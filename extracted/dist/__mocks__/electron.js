"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webUtils = exports.webFrame = exports.webContents = exports.session = exports.ipcRenderer = exports.contextBridge = exports.shell = exports.Notification = exports.Menu = exports.MenuItem = exports.Tray = exports.nativeImage = exports.protocol = exports.ipcMain = exports.dialog = exports.MessageChannelMain = exports.WebContentsView = exports.BrowserWindow = exports.app = void 0;
/**
 * Shared Electron mock for all test files.
 *
 * This file is automatically used by Vitest when a test calls
 * `vi.mock('electron')` without a factory argument, because it lives
 * in the `__mocks__` directory.
 *
 * Individual tests can still override specific properties on these
 * mock objects in their `beforeEach` or `vi.hoisted` blocks.
 */
const vitest_1 = require("vitest");
exports.app = {
    whenReady: vitest_1.vi.fn().mockReturnValue({
        then: vitest_1.vi.fn().mockImplementation(function (cb) {
            this.cb = cb;
            return { catch: vitest_1.vi.fn() };
        }),
    }),
    on: vitest_1.vi.fn(),
    quit: vitest_1.vi.fn(),
    relaunch: vitest_1.vi.fn(),
    isPackaged: true,
    getAppPath: vitest_1.vi.fn().mockReturnValue('/mock/path'),
    getPath: vitest_1.vi.fn().mockReturnValue('/mock/user/data'),
    getVersion: vitest_1.vi.fn().mockReturnValue('1.0.0'),
    getName: vitest_1.vi.fn().mockReturnValue('App'),
    commandLine: {
        appendSwitch: vitest_1.vi.fn(),
        hasSwitch: vitest_1.vi.fn().mockReturnValue(false),
    },
    dock: {
        show: vitest_1.vi.fn(),
        hide: vitest_1.vi.fn(),
        setIcon: vitest_1.vi.fn(),
        setMenu: vitest_1.vi.fn(),
    },
    requestSingleInstanceLock: vitest_1.vi.fn().mockReturnValue(true),
    isDefaultProtocolClient: vitest_1.vi.fn().mockReturnValue(false),
    setAsDefaultProtocolClient: vitest_1.vi.fn().mockReturnValue(true),
    isReady: vitest_1.vi.fn().mockReturnValue(true),
    focus: vitest_1.vi.fn(),
    getAppMetrics: vitest_1.vi.fn().mockReturnValue([]),
};
const _mockBrowserWindowInstance = {
    loadURL: vitest_1.vi.fn(),
    once: vitest_1.vi.fn(),
    close: vitest_1.vi.fn(),
    show: vitest_1.vi.fn(),
    focus: vitest_1.vi.fn(),
    isMinimized: vitest_1.vi.fn().mockReturnValue(false),
    restore: vitest_1.vi.fn(),
    on: vitest_1.vi.fn(),
    off: vitest_1.vi.fn(),
    isDestroyed: vitest_1.vi.fn().mockReturnValue(false),
    getContentSize: vitest_1.vi.fn().mockReturnValue([1000, 800]),
    contentView: {
        addChildView: vitest_1.vi.fn(),
        removeChildView: vitest_1.vi.fn(),
    },
    webContents: {
        id: 1,
        isDestroyed: vitest_1.vi.fn().mockReturnValue(false),
        getType: vitest_1.vi.fn().mockReturnValue('window'),
        send: vitest_1.vi.fn(),
        postMessage: vitest_1.vi.fn(),
        on: vitest_1.vi.fn(),
        once: vitest_1.vi.fn(),
        removeListener: vitest_1.vi.fn(),
        setWindowOpenHandler: vitest_1.vi.fn(),
    },
};
exports.BrowserWindow = Object.assign(vitest_1.vi.fn().mockImplementation(function () {
    return _mockBrowserWindowInstance;
}), {
    getAllWindows: vitest_1.vi.fn().mockReturnValue([_mockBrowserWindowInstance]),
    getFocusedWindow: vitest_1.vi.fn().mockReturnValue(_mockBrowserWindowInstance),
});
exports.WebContentsView = vitest_1.vi.fn().mockImplementation(function () {
    return {
        webContents: {
            loadURL: vitest_1.vi.fn().mockResolvedValue(undefined),
            executeJavaScript: vitest_1.vi.fn().mockResolvedValue({ ok: true }),
            postMessage: vitest_1.vi.fn(),
            on: vitest_1.vi.fn(),
            once: vitest_1.vi.fn(),
            removeListener: vitest_1.vi.fn(),
            setWebRTCIPHandlingPolicy: vitest_1.vi.fn(),
            setWindowOpenHandler: vitest_1.vi.fn(),
            getOSProcessId: vitest_1.vi.fn().mockReturnValue(12345),
            isDestroyed: vitest_1.vi.fn().mockReturnValue(false),
            close: vitest_1.vi.fn(),
            destroy: vitest_1.vi.fn(),
        },
        setBounds: vitest_1.vi.fn(),
    };
});
exports.MessageChannelMain = vitest_1.vi.fn().mockImplementation(function () {
    return {
        port1: {
            postMessage: vitest_1.vi.fn(),
            close: vitest_1.vi.fn(),
            on: vitest_1.vi.fn(),
            once: vitest_1.vi.fn(),
            start: vitest_1.vi.fn(),
        },
        port2: {
            postMessage: vitest_1.vi.fn(),
            close: vitest_1.vi.fn(),
            on: vitest_1.vi.fn(),
            once: vitest_1.vi.fn(),
            start: vitest_1.vi.fn(),
        },
    };
});
exports.dialog = {
    showErrorBox: vitest_1.vi.fn(),
    showMessageBox: vitest_1.vi.fn(),
};
exports.ipcMain = {
    handle: vitest_1.vi.fn(),
    removeHandler: vitest_1.vi.fn(),
};
exports.protocol = {
    registerSchemesAsPrivileged: vitest_1.vi.fn(),
    handle: vitest_1.vi.fn(),
};
const _mockNativeImage = {
    setTemplateImage: vitest_1.vi.fn(),
};
exports.nativeImage = {
    createFromPath: vitest_1.vi.fn().mockReturnValue(_mockNativeImage),
};
exports.Tray = vitest_1.vi.fn().mockImplementation(function () {
    return {
        setToolTip: vitest_1.vi.fn(),
        setContextMenu: vitest_1.vi.fn(),
        on: vitest_1.vi.fn(),
        destroy: vitest_1.vi.fn(),
    };
});
exports.MenuItem = vitest_1.vi.fn().mockImplementation(function (options) {
    Object.assign(this, options);
});
const _mockMenuInstance = {
    items: [
        {
            label: 'File',
            submenu: {
                insert: vitest_1.vi.fn(),
            },
        },
    ],
    getMenuItemById: vitest_1.vi.fn().mockReturnValue({ label: '' }),
    popup: vitest_1.vi.fn(),
};
exports.Menu = Object.assign(vitest_1.vi.fn().mockImplementation(function () {
    this.items = [];
    this.append = (item) => {
        this.items.push(item);
    };
}), {
    buildFromTemplate: vitest_1.vi.fn().mockReturnValue(_mockMenuInstance),
    getApplicationMenu: vitest_1.vi.fn().mockReturnValue(_mockMenuInstance),
    setApplicationMenu: vitest_1.vi.fn(),
});
const _mockNotificationInstance = {
    show: vitest_1.vi.fn(),
    on: vitest_1.vi.fn(),
};
exports.Notification = Object.assign(vitest_1.vi.fn().mockImplementation(function () {
    return _mockNotificationInstance;
}), {
    // Static method
    isSupported: vitest_1.vi.fn().mockReturnValue(true),
    // Expose the mock instance for assertions
    _mockInstance: _mockNotificationInstance,
});
exports.shell = {
    openExternal: vitest_1.vi.fn().mockResolvedValue(undefined),
};
exports.contextBridge = {
    exposeInMainWorld: vitest_1.vi.fn(),
};
exports.ipcRenderer = {
    invoke: vitest_1.vi.fn(),
    on: vitest_1.vi.fn(),
    removeListener: vitest_1.vi.fn(),
};
exports.session = {
    defaultSession: {
        on: vitest_1.vi.fn(),
        setProxy: vitest_1.vi.fn().mockResolvedValue(undefined),
        closeAllConnections: vitest_1.vi.fn().mockResolvedValue(undefined),
        setCertificateVerifyProc: vitest_1.vi.fn(),
    },
    fromPartition: vitest_1.vi.fn().mockImplementation(() => {
        let preloadScripts = [];
        let legacyPreloads = [];
        return {
            on: vitest_1.vi.fn(),
            setProxy: vitest_1.vi.fn().mockResolvedValue(undefined),
            getPreloadScripts: vitest_1.vi.fn(() => [...preloadScripts]),
            registerPreloadScript: vitest_1.vi.fn((script) => {
                const id = script.id ?? `preload-${preloadScripts.length + 1}`;
                preloadScripts.push({
                    id,
                    filePath: script.filePath,
                    type: script.type,
                });
                return id;
            }),
            unregisterPreloadScript: vitest_1.vi.fn((id) => {
                preloadScripts = preloadScripts.filter((s) => s.id !== id);
            }),
            getPreloads: vitest_1.vi.fn(() => [...legacyPreloads]),
            setPreloads: vitest_1.vi.fn((preloads) => {
                legacyPreloads = [...preloads];
            }),
            setPermissionRequestHandler: vitest_1.vi.fn(),
            setPermissionCheckHandler: vitest_1.vi.fn(),
            webRequest: {
                onBeforeRequest: vitest_1.vi.fn(),
            },
        };
    }),
};
exports.webContents = {
    fromId: vitest_1.vi.fn(),
};
exports.webFrame = {
    executeJavaScript: vitest_1.vi.fn().mockResolvedValue(undefined),
    getZoomFactor: vitest_1.vi.fn().mockReturnValue(1),
};
exports.webUtils = {
    getPathForFile: vitest_1.vi.fn().mockReturnValue('/mock/file/path'),
};
