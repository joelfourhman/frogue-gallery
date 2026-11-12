// Windows double-click launcher. The server stays in this console; Chrome is
// independent. Reusing the preview's origin also preserves browser-local saves.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer, ROOT } from './dev.mjs';

export async function findChrome(env = process.env) {
  const roots = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean);
  for (const root of roots) {
    const candidate = path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe');
    try { await fs.access(candidate); return candidate; } catch { /* try next installation */ }
  }
  throw new Error('Google Chrome was not found. Install Chrome, then double-click Launch Game.cmd again.');
}

async function openChrome(executable, url) {
  const child = spawn(executable, [url], { detached: true, stdio: 'ignore' });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  child.unref();
}

export async function launchGame({ port = 8767, open = async () => {} } = {}) {
  const server = createServer();
  let reused = false;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    // Never open an unrelated service or silently switch to a new save origin.
    try {
      const response = await fetch(`http://127.0.0.1:${port}/src/game.js`, { signal: AbortSignal.timeout(2500) });
      const local = await fs.readFile(path.join(ROOT, 'src', 'game.js'), 'utf8');
      if (!response.ok || await response.text() !== local) throw new Error('different server');
    } catch {
      throw new Error(`Port ${port} is in use by another server. Stop it, then launch again.`);
    }
    reused = true;
  }
  const url = `http://127.0.0.1:${reused ? port : server.address().port}`;
  try { await open(url); }
  catch (error) { if (!reused) await new Promise(resolve => server.close(resolve)); throw error; }
  return { url, reused, server: reused ? null : server };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    // --no-browser supports a launch check without opening a user tab.
    const chrome = process.argv.includes('--no-browser') ? null : await findChrome();
    const result = await launchGame({ open: chrome ? url => openChrome(chrome, url) : undefined });
    console.log(`Frogue Gallery: ${result.url}`);
    console.log(result.reused ? 'Using the game server already running.' : 'Keep this window open while playing. Ctrl+C stops the game server.');
    if (result.server) process.once('SIGINT', () => result.server.close(() => process.exit(0)));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
