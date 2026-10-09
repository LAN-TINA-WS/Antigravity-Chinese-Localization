/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import fs from 'node:fs';
import util from 'node:util';
const mcpDebugNamespace = 'mcp:log';
let logFileStream;
const _debugLog = util.debuglog(mcpDebugNamespace);
export function saveLogsToFile(fileName) {
    const logFile = fs.createWriteStream(fileName, { flags: 'a+' });
    logFile.on('error', function (error) {
        console.error(`Error when opening/writing to log file: ${error.message}`);
        logFile.end();
        process.exit(1);
    });
    logFileStream = logFile;
    return logFile;
}
export function flushLogs(logFile, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(reject, timeoutMs);
        logFile.end(() => {
            clearTimeout(timeout);
            resolve();
        });
    });
}
export const logger = (...args) => {
    if (logFileStream) {
        logFileStream.write(`${new Date().toISOString()} ${mcpDebugNamespace} ${util.format(...args)}\n`);
    }
    else if (_debugLog.enabled) {
        _debugLog('%s %s', new Date().toISOString(), util.format(...args));
    }
};
export const puppeteerLogger = (prefix) => {
    if (logFileStream) {
        return (...args) => {
            logFileStream.write(`${new Date().toISOString()} ${prefix} ${util.format(...args)}\n`);
        };
    }
    const dbg = util.debuglog(prefix);
    return dbg.enabled
        ? (...args) => {
            dbg('%s %s', new Date().toISOString(), util.format(...args));
        }
        : undefined;
};
//# sourceMappingURL=logger.js.map