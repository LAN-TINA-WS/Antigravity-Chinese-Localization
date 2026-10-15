'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isAppRunningStrict } = require('../process-check');

test('Windows process detection matches image names and propagates tasklist failures', () => {
  assert.equal(isAppRunningStrict({ platform: 'win32', run: () => '"Antigravity.exe","12"\r\n' }), true);
  assert.equal(isAppRunningStrict({ platform: 'win32', run: () => '"LANGUAGE_SERVER.EXE","13"\r\n' }), true);
  assert.equal(isAppRunningStrict({ platform: 'win32', run: () => '"node.exe","12","Antigravity.exe"\r\n' }), false);
  assert.throws(() => isAppRunningStrict({ platform: 'win32', run: () => 'unavailable' }), /进程列表/);
  const denied = new Error('tasklist failed');
  assert.throws(() => isAppRunningStrict({ platform: 'win32', run: () => { throw denied; } }), error => error === denied);
});

test('pgrep no-match is idle but other errors cannot permit installation', () => {
  assert.equal(isAppRunningStrict({ platform: 'linux', run: () => '' }), true);
  assert.equal(isAppRunningStrict({ platform: 'linux', run: () => { throw Object.assign(new Error('no match'), { status: 1 }); } }), false);
  const denied = Object.assign(new Error('permission denied'), { status: 2 });
  assert.throws(() => isAppRunningStrict({ platform: 'darwin', run: () => { throw denied; } }), error => error === denied);
});
