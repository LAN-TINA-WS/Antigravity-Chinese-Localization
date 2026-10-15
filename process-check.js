'use strict';

const { execFileSync } = require('child_process');

function isAppRunningStrict({ platform = process.platform, run = execFileSync } = {}) {
  if (platform === 'win32') {
    const output = run('tasklist.exe', ['/FO', 'CSV', '/NH'], {
      encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024
    });
    const names = String(output).split(/\r?\n/).map(line => {
      const match = /^"([^"]+)"/.exec(line.trim());
      return match && match[1].toLowerCase();
    }).filter(Boolean);
    if (!names.length) throw new Error('无法解析 Windows 进程列表');
    return names.some(name => ['antigravity.exe', 'language_server.exe'].includes(name));
  }
  try {
    run('pgrep', ['-xi', 'antigravity|language_server'], { stdio: 'ignore' });
    return true;
  } catch (error) {
    // pgrep uses exit 1 for no matches; execution and permission failures
    // must propagate so the installer cannot mistake them for an idle app.
    if (error.status === 1) return false;
    throw error;
  }
}

module.exports = { isAppRunningStrict };
