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
    // Pixel evidence uses deterministic CPU rasterization. GPU/readback mode
    // transitions can differ by one channel value even on the same surface.
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, options) {
      return getContext.call(this, type, type === '2d' ? { ...options, willReadFrequently: true } : options);
    };
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
  // Q6: shipped pin UI through real browser key/mouse input; book suspends play.
  await page.keyboard.press('x'); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.save.sketchPins.length), 1);
  const clickBook = async key => {
    const p = await page.evaluate(async key => {
      const g = window.__game, { bookLayout } = await import('./src/studio.js'), r = bookLayout(g)[key];
      const c = g.canvas.getBoundingClientRect();
      return { x: c.left + (r.x + r.w / 2) * c.width / g.cw, y: c.top + (r.y + r.h / 2) * c.height / g.ch };
    }, key);
    await page.mouse.click(p.x, p.y); await tick(1);
  };
  await clickBook('pin');
  assert.equal(await page.evaluate(() => window.__game.save.sketchPins.length), 0);
  await page.keyboard.press('x'); await tick(1);
  await page.screenshot({ path: path.join(out, '12-pinned-book.png') });
  report.push('Q6 real keyboard/mouse pin toggles and expedition suspension');
  // Q7 vertical slice: native text ownership, confirm/cancel, explicit exhibit.
  await clickBook('rename');
  const titleInput = page.locator('input[aria-label="Postcard title"]');
  await titleInput.fill('a'.repeat(80));
  assert.equal(await titleInput.evaluate(el => Array.from(el.value).length), 48, 'editor bounds live input, not just the saved caption');
  await titleInput.fill('🌿'.repeat(60));
  assert.equal(await titleInput.evaluate(el => Array.from(el.value).length), 48);
  await titleInput.fill('My xj swamp <3 🌿');
  await page.keyboard.press('j'); await page.keyboard.press('x'); await page.keyboard.press('m'); await tick(1);
  assert.equal(await page.evaluate(() => window.__game._bookOpen), true);
  assert.equal(await page.evaluate(() => window.__game.save.sketchPins.length), 1);
  await titleInput.fill('My little swamp 🌿');
  await page.keyboard.press('Enter'); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.save.sketchbook[window.__game._bookIndex].title), 'My little swamp 🌿');
  await clickBook('rename'); await titleInput.fill('Discard this');
  await page.keyboard.press('Escape'); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.save.sketchbook[window.__game._bookIndex].title), 'My little swamp 🌿');
  await clickBook('rename'); await titleInput.fill('Mouse cancellation'); await clickBook('cancel');
  assert.equal(await page.evaluate(() => window.__game.save.sketchbook[window.__game._bookIndex].title), 'My little swamp 🌿');
  await clickBook('rename'); await titleInput.fill('My little swamp 🌿'); await clickBook('confirm');
  assert.equal(await titleInput.count(), 0);
  await clickBook('exhibit');
  assert.equal(await page.evaluate(() => window.__game.save.sketchExhibit === window.__game.save.sketchbook[window.__game._bookIndex].id), true);
  await page.screenshot({ path: path.join(out, '13-named-book.png') });
  // Exercise the actual Gamepad API polling -> D-pad focus -> A/B input path.
  await page.setViewportSize({ width: 640, height: 480 }); await tick(1);
  await page.evaluate(() => {
    window.testPad = { id: 'exhibition test pad', axes: [0,0,0,0], buttons: Array.from({length:17},()=>({pressed:false,value:0})) };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [window.testPad] });
    const g = window.__game; g._gp.menu = null; g._gp.mi.sketchbook = 0;
  });
  const padPress = async button => {
    await page.evaluate(b => { window.testPad.buttons[b] = {pressed:true,value:1}; }, button); await tick(1);
    await page.evaluate(b => { window.testPad.buttons[b] = {pressed:false,value:0}; }, button); await tick(1);
  };
  await tick(1);
  for (let i=0;i<4;i++) await padPress(13);
  await padPress(0);
  assert.equal(await page.evaluate(() => window.__game.save.sketchPins.length), 0);
  assert.equal(await page.evaluate(() => window.__game.save.sketchExhibit), null);
  await padPress(0);
  assert.equal(await page.evaluate(() => window.__game.save.sketchPins.length), 1);
  await padPress(13); await padPress(13); await padPress(0); // explicitly restore exhibit after re-pin
  await padPress(12);
  await padPress(0);
  await titleInput.waitFor({ state: 'visible' });
  const inputBounds = await titleInput.boundingBox();
  assert(inputBounds.x >= 0 && inputBounds.y >= 0 && inputBounds.x + inputBounds.width <= 640 && inputBounds.y + inputBounds.height <= 480);
  await titleInput.fill('Controller cancelled');
  await page.screenshot({ path: path.join(out, '14-editor-640.png') });
  await padPress(1);
  assert.equal(await titleInput.count(), 0);
  assert.equal(await page.evaluate(() => window.__game._bookOpen), true);
  await padPress(0); await titleInput.fill('My little swamp 🌿'); await padPress(0);
  assert.equal(await titleInput.count(), 0);
  await padPress(13); await padPress(0); // exhibit removes; second A restores explicitly
  assert.equal(await page.evaluate(() => window.__game.save.sketchExhibit), null);
  await padPress(0);
  assert.equal(await page.evaluate(() => !!window.__game.save.sketchExhibit), true);
  for(let i=0;i<4;i++) await padPress(12);
  const controllerDownload = page.waitForEvent('download');
  await padPress(0);
  await (await controllerDownload).saveAs(path.join(out,'controller-postcard.png'));
  await page.evaluate(() => { window.testPad = null; }); await tick(1);
  await page.setViewportSize({width:1280,height:820}); await tick(1);
  const exportRect = await page.evaluate(async () => {
    const { bookLayout } = await import('./src/studio.js'); const r = bookLayout(window.__game).export;
    const c = document.querySelector('canvas').getBoundingClientRect();
    return { x: c.x + (r.x + r.w / 2) * c.width / 1280, y: c.y + (r.y + r.h / 2) * c.height / 800 };
  });
  const downloadPromise = page.waitForEvent('download');
  await page.mouse.click(exportRect.x, exportRect.y); await tick(1);
  const download = await downloadPromise; await download.saveAs(path.join(out, 'postcard.png'));
  assert.deepEqual(await fs.readFile(path.join(out,'controller-postcard.png')), await fs.readFile(path.join(out,'postcard.png')), 'mouse and controller export identical PNG bytes');
  assert((await fs.stat(path.join(out, 'postcard.png'))).size > 15000);
  const exportPixels = await page.evaluate(async data => {
    const { drawPostcard } = await import('./src/studio.js'), { studyRewardEarned } = await import('./src/logic.js');
    const g = window.__game, p = g.save.sketchbook[g._bookIndex];
    const image = new Image(); image.src = data; await image.decode();
    const cv = document.createElement('canvas'); cv.width=1600; cv.height=960; const c=cv.getContext('2d');
    c.drawImage(image,0,0); const actual=c.getImageData(0,0,1600,960).data;
    drawPostcard(c,p,0,0,1600,960,studyRewardEarned(g.save.studio.completed,'swamp'),studyRewardEarned(g.save.studio.completed,'reeds'),!!g.save.flags.crossingPainted);
    const expected=c.getImageData(0,0,1600,960).data;
    let diff=0; for(let i=0;i<actual.length;i++) if(actual[i]!==expected[i]) diff++;
    const caption=c.getImageData(0,820,1600,80).data.slice();
    drawPostcard(c,{...p,title:'A different caption'},0,0,1600,960,studyRewardEarned(g.save.studio.completed,'swamp'),studyRewardEarned(g.save.studio.completed,'reeds'),!!g.save.flags.crossingPainted);
    const changed=c.getImageData(0,820,1600,80).data;
    let captionDiff=0; for(let i=0;i<caption.length;i++) if(caption[i]!==changed[i]) captionDiff++;
    return {diff,captionDiff,width:image.width,height:image.height};
  }, 'data:image/png;base64,' + (await fs.readFile(path.join(out,'postcard.png'))).toString('base64'));
  assert.equal(exportPixels.diff,0); assert.equal(exportPixels.width,1600); assert.equal(exportPixels.height,960); assert(exportPixels.captionDiff>100);
  report.push({exhibitionExportPixels:exportPixels});
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

  // The first guardian now opens a rest, even at low world restoration.
  await page.evaluate(() => { const g = window.__game; g._endRun('victory'); g.world.worldColorSat = () => 0.25; g._drawAll(); });
  assert.equal(await page.evaluate(() => window.__game.state), 'camp');
  assert.equal(await page.evaluate(() => window.__game.campaign.pendingReward), true);
  assert.equal(await page.evaluate(() => window.__game.save.stats.victories), 0, 'one guardian is not a dungeon victory');
  await page.screenshot({ path: path.join(out, '05-first-guardian-rest.png') });
  await page.reload(); await page.waitForFunction(() => window.__game, null, { polling: 50 }); await tick(100);
  assert.equal(await page.evaluate(() => window.__game.save.studio.completed.length), 3);
  assert.equal(await page.evaluate(() => window.__game.save.sketchbook.length), 1);
  assert.equal(await page.evaluate(() => window.__game.save.sketchbook[0].title), 'My little swamp 🌿');
  assert.equal(await page.evaluate(() => window.__game.save.sketchPins.includes(window.__game.save.sketchExhibit)), true);
  const titlePixels = await page.evaluate(async () => {
    const {drawPostcard}=await import('./src/studio.js'),{studyRewardEarned}=await import('./src/logic.js');
    const g=window.__game; g.options.vignette=false; g.banners=[]; g._drawAll();
    const c=g.canvas.getContext('2d'), before=c.getImageData(26,274,312,187).data.slice(), id=g.save.sketchExhibit;
    const expected=document.createElement('canvas'); expected.width=g.cw; expected.height=g.ch;
    drawPostcard(expected.getContext('2d'),g.save.sketchbook.find(p=>p.id===id),26,274,312,187.2,studyRewardEarned(g.save.studio.completed,'swamp'),studyRewardEarned(g.save.studio.completed,'reeds'),!!g.save.flags.crossingPainted);
    const expectedPx=expected.getContext('2d').getImageData(26,274,312,187).data;
    const mismatches=[]; let maxDelta=0, totalDiff=0;
    for(let i=0;i<before.length;i++) if(before[i]!==expectedPx[i]) { totalDiff++; maxDelta=Math.max(maxDelta,Math.abs(before[i]-expectedPx[i])); if(mismatches.length<12) mismatches.push({x:Math.floor(i/4)%312,y:Math.floor(i/(312*4)),actual:before[i],expected:expectedPx[i]}); }
    if(totalDiff) throw new Error('Title keepsake render mismatch '+JSON.stringify({totalDiff,maxDelta,mismatches,lineCap:c.lineCap,lineJoin:c.lineJoin,lineDash:c.getLineDash(),alpha:c.globalAlpha,composite:c.globalCompositeOperation}));
    g.save.sketchExhibit=null; g._drawAll(); const after=c.getImageData(26,274,312,187).data;
    let diff=0; for(let i=0;i<before.length;i++) if(before[i]!==after[i]) diff++;
    g.save.sketchExhibit=id; g._drawAll(); return diff;
  });
  assert(titlePixels>1000,'explicit pinned keepsake actually renders on the title canvas');
  await page.setViewportSize({width:640,height:480}); await tick(1);
  await page.screenshot({path:path.join(out,'15-exhibition-title-640.png')});
  report.push({titleKeepsakePixelDifference:titlePixels,controller:'D-pad to rename/exhibit, A open/save/toggle, B cancel, native input within 640x480'});
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
    g._beginExpedition(false, { campaignFloor: 1 });
    const reedsStudies = g.studio.studies.filter(st => st.biome === 'reeds');
    if (reedsStudies.length !== 2) throw new Error('both reeds studies must exist in a normal Reeds expedition: ' + reedsStudies.map(s => s.id).join(','));
    for (const s of reedsStudies) {
      for (let k = 0; k < 3; k++) {
        const n = studyNode(s);
        g.player.x = n.x - 40; g.player.y = n.y; g.player.pigment = n.pigment; g.player.aimA = 0;
        for (let j = 0; j < 3; j++) { g.paint.swipeCd = 0; g.player.swipeT = 0; g.paint.trySwipe([]); }
      }
    }
    const p = g.save.sketchbook[g.save.sketchbook.length - 1];
    return { steps: reedsStudies.map(s => s.step), x: reedsStudies[0].x, y: reedsStudies[0].y,
      poolX: reedsStudies[1].x, poolY: reedsStudies[1].y,
      borderBanner: g.banners.some(b => b.text.includes('border')),
      completed: g.save.studio.completed,
      page: p ? { biome: p.biome, studies: p.studies } : null };
  });
  assert.deepEqual(garden.steps, [3, 3]);
  assert.equal(garden.x, 3300); assert.equal(garden.y, 780);
  assert.equal(garden.poolX, 1150); assert.equal(garden.poolY, 720);
  assert(garden.borderBanner, 'the reeds border is announced once both reeds studies are complete');
  assert(garden.completed.includes('lantern-garden') && garden.completed.includes('echo-pool') && garden.completed.includes('first-light'));
  assert(garden.page && garden.page.biome === 'reeds' && garden.page.studies.includes('lantern-garden') && garden.page.studies.includes('echo-pool'));
  // The reeds border must be visible: the bordered postcard frame differs in
  // real pixels from the same page without the border.
  const borderPx = await page.evaluate(async () => {
    const g = window.__game, { drawPostcard } = await import('./src/studio.js');
    const c = document.createElement('canvas'); c.width = 1000; c.height = 600;
    const ctx = c.getContext('2d');
    const page = g.save.sketchbook[g.save.sketchbook.length - 1];
    ctx.clearRect(0, 0, 1000, 600);
    drawPostcard(ctx, page, 0, 0, 1000, 600, false, false);
    const flat = Array.from(ctx.getImageData(500, 13, 4, 1).data);
    ctx.clearRect(0, 0, 1000, 600);
    drawPostcard(ctx, page, 0, 0, 1000, 600, false, true);
    const bord = Array.from(ctx.getImageData(500, 13, 4, 1).data);
    return { differs: flat.some((v, i) => v !== bord[i]) };
  });
  assert(borderPx.differs, 'the reeds border changes the postcard frame pixels');
  report.push({ lanternGarden: garden });
  await page.keyboard.press('j'); await tick(1);
  await page.evaluate(() => { const g = window.__game; g._bookIndex = g.save.sketchbook.length - 1; g._drawAll(); });
  await page.screenshot({ path: path.join(out, '10-lantern-garden.png') });
  await page.evaluate(() => window.__game._closeSketchbook());

  // Q5: THE PAINTED CROSSING — all three real paint actions (green/blue/red),
  // the effect zone, the corner push-out, the return route and the one-time
  // postcard stamp, in a fresh normal swamp expedition. Paint actions run
  // through the real swipe path; spawn staging keeps the effect measurements
  // exact (no invulnerability is used for the actions themselves).
  const crossing = await page.evaluate(async () => {
    const g = window.__game, { CROSSING, crossingSpeedFactor, freshSave } = await import('./src/logic.js');
    const keptPage = g.save.sketchbook[g.save.sketchbook.length - 1]; // Q2's real reeds page (stamp render check)
    g._closeSketchbook(); g.save = freshSave(); g._beginExpedition(false);
    const step = () => g._frame(g.last + 1000 / 60);
    const w = g.world, p = g.player;
    if (w.crossingState !== 'unpainted' || w.crossingSolids.length !== 4) throw new Error('fresh run must start with the 4-blob bramble wall unpainted: ' + w.crossingState);
    if (p.hp !== p.maxHp) throw new Error('a fresh expedition starts at full HP');
    // corner check: a frog that HOPS INTO the wall's corner (a real landing
    // is always off-center — the push-out keeps the frog >= r+46 from any
    // blob center) is pushed clear of the wall every frame, not trapped.
    p.x = CROSSING.x + CROSSING.blobOffsets[0] + 18; p.y = CROSSING.y + 34; p.vx = 0; p.vy = 0;
    for (let i = 0; i < 30; i++) step();
    const cornerFree = w.crossingSolids.every(c => Math.hypot(p.x - c.x, p.y - c.y) > c.r);
    // the main corridor is open in every state: the corridor anchor is never pushed
    p.x = CROSSING.x; p.y = CROSSING.corridorY; p.vx = 0; p.vy = 0; step();
    const corridorOpen = Math.hypot(p.x - CROSSING.x, p.y - CROSSING.corridorY) < 8;
    // staging for exact effect measurements (not the paint actions): no waves
    // spawn while we measure.
    g.spawnT = 1e6; g.enemies.length = 0;
    // ACTION 1 — green parts the bramble (the real swipe path from the south bank)
    p.x = CROSSING.x; p.y = 560; p.pigment = 'green'; p.aimA = -Math.PI / 2;
    g.paint.swipeCd = 0; p.swipeT = 0; g.paint.trySwipe([]); step();
    const green = { state: w.crossingState, solids: w.crossingSolids.length, stamped: g.save.flags.crossingPainted,
      banner: g.banners.some(b => b.text.includes('crossing')) };
    // enter the detour north of the mouth, then back down the corridor
    p.x = CROSSING.x; p.y = CROSSING.pocketY; p.vx = 0; p.vy = 0; step();
    const entered = Math.hypot(p.x - CROSSING.x, p.y - CROSSING.pocketY) < 8;
    p.x = CROSSING.x; p.y = CROSSING.corridorY; p.vx = 0; p.vy = 0; step();
    const returned = Math.hypot(p.x - CROSSING.x, p.y - CROSSING.corridorY) < 8;
    // ACTION 2 — blue fills the gap; the current slows the frog in the zone
    p.x = CROSSING.x; p.y = 560; p.pigment = 'blue'; p.aimA = -Math.PI / 2;
    g.paint.swipeCd = 0; p.swipeT = 0; g.paint.trySwipe([]); step();
    if (w.crossingState !== 'current') throw new Error('blue paint must fill the gap: ' + w.crossingState);
    p.x = CROSSING.x; p.y = CROSSING.y; p.vx = 0; p.vy = 0; g.input.keys.add('d');
    for (let i = 0; i < 20; i++) step();
    const inDx = p.x - CROSSING.x;
    p.x = CROSSING.x + 600; p.y = CROSSING.y; p.vx = 0; p.vy = 0;
    for (let i = 0; i < 20; i++) step();
    g.input.keys.clear();
    const outDx = p.x - (CROSSING.x + 600);
    const current = { slow: crossingSpeedFactor('current'), inDx: Math.round(inDx * 10) / 10, outDx: Math.round(outDx * 10) / 10,
      slowed: inDx > 4 && outDx > inDx && inDx < outDx * 0.85 };
    // ACTION 3 — red wakes the thorns; the bramble stings ONCE per entry
    p.x = CROSSING.x; p.y = 560; p.pigment = 'red'; p.aimA = -Math.PI / 2;
    g.paint.swipeCd = 0; p.swipeT = 0; g.paint.trySwipe([]); step();
    if (w.crossingState !== 'bramble') throw new Error('red paint must wake the thorns: ' + w.crossingState);
    p.x = CROSSING.x; p.y = CROSSING.y; p.iframes = 0; p._crossingSting = false;
    const hp0 = p.hp; step(); step();
    const stingFirst = hp0 - p.hp;
    for (let i = 0; i < 60; i++) step();
    const stingNoBleed = hp0 - p.hp === stingFirst;
    // leave the zone, then re-enter: the sting fires again (once per entry)
    p.x = CROSSING.x; p.y = CROSSING.corridorY; p.vx = 0; p.vy = 0; step();
    const leftZone = p._crossingSting === false;
    p.x = CROSSING.x; p.y = CROSSING.y; p.iframes = 0; p._crossingSting = false;
    step(); step();
    const stingSecond = hp0 - p.hp === 2 * stingFirst;
    // revisit: repaint green and the crossing is safe again (no damage in zone)
    p.x = CROSSING.x; p.y = 560; p.pigment = 'green'; p.aimA = -Math.PI / 2;
    g.paint.swipeCd = 0; p.swipeT = 0; g.paint.trySwipe([]); step();
    const revisit = w.crossingState === 'crossing';
    p.x = CROSSING.x; p.y = CROSSING.y; p.iframes = 0; p._crossingSting = false;
    for (let i = 0; i < 30; i++) step();
    const revisitSafe = hp0 - p.hp === 2 * stingFirst && p.alive;
    // effects stay capped after all the crossing beats
    const effectsCapped = g.particles.count <= 240 && g.studio.wakes.length <= 24;
    return { keptPage, cornerFree, corridorOpen, green, entered, returned, current,
      sting: { first: stingFirst, noBleed: stingNoBleed, leftZone, second: stingSecond },
      revisit, revisitSafe, effectsCapped };
  });
  assert(crossing.cornerFree, 'hopping at the wall corner cannot trap the frog (pushed out every frame)');
  assert(crossing.corridorOpen, 'the main corridor is open in every crossing state');
  assert.deepEqual(crossing.green, { state: 'crossing', solids: 0, stamped: true, banner: true });
  assert(crossing.entered && crossing.returned, 'the detour can be entered and the return route stays open');
  assert(crossing.current.slowed, `the blue current slows the frog in the zone (in ${crossing.current.inDx}px vs out ${crossing.current.outDx}px over 20 frames)`);
  assert(crossing.sting.first >= 3, 'the bramble stings on entry (a small hit)');
  assert(crossing.sting.noBleed, 'the sting is latched per entry — a standing frog is not bled');
  assert(crossing.sting.leftZone && crossing.sting.second, 're-entering the bramble stings again (once per entry)');
  assert(crossing.revisit && crossing.revisitSafe, 'repainting green restores the safe crossing (revisited with normal input)');
  assert(crossing.effectsCapped, 'effects stay capped after the crossing beats');
  report.push({ paintedCrossing: crossing });
  // frame evidence: every state renders (real pixels in real Chromium)
  for (const st of ['unpainted', 'crossing', 'current', 'bramble']) {
    await page.evaluate(st => import('./src/logic.js').then(m => {
      const g = window.__game;
      g.world.crossingState = st; g.world.crossingSolids = m.crossingSolids(st);
      g.cam.x = m.CROSSING.x; g.cam.y = m.CROSSING.y; g._drawAll();
    }), st);
    await page.screenshot({ path: path.join(out, `11-crossing-${st}.png`) });
  }
  // all four states must be pairwise pixel-distinct (the detour's silhouettes)
  const crossingPx = await page.evaluate(async () => {
    const g = window.__game, { CROSSING, crossingSolids } = await import('./src/logic.js');
    const c = document.createElement('canvas'); c.width = 440; c.height = 300;
    const ctx = c.getContext('2d');
    const sig = st => {
      g.world.crossingState = st; g.world.crossingSolids = crossingSolids(st);
      ctx.clearRect(0, 0, 440, 300);
      ctx.save(); ctx.translate(220 - CROSSING.x, 150 - CROSSING.y);
      g.world.drawCrossing(ctx, 1.7, 0.5);
      ctx.restore();
      return Array.from(ctx.getImageData(0, 0, 440, 300).data.filter((_, i) => i % 16 === 0));
    };
    const states = ['unpainted', 'crossing', 'current', 'bramble'];
    const sigs = states.map(sig);
    const diffs = [];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) diffs.push(sigs[i].filter((v, k) => v !== sigs[j][k]).length);
    g.world.crossingState = 'crossing'; g.world.crossingSolids = crossingSolids('crossing');
    return diffs;
  });
  assert(crossingPx.every(n => n > 400), 'all four crossing states render distinct pixels (6 pairwise diffs: ' + crossingPx.join('/') + ')');
  // the postcard stamp: a real Q2 page with the latch renders differently from
  // the same page without it (the stamp sits top-right, on the card).
  const stampPx = await page.evaluate(async (keptPage) => {
    const { drawPostcard } = await import('./src/studio.js');
    const c = document.createElement('canvas'); c.width = 1000; c.height = 600;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 1000, 600);
    drawPostcard(ctx, keptPage, 0, 0, 1000, 600, false, false, false);
    const a = ctx.getImageData(880, 90, 40, 1).data;
    ctx.clearRect(0, 0, 1000, 600);
    drawPostcard(ctx, keptPage, 0, 0, 1000, 600, false, false, true);
    const b = ctx.getImageData(880, 90, 40, 1).data;
    return { differs: Array.from(a).some((v, i) => v !== b[i]) };
  }, crossing.keptPage);
  assert(stampPx.differs, 'the crossing stamp changes the postcard pixels (real Q2 page, latch on vs off)');

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

  // Full-health real first-guardian fight and camp transition. Arena placement and god
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
  assert.equal(await page.evaluate(() => window.__game.state), 'camp');
  assert.equal(await page.evaluate(() => window.__game.campaign.pendingReward), true);
  assert.deepEqual(await page.evaluate(() => window.__game.campaign.cleared), ['gray']);
  report.push({ realFirstGuardianVictoryWithGodMode: boss });
  await page.screenshot({ path: path.join(out, '08-earned-rest.png') });
  await page.evaluate(() => { const g = window.__game; g._beginExpedition(); g.player.iframes = 0; g.player.hurt(99999, g.tuning); }); await tick(180);
  assert.equal(await page.evaluate(() => window.__game.endKind), 'defeat');
  await page.screenshot({ path: path.join(out, '09-defeat.png') });
  await page.keyboard.press('Escape'); await tick(1); await page.keyboard.press('Enter'); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.state), 'expedition');
  assert.equal(await page.evaluate(() => window.__game.player.alive && !window.__game.dying), true);
  report.push('Defeat, title return and fresh expedition restart verified');
  const {mothBrowser}=await import('./moth-browser.mjs');
  await mothBrowser({page,tick,out,report});
  const { livingSketchbookBrowser } = await import('./living-sketchbook-browser.mjs');
  await livingSketchbookBrowser({page,tick,out,report});
  const { controlFeelBrowser } = await import('./control-feel-browser.mjs');
  await controlFeelBrowser({page,tick,out,report});
  const {clearingBrowser} = await import('./clearing-browser.mjs');
  await clearingBrowser({page,tick,out,report});
  const { campaignBrowser } = await import('./campaign-browser.mjs');
  await campaignBrowser({page,tick,out,report});
  const { paintDelightsBrowser } = await import('./paint-delights-browser.mjs');
  await paintDelightsBrowser({page,tick,out,report});
  const { combatDelightsBrowser } = await import('./combat-delights-browser.mjs');
  await combatDelightsBrowser({page,tick,out,report});
  const { brushJourneyBrowser } = await import('./brush-journey-browser.mjs');
  await brushJourneyBrowser({page,tick,out,report});
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ report, errors }, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log('VERTICAL SLICE BROWSER CHECKS PASSED');
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
