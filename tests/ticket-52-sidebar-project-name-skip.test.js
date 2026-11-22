'use strict';

const assert = require('node:assert/strict');
const { loadTranslatorSandbox } = require('./helpers/translator-loader');

function matchesSimpleSelector(el, singleSel) {
  const s = singleSel.trim();
  if (!s) return false;
  const attrMatch = s.match(/^([a-zA-Z0-9_-]+)?\[([^=\]]+)(?:="([^"]*)")?\]$/);
  if (attrMatch) {
    const [, tag, attr, val] = attrMatch;
    if (tag && el.tagName !== tag.toUpperCase()) return false;
    if (!el.hasAttribute(attr)) return false;
    return val === undefined ? true : el.getAttribute(attr) === val;
  }
  if (s.startsWith('.')) {
    const rawCls = s.slice(1).replace(/\\\//g, '/');
    return el.classList.contains(rawCls);
  }
  return el.tagName === s.toUpperCase();
}

function createElement(tagName, attributes = {}, children = [], { withClosest = true } = {}) {
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
  if (withClosest) {
    node.matches = (selectorList) => String(selectorList)
      .split(',')
      .some((sel) => matchesSimpleSelector(node, sel));
    node.closest = (selectorList) => {
      let cur = node;
      while (cur && cur.nodeType === 1) {
        if (cur.matches(selectorList)) return cur;
        cur = cur.parentElement;
      }
      return null;
    };
  }
  for (const child of children) {
    child.parentElement = node;
  }
  return node;
}

function createText(value) {
  return { nodeType: 3, nodeValue: value, parentElement: null };
}

// 1. 左侧边栏项目标题卡片（完整属性：data-project-card="true" + data-testid="project-header"）
const devText = createText('Developer');
const devSpan = createElement('span', { title: 'Developer' }, [devText]);
const devHeader = createElement('button', {
  'data-project-card': 'true',
  'data-testid': 'project-header',
  title: 'Developer',
  'aria-label': 'Project',
}, [devSpan]);

// 2. 命中 isActionPill 特权词的项目名（Run / Done）
const runText = createText('Run');
const runSpan = createElement('span', {}, [runText]);
const runHeader = createElement('button', {
  'data-project-card': 'true',
  'data-testid': 'project-header',
}, [runSpan]);

// 3. 短词拼接（coreWords）项目名（Agent Tools）与仅带 data-project-card="true" 的按钮
const agentToolsText = createText('Agent Tools');
const cardOnlyHeader = createElement('button', {
  'data-project-card': 'true',
  title: 'Docs',
}, [createElement('span', {}, [agentToolsText])]);

// 4. 仅带 data-testid="project-header"（无 closest 方法，验证祖先遍历兜底分支）
const projectText = createText('Project');
const noClosestSpan = createElement('span', {}, [projectText], { withClosest: false });
const headerOnlyDiv = createElement('div', {
  'data-testid': 'project-header',
}, [noClosestSpan], { withClosest: false });

// 5. project-header 内部不应被 translateComposerLabel 穿透
const protectedVoiceInsideHeader = createElement('button', {
  'aria-label': 'Start Voice mode',
});
const headerWithAria = createElement('button', {
  'data-project-card': 'true',
  'data-testid': 'project-header',
  'aria-label': 'Message input',
}, [protectedVoiceInsideHeader]);

// 6. 同级侧边栏分区标题与项目行右侧兄弟按钮（应正常汉化）
const sectionHeadingText = createText('Projects');
const sectionHeading = createElement('div', {
  'data-sidebar-section-drop-id': 'main-section-header',
}, [createElement('span', {}, [sectionHeadingText])]);

const siblingActionText = createText('New Conversation');
const siblingActionBtn = createElement('button', {
  title: 'Settings',
}, [siblingActionText]);

const projectRowWrapper = createElement('div', {
  'data-sidebar-section-drop-id': 'file:///Users/demo/Developer',
  'data-index': '1',
}, [devHeader, siblingActionBtn]);

// 7. 复用同一 project-header 组件的系统内置分组标题（按状态 / 按环境 / 独立 / Unknown Project）：应正常汉化
function makeGroupRow(dropId, label, icon = 'custom') {
  const txt = createText(label);
  const span = createElement('span', {}, [txt]);
  const btn = createElement('button', {
    'data-project-card': 'true',
    'data-testid': 'project-header',
    'data-project-label': label,
    'data-project-icon': icon,
  }, [span]);
  const row = dropId
    ? createElement('div', { 'data-sidebar-section-drop-id': dropId }, [btn])
    : btn;
  return { row, btn, txt };
}

const sysBlocked = makeGroupRow('status-blocked', 'Blocked');
const sysInProgress = makeGroupRow('status-in-progress', 'In Progress');
const sysIdle = makeGroupRow('status-idle', 'Idle');
const sysLocal = makeGroupRow('location-local', 'This Computer');
const sysRemote = makeGroupRow('location-cloud', 'Remote');
const sysStandalone = makeGroupRow('standalone', 'Standalone', 'folder');
const sysUnknown = makeGroupRow('proj-unknown-id', 'Unknown Project', 'folder');
const sysDetachedCustom = makeGroupRow(null, 'This Computer', 'custom');

// 8. 与系统分组同名撞词的真实用户项目目录 & 用户自定义对话分组（convgroup:*）：必须严格跳过保护
const userFolderRemote = makeGroupRow('file:///Users/demo/Remote', 'Remote', 'folder');
const userFolderBlocked = makeGroupRow('file:///Users/demo/Blocked', 'Blocked', 'folder');
const userConvGroupRemote = makeGroupRow('convgroup:custom-1', 'Remote', 'custom');

const sidebarContainer = createElement('div', {
  'data-sidebar-scroll-container': 'true',
}, [
  sectionHeading,
  projectRowWrapper,
  runHeader,
  cardOnlyHeader,
  headerOnlyDiv,
  headerWithAria,
  sysBlocked.row,
  sysInProgress.row,
  sysIdle.row,
  sysLocal.row,
  sysRemote.row,
  sysStandalone.row,
  sysUnknown.row,
  sysDetachedCustom.row,
  userFolderRemote.row,
  userFolderBlocked.row,
  userConvGroupRemote.row,
]);

const body = createElement('body', {}, [sidebarContainer]);

let notifyObserver;
const { shouldSkipNode, translateNode } = loadTranslatorSandbox({
  document: { body, readyState: 'complete', addEventListener() {} },
  MutationObserver: class {
    constructor(callback) { notifyObserver = callback; }
    observe() {}
  },
});

// 验证 shouldSkipNode 精确判定
assert.equal(shouldSkipNode(devText), true, 'project-header 内文本应跳过');
assert.equal(shouldSkipNode(devHeader), true, 'project-header 按钮自身应跳过');
assert.equal(shouldSkipNode(runText), true, 'project-header 内命中 isActionPill 的 Run 仍应跳过');
assert.equal(shouldSkipNode(agentToolsText), true, 'button[data-project-card="true"] 内文本应跳过');
assert.equal(shouldSkipNode(projectText), true, '无 closest 环境下 data-testid="project-header" 祖先仍应跳过');
assert.equal(shouldSkipNode(sectionHeadingText), false, '侧边栏分区标题 Projects 不应跳过');
assert.equal(shouldSkipNode(siblingActionText), false, '项目行兄弟操作按钮不应跳过');

// 验证首屏扫描结果：项目名与属性全部保持原样，侧边栏 UI 控件正常汉化
assert.equal(devText.nodeValue, 'Developer');
assert.equal(devSpan.getAttribute('title'), 'Developer');
assert.equal(devHeader.getAttribute('title'), 'Developer');
assert.equal(devHeader.getAttribute('aria-label'), 'Project');
assert.equal(runText.nodeValue, 'Run');
assert.equal(agentToolsText.nodeValue, 'Agent Tools');
assert.equal(cardOnlyHeader.getAttribute('title'), 'Docs');
assert.equal(projectText.nodeValue, 'Project');
assert.equal(headerWithAria.getAttribute('aria-label'), 'Message input');
assert.equal(protectedVoiceInsideHeader.getAttribute('aria-label'), 'Start Voice mode');
assert.equal(sectionHeadingText.nodeValue, '项目');
assert.equal(siblingActionText.nodeValue, '新建对话');
assert.equal(siblingActionBtn.getAttribute('title'), '设置');

// 验证 MutationObserver 增量变更（characterData / attributes / childList）同样保护项目名
devText.nodeValue = 'Tools';
devHeader.setAttribute('title', 'Workspace');
devHeader.setAttribute('aria-label', 'Message input');
const dynamicNameText = createText('Docs');
const dynamicHeader = createElement('button', {
  'data-project-card': 'true',
  'data-testid': 'project-header',
  title: 'Tools',
}, [createElement('span', {}, [dynamicNameText])]);
sidebarContainer.childNodes.push(dynamicHeader);
dynamicHeader.parentElement = sidebarContainer;

notifyObserver([
  { type: 'characterData', target: devText },
  { type: 'attributes', target: devHeader, attributeName: 'title' },
  { type: 'attributes', target: devHeader, attributeName: 'aria-label' },
  { type: 'childList', addedNodes: [dynamicHeader] },
]);

assert.equal(devText.nodeValue, 'Tools');
assert.equal(devHeader.getAttribute('title'), 'Workspace');
assert.equal(devHeader.getAttribute('aria-label'), 'Message input');
assert.equal(dynamicNameText.nodeValue, 'Docs');
assert.equal(dynamicHeader.getAttribute('title'), 'Tools');

// 验证直接调用 translateNode 也不会误译动态项目卡片
translateNode(dynamicHeader);
assert.equal(dynamicNameText.nodeValue, 'Docs');
assert.equal(dynamicHeader.getAttribute('title'), 'Tools');

// 验证系统内置分组标题放行汉化，且不误伤同名用户目录或自定义对话分组
assert.equal(shouldSkipNode(sysBlocked.txt), false, 'status-blocked 系统分组应放行汉化');
assert.equal(shouldSkipNode(sysInProgress.txt), false, 'status-in-progress 系统分组应放行汉化');
assert.equal(shouldSkipNode(sysIdle.txt), false, 'status-idle 系统分组应放行汉化');
assert.equal(shouldSkipNode(sysLocal.txt), false, 'location-local 系统分组应放行汉化');
assert.equal(shouldSkipNode(sysRemote.txt), false, 'location-cloud 系统分组应放行汉化');
assert.equal(shouldSkipNode(sysStandalone.txt), false, 'standalone 系统分组应放行汉化');
assert.equal(shouldSkipNode(sysUnknown.txt), false, 'Unknown Project 占位应放行汉化');
assert.equal(shouldSkipNode(sysDetachedCustom.txt), false, '无外层 drop-id 时 custom 图标系统分组兜底应放行');

assert.equal(sysBlocked.txt.nodeValue, '已阻止');
assert.equal(sysInProgress.txt.nodeValue, '进行中');
assert.equal(sysIdle.txt.nodeValue, '空闲');
assert.equal(sysLocal.txt.nodeValue, '本机');
assert.equal(sysRemote.txt.nodeValue, '远程');
assert.equal(sysStandalone.txt.nodeValue, '独立');
assert.equal(sysUnknown.txt.nodeValue, '未知项目');
assert.equal(sysDetachedCustom.txt.nodeValue, '本机');

assert.equal(shouldSkipNode(userFolderRemote.txt), true, '名为 Remote 的真实用户项目目录必须跳过');
assert.equal(shouldSkipNode(userFolderBlocked.txt), true, '名为 Blocked 的真实用户项目目录必须跳过');
assert.equal(shouldSkipNode(userConvGroupRemote.txt), true, '名为 Remote 的用户自定义分组(convgroup:*)必须跳过');
assert.equal(userFolderRemote.txt.nodeValue, 'Remote');
assert.equal(userFolderBlocked.txt.nodeValue, 'Blocked');
assert.equal(userConvGroupRemote.txt.nodeValue, 'Remote');

console.log('PASS: 左侧项目栏项目标题卡片隔离与系统内置分组放行回归测试全部通过');
