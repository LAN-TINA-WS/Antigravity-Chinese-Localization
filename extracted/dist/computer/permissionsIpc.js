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
exports.PERMISSIONS_CHANNELS = void 0;
exports.defaultPermissionGuide = defaultPermissionGuide;
exports.registerComputerPermissionsIpc = registerComputerPermissionsIpc;
/**
 * @fileoverview IPC for the Hub UI's macOS permission onboarding card
 * (preload `window.agyComputerPreview.getPermissions`, `openPermissionSettings`,
 * `closePermissionGuide` and `relaunchApp`). Registered with the computer preview IPC, so only while
 * computer use is on.
 *
 * Only the top frame of a Hub UI window may call it (not popups, webview
 * guests or subframes). Reading the grants is passive (Electron's TCC queries;
 * the desktop helper is never started for it, and nothing prompts), settings
 * panes are named, not passed as URLs, and a relaunch quits gracefully (the
 * language server and the helper are shut down) before the Hub starts again.
 *
 * Open never asks macOS for a permission (no prompting TCC call, so no
 * "would like to control this computer" alert): it opens the named pane and
 * reports whether that pane is already granted, read passively. Unless the
 * pane is granted, it then shows the permission guide (permissionGuide.ts)
 * beside System Settings, always starting with the drag tile; a grant read
 * that sees the pane flip on closes it.
 */
const fs = __importStar(require("fs"));
const electron_1 = require("electron");
const utils_1 = require("../utils");
const gate_1 = require("./gate");
const index_1 = require("./index");
const permissionGuide_1 = require("./permissionGuide");
const permissions_1 = require("./permissions");
const previewViewers_1 = require("./previewViewers");
exports.PERMISSIONS_CHANNELS = Object.freeze({
    get: 'computer-permissions:get',
    openSettings: 'computer-permissions:open-settings',
    relaunch: 'computer-permissions:relaunch',
    closeGuide: 'computer-permissions:close-guide',
});
function existingHelperPath() {
    const p = (0, index_1.desktopHelperPath)();
    return fs.existsSync(p) ? p : undefined;
}
/** The guide with the real helper, app bundle and Hub quit. */
function defaultPermissionGuide() {
    return new permissionGuide_1.PermissionGuide({
        helperPath: existingHelperPath,
        app: () => (0, permissionGuide_1.resolveGuideApp)(process.execPath, electron_1.app.isPackaged),
        fallbackName: () => electron_1.app.getName(),
        env: () => (0, gate_1.helperEnv)(process.env, electron_1.app.isPackaged),
        // The confirmed quit only (not 'before-quit', which runs before the
        // Cmd+Q confirmation, so Cancel would close the guide too).
        onQuit: (cb) => (0, index_1.onComputerUseTeardown)(cb),
    });
}
const defaultReadGrants = () => ({
    accessibility: electron_1.systemPreferences.isTrustedAccessibilityClient(false),
    screenRecording: electron_1.systemPreferences.getMediaAccessStatus('screen') === 'granted',
});
/**
 * A local Hub window (never an SSH remote window) showing the Hub UI (not a
 * page it navigated to). Independent of the preview, so onboarding works with
 * AGY_DESKTOP_PREVIEW=0.
 */
function defaultIsHubUi(wc) {
    return ((0, utils_1.getLocalHubWindows)().some((w) => (0, utils_1.getHubWebContents)(w) === wc) &&
        (0, previewViewers_1.isHubUiUrl)(wc.getURL()));
}
/** How long a grant flip waits for the Hello refresh before answering. */
const REFRESH_HELLO_TIMEOUT_MS = 2000;
function defaultRelaunch() {
    electron_1.app.relaunch();
    // A graceful quit ('before-quit' stops the LS and the helper), then the
    // relaunch.
    electron_1.app.quit();
}
/** Registers the handlers; samples the grants now (process start). */
function registerComputerPermissionsIpc(deps = {}) {
    const tracker = new permissions_1.PermissionTracker(deps.readGrants ?? defaultReadGrants);
    const isHubUi = deps.isHubUi ?? defaultIsHubUi;
    const openExternal = deps.openExternal ?? ((url) => electron_1.shell.openExternal(url));
    const relaunch = deps.relaunch ?? defaultRelaunch;
    const refreshHello = deps.refreshHello ?? index_1.refreshComputerHello;
    const readGrants = deps.readGrants ?? defaultReadGrants;
    const guide = deps.guide ?? defaultPermissionGuide();
    /**
     * Bumped by every Open and close-guide: an Open whose
     * `await openExternal` was overtaken (a close or a newer Open meanwhile)
     * shows no guide, so no guide outlives a close and only the newest Open's
     * pane gets one.
     */
    let generation = 0;
    /** What an Open reports: the pane's grant, read passively; never asks. */
    const paneState = (pane) => {
        let granted = false;
        try {
            granted = readGrants()[pane] === true;
        }
        catch (_e) {
            granted = false;
        }
        return {
            registered: granted ? 'already-granted' : 'skipped',
            promptedThisSession: false,
        };
    };
    const check = (e) => {
        const wc = e.sender;
        if (wc.isDestroyed() ||
            wc.getType() !== 'window' ||
            e.senderFrame !== wc.mainFrame ||
            !isHubUi(wc)) {
            throw new Error('computer permissions: not allowed from this frame');
        }
    };
    let last = tracker.sample();
    electron_1.ipcMain.handle(exports.PERMISSIONS_CHANNELS.get, async (e) => {
        check(e);
        const now = tracker.sample();
        const flipped = now.accessibility !== last.accessibility ||
            now.screenRecording !== last.screenRecording;
        // A pane granted since the last read: its guide is done (Screen
        // Recording's only close path; the guide sees Accessibility itself).
        for (const pane of ['accessibility', 'screenRecording']) {
            if (now[pane] && !last[pane]) {
                guide.setGranted(pane);
            }
        }
        last = now;
        // Every check re-reads the helper's grants (the ones the LS gates on),
        // which can change without the Hub's own read flipping. On a flip the
        // card waits for it: the LS sees the new grants before the card offers
        // to continue, not on the next Hello timer (a stale PERMISSION_MISSING).
        const refreshed = refreshHello().catch(() => { });
        if (flipped) {
            await Promise.race([
                refreshed,
                new Promise((resolve) => setTimeout(resolve, REFRESH_HELLO_TIMEOUT_MS)),
            ]);
        }
        return now;
    });
    electron_1.ipcMain.handle(exports.PERMISSIONS_CHANNELS.openSettings, async (e, pane) => {
        check(e);
        // Validated before anything runs: only the two named panes.
        const url = (0, permissions_1.permissionPaneUrl)(pane);
        const p = pane;
        const mine = ++generation;
        let result = paneState(p);
        await openExternal(url);
        if (mine !== generation) {
            // Overtaken while System Settings opened: the close or the newer
            // Open decides about the guide; this one leaves it alone.
            return { ...result, guide: 'unavailable', appName: guide.appName() };
        }
        // Granted while System Settings opened: report the fresh read
        // (already-granted, as if it had been granted before) and show no guide.
        if (result.registered !== 'already-granted') {
            result = paneState(p);
        }
        if (result.registered === 'already-granted') {
            // Nothing to add or turn on: no guide over System Settings (nor the
            // other pane's, beside this one).
            guide.close();
            return { ...result, guide: 'unavailable', appName: guide.appName() };
        }
        // Nothing asked macOS to list the app, so the guide starts with the
        // drag tile (its text also covers an app that is already listed).
        return { ...result, ...guide.show(p, 'add') };
    });
    electron_1.ipcMain.handle(exports.PERMISSIONS_CHANNELS.closeGuide, (e) => {
        check(e);
        generation++;
        guide.close();
    });
    let relaunching = false;
    electron_1.ipcMain.handle(exports.PERMISSIONS_CHANNELS.relaunch, (e) => {
        check(e);
        if (!relaunching) {
            relaunching = true;
            relaunch();
        }
    });
}
