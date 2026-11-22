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

const sidebarContainer = createElement('div', {
  'data-sidebar-scroll-container': 'true',
}, [sectionHeading, projectRowWrapper, runHeader, cardOnlyHeader, headerOnlyDiv, headerWithAria]);

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

console.log('PASS: 左侧项目栏项目标题卡片隔离与侧边栏 UI 正常汉化回归测试全部通过');
