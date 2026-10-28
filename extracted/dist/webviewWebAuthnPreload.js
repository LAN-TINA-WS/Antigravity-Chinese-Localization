"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEBAUTHN_MAIN_WORLD_BRIDGE_KEY = void 0;
exports.isTopLevelWebAuthnFrame = isTopLevelWebAuthnFrame;
exports.shouldUseCableWebAuthnAssertion = shouldUseCableWebAuthnAssertion;
exports.isUnfulfillableWebAuthnAssertion = isUnfulfillableWebAuthnAssertion;
exports.buildWebviewWebAuthnMainWorldScript = buildWebviewWebAuthnMainWorldScript;
const electron_1 = require("electron");
/** Global bridge key exposed from the `<webview>` preload to the main world. */
exports.WEBAUTHN_MAIN_WORLD_BRIDGE_KEY = '__antigravityWebAuthn';
const WEBAUTHN_CABLE_AVAILABLE_CHANNEL = 'webauthn:cable-available';
const WEBAUTHN_CABLE_GET_ASSERTION_CHANNEL = 'webauthn:cable-get-assertion';
const WEBAUTHN_CABLE_CANCEL_ASSERTION_CHANNEL = 'webauthn:cable-cancel-assertion';
/**
 * Returns `true` when the preload is executing in a top-level frame rather
 * than an embedded `<iframe>` subframe.
 */
function isTopLevelWebAuthnFrame(frame = electron_1.webFrame, win = globalThis.window) {
    if (win &&
        typeof win === 'object' &&
        'top' in win &&
        win.top !== null &&
        win.top !== undefined) {
        return win.top === win;
    }
    if (frame &&
        typeof frame === 'object' &&
        'top' in frame &&
        frame.top !== null &&
        frame.top !== undefined) {
        const topObj = frame.top;
        if (typeof frame.routingId === 'number' &&
            topObj &&
            typeof topObj === 'object' &&
            typeof topObj.routingId === 'number') {
            return topObj.routingId === frame.routingId;
        }
        return frame.top === frame;
    }
    return true;
}
/**
 * Returns `true` when a `navigator.credentials.get({ publicKey })` request
 * should be fulfilled via the Hub's macOS `caBLEv2` (QR + BLE + tunnel)
 * initiator rather than Electron's native authenticator discovery.
 */
function shouldUseCableWebAuthnAssertion(options, hasPlatformAuthenticator, hasCableSupport) {
    if (!hasCableSupport ||
        !options ||
        typeof options !== 'object' ||
        !options.publicKey) {
        return false;
    }
    if (options.mediation === 'conditional') {
        return false;
    }
    const allow = options.publicKey.allowCredentials;
    if (!Array.isArray(allow) || allow.length === 0) {
        return !hasPlatformAuthenticator;
    }
    if (hasPlatformAuthenticator &&
        allow.some((c) => !Array.isArray(c?.transports) ||
            c.transports.length === 0 ||
            c.transports.includes('internal'))) {
        return false;
    }
    return allow.some((cred) => {
        const transports = cred?.transports;
        if (!Array.isArray(transports) || transports.length === 0) {
            return true;
        }
        return transports.some((t) => t === 'hybrid' || t === 'cable');
    });
}
/**
 * Returns `true` when a `navigator.credentials.get()` request in an Electron
 * `<webview>` cannot be satisfied by any local authenticator and `caBLEv2` is
 * unavailable, so failing fast with `NotAllowedError` avoids a silent
 * 180-second `FidoHidDiscovery` hang.
 */
function isUnfulfillableWebAuthnAssertion(options, hasPlatformAuthenticator) {
    if (!options || typeof options !== 'object' || !options.publicKey) {
        return false;
    }
    if (options.mediation === 'conditional' && !hasPlatformAuthenticator) {
        return true;
    }
    const allow = options.publicKey.allowCredentials;
    if (!Array.isArray(allow) || allow.length === 0) {
        return false;
    }
    return allow.every((cred) => {
        const transports = cred?.transports;
        if (!Array.isArray(transports) || transports.length === 0) {
            return false;
        }
        return transports.every((t) => t === 'hybrid' ||
            t === 'cable' ||
            (t === 'internal' && !hasPlatformAuthenticator));
    });
}
/**
 * Builds the self-contained main-world script injected into top-level
 * `<webview>` frames to report WebAuthn capabilities, route cross-device
 * passkey assertions to the macOS `caBLEv2` initiator, and fail fast on
 * unfulfillable assertions.
 */
function buildWebviewWebAuthnMainWorldScript() {
    return `(() => {
  if (
    typeof window === 'undefined' ||
    (window.top && window.top !== window) ||
    !window.PublicKeyCredential
  ) {
    return;
  }
  const PublicKeyCredentialCtor = window.PublicKeyCredential;
  const patchFlag = Symbol.for('antigravity.webviewWebAuthnPatched');
  if (PublicKeyCredentialCtor[patchFlag]) {
    return;
  }
  Object.defineProperty(PublicKeyCredentialCtor, patchFlag, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  const bridge = window[${JSON.stringify(exports.WEBAUTHN_MAIN_WORLD_BRIDGE_KEY)}];
  let cableAvailablePromise = null;
  async function resolveHasCable() {
    if (!bridge) {
      return false;
    }
    if (typeof bridge.checkCableAvailable === 'function') {
      if (!cableAvailablePromise) {
        cableAvailablePromise = Promise.resolve(bridge.checkCableAvailable())
          .then((v) => Boolean(v))
          .catch(() => false);
      }
      return cableAvailablePromise;
    }
    return Boolean(bridge.isCableSupported);
  }
  const shouldUseCable = ${shouldUseCableWebAuthnAssertion.toString()};
  const isUnfulfillable = ${isUnfulfillableWebAuthnAssertion.toString()};

  function toUint8Array(bufSource) {
    if (bufSource instanceof Uint8Array) {
      return bufSource;
    }
    if (ArrayBuffer.isView(bufSource)) {
      return new Uint8Array(bufSource.buffer, bufSource.byteOffset, bufSource.byteLength);
    }
    if (bufSource instanceof ArrayBuffer) {
      return new Uint8Array(bufSource);
    }
    throw new TypeError('Expected BufferSource');
  }

  function bytesToBase64Url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');
  }

  function base64UrlToArrayBuffer(b64url) {
    const padded = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function buildPublicKeyCredentialFromCable(res) {
    const rawIdBuffer = base64UrlToArrayBuffer(res.rawIdBase64Url);
    const clientDataBuffer = base64UrlToArrayBuffer(res.clientDataJSONBase64Url);
    const authDataBuffer = base64UrlToArrayBuffer(res.authenticatorDataBase64Url);
    const sigBuffer = base64UrlToArrayBuffer(res.signatureBase64Url);
    const userHandleBuffer = res.userHandleBase64Url
      ? base64UrlToArrayBuffer(res.userHandleBase64Url)
      : null;

    const respProto = window.AuthenticatorAssertionResponse
      ? window.AuthenticatorAssertionResponse.prototype
      : Object.prototype;
    const assertionResp = Object.create(respProto);
    Object.defineProperties(assertionResp, {
      clientDataJSON: { value: clientDataBuffer, enumerable: true },
      authenticatorData: { value: authDataBuffer, enumerable: true },
      signature: { value: sigBuffer, enumerable: true },
      userHandle: { value: userHandleBuffer, enumerable: true },
    });

    const cred = Object.create(PublicKeyCredentialCtor.prototype);
    Object.defineProperties(cred, {
      id: { value: res.id, enumerable: true },
      rawId: { value: rawIdBuffer, enumerable: true },
      type: { value: 'public-key', enumerable: true },
      authenticatorAttachment: { value: 'cross-platform', enumerable: true },
      response: { value: assertionResp, enumerable: true },
      getClientExtensionResults: {
        value: function getClientExtensionResults() {
          return {};
        },
      },
      toJSON: {
        value: function toJSON() {
          return {
            id: res.id,
            rawId: res.rawIdBase64Url,
            type: 'public-key',
            authenticatorAttachment: 'cross-platform',
            response: {
              clientDataJSON: res.clientDataJSONBase64Url,
              authenticatorData: res.authenticatorDataBase64Url,
              signature: res.signatureBase64Url,
              userHandle: res.userHandleBase64Url,
            },
            clientExtensionResults: {},
          };
        },
      },
    });
    return cred;
  }

  const origUvpaa =
    typeof PublicKeyCredentialCtor.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
      ? PublicKeyCredentialCtor.isUserVerifyingPlatformAuthenticatorAvailable.bind(PublicKeyCredentialCtor)
      : async () => false;

  if (typeof PublicKeyCredentialCtor.isConditionalMediationAvailable === 'function') {
    PublicKeyCredentialCtor.isConditionalMediationAvailable = async function isConditionalMediationAvailable() {
      return Boolean(await origUvpaa());
    };
  }

  if (typeof PublicKeyCredentialCtor.getClientCapabilities === 'function') {
    const origGetCaps = PublicKeyCredentialCtor.getClientCapabilities.bind(PublicKeyCredentialCtor);
    PublicKeyCredentialCtor.getClientCapabilities = async function getClientCapabilities(...args) {
      const [caps, uvpaa, hasCable] = await Promise.all([
        origGetCaps(...args),
        origUvpaa(),
        resolveHasCable(),
      ]);
      const hasPlatform = Boolean(uvpaa);
      return {
        ...caps,
        conditionalCreate: hasPlatform,
        conditionalGet: hasPlatform,
        hybridTransport: hasCable,
        passkeyPlatformAuthenticator: hasPlatform,
        userVerifyingPlatformAuthenticator: hasPlatform,
      };
    };
  }

  if (navigator.credentials && typeof navigator.credentials.get === 'function') {
    const origGet = navigator.credentials.get.bind(navigator.credentials);
    navigator.credentials.get = async function get(options) {
      if (options && options.publicKey) {
        if (options.signal && options.signal.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError');
        }
        const [hasPlatform, hasCable] = await Promise.all([
          origUvpaa().then(Boolean),
          resolveHasCable(),
        ]);
        if (shouldUseCable(options, hasPlatform, hasCable) && bridge && typeof bridge.getCableAssertion === 'function') {
          const pk = options.publicKey;
          const challengeBase64Url = bytesToBase64Url(toUint8Array(pk.challenge));
          const allowCredentials = Array.isArray(pk.allowCredentials)
            ? pk.allowCredentials.map((c) => ({
                idBase64Url: bytesToBase64Url(toUint8Array(c.id)),
                transports: Array.isArray(c.transports) ? c.transports.slice() : undefined,
              }))
            : undefined;
          const requestId = Math.random().toString(36).slice(2) + Date.now().toString(36);
          const onAbort = () => {
            if (typeof bridge.cancelCableAssertion === 'function') {
              void bridge.cancelCableAssertion(requestId);
            }
          };
          if (options.signal && typeof options.signal.addEventListener === 'function') {
            options.signal.addEventListener('abort', onAbort, { once: true });
          }
          if (options.signal && options.signal.aborted) {
            if (typeof options.signal.removeEventListener === 'function') {
              options.signal.removeEventListener('abort', onAbort);
            }
            throw new DOMException('The operation was aborted.', 'AbortError');
          }
          try {
            const res = await bridge.getCableAssertion({
              requestId,
              rpId: pk.rpId,
              challengeBase64Url,
              allowCredentials,
              userVerification: pk.userVerification,
              timeoutMs: pk.timeout,
            });
            return buildPublicKeyCredentialFromCable(res);
          } catch (err) {
            if (options.signal && options.signal.aborted) {
              throw new DOMException('The operation was aborted.', 'AbortError');
            }
            const msg =
              err && typeof err === 'object' && typeof err.message === 'string'
                ? err.message
                : String(err || '');
            if (err instanceof TypeError || /\\[TypeError\\]/i.test(msg)) {
              throw new TypeError(msg);
            }
            if (
              (err && typeof err === 'object' && err.name === 'SecurityError') ||
              /\\[SecurityError\\]|Invalid WebAuthn rpId/i.test(msg)
            ) {
              throw new DOMException(
                msg || 'The operation is insecure.',
                'SecurityError'
              );
            }
            if (
              (err && typeof err === 'object' && err.name === 'AbortError') ||
              /\\[AbortError\\]/i.test(msg)
            ) {
              throw new DOMException('The operation was aborted.', 'AbortError');
            }
            throw new DOMException(
              'The operation either timed out or was not allowed.',
              'NotAllowedError'
            );
          } finally {
            if (options.signal && typeof options.signal.removeEventListener === 'function') {
              options.signal.removeEventListener('abort', onAbort);
            }
          }
        }
        if (isUnfulfillable(options, hasPlatform)) {
          throw new DOMException(
            'The operation either timed out or was not allowed.',
            'NotAllowedError'
          );
        }
      }
      return origGet(options);
    };
  }
})();`;
}
let cachedCableAvailablePromise = null;
const webAuthnBridgeApi = {
    isCableSupported: process.platform === 'darwin',
    checkCableAvailable: () => {
        if (process.platform !== 'darwin') {
            return Promise.resolve(false);
        }
        if (!cachedCableAvailablePromise) {
            cachedCableAvailablePromise = Promise.resolve(electron_1.ipcRenderer.invoke(WEBAUTHN_CABLE_AVAILABLE_CHANNEL))
                .then((available) => Boolean(available))
                .catch(() => false);
        }
        return cachedCableAvailablePromise;
    },
    getCableAssertion: (request) => electron_1.ipcRenderer.invoke(WEBAUTHN_CABLE_GET_ASSERTION_CHANNEL, request),
    cancelCableAssertion: (requestId) => electron_1.ipcRenderer.invoke(WEBAUTHN_CABLE_CANCEL_ASSERTION_CHANNEL, requestId),
};
if (isTopLevelWebAuthnFrame()) {
    if (electron_1.contextBridge &&
        typeof electron_1.contextBridge.exposeInMainWorld === 'function' &&
        process.contextIsolated) {
        try {
            electron_1.contextBridge.exposeInMainWorld(exports.WEBAUTHN_MAIN_WORLD_BRIDGE_KEY, webAuthnBridgeApi);
        }
        catch {
            // Ignore duplicate exposure in frames where the preload already ran.
        }
    }
    else {
        try {
            globalThis[exports.WEBAUTHN_MAIN_WORLD_BRIDGE_KEY] =
                webAuthnBridgeApi;
        }
        catch {
            // Ignore read-only globalThis in restricted frames.
        }
    }
    if (electron_1.webFrame && typeof electron_1.webFrame.executeJavaScript === 'function') {
        try {
            void electron_1.webFrame.executeJavaScript(buildWebviewWebAuthnMainWorldScript());
        }
        catch {
            // Ignore non-HTML or restricted frames where script execution is disabled.
        }
    }
}
