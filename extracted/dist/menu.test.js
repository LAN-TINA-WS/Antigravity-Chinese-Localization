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
vitest_1.vi.mock('electron');
vitest_1.vi.mock('./utils', () => ({
    createWindow: vitest_1.vi.fn(),
    isMacOS: vitest_1.vi.fn().mockReturnValue(false),
}));
vitest_1.vi.mock('./updater', () => ({
    updateActions: {},
    MenuUpdateStep: { CheckForUpdates: 'Check for Updates' },
}));
vitest_1.vi.mock('./wsl', () => ({
    isWslAvailable: vitest_1.vi.fn().mockReturnValue(true),
    listWslDistros: vitest_1.vi.fn().mockResolvedValue([
        { name: 'Ubuntu', version: 2, isDefault: true },
        { name: 'Debian', version: 2, isDefault: false },
    ]),
    getActiveWslDistro: vitest_1.vi.fn().mockReturnValue('Ubuntu'),
    persistWslDistro: vitest_1.vi.fn(),
    WSL_STATE_FILE: 'wsl_state.json',
}));
const originalPlatform = process.platform;
const originalArgv = process.argv;
function setPlatform(platform) {
    Object.defineProperty(process, 'platform', { value: platform });
}
(0, vitest_1.describe)('wslConnectMenuTemplate', () => {
    (0, vitest_1.beforeEach)(async () => {
        vitest_1.vi.clearAllMocks();
        vitest_1.vi.resetModules();
        setPlatform('win32');
        const wsl = await Promise.resolve().then(() => __importStar(require('./wsl')));
        vitest_1.vi.mocked(wsl.isWslAvailable).mockReturnValue(true);
        vitest_1.vi.mocked(wsl.listWslDistros).mockResolvedValue([
            { name: 'Ubuntu', version: 2, isDefault: true },
            { name: 'Debian', version: 2, isDefault: false },
        ]);
        vitest_1.vi.mocked(wsl.getActiveWslDistro).mockReturnValue('Ubuntu');
    });
    (0, vitest_1.afterEach)(() => {
        setPlatform(originalPlatform);
        process.argv = originalArgv;
    });
    (0, vitest_1.it)('returns null when WSL is unavailable', async () => {
        const wsl = await Promise.resolve().then(() => __importStar(require('./wsl')));
        vitest_1.vi.mocked(wsl.isWslAvailable).mockReturnValue(false);
        const { wslConnectMenuTemplate } = await Promise.resolve().then(() => __importStar(require('./menu')));
        (0, vitest_1.expect)(await wslConnectMenuTemplate()).toBeNull();
    });
    (0, vitest_1.it)('lists only distros, with the active one checked', async () => {
        const { wslConnectMenuTemplate } = await Promise.resolve().then(() => __importStar(require('./menu')));
        const template = await wslConnectMenuTemplate();
        (0, vitest_1.expect)(template?.label).toBe('Connect to WSL');
        const submenu = template?.submenu;
        (0, vitest_1.expect)(submenu.map((i) => i.label)).toEqual(['Ubuntu', 'Debian']);
        (0, vitest_1.expect)(submenu[0].checked).toBe(true);
        (0, vitest_1.expect)(submenu[1].checked).toBe(false);
    });
    (0, vitest_1.it)('offers Reopen Locally as a separate item only in WSL mode', async () => {
        const wsl = await Promise.resolve().then(() => __importStar(require('./wsl')));
        const { wslReopenLocallyTemplate } = await Promise.resolve().then(() => __importStar(require('./menu')));
        (0, vitest_1.expect)(wslReopenLocallyTemplate()?.label).toBe('Reopen Locally');
        vitest_1.vi.mocked(wsl.getActiveWslDistro).mockReturnValue('');
        (0, vitest_1.expect)(wslReopenLocallyTemplate()).toBeNull();
    });
    (0, vitest_1.it)('relaunches with --wsl-distro when a different distro is clicked', async () => {
        const { app } = await Promise.resolve().then(() => __importStar(require('electron')));
        const wsl = await Promise.resolve().then(() => __importStar(require('./wsl')));
        process.argv = ['electron.exe', '.', '--wsl-distro=Ubuntu'];
        const { wslConnectMenuTemplate } = await Promise.resolve().then(() => __importStar(require('./menu')));
        const template = await wslConnectMenuTemplate();
        const submenu = template?.submenu;
        submenu[1].click();
        (0, vitest_1.expect)(wsl.persistWslDistro).toHaveBeenCalledWith(vitest_1.expect.stringContaining('wsl_state.json'), 'Debian');
        (0, vitest_1.expect)(app.relaunch).toHaveBeenCalledWith({
            args: ['.', '--wsl-distro=Debian'],
        });
        (0, vitest_1.expect)(app.quit).toHaveBeenCalled();
    });
    (0, vitest_1.it)('relaunches without --wsl-distro for Reopen Locally', async () => {
        const { app } = await Promise.resolve().then(() => __importStar(require('electron')));
        const wsl = await Promise.resolve().then(() => __importStar(require('./wsl')));
        process.argv = ['electron.exe', '.', '--wsl-distro=Ubuntu'];
        const { wslReopenLocallyTemplate } = await Promise.resolve().then(() => __importStar(require('./menu')));
        const item = wslReopenLocallyTemplate();
        (item?.click)();
        (0, vitest_1.expect)(wsl.persistWslDistro).toHaveBeenCalledWith(vitest_1.expect.stringContaining('wsl_state.json'), '');
        (0, vitest_1.expect)(app.relaunch).toHaveBeenCalledWith({ args: ['.'] });
        (0, vitest_1.expect)(app.quit).toHaveBeenCalled();
    });
    (0, vitest_1.it)('does not relaunch when the active distro is clicked', async () => {
        const { app } = await Promise.resolve().then(() => __importStar(require('electron')));
        const wsl = await Promise.resolve().then(() => __importStar(require('./wsl')));
        const { wslConnectMenuTemplate } = await Promise.resolve().then(() => __importStar(require('./menu')));
        const template = await wslConnectMenuTemplate();
        const submenu = template?.submenu;
        submenu[0].click();
        (0, vitest_1.expect)(wsl.persistWslDistro).not.toHaveBeenCalled();
        (0, vitest_1.expect)(app.relaunch).not.toHaveBeenCalled();
        (0, vitest_1.expect)(app.quit).not.toHaveBeenCalled();
    });
});
