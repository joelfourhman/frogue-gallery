// Explicit public-file boundary shared by packaging and release verification.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const RUNTIME_FILES = Object.freeze([
  'index.html', 'favicon.svg',
  ...['atlas', 'audio', 'boot', 'combat-ui', 'dungeon', 'encounter', 'enemies',
    'game', 'input', 'journey-ui', 'logic', 'math', 'music', 'paint', 'particles',
    'player', 'repaint', 'save', 'score', 'studio', 'ui', 'wildlife', 'world'].map(n => `src/${n}.js`),
  '_headers', '404.html',
]);
export const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

export async function regularFile(file) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Not a regular file: ${file}`);
  return fs.readFile(file);
}

export async function verifyArtifact(folder, manifestFile, zipFile) {
  const found = [];
  async function walk(dir, prefix = '') {
    const stat = await fs.lstat(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Not a regular directory: ${dir}`);
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const name = prefix + entry.name, full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlink in artifact: ${name}`);
      if (entry.isDirectory() && name === 'src') await walk(full, 'src/');
      else if (entry.isFile() && RUNTIME_FILES.includes(name)) found.push(name);
      else throw new Error(`Unexpected artifact path: ${name}`);
    }
  }
  await walk(folder);
  if (JSON.stringify(found.sort()) !== JSON.stringify([...RUNTIME_FILES].sort())) throw new Error('Artifact file set differs from allowlist');
  const manifest = JSON.parse(await regularFile(manifestFile));
  if (!Array.isArray(manifest.files) || manifest.files.length !== found.length || new Set(manifest.files.map(x => x.file)).size !== found.length) throw new Error('Invalid manifest file set');
  for (const item of manifest.files) {
    if (!RUNTIME_FILES.includes(item.file)) throw new Error(`Unexpected manifest path: ${item.file}`);
    const data = await regularFile(path.join(folder, item.file));
    if (data.length !== item.bytes || sha256(data) !== item.sha256) throw new Error(`Artifact hash mismatch: ${item.file}`);
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b/.test(data.toString())) throw new Error(`Possible credential in ${item.file}`);
  }
  if (sha256(await regularFile(zipFile)) !== manifest.zipSha256) throw new Error('ZIP hash mismatch');
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const release = path.resolve(process.argv[2] || 'dist');
  const manifest = await verifyArtifact(path.join(release, 'frogue-gallery'), path.join(release, 'manifest.json'), path.join(release, 'frogue-gallery.zip'));
  console.log(`ARTIFACT VERIFIED: ${manifest.files.length} allowlisted files; ZIP SHA-256 ${manifest.zipSha256}`);
}
