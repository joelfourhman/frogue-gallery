import assert from 'node:assert/strict';
import { CAMPAIGN, createCampaignRun } from '../src/logic.js';
import { journeyLandmarks, journeyObjective, journeyHudLayout, drawJourneyHud, drawJourneyWorld, runBuildLines, drawRunBuild } from '../src/journey-ui.js';
import { atlasForGame, drawFieldAtlas } from '../src/atlas.js';

const lines = [], calls = [];
const ctx = new Proxy({
  measureText: text => ({ width: String(text).length * 7.5 }),
  fillText: (text, x, y) => { lines.push(String(text)); assert(Number.isFinite(x) && Number.isFinite(y)); },
}, {
  get: (target, key) => key in target ? target[key] : (...args) => {
    assert(args.every(value => typeof value !== 'number' || Number.isFinite(value)), `${String(key)} uses finite geometry`);
    calls.push([key, ...args]);
  },
  set: (target, key, value) => { target[key] = value; return true; },
});
const game = () => ({ cw: 1280, ch: 800, state: 'expedition', campaign: createCampaignRun(7),
  world: { w: 5400, h: 1500, restSpots: [] }, options: {}, save: { studio: {} }, runBiome: 'swamp',
  player: { alive: true, x: 260, y: 750 }, heron: { hp: 100, _intro: 3.2, flying: 0 },
  studio: { studies: [] }, encounter: { completed: false }, banners: [], runT: 2, _floorStartT: 0,
  _tutorialActive: () => false, _mouseIn: () => false });

for (const [cw, ch] of [[1280, 800], [640, 500]]) {
  const g = game(); Object.assign(g, { cw, ch });
  const b = journeyHudLayout(g);
  assert(b.x >= 0 && b.x + b.w <= cw && b.intro.y + b.intro.h < ch - 126, 'guidance avoids bottom teaching cards');
  const before = JSON.stringify(g); lines.length = 0;
  drawJourneyHud(g, ctx);
  assert(lines.some(line => line.includes('Watercolor Marsh')));
  assert(lines.some(line => line.includes('Umbral Wyrm stole the color')), 'the first arrival names the color thief');
  assert(!lines.some(line => /dungeon|depth|descend/i.test(line)));
  assert.equal(JSON.stringify(g), before, 'intro is presentation only');
  for (const flag of ['paused', 'help', '_bookOpen', '_atlasOpen', 'dying']) {
    g[flag] = true; calls.length = 0; lines.length = 0; drawJourneyHud(g, ctx); g[flag] = false;
    assert.equal(calls.length, 0); assert.equal(lines.length, 0);
  }
  g.banners = [{ t: 2 }]; lines.length = 0; drawJourneyHud(g, ctx);
  assert.equal(lines.length, 0, 'existing teaching banners win');
  g.banners = []; g.runT = 25; lines.length = 0; drawJourneyHud(g, ctx);
  assert(lines.some(line => line.includes('Bring color back to our swamp')));
  g.encounter.nearby = true; assert.equal(journeyObjective(g), ''); g.encounter.nearby = false;
  g.enemies = [{ x: 300, y: 750, hp: 20 }]; assert.equal(journeyObjective(g), ''); g.enemies = [];
  g.studio.studies = [{ x: 260, y: 750 }]; assert.equal(journeyObjective(g), ''); g.studio.studies = [];
  const landmarks = journeyLandmarks(g);
  assert.equal(landmarks.guardian.x, 4500); assert.equal(landmarks.clearing.name, 'Lily Clearing');
  assert.equal(atlasForGame(g).journey.guardian.name, 'Great Gray Heron');
  g.player.x = 4400; assert(journeyObjective(g).includes('Great Gray Heron'));
  g.heron._intro = 0; assert.equal(journeyObjective(g), '', 'active boss fights get no instructional overlay');
  lines.length = 0; drawJourneyHud(g, ctx); assert.equal(lines.length, 0);
  g.runT = 2; lines.length = 0; drawJourneyHud(g, ctx); assert.equal(lines.length, 0, 'arrival card also yields during a fight');
  const worldBefore = JSON.stringify(g); lines.length = 0;
  drawJourneyWorld(g, ctx, { x: 4300, y: 400, w: cw, h: ch, scale: 1 });
  assert(lines.some(line => line.includes('GUARDIAN AHEAD')));
  assert.equal(JSON.stringify(g), worldBefore, 'gate artwork never wakes the guardian');
  calls.length = 0; drawJourneyWorld(g, ctx, { x: 0, y: 0, w: 100, h: 100, scale: 1 });
  assert.equal(calls.length, 0, 'distant landmarks are culled');
}

for (let floor = 0; floor < 4; floor++) {
  const g = game(); g.campaign.floor = floor; g.runT = 402; g._floorStartT = 400;
  const l = journeyLandmarks(g);
  assert.equal(!!l.clearing, floor === 0); assert.equal(l.guardian.final, floor === 3);
  lines.length = 0; drawJourneyHud(g, ctx);
  assert(lines.some(line => line.includes(CAMPAIGN[floor].name)), 'every floor gets its own introduction with a carried clock');
  g.heron._intro = 0; assert.equal(journeyObjective(g), '');
  lines.length = 0; drawFieldAtlas(g, ctx);
  assert(lines.includes(l.guardian.name));
  assert.equal(lines.some(line => line === 'Lily Clearing'), floor === 0);
  if (floor === 3) assert(lines.includes('The color thief'));
  g.options.wander = true; assert.equal(journeyLandmarks(g), null);
}
const g = game(); g.campaign.rewards = ['power', 'power', 'heart'];
assert.deepEqual(runBuildLines(g), ['Brighter paint ×2', 'Lily heart']);
lines.length = 0; drawRunBuild(g, ctx, 600, 370, 340);
assert(lines.includes('Brighter paint ×2') && lines.includes('Lily heart'));
g.campaign.rewards = []; lines.length = 0; drawRunBuild(g, ctx, 100, 370, 580);
assert(lines.includes('No guardian gifts yet'), 'early death summary remains useful');
console.log('Journey UI: four floor voices, contextual objective, dormant arena landmark, atlas destinations and earned build summary PASS');
