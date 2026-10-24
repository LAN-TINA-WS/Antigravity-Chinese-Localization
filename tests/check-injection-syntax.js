const fs = require('fs');
const path = require('path');
const vm = require('vm');

const localizeSource = fs.readFileSync(path.join(__dirname, '..', 'localize.js'), 'utf-8');
const match = localizeSource.match(/const DOM_TRANSLATOR_INJECTION = `([\s\S]*?)`;/);

if (!match) {
  console.error('未匹配到 DOM_TRANSLATOR_INJECTION');
  process.exit(1);
}

// 必须通过模板字符串求值，模拟运行时真实注入到 preload.js 的代码
const injectionCode = eval('`' + match[1] + '`');

console.log('injectionCode 长度:', injectionCode.length);
try {
  new vm.Script(injectionCode);
  console.log('✅ injectionCode 语法完全合法 (Valid JavaScript)');
} catch (e) {
  console.error('❌ injectionCode 存在语法错误:', e.message);
  process.exit(1);
}
