const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { readAsarPackageVersion } = require('../asar-version');

console.log('=== 开始 Ticket-30 Antigravity 2.28.2 官方版本与架构特性专项测试 ===\n');

const root = path.join(__dirname, '..');
const localizePath = path.join(root, 'localize.js');
const localizeSource = fs.readFileSync(localizePath, 'utf-8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'extracted', 'package.json'), 'utf-8'));
const indexPath = path.join(root, 'index.html');
const indexSource = fs.readFileSync(indexPath, 'utf-8');
const readmePath = path.join(root, 'README.md');
const readmeSource = fs.readFileSync(readmePath, 'utf-8');
const readmeEnPath = path.join(root, 'README.en.md');
const readmeEnSource = fs.readFileSync(readmeEnPath, 'utf-8');
const changelogPath = path.join(root, 'CHANGELOG.md');
const changelogSource = fs.readFileSync(changelogPath, 'utf-8');
const changelogEnPath = path.join(root, 'CHANGELOG.en.md');
const changelogEnSource = fs.readFileSync(changelogEnPath, 'utf-8');
const readyAsarPath = path.join(root, 'app.asar.ready');

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

// 1. 版本元数据校验
console.log('--- 1. 2.28.2 版本元数据校验 ---');
function isVerGte2282(ver) {
  if (!ver) return false;
  const parts = ver.split('.').map(n => parseInt(n, 10));
  if (parts[0] > 2) return true;
  if (parts[0] === 2 && parts[1] > 28) return true;
  if (parts[0] === 2 && parts[1] === 28 && parts[2] >= 2) return true;
  return false;
}

const versionMatch = localizeSource.match(/const CURRENT_VERSION = ['"]([^'"]+)['"];/);
const currentVer = versionMatch ? versionMatch[1] : '';
check('localize.js CURRENT_VERSION 版本号有效且 >= 2.28.2', isVerGte2282(currentVer), true);
check('extracted/package.json 版本与 CURRENT_VERSION 完全一致', packageJson.version, currentVer);

if (fs.existsSync(readyAsarPath)) {
  check('app.asar.ready 读取包版本有效且 >= 2.28.2', isVerGte2282(readAsarPackageVersion(readyAsarPath)), true);
}

check('index.html 包含 控制中心 v2.28.2+', (() => {
  const m = indexSource.match(/(?:本地词库|控制中心) v(2\.\d+\.\d+)/);
  return m ? isVerGte2282(m[1]) : false;
})(), true);
check('index.html 包含 Antigravity 汉化', indexSource.includes('<h1>Antigravity 汉化</h1>'), true);
check('README.md 包含 Antigravity v' + currentVer + '+', readmeSource.includes('Antigravity v' + currentVer + '+'), true);
check('README.en.md 包含 Antigravity v' + currentVer + '+', readmeEnSource.includes('Antigravity v' + currentVer + '+'), true);
check('CHANGELOG.md 包含 2.28.2 版本日志条目', changelogSource.includes('## v2.28.2 (2026-10-30)'), true);
check('CHANGELOG.en.md 包含 2.28.2 版本日志条目', changelogEnSource.includes('## v2.28.2 (2026-10-30)'), true);

// 2. 原生层与补丁产物校验
console.log('\n--- 2. 原生层与补丁产物校验 ---');
const distDir = path.join(root, 'extracted', 'dist');
check('webauthn.js 模块存在', fs.existsSync(path.join(distDir, 'webauthn.js')), true);
check('cablev2.js 模块存在', fs.existsSync(path.join(distDir, 'cablev2.js')), true);
check('webviewBrowser.js 模块存在', fs.existsSync(path.join(distDir, 'webviewBrowser.js')), true);
check('scriptJail.js 模块存在', fs.existsSync(path.join(distDir, 'scriptJail.js')), true);
check('scriptJailPreload.js 模块存在', fs.existsSync(path.join(distDir, 'scriptJailPreload.js')), true);
check('guestDebugger.js 模块存在', fs.existsSync(path.join(distDir, 'guestDebugger.js')), true);
check('webviewSecurityState.js 模块存在', fs.existsSync(path.join(distDir, 'webviewSecurityState.js')), true);

const preloadSource = fs.readFileSync(path.join(distDir, 'preload.js'), 'utf-8');
const menuSource = fs.readFileSync(path.join(distDir, 'menu.js'), 'utf-8');
const cableSource = fs.readFileSync(path.join(distDir, 'cablev2.js'), 'utf-8');
const webauthnSource = fs.readFileSync(path.join(distDir, 'webauthn.js'), 'utf-8');

check('preload.js 包含 DOM 实时汉化注入引擎', preloadSource.includes('// Antigravity 2.0 Chinese Localization Engine'), true);
check('preload.js 包含 幕僚长 (Chief of Staff) 汉化', preloadSource.includes('幕僚长'), true);
check('preload.js 包含 内置浏览器 (Built-in Browser) 汉化', preloadSource.includes('内置浏览器'), true);
check('preload.js 包含 5h limit 限额汉化', preloadSource.includes('5h limit') && preloadSource.includes('5 小时限额'), true);
check('preload.js 包含 Resets in 配额重置时间动态规则', preloadSource.includes('Resets?') && preloadSource.includes('后重置'), true);
check('preload.js 包含 % left 配额剩余动态规则', preloadSource.includes('left') && preloadSource.includes('剩余'), true);
check('menu.js 包含 原生菜单翻译映射', menuSource.includes('const menuTranslationMap = {'), true);
check('cablev2.js 包含 通行密钥 汉化', cableSource.includes('通行密钥'), true);
check('webauthn.js 包含 选择通行密钥 汉化', webauthnSource.includes('选择通行密钥'), true);

console.log(`\n测试汇总: 通过: ${passed}, 失败: ${total - passed}, 总计: ${total}`);
if (passed === total) {
  console.log('Ticket-30 校验全部通过！');
  process.exit(0);
} else {
  console.error('Ticket-30 校验存在失败项！');
  process.exit(1);
}
