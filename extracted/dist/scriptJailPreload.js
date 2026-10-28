"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Minimal preload script for the ephemeral Electron script jail.
 *
 * Runs in an isolated preload context inside the sandboxed `about:blank`
 * `WebContentsView`. Its sole responsibility is to receive the single
 * `MessagePortMain` transferred from the main process on channel
 * `'agy-script-jail:port'` and forward it to the jail's main world via
 * `window.postMessage`. No `contextBridge` APIs or Node/Electron capabilities
 * are exposed.
 */
const electron_1 = require("electron");
let pendingPorts = null;
let mainWorldReady = false;
function tryFlushPort() {
    if (!pendingPorts || !mainWorldReady) {
        return;
    }
    const ports = pendingPorts;
    pendingPorts = null;
    window.postMessage({ type: 'agy-script-jail-port' }, '*', ports);
}
window.addEventListener('message', (event) => {
    const data = event?.data;
    if (data && data.type === 'agy-script-jail-ready') {
        mainWorldReady = true;
        tryFlushPort();
    }
});
electron_1.ipcRenderer.on('agy-script-jail:port', (event) => {
    pendingPorts = event.ports;
    tryFlushPort();
});
