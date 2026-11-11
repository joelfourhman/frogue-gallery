// Actual DOM input for the atlas and study feedback. Scene placement is staged;
// this is regression evidence, not a human playtest or traversal measurement.
import assert from 'node:assert/strict';
import path from 'node:path';

export async function livingSketchbookBrowser({ page, tick, out, report }) {
  const begin = async (reeds = false) => {
    await page.evaluate(async reeds => {
      const g = window.__game, { freshSave } = await import('./src/logic.js');
      g.save = freshSave(); g.save.flags.heronDefeated = reeds;
      g.options.wander = false; g.options.shake = false;
      g._beginExpedition(false, { campaignFloor: reeds ? 1 : 0 }); g.spawnT = 999;
      g.banners = []; g._drawAll();
    }, reeds);
  };
  const clickRect = async kind => {
    const p = await page.evaluate(async kind => {
      const g = window.__game, { atlasLayout, atlasButton } = await import('./src/atlas.js');
      const r = kind === 'open' ? atlasButton() : atlasLayout(g).close;
      const c = g.canvas.getBoundingClientRect();
      return { x: c.left + (r.x + r.w / 2) * c.width / g.cw, y: c.top + (r.y + r.h / 2) * c.height / g.ch };
    }, kind);
    await page.mouse.click(p.x, p.y); await tick(1);
  };
  await begin();
  await page.keyboard.down('d'); await page.mouse.down({ button: 'right' }); await tick(12);
  await page.keyboard.press('v'); await tick(1);
  assert.equal(await page.evaluate(() => window.__game._atlasOpen), true);
  const frozen = await page.evaluate(() => {
    const g = window.__game;
    return { runT: g.runT, x: g.player.x, hp: g.player.hp, spawnT: g.spawnT,
      wildlifeTime: g.world.pondLife.time, strokes: g.studio.strokes.length, save: JSON.stringify(g.save) };
  });
  await tick(180);
  assert.deepEqual(await page.evaluate(() => {
    const g = window.__game;
    return { runT: g.runT, x: g.player.x, hp: g.player.hp, spawnT: g.spawnT,
      wildlifeTime: g.world.pondLife.time, strokes: g.studio.strokes.length, save: JSON.stringify(g.save) };
  }), frozen, 'atlas suspends world, damage, spawns, artwork and persistence');
  await page.screenshot({ path: path.join(out, '23-field-atlas.png') });
  await page.keyboard.up('d'); await page.mouse.up({ button: 'right' });
  await page.keyboard.press('Escape'); await tick(1); await tick(2);
  assert.equal(await page.evaluate(() => window.__game._atlasOpen), false);
  assert.equal(await page.evaluate(() => window.__game.studio.strokes.length), frozen.strokes, 'closing never releases a stored paint action');
  assert.equal(await page.evaluate(() => window.__game.input.keys.size), 0);

  await page.keyboard.press('p'); await tick(1);
  await clickRect('open'); assert.equal(await page.evaluate(() => window.__game._atlasOpen), true);
  await page.setViewportSize({ width: 640, height: 480 }); await tick(1);
  await page.screenshot({ path: path.join(out, '24-field-atlas-640.png') });
  await clickRect('close');
  assert.equal(await page.evaluate(() => window.__game.paused && !window.__game._atlasOpen), true, 'mouse close preserves previous pause');

  // Gamepad API injection exercises menu navigation; no physical device claim.
  await page.evaluate(() => {
    window.testPad = { id: 'atlas test pad', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [window.testPad] });
    const g = window.__game; g._gp.menu = null; g._gp.mi.pause = 0;
  });
  const padPress = async button => {
    await page.evaluate(b => { window.testPad.buttons[b] = { pressed: true, value: 1 }; }, button); await tick(1);
    await page.evaluate(b => { window.testPad.buttons[b] = { pressed: false, value: 0 }; }, button); await tick(1);
  };
  await tick(1);
  for (let i = 0; i < 3; i++) await padPress(13);
  await padPress(0);
  assert.equal(await page.evaluate(() => window.__game._atlasOpen), true, 'D-pad and A open atlas from pause');
  await padPress(1);
  assert.equal(await page.evaluate(() => !window.__game._atlasOpen && window.__game.paused), true, 'B returns to pause');
  await page.evaluate(() => { window.testPad = null; }); await tick(1);
  await page.keyboard.press('p'); await tick(1);
  await page.setViewportSize({ width: 1280, height: 820 }); await tick(1);
  report.push('Field Atlas actual V/Esc, mouse at 640px, injected controller, frozen simulation and held-input cleanup PASS');

  for (const reeds of [false, true]) {
    await begin(reeds);
    const target = await page.evaluate(async () => {
      const g = window.__game, { studyNode } = await import('./src/logic.js');
      const s = g.studio.studies[0], n = studyNode(s);
      g.player.x = n.x - 45; g.player.y = n.y; g.cam.x = s.x; g.cam.y = s.y;
      g.banners = []; g._drawAll();
      return { x: n.x, y: n.y, pigment: n.pigment };
    });
    const aimAtTarget = async () => {
      const aim = await page.evaluate(({ x, y }) => {
        const g = window.__game, v = g._view(), c = g.canvas.getBoundingClientRect();
        return { x: c.left + (x - v.x) * v.scale * c.width / g.cw, y: c.top + (y - v.y) * v.scale * c.height / g.ch };
      }, target);
      await page.mouse.move(aim.x, aim.y);
    };
    await aimAtTarget();
    await page.keyboard.press('1'); await tick(1);
    await page.mouse.down(); await tick(1); await page.mouse.up();
    assert.equal(await page.evaluate(() => window.__game.studio.studies[0].step), 0);
    assert.equal(await page.evaluate(() => window.__game.studio.studies[0].coats), 0);
    assert(await page.evaluate(() => window.__game.studio.studies[0].wrongT > 0), 'real wrong-color stroke gets relevant guidance');
    await page.screenshot({ path: path.join(out, reeds ? '26-reeds-study-guidance.png' : '25-study-guidance.png') });
    await tick(35);
    await page.keyboard.press(String(['red', 'blue', 'green'].indexOf(target.pigment) + 1)); await tick(1);
    await aimAtTarget();
    await page.mouse.down(); await tick(1); await page.mouse.up();
    const painted = await page.evaluate(() => {
      const g = window.__game, s = g.studio.studies[0];
      return { coats: s.coats, pigment: g.player.pigment, x: g.player.x, y: g.player.y,
        aim: g.player.aimA, stroke: g.studio.strokes.at(-1), cd: g.paint.swipeCd,
        step: s.step, tutorial: g._tutorialActive(), state: g.state };
    });
    assert.equal(painted.coats, 1, JSON.stringify({ reeds, target, painted }));
    assert.equal(await page.evaluate(() => window.__game.studio.studies[0].wrongT), 0);
    if (reeds) {
      await page.keyboard.press('v'); await tick(1);
      const atlas = await page.evaluate(async () => (await import('./src/atlas.js')).atlasForGame(window.__game));
      assert.equal(atlas.studies.length, 2); assert(atlas.moth); assert.equal(atlas.crossing, null);
      await page.screenshot({ path: path.join(out, '27-reeds-atlas.png') });
      await page.keyboard.press('v'); await tick(1);
    }
  }
  report.push('Swamp/Reeds actual wrong-pigment and correct-coat input; Reeds atlas landmarks PASS');

  await begin();
  const wildlife = await page.evaluate(() => {
    const g = window.__game, f = g.world.pondLife.creatures[0];
    g.player.x = f.x - 55; g.player.y = f.y; g.cam.x = f.x; g.cam.y = f.y; g._drawAll();
    const v = g._view(), c = g.canvas.getBoundingClientRect();
    return { x: c.left + (f.x - v.x) * v.scale * c.width / g.cw, y: c.top + (f.y - v.y) * v.scale * c.height / g.ch };
  });
  await page.keyboard.press('2'); await tick(1); await page.mouse.move(wildlife.x, wildlife.y);
  await page.mouse.down(); await tick(2); await page.mouse.up(); await tick(25);
  assert(await page.evaluate(() => window.__game.world.pondLife.creatures.some(f => f.reaction > 0 && f.color)), 'real brush excites nearby decorative wildlife');
  await page.screenshot({ path: path.join(out, '28-pond-life.png') });
  await tick(240);
  assert.equal(await page.evaluate(() => window.__game.world.pondLife.creatures.some(f => f.reaction > 0)), false, 'cosmetic response expires');
  report.push('Actual brush/world-splat wildlife curiosity and expiry PASS');
}
