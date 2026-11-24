"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerKeybindings = registerKeybindings;
const electron_1 = require("electron");
const utils_1 = require("./utils");
function registerKeybindings(win, actions) {
    const hubContents = (0, utils_1.getHubWebContents)(win) ?? win.webContents;
    const handleBeforeInput = (event, input) => {
        if (win.isDestroyed?.()) {
            return;
        }
        if (input.type === 'keyDown') {
            const isCmdOrCtrl = (0, utils_1.isMacOS)() ? input.meta : input.control;
            if (isCmdOrCtrl && input.shift && input.key.toLowerCase() === 'n') {
                actions.createNewWindow();
                event.preventDefault();
            }
            if (isCmdOrCtrl && input.key.toLowerCase() === 'q') {
                actions.onQuitRequested();
                event.preventDefault();
            }
            if (!electron_1.app.isPackaged &&
                !(0, utils_1.isMacOS)() &&
                isCmdOrCtrl &&
                !input.alt &&
                input.key.toLowerCase() === 'r') {
                if (input.shift) {
                    hubContents?.reloadIgnoringCache();
                }
                else {
                    hubContents?.reload();
                }
                event.preventDefault();
            }
        }
    };
    hubContents?.on('before-input-event', handleBeforeInput);
    win.once?.('closed', () => {
        hubContents?.off?.('before-input-event', handleBeforeInput);
    });
}
