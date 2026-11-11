import assert from 'node:assert/strict';
import path from 'node:path';

export async function brushJourneyBrowser({ page, tick, out, report }) {
  await page.setViewportSize({ width: 1280, height: 820 });
  for (const id of ['reach', 'tempo', 'mend']) {
    const fixture = await page.evaluate(async id => {
      const g = window.__game;
      const { campaignRewardOffers, campaignRewardPreview, applyCampaignRewards } = await import('./src/logic.js');
      const { dungeonCampLayout } = await import('./src/dungeon.js');
      g.options.wander = false; g._beginExpedition(false, { campaignFloor: 1 });
      while (!campaignRewardOffers(g.campaign).some(r => r.id === id)) g.campaign.seed++;
      g._endRun('victory'); g.banners = []; g._drawAll();
      const offers = campaignRewardOffers(g.campaign), index = offers.findIndex(r => r.id === id);
      const card = dungeonCampLayout(g).cards[index], c = g.canvas.getBoundingClientRect();
      return { x: c.x + (card.x + card.w / 2) * c.width / g.cw,
        y: c.y + (card.y + card.h / 2) * c.height / g.ch,
        expected: applyCampaignRewards({ ...g.tuning }, { rewards: [id] }),
        preview: campaignRewardPreview(g.tuning, id), seed: g.campaign.seed };
    }, id);
    assert(fixture.preview[0].includes('→'));
    await page.mouse.click(fixture.x, fixture.y); await tick(1);
    assert.equal(await page.evaluate(() => window.__game._campChoice), id);
    await page.screenshot({ path: path.join(out, `44-gift-${id}.png`) });
    if (id === 'reach') {
      await page.setViewportSize({ width: 640, height: 500 }); await tick(1);
      await page.screenshot({ path: path.join(out, '44-gift-compact.png') });
      await page.setViewportSize({ width: 1280, height: 820 }); await tick(1);
    }
    await page.keyboard.press('Enter'); await tick(1);
    const actual = await page.evaluate(() => ({ floor: window.__game.campaign.floor, tuning: window.__game.tuning }));
    assert.equal(actual.floor, 2);
    for (const field of ['swipeRange', 'splashRadius', 'swipeCooldown', 'greenHeal', 'greenHealOnPaint'])
      assert.equal(actual.tuning[field], fixture.expected[field], `${id} actual gameplay ${field}`);
  }
  for (let floor = 0; floor < 4; floor++) {
    const state = await page.evaluate(async floor => {
      const g = window.__game;
      const { journeyLandmarks } = await import('./src/journey-ui.js');
      const { atlasForGame } = await import('./src/atlas.js');
      g._beginExpedition(false, { campaignFloor: floor });
      g.runT = 5; g._floorStartT = 0; g.banners = []; g._tut = null;
      g._drawAll();
      return { journey: journeyLandmarks(g), atlas: atlasForGame(g).journey, intro: g.heron._intro };
    }, floor);
    assert.equal(state.atlas.guardian.name, state.journey.guardian.name);
    assert.equal(!!state.atlas.clearing, floor === 0);
    await page.screenshot({ path: path.join(out, `45-depth-${floor + 1}-intro.png`) });
  }
  await page.evaluate(() => {
    const g = window.__game;
    g.player.x = g.world.w - 1050; g.player.y = 750;
    g.cam.x = g.player.x; g.cam.y = g.player.y; g.runT = 20; g.banners = [];
    g.input.setView(g._view()); g._drawAll();
  });
  const dormant = await page.evaluate(() => window.__game.heron._intro);
  await page.screenshot({ path: path.join(out, '46-final-gate.png') });
  await page.keyboard.press('v'); await tick(1);
  assert.equal(await page.evaluate(() => window.__game._atlasOpen), true);
  assert.equal(await page.evaluate(() => window.__game.heron._intro), dormant, 'atlas and landmark do not wake the final boss');
  await page.screenshot({ path: path.join(out, '46-final-atlas.png') });
  await page.keyboard.press('v'); await tick(1);
  await page.evaluate(() => { const g = window.__game; g._endRun('defeat'); g._drawAll(); });
  await page.screenshot({ path: path.join(out, '47-build-recap.png') });
  report.push('Three specialty gifts chosen through DOM controls match displayed values; four floor introductions, guardian atlas/gate and run build summary verified.');
}
