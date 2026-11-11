import assert from 'node:assert/strict';
import { RepaintGarden, REPAINT_CAP } from '../src/repaint.js';
import { FIELD_STUDIES } from '../src/logic.js';

const sounds = [];
const game = { runBiome: 'swamp', options: { wander: false }, challenge: false,
  world: { w: 5400, h: 1500 }, player: { x: 260, y: 750 }, enemies: [],
  sfx: sound => sounds.push(sound), cw: 1280, ch: 800 };
const studies = FIELD_STUDIES.filter(s => s.biome === 'swamp');
const random = Math.random;
let garden;
Math.random = () => { throw new Error('repainting must not consume gameplay randomness'); };
try { garden = new RepaintGarden(game, studies); } finally { Math.random = random; }
assert.equal(garden.props.length, REPAINT_CAP);
assert.equal(new Set(garden.props.map(p => p.kind)).size, 4);
assert(garden.props.some(p => Math.hypot(p.x - 260, p.y - 750) < 130), 'paintable scenery is visible from the starting frog');
assert(garden.props.every(p => p.x > 0 && p.x < 5400 && p.y > 0 && p.y < 1500));
assert(garden.props.every(p => studies.every(s => Math.hypot(p.x - s.x, p.y - s.y) > 180)), 'free painting leaves study nodes unobscured');
const prop = garden.props[0], base = { kind: 'swipe', x: prop.x - 50, y: prop.y, a: 0, range: 74, pigment: 'red' };
for (const invalid of [null, { ...base, x: NaN }, { ...base, pigment: 'gold' }, { ...base, kind: 'hop' }, { ...base, a: Math.PI }, { ...base, x: -999 }]) {
  assert.equal(garden.onStroke(invalid), 0);
}
for (const pigment of ['red', 'blue', 'green', 'dry']) {
  assert(garden.onStroke({ ...base, pigment }) > 0, `free scenery accepts ${pigment}`);
  assert.equal(prop.pigment, pigment);
  assert.equal(prop.pulse, 1);
  assert.equal(garden.onStroke({ ...base, pigment }), 0, 'held same-color painting is idempotent');
}
assert.equal(sounds.length, 1, 'rapid repainting coalesces its feedback sound');
garden.update(1);
assert(garden.props.every(p => p.pulse === 0));
assert(garden.onStroke({ ...base, pigment: 'blue', kind: 'splash', a: Math.PI }) > 0, 'splash paints behind the frog too');
assert.equal(sounds.length, 2);
const state = JSON.stringify(garden.props), lines = [];
let draws = 0;
const ctx = new Proxy({ fillText: (text, x, y) => lines.push({ text, x, y }), beginPath: () => { draws++; } }, {
  get: (obj, key) => key in obj ? obj[key] : () => {}, set: (obj, key, value) => { obj[key] = value; return true; },
});
Math.random = () => { throw new Error('drawing scenery must not consume gameplay randomness'); };
try { garden.draw(ctx, { x: 0, y: 0, w: 1280, h: 800, scale: 1 }, 4); } finally { Math.random = random; }
assert(draws > 0);
assert.equal(JSON.stringify(garden.props), state, 'rendering never changes painted state');
draws = 0; garden.draw(ctx, { x: -5000, y: -5000, w: 100, h: 100, scale: 1 }, 4);
assert.equal(draws, 0, 'all offscreen props are culled');
assert(garden.drawHint(ctx));
assert(lines.some(l => l.text.includes('any color')));
assert(lines.some(l => l.text.includes('Hold left click')));
game.enemies = [{ x: 280, y: 750, dead: false }]; lines.length = 0;
assert(!garden.drawHint(ctx)); assert.equal(lines.length, 0, 'scenery hint yields to nearby combat'); game.enemies = [];
for (const mode of [{ runBiome: 'reeds' }, { runBiome: 'reeds-dark' }, { challenge: true }, { options: { wander: true } }]) {
  assert.equal(new RepaintGarden({ ...game, ...mode }, studies).props.length, 0, 'authored scenery respects biome and mode');
}
for (let i = 0; i < 1000; i++) { garden.onStroke({ ...base, pigment: i % 2 ? 'red' : 'green' }); garden.update(1 / 60); }
assert.equal(garden.props.length, REPAINT_CAP, 'long repainting never adds persistent objects');

export function testRepaintGame(Game, makeCanvas) {
  const g = new Game(makeCanvas()); g._beginExpedition();
  const props = g.studio.garden.props, p = props[0];
  const bank = JSON.stringify(g.save.bank), completed = JSON.stringify(g.save.studio.completed);
  g.player.x = p.x - 48; g.player.y = p.y; g.player.aimA = 0;
  const paint = pigment => g.studio.onStroke({ kind: 'swipe', pigment, x: g.player.x, y: g.player.y, a: 0, range: g.tuning.swipeRange });
  paint('red'); assert.equal(p.pigment, 'red', 'real stroke hook repaints scenery');
  paint('blue'); assert.equal(p.pigment, 'blue');
  assert.equal(JSON.stringify(g.save.bank), bank, 'repainting grants no banked resources');
  assert.equal(JSON.stringify(g.save.studio.completed), completed, 'free colors cannot bypass study progression');
  assert(g.studio.strokes.length >= 2, 'free scenery strokes remain in the sketchbook drawing');
  g.studio.update(2); assert.equal(p.pulse, 0);
  g._beginExpedition(); assert(g.studio.garden.props.every(prop => prop.pigment === 'dry'), 'a new visit starts a fresh canvas');
}
console.log('Repaint garden: free colors, real range, bounded effects, mode separation and clear hints PASS');
