"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEBVIEW_GET_SECURITY_STATE_CHANNEL = exports.WEBVIEW_SECURITY_STATE_CHANNEL = void 0;
exports.trackGuestSecurityState = trackGuestSecurityState;
exports.getGuestSecurityStateForOwner = getGuestSecurityStateForOwner;
exports.isSecurityTrackableContents = isSecurityTrackableContents;
exports.resetTrackedGuestSecurityStateForTesting = resetTrackedGuestSecurityStateForTesting;
const electron_1 = require("electron");
const guestDebugger_1 = require("./guestDebugger");
/** IPC channel that pushes a guest's connection security state to its host. */
exports.WEBVIEW_SECURITY_STATE_CHANNEL = 'webview:security-state-changed';
/** IPC invoke channel that returns a guest's latest connection security state. */
exports.WEBVIEW_GET_SECURITY_STATE_CHANNEL = 'webview:get-security-state';
/** Document responses remembered per guest while waiting for their commit. */
const MAX_PENDING_DOCUMENT_RESPONSES = 8;
/** Chromium `net::ERR_ABORTED`, reported for cancelled loads and downloads. */
const NET_ERROR_ABORTED = -3;
const trackedGuests = new Map();
let nextSeq = 1;
function mapCdpSecurityState(securityState) {
    switch (securityState) {
        case 'secure':
            return 'secure';
        case 'insecure':
            return 'insecure';
        case 'insecure-broken':
            return 'dangerous';
        default:
            return 'neutral';
    }
}
/**
 * Converts a CDP main-frame Document response into security details. Only a
 * response with TLS `securityDetails` counts as `secure`: Chromium also reports
 * plaintext secure contexts such as `http://127.0.0.1` as `secure`.
 */
function securityDetailsFromCdpResponse(response) {
    const level = mapCdpSecurityState(response.securityState);
    const details = response.securityDetails;
    if (!details) {
        return { level: level === 'secure' ? 'neutral' : level };
    }
    return {
        level,
        certificate: {
            subjectName: details.subjectName ?? '',
            issuer: details.issuer ?? '',
            validFromMs: (details.validFrom ?? 0) * 1000,
            validToMs: (details.validTo ?? 0) * 1000,
            ...(details.protocol ? { protocol: details.protocol } : {}),
        },
    };
}
/** Converts a rejected certificate into `dangerous` security details. */
function securityDetailsFromCertificateError(error, certificate) {
    return {
        level: 'dangerous',
        certificateError: error,
        ...(certificate
            ? {
                certificate: {
                    subjectName: certificate.subjectName ?? '',
                    issuer: certificate.issuerName ?? '',
                    validFromMs: (certificate.validStart ?? 0) * 1000,
                    validToMs: (certificate.validExpiry ?? 0) * 1000,
                },
            }
            : {}),
    };
}
/**
 * Returns `url` without its fragment: CDP reports document responses without
 * it, while `did-navigate` keeps it.
 */
function documentKey(url) {
    const hashIndex = url.indexOf('#');
    return hashIndex === -1 ? url : url.slice(0, hashIndex);
}
/**
 * Tracks the connection security of `contents`' committed main-frame document
 * from Chromium's network stack and reports every change to `onChange`.
 *
 * Electron does not emit CDP `Security.visibleSecurityStateChanged`, so the
 * state comes from the main-frame `Network.responseReceived` (TLS state and
 * certificate) and the `certificate-error` event (rejected certificates). The
 * page cannot influence it. Shares `contents.debugger` with other main-process
 * CDP clients under the rules of {@link ensureGuestDebuggerAttached}; after
 * something else detaches it, re-attaches when the next navigation starts.
 * Idempotent per `WebContents`.
 */
function trackGuestSecurityState(contents, options) {
    const webContentsId = contents.id;
    // A destroyed guest never emits 'destroyed', so it would never be untracked.
    if (contents.isDestroyed() || trackedGuests.has(webContentsId)) {
        return;
    }
    ensureGetStateHandlerRegistered();
    const guest = {
        ownerId: options.ownerId,
        state: { webContentsId, seq: nextSeq++, url: '', level: 'neutral' },
    };
    trackedGuests.set(webContentsId, guest);
    const publish = (url, details) => {
        guest.state = { ...details, webContentsId, seq: nextSeq++, url };
        options.onChange(guest.state);
    };
    let mainFrameId;
    let committedUrl = '';
    const pendingDocumentResponses = new Map();
    let pendingCertificateError;
    const dbg = contents.debugger;
    const enableNetworkTracking = () => {
        if (!(0, guestDebugger_1.ensureGuestDebuggerAttached)(dbg)) {
            return;
        }
        void dbg
            .sendCommand('Network.enable', {
            maxTotalBufferSize: 0,
            maxResourceBufferSize: 0,
        })
            .catch(() => undefined);
        void dbg
            .sendCommand('Page.getFrameTree')
            .then((result) => {
            mainFrameId = result
                ?.frameTree?.frame?.id;
        })
            .catch(() => undefined);
    };
    enableNetworkTracking();
    dbg.on('message', (_event, method, params) => {
        if (method !== 'Network.responseReceived' ||
            params?.type !== 'Document' ||
            !params.response?.url ||
            (mainFrameId !== undefined && params.frameId !== mainFrameId)) {
            return;
        }
        const key = documentKey(params.response.url);
        const details = securityDetailsFromCdpResponse(params.response);
        pendingDocumentResponses.delete(key);
        pendingDocumentResponses.set(key, details);
        if (pendingDocumentResponses.size > MAX_PENDING_DOCUMENT_RESPONSES) {
            const oldest = pendingDocumentResponses.keys().next().value;
            if (oldest !== undefined) {
                pendingDocumentResponses.delete(oldest);
            }
        }
        // The response can arrive after `did-navigate` when the debugger was
        // still enabling the Network domain during the first navigation.
        if (committedUrl && key === documentKey(committedUrl)) {
            publish(committedUrl, details);
        }
    });
    dbg.on('detach', () => {
        // No responses arrive while detached, so remembered ones would go stale.
        pendingDocumentResponses.clear();
        if (!contents.isDestroyed() && committedUrl) {
            publish(committedUrl, { level: 'neutral' });
        }
    });
    contents.on('certificate-error', (_event, url, error, certificate, _callback, isMainFrame) => {
        // Leaves the default (reject) behavior in place; only records it.
        if (isMainFrame === false) {
            return;
        }
        pendingCertificateError = {
            url,
            details: securityDetailsFromCertificateError(error, certificate),
        };
    });
    // A detach also drops the Network domain. Re-enable it before the next
    // document response, which arrives after `did-start-navigation`.
    contents.on('did-start-navigation', () => {
        if (!contents.isDestroyed() && !dbg.isAttached()) {
            enableNetworkTracking();
        }
    });
    contents.on('did-navigate', (_event, url) => {
        committedUrl = url;
        pendingCertificateError = undefined;
        publish(url, pendingDocumentResponses.get(documentKey(url)) ?? { level: 'neutral' });
    });
    contents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
        if (isMainFrame === false) {
            return;
        }
        // Same-document navigations keep the document's connection.
        committedUrl = url;
        const { level, certificate, certificateError } = guest.state;
        publish(url, { level, certificate, certificateError });
    });
    contents.on('did-fail-load', (_event, errorCode, _errorDescription, validatedUrl, isMainFrame) => {
        if (isMainFrame === false || errorCode === NET_ERROR_ABORTED) {
            return;
        }
        committedUrl = validatedUrl;
        const certificateError = pendingCertificateError &&
            documentKey(pendingCertificateError.url) === documentKey(validatedUrl)
            ? pendingCertificateError.details
            : undefined;
        pendingCertificateError = undefined;
        publish(validatedUrl, certificateError ?? { level: 'neutral' });
    });
    contents.on('destroyed', () => {
        trackedGuests.delete(webContentsId);
    });
}
/**
 * Returns the latest security state of guest `webContentsId` when
 * `requesterId` is the renderer that owns it, else `null`.
 */
function getGuestSecurityStateForOwner(webContentsId, requesterId) {
    if (typeof webContentsId !== 'number') {
        return null;
    }
    const guest = trackedGuests.get(webContentsId);
    if (!guest || guest.ownerId === undefined || guest.ownerId !== requesterId) {
        return null;
    }
    return guest.state;
}
let getStateHandlerRegistered = false;
/**
 * Registers the {@link WEBVIEW_GET_SECURITY_STATE_CHANNEL} invoke handler the
 * first time a guest is tracked.
 */
function ensureGetStateHandlerRegistered() {
    if (getStateHandlerRegistered) {
        return;
    }
    getStateHandlerRegistered = true;
    electron_1.ipcMain.handle(exports.WEBVIEW_GET_SECURITY_STATE_CHANNEL, (event, webContentsId) => getGuestSecurityStateForOwner(webContentsId, event.sender.id));
}
/**
 * Returns `true` when `contents` exposes what {@link trackGuestSecurityState}
 * needs (every real `WebContents` does).
 */
function isSecurityTrackableContents(contents) {
    const candidate = contents;
    return (typeof candidate?.id === 'number' &&
        typeof candidate.on === 'function' &&
        typeof candidate.isDestroyed === 'function' &&
        typeof candidate.debugger?.attach === 'function' &&
        typeof candidate.debugger.isAttached === 'function' &&
        typeof candidate.debugger.sendCommand === 'function' &&
        typeof candidate.debugger.on === 'function');
}
/** Clears tracked guests; for tests only. */
function resetTrackedGuestSecurityStateForTesting() {
    trackedGuests.clear();
    nextSeq = 1;
    getStateHandlerRegistered = false;
}
