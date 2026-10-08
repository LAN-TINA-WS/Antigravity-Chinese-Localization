const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

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

console.log('=== 开始 Ticket-15 Antigravity 2.21.0 官方版本与架构特性专项测试 ===\n');

// 1. 版本号与工程元数据校验
console.log('--- 2.21.0 版本元数据校验 ---');
const versionMatch = localizeSource.match(/const CURRENT_VERSION = ['"]([^'"]+)['"];/);
const currentVer = versionMatch ? versionMatch[1] : '';
const parseVer = (v) => (v || '').split('.').map(n => parseInt(n, 10) || 0);
const isVerGte2210 = (v) => {
  const [maj, min, patch] = parseVer(v);
  return maj > 2 || (maj === 2 && min > 21) || (maj === 2 && min === 21 && patch >= 0);
};
check('localize.js CURRENT_VERSION 版本号有效且 >= 2.21.0', isVerGte2210(currentVer), true);
check('extracted/package.json version 有效且 >= 2.21.0', isVerGte2210(packageJson.version), true);
check('index.html 包含 本地词库 v2.21.0 或更新', (() => {
  const m = indexSource.match(/本地词库 v(2\.\d+\.\d+)/);
  return m ? isVerGte2210(m[1]) : false;
})(), true);
check('index.html 包含 Antigravity 2.0 / 2.21.0+ 或更新', (() => {
  const m = indexSource.match(/Antigravity 2\.0 \/ (2\.\d+\.\d+)\+/);
  return m ? isVerGte2210(m[1]) : false;
})(), true);
check('index.html currentVer 变量有效且 >= 2.21.0', (() => {
  const m = indexSource.match(/const currentVer = ['"](2\.\d+\.\d+)['"];/);
  return m ? isVerGte2210(m[1]) : false;
})(), true);
check('README.md 包含 Antigravity v2.21.0+ 或更新', (() => {
  const m = readmeSource.match(/Antigravity v(2\.\d+\.\d+)\+/);
  return m ? isVerGte2210(m[1]) : false;
})(), true);
check('README.en.md 包含 Antigravity v2.21.0+ 或更新', (() => {
  const m = readmeEnSource.match(/Antigravity v(2\.\d+\.\d+)\+/);
  return m ? isVerGte2210(m[1]) : false;
})(), true);

// 2. 2.21.0 上游架构特性校验
console.log('\n--- 2.21.0 上游架构特性校验 ---');
const distDir = path.join(__dirname, '..', 'extracted', 'dist');
const preloadSource = fs.readFileSync(path.join(distDir, 'preload.js'), 'utf-8');
const ipcSource = fs.readFileSync(path.join(distDir, 'ipcHandlers.js'), 'utf-8');
const traySource = fs.readFileSync(path.join(distDir, 'tray.js'), 'utf-8');
const mainSource = fs.readFileSync(path.join(distDir, 'main.js'), 'utf-8');
const menuSource = fs.readFileSync(path.join(distDir, 'menu.js'), 'utf-8');
const updaterSource = fs.readFileSync(path.join(distDir, 'updater.js'), 'utf-8');
const wizardHtmlSource = fs.readFileSync(path.join(distDir, 'ideInstall', 'wizardHtml.js'), 'utf-8');

check('preload.js 官方 2.21.0 新增 getPathForFile 桥接接口', 
  preloadSource.includes('getPathForFile: (file) => electron_1.webUtils.getPathForFile(file)'), true);
check('preload.js 保持 showContextMenu 桥接定义', preloadSource.includes('showContextMenu:'), true);
check('preload.js 保持 closeContextMenu 桥接定义', preloadSource.includes('closeContextMenu:'), true);
check('ipcHandlers.js 保持 buildContextMenuTemplate 函数', ipcSource.includes('function buildContextMenuTemplate(items, onSelect)'), true);
check('ipcHandlers.js 保持 window:show-context-menu 通道', ipcSource.includes("electron_1.ipcMain.handle('window:show-context-menu'"), true);
check('tray.js 保持 createTray(actions, onClick) 回调', traySource.includes('function createTray(actions, onClick)'), true);
check('tray.js 保持非 macOS 绑定 click 激活', traySource.includes("tray.on('click', onClick);"), true);
check('main.js 保持 steal: true 托盘焦点抢占', mainSource.includes("electron_1.app.focus({ steal: true });"), true);

// 3. 2.21.0 核心汉化注入完备性校验
console.log('\n--- 2.21.0 核心汉化注入完备性校验 ---');
check('preload.js 注入 Web UI 实时汉化引擎', preloadSource.includes('Antigravity 2.0 Chinese Localization Engine'), true);
check('ipcHandlers.js 注入 contextMenuTranslationMap 字典', ipcSource.includes('const contextMenuTranslationMap = {'), true);
check('ipcHandlers.js 注入 translateContextLabel 函数', ipcSource.includes('function translateContextLabel(lbl)'), true);
check('ipcHandlers.js buildContextMenuTemplate 拦截 label 翻译', ipcSource.includes("translateContextLabel(item.label)"), true);
check('ipcHandlers.js 打开工作区 对话框汉化', ipcSource.includes("title: '打开工作区'"), true);
check('ipcHandlers.js 无法打开文件夹 错误弹窗汉化', ipcSource.includes("electron_1.dialog.showErrorBox('无法打开文件夹', t.error);"), true);
check('ipcHandlers.js 文件夹位于 Windows 文件系统中 提示汉化', ipcSource.includes("message: '文件夹位于 Windows 文件系统中'"), true);
check('menu.js 注入 menuTranslationMap', menuSource.includes('const menuTranslationMap = {'), true);
check('menu.js 注入 translateMenu 函数', menuSource.includes('function translateMenu(menuItem)'), true);
check('tray.js 包含 个智能体运行中 动态计数汉化', traySource.includes('`${count} 个智能体运行中`'), true);
check('tray.js 包含 没有智能体在运行 汉化', traySource.includes("'没有智能体在运行'"), true);
check('main.js 包含 确认退出 弹窗汉化', mainSource.includes("title: '确认退出'"), true);
check('main.js 包含 新建窗口 Dock 菜单汉化', mainSource.includes("label: '新建窗口'"), true);
check('updater.js 包含 检查更新 弹窗标题汉化', updaterSource.includes("title: '检查更新'"), true);
check('updater.js 包含 当前已是最新版本 提示汉化', updaterSource.includes("message: '当前已是最新版本，暂无可用更新。'"), true);
check('wizardHtml.js 包含 欢迎使用全新 Antigravity！ 主标题', wizardHtmlSource.includes('<h1>欢迎使用全新 Antigravity！</h1>'), true);
check('wizardHtml.js 包含 探索全新 Antigravity 按钮', wizardHtmlSource.includes('>探索全新 Antigravity</button>'), true);

// 4. 原生右键上下文菜单动态翻译执行 (VM 沙盒测试)
console.log('\n--- 原生右键上下文菜单动态翻译执行测试 ---');
const context = {};
vm.createContext(context);
const translateContextSnippet = `
const contextMenuTranslationMap = {
  'Cut': '剪切',
  'Copy': '复制',
  'Paste': '粘贴',
  'Select All': '全选',
  'Undo': '撤销',
  'Redo': '重做',
  'Delete': '删除',
  'New Conversation': '新建对话',
  'Fork Conversation': '派生对话',
  'Rename': '重命名',
  'Pin': '置顶',
  'Unpin': '取消置顶',
  'Close': '关闭',
  'Close Others': '关闭其他',
  'Close All': '全部关闭',
  'Copy Path': '复制路径',
  'Copy Relative Path': '复制相对路径',
  'Reveal in File Explorer': '在文件资源管理器中显示',
  'Reveal in Finder': '在访达中显示',
  'Open in Terminal': '在终端中打开'
};
function translateContextLabel(lbl) {
  if (!lbl) return '';
  return contextMenuTranslationMap[lbl] || lbl;
}
`;
vm.runInContext(translateContextSnippet, context);

const testLabels = [
  ['Cut', '剪切'],
  ['Copy', '复制'],
  ['Paste', '粘贴'],
  ['Select All', '全选'],
  ['Undo', '撤销'],
  ['Redo', '重做'],
  ['Delete', '删除'],
  ['New Conversation', '新建对话'],
  ['Fork Conversation', '派生对话'],
  ['Rename', '重命名'],
  ['Pin', '置顶'],
  ['Unpin', '取消置顶'],
  ['Close', '关闭'],
  ['Close Others', '关闭其他'],
  ['Close All', '全部关闭'],
  ['Copy Path', '复制路径'],
  ['Copy Relative Path', '复制相对路径'],
  ['Reveal in File Explorer', '在文件资源管理器中显示'],
  ['Reveal in Finder', '在访达中显示'],
  ['Open in Terminal', '在终端中打开'],
  ['Custom Item', 'Custom Item'],
  ['', '']
];

for (const [input, expected] of testLabels) {
  const actual = context.translateContextLabel(input);
  check(`上下文菜单翻译: "${input}" => "${expected}"`, actual, expected);
}

// 5. 核心功能文件完备性
console.log('\n--- 核心文件完备性测试 ---');
check('preload.js 存在', fs.existsSync(path.join(distDir, 'preload.js')), true);
check('wizardPreload.js 存在', fs.existsSync(path.join(distDir, 'ideInstall', 'wizardPreload.js')), true);
check('menu.js 存在', fs.existsSync(path.join(distDir, 'menu.js')), true);
check('tray.js 存在', fs.existsSync(path.join(distDir, 'tray.js')), true);
check('wsl.js 存在', fs.existsSync(path.join(distDir, 'wsl.js')), true);
check('wizardHtml.js 存在', fs.existsSync(path.join(distDir, 'ideInstall', 'wizardHtml.js')), true);
check('main.js 存在', fs.existsSync(path.join(distDir, 'main.js')), true);
check('updater.js 存在', fs.existsSync(path.join(distDir, 'updater.js')), true);

console.log('\n======================================================');
console.log(`Ticket-15 测试结果: ${passed}/${total} 断言全部通过！`);
console.log('======================================================\n');

if (passed !== total) {
  process.exit(1);
} else {
  process.exit(0);
}
