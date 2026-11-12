import assert from 'node:assert/strict';
import { RepaintGarden, REPAINT_CAP, REPAINT_MARK_CAP, repaintTargets, drawRepaintProp } from '../src/repaint.js';
import { PIGMENTS } from '../src/logic.js';

const game = floor => ({ campaign: { floor }, runBiome: floor ? 'reeds' : 'swamp', options: {},
  world: { w: 6200, h: 1500 }, sfx() {}, player: { x: 0, y: 0 }, enemies: [] });
const atPart = (prop, index, pigment, a = 0) => {
  const p = prop.parts[index];
  return { kind: 'swipe', x: prop.x + p.x - Math.cos(a) * 74,
    y: prop.y + p.y - Math.sin(a) * 74, a, range: 74, pigment };
};
const gardens = [new RepaintGarden(game(0)), new RepaintGarden(game(1))];
const types = new Set();
for (const garden of gardens) for (const kind of new Set(garden.props.map(p => p.kind))) {
  types.add(kind);
  const p = garden.props.find(p => p.kind === kind), [a, b] = [0, p.parts.length - 1];
  const red = atPart(p, a, 'red'), blue = atPart(p, b, 'blue');
  assert.deepEqual(repaintTargets(p, red), [a]); assert.deepEqual(repaintTargets(p, blue), [b]);
  garden.onStroke(red); garden.onStroke(blue);
  assert.equal(p.parts[a].pigment, 'red'); assert.equal(p.parts[b].pigment, 'blue', `${kind} retains a mixed palette`);
  assert(p.marks.some(m => m.part === a && m.kind === 'swipe'));
  assert.equal(garden.onStroke(blue), 0, 'held unchanged stroke is quiet');
  garden.onStroke(atPart(p, b, 'blue', Math.PI / 2));
  assert(p.marks.some(m => m.part === b && m.a === Math.PI / 2), 'direction leaves a different visible stripe');
  garden.onStroke(atPart(p, a, 'dry'));
  assert.equal(p.parts[a].pigment, 'dry'); assert.equal(p.parts[b].pigment, 'blue');
  assert(!p.marks.some(m => m.part === a), 'eraser removes only the touched part detail');
  garden.onStroke({ kind: 'splash', x: p.x, y: p.y, a: 0, range: 60, pigment: 'green' });
  assert(p.parts.every(part => part.pigment === 'green'));
  assert(p.marks.some(m => m.kind === 'splash'), 'splash keeps speckles, not stroke stripes');
  for (let n = 0; n < 120; n++) garden.onStroke(atPart(p, n % p.parts.length, n % 2 ? 'blue' : 'red', n * Math.PI / 4));
  assert(p.marks.length <= REPAINT_MARK_CAP);
}
assert.equal(types.size, 6, 'all scenery kinds are editable');
const mushrooms = gardens[0].props.find(p => p.kind === 'mushrooms');
const notes = []; gardens[0].game.sfx = (name, options) => notes.push({ name, options });
gardens[0].update(1); gardens[0].onStroke(atPart(mushrooms, 0, 'green'));
assert(notes.some(n => n.name === 'garden-note' && n.options.note === 0 && n.options.pig === 'green'));
const snapshot = JSON.stringify(gardens[0].props), texts = [];
const ctx = new Proxy({ fillText: text => texts.push(text) }, {
  get: (o, k) => k in o ? o[k] : () => {}, set: (o, k, v) => { o[k] = v; return true; },
});
const random = Math.random;
Math.random = () => { throw Error('Creative drawing cannot consume combat RNG'); };
try { gardens[0].draw(ctx, { x: 0, y: 0, w: 6200, h: 1500, scale: 1 }, 1); }
finally { Math.random = random; }
assert.equal(JSON.stringify(gardens[0].props), snapshot);
assert.equal(texts.length, 0, 'creative scenery reacts visually without completion captions');
assert(gardens.every(g => g.props.length === REPAINT_CAP));

// Only the final victory restores untouched scenery, without rewriting art.
const finalGame = game(0), finalGarden = new RepaintGarden(finalGame), fills = [];
const colorCtx = new Proxy({}, {
  get: (o, k) => k in o ? o[k] : () => {},
  set: (o, k, v) => { o[k] = v; if (k === 'fillStyle') fills.push(v); return true; },
});
const fullView = { x: 0, y: 0, w: 6200, h: 1500, scale: 1 };
const blankData = JSON.stringify(finalGarden.props);
finalGarden.draw(colorCtx, fullView, 1);
assert(fills.includes('#d4d6c3'), 'untouched parts remain gray during the journey');
finalGame.state = 'end'; finalGame.endKind = 'victory'; finalGame.campaign.complete = true;
fills.length = 0; finalGarden.draw(colorCtx, fullView, 1);
assert(!fills.includes('#d4d6c3'), 'the final victory returns color to every untouched part');
for (const pigment of ['red', 'blue', 'green']) assert(fills.includes(PIGMENTS[pigment].color));
assert.equal(JSON.stringify(finalGarden.props), blankData, 'victory color is a read-only presentation fallback');
const owned = { ...finalGarden.props.find(p => p.kind === 'stones'), parts: [{ x: 0, y: 0, rx: 16, ry: 11, pigment: 'blue' }] };
fills.length = 0; drawRepaintProp(colorCtx, owned, 1, true);
assert(fills.includes(PIGMENTS.blue.color) && !fills.includes(PIGMENTS.red.color), 'personal blue paint overrides the natural red fallback');
finalGame.campaign.complete = false; fills.length = 0; finalGarden.draw(colorCtx, fullView, 1);
assert(fills.includes('#d4d6c3'), 'an intermediate boss victory cannot restore the whole swamp');

export function testCreativePaintGame(Game, makeCanvas) {
  const g = new Game(makeCanvas()); g._beginExpedition();
  const p = g.studio.garden.props.find(p => p.kind === 'mushrooms');
  const original = JSON.stringify(g.save), tuning = JSON.stringify(g.tuning), hp = g.player.hp;
  g.studio.onStroke(atPart(p, 0, 'red')); g.studio.onStroke(atPart(p, 2, 'blue'));
  assert.equal(p.parts[0].pigment, 'red'); assert.equal(p.parts[2].pigment, 'blue');
  assert.equal(JSON.stringify(g.save), original); assert.equal(JSON.stringify(g.tuning), tuning); assert.equal(g.player.hp, hp);
  g._beginExpedition(); assert(g.studio.garden.props.every(prop => prop.parts.every(part => part.pigment === 'dry') && !prop.marks.length));
}
console.log('Creative painting: six part palettes, direction stripes, splash speckles, local erasing, cap notes and bounded quiet rendering PASS');
