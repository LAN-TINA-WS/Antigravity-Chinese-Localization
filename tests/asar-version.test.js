'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { readAsarPackageVersion } = require('../asar-version');

function archive(tree, data = Buffer.alloc(0)) {
  const json = Buffer.from(JSON.stringify(tree), 'utf8');
  const headerSize = 8 + Math.ceil(json.length / 4) * 4;
  const header = Buffer.alloc(headerSize);
  header.writeUInt32LE(headerSize - 4, 0);
  header.writeInt32LE(json.length, 4);
  json.copy(header, 8);
  const prefix = Buffer.alloc(8);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(headerSize, 4);
  return Buffer.concat([prefix, header, data]);
}

function packed(version = '2.23.0', entryChanges = {}) {
  const metadata = Buffer.from(JSON.stringify({ name: 'fixture', version, description: '中文 metadata' }));
  const preceding = Buffer.from('prefix!');
  const entry = { size: metadata.length, offset: String(preceding.length), ...entryChanges };
  return archive({ files: { '前置.txt': { offset: '0', size: preceding.length }, 'package.json': entry } }, Buffer.concat([preceding, metadata]));
}

async function workspace(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'antigravity-asar-version-test-'));
  t.after(async () => {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.match(path.basename(resolved), /^antigravity-asar-version-test-/);
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return directory;
}

test('reads package version at a nonzero offset using UTF-8 byte lengths and Pickle alignment', async t => {
  const directory = await workspace(t);
  const file = path.join(directory, 'app.asar.ready');
  const bytes = packed();
  await fs.writeFile(file, bytes);
  assert.equal(readAsarPackageVersion(file), '2.23.0');
  assert.deepEqual(await fs.readFile(file), bytes, 'reading must not change the archive');
  await fs.writeFile(file, packed('2.24.0-beta.1+build.4'));
  assert.equal(readAsarPackageVersion(file), '2.24.0-beta.1+build.4');
  await fs.writeFile(file, packed(123));
  assert.equal(readAsarPackageVersion(file), null);
});

test('rejects malformed Pickles, truncated data, invalid offsets and excessive lengths', async t => {
  const directory = await workspace(t);
  const valid = packed();
  const badPrefix = Buffer.from(valid); badPrefix.writeUInt32LE(8, 0);
  const hugeHeader = Buffer.from(valid); hugeHeader.writeUInt32LE(0xffffffff, 4);
  const wrongPayload = Buffer.from(valid); wrongPayload.writeUInt32LE(valid.readUInt32LE(8) + 4, 8);
  const negativeJson = Buffer.from(valid); negativeJson.writeInt32LE(-1, 12);
  const invalidUtf8 = Buffer.from(valid); invalidUtf8[16] = 0xff;
  const fixtures = [Buffer.alloc(7), badPrefix, hugeHeader, wrongPayload, negativeJson,
    valid.subarray(0, 20), valid.subarray(0, valid.length - 3), invalidUtf8,
    ...['-1', '1.5', '7trailing', '9007199254740993', '999999999999999', 7].map(offset => packed('2.23.0', { offset })),
    packed('2.23.0', { size: 1024 * 1024 + 1 }), packed('2.23.0', { size: 2.5 }),
    archive({ files: { 'package.json': { link: '../external/package.json', size: 20, offset: '0' } } }),
    archive({ files: [] }), archive({ files: {} })];
  for (let i = 0; i < fixtures.length; i++) {
    const file = path.join(directory, `bad-${i}.asar`);
    await fs.writeFile(file, fixtures[i]);
    assert.equal(readAsarPackageVersion(file), null, `fixture ${i}`);
  }
  assert.equal(readAsarPackageVersion(path.join(directory, 'missing.asar')), null);
  assert.equal(readAsarPackageVersion(directory), null);
  assert.equal(readAsarPackageVersion(null), null);
});

test('unpacked metadata uses only the fixed companion path and rejects directory junctions', async t => {
  const directory = await workspace(t);
  const file = path.join(directory, 'app.asar');
  const metadata = Buffer.from(JSON.stringify({ version: '2.23.1' }));
  await fs.writeFile(file, archive({ files: { 'package.json': { unpacked: true, size: metadata.length } } }));
  assert.equal(readAsarPackageVersion(file), null, 'missing companion package');
  const companion = `${file}.unpacked`;
  await fs.mkdir(companion);
  await fs.writeFile(path.join(companion, 'package.json'), metadata);
  assert.equal(readAsarPackageVersion(file), '2.23.1');
  await fs.writeFile(path.join(companion, 'package.json'), '{}');
  assert.equal(readAsarPackageVersion(file), null, 'metadata size must match the header');
  await fs.rename(companion, `${companion}.saved`);
  const external = path.join(directory, 'external');
  await fs.mkdir(external);
  await fs.writeFile(path.join(external, 'package.json'), metadata);
  await fs.symlink(external, companion, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(readAsarPackageVersion(file), null, 'unpacked directory link must not be followed');
});
