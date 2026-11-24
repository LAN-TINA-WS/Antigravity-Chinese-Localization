"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isInsidersBuild = isInsidersBuild;
const electron_1 = require("electron");
/**
 * Whether this is an Insiders build: its app name says so (e.g.
 * "Antigravity Insiders"). Dev builds from `npm start` are not.
 */
function isInsidersBuild() {
    return electron_1.app.getName().toLowerCase().includes('insiders');
}
