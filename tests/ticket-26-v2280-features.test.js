const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');
const { readAsarPackageVersion } = require('../asar-version');

console.log('=== 开始 Ticket-26 Antigravity 2.28.0 官方版本与架构特性专项测试 ===\n');

// 1. 读取当前工程与解包文件
const localizePath = path.join(__dirname, '..', 'localize.js');
const localizeSource = fs.readFileSync(localizePath, 'utf-8');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'extracted', 'package.json'), 'utf-8'));
const indexPath = path.join(__dirname, '..', 'index.html');
const indexSource = fs.readFileSync(indexPath, 'utf-8');
const readmePath = path.join(__dirname, '..', 'README.md');
const readmeSource = fs.readFileSync(readmePath, 'utf-8');
const readmeEnPath = path.join(__dirname, '..', 'README.en.md');
const readmeEnSource = fs.readFileSync(readmeEnPath, 'utf-8');
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
const changelogSource = fs.readFileSync(changelogPath, 'utf-8');
const changelogEnPath = path.join(__dirname, '..', 'CHANGELOG.en.md');
const changelogEnSource = fs.readFileSync(changelogEnPath, 'utf-8');
const readyAsarPath = path.join(__dirname, '..', 'app.asar.ready');

let passed = 0;
let total = 0;

function check(desc, actual, expected) {
  total++;
  try {
    assert.strictEqual(actual, expected);
    console.log(`PASS [${total}]: ${desc} => "${actual}"`);
    passed++;
  } catch (err) {
    console.error(`FAIL [${total}]: ${desc}`);
    console.error(`   期望: "${expected}"`);
    console.error(`   实际: "${actual}"`);
  }
}

// 2. 2.28.0 版本元数据校验
console.log('--- 1. 2.28.0 版本元数据校验 ---');
function isVerGte2280(ver) {
  if (!ver) return false;
  const parts = ver.split('.').map(n => parseInt(n, 10));
  if (parts[0] > 2) return true;
  if (parts[0] === 2 && parts[1] > 28) return true;
  if (parts[0] === 2 && parts[1] === 28 && parts[2] >= 0) return true;
  return false;
}
const versionMatch = localizeSource.match(/const CURRENT_VERSION = ['"]([^'"]+)['"];/);
const currentVer = versionMatch ? versionMatch[1] : '';
check('localize.js CURRENT_VERSION 严格等于 2.28.0', currentVer, '2.28.0');
check('extracted/package.json version 严格等于 2.28.0', packageJson.version, '2.28.0');
if (fs.existsSync(readyAsarPath)) {
  check('app.asar.ready 读取包版本严格等于 2.28.0', readAsarPackageVersion(readyAsarPath), '2.28.0');
}
check('index.html 包含 控制中心 v2.28.0', (() => {
  const m = indexSource.match(/(?:本地词库|控制中心) v(2\.\d+\.\d+)/);
  return m ? m[1] === '2.28.0' : false;
})(), true);
check('index.html 包含 Antigravity 汉化', indexSource.includes('<h1>Antigravity 汉化</h1>'), true);
check('README.md 包含 Antigravity v2.28.0+', readmeSource.includes('Antigravity v2.28.0+'), true);
check('README.en.md 包含 Antigravity v2.28.0+', readmeEnSource.includes('Antigravity v2.28.0+'), true);
check('CHANGELOG.md 包含 2.28.0 版本日志条目', changelogSource.includes('## v2.28.0 (2026-10-28)'), true);
check('CHANGELOG.en.md 包含 2.28.0 版本日志条目', changelogEnSource.includes('## v2.28.0 (2026-10-28)'), true);

// 3. 2.28.0 官方架构新增模块与主进程接口完备性校验
console.log('\n--- 2. 2.28.0 官方架构新增模块与接口完备性校验 ---');
const distDir = path.join(__dirname, '..', 'extracted', 'dist');
check('2.28.0 新增 webauthn.js 模块存在', fs.existsSync(path.join(distDir, 'webauthn.js')), true);
check('2.28.0 新增 webviewBrowser.js 模块存在', fs.existsSync(path.join(distDir, 'webviewBrowser.js')), true);
check('2.28.0 新增 scriptJail.js 模块存在', fs.existsSync(path.join(distDir, 'scriptJail.js')), true);
check('2.28.0 新增 qrEncoder.js 模块存在', fs.existsSync(path.join(distDir, 'qrEncoder.js')), true);
check('2.28.0 新增 webviewSecurityState.js 模块存在', fs.existsSync(path.join(distDir, 'webviewSecurityState.js')), true);

const preloadSource = fs.readFileSync(path.join(distDir, 'preload.js'), 'utf-8');
const ipcSource = fs.readFileSync(path.join(distDir, 'ipcHandlers.js'), 'utf-8');
const traySource = fs.readFileSync(path.join(distDir, 'tray.js'), 'utf-8');
const menuSource = fs.readFileSync(path.join(distDir, 'menu.js'), 'utf-8');
const updaterSource = fs.readFileSync(path.join(distDir, 'updater.js'), 'utf-8');
const wizardHtmlSource = fs.readFileSync(path.join(distDir, 'ideInstall', 'wizardHtml.js'), 'utf-8');
const webauthnSource = fs.readFileSync(path.join(distDir, 'webauthn.js'), 'utf-8');

check('preload.js 官方支持 runScriptInJail 桥接接口', preloadSource.includes('runScriptInJail:'), true);
check('preload.js 官方支持 onWebviewOpenNewTab 桥接接口', preloadSource.includes('onWebviewOpenNewTab:'), true);
check('preload.js 官方支持 subscribeWebviewSecurityState 桥接接口', preloadSource.includes('subscribeWebviewSecurityState:'), true);
check('preload.js 注入汉化引擎标记', preloadSource.includes('// Antigravity 2.0 Chinese Localization Engine'), true);
check('ipcHandlers.js 保持原生 show-context-menu 调度支持', ipcSource.includes('window:show-context-menu'), true);
check('ipcHandlers.js 注入 translateContextLabel 过滤器', ipcSource.includes('translateContextLabel('), true);
check('menu.js 注入 translateMenu 递归汉化机制', menuSource.includes('translateMenu('), true);
check('tray.js 注入运行中智能体数量汉化', traySource.includes('个智能体运行中'), true);
check('updater.js 检查更新弹窗汉化', updaterSource.includes('当前已是最新版本，暂无可用更新。'), true);
check('wizardHtml.js 首发向导模板汉化', wizardHtmlSource.includes('欢迎使用全新 Antigravity！'), true);
check('webauthn.js 通行密钥模态弹窗标题汉化', webauthnSource.includes("title: '选择通行密钥"), true);
check('webauthn.js 通行密钥详情文案汉化', webauthnSource.includes("通行密钥") && webauthnSource.includes("以继续"), true);
check('webauthn.js 通行密钥取消按钮汉化', webauthnSource.includes("buttons: [...accountLabels, '取消'],"), true);
check('webauthn.js 通行密钥账号标签格式化汉化', webauthnSource.includes("${index + 1}") && (webauthnSource.includes("账号") || webauthnSource.includes("账户")), true);

// 4. 实时汉化引擎沙箱测试
console.log('\n--- 3. 实时汉化引擎与 2.28.0 新特性词条校验 ---');
const sandbox = {
  globalThis: {},
  window: {},
  document: { body: {}, addEventListener: () => {}, readyState: 'loading' },
  NodeFilter: { SHOW_TEXT: 4 },
  Node: { TEXT_NODE: 3, ELEMENT_NODE: 1, DOCUMENT_FRAGMENT_NODE: 11 },
  Element: { prototype: {} },
  MutationObserver: class { observe() {} disconnect() {} },
  WeakSet: WeakSet,
  WeakMap: WeakMap,
  Set: Set,
  Map: Map,
  queueMicrotask: (fn) => fn(),
  requestAnimationFrame: (fn) => fn(),
  console: console
};
vm.createContext(sandbox);

const marker = '// Antigravity 2.0 Chinese Localization Engine';
const markerIdx = preloadSource.indexOf(marker);
assert.ok(markerIdx !== -1, 'preload.js 必须包含汉化引擎注入标记');
const engineCode = preloadSource.substring(markerIdx);

const exportInstrument = engineCode.replace(
  "if (document.readyState === 'loading')",
  'globalThis.__test_translateString = translateString;\n  if (typeof document !== "undefined" && document.readyState === "loading")'
);

vm.runInContext(exportInstrument, sandbox);
const translate = sandbox.globalThis.__test_translateString;
assert.ok(typeof translate === 'function', 'translateString 必须在 VM 沙箱内可正常调用');

// 验证 2.28.0 新增词条
check('2.28.0 词条: Choose a Passkey', translate('Choose a Passkey'), '选择通行密钥 (Passkey)');
check('2.28.0 词条: Select a passkey account to continue:', translate('Select a passkey account to continue:'), '选择通行密钥账号以继续：');
check('2.28.0 词条: Passkey', translate('Passkey'), '通行密钥');
check('2.28.0 词条: Passkeys', translate('Passkeys'), '通行密钥');
check('2.28.0 词条: Passkey QR code', translate('Passkey QR code'), '通行密钥二维码');
check('2.28.0 词条: Scan with your phone', translate('Scan with your phone'), '使用手机扫码');
check('2.28.0 词条: Security State', translate('Security State'), '安全状态');
check('2.28.0 词条: Secure Connection', translate('Secure Connection'), '安全连接');
check('2.28.0 词条: Insecure Connection', translate('Insecure Connection'), '不安全连接');
check('2.28.0 词条: Script Jail', translate('Script Jail'), '脚本安全沙箱');
check('2.28.0 词条: Webview Browser', translate('Webview Browser'), '内置浏览器');
check('2.28.0 词条: Open in Browser', translate('Open in Browser'), '在浏览器中打开');
check('2.28.0 词条: Open Link in New Tab', translate('Open Link in New Tab'), '在新标签页中打开链接');
check('2.28.0 词条: Close Tab', translate('Close Tab'), '关闭标签页');
check('2.28.0 词条: Duplicate Tab', translate('Duplicate Tab'), '复制标签页');
check('2.28.0 词条: Pin Tab', translate('Pin Tab'), '固定标签页');
check('2.28.0 词条: Copy URL', translate('Copy URL'), '复制链接');
check('2.28.0 词条: View Page Source', translate('View Page Source'), '查看网页源代码');

// 基础与反馈词条回归
check('基础词条: Give Feedback', translate('Give Feedback'), '提供反馈');
check('基础词条: Send Feedback', translate('Send Feedback'), '发送反馈');
check('基础词条: Models within this group', translate('Models within this group'), '本组内的模型');
check('基础词条: Windows Subsystem for Linux', translate('Windows Subsystem for Linux'), '适用于 Linux 的 Windows 子系统');

console.log(`\n================ 测试汇总 ================`);
console.log(`总计: ${total}, 通过: ${passed}, 失败: ${total - passed}`);
if (passed === total) {
  console.log('Ticket-26 Antigravity 2.28.0 官方版本与架构特性专项测试 100% 全部通过！');
  process.exit(0);
} else {
  console.error(`存在 ${total - passed} 项失败，请排查！`);
  process.exit(1);
}
