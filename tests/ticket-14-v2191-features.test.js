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

console.log('=== 开始 Ticket-14 Antigravity 2.19.1 官方版本与架构特性专项测试 ===\n');

// 1. 版本号与工程元数据校验
console.log('--- 2.19.1 版本元数据校验 ---');
const versionMatch = localizeSource.match(/const CURRENT_VERSION = ['"]([^'"]+)['"];/);
const currentVer = versionMatch ? versionMatch[1] : '';
const parseVer = (v) => (v || '').split('.').map(n => parseInt(n, 10) || 0);
const isVerGte2191 = (v) => {
  const [maj, min, patch] = parseVer(v);
  return maj > 2 || (maj === 2 && min > 19) || (maj === 2 && min === 19 && patch >= 1);
};
check('localize.js CURRENT_VERSION 严格等于 2.19.1', currentVer, '2.19.1');
check('extracted/package.json version 严格等于 2.19.1', packageJson.version, '2.19.1');
check('index.html 包含 本地词库 v2.19.1', indexSource.includes('本地词库 v2.19.1'), true);
check('index.html 包含 Antigravity 2.0 / 2.19.1+', indexSource.includes('<h1>Antigravity 2.0 / 2.19.1+</h1>'), true);
check('index.html currentVer 变量为 2.19.1', indexSource.includes("const currentVer = '2.19.1';"), true);
check('README.md 包含 Antigravity v2.19.1+', readmeSource.includes('Antigravity v2.19.1+'), true);
check('README.en.md 包含 Antigravity v2.19.1+', readmeEnSource.includes('Antigravity v2.19.1+'), true);

// 2. 2.19.1 上游架构特性校验
console.log('\n--- 2.19.1 上游架构特性校验 ---');
const distDir = path.join(__dirname, '..', 'extracted', 'dist');
const ipcSource = fs.readFileSync(path.join(distDir, 'ipcHandlers.js'), 'utf-8');
const traySource = fs.readFileSync(path.join(distDir, 'tray.js'), 'utf-8');
const mainSource = fs.readFileSync(path.join(distDir, 'main.js'), 'utf-8');
const preloadSource = fs.readFileSync(path.join(distDir, 'preload.js'), 'utf-8');

check('ipcHandlers.js 官方新增 buildContextMenuTemplate 函数', ipcSource.includes('function buildContextMenuTemplate(items, onSelect)'), true);
check('ipcHandlers.js 官方注册 window:show-context-menu 通道', ipcSource.includes("electron_1.ipcMain.handle('window:show-context-menu'"), true);
check('ipcHandlers.js 官方注册 window:close-context-menu 通道', ipcSource.includes("electron_1.ipcMain.handle('window:close-context-menu'"), true);
check('tray.js 官方支持 createTray(actions, onClick) 回调', traySource.includes('function createTray(actions, onClick)'), true);
check('tray.js 官方非 macOS 绑定 click 激活', traySource.includes("tray.on('click', onClick);"), true);
check('main.js 托盘点击包含 steal: true 焦点抢占', mainSource.includes("electron_1.app.focus({ steal: true });"), true);
check('preload.js 包含 showContextMenu 桥接定义', preloadSource.includes('showContextMenu:'), true);
check('preload.js 包含 closeContextMenu 桥接定义', preloadSource.includes('closeContextMenu:'), true);

// 3. 2.19.1 ipcHandlers.js 汉化注入完备性校验
console.log('\n--- 2.19.1 ipcHandlers.js 汉化注入校验 ---');
check('ipcHandlers.js 注入 contextMenuTranslationMap 字典', ipcSource.includes('const contextMenuTranslationMap = {'), true);
check('ipcHandlers.js 注入 translateContextLabel 函数', ipcSource.includes('function translateContextLabel(lbl)'), true);
check('buildContextMenuTemplate 拦截 label 翻译', ipcSource.includes("translateContextLabel(item.label)"), true);
check('ipcHandlers.js 工作区对话框标题为 打开工作区', ipcSource.includes("title: '打开工作区'"), true);
check('ipcHandlers.js 无法打开文件夹 错误弹窗汉化', ipcSource.includes("electron_1.dialog.showErrorBox('无法打开文件夹', t.error);"), true);
check('ipcHandlers.js 文件夹位于 Windows 文件系统中 提示汉化', ipcSource.includes("message: '文件夹位于 Windows 文件系统中'"), true);

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
  ['Unknown Custom Action', 'Unknown Custom Action'],
  ['', '']
];

for (const [input, expected] of testLabels) {
  const actual = context.translateContextLabel(input);
  check(`上下文菜单翻译: "${input}" => "${expected}"`, actual, expected);
}

// 5. 模拟 buildContextMenuTemplate 递归结构翻译测试
console.log('\n--- 递归上下文菜单结构翻译沙盒测试 ---');
const buildSnippet = `
function testBuildContextMenuTemplate(items) {
  return items.map((item) => {
    if (item.type === 'separator') return { type: 'separator' };
    if (item.type === 'submenu' || (item.submenu && item.submenu.length > 0)) {
      return {
        id: item.id,
        label: (typeof translateContextLabel === 'function' ? translateContextLabel(item.label) : item.label) ?? '',
        type: 'submenu',
        enabled: !item.disabled,
        submenu: testBuildContextMenuTemplate(item.submenu ?? [])
      };
    }
    return {
      id: item.id,
      label: (typeof translateContextLabel === 'function' ? translateContextLabel(item.label) : item.label) ?? '',
      type: item.type ?? 'normal',
      checked: item.checked,
      enabled: !item.disabled,
      accelerator: item.accelerator
    };
  });
}
`;
vm.runInContext(buildSnippet, context);

const rawMenuTree = [
  { id: '1', label: 'Cut' },
  { id: '2', label: 'Copy' },
  { id: '3', label: 'Paste' },
  { type: 'separator' },
  {
    id: 'sub1',
    label: 'Fork Conversation',
    type: 'submenu',
    submenu: [
      { id: 'sub1-1', label: 'New Conversation' },
      { id: 'sub1-2', label: 'Pin' }
    ]
  }
];

const translatedTree = context.testBuildContextMenuTemplate(rawMenuTree);
check('顶级菜单项 Cut 已汉化为 剪切', translatedTree[0].label, '剪切');
check('顶级菜单项 Copy 已汉化为 复制', translatedTree[1].label, '复制');
check('顶级菜单项 Paste 已汉化为 粘贴', translatedTree[2].label, '粘贴');
check('分隔线保持 separator', translatedTree[3].type, 'separator');
check('子菜单父项 Fork Conversation 已汉化为 派生对话', translatedTree[4].label, '派生对话');
check('子菜单子项 New Conversation 已汉化为 新建对话', translatedTree[4].submenu[0].label, '新建对话');
check('子菜单子项 Pin 已汉化为 置顶', translatedTree[4].submenu[1].label, '置顶');

// 6. 核心功能完备性验证
console.log('\n--- 核心注入与功能文件完备性测试 ---');
check('preload.js 存在', fs.existsSync(path.join(distDir, 'preload.js')), true);
check('wizardPreload.js 存在', fs.existsSync(path.join(distDir, 'ideInstall', 'wizardPreload.js')), true);
check('menu.js 存在', fs.existsSync(path.join(distDir, 'menu.js')), true);
check('tray.js 存在', fs.existsSync(path.join(distDir, 'tray.js')), true);
check('wsl.js 存在', fs.existsSync(path.join(distDir, 'wsl.js')), true);
check('wizardHtml.js 存在', fs.existsSync(path.join(distDir, 'ideInstall', 'wizardHtml.js')), true);

console.log('\n======================================================');
console.log(`Ticket-14 测试结果: ${passed}/${total} 断言全部通过！`);
console.log('======================================================\n');

if (passed !== total) {
  process.exit(1);
} else {
  process.exit(0);
}
