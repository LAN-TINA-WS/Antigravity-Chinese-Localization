'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const { loadTranslatorSandbox } = require('./helpers/translator-loader');

const repoRoot = path.resolve(__dirname, '..');
const ipcPath = path.join(repoRoot, 'extracted', 'dist', 'ipcHandlers.js');
const menuPath = path.join(repoRoot, 'extracted', 'dist', 'menu.js');

const ipcSource = fs.readFileSync(ipcPath, 'utf-8');
const menuSource = fs.readFileSync(menuPath, 'utf-8');

const ctxStart = ipcSource.indexOf('const contextMenuTranslationMap = {');
assert.notEqual(ctxStart, -1, 'extracted/dist/ipcHandlers.js 必须已注入 contextMenuTranslationMap');
const ctxBlock = ipcSource.slice(ctxStart);
const ctxSandbox = {};
vm.runInNewContext(ctxBlock, ctxSandbox);
assert.equal(typeof ctxSandbox.translateContextLabel, 'function', 'ipcHandlers.js 必须导出 translateContextLabel');

const menuStart = menuSource.indexOf('const menuTranslationMap = {');
assert.notEqual(menuStart, -1, 'extracted/dist/menu.js 必须已注入 menuTranslationMap');
const menuBlock = menuSource.slice(menuStart);
const menuSandbox = {};
vm.runInNewContext(menuBlock, menuSandbox);
assert.equal(typeof menuSandbox.translateMenu, 'function', 'menu.js 必须导出 translateMenu');

const expectedPairs = [
  // 右侧文件/图片预览栏原生右键菜单（完整 6 项 + 内容复制）
  ['Copy', '复制'],
  ['Copy Image', '复制图片'],
  ['Save Image', '保存图片'],
  ['Copy File Path', '复制文件路径'],
  ['Copy File Name', '复制文件名'],
  ['Add to Chat', '添加到对话'],
  ['Copy Content', '复制内容'],
  // 插件侧栏、智能体气泡、分组排序与发送按钮原生右键菜单
  ['Hide', '隐藏'],
  ['Reply', '回复'],
  ['Manual Order', '手动排序'],
  ['Send Message', '发送消息'],
  ['Queue Message', '排队发送消息'],
  ['Send Immediately', '立即发送'],
];

for (const [en, zh] of expectedPairs) {
  assert.equal(
    ctxSandbox.translateContextLabel(en),
    zh,
    `ipcHandlers translateContextLabel("${en}") 应译为 "${zh}"`
  );
  const menuItem = { label: en };
  menuSandbox.translateMenu(menuItem);
  assert.equal(
    menuItem.label,
    zh,
    `menu translateMenu("${en}") 应译为 "${zh}"`
  );
}

// 确认带前后空格的右键菜单 label 也能正确命中
assert.equal(ctxSandbox.translateContextLabel('  Copy File Path  '), '复制文件路径');
assert.equal(ctxSandbox.translateContextLabel('  Copy File Name  '), '复制文件名');

// 确认未知自定义文本（如用户自定义分组名）保持原样不被误翻
assert.equal(ctxSandbox.translateContextLabel('MyCustomWorkspace'), 'MyCustomWorkspace');

// 发送按钮带快捷键后缀的悬浮提示（Enter / Ctrl+Enter / ⏎ / ⌘⏎ / Alt+Enter / ⌥⏎）
const { translateString, translateNode } = loadTranslatorSandbox();
const sendTooltipCases = [
  ['Send Message Enter', '发送消息 Enter'],
  ['Send Message Ctrl+Enter', '发送消息 Ctrl+Enter'],
  ['Send Message ⏎', '发送消息 ⏎'],
  ['Send Message ⌘⏎', '发送消息 ⌘⏎'],
  ['Queue Message Enter', '排队发送消息 Enter'],
  ['Queue Message Ctrl+Enter', '排队发送消息 Ctrl+Enter'],
  ['Queue Message (Alt+Enter)', '排队发送消息 (Alt+Enter)'],
  ['Send Immediately (Alt+Enter)', '立即发送 (Alt+Enter)'],
  ['Send Immediately (⌥⏎)', '立即发送 (⌥⏎)'],
];
for (const [en, zh] of sendTooltipCases) {
  assert.equal(translateString(en), zh, `send tooltip: ${en}`);
  assert.equal(translateString(zh), zh, `send tooltip idempotent: ${en}`);
}

// 云工作区文件与资源弹窗副标题、横幅、项目设置副标题及底部 4 链接免责声明 DOM 组合句测试
const cloudModalStaticCases = [
  [
    "Here's how uploaded files, attachments, and connected resources work in your cloud environment",
    '以下介绍上传的文件、附件以及已连接的资源在你的云环境中的工作方式',
  ],
  [
    'Uploaded files and connected resources are mounted in your cloud environment.',
    '上传的文件和已连接的资源将挂载到你的云环境中。',
  ],
  ['Manage project resources and settings', '管理项目资源和设置'],
  ['Manage project resources and settings.', '管理项目资源和设置。'],
  ['Manage workspace resources and settings', '管理工作区资源和设置'],
];
for (const [en, zh] of cloudModalStaticCases) {
  assert.equal(translateString(en), zh, `cloud modal: ${en}`);
  assert.equal(translateString(zh), zh, `cloud modal idempotent: ${en}`);
}

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

const aRights = makeEl('a', [makeText('necessary rights')]);
const aProhibited = makeEl('a', [makeText('Prohibited Use Policy')]);
const aTerms = makeEl('a', [makeText('Google Antigravity Terms of Service')]);
const aPrivacy = makeEl('a', [makeText('Google Privacy Policy')]);
const termsPara = makeEl('p', [
  makeText('Avoid uploading highly sensitive data and verify actions taken by your agent. Make sure you have the'),
  makeText(' '),
  aRights,
  makeText(' '),
  makeText("to any content or files that you upload, including content of minors. Don't generate content that infringes on others' rights, including content that deceives, harasses, or harms. When using Antigravity, you must comply with Google's"),
  makeText(' '),
  aProhibited,
  makeText('. Your use is subject to the'),
  makeText(' '),
  aTerms,
  makeText(' '),
  makeText('and'),
  makeText(' '),
  aPrivacy,
  makeText('.'),
]);

translateNode(termsPara);
const expectedTermsText =
  '请勿上传高度敏感的数据，并核实你的智能体所执行的操作。请确保你对你上传的任何内容或文件（包括涉及未成年人的内容）拥有必要权利。请勿生成侵犯他人权利的内容，包括具有欺骗性、骚扰性或危害性的内容。使用 Antigravity 时，你必须遵守 Google 的禁止使用政策。你的使用行为须遵守 Google Antigravity 服务条款和 Google 隐私权政策。';
assert.equal(termsPara.textContent, expectedTermsText, '底部 4 链接免责声明应完整流畅译出');
assert.equal(aRights.textContent, '必要权利', '超链接 1 文本应原位汉化且不破坏 <a> 节点');
assert.equal(aProhibited.textContent, '禁止使用政策', '超链接 2 文本应原位汉化且不破坏 <a> 节点');
assert.equal(aTerms.textContent, 'Google Antigravity 服务条款', '超链接 3 文本应原位汉化且不破坏 <a> 节点');
assert.equal(aPrivacy.textContent, 'Google 隐私权政策', '超链接 4 文本应原位汉化且不破坏 <a> 节点');
translateNode(termsPara);
assert.equal(termsPara.textContent, expectedTermsText, '底部 4 链接免责声明二次扫描必须幂等');

console.log(`PASS: 右侧预览栏、原生右键菜单、发送按钮快捷键提示与云工作区免责声明回归测试全部通过`);
