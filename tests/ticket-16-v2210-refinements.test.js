const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('=== Running Ticket-16: v2.21.0 Deep Localization Refinements Test ===');

const preloadPath = path.join(__dirname, '..', 'extracted', 'dist', 'preload.js');
assert.ok(fs.existsSync(preloadPath), 'extracted/dist/preload.js must exist');
const preloadCode = fs.readFileSync(preloadPath, 'utf-8');

// 1. VM Sandbox setup to extract translateString
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

// Wrap preload code to extract translateString
const marker = '// Antigravity 2.0 Chinese Localization Engine';
const markerIdx = preloadCode.indexOf(marker);
assert.ok(markerIdx !== -1, 'Preload must contain injection marker');
const engineCode = preloadCode.substring(markerIdx);

const exportInstrument = engineCode.replace(
  "if (document.readyState === 'loading')",
  'globalThis.__test_translateString = translateString;\n  if (typeof document !== "undefined" && document.readyState === "loading")'
);

vm.runInContext(exportInstrument, sandbox);
const translate = sandbox.globalThis.__test_translateString;
assert.ok(typeof translate === 'function', 'translateString must be callable in VM');

// 2. Test 2.21.0 Specific Strings
console.log('Testing 2.21.0 specific string translations...');

// 2.1 Settings experience and token usage
assert.strictEqual(
  translate('Choose the experience that fits how you work.'),
  '选择适合您工作方式的操作体验。'
);
assert.strictEqual(
  translate('Choose between the Default and Project 4K experience.'),
  '在默认体验与 4K 项目体验之间切换。'
);
assert.strictEqual(
  translate('The breakdown below shows token usage from customizations like rules, skills, and MCP. If a budget is exceeded, large rules are demoted to path pointers and large customizations are excluded automatically.'),
  '下方明细展示了来自规则、技能和 MCP 等自定义项的 Token 用量。如果超出额度，大型规则将自动降级为路径指针，大型自定义项将被自动排除。'
);
assert.strictEqual(translate('Other Customizations'), '其他自定义项');
assert.strictEqual(translate('Show 1 breakdown'), '显示 1 项明细');
assert.strictEqual(translate('Show 5 breakdowns'), '显示 5 项明细');
assert.strictEqual(translate('Hide breakdown'), '隐藏明细');
assert.strictEqual(translate('Hide breakdowns'), '隐藏明细');

// 2.2 File and contrast settings
assert.strictEqual(translate('File Reads'), '文件读取');
assert.strictEqual(translate('File Writes'), '文件写入');
assert.strictEqual(translate('Contrast'), '对比度');
assert.strictEqual(translate('Strong'), '强烈');
assert.strictEqual(translate('Strong contrast'), '高对比度');

// 2.3 Creation states and legal
assert.strictEqual(translate('Creating Cloud Project'), '正在创建云项目');
assert.strictEqual(translate('Creating Chat Bot'), '正在创建聊天机器人');
assert.strictEqual(translate('Installing Chat Bot'), '正在安装聊天机器人');
assert.strictEqual(translate('Creating Sidecar'), '正在创建 Sidecar');
assert.strictEqual(
  translate('Setup may take over 5 minutes. Please keep this screen open during setup.'),
  '配置可能需要 5 分钟以上。配置期间请保持此界面打开。'
);
assert.strictEqual(translate('Legal Help'), '法律帮助');
assert.strictEqual(translate('to ask for content changes for legal reasons.'), '出于法律原因申请内容变更。');
assert.strictEqual(translate('Permanently delete'), '永久删除');
assert.strictEqual(translate('Refreshing...'), '正在刷新...');

// 2.4 Chat cards and interactive elements
assert.strictEqual(translate('Project options'), '项目选项');
assert.strictEqual(translate('Agent response'), '智能体回复');
assert.strictEqual(translate('Undo to this point'), '撤销至此处');
assert.strictEqual(translate('Explored files, ran commands'), '已探索文件，已执行命令');
assert.strictEqual(translate('Explored 3 files, ran 5 commands'), '已探索 3 个文件，已执行 5 条命令');
assert.strictEqual(
  translate('Exploring file, running commands, editing artifact'),
  '正在探索文件、运行命令、编辑工件'
);
assert.strictEqual(
  translate('Select model, current: Gemini 3.8 Flash High'),
  '选择模型，当前为: Gemini 3.8 Flash High'
);
assert.strictEqual(
  translate('Opens external link: https://github.com/liominsb'),
  '打开外部链接: https://github.com/liominsb'
);
assert.strictEqual(
  translate('Send feedback as developer@google.com'),
  '以 developer@google.com 身份发送反馈'
);
assert.strictEqual(translate('Show All'), '显示全部');

// 2.5 Models and plugin info
assert.strictEqual(translate('View Usage'), '查看使用额度');
assert.strictEqual(translate('Leaving Soon'), '即将下线');
assert.strictEqual(translate('Notice'), '重要提示');
assert.strictEqual(
  translate('Build applications with the Gemini Interactions API and Live API, including text, image, video, and speech generation, managed agents, and real-time multimodal streaming.'),
  '借助 Gemini Interactions API 与 Live API 构建应用程序，涵盖文本、图像、视频与语音生成，托管智能体以及实时多模态流式交互。'
);

// 3. Anti-Corruption Tests (Ensure paths, extensions and kebab-case are NOT corrupted)
console.log('Testing anti-corruption protections...');
assert.strictEqual(translate('tests/run-all-tests.js'), 'tests/run-all-tests.js', 'File path with run and .js must NOT be mangled');
assert.strictEqual(translate('run-all-tests'), 'run-all-tests', 'Kebab-case with run must NOT be mangled');
assert.strictEqual(translate('mcp-permission-authorization'), 'mcp-permission-authorization', 'Kebab-case skill name must NOT be mangled');
assert.strictEqual(translate('go/jetski-project-migration'), 'go/jetski-project-migration', 'Internal URL path must NOT be mangled');
assert.strictEqual(translate('app.asar.ready'), 'app.asar.ready', 'Artifact name with dot must NOT be mangled');
assert.strictEqual(translate('script.js'), 'script.js', 'JS extension must NOT be capitalized or translated');

// 4. Test ipcHandlers Context Menu Updates
console.log('Testing ipcHandlers native context menu translations...');
const ipcPath = path.join(__dirname, '..', 'extracted', 'dist', 'ipcHandlers.js');
assert.ok(fs.existsSync(ipcPath), 'extracted/dist/ipcHandlers.js must exist');
const ipcCode = fs.readFileSync(ipcPath, 'utf-8');
assert.ok(ipcCode.includes("'Project options': '项目选项'"), 'ipcHandlers must contain Project options');
assert.ok(ipcCode.includes("'View Usage': '查看使用额度'"), 'ipcHandlers must contain View Usage');
assert.ok(ipcCode.includes("'Duplicate': '创建副本'"), 'ipcHandlers must contain Duplicate');
assert.ok(ipcCode.includes("'Archive': '归档'"), 'ipcHandlers must contain Archive');
assert.ok(ipcCode.includes("'Clear History': '清除历史'"), 'ipcHandlers must contain Clear History');

console.log('Ticket-16: ALL ASSERTIONS PASSED (ALL GREEN)!');
