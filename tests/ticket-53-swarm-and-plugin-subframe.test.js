'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { loadTranslatorSandbox } = require('./helpers/translator-loader');

console.log('=== 开始 Ticket-53 Swarm 侧栏面板与 plugin:// 子框架注入专项测试 ===\n');

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

function makeEl(tagName, { className = '', attrs = {}, children = [] } = {}) {
  const classes = className ? className.split(/\s+/).filter(Boolean) : [];
  const attributes = { ...attrs };
  const node = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    className,
    classList: { contains: (c) => classes.includes(c) },
    childNodes: children,
    firstChild: children[0] || null,
    get textContent() {
      return this.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join('');
    },
    hasAttribute: (name) => Object.prototype.hasOwnProperty.call(attributes, name),
    getAttribute: (name) => (Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null),
    setAttribute: (name, value) => { attributes[name] = value; },
  };
  for (const ch of children) ch.parentElement = node;
  return node;
}

function makeText(val) {
  return { nodeType: 3, nodeValue: val };
}

const { translateString, translateNode, shouldSkipNode } = loadTranslatorSandbox();

console.log('--- 1. Swarm 静态词条与品牌名保留 ---');
const staticCases = [
  ['Swarm', 'Swarm'],
  ['No swarm in this conversation', '当前对话中暂无 Swarm'],
  ['Watching for a swarm', '正在等待 Swarm 启动'],
  ["Looking for this conversation's swarm…", '正在查找当前对话的 Swarm…'],
  ['Untitled swarm', '未命名 Swarm'],
  ['Live', '实时'],
  ['Reconnecting', '正在重连'],
  ['Updates automatically', '自动更新'],
  ['Overview', '概览'],
  ['Board', '看板'],
  ['Members', '成员'],
  ['Graph', '关系图'],
  ['Raw', '原始数据'],
  ['Goal', '目标'],
  ['GOAL', '目标'],
  ['Running', '正在运行'],
  ['Coordinator', '协调器'],
  ['Coordinator · Working', '协调器 · 工作中'],
  ['Planned next', '后续计划'],
  ['Needs you', '需要你处理'],
  ['Waiting on @coordinator', '等待 @coordinator'],
  ['Stuck', '卡住'],
  ['Resting', '休眠中'],
  ['Retired', '已停用'],
  ['In review', '审核中'],
  ['No tasks completed yet.', '暂未完成任何任务。'],
  ['overview · from the narrator’s notes', '概览 · 来自旁白笔记'],
  ['Narrator’s page', '旁白视图'],
  ['Want this view different? Tell the coordinator.', '想调整此视图的展示方式？直接告诉协调器即可。'],
  ['Open coordinator chat', '打开协调器对话'],
  ['Your swarm is starting', 'Swarm 正在启动'],
  ['Waiting for the first update', '正在等待首条进展更新'],
  ['Swarm stalled — no agents working', 'Swarm 已停滞 — 当前无智能体运行'],
  ['From anyone', '所有发布者'],
  ['To anyone', '所有接收者'],
  ['All channels', '全部频道'],
  ['Follow', '跟随最新'],
  ['Latest', '跳至最新'],
  ['No posts match', '没有匹配的动态'],
  ['No posts yet', '暂无动态'],
  ['Search members', '搜索成员'],
  ['Killed', '已终止'],
  ['Hive', '蜂巢'],
  ['Mentions', '提及'],
  ['Hide inactive', '隐藏非活跃'],
  ['Expand @all', '展开 @all'],
  ['Even pacing', '均匀节奏'],
  ['Real-time gaps', '真实时间间隔'],
  ['Export GIF', '导出 GIF'],
  ['Exporting…', '正在导出…'],
  ['Open in new tab', '在新标签页中打开'],
  ['Right-click image to save, or open in a new tab.', '右键图片即可保存，或在新标签页中打开。'],
  ['Waiting for posts', '等待看板新动态'],
];
for (const [en, zh] of staticCases) {
  check(`静态词条: ${en}`, translateString(en), zh);
}

console.log('\n--- 2. Swarm 动态模板（进度、线程、等待、回放、导出） ---');
const dynamicCases = [
  ['0 of 1 tasks done', '0 / 1 项任务已完成'],
  ['3 of 5 tasks done', '3 / 5 项任务已完成'],
  ['0 of 1', '0 / 1'],
  ['1 thread open', '1 个线程进行中'],
  ['4 threads open', '4 个线程进行中'],
  ['2 waiting on @coordinator', '2 项正在等待 @coordinator'],
  ['1 stuck', '1 项卡住'],
  ['1 needs you', '1 项需要你处理'],
  ['2 need you', '2 项需要你处理'],
  ['3 in review', '3 项审核中'],
  ['2 active', '2 项活跃'],
  ['Up next · 4', '接下来 · 4'],
  ['+3 more', '还有 +3 项'],
  ['Waiting on @card-architect', '等待 @card-architect'],
  ['Waiting on 3', '等待 3 位成员'],
  ['Working for @coordinator', '正在为 @coordinator 处理'],
  ['12 posts', '12 条动态'],
  ['1 post', '1 条动态'],
  ['5 posts over 3m 20s', '5 条动态 · 历时 3 分钟 20 秒'],
  ['2 posts since the view was updated', '自视图上次更新以来新增了 2 条动态'],
  ['last seen 5m ago', '最近活跃于 5 分钟前'],
  ['last seen 2h ago', '最近活跃于 2 小时前'],
  ['last seen 3d ago', '最近活跃于 3 天前'],
  ['Runs on devbox', '运行于 devbox'],
  ['Open @worker-1', '打开 @worker-1'],
  ['Go to #14 on the Board', '跳转到看板 #14'],
  ['Posted in #backend; click to show only #backend', '发布于 #backend；点击仅查看 #backend'],
  ['Exporting 65%', '正在导出 65%'],
  ['Exported swarm.gif (24 frames · 1.2 MB)', '已导出 swarm.gif（24 frames · 1.2 MB）'],
  ['GIF ready (10 frames · 420 KB) — right-click image to save.', 'GIF 已就绪（10 frames · 420 KB）— 右键图片即可保存。'],
  ['Rendering swarm.gif…', '正在渲染 swarm.gif…'],
  ['Download swarm-graph.gif', '下载 swarm-graph.gif'],
  ['24 frames · 1.2 MB', '24 帧 · 1.2 MB'],
  ['Narrator read up to #12 of 20', '旁白已阅读至 #12 / 20'],
  ['overview · from the narrator\'s notes · stale', '概览 · 来自旁白笔记 · stale'],
  ['Opening worker-1\'s conversation needs the app.', '打开 worker-1 的对话需要在客户端内操作。'],
  ['worker-1 runs on remote-box; open it there.', 'worker-1 运行在 remote-box 上，请在对应设备打开。'],
  ['Now · 4 / 4', '现在 · 4 / 4'],
  ['Coordinator · 2 of 5 done', '协调器 · 已完成 2 / 5'],
  ['Coordinator · 2 of 5 done · Needs you', '协调器 · 已完成 2 / 5 · 需要你处理'],
];
for (const [en, zh] of dynamicCases) {
  check(`动态模板: ${en}`, translateString(en), zh);
  check(`幂等校验: ${en}`, translateString(zh), zh);
}

// 兼容 hive.js L742 的滑块数字前置替换
check(
  'hive.js 滑块前置数字替换兼容',
  translateString('0 of 5 tasks done').replace(/^\d+/, '3'),
  '3 / 5 项任务已完成'
);

console.log('\n--- 3. DOM 组合句（<code>/swarm</code> 与 <b>0 of 1</b>）及动态内容隔离保护 ---');
const emptyCode = makeEl('code', { children: [makeText('/swarm')] });
const emptyP = makeEl('p', {
  className: 'empty-body',
  children: [
    makeText('Swarms started in this conversation appear here automatically, with their board, members and @mention graph. Start one with '),
    emptyCode,
    makeText('.'),
  ],
});
translateNode(emptyP);
check('空状态组合句完整译出且保留 <code>/swarm</code>', emptyP.textContent, '当前对话中启动的 Swarm 会自动显示在此处，包含其看板、成员与 @mention 关系图。输入 /swarm 即可启动。');
check('<code>/swarm</code> 节点本身完好未破坏', emptyCode.firstChild.nodeValue, '/swarm');

const progB = makeEl('b', { children: [makeText('0 of 1')] });
const progSpan = makeEl('span', {
  className: 'o2-progt',
  children: [progB, makeText(' tasks done')],
});
translateNode(progSpan);
check('进度卡 <b>0 of 1</b> tasks done 保留加粗节点并译出', progSpan.textContent, '0 / 1 项任务已完成');
check('进度卡 <b> 内部译为 0 / 1', progB.firstChild.nodeValue, '0 / 1');

// 目标卡片内 .o2-glbl ("Goal") 需翻译，AI 生成的 B/P 必须跳过
const goalLabel = makeEl('div', { className: 'o2-glbl', children: [makeText('Goal')] });
const goalTitle = makeEl('b', { children: [makeText('Overview')] });
const goalSub = makeEl('p', { children: [makeText('Build me a web app')] });
const goalCard = makeEl('section', { className: 'o2-goal', children: [goalLabel, goalTitle, goalSub] });
translateNode(goalCard);
check('Goal 卡片标签译为“目标”', goalLabel.firstChild.nodeValue, '目标');
check('Goal 卡片 AI 标题受保护不误翻', goalTitle.firstChild.nodeValue, 'Overview');
check('Goal 卡片 AI 副标题受保护不误翻', goalSub.firstChild.nodeValue, 'Build me a web app');

// Board 正文、@mention、成员徽章、Raw JSON 必须跳过
const msgBodyText = makeText('Board');
const msgBody = makeEl('div', { className: 'msg-body md open', children: [msgBodyText] });
const mentionText = makeText('@coordinator');
const mentionEl = makeEl('span', { className: 'mention', children: [mentionText] });
const workerChipText = makeText('card-architect');
const workerChip = makeEl('span', { className: 'o2-wchip bee', children: [workerChipText] });
const runTaskTitle = makeEl('b', { className: 'o2-runt', children: [makeText('Running')] });
check('Swarm 帖子正文 (.msg-body) 跳过', shouldSkipNode(msgBodyText), true);
check('Swarm @mention (.mention) 跳过', shouldSkipNode(mentionText), true);
check('Swarm 成员徽章 (.o2-wchip) 跳过', shouldSkipNode(workerChipText), true);
check('Swarm 任务标题 (.o2-runt) 跳过', shouldSkipNode(runTaskTitle.firstChild), true);

console.log('\n--- 4. dist/utils.js 的 plugin:// 子框架注入钩子校验 ---');
const utilsSrc = fs.readFileSync(path.join(ROOT, 'extracted', 'dist', 'utils.js'), 'utf-8');
check('extracted/dist/utils.js 包含 plugin:// 子框架注入钩子', utilsSrc.includes('Antigravity 2.0 Plugin Subframe DOM Localization Hook'), true);
check('extracted/dist/utils.js 监听 did-frame-finish-load', utilsSrc.includes("hubContents.on('did-frame-finish-load', handlePluginSubframeLoad)"), true);
check('extracted/dist/utils.js 关闭窗口时清理 did-frame-finish-load', utilsSrc.includes("hubContents.off?.('did-frame-finish-load', handlePluginSubframeLoad)"), true);
check('extracted/dist/utils.js 仅对 plugin:// 协议放行执行', utilsSrc.includes('/^plugin:\\/\\//i.test(frameUrl)'), true);

console.log(`\n=== Ticket-53 测试总结: ${passed}/${total} 通过 ===`);
if (passed !== total) {
  process.exit(1);
}
