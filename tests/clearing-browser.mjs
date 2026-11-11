import assert from 'node:assert/strict';
import path from 'node:path';

// DOM input checks; positions and one attack windup are staged explicitly.
// Full encounter throughput is measured separately; this is not a human test.
export async function clearingBrowser({ page, tick, out, report }) {
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.evaluate(async () => {
    const g = window.__game, { freshSave } = await import('./src/logic.js');
    g.save = freshSave(); g.options.wander = false; g.challenge = null;
    g._beginExpedition(); g.spawnT = 999; g.banners = []; g._tut = [];
  });
  const aimAt = async (x, y) => {
    const pos = await page.evaluate(({ x, y }) => {
      const g = window.__game, v = g._view(), c = g.canvas.getBoundingClientRect();
      return { x: c.x + (x - v.x) * v.scale * c.width / g.cw, y: c.y + (y - v.y) * v.scale * c.height / g.ch };
    }, { x, y });
    await page.mouse.move(pos.x, pos.y);
  };
  const prop = await page.evaluate(() => {
    const g = window.__game, a = g.studio.garden.props[0];
    g.player.x = a.x - 52; g.player.y = a.y; g.cam.x = g.player.x; g.cam.y = g.player.y;
    g.input.setView(g._view()); g._drawAll(); return { x: a.x, y: a.y };
  });
  // Re-aim and paint with a real held button, preserving camera coordinates.
  await aimAt(prop.x, prop.y); await page.mouse.down(); await tick(18); await page.mouse.up();
  assert.equal(await page.evaluate(() => window.__game.studio.garden.props[0].pigment), 'red');
  await page.keyboard.press('2'); await tick(18); await aimAt(prop.x, prop.y);
  await page.mouse.down(); await tick(18); await page.mouse.up();
  assert.equal(await page.evaluate(() => window.__game.studio.garden.props[0].pigment), 'blue');
  await tick(45);
  assert.equal(await page.evaluate(() => window.__game.canvas.style.cursor), 'none');
  await page.screenshot({ path: path.join(out, '32-free-repainting.png') });
  await page.keyboard.press('p'); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.canvas.style.cursor), 'default');
  await page.keyboard.press('p'); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.canvas.style.cursor), 'none');

  const bell = await page.evaluate(async () => {
    const g = window.__game, { CLEARING } = await import('./src/logic.js');
    g.enemies = []; g.player.x = CLEARING.x - 60; g.player.y = CLEARING.y;
    g.player.vx = g.player.vy = 0; g.cam.x = g.player.x; g.cam.y = g.player.y;
    g.input.reset(); g.input.setView(g._view()); g._drawAll();
    return { x: CLEARING.x, y: CLEARING.y };
  });
  await aimAt(bell.x, bell.y); await page.mouse.down(); await tick(18); await page.mouse.up();
  assert.equal(await page.evaluate(() => window.__game.encounter.phase), 'fight');
  assert.equal(await page.evaluate(() => window.__game.enemies.filter(e => e._clearing).length), 2);
  // Isolate one real telegraph to verify the real Space input escapes its lane.
  const health = await page.evaluate(() => {
    const g = window.__game, p = g.player, [a, b] = g.encounter.members;
    a.x = p.x + 110; a.y = p.y; a.clearingPhase = 'approach'; a.status = null;
    b.clearingPhase = 'recover'; b.clearingT = 99;
    p.hopCd = 0; p.iframes = 0; g.input.reset(); return p.hp;
  });
  await tick(1);
  assert.equal(await page.evaluate(() => window.__game.encounter.members[0].clearingPhase), 'tell');
  await page.screenshot({ path: path.join(out, '33-readable-attack.png') });
  await page.keyboard.down('w'); await page.keyboard.press('Space'); await tick(14); await page.keyboard.up('w');
  await tick(42);
  assert.equal(await page.evaluate(() => window.__game.player.hp), health, 'real directional dodge escapes the committed warning');

  const target = await page.evaluate(() => {
    const g = window.__game, p = g.player, a = g.encounter.members[0];
    a.x = p.x + 52; a.y = p.y; a.hp = 120; a.dead = false; a.status = null;
    a.clearingPhase = 'recover'; a.clearingT = 5; g.paint.swipeCd = 0; p.swipeT = 0;
    return { x: a.x, y: a.y };
  });
  await page.keyboard.press('2'); await tick(1); await aimAt(target.x, target.y);
  await page.mouse.down(); await tick(1); await page.mouse.up();
  assert(await page.evaluate(() => ['slow', 'freeze'].includes(window.__game.encounter.members[0].status?.type)));
  await tick(18); await page.keyboard.press('1'); await tick(1); await aimAt(target.x, target.y);
  await page.mouse.down(); await tick(1); await page.mouse.up();
  assert(await page.evaluate(() => window.__game.paint.hitNotes.some(n => String(n.text).includes('Blue + red'))), 'actual color change earns combo feedback');
  await page.screenshot({ path: path.join(out, '34-color-combo.png') });
  assert(await page.evaluate(() => window.__game.heron._intro > 0), 'boss remains dormant through opening combat');
  await page.setViewportSize({ width: 640, height: 500 }); await tick(1);
  await page.screenshot({ path: path.join(out, '35-clearing-640.png') });
  await page.setViewportSize({ width: 1280, height: 820 });

  // A dormant heron does not wake merely because time passes in the opening.
  await page.evaluate(() => { const g = window.__game; g.encounter.cancel(); g.player.x = 300; g.runT = 600; g.enemies = []; });
  await tick(1); assert(await page.evaluate(() => window.__game.heron._intro > 0));
  const skip = await page.evaluate(async () => {
    const g = window.__game, { freshSave } = await import('./src/logic.js');
    g.save = freshSave(); g._beginExpedition(true); g._drawAll();
    const r = g._tutorialLayout().skip, c = g.canvas.getBoundingClientRect();
    return { x: c.x + (r.x + r.w / 2) * c.width / g.cw, y: c.y + (r.y + r.h / 2) * c.height / g.ch };
  });
  await page.mouse.move(skip.x, skip.y); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.canvas.style.cursor), 'default', 'Skip button retains visible pointer during practice');
  await page.mouse.click(skip.x, skip.y); await tick(1);
  assert.equal(await page.evaluate(() => window.__game._tutorialActive()), false);
  report.push('Free red/blue scenery repaint, pointer ownership, real bell activation, warning/dodge and blue-red combo verified through DOM input; boss still dormant after opening time skip.');
}
