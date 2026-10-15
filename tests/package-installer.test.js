'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { createReleaseManager } = require('../release-manager');
const { createPackageInstaller } = require('../package-installer');

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function fixture(t, { isAppRunning, stopProcesses, stopTimeoutMs = 0 } = {}) {
  const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'antigravity-install-test-'));
  const appDir = path.join(workspaceDir, 'fake-program');
  const resources = path.join(appDir, 'resources');
  const asarPath = path.join(resources, 'app.asar');
  await fs.mkdir(resources, { recursive: true });
  const original = Buffer.from('original official archive fixture');
  const localized = Buffer.from('selected localized archive fixture');
  await fs.writeFile(asarPath, original);
  await fs.writeFile(path.join(resources, 'app.asar.bak'), 'legacy backup must survive');
  await fs.writeFile(path.join(resources, 'app.asar.backup-previous'), 'previous installation backup');
  const sha256 = hash(localized);
  const cacheId = `release-v1.0.0-1-${sha256}`;
  const cacheDir = path.join(workspaceDir, 'downloads', cacheId);
  const cachePath = path.join(cacheDir, 'app.asar.ready');
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(cachePath, localized);
  await fs.writeFile(path.join(cacheDir, 'download.json'), JSON.stringify({
    format: 1, cacheId, releaseId: 1, tag: 'v1.0.0', filename: 'app.asar.ready',
    size: localized.length, sha256, downloadedAt: '2026-10-15T00:00:00Z'
  }));
  const releaseManager = createReleaseManager({ workspaceDir });
  const installer = createPackageInstaller({ workspaceDir, releaseManager,
    getAppDir(username, useDefault, customPath) { return useDefault ? appDir : customPath; },
    getResourcesDir(directory) { return path.join(directory, 'resources'); },
    isAppRunning: isAppRunning || (() => false), stopProcesses, stopTimeoutMs });
  const server = http.createServer((req, res) => {
    if (!installer.handleRequest(req, res) && !releaseManager.handleRequest(req, res)) {
      res.writeHead(404); res.end('{}');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    const resolved = path.resolve(workspaceDir);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.match(path.basename(resolved), /^antigravity-install-test-/);
    await fs.rm(resolved, { recursive: true, force: true });
  });
  async function call(route = '/api/release-install', method = 'POST', body = { cacheId, useDefault: true }, origin) {
    return new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const headers = payload === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) };
      if (origin !== undefined) headers.Origin = origin;
      const req = http.request({ host: '127.0.0.1', port, path: route, method, headers }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); }
          catch (error) { reject(error); }
        });
      });
      req.on('error', reject);
      req.end(payload);
    });
  }
  const stages = async () => (await fs.readdir(resources)).filter(name => name.endsWith('.stage'));
  const backups = async () => (await fs.readdir(resources)).filter(name => name.startsWith('app.asar.backup-') && name !== 'app.asar.backup-previous');
  return { workspaceDir, appDir, resources, asarPath, original, localized, cacheId, cachePath, sha256, call, port, stages, backups };
}

test('selected cache installs with verified backup and skips identical repeated installation', async t => {
  const f = await fixture(t);
  const installed = await f.call('/api/release-install', 'POST', { cacheId: f.cacheId, useDefault: true }, `http://127.0.0.1:${f.port}`);
  assert.equal(installed.status, 200);
  assert.equal(installed.body.installed.tag, 'v1.0.0');
  assert.equal(installed.body.installed.sha256, f.sha256);
  assert.equal(installed.body.installed.asarPath, f.asarPath);
  assert.deepEqual(await fs.readFile(f.asarPath), f.localized);
  assert.deepEqual(await fs.readFile(installed.body.installed.backupPath), f.original);
  assert.deepEqual(await fs.readFile(f.cachePath), f.localized);
  assert.equal(await fs.readFile(path.join(f.resources, 'app.asar.bak'), 'utf8'), 'legacy backup must survive');
  assert.equal(await fs.readFile(path.join(f.resources, 'app.asar.backup-previous'), 'utf8'), 'previous installation backup');
  assert.deepEqual(await f.stages(), []);
  const second = await f.call();
  assert.equal(second.status, 200);
  assert.equal(second.body.installed.skipped, true);
  assert.equal(second.body.installed.backupPath, null);
  assert.equal((await f.backups()).length, 1);
  assert.deepEqual(await f.stages(), []);
  assert.equal((await f.call('/api/release-install', 'GET')).status, 405);
  assert.equal((await f.call('/unmanaged', 'GET')).status, 404);
});

test('switching packages reuses backups by content and retains distinct contents', async t => {
  const f = await fixture(t);
  const first = await f.call();
  assert.equal(first.status, 200);
  assert.equal(first.body.installed.backupReused, false);
  const originalHash = hash(f.original);
  const originalCacheId = `release-v0.9.0-2-${originalHash}`;
  const originalCache = path.join(f.workspaceDir, 'downloads', originalCacheId);
  await fs.mkdir(originalCache);
  await fs.writeFile(path.join(originalCache, 'app.asar.ready'), f.original);
  await fs.writeFile(path.join(originalCache, 'download.json'), JSON.stringify({
    format: 1, cacheId: originalCacheId, releaseId: 2, tag: 'v0.9.0', filename: 'app.asar.ready',
    size: f.original.length, sha256: originalHash, downloadedAt: '2026-10-15T00:00:00Z'
  }));
  assert.equal((await f.call('/api/release-install', 'POST', { cacheId: originalCacheId })).status, 200);
  assert.deepEqual(await fs.readFile(f.asarPath), f.original);
  const again = await f.call();
  assert.equal(again.status, 200);
  assert.equal(again.body.installed.skipped, false);
  assert.equal(again.body.installed.backupReused, true);
  assert.equal(again.body.installed.backupPath, first.body.installed.backupPath);
  assert.equal((await f.backups()).length, 2);
  assert.deepEqual(await fs.readFile(f.asarPath), f.localized);
});

test('verified legacy backups are reused while corrupt and linked candidates are left untouched', async t => {
  const legacy = await fixture(t);
  const legacyPath = path.join(legacy.resources, 'app.asar.bak');
  await fs.writeFile(legacyPath, legacy.original);
  const result = await legacy.call();
  assert.equal(result.status, 200);
  assert.equal(result.body.installed.backupPath, legacyPath);
  assert.equal(result.body.installed.backupReused, true);
  assert.deepEqual(await legacy.backups(), []);

  const corrupt = await fixture(t);
  const misleadingPath = path.join(corrupt.resources, `app.asar.backup-${hash(corrupt.original).slice(0, 16)}-old`);
  const badBytes = Buffer.alloc(corrupt.original.length, 65);
  await fs.writeFile(misleadingPath, badBytes);
  // A directory junction is supported without elevated symlink privileges on Windows.
  const linkedPath = path.join(corrupt.resources, 'app.asar.backup-linked');
  await fs.symlink(corrupt.appDir, linkedPath, process.platform === 'win32' ? 'junction' : 'dir');
  const repaired = await corrupt.call();
  assert.equal(repaired.status, 200);
  assert.equal(repaired.body.installed.backupReused, false);
  assert.notEqual(repaired.body.installed.backupPath, misleadingPath);
  assert.deepEqual(await fs.readFile(repaired.body.installed.backupPath), corrupt.original);
  assert.deepEqual(await fs.readFile(misleadingPath), badBytes);
  assert.equal((await fs.lstat(linkedPath)).isSymbolicLink(), true);
});

test('running processes, cross-origin requests and tampered cache cannot change the target', async t => {
  const f = await fixture(t, { isAppRunning: () => true });
  assert.equal((await f.call()).status, 409);
  assert.deepEqual(await fs.readFile(f.asarPath), f.original);
  assert.deepEqual(await f.backups(), []);
  assert.equal((await f.call('/api/release-install', 'POST', { cacheId: f.cacheId }, 'https://evil.example')).status, 403);
  await fs.writeFile(f.cachePath, Buffer.alloc(f.localized.length, 65));
  const tampered = await f.call();
  assert.equal(tampered.status, 400);
  assert.match(tampered.body.error, /SHA256/);
  assert.deepEqual(await fs.readFile(f.asarPath), f.original);
});

test('force stop requires explicit permission and only stops an active, different installation once', async t => {
  let running = true;
  let stops = 0;
  let checks = 0;
  const f = await fixture(t, {
    isAppRunning: () => { checks++; return running; },
    stopProcesses: () => { stops++; running = false; }
  });
  assert.equal((await f.call()).status, 409);
  assert.equal((await f.call('/api/release-install', 'POST', { cacheId: f.cacheId, forceStop: false })).status, 409);
  assert.equal(stops, 0);
  const installed = await f.call('/api/release-install', 'POST', { cacheId: f.cacheId, forceStop: true });
  assert.equal(installed.status, 200);
  assert.equal(stops, 1);
  assert.deepEqual(await fs.readFile(f.asarPath), f.localized);

  // No write is necessary for identical contents, even when the client is open.
  running = true;
  const previousChecks = checks;
  const repeated = await f.call('/api/release-install', 'POST', { cacheId: f.cacheId, forceStop: true });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.installed.skipped, true);
  assert.equal(stops, 1);
  assert.equal(checks, previousChecks);
  assert.equal((await f.backups()).length, 1);

  const idle = await fixture(t, {
    isAppRunning: () => false,
    stopProcesses: () => { throw new Error('Must not stop an idle client'); }
  });
  assert.equal((await idle.call('/api/release-install', 'POST', { cacheId: idle.cacheId, forceStop: true })).status, 200);
});

test('force-stop failures and uncertain process state cannot change the target', async t => {
  for (const scenario of [
    { name: 'stop failed', running: () => true, stop: () => { throw new Error('Mock access denied'); }, status: 409, stops: 1 },
    { name: 'still running', running: () => true, stop: () => {}, status: 409, stops: 1 },
    { name: 'initial detection failed', running: () => { throw new Error('Mock tasklist failure'); }, stop: () => {}, status: 503, stops: 0 },
    { name: 'detection failed after stop', running: count => { if (count > 1) throw new Error('Mock tasklist failure'); return true; }, stop: () => {}, status: 503, stops: 1 }
  ]) {
    let stops = 0;
    let checks = 0;
    const f = await fixture(t, {
      isAppRunning: () => scenario.running(++checks),
      stopProcesses: () => { stops++; return scenario.stop(); }
    });
    const result = await f.call('/api/release-install', 'POST', { cacheId: f.cacheId, forceStop: true });
    assert.equal(result.status, scenario.status, scenario.name);
    assert.equal(stops, scenario.stops, scenario.name);
    assert.deepEqual(await fs.readFile(f.asarPath), f.original, scenario.name);
    assert.deepEqual(await f.backups(), [], scenario.name);
    assert.deepEqual(await f.stages(), [], scenario.name);
  }
});

test('request, cache and target validation happen before any force stop', async t => {
  let stops = 0;
  let checks = 0;
  const f = await fixture(t, {
    isAppRunning: () => { checks++; return true; },
    stopProcesses: () => { stops++; }
  });
  for (const forceStop of ['true', 1, null, [], {}]) {
    assert.equal((await f.call('/api/release-install', 'POST', { cacheId: f.cacheId, forceStop })).status, 400);
  }
  assert.equal((await f.call('/api/release-install', 'POST', { cacheId: f.cacheId, forceStop: true }, 'https://evil.example')).status, 403);
  assert.equal((await f.call('/api/release-install', 'POST', { cacheId: f.cacheId, forceStop: true,
    useDefault: false, customPath: path.join(f.workspaceDir, 'downloads') })).status, 400);
  await fs.writeFile(f.cachePath, Buffer.alloc(f.localized.length, 65));
  assert.equal((await f.call('/api/release-install', 'POST', { cacheId: f.cacheId, forceStop: true })).status, 400);
  assert.equal(stops, 0);
  assert.equal(checks, 0);
  assert.deepEqual(await fs.readFile(f.asarPath), f.original);
});

test('a restarted client is never force-stopped again during commit preparation or rollback', async t => {
  let running = true;
  let stops = 0;
  const preparing = await fixture(t, {
    isAppRunning: () => running,
    stopProcesses: () => { stops++; running = false; }
  });
  const copyFile = fs.copyFile;
  fs.copyFile = async (source, destination, flags) => {
    await copyFile(source, destination, flags);
    if (destination.includes('.app.asar.install-')) running = true;
  };
  try {
    const result = await preparing.call('/api/release-install', 'POST', { cacheId: preparing.cacheId, forceStop: true });
    assert.equal(result.status, 409);
    assert.equal(stops, 1);
    assert.deepEqual(await fs.readFile(preparing.asarPath), preparing.original);
    assert.deepEqual(await preparing.stages(), []);
  } finally { fs.copyFile = copyFile; }

  running = true;
  stops = 0;
  const rollingBack = await fixture(t, {
    isAppRunning: () => running,
    stopProcesses: () => { stops++; running = false; }
  });
  const rename = fs.rename;
  fs.rename = async (source, destination) => {
    await rename(source, destination);
    if (source.includes('.app.asar.install-')) {
      running = true;
      throw Object.assign(new Error('Mock failure after commit'), { code: 'EIO' });
    }
  };
  try {
    const result = await rollingBack.call('/api/release-install', 'POST', { cacheId: rollingBack.cacheId, forceStop: true });
    assert.equal(result.status, 409);
    assert.match(result.body.error, /无法完成自动恢复/);
    assert.equal(stops, 1);
    assert.deepEqual(await fs.readFile(rollingBack.asarPath), rollingBack.localized);
    assert.deepEqual(await fs.readFile(path.join(rollingBack.resources, (await rollingBack.backups())[0])), rollingBack.original);
    assert.deepEqual(await rollingBack.stages(), []);
  } finally { fs.rename = rename; }
});

test('process starting during preparation and concurrent official changes stop the commit', async t => {
  let checks = 0;
  const f = await fixture(t, { isAppRunning: () => ++checks >= 2 });
  assert.equal((await f.call()).status, 409);
  assert.deepEqual(await fs.readFile(f.asarPath), f.original);
  assert.deepEqual(await f.stages(), []);

  const changing = await fixture(t);
  const copyFile = fs.copyFile;
  fs.copyFile = async (source, destination, flags) => {
    await copyFile(source, destination, flags);
    if (destination.includes('app.asar.backup-')) await fs.writeFile(changing.asarPath, 'new official update');
  };
  try {
    const result = await changing.call();
    assert.equal(result.status, 409);
    assert.match(result.body.error, /发生变化/);
    assert.equal(await fs.readFile(changing.asarPath, 'utf8'), 'new official update');
    assert.deepEqual(await changing.stages(), []);
  } finally { fs.copyFile = copyFile; }
});

test('commit failures preserve or restore this installation original and keep its backup', async t => {
  const f = await fixture(t);
  const rename = fs.rename;
  fs.rename = async (source, target) => {
    if (source.includes('.app.asar.install-')) {
      const error = new Error('Mock file lock'); error.code = 'EPERM'; throw error;
    }
    return rename(source, target);
  };
  try {
    const failed = await f.call();
    assert.equal(failed.status, 409);
    assert.match(failed.body.error, /保留或恢复/);
    assert.deepEqual(await fs.readFile(f.asarPath), f.original);
    assert.equal((await f.backups()).length, 1);
    assert.deepEqual(await f.stages(), []);
  } finally { fs.rename = rename; }

  fs.rename = async (source, target) => {
    await rename(source, target);
    if (source.includes('.app.asar.install-')) {
      const error = new Error('Mock failure after commit'); error.code = 'EIO'; throw error;
    }
  };
  try {
    const restored = await f.call();
    assert.equal(restored.status, 500);
    assert.match(restored.body.error, /保留或恢复/);
    assert.deepEqual(await fs.readFile(f.asarPath), f.original);
    assert.deepEqual(await fs.readFile(f.cachePath), f.localized);
    assert.equal((await f.backups()).length, 1);
    assert.deepEqual(await f.stages(), []);
  } finally { fs.rename = rename; }
});

test('unknown external change during failed commit is preserved instead of overwritten by rollback', async t => {
  const f = await fixture(t);
  const rename = fs.rename;
  fs.rename = async (source, target) => {
    if (source.includes('.app.asar.install-')) {
      await fs.writeFile(target, 'external updater won the race');
      const error = new Error('Mock updater conflict'); error.code = 'EPERM'; throw error;
    }
    return rename(source, target);
  };
  try {
    const result = await f.call();
    assert.equal(result.status, 409);
    assert.match(result.body.error, /其它程序修改.*保留当前文件/);
    assert.equal(await fs.readFile(f.asarPath, 'utf8'), 'external updater won the race');
    const backup = path.join(f.resources, (await f.backups())[0]);
    assert.deepEqual(await fs.readFile(backup), f.original);
    assert.deepEqual(await f.stages(), []);
  } finally { fs.rename = rename; }
});

test('rollback refuses to write while a process starts, and process-detection failures stop installation', async t => {
  let checks = 0;
  const f = await fixture(t, { isAppRunning: () => ++checks >= 3 });
  const rename = fs.rename;
  fs.rename = async (source, target) => {
    await rename(source, target);
    if (source.includes('.app.asar.install-')) {
      const error = new Error('Mock failure after commit'); error.code = 'EIO'; throw error;
    }
  };
  try {
    const result = await f.call();
    assert.equal(result.status, 409);
    assert.match(result.body.error, /无法完成自动恢复.*退出/);
    assert.deepEqual(await fs.readFile(f.asarPath), f.localized);
    assert.deepEqual(await fs.readFile(path.join(f.resources, (await f.backups())[0])), f.original);
    assert.deepEqual(await f.stages(), []);
  } finally { fs.rename = rename; }
  const unknown = await fixture(t, { isAppRunning: () => { throw new Error('Mock tasklist failure'); } });
  const result = await unknown.call();
  assert.equal(result.status, 503);
  assert.match(result.body.error, /无法确认/);
  assert.deepEqual(await fs.readFile(unknown.asarPath), unknown.original);
});

test('missing targets, traversal, cache overlap and directory junctions are rejected', async t => {
  const f = await fixture(t);
  assert.equal((await f.call('/api/release-install', 'POST', { cacheId: '../outside' })).status, 400);
  assert.equal((await f.call('/api/release-install', 'POST', { cacheId: f.cacheId, useDefault: false, customPath: path.join(f.workspaceDir, 'downloads') })).status, 400);
  await fs.unlink(f.asarPath);
  assert.equal((await f.call()).status, 404);
  await assert.rejects(fs.stat(f.asarPath), { code: 'ENOENT' });
  await fs.writeFile(f.asarPath, f.original);
  const linked = path.join(f.workspaceDir, 'linked-program');
  await fs.symlink(f.appDir, linked, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await f.call('/api/release-install', 'POST', { cacheId: f.cacheId, useDefault: false, customPath: linked })).status, 400);
  assert.deepEqual(await fs.readFile(f.asarPath), f.original);
});

test('install, downloads and cache deletion share a single write lock', async t => {
  const f = await fixture(t);
  const copyFile = fs.copyFile;
  let allowCopy;
  let enteredCopy;
  const allowed = new Promise(resolve => { allowCopy = resolve; });
  const entered = new Promise(resolve => { enteredCopy = resolve; });
  fs.copyFile = async (source, destination, flags) => {
    if (source === f.cachePath && destination.includes('.app.asar.install-')) { enteredCopy(); await allowed; }
    return copyFile(source, destination, flags);
  };
  try {
    const installing = f.call();
    await entered;
    assert.equal((await f.call('/api/release-download', 'POST', { releaseId: 1 })).status, 409);
    assert.equal((await f.call('/api/release-cache', 'DELETE', { cacheId: f.cacheId })).status, 409);
    assert.equal((await f.call()).status, 409);
    allowCopy();
    assert.equal((await installing).status, 200);
  } finally { allowCopy(); fs.copyFile = copyFile; }
  assert.deepEqual(await fs.readFile(f.asarPath), f.localized);
  assert.deepEqual(await fs.readFile(f.cachePath), f.localized);
});
