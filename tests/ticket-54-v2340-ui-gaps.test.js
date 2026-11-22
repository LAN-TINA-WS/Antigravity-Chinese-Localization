'use strict';

const assert = require('node:assert/strict');
const { loadTranslatorSandbox } = require('./helpers/translator-loader');

const { translateString, translateNode } = loadTranslatorSandbox();

const staticCases = [
  // 组合包折叠与通用加载状态
  ['See more', '展开更多'],
  ['Loading...', '加载中...'],
  ['Loading…', '加载中…'],
  ['Loading logs...', '正在加载日志...'],
  ['Loading Browser recording...', '正在加载浏览器录制...'],
  ['Error loading Browser recording', '加载浏览器录制出错'],
  ['Launching the browser...', '正在启动浏览器...'],
  ['Resolving permissions...', '正在解析权限...'],
  ['This may take a few minutes', '这可能需要几分钟'],

  // 语音重登拆分节点、Windows 麦克风隐私设置与认证登录
  ['Your sign-in needs an update.', '你的登录状态需要更新。'],
  ['to use Voice.', '以使用语音功能。'],
  ['Microphone blocked. Allow in', '麦克风已被阻止，请前往'],
  ['Microphone blocked. Allow in Privacy Settings.', '麦克风已被阻止。请在隐私设置中允许访问。'],
  ['Microphone blocked. Allow in System Settings.', '麦克风已被阻止。请在系统设置中允许访问。'],
  ['Authentication Required', '需要身份验证'],
  ['Other sign-in options', '其他登录选项'],
  ['Finish signing in in your browser.', '请在浏览器中完成登录。'],
  ['Enable the plugin to sign in.', '请先启用此插件再登录。'],
  ['Business Account Sign In', '企业账户登录'],
  ['Use Advanced SSO Config', '使用高级 SSO 配置'],

  // 凭据安全与账户隐私声明（含同一 <p> 相邻兄弟句与下方方位修正）
  ['Credentials stay on this machine and are only sent to the domains listed.', '凭据仅保存在本机，且只会发送到下方列出的域名。'],
  ['Other credentials stay on this machine.', '其他凭据仅保存在本机。'],
  ['Credentials are only sent to the domains listed.', '凭据只会发送到下方列出的域名。'],
  ['Services this plugin connects to on your behalf.', '此插件将代表你连接以下服务。'],
  ['If you add multiple accounts, MCP servers use the one marked Default.', '如果你添加了多个账户，MCP 服务器将使用标有“默认”的账户。'],
  ['Enable this plugin to manage its accounts.', '启用此插件以管理其账户。'],
  ['API key', 'API 密钥'],
  ['Basic auth', '基本认证'],

  // 云环境 / 项目 / 更新 / Diff / 浏览器工具 / Computer Use（含更新与反馈相邻兄弟文案）
  [
    'A bash script run in your cloud environment after cloning repositories (or configure interactively in chat with /env-setup).',
    '在云端环境克隆代码仓库后自动运行的 Bash 脚本（也可在对话中使用 /env-setup 进行交互式配置）。',
  ],
  ['A new version is available.', '有新版本可用。'],
  ['To update:', '更新步骤：'],
  [
    'Go to the machine you are controlling and quit Antigravity. It installs pending updates the next time it starts.',
    '前往你正在控制的设备并退出 Antigravity。下次启动时它会自动安装待处理的更新。',
  ],
  ['Snooze for 24 Hours', '24 小时后提醒'],
  ['Code Change Summary', '代码变更摘要'],
  ['File Diff Comments', '文件差异评论'],
  ['Switch IDE Workspace', '切换 IDE 工作区'],
  ["This chat's environment is paused", '此对话的环境已暂停'],
  ['Start it again.', '重新启动。'],
  ['A project with this name already exists.', '已存在同名项目。'],
  ['Missing a repository? Configure on GitHub', '找不到代码仓库？前往 GitHub 配置'],
  ['Only Automations', '仅自动化任务'],
  ['Empty directory', '空目录'],
  ['Empty log', '空日志'],
  ['Failed to load image', '图片加载失败'],
  ['Failed to load shared conversation', '加载共享对话失败'],
  ['No content available for this resource', '此资源暂无可用内容'],
  ['No instances yet.', '暂无实例。'],
  ['Rendering playback', '正在渲染回放'],
  ['Playback available', '回放可用'],
  ['Error rendering playback', '渲染回放出错'],
  ['Read URL rejected', '读取 URL 被拒绝'],
  ['Page contents', '页面内容'],
  ['Open URL', '打开链接'],
  ['Multi-select', '多选'],
  ['Full output written to', '完整输出已写入'],
  ['Whether it never connects or is intermittent/flaky', '是一直无法连接，还是间歇性断开/不稳定'],
  ['Did restarting the desktop app help?', '重启桌面应用是否解决了问题？'],
  ['Allow again', '重新允许'],
  ['You took over — agent stopped', '你已接管 — 智能体已停止'],
  ['Site data cleared for', '已清除以下站点数据：'],
  ['Could not clear site data for', '无法清除以下站点数据：'],
];

const dynamicCases = [
  // JXb 单句、两句、三句真实 .join(" ") 拼接与 $ 特殊字符安全
  [
    'Sign-ins to GitHub, Slack are kept in the cloud with your account.',
    '登录到 GitHub, Slack 的凭据将随你的账户保存在云端。',
  ],
  [
    'Sign-ins to GitHub, Slack are kept in the cloud with your account. Credentials are only sent to the domains listed.',
    '登录到 GitHub, Slack 的凭据将随你的账户保存在云端。凭据只会发送到下方列出的域名。',
  ],
  [
    'Sign-ins to GitHub, Slack are kept in the cloud with your account. Other credentials stay on this machine. Credentials are only sent to the domains listed.',
    '登录到 GitHub, Slack 的凭据将随你的账户保存在云端。其他凭据仅保存在本机。凭据只会发送到下方列出的域名。',
  ],
  [
    'Sign-ins to $1 & $& Service are kept in the cloud with your account. Credentials are only sent to the domains listed.',
    '登录到 $1 & $& Service 的凭据将随你的账户保存在云端。凭据只会发送到下方列出的域名。',
  ],
  // 站点数据清除（成功态 + 失败态 + $ 字符安全）
  [
    'Site data cleared for github.com.',
    '已清除 github.com 的站点数据。',
  ],
  [
    'Could not clear site data for github.com.',
    '无法清除 github.com 的站点数据。',
  ],
  [
    'Could not clear site data for $&.example.com.',
    '无法清除 $&.example.com 的站点数据。',
  ],
];

for (const [english, chinese] of [...staticCases, ...dynamicCases]) {
  assert.equal(translateString(english), chinese, `translate:${english}`);
  assert.equal(translateString(chinese), chinese, `idempotent:${english}`);
}

// 真实 DOM 结构回归：React 三段文本节点 + settingsLink 按钮内联组合句
function makeText(val) {
  return { nodeType: 3, nodeValue: val, parentElement: null };
}
function makeEl(tag, children = []) {
  const el = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    childNodes: children,
    firstChild: children[0] || null,
    parentElement: null,
    getAttribute: () => null,
    hasAttribute: () => false,
    get textContent() {
      return this.childNodes.map(c => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join('');
    },
  };
  for (const c of children) c.parentElement = el;
  return el;
}

// 1) React <span>{"Site data cleared for "}{n.host}{"."}</span>
const clearedHostNode = makeText('github.com');
const clearedSpan = makeEl('span', [makeText('Site data cleared for '), clearedHostNode, makeText('.')]);
translateNode(clearedSpan);
assert.equal(clearedSpan.textContent, '已清除 github.com 的站点数据。');
assert.equal(clearedHostNode.nodeValue, 'github.com', '必须保持中间 host 文本节点原值与引用不变');
translateNode(clearedSpan);
assert.equal(clearedSpan.textContent, '已清除 github.com 的站点数据。', '二次扫描必须幂等');

// 2) React <span>{"Could not clear site data for "}{n.host}{"."}</span>
const failedHostNode = makeText('$&.example.com');
const failedSpan = makeEl('span', [makeText('Could not clear site data for '), failedHostNode, makeText('.')]);
translateNode(failedSpan);
assert.equal(failedSpan.textContent, '无法清除 $&.example.com 的站点数据。');
assert.equal(failedHostNode.nodeValue, '$&.example.com', '必须保持中间 host 文本节点原值与引用不变');
translateNode(failedSpan);
assert.equal(failedSpan.textContent, '无法清除 $&.example.com 的站点数据。', '二次扫描必须幂等');

// 3) React <span>{"Microphone blocked. Allow in "}<button>Privacy Settings</button>{"."}</span>
const micBtn = makeEl('button', [makeText('Privacy Settings')]);
const micSpan = makeEl('span', [makeText('Microphone blocked. Allow in '), micBtn, makeText('.')]);
translateNode(micSpan);
assert.equal(micSpan.textContent, '麦克风已被阻止。请在隐私设置中允许访问。');
assert.equal(micBtn.textContent, '隐私设置');

// 4) React <span>{"Your sign-in needs an update. "}<button>Sign in again</button>{" to use Voice."}</span>
const signInBtn = makeEl('button', [makeText('Sign in again')]);
const voiceSpan = makeEl('span', [makeText('Your sign-in needs an update. '), signInBtn, makeText(' to use Voice.')]);
translateNode(voiceSpan);
assert.equal(voiceSpan.textContent, '你的登录状态需要更新。请重新登录以使用语音功能。');
assert.equal(signInBtn.textContent, '重新登录');

console.log(`PASS: Ticket-54 (${staticCases.length} 静态词条 + ${dynamicCases.length} 动态与多句用例 + 4 组真实 React DOM 组合节点用例全部通过)`);
