import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { launchGame, findChrome, lanUrls } from '../scripts/play.mjs';
import { createServer } from '../scripts/dev.mjs';

assert.deepEqual(lanUrls(8767, { Ethernet: [
  { family:'IPv4',internal:false,address:'192.168.1.24' },
  { family:4,internal:false,address:'192.168.1.24' },
  { family:'IPv4',internal:true,address:'127.0.0.1' },
  { family:'IPv6',internal:false,address:'fe80::1' },
  { family:'IPv4',internal:false,address:'169.254.1.1' },
] }), ['http://192.168.1.24:8767'], 'only usable unique LAN IPv4 addresses are printed');

let opened = 0;
const game = await launchGame({ port: 0, open: async url => {
  const response = await fetch(url);
  assert(response.ok && (await response.text()).includes('Frogue Gallery'), 'server is ready before Chrome is opened');
  opened++;
} });
try {
  assert.equal(game.server.address().address, '0.0.0.0');
  assert.equal((await fetch(game.url)).headers.get('x-frogue-bind'), '0.0.0.0');
  for (const url of game.lanUrls) {
    const response = await fetch(url, { signal:AbortSignal.timeout(2500) });
    assert(response.ok && (await response.text()).includes('Frogue Gallery'), `game responds on network interface ${url}`);
  }
  await assert.rejects(launchGame({port:game.server.address().port,open:()=>{opened++;}}),/already in use/);
  assert.equal(opened,1,'a second launcher cannot reuse a server owned by another window');
  assert(game.server.listening,'conflict never kills the first server');
  assert.equal((await fetch(game.url + '/scripts/launch.ps1')).status, 404, 'launcher is not exposed by the runtime server');
} finally { await new Promise(resolve => game.server.close(resolve)); }

const localOnly = createServer();
await new Promise(resolve => localOnly.listen(0, '127.0.0.1', resolve));
try {
  await assert.rejects(launchGame({ port:localOnly.address().port, open:()=>{ throw new Error('must not advertise a loopback preview'); } }), /already in use/);
  assert(localOnly.listening, 'launcher never stops the existing preview');
} finally { await new Promise(resolve => localOnly.close(resolve)); }

const foreign = http.createServer((req, res) => res.end('Not this game'));
await new Promise(resolve => foreign.listen(0, '127.0.0.1', resolve));
try {
  await assert.rejects(launchGame({ port: foreign.address().port, open: () => { throw new Error('must not open unrelated server'); } }), /already in use/);
} finally { await new Promise(resolve => foreign.close(resolve)); }
await assert.rejects(findChrome({}), /Chrome was not found/);
// Real foreground CLI owns its listener for its lifetime, with no daemon left.
const child=spawn(process.execPath,['scripts/play.mjs','--no-browser','--port','0'],{stdio:['ignore','pipe','pipe']});
const exited=new Promise(resolve=>child.once('exit',resolve));
try {
  const url=await new Promise((resolve,reject)=>{
    let output='';const timer=setTimeout(()=>reject(new Error('Launcher did not become ready')),5000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/Frogue Gallery: (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
  });
  assert((await fetch(url)).ok,'foreground process serves while alive');
  child.kill('SIGTERM');await exited;
  await assert.rejects(fetch(url,{signal:AbortSignal.timeout(1500)}),'exiting the server process releases its port');
} finally {if(child.exitCode===null&&!child.killed)child.kill();await exited;}
console.log('LAUNCHER CHECKS PASSED: foreground lifecycle, no reuse, LAN binding/HTTP, ready-before-open, conflicts and Chrome diagnostics.');
