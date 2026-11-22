'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');

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

console.log(`PASS: 右侧预览栏及全端原生右键菜单补齐回归测试全部通过 (${expectedPairs.length} 项精确校验)`);
