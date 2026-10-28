"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureGuestDebuggerAttached = ensureGuestDebuggerAttached;
/**
 * Attaches a guest's `webContents.debugger` unless it is already attached, and
 * returns whether it is attached afterwards.
 *
 * Electron gives each `WebContents` one debugger session, shared by every
 * main-process CDP client of that guest. To keep the session usable for all of
 * them, clients must:
 * - attach only through this function, and reuse a session someone else
 *   attached;
 * - never call `detach()`, and never `*.disable` a domain they did not enable;
 * - after a `'detach'` caused by something else (such as DevTools opening on
 *   the guest, or a renderer crash), attach again through this function and
 *   re-enable their own domains.
 */
function ensureGuestDebuggerAttached(dbg) {
    if (dbg.isAttached()) {
        return true;
    }
    try {
        dbg.attach('1.3');
    }
    catch {
        // Another client attached between the check and the attach; reuse it.
    }
    return dbg.isAttached();
}
