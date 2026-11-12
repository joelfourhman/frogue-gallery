// Windows double-click launcher. The server stays in this console; Chrome is
// independent. Never reuse another process: closing this console stops hosting.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { connect } from 'node:net';
import { createServer } from './dev.mjs';

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
  const occupied = () => new Error(`Port ${port} is already in use. Close the existing server window, then launch again. This window must own the server so closing it stops hosting.`);
  // Windows may allow a wildcard listener alongside a loopback listener.
  // Refuse every occupied local port, including matching/older game servers.
  if (port > 0 && await new Promise(resolve => {
    const socket = connect({host:'127.0.0.1',port});
    const done = occupied => { socket.destroy(); resolve(occupied); };
    socket.once('connect',()=>done(true));
    socket.once('error',error=>done(error.code!=='ECONNREFUSED'));
    socket.setTimeout(1500,()=>done(true));
  })) throw occupied();
  try {
    await new Promise((resolve,reject)=>{
      server.once('error',reject);server.listen(port,'0.0.0.0',resolve);
    });
  } catch(error) {
    if(error.code==='EADDRINUSE')throw occupied();
    throw error;
  }
  const url = `http://127.0.0.1:${server.address().port}`;
  try { await open(url); }
  catch (error) { await new Promise(resolve => server.close(resolve)); throw error; }
  return { url, lanUrls: lanUrls(server.address().port), server };
}

export function lanUrls(port, interfaces = networkInterfaces()) {
  return [...new Set(Object.values(interfaces).flat().filter(address => address &&
    !address.internal && (address.family === 'IPv4' || address.family === 4) &&
    !address.address.startsWith('169.254.') && address.address !== '0.0.0.0')
    .map(address => `http://${address.address}:${port}`))].sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    // --no-browser supports a launch check without opening a user tab.
    const chrome = process.argv.includes('--no-browser') ? null : await findChrome();
    const portIndex=process.argv.indexOf('--port');
    const port=portIndex<0?8767:Number(process.argv[portIndex+1]);
    if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Use --port 0..65535');
    const result = await launchGame({port, open: chrome ? url => openChrome(chrome, url) : undefined });
    console.log(`Frogue Gallery: ${result.url}`);
    console.log(`Listening on all IPv4 interfaces (0.0.0.0:${result.server.address().port}).`);
    for (const url of result.lanUrls) console.log(`LAN players: ${url}`);
    if (!result.lanUrls.length) console.log('No LAN IPv4 address found. Connect this computer to your network, then launch again.');
    console.log('This window is the game server. Closing it or pressing Ctrl+C stops hosting.');
    const stop=()=>{result.server.close(()=>process.exit(0));result.server.closeAllConnections();};
    process.once('SIGINT',stop);process.once('SIGTERM',stop);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
