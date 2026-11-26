'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { buildDomTranslatorInjection } = require('../src/build-injection');
const { loadTranslatorSandbox } = require('./helpers/translator-loader');

console.log('=== 开始 Ticket-61 超长对话零回流遍历、叶子收集早退与子框架注入边界专项测试 ===\n');

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
// 1. 模拟 356 步超长对话（12,000+ DOM 节点）：零 innerText 回流、零全树 textContent 拼接
// -----------------------------------------------------------------------------
console.log('--- 1. 超长对话 DOM 零回流与 O(N) 线性遍历验收 ---');

let innerTextReads = 0;
let textContentReads = 0;

class PerfMockNode {
  constructor(type, tag = '', value = '') {
    this.nodeType = type;
    this.tagName = tag;
    this.nodeValue = value;
    this.childNodes = [];
    this.parentElement = null;
    this.className = '';
    this._attrs = {};
    this.classList = { contains: (c) => this.className.split(/\s+/).includes(c) };
  }
  appendChild(ch) {
    ch.parentElement = this;
    this.childNodes.push(ch);
    return ch;
  }
  get firstChild() {
    return this.childNodes[0] || null;
  }
  get childElementCount() {
    let count = 0;
    for (let i = 0; i < this.childNodes.length; i++) {
      if (this.childNodes[i].nodeType === 1) count++;
    }
    return count;
  }
  getAttribute(k) {
    return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null;
  }
  hasAttribute(k) {
    return Object.prototype.hasOwnProperty.call(this._attrs, k);
  }
  setAttribute(k, v) {
    this._attrs[k] = v;
  }
  closest(sel) {
    let cur = this;
    while (cur) {
      if (sel.includes('data-markdown-root') && cur.hasAttribute('data-markdown-root')) return cur;
      if (sel.includes('project-header') && cur.getAttribute('data-testid') === 'project-header') return cur;
      if (sel.includes('menu-option-label') && cur.getAttribute('data-testid') === 'menu-option-label') return cur;
      if (sel.includes('thinking-collapsible-trigger') && cur.getAttribute('data-testid') === 'thinking-collapsible-trigger') return cur;
      cur = cur.parentElement;
    }
    return null;
  }
  get innerText() {
    innerTextReads++;
    return this._collectText();
  }
  get textContent() {
    textContentReads++;
    return this._collectText();
  }
  _collectText() {
    if (this.nodeType === 3) return this.nodeValue || '';
    let s = '';
    for (let i = 0; i < this.childNodes.length; i++) {
      s += this.childNodes[i]._collectText();
    }
    return s;
  }
}

const docEl = new PerfMockNode(1, 'HTML');
const body = docEl.appendChild(new PerfMockNode(1, 'BODY'));
const conv = body.appendChild(new PerfMockNode(1, 'DIV')).appendChild(new PerfMockNode(1, 'DIV'));
conv.setAttribute('data-testid', 'conversation-view');

const samplePillTexts = [];
const sampleMarkdownTexts = [];
let totalNodes = 4;

for (let step = 0; step < 356; step++) {
  const stepBox = conv.appendChild(new PerfMockNode(1, 'DIV'));
  const pillWrap = stepBox.appendChild(new PerfMockNode(1, 'DIV'));
  const pill = pillWrap.appendChild(new PerfMockNode(1, 'SPAN'));
  const pillText = pill.appendChild(new PerfMockNode(3, '', step % 2 === 0 ? 'Explored' : 'Ran command'));
  if (step < 4) samplePillTexts.push(pillText);

  const md = stepBox.appendChild(new PerfMockNode(1, 'DIV'));
  md.setAttribute('data-markdown-root', 'true');
  totalNodes += 5;
  for (let p = 0; p < 10; p++) {
    const pEl = md.appendChild(new PerfMockNode(1, 'P'));
    const sp = pEl.appendChild(new PerfMockNode(1, 'SPAN'));
    const mdText = sp.appendChild(new PerfMockNode(3, '', `Request log line ${step}:${p} Settings ` + 'x'.repeat(200)));
    if (step === 0 && p === 0) sampleMarkdownTexts.push(mdText);
    totalNodes += 3;
  }
}

const injCode = buildDomTranslatorInjection();
const instrumented = injCode.replace(
  'function translateNode(node) {',
  'globalThis.__testTranslateNode = translateNode; function translateNode(node) {'
);
const perfSandbox = {
  console,
  setTimeout,
  clearTimeout,
  queueMicrotask,
  Map,
  Set,
  WeakMap,
  WeakSet,
  RegExp,
  Object,
  Array,
  String,
  Number,
  Math,
  Date,
  document: { readyState: 'loading', addEventListener() {}, body, documentElement: docEl },
  window: { addEventListener() {} },
  Element: { prototype: {} },
  Node: { TEXT_NODE: 3, ELEMENT_NODE: 1, DOCUMENT_FRAGMENT_NODE: 11 },
  MutationObserver: class { observe() {} },
  history: { pushState() {}, replaceState() {} },
};
perfSandbox.globalThis = perfSandbox;
vm.runInNewContext(instrumented, perfSandbox);

const t0 = performance.now();
perfSandbox.__testTranslateNode(body);
const firstPassMs = performance.now() - t0;

const t1 = performance.now();
perfSandbox.__testTranslateNode(body);
const secondPassMs = performance.now() - t1;

check(`356 步超长对话 (${totalNodes} 节点) 零 innerText 同步回流`, innerTextReads, 0);
check(`356 步超长对话 (${totalNodes} 节点) 零整树 textContent 拼接`, textContentReads, 0);
check(`356 步超长对话首轮遍历在 2000ms 内完成 (实测 ${firstPassMs.toFixed(1)}ms)`, firstPassMs < 2000, true);
check(`356 步超长对话次轮遍历在 1000ms 内完成 (实测 ${secondPassMs.toFixed(1)}ms)`, secondPassMs < 1000, true);
check('步骤状态药丸 "Explored" 仍正常汉化', samplePillTexts[0].nodeValue, '已探索');
check('步骤状态药丸 "Ran command" 仍正常汉化', samplePillTexts[1].nodeValue, '已运行命令');
check('Markdown 正文保持物理免疫不被改写', sampleMarkdownTexts[0].nodeValue.startsWith('Request log line 0:0 Settings '), true);

// -----------------------------------------------------------------------------
// 2. 空状态收敛与仅含 innerText 的节点向下兼容
// -----------------------------------------------------------------------------
console.log('\n--- 2. 空状态收敛与兼容性校验 ---');

const { translateNode, shouldSkipNode } = loadTranslatorSandbox();

const emptyA = new PerfMockNode(3, '', 'No ');
const emptyB = new PerfMockNode(1, 'SPAN');
emptyB.appendChild(new PerfMockNode(3, '', 'automations'));
const emptyC = new PerfMockNode(3, '', ' yet.');
const emptyWrap = new PerfMockNode(1, 'DIV');
emptyWrap.appendChild(emptyA);
emptyWrap.appendChild(emptyB);
emptyWrap.appendChild(emptyC);
translateNode(emptyWrap);
check('空状态提示 "No automations yet." 仍正常收敛为 "暂无自动化"', emptyA.nodeValue, '暂无自动化');
check('空状态收敛清空后续碎片文本节点', emptyB.firstChild.nodeValue + emptyC.nodeValue, '');

const innerTextOnlyNode = {
  nodeType: 1,
  tagName: 'SPAN',
  innerText: 'Explored',
  childNodes: [],
  parentElement: null,
  getAttribute: () => null,
  hasAttribute: () => false,
};
check('仅提供 innerText 的 mock 节点仍能正确识别为动作药丸', shouldSkipNode(innerTextOnlyNode), false);

// -----------------------------------------------------------------------------
// 3. plugin:// 子框架注入起止边界校验（防止截入 preload.js 末尾第三方代码）
// -----------------------------------------------------------------------------
console.log('\n--- 3. preload.js 汉化引擎结束边界与子框架截断校验 ---');

const endMarker = '// Antigravity 2.0 Chinese Localization Engine End';
check('构建产物包含汉化引擎结束边界标记', injCode.trimEnd().endsWith(endMarker), true);

const localizeSrc = fs.readFileSync(path.join(ROOT, 'localize.js'), 'utf-8');
check('localize.js 子框架注入逻辑识别结束边界标记', localizeSrc.includes(endMarker), true);

const fakePreload = [
  'const electron_1 = require("electron");',
  injCode,
  '// Third-party preload appendix',
  'electron_1.contextBridge.exposeInMainWorld("thirdPartyAPI", {});',
].join('\n');

const startMarker = '// Antigravity 2.0 Chinese Localization Engine';
const startIdx = fakePreload.indexOf(startMarker);
let sliced = startIdx !== -1 ? fakePreload.slice(startIdx) : '';
const endIdx = sliced.indexOf(endMarker);
if (endIdx !== -1) {
  sliced = sliced.slice(0, endIdx + endMarker.length);
}

let sliceSyntaxOk = false;
try {
  new vm.Script(sliced, { filename: 'subframe-i18n.js' });
  sliceSyntaxOk = true;
} catch (_) {
  sliceSyntaxOk = false;
}

check('截断后的子框架汉化脚本语法合法', sliceSyntaxOk, true);
check('截断后的子框架汉化脚本不携带末尾第三方 electron_1 代码', sliced.includes('electron_1'), false);
check('截断后的子框架汉化脚本不携带末尾第三方 API 暴露代码', sliced.includes('thirdPartyAPI'), false);

console.log(`\n=== Ticket-61 测试总结: ${passed}/${total} 通过 ===`);
if (passed !== total) {
  process.exit(1);
}
