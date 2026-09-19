const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. 读取当前 localize.js 源码与 extracted/package.json
const localizeSource = fs.readFileSync(path.join(__dirname, '..', 'localize.js'), 'utf-8');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'extracted', 'package.json'), 'utf-8'));

let passed = 0;
let total = 0;

function check(desc, actual, expected) {
  total++;
  try {
    assert.strictEqual(actual, expected);
    console.log(`PASS [${total}]: ${desc} => "${actual}"`);
    passed++;
  } catch (err) {
    console.error(`FAIL [${total}]: ${desc}`);
    console.error(`   期望: "${expected}"`);
    console.error(`   实际: "${actual}"`);
  }
}

console.log('=== 开始 Ticket-10 Antigravity 2.15.0 核心版本与特性专项测试 ===\n');

// 1. 版本号校验
console.log('--- 2.15.0 版本元数据校验 ---');
const versionMatch = localizeSource.match(/const CURRENT_VERSION = ['"]([^'"]+)['"];/);
check('localize.js CURRENT_VERSION 版本号必须为 2.15.0', versionMatch ? versionMatch[1] : null, '2.15.0');
check('extracted/package.json version 必须为 2.15.0', packageJson.version, '2.15.0');

// 2. 核心文件完备性
console.log('\n--- 核心注入文件完备性测试 ---');
const distDir = path.join(__dirname, '..', 'extracted', 'dist');
check('preload.js 存在', fs.existsSync(path.join(distDir, 'preload.js')), true);
check('wizardPreload.js 存在', fs.existsSync(path.join(distDir, 'ideInstall', 'wizardPreload.js')), true);
check('menu.js 存在', fs.existsSync(path.join(distDir, 'menu.js')), true);
check('tray.js 存在', fs.existsSync(path.join(distDir, 'tray.js')), true);
check('loadingOverlay.js 存在', fs.existsSync(path.join(distDir, 'loadingOverlay.js')), true);
check('updater.js 存在', fs.existsSync(path.join(distDir, 'updater.js')), true);

// 3. 官方 2.15.0 更新器头信息校验
console.log('\n--- 官方 2.15.0 更新器特征校验 ---');
const updaterSource = fs.readFileSync(path.join(distDir, 'updater.js'), 'utf-8');
check('updater.js 包含 2.15.0 requestHeaders 特征', updaterSource.includes("autoUpdater.requestHeaders = { 'x-app-version': electron_1.app.getVersion() }"), true);

// 4. v2.15.0 核心新增特性汉化校验
console.log('\n--- v2.15.0 智能体控制、项目状态与报错汉化校验 ---');
const preloadSource = fs.readFileSync(path.join(distDir, 'preload.js'), 'utf-8');
check('preload.js 包含 No Project 映射', preloadSource.includes('"No Project": "无项目"'), true);
check('preload.js 包含 Invalid tool call 映射', preloadSource.includes('"Invalid tool call": "无效的工具调用"'), true);
check('preload.js 包含 Main Agent 映射', preloadSource.includes('"Main Agent": "主智能体"'), true);
check('preload.js 包含 Default tools 映射', preloadSource.includes('"Default tools": "默认工具"'), true);
check('preload.js 包含 Default prompt sections 映射', preloadSource.includes('"Default prompt sections": "默认提示词小节"'), true);
check('preload.js 包含 Cannot display binary file 映射', preloadSource.includes('"Cannot display binary file": "无法显示二进制文件"'), true);
check('preload.js 包含 Command canceled 映射', preloadSource.includes('"Command canceled": "命令已取消"'), true);

check('localize.js 包含 No Project 映射', localizeSource.includes('"No Project": "无项目"'), true);
check('localize.js 包含 Invalid tool call 映射', localizeSource.includes('"Invalid tool call": "无效的工具调用"'), true);
check('localize.js 包含 Main Agent 映射', localizeSource.includes('"Main Agent": "主智能体"'), true);
check('localize.js 包含 Default tools 映射', localizeSource.includes('"Default tools": "默认工具"'), true);

console.log('\n========================================');
console.log(`测试完成: ${passed}/${total} 通过 (${passed === total ? 'ALL PASS' : 'FAILED'})`);
console.log('========================================');

if (passed !== total) {
  process.exit(1);
}
