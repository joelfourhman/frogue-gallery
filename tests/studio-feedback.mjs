import assert from 'node:assert/strict';
import { FieldStudio } from '../src/studio.js';
import { freshSave, studyNode, STUDIO } from '../src/logic.js';

// Runs standalone and when imported by smoke; does not replace browser globals.
const banners = [], sounds = [];
const game = {
  save: freshSave(), runBiome: 'swamp', runSeed: 42, runT: 0,
  options: { wander: false }, challenge: null, cw: 1280, ch: 800,
  world: { w: 5400, h: 1500 }, player: { x: 620, y: 750, alive: true, hp: 5, maxHp: 10, iframes: 0, hopT: 0 },
  input: { mouse: { lDown: false } }, enemies: [],
  particles: { splatter() {} }, sfx: sound => sounds.push(sound),
  addBanner: text => banners.push(text), _triggerBloom() {}, _tutorialActive: () => false,
};
const studio = new FieldStudio(game), study = studio.studies[0];
let archived = 0;
studio.archive = () => { archived++; };
const target = studyNode(study);
const stroke = { x: target.x - 60, y: target.y, a: 0, range: 74, pigment: 'red', kind: 'swipe' };
for (const miss of [{ ...stroke, a: Math.PI }, { ...stroke, x: 0 }, { ...stroke, kind: 'hop' }, { ...stroke, kind: 'splash', x: NaN }]) {
  studio.onStroke(miss);
  assert.equal(study.wrongT, 0, 'only a finite actual hit on the active target requests another color');
}
studio.onStroke(stroke);
assert.equal(study.wrongT, 1.8);
assert.equal(study.coats, 0);
assert.equal(banners.length, 0, 'wrong color uses one quiet panel, without banner spam');
assert.equal(sounds.length, 0, 'wrong color does not repeatedly play error audio');
studio.update(0.5);
studio.onStroke(stroke);
assert.equal(study.wrongT, 1.3, 'holding wrong paint does not refresh the cue every swipe');
studio.onStroke({ ...stroke, pigment: 'blue' });
assert.equal(study.coats, 1);
assert.equal(study.wrongT, 0, 'successful paint clears stale correction immediately');
assert.equal(study.coatFlash, 0.35);

const lines = [];
const ctx = new Proxy({ fillText: (text, x, y) => lines.push({ text, x, y }) }, {
  get: (o, key) => key in o ? o[key] : () => {},
  set: (o, key, value) => { o[key] = value; return true; },
});
studio.drawHint(ctx);
assert(lines.some(l => l.text === 'First Light · Color 1 of 3'));
assert(lines.some(l => l.text.includes('Press 2 for Blue') && l.text.includes('Wake the water')));
assert(lines.some(l => l.text === '1 / 3'));
assert(lines.some(l => l.text.includes('Hold left click on the circle')));
assert(lines.every(l => l.y > game.ch - 132 && l.y < game.ch - 28), 'study instructions fit their bottom paper panel');
studio.update(1);
assert.equal(study.coatFlash, 0, 'cosmetic pulse expires');

while (study.step < 3) {
  const node = studyNode(study);
  studio.onStroke({ ...stroke, x: node.x - 60, y: node.y, pigment: node.pigment });
}
assert.equal(archived, 1);
assert.equal(game.player.hp, 10, 'existing completion reward is unchanged');
assert.deepEqual(game.save.studio.completed, ['first-light']);
lines.length = 0; studio.drawHint(ctx);
assert(lines.some(l => l.text.includes('Painting complete')));
assert(lines.some(l => l.text.includes('J · Open your sketchbook')));
studio.onStroke(stroke);
assert.equal(archived, 1, 'completed scene cannot reward again');

for (const mode of ['paused', 'help', '_bookOpen', '_atlasOpen']) {
  game[mode] = true; lines.length = 0; studio.drawHint(ctx);
  assert.equal(lines.length, 0, `${mode} owns its screen`); game[mode] = false;
}
game.player.alive = false; lines.length = 0; studio.drawHint(ctx);
assert.equal(lines.length, 0, 'no instructions after defeat'); game.player.alive = true;
game._tutorialActive = () => true; lines.length = 0; studio.drawHint(ctx);
assert.equal(lines.length, 0, 'practice owns its instructions'); game._tutorialActive = () => false;

game.runBiome = 'reeds'; const reeds = new FieldStudio(game), garden = reeds.studies[0];
game.player.x = garden.x; game.player.y = garden.y;
lines.length = 0; reeds.drawHint(ctx);
assert(lines.some(l => l.text.includes('The Lantern Garden')));
assert(lines.some(l => l.text.includes('Press 3 for Green')), 'Reeds uses the same fully lit instruction panel');
for (const options of [{ challenge: true, wander: false }, { challenge: false, wander: true }]) {
  game.challenge = options.challenge; game.options.wander = options.wander;
  const excluded = new FieldStudio(game); lines.length = 0; excluded.drawHint(ctx);
  assert.equal(excluded.studies.length, 0); assert.equal(lines.length, 0, 'no authored study instructions in excluded modes');
}
assert.equal(STUDIO.coats, 3);
console.log('Living-study feedback: aimed corrections, coat progress, completion, ownership and mode gating PASS');
