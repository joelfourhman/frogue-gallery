import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer, ROOT } from '../scripts/dev.mjs';

const build = () => { const r = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
build();
const zipPath = path.join(ROOT, 'dist', 'frogue-gallery.zip'), zip = await fs.readFile(zipPath);
const stale = path.join(ROOT, 'dist', 'frogue-gallery', 'obsolete.js');
await fs.writeFile(stale, 'stale generated output');
build(); assert.deepEqual(await fs.readFile(zipPath), zip, 'same source creates byte-identical ZIPs');
await assert.rejects(fs.access(stale), 'rebuild removes obsolete generated files');
const manifest = JSON.parse(await fs.readFile(path.join(ROOT, 'dist', 'manifest.json'), 'utf8'));
assert.equal(manifest.zipSha256, crypto.createHash('sha256').update(zip).digest('hex'));
assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
assert.equal(zip.readUInt16LE(zip.length - 12), manifest.files.length);
let offset = 0;
for (const item of manifest.files) {
  assert.equal(zip.readUInt32LE(offset), 0x04034b50);
  const n = zip.readUInt16LE(offset + 26), len = zip.readUInt32LE(offset + 18);
  assert.equal(zip.subarray(offset + 30, offset + 30 + n).toString(), item.file);
  const data = zip.subarray(offset + 30 + n, offset + 30 + n + len);
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'), item.sha256);
  assert.deepEqual(await fs.readFile(path.join(ROOT, 'dist', 'frogue-gallery', item.file)), data);
  offset += 30 + n + len;
}
const server = createServer(path.join(ROOT, 'dist', 'frogue-gallery'));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const item of manifest.files) {
    const r = await fetch(base + '/' + item.file); assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
  }
  for (const name of ['/.git/config', '/PROJECT_STATE.md', '/%2e%2e/README.md', '/src/%2e%2e/AGENTS.md', '/%ZZ']) assert.equal((await fetch(base + name)).status, 404);
  assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
  console.log(`PACKAGE CHECKS PASSED: ${manifest.files.length} runtime files, reproducible ZIP, static server allowlist.`);
} finally { await new Promise(resolve => server.close(resolve)); }
