"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDebugConsoleEnabled = isDebugConsoleEnabled;
exports.configureDebugConsoleMenu = configureDebugConsoleMenu;
const electron_1 = require("electron");
/**
 * Returns whether Chromium DevTools should be enabled for BrowserWindows.
 * Defaults to unpackaged local development builds only.
 */
function isDebugConsoleEnabled() {
    return !electron_1.app.isPackaged;
}
function hideDevTools(menuInstance) {
    // Lowercase comparison handles Electron's runtime role normalization ('toggledevtools').
    menuInstance.items?.forEach((item) => {
        if (item.role?.toLocaleLowerCase() === 'toggledevtools') {
            item.visible = false;
        }
        if (item.submenu) {
            hideDevTools(item.submenu);
        }
    });
}
/**
 * Hides the built-in Toggle Developer Tools menu item across all submenus
 * when the debug console is disabled.
 */
function configureDebugConsoleMenu(menuInstance) {
    if (isDebugConsoleEnabled()) {
        return;
    }
    hideDevTools(menuInstance);
}
