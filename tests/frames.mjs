// tests/frames.mjs — T0 (v1.9): the frame-evidence harness (dev-only, committed
// test, run by `node tests/frames.mjs`).
//
// A small screenshot tool built on the sanctioned dev tooling (playwright-core;
// no runtime dep for the game itself). It boots the real game over loopback on
// a FREE PORT (never 8765), drives it headless through 35 key scenes (seeded
// save states + fixed positions + a frozen rAF loop for determinism), and
// writes real PNGs to tests/frames/ (gitignored EXCEPT the README.md index).
//
// It doubles as T0's test: after capturing, it verifies 20+ frames exist and
// are NON-TRIVIAL (pixel std-dev >= 2 AND file >= 30 KB — a real render with
// visible content, not a blank fill), prints a manifest, and exits non-zero if
// the set is incomplete. Every v1.9 polish item ships its before/after frames
// by re-running this harness (see tests/frames/README.md).
//
// Determinism: Math.random is seeded (mulberry32(12345)) so world builds are
// reproducible; rAF is frozen (no-op) so the game does NOT auto-advance — we
// stage each scene and call G._drawAll() manually on a fixed G.now.
'use strict';
import { chromium } from 'playwright-core';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

// This file lives in <repo>/tests/, so the repo root is one level up. Resolve
// it from the script's own location (not cwd) so it works from any directory.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FRAMES_DIR = path.join(ROOT, 'tests', 'frames');
const CHROME = path.join(homedir(), '.agent-browser', 'browsers', 'chrome-152.0.7977.82', 'chrome.exe');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

// ---------- free port (NEVER 8765) ----------
function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => (p === 8765 ? freePort().then(res) : res(p)));
    });
  });
}

// ---------- static server ----------
function serve(port) {
  return new Promise((res) => {
    const server = http.createServer((req, r) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      fs.readFile(f, (e, d) => {
        if (e) { r.writeHead(404); r.end('nf ' + p); return; }
        r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
        r.end(d);
      });
    });
    server.listen(port, '127.0.0.1', () => res(server));
  });
}

// ---------- boot ----------
const port = await freePort();
const server = await serve(port);
const GAME_URL = `http://127.0.0.1:${port}/index.html`;
console.log(`[frames] serving on ${port} (8765 = dev-only, never used here)`);

const browser = await chromium.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--window-size=1280,800'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('pageerror', (e) => console.log('[page-fatal]', String(e)));
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });

// Freeze the auto rAF loop + seed Math.random BEFORE the module boots, and
// register the in-page scene library. Everything the scenes need (staging
// state, forcing a real render) runs in-page against window.__game +
// window.__mods, so nothing cross-realm is serialized.
await page.addInitScript(() => {
  let s = 12345 >>> 0;
  function rng() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  Math.random = rng;
  const origRaf = window.requestAnimationFrame;
  window.requestAnimationFrame = () => 0; // no-op: never reschedules
  window.__origRaf = origRaf;

  // ---- in-page scene library ----
  const PAINTING_IDS = ['moonlit-pond', 'dancing-salamander', 'spring-garden', 'self-portrait',
    'king-frog', 'storm-cloud', 'beetle-armor', 'croaksworth', 'gilded-meridian', 'verdant-crown'];
  const BOSS_IDS = ['gray', 'green', 'gilded', 'wyrm', 'warden', 'umbra'];

  function toTitle(G) {
    G.state = 'title'; G.paused = false; G.help = false; G.optionsOpen = false;
    G.player = null; G.heron = null; G.midHeron = null; G.enemies = []; G.orbs = [];
    G._seedCard = null; G._modPrompt = null; G._encoreOpen = false;
    G.titleT = 3; G.now = 10;
  }
  // Begin a fresh seeded expedition. saveMut(save) mutates the save BEFORE the
  // run starts (to gate Reeds / Black Reeds / NG+ / Wander / full collection).
  // opts -> G.options keys; runOpts -> _beginExpedition's second arg (reeds).
  function beginRun(G, saveMut, opts, runOpts) {
    toTitle(G);
    if (saveMut) saveMut(G.save);
    if (opts) for (const k in opts) G.options[k] = opts[k];
    G.challenge = null;
    G._beginExpedition(false, runOpts || {}); // deterministic: Math.random is seeded
    return G;
  }
  function enemyScene(G, kind, pig) {
    // spawnEnemy is a function (not a class) — call it, not `new`.
    const e = G.__modsEnemy(kind, G.player.x + 140, G.player.y - 10, G.tuning);
    e._seed = 1.3; e.hitFlash = 0; e.hp = e.maxHp; e.dead = false;
    if (pig === 'burn') { e.status = { type: 'burn', t: 4, max: 4 }; e.tint = '#e8836b'; e.tintT = 1; G.player.pigment = 'red'; }
    else if (pig === 'freeze') { e.status = { type: 'freeze', t: 4, max: 4 }; G.player.pigment = 'blue'; }
    else if (pig === 'root') { e.status = { type: 'root', t: 4, max: 4 }; G.player.pigment = 'green'; }
    G.enemies = [e];
    G.now = 2.5;
    return { note: 'enemy ' + kind + (pig ? ' (' + pig + ')' : '') };
  }
  // Build a real run-start heron via _beginExpedition, then MUTATE it into the
  // target variant. The draw dispatch routes on h.warden/h.umbra/h.wyrm flags
  // (falling through to _drawHeron), so we copy the fully-populated gray heron
  // (it has hue/hitFlash/diveH/facing/etc.) and overwrite the variant fields.
  // The wyrm/warden/umbra are built by the game only when the frog REACHES the
  // arena, so we hand-build them here from the same field contract.
  function bossFrame(G, { flags, stats, ngCycle, opts, runOpts, variant, phase, surfIdx, awakened, hpFrac, arena }) {
    beginRun(G, (sv) => {
      if (ngCycle != null) sv.ngCycle = ngCycle;
      if (flags) Object.assign(sv.flags, flags);
      if (stats) Object.assign(sv.stats, stats);
    }, opts, runOpts);
    const base = G.heron || { hue: { red: 0, blue: 0, green: 0 }, hitFlash: 0, diveH: 0, facing: -1, flying: 0, _intro: 0 };
    const w = G.world.w;
    // arena water line (SILT_WYRM/UMBRAL surfaceY); head x at the active point.
    const surfY = variant === 'umbra' ? 1500 : 780;
    const arenaX = w - 600;
    const h = Object.assign({}, base, {
      x: arenaX, y: surfY, phase: phase || 'surfaced', phaseT: 4,
      surfIdx: surfIdx != null ? surfIdx : 0, awakened: !!awakened,
      awakenedT: awakened ? 1.2 : 0, hue: { red: 0, blue: 0, green: 0 },
      hitFlash: 0, diving: false, sinking: false,
    });
    if (variant === 'wyrm') { h.kind = 'wyrm'; h.wyrm = true; h.warden = h.umbra = h.green = h.gilded = false; }
    else if (variant === 'warden') { h.kind = 'warden'; h.warden = true; h.wyrm = h.umbra = h.green = h.gilded = false; h.tasteFactor = 1; }
    else if (variant === 'umbra') { h.kind = 'umbra'; h.umbra = true; h.wyrm = h.warden = h.green = h.gilded = false; h._transitFromX = w - 900; }
    else { h.wyrm = h.warden = h.umbra = false; if (variant === 'green') { h.green = true; h.gilded = false; } if (variant === 'gilded') { h.gilded = true; h.green = false; } }
    if (variant === 'gilded') h.plumeT = 0.8; // the gold-plume phase (visible tell)
    const maxHp = { gray: 30000, green: 36000, gilded: 42000, wyrm: 48000, warden: 52000, umbra: 60000 }[variant] || 30000;
    h.maxHp = maxHp; h.hp = Math.round(maxHp * (hpFrac != null ? hpFrac : 0.7));
    if (awakened) { h.awakened = true; h.awakenedT = 1.2; h.hp = Math.round(maxHp * 0.1); }
    G.heron = h;
    // frame the arena: frog to the left, camera centered on the boss.
    G.player.x = w - 900; G.player.y = surfY - 20; G.player.alive = true;
    G.cam.x = arenaX - 250; G.cam.y = surfY; G.zoom = 1; G.shake = 0;
    if (awakened) G._bloom = { x: arenaX, y: surfY, t: 0.5, dur: 1.4 };
    G.enemies = []; G.orbs = [];
    G.now = 6;
    return { note: (variant || 'heron') + (awakened ? ' (awaken)' : '') };
  }

  const S = {};

  // ---- title ----
  S['title'] = (G) => { toTitle(G); return { note: 'title' }; };
  S['options'] = (G) => { toTitle(G); G.optionsOpen = true; G.now = 11; return { note: 'options panel' }; };
  S['wander-seed-card'] = (G) => { toTitle(G); G.options.wander = true; G._seedCard = { seed: 424242 }; G.now = 12; return { note: 'wander seed card' }; };
  S['full-collection-badge'] = (G) => {
    toTitle(G);
    G.save.galleryComplete = true;
    G.save.owned = PAINTING_IDS.slice();
    G.save.flags.bossDefeats = BOSS_IDS.slice();
    G.save.stats.victories = 6; G.save.flags.reedsVictory = true; G.save.flags.heronDefeated = true;
    G.now = 13; return { note: 'title + full-collection badge' };
  };

  // ---- atelier (state = 'atelier') ----
  function atelierTab(G, tab, saveMut) {
    G._beginAtelier();
    if (saveMut) saveMut(G.save);
    G.atelierTab = tab; G.atelierT = 1; G.now = 20;
  }
  S['atelier-upgrades'] = (G) => { toTitle(G); atelierTab(G, 0); return { note: 'atelier / studio upgrades' }; };
  S['atelier-loadout'] = (G) => { toTitle(G); atelierTab(G, 1); return { note: 'atelier / paintings + loadout' }; };
  S['gallery-wall-empty'] = (G) => {
    toTitle(G); G.save.owned = []; G.save.loadout = [];
    atelierTab(G, 2); return { note: 'gallery wall (empty)' };
  };
  S['gallery-wall-full'] = (G) => {
    toTitle(G);
    G.save.owned = PAINTING_IDS.slice();
    G.save.flags.bossDefeats = BOSS_IDS.slice();
    G.save.stats.victories = 6; G.save.flags.reedsVictory = true; G.save.flags.heronDefeated = true;
    G.save.galleryComplete = true;
    atelierTab(G, 2); return { note: 'gallery wall (full-collection glow)' };
  };

  // ---- expedition / paint in flight ----
  function paintRun(G, pig, surf) {
    beginRun(G, null, { wander: false });
    G.enemies = []; G.orbs = [];
    G.player.pigment = pig;
    G.player.aimA = surf === 'water' ? -0.4 : (surf === 'vegetation' ? 0.3 : 0.1);
    const P = G.paint, w = G.world;
    P.trails = [];
    P.trails.push({ ring: false, x0: G.player.x - 60, y0: G.player.y + 30,
      x1: G.player.x + 90, y1: G.player.y - 40, w: 20, t: 0.26, max: 0.35, pig, seed: 0.7 });
    P._addWet(G.player.x + 60, G.player.y - 30, 30, pig, 3);
    P._addWet(G.player.x + 100, G.player.y - 50, 22, pig, 3);
    P._addWet(G.player.x - 20, G.player.y + 10, 26, pig, 3);
    // surface: nudge the player to a representative spot (soil / water / veg)
    if (surf === 'water') { G.player.y = 1250; G.player.x = 900; }
    else if (surf === 'vegetation') { G.player.y = 900; G.player.x = 1600; }
    else { G.player.y = 750; G.player.x = 700; }
    G.player.aimA = surf === 'water' ? -0.4 : (surf === 'vegetation' ? 0.3 : 0.1);
    G.now = 4.5;
    return { note: `paint in flight: ${pig} on ${surf}` };
  }
  S['paint-red'] = (G) => paintRun(G, 'red', 'soil');
  S['paint-blue'] = (G) => paintRun(G, 'blue', 'soil');
  S['paint-green'] = (G) => paintRun(G, 'green', 'soil');
  S['paint-dry'] = (G) => paintRun(G, 'dry', 'soil');
  S['paint-water'] = (G) => paintRun(G, 'blue', 'water');
  S['paint-vegetation'] = (G) => paintRun(G, 'green', 'vegetation');

  // ---- 6 enemies ----
  S['enemy-beetle'] = (G) => { beginRun(G, null); return enemyScene(G, 'beetle', 'plain'); };
  S['enemy-mosquito'] = (G) => { beginRun(G, null); return enemyScene(G, 'mosquito', 'plain'); };
  S['enemy-toad'] = (G) => { beginRun(G, null); return enemyScene(G, 'toad', 'plain'); };
  S['enemy-wisp'] = (G) => { beginRun(G, (sv) => { sv.flags.reedsUnlocked = true; sv.stats.victories = 1; }, null, { reeds: true }); return enemyScene(G, 'wisp', 'plain'); };
  S['enemy-serpent'] = (G) => { beginRun(G, (sv) => { sv.flags.reedsUnlocked = true; sv.stats.victories = 1; }, null, { reeds: true }); return enemyScene(G, 'serpent', 'plain'); };
  S['enemy-leech'] = (G) => { beginRun(G, (sv) => { sv.flags.reedsUnlocked = true; sv.stats.victories = 1; }, null, { reeds: true }); return enemyScene(G, 'leech', 'plain'); };
  // status examples
  S['status-burn'] = (G) => { beginRun(G, null); return enemyScene(G, 'beetle', 'burn'); };
  S['status-freeze'] = (G) => { beginRun(G, null); return enemyScene(G, 'mosquito', 'freeze'); };
  S['status-root'] = (G) => { beginRun(G, null); return enemyScene(G, 'toad', 'root'); };

  // ---- 6 bosses (heron variants) + awaken ----
  S['boss-gray-heron'] = (G) => bossFrame(G, { variant: 'gray', hpFrac: 0.75 });
  S['boss-gray-heron-awaken'] = (G) => bossFrame(G, { variant: 'gray', awakened: true });
  S['boss-green-heron'] = (G) => bossFrame(G, { variant: 'green', hpFrac: 0.75 });
  S['boss-gilded-heron'] = (G) => bossFrame(G, { variant: 'gilded', hpFrac: 0.75 });
  S['boss-silt-wyrm'] = (G) => bossFrame(G, { variant: 'wyrm', phase: 'surfaced', hpFrac: 0.75, runOpts: { reeds: true }, flags: { reedsUnlocked: true }, stats: { victories: 1 } });
  S['boss-hollow-warden'] = (G) => bossFrame(G, { variant: 'warden', phase: 'mawOpen', hpFrac: 0.75, opts: { wander: true } });
  S['boss-hollow-warden-awaken'] = (G) => bossFrame(G, { variant: 'warden', phase: 'mawOpen', awakened: true, opts: { wander: true } });
  S['boss-umbral-wyrm'] = (G) => bossFrame(G, { variant: 'umbra', phase: 'surfaced', hpFrac: 0.7, runOpts: { reeds: true }, ngCycle: 2, flags: { reedsUnlocked: true, reedsVictory: true }, stats: { victories: 1 } });
  S['boss-umbral-deep-dark'] = (G) => bossFrame(G, { variant: 'umbra', phase: 'surfaced', awakened: true, hpFrac: 0.3, runOpts: { reeds: true }, ngCycle: 2, flags: { reedsUnlocked: true, reedsVictory: true }, stats: { victories: 1 } });

  // ---- Reeds descent (lantern) / Black Reeds ----
  S['reeds-descent'] = (G) => {
    beginRun(G, (sv) => { sv.flags.reedsUnlocked = true; sv.stats.victories = 1; }, null, { reeds: true });
    G.enemies = []; G.orbs = [];
    G.player.x = 2000; G.player.y = 780; G.cam.x = 2000; G.cam.y = 780;
    G.lantern.fuel = 1; G.lantern.lit = true;
    G.now = 9; return { note: 'Reeds descent — lantern lit' };
  };
  S['black-reeds-descent'] = (G) => {
    beginRun(G, (sv) => { sv.ngCycle = 1; sv.flags.reedsUnlocked = true; sv.flags.reedsVictory = true; sv.stats.victories = 1; }, null, { reeds: true });
    G.enemies = []; G.orbs = [];
    G.player.x = 2400; G.player.y = 800; G.cam.x = 2400; G.cam.y = 800;
    G.lantern.fuel = 0.6; G.lantern.lit = true;
    G.now = 9; return { note: 'Black Reeds descent (NG+, darker)' };
  };
  S['warden-maw-open'] = (G) => {
    beginRun(G, null, { wander: true });
    // Force the Warden into its maw-open window and frame the arena.
    const w = G.world.w;
    G.heron = { kind: 'warden', warden: true, maxHp: 52000, hp: 40000,
      phase: 'mawOpen', phaseT: 5, surfIdx: 0, tasteFactor: 1, awakened: false };
    G.player.x = w - 700; G.player.y = 760; G.cam.x = w - 500; G.cam.y = 780; G.zoom = 1; G.now = 7;
    return { note: "Warden's maw open (paintable window)" };
  };

  // ---- end-screen recap ----
  S['end-recap'] = (G) => {
    beginRun(G, null);
    G.state = 'end'; G.endKind = 'victory'; G.endT = 2; G.runT = 40;
    G.runWaypoints = [{ x: 260, y: 750 }, { x: 900, y: 800 }, { x: 1800, y: 780 },
      { x: 2700, y: 820 }, { x: 3600, y: 760 }, { x: 4500, y: 800 }, { x: 5100, y: 780 }];
    G.runEnemies = 24; G.runOrbs = 18; G.bossTime = 90;
    G._cine = null; G.heron = null;
    G.now = 30; return { note: 'end-screen recap (victory + route strip)' };
  };

  window.__scenes = S;
  // In-canvas pixel probe: sample a stride of pixels from the real render and
  // return {mean, std}. A near-blank frame has std ~ 0; a real scene (even a
  // dark Reeds/Umbral one with a lit lantern + HUD) has std >> 0. This is what
  // the manifest uses to prove a frame has real content, not just file size.
  function pixelStats() {
    const cv = document.getElementById('game');
    if (!cv) return { mean: -1, std: -1 };
    const ctx = cv.getContext('2d');
    const { width: w, height: h } = cv;
    const stride = 8;                       // sample every 8th px (~25k samples)
    const data = ctx.getImageData(0, 0, w, h).data;
    let sum = 0, sumSq = 0, n = 0;
    for (let y = 0; y < h; y += stride) {
      for (let x = 0; x < w; x += stride) {
        const i = (y * w + x) * 4;
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        sum += lum; sumSq += lum * lum; n++;
      }
    }
    const mean = sum / n;
    const std = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
    return { mean: Math.round(mean), std: Math.round(std * 10) / 10 };
  }
  window.__pixelStats = pixelStats;
  window.__scene = (name) => {
    const G = window.__game;
    if (!G) return { err: 'no __game' };
    const fn = S[name];
    if (!fn) return { err: 'unknown scene ' + name };
    // expose the Enemy ctor to the scene helpers
    G.__modsEnemy = window.__modsEnemy;
    try {
      const out = fn(G);
      G._drawAll(); // the real render, on a fully-deterministic staged state
      const stats = pixelStats();
      const r = out || { note: name };
      r.mean = stats.mean; r.std = stats.std;
      return r;
    } catch (e) { return { err: String(e) }; }
  };
});

await page.goto(GAME_URL, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(400);

// Verify the game booted + grab the Enemy ctor from the enemies module.
const boot = await page.evaluate(() => {
  const G = window.__game;
  if (!G) return { ok: false, err: 'no __game' };
  return { ok: true, state: G.state, cw: G.cw, ch: G.ch };
});
if (!boot.ok) { console.log('[frames] FATAL', boot.err); await browser.close(); server.close(); process.exit(1); }
// Load the Enemy ctor into the page scope (in-page, via a dynamic import of the module).
await page.evaluate(async () => {
  const m = await import('/src/enemies.js');
  window.__modsEnemy = m.spawnEnemy;
});
console.log('[frames] booted:', JSON.stringify(boot));

fs.mkdirSync(FRAMES_DIR, { recursive: true });

const SCENES = [
  'title', 'options', 'wander-seed-card', 'full-collection-badge',
  'atelier-upgrades', 'atelier-loadout', 'gallery-wall-empty', 'gallery-wall-full',
  'paint-red', 'paint-blue', 'paint-green', 'paint-dry', 'paint-water', 'paint-vegetation',
  'enemy-beetle', 'enemy-mosquito', 'enemy-toad', 'enemy-wisp', 'enemy-serpent', 'enemy-leech',
  'status-burn', 'status-freeze', 'status-root',
  'boss-gray-heron', 'boss-gray-heron-awaken', 'boss-green-heron', 'boss-gilded-heron',
  'boss-silt-wyrm', 'boss-hollow-warden', 'boss-hollow-warden-awaken',
  'boss-umbral-wyrm', 'boss-umbral-deep-dark',
  'reeds-descent', 'black-reeds-descent', 'warden-maw-open', 'end-recap',
];

const manifest = [];
for (const name of SCENES) {
  const info = await page.evaluate((n) => window.__scene(n), name);
  if (info && info.err) {
    console.log(`[frame FAIL] ${name}: ${info.err}`);
    manifest.push({ name, err: info.err, size: 0, std: 0 });
    continue;
  }
  const p = path.join(FRAMES_DIR, name + '.png');
  await page.screenshot({ path: p });
  const size = fs.statSync(p).size;
  // real-content check: the rendered canvas must have visible variance (std).
  // A near-blank frame compresses tiny AND has std ~ 0. Even a dark Reeds/
  // Umbral scene (lit lantern + HUD + wrym body) has std well above 0.
  manifest.push({ name, path: p, size, mean: info.mean, std: info.std, note: info.note });
  console.log(`[frame] ${name}.png  (${(size / 1024).toFixed(0)} KB, mean ${info.mean} std ${info.std})  ${info.note || ''}`);
}

await browser.close();
server.close();

// ---------- verify ----------
// A frame is "non-trivial" when the real render shows visible content
// (pixel std-dev >= 2) AND the PNG is a real image (>= 30 KB). This is what
// the committed test (tests/frames.mjs verify) and the A1 audit rely on.
const ok = manifest.filter((m) => !m.err && m.size >= 30000 && m.std >= 2);
const failed = manifest.filter((m) => m.err);
console.log('\n=== FRAME MANIFEST ===');
for (const m of manifest) {
  const stat = m.err ? m.err : `mean ${m.mean} std ${m.std}`;
  console.log(`${m.err ? 'FAIL' : (ok.includes(m) ? 'OK  ' : 'LOW ')}  ${m.name}  ${m.size ? (m.size / 1024).toFixed(0) + ' KB' : ''}  ${stat}`);
}
console.log(`\n${ok.length}/${manifest.length} frames non-trivial (std>=2, >=30KB); ${failed.length} failed`);
if (pageErrors.length) console.log('[page errors]', pageErrors.slice(0, 10));
if (ok.length < 20) { console.log('T0 FRAME SET INCOMPLETE (<20 frames non-trivial)'); process.exit(2); }
console.log(`T0 FRAME SET COMPLETE — ${ok.length} baseline frames captured under tests/frames/`);
