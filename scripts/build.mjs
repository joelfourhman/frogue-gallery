// Reproducible static distribution + ZIP. Node standard library only.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from './dev.mjs';
import { RUNTIME_FILES, regularFile, verifyArtifact } from './artifact.mjs';

const destination = path.join(ROOT, 'dist', 'frogue-gallery');
const names = RUNTIME_FILES;
for (const dir of ['src', 'deploy']) {
  const stat = await fs.lstat(path.join(ROOT, dir));
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Invalid source directory: ${dir}`);
}
// This directory is generated output, never source. Verify its resolved path
// before replacing it so removed runtime files cannot survive a later build.
if (path.relative(ROOT, path.resolve(destination)) !== path.join('dist', 'frogue-gallery')) throw new Error('Invalid build destination');
await fs.mkdir(path.join(ROOT, 'dist'), { recursive: true });
const distStat = await fs.lstat(path.join(ROOT, 'dist'));
if (!distStat.isDirectory() || distStat.isSymbolicLink()) throw new Error('Invalid dist directory');
await fs.rm(destination, { recursive: true, force: true });
await fs.mkdir(path.join(destination, 'src'), { recursive: true });
const entries = [], manifest = [];
for (const name of names) {
  const source = await regularFile(path.join(ROOT, ['_headers', '404.html'].includes(name) ? 'deploy' : '', name));
  // All allowlisted assets are UTF-8 text. Git's Windows checkout conversion
  // must not make the locally verified artifact differ from Cloudflare's build.
  const data = Buffer.from(source.toString('utf8').replace(/\r\n/g, '\n'));
  await fs.writeFile(path.join(destination, name), data);
  entries.push({ name, data });
  manifest.push({ file: name, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') });
}
// ZIP "store" format is sufficient for this small game; no dependency or
// platform-specific compressor. Fixed DOS date makes identical sources byte-
// identical, independent of machine timezone and file modification times.
const table = Array.from({ length: 256 }, (_, n) => { for (let j = 0; j < 8; j++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1; return n >>> 0; });
const crc32 = data => { let c = 0xffffffff; for (const byte of data) c = table[(c ^ byte) & 255] ^ c >>> 8; return (c ^ 0xffffffff) >>> 0; };
const locals = [], central = []; let offset = 0;
for (const { name, data } of entries) {
  const nameBuf = Buffer.from(name), crc = crc32(data), local = Buffer.alloc(30), directory = Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x21, 12);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
  directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(0x21, 14);
  directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(data.length, 24); directory.writeUInt16LE(nameBuf.length, 28); directory.writeUInt32LE(offset, 42);
  locals.push(local, nameBuf, data); central.push(directory, nameBuf);
  offset += local.length + nameBuf.length + data.length;
}
const centralBuf = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...locals, centralBuf, end]);
await fs.writeFile(path.join(ROOT, 'dist', 'frogue-gallery.zip'), zip);
await fs.writeFile(path.join(ROOT, 'dist', 'manifest.json'), JSON.stringify({ milestone: 'The Living Sketchbook', files: manifest, zipSha256: crypto.createHash('sha256').update(zip).digest('hex') }, null, 2) + '\n');
await verifyArtifact(destination, path.join(ROOT, 'dist', 'manifest.json'), path.join(ROOT, 'dist', 'frogue-gallery.zip'));
console.log(`BUILD READY: dist/frogue-gallery/ and dist/frogue-gallery.zip (${entries.length} files, ${Math.ceil(zip.length / 1024)} KiB)`);
