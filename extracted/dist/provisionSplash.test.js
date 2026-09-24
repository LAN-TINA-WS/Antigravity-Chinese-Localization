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
const vitest_1 = require("vitest");
const mockWebContents = { executeJavaScript: vitest_1.vi.fn().mockResolvedValue(null) };
const mockWin = {
    loadURL: vitest_1.vi.fn().mockResolvedValue(undefined),
    once: vitest_1.vi.fn(),
    show: vitest_1.vi.fn(),
    close: vitest_1.vi.fn(),
    isDestroyed: vitest_1.vi.fn().mockReturnValue(false),
    webContents: mockWebContents,
};
vitest_1.vi.mock('electron', () => ({
    BrowserWindow: vitest_1.vi.fn(function () {
        return mockWin;
    }),
    nativeTheme: { shouldUseDarkColors: true },
}));
const provisionSplash_1 = require("./provisionSplash");
(0, vitest_1.describe)('createProvisionSplash', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockWin.isDestroyed.mockReturnValue(false);
    });
    (0, vitest_1.it)('opens a frameless data-URL window naming the distro', async () => {
        const { BrowserWindow } = await Promise.resolve().then(() => __importStar(require('electron')));
        (0, provisionSplash_1.createProvisionSplash)('Ubuntu');
        (0, vitest_1.expect)(vitest_1.vi.mocked(BrowserWindow)).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ frame: false, alwaysOnTop: true }));
        const url = mockWin.loadURL.mock.calls[0][0];
        (0, vitest_1.expect)(url).toMatch(/^data:text\/html/);
        (0, vitest_1.expect)(decodeURIComponent(url)).toContain('Setting up WSL: Ubuntu');
    });
    (0, vitest_1.it)('escapes HTML in the distro name', () => {
        (0, provisionSplash_1.createProvisionSplash)('<img>');
        const url = decodeURIComponent(mockWin.loadURL.mock.calls[0][0]);
        (0, vitest_1.expect)(url).not.toContain('<img>');
        (0, vitest_1.expect)(url).toContain('&lt;img&gt;');
    });
    (0, vitest_1.it)('updates the status line and closes safely', () => {
        const splash = (0, provisionSplash_1.createProvisionSplash)('Ubuntu');
        splash.setStatus('Downloading…');
        (0, vitest_1.expect)(mockWebContents.executeJavaScript).toHaveBeenCalledWith(vitest_1.expect.stringContaining('Downloading…'));
        splash.close();
        (0, vitest_1.expect)(mockWin.close).toHaveBeenCalled();
    });
    (0, vitest_1.it)('is a no-op after the window is destroyed', () => {
        const splash = (0, provisionSplash_1.createProvisionSplash)('Ubuntu');
        mockWin.isDestroyed.mockReturnValue(true);
        splash.setStatus('late');
        splash.close();
        (0, vitest_1.expect)(mockWebContents.executeJavaScript).not.toHaveBeenCalled();
        (0, vitest_1.expect)(mockWin.close).not.toHaveBeenCalled();
    });
});
