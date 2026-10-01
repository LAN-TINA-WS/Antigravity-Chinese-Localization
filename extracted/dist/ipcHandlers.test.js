"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const electron_1 = require("./__mocks__/electron");
const promises_1 = require("fs/promises");
vitest_1.vi.mock('electron');
vitest_1.vi.mock('electron-updater');
vitest_1.vi.mock('fs/promises', () => ({
    stat: vitest_1.vi.fn(),
}));
vitest_1.vi.mock('./ideInstall/constants', () => ({
    getIdeInstallPath: vitest_1.vi
        .fn()
        .mockReturnValue('/Applications/Antigravity IDE.app'),
}));
// Capture registered handlers so we can invoke them in tests
const handlers = new Map();
vitest_1.vi.mocked(electron_1.ipcMain.handle).mockImplementation((channel, handler) => {
    handlers.set(channel, handler);
});
// Import after mocks are in place
const ipcHandlers_1 = require("./ipcHandlers");
(0, vitest_1.describe)('ipcHandlers — notifications', () => {
    (0, vitest_1.beforeEach)(() => {
        handlers.clear();
        vitest_1.vi.clearAllMocks();
        (0, ipcHandlers_1.registerIpcHandlers)({});
    });
    (0, vitest_1.describe)('notification:send', () => {
        (0, vitest_1.it)('should create and show a Notification with the given options', () => {
            const handler = handlers.get('notification:send');
            const options = {
                id: 'test-1',
                title: 'Test Title',
                body: 'Test Body',
                silent: true,
            };
            handler({ sender: { send: vitest_1.vi.fn() } }, options);
            (0, vitest_1.expect)(electron_1.Notification).toHaveBeenCalledWith({
                title: 'Test Title',
                body: 'Test Body',
                silent: true,
            });
            (0, vitest_1.expect)(electron_1.Notification._mockInstance.show).toHaveBeenCalled();
        });
        (0, vitest_1.it)('should default silent to false when not specified', () => {
            const handler = handlers.get('notification:send');
            handler({ sender: { send: vitest_1.vi.fn() } }, { id: 'test-2', title: 'T', body: 'B' });
            (0, vitest_1.expect)(electron_1.Notification).toHaveBeenCalledWith({
                title: 'T',
                body: 'B',
                silent: false,
            });
        });
        (0, vitest_1.it)('should register a click handler that focuses the window', () => {
            const handler = handlers.get('notification:send');
            handler({ sender: { send: vitest_1.vi.fn() } }, { id: 'test-3', title: 'T', body: 'B' });
            // Verify 'click' listener was registered
            (0, vitest_1.expect)(electron_1.Notification._mockInstance.on).toHaveBeenCalledWith('click', vitest_1.expect.any(Function));
            // Simulate click
            const clickHandler = vitest_1.vi.mocked(electron_1.Notification._mockInstance.on).mock
                .calls[0][1];
            const mockWin = electron_1.BrowserWindow.getAllWindows()[0];
            Object.assign(mockWin, {
                isMinimized: vitest_1.vi.fn().mockReturnValue(true),
                restore: vitest_1.vi.fn(),
                show: vitest_1.vi.fn(),
                focus: vitest_1.vi.fn(),
            });
            clickHandler();
            (0, vitest_1.expect)(mockWin.isMinimized).toHaveBeenCalled();
            (0, vitest_1.expect)(mockWin.restore).toHaveBeenCalled();
            (0, vitest_1.expect)(mockWin.show).toHaveBeenCalled();
            (0, vitest_1.expect)(mockWin.focus).toHaveBeenCalled();
        });
    });
    (0, vitest_1.describe)('notification:open-system-preferences', () => {
        (0, vitest_1.it)('should call shell.openExternal on macOS', () => {
            // Override platform for this test
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            const handler = handlers.get('notification:open-system-preferences');
            handler({});
            (0, vitest_1.expect)(electron_1.shell.openExternal).toHaveBeenCalledWith('x-apple.systempreferences:com.apple.preference.notifications');
            // Restore
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });
        (0, vitest_1.it)('should not call shell.openExternal on non-macOS', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'linux' });
            const handler = handlers.get('notification:open-system-preferences');
            handler({});
            (0, vitest_1.expect)(electron_1.shell.openExternal).not.toHaveBeenCalled();
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });
    });
    (0, vitest_1.describe)('ide:is-installed', () => {
        (0, vitest_1.it)('should return true if the IDE installation directory exists', async () => {
            const handler = handlers.get('ide:is-installed');
            vitest_1.vi.mocked(promises_1.stat).mockResolvedValue({});
            const result = await handler({});
            (0, vitest_1.expect)(result).toBe(true);
            (0, vitest_1.expect)(promises_1.stat).toHaveBeenCalledWith(vitest_1.expect.stringContaining('Antigravity IDE'));
        });
        (0, vitest_1.it)('should return false if the stat call throws an error', async () => {
            const handler = handlers.get('ide:is-installed');
            vitest_1.vi.mocked(promises_1.stat).mockRejectedValue(new Error('ENOENT'));
            const result = await handler({});
            (0, vitest_1.expect)(result).toBe(false);
        });
    });
    (0, vitest_1.describe)('window:show-context-menu', () => {
        (0, vitest_1.it)('should build native menu, popup on focused window, and resolve with clicked item id', async () => {
            const handler = handlers.get('window:show-context-menu');
            const mockMenu = electron_1.Menu.buildFromTemplate([]);
            vitest_1.vi.mocked(mockMenu.popup).mockImplementation(() => {
                const template = vitest_1.vi
                    .mocked(electron_1.Menu.buildFromTemplate)
                    .mock.calls.at(-1)?.[0];
                const copySubmenu = template?.[1]?.submenu;
                copySubmenu?.[0]?.click?.();
            });
            const result = await handler({}, [
                { id: 'sep-1', type: 'separator' },
                {
                    id: 'copy-group',
                    label: 'Copy',
                    type: 'submenu',
                    submenu: [
                        {
                            id: 'copy-id',
                            label: 'Copy Conversation ID',
                            accelerator: 'CmdOrCtrl+C',
                        },
                    ],
                },
                { id: 'disabled-item', label: 'Disabled', disabled: true },
            ]);
            (0, vitest_1.expect)(result).toBe('copy-id');
            (0, vitest_1.expect)(electron_1.Menu.buildFromTemplate).toHaveBeenCalledWith([
                { type: 'separator' },
                {
                    id: 'copy-group',
                    label: 'Copy',
                    type: 'submenu',
                    enabled: true,
                    submenu: [
                        vitest_1.expect.objectContaining({
                            id: 'copy-id',
                            label: 'Copy Conversation ID',
                            type: 'normal',
                            enabled: true,
                            accelerator: 'CmdOrCtrl+C',
                        }),
                    ],
                },
                vitest_1.expect.objectContaining({
                    id: 'disabled-item',
                    label: 'Disabled',
                    type: 'normal',
                    enabled: false,
                }),
            ]);
            (0, vitest_1.expect)(mockMenu.popup).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                window: electron_1.BrowserWindow.getFocusedWindow(),
                callback: vitest_1.expect.any(Function),
            }));
        });
        (0, vitest_1.it)('should resolve with null when menu closes without selection', async () => {
            const handler = handlers.get('window:show-context-menu');
            const mockMenu = electron_1.Menu.buildFromTemplate([]);
            vitest_1.vi.mocked(mockMenu.popup).mockImplementation((opts) => {
                opts?.callback?.();
            });
            const result = await handler({}, [{ id: 'copy', label: 'Copy' }]);
            (0, vitest_1.expect)(result).toBeNull();
        });
        (0, vitest_1.it)('should return null without popping up menu when items is empty', async () => {
            const handler = handlers.get('window:show-context-menu');
            vitest_1.vi.mocked(electron_1.Menu.buildFromTemplate).mockClear();
            const result = await handler({}, []);
            (0, vitest_1.expect)(result).toBeNull();
            (0, vitest_1.expect)(electron_1.Menu.buildFromTemplate).not.toHaveBeenCalled();
        });
    });
});
