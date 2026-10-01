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

// 1. 版本号校验
console.log('--- 2.18.1 版本元数据校验 ---');
const versionMatch = localizeSource.match(/const CURRENT_VERSION = ['"]([^'"]+)['"];/);
const currentVer = versionMatch ? versionMatch[1] : '';
const parseVer = (v) => (v || '').split('.').map(n => parseInt(n, 10) || 0);
const isVerGte2181 = (v) => {
  const [maj, min, patch] = parseVer(v);
  return maj > 2 || (maj === 2 && min > 18) || (maj === 2 && min === 18 && patch >= 1);
};
check('localize.js CURRENT_VERSION 版本号有效且 >= 2.18.1', isVerGte2181(currentVer), true);
check('extracted/package.json version 有效且 >= 2.18.1', isVerGte2181(packageJson.version), true);
check('index.html 包含 本地词库 v2.18.1 或更新', /本地词库 v2\.(18\.1|19\.\d+)/.test(indexSource), true);
check('index.html 包含 Antigravity 2.0 / 2.18.1+ 或更新', /Antigravity 2\.0 \/ 2\.(18\.1|19\.\d+)\+/.test(indexSource), true);
check('index.html currentVer 变量有效且 >= 2.18.1', (() => {
  const m = indexSource.match(/const currentVer = '([^']+)';/);
  return m ? isVerGte2181(m[1]) : false;
})(), true);
check('README.md 包含 Antigravity v2.18.1+ 或更新', /Antigravity v2\.(18\.1|19\.\d+)\+/.test(readmeSource), true);
check('README.en.md 包含 Antigravity v2.18.1+ 或更新', /Antigravity v2\.(18\.1|19\.\d+)\+/.test(readmeEnSource), true);

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

// 12. 向导静态 HTML 模板与主进程 Dock 菜单汉化测试
console.log('\n--- 向导静态 HTML 模板与 Dock 菜单校验 ---');
const wizardHtmlSource = fs.readFileSync(path.join(distDir, 'ideInstall', 'wizardHtml.js'), 'utf-8');
check('wizardHtml.js 包含 欢迎使用 Antigravity 标题', wizardHtmlSource.includes('<title>欢迎使用 Antigravity</title>'), true);
check('wizardHtml.js 包含 正在配置… 加载态', wizardHtmlSource.includes('<div class="text" style="font-size: 13px; opacity: 0.6; letter-spacing: 0.03em;">正在配置…</div>'), true);
check('wizardHtml.js 包含 欢迎使用全新 Antigravity！ 主标题', wizardHtmlSource.includes('<h1>欢迎使用全新 Antigravity！</h1>'), true);
check('wizardHtml.js 包含 全新重构说明段落', wizardHtmlSource.includes('Antigravity 经过全面重构，赋予智能体更强大的原生能力。'), true);
check('wizardHtml.js 包含 下载 Antigravity IDE 选项', wizardHtmlSource.includes('<span>下载 Antigravity IDE</span>'), true);
check('wizardHtml.js 包含 探索全新 Antigravity 按钮', wizardHtmlSource.includes('<button class="btn-primary" id="btn-skip">探索全新 Antigravity</button>'), true);
check('main.js 包含 新建窗口 Dock 菜单', mainSource.includes("label: '新建窗口',"), true);

// 13. 代码差异比对 (Diff) 与交互控件汉化测试
console.log('\n--- 代码差异比对 (Diff) 与交互控件测试 ---');
check('词典: Insert into terminal', translateString('Insert into terminal'), '插入至终端');
check('词典: Run in terminal', translateString('Run in terminal'), '在终端中运行');
check('词典: Apply diff', translateString('Apply diff'), '应用改动');
check('词典: Revert diff', translateString('Revert diff'), '还原改动');
check('词典: Accept changes', translateString('Accept changes'), '接受改动');
check('词典: Reject changes', translateString('Reject changes'), '放弃改动');
check('词典: Show diff', translateString('Show diff'), '显示差异');
check('词典: Hide diff', translateString('Hide diff'), '隐藏差异');
check('词典: Inline diff', translateString('Inline diff'), '行内差异');
check('词典: Side-by-side diff', translateString('Side-by-side diff'), '并排差异');
check('词典: Toggle raw markdown', translateString('Toggle raw markdown'), '切换原生 Markdown');
check('词典: View raw markdown', translateString('View raw markdown'), '查看原生 Markdown');
check('词典: Copy raw markdown', translateString('Copy raw markdown'), '复制原生 Markdown');
check('词典: Clear Conversation', translateString('Clear Conversation'), '清除对话');
check('词典: Export Conversation', translateString('Export Conversation'), '导出对话');
check('词典: Share Conversation', translateString('Share Conversation'), '分享对话');

// 14. 智能体运行态胶囊与状态提示测试
console.log('\n--- 智能体运行态胶囊与状态提示测试 ---');
check('词典: Planning...', translateString('Planning...'), '正在制定计划...');
check('词典: Generating plan...', translateString('Generating plan...'), '正在生成计划...');
check('词典: Executing command...', translateString('Executing command...'), '正在执行命令...');
check('词典: Analyzing repository...', translateString('Analyzing repository...'), '正在分析代码库...');
check('词典: Reading files...', translateString('Reading files...'), '正在读取文件...');
check('词典: Writing changes...', translateString('Writing changes...'), '正在写入改动...');
check('词典: Running verification...', translateString('Running verification...'), '正在运行验证...');
check('词典: Searching codebase...', translateString('Searching codebase...'), '正在搜索代码库...');
check('词典: Waiting for approval...', translateString('Waiting for approval...'), '等待审批...');
check('词典: Waiting for approval', translateString('Waiting for approval'), '等待审批');
check('词典: Waiting for user input...', translateString('Waiting for user input...'), '等待用户输入...');
check('词典: Waiting for user input', translateString('Waiting for user input'), '等待用户输入');
check('词典: Requires approval', translateString('Requires approval'), '需要审批');
check('词典: Stop generating', translateString('Stop generating'), '停止生成');
check('词典: Stop execution', translateString('Stop execution'), '停止执行');
check('词典: Stop agent', translateString('Stop agent'), '停止智能体');
check('词典: Ask anything, @ to mention, / for workflows', 
  translateString('Ask anything, @ to mention, / for workflows'), 
  '输入任何问题，输入 @ 提及，输入 / 调用工作流');
check('词典: Type a message or press / for workflows', 
  translateString('Type a message or press / for workflows'), 
  '输入消息或按 / 调用工作流');
check('词典: Ask a question or describe a task...', 
  translateString('Ask a question or describe a task...'), 
  '提出问题或描述任务...');

// 15. 设置中心、权限沙箱与模型参数测试
console.log('\n--- 设置中心、权限沙箱与模型参数测试 ---');
check('词典: Terminal auto-execution policy', translateString('Terminal auto-execution policy'), '终端自动执行策略');
check('词典: Background terminal execution', translateString('Background terminal execution'), '后台终端执行');
check('词典: Terminal Execution', translateString('Terminal Execution'), '终端执行');
check('词典: Terminal command execution', translateString('Terminal command execution'), '终端命令执行');
check('词典: Command auto-execution', translateString('Command auto-execution'), '命令自动执行');
check('词典: Always deny', translateString('Always deny'), '始终拒绝');
check('词典: Auto-approve', translateString('Auto-approve'), '自动批准');
check('词典: Allow background tasks', translateString('Allow background tasks'), '允许后台任务');
check('词典: Cancel task', translateString('Cancel task'), '取消任务');
check('词典: Kill task', translateString('Kill task'), '终止任务');
check('词典: Task status', translateString('Task status'), '任务状态');
check('词典: Reasoning', translateString('Reasoning'), '推理');
check('词典: Thinking budget', translateString('Thinking budget'), '思考预算');
check('词典: Models', translateString('Models'), '模型');
check('词典: Temperature', translateString('Temperature'), '温度参数');
check('词典: Context window', translateString('Context window'), '上下文窗口');
check('词典: Max output tokens', translateString('Max output tokens'), '最大输出 Token');
check('词典: System instructions', translateString('System instructions'), '系统指令');
check('词典: Custom instructions', translateString('Custom instructions'), '自定义指令');
check('词典: Active model', translateString('Active model'), '当前活跃模型');
check('词典: Available models', translateString('Available models'), '可用模型列表');
check('词典: Keybindings', translateString('Keybindings'), '快捷键绑定');
check('词典: Quick Open', translateString('Quick Open'), '快速打开');
check('词典: Installed Distros', translateString('Installed Distros'), '已安装发行版');
check('词典: WSL Distros', translateString('WSL Distros'), 'WSL 发行版');
check('词典: Security', translateString('Security'), '安全');
check('词典: Allow once', translateString('Allow once'), '允许一次');
check('词典: Always allow in this project', translateString('Always allow in this project'), '在此项目中始终允许');
check('词典: Standard sandbox', translateString('Standard sandbox'), '标准沙箱');
check('词典: Full access', translateString('Full access'), '完全访问');
check('词典: Read-only access', translateString('Read-only access'), '只读访问');
check('词典: Workspace only', translateString('Workspace only'), '仅工作区');
check('词典: Allow network access', translateString('Allow network access'), '允许网络访问');
check('词典: Allow file system modifications', translateString('Allow file system modifications'), '允许修改文件系统');
check('词典: Add MCP Server', translateString('Add MCP Server'), '添加 MCP 服务器');
check('词典: Restart MCP Server', translateString('Restart MCP Server'), '重启 MCP 服务器');
check('词典: Reload customizations', translateString('Reload customizations'), '重新加载自定义项');
check('词典: Google Cloud Project', translateString('Google Cloud Project'), 'Google Cloud 项目');
check('词典: Select a Google Cloud Project', translateString('Select a Google Cloud Project'), '选择 Google Cloud 项目');
check('词典: No Google Cloud project selected', translateString('No Google Cloud project selected'), '未选择 Google Cloud 项目');
check('词典: Switch Account', translateString('Switch Account'), '切换账号');
check('词典: Enterprise License', translateString('Enterprise License'), '企业许可证');
check('词典: Personal License', translateString('Personal License'), '个人许可证');
check('词典: Free tier', translateString('Free tier'), '免费层级');
check('词典: Pro tier', translateString('Pro tier'), '专业版层级');
check('词典: Enterprise tier', translateString('Enterprise tier'), '企业版层级');
check('词典: Quota exceeded', translateString('Quota exceeded'), '配额超限');
check('词典: Rate limit exceeded', translateString('Rate limit exceeded'), '速率限制超限');

// 16. 斜杠指令功能描述长句测试
console.log('\n--- 斜杠指令功能描述长句测试 ---');
check('长句: /goal 描述', 
  translateString('Run an autonomous, goal-driven agent loop until task completion'), 
  '自主目标驱动的智能体循环，直至彻底完成任务');
check('长句: /schedule 描述', 
  translateString('Schedule recurring workflows or set delayed reminders'), 
  '调度周期性工作流或设定延时提醒');
check('长句: /plan 描述', 
  translateString('Generate a detailed step-by-step implementation plan'), 
  '生成详尽的分步实施计划');
check('长句: /grill-me 描述', 
  translateString('Interactive interview to clarify and align requirements'), 
  '通过互动访谈厘清需求与设计决策');
check('长句: /teamwork-preview 描述', 
  translateString('Coordinate multiple autonomous subagents'), 
  '多子智能体并行协作预览模式');
check('长句: /learn 描述', 
  translateString('Save corrected workflows and habits to long-term memory'), 
  '将纠正后的工作流与习惯沉淀至长期记忆');
check('长句: /boost 描述', 
  translateString('Deep thinking and multi-perspective verification mode'), 
  '深度思考与多重视角交叉验证增强模式');

// 17. 向导截断碎片容错测试
console.log('\n--- 向导截断碎片容错测试 ---');
check('向导前段碎片: If you\'d still like a code editor, you can download it as a separate app named',
  translateString("If you'd still like a code editor, you can download it as a separate app named"),
  '如果您仍需要代码编辑器，可单独下载独立应用');
check('向导后段碎片: separate app named Antigravity IDE',
  translateString('separate app named Antigravity IDE'),
  '名为 Antigravity IDE 的独立应用');

console.log(`\n======================================================`);
console.log(`Ticket-13 测试结果: ${passed}/${total} 断言全部通过！`);
console.log(`======================================================\n`);

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
