'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { readAsarPackageVersion } = require('../asar-version');
const { loadTranslatorSandbox, compareSemver } = require('./helpers/translator-loader');
const { extractChangelogSection } = require('../release-assets/generate-release-assets');

console.log('=== 开始 Ticket-56 Antigravity 2.35.0 官方版本全量特性与主进程同步专项测试 ===\n');

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
// 1. v2.35.0 版本号、文档与产物元数据一致性校验
// -----------------------------------------------------------------------------
console.log('--- 1. v2.35.0 版本号与文档元数据校验 ---');
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
check('localize.js CURRENT_VERSION >= 2.35.0', Boolean(curVerMatch && compareSemver(curVerMatch[1], '2.35.0') >= 0), true);
check('localize.js RELEASE_VERSION >= 2.35.0', Boolean(relVerMatch && compareSemver(relVerMatch[1], '2.35.0') >= 0), true);
check('package.json version >= 2.35.0', compareSemver(rootPkg.version, '2.35.0') >= 0, true);
check('extracted/package.json version >= 2.35.0', compareSemver(extractedPkg.version, '2.35.0') >= 0, true);
check('app.asar.ready package.json version >= 2.35.0', compareSemver(readAsarPackageVersion(readyAsarPath), '2.35.0') >= 0, true);
check('index.html 控制中心显示 v2.35.0+', /控制中心 v2\.(3[5-9]|[4-9]\d)\./.test(indexSource), true);
check('README.md 与 README.en.md 标注 v2.35.0+', /v2\.(3[5-9]|[4-9]\d)\./.test(readmeZh) && /v2\.(3[5-9]|[4-9]\d)\./.test(readmeEn), true);
check('docs/architecture(.en).md 同步 v2.35.0+', archZh.includes('2.35.0') && archEn.includes('2.35.0'), true);
check('CHANGELOG.md 与 CHANGELOG.en.md 包含 v2.35.0 章节', changelogZh.includes('## v2.35.0 (2026-11-24)') && changelogEn.includes('## v2.35.0 (2026-11-24)'), true);
check('extractChangelogSection 精确提取 v2.35.0 章节', extractChangelogSection(changelogZh, '2.35.0').matchedExact, true);

// -----------------------------------------------------------------------------
// 2. v2.35.0 主进程模块同步、移除旧 HUD 与原生菜单映射校验
// -----------------------------------------------------------------------------
console.log('\n--- 2. v2.35.0 主进程模块同步与原生菜单校验 ---');
const distDir = path.join(ROOT, 'extracted', 'dist');
check(
  'extracted 同步 v2.35.0 新增的 4 个主进程模块',
  fs.existsSync(path.join(distDir, 'appChannel.js')) &&
    fs.existsSync(path.join(distDir, 'customWindowControls.js')) &&
    fs.existsSync(path.join(distDir, 'computer', 'idleProbe.js')) &&
    fs.existsSync(path.join(distDir, 'computer', 'permissionGuide.js')),
  true
);
check(
  'extracted 清理官方 v2.35.0 已移除的 hud*.js 遗留文件',
  !fs.existsSync(path.join(distDir, 'computer', 'hud.js')) &&
    !fs.existsSync(path.join(distDir, 'computer', 'hudAgents.js')) &&
    !fs.existsSync(path.join(distDir, 'computer', 'hudState.js')),
  true
);

const overlay = require(path.join(distDir, 'computer', 'overlay.js'));
check('v2.35.0 overlay.overlayLabel 保留 "unnamed" 协议字面量', overlay.overlayLabel(''), 'unnamed');
check('v2.35.0 overlay.overlayDisplayName 正确汉化', overlay.overlayDisplayName('unnamed'), '智能体：未命名');

const utilsJs = fs.readFileSync(path.join(distDir, 'utils.js'), 'utf-8');
const frameHookCount = (utilsJs.match(/did-frame-finish-load/g) || []).length;
check(
  'v2.35.0 dist/utils.js 保留 customWindowControls 且 plugin:// 子框架钩子严格幂等注入（恰好注册/卸载各 1 处）',
  utilsJs.includes('customWindowControls') &&
    frameHookCount === 2 &&
    utilsJs.includes('/^plugin:\\/\\//i'),
  true
);

const ipcJs = fs.readFileSync(path.join(distDir, 'ipcHandlers.js'), 'utf-8');
const menuJs = fs.readFileSync(path.join(distDir, 'menu.js'), 'utf-8');
check(
  'ipcHandlers.js 与 menu.js 包含 v2.35.0 新增原生菜单映射与状态后缀处理',
  ipcJs.includes("'Resolve': '标为已解决'") &&
    ipcJs.includes("'Return to Inbox': '移回收件箱'") &&
    ipcJs.includes("'Move to Project': '移动到项目'") &&
    ipcJs.includes("'Open with': '打开方式'") &&
    ipcJs.includes("'For My Team': '团队共享'") &&
    ipcJs.includes('Not running|Sidecar disabled') &&
    menuJs.includes("'Resolve': '标为已解决'") &&
    menuJs.includes("'Application Menu': '应用菜单'"),
  true
);

// -----------------------------------------------------------------------------
// 3. Web UI v2.35.0 静态词条与动态规则验收
// -----------------------------------------------------------------------------
console.log('\n--- 3. Web UI v2.35.0 新增静态词条与动态规则校验 ---');
const { translateString } = loadTranslatorSandbox();

const staticChecks = [
  // 收件箱模式与侧边栏
  ['Inbox', '收件箱'],
  ['Inbox Mode', '收件箱模式'],
  ['Working Section', '“正在工作”分组'],
  ['Keep running conversations in a separate Working section instead of in the Inbox.', '将正在运行的对话放在独立的“正在工作”分组中，而不是留在收件箱里。'],
  ['Auto-Resolve', '自动解决'],
  ['Move idle Inbox conversations to Resolved automatically after the selected time.', '在所选时间后自动将空闲的收件箱对话移至“已解决”。'],
  ['Resolve', '标为已解决'],
  ['Resolved', '已解决'],
  ['Return to Inbox', '移回收件箱'],
  ['All caught up', '已全部处理完毕'],
  ['Moved to Resolved.', '已移至“已解决”。'],
  ['Conversation resolved', '对话已标为已解决'],
  ['Returned conversation to Inbox', '已将对话移回收件箱'],
  ['Subtitle', '副标题'],
  ['Locked while grouped by Status', '按状态分组时已锁定'],
  ['Automatically pin conversations when you send a message. Unpin as needed to keep your Pinned list focused.', '发送消息时自动置顶对话。按需取消置顶以保持置顶列表精简聚焦。'],
  // 插件权限与扩展市场
  ['Changes plugins can make without asking.', '插件无需询问即可执行的更改。'],
  ['Allowed by you', '你已允许'],
  ["Nothing is always allowed. You'll be asked before this plugin makes changes.", '当前没有任何始终允许的权限。此插件在作出更改前会向你询问。'],
  ['Included with plugin', '插件自带'],
  ["These come with the plugin and can't be revoked.", '这些权限随插件附带，无法撤销。'],
  ['Any resource', '任意资源'],
  ['Always allowed', '始终允许'],
  ['Revoke all', '全部撤销'],
  ['From a plugin', '来自插件'],
  ['from a plugin', '来自插件'],
  ['Applied', '已应用'],
  ['Install this plugin to see the commands it adds, along with its skills, agents and MCP servers.', '安装此插件即可查看其添加的命令，以及包含的技能、智能体和 MCP 服务器。'],
  ['Failed to load bundle. Please try again.', '加载组合包失败，请重试。'],
  ['No MCP servers available.', '暂无可用的 MCP 服务器。'],
  ["Error starting sign-in: this host can't start it", '启动登录失败：当前主机无法发起登录'],
  // 语音听写多语言选择器
  ['Dictation languages', '听写语言'],
  ['Constrain voice dictation to selected languages in priority order. Leave empty to auto-detect.', '按优先级顺序将语音听写限制为所选语言。留空则自动检测。'],
  ['Reset to auto', '重置为自动'],
  ['Auto-detect (browser defaults)', '自动检测（浏览器默认）'],
  ['Search languages to add (e.g. English, Spanish, 中文, yue)...', '搜索要添加的语言（如 English、Spanish、中文、yue）...'],
  ['Click items to multi-select · Drag or ‹/› pills to reorder', '点击条目可多选 · 拖动或点击 ‹/› 按钮调整顺序'],
  ['#1 Primary', '#1 首选'],
  ['Chinese (Mandarin)', '汉语（普通话）'],
  ['Cantonese', '粤语'],
  ['English', '英语'],
  ['Japanese', '日语'],
  // 侧边提问升级、移动对话与打开方式
  ['Continue as a New Conversation', '作为新对话继续'],
  ['Continue as a new conversation', '作为新对话继续'],
  ['Continue in Current Workspace', '在当前工作区继续'],
  ['Continue in Shared Workspace', '在共享工作区继续'],
  ['Continue in New Workspace', '在新工作区继续'],
  ["Cannot continue a subagent's side question as a new conversation", '无法将子智能体的侧边提问作为新对话继续'],
  ['Cannot continue as a new conversation while side question is running', '侧边提问运行期间无法作为新对话继续'],
  ['Cannot continue as a new conversation during Battle Mode — end the battle first', '对决模式期间无法作为新对话继续 — 请先结束对决'],
  ['Move Conversation', '移动对话'],
  ['Move', '移动'],
  ['Move to Project', '移动到项目'],
  ['Move to Workspace', '移动到工作区'],
  ['Remove from Project', '从项目中移除'],
  ['Clone from Remote', '从远端克隆'],
  ['Clone from This Computer', '从本机克隆'],
  ['Clone locally', '克隆到本地'],
  ['Open with', '打开方式'],
  ['Text viewer', '文本查看器'],
  ['Image viewer', '图片查看器'],
  ['Video player', '视频播放器'],
  ['Audio player', '音频播放器'],
  ['HTML viewer', 'HTML 查看器'],
  ['Notebook viewer', 'Notebook 查看器'],
  ['PDF viewer', 'PDF 查看器'],
  ['Sidecar disabled', 'Sidecar 已禁用'],
  ['Not running', '未运行'],
  ['Application Menu', '应用菜单'],
  // 远程智能体与 Orchestrator
  ['For Me', '仅自己使用'],
  ['Personal agent running as you', '以你的身份运行的个人智能体'],
  ['For My Team', '团队共享'],
  ['Shared agent for your team', '面向团队的共享智能体'],
  ['No agents', '暂无智能体'],
  ['What should this agent accomplish?', '希望此智能体完成什么目标？'],
  ["Couldn't create the agent. Try again.", '无法创建智能体，请重试。'],
  ['Provisioning', '正在配置环境'],
  ['Updating', '正在更新'],
  ['Stalled', '已停滞'],
  ['No longer active', '已不再活跃'],
  ['Search by name or username', '按名称或用户名搜索'],
  ['No matching identities', '没有匹配的身份'],
  ['Default (Gemini Pro)', '默认（Gemini Pro）'],
  ['Default uses server-managed routing and Orchestrator quota. Custom pins specific models for orchestration and execution.', '“默认”使用服务端托管路由与 Orchestrator 配额；“自定义”可为编排与执行固定指定具体模型。'],
  ['Orchestrator model selection', 'Orchestrator 模型选择'],
  // Onboarding 引导、授权码与 WIF SSO
  ['Get Anything Done with', '轻松搞定一切，尽在'],
  ["Let's tailor the experience for you. What best describes your work?", '让我们为你量身定制体验。以下哪项最符合你的工作？'],
  ['Enter Google Cloud Project Details', '输入 Google Cloud 项目详情'],
  ['Google Cloud Project ID', 'Google Cloud 项目 ID'],
  ['Use Google Cloud project instead', '改用 Google Cloud 项目'],
  ['Having trouble signing in?', '登录遇到问题？'],
  ['Trouble signing in? Enter authorization code', '登录遇到问题？输入授权码'],
  ['Authorization code', '授权码'],
  ['Submit code', '提交授权码'],
  ['Sign in in your browser, then paste the authorization code shown on the callback page.', '请在浏览器中登录，然后粘贴回调页面上显示的授权码。'],
  ['Authorization code was rejected. Paste a fresh code and try again.', '授权码已被拒绝。请粘贴新的授权码后重试。'],
  ['Switched to authorization code sign-in', '已切换至授权码登录'],
  ['Copied sign-in link to clipboard', '已将登录链接复制到剪贴板'],
  ['WIF Config', 'WIF 配置'],
  ['Use this if your admin gave you a WIF config. Paste it below to sign in.', '如果管理员向你提供了 WIF 配置，请将其粘贴到下方以登录。'],
  ['Last Used', '上次使用'],
  ['Sorry, this account is ineligible to use', '抱歉，此账户无权使用'],
  ['Verify', '前往验证'],
  ['There was an unexpected issue setting up your account.', '设置账户时遇到意外问题。'],
  ['We apologize for the inconvenience. Please try again later.', '很抱歉带来不便，请稍后再试。'],
  // 权限决策、MCP 表单、排队、Google Drive 与 CEL
  ['Permission decision', '权限决策'],
  ['Yes, allow in this conversation', '是，在当前对话中允许'],
  ['Yes, always allow in this project', '是，在此项目中始终允许'],
  ['Yes, always allow', '是，始终允许'],
  ['Yes, allow for this task', '是，本次任务允许'],
  ['Waiting for approval to grant administrator access', '正在等待批准授予管理员权限'],
  ['Needs your approval', '需要你的批准'],
  ['Type your own answer', '输入你自己的回答'],
  ['Answered in chat', '已在对话中回答'],
  ['Dismissed', '已关闭'],
  ['Chosen', '已选择'],
  ['Required', '必填'],
  ['Loading messages', '正在加载消息'],
  ['Loading messages…', '正在加载消息…'],
  ['Loading newer messages', '正在加载更新的消息'],
  ['Loading newer messages…', '正在加载更新的消息…'],
  ['Searching older messages', '正在搜索更早的消息'],
  ['Failed to send queued message', '发送排队消息失败'],
  ['Queued message sent', '排队消息已发送'],
  ['Queued message loaded into editor', '排队消息已载入编辑器'],
  ['Agent finished. Queued messages send after background work finishes.', '智能体已完成。排队消息将在后台任务结束后发送。'],
  ["You don't have access to this Google Drive file, so its title couldn't be added. The link was kept as-is.", '你没有此 Google Drive 文件的访问权限，因此无法获取标题，已保留原链接。'],
  ["Timed out fetching the Google Drive file's title. The link was kept as-is.", '获取 Google Drive 文件标题超时，已保留原链接。'],
  ["Couldn't fetch the Google Drive file's title. The link was kept as-is.", '无法获取 Google Drive 文件标题，已保留原链接。'],
  ['Scrollable table', '可滚动表格'],
  ['Password prompt blocked to prevent a Chrome Password Alert reset.', '已拦截密码提示框，以防止触发 Chrome 密码警报重置。'],
  ['Self', '自身'],
  ['Self-watch target presets', '自身监听目标预设'],
  ["Matches this automation's active identity.", '匹配此自动化任务的当前活动身份。'],
  ['Invalid CEL', '无效的 CEL 表达式'],
  ['Needs Target', '缺少目标条件'],
  ['Incompatible event type', '不兼容的事件类型'],
  ['Missing required field', '缺少必填字段'],
  ['Include at least one positive', '至少包含一个正向条件'],
  ['Indexed CEL helper functions', '已建索引的 CEL 辅助函数'],
];

for (const [src, exp] of staticChecks) {
  check(`静态词条 "${src}"`, translateString(src), exp);
}

const dynamicChecks = [
  ['Resolved "Fix $100 bug"', '已解决“Fix $100 bug”'],
  ['Allowed in Project $1', '已在 Project $1 中允许'],
  ['Revoke all: File writes', '全部撤销：File writes'],
  ['Revoke: $& action', '撤销：$& action'],
  ['All 3 will be revoked. The plugin will ask before doing this again.', '全部 3 项将被撤销。下次执行此操作前插件将重新询问。'],
  ['Added Science Pack.', '已添加 Science Pack。'],
  ['Removed Science Pack.', '已移除 Science Pack。'],
  ['Error signing in to MCP server: timeout', '登录 MCP 服务器出错：timeout'],
  ['Error starting sign-in: invalid URL', '启动登录失败：invalid URL'],
  ['No matching languages for "klingon"', '未找到匹配“klingon”的语言'],
  ['Move this conversation to "My App $2"?', '确定将此对话移动到“My App $2”吗？'],
  ['Remove this conversation from its project?', '确定将此对话从所属项目中移除吗？'],
  ['Remove this conversation from its workspace?', '确定将此对话从所属工作区中移除吗？'],
  ['Text viewer (Not running)', '文本查看器（未运行）'],
  ['Notebook viewer (Sidecar disabled)', 'Notebook 查看器（Sidecar 已禁用）'],
  ['3 waiting on you', '3 项正在等待你处理'],
  ['Sorry, this account is ineligible to use Antigravity', '抱歉，此账户无权使用 Antigravity'],
  ['Further action is required to use Antigravity', '需要完成进一步操作才能使用 Antigravity'],
  ['Waiting for approval to write: /tmp/foo', '正在等待批准写入：/tmp/foo'],
  ['Waiting for approval to execute', '正在等待批准执行'],
  ['Wants to run: npm test', '请求运行：npm test'],
  ['Minimum length is 3', '最少需要 3 个字符'],
  ['Maximum length is 100', '最多允许 100 个字符'],
  ['Minimum value is -10.5', '最小值为 -10.5'],
  ['Maximum value is 99', '最大值为 99'],
  ['Select at least 2 items', '请至少选择 2 项'],
  ['Select at most 5 items', '最多选择 5 项'],
  ['Input must match ^[a-z]+$', '输入内容必须匹配 ^[a-z]+$'],
  ['Dismissed: Permission Check', '已关闭：Permission Check'],
  ['Dismiss: Permission Check', '关闭：Permission Check'],
  ['Forked from Main Task', '分叉自 Main Task'],
  ['Open URL in system browser: https://example.com', '在系统浏览器中打开链接：https://example.com'],
  ['Required to save: target filter', '执行“保存”所需的条件：target filter'],
  ['Self (author)', '自身（author）'],
  // PR #74 及其完整 Hzc 9 项权限动作家族（Allow / Save rule to always allow 全覆盖）
  ['Allow read access to this path?', '是否允许读取此路径？'],
  ['Allow write access to this path?', '是否允许写入此路径？'],
  ['Save rule to always allow read access to this path?', '保存规则以始终允许读取此路径？'],
  ['Save rule to always allow write access to this path?', '保存规则以始终允许写入此路径？'],
  ['Allow reading this URL?', '是否允许读取此 URL？'],
  ['Save rule to always allow reading this URL?', '保存规则以始终允许读取此 URL？'],
  ['Allow executing actions on this URL?', '是否允许在此 URL 上执行操作？'],
  ['Save rule to always allow executing actions on this URL?', '保存规则以始终允许在此 URL 上执行操作？'],
  ['Allow browser downloads from this site?', '是否允许浏览器从此站点下载文件？'],
  ['Save rule to always allow browser downloads from this site?', '保存规则以始终允许浏览器从此站点下载文件？'],
  ['Allow running $& custom cmd?', '是否允许 running $& custom cmd？'],
  ['Save rule to always allow running $1 cmd?', '保存规则以始终允许 running $1 cmd？'],
  // PR #77 及其官方完整 AI 点数 / 配额用尽 / 超额使用多变体家族
  [
    "You need at least 10 AI Credits to send messages. To continue using Gemini 3.1 Pro now, purchase more AI Credits. Your plan's baseline quota will refresh on 2026/11/25 12:00:00.",
    '发送消息至少需要 10 个 AI 点数。若要立即继续使用 Gemini 3.1 Pro，请购买更多 AI 点数。您当前方案的基础配额将于 2026/11/25 12:00:00 刷新。',
  ],
  [
    'You need more AI Credits to send messages. To continue using this model now, purchase more AI Credits.',
    '发送消息需要更多 AI 点数。若要立即继续使用此模型，请购买更多 AI 点数。',
  ],
  [
    "You need at least 5 AI Credits to send messages. To continue using Claude 4.5 Sonnet now, purchase more AI Credits. Your plan's baseline quota will refresh on Nov. 25, 2026, 2:30 p.m.. To continue using this model now, enable AI Credit overages.",
    '发送消息至少需要 5 个 AI 点数。若要立即继续使用 Claude 4.5 Sonnet，请购买更多 AI 点数。您当前方案的基础配额将于 Nov. 25, 2026, 2:30 p.m. 刷新。若要立即继续使用此模型，请开启 AI 点数超额使用。',
  ],
  [
    "Your plan's baseline quota will refresh on 11/25/2026, 8:00:00 AM. To continue using this model now, enable AI Credit overages.",
    '您当前方案的基础配额将于 11/25/2026, 8:00:00 AM 刷新。若要立即继续使用此模型，请开启 AI 点数超额使用。',
  ],
  [
    'To continue using this model now, enable AI Credit overages.',
    '若要立即继续使用此模型，请开启 AI 点数超额使用。',
  ],
  [
    'Your quota for Gemini 3.1 Pro will reset on 2026/11/25 12:00:00. Switch to another available model to continue.',
    'Gemini 3.1 Pro 的配额将于 2026/11/25 12:00:00 重置。请切换至其他可用模型以继续。',
  ],
  [
    'Your quota for this model has been reached. Switch to another available model to continue.',
    '此模型的配额已用尽。请切换至其他可用模型以继续。',
  ],
  [
    'Your quota for Model $& has been reached. Switch to another available model to continue.',
    'Model $& 的配额已用尽。请切换至其他可用模型以继续。',
  ],
  // PR #79 Hydrogen 推荐提示与模型下线日期（含 Sept / 序数词 / this model）
  [
    'Use Hydrogen for better quality with lower quota usage.',
    '使用 Hydrogen 可获得更好的质量，同时消耗更少配额。',
  ],
  [
    'Use Hydrogen for better quality with lower quota usage. Gemini 3.1 Pro is leaving on Nov 30, 2026.',
    '使用 Hydrogen 可获得更好的质量，同时消耗更少配额。Gemini 3.1 Pro 将于 2026 年 11 月 30 日 下线。',
  ],
  [
    'Use Hydrogen for better quality with lower quota usage. Leaving on Sept 1st, 2026.',
    '使用 Hydrogen 可获得更好的质量，同时消耗更少配额。此模型将于 2026 年 9 月 1 日 下线。',
  ],
  [
    'Leaving on Dec 15',
    '此模型将于 12 月 15 日 下线。',
  ],
  [
    'This model is leaving on Nov. 30, 2026.',
    '此模型将于 2026 年 11 月 30 日 下线。',
  ],
  [
    "You need at least 1,000 AI Credits to send messages. To continue using Gemini 3.1 Pro now, purchase more AI Credits. Your plan’s baseline quota will refresh on 2026/11/25 12:00:00.",
    '发送消息至少需要 1,000 个 AI 点数。若要立即继续使用 Gemini 3.1 Pro，请购买更多 AI 点数。您当前方案的基础配额将于 2026/11/25 12:00:00 刷新。',
  ],
  [
    'Your quota for Gemini 3.1 Pro will reset on Nov. 25, 2026, 2:30 p.m.. Switch to another available model to continue.',
    'Gemini 3.1 Pro 的配额将于 Nov. 25, 2026, 2:30 p.m. 重置。请切换至其他可用模型以继续。',
  ],
  [
    'Use Hydrogen for better quality with lower quota usage. Gemini 3.1 Pro will be removed on November 30, 2026.',
    '使用 Hydrogen 可获得更好的质量，同时消耗更少配额。Gemini 3.1 Pro 将于 2026 年 11 月 30 日移除。',
  ],
  [
    'Claude Sonnet 4.6 (Thinking) is leaving on Dec 1.',
    'Claude Sonnet 4.6 (Thinking) 将于 12 月 1 日 下线。',
  ],
];

for (const [src, exp] of dynamicChecks) {
  check(`动态规则 "${src}"`, translateString(src), exp);
  check(`动态规则幂等 "${exp}"`, translateString(exp), exp);
}

// PR #79 P1 防误伤回归测试：自然英文 leaving on 句子严禁被劫持为“下线”
const nonModelLeavingChecks = [
  'John is leaving on vacation.',
  'Leaving on Monday',
  'Flight leaving on time',
  'John is leaving on May 5.',
  'Flight 102 is leaving on May 5, 2026.',
  'Leaving on Nov 99',
];
for (const sample of nonModelLeavingChecks) {
  check(`防误伤保留原句 "${sample}"`, translateString(sample), sample);
}

// 品牌/模型/思考链原生保护
check('品牌名 Orchestrator 保持原生', translateString('Orchestrator'), 'Orchestrator');
check('品牌名 Swarm 保持原生', translateString('Swarm'), 'Swarm');
check('模型名 Gemini 4 Pro 保持原生', translateString('Gemini 4 Pro'), 'Gemini 4 Pro');

// -----------------------------------------------------------------------------
// 4. PR #76 安装安全门禁与 macOS 签名指引一致性校验
// -----------------------------------------------------------------------------
console.log('\n--- 4. PR #76 安装安全门禁与 macOS 签名指引一致性校验 ---');
const genReleaseSrc = fs.readFileSync(path.join(ROOT, 'release-assets', 'generate-release-assets.js'), 'utf-8');
check(
  'README.md / README.en.md 兼具版本强校验门禁、macOS 签名风险前置与可选重签排错命令',
  readmeZh.includes('Google 原始代码签名失效') &&
    readmeZh.includes('xattr -cr "/Applications/Antigravity.app"') &&
    readmeZh.includes('任一版本无法确认或不完全匹配') &&
    readmeEn.includes("Google's original code signature") &&
    readmeEn.includes('xattr -cr "/Applications/Antigravity.app"') &&
    readmeEn.includes('does not match exactly'),
  true
);
check(
  'generate-release-assets.js 发布说明同步版本严格匹配警示、macOS 官方恢复路径与可选重签提示',
  genReleaseSrc.includes('安装前请确认客户端版本完全一致') &&
    genReleaseSrc.includes('Google 官方完整安装包覆盖安装') &&
    genReleaseSrc.includes('xattr -cr "/Applications/Antigravity.app"'),
  true
);

// -----------------------------------------------------------------------------
// 5. Issue #73 批处理 CRLF 完整性、防闪退与无 Node.js 离线安全还原实机校验
// -----------------------------------------------------------------------------
console.log('\n--- 5. Issue #73 批处理防闪退与无 Node.js 离线一键安全还原校验 ---');
function countBareLf(buf) {
  let n = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0a && (i === 0 || buf[i - 1] !== 0x0d)) n++;
  }
  return n;
}
const launcherBatBuf = fs.readFileSync(path.join(ROOT, '双击运行汉化.bat'));
const updaterBatBuf = fs.readFileSync(path.join(ROOT, '一键更新汉化.bat'));
check('双击运行汉化.bat 保持严格 CRLF (0 裸 LF)', countBareLf(launcherBatBuf), 0);
check('一键更新汉化.bat 保持严格 CRLF (0 裸 LF)', countBareLf(updaterBatBuf), 0);

const updaterBatStr = updaterBatBuf.toString('utf-8');
check(
  '一键更新汉化.bat 已修复已汉化闪退并内置离线安全还原分支 (Issue #73)',
  updaterBatStr.includes('LEGACY_RESTORE_FLOW') &&
    updaterBatStr.includes('PS_ACTION=restore_precheck') &&
    updaterBatStr.includes('PS_ACTION=restore') &&
    updaterBatStr.includes('输入 R 并回车可安全还原官方英文原版'),
  true
);

if (process.platform === 'win32') {
  const os = require('os');
  const { spawnSync } = require('child_process');
  const { isLocalizedAsar } = require('../auto-restore');

  function buildTestAsar(version, localized) {
    const pkg = Buffer.from(JSON.stringify({ name: 'antigravity', version }), 'utf-8');
    const body = Buffer.from(localized ? '// Antigravity 2.0 Chinese Localization Engine\n' : '// clean official\n', 'utf-8');
    const headerObj = {
      files: {
        'package.json': { size: pkg.length, offset: '0' },
        dist: { files: { 'preload.js': { size: body.length, offset: String(pkg.length) } } },
      },
    };
    const headerJson = Buffer.from(JSON.stringify(headerObj), 'utf-8');
    const pad = (4 - (headerJson.length % 4)) % 4;
    const aligned = headerJson.length + pad;
    const pickle = 4 + aligned;
    const pre = Buffer.alloc(16);
    pre.writeUInt32LE(4, 0);
    pre.writeUInt32LE(pickle + 4, 4);
    pre.writeUInt32LE(pickle, 8);
    pre.writeUInt32LE(headerJson.length, 12);
    return Buffer.concat([pre, headerJson, Buffer.alloc(pad), pkg, body]);
  }

  function runOfflineBat(targetDir, extraEnv = {}, stdinText = '') {
    return spawnSync('cmd.exe', ['/d', '/c', path.join(ROOT, '一键更新汉化.bat')], {
      cwd: ROOT,
      input: stdinText,
      env: {
        SystemRoot: process.env.SystemRoot || 'C:\\Windows',
        ComSpec: process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
        PATH: 'C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\WindowsPowerShell\\v1.0',
        ANTIGRAVITY_FORCE_LEGACY: '1',
        ANTIGRAVITY_TARGET_DIR: targetDir,
        ANTIGRAVITY_SKIP_TASKKILL: '1',
        ANTIGRAVITY_NO_START: '1',
        ANTIGRAVITY_BATCH_NOPAUSE: '1',
        ...extraEnv,
      },
      timeout: 20000,
    });
  }

  // 场景 A: 已汉化 v2.35.0 + 同版纯净原版备份 => 离线安全还原成功
  const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-t56-i73-ok-'));
  try {
    const locBuf = buildTestAsar('2.35.0', true);
    const offBuf = buildTestAsar('2.35.0', false);
    fs.writeFileSync(path.join(tmpA, 'app.asar'), locBuf);
    fs.writeFileSync(path.join(tmpA, 'app.asar.bak'), offBuf);
    const rA = runOfflineBat(tmpA, { ANTIGRAVITY_OFFLINE_ACTION: 'restore' });
    check(
      'Windows 实机验证 (Issue #73-A): 无 Node.js 离线还原同版纯净备份成功且字节完全恢复',
      rA.status === 0 && !isLocalizedAsar(path.join(tmpA, 'app.asar')) && fs.readFileSync(path.join(tmpA, 'app.asar')).equals(offBuf),
      true
    );
  } finally {
    fs.rmSync(tmpA, { recursive: true, force: true });
  }

  // 场景 B: 已汉化 v2.35.0 + 跨版本旧备份 v2.34.0 => 严格拦截防白屏 (exit=2)
  const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-t56-i73-stale-'));
  try {
    const locBuf = buildTestAsar('2.35.0', true);
    const staleBak = buildTestAsar('2.34.0', false);
    fs.writeFileSync(path.join(tmpB, 'app.asar'), locBuf);
    fs.writeFileSync(path.join(tmpB, 'app.asar.bak'), staleBak);
    const rB = runOfflineBat(tmpB, { ANTIGRAVITY_OFFLINE_ACTION: 'restore' });
    check(
      'Windows 实机验证 (Issue #73-B): 跨版本旧备份被离线还原门禁严格拦截 (exit=2) 且原文件未改动',
      rB.status === 2 && fs.readFileSync(path.join(tmpB, 'app.asar')).equals(locBuf),
      true
    );
  } finally {
    fs.rmSync(tmpB, { recursive: true, force: true });
  }

  // 场景 C: 已汉化 v2.35.0 + 被汉化污染的备份 => 严格拦截 (exit=1)
  const tmpC = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-t56-i73-polluted-'));
  try {
    const locBuf = buildTestAsar('2.35.0', true);
    fs.writeFileSync(path.join(tmpC, 'app.asar'), locBuf);
    fs.writeFileSync(path.join(tmpC, 'app.asar.bak'), locBuf);
    const rC = runOfflineBat(tmpC, { ANTIGRAVITY_OFFLINE_ACTION: 'restore' });
    check(
      'Windows 实机验证 (Issue #73-C): 被汉化污染的备份被离线还原严格拦截 (exit=1)',
      rC.status === 1 && fs.readFileSync(path.join(tmpC, 'app.asar')).equals(locBuf),
      true
    );
  } finally {
    fs.rmSync(tmpC, { recursive: true, force: true });
  }
}

// -----------------------------------------------------------------------------
// 6. 实装产物 preload.js 与 wizardPreload.js 校验
// -----------------------------------------------------------------------------
console.log('\n--- 6. 实装产物 preload.js 与 wizardPreload.js 校验 ---');
const preloadJs = fs.readFileSync(path.join(distDir, 'preload.js'), 'utf-8');
const wizardPreloadJs = fs.readFileSync(path.join(distDir, 'ideInstall', 'wizardPreload.js'), 'utf-8');
check(
  'extracted preload.js 与 wizardPreload.js 已实装 v2.35.0 及 PR #77/#79 词条与动态规则',
  preloadJs.includes('收件箱模式') &&
    preloadJs.includes('听写语言') &&
    preloadJs.includes('确定将此对话移动到“') &&
    preloadJs.includes('请开启 AI 点数超额使用。') &&
    preloadJs.includes('MODEL_LEAVING_SUBJECT_RE') &&
    wizardPreloadJs.includes('收件箱模式') &&
    wizardPreloadJs.includes('WIF 配置') &&
    wizardPreloadJs.includes('请开启 AI 点数超额使用。'),
  true
);

console.log(`\n========== 测试完成: ${passed}/${total} 全部通过 ==========`);
if (passed !== total) {
  process.exit(1);
}
