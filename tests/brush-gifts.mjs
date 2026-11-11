import assert from 'node:assert/strict';
import { CAMPAIGN_REWARDS, createCampaignRun, campaignRewardOffers, campaignRewardPreview,
  chooseCampaignReward, finishCampaignFloor, applyCampaignRewards, makeTuning } from '../src/logic.js';

assert.equal(CAMPAIGN_REWARDS.length, 6);
const signatures = new Set();
const specialties = new Set();
for (let seed = 0; seed < 100; seed++) {
  const run = createCampaignRun(seed);
  assert.deepEqual(campaignRewardOffers(run).map(r => r.id), ['power', 'heart', 'flow']);
  finishCampaignFloor(run, 'gray'); chooseCampaignReward(run, 'power');
  const offers = campaignRewardOffers(run).map(r => r.id);
  assert.equal(new Set(offers).size, 3);
  assert.equal(offers[1], 'heart', 'second rest retains a recognizable recovery option');
  assert.deepEqual(campaignRewardOffers(run).map(r => r.id), offers, 'rendering cannot reroll');
  signatures.add(offers.join()); offers.filter(id => id !== 'heart').forEach(id => specialties.add(id));
  finishCampaignFloor(run, 'wyrm');
  const snapshot = JSON.stringify(run);
  assert.equal(chooseCampaignReward(run, 'power'), false, 'unoffered gifts cannot be granted');
  assert.equal(JSON.stringify(run), snapshot);
}
assert(signatures.size > 3, 'different run seeds change the choices');
assert.deepEqual([...specialties].sort(), ['mend', 'reach', 'tempo']);
const base = makeTuning();
const wide = applyCampaignRewards(makeTuning(), { rewards: ['reach', 'reach'] });
assert.equal(wide.swipeRange, base.swipeRange * 1.2 * 1.2);
assert.equal(wide.splashRadius, base.splashRadius * 1.15 * 1.15);
assert.equal(wide.power, base.power, 'reach does not secretly grant damage');
const quick = applyCampaignRewards(makeTuning(), { rewards: ['tempo'] });
assert.equal(quick.swipeCooldown, base.swipeCooldown * .85);
assert.equal(quick.hopCooldown, base.hopCooldown);
const kind = applyCampaignRewards(makeTuning(), { rewards: ['mend'] });
assert.equal(kind.greenHeal, base.greenHeal * 1.35);
assert.equal(kind.greenHealOnPaint, base.greenHealOnPaint * 1.35);
assert.equal(kind.maxHp, base.maxHp);
for (const gift of CAMPAIGN_REWARDS) {
  const before = JSON.stringify(base);
  const lines = campaignRewardPreview(base, gift.id);
  assert.equal(lines.length, 2); assert(lines[0].includes('→'));
  assert(!lines.join().includes('NaN')); assert.equal(JSON.stringify(base), before);
}
assert.deepEqual(applyCampaignRewards(makeTuning(), createCampaignRun()), base);

export function testBrushGiftsGame(Game, makeCanvas) {
  for (const id of ['reach', 'tempo', 'mend']) {
    const g = new Game(makeCanvas()); g._beginExpedition();
    let seed = 0;
    while (!campaignRewardOffers({ ...createCampaignRun(seed), floor: 1 }).some(r => r.id === id)) seed++;
    g.campaign.seed = seed;
    g._endRun('victory'); g._campChoice = 'power'; assert(g._descendCampaign());
    g._endRun('victory'); g._campChoice = id; assert(g._descendCampaign());
    const expected = applyCampaignRewards(makeTuning(), { rewards: ['power', id] });
    for (const key of ['swipeRange', 'splashRadius', 'swipeCooldown', 'greenHeal', 'greenHealOnPaint'])
      assert.equal(g.tuning[key], expected[key], `${id}: live tuning ${key}`);
    assert.equal(g.paint.swipeRange, expected.swipeRange, 'actual brush consumes the reach gift');
    assert.equal(g.paint.tuning, g.tuning);
    g._beginExpedition(); assert.equal(g.tuning.swipeRange, base.swipeRange);
    assert.equal(g.tuning.greenHeal, base.greenHeal);
    assert.equal(g.tuning.swipeCooldown, base.swipeCooldown);
  }
}
console.log('Brush gifts: stable varied offers, no unoffered grants, measured reach/cadence/healing and clean reset PASS');
