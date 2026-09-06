// tests/headless.mjs — headless Chrome driver for the playtest pass.
// Usage: node tests/headless.mjs <scenario> [outDir]
//   explore  — fresh save, start expedition, screenshot the start area (grey box hunt)
//   paint    — paint enemies, verify damage + trail rendering
//   spawn    — sample spawn distances to the player over a timed run
//   death    — start run, collect orbs, force death, verify bank gain (economy)
//   onb      — capture title + first-run expedition banners (onboarding audit)
// Requires: playwright-core + local Chrome. HTTP server on 127.0.0.1:8901.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const CHROME = path.join(homedir(), '.agent-browser', 'browsers', 'chrome-152.0.7977.82', 'chrome.exe');
const URL = 'http://127.0.0.1:8901/index.html';
const scenario = process.argv[2] || 'explore';
const outDir = process.argv[3] || 'tests/.out';

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,800', '--use-gl=swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
// Patch the (cached) module graph BEFORE the page's boot script runs, so
// window.__g captures the live Game instance.
await page.addInitScript(async () => {
  try {
    const m = await import('/src/game.js');
    const orig = m.Game.prototype.start;
    m.Game.prototype.start = function () { window.__g = this; return orig.apply(this, arguments); };
  } catch (e) { window.__hookErr = String(e); }
});
page.on('console', m => { if (m.type() === 'error') console.log('[page-err]', m.text()); });
page.on('pageerror', e => console.log('[page-fatal]', String(e)));

await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => { localStorage.clear(); });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);

const g = () => page.evaluate(`window.__g`);

async function shot(name) {
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`[shot] ${name}.png`);
}

// helper: wait for game to finish a number of rAF frames
async function frames(n, ms = 16.7) {
  for (let i = 0; i < n; i++) await page.waitForTimeout(ms);
}

switch (scenario) {
  case 'explore': {
    // title screen shot (onboarding audit part 1)
    await frames(10);
    await shot('01-title');
    const title = await g();
    console.log('[state]', title.state, 'titleT', title.titleT?.toFixed(1));
    // start expedition
    await page.keyboard.press('Enter');
    await frames(30);
    const s1 = await g();
    console.log('[state]', s1.state, 'player?', !!s1.player, 'enemies', s1.enemies?.length);
    await shot('02-expedition-start');
    // sample grey-ish pixels across the visible world (exclude HUD corners)
    const scan = await page.evaluate(() => {
      const c = document.getElementById('game'), x = c.getContext('2d');
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const gray = [], samples = 64 * 48; let n = 0;
      for (let i = 0; i < samples; i++) {
        const px = (Math.random() * c.width) | 0, py = (Math.random() * c.height) | 0;
        if (py < 120 || py > c.height - 90 || px < 100 || px > c.width - 100) continue;
        const o = (py * c.width + px) * 4;
        const r = d[o], gg = d[o + 1], b = d[o + 2];
        n++;
        const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        // desaturated but not too dark/bright: the swamp floor at sat 0.25 is
        // rgb(114,127,121)-ish; a pure grey box would be near r==g==b
        if (mx - mn < 12 && r > 90 && r < 175) gray.push([px, py, r, gg, b]);
      }
      // cluster: find the largest local concentration (grid 80px)
      const grid = new Map();
      for (const [px, py] of gray) {
        const k = `${(px / 80) | 0},${(py / 80) | 0}`;
        grid.set(k, (grid.get(k) || 0) + 1);
      }
      let best = null, bestN = 0;
      for (const [k, cnt] of grid) if (cnt > bestN) { bestN = cnt; best = k; }
      return { n, grayCount: gray.length, bestCell: best, bestN, sample: gray.slice(0, 6) };
    });
    console.log('[gray-scan]', JSON.stringify(scan));
    break;
  }

  case 'paint': {
    await page.keyboard.press('Enter');
    await frames(20);
    // place an enemy in front of the player and paint it
    const res = await page.evaluate(() => {
      const G = window.__g;
      const p = G.player;
      const { spawnEnemy } = window.__mod ? window.__mod : {};
      // no module handle in browser; fabricate via the game's own spawn path instead:
      // push a synthetic enemy matching the Enemy shape (game only calls .update/.draw/hurt via update loop)
      const e = {
        kind: 'mosquito', name: 'Mosquito', x: p.x + 90, y: p.y, vx: 0, vy: 0,
        hp: 10, maxHp: 10, speed: 150, dmg: 5, r: 10, armor: 0, fly: true,
        score: 10, status: null, burnAccum: 0, tint: null, tintT: 0, attackCd: 0,
        hitFlash: 0, dead: false, _seed: 0, _wanderA: 0, _wanderT: 1, _bob: 0,
        dizzyPaintChance: 0, dizzyDuration: 0, paintTintDecay: 0.25,
        _tele: { t: 0 },
      };
      G.enemies.push(e);
      G.player.pigment = 'red';
      G.player.aimA = 0; // face +x, toward the enemy
      return { ex: e.x, ey: e.y, px: p.x, py: p.y };
    });
    console.log('[setup]', JSON.stringify(res));
    // mouse down near the enemy, in world space -> screen space
    const scr = await page.evaluate(() => {
      const G = window.__g; const v = G._view();
      const p = G.player, e = G.enemies[G.enemies.length - 1];
      return { sx: (e.x - v.x) * v.scale, sy: (e.y - v.y) * v.scale };
    });
    await page.mouse.move(scr.sx, scr.sy);
    await page.mouse.down();
    // hold-paint ~1.5s = several swipes
    await frames(90);
    await page.mouse.up();
    const after = await page.evaluate(() => {
      const G = window.__g;
      const e = G.enemies[G.enemies.length - 1];
      return {
        hp: e.hp, dead: e.dead,
        pigment: G.player.pigment,
        collected: G.collected, stock: G.stock,
        orbs: G.orbs.length,
        trails: G.paint.trails.length,
      };
    });
    console.log('[after-paint]', JSON.stringify(after));
    await shot('03-after-paint');
    break;
  }

  case 'spawn': {
    await page.keyboard.press('Enter');
    // sample every new enemy's distance to player for ~20s
    const samples = await page.evaluate(async () => {
      const G = window.__g;
      const out = [];
      let prev = G.enemies.length;
      const t0 = performance.now();
      while (performance.now() - t0 < 20000 && G.player && G.player.alive) {
        await new Promise(r => setTimeout(r, 40));
        for (let i = prev; i < G.enemies.length; i++) {
          const e = G.enemies[i];
          const d = Math.hypot(e.x - G.player.x, e.y - G.player.y);
          out.push({ kind: e.kind, d: Math.round(d), px: Math.round(G.player.x) });
        }
        prev = G.enemies.length;
      }
      return out;
    });
    console.log('[spawns]', JSON.stringify(samples));
    const min = samples.length ? Math.min(...samples.map(s => s.d)) : null;
    console.log('[min-dist]', min, 'of', samples.length, 'samples');
    break;
  }

  case 'death': {
    await page.keyboard.press('Enter');
    await frames(15);
    // grant orbs, collect them, then force death and read the bank delta
    const r = await page.evaluate(async () => {
      const G = window.__g;
      const before = { ...G.save.bank };
      // spawn 10 orbs right on the player
      for (let i = 0; i < 10; i++) {
        G.orbs.push({ x: G.player.x + (Math.random() - 0.5) * 20, y: G.player.y + (Math.random() - 0.5) * 20, color: 'red', t: 0 });
      }
      await new Promise(r2 => setTimeout(r2, 500));
      const collected = { ...G.collected };
      const stock = { ...G.stock };
      // force death
      G.player.hp = 1; G.player.iframes = 0;
      G._onPlayerDead();
      // fast-forward the death cinematic
      G.dieT = 5; G.dying = true;
      await new Promise(r3 => setTimeout(r3, 100));
      G._endRun('death');
      const after = { ...G.save.bank };
      const gains = {};
      for (const k of ['red', 'blue', 'green']) gains[k] = after[k] - before[k];
      return { before, after, gains, collected, stock, endKind: G.endKind };
    });
    console.log('[death-econ]', JSON.stringify(r));
    break;
  }

  case 'artifact': {
    // Hunt for a box-like grey artifact: large uniform desaturated regions with
    // straight edges. Scan the whole world by teleporting the player.
    await page.keyboard.press('Enter');
    await frames(30);
    const scanAt = (wx) => page.evaluate((x) => {
      const G = window.__g;
      G.player.x = x; G.player.y = 750; G.cam.x = x; G.cam.y = 750;
      G._drawAll();
      const c = document.getElementById('game'), ctx2 = c.getContext('2d');
      const d = ctx2.getImageData(0, 0, c.width, c.height).data;
      // classify pixels as "gray-boxy": low chroma, mid brightness
      const isGray = (o) => {
        const r = d[o], g2 = d[o + 1], b = d[o + 2];
        return Math.max(r, g2, b) - Math.min(r, g2, b) < 14 && r > 85 && r < 190;
      };
      // connected components (flood fill on a grid, step 2px for speed)
      const w = c.width, h = c.height, step = 2;
      const seen = new Uint8Array(w * h);
      const comps = [];
      for (let y = 100; y < h - 90; y += step) {
        for (let x = 60; x < w - 60; x += step) {
          const o = (y * w + x) * 4;
          if (seen[y * w + x] || !isGray(o)) continue;
          // flood fill (BFS, bounded)
          const stack = [[x, y]]; seen[y * w + x] = 1;
          let minX = x, maxX = x, minY = y, maxY = y, n = 0;
          const r0 = d[o], g0 = d[o + 1], b0 = d[o + 2];
          while (stack.length && n < 20000) {
            const [cx, cy] = stack.pop(); n++;
            if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
            for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
              const nx = cx + dx, ny = cy + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              if (seen[ny * w + nx]) continue;
              const o2 = (ny * w + nx) * 4;
              if (!isGray(o2)) continue;
              // color continuity (allow small variance, exclude the swamp floor)
              const dr = Math.abs(d[o2] - r0), dg = Math.abs(d[o2 + 1] - g0), db = Math.abs(d[o2 + 2] - b0);
              if (dr + dg + db > 30) continue;
              seen[ny * w + nx] = 1; stack.push([nx, ny]);
            }
          }
          const bw = maxX - minX, bh = maxY - minY;
          if (n > 300 && bw > 40 && bh > 30) {
            // fill ratio: how boxy (a rect ~1.0, a blob ~0.78 for a circle)
            const fill = n / ((bw / step + 1) * (bh / step + 1));
            // edge straightness: fraction of bbox perimeter cells that are gray
            comps.push({ x: minX, y: minY, w: bw, h: bh, n, fill: +fill.toFixed(2), color: [r0, g0, b0] });
          }
        }
      }
      return comps.sort((a, b) => b.n - a.n).slice(0, 6);
    }, wx);

    const results = [];
    for (const wx of [500, 1500, 2500, 3500, 4500, 5200]) {
      const comps = await scanAt(wx);
      results.push({ wx, comps });
      if (comps.length) console.log(`[artifact @x=${wx}]`, JSON.stringify(comps));
    }
    if (!results.some(r => r.comps.length)) console.log('[artifact] no box-like grey regions found anywhere');
    await shot('13-artifact-scan');
    break;
  }

  case 'floor': {
    // #5 grey-box hunt v2: find TRANSPARENT canvas regions (page background
    // showing through = an empty rectangular area inside the swamp view).
    await page.keyboard.press('Enter');
    await frames(40);
    const report = (label) => page.evaluate((lab) => {
      const G = window.__g;
      const c = document.getElementById('game'), ctx = c.getContext('2d');
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const w = c.width, h = c.height;
      let transparent = 0, minX = w, maxX = -1, minY = h, maxY = -1;
      const seen = {};
      for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) {
        const o = (y * w + x) * 4;
        if (d[o + 3] < 250) {
          transparent++;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          const cell = Math.floor(y / 100) + ',' + Math.floor(x / 100);
          seen[cell] = (seen[cell] || 0) + 1;
        }
      }
      // summarize the transparent region shape
      const rows = {};
      for (const k in seen) { const [ry, rx] = k.split(','); rows[ry] = rows[ry] || []; rows[ry].push(rx); }
      const shape = Object.keys(rows).sort().map(ry => `y${ry * 100}:x[${rows[ry].map(r => r * 100).join(',')}]`)
        .filter((s, i, a) => i === 0 || i === a.length - 1 || (i & 1));
      const v = G._view();
      return { transparent, bbox: [minX, minY, maxX, maxY], view: [v.x | 0, v.y | 0, v.scale], shape: shape.slice(0, 8) };
    }, label);
    for (const [lab, fn] of [['start', () => null]]) { /* noop */ }
    console.log('[floor start]', JSON.stringify(await report('start')));
    // move right + down to a mid-swamp spot
    await page.evaluate(() => { const G = window.__g; G.player.x = 2600; G.player.y = 750; G.cam.x = 2600; G.cam.y = 750; });
    await frames(10);
    console.log('[floor mid]', JSON.stringify(await report('mid')));
    // title screen check
    await page.evaluate(() => { window.__g.state = 'title'; window.__g._zoneI = 0; });
    await frames(10);
    console.log('[floor title]', JSON.stringify(await report('title')));
    await shot('14-floor-check');
    break;
  }

  case 'doublex': {
    // #5 v3: is world terrain double-transformed? Compare a rock's actual
    // on-screen pixels vs (a) single-transform position and (b) double-transform.
    await page.keyboard.press('Enter');
    await frames(40);
    const res = await page.evaluate(() => {
      const G = window.__g;
      const rocks = G.world.obstacles.filter(o => o.kind === 0).slice(0, 60);
      const o = rocks.find(r => r.x > 1500 && r.x < 4200 && r.y > 400 && r.y < 1100) || rocks[0];
      // camera such that d = o - v = 200: single-transform pos = 200, double = 400 (both on-screen, apart)
      G.player.x = o.x; G.player.y = o.y;
      G.cam.x = o.x + 440; G.cam.y = o.y + 440;
      const v = G._view();
      const s = v.scale;
      const sxSingle = (o.x - v.x) * s, sySingle = (o.y - v.y) * s;
      const sxDouble = (s * s) * o.x - s * v.x * (s + 1), syDouble = (s * s) * o.y - s * v.y * (s + 1);
      G._drawAll();
      const c = document.getElementById('game'), ctx = c.getContext('2d');
      const probe = (sx, sy) => {
        let gray = 0, alpha = 0;
        for (let dx = -10; dx <= 10; dx += 5) for (let dy = -10; dy <= 10; dy += 5) {
          const d2 = ctx.getImageData((sx + dx) | 0, (sy + dy) | 0, 1, 1).data;
          if (d2[3] > 250) alpha++;
          if (Math.max(d2[0], d2[1], d2[2]) - Math.min(d2[0], d2[1], d2[2]) < 18 && d2[0] > 105 && d2[0] < 170 && d2[3] > 250) gray++;
        }
        return { alpha, gray };
      };
      return { rock: [o.x | 0, o.y | 0, o.r], view: [v.x | 0, v.y | 0, s], single: [sxSingle | 0, sySingle | 0], double: [sxDouble | 0, syDouble | 0], probeSingle: probe(sxSingle, sySingle), probeDouble: probe(sxDouble, syDouble) };
    });
    console.log(JSON.stringify(res, null, 1));
    await shot('15-doublex-check');
    break;
  }

  case 'xform3': {
    // Capture the EXACT input CTM each world draw method receives (right
    // before its inner save/translate), plus the CTM the floor fill sees.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const R = await page.evaluate(async () => {
      const G = window.__g;
      const w = G.world, out = {};
      const tfm = (ctx) => { const m = ctx.getTransform ? ctx.getTransform() : ctx.transform; return [m.a, m.b, m.c, m.d, m.e, m.f].map(n => +n.toFixed(2)); };
      const ob = w.drawObstacles.bind(w);
      w.drawObstacles = (ctx, v, s) => { out.obstaclesIn = tfm(ctx); out.obstaclesV = [v.x|0, v.y|0, +v.scale.toFixed(3)]; return ob(ctx, v, s); };
      const db = w.drawBackground.bind(w);
      const ctx = G.ctx; const origFR = ctx.fillRect.bind(ctx);
      let floorSeen = null;
      ctx.fillRect = function (x, y, ww, hh) { if (ww > 200 && hh > 200 && !floorSeen) floorSeen = tfm(ctx); return origFR(x, y, ww, hh); };
      w.drawBackground = (c, v, s) => { out.backgroundIn = tfm(c); out.backgroundV = [v.x|0, v.y|0, +v.scale.toFixed(3)]; return db(c, v, s); };
      await new Promise(r => setTimeout(r, 250));
      ctx.fillRect = origFR;
      out.floorTfm = floorSeen;
      const v = G._view();
      return { view: [v.x|0, v.y|0, +v.scale.toFixed(3)], out };
    });
    console.log('XFORM3', JSON.stringify(R));
    break;
  }
  case 'xform2': {
    // Runtime ground truth: log the actual canvas transform at the moment the
    // big floor fillRect is drawn, plus canvas sizing facts.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    const R = await page.evaluate(async () => {
      const cv = document.getElementById('game');
      const g = cv.getContext('2d');
      const calls = [];
      const orig = g.fillRect.bind(g);
      g.fillRect = function (x, y, w, h) {
        if (w > 200 && h > 200) {
          const m = g.getTransform ? g.getTransform() : g.transform;
          calls.push({ x: x | 0, y: y | 0, w: w | 0, h: h | 0, m: [m.a, m.b, m.c, m.d, m.e, m.f].map(n => +n.toFixed(2)) });
        }
        return orig(x, y, w, h);
      };
      await new Promise(r => setTimeout(r, 300));
      g.fillRect = orig;
      const G = window.__g;
      const v = G._view();
      return { cw: G.cw, ch: G.ch, dpr: window.devicePixelRatio, cvW: cv.width, cvH: cv.height,
        cssW: cv.clientWidth, cssH: cv.clientHeight, zoom: +G.zoom.toFixed(3),
        view: [v.x | 0, v.y | 0, +v.scale.toFixed(3)], bigFills: calls.slice(0, 4) };
    });
    console.log('XFORM2', JSON.stringify(R));
    break;
  }
  case 'xform6': {
    // ABSOLUTE DEFINITIVE: place the frog and a rock at the SAME world
    // point, same camera. Compare pixels: if terrain is double-transformed,
    // the rock renders far away from the frog.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    const R = await page.evaluate(() => {
      const G = window.__g;
      const rk = G.world.obstacles[0];
      const WX = 3000, WY = 700;
      G.player.x = WX; G.player.y = WY;
      rk.x = WX + 60; rk.y = WY;   // rock 60px right of frog (world)
      G.cam.x = WX; G.cam.y = WY;
      if (G._updateCamera) G._updateCamera(1);
      const v = G._view(), s = v.scale;
      const c = document.getElementById('game'), g = c.getContext('2d');
      // hook: log CTM at moment the rock blob is filled (traceBlob is global)
      let rockCTM = null, rockBlob = null;
      const origTrace = globalThis.__traceHook; // noop
      // wrap the canvas fill for large blobs:
      const obFill = g.fill.bind(g);
      g.fill = function () {
        const m = g.getTransform();
        // detect a transform that is NOT the plain outer one
        if (Math.abs(m.e - (-(v.x * s))) > 1 || Math.abs(m.f - (-(v.y * s))) > 1) {
          if (!rockCTM) rockCTM = [m.a, m.b, m.c, m.d, m.e, m.f].map(n => +n.toFixed(2));
        }
        return obFill();
      };
      G._drawAll();
      g.fill = obFill;
      const img = g.getImageData(0, 0, 1280, 800).data;
      const rgb = (x, y) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= 1280 || y >= 800) return ['oob']; const i = (y * 1280 + x) * 4; return [img[i], img[i + 1], img[i + 2], img[i + 3]]; };
      // expected single-transform screen coords:
      const frogS = [640, 400];
      const rockS = [640 + 60, 400];
      // find rock-grey anywhere: rock colors ~ #8a7f72 family; scan center band
      let rockFound = null;
      for (let x = 0; x < 1280; x += 4) {
        for (let y = 300; y < 500; y += 4) {
          const i = (y * 1280 + x) * 4;
          const r = img[i], gg = img[i + 1], b = img[i + 2];
          // warm grey stone, not cream, not green, not ink
          if (r > 100 && r < 190 && Math.abs(r - gg) < 18 && Math.abs(gg - b) < 18 && r - gg > -6) {
            rockFound = [x, y, r, gg, b]; break;
          }
        }
        if (rockFound) break;
      }
      return {
        v: [v.x | 0, v.y | 0], rockWorld: [rk.x | 0, rk.y | 0, rk.r],
        frogPx: rgb(640, 400), rockExpectedPx: rgb(rockS[0], rockS[1]),
        rockFoundInBand: rockFound, innerCTMseen: rockCTM,
        transparentCheck: { c1: rgb(200, 400), c2: rgb(1000, 400) },
      };
    });
    console.log('XFORM6', JSON.stringify(R));
    break;
  }
  case 'xform5': {
    // Dump ACTUAL pixel RGB at the pad's single/double positions, the frog,
    // four screen corners, and the zone colorSat + a full histogram bucket.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    const R = await page.evaluate(() => {
      const G = window.__g;
      const pad = G.world.pads.reduce((a, b) => (Math.abs(b.x - 3800) < Math.abs(a.x - 3800) ? b : a));
      G.player.x = 4000; G.player.y = 760;
      G.cam.x = 4000; G.cam.y = 760;
      if (G._updateCamera) G._updateCamera(1);
      const v = G._view(), s = v.scale;
      const c = document.getElementById('game'), g = c.getContext('2d');
      G._drawAll();
      const img = g.getImageData(0, 0, 1280, 800).data;
      const rgb = (x, y) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= 1280 || y >= 800) return ['oob']; const i = (y * 1280 + x) * 4; return [img[i], img[i + 1], img[i + 2], img[i + 3]]; };
      const padSx = pad.x - v.x, padSy = pad.y - v.y;
      const buckets = {};
      for (let x = 0; x < 1280; x += 16) for (let y = 0; y < 800; y += 16) {
        const i = (y * 1280 + x) * 4;
        const key = img[i] + ',' + img[i + 1] + ',' + img[i + 2];
        buckets[key] = (buckets[key] || 0) + 1;
      }
      const top = Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, 8);
      return {
        sat: +G.world.worldColorSat().toFixed(3),
        pad: [pad.x | 0, pad.y | 0], v: [v.x | 0, v.y | 0],
        atPadSingle: rgb(padSx, padSy),
        atFrog: rgb(640, 400),
        corners: { TL: rgb(5, 5), TR: rgb(1274, 5), BL: rgb(5, 794), BR: rgb(1274, 794), C: rgb(640, 400) },
        topColors: top,
      };
    });
    console.log('XFORM5', JSON.stringify(R));
    break;
  }
  case 'xform4': {
    // DEFINITIVE: is terrain double-transformed vs actors? Move the frog +
    // camera to world (4000,760) where a lily pad sits at ~(3800,760).
    // Probe pad-green at the single-transform position and at the
    // double-transform position.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    const R = await page.evaluate(() => {
      const G = window.__g;
      const pad = G.world.pads.reduce((a, b) => (Math.abs(b.x - 3800) < Math.abs(a.x - 3800) ? b : a));
      G.player.x = 4000; G.player.y = 760;
      G.cam.x = 4000; G.cam.y = 760;
      if (G._updateCamera) G._updateCamera(1);
      const v = G._view();
      const s = v.scale, padSx = pad.x * s - v.x * s, padSy = pad.y * s - v.y * s;
      // double-transform: screen = pad*s^2 - v.x*s*(s+1)  (outer then inner)
      const padSx2 = pad.x * s * s - v.x * s * (s + 1);
      const padSy2 = pad.y * s * s - v.y * s * (s + 1);
      const frogSx = G.player.x * s - v.x * s, frogSy = (G.player.y - 0) * s - v.y * s;
      const c = document.getElementById('game'), g = c.getContext('2d');
      G._drawAll();
      const img = g.getImageData(0, 0, 1280, 800).data;
      const region = (sx, sy) => {
        let green = 0, floor = 0, n = 0;
        for (let dx = -24; dx <= 24; dx += 4) for (let dy = -24; dy <= 24; dy += 4) {
          const x = (sx + dx) | 0, y = (sy + dy) | 0;
          if (x < 0 || y < 0 || x >= 1280 || y >= 800) continue;
          const i = (y * 1280 + x) * 4, d = img;
          n++;
          const r = d[i], gg = d[i + 1], b = d[i + 2];
          // lily-pad green #4f8a55 -> r79 g138 b85-ish (sat 1)
          if (gg > r + 20 && gg > b + 20 && gg > 90 && r < 130) green++;
          // swamp floor #6f9e8e -> r111 g158 b142 (g highest, b close to g)
          if (gg > 120 && b > 100 && Math.abs(gg - b) < 40 && gg - r > 25) floor++;
        }
        return { n, green, floor };
      };
      const scan = (label, x0, y0, x1, y1) => {
        let green = 0, floor = 0, n = 0;
        for (let x = x0; x <= x1; x += 8) for (let y = y0; y <= y1; y += 8) {
          if (x < 0 || y < 0 || x >= 1280 || y >= 800) continue;
          const i = (y * 1280 + x) * 4;
          n++;
          const r = img[i], gg = img[i + 1], b = img[i + 2];
          if (gg > r + 20 && gg > b + 20 && gg > 90 && r < 130) green++;
          if (gg > 120 && b > 100 && Math.abs(gg - b) < 40 && gg - r > 25) floor++;
        }
        return { label, n, green, floor };
      };
      return {
        pad: [pad.x | 0, pad.y | 0, pad.r], v: [v.x | 0, v.y | 0, +s.toFixed(3)],
        padSingle: [padSx | 0, padSy | 0], padDouble: [padSx2 | 0, padSy2 | 0],
        frogScreen: [frogSx | 0, frogSy | 0],
        atSingle: region(padSx, padSy), atDouble: region(padSx2, padSy2),
        atFrog: region(frogSx, frogSy),
        screenQuarter: [scan('TL', 0, 0, 320, 200), scan('TR', 960, 0, 1280, 200), scan('BL', 0, 600, 320, 800), scan('BR', 960, 600, 1280, 800)],
      };
    });
    console.log('XFORM4', JSON.stringify(R));
    break;
  }
  case 'xform': {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    const R = await page.evaluate(() => {
      const G = window.__g;
      const p = G.player; p.x = 3000; p.y = 700;
      // hard-set the camera to the frog (no lag) and force a frame
      G.cam.x = 3000; G.cam.y = 700;
      G._updateCamera(1);
      const v = G._view();
      const cv = document.getElementById('game'); const g = cv.getContext('2d');
      const img = g.getImageData(0, 0, 1280, 800).data;
      const px = (x, y) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= 1280 || y >= 800) return [0,0,0,0]; const i = (y*1280+x)*4; return [img[i],img[i+1],img[i+2],img[i+3]]; };
      // scan for frog-green body #69a24e-ish (r~105,g~162,b~78)
      let fx = 0, fy = 0, fn = 0;
      for (let y = 0; y < 800; y++) for (let x = 0; x < 1280; x++) {
        const d = (y*1280+x)*4; const r = img[d], gg = img[d+1], b = img[d+2];
        if (Math.abs(r-105) < 40 && Math.abs(gg-162) < 40 && Math.abs(b-78) < 45) { fx += x; fy += y; fn++; }
      }
      const frogScreen = fn ? [fx/fn|0, fy/fn|0, fn] : null;
      // pick a rock near the frog and scan for it (grey ~ #8a8578 = 138,133,120)
      const rock = G.world.obstacles.find(o => o.kind === 0 && Math.abs(o.x-3000) < 300 && Math.abs(o.y-700) < 250);
      let rockScreen = null;
      if (rock) {
        let rx = 0, ry = 0, rn = 0;
        for (let y = 0; y < 800; y++) for (let x = 0; x < 1280; x++) {
          const d = (y*1280+x)*4; const r = img[d], gg = img[d+1], b = img[d+2];
          if (Math.abs(r-138) < 26 && Math.abs(gg-133) < 26 && Math.abs(b-120) < 26) { rx += x; ry += y; rn++; }
        }
        rockScreen = rn ? [rx/rn|0, ry/rn|0, rn] : null;
      }
      const single = (wx, wy) => [(wx - v.x)*v.scale|0, (wy - v.y)*v.scale|0];
      const double = (wx, wy) => { const s = v.scale; return [s*(s*(wx - v.x) - v.x)|0, s*(s*(wy - v.y) - v.y)|0]; };
      return {
        cam: [v.x|0, v.y|0, +v.scale.toFixed(3)],
        frogWorld: [p.x|0, p.y|0],
        frogScreen, frogSingle: single(p.x, p.y), frogDouble: double(p.x, p.y),
        rockWorld: rock ? [rock.x|0, rock.y|0, rock.r|0] : null,
        rockScreen, rockSingle: rock ? single(rock.x, rock.y) : null, rockDouble: rock ? double(rock.x, rock.y) : null,
      };
    });
    console.log('XFORM', JSON.stringify(R));
    await page.screenshot({ path: 'tests/.out/18-xform.png' });
    console.log('[shot] 18-xform.png');
    break;
  }
  case 'floorcov': {
    // PT5 decisive: measure what % of the viewport is swamp-floor vs cream(page bg)
    // at (a) start and (b) a panned position. Also locate a rock's real screen pos.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(650);
    const scan = async () => {
      return page.evaluate(async () => {
        const G = window.__g;
        const cv = document.getElementById('game');
        const g = cv.getContext('2d');
        const img = g.getImageData(0, 0, 1280, 800).data;
        let floor = 0, cream = 0, other = 0, total = 0;
        for (let y = 0; y < 800; y += 4) for (let x = 0; x < 1280; x += 4) {
          const i = (y * 1280 + x) * 4; const r = img[i], gg = img[i + 1], b = img[i + 2], a = img[i + 3];
          total++;
          if (a < 10) { cream++; continue; }
          // swamp floor desaturated #6f9e8e: r<gg, b close, low sat, mid value
          const maxc = Math.max(r, gg, b), minc = Math.min(r, gg, b);
          if (gg >= r && b >= r - 10 && (maxc - minc) < 40 && maxc > 70 && maxc < 190) floor++;
          else if (r > 220 && gg > 210 && b > 185) cream++;
          else other++;
        }
        return { floorPct: +(100 * floor / total).toFixed(1), creamPct: +(100 * cream / total).toFixed(1), otherPct: +(100 * other / total).toFixed(1) };
      });
    };
    const start = await scan();
    // teleport frog + camera to mid-swamp
    await page.evaluate(async () => { const G = window.__g, p = G.player; p.x = 3000; p.y = 750; });
    await page.waitForTimeout(300);
    const panned = await scan();
    // locate a rock by scanning for its blob (dark-ish, low alpha) in world 2600-3400
    const rockPos = await page.evaluate(() => {
      const G = window.__g; const v = G._view();
      const cv = document.getElementById('game'); const g = cv.getContext('2d');
      const rock = G.world.obstacles.find(o => o.kind === 0 && o.x > 2600 && o.x < 3400);
      if (!rock) return null;
      // check single vs double transform screen positions
      const px = (sx, sy) => { const d = g.getImageData(sx | 0, sy | 0, 1, 1).data; return [d[0], d[1], d[2], d[3]]; };
      const single = { sx: (rock.x - v.x) * v.scale, sy: (rock.y - v.y) * v.scale };
      const outer = single; // outer transform IS the camera
      // double would be applying camera twice: screen = s*(s*(rock-v) - v)
      const s = v.scale;
      const double = { sx: s * (s * (rock.x - v.x) - v.x), sy: s * (s * (rock.y - v.y) - v.y) };
      return { world: [rock.x, rock.y, rock.r], view: [v.x | 0, v.y | 0, +s.toFixed(3)],
        single: [single.sx | 0, single.sy | 0, ...px(single.sx, single.sy)],
        double: [double.sx | 0, double.sy | 0, ...px(double.sx, double.sy)] };
    });
    console.log('FLOORCOV', JSON.stringify({ start, panned, rockPos }));
    await page.screenshot({ path: 'tests/.out/17-floorcov.png' });
    console.log('[shot] 17-floorcov.png');
    break;
  }
  case 'misreg': {
    // PT5 decisive probe: is terrain misregistered vs actors (double transform)?
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    const A = await page.evaluate(async () => {
      const G = window.__g; const p = G.player;
      // teleport to a mid-world spot well away from start
      p.x = 2800; p.y = 760; G._updateCamera(1);
      await new Promise(r => setTimeout(r, 60));
      const v = G._view();
      // the frog is drawn under the OUTER camera transform only:
      //   screen = (world - v.x) * v.scale
      const single = (wx, wy) => ({ sx: (wx - v.x) * v.scale, sy: (wy - v.y) * v.scale });
      const rock = G.world.obstacles.find(o => Math.abs(o.x - p.x) < 260 && Math.abs(o.y - p.y) < 220);
      function pxAt(sx, sy) {
        const cv = document.getElementById('game');
        const g = cv.getContext('2d');
        const d = g.getImageData(sx | 0, sy | 0, 1, 1).data;
        return [d[0], d[1], d[2], d[3]];
      }
      const probe = (obj, label) => {
        const r = {};
        for (const [nm, pt] of Object.entries(obj)) { if (pt) r[nm] = pxAt(pt.sx, pt.sy); }
        r._label = label; r._view = [v.x | 0, v.y | 0, +v.scale.toFixed(3)]; r._px = [p.x | 0, p.y | 0];
        return r;
      };
      // frog center under single vs double transform
      const dF = { single: single(p.x, p.y - 12), double: single(single(p.x, p.y - 12).sx, single(p.x, p.y - 12).sy) };
      const out = { frog: probe(dF, 'frog') };
      if (rock) {
        const rs = single(rock.x, rock.y);
        const rd = { single: rs, double: single(rs.sx, rs.sy) };
        out.rock = probe(rd, 'rock');
        out._rockWorld = [rock.x | 0, rock.y | 0, rock.r | 0];
      }
      // horizontal scan at frog's screen-y: find long runs of near-cream (page bg)
      const sy = (p.y - v.y) * v.scale;
      let runs = [], inC = false, start = 0;
      for (let sx = 0; sx < 1280; sx += 2) {
        const d = pxAt(sx, sy);
        // cream page bg #efe3cc ~ (239,227,204); transparent->cream over white
        const cream = d[3] < 10 ? true : (d[0] > 225 && d[1] > 215 && d[2] > 190 && d[0] < 250 && Math.abs(d[0] - d[2]) < 45);
        if (cream && !inC) { inC = true; start = sx; }
        if (!cream && inC) { inC = false; if (sx - start > 40) runs.push([start, sx, sx - start]); }
      }
      out._creamRuns = runs.slice(0, 10);
      return out;
    });
    console.log('MISREG', JSON.stringify(A));
    await page.screenshot({ path: 'tests/.out/16-misreg.png' });
    console.log('[shot] 16-misreg.png');
    break;
  }
  case 'onb': {
    // capture the title copy + first-expedition banners, plus the atelier intro
    await frames(10);
    const titleState = await g();
    await shot('10-title');
    await page.keyboard.press('Enter');
    // the atelier screen appears first (build) — capture it
    await frames(15);
    await shot('11-atelier');
    const at = await g();
    console.log('[state]', at.state, 'intro?', !!at.atelierIntro || at._introPanel);
    // depart
    await page.keyboard.press('Enter');
    await frames(10);
    const exp = await g();
    console.log('[exp]', exp.state, 'banners', JSON.stringify(exp.banners?.map(b => b.text)));
    await shot('12-expedition');
    break;
  }
}

await browser.close();
