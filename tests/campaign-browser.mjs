import assert from 'node:assert/strict';
import path from 'node:path';

// Real DOM camp/restart controls. Boss defeat endpoints are staged here;
// campaignpace exercises every actual combat kill in the same ordered run.
export async function campaignBrowser({ page, tick, out, report }) {
  const padPress = async button => {
    await page.evaluate(b => { window.testPad.buttons[b] = { pressed: true, value: 1 }; }, button); await tick(1);
    await page.evaluate(b => { window.testPad.buttons[b] = { pressed: false, value: 0 }; }, button); await tick(1);
  };
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.evaluate(async () => {
    const g = window.__game, { freshSave } = await import('./src/logic.js');
    g.save = freshSave(); g.options.wander = false; g._quitToTitle(); g._drawAll();
  });
  await page.keyboard.press('Enter'); await tick(2);
  assert.equal(await page.evaluate(() => window.__game.campaign.floor), 0);
  const expected = ['gray', 'wyrm', 'warden', 'umbra'];
  for (let i = 0; i < 4; i++) {
    assert.equal(await page.evaluate(() => window.__game.heron.kind), expected[i]);
    await page.evaluate(() => {
      const g = window.__game;
      g.runT += 90; g.collected.red += 2; g.player.hp = Math.max(1, g.player.maxHp - 3);
      g.heron.hp = 0; g._endRun('victory'); g._drawAll();
    });
    if (i === 3) break;
    const frozen = await page.evaluate(() => ({ time: window.__game.runT, hp: window.__game.player.hp, drops: window.__game.collected.red }));
    assert.equal(await page.evaluate(() => window.__game.state), 'camp');
    assert.equal(await page.evaluate(() => window.__game.canvas.style.cursor), 'default');
    await page.keyboard.press('Enter'); await tick(1);
    assert.equal(await page.evaluate(() => window.__game.campaign.floor), i, 'descent requires an explicit choice');
    await tick(120);
    assert.equal(await page.evaluate(() => window.__game.runT), frozen.time, 'camp stops the simulation clock');
    assert.equal(await page.evaluate(() => window.__game.player.hp), frozen.hp, 'camp does not secretly run combat');
    if (i === 0) {
      const rect = await page.evaluate(async () => {
        const g = window.__game, { dungeonCampLayout } = await import('./src/dungeon.js');
        const r = dungeonCampLayout(g).cards[0], c = g.canvas.getBoundingClientRect();
        return { x: c.x + (r.x + r.w / 2) * c.width / g.cw, y: c.y + (r.y + r.h / 2) * c.height / g.ch };
      });
      await page.mouse.click(rect.x, rect.y); await tick(1);
    } else { await page.keyboard.press(String(i + 1)); await tick(1); }
    assert.equal(await page.evaluate(() => window.__game._campChoice), ['power', 'heart', 'flow'][i]);
    if (i === 0) {
      await page.evaluate(() => {
        window.testPad = { id: 'dungeon rest test pad', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
        Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [window.testPad] });
        window.__game._gp.menu = null; window.__game._gp.mi.camp = 0;
      }); await tick(1);
      await padPress(1);
      assert.equal(await page.evaluate(() => window.__game._campChoice), null, 'B clears the ungranted gift without abandoning the run');
      assert.equal(await page.evaluate(() => window.__game._gpMenuList().list.length), 3, 'cleared choice removes Descend from controller focus');
      await padPress(13); await padPress(0);
      assert.equal(await page.evaluate(() => window.__game._campChoice), 'heart', 'D-pad and A select the focused gift');
      await padPress(1); await padPress(0);
      assert.equal(await page.evaluate(() => window.__game._campChoice), 'power', 'B returns focus to the first gift');
      assert.equal(await page.evaluate(() => window.__game.campaign.floor), 0);
      assert.deepEqual(await page.evaluate(() => window.__game.campaign.rewards), [], 'controller selection grants nothing before descent');
    }
    await page.screenshot({ path: path.join(out, `36-camp-${i + 1}.png`) });
    if (i === 0) {
      for (let j = 0; j < 3; j++) await padPress(13);
      await padPress(0);
      await page.evaluate(() => { window.testPad = null; }); await tick(1);
    } else { await page.keyboard.press('Enter'); await tick(1); }
    assert.equal(await page.evaluate(() => window.__game.campaign.floor), i + 1);
    assert.equal(await page.evaluate(() => window.__game.collected.red), frozen.drops, 'collected paint travels with the run');
    assert.equal(await page.evaluate(() => window.__game.input.mouse.lDown), false, 'camp click cannot leak into combat');
  }
  assert.equal(await page.evaluate(() => window.__game.state), 'end');
  assert.equal(await page.evaluate(() => window.__game.endKind), 'victory');
  assert.equal(await page.evaluate(() => window.__game.save.stats.victories), 1);
  assert.deepEqual(await page.evaluate(() => window.__game.campaign.cleared), expected);
  await page.screenshot({ path: path.join(out, '39-dungeon-complete.png') });
  await tick(40); // Let the end screen's 0.6s accidental-input guard expire.
  await page.keyboard.press('Enter'); await tick(2);
  assert.equal(await page.evaluate(() => window.__game.campaign.floor), 0);
  assert.deepEqual(await page.evaluate(() => window.__game.campaign.rewards), []);
  assert.equal(await page.evaluate(() => window.__game.heron.kind), 'gray');
  await page.evaluate(() => { const g = window.__game; g.player.iframes = 0; g.player.hurt(9999, g.tuning); }); await tick(180);
  assert.equal(await page.evaluate(() => window.__game.endKind), 'defeat');
  await page.keyboard.press('Enter'); await tick(2);
  assert.equal(await page.evaluate(() => window.__game.campaign.floor), 0);
  assert.equal(await page.evaluate(() => window.__game.player.alive), true);
  report.push('Four ordered dungeon bosses: actual mouse/keyboard/controller camp choices, D-pad focus and B cancellation, frozen rests, carried drops, exactly one final victory, clean run rewards reset and death restart PASS.');
}
