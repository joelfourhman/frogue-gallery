import assert from 'node:assert/strict';
import * as L from '../src/logic.js';

export function testCampaignRules() {
  assert.equal(L.CAMPAIGN.length, 4);
  assert.deepEqual(L.CAMPAIGN.map(f => f.boss), ['gray', 'wyrm', 'warden', 'umbra']);
  assert.equal(L.CAMPAIGN.filter(f => f.final).length, 1);
  assert(L.CAMPAIGN.at(-1).final);
  const run = L.createCampaignRun(1234);
  assert.equal(L.campaignFloor(run), L.CAMPAIGN[0]);
  assert.equal(run.floor, 0); assert.equal(run.complete, false);
  assert.equal(L.chooseCampaignReward(run, 'power'), false, 'cannot buy a reward before a floor clear');
  assert.equal(L.finishCampaignFloor(run, 'umbra'), false, 'a different boss cannot skip progression');
  for (let i = 0; i < L.CAMPAIGN.length; i++) {
    assert.equal(run.floor, i);
    assert(L.finishCampaignFloor(run, L.CAMPAIGN[i].boss));
    assert.equal(L.finishCampaignFloor(run, L.CAMPAIGN[i].boss), false, 'floor rewards cannot be duplicated');
    if (i < 3) {
      assert(run.pendingReward && !run.complete);
      const snapshot = JSON.stringify(run);
      assert.equal(L.chooseCampaignReward(run, 'not-a-reward'), false);
      assert.equal(JSON.stringify(run), snapshot, 'invalid choice cannot advance the run');
      assert(L.chooseCampaignReward(run, ['power', 'heart', 'flow'][i]));
      assert.equal(L.chooseCampaignReward(run, 'power'), false, 'one reward per clear');
    }
  }
  assert(run.complete && !run.pendingReward);
  assert.equal(run.floor, 3, 'there is no fifth floor or escalating next cycle');
  assert.deepEqual(run.cleared, ['gray', 'wyrm', 'warden', 'umbra']);
  assert.equal(L.chooseCampaignReward(run, 'power'), false, 'final victory has no loop reward');
  const fresh = L.createCampaignRun(1234);
  assert.deepEqual(fresh.rewards, [], 'a new run loses run-only upgrades');
  const base = L.makeTuning(), enhanced = L.applyCampaignRewards(L.makeTuning(), run);
  assert(enhanced.swipeDamage > base.swipeDamage || enhanced.power > base.power);
  assert(enhanced.maxHp > base.maxHp);
  assert(enhanced.hopCooldown < base.hopCooldown);
  assert.deepEqual(L.applyCampaignRewards(L.makeTuning(), fresh), base);

  const legacy = L.freshSave();
  Object.assign(legacy, { ngCycle: 9, ngModifier: 'high-tide', gold: 500, goldEarned: { 'boss:green': true }, gildedFrame: true, galleryBonus: 8 });
  const migrated = L.migrateSave(legacy);
  for (const key of ['ngCycle', 'ngModifier', 'gold', 'goldEarned', 'gildedFrame', 'galleryBonus']) assert(!Object.hasOwn(migrated, key), `legacy ${key} is retired`);
  for (const key of ['ngUnlocked', 'applyNGPlus', 'ngPlusScaling', 'MODIFIERS', 'GREEN_HERON', 'GILDED_HERON', 'GILDED_FRAME', 'retireCollection']) assert(!(key in L), `${key} has no runtime API`);
  assert.equal(L.SAVE_VERSION, 12); assert.equal(L.GAME_VERSION, '1.0.0');
  console.log('Campaign rules: four ordered bosses, one reward per rest, final victory, clean restart and legacy migration PASS');
}

export function testCampaignGame(Game, makeCanvas) {
  const g = new Game(makeCanvas()); g.save = L.freshSave(); g.options.wander = false;
  // Imported prestige/cycles may not affect a fresh dungeon.
  g.save.ngCycle = 99; g.save.ngModifier = 'high-tide'; g.save.galleryBonus = 99;
  g.save.upgrades = { capacity: 3, power: 3, vitality: 3 };
  g.save.loadout = L.PAINTINGS.slice(0, 2).map(p => p.id);
  g._beginExpedition();
  assert.equal(g.campaign.floor, 0); assert.equal(g.heron.kind, 'gray');
  assert.equal(g.tuning.enemyHp, L.makeTuning().enemyHp);
  assert.equal(g.tuning.power, L.makeTuning().power, 'saved permanent upgrades do not power a new run');
  assert.equal(g.tuning.maxHp, L.makeTuning().maxHp);
  const campaign = g.campaign;
  for (let i = 0; i < 4; i++) {
    assert.equal(g.heron.kind, L.CAMPAIGN[i].boss);
    const seconds = g.runT = 123 + i * 100;
    g.score = 777; g.collected = { red: 2, blue: 3, green: 4 };
    g.player.hp = Math.max(1, g.player.maxHp - 2);
    g._endRun('victory');
    if (i < 3) {
      assert.equal(g.state, 'camp', 'intermediate boss leads to rest, not run victory');
      assert.equal(g.save.stats.victories, 0, 'intermediate bosses do not file campaign wins');
      const floor = g.campaign.floor;
      const restHp = g.player.hp, oldMaxHp = g.player.maxHp;
      assert.equal(g._descendCampaign(), false, 'rest requires an explicit reward choice');
      g._endRun('victory'); assert.equal(g.campaign.floor, floor, 'duplicate clear cannot skip floors');
      g._campChoice = ['power', 'heart', 'flow'][i]; g._descendCampaign();
      assert.equal(g.state, 'expedition'); assert.equal(g.campaign, campaign, 'one run spans every floor');
      assert(g.runT >= seconds, 'elapsed run time survives descent');
      assert.equal(g.score, 777); assert.deepEqual(g.collected, { red: 2, blue: 3, green: 4 });
      assert.equal(g.campaign.floor, i + 1);
      assert.equal(g.player.hp, Math.min(g.player.maxHp, restHp + Math.max(0, g.player.maxHp - oldMaxHp)), 'descent preserves wounds and adds only new maximum hearts');
    } else {
      assert.equal(g.state, 'end'); assert.equal(g.endKind, 'victory');
      assert(g.campaign.complete); assert.equal(g.save.stats.victories, 1);
    }
  }
  g._beginExpedition(); assert.equal(g.campaign.floor, 0); assert.deepEqual(g.campaign.rewards, []);
  assert.equal(g.heron.kind, 'gray');
  g._endRun('defeat'); assert.equal(g.state, 'end'); assert.equal(g.endKind, 'defeat');
  g._beginExpedition(); assert.equal(g.campaign.floor, 0); assert.deepEqual(g.campaign.rewards, []);
  console.log('Campaign runtime: ordered camps, carried run stats, one final win, death and fresh restart PASS');
}

testCampaignRules();
