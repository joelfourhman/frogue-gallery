// Control-feel regression through DOM input. Combat fixtures isolate feedback;
// they are not human playtests or estimates of ordinary enemy difficulty.
import assert from 'node:assert/strict';
import path from 'node:path';

export async function controlFeelBrowser({ page, tick, out, report }) {
  await page.evaluate(async () => {
    const g = window.__game, { freshSave } = await import('./src/logic.js');
    g.save = freshSave(); g.options.wander = false; g.options.shake = true;
    g._beginExpedition(); g.spawnT = 999; g.banners = []; g._tut = [];
  });
  await page.keyboard.down('d'); await tick(30); await page.keyboard.up('d');
  const releaseX = await page.evaluate(() => window.__game.player.x); await tick(30);
  const drift = await page.evaluate(x => window.__game.player.x - x, releaseX);
  assert(drift > 0 && drift < 5, 'real key release stops within five pixels');
  const aimAt = async (x, y) => {
    const q = await page.evaluate(({ x, y }) => {
      const g = window.__game, v = g._view(), c = g.canvas.getBoundingClientRect();
      return { x: c.x + (x - v.x) * v.scale * c.width / g.cw, y: c.y + (y - v.y) * v.scale * c.height / g.ch };
    }, { x, y });
    await page.mouse.move(q.x, q.y);
  };
  let position = await page.evaluate(() => ({ x: window.__game.player.x, y: window.__game.player.y }));
  await aimAt(position.x + 100, position.y);
  await page.keyboard.press('Space'); await tick(1);
  assert(await page.evaluate(x => window.__game.player.x - x > 7, position.x), 'hop moves immediately on its first frame');
  await tick(50);

  await page.keyboard.press('q'); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.player.pigment), 'green');
  await page.keyboard.press('e'); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.player.pigment), 'red');
  await page.mouse.wheel(0, 100);
  await page.waitForFunction(() => window.__game.input.mouse.wheel > 0, null, { polling: 20 });
  await tick(1); assert.equal(await page.evaluate(() => window.__game.player.pigment), 'blue');
  await page.keyboard.press('4'); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.player.pigment), 'dry');
  await page.keyboard.press('e'); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.player.pigment), 'red');

  const strokes = await page.evaluate(() => window.__game.studio.strokes.length);
  await page.mouse.click(700, 420); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.studio.strokes.length), strokes + 1, 'short click between frames produces a swipe');
  await tick(20);
  assert.equal(await page.evaluate(() => window.__game.studio.strokes.length), strokes + 1, 'one click does not repeat');

  // An unkillable stationary target isolates regular-hit clock and text density.
  // No god mode on the frog. Damage/HP/movement of live encounters are unchanged.
  await page.evaluate(async () => {
    const g = window.__game, { spawnEnemy } = await import('./src/enemies.js');
    g.player.x = 1800; g.player.y = 750; g.player.vx = g.player.vy = 0;
    g.cam.x = 1800; g.cam.y = 750; g._zoneI = 2; g.weatherZoneI = 2;
    g.input.setView(g._view()); g.input.update(); g.banners = [];
    const e = spawnEnemy('beetle', 1860, 750, g.tuning);
    e.hp = e.maxHp = 1000; e.speed = 0; g.enemies = [e];
    g._drawAll();
  });
  await page.keyboard.press('2'); await tick(1);
  const start = await page.evaluate(() => window.__game.runT);
  await aimAt(1860, 750); await page.mouse.down();
  for (let i = 0; i < 180; i++) { await aimAt(1860, 750); await tick(1); }
  await page.mouse.up();
  const combat = await page.evaluate(s => {
    const g = window.__game;
    return { seconds: g.runT - s, scale: g.timeScale, hp: g.enemies[0].hp,
      notes: g.paint.hitNotes.length, status: g.enemies[0].status.type };
  }, start);
  assert(Math.abs(combat.seconds - 3) < 0.01, 'normal hits preserve full-speed movement clock');
  assert.equal(combat.scale, 1); assert(combat.hp < 1000); assert(combat.notes <= 2);
  assert(['slow', 'freeze'].includes(combat.status), 'blue applies its slow/freeze counter through real input');
  await page.screenshot({ path: path.join(out, '29-close-combat.png') });

  await page.mouse.down({ button: 'right' }); await tick(40);
  assert.equal(await page.evaluate(() => window.__game.player.splashCharge), 1);
  await page.screenshot({ path: path.join(out, '30-splash-readiness.png') });
  await page.setViewportSize({ width: 640, height: 480 }); await tick(1);
  await page.screenshot({ path: path.join(out, '31-combat-640.png') });
  const beforeSplash = await page.evaluate(() => window.__game.studio.strokes.length);
  await page.mouse.up({ button: 'right' }); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.studio.strokes.length), beforeSplash + 1);
  assert.equal(await page.evaluate(() => window.__game.player.splashCharge), 0);
  assert(await page.evaluate(() => window.__game.timeScale < 1), 'charged impact retains its heavier feedback');
  await page.setViewportSize({ width: 1280, height: 820 }); await tick(1);
  report.push({ controlFeel: { releaseDriftPx: drift, normalHitSecondsOver3Seconds: combat.seconds,
    damageAndStatusLabels: combat.notes, input: 'real keys, mouse wheel, short click, hold/release and immediate hop',
    fixture: 'stationary 1000 HP beetle; no player god mode; source and dist' } });
}
