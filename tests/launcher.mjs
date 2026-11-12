import assert from 'node:assert/strict';
import http from 'node:http';
import { launchGame, findChrome } from '../scripts/play.mjs';

let opened = 0;
const game = await launchGame({ port: 0, open: async url => {
  const response = await fetch(url);
  assert(response.ok && (await response.text()).includes('Frogue Gallery'), 'server is ready before Chrome is opened');
  opened++;
} });
try {
  assert.equal(game.server.address().address, '127.0.0.1');
  const again = await launchGame({ port: game.server.address().port, open: async url => {
    assert.equal(url, game.url); opened++;
  } });
  assert(again.reused); assert.equal(again.server, null); assert.equal(opened, 2);
  assert.equal((await fetch(game.url + '/scripts/launch.ps1')).status, 404, 'launcher is not exposed by the runtime server');
} finally { await new Promise(resolve => game.server.close(resolve)); }

const foreign = http.createServer((req, res) => res.end('Not this game'));
await new Promise(resolve => foreign.listen(0, '127.0.0.1', resolve));
try {
  await assert.rejects(launchGame({ port: foreign.address().port, open: () => { throw new Error('must not open unrelated server'); } }), /another server/);
} finally { await new Promise(resolve => foreign.close(resolve)); }
await assert.rejects(findChrome({}), /Chrome was not found/);
console.log('LAUNCHER CHECKS PASSED: ready-before-open, loopback, safe reuse, port conflict and missing Chrome.');
