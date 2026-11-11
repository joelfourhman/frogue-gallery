import assert from 'node:assert/strict';
import { Player } from '../src/player.js';
import { makeTuning, movementVelocity, cycleCombatPigment, brushHitsCircle, splashChargeStep } from '../src/logic.js';
import { drawCombatReadout } from '../src/combat-ui.js';

const tuning = makeTuning();
const world = { collideCircle: (x, y) => [x, y], pigmentAt: () => ({}) };
let direction = [1, 0], hop = false;
const input = { moveVec: () => direction, pressed: () => hop, mouse: { worldX: 1000, worldY: 0 } };
const p = new Player(0, 0, tuning);
for (let i = 0; i < 60; i++) p.update(1 / 60, input, tuning, world);
assert(Math.abs(p.vx - 230) < 0.01, 'walking top speed stays 230');
const releaseX = p.x; direction = [0, 0];
for (let i = 0; i < 30; i++) p.update(1 / 60, input, tuning, world);
assert(p.x - releaseX < 5 && p.vx === 0, 'release stops within five pixels without residual creep');
direction = [1, 0]; for (let i = 0; i < 60; i++) p.update(1 / 60, input, tuning, world);
direction = [-1, 0]; p.update(1 / 60, input, tuning, world); p.update(1 / 60, input, tuning, world);
assert(p.vx < 0, 'opposite direction takes over within two frames');
direction = [0, 0]; p.vx = 0; hop = true;
const x = p.x; p.update(1 / 60, input, tuning, world); hop = false;
assert(p.vx > 450, 'hop launches immediately instead of accelerating slowly');
for (let i = 0; i < 17; i++) p.update(1 / 60, input, tuning, world);
assert(p.x - x > 90 && p.x - x < 110, 'hop is decisive but bounded to a short dodge');
assert(p.hopCd > 0, 'hop recovery still prevents repeated invulnerability');
const integrate = hz => { let vx = 230, vy = -80; for (let i = 0; i < hz / 5; i++) [vx, vy] = movementVelocity(vx, vy, -230, 0, 1 / hz); return [vx, vy]; };
// Reversal changes response at the zero crossing; allow the one-frame boundary.
assert(Math.abs(integrate(30)[0] - integrate(120)[0]) < 3, 'response stays close across 30–120Hz');
assert.equal(cycleCombatPigment('red', -1), 'green');
assert.equal(cycleCombatPigment('green', 1), 'red');
assert.equal(cycleCombatPigment('dry', 1), 'red');
assert.equal(cycleCombatPigment('dry', -1), 'green');
assert.equal(splashChargeStep(0.5, 1 / 60, false, false, 0.55), 0, 'lost input ownership clears charge');
assert.equal(splashChargeStep(1, 1 / 60, false, true, 0.55), 1, 'release preserves charge only for the firing frame');
assert(brushHitsCircle(0, 0, 0, 74, 1.25, { x: 80, y: 0, r: 10 }), 'enemy radius contributes to reach');
assert(!brushHitsCircle(0, 0, 0, 74, 1.25, { x: 85, y: 0, r: 10 }));
assert(!brushHitsCircle(0, 0, 0, 74, 1.25, { x: -40, y: 0, r: 10 }), 'targets behind the frog are not previewed as hittable');

export function testControlFeelGame(Game, makeCanvas) {
 const g = new Game(makeCanvas()); g._beginExpedition(); g.spawnT = 999; g.options.shake = false;
 g.input.kb.add('q'); g._updateExpedition(1 / 60); g.input.endFrame();
 assert.equal(g.player.pigment, 'green');
 g.input.mouse.wheel = 1; g._updateExpedition(1 / 60); g.input.endFrame();
 assert.equal(g.player.pigment, 'red');
 // A full mouse click can arrive between two animation frames.
 const before = g.studio.strokes.length;
 g.input.mouse.lPressed = true; g.input.mouse.lDown = false;
 g._updateExpedition(1 / 60); g.input.endFrame();
 assert.equal(g.studio.strokes.length, before + 1, 'quick click paints once even if released before the next frame');
 g._updateExpedition(1 / 60);
 assert.equal(g.studio.strokes.length, before + 1, 'quick click does not become held fire');
 g.player.splashCharge = 0.5; g.input.mouse.rReleased = true;
 g._updateExpedition(1 / 60); g.input.endFrame();
 assert.equal(g.player.splashCharge, 0, 'early release cancels partial charge');
 assert.equal(g.paint.splashCd, 0, 'early release never fires');
 g.player.splashCharge = 1; g.input.mouse.rPressed = true; g.input.mouse.rDown = true;
 g._updateExpedition(1 / 60); g.input.endFrame();
 assert.equal(g.paint.splashCd, 0, 'press cannot fire an old stored full charge');
 g.input.mouse.rDown = false; g.input.mouse.rReleased = true;
 g._updateExpedition(1 / 60); g.input.endFrame();
 assert(g.paint.splashCd > 0); assert.equal(g.player.splashCharge, 0, 'full release fires exactly once');
 const owner = {};
 g.paint.hitNotes = [];
 for (let i = 0; i < 40; i++) {
   g.paint.note(10, 20, '-6', 'blue', owner, 'damage');
   g.paint.note(10, 42, 'frozen', 'blue', owner);
 }
 assert.equal(g.paint.hitNotes.length, 2, 'sustained hits keep one damage and one status label per target');
 g.paint.note(10, 42, 'rooted', 'green', owner);
 assert.equal(g.paint.hitNotes[1].text, 'rooted', 'new status replaces stale information');
 g.paint.update(1);
 assert.equal(g.paint.hitNotes.length, 0, 'target references expire with their labels');
 const snapshot = JSON.stringify([g.player, g.save, g.enemies]);
 const calls = [];
 const ctx = new Proxy({}, { get: (_, key) => (...args) => { calls.push(key); assert(args.every(a => typeof a !== 'number' || Number.isFinite(a))); }, set: () => true });
 const view = { x: 0, y: 0, w: 1280, h: 800, scale: 1 };
 drawCombatReadout(g, ctx, view);
 assert(calls.length > 0); assert.equal(JSON.stringify([g.player, g.save, g.enemies]), snapshot, 'range UI cannot mutate combat');
 for (const overlay of ['paused', 'help', '_bookOpen', '_atlasOpen']) {
   calls.length = 0; g[overlay] = true; drawCombatReadout(g, ctx, view); g[overlay] = false;
   assert.equal(calls.length, 0, `${overlay} hides combat cues`);
 }
 g.player.splashCharge = 1; g.input.mouse.rDown = true; drawCombatReadout(g, ctx, view);
 assert(calls.includes('fillText'), 'ready splash has a local release instruction');
 console.log('Control feel: quick-click routing, pigment shortcuts and pure combat cues PASS');
}
console.log('Control feel: stopping, reversal, immediate bounded hop and exact brush reach PASS');
