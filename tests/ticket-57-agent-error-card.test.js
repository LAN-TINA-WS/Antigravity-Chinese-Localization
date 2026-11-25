'use strict';

const assert = require('assert');
const { loadTranslatorSandbox } = require('./helpers/translator-loader');

const { translateString, tryCombinedSentenceTranslation } = loadTranslatorSandbox();

let passedCount = 0;
let failedCount = 0;

function check(name, actual, expected) {
  try {
    assert.strictEqual(actual, expected);
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (_) {
    console.error(`[FAIL] ${name}`);
    console.error(`       实际: ${JSON.stringify(actual)}`);
    console.error(`       期望: ${JSON.stringify(expected)}\n`);
    failedCount++;
  }
}

function mockText(value) {
  return { nodeType: 3, nodeValue: value };
}

function mockAnchor(text) {
  const inner = mockText(text);
  return {
    nodeType: 1,
    tagName: 'A',
    childNodes: [inner],
    firstChild: inner,
    textContent: text,
  };
}

function mockParagraph(childNodes) {
  return { nodeType: 1, childNodes };
}

console.log('=== 开始执行 Ticket 57 智能体错误卡片提示汉化测试 ===\n');

// 1. 静态词条
check(
  '错误卡片正文段落汉化',
  translateString('You can prompt the model to try again or start a new conversation if the error persists.'),
  '你可以提示模型重试；若错误持续出现，也可以开启新的对话。'
);
check(
  '疑难解答链接文字汉化',
  translateString('troubleshooting guide'),
  '疑难解答指南'
);
check(
  '整句（正文 + 链接 + 句尾）词典条目存在',
  translateString('See our troubleshooting guide for more help.'),
  '更多帮助请参阅我们的疑难解答指南。'
);

// 2. 组合句拆分：<p>See our <a>troubleshooting guide</a> for more help.</p>
const p1 = mockParagraph([
  mockText('See our '),
  mockAnchor('troubleshooting guide'),
  mockText(' for more help.'),
]);
check('组合句命中并改写首段文本', tryCombinedSentenceTranslation(p1), true);
check('组合句首段拆分正确', p1.childNodes[0].nodeValue, '更多帮助请参阅我们的');
check('组合句链接节点替换为中文', p1.childNodes[1].firstChild.nodeValue, '疑难解答指南');
check('组合句尾段拆分正确', p1.childNodes[2].nodeValue, '。');

// 3. 两段合并同一段落的变体：正文 + "See our " + 链接 + " for more help."
const p2 = mockParagraph([
  mockText('You can prompt the model to try again or start a new conversation if the error persists. See our '),
  mockAnchor('troubleshooting guide'),
  mockText(' for more help.'),
]);
check('整句组合（含正文）命中', tryCombinedSentenceTranslation(p2), true);
check(
  '整句组合首段拆分正确',
  p2.childNodes[0].nodeValue,
  '你可以提示模型重试；若错误持续出现，也可以开启新的对话。更多帮助请参阅我们的'
);
check('整句组合链接节点替换为中文', p2.childNodes[1].firstChild.nodeValue, '疑难解答指南');
check('整句组合尾段拆分正确', p2.childNodes[2].nodeValue, '。');

// 4. 防误伤：普通含 guide 的英文句子不应被组合翻译
const p3 = mockParagraph([
  mockText('See our '),
  mockAnchor('user guide'),
  mockText(' for more details.'),
]);
check('未收录组合句不误翻', tryCombinedSentenceTranslation(p3), false);
check('未收录组合句文本保持原样', p3.childNodes[0].nodeValue, 'See our ');

console.log(`\n测试汇总: 通过: ${passedCount}, 失败: ${failedCount}, 总计: ${passedCount + failedCount}`);
if (failedCount > 0) {
  process.exit(1);
}
