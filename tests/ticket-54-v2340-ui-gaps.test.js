'use strict';

const assert = require('node:assert/strict');
const { loadTranslatorSandbox } = require('./helpers/translator-loader');

const { translateString } = loadTranslatorSandbox();

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

  // 凭据安全与账户隐私声明
  ['Credentials stay on this machine and are only sent to the domains listed.', '凭据仅保存在本机，且只会发送到上方列出的域名。'],
  ['Other credentials stay on this machine.', '其他凭据仅保存在本机。'],
  ['Credentials are only sent to the domains listed.', '凭据只会发送到上方列出的域名。'],
  ['API key', 'API 密钥'],
  ['Basic auth', '基本认证'],

  // 云环境 / 项目 / 更新 / Diff / 浏览器工具 / Computer Use
  [
    'A bash script run in your cloud environment after cloning repositories (or configure interactively in chat with /env-setup).',
    '在云端环境克隆代码仓库后自动运行的 Bash 脚本（也可在对话中使用 /env-setup 进行交互式配置）。',
  ],
  ['A new version is available.', '有新版本可用。'],
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
  ['Did restarting the desktop app help?', '重启桌面应用是否解决了问题？'],
  ['Allow again', '重新允许'],
  ['You took over — agent stopped', '您已接管 — 智能体已停止'],
  ['Could not clear site data for', '无法清除以下站点的浏览数据：'],
];

const dynamicCases = [
  [
    'Sign-ins to GitHub, Slack are kept in the cloud with your account.',
    '登录到 GitHub, Slack 的凭据将随您的账户保存在云端。',
  ],
  [
    'Sign-ins to $1 & $& Service are kept in the cloud with your account.',
    '登录到 $1 & $& Service 的凭据将随您的账户保存在云端。',
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

console.log(`PASS: Ticket-54 (${staticCases.length} 静态词条 + ${dynamicCases.length} 动态与 $ 安全用例全部通过且幂等)`);
