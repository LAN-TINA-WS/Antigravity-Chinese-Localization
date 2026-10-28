"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POPUP_USER_ACTIVATION_WINDOW_MS = exports.MIN_POPUP_INTERVAL_MS = exports.MAX_CONCURRENT_POPUPS_PER_WEBVIEW = exports.WEBVIEW_OPEN_NEW_TAB_CHANNEL = void 0;
exports.isExternalOnlyAuthUrl = isExternalOnlyAuthUrl;
exports.validateWebviewNavigationUrl = validateWebviewNavigationUrl;
exports.isPopupWindowRequest = isPopupWindowRequest;
exports.parsePopupWindowDimensions = parsePopupWindowDimensions;
exports.configureWebviewBrowserContents = configureWebviewBrowserContents;
const electron_1 = require("electron");
const utils_1 = require("./utils");
/** IPC channel sent to the host renderer when a `<webview>` requests a new tab. */
exports.WEBVIEW_OPEN_NEW_TAB_CHANNEL = 'webview:open-new-tab';
const DEFAULT_POPUP_WIDTH = 520;
const DEFAULT_POPUP_HEIGHT = 680;
const MIN_POPUP_WIDTH = 360;
const MAX_POPUP_WIDTH = 1280;
const MIN_POPUP_HEIGHT = 400;
const MAX_POPUP_HEIGHT = 960;
/** Maximum concurrent child popup windows allowed per `<webview>` guest. */
exports.MAX_CONCURRENT_POPUPS_PER_WEBVIEW = 2;
/** Minimum interval (ms) between child popup creations from the same `<webview>`. */
exports.MIN_POPUP_INTERVAL_MS = 500;
/** Maximum age (ms) of a user input event on a `<webview>` to authorize a popup. */
exports.POPUP_USER_ACTIVATION_WINDOW_MS = 5000;
/**
 * Matches Google OAuth / Sign-In paths on `accounts.google.com` (with or
 * without an account-chooser prefix `/u/<index>`) that block embedded WebViews
 * and must be routed to the system browser via `shell.openExternal`.
 */
const EXTERNAL_ONLY_OAUTH_PATH_RE = /^(?:\/u\/\d+)?\/(?:o\/oauth2|signin\/oauth)(?:\/|$)/;
const BLOCKED_METADATA_HOSTS = new Set([
    'metadata.google.internal',
    'metadata.goog',
]);
/**
 * Returns `true` when `rawUrl` is a Google OAuth endpoint on
 * `accounts.google.com` (`/o/oauth2/...`, `/signin/oauth/...`, or `/u/N/...`)
 * that must open in the user's system browser via `shell.openExternal`.
 */
function isExternalOnlyAuthUrl(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            return false;
        }
        if (parsed.hostname.toLowerCase() !== 'accounts.google.com') {
            return false;
        }
        return EXTERNAL_ONLY_OAUTH_PATH_RE.test(parsed.pathname);
    }
    catch {
        return false;
    }
}
function normalizeHostname(rawHostname) {
    return rawHostname
        .trim()
        .replace(/^\[|\]$/g, '')
        .replace(/\.+$/, '')
        .toLowerCase();
}
function parseIpv4Octets(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) {
        return null;
    }
    const octets = [];
    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part)) {
            return null;
        }
        const n = Number(part);
        if (n < 0 || n > 255) {
            return null;
        }
        octets.push(n);
    }
    return [octets[0], octets[1], octets[2], octets[3]];
}
function parseIpv6Groups(host) {
    if (!host.includes(':')) {
        return null;
    }
    const doubleColonParts = host.split('::');
    if (doubleColonParts.length > 2) {
        return null;
    }
    const parseSide = (side, allowTrailingIpv4) => {
        if (side === '') {
            return [];
        }
        const tokens = side.split(':');
        const groups = [];
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (allowTrailingIpv4 && i === tokens.length - 1 && token.includes('.')) {
                const octets = parseIpv4Octets(token);
                if (!octets) {
                    return null;
                }
                groups.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
            }
            else {
                if (!/^[0-9a-f]{1,4}$/i.test(token)) {
                    return null;
                }
                groups.push(parseInt(token, 16));
            }
        }
        return groups;
    };
    if (doubleColonParts.length === 1) {
        const groups = parseSide(doubleColonParts[0], true);
        return groups && groups.length === 8 ? groups : null;
    }
    const left = parseSide(doubleColonParts[0], false);
    const right = parseSide(doubleColonParts[1], true);
    if (!left || !right || left.length + right.length >= 8) {
        return null;
    }
    const missing = 8 - left.length - right.length;
    return [...left, ...new Array(missing).fill(0), ...right];
}
function extractMappedIpv4FromIpv6(host) {
    const groups = parseIpv6Groups(host);
    if (!groups) {
        return null;
    }
    const firstFiveZero = groups[0] === 0 &&
        groups[1] === 0 &&
        groups[2] === 0 &&
        groups[3] === 0 &&
        groups[4] === 0;
    if (!firstFiveZero) {
        return null;
    }
    const isIpv4Mapped = groups[5] === 0xffff;
    const isIpv4Compatible = groups[5] === 0 &&
        !(groups[6] === 0 && (groups[7] === 0 || groups[7] === 1));
    if (!isIpv4Mapped && !isIpv4Compatible) {
        return null;
    }
    return [
        (groups[6] >> 8) & 0xff,
        groups[6] & 0xff,
        (groups[7] >> 8) & 0xff,
        groups[7] & 0xff,
    ];
}
function isLinkLocalHost(hostname) {
    const host = normalizeHostname(hostname);
    const v4 = parseIpv4Octets(host) ?? extractMappedIpv4FromIpv6(host);
    if (v4) {
        return v4[0] === 169 && v4[1] === 254;
    }
    const groups = parseIpv6Groups(host);
    if (groups) {
        return (groups[0] & 0xffc0) === 0xfe80;
    }
    return false;
}
function isLoopbackHost(hostname) {
    const host = normalizeHostname(hostname);
    if (host === 'localhost' || host.endsWith('.localhost')) {
        return true;
    }
    const v4 = parseIpv4Octets(host) ?? extractMappedIpv4FromIpv6(host);
    if (v4) {
        return v4[0] === 127 || v4[0] === 0;
    }
    const groups = parseIpv6Groups(host);
    if (groups) {
        const firstSevenZero = groups[0] === 0 &&
            groups[1] === 0 &&
            groups[2] === 0 &&
            groups[3] === 0 &&
            groups[4] === 0 &&
            groups[5] === 0 &&
            groups[6] === 0;
        return firstSevenZero && (groups[7] === 0 || groups[7] === 1);
    }
    return false;
}
function isPrivateNetworkHost(hostname) {
    const host = normalizeHostname(hostname);
    const v4 = parseIpv4Octets(host) ?? extractMappedIpv4FromIpv6(host);
    if (v4) {
        return (v4[0] === 10 ||
            (v4[0] === 172 && v4[1] >= 16 && v4[1] <= 31) ||
            (v4[0] === 192 && v4[1] === 168));
    }
    const groups = parseIpv6Groups(host);
    if (groups) {
        return (groups[0] & 0xfe00) === 0xfc00;
    }
    return false;
}
function isLoopbackOrigin(originOrUrl) {
    if (!originOrUrl || originOrUrl === 'null') {
        return false;
    }
    try {
        const parsed = new URL(originOrUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false;
        }
        return isLoopbackHost(parsed.hostname);
    }
    catch {
        return false;
    }
}
/**
 * Validates a `<webview>` or child popup target URL against the Hub browser
 * navigation policy:
 * - Only `http:` and `https:` URLs are permitted.
 * - Cloud metadata hosts (`metadata.google.internal`, `*.metadata.google.internal`,
 *   `metadata.goog`, `*.metadata.goog`) and link-local addresses
 *   (`169.254.0.0/16`, `fe80::/10`) are always blocked.
 * - Loopback (`localhost`, `127.0.0.0/8`, `0.0.0.0/8`, `::1`, `::`) and
 *   private RFC1918 / IPv6 ULA ranges (`10.0.0.0/8`, `172.16.0.0/12`,
 *   `192.168.0.0/16`, `fc00::/7`) are blocked unless initiated from a
 *   loopback opener origin.
 */
function validateWebviewNavigationUrl(rawUrl, openerOrigin) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    }
    catch {
        return { allowed: false, reason: 'Invalid URL' };
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return {
            allowed: false,
            reason: `Disallowed URL protocol: ${parsed.protocol}`,
        };
    }
    const host = normalizeHostname(parsed.hostname);
    if (!host) {
        return { allowed: false, reason: 'Empty hostname' };
    }
    if (BLOCKED_METADATA_HOSTS.has(host) ||
        host.endsWith('.metadata.google.internal') ||
        host.endsWith('.metadata.goog') ||
        isLinkLocalHost(host)) {
        return {
            allowed: false,
            reason: `Blocked cloud metadata or link-local host: ${host}`,
        };
    }
    if (isLoopbackHost(host) || isPrivateNetworkHost(host)) {
        if (!isLoopbackOrigin(openerOrigin)) {
            return {
                allowed: false,
                reason: `Cross-origin navigation from remote origin to local/private host "${host}" is blocked`,
            };
        }
    }
    return { allowed: true };
}
/**
 * Returns `true` when a `window.open()` request explicitly specifies popup
 * window features (`width=`, `height=`, `left=`, `top=`, or `popup`) rather
 * than a standard tab navigation (including Shift-click `new-window` without
 * popup features).
 */
function isPopupWindowRequest(details) {
    const features = details.features || '';
    if (/\b(?:width|height|left|top)\s*=\s*\d+/i.test(features)) {
        return true;
    }
    if (/\bpopup\s*=\s*(?:0|no|false)\b/i.test(features)) {
        return false;
    }
    return /\bpopup(?:\s*=\s*(?:1|yes|true))?\b/i.test(features);
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
/**
 * Parses `width` and `height` from a `window.open()` `features` string,
 * clamping to safe desktop popup dimensions.
 */
function parsePopupWindowDimensions(features) {
    const widthMatch = /\bwidth\s*=\s*(\d+)/i.exec(features);
    const heightMatch = /\bheight\s*=\s*(\d+)/i.exec(features);
    const parsedWidth = widthMatch ? Number(widthMatch[1]) : NaN;
    const parsedHeight = heightMatch ? Number(heightMatch[1]) : NaN;
    return {
        width: Number.isFinite(parsedWidth)
            ? clamp(parsedWidth, MIN_POPUP_WIDTH, MAX_POPUP_WIDTH)
            : DEFAULT_POPUP_WIDTH,
        height: Number.isFinite(parsedHeight)
            ? clamp(parsedHeight, MIN_POPUP_HEIGHT, MAX_POPUP_HEIGHT)
            : DEFAULT_POPUP_HEIGHT,
    };
}
function isBlankPopupUrl(url) {
    return url === '' || /^about:blank(?:[?#].*)?$/i.test(url);
}
function extractHttpOrigin(rawUrl) {
    if (!rawUrl || isBlankPopupUrl(rawUrl)) {
        return undefined;
    }
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.origin;
        }
    }
    catch {
        // Non-URL strings are ignored.
    }
    return undefined;
}
function isMainFrameNavigationEvent(event, isMainFrameArg) {
    if (typeof isMainFrameArg === 'boolean') {
        return isMainFrameArg;
    }
    if (typeof event?.isMainFrame === 'boolean') {
        return event.isMainFrame;
    }
    return true;
}
function formatOriginPrefix(rawUrl) {
    if (!rawUrl) {
        return '[about:blank]';
    }
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return `[${parsed.origin}]`;
        }
    }
    catch {
        // Fall through to about:blank prefix.
    }
    return '[about:blank]';
}
function formatPopupWindowTitle(rawUrl, pageTitle) {
    const prefix = formatOriginPrefix(rawUrl);
    const trimmedTitle = pageTitle?.trim();
    if (!trimmedTitle || trimmedTitle === prefix) {
        return prefix;
    }
    if (trimmedTitle.startsWith(`${prefix} `)) {
        return trimmedTitle;
    }
    return `${prefix} ${trimmedTitle}`;
}
const configuredWebviewContents = new WeakSet();
/**
 * Configures a `<webview>` guest `WebContents` to:
 * 1. Route external-only Google OAuth endpoints (`accounts.google.com/o/oauth2/*`
 *    and `/signin/oauth/*`) to the system browser via `shell.openExternal`.
 * 2. Open explicit popup windows (`window.open(..., 'width=...,height=...')`)
 *    in hardened child `BrowserWindow`s (preserving `window.opener`, enforcing
 *    user activation, rate limits, concurrency caps, origin-prefixed title
 *    bars, and private-network URL validation).
 * 3. Route standard tab navigations (`target="_blank"`, Shift-click) to the
 *    built-in browser tab strip via `webview:open-new-tab`.
 */
function configureWebviewBrowserContents(contents, options) {
    if (!contents ||
        contents.getType() !== 'webview' ||
        configuredWebviewContents.has(contents)) {
        return;
    }
    configuredWebviewContents.add(contents);
    const guestSession = contents.session;
    const host = contents.hostWebContents;
    const webContentsId = contents.id;
    const openExternal = options?.openExternal ?? ((url) => electron_1.shell.openExternal(url));
    const now = options?.now ?? (() => Date.now());
    const getParentWindow = options?.getParentWindow ??
        (() => {
            if (host && typeof electron_1.BrowserWindow?.fromWebContents === 'function') {
                const fromHost = electron_1.BrowserWindow.fromWebContents(host);
                if (fromHost) {
                    return fromHost;
                }
            }
            return electron_1.BrowserWindow?.getFocusedWindow?.() ?? undefined;
        });
    let lastUserActivationMs = 0;
    let lastPopupOpenedMs = 0;
    let lastPopupInitialUrl = '';
    let lastPopupOpenerOrigin;
    let hasCommittedWebviewNavigation = false;
    let inFlightWebviewOrigin;
    const activePopups = new Set();
    contents.on?.('before-input-event', () => {
        lastUserActivationMs = now();
    });
    contents.on?.('input-event', (_event, inputEvent) => {
        const type = inputEvent?.type;
        if (!type ||
            type === 'mouseDown' ||
            type === 'mouseUp' ||
            type === 'rawKeyDown' ||
            type === 'keyDown' ||
            type === 'char' ||
            type === 'gestureTap') {
            lastUserActivationMs = now();
        }
    });
    contents.on?.('destroyed', () => {
        for (const popup of activePopups) {
            try {
                popup.close?.();
            }
            catch {
                // Ignore errors when closing already-destroyed child popups.
            }
        }
        activePopups.clear();
    });
    const getOpenerOrigin = (details) => {
        const frameOrigin = details?.frame?.origin;
        if (frameOrigin === 'null') {
            return 'null';
        }
        const mainFrame = contents.mainFrame;
        const mainFrameHasUncommittedBlankUrl = typeof mainFrame?.url === 'string' && isBlankPopupUrl(mainFrame.url);
        if (mainFrame?.origin === 'null' && !mainFrameHasUncommittedBlankUrl) {
            return 'null';
        }
        if (frameOrigin) {
            return frameOrigin;
        }
        if (mainFrame?.origin && mainFrame.origin !== 'null') {
            return mainFrame.origin;
        }
        const currentUrl = contents.getURL?.();
        if (currentUrl && !isBlankPopupUrl(currentUrl)) {
            return currentUrl;
        }
        return details?.referrer?.url;
    };
    const forwardNewTabToHost = (url) => {
        if (host && !host.isDestroyed()) {
            host.send(exports.WEBVIEW_OPEN_NEW_TAB_CHANNEL, url, webContentsId);
        }
    };
    contents.on?.('did-start-navigation', (event, navigationUrl, _isInPlace, isMainFrameArg) => {
        if (isMainFrameNavigationEvent(event, isMainFrameArg) &&
            !inFlightWebviewOrigin) {
            inFlightWebviewOrigin = extractHttpOrigin(navigationUrl);
        }
    });
    contents.on?.('did-navigate', (_event, navigationUrl) => {
        inFlightWebviewOrigin = undefined;
        if (!isBlankPopupUrl(navigationUrl)) {
            hasCommittedWebviewNavigation = true;
        }
    });
    const createWebviewNavigationListener = (isRedirect) => (event, navigationUrl, _isInPlace, isMainFrameArg) => {
        const isMainFrame = isMainFrameNavigationEvent(event, isMainFrameArg);
        if (isExternalOnlyAuthUrl(navigationUrl)) {
            event.preventDefault();
            if (isMainFrame) {
                void openExternal(navigationUrl);
            }
            return;
        }
        const baseOrigin = getOpenerOrigin();
        let validationOrigin;
        if (baseOrigin !== undefined) {
            validationOrigin =
                isRedirect &&
                    inFlightWebviewOrigin &&
                    !isLoopbackOrigin(inFlightWebviewOrigin)
                    ? inFlightWebviewOrigin
                    : baseOrigin;
        }
        else if (!hasCommittedWebviewNavigation) {
            validationOrigin =
                isRedirect && inFlightWebviewOrigin
                    ? inFlightWebviewOrigin
                    : extractHttpOrigin(navigationUrl);
        }
        if (!validateWebviewNavigationUrl(navigationUrl, validationOrigin).allowed) {
            event.preventDefault();
            return;
        }
        if (isMainFrame) {
            inFlightWebviewOrigin = extractHttpOrigin(navigationUrl);
        }
    };
    contents.on?.('will-navigate', createWebviewNavigationListener(false));
    contents.on?.('will-redirect', createWebviewNavigationListener(true));
    contents.setWindowOpenHandler((details) => {
        if (isExternalOnlyAuthUrl(details.url)) {
            void openExternal(details.url);
            return { action: 'deny' };
        }
        const openerOrigin = getOpenerOrigin(details);
        const blankPopup = isBlankPopupUrl(details.url);
        const urlValidation = blankPopup
            ? { allowed: true }
            : validateWebviewNavigationUrl(details.url, openerOrigin);
        if (isPopupWindowRequest(details)) {
            if (!urlValidation.allowed) {
                return { action: 'deny' };
            }
            const currentTime = now();
            if (lastUserActivationMs <= 0 ||
                currentTime - lastUserActivationMs > exports.POPUP_USER_ACTIVATION_WINDOW_MS) {
                return { action: 'deny' };
            }
            if (activePopups.size >= exports.MAX_CONCURRENT_POPUPS_PER_WEBVIEW) {
                return { action: 'deny' };
            }
            if (lastPopupOpenedMs > 0 &&
                currentTime - lastPopupOpenedMs < exports.MIN_POPUP_INTERVAL_MS) {
                return { action: 'deny' };
            }
            lastPopupOpenedMs = currentTime;
            lastPopupInitialUrl = details.url;
            lastPopupOpenerOrigin = openerOrigin;
            const { width, height } = parsePopupWindowDimensions(details.features || '');
            const parentWindow = getParentWindow() ?? undefined;
            let x;
            let y;
            if (parentWindow &&
                !parentWindow.isDestroyed?.() &&
                typeof parentWindow.getBounds === 'function') {
                const bounds = parentWindow.getBounds();
                if (bounds &&
                    Number.isFinite(bounds.x) &&
                    Number.isFinite(bounds.y) &&
                    Number.isFinite(bounds.width) &&
                    Number.isFinite(bounds.height)) {
                    x = Math.round(bounds.x + Math.max(0, (bounds.width - width) / 2));
                    y = Math.round(bounds.y + Math.max(0, (bounds.height - height) / 2));
                }
            }
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    width,
                    height,
                    x: x ?? 120,
                    y: y ?? 80,
                    ...(parentWindow && !parentWindow.isDestroyed?.()
                        ? { parent: parentWindow }
                        : {}),
                    title: formatPopupWindowTitle(details.url),
                    titleBarStyle: 'default',
                    frame: true,
                    modal: false,
                    show: true,
                    movable: true,
                    resizable: true,
                    maximizable: true,
                    minimizable: true,
                    closable: true,
                    focusable: true,
                    hasShadow: true,
                    roundedCorners: true,
                    thickFrame: true,
                    type: 'normal',
                    autoHideMenuBar: true,
                    fullscreen: false,
                    fullscreenable: false,
                    kiosk: false,
                    alwaysOnTop: false,
                    transparent: false,
                    opacity: 1,
                    skipTaskbar: false,
                    webPreferences: {
                        sandbox: true,
                        contextIsolation: true,
                        nodeIntegration: false,
                        nodeIntegrationInWorker: false,
                        nodeIntegrationInSubFrames: false,
                        webviewTag: false,
                        navigateOnDragDrop: false,
                        enableBlinkFeatures: '',
                        session: guestSession,
                    },
                },
            };
        }
        if (!blankPopup && urlValidation.allowed) {
            forwardNewTabToHost(details.url);
        }
        return { action: 'deny' };
    });
    contents.on?.('did-create-window', (childWindow, details) => {
        (0, utils_1.markWebviewPopupWindow)(childWindow);
        activePopups.add(childWindow);
        const cleanupPopup = () => {
            activePopups.delete(childWindow);
        };
        const closePopupIfOpen = () => {
            if (!childWindow.isDestroyed?.()) {
                childWindow.close?.();
            }
        };
        childWindow.once?.('closed', cleanupPopup);
        childWindow.webContents?.once?.('destroyed', cleanupPopup);
        const initialOpenerOrigin = lastPopupOpenerOrigin ?? getOpenerOrigin();
        const initialRequestedUrl = details?.url ||
            childWindow.webContents?.getURL?.() ||
            lastPopupInitialUrl;
        const initialPopupOrigin = extractHttpOrigin(initialRequestedUrl);
        let hasCommittedFirstNavigation = false;
        let currentPopupUrl = initialRequestedUrl;
        let inFlightMainFrameOrigin;
        childWindow.setTitle?.(formatPopupWindowTitle(currentPopupUrl));
        childWindow.on?.('page-title-updated', (event, title) => {
            event.preventDefault();
            const displayUrl = !isBlankPopupUrl(currentPopupUrl)
                ? currentPopupUrl
                : childWindow.webContents?.getURL?.() || currentPopupUrl;
            childWindow.setTitle?.(formatPopupWindowTitle(displayUrl, title));
        });
        const getPopupBaseValidationOrigin = () => {
            if (hasCommittedFirstNavigation) {
                return extractHttpOrigin(currentPopupUrl) ?? 'null';
            }
            if (initialPopupOrigin && !isLoopbackOrigin(initialPopupOrigin)) {
                return initialPopupOrigin;
            }
            if (initialOpenerOrigin && !isLoopbackOrigin(initialOpenerOrigin)) {
                return initialOpenerOrigin;
            }
            return initialPopupOrigin ?? initialOpenerOrigin;
        };
        const createChildNavigationListener = (isRedirect) => (event, navigationUrl, _isInPlace, isMainFrameArg) => {
            const isMainFrame = isMainFrameNavigationEvent(event, isMainFrameArg);
            if (isExternalOnlyAuthUrl(navigationUrl)) {
                event.preventDefault();
                if (isMainFrame) {
                    void openExternal(navigationUrl);
                    closePopupIfOpen();
                }
                return;
            }
            const baseOrigin = getPopupBaseValidationOrigin();
            const validationOrigin = isRedirect &&
                inFlightMainFrameOrigin &&
                !isLoopbackOrigin(inFlightMainFrameOrigin)
                ? inFlightMainFrameOrigin
                : baseOrigin;
            if (!validateWebviewNavigationUrl(navigationUrl, validationOrigin)
                .allowed) {
                event.preventDefault();
                if (isMainFrame && !hasCommittedFirstNavigation) {
                    closePopupIfOpen();
                }
                return;
            }
            if (isMainFrame) {
                inFlightMainFrameOrigin = extractHttpOrigin(navigationUrl);
            }
        };
        childWindow.webContents?.on?.('will-navigate', createChildNavigationListener(false));
        childWindow.webContents?.on?.('will-redirect', createChildNavigationListener(true));
        childWindow.webContents?.on?.('did-navigate', (_event, navigationUrl) => {
            if (isBlankPopupUrl(navigationUrl) && !hasCommittedFirstNavigation) {
                return;
            }
            inFlightMainFrameOrigin = undefined;
            currentPopupUrl = navigationUrl;
            if (!isBlankPopupUrl(navigationUrl)) {
                hasCommittedFirstNavigation = true;
            }
            childWindow.setTitle?.(formatPopupWindowTitle(navigationUrl));
        });
        childWindow.webContents?.on?.('did-navigate-in-page', (event, navigationUrl, isMainFrameArg) => {
            if (!isMainFrameNavigationEvent(event, isMainFrameArg)) {
                return;
            }
            currentPopupUrl = navigationUrl;
            childWindow.setTitle?.(formatPopupWindowTitle(navigationUrl));
        });
        childWindow.webContents?.setWindowOpenHandler?.((nestedDetails) => {
            if (isExternalOnlyAuthUrl(nestedDetails.url)) {
                void openExternal(nestedDetails.url);
                return { action: 'deny' };
            }
            const openerOrigin = getPopupBaseValidationOrigin();
            if (!isBlankPopupUrl(nestedDetails.url) &&
                validateWebviewNavigationUrl(nestedDetails.url, openerOrigin).allowed) {
                forwardNewTabToHost(nestedDetails.url);
            }
            return { action: 'deny' };
        });
    });
}
