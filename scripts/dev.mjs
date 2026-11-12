// Dependency-free static server. CLI defaults to loopback; LAN is opt-in.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
export function createServer(root = ROOT) {
  const server = http.createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const name = pathname === '/' ? '/index.html' : pathname;
      // Serve only the distributable game, never Git, docs, logs, or dotfiles.
      if (!/^\/(index\.html|favicon\.svg|src\/[a-z0-9_-]+\.js)$/.test(name)) { res.writeHead(404); res.end('Not found'); return; }
      const data = await fs.readFile(path.join(root, name));
      res.writeHead(200, { 'Content-Type': mime[path.extname(name)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frogue-Bind': server.address()?.address || '' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--port');
  const port = i >= 0 ? Number(process.argv[i + 1]) : 8765;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Use --port 1..65535');
  const hi = process.argv.indexOf('--host');
  const host = hi >= 0 ? process.argv[hi + 1] : '127.0.0.1';
  if (!['127.0.0.1', '0.0.0.0'].includes(host)) throw new Error('Use --host 127.0.0.1 or --host 0.0.0.0');
  const root = process.argv.includes('--dist') ? path.join(ROOT, 'dist', 'frogue-gallery') : ROOT;
  const server = createServer(root);
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Choose --port 8766.` : error.message); process.exitCode = 1; });
  server.listen(port, host, () => console.log(`Frogue Gallery: http://127.0.0.1:${port}\nListening on ${host}:${port}. Ctrl+C stops the server.`));
}
