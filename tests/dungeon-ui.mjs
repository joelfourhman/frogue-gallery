import assert from 'node:assert/strict';
import { CAMPAIGN, CAMPAIGN_REWARDS, createCampaignRun, finishCampaignFloor, campaignRewardOffers } from '../src/logic.js';
import { dungeonCampLayout, drawDungeonCamp, drawDungeonProgress, drawDungeonRoute } from '../src/dungeon.js';

const lines = [], calls = [];
const ctx = new Proxy({
  measureText: text => ({ width: String(text).length * 7.5 }),
  fillText: (text, x, y) => { lines.push(String(text)); assert(Number.isFinite(x) && Number.isFinite(y)); },
}, {
  get: (target, key) => key in target ? target[key] : (...args) => {
    assert(args.every(value => typeof value !== 'number' || Number.isFinite(value)), `${String(key)} uses finite geometry`);
    calls.push(key);
  },
  set: (target, key, value) => { target[key] = value; return true; },
});
for (const [cw, ch] of [[1280, 800], [640, 500]]) {
  const g = { cw, ch, state: 'camp', campaign: createCampaignRun(5), _campChoice: null,
    player: { hp: 7.5, maxHp: 10 }, input: { mouse: { x: -1, y: -1 } } };
  finishCampaignFloor(g.campaign, CAMPAIGN[0].boss);
  const layout = dungeonCampLayout(g);
  assert.equal(layout.cards.length, 3);
  assert.deepEqual(layout.cards.map(r => r.id), campaignRewardOffers(g.campaign).map(r => r.id));
  for (const r of [layout.panel, ...layout.cards, layout.descend]) {
    assert(r.w > 0 && r.h > 0 && r.x >= 0 && r.y >= 0 && r.x + r.w <= cw && r.y + r.h <= ch, 'all interactive regions stay within canvas');
  }
  assert(layout.cards.every(r => r.y + r.h < layout.descend.y), 'choice cards cannot overlap Descend');
  const before = JSON.stringify(g); lines.length = 0;
  drawDungeonCamp(g, ctx);
  assert(lines.includes('Choose an upgrade above'), 'no default selection grants a reward');
  assert(lines.some(line => line.startsWith('Health 7.5 / 10') && line.includes('35%')), 'rest explains healing and current health');
  assert(lines.includes('Your first brush gift awaits below'));
  assert(!lines.some(line => line.includes('undefined')));
  assert.equal(JSON.stringify(g), before, 'drawing grants no reward and advances no floor');
  g._campChoice = CAMPAIGN_REWARDS[1].id; lines.length = 0;
  drawDungeonCamp(g, ctx);
  assert(lines.includes('Selected') && lines.includes('Continue · Enter'));
  assert(lines.some(line => line.includes(CAMPAIGN[1].name)), 'next destination is named');
  g.campaign.rewards = ['power', 'power']; lines.length = 0;
  drawDungeonCamp(g, ctx);
  assert(lines.includes('Carried gifts: Brighter paint ×2'), 'stacked gifts remain visible without suggesting the pending gift is granted');
  g._gp = { connected: true }; lines.length = 0; drawDungeonCamp(g, ctx);
  assert(lines.includes('Continue · A') && lines.some(line => line.includes('B clears choice')), 'connected controller gets accurate controls');
  g.state = 'expedition'; lines.length = 0;
  drawDungeonProgress(g, ctx);
  assert(lines.some(line => line.includes('Watercolor Marsh · 1 / 4')));
  assert(!lines.some(line => /dungeon|depth|descend/i.test(line)), 'player-facing route stays in the swamp story');
  for (const flag of ['help', 'paused', '_bookOpen', '_atlasOpen']) {
    g[flag] = true; calls.length = 0; drawDungeonProgress(g, ctx); g[flag] = false;
    assert.equal(calls.length, 0, `${flag} hides dungeon progress`);
  }
  drawDungeonRoute(g, ctx, 24, 50, cw - 48);
  g.encounter = { nearby: true }; calls.length = 0; drawDungeonProgress(g, ctx);
  assert.equal(calls.length, 0, 'clearing instruction card owns the bottom area');
  g.encounter = null; g.player = { x: 500, y: 500 };
  g.studio = { studies: [{ x: 510, y: 510, step: 0 }] };
  calls.length = 0; drawDungeonProgress(g, ctx);
  assert.equal(calls.length, 0, 'study card cannot overlap the region label');
  g.studio = { studies: [], garden: { props: [{ x: 510, y: 510 }] } };
  calls.length = 0; drawDungeonProgress(g, ctx);
  assert.equal(calls.length, 0, 'creative painting card owns the bottom area');
}
console.log('Dungeon UI: readable reward choices, explicit descent, four-depth progress and render purity PASS');
