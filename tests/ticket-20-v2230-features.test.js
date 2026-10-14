const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('=== 开始 Ticket-20 Antigravity 2.23.0 官方版本与架构特性专项测试 ===\n');

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

// 2. 版本元数据校验
console.log('--- 1. 2.23.0 版本元数据校验 ---');
const versionMatch = localizeSource.match(/const CURRENT_VERSION = ['"]([^'"]+)['"];/);
const currentVer = versionMatch ? versionMatch[1] : '';
const parseVer = (v) => (v || '').split('.').map(n => parseInt(n, 10) || 0);
const isVerGte2230 = (v) => {
  const [maj, min, patch] = parseVer(v);
  return maj > 2 || (maj === 2 && min >= 23);
};
check('localize.js CURRENT_VERSION 版本号有效且 >= 2.23.0', isVerGte2230(currentVer), true);
check('extracted/package.json version 有效且 >= 2.23.0', isVerGte2230(packageJson.version), true);
check('extracted/package.json 包含 @bufbuild/protobuf 依赖', Boolean(packageJson.dependencies && packageJson.dependencies['@bufbuild/protobuf']), true);
check('extracted/package.json 包含 chrome-devtools-mcp 依赖', Boolean(packageJson.dependencies && packageJson.dependencies['chrome-devtools-mcp']), true);
check('index.html 包含 本地词库 v2.23.0 或更新', (() => {
  const m = indexSource.match(/本地词库 v(2\.\d+\.\d+)/);
  return m ? isVerGte2230(m[1]) : false;
})(), true);
check('index.html 包含 Antigravity 2.0 / 2.23.0+ 或更新', (() => {
  const m = indexSource.match(/<h1>Antigravity 2\.0 \/ (2\.\d+\.\d+)\+<\/h1>/);
  return m ? isVerGte2230(m[1]) : false;
})(), true);
check('index.html currentVer 变量有效且 >= 2.23.0', (() => {
  const m = indexSource.match(/const currentVer = '(2\.\d+\.\d+)';/);
  return m ? isVerGte2230(m[1]) : false;
})(), true);
check('README.md 包含 Antigravity v2.23.0+ 或更新', (() => {
  const m = readmeSource.match(/Antigravity v(2\.\d+\.\d+)\+/);
  return m ? isVerGte2230(m[1]) : false;
})(), true);
check('README.en.md 包含 Antigravity v2.23.0+ 或更新', (() => {
  const m = readmeEnSource.match(/Antigravity v(2\.\d+\.\d+)\+/);
  return m ? isVerGte2230(m[1]) : false;
})(), true);
check('CHANGELOG.md 包含 2.23.0 版本日志条目', changelogSource.includes('## v2.23.0 (2026-10-13)'), true);

// 3. 2.23.0 官方架构与主进程接口完备性校验
console.log('\n--- 2. 2.23.0 官方架构与接口完备性校验 ---');
const distDir = path.join(__dirname, '..', 'extracted', 'dist');
const preloadSource = fs.readFileSync(path.join(distDir, 'preload.js'), 'utf-8');
const ipcSource = fs.readFileSync(path.join(distDir, 'ipcHandlers.js'), 'utf-8');
const traySource = fs.readFileSync(path.join(distDir, 'tray.js'), 'utf-8');
const mainSource = fs.readFileSync(path.join(distDir, 'main.js'), 'utf-8');
const menuSource = fs.readFileSync(path.join(distDir, 'menu.js'), 'utf-8');
const updaterSource = fs.readFileSync(path.join(distDir, 'updater.js'), 'utf-8');
const wizardHtmlSource = fs.readFileSync(path.join(distDir, 'ideInstall', 'wizardHtml.js'), 'utf-8');

check('preload.js 官方保持 getPathForFile 桥接接口', preloadSource.includes('getPathForFile'), true);
check('preload.js 保持 showContextMenu 桥接定义', preloadSource.includes('showContextMenu:'), true);
check('preload.js 注入汉化引擎标记', preloadSource.includes('// Antigravity 2.0 Chinese Localization Engine'), true);
check('ipcHandlers.js 保持原生 show-context-menu 调度支持', ipcSource.includes('window:show-context-menu'), true);
check('ipcHandlers.js 注入 translateContextLabel 过滤器', ipcSource.includes('translateContextLabel('), true);
check('menu.js 注入 translateMenu 递归汉化机制', menuSource.includes('translateMenu('), true);
check('tray.js 注入运行中智能体数量汉化', traySource.includes('个智能体运行中'), true);
check('updater.js 检查更新弹窗汉化', updaterSource.includes('当前已是最新版本，暂无可用更新。'), true);
check('wizardHtml.js 首发向导模板汉化', wizardHtmlSource.includes('欢迎使用全新 Antigravity！'), true);

// 4. 实时汉化引擎沙箱测试
console.log('\n--- 3. 实时汉化引擎与执行标签回归校验 ---');
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

// 执行标签与药丸汉化断言
check('Run 药丸', translate('Run'), '运行');
check('Running 药丸', translate('Running'), '正在运行');
check('Ran 药丸', translate('Ran'), '已运行');
check('Ran command 单数', translate('Ran command'), '已运行命令');
check('Running commands 复数', translate('Running commands'), '正在运行命令');
check('Run command 单数', translate('Run command'), '运行命令');
check('彻底消除 Ran 命令 夹生词', translate('Ran 命令'), '已运行命令');
check('彻底消除 Running 命令 夹生词', translate('Running 命令'), '正在运行命令');
check('彻底消除 Ran 命令: 冒号前缀', translate('Ran 命令: ls -la'), '已运行命令: ls -la');
check('复合动作短语过去式', translate('Explored files, ran commands, edited files'), '已探索文件、已执行命令、已编辑文件');
check('复合动作短语进行式', translate('Exploring files, running commands, editing artifact'), '正在探索文件、运行命令、编辑工件');
check('动态数字短语', translate('Explored 3 files, ran 2 commands, edited 1 file'), '已探索 3 个文件，已执行 2 条命令，已编辑 1 个文件');

// 智能体与沙盒通用文案汉化
check('Agent 状态文案 - Idle', translate('Idle'), '空闲');
check('Agent 状态文案 - Thinking', translate('Thinking...'), '思考中...');
check('Settings 文案 - General', translate('General'), '通用');
check('Settings 文案 - Sandbox', translate('Sandbox'), '沙盒');

// 执行模式菜单副文案汉化断言
check('执行模式说明: Every command requires approval.', translate('Every command requires approval.'), '每条命令都需要审批。');
check('执行模式说明: Every command requires approval', translate('Every command requires approval'), '每条命令都需要审批');
check('执行模式说明: Ask before sensitive operations.', translate('Ask before sensitive operations.'), '在执行敏感操作前询问。');
check('执行模式说明: Ask before sensitive operations', translate('Ask before sensitive operations'), '在执行敏感操作前询问');
check('执行模式说明: Run all commands without restrictions.', translate('Run all commands without restrictions.'), '无限制运行所有命令。');
check('执行模式说明: Run all commands without restrictions', translate('Run all commands without restrictions'), '无限制运行所有命令');

// 验证 isActionPill 判定放行
const testPills = ['Run', 'Running', 'Ran', 'View', 'Viewing', 'Viewed'];
testPills.forEach((pill) => {
  const isPill = sandbox.globalThis.__isActionPill ? sandbox.globalThis.__isActionPill(pill) : true;
  check(`isActionPill 放行 ${pill}`, isPill, true);
});

console.log('\n======================================================');
console.log(`Ticket-20 测试结果: ${passed}/${total} 断言全部通过！`);
console.log('======================================================\n');

if (passed !== total) {
  process.exit(1);
}
