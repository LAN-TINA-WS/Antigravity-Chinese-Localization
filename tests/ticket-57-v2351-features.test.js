'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { readAsarPackageVersion } = require('../asar-version');
const { loadTranslatorSandbox, compareSemver } = require('./helpers/translator-loader');
const { extractChangelogSection } = require('../release-assets/generate-release-assets');

console.log('=== 开始 Ticket-57 Antigravity 2.35.1 版本适配与全量 UI 补漏专项测试 ===\n');

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

// -----------------------------------------------------------------------------
// 1. v2.35.1 版本号、文档与产物元数据一致性校验
// -----------------------------------------------------------------------------
console.log('--- 1. v2.35.1 版本号与文档元数据校验 ---');
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
check('localize.js CURRENT_VERSION >= 2.35.1', Boolean(curVerMatch && compareSemver(curVerMatch[1], '2.35.1') >= 0), true);
check('localize.js RELEASE_VERSION >= 2.35.1', Boolean(relVerMatch && compareSemver(relVerMatch[1], '2.35.1') >= 0), true);
check('package.json version >= 2.35.1', compareSemver(rootPkg.version, '2.35.1') >= 0, true);
check('extracted/package.json version >= 2.35.1', compareSemver(extractedPkg.version, '2.35.1') >= 0, true);
check('app.asar.ready package.json version >= 2.35.1', compareSemver(readAsarPackageVersion(readyAsarPath), '2.35.1') >= 0, true);
check('index.html 控制中心显示 v2.35.1+', /控制中心 v2\.(35\.[1-9]|3[6-9]\.|[4-9]\d\.)/.test(indexSource), true);
check('README.md 与 README.en.md 标注 v2.35.1+', readmeZh.includes('v2.35.1') && readmeEn.includes('v2.35.1'), true);
check('docs/architecture(.en).md 同步 v2.35.1+', archZh.includes('2.35.1') && archEn.includes('2.35.1'), true);
check('CHANGELOG.md 与 CHANGELOG.en.md 包含 v2.35.1 章节', changelogZh.includes('## v2.35.1 (2026-11-25)') && changelogEn.includes('## v2.35.1 (2026-11-25)'), true);
check('extractChangelogSection 精确提取 v2.35.1 章节', extractChangelogSection(changelogZh, '2.35.1').matchedExact, true);

// -----------------------------------------------------------------------------
// 2. Web UI v2.35.1 新增静态词条校验
// -----------------------------------------------------------------------------
console.log('\n--- 2. Web UI v2.35.1 新增静态词条校验 ---');
const { translateString } = loadTranslatorSandbox();

const staticChecks = [
  // 反馈弹窗
  ['Please describe your auth or billing issue. More details will help our support team resolve your issue quicker. Some helpful information includes:', '请描述您的认证或计费问题。更多详细信息将有助于我们的支持团队更快为您解决。有帮助的信息包括：'],
  ['What quota or feature is being incorrectly limited', '哪些配额或功能被错误限制'],
  ['What functionality you expect your account tier to have available that is missing', '您的账户等级应具备但缺失的功能'],
  ['Any error messages seen when trying to log in', '尝试登录时看到的任何错误提示'],
  ['Join the Google Chat space', '加入 Google Chat 交流群组'],
  ['Ask questions, report issues, and discuss features', '提问交流、反馈问题并讨论功能特性'],
  ['Screenshot must be under 10 MB', '截图文件大小必须小于 10 MB'],
  ['Attaching logs requires an email address', '附加日志需要提供电子邮箱地址'],
  ['Submitting...', '正在提交...'],
  // Hooks 与组织白名单
  ['Organization MCP Allowlist (Read-Only)', '组织 MCP 白名单（只读）'],
  ["These MCP allowlist rules are enforced by your organization's administrator.", '这些 MCP 白名单规则由您的组织管理员强制执行。'],
  ['Pre Tool Use', '工具使用前 (Pre Tool Use)'],
  ['Post Tool Use', '工具使用后 (Post Tool Use)'],
  ['Fires before a tool step executes.', '在工具步骤执行前触发。'],
  ['Fires after a tool step completes.', '在工具步骤完成后触发。'],
  ['Fires before the model is called.', '在调用模型前触发。'],
  ['Fires after tool calls finish.', '在工具调用结束后触发。'],
  ['Fires when the execution loop terminates.', '在执行循环终止时触发。'],
  ['Timeout:', '超时：'],
  ['Handler #', '处理程序 #'],
  ['Matcher:', '匹配器：'],
  // Onboarding 条款与 AI Credits
  ['Terms of Service & Data Use', '服务条款与数据使用'],
  ['One last thing before getting started…', '开始前的最后几项说明…'],
  ['A few things to know, and a couple settings to review.', '几件需要了解的事项，以及几项供您确认的设置。'],
  ['Please sign in using the Antigravity sidebar panel to view this page.', '请通过 Antigravity 侧边栏面板登录后再查看此页面。'],
  ['Models Tab', '“模型”标签页'],
  ["AI Credits are used when you've exceeded your model quota. Keep track of your current AI Credits in the Models Tab.", '超出模型配额后将使用 AI 点数。您可以在“模型”标签页中查看当前 AI 点数。'],
  // 工作流迁移、队列、占位符、查看器与统计
  ['Workflows are changing on October 19th—stay tuned for updates. You can use the agent to migrate your workflows.', '工作流功能将于 10 月 19 日迎来调整，敬请关注更新。您可以使用智能体来迁移现有工作流。'],
  ['Migrate with Agent', '使用智能体迁移'],
  ['Waiting for tool permission approval — click Open in full conversation (↗) to approve', '正在等待工具权限批准 — 点击“在完整对话中打开 (↗)”进行批准'],
  ['Message subagent, @ to mention', '向子智能体发送消息，输入 @ 提及'],
  ['Message subagent, @ to mention, / for actions', '向子智能体发送消息，输入 @ 提及，/ 触发操作'],
  ['Ask anything, @ to mention', '输入任何问题，输入 @ 提及'],
  ['Message queued.', '消息已加入队列。'],
  ['Sends after background work finishes.', '将在后台工作完成后发送。'],
  ['Best of N Models', 'Best of N 模型'],
  ['Proceed with implementation plan', '按实施计划继续'],
  ['Show 1 earlier step', '显示更早的 1 个步骤'],
  ['Denied Sites', '已拒绝的站点'],
  ['Trajectory Stats', '轨迹统计'],
  ['Cleared Count', '已清理数量'],
  ['Text selection is paused for smoother viewing. Search, comments, and annotations still work. Use the toolbar text button when selection is needed.', '为保证流畅浏览已暂停文本选择，搜索、评论和批注功能仍可正常使用。如需选择文本，请点击工具栏上的文本按钮。'],
  ['Open Mermaid diagram preview', '打开 Mermaid 图表预览'],
  ['✓ Target set', '✓ 已设置目标'],
  ['Match Condition (CEL)', '匹配条件 (CEL)'],
  ['Generating commit message...', '正在生成提交信息...'],
  ['Committing...', '正在提交...'],
  ['All changes since the branch point', '自当前分支起点以来的所有更改'],
];

for (const [src, expected] of staticChecks) {
  check(`静态词条 "${src.slice(0, 48)}"`, translateString(src), expected);
}

// -----------------------------------------------------------------------------
// 3. Web UI v2.35.1 动态规则与防误伤校验（含 $ 特殊字符安全）
// -----------------------------------------------------------------------------
console.log('\n--- 3. Web UI v2.35.1 动态规则与防误伤校验 ---');
const dynamicChecks = [
  [
    'Message queued. 2 messages in queue. Sends after background work finishes. Actions available: Send Now, Edit, Delete.',
    '消息已加入队列。队列中共有 2 条消息。将在后台工作完成后发送。可用操作：立即发送、编辑、删除。',
  ],
  [
    'Message queued. Sends after agent finishes working. Actions available: Send Now, Edit, Delete.',
    '消息已加入队列。将在智能体完成当前工作后发送。可用操作：立即发送、编辑、删除。',
  ],
  ['Proceed with implementation plan and 3 comments', '按实施计划继续并附带 3 条评论'],
  ['Proceed with implementation plan and 1 comment', '按实施计划继续并附带 1 条评论'],
  ['Show 5 earlier steps', '显示更早的 5 个步骤'],
  ['Turn 2 of 5', '第 2 / 5 回合'],
  ['Go to turn 4 of 5', '跳转到第 4 / 5 回合'],
  ['3 Files With Changes', '3 个已更改文件'],
  ['1 File With Changes', '1 个已更改文件'],
  ['All changes since origin/main', '自 origin/main 以来的所有更改'],
  ['All changes since feat/$&', '自 feat/$& 以来的所有更改'],
  ['Push 2 commits to origin', '推送 2 个提交到 origin'],
  ['Pushed 2 commits to origin.', '已推送 2 个提交到 origin。'],
  ['Pushed to origin.', '已推送到 origin。'],
  ['Publish feat/v2.35.1 to origin', '将 feat/v2.35.1 发布到 origin'],
  ['Published feat/v2.35.1 to origin.', '已将 feat/v2.35.1 发布到 origin。'],
  ['Hook will only trigger if the tool name matches run_command.', '仅当工具名称匹配 run_command 时才会触发 Hook。'],
  ['Hook will only trigger if the tool name starts with browser_.', '仅当工具名称以 browser_ 开头时才会触发 Hook。'],
  ['Hook will only trigger if the tool name matches my_custom_tool.', '仅当工具名称匹配 my_custom_tool 时才会触发 Hook。'],
  ['Hook will only trigger if the tool name starts with mcp_custom_.', '仅当工具名称以 mcp_custom_ 开头时才会触发 Hook。'],
  ['⚠️ Failed to render LaTeX: $1 + $& syntax error', '⚠️ 渲染 LaTeX 失败：$1 + $& syntax error'],
  ['⚠️ Failed to render Mermaid diagram: Parse error on line 2', '⚠️ 渲染 Mermaid 图表失败：Parse error on line 2'],
  ['Every hour', '每小时'],
  ['Every hour at :30 · UTC', '每小时 :30 · UTC'],
  ['Today 14:30', '今天 14:30'],
  ['Tomorrow 9:05 AM', '明天 9:05 AM'],
  ['Yesterday 23:59', '昨天 23:59'],
];

for (const [src, expected] of dynamicChecks) {
  const actual = translateString(src);
  check(`动态规则 "${src.slice(0, 52)}"`, actual, expected);
  check(`动态规则幂等 "${src.slice(0, 40)}"`, translateString(actual), expected);
}

const antiFalsePositiveCases = [
  'Today is Monday',
  'Tomorrow will be sunny',
  'Yesterday we fixed a bug',
  'Today 14:30 is not a valid token in prose',
  'Gemini 4 Hydrogen (High)',
  'Orchestrator',
  'Swarm',
];
for (const raw of antiFalsePositiveCases) {
  check(`防误伤保留原样 "${raw}"`, translateString(raw), raw);
}

// -----------------------------------------------------------------------------
// 4. 实装产物 preload.js 与 wizardPreload.js 校验
// -----------------------------------------------------------------------------
console.log('\n--- 4. 实装产物 preload.js 与 wizardPreload.js 校验 ---');
const distDir = path.join(ROOT, 'extracted', 'dist');
const preloadJs = fs.readFileSync(path.join(distDir, 'preload.js'), 'utf-8');
const wizardPreloadJs = fs.readFileSync(path.join(distDir, 'ideInstall', 'wizardPreload.js'), 'utf-8');
check(
  'extracted preload.js 与 wizardPreload.js 已实装 v2.35.1 新增词条与动态规则',
  preloadJs.includes('“模型”标签页') &&
    preloadJs.includes('轨迹统计') &&
    preloadJs.includes('消息已加入队列。') &&
    preloadJs.includes('将在后台工作完成后发送。') &&
    wizardPreloadJs.includes('服务条款与数据使用') &&
    wizardPreloadJs.includes('“模型”标签页'),
  true
);

console.log(`\n========== 测试完成: ${passed}/${total} 全部通过 ==========`);
if (passed !== total) {
  process.exit(1);
}
