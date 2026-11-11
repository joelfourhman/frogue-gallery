import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PondLife, WILDLIFE_CAP, WILDLIFE_REACTION_SECONDS } from '../src/wildlife.js';
import { World } from '../src/world.js';
import { mulberry32 } from '../src/math.js';

const life = new PondLife(81, 5400, 1500);
assert.equal(life.creatures.length, WILDLIFE_CAP);
assert.deepEqual(life, new PondLife(81, 5400, 1500), 'same seed reproduces decorative population');
assert.notDeepEqual(life.creatures, new PondLife(82, 5400, 1500).creatures);
const originalRandom = Math.random;
Math.random = () => { throw Error('Wildlife consumed gameplay RNG'); };
try {
  const isolated = new PondLife(123, 5400, 1500);
  isolated.paint(isolated.creatures[0].x, isolated.creatures[0].y, 'blue');
  isolated.update(1 / 60);
} finally { Math.random = originalRandom; }

const fly = life.creatures[0], before = JSON.stringify(life);
for (const color of ['dry', 'purple', '__proto__', 'constructor']) life.paint(fly.x, fly.y, color);
life.paint(NaN, fly.y, 'blue'); life.paint(fly.x, Infinity, 'green');
life.paint(-999, -999, 'red');
assert.equal(JSON.stringify(life), before, 'invalid, dry and distant paint has no response');
life.paint(fly.x + 50, fly.y, 'blue');
assert.equal(fly.reaction, WILDLIFE_REACTION_SECONDS);
assert.equal(fly.color, '#528fc4');
life.update(0.2);
const afterFirst = fly.reaction;
for (let i = 0; i < 1000; i++) life.paint(fly.x, fly.y, 'red');
assert.equal(fly.reaction, afterFirst, 'multiple splats do not restart the first ripple frame');
assert.equal(life.creatures.length, WILDLIFE_CAP, 'paint never allocates more wildlife');
const frozen = JSON.stringify(life);
for (const dt of [0, -1, NaN, Infinity]) life.update(dt);
assert.equal(JSON.stringify(life), frozen, 'paused/invalid delta cannot advance wildlife');
life.update(10);
assert(life.creatures.every(f => f.reaction === 0 && f.color === ''), 'offscreen reactions expire completely');
for (let i = 0; i < 10000; i++) {
  if (i % 10 === 0) life.paint(fly.x + 130, fly.y + 50, ['red', 'blue', 'green'][i % 3]);
  life.update(0.1);
}
for (const f of life.creatures) {
  assert([f.x, f.y, f.reaction, f.targetX, f.targetY].every(Number.isFinite));
  assert(Math.abs(f.x - f.homeX) <= 113 && Math.abs(f.y - f.homeY) <= 77, 'curiosity never drifts away indefinitely');
}

let commands = 0, translations = [];
const ctx = new Proxy({}, {
  get: (target, key) => key === 'translate' ? (x, y) => { translations.push([x, y]); }
    : (...args) => { commands++; assert(args.every(v => typeof v !== 'number' || Number.isFinite(v)), 'finite Canvas geometry'); },
  set: () => true,
});
assert.equal(life.draw(ctx, { x: -10000, y: -10000, w: 800, h: 500, scale: 1 }, 1), 0);
assert.equal(commands, 0, 'offscreen wildlife makes no Canvas calls');
const fullView = { x: 0, y: 0, w: 5400, h: 1500, scale: 1 };
const drawState = JSON.stringify(life);
assert.equal(life.draw(ctx, fullView, 1), WILDLIFE_CAP);
const calm = translations[0]; translations = [];
life.draw(ctx, fullView, 1, fly.x - 10, fly.y);
assert(translations[0][0] > calm[0], 'nearby frog causes a decorative sidestep');
assert.equal(JSON.stringify(life), drawState, 'draw does not mutate even when reacting to frog');
translations = [];
life.draw(ctx, fullView, 0, fly.x, fly.y);
assert(translations.flat().every(Number.isFinite), 'exact frog/wildlife overlap remains finite');

// Captured from HEAD before wildlife was added: geometry and the shared RNG
// position must remain identical, including both Reeds light economies.
const baselines = [
  [{}, 2735, '1563d4c6e02d18e8d9f82d46c77e638543f7fc17703fa7a82acf60046382d35e', 0.3214959215838462],
  [{ reeds: true }, 2950, 'd47be8a414a3bef30577a7fffc6382a9723f6fc19d7e8c66d67b0ac33fcda884', 0.842086739372462],
  [{ reeds: true, blackReeds: true }, 3523, '3a5b2fc4ce66b72579dd4d018d2d5dc09ecce1bacb84eefcc0258281a3496b8a', 0.3136965613812208],
];
const previousDocument = globalThis.document;
const stub = new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true });
globalThis.document = { createElement: () => ({ getContext: () => stub }) };
try {
  for (const [opts, expectedCalls, hash, next] of baselines) {
    let calls = 0; const rng = mulberry32(81);
    const world = new World(() => { calls++; return rng(); }, 81, opts);
    const data = JSON.stringify([world.obstacles, world.veg, world.pads, world.soil, world.fireflies, world.restSpots]);
    assert.equal(createHash('sha256').update(data).digest('hex'), hash, 'terrain/economy generation unchanged');
    assert.equal(calls, expectedCalls); assert.equal(rng(), next, 'shared stream position unchanged');
    assert.equal(world.pondLife.reeds, !!opts.reeds);
    assert.equal(world.pondLife.dark, !!opts.blackReeds);
    const f = world.pondLife.creatures[0];
    world.splat(f.x, f.y, 'blue', 10, true);
    assert.equal(f.reaction, WILDLIFE_REACTION_SECONDS, 'actual world paint routes response');
    world.update(1);
    assert(f.reaction < WILDLIFE_REACTION_SECONDS, 'actual world update ages response');
    assert.equal(new World(mulberry32(81), 81, opts).pondLife.creatures[0].reaction, 0, 'fresh world resets all reactions');
  }
} finally {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
}
console.log('Pond wildlife: bounded storage, paint response, pause/expiry, finite/cull rendering, biome and RNG isolation PASS');
