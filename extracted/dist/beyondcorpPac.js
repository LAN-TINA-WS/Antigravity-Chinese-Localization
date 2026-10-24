"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureWebviewSessionProxy = exports.ANONYMOUS_WEBVIEW_PARTITION = exports.BEYONDCORP_PAC_FILENAME = exports.BEYONDCORP_EXTENSION_IDS = void 0;
exports.getChromeUserDataDirs = getChromeUserDataDirs;
exports.findBeyondCorpPacFile = findBeyondCorpPacFile;
exports.wrapBeyondCorpPacScript = wrapBeyondCorpPacScript;
exports.loadBeyondCorpPacDataUri = loadBeyondCorpPacDataUri;
exports.createWebviewProxyConfigurator = createWebviewProxyConfigurator;
exports.preconfigureWebviewPartitionProxies = preconfigureWebviewPartitionProxies;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
/**
 * Chrome Web Store / enterprise force-installed extension IDs for the BeyondCorp
 * proxy extension (production first, followed by development).
 */
exports.BEYONDCORP_EXTENSION_IDS = [
    'aihpiglmnhnhijdnjghpfnlledckkhja',
    'mnhjodcoklifmaholfognbdkgohlcbmg',
];
/** Filename of the bundled PAC script inside the unpacked extension directory. */
exports.BEYONDCORP_PAC_FILENAME = 'beyondcorp_bundled.pac.js';
/**
 * Default persistent partition used by the built-in `<webview>` browser before
 * user identity resolves (must match `ANONYMOUS_BROWSER_PARTITION` in AUIT).
 */
exports.ANONYMOUS_WEBVIEW_PARTITION = 'persist:hub-browser-anonymous';
const WEBVIEW_PARTITION_DIR_PREFIX = 'hub-browser-';
const PROFILE_DIR_RE = /^(Default|Profile \d+)$/;
const XUP_PROXY_DIRECTIVE_RE = /(?:^|\s|;)(?:HTTPS|PROXY)\s+[^;]*xup\./i;
const XUP_PROXY_ENTRY_RE = /^(?:HTTPS|PROXY)\s+[^;]*xup\./i;
function resolveDefaultAppDataPath() {
    try {
        return electron_1.app.getPath('appData');
    }
    catch {
        return '';
    }
}
function listSubdirectories(dirPath) {
    try {
        return fs
            .readdirSync(dirPath, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);
    }
    catch {
        return [];
    }
}
function isNonEmptyRegularFile(filePath) {
    try {
        const stat = fs.statSync(filePath);
        return stat.isFile() && stat.size > 0;
    }
    catch {
        return false;
    }
}
/**
 * Returns candidate Chrome `User Data` directories for the given platform in
 * channel priority order (Stable, Beta, Canary/Unstable).
 */
function getChromeUserDataDirs(platform = process.platform, appDataPath, localAppDataPath = process.env.LOCALAPPDATA, homePath = os.homedir()) {
    switch (platform) {
        case 'darwin': {
            const base = appDataPath ?? resolveDefaultAppDataPath();
            if (!base) {
                return [];
            }
            return [
                path.join(base, 'Google', 'Chrome'),
                path.join(base, 'Google', 'Chrome Beta'),
                path.join(base, 'Google', 'Chrome Canary'),
            ];
        }
        case 'linux': {
            const base = appDataPath ?? resolveDefaultAppDataPath();
            if (!base) {
                return [];
            }
            return [
                path.join(base, 'google-chrome'),
                path.join(base, 'google-chrome-beta'),
                path.join(base, 'google-chrome-unstable'),
            ];
        }
        case 'win32': {
            const base = localAppDataPath ||
                appDataPath ||
                (homePath ? path.join(homePath, 'AppData', 'Local') : '');
            if (!base) {
                return [];
            }
            return [
                path.join(base, 'Google', 'Chrome', 'User Data'),
                path.join(base, 'Google', 'Chrome Beta', 'User Data'),
                path.join(base, 'Google', 'Chrome SxS', 'User Data'),
            ];
        }
        default:
            return [];
    }
}
/**
 * Scans candidate Chrome `User Data` directories for the unpacked BeyondCorp
 * extension's bundled PAC file (`beyondcorp_bundled.pac.js`).
 *
 * Inspects `Default` before numerically sorted `Profile N` directories and
 * selects the highest version directory containing a non-empty PAC file.
 * Returns `null` when the extension is absent.
 */
function findBeyondCorpPacFile(userDataDirs) {
    // Phase 1 reads the force-installed Chrome extension's bundled PAC file from
    // the local disk; Phase 2 will transition to native OS-level MDM / Managed
    // Preferences policy keys (ProxyPacUrl, AutoSelectCertificateForUrls).
    const candidateDirs = userDataDirs ?? getChromeUserDataDirs();
    for (const userDataDir of candidateDirs) {
        const profiles = listSubdirectories(userDataDir)
            .filter((name) => PROFILE_DIR_RE.test(name))
            .sort((a, b) => {
            if (a === b) {
                return 0;
            }
            if (a === 'Default') {
                return -1;
            }
            if (b === 'Default') {
                return 1;
            }
            return a.localeCompare(b, undefined, { numeric: true });
        });
        for (const profile of profiles) {
            for (const extId of exports.BEYONDCORP_EXTENSION_IDS) {
                const extDir = path.join(userDataDir, profile, 'Extensions', extId);
                const versions = listSubdirectories(extDir).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
                for (const version of versions) {
                    const pacPath = path.join(extDir, version, exports.BEYONDCORP_PAC_FILENAME);
                    if (isNonEmptyRegularFile(pacPath)) {
                        return pacPath;
                    }
                }
            }
        }
    }
    return null;
}
/**
 * Wraps `FindProxyForURL` in the given PAC script source so any `xup.` proxy
 * entry is stripped from the directive list, falling back to `'DIRECT'` only
 * when no non-`xup.` directives remain.
 */
function wrapBeyondCorpPacScript(rawPacJs) {
    // XUP proxy endpoints challenge clients with HTTP 407 Proxy Authentication
    // Required, which relies on the Chrome extension's webRequest.onAuthRequired
    // listener that does not run inside an Electron <webview>. Stripping xup
    // directives (and falling back to DIRECT only if nothing else remains)
    // avoids 407 failures on third-party SaaS domains while preserving any
    // non-xup fallback routes (such as l2-uberproxy and up.gcp).
    return `${rawPacJs}
;(function() {
  if (typeof FindProxyForURL !== 'function') {
    return;
  }
  var originalFindProxyForURL = FindProxyForURL;
  var xupProxyDirectiveRe = ${XUP_PROXY_DIRECTIVE_RE.toString()};
  var xupProxyEntryRe = ${XUP_PROXY_ENTRY_RE.toString()};
  FindProxyForURL = function(url, host) {
    var result = originalFindProxyForURL(url, host);
    if (typeof result !== 'string' || !xupProxyDirectiveRe.test(result)) {
      return result;
    }
    var entries = result.split(';');
    var filtered = [];
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i].trim();
      if (entry && !xupProxyEntryRe.test(entry)) {
        filtered.push(entry);
      }
    }
    return filtered.length > 0 ? filtered.join('; ') : 'DIRECT';
  };
})();
`;
}
/**
 * Locates the local BeyondCorp PAC file, wraps it with `wrapBeyondCorpPacScript`,
 * and encodes it as a base64 `data:application/x-ns-proxy-autoconfig` URI.
 * Returns `null` if no valid PAC file is found or reading fails.
 */
function loadBeyondCorpPacDataUri(userDataDirs) {
    const pacPath = findBeyondCorpPacFile(userDataDirs);
    if (!pacPath) {
        return null;
    }
    try {
        const rawPacJs = fs.readFileSync(pacPath, 'utf8');
        if (!rawPacJs || !rawPacJs.trim()) {
            return null;
        }
        const wrapped = wrapBeyondCorpPacScript(rawPacJs);
        return `data:application/x-ns-proxy-autoconfig;base64,${Buffer.from(wrapped, 'utf8').toString('base64')}`;
    }
    catch {
        return null;
    }
}
/**
 * Creates a `<webview>` session proxy configurator that resolves the PAC `data:`
 * URI at most once, skips `session.defaultSession`, holds in-flight initial
 * requests via `webRequest.onBeforeRequest` until `session.setProxy` resolves,
 * and applies `session.setProxy` at most once per `Session` instance.
 */
function createWebviewProxyConfigurator(resolvePacDataUri = () => loadBeyondCorpPacDataUri(), options) {
    const configuredSessions = new WeakMap();
    let hasResolvedPacDataUri = false;
    let cachedPacDataUri = null;
    return (targetSession) => {
        const resolvedDefaultSession = options?.defaultSession !== undefined
            ? options.defaultSession
            : electron_1.session?.defaultSession;
        if (!targetSession ||
            (resolvedDefaultSession && targetSession === resolvedDefaultSession)) {
            return Promise.resolve();
        }
        const existingPromise = configuredSessions.get(targetSession);
        if (existingPromise) {
            return existingPromise;
        }
        if (!hasResolvedPacDataUri) {
            hasResolvedPacDataUri = true;
            cachedPacDataUri = resolvePacDataUri();
            if (!cachedPacDataUri) {
                console.info('[BeyondCorpPAC] No local BeyondCorp PAC file found; skipping webview proxy configuration.');
            }
        }
        if (!cachedPacDataUri) {
            return Promise.resolve();
        }
        let releaseHold;
        const holdGate = new Promise((resolve) => {
            releaseHold = resolve;
        });
        if (targetSession.webRequest?.onBeforeRequest) {
            targetSession.webRequest.onBeforeRequest((_details, callback) => {
                void holdGate.then(() => {
                    callback({});
                });
            });
        }
        const proxyPromise = Promise.resolve(targetSession.setProxy({ pacScript: cachedPacDataUri }))
            .catch((err) => {
            configuredSessions.delete(targetSession);
            console.warn('[BeyondCorpPAC] Failed to configure webview session proxy:', err);
        })
            .finally(() => {
            if (targetSession.webRequest?.onBeforeRequest) {
                targetSession.webRequest.onBeforeRequest(null);
            }
            releaseHold();
        });
        configuredSessions.set(targetSession, proxyPromise);
        return proxyPromise;
    };
}
/**
 * Default `<webview>` session proxy configurator used by the main process.
 */
exports.configureWebviewSessionProxy = createWebviewProxyConfigurator();
/**
 * Pre-configures the BeyondCorp PAC proxy on `persist:hub-browser-anonymous`
 * and any existing `persist:hub-browser-*` account partitions on disk before
 * any `BrowserWindow` or `<webview>` is created.
 */
async function preconfigureWebviewPartitionProxies(options) {
    const configureSession = options?.configureSession ?? exports.configureWebviewSessionProxy;
    const fromPartition = options?.fromPartition ??
        (typeof electron_1.session?.fromPartition === 'function'
            ? (partition) => electron_1.session.fromPartition(partition)
            : undefined);
    if (!fromPartition) {
        return;
    }
    const partitions = new Set([exports.ANONYMOUS_WEBVIEW_PARTITION]);
    let userDataPath = options?.userDataPath;
    if (userDataPath === undefined) {
        try {
            userDataPath = electron_1.app.getPath('userData');
        }
        catch {
            userDataPath = '';
        }
    }
    if (userDataPath) {
        const partitionsDir = path.join(userDataPath, 'Partitions');
        for (const dirName of listSubdirectories(partitionsDir)) {
            if (dirName.startsWith(WEBVIEW_PARTITION_DIR_PREFIX)) {
                partitions.add(`persist:${dirName}`);
            }
        }
    }
    await Promise.all([...partitions].map((partition) => configureSession(fromPartition(partition))));
}
