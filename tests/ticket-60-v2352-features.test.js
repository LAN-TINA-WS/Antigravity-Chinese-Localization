'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { readAsarPackageVersion } = require('../asar-version');
const { loadTranslatorSandbox, compareSemver } = require('./helpers/translator-loader');
const { extractChangelogSection } = require('../release-assets/generate-release-assets');

console.log('=== 开始 Ticket-60 Antigravity 2.35.2 版本适配与增量 UI/动态规则专项测试 ===\n');

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
// 1. v2.35.2 版本号、文档与产物元数据一致性校验
// -----------------------------------------------------------------------------
console.log('--- 1. v2.35.2 版本号与文档元数据校验 ---');
const localizeSource = fs.readFileSync(path.join(ROOT, 'localize.js'), 'utf-8');
const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const extractedPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'extracted', 'package.json'), 'utf-8'));
const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
const readmeZh = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf-8');
const readmeEn = fs.readFileSync(path.join(ROOT, 'README.en.md'), 'utf-8');
const archZh = fs.readFileSync(path.join(ROOT, 'docs', 'architecture.md'), 'utf-8');
const archEn = fs.readFileSync(path.join(ROOT, 'docs', 'architecture.en.md'), 'utf-8');
const changelogZh = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
const changelogEn = fs.readFileSync(path.join(ROOT, 'CHANGELOG.en.md'), 'utf-8');
const readyAsarPath = path.join(ROOT, 'app.asar.ready');

const curVerMatch = localizeSource.match(/const CURRENT_VERSION = ['"]([^'"]+)['"];/);
const relVerMatch = localizeSource.match(/const RELEASE_VERSION = ['"]([^'"]+)['"];/);
check('localize.js CURRENT_VERSION >= 2.35.2', Boolean(curVerMatch && compareSemver(curVerMatch[1], '2.35.2') >= 0), true);
check('localize.js RELEASE_VERSION >= 2.35.2', Boolean(relVerMatch && compareSemver(relVerMatch[1], '2.35.2') >= 0), true);
check('package.json version >= 2.35.2', compareSemver(rootPkg.version, '2.35.2') >= 0, true);
check('extracted/package.json version >= 2.35.2', compareSemver(extractedPkg.version, '2.35.2') >= 0, true);
check('app.asar.ready package.json version >= 2.35.2', compareSemver(readAsarPackageVersion(readyAsarPath), '2.35.2') >= 0, true);
check('index.html 控制中心显示 v2.35.2+', /控制中心 v2\.(35\.[2-9]|3[6-9]\.|[4-9]\d\.)/.test(indexSource), true);
check('README.md 与 README.en.md 标注 v2.35.2+', readmeZh.includes('v2.35.2') && readmeEn.includes('v2.35.2'), true);
check('docs/architecture(.en).md 同步 v2.35.2+', archZh.includes('2.35.2') && archEn.includes('2.35.2'), true);
check('CHANGELOG.md 与 CHANGELOG.en.md 包含 v2.35.2 章节', changelogZh.includes('## v2.35.2 (2026-11-26)') && changelogEn.includes('## v2.35.2 (2026-11-26)'), true);
check('extractChangelogSection 精确提取 v2.35.2 章节', extractChangelogSection(changelogZh, '2.35.2').matchedExact, true);

// -----------------------------------------------------------------------------
// 2. Web UI v2.35.2 新增模型切换提示与静态词条校验
// -----------------------------------------------------------------------------
console.log('\n--- 2. Web UI v2.35.2 新增静态词条校验 ---');
const { translateString } = loadTranslatorSandbox();

const staticChecks = [
  ['Applies to /btw and messages sent after this turn', '适用于 /btw 及本回合之后发送的消息'],
  ['Applies to messages sent after this turn', '适用于本回合之后发送的消息'],
  ['Model cannot be changed while the agent is running', '智能体运行期间无法切换模型'],
];

for (const [src, expected] of staticChecks) {
  check(`静态词条 "${src}"`, translateString(src), expected);
}

// -----------------------------------------------------------------------------
// 3. Web UI v2.35.2 动态规则、$ 安全性与防误伤校验
// -----------------------------------------------------------------------------
console.log('\n--- 3. Web UI v2.35.2 动态规则与防误伤校验 ---');
const dynamicChecks = [
  ['Blocked navigation to "https://example.com/$&"', '已拦截前往“https://example.com/$&”的导航'],
  ['Sign in from the Antigravity panel.', '请从 Antigravity 面板登录。'],
  ['Sign in to use Antigravity!', '请登录以使用 Antigravity！'],
  ['Failed to save project: network timeout', '保存项目失败：network timeout'],
  ['Failed to create project: permission denied', '创建项目失败：permission denied'],
  ['Failed to unarchive project: RPC $1 error', '取消归档项目失败：RPC $1 error'],
  ['Failed to delete workspace: locked', '删除工作区失败：locked'],
  ['Failed to save settings: invalid value', '保存设置失败：invalid value'],
  ['Failed to save project settings: invalid value', '保存项目设置失败：invalid value'],
  ['Failed to save project permissions: denied', '保存项目权限失败：denied'],
  ['Failed to save cloud permission settings: timeout', '保存云端权限设置失败：timeout'],
  ['Failed to save configuration: missing field', '保存配置失败：missing field'],
  ['Could not attach folder "src/$&": not found', '无法附加文件夹“src/$&”：not found'],
  ['Could not attach image: unsupported format', '无法附加图片：unsupported format'],
  ['Could not open folder: access denied', '无法打开文件夹：access denied'],
  ['Error installing MCP server: timeout', '安装 MCP 服务器出错：timeout'],
  ['Error refreshing MCP servers: network error', '刷新 MCP 服务器出错：network error'],
  ['Error restarting MCP server: timeout', '重启 MCP 服务器出错：timeout'],
  ['Error updating agent: permission denied', '更新智能体出错：permission denied'],
  ['Error restarting github-mcp: exit code 1', '重启 github-mcp 出错：exit code 1'],
  ['Added MCP server "github", but it failed to start: exit 1', '已添加 MCP 服务器“github”，但启动失败：exit 1'],
  ['Failed to send interaction: closed', '发送交互失败：closed'],
];

for (const [src, expected] of dynamicChecks) {
  const actual = translateString(src);
  check(`动态规则 "${src.slice(0, 48)}"`, actual, expected);
  check(`动态规则幂等 "${src.slice(0, 40)}"`, translateString(actual), expected);
}

const antiFalsePositiveCases = [
  'NAVIGATION_BLOCKED: Payment page (https://pay.example.com) cannot be inspected or actuated by the agent; ask the user to complete the payment in the browser pane',
  'Sign in to use this app! Then restart your PC.',
  'Gemini 4 Hydrogen (High)',
  'Orchestrator',
  'Swarm',
];
for (const raw of antiFalsePositiveCases) {
  check(`防误伤保留原样 "${raw.slice(0, 48)}"`, translateString(raw), raw);
}

// -----------------------------------------------------------------------------
// 4. 实装产物 preload.js 与 wizardPreload.js 校验
// -----------------------------------------------------------------------------
console.log('\n--- 4. 实装产物 preload.js 与 wizardPreload.js 校验 ---');
const distDir = path.join(ROOT, 'extracted', 'dist');
const preloadJs = fs.readFileSync(path.join(distDir, 'preload.js'), 'utf-8');
const wizardPreloadJs = fs.readFileSync(path.join(distDir, 'ideInstall', 'wizardPreload.js'), 'utf-8');
check(
  'extracted preload.js 与 wizardPreload.js 已实装 v2.35.2 新增词条与动态规则',
  preloadJs.includes('适用于 /btw 及本回合之后发送的消息') &&
    preloadJs.includes('智能体运行期间无法切换模型') &&
    preloadJs.includes('已拦截前往“') &&
    wizardPreloadJs.includes('适用于 /btw 及本回合之后发送的消息') &&
    wizardPreloadJs.includes('已拦截前往“'),
  true
);

console.log(`\n========== 测试完成: ${passed}/${total} 全部通过 ==========`);
if (passed !== total) {
  process.exit(1);
}
