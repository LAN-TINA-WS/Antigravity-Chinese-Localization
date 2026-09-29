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

console.log('=== 开始 Ticket-13 Antigravity 2.18.1 官方版本与架构特性专项测试 ===\n');

// 1. 版本号与工程元数据校验
console.log('--- 2.18.1 版本元数据校验 ---');
const versionMatch = localizeSource.match(/const CURRENT_VERSION = ['"]([^'"]+)['"];/);
const currentVer = versionMatch ? versionMatch[1] : '';
check('localize.js CURRENT_VERSION 严格等于 2.18.1', currentVer, '2.18.1');
check('extracted/package.json version 严格等于 2.18.1', packageJson.version, '2.18.1');
check('index.html 包含 本地词库 v2.18.1', indexSource.includes('本地词库 v2.18.1'), true);
check('index.html 包含 Antigravity 2.0 / 2.18.1+', indexSource.includes('<h1>Antigravity 2.0 / 2.18.1+</h1>'), true);
check('index.html currentVer 变量为 2.18.1', indexSource.includes("const currentVer = '2.18.1';"), true);
check('README.md 包含 Antigravity v2.18.1+', readmeSource.includes('Antigravity v2.18.1+'), true);
check('README.en.md 包含 Antigravity v2.18.1+', readmeEnSource.includes('Antigravity v2.18.1+'), true);

// 2. 2.18.1 核心上游特性与依赖完备性
console.log('\n--- 2.18.1 上游架构特性校验 ---');
const distDir = path.join(__dirname, '..', 'extracted', 'dist');
const mainSource = fs.readFileSync(path.join(distDir, 'main.js'), 'utf-8');
check('main.js 包含 AutomationControlled 命令行参数', 
  mainSource.includes("electron_1.app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');"), true);

const jsYamlPackage = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'extracted', 'node_modules', 'js-yaml', 'package.json'), 'utf-8'));
check('js-yaml 内部依赖版本升级为 4.3.2 (上游安全加固)', jsYamlPackage.version, '4.3.2');
check('loadingOverlay.test.js 官方单元测试存在', fs.existsSync(path.join(distDir, 'loadingOverlay.test.js')), true);

// 3. 核心注入文件完备性
console.log('\n--- 核心注入与架构文件完备性测试 ---');
check('preload.js 存在', fs.existsSync(path.join(distDir, 'preload.js')), true);
check('wizardPreload.js 存在', fs.existsSync(path.join(distDir, 'ideInstall', 'wizardPreload.js')), true);
check('menu.js 存在', fs.existsSync(path.join(distDir, 'menu.js')), true);
check('tray.js 存在', fs.existsSync(path.join(distDir, 'tray.js')), true);
check('loadingOverlay.js 存在', fs.existsSync(path.join(distDir, 'loadingOverlay.js')), true);
check('updater.js 存在', fs.existsSync(path.join(distDir, 'updater.js')), true);
check('wsl.js 架构文件存在', fs.existsSync(path.join(distDir, 'wsl.js')), true);
check('provisionSplash.js 架构文件存在', fs.existsSync(path.join(distDir, 'provisionSplash.js')), true);

// 4. 原生菜单 WSL 汉化与健壮性校验
console.log('\n--- 原生菜单 WSL 汉化校验 ---');
const menuSource = fs.readFileSync(path.join(distDir, 'menu.js'), 'utf-8');
check('menu.js 包含 Connect to WSL 翻译', menuSource.includes("'Connect to WSL': '连接到 WSL'"), true);
check('menu.js 包含 Reopen Locally 翻译', menuSource.includes("'Reopen Locally': '本地重新打开'"), true);
check('menu.js 具备 addItemToSubmenu 中英双向匹配回退', menuSource.includes('item.label === submenuLabel || (typeof menuTranslationMap !== "undefined" && item.label === menuTranslationMap[submenuLabel])'), true);
check('menu.js setApplicationMenu 注入 translateMenu 包装', menuSource.includes("if (typeof translateMenu === 'function') { menu.items.forEach(translateMenu); } electron_1.Menu.setApplicationMenu(menu);"), true);

// 5. WSL 部署弹窗 provisionSplash 汉化校验
console.log('\n--- WSL 部署弹窗 provisionSplash 汉化校验 ---');
const splashSource = fs.readFileSync(path.join(distDir, 'provisionSplash.js'), 'utf-8');
check('provisionSplash.js 包含 正在配置 WSL 标题', splashSource.includes('<div>正在配置 WSL: ${escapeHtml(distro)}</div>'), true);
check('provisionSplash.js setStatus 状态动态汉化', splashSource.includes('正在下载 Antigravity 二进制组件…'), true);

// 6. IPC 弹窗与 WSL 对话框汉化校验
console.log('\n--- IPC 弹窗与 WSL 对话框汉化校验 ---');
const ipcSource = fs.readFileSync(path.join(distDir, 'ipcHandlers.js'), 'utf-8');
check('ipcHandlers.js 包含 打开工作区 对话框标题', ipcSource.includes("title: '打开工作区',"), true);
check('ipcHandlers.js 包含 无法打开文件夹 错误框', ipcSource.includes("electron_1.dialog.showErrorBox('无法打开文件夹', t.error);"), true);
check('ipcHandlers.js 包含 文件夹位于 Windows 文件系统中 警告框', ipcSource.includes("message: '文件夹位于 Windows 文件系统中',"), true);

// 7. WSL 核心模块提示与状态汉化校验
console.log('\n--- WSL 核心模块提示与状态汉化校验 ---');
const wslSource = fs.readFileSync(path.join(distDir, 'wsl.js'), 'utf-8');
check('wsl.js 包含 Windows 文件系统挂载性能提示', wslSource.includes('此文件夹位于 Windows 文件系统。从 WSL 访问（通过 /mnt）可能较慢'), true);
check('wsl.js 包含 发行版不匹配错误提示', wslSource.includes('此文件夹属于 WSL 发行版 "${unc[1]}"，但当前窗口连接到 "${distro}"。'), true);
check('wsl.js 包含 无法在 WSL 中打开此位置 提示', wslSource.includes('无法在 WSL 中打开此位置: ${winPath}'), true);
check('wsl.js 包含 正在下载 Antigravity 二进制组件 状态', wslSource.includes("onStatus?.('正在下载 Antigravity 二进制组件\\u2026');"), true);
check('wsl.js 包含 正在安装到 发行版 状态', wslSource.includes("onStatus?.(`正在安装到 ${distro}\\u2026`);"), true);

// 8. 主进程 WSL 警告与弹窗汉化校验
console.log('\n--- 主进程 WSL 警告与弹窗汉化校验 ---');
check('main.js 包含 未找到 WSL 发行版 弹窗标题', mainSource.includes("title: '未找到 WSL 发行版',"), true);
check('main.js 包含 WSL 发行版已不再安装 消息', mainSource.includes('WSL 发行版 "${WSL_DISTRO}" 已不再安装。'), true);
check('main.js 包含 Antigravity 已改为在 Windows 本地打开 详情', mainSource.includes("detail: 'Antigravity 已改为在 Windows 本地打开。',"), true);
check('main.js 包含 WSL 配置失败 错误框', mainSource.includes("await electron_1.dialog.showErrorBox('WSL 配置失败', msg);"), true);
check('main.js 包含 启动失败 错误框', mainSource.includes("await electron_1.dialog.showErrorBox('启动失败', msg);"), true);
check('main.js 包含 未找到核心二进制组件 错误框', mainSource.includes("await electron_1.dialog.showErrorBox('未找到核心二进制组件', msg);"), true);
check('main.js 包含 确认退出 弹窗标题', mainSource.includes("title: '确认退出',"), true);
check('main.js 包含 您确定要退出吗 提示文案', mainSource.includes("message: '您确定要退出吗？',"), true);
check('main.js 包含 确认退出 取消/退出 按钮', mainSource.includes("buttons: ['取消', '退出'],"), true);

// 9. 原生系统托盘与自动更新弹窗校验
console.log('\n--- 原生系统托盘与自动更新弹窗校验 ---');
const traySource = fs.readFileSync(path.join(distDir, 'tray.js'), 'utf-8');
check('tray.js 包含 智能体运行中状态汉化', traySource.includes('count > 0 ? `${count} 个智能体运行中` : \'没有智能体在运行\''), true);
check('tray.js 包含 打开 Antigravity 动作', traySource.includes("action.label = '打开 Antigravity'"), true);
check('tray.js 包含 退出 动作', traySource.includes("action.label = '退出'"), true);

const updaterSource = fs.readFileSync(path.join(distDir, 'updater.js'), 'utf-8');
check('updater.js 包含 检查更新 弹窗标题', updaterSource.includes("title: '检查更新',"), true);
check('updater.js 包含 当前已是最新版本 提示文案', updaterSource.includes("message: '当前已是最新版本，暂无可用更新。',"), true);
check('updater.js 包含 确定 按钮', updaterSource.includes("buttons: ['确定'],"), true);

// 10. Web UI 字典与动态正则校验 (VM 隔离沙盒)
console.log('\n--- Web UI 字典与动态正则校验 ---');
const preloadSource = fs.readFileSync(path.join(distDir, 'preload.js'), 'utf-8');
check('preload.js 包含 Connect to WSL', preloadSource.includes('"Connect to WSL": "连接到 WSL"'), true);
check('preload.js 包含 Reopen Locally', preloadSource.includes('"Reopen Locally": "本地重新打开"'), true);
check('preload.js 包含 WSL Environment', preloadSource.includes('"WSL Environment": "WSL 环境"'), true);
check('preload.js 包含 Distro 映射', preloadSource.includes('"Distro": "发行版"'), true);
check('preload.js 包含 Distros 映射', preloadSource.includes('"Distros": "发行版"'), true);
check('preload.js 包含 Default Distro 映射', preloadSource.includes('"Default Distro": "默认发行版"'), true);
check('preload.js 包含 Setting up WSL 映射', preloadSource.includes('"Setting up WSL": "正在配置 WSL"'), true);
check('preload.js 包含 Open workspace 映射', preloadSource.includes('"Open workspace": "打开工作区"'), true);

const hostSandbox = { 
  globalThis: {}, 
  window: { addEventListener: () => {} }, 
  document: { body: null, readyState: 'loading', addEventListener: () => {} },
  Node: { TEXT_NODE: 3, ELEMENT_NODE: 1, DOCUMENT_FRAGMENT_NODE: 11 },
  Element: { prototype: {} },
  MutationObserver: class { observe() {} disconnect() {} },
  history: {}
};
vm.createContext(hostSandbox);
const preloadScript = preloadSource.substring(preloadSource.indexOf('// Antigravity 2.0 Chinese Localization Engine'))
  .replace('function startObserver()', 'globalThis.__test_translateString = translateString;\n  function startObserver()');
vm.runInContext(preloadScript, hostSandbox);
const translateString = hostSandbox.globalThis.__test_translateString;

check('正则: Setting up WSL: Ubuntu', translateString('Setting up WSL: Ubuntu'), '正在配置 WSL: Ubuntu');
check('正则: Installing into Debian…', translateString('Installing into Debian…'), '正在安装到 Debian…');
check('正则: This folder belongs to the WSL distro "Ubuntu", but this window is connected to "Debian".', 
  translateString('This folder belongs to the WSL distro "Ubuntu", but this window is connected to "Debian".'), 
  '此文件夹属于 WSL 发行版“Ubuntu”，但当前窗口连接到“Debian”。');
check('正则: This location cannot be opened in WSL: C:\\foo', 
  translateString('This location cannot be opened in WSL: C:\\foo'), 
  '无法在 WSL 中打开此位置: C:\\foo');
check('正则: The WSL distro "Ubuntu" is no longer installed.', 
  translateString('The WSL distro "Ubuntu" is no longer installed.'), 
  'WSL 发行版“Ubuntu”已不再安装。');
check('正则: Antigravity opened on Windows instead.', 
  translateString('Antigravity opened on Windows instead.'), 
  'Antigravity 已改为在 Windows 本地打开。');
check('正则: Connected to WSL: Ubuntu', 
  translateString('Connected to WSL: Ubuntu'), 
  '已连接到 WSL: Ubuntu');

// 11. 智能体行为：计划审核 (Plan Review) 设置汉化测试
console.log('\n--- 智能体行为：计划审核与策略提示汉化测试 ---');
check('词典: Plan Review', translateString('Plan Review'), '计划审核');
check('词典: Plan Review Policy', translateString('Plan Review Policy'), '计划审核策略');
check('词典: Policy', translateString('Policy'), '策略');
check('词典: policy', translateString('policy'), '策略');
check('句子: Type / and select plan to have the agent generate a plan.', 
  translateString('Type / and select plan to have the agent generate a plan.'), 
  '输入 / 并选择 plan 来让智能体生成计划。');
check('句子: Type / and select plan to have the agent generate a plan (无标点)', 
  translateString('Type / and select plan to have the agent generate a plan'), 
  '输入 / 并选择 plan 来让智能体生成计划');
check('夹生容错: Type / and 选择 plan to have the agent generate a plan.', 
  translateString('Type / and 选择 plan to have the agent generate a plan.'), 
  '输入 / 并选择 plan 来让智能体生成计划。');
check('碎片: to have the agent generate a plan.', 
  translateString('to have the agent generate a plan.'), 
  '来让智能体生成计划。');
check('碎片: plan to have the agent generate a plan.', 
  translateString('plan to have the agent generate a plan.'), 
  'plan 来让智能体生成计划。');
check('碎片: Type / and', 
  translateString('Type / and'), 
  '输入 / 并');
check('选项: Never', 
  translateString('Never'), 
  '从不');

console.log(`\n======================================================`);
console.log(`Ticket-13 测试结果: ${passed}/${total} 断言全部通过！`);
console.log(`======================================================\n`);

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
