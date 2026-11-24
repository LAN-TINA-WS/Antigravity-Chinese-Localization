"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAXIMIZED_CHANGED_CHANNEL = exports.CUSTOM_WINDOW_CONTROLS_ARG = exports.CUSTOM_WINDOW_CONTROLS_ENV = exports.NATIVE_WINDOW_CONTROLS_SWITCH = exports.CUSTOM_WINDOW_CONTROLS_SWITCH = void 0;
exports.isCustomWindowControlsEnabled = isCustomWindowControlsEnabled;
exports.forwardMaximizedState = forwardMaximizedState;
const electron_1 = require("electron");
const appChannel_1 = require("./appChannel");
/**
 * Whether the Hub page draws its own minimize / maximize / close buttons on
 * Windows and Linux instead of the native caption-button overlay.
 *
 * On by default in Insiders builds. Elsewhere, turn it on with the
 * `--custom-window-controls` switch or `AGY_CUSTOM_WINDOW_CONTROLS=1`.
 * `--native-window-controls` or `AGY_CUSTOM_WINDOW_CONTROLS=0` forces the
 * native buttons, even in Insiders. macOS keeps its traffic lights either way.
 */
exports.CUSTOM_WINDOW_CONTROLS_SWITCH = 'custom-window-controls';
exports.NATIVE_WINDOW_CONTROLS_SWITCH = 'native-window-controls';
exports.CUSTOM_WINDOW_CONTROLS_ENV = 'AGY_CUSTOM_WINDOW_CONTROLS';
/**
 * Passed to the Hub renderer in `additionalArguments` so the preload can tell
 * the page it must draw the buttons. The preload repeats this constant: a
 * sandboxed preload can't import this module.
 */
exports.CUSTOM_WINDOW_CONTROLS_ARG = '--agy-custom-window-controls=1';
/** Sent to a Hub window's page with `isMaximized` whenever that changes. */
exports.MAXIMIZED_CHANGED_CHANNEL = 'window:maximized-changed';
/** Whether Hub windows draw their own window buttons (never on macOS). */
function isCustomWindowControlsEnabled() {
    if (process.platform === 'darwin') {
        return false;
    }
    const hasSwitch = (name) => electron_1.app.commandLine?.hasSwitch?.(name) === true;
    const env = process.env[exports.CUSTOM_WINDOW_CONTROLS_ENV];
    // The kill switch wins, so native buttons are always one flag away.
    if (hasSwitch(exports.NATIVE_WINDOW_CONTROLS_SWITCH) || env === '0') {
        return false;
    }
    return (hasSwitch(exports.CUSTOM_WINDOW_CONTROLS_SWITCH) || env === '1' || (0, appChannel_1.isInsidersBuild)());
}
/**
 * Tells `getContents()` (the window's Hub page) whether `win` is maximized
 * each time it maximizes, restores, or enters or leaves full screen, so a
 * page-drawn maximize button shows the right icon. Harmless when the page
 * draws no buttons: nothing listens.
 */
function forwardMaximizedState(win, getContents) {
    const send = () => {
        if (win.isDestroyed?.()) {
            return;
        }
        const contents = getContents();
        if (!contents || contents.isDestroyed?.()) {
            return;
        }
        contents.send(exports.MAXIMIZED_CHANGED_CHANNEL, win.isMaximized() === true);
    };
    win.on('maximize', send);
    win.on('unmaximize', send);
    win.on('enter-full-screen', send);
    win.on('leave-full-screen', send);
}
