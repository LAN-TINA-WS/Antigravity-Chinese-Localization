"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const mockLogger = {
    initialize: vitest_1.vi.fn(),
    functions: {},
    info: vitest_1.vi.fn(),
    warn: vitest_1.vi.fn(),
    error: vitest_1.vi.fn(),
    debug: vitest_1.vi.fn(),
    log: vitest_1.vi.fn(),
    transports: {
        file: {
            getFile: vitest_1.vi.fn().mockReturnValue({ path: '/mock/logs/main.log' }),
        },
        console: {},
    },
};
exports.default = mockLogger;
