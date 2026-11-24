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
exports.PermissionGuide = exports.GUIDE_KILL_AFTER_MS = void 0;
exports.bundlePathOf = bundlePathOf;
exports.bundleNameFromPlist = bundleNameFromPlist;
exports.resolveGuideApp = resolveGuideApp;
/**
 * @fileoverview The Hub side of the macOS permission guide: the small native
 * panel (`agy-desktop-helper perm-guide`, desktop-helper/PermGuide.swift)
 * beside System Settings that shows the app to drag into the list (state
 * "add") or the switch to turn on ("enable").
 *
 * Only the permission card's Open click starts it (permissionsIpc.ts), after
 * the pane is open. At most one guide runs: Open on the other pane replaces
 * it, Open on the same pane only updates its state. It is closed (a close
 * line, then EOF on its stdin) when that pane's grant flips on, when the card
 * asks (closePermissionGuide), and on a confirmed Hub quit; the guide also closes itself
 * (its ✕, System Settings gone, Accessibility granted, a 10 min cap). A guide
 * that exits or crashes is gone: it is never restarted.
 */
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
const MAX_NAME_BYTES = 256;
const MAX_PLIST_BYTES = 1024 * 1024;
/**
 * Pure: the outermost `.app` bundle containing `execPath` (the main
 * process's binary, `<X>.app/Contents/MacOS/<X>`), or undefined. Only an
 * absolute path whose components are not empty, "." or ".." (what
 * perm-guide's --app accepts).
 */
function bundlePathOf(execPath) {
    if (!execPath.startsWith('/') || execPath.includes('\0')) {
        return undefined;
    }
    const comps = execPath.split('/').slice(1);
    if (comps.some((c) => c === '' || c === '.' || c === '..')) {
        return undefined;
    }
    const i = comps.findIndex((c, k) => c.length > 4 && c.endsWith('.app') && comps[k + 1] === 'Contents');
    return i < 0 ? undefined : '/' + comps.slice(0, i + 1).join('/');
}
function decodeXml(s) {
    return s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (m, e) => {
        switch (e) {
            case 'amp':
                return '&';
            case 'lt':
                return '<';
            case 'gt':
                return '>';
            case 'quot':
                return '"';
            case 'apos':
                return "'";
        }
        const n = e.startsWith('#x')
            ? parseInt(e.slice(2), 16)
            : parseInt(e.slice(1), 10);
        return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    });
}
/** Trimmed, control characters dropped, at most 256 UTF-8 bytes; or ''. */
function displaySafe(s) {
    // eslint-disable-next-line no-control-regex
    let out = s.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
    // Every code point is at least one UTF-8 byte: cut to MAX_NAME_BYTES code
    // points first, so the byte loop below runs on a short string only.
    if (out.length > MAX_NAME_BYTES) {
        out = Array.from(out).slice(0, MAX_NAME_BYTES).join('');
    }
    while (Buffer.byteLength(out, 'utf8') > MAX_NAME_BYTES) {
        out = Array.from(out).slice(0, -1).join('');
    }
    return out;
}
/**
 * Pure: CFBundleDisplayName, else CFBundleName, from an XML Info.plist (the
 * top-level dict's string values); '' when neither is there or the plist is
 * binary. A minimal read, not a plist parser: no dependency for two keys.
 */
function bundleNameFromPlist(xml) {
    if (xml.startsWith('bplist')) {
        return '';
    }
    for (const key of ['CFBundleDisplayName', 'CFBundleName']) {
        const m = new RegExp(`<key>\\s*${key}\\s*</key>\\s*<string>([^<]*)</string>`).exec(xml);
        const name = m ? displaySafe(decodeXml(m[1])) : '';
        if (name) {
            return name;
        }
    }
    return '';
}
/**
 * The app to drag into the list, from (execPath, isPackaged):
 * - packaged: the .app containing execPath, named by its Info.plist
 *   (CFBundleDisplayName || CFBundleName), else the bundle's basename
 *   without ".app";
 * - dev: the .app containing execPath (Electron.app, or a renamed copy used
 *   as a throwaway test app), named by its Info.plist like a packaged build,
 *   else "Electron" (what the System Settings list shows for Electron.app).
 * Undefined when execPath isn't inside an .app bundle. `readPlist` returns
 * the Info.plist text or throws (tests fake it).
 */
function resolveGuideApp(execPath, isPackaged, readPlist = readPlistFile) {
    const bundlePath = bundlePathOf(execPath);
    if (!bundlePath) {
        return undefined;
    }
    let name = '';
    try {
        name = bundleNameFromPlist(readPlist(path.posix.join(bundlePath, 'Contents', 'Info.plist')));
    }
    catch (_e) {
        name = '';
    }
    return {
        bundlePath,
        name: name ||
            (isPackaged
                ? displaySafe(path.posix.basename(bundlePath).replace(/\.app$/, ''))
                : 'Electron'),
    };
}
function readPlistFile(p) {
    const fd = fs.openSync(p, 'r');
    try {
        const buf = Buffer.alloc(MAX_PLIST_BYTES);
        const n = fs.readSync(fd, buf, 0, MAX_PLIST_BYTES, 0);
        return buf.subarray(0, n).toString('utf8');
    }
    finally {
        fs.closeSync(fd);
    }
}
/** How long a closed guide may take to exit before it is killed. */
exports.GUIDE_KILL_AFTER_MS = 3000;
const defaultSpawn = (file, args, o) => (0, child_process_1.spawn)(file, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    ...(o.env ? { env: o.env } : {}),
});
/** One permission guide at a time; see the fileoverview. */
class PermissionGuide {
    constructor(deps) {
        this.deps = deps;
        this.spawn = deps.spawn ?? defaultSpawn;
        this.log = deps.log ?? ((m) => console.log(`[PermGuide] ${m}`));
        this.setTimer = deps.setTimeout ?? ((cb, ms) => setTimeout(cb, ms));
        this.clearTimer =
            deps.clearTimeout ??
                ((t) => clearTimeout(t));
        deps.onQuit?.(() => this.close());
    }
    /** The pane whose guide is up, if any (for tests and logs). */
    get pane() {
        return this.current?.pane;
    }
    resolveApp() {
        try {
            return this.deps.app();
        }
        catch (_e) {
            return undefined;
        }
    }
    /** The app's name in the list (also when no guide can be shown). */
    appName() {
        return this.resolveApp()?.name || this.deps.fallbackName();
    }
    /**
     * Shows the guide for `pane` in `state`: updates the running guide of the
     * same pane, else replaces any other guide with a new one.
     */
    show(pane, state) {
        const app = this.resolveApp();
        const appName = app?.name || this.deps.fallbackName();
        const cur = this.current;
        if (cur && cur.pane === pane && !cur.closing) {
            if (cur.state !== state) {
                cur.state = state;
                this.send(cur, { op: 'state', state });
            }
            return { guide: 'shown', appName };
        }
        this.close();
        if ((this.deps.platform ?? process.platform) !== 'darwin' || !app) {
            return { guide: 'unavailable', appName };
        }
        const helper = this.deps.helperPath();
        if (!helper) {
            this.log('helper binary missing; no guide');
            return { guide: 'unavailable', appName };
        }
        let child;
        try {
            child = this.spawn(helper, [
                'perm-guide',
                '--pane',
                pane,
                '--app',
                app.bundlePath,
                '--name',
                appName,
                '--state',
                state,
            ], { env: this.deps.env?.() });
        }
        catch (err) {
            this.log(`spawn failed: ${String(err)}`);
            return { guide: 'unavailable', appName };
        }
        const run = { pane, state, child, closing: false };
        this.current = run;
        this.watch(run);
        return { guide: 'shown', appName };
    }
    /** Closes the guide if it is for `pane` (its grant flipped on). */
    setGranted(pane) {
        if (this.current?.pane === pane) {
            this.close();
        }
    }
    /** Closes the guide, if any: a close line, then EOF on its stdin. */
    close() {
        const run = this.current;
        if (!run) {
            return;
        }
        this.current = undefined;
        run.closing = true;
        this.send(run, { op: 'close' });
        try {
            run.child.stdin?.end();
        }
        catch (_e) {
            // Already gone.
        }
        run.killTimer = this.setTimer(() => {
            try {
                run.child.kill('SIGTERM');
            }
            catch (_e) {
                // Already gone.
            }
        }, exports.GUIDE_KILL_AFTER_MS);
    }
    send(run, msg) {
        try {
            run.child.stdin?.write(`${JSON.stringify(msg)}\n`);
        }
        catch (err) {
            this.log(`write failed: ${String(err)}`);
        }
    }
    watch(run) {
        const { child } = run;
        // A guide that exited leaves EPIPE on the next write: not a crash here.
        child.stdin?.on('error', () => { });
        const gone = (why) => {
            if (run.killTimer !== undefined) {
                this.clearTimer(run.killTimer);
                run.killTimer = undefined;
            }
            if (this.current === run) {
                this.current = undefined;
                this.log(`guide gone (${why}); not restarting`);
            }
        };
        child.on('exit', (code, signal) => gone(signal ? `signal ${signal}` : `exit ${code}`));
        child.on('error', (err) => gone(`error: ${err.message}`));
        if (child.stdout) {
            readline
                .createInterface({ input: child.stdout })
                .on('line', (line) => this.onEvent(run, line));
        }
        if (child.stderr) {
            readline
                .createInterface({ input: child.stderr })
                .on('line', (line) => this.log(line.slice(0, 500)));
        }
    }
    onEvent(run, line) {
        let ev;
        try {
            const v = JSON.parse(line);
            if (!v || typeof v !== 'object') {
                return;
            }
            ev = v;
        }
        catch (_e) {
            return;
        }
        switch (ev['event']) {
            case 'perm_guide_state':
                // A drop or the user's "Not in the list?" changed it.
                if (ev['state'] === 'add' || ev['state'] === 'enable') {
                    run.state = ev['state'];
                    this.log(`state: ${ev['state']}` +
                        (ev['hint'] === 'stale_row' ? ' hint=stale_row' : '') +
                        (typeof ev['by'] === 'string' ? ` by=${logToken(ev['by'])}` : ''));
                }
                break;
            case 'perm_guide_closed':
                // Going away: the next show() starts a new guide.
                run.closing = true;
                this.log(`closed: ${String(ev['reason'])}`);
                break;
            case 'perm_guide_dropped': {
                // For drag checks on a Mac: did the target take it, with which
                // operation (copy/generic/link/none), and was it on Settings.
                const onSettings = ev['on_settings'];
                this.log(`dropped: accepted=${ev['accepted'] === true}` +
                    ` operation=${typeof ev['operation'] === 'string' ? logToken(ev['operation']) : 'unknown'}` +
                    ` on_settings=${typeof onSettings === 'boolean' ? String(onSettings) : 'unknown'}`);
                break;
            }
            case 'perm_guide_shown':
                break;
        }
    }
}
exports.PermissionGuide = PermissionGuide;
/** A child-reported word for the log: short [a-z0-9_] only, else "other". */
function logToken(v) {
    return /^[a-z0-9_]{1,24}$/.test(v) ? v : 'other';
}
