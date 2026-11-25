'use strict';

const assert = require('node:assert/strict');
const { loadTranslatorSandbox } = require('./helpers/translator-loader');

console.log('=== 开始 Ticket-58 AI 聊天正文与 Markdown/行内代码隔离专项测试 ===\n');

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
    appendChild(child) {
      child.parentElement = this;
      this.childNodes.push(child);
      if (!this.firstChild) this.firstChild = child;
      return child;
    },
  };
  if (withClosest) {
    node.matches = (selectorList) => String(selectorList)
      .split(',')
      .some((sel) => matchesSimpleSelector(node, sel));
    node.closest = (selectorList) => {
      let cur = node;
      while (cur && cur.nodeType === 1) {
        if (cur.matches && cur.matches(selectorList)) return cur;
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

// 1. 构造完整聊天消息、侧边提问、预览区及 Toast/NUX 场景 DOM
const plainLogText = createText('log');
const boldLogText = createText('log');
const inlineCodeLogText = createText('log');
const nestedCodePillText = createText('Done');
const nestedKbdText = createText('End');
const emSettingsText = createText('Settings');
const headingOverviewText = createText('Overview');
const listModelsText = createText('Models');
const tableHistoryText = createText('History');
const boldDoneText = createText('Done');
const pWorkingText = createText('Working');
const stepRegexText = createText('Step 1 of 3');
const ariaTextboxInMd = createElement('div', { role: 'textbox', 'aria-label': 'Message input' });
const streamTargetText = createText('l');

const markdownRootInChat = createElement('div', { 'data-markdown-root': '' }, [
  createElement('p', {}, [plainLogText]),
  createElement('p', {}, [createText('常简写为 '), createElement('strong', {}, [boldLogText]), createText('。')]),
  createElement('p', {}, [createElement('code', { dir: 'ltr' }, [inlineCodeLogText])]),
  createElement('code', {}, [createElement('span', {}, [nestedCodePillText])]),
  createElement('kbd', {}, [createElement('span', {}, [nestedKbdText])]),
  createElement('em', {}, [emSettingsText]),
  createElement('h2', {}, [headingOverviewText]),
  createElement('ul', {}, [createElement('li', {}, [listModelsText])]),
  createElement('table', {}, [createElement('tr', {}, [createElement('td', {}, [tableHistoryText])])]),
  createElement('strong', {}, [boldDoneText]),
  createElement('p', {}, [pWorkingText]),
  createElement('p', {}, [stepRegexText]),
  createElement('p', {}, [streamTargetText]),
  ariaTextboxInMd,
]);

// 嵌套在普通 step 包装层内、易触发 collectSafeLeafTextNodes 空状态规则的 Markdown 段落
const emptyLikeMdText = createText('No conversations yet.');
const stepWrapperWithEmptyLikeMd = createElement('div', { class: 'px-2 py-1' }, [
  createElement('div', { 'data-markdown-root': '' }, [
    createElement('p', {}, [emptyLikeMdText]),
  ]),
]);

// 同一 agent-response 内的系统 UI 控件（必须正常汉化）
const thinkingTriggerText = createText('Thought for 4s');
const thinkingTriggerBtn = createElement('button', { 'data-testid': 'thinking-collapsible-trigger' }, [
  createElement('span', {}, [thinkingTriggerText]),
]);
const toolPillText = createText('Ran command');
const toolDonePillText = createText('Done');
const toolStepRow = createElement('div', { class: 'step-row' }, [
  createElement('span', {}, [toolPillText]),
  createElement('span', {}, [toolDonePillText]),
]);
const toolbarCopyBtn = createElement('button', { 'aria-label': 'Copy' }, []);
const toolbarGoodTip = createElement('span', {}, [createText('Good Response')]);
const toolbarBadTip = createElement('span', {}, [createText('Bad Response')]);
const agentToolbar = createElement('div', { 'data-testid': 'cascade-system-message-toolbar' }, [
  toolbarCopyBtn,
  toolbarGoodTip,
  toolbarBadTip,
]);

const agentResponse = createElement('div', { 'data-testid': 'agent-response' }, [
  thinkingTriggerBtn,
  toolStepRow,
  createElement('div', { 'data-bubble-side': 'agent' }, [markdownRootInChat]),
  stepWrapperWithEmptyLikeMd,
  agentToolbar,
]);

// 2. Side Question 侧边提问回复（Thinking... 放行，Markdown 正文跳过）
const sideQuestionThinkingText = createText('Thinking...');
const sideQuestionReplyLog = createText('log');
const sideQuestionReplySettings = createText('Settings');
const sideQuestionAnswer = createElement('div', { 'data-testid': 'side-question-answer' }, [
  createElement('span', { class: 'opacity-70 animate-pulse' }, [sideQuestionThinkingText]),
  createElement('div', { 'data-markdown-root': '' }, [
    createElement('p', {}, [sideQuestionReplyLog]),
    createElement('strong', {}, [sideQuestionReplySettings]),
  ]),
]);

// 3. 代码块预览与自动化指令 Markdown（无 closest 环境兼容校验）
const codePreviewText = createText('Settings');
const codeBlockPreview = createElement('div', { 'data-testid': 'markdown-code-block-preview' }, [
  createElement('p', {}, [codePreviewText], { withClosest: false }),
], { withClosest: false });

const autoInstText = createText('log');
const autoInstShowAllText = createText('Show all');
const automationBlock = createElement('div', { 'data-testid': 'automation-instructions-text' }, [
  createElement('div', { 'data-testid': 'automation-instructions-markdown' }, [
    createElement('p', {}, [autoInstText]),
  ]),
  createElement('button', {}, [autoInstShowAllText]),
]);

// 4. Toast 与 NUX 白名单：外层 UI 提示文案必须正常汉化，但内嵌 <code> 不可改写
const toastArchivePrefix = createText('View archived in the sidebar (');
const toastArchiveSuffix = createText(' menu).');
const toastInlineCodeText = createText('log');
const toastCombinedCodeText = createText('0 of 1');
const toastNotification = createElement('div', { 'data-testid': 'toast-notification' }, [
  createElement('div', { 'data-markdown-root': '' }, [
    createElement('p', {}, [
      toastArchivePrefix,
      createElement('svg', {}, []),
      toastArchiveSuffix,
    ]),
    createElement('p', {}, [
      createText('Use '),
      createElement('code', {}, [toastInlineCodeText]),
      createText(' here'),
    ]),
    createElement('p', {}, [
      createElement('code', {}, [toastCombinedCodeText]),
      createText(' tasks done'),
    ]),
  ]),
]);

const nuxBodyText = createText('Settings');
const nuxCard = createElement('div', { 'data-testid': 'nux-card' }, [
  createElement('div', { 'data-markdown-root': '' }, [
    createElement('p', {}, [nuxBodyText], { withClosest: false }),
  ], { withClosest: false }),
], { withClosest: false });

// 5. 模拟 getAttribute 返回 '' || null 的极简 Mock 容器（贴近 ticket-40 makeMockEl 写法）
const emptyAttrLogText = createText('log');
const emptyAttrMdRoot = {
  nodeType: 1,
  tagName: 'DIV',
  className: '',
  classList: { contains: () => false },
  childNodes: [],
  parentElement: null,
  hasAttribute: (k) => k === 'data-markdown-root',
  getAttribute: () => null,
};
const emptyAttrParagraph = createElement('p', {}, [emptyAttrLogText]);
emptyAttrParagraph.parentElement = emptyAttrMdRoot;
emptyAttrMdRoot.childNodes = [emptyAttrParagraph];

const body = createElement('body', {}, [
  agentResponse,
  sideQuestionAnswer,
  codeBlockPreview,
  automationBlock,
  toastNotification,
  nuxCard,
  emptyAttrMdRoot,
]);

let notifyObserver;
const { translateString, shouldSkipNode, translateNode, tryCombinedSentenceTranslation } = loadTranslatorSandbox({
  document: { body, readyState: 'complete', addEventListener() {} },
  MutationObserver: class {
    constructor(callback) { notifyObserver = callback; }
    observe() {}
  },
});

// 断言 1：translateString 对独立纯小写 "log" 的防御纵深，以及多词组合与 "Logs" 兼容
assert.equal(translateString('log'), 'log', '独立纯小写 log 应保持原样');
assert.equal(translateString('Error Log'), '错误日志', '多词组合 Error Log 应正常组合译出');
assert.equal(translateString('Logs'), '日志', '词典显式收录的 Logs 应正常译出');

// 断言 2：shouldSkipNode 判定边界
assert.equal(shouldSkipNode(plainLogText), true, 'AI 回复正文 <p>log</p> 应跳过');
assert.equal(shouldSkipNode(boldLogText), true, 'AI 回复正文 <strong>log</strong> 应跳过');
assert.equal(shouldSkipNode(boldDoneText), true, 'AI 回复正文 <strong>Done</strong> 不应被 isActionPill 放行');
assert.equal(shouldSkipNode(pWorkingText), true, 'AI 回复正文 <p>Working</p> 不应被 isActionPill 放行');
assert.equal(shouldSkipNode(nestedCodePillText), true, '<code><span>Done</span></code> 嵌套子节点应跳过');
assert.equal(shouldSkipNode(nestedKbdText), true, '<kbd><span>End</span></kbd> 嵌套子节点应跳过');
assert.equal(shouldSkipNode(emptyAttrLogText), true, 'hasAttribute mock 下 data-markdown-root 应跳过');
assert.equal(shouldSkipNode(thinkingTriggerText), false, 'thinking-collapsible-trigger 按钮必须放行');
assert.equal(shouldSkipNode(toolPillText), false, 'AI 回复外的工具状态药丸 Ran command 必须放行');
assert.equal(shouldSkipNode(toastArchivePrefix), false, 'toast-notification 内的 Markdown 文案必须放行');
assert.equal(shouldSkipNode(toastInlineCodeText), true, 'toast-notification 内的 <code>log</code> 仍必须跳过');
assert.equal(shouldSkipNode(nuxBodyText), false, '无 closest 环境下 nux-card 内的 Markdown 文案必须放行');

// 断言 3：首屏扫描后的实际 DOM 文本结果
assert.equal(plainLogText.nodeValue, 'log');
assert.equal(boldLogText.nodeValue, 'log');
assert.equal(inlineCodeLogText.nodeValue, 'log');
assert.equal(nestedCodePillText.nodeValue, 'Done');
assert.equal(nestedKbdText.nodeValue, 'End');
assert.equal(emSettingsText.nodeValue, 'Settings');
assert.equal(headingOverviewText.nodeValue, 'Overview');
assert.equal(listModelsText.nodeValue, 'Models');
assert.equal(tableHistoryText.nodeValue, 'History');
assert.equal(boldDoneText.nodeValue, 'Done');
assert.equal(pWorkingText.nodeValue, 'Working');
assert.equal(stepRegexText.nodeValue, 'Step 1 of 3');
assert.equal(emptyLikeMdText.nodeValue, 'No conversations yet.', 'collectSafeLeafTextNodes 不得穿透 data-markdown-root');
assert.equal(ariaTextboxInMd.getAttribute('aria-label'), 'Message input', 'Markdown 正文内的控件属性不得被修改');

// 同区 UI 控件正常汉化
assert.equal(thinkingTriggerText.nodeValue, '思考了 4s');
assert.equal(toolPillText.nodeValue, '已运行命令');
assert.equal(toolDonePillText.nodeValue, '已完成');
assert.equal(toolbarCopyBtn.getAttribute('aria-label'), '复制');
assert.equal(toolbarGoodTip.firstChild.nodeValue, '好评回复');
assert.equal(toolbarBadTip.firstChild.nodeValue, '差评回复');

// Side Question / Preview / Automation
assert.equal(sideQuestionThinkingText.nodeValue, '思考中...');
assert.equal(sideQuestionReplyLog.nodeValue, 'log');
assert.equal(sideQuestionReplySettings.nodeValue, 'Settings');
assert.equal(codePreviewText.nodeValue, 'Settings');
assert.equal(autoInstText.nodeValue, 'log');
assert.equal(autoInstShowAllText.nodeValue, '显示全部');

// Toast & NUX 正常汉化且不破坏内嵌 <code>
assert.equal(toastArchivePrefix.nodeValue, '已归档内容可在侧边栏（');
assert.equal(toastArchiveSuffix.nodeValue, ' 菜单）中查看。');
assert.equal(toastInlineCodeText.nodeValue, 'log');
assert.equal(toastCombinedCodeText.nodeValue, '0 of 1', 'tryCombinedSentenceTranslation 不得改写 <code> 内锚点');
assert.equal(nuxBodyText.nodeValue, '设置');

// 断言 4：tryCombinedSentenceTranslation 直接调用回归测试（保护 <code> 等受保护内联锚点）
const combinedCode = createElement('code', {}, [createText('0 of 1')]);
const combinedP = createElement('p', {}, [combinedCode, createText(' tasks done')]);
tryCombinedSentenceTranslation(combinedP);
assert.equal(combinedCode.firstChild.nodeValue, '0 of 1', '直接调用 tryCombinedSentenceTranslation 不得修改 <code> 子文本');

// 断言 5：MutationObserver 增量流式输出场景（childList + characterData）
const streamedParagraphText = createText('Settings');
const streamedParagraph = createElement('p', {}, [streamedParagraphText]);
const streamedBoldDoneText = createText('Done');
const streamedBoldDone = createElement('strong', {}, [streamedBoldDoneText]);
markdownRootInChat.appendChild(streamedParagraph);
markdownRootInChat.appendChild(streamedBoldDone);
streamTargetText.nodeValue = 'log';

notifyObserver([
  { type: 'childList', addedNodes: [streamedParagraph, streamedBoldDone] },
  { type: 'characterData', target: streamTargetText },
]);

assert.equal(streamedParagraphText.nodeValue, 'Settings', '流式新增 <p>Settings</p> 不得被翻译');
assert.equal(streamedBoldDoneText.nodeValue, 'Done', '流式新增 <strong>Done</strong> 不得被翻译');
assert.equal(streamTargetText.nodeValue, 'log', '流式 characterData 更新为 log 后不得被翻译');

// 独立调用 translateNode 扫描内部子节点同样受保护
translateNode(streamedParagraph);
assert.equal(streamedParagraphText.nodeValue, 'Settings');

console.log('PASS: Ticket-58 AI 聊天正文、Markdown 预览与行内代码隔离测试全部通过！');
