import assert from 'node:assert/strict';
import http from 'node:http';
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
  const again = await launchGame({ port: game.server.address().port, open: async url => {
    assert.equal(url, game.url); opened++;
  } });
  assert(again.reused); assert.equal(again.server, null); assert.equal(opened, 2);
  assert.equal((await fetch(game.url + '/scripts/launch.ps1')).status, 404, 'launcher is not exposed by the runtime server');
} finally { await new Promise(resolve => game.server.close(resolve)); }

const localOnly = createServer();
await new Promise(resolve => localOnly.listen(0, '127.0.0.1', resolve));
try {
  await assert.rejects(launchGame({ port:localOnly.address().port, open:()=>{ throw new Error('must not advertise a loopback preview'); } }), /local-only preview/);
  assert(localOnly.listening, 'launcher never stops the existing preview');
} finally { await new Promise(resolve => localOnly.close(resolve)); }

const foreign = http.createServer((req, res) => res.end('Not this game'));
await new Promise(resolve => foreign.listen(0, '127.0.0.1', resolve));
try {
  await assert.rejects(launchGame({ port: foreign.address().port, open: () => { throw new Error('must not open unrelated server'); } }), /another server/);
} finally { await new Promise(resolve => foreign.close(resolve)); }
await assert.rejects(findChrome({}), /Chrome was not found/);
console.log('LAUNCHER CHECKS PASSED: ready-before-open, all-interface binding, LAN HTTP, safe reuse, local-only refusal, port conflict and missing Chrome.');
