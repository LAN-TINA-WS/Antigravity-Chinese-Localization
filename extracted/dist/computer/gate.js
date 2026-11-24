"use strict";
/**
 * When computer use runs in the Hub, and which environment it reads.
 *
 * Computer use (the `computer` actuator, the desktop helper and the live
 * preview) starts when, in this order:
 * 1. in an unpackaged build only, AGY_ENABLE_CUA=1 (dev / E2E harness): on;
 * 2. the `enable-agy-hub-cua-macos` custom flag override is a boolean (Hub
 *    Developer Settings, persisted as `jetski.developer.customFlagOverrides`):
 *    that value, so `false` opts out of a server-side rollout;
 * 3. otherwise the server's `enable-agy-hub-cua-macos` Mendel value cached in
 *    app storage by src/mendelFlagSync.ts at the last poll: on iff `'true'`.
 * Anything else (no cache yet, `'false'`, unreadable storage) is off.
 *
 * The decision is needed before app ready (the loopback WebRTC switch) and is
 * read once at startup, so it cannot wait for the LS: the server value takes
 * effect on the launch after the Hub first sees it, and a flag turned off
 * stops computer use from the launch after the next poll that sees it off.
 *
 * Storage is renderer-writable, so this is a convenience gate, not a security
 * boundary: the LS's own flag, per-app consent and the macOS TCC grants stay
 * authoritative.
 *
 * Node-only, no Electron (callers pass `app.isPackaged`).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HELPER_ENV_ALLOWLIST = exports.MAX_PREVIEW_SLOTS = exports.MIN_PREVIEW_SLOTS = exports.DEFAULT_PREVIEW_SLOTS = exports.MAX_PREVIEW_SLOTS_KEY = exports.CUSTOM_FLAG_OVERRIDES_KEY = exports.CUA_FLAG = void 0;
exports.cuaFlagOverride = cuaFlagOverride;
exports.resolveMaxPreviewSlots = resolveMaxPreviewSlots;
exports.cuaServerFlagCached = cuaServerFlagCached;
exports.isComputerUseEnabled = isComputerUseEnabled;
exports.cuaEnv = cuaEnv;
exports.helperEnv = helperEnv;
const constants_1 = require("../constants");
const protocol_1 = require("../desktopHost/protocol");
exports.CUA_FLAG = constants_1.CUA_MACOS_FLAG;
exports.CUSTOM_FLAG_OVERRIDES_KEY = constants_1.CUSTOM_FLAG_OVERRIDES_STORAGE_KEY;
/** The override's value: true / false when set to a boolean, else undefined. */
function cuaFlagOverride(items) {
    // A store that failed to load reads as no override.
    const raw = items?.[exports.CUSTOM_FLAG_OVERRIDES_KEY];
    if (typeof raw !== 'string' || !raw) {
        return undefined;
    }
    try {
        const o = JSON.parse(raw);
        if (!o || typeof o !== 'object' || Array.isArray(o)) {
            return undefined;
        }
        const v = o[exports.CUA_FLAG];
        return typeof v === 'boolean' ? v : undefined;
    }
    catch {
        return undefined;
    }
}
/**
 * How many windows the live preview shows at once: the single
 * `computer.maxPreviewSlots` setting (an app storage item, or a custom flag
 * override of that name in Developer Settings), 1..12, default 6. In an
 * unpackaged build AGY_MAX_PREVIEW_SLOTS wins (dev / E2E). Read at startup.
 */
exports.MAX_PREVIEW_SLOTS_KEY = 'computer.maxPreviewSlots';
exports.DEFAULT_PREVIEW_SLOTS = protocol_1.DEFAULT_VIDEO_SLOTS;
exports.MIN_PREVIEW_SLOTS = 1;
exports.MAX_PREVIEW_SLOTS = protocol_1.MAX_VIDEO_SLOTS;
function resolveMaxPreviewSlots(items, env, packaged) {
    if (!packaged && env.AGY_MAX_PREVIEW_SLOTS) {
        return (0, protocol_1.clampVideoSlots)(env.AGY_MAX_PREVIEW_SLOTS);
    }
    const direct = items[exports.MAX_PREVIEW_SLOTS_KEY];
    if (typeof direct === 'string' && direct.trim()) {
        // Stored by the renderer as JSON (a number or a numeric string).
        let v = direct;
        try {
            v = JSON.parse(direct);
        }
        catch {
            // a bare string
        }
        return (0, protocol_1.clampVideoSlots)(v);
    }
    const raw = items[exports.CUSTOM_FLAG_OVERRIDES_KEY];
    if (typeof raw === 'string' && raw) {
        try {
            const o = JSON.parse(raw);
            if (o && typeof o === 'object' && !Array.isArray(o)) {
                const v = o[exports.MAX_PREVIEW_SLOTS_KEY];
                if (v !== undefined) {
                    return (0, protocol_1.clampVideoSlots)(v);
                }
            }
        }
        catch {
            // ignore a bad overrides blob
        }
    }
    return exports.DEFAULT_PREVIEW_SLOTS;
}
/**
 * The server's flag value as cached by mendelFlagSync at the last poll:
 * true / false, or undefined if never cached (or the store failed to load).
 */
function cuaServerFlagCached(items) {
    const raw = items?.[exports.CUA_FLAG];
    return raw === 'true' ? true : raw === 'false' ? false : undefined;
}
/** Whether computer use starts (see the file comment). */
function isComputerUseEnabled(items, env, packaged) {
    if (!packaged && env.AGY_ENABLE_CUA === '1') {
        return true;
    }
    return cuaFlagOverride(items) ?? cuaServerFlagCached(items) === true;
}
/**
 * The environment computer use reads its overrides from: as is in an
 * unpackaged build; without any AGY_* variable in a packaged app.
 */
function cuaEnv(env, packaged) {
    if (!packaged) {
        return env;
    }
    const out = {};
    for (const [k, v] of Object.entries(env)) {
        if (!k.startsWith('AGY_')) {
            out[k] = v;
        }
    }
    return out;
}
/** The only variables a packaged app passes to its helper processes. */
exports.HELPER_ENV_ALLOWLIST = [
    'PATH',
    'HOME',
    'TMPDIR',
    'LANG',
];
/**
 * The environment of the desktop helper and the RTC sidecar: the full
 * environment in an unpackaged build (dev and E2E overrides), only
 * {@link HELPER_ENV_ALLOWLIST} in a packaged app (no AGY_*, DYLD_*, ...).
 */
function helperEnv(env, packaged) {
    if (!packaged) {
        return env;
    }
    const out = {};
    for (const k of exports.HELPER_ENV_ALLOWLIST) {
        if (env[k] !== undefined) {
            out[k] = env[k];
        }
    }
    return out;
}
