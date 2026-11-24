"use strict";
/**
 * Agent identity on screen: the color and the display-safe label each agent
 * gets in the Hub's Agents pane (its tiles, preview cursors and labels) and
 * in the viewer protocol's colorIndex (desktopHost/colors.ts). The helper's
 * own labels (the pairing prompt, the activation tripwire's app names) use
 * the same sanitizer (overlayLabel in desktop-helper/Common.swift). Kept
 * free of Electron imports so it can be unit tested.
 *
 * The names keep their "overlay" prefix from the desktop cursor panels the
 * helper used to draw; the rules are unchanged.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OVERLAY_MAX_LABEL = exports.OVERLAY_PALETTE = void 0;
exports.overlayHash = overlayHash;
exports.overlayColorIndex = overlayColorIndex;
exports.overlayColorHex = overlayColorHex;
exports.overlayLabel = overlayLabel;
exports.overlayDisplayName = overlayDisplayName;
/** Agent colors (0xRRGGBB). */
exports.OVERLAY_PALETTE = [
    0x0a84ff, 0xff375f, 0x30d158, 0xff9f0a, 0xbf5af2, 0x40c8e0, 0xffd60a,
    0xac8e68,
];
/** Mirrors kOverlayMaxLabel in desktop-helper/Common.swift. */
exports.OVERLAY_MAX_LABEL = 32;
/**
 * 32-bit FNV-1a over the UTF-16 code units: Layer 2's agentColorIndex
 * (computerOps.ts) computes the same.
 */
function overlayHash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}
/**
 * The palette slot of an actor: its explicit index (wrapped into range) if it
 * has one, else the hash of its id.
 */
function overlayColorIndex(actorId, explicit) {
    const n = exports.OVERLAY_PALETTE.length;
    if (explicit !== undefined && Number.isInteger(explicit)) {
        return ((explicit % n) + n) % n;
    }
    return overlayHash(actorId) % n;
}
/** "#rrggbb" of a palette slot. */
function overlayColorHex(index) {
    const n = exports.OVERLAY_PALETTE.length;
    const v = exports.OVERLAY_PALETTE[((Math.trunc(index) % n) + n) % n];
    return '#' + v.toString(16).padStart(6, '0');
}
const DROP = /[\p{Cf}\p{Co}\p{Cn}\p{Cs}]/gu;
const SPACES = /[\p{Cc}\p{White_Space}]+/gu;
/**
 * A display-safe one-line label; mirrors overlayLabel in Common.swift:
 * format / private-use / unassigned / surrogate code points are dropped
 * (bidi overrides, zero-width characters), controls and whitespace runs
 * become one space, trimmed, at most 32 code points (31 + "…"), and
 * "unnamed" if nothing is left. Shown only via {@link overlayDisplayName}.
 */
function overlayLabel(raw) {
    const s = raw.replace(DROP, '').replace(SPACES, ' ').trim();
    if (!s) {
        return 'unnamed';
    }
    const cps = [...s];
    if (cps.length <= exports.OVERLAY_MAX_LABEL) {
        return s;
    }
    return (cps
        .slice(0, exports.OVERLAY_MAX_LABEL - 1)
        .join('')
        .trimEnd() + '…');
}
/**
 * How a label is shown: always behind the fixed "Agent: " prefix, as plain
 * text, so a subagent name can't pose as UI text.
 */
function overlayDisplayName(label) {
    return `智能体：${label === 'unnamed' ? '未命名' : label}`;
}
