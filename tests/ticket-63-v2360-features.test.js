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
  ['👍 (3), click to remove your reaction', '👍 (3)，点击移除你的回应'],
  ['Copied link to Thread 1', '已复制 Thread 1 的链接'],
  ['3 replies', '3 条回复'],
  ['No messages matching “$1” in loaded messages.', '在已加载的消息中没有匹配“$1”的结果。'],
  ['Resume the conversation to start its workspace again, then start the server on port 3000 and retry.', '请恢复对话以重新启动其工作区，然后在端口 3000 上启动服务器后重试。'],
  ['No server is listening on port 3000 inside the remote workspace. Start it, or ask the agent to, then retry.', '远程工作区内的端口 3000 上没有正在监听的服务。请启动服务（或让智能体启动）后重试。'],
  ['Work in /tmp/$&', '工作目录：/tmp/$&'],
  ['Environment paused. Click to resume it and load the terminal.', '环境已暂停，点击恢复以加载终端。'],
  ['Failed to update agent: denied', '更新智能体失败：denied'],
  ['Error toggling MCP server: timeout', '切换 MCP 服务器出错：timeout'],
  ['This deletes 2 call recordings (4.5 MB) and cannot be undone.', '此操作将删除 2 条通话录音（4.5 MB），且无法撤销。'],
  ['Secret for a new GitHub account', '新 GitHub 账户的密钥'],
  ['New secret for user@example.com', '新建密钥：user@example.com'],
  ['Secret for GitHub', '密钥：GitHub'],
  ['Scroll to Bottom (7 unread)', '滚动到底部（7 条未读）'],
  ['Still thinking, 15 seconds', '仍在思考中，已用时 15 秒'],
  ['Unfold lines 12-48', '展开第 12-48 行'],
  ['Generating with Gemini 🍌', '正在使用 Gemini 生成 🍌'],
  ['Web app: 2.36.0', 'Web 应用：2.36.0'],
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

const antiFalsePositiveCases = [
  'Work in progress',
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
