'use strict';

const assert = require('node:assert/strict');
const { loadTranslatorSandbox } = require('./helpers/translator-loader');

function createElement(tagName, attributes = {}, children = []) {
  const attrs = { ...attributes };
  const classes = String(attrs.class || '').split(/\s+/).filter(Boolean);
  const node = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    className: attrs.class || '',
    classList: { contains: (name) => classes.includes(name) },
    childNodes: children,
    firstChild: children[0] ?? null,
    parentElement: null,
    hasAttribute: (name) => Object.hasOwn(attrs, name),
    getAttribute: (name) => (Object.hasOwn(attrs, name) ? attrs[name] : null),
    setAttribute: (name, value) => { attrs[name] = value; },
    get textContent() {
      return this.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join('');
    },
  };
  for (const child of children) {
    child.parentElement = node;
  }
  return node;
}

function createText(value) {
  return { nodeType: 3, nodeValue: value, parentElement: null };
}

console.log('=== 开始 Ticket-62 新建项目/SSH 主机悬浮提示与项目选择器补漏专项测试 ===\n');

const { translateString, translateNode } = loadTranslatorSandbox();

const cases = [
  [
    "Create a project on a machine you reach over SSH. It opens in that host's own window.",
    '在通过 SSH 连接的远程主机上创建项目，并将在该主机的独立窗口中打开。',
  ],
  [
    'Create a project on this computer or remotely.',
    '在本机或远程创建项目。',
  ],
  [
    'Create a new Piper (g4) workspace from your initial prompt. Customize in General Settings, under Advanced.',
    '根据初始提示词创建新的 Piper (g4) 工作区。可在通用设置的“高级”中自定义。',
  ],
  [
    'Create a new JJ workspace from your initial prompt. Customize in General Settings, under Advanced.',
    '根据初始提示词创建新的 JJ 工作区。可在通用设置的“高级”中自定义。',
  ],
  [
    'Create a new Cog (GoB) workspace from your initial prompt. Customize in General Settings, under Advanced.',
    '根据初始提示词创建新的 Cog (GoB) 工作区。可在通用设置的“高级”中自定义。',
  ],
  [
    'Create a new Fig workspace from your initial prompt. Customize in General Settings, under Advanced.',
    '根据初始提示词创建新的 Fig 工作区。可在通用设置的“高级”中自定义。',
  ],
  ['Runs on this machine', '在本机运行'],
  ['Runs in a cloud environment', '在云端环境中运行'],
  ['Search Hosts…', '搜索主机…'],
  ['Search Hosts...', '搜索主机...'],
  ['No matching hosts', '没有匹配的主机'],
  ['No hosts in ~/.ssh/config yet', '~/.ssh/config 中尚无主机'],
  ['Loading Repositories…', '正在加载代码仓库…'],
  ['Loading Repositories...', '正在加载代码仓库...'],
  ['Open in Remote', '在远程打开'],
  ['Cloning locally…', '正在克隆到本地…'],
  ['Cloning locally...', '正在克隆到本地...'],
  [
    'Google3 projects are being deprecated. Select a CitC workspace instead.',
    'Google3 项目即将弃用，请改选 CitC 工作区。',
  ],
  ['No matching projects', '没有匹配的项目'],
  ['No matching workspaces', '没有匹配的工作区'],
  ['No remote projects', '暂无远程项目'],
  ['No remote workspaces', '暂无远程工作区'],
  ['No projects found', '未找到项目'],
];

for (const [src, expected] of cases) {
  const actual = translateString(src);
  assert.equal(actual, expected, `词条 "${src}" 翻译不匹配`);
  assert.equal(translateString(actual), expected, `词条 "${src}" 翻译应保持幂等`);
}

// DOM 场景校验：悬浮 tooltip、title 属性、搜索框 placeholder 与位置选择器副标题
const sshTooltipText = createText("Create a project on a machine you reach over SSH. It opens in that host's own window.");
const sshTooltip = createElement('div', { role: 'tooltip' }, [sshTooltipText]);

const connectSshText = createText('Connect to SSH Host…');
const connectSshSpan = createElement('span', {
  class: 'truncate flex-1 min-w-0',
  title: "Create a project on a machine you reach over SSH. It opens in that host's own window.",
}, [connectSshText]);

const searchHostsInput = createElement('input', {
  'data-testid': 'project-selector-ssh-host-search',
  placeholder: 'Search Hosts…',
});

const localDescText = createText('Runs on this machine');
const cloudDescText = createText('Runs in a cloud environment');
const container = createElement('div', {}, [
  sshTooltip,
  connectSshSpan,
  searchHostsInput,
  createElement('span', {}, [localDescText]),
  createElement('span', {}, [cloudDescText]),
]);

translateNode(container);

assert.equal(
  sshTooltipText.nodeValue,
  '在通过 SSH 连接的远程主机上创建项目，并将在该主机的独立窗口中打开。',
  'SSH 主机悬浮提示文本应完整汉化'
);
assert.equal(
  connectSshSpan.getAttribute('title'),
  '在通过 SSH 连接的远程主机上创建项目，并将在该主机的独立窗口中打开。',
  'Connect to SSH Host… 的 title 属性应完整汉化'
);
assert.equal(connectSshText.nodeValue, '连接到 SSH 主机…');
assert.equal(searchHostsInput.getAttribute('placeholder'), '搜索主机…', 'SSH 主机搜索框 placeholder 应汉化');
assert.equal(localDescText.nodeValue, '在本机运行', '位置选择器本机副标题不得出现半中半英残片');
assert.equal(cloudDescText.nodeValue, '在云端环境中运行', '位置选择器远程副标题应完整汉化');

console.log(`PASS: Ticket-62 新建项目/SSH 主机悬浮提示与项目选择器补漏测试全部通过 (${cases.length} 条词条 + DOM 场景)`);
