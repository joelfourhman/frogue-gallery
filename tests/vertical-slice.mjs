// Browser integration evidence. Actual game simulation and DOM input handlers;
// only late-game scene setup is staged. No external requests or saved user data.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer, ROOT } from '../scripts/dev.mjs';
import { browserPath } from '../scripts/browser.mjs';

const out = path.join(ROOT, 'tests', '.out', 'astra');
await fs.mkdir(out, { recursive: true });
const server = createServer(process.argv.includes('--dist') ? path.join(ROOT, 'dist', 'frogue-gallery') : ROOT);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: browserPath(), headless: true });
const errors = [], report = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    let seed = 7349;
    Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  try { await page.waitForFunction(() => window.__game, null, { timeout: 5000, polling: 50 }); }
  catch (error) { console.error(errors); await page.screenshot({ path: path.join(out, 'boot-failure.png') }); throw error; }
  const tick = n => page.evaluate(n => { const g = window.__game; for (let i = 0; i < n; i++) g._frame(g.last + 1000 / 60); }, n);
  await tick(100);
  await page.screenshot({ path: path.join(out, '01-title.png') });
  await page.keyboard.press('Enter'); await tick(2);
  const first = await page.evaluate(() => {
    const g = window.__game;
    const step = () => g._frame(g.last + 1000 / 60);
    const aim = (x, y) => { const v = g._view(); g.input.setView(v); g.input.mouse.x = (x - v.x) * v.scale; g.input.mouse.y = (y - v.y) * v.scale; g.input.update(); };
    const walk = (x, y) => {
      for (let i = 0; i < 300 && Math.hypot(g.player.x - x, g.player.y - y) > 12; i++) {
        g.input.keys.clear();
        if (Math.abs(g.player.x - x) > 8) g.input.keys.add(g.player.x < x ? 'd' : 'a');
        if (Math.abs(g.player.y - y) > 8) g.input.keys.add(g.player.y < y ? 's' : 'w');
        aim(x, y); step();
      }
      g.input.keys.clear();
    };
    const s = g.studio.studies[0], offsets = [[-62, 16], [0, -28], [62, 16]];
    for (let phase = 0; phase < 3; phase++) {
      const x = s.x + offsets[phase][0], y = s.y + offsets[phase][1];
      walk(x - 43, y);
      g.input.kb.add(String(['red', 'blue', 'green'].indexOf(s.colors[phase]) + 1));
      for (let i = 0; i < 90 && s.step === phase && g.player.alive; i++) { aim(x, y); g.input.mouse.lDown = true; step(); }
      g.input.mouse.lDown = false;
    }
    g.banners = []; g._drawAll();
    return { complete: s.step, alive: g.player.alive, hp: g.player.hp, maxHp: g.player.maxHp, seconds: g.runT, pages: g.save.sketchbook.length };
  });
  assert.equal(first.complete, 3); assert.equal(first.alive, true); assert.equal(first.hp, first.maxHp); assert.equal(first.pages, 1);
  report.push({ openingWithoutGodMode: first });
  await page.screenshot({ path: path.join(out, '02-first-light.png') });

  // Verify release-to-fire through real mouse events, with CSS pointer scaling.
  await page.mouse.move(700, 480); await page.mouse.down({ button: 'right' }); await tick(40);
  assert.equal(await page.evaluate(() => window.__game.player.splashCharge), 1);
  await page.mouse.up({ button: 'right' }); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.player.splashCharge), 0);
  report.push('RMB charge/release fired through browser DOM input');
  await page.keyboard.press('j'); await tick(1);
  const frozen = await page.evaluate(() => window.__game.runT); await tick(180);
  assert.equal(await page.evaluate(() => window.__game.runT), frozen);
  await page.screenshot({ path: path.join(out, '03-sketchbook.png') });
  const exportRect = await page.evaluate(async () => {
    const { bookLayout } = await import('./src/studio.js'); const r = bookLayout(window.__game).export;
    const c = document.querySelector('canvas').getBoundingClientRect();
    return { x: c.x + (r.x + r.w / 2) * c.width / 1280, y: c.y + (r.y + r.h / 2) * c.height / 800 };
  });
  const downloadPromise = page.waitForEvent('download');
  await page.mouse.click(exportRect.x, exportRect.y); await tick(1);
  const download = await downloadPromise; await download.saveAs(path.join(out, 'postcard.png'));
  assert((await fs.stat(path.join(out, 'postcard.png'))).size > 15000);
  report.push('Postcard PNG exported successfully');

  // Staged entry points, real paint strokes: later studies and progression.
  await page.keyboard.press('j'); await tick(1);
  const completion = await page.evaluate(async () => {
    const g = window.__game, { studyNode } = await import('./src/logic.js');
    for (const s of g.studio.studies.slice(1)) {
      for (let k = 0; k < 3; k++) {
        const n = studyNode(s); g.player.x = n.x - 40; g.player.y = n.y; g.player.pigment = n.pigment; g.player.aimA = 0;
        for (let j = 0; j < 3; j++) { g.paint.swipeCd = 0; g.player.swipeT = 0; g.paint.trySwipe([]); }
      }
    }
    g.banners = []; g.cam.x = g.player.x; g.cam.y = g.player.y; g._drawAll();
    return g.save.studio.completed.length;
  });
  assert.equal(completion, 3);
  await page.screenshot({ path: path.join(out, '04-borrowed-sky.png') });

  // Victory at low restoration previously crashed only in a real rendered beat.
  await page.evaluate(() => { const g = window.__game; g._endRun('victory'); g._cine = { t: 1.8, dur: 4, firstBeat: true }; g.world.worldColorSat = () => 0.25; g._drawAll(); });
  await page.screenshot({ path: path.join(out, '05-victory.png') });
  await page.reload(); await page.waitForFunction(() => window.__game, null, { polling: 50 }); await tick(100);
  assert.equal(await page.evaluate(() => window.__game.save.studio.completed.length), 3);
  assert.equal(await page.evaluate(() => window.__game.save.sketchbook.length), 1);
  await page.keyboard.press('j'); await tick(1);
  for (const [width, height] of [[960, 720], [1920, 1080], [640, 480]]) {
    await page.setViewportSize({ width, height }); await tick(1);
    const rect = await page.locator('#game').boundingBox();
    assert(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= height);
    await page.screenshot({ path: path.join(out, `06-book-${width}.png`) });
  }
  report.push('Save reload and 640/960/1920 viewport bounds verified');

  // Q2: The Lantern Garden — a real Reeds expedition with real paint strokes
  // at its fixed banks spot (no god mode; the study is optional content).
  const garden = await page.evaluate(async () => {
    const g = window.__game, { studyNode } = await import('./src/logic.js');
    g._closeSketchbook();
    g.save.flags.reedsUnlocked = true;
    g._beginExpedition(false, { reeds: true });
    const s = g.studio.studies.find(st => st.id === 'lantern-garden');
    if (!s) throw new Error('the Lantern Garden is missing from a normal Reeds expedition');
    for (let k = 0; k < 3; k++) {
      const n = studyNode(s);
      g.player.x = n.x - 40; g.player.y = n.y; g.player.pigment = n.pigment; g.player.aimA = 0;
      for (let j = 0; j < 3; j++) { g.paint.swipeCd = 0; g.player.swipeT = 0; g.paint.trySwipe([]); }
    }
    g.banners = []; g.cam.x = g.player.x; g.cam.y = g.player.y; g._drawAll();
    const p = g.save.sketchbook[g.save.sketchbook.length - 1];
    return { step: s.step, x: s.x, y: s.y, completed: g.save.studio.completed,
      page: p ? { biome: p.biome, studies: p.studies } : null };
  });
  assert.equal(garden.step, 3);
  assert.equal(garden.x, 3300); assert.equal(garden.y, 780);
  assert(garden.completed.includes('lantern-garden') && garden.completed.includes('first-light'));
  assert(garden.page && garden.page.biome === 'reeds' && garden.page.studies.includes('lantern-garden'));
  report.push({ lanternGarden: garden });
  await page.keyboard.press('j'); await tick(1);
  await page.evaluate(() => { const g = window.__game; g._bookIndex = g.save.sketchbook.length - 1; g._drawAll(); });
  await page.screenshot({ path: path.join(out, '10-lantern-garden.png') });
  await page.evaluate(() => window.__game._closeSketchbook());

  // Exercise every lesson through the real paint/update path. Reset this
  // isolated browser save, never the user's profile. No invulnerability cheat.
  await page.setViewportSize({ width: 1280, height: 820 });
  const lessons = await page.evaluate(async () => {
    const g = window.__game, { freshSave } = await import('./src/logic.js');
    g._closeSketchbook(); g.save = freshSave(); g._beginExpedition(true);
    const step = () => g._frame(g.last + 1000 / 60);
    const paint = pigment => {
      const t = g.tutorial.target, v = g._view();
      g.player.pigment = pigment;
      g.input.mouse.x = (t.x - v.x) * v.scale;
      g.input.mouse.y = (t.y - v.y) * v.scale;
      g.input.mouse.lDown = true; step();
    };
    for (let n = 0; n < 1800 && g.tutorial.idx < 6; n++) paint(g._tutorialPhase().pigment);
    if (g.tutorial.idx !== 6) throw new Error('Practice drills did not complete: ' + g.tutorial.idx);
    for (let n = 0; n < 120; n++) paint('red'); // deliberately overpaint one hue
    if (g.sketchHeron.hp < 1) throw new Error('Sketch heron can be killed before its lesson');
    for (const pigment of ['blue', 'green']) for (let n = 0; n < 12 && !g.tutorial.done; n++) paint(pigment);
    g.input.mouse.lDown = false; g.banners = []; g._drawAll();
    return { done: g.tutorial.done, drills: g.save.tutorialDrills, hp: g.player.hp, maxHp: g.player.maxHp };
  });
  assert(lessons.done && Object.values(lessons.drills).every(Boolean));
  assert.equal(lessons.hp, lessons.maxHp); report.push({ sevenGuidedLessons: lessons });
  await page.screenshot({ path: path.join(out, '07-lessons-complete.png') });
  await page.keyboard.press('p'); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.paused), true);
  await page.keyboard.press('p'); await tick(1);

  // Full-health real boss fight and end transition. Arena placement and god
  // mode isolate the boss state machine; this does NOT measure player skill.
  await page.evaluate(() => { const g = window.__game; g._beginExpedition(); g.heron._intro = 0; g._browserBossFrames = 0; });
  let boss;
  for (let chunk = 0; chunk < 36; chunk++) {
    boss = await page.evaluate(() => {
      const g = window.__game, h = g.heron, p = g.player;
      for (let n = 0; n < 300 && !h.flying && h.hp > 0; n++) {
        p.x = h.x - 50; p.y = h.y - 40; p.iframes = 99;
        p.pigment = ['red', 'blue', 'green'][Math.floor(g._browserBossFrames / 150) % 3];
        const v = g._view(); g.input.mouse.x = (h.x - v.x) * v.scale; g.input.mouse.y = (h.y - 100 - v.y) * v.scale;
        g.input.mouse.lDown = true; g._frame(g.last + 1000 / 60); g._browserBossFrames++;
      }
      return { hp: h.hp, maxHp: h.maxHp, flying: h.flying, seconds: g._browserBossFrames / 60 };
    });
    if (boss.flying || boss.hp <= 0) break;
  }
  assert(boss.hp <= 0 || boss.flying); await page.evaluate(() => window.__game.input.reset()); await tick(600);
  assert.equal(await page.evaluate(() => window.__game.state), 'end');
  assert.equal(await page.evaluate(() => window.__game.endKind), 'victory');
  report.push({ realBossVictoryWithGodMode: boss });
  await page.screenshot({ path: path.join(out, '08-earned-victory.png') });
  await page.evaluate(() => { const g = window.__game; g._beginExpedition(); g.player.iframes = 0; g.player.hurt(99999, g.tuning); }); await tick(180);
  assert.equal(await page.evaluate(() => window.__game.endKind), 'defeat');
  await page.screenshot({ path: path.join(out, '09-defeat.png') });
  await page.keyboard.press('Escape'); await tick(1); await page.keyboard.press('Enter'); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.state), 'expedition');
  assert.equal(await page.evaluate(() => window.__game.player.alive && !window.__game.dying), true);
  report.push('Defeat, title return and fresh expedition restart verified');
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ report, errors }, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log('VERTICAL SLICE BROWSER CHECKS PASSED');
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
