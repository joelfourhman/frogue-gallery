// Local harness for the shipped Pages headers. Not an internet host.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, ROOT } from './dev.mjs';

export async function deploymentPolicy(root) {
  const lines = (await fs.readFile(path.join(root, '_headers'), 'utf8')).trim().split(/\r?\n/);
  if (lines.shift() !== '/*') throw new Error('Preview expects one global header rule');
  const headers = {};
  for (const line of lines) {
    const match = line.match(/^\s+([A-Za-z-]+): (.+)$/);
    if (!match || headers[match[1]]) throw new Error(`Unsupported header rule: ${line}`);
    headers[match[1]] = match[2];
  }
  return { headers, notFound: await fs.readFile(path.join(root, '404.html'), 'utf8') };
}
export async function createPreview(root = path.join(ROOT, 'dist', 'frogue-gallery')) {
  return createServer(root, await deploymentPolicy(root));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createPreview(process.argv[2] && path.resolve(process.argv[2]));
  server.listen(0, '127.0.0.1', () => console.log(`Policy preview: http://127.0.0.1:${server.address().port}`));
}
