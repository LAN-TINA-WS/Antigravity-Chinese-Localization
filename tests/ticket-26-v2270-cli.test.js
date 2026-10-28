const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

console.log('=== 开始 Ticket-26 命令行参数白名单与文档一致性专项测试 (issue #40) ===\n');

const root = path.join(__dirname, '..');
const localizeSource = fs.readFileSync(path.join(root, 'localize.js'), 'utf-8');
const readmeSource = fs.readFileSync(path.join(root, 'README.md'), 'utf-8');
const readmeEnSource = fs.readFileSync(path.join(root, 'README.en.md'), 'utf-8');
const changelogSource = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf-8');

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

// ---------------------------------------------------------------------------
// 1. 参数白名单：localize.js 必须显式声明可接受的 CLI 参数
// ---------------------------------------------------------------------------
const flagsMatch = localizeSource.match(/const KNOWN_CLI_FLAGS = \[([^\]]+)\];/);
check('localize.js 声明了 KNOWN_CLI_FLAGS 白名单', Boolean(flagsMatch), true);

const declaredFlags = flagsMatch
  ? flagsMatch[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean).sort()
  : [];
const expectedFlags = ['--apply-only', '--auto-restore', '--check-status', '--now'].sort();
check('白名单恰好是真实存在的四个参数', declaredFlags.join(' '), expectedFlags.join(' '));

// 白名单里的每个参数都必须真的被 process.argv.includes 分支处理
const unhandled = declaredFlags.filter(
  (flag) => !localizeSource.includes(`process.argv.includes('${flag}')`)
);
check('白名单参数全部有对应的 argv 分支', unhandled.join(',') || 'none', 'none');

// ---------------------------------------------------------------------------
// 2. 未知参数必须报错退出，而不是静默启动 Web 面板
// ---------------------------------------------------------------------------
check(
  'localize.js 含未识别参数报错文案',
  localizeSource.includes('未识别的命令行参数'),
  true
);
check(
  'localize.js 对未知参数执行 process.exit(1)',
  /if \(unknownCliFlags\.length > 0\) \{[\s\S]{0,400}?process\.exit\(1\)/.test(localizeSource),
  true
);

// 运行时行为验证：三个历史假参数都必须以退出码 1 结束且不回落到 Web 面板
for (const fakeFlag of ['--restore', '--extract-only', '--pack-only']) {
  const r = spawnSync(process.execPath, ['localize.js', fakeFlag], {
    cwd: root,
    encoding: 'utf-8',
    timeout: 30000
  });
  const stderr = (r.stderr || '') + (r.stdout || '');
  const rejected = r.status === 1 && stderr.includes('未识别的命令行参数') && !stderr.includes('汉化服务已在后台运行');
  check(`运行 ${fakeFlag} 被拒绝（退出码 1，不启动面板）`, rejected, true);
}

// ---------------------------------------------------------------------------
// 3. 文档一致性：README 不得再出现不存在的参数
// ---------------------------------------------------------------------------
const phantomCommands = ['localize.js --restore', 'localize.js --extract-only', 'localize.js --pack-only'];
for (const phantom of phantomCommands) {
  check(`README.md 不再出现假的命令行 ${phantom}`, readmeSource.includes(phantom), false);
  check(`README.en.md 不再出现假的命令行 ${phantom}`, readmeEnSource.includes(phantom), false);
}

for (const realFlag of expectedFlags) {
  check(`README.md 记录了真实参数 ${realFlag}`, readmeSource.includes(`localize.js ${realFlag}`), true);
  check(`README.en.md 记录了真实参数 ${realFlag}`, readmeEnSource.includes(`localize.js ${realFlag}`), true);
}

check('README.md 声明了参数白名单约束', readmeSource.includes('参数白名单'), true);
check('README.en.md 声明了参数白名单约束', /argument whitelist/i.test(readmeEnSource), true);

// ---------------------------------------------------------------------------
// 4. CHANGELOG 记录本次修复
// ---------------------------------------------------------------------------
check('CHANGELOG.md 记录了 issue #40 的修复', changelogSource.includes('issue #40'), true);

console.log('\n======================================================');
console.log(`Ticket-26 测试结果: ${passed}/${total} 断言全部通过！`);
console.log('======================================================\n');

if (passed !== total) {
  process.exit(1);
} else {
  process.exit(0);
}
