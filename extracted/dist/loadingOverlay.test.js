"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const mockView = {
    webContents: { loadURL: vitest_1.vi.fn().mockResolvedValue(undefined) },
    setBounds: vitest_1.vi.fn(),
};
vitest_1.vi.mock('electron', () => ({
    WebContentsView: vitest_1.vi.fn(function () {
        return mockView;
    }),
}));
const loadingOverlay_1 = require("./loadingOverlay");
(0, vitest_1.describe)('attachLoadingOverlay', () => {
    (0, vitest_1.it)('loads the SVG overlay and removes it on did-finish-load', () => {
        const win = {
            contentView: { addChildView: vitest_1.vi.fn(), removeChildView: vitest_1.vi.fn() },
            getContentSize: vitest_1.vi.fn().mockReturnValue([1280, 800]),
            on: vitest_1.vi.fn(),
            off: vitest_1.vi.fn(),
            webContents: { once: vitest_1.vi.fn() },
        };
        (0, loadingOverlay_1.attachLoadingOverlay)(win, '#FAFAFA', '#131313');
        const url = decodeURIComponent(mockView.webContents.loadURL.mock.calls[0][0]);
        (0, vitest_1.expect)(url).toContain('<svg');
        (0, vitest_1.expect)(win.contentView.addChildView).toHaveBeenCalledWith(mockView);
        const onFinishLoad = win.webContents.once.mock.calls[0][1];
        onFinishLoad();
        (0, vitest_1.expect)(win.contentView.removeChildView).toHaveBeenCalledWith(mockView);
    });
});
