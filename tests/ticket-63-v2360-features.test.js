'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { readAsarPackageVersion } = require('../asar-version');
const { loadTranslatorSandbox, compareSemver } = require('./helpers/translator-loader');
const { extractChangelogSection } = require('../release-assets/generate-release-assets');

console.log('=== 开始 Ticket-63 Antigravity 2.36.0 版本适配与增量 UI/动态规则专项测试 ===\n');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let total = 0;

function check(desc, actual, expected) {
  total++;
  try {
    assert.deepStrictEqual(actual, expected);
    console.log(`PASS [${total}]: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`FAIL [${total}]: ${desc}`);
    console.error('   期望:', expected);
    console.error('   实际:', actual);
  }
}

function mockText(value) {
  return { nodeType: 3, nodeValue: value };
}

function mockEl(tagName, childNodes) {
  return { nodeType: 1, tagName: tagName.toUpperCase(), childNodes };
}

// -----------------------------------------------------------------------------
// 1. v2.36.0 版本号、文档与产物元数据一致性校验
// -----------------------------------------------------------------------------
console.log('--- 1. v2.36.0 版本号与文档元数据校验 ---');
const localizeSource = fs.readFileSync(path.join(ROOT, 'localize.js'), 'utf-8');
const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const extractedPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'extracted', 'package.json'), 'utf-8'));
const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
const readmeZh = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf-8');
const readmeEn = fs.readFileSync(path.join(ROOT, 'README.en.md'), 'utf-8');
const archZh = fs.readFileSync(path.join(ROOT, 'docs', 'architecture.md'), 'utf-8');
const archEn = fs.readFileSync(path.join(ROOT, 'docs', 'architecture.en.md'), 'utf-8');
const changelogZh = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
const changelogEn = fs.readFileSync(path.join(ROOT, 'CHANGELOG.en.md'), 'utf-8');
const readyAsarPath = path.join(ROOT, 'app.asar.ready');

const curVerMatch = localizeSource.match(/const CURRENT_VERSION = ['"]([^'"]+)['"];/);
const relVerMatch = localizeSource.match(/const RELEASE_VERSION = ['"]([^'"]+)['"];/);
check('localize.js CURRENT_VERSION >= 2.36.0', Boolean(curVerMatch && compareSemver(curVerMatch[1], '2.36.0') >= 0), true);
check('localize.js RELEASE_VERSION >= 2.36.0', Boolean(relVerMatch && compareSemver(relVerMatch[1], '2.36.0') >= 0), true);
check('package.json version >= 2.36.0', compareSemver(rootPkg.version, '2.36.0') >= 0, true);
check('extracted/package.json version >= 2.36.0', compareSemver(extractedPkg.version, '2.36.0') >= 0, true);
check('app.asar.ready package.json version >= 2.36.0', compareSemver(readAsarPackageVersion(readyAsarPath), '2.36.0') >= 0, true);
check('index.html 控制中心显示 v2.36.0+', /控制中心 v2\.(3[6-9]\.|[4-9]\d\.)/.test(indexSource), true);
check('README.md 与 README.en.md 标注 v2.36.0+', readmeZh.includes('v2.36.0') && readmeEn.includes('v2.36.0'), true);
check('docs/architecture(.en).md 同步 v2.36.0+', archZh.includes('2.36.0') && archEn.includes('2.36.0'), true);
check('CHANGELOG.md 与 CHANGELOG.en.md 包含 v2.36.0 章节', changelogZh.includes('## v2.36.0 (2026-11-28)') && changelogEn.includes('## v2.36.0 (2026-11-28)'), true);
check('extractChangelogSection 精确提取 v2.36.0 章节', extractChangelogSection(changelogZh, '2.36.0').matchedExact, true);

// -----------------------------------------------------------------------------
// 2. Web UI v2.36.0 新增静态词条校验
// -----------------------------------------------------------------------------
console.log('\n--- 2. Web UI v2.36.0 新增静态词条校验 ---');
const { translateString, tryCombinedSentenceTranslation } = loadTranslatorSandbox();

const staticChecks = [
  ['Fork in Current Folder', '在当前文件夹中派生'],
  ['Fork in New Git Worktree', '在新的 Git 工作树中派生'],
  ['Creates a git worktree of this repository, with a working copy of its own.', '创建此仓库的 Git 工作树，并拥有独立的工作副本。'],
  ['Creating git worktree for the forked conversation...', '正在为派生的对话创建 Git 工作树...'],
  ['Paste .env entries', '粘贴 .env 条目'],
  ['Parse .env', '解析 .env'],
  ['Network secrets', '网络密钥'],
  ['Environment variables', '环境变量'],
  ['Saved securely. Secret values are hidden after saving.', '已安全保存。密钥值在保存后将隐藏显示。'],
  ['Arize API Key', 'Arize API 密钥'],
  ['API key for Meshy 3D generation', '用于 Meshy 3D 生成的 API 密钥'],
  ['Filter feed', '筛选动态'],
  ['Latest screenshot', '最新截图'],
  ['Nothing in this view', '此视图中暂无内容'],
  ['Reply in Thread', '在线程中回复'],
  ['Add reaction', '添加回应'],
  ['FYI', '仅供参考'],
  ['Sent as a quiet FYI (delivered on next turn without waking agent)', '作为静默提示发送（将在下一回合送达，不会唤醒智能体）'],
  ['Organization prepaid wallet is empty', '组织预付钱包余额已耗尽'],
  ['Billing model', '计费模式'],
  ['Available licenses', '可用许可证'],
  ['Auto-assignment not configured', '未配置自动分配'],
  ['Get started with Remote Control', '开始使用远程控制'],
  ['Loading Remote Control QR code…', '正在加载远程控制二维码…'],
  ['Are you sure you want to delete this handler?', '确定要删除此处理程序吗？'],
  ['Untrusted sidecar', '不受信任的 Sidecar'],
  ['Don\'t enter corp passwords', '请勿输入企业密码'],
  ['2x playback speed', '2 倍播放速度'],
  ['Resume 1 comment draft', '继续编辑 1 条评论草稿'],
  ['1 Draft', '1 条草稿'],
  ['Feeds', '信息流'],
  ['Approve & proceed', '批准并继续'],
  ['Approve & run', '批准并运行'],
  ['Auth format', '认证格式'],
  ['Network Secret', '网络密钥'],
  ['Environment Variable', '环境变量'],
  ['Back to split view', '返回分屏视图'],
  ['Expand full view', '展开完整视图'],
  ['Full screen', '全屏'],
  ['Hide from Sidebar', '从侧边栏隐藏'],
  ['Configuration saved.', '配置已保存。'],
  ['Add your API key or configuration to use this plugin.', '添加你的 API 密钥或配置以使用此插件。'],
  ['Filter agents…', '筛选智能体…'],
  ['Searching messages…', '正在搜索消息…'],
  ['Resuming environment…', '正在恢复环境…'],
  ['Waiting for you to finish signing in…', '正在等待你完成登录…'],
  ['Value is required.', '值不能为空。'],
  ['Key is required.', '键名不能为空。'],
  ['Key can only use letters, numbers, and underscores, and cannot start with a number or $.', '键名只能包含字母、数字和下划线，且不能以数字或 $ 开头。'],
  ['Cookie name is required.', 'Cookie 名称不能为空。'],
  ['Query param is required.', '查询参数不能为空。'],
  ['No matches', '无匹配项'],
  ['Grant permission', '授予权限'],
  ['Duplicate project name', '项目名称重复'],
  ['Duplicate workspace name', '工作区名称重复'],
  ['Failed to delete project', '删除项目失败'],
  ['Failed to delete workspace', '删除工作区失败'],
];

for (const [src, expected] of staticChecks) {
  check(`静态词条 "${src}"`, translateString(src), expected);
}

// -----------------------------------------------------------------------------
// 3. Web UI v2.36.0 动态规则、$ 安全性与防误伤校验
// -----------------------------------------------------------------------------
console.log('\n--- 3. Web UI v2.36.0 动态规则与防误伤校验 ---');
const dynamicChecks = [
  ['Failed to load instances: timeout $&', '加载实例失败：timeout $&'],
  ['Project: my-$1-app', '项目：my-$1-app'],
  ['Replace environment variable: API_KEY', '替换环境变量：API_KEY'],
  ['Add network secret: MESHY_API_KEY', '添加网络密钥：MESHY_API_KEY'],
  ['Please fill in all required fields: API Key, URL', '请填写所有必填字段：API Key, URL'],
  ['Environment variable "PATH" is reserved by the system and cannot be used. Choose a different key.', '环境变量“PATH”为系统保留名称，无法使用，请换一个键名。'],
  ['Environment variable "TOKEN" is already used by a Network Secret ("Demo") in this scope. Choose a different name or delete the existing credential.', '环境变量“TOKEN”在当前作用域内已被 网络密钥 ("Demo") 占用，请换一个名称，或删除现有凭证。'],
  ['Environment variable "TOKEN" is already used by another credential in this scope. Choose a different name or update the existing credential.', '环境变量“TOKEN”在当前作用域内已被 其他凭证 占用，请换一个名称，或更新现有凭证。'],
  ['3 agents are working quietly in the background. Anything that needs your input will show up here.', '3 个智能体正在后台静默运行。任何需要你确认的内容都会显示在这里。'],
  ['1 agent is working quietly in the background. Anything that needs your input will show up here.', '1 个智能体正在后台静默运行。任何需要你确认的内容都会显示在这里。'],
  ['Looks good on plan.md — go ahead and proceed.', '关于“plan.md”的内容没有问题 — 请继续执行。'],
  ['Running “Daily $&” now', '正在立即运行“Daily $&”'],
  ['3 of 5 steps done', '已完成 3 / 5 步'],
  ['Restore 4 cleared', '恢复已清除的 4 项'],
  ['Reply in thread to Alice', '在线程中回复 Alice'],
  ['You reacted with 👍', '你添加了回应 👍'],
  ['Alice reacted with 👍', 'Alice 添加了回应 👍'],
  ['Alice reacted with thumbs up', 'Alice 添加了回应 thumbs up'],
  ['Alice reacted with thumbs down', 'Alice 添加了回应 thumbs down'],
  ['Alice reacted with heart', 'Alice 添加了回应 heart'],
  ['👍 (3), click to remove your reaction', '👍 (3)，点击移除你的回应'],
  ['Copied link to Thread 1', '已复制 Thread 1 的链接'],
  ['3 replies', '3 条回复'],
  ['No messages matching “$1” in loaded messages.', '在已加载的消息中没有匹配“$1”的结果。'],
  ['No messages matching “$1”.', '没有匹配“$1”的消息。'],
  ['Resume the conversation to start its workspace again, then start the server on port 3000 and retry.', '请恢复对话以重新启动其工作区，然后在端口 3000 上启动服务器后重试。'],
  ['No server is listening on port 3000 inside the remote workspace. Start it, or ask the agent to, then retry.', '远程工作区内的端口 3000 上没有正在监听的服务。请启动服务（或让智能体启动）后重试。'],
  ['Work in /tmp/$&', '工作目录：/tmp/$&'],
  ['Work in file:///Users/dev/repo', '工作目录：file:///Users/dev/repo'],
  ['Environment paused. Click to resume it and load the terminal.', '环境已暂停，点击恢复以加载终端。'],
  ['Environment paused. Click to resume it and load the image.', '环境已暂停，点击恢复以加载图片。'],
  ['Environment paused. Click to resume it and load the video.', '环境已暂停，点击恢复以加载视频。'],
  ['Failed to update agent: denied', '更新智能体失败：denied'],
  ['Error toggling MCP server: timeout', '切换 MCP 服务器出错：timeout'],
  ['This deletes 2 call recordings (4.5 MB) from your machine. You can\'t undo this.', '此操作将从你的设备中删除 2 条通话录音（4.5 MB），且无法撤销。'],
  ['This deletes 2 call recordings (4.5 MB) and cannot be undone.', '此操作将删除 2 条通话录音（4.5 MB），且无法撤销。'],
  ['Secret for a new GitHub account', '新 GitHub 账户的密钥'],
  ['New secret for user@example.com', '新建密钥：user@example.com'],
  ['Secret for GitHub', '密钥：GitHub'],
  ['More for my-plugin', '更多操作：my-plugin'],
  ['More for us-east-1', '更多操作：us-east-1'],
  ['Scroll to Bottom (7 unread)', '滚动到底部（7 条未读）'],
  ['Still thinking, 15 seconds', '仍在思考中，已用时 15 秒'],
  ['Unfold lines 12-48', '展开第 12-48 行'],
  ['Generating with Gemini 🍌', '正在使用 Gemini 生成 🍌'],
  ['Web app: 2.36.0', 'Web 应用：2.36.0'],
  ['Web app: 2.36.0\nLanguage server: 1029995663\nRelease channel: stable', 'Web 应用：2.36.0\n语言服务器：1029995663\n发布通道：stable'],
  ['1 match', '1 个匹配项'],
  ['12+ matches', '12+ 个匹配项'],
  ['3 needing your input', '3 项需要你处理'],
  ['2 tasks running', '2 个任务正在运行'],
  ['Configure Arize AX', '配置 Arize AX'],
  ['Remove dev-box.internal from Recent', '从最近记录中移除 dev-box.internal'],
  ['Removed dev-box.internal from Recent', '已从最近记录中移除 dev-box.internal'],
  ['Couldn\'t remove dev-box.internal from Recent', '无法从最近记录中移除 dev-box.internal'],
  ['Cannot add folder: "/tmp/$&" is not a valid folder location.', '无法添加文件夹：“/tmp/$&”不是有效的文件夹路径。'],
  ['Failed to resolve folder: /bad ($&)', '解析文件夹失败：/bad ($&)'],
  ['A file already exists at /tmp/foo.', '路径 /tmp/foo 处已存在同名文件。'],
  ['Can’t create this path — “foo” is a file, not a folder.', '无法创建此路径——“foo”是一个文件，而非文件夹。'],
  ['Failed to save project settings: denied $&', '保存项目设置失败：denied $&'],
  ['Failed to save project Google3 configuration: denied', '保存项目 Google3 配置失败：denied'],
  ['Failed to save cloud permission settings: denied', '保存云端权限设置失败：denied'],
  ['Failed to create project: quota exceeded', '创建项目失败：quota exceeded'],
  ['Failed to delete workspace: locked', '删除工作区失败：locked'],
  ['Couldn\'t disconnect github: timeout', '无法断开 github 的连接：timeout'],
  ['Restarted "my-sidecar".', '已重启“my-sidecar”。'],
  ['Created automation "Nightly Check".', '已创建自动化任务“Nightly Check”。'],
  ['Failed to update "my-trigger"', '更新“my-trigger”失败'],
  ['Failed to load page 3: Unknown error', '加载第 3 页失败：Unknown error'],
  ['Opens the New Conversation screen for this project', '为此项目打开新建对话界面'],
  ['Opens the New Conversation screen for this workspace', '为此工作区打开新建对话界面'],
  ['Thread #42', '线程 #42'],
  ['Topic sess_01', '主题 sess_01'],
  ['failed to load image', '图片加载失败'],
];

for (const [src, expected] of dynamicChecks) {
  const actual = translateString(src);
  check(`动态规则 "${src.slice(0, 48)}"`, actual, expected);
  check(`动态规则幂等 "${src.slice(0, 40)}"`, translateString(actual), expected);
}

// React 三节点 Feed 按钮组合句校验
const showAllBtn = mockEl('button', [mockText('Show all ('), mockText('12'), mockText(')')]);
check('Feed Show all (12) 三节点命中', tryCombinedSentenceTranslation(showAllBtn), true);
check('Feed Show all (12) 首段译文', showAllBtn.childNodes[0].nodeValue, '显示全部 (');
check('Feed Show all (12) 数字节点原位保留', showAllBtn.childNodes[1].nodeValue, '12');
check('Feed Show all (12) 幂等', tryCombinedSentenceTranslation(showAllBtn), true);

const restoreBtn = mockEl('button', [mockText('Restore '), mockText('5'), mockText(' cleared')]);
check('Feed Restore 5 cleared 三节点命中', tryCombinedSentenceTranslation(restoreBtn), true);
check('Feed Restore 5 cleared 首段译文', restoreBtn.childNodes[0].nodeValue, '恢复已清除的 ');
check('Feed Restore 5 cleared 数字节点原位保留', restoreBtn.childNodes[1].nodeValue, '5');
check('Feed Restore 5 cleared 尾段译文', restoreBtn.childNodes[2].nodeValue, ' 项');
check('Feed Restore 5 cleared 幂等', tryCombinedSentenceTranslation(restoreBtn), true);

const resetBtn = mockEl('button', [mockText('Reset ('), mockText('4'), mockText(' cleared)')]);
check('Feed Reset (4 cleared) 三节点命中', tryCombinedSentenceTranslation(resetBtn), true);
check('Feed Reset (4 cleared) 首段译文', resetBtn.childNodes[0].nodeValue, '重置 (');
check('Feed Reset (4 cleared) 数字节点原位保留', resetBtn.childNodes[1].nodeValue, '4');
check('Feed Reset (4 cleared) 尾段译文', resetBtn.childNodes[2].nodeValue, ' 项已清除)');
check('Feed Reset (4 cleared) 幂等', tryCombinedSentenceTranslation(resetBtn), true);

const showHiddenBtn = mockEl('button', [mockText('Show all ('), mockText('3'), mockText(' hidden)')]);
check('Sidebar Show all (3 hidden) 三节点命中', tryCombinedSentenceTranslation(showHiddenBtn), true);
check('Sidebar Show all (3 hidden) 首段译文', showHiddenBtn.childNodes[0].nodeValue, '显示全部 (');
check('Sidebar Show all (3 hidden) 数字节点原位保留', showHiddenBtn.childNodes[1].nodeValue, '3');
check('Sidebar Show all (3 hidden) 尾段译文', showHiddenBtn.childNodes[2].nodeValue, ' 个已隐藏)');
check('Sidebar Show all (3 hidden) 幂等', tryCombinedSentenceTranslation(showHiddenBtn), true);

const searchingSpan = mockEl('span', [
  mockText('Searching '),
  mockText('1'),
  mockText(' loaded'),
  mockText(' '),
  mockText('message'),
  mockText(' — older history available'),
]);
check('Searching 1 loaded message 六节点命中', tryCombinedSentenceTranslation(searchingSpan), true);
check('Searching 1 loaded message 拼接文本', searchingSpan.childNodes.map(n => n.nodeValue).join(''), '正在搜索已加载的 1 条消息 — 可加载更早历史');
// 模拟 React 原位将 1 -> 50 且将 message -> messages 后再触发翻译
searchingSpan.childNodes[1].nodeValue = '50';
searchingSpan.childNodes[4].nodeValue = 'messages';
check('Searching React 原位切单复数后二次命中', tryCombinedSentenceTranslation(searchingSpan), true);
check('Searching React 原位切单复数无残余英文', searchingSpan.childNodes.map(n => n.nodeValue).join(''), '正在搜索已加载的 50 条消息 — 可加载更早历史');

// 模拟真实 MutationObserver characterData 批量管道，验证 React 原位更新绝不出现“消息消息”叠词或断层
let capturedMoCb = null;
const mockDocBody = { nodeType: 1, tagName: 'BODY', childNodes: [], parentElement: null, getAttribute: () => null };
const liveEnv = loadTranslatorSandbox({
  MutationObserver: class {
    constructor(cb) {
      capturedMoCb = cb;
    }
    observe() {}
    disconnect() {}
  },
  document: {
    body: mockDocBody,
    documentElement: mockDocBody,
    readyState: 'complete',
    addEventListener: () => {},
    querySelectorAll: () => [],
  },
});

function linkParent(el) {
  el.parentElement = mockDocBody;
  el.getAttribute = () => null;
  for (const ch of el.childNodes) ch.parentElement = el;
  return el;
}

const liveSearching = linkParent(
  mockEl('span', [
    mockText('Searching '),
    mockText('1'),
    mockText(' loaded'),
    mockText(' '),
    mockText('message'),
    mockText(' — older history available'),
  ])
);
liveEnv.translateNode(liveSearching);
check('Live MO 初始渲染 Searching 1 loaded message', liveSearching.childNodes.map(n => n.nodeValue).join(''), '正在搜索已加载的 1 条消息 — 可加载更早历史');
// 模拟 React characterData 原位变更：1 -> 50 且 message -> messages
liveSearching.childNodes[1].nodeValue = '50';
liveSearching.childNodes[4].nodeValue = 'messages';
capturedMoCb([
  { type: 'characterData', target: liveSearching.childNodes[1] },
  { type: 'characterData', target: liveSearching.childNodes[4] },
]);
check('Live MO characterData 1->50 绝无“消息消息”叠词', liveSearching.childNodes.map(n => n.nodeValue).join(''), '正在搜索已加载的 50 条消息 — 可加载更早历史');
// 再切回 1 message
liveSearching.childNodes[1].nodeValue = '1';
liveSearching.childNodes[4].nodeValue = 'message';
capturedMoCb([
  { type: 'characterData', target: liveSearching.childNodes[1] },
  { type: 'characterData', target: liveSearching.childNodes[4] },
]);
check('Live MO characterData 50->1 依然精确无叠词', liveSearching.childNodes.map(n => n.nodeValue).join(''), '正在搜索已加载的 1 条消息 — 可加载更早历史');

// 模拟 4 节点 No messages matching “foo” in loaded messages. <-> “bar”. 实机切换
const liveNoMatch = linkParent(
  mockEl('div', [mockText('No messages matching “'), mockText('foo'), mockText('”'), mockText(' in loaded messages.')])
);
liveEnv.translateNode(liveNoMatch);
check('Live MO 4节点 No messages matching 初始态', liveNoMatch.childNodes.map(n => n.nodeValue).join(''), '在已加载的消息中没有匹配“foo”的结果。');
liveNoMatch.childNodes[1].nodeValue = 'bar';
liveNoMatch.childNodes[3].nodeValue = '.';
capturedMoCb([
  { type: 'characterData', target: liveNoMatch.childNodes[1] },
  { type: 'characterData', target: liveNoMatch.childNodes[3] },
]);
check('Live MO 4节点切换为短句号变体并保留新查询词', liveNoMatch.childNodes.map(n => n.nodeValue).join(''), '没有匹配“bar”的消息。');
liveNoMatch.childNodes[3].nodeValue = ' in loaded messages.';
capturedMoCb([{ type: 'characterData', target: liveNoMatch.childNodes[3] }]);
check('Live MO 4节点切回 in loaded messages 变体', liveNoMatch.childNodes.map(n => n.nodeValue).join(''), '在已加载的消息中没有匹配“bar”的结果。');

// 按 WHATWG DOM §4.10 规范（任何 nodeValue 赋值即使同值也必入队 characterData MutationRecord）验证全部 8 组多节点合句零死循环
{
  let specMoCb = null;
  const microtasks = [];
  const pendingMutations = [];
  let mutationFlushScheduled = false;
  const specBody = { nodeType: 1, tagName: 'BODY', childNodes: [], parentElement: null, getAttribute: () => null };

  const specEnv = loadTranslatorSandbox({
    queueMicrotask: (fn) => microtasks.push(fn),
    MutationObserver: class {
      constructor(cb) {
        specMoCb = cb;
      }
      observe() {}
      disconnect() {}
    },
    document: {
      body: specBody,
      documentElement: specBody,
      readyState: 'complete',
      addEventListener: () => {},
      querySelectorAll: () => [],
    },
  });

  function enqueueMutation(node) {
    pendingMutations.push({ type: 'characterData', target: node });
    if (!mutationFlushScheduled) {
      mutationFlushScheduled = true;
      microtasks.push(() => {
        mutationFlushScheduled = false;
        const batch = pendingMutations.splice(0);
        if (batch.length && specMoCb) specMoCb(batch);
      });
    }
  }

  function makeSpecText(initial) {
    let val = initial;
    const node = { nodeType: 3, parentElement: null };
    Object.defineProperty(node, 'nodeValue', {
      get: () => val,
      set: (next) => {
        val = String(next);
        enqueueMutation(node);
      },
      enumerable: true,
    });
    return node;
  }

  function runSpecSettleTest(label, tag, texts, expected) {
    microtasks.length = 0;
    pendingMutations.length = 0;
    mutationFlushScheduled = false;
    const el = {
      nodeType: 1,
      tagName: tag.toUpperCase(),
      childNodes: texts.map(makeSpecText),
      parentElement: specBody,
      getAttribute: () => null,
    };
    for (const ch of el.childNodes) ch.parentElement = el;
    specEnv.translateNode(el);
    let ticks = 0;
    while (microtasks.length > 0 && ticks < 50) {
      const fn = microtasks.shift();
      fn();
      ticks++;
    }
    check(`WHATWG 规范零死循环 (${label}) ticks <= 4`, ticks <= 4, true);
    check(`WHATWG 规范稳态译文 (${label})`, el.childNodes.map(n => n.nodeValue).join(''), expected);
  }

  runSpecSettleTest('Show all (12)', 'button', ['Show all (', '12', ')'], '显示全部 (12)');
  runSpecSettleTest('Show all (3 hidden)', 'button', ['Show all (', '3', ' hidden)'], '显示全部 (3 个已隐藏)');
  runSpecSettleTest('Reset (4 cleared)', 'button', ['Reset (', '4', ' cleared)'], '重置 (4 项已清除)');
  runSpecSettleTest('Restore 5 cleared', 'button', ['Restore ', '5', ' cleared'], '恢复已清除的 5 项');
  runSpecSettleTest('No messages matching in loaded', 'div', ['No messages matching “', 'foo', '”', ' in loaded messages.'], '在已加载的消息中没有匹配“foo”的结果。');
  runSpecSettleTest('No messages matching short .', 'div', ['No messages matching “', 'foo', '”', '.'], '没有匹配“foo”的消息。');
  runSpecSettleTest('Searching 1 loaded message', 'span', ['Searching ', '1', ' loaded', ' ', 'message', ' — older history available'], '正在搜索已加载的 1 条消息 — 可加载更早历史');
  runSpecSettleTest('No matching projects', 'div', ['No matching ', 'projects'], '没有匹配的项目');
}

const antiFalsePositiveCases = [
  'Work in progress',
  'Work in a new git worktree.',
  'Work in sync',
  'Work in parallel',
  'Work in background',
  'Thread safety',
  'Topic list',
  'More for you',
  'More for your team',
  'More for everyone',
  'The server reacted with 500 Internal Server Error',
  'Users reacted with surprise',
  'Configure proxy server',
  'Configure API keys for this project',
  'Fig share',
  'Gemini Flash Next',
  'Orchestrator',
  'Swarm',
  'NAVIGATION_BLOCKED: Payment page (https://pay.example.com) cannot be inspected or actuated by the agent; ask the user to complete the payment in the browser pane',
];
for (const raw of antiFalsePositiveCases) {
  const translated = translateString(raw);
  if (raw === 'Work in progress') {
    check('Work in progress 不被 Work in 动态规则截胡', translated !== '工作目录：progress', true);
  } else {
    check(`防误伤保留原样 "${raw.slice(0, 48)}"`, translated, raw);
  }
}

// -----------------------------------------------------------------------------
// 4. 实装产物 preload.js 与 wizardPreload.js 校验
// -----------------------------------------------------------------------------
console.log('\n--- 4. 实装产物 preload.js 与 wizardPreload.js 校验 ---');
const distDir = path.join(ROOT, 'extracted', 'dist');
const preloadJs = fs.readFileSync(path.join(distDir, 'preload.js'), 'utf-8');
const wizardPreloadJs = fs.readFileSync(path.join(distDir, 'ideInstall', 'wizardPreload.js'), 'utf-8');
check(
  'extracted preload.js 与 wizardPreload.js 已实装 v2.36.0 新增词条与动态规则',
  preloadJs.includes('在新的 Git 工作树中派生') &&
    preloadJs.includes('组织预付钱包余额已耗尽') &&
    preloadJs.includes('加载实例失败：') &&
    wizardPreloadJs.includes('在新的 Git 工作树中派生') &&
    wizardPreloadJs.includes('加载实例失败：'),
  true
);

console.log(`\n========== 测试完成: ${passed}/${total} 全部通过 ==========`);
if (passed !== total) {
  process.exit(1);
}
