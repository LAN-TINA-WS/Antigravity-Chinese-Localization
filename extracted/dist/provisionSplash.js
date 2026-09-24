"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProvisionSplash = createProvisionSplash;
const electron_1 = require("electron");
function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
/**
 * Small frameless window shown while the WSL language server is downloaded
 * and installed at startup (first launch per version), so the app doesn't
 * appear dead during the multi-minute provisioning.
 */
function createProvisionSplash(distro) {
    const dark = electron_1.nativeTheme.shouldUseDarkColors;
    const bg = dark ? '#131313' : '#FAFAFA';
    const fg = dark ? '#FAFAFA' : '#383A42';
    const sub = dark ? '#9A9A9A' : '#6B6E76';
    const win = new electron_1.BrowserWindow({
        width: 380,
        height: 150,
        frame: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        alwaysOnTop: true,
        show: false,
        backgroundColor: bg,
        webPreferences: { sandbox: true },
    });
    const html = `<!doctype html>
<html>
  <head>
    <style>
      body {
        margin: 0;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${bg};
        color: ${fg};
        font: 500 13px system-ui, sans-serif;
        -webkit-app-region: drag;
        user-select: none;
        cursor: default;
      }
      .stack {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }
      .spinner {
        width: 22px;
        height: 22px;
        border: 2px solid ${sub};
        border-top-color: ${fg};
        border-radius: 50%;
        animation: rotate 1s linear infinite;
      }
      #status {
        color: ${sub};
        font-weight: 400;
        font-size: 12px;
      }
      @keyframes rotate {
        to {
          transform: rotate(360deg);
        }
      }
    </style>
  </head>
  <body>
    <div class="stack">
      <div class="spinner"></div>
      <div>正在配置 WSL: ${escapeHtml(distro)}</div>
      <div id="status">&nbsp;</div>
    </div>
  </body>
</html>`;
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    win.once('ready-to-show', () => win.show());
    return {
        setStatus(text) {
            if (win.isDestroyed()) {
                return;
            }
            void win.webContents
                .executeJavaScript(`document.getElementById('status').textContent = ${JSON.stringify(typeof text === 'string' ? (text.includes('Downloading the Antigravity binary') ? '正在下载 Antigravity 二进制组件…' : (text.startsWith('Installing into ') ? text.replace('Installing into ', '正在安装到 ') : text)) : text)}`)
                .catch(() => {
                // Non-fatal: the splash is purely informational.
            });
        },
        close() {
            if (!win.isDestroyed()) {
                win.close();
            }
        },
    };
}
