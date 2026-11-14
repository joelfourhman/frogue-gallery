import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer, ROOT } from '../scripts/dev.mjs';
import { RUNTIME_FILES, verifyArtifact } from '../scripts/artifact.mjs';
import { createPreview } from '../scripts/preview.mjs';

const build = () => { const r = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
build();
const zipPath = path.join(ROOT, 'dist', 'frogue-gallery.zip'), zip = await fs.readFile(zipPath);
const stale = path.join(ROOT, 'dist', 'frogue-gallery', 'obsolete.js');
await fs.writeFile(stale, 'stale generated output');
build(); assert.deepEqual(await fs.readFile(zipPath), zip, 'same source creates byte-identical ZIPs');
await assert.rejects(fs.access(stale), 'rebuild removes obsolete generated files');
const manifest = JSON.parse(await fs.readFile(path.join(ROOT, 'dist', 'manifest.json'), 'utf8'));
const artifact = path.join(ROOT, 'dist', 'frogue-gallery');
const verify = () => verifyArtifact(artifact, path.join(ROOT, 'dist', 'manifest.json'), zipPath);
await verify();
assert.deepEqual(manifest.files.map(x => x.file), [...RUNTIME_FILES]);
for (const name of ['.env', '_worker.js', 'secret.log']) {
  await fs.writeFile(path.join(artifact, name), 'unexpected');
  await assert.rejects(verify(), /Unexpected artifact path/);
  await fs.unlink(path.join(artifact, name));
}
await fs.mkdir(path.join(artifact, 'functions'));
await assert.rejects(verify(), /Unexpected artifact path/);
await fs.rmdir(path.join(artifact, 'functions'));
const bootPath = path.join(artifact, 'src', 'boot.js'), bootBytes = await fs.readFile(bootPath);
await fs.appendFile(bootPath, '\n// tampered');
await assert.rejects(verify(), /hash mismatch/);
await fs.writeFile(bootPath, bootBytes);
// Directory junctions work on Windows without symlink privileges.
const linkPath = path.join(artifact, 'linked');
try {
  await fs.symlink(path.join(ROOT, 'src'), linkPath, 'junction');
  try { await assert.rejects(verify(), /Symlink/); }
  finally { await fs.unlink(linkPath); }
} catch (error) {
  if (!['EPERM', 'EACCES'].includes(error.code)) throw error;
  console.log('Symlink creation unavailable in this environment; rejection code retained.');
}
await verify();
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
    if (item.file === '_headers') { assert.equal((await fetch(base + '/_headers')).status, 404); continue; }
    const r = await fetch(base + '/' + item.file); assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
  }
  for (const name of ['/.git/config', '/PROJECT_STATE.md', '/%2e%2e/README.md', '/src/%2e%2e/AGENTS.md', '/%ZZ']) assert.equal((await fetch(base + name)).status, 404);
  assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
  console.log(`PACKAGE CHECKS PASSED: ${manifest.files.length} runtime files, reproducible ZIP, static server allowlist.`);
} finally { await new Promise(resolve => server.close(resolve)); }
const preview = await createPreview();
await new Promise(resolve => preview.listen(0, '127.0.0.1', resolve));
try {
  const base = `http://127.0.0.1:${preview.address().port}`;
  for (const name of ['/', '/src/boot.js', '/favicon.svg']) {
    const response = await fetch(base + name);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    assert.match(response.headers.get('content-security-policy'), /script-src 'self';/);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  }
  for (const name of ['/nonexistent', '/.git/config', '/.env', '/scripts/launch.ps1', '/deployment.md', '/PROJECT_STATE.md', '/_headers']) {
    const response = await fetch(base + name);
    assert.equal(response.status, 404);
    assert.match(await response.text(), /This trail fades into the reeds/);
  }
  console.log('DEPLOYMENT PACKAGE PASSED: exact allowlist, tamper/symlink rejection, CSP, cache and 404 policy.');
} finally { await new Promise(resolve => preview.close(resolve)); }
await import('./launcher.mjs');
