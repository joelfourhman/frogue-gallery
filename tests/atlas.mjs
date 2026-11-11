import assert from 'node:assert/strict';
import { fieldAtlasSnapshot, FIELD_STUDIES, STUDIO, CROSSING } from '../src/logic.js';
import { atlasLayout, atlasButton, atlasForGame } from '../src/atlas.js';

const swamp = fieldAtlasSnapshot({ player: { x: 2200, y: 750 }, crossingState: 'unpainted',
  studies: [{ id: 'first-light', step: 3 }, { id: 'rain-choir', step: 1, coats: 2 }] });
assert.equal(swamp.studies.length, 3);
assert.equal(swamp.next.id, 'rain-choir');
assert.equal(swamp.studies[1].color, 'blue');
assert.equal(swamp.studies[1].coats, 2);
assert.equal(swamp.studies[0].complete, true);
assert.deepEqual(swamp.crossing, { x: CROSSING.x, y: CROSSING.y, state: 'unpainted' });
const done = fieldAtlasSnapshot({ studies: FIELD_STUDIES.map(s => ({ id: s.id, step: 3 })) });
assert.equal(done.next, null);
const memory = fieldAtlasSnapshot({ remembered: ['first-light'] });
assert.equal(memory.studies[0].remembered, true);
assert.equal(memory.studies[0].complete, false, 'saved memory does not fake this-run progress');
assert.equal(memory.studies[1].remembered, false);
for (const mode of [{ challenge: true }, { wander: true }]) {
  const a = fieldAtlasSnapshot({ ...mode, crossingState: 'crossing', mothFlower: { x: 2650, y: 300 } });
  assert.equal(a.studies.length, 0); assert.equal(a.crossing, null); assert.equal(a.moth, null);
}
const reeds = fieldAtlasSnapshot({ biome: 'reeds', width: 6000, player: { x: 100, y: 700 },
  mothFlower: { x: 2650, y: 300, green: true, resting: true }, crossingState: 'crossing',
  rests: [{ x: 1000, y: 430 }] });
assert.deepEqual(reeds.studies.map(s => s.id), ['echo-pool', 'lantern-garden']);
assert.equal(reeds.next.id, 'echo-pool'); assert.equal(reeds.crossing, null);
assert.equal(reeds.moth.resting, true); assert.equal(reeds.rests.length, 1);
const black = fieldAtlasSnapshot({ biome: 'blackReeds', mothFlower: { x: 2650, y: 300 } });
assert.equal(black.studies.length, 0); assert.equal(black.moth, null);
const malformed = fieldAtlasSnapshot({ player: { x: NaN, y: Infinity }, width: -1, height: NaN,
  studies: [{ id: 'first-light', step: -10, coats: 100 }], rests: {},
  checkpoints: Array.from({ length: 100 }, () => ({ x: 1, y: 2 })) });
assert.equal(malformed.width, 5400); assert.equal(malformed.height, 1500);
assert.equal(malformed.studies[0].step, 0); assert.equal(malformed.studies[0].coats, STUDIO.coats);
assert.equal(malformed.checkpoints.length, 4);
assert.equal(fieldAtlasSnapshot({ studies: null }).studies.length, 3);
assert.equal(fieldAtlasSnapshot({ biome: 'reeds', rests: [null, { x: NaN, y: 0 }] }).rests.length, 0);

// Called by smoke with its established real-Game harness; no globals replaced.
export function runAtlasGameTests(Game, makeCanvas) {
  const g = new Game(makeCanvas()); g._beginExpedition();
  const before = JSON.stringify(g.save), time = g.runT, playerX = g.player.x;
  g.input.keys.add('d'); g.input.mouse.rDown = true; g.player.splashCharge = .7;
  g._openAtlas();
  assert.equal(g._atlasOpen, true); assert.equal(g.input.keys.size, 0); assert.equal(g.input.mouse.rDown, false);
  assert.equal(g.player.splashCharge, 0, 'opening a menu cancels a held splash');
  assert.equal(g._gpMenuList().id, 'atlas');
  const worldUpdate = g.world.update;
  g.world.update = () => { throw new Error('atlas advanced world simulation'); };
  g._frame(g.last + 50); g._frame(g.last + 50);
  g.world.update = worldUpdate;
  assert.equal(g.runT, time); assert.equal(g.player.x, playerX);
  assert.equal(JSON.stringify(g.save), before, 'viewing atlas never writes progression');
  const close = atlasLayout(g).close;
  g.input.mouse.x = close.x + 10; g.input.mouse.y = close.y + 10; g.input.mouse.lPressed = true;
  g._updateAtlas(); assert.equal(g._atlasOpen, false); assert.equal(g.input.mouse.lPressed, false);
  g.paused = true; g._openAtlas(); g._gpMenuBack();
  assert.equal(g._atlasOpen, false); assert.equal(g.paused, true, 'return preserves underlying pause');
  const button = atlasButton(); assert(g._gpMenuList().list.some(r => r.x === button.x && r.y === button.y));
  g.paused = false; g._openAtlas(); g.input.kb.add('escape'); g._updateAtlas();
  assert.equal(g.state, 'expedition'); assert.equal(g._atlasOpen, false);
  g._openAtlas(); g.input.kb.add('v'); g._updateAtlas(); assert.equal(g._atlasOpen, false);
  g.help = true; g._openAtlas(); assert.equal(g._atlasOpen, false); g.help = false;
  g._bookOpen = true; g._openAtlas(); assert.equal(g._atlasOpen, false); g._bookOpen = false;
  g.dying = true; g._openAtlas(); assert.equal(g._atlasOpen, false); g.dying = false;
  g._zoneBeat(g.zones[0]); assert.equal(g._atlasCheckpoints.length, 1);
  assert.deepEqual(atlasForGame(g).checkpoints, g._atlasCheckpoints);
  g._openAtlas(); g._beginExpedition();
  assert.equal(g._atlasOpen, false); assert.equal(g._atlasCheckpoints.length, 0);
  g._openAtlas(); g._quitToTitle(); assert.equal(g._atlasOpen, false);
  console.log('Field Atlas real Game pause, close, controller focus, save purity and restart PASS');
}
console.log('Field Atlas selectors, progress, nearest study, mode gates and bounded points PASS');
