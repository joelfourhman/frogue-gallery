// tests/frames.mjs — T0 (v1.9): the frame-evidence harness (dev-only, committed
// test, run by `node tests/frames.mjs`).
//
// A small screenshot tool built on the sanctioned dev tooling (playwright-core;
// no runtime dep for the game itself). It boots the real game over loopback on
// a FREE PORT (never 8765), drives it headless through 36 key scenes (seeded
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
import { browserPath } from '../scripts/browser.mjs';

// This file lives in <repo>/tests/, so the repo root is one level up. Resolve
// it from the script's own location (not cwd) so it works from any directory.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// T0: the baseline set goes to tests/frames/ (gitignored EXCEPT README.md).
// v1.9 polish items capture their BEFORE/AFTER evidence into per-item subdirs
// (e.g. tests/frames/after-J1/) by re-running this harness with --out. The
// frames stay gitignored; the README index + the commit message reference them.
//
// CLI (all optional, default = the 36-scene current set into tests/frames/):
//   node tests/frames.mjs [--out <dir>] [--scenes a,b,c] [--min <n>]
//   --out     output directory (resolved against the repo root if not absolute)
//   --scenes  comma-separated scene names to capture (subset; for after-sets)
//   --min     minimum non-trivial frames before "COMPLETE" (default 20 for the
//             baseline set; 0 for a small after-set that is verified by eye).
function argFlag(name) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; }
const OUT_DIR = path.resolve(ROOT, argFlag('--out') || path.join('tests', 'frames'));
const SCENE_FILTER = argFlag('--scenes') ? argFlag('--scenes').split(',').map(s => s.trim()).filter(Boolean) : null;
const MIN_FRAMES = argFlag('--min') != null ? parseInt(argFlag('--min'), 10) : 20;
const FRAMES_DIR = OUT_DIR;
const CHROME = browserPath();
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
const pageErrors = [];
page.on('pageerror', (e) => { pageErrors.push(String(e)); console.log('[page-fatal]', String(e)); });
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
  function toTitle(G) {
    G.state = 'title'; G.paused = false; G.help = false; G.optionsOpen = false;
    G.player = null; G.heron = null; G.midHeron = null; G.enemies = []; G.orbs = [];
    G._seedCard = null; G._bookOpen = false; G._atlasOpen = false;
    G.titleT = 3; G.now = 10;
  }
  // Begin a fresh seeded expedition. saveMut(save) mutates the save BEFORE the
  // run starts. Direct floor selection is a deterministic rendering fixture.
  // opts -> G.options keys; runOpts -> _beginExpedition's second arg (reeds).
  function beginRun(G, saveMut, opts, runOpts) {
    toTitle(G);
    G.options.wander = false;
    if (saveMut) saveMut(G.save);
    if (opts) for (const k in opts) G.options[k] = opts[k];
    G.challenge = null;
    G._beginExpedition(false, runOpts || {}); // deterministic: Math.random is seeded
    if (G.campaign && runOpts?.campaignFloor > 0) {
      G.campaign.cleared = ['gray', 'wyrm', 'warden'].slice(0, runOpts.campaignFloor);
      G.campaign.rewards = Array(runOpts.campaignFloor).fill('power');
    }
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
  function bossFrame(G, { flags, stats, opts, runOpts, variant, phase, surfIdx, awakened, hpFrac, arena }) {
    beginRun(G, (sv) => {
      if (flags) Object.assign(sv.flags, flags);
      if (stats) Object.assign(sv.stats, stats);
    }, opts, { ...runOpts, campaignFloor: { gray: 0, wyrm: 1, warden: 2, umbra: 3 }[variant] || 0 });
    const base = G.heron || { hue: { red: 0, blue: 0, green: 0 }, hitFlash: 0, diveH: 0, facing: -1, flying: 0, _intro: 0 };
    const w = G.world.w;
    // arena water line (SILT_WYRM/UMBRAL surfaceY); head x at the active point.
    const surfY = variant === 'umbra' ? 1240 : 780;
    const arenaX = w - 600;
    const h = Object.assign({}, base, {
      x: arenaX, y: surfY, phase: phase || 'surfaced', phaseT: 4,
      surfIdx: surfIdx != null ? surfIdx : 0, awakened: !!awakened,
      awakenedT: awakened ? 1.2 : 0, hue: { red: 0, blue: 0, green: 0 },
      hitFlash: 0, diving: false, sinking: false, _intro: 0,
    });
    if (variant === 'wyrm') { h.kind = 'wyrm'; h.wyrm = true; h.warden = h.umbra = false; }
    else if (variant === 'warden') { h.kind = 'warden'; h.warden = true; h.wyrm = h.umbra = false; h.tasteFactor = 1; }
    else if (variant === 'umbra') { h.kind = 'umbra'; h.umbra = true; h.wyrm = h.warden = false; h._transitFromX = w - 900; }
    else { h.wyrm = h.warden = h.umbra = false; }
    const maxHp = { gray: 30000, wyrm: 48000, warden: 48000, umbra: 60000 }[variant] || 30000;
    h.maxHp = maxHp; h.hp = Math.round(maxHp * (hpFrac != null ? hpFrac : 0.7));
    if (awakened) { h.awakened = true; h.awakenedT = 1.2; h.hp = Math.round(maxHp * 0.1); }
    G.heron = h;
    // frame the arena: frog to the left, camera centered on the boss.
    G.player.x = w - 900; G.player.y = surfY - 20; G.player.alive = true;
    if (variant === 'umbra') G.player.x = w - 1000;
    if (G.lanternReeds) { G.lantern.lit = true; G.lantern.fuel = 1; G._updateLantern(0, G.player); }
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
  function campFrame(G, floor, choice = null) {
    beginRun(G, null, null, { campaignFloor: floor });
    G._endRun('victory'); G._campChoice = choice;
    G.banners = []; G.now = 20;
    return { note: `campaign rest after depth ${floor + 1}${choice ? ' / reward selected' : ''}` };
  }
  S['camp-depth-one'] = G => campFrame(G, 0);
  S['camp-depth-two'] = G => campFrame(G, 1);
  S['camp-depth-three'] = G => campFrame(G, 2);
  S['camp-selected-reward'] = G => campFrame(G, 0, 'power');
  S['sketchbook-empty'] = G => {
    beginRun(G); G.save.sketchbook = []; G._openSketchbook(); G.banners = [];
    return { note: 'sketchbook keepsakes, no permanent upgrade shop' };
  };
  S['free-repainting'] = G => {
    beginRun(G); G.enemies = []; G.banners = [];
    const props = G.studio.garden.props;
    for (let i = 0; i < Math.min(8, props.length); i++) props[i].pigment = ['red', 'blue', 'green'][i % 3];
    G.cam.x = 620; G.cam.y = 750; G.now = 3;
    return { note: 'freely recolored opening scenery' };
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

  // ---- J2 (v1.9): the paint-ARC upgrade in flight (the new curve + droplets +
  //      ink landing). Stages a FRESH swipe via the real J2 methods (a curved
  //      trail ribbon, seeded pooled droplets mid-air, and the ink landing) so
  //      the frame shows the actual new rendering. Deterministic (seeded PRNG).
  //      These are the J2 after-frames: the before is the straight-ribbon
  //      paint-*.png baseline; the after shows the bow + spray + landing.
  function paintArcScene(G, pig, surf, charged) {
    beginRun(G, null, { wander: false });
    G.enemies = []; G.orbs = [];
    const p = G.player; p.pigment = pig;
    if (surf === 'water') { p.x = 900; p.y = 1250; p.aimA = -0.5; }
    else { p.x = 700; p.y = 750; p.aimA = 0.25; }
    const P = G.paint; P.trails = []; P.droplets = []; P.ink = [];
    const a = p.aimA, R = P.swipeRange;
    const x0 = p.x + Math.cos(a) * p.r, y0 = p.y + Math.sin(a) * p.r;
    const x1 = p.x + Math.cos(a) * R, y1 = p.y + Math.sin(a) * R;
    const seed = charged ? 77 : 13;
    const cx = (x0 + x1) / 2 - Math.sin(a) * R * 0.16, cy = (y0 + y1) / 2 + Math.cos(a) * R * 0.16;
    // the curved ribbon (the arc fidelity) — fresh (t = max)
    P.trails.push({ x0, y0, cx, cy, x1: x1 + Math.cos(a) * R * 0.1, y1: y1 + Math.sin(a) * R * 0.1,
      w: 18, t: 0.4, max: 0.4, pig, seed, curve: true });
    // the in-flight droplets (seeded, deterministic)
    P._spawnDroplets(seed, x0, y0, x1, y1, pig, charged ? 12 : 5, charged ? 3.2 : 2.6, 1);
    // the ink landing at the stroke's end
    P._inkLanding(x1, y1, pig, P.paintSurfaceAt(x1, y1, R * 0.7), charged);
    if (charged) {
      // the charged-slate dense inner ring + a splash wet mark
      P.trails.push({ ring: true, x: p.x, y: p.y, r: P.tuning.splashRadius * 0.72, t: 0.5, max: 0.5, pig, dense: true });
      P._addWet(p.x, p.y, 34, pig, 1.2);
    }
    P._addWet((x0 + x1) / 2, (y0 + y1) / 2, 16, pig, 1.0);
    G.cam.x = p.x; G.cam.y = p.y; G.zoom = 1; G.now = 4.5;
    return { note: `J2 paint arc: ${pig} ${charged ? 'charged splash' : 'swipe'} on ${surf}` };
  }
  S['arc-red'] = (G) => paintArcScene(G, 'red', 'soil', false);
  S['arc-blue'] = (G) => paintArcScene(G, 'blue', 'soil', false);
  S['arc-green'] = (G) => paintArcScene(G, 'green', 'soil', false);
  S['arc-water'] = (G) => paintArcScene(G, 'blue', 'water', false);
  S['arc-charged'] = (G) => paintArcScene(G, 'red', 'soil', true);

  // ---- 6 enemies ----
  S['enemy-beetle'] = (G) => { beginRun(G, null); return enemyScene(G, 'beetle', 'plain'); };
  S['enemy-mosquito'] = (G) => { beginRun(G, null); return enemyScene(G, 'mosquito', 'plain'); };
  S['enemy-toad'] = (G) => { beginRun(G, null); return enemyScene(G, 'toad', 'plain'); };
  S['enemy-wisp'] = (G) => { beginRun(G, null, null, { campaignFloor: 1 }); return enemyScene(G, 'wisp', 'plain'); };
  S['enemy-serpent'] = (G) => { beginRun(G, null, null, { campaignFloor: 1 }); return enemyScene(G, 'serpent', 'plain'); };
  S['enemy-leech'] = (G) => { beginRun(G, null, null, { campaignFloor: 1 }); return enemyScene(G, 'leech', 'plain'); };
  // status examples
  S['status-burn'] = (G) => { beginRun(G, null); return enemyScene(G, 'beetle', 'burn'); };
  S['status-freeze'] = (G) => { beginRun(G, null); return enemyScene(G, 'mosquito', 'freeze'); };
  S['status-root'] = (G) => { beginRun(G, null); return enemyScene(G, 'toad', 'root'); };

  // ---- J1 (v1.9): the paint-CONNECT impact frame (the hitstop's frozen instant) ----
  // The brush has just LANDED a red swipe on the beetle. The frame is staged AT
  // the connect instant: e.hitFlash is at its 0.14 peak (the white-hot rim +
  // body-flash are full — k=1), the swipe ribbon is mid-air, and the world is
  // the "frozen" hitstop frame. This is the J1 after-evidence: enemy-beetle.png
  // (base, hitFlash=0) -> after-J1/beetle-hitstop.png (the impact reads).
  function connectScene(G, pig, kind) {
    beginRun(G, null, { wander: false });
    const p = G.player; p.pigment = pig;
    const e = G.__modsEnemy(kind, p.x + 70, p.y - 6, G.tuning);
    e._seed = 1.3; e.dead = false;
    // the hit has JUST connected: flash at peak, body tinted with the pigment
    e.hitFlash = 0.14;                 // k=1 -> white-hot rim at the peak instant
    e.hp = e.maxHp - 7; e.status = null;
    e.tint = pig; e.tintT = 0.6;
    G.enemies = [e];
    // the brush ribbon is mid-swipe (freshest, full alpha), aimed at the beetle
    const P = G.paint; P.trails = [];
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    P.trails.push({ ring: false, x0: p.x + Math.cos(a) * 12, y0: p.y + Math.sin(a) * 12,
      x1: e.x, y1: e.y, w: 18, t: 0.4, max: 0.4, pig, seed: 0.7 });
    P._addWet(e.x - 8, e.y + 4, 14, pig, 0.9);
    // park the camera on the frog so the impact is centered + the HUD reads
    G.cam.x = p.x; G.cam.y = p.y; G.zoom = 1; G.now = 2.5;
    return { note: `J1 paint-connect hitstop: ${pig} swipe impact on ${kind} (frozen instant)` };
  }
  S['beetle-hitstop'] = (G) => connectScene(G, 'red', 'beetle');
  S['toad-hitstop'] = (G) => connectScene(G, 'blue', 'toad');

  // ---- J3 (v1.9): the KILL INK-BURST — a creature mid-dissolve, broken into
  // the ink blobs of the pigment that painted it. Staged via the REAL death
  // path (_onEnemyDead -> paint.spawnInkBurst), then the burst is stepped a
  // few frames so the blobs have spread + settled (not a static pile at the
  // exact death point). BEFORE = the matching baseline enemy-*.png (intact);
  // AFTER = after-J3/toad-kill-burst.png (the ink burst reads). The burst is
  // draw-only + pooled (P10), so stepping it never leaks particles.
  function killBurstScene(G, pig, kind) {
    beginRun(G, null, { wander: false });
    const p = G.player; p.pigment = pig;
    const e = G.__modsEnemy(kind, p.x + 74, p.y - 8, G.tuning);
    e.dead = false;
    G.enemies = [e];
    // the killing swipe lands the lethal blow: coat with the pigment + take the
    // fatal damage, then run the real death path so the burst spawns exactly as
    // it does in play (the enemy is removed from G.enemies by the call).
    e.tint = pig; e.tintT = 0.6;
    e.hp = 0; e.maxHp = e.maxHp; e.hitFlash = 0.14;
    G._onEnemyDead(e);
    // step the burst a few frames so the blobs settle + fade a touch (the
    // "mid-dissolve" instant the evidence wants, not the t=0 flash frame).
    const P = G.paint;
    for (let i = 0; i < 6; i++) P.update(1 / 60);
    // park the camera on the frog so the burst is centered + the HUD reads
    G.cam.x = p.x; G.cam.y = p.y; G.zoom = 1; G.now = 2.5;
    return { note: `J3 kill ink-burst: ${kind} dissolved into ${pig} ink (real death path)` };
  }
  S['toad-kill-burst'] = (G) => killBurstScene(G, 'red', 'toad');
  S['beetle-kill-burst'] = (G) => killBurstScene(G, 'blue', 'beetle');

  // ---- J3 (v1.9): the BOSS KILL ink-burst — a LARGER burst + the camera hold,
  // staged via the REAL defeat path (_onHeronDefeated -> spawnInkBurst x2 +
  // _bossKillHold). BEFORE = the baseline boss-gray-heron.png; AFTER shows the
  // two-burst (painted-pigment + neutral ring) breaking out of the heron.
  function bossKillScene(G) {
    const b = bossFrame(G, { variant: 'gray', hpFrac: 0.75 });
    const h = G.heron;
    // the heron is already tinted by paint (the world remembers what you
    // painted) — give it a red last-pigment so the burst takes that tint.
    h._lastPig = 'red';
    h.wyrm = h.umbra = h.warden = false;   // flying-bird branch
    h.defeated = true; h.hp = 0;
    G._onHeronDefeated();
    // the boss-kill white flash (a pre-existing v1.4 beat) would otherwise wash
    // the frame out — let it nearly fade so the INK-BURST (the J3 evidence) is
    // the thing that reads, with just a hint of the impact white still in the
    // air. (The white flash itself is v1.4 scope, not J3.)
    G._whiteFlash = 0.12;
    // step the burst a few frames so the larger blobs spread + settle (the
    // "mid-dissolve" instant the evidence wants, not the t=0 flash frame).
    const P = G.paint;
    for (let i = 0; i < 6; i++) P.update(1 / 60);
    return { note: `J3 boss kill ink-burst: heron dissolved (painted tint + neutral ring) (real defeat path)` };
  }
  S['boss-kill-burst'] = (G) => bossKillScene(G);

  // ---- J4 (v1.9): the frog's OWN LIVENESS — four draw-states (idle breathe /
  // hurt stagger / low-HP tremble / victory pose). BEFORE = the baseline idle
  // frog (the title screen / the still run-start frog); AFTER = the after-J4/
  // frames. `draw()` is a PURE function of the frog's state timers + the
  // wall-clock `now`, so each scene sets the draw-state DIRECTLY (like J1's
  // hitFlash) — no update stepping (the game loop is `_frame`, not `update`,
  // and stepping would let the world/player sim move). The camera is parked on
  // the frog so the (subtle) liveness reads centered. Draw-only — nothing here
  // moves a physics / HP / i-frame number that feeds a rule.
  function frogStateScene(G, which) {
    beginRun(G, null, { wander: false });
    const p = G.player;
    G.enemies = []; G.orbs = []; G.heron = null; G.midHeron = null;
    p.vx = 0; p.vy = 0; p.hopT = 0; p._staggerT = 0; p._victoryHopT = 0;
    // aim + park the camera on the frog (so the liveness reads centered)
    G.input.mouse.worldX = p.x + 40; G.input.mouse.worldY = p.y - 4;
    G.cam.x = p.x; G.cam.y = p.y; G.zoom = 1; G.shake = 0;
    if (which === 'idle') {
      // stand still: the IDLE BREATHE (a slow squash oscillation, OFF while
      // moving) — stage a mid-breath peak so the frog reads as LIVING, not
      // static. The breathe is a tiny squash offset layered on the relaxed ~1.0.
      p.squash = 1.02;           // the puffed peak of the breathe (a subtle squash)
      G.now = 5.0;
      return { note: 'J4 idle BREATHE — the puffed peak of a subtle squash cycle (a living frog, not a static sprite)' };
    }
    if (which === 'hurt') {
      // the HURT STAGGER — stage the wobble mid-flinch (`_staggerT` at ~0.28 of
      // its 0.4 window, so draw() computes a wobble rotation + a flinch squash).
      p._staggerT = 0.28;
      G.now = 3.3;
      return { note: 'J4 HURT STAGGER — a wobble + flinch (the frog own-reaction, over the J1 hitstop)' };
    }
    if (which === 'lowhp') {
      // LOW-HP TREMBLE — below ~30% HP: the faint tremble + the desperate
      // (narrowed) eyes + the worried brow, drawn straight from hp in draw().
      p.hp = Math.round(p.maxHp * 0.15);
      G.now = 4.7;
      return { note: 'J4 LOW-HP TREMBLE — a faint jitter + desperate eyes (below ~30% HP)' };
    }
    // 'victory' — the VICTORY POSE, staged at a mid-hop instant (`_victoryHopT`
    // at 0.6 of its 1.0 window, so the hop lift + the contented settle read).
    p._victoryHopT = 0.6;
    G.now = 6.0;
    return { note: 'J4 VICTORY POSE — a small contented hop + squash-and-settle (the moment the boss is defeated)' };
  }
  S['frog-idle-breathe'] = (G) => frogStateScene(G, 'idle');
  S['frog-hurt-stagger'] = (G) => frogStateScene(G, 'hurt');
  S['frog-low-HP'] = (G) => frogStateScene(G, 'lowhp');
  S['frog-victory-pose'] = (G) => frogStateScene(G, 'victory');

  // ---- L1 (v1.9): the ENVIRONMENTAL LIFE layer (breathing mist / ambient
  //      fireflies / drifting pollen / surface ripples). BEFORE = the baseline
  //      world scenes (swamp + reeds-descent); AFTER = after-L1/. `drawAmbient`
  //      is a PURE function of the world SEED (layout) + the wall-clock `now`
  //      (motion), so each scene parks the camera still and sets `G.now` — the
  //      mist-breathing pair differs ONLY by `now` (~2.2 s apart), proving the
  //      alpha/offset oscillation reads (the two frames md5-differ).
  function worldAmbient(G, { reeds, now, x, y }) {
    beginRun(G, null, null, { campaignFloor: reeds ? 1 : 0 });
    G.enemies = []; G.orbs = []; G.heron = null; G.midHeron = null;
    G.player.x = x; G.player.y = y; G.player.vx = 0; G.player.vy = 0; G.player.hopT = 0;
    G.player._staggerT = 0; G.player._victoryHopT = 0;
    if (reeds) { G.lantern.fuel = 1; G.lantern.lit = true; }
    G.cam.x = x; G.cam.y = y; G.zoom = 1; G.shake = 0; G.now = now;
  }
  // the MIST-BREATHING pair: the SAME world + camera, ~2.2 s apart. drawAmbient
  // is a pure f(seed, now) + the mist draw is now*mistBreath(seed,now), so the
  // two frames differ ONLY by the breathing (alpha swell + ±8 px drift) — the
  // evidence that the mist breathes (md5 differs; the pixel std shifts).
  S['world-mist-a'] = (G) => { worldAmbient(G, { reeds: false, now: 0.0, x: 900, y: 760 }); return { note: 'L1 mist-breathing pair A (now=0.0)' }; };
  S['world-mist-b'] = (G) => { worldAmbient(G, { reeds: false, now: 2.2, x: 900, y: 760 }); return { note: 'L1 mist-breathing pair B (now=2.2, ~2.2 s after A)' }; };
  // the Reeds/Black Reeds AMBIENT FIREFLY swarm (a SEPARATE small pool from the
  // lantern light-economy fireflies) + surface ripples.
  S['world-fireflies'] = (G) => { worldAmbient(G, { reeds: true, now: 3.0, x: 2000, y: 780 }); return { note: 'L1 ambient fireflies (Reeds) + ripples' }; };
  // the base-swamp DRIFTING POLLEN (leaves) + surface ripples on the water bands.
  S['world-pollen'] = (G) => { worldAmbient(G, { reeds: false, now: 5.0, x: 1500, y: 740 }); return { note: 'L1 drifting pollen (swamp) + surface ripples' }; };

  // ---- L2 (v1.9): the LIGHTING PASS (pure draw; the parked "lantern in the
  //      swamp" done as LIGHT + the charged-paint glow + the awaken halo).
  //      BEFORE = the baseline world/boss scenes; AFTER = after-L2/. The three
  //      light reads:
  //        (1) the BASE-SWAMP LIGHT POOLS — `swamp-light-pools`: a base (non-
  //            Reeds) swamp with the seeded light pools lit on the ground (the
  //            "lantern in the swamp" as pure light). drawSwampLightPools is a
  //            pure f(seed, now); the pool BREATHES, so the pair below
  //            (swamp-light-pools-b, ~1.4 s later) md5-differs on the breath.
  //        (2) the CHARGED-PAINT GLOW — `charged-paint-glow`: the frog with
  //            splashCharge at 1 (full charge) so the soft radial on the brush
  //            is at its brightest (vs the uncharged baseline paint-blue.png).
  //        (3) the AWAKEN HALO — reuses the baseline `boss-*.png` awaken scene
  //            (captured here so the after-L2 set is self-contained): the
  //            heron's Awakened state now radiates a light halo.
  function swampLightPool(G, { now, x, y }) {
    beginRun(G, null);   // base swamp (no Reeds) -> the light pools are live
    G.enemies = []; G.orbs = []; G.heron = null; G.midHeron = null;
    G.player.x = x; G.player.y = y; G.player.vx = 0; G.player.vy = 0; G.player.hopT = 0;
    G.player._staggerT = 0; G.player._victoryHopT = 0; G.player.splashCharge = 0;
    // park the camera on a region with a couple of the seeded light pools so
    // the faint ground glow reads; the pool BREATHES on now (the pair differs).
    G.cam.x = x; G.cam.y = y; G.zoom = 1; G.shake = 0; G.now = now;
  }
  S['swamp-light-pools'] = (G) => { swampLightPool(G, { now: 0.0, x: 900, y: 780 }); return { note: 'L2 base-swamp light pools (the "lantern in the swamp" as light) — pair A (now=0.0)' }; };
  S['swamp-light-pools-b'] = (G) => { swampLightPool(G, { now: 1.4, x: 900, y: 780 }); return { note: 'L2 base-swamp light pools — pair B (now=1.4, the pools breathe)' }; };
  S['charged-paint-glow'] = (G) => {
    beginRun(G, null);
    const p = G.player; p.pigment = 'blue';
    p.splashCharge = 1;                     // full charge -> the brush radial is brightest
    p.aimA = -0.5;                          // aim the brush up-right so the glow reads
    G.enemies = []; G.orbs = []; G.heron = null; G.midHeron = null;
    G.cam.x = p.x; G.cam.y = p.y; G.zoom = 1; G.shake = 0; G.now = 2.5;
    return { note: 'L2 charged-paint glow: the brush radial at full splashCharge (vs baseline paint-blue.png)' };
  };
  // the AWAKEN HALO: reuse the baseline gray-heron awaken scene so the after-L2
  // set is self-contained (the heron's Awakened state now carries a light halo).
  S['boss-gray-heron-awaken-halo'] = (G) => bossFrame(G, { variant: 'gray', awakened: true });

  // ---- L3 (v1.9): enemy liveness — one tell frame per behavior. Each spawns a
  // real enemy at a FIXED _seed (so the seeded pulse phase is deterministic),
  // then frames it at a `now` where its tell is at peak. Pure presentation —
  // the collision body (e.x/e.y) is untouched; only the rendered sprite moves.
  function l3Tell(G, kind, now, mut) {
    beginRun(G, null);   // start a real base-swamp run (so G.player exists)
    const e = G.__modsEnemy(kind, G.player.x + 120, G.player.y - 40, G.tuning);
    e._seed = 1.3; e.hitFlash = 0; e.hp = e.maxHp; e.dead = false; e.status = null;
    if (mut) mut(e);
    G.enemies = [e]; G.heron = null; G.midHeron = null; G.orbs = [];
    G.cam.x = e.x - 150; G.cam.y = e.y; G.zoom = 1.25; G.shake = 0; G.now = now;
    return { note: 'L3 ' + kind + ' tell' };
  }
  // the beetle LOWERS (crouches) — crouch peak at now≈2.48 for _seed=1.3.
  S['beetle-lowers'] = (G) => l3Tell(G, 'beetle', 2.48);
  // the toad INFLATES — body puff peak at now≈1.58 for _seed=1.3.
  S['toad-inflates'] = (G) => l3Tell(G, 'toad', 1.58);
  // the mosquito WIDENS its weave — the widen pulse peaks here AND the extra
  // horizontal sway (sin(now*7+1.3)) is at max → ~13px extra width.
  S['mosquito-weave'] = (G) => l3Tell(G, 'mosquito', 2.82);
  // a wisp DRIFTS AWAY from the lantern when lit — set _light=1 (fully lit) and
  // frame at the flee-sway peak (cos(now*1.9+1.3)≈1 at now≈1.37 for _seed=1.3).
  S['wisp-flee-from-lantern'] = (G) => {
    beginRun(G, null, null, { campaignFloor: 1 });
    const e = G.__modsEnemy('wisp', G.player.x + 120, G.player.y - 40, G.tuning);
    e._seed = 1.3; e.hitFlash = 0; e.hp = e.maxHp; e.dead = false; e.status = null;
    e._light = 1;                                  // fully lit → the flee sway is maxed
    G.enemies = [e]; G.heron = null; G.midHeron = null; G.orbs = [];
    G.lantern.lit = true; G.lantern.fuel = 1;
    G.cam.x = e.x - 150; G.cam.y = e.y; G.zoom = 1.25; G.shake = 0; G.now = 1.37;
    return { note: 'L3 wisp fleeing the lit lantern (fully lit, sway peak)' };
  };

  S['boss-gray-heron'] = (G) => bossFrame(G, { variant: 'gray', hpFrac: 0.75 });
  S['boss-gray-heron-awaken'] = (G) => bossFrame(G, { variant: 'gray', awakened: true });
  S['clearing-warning'] = G => {
    beginRun(G); G.enemies = []; G.banners = []; G._tut = [];
    G.player.x = 990; G.player.y = 730; G.cam.x = 990; G.cam.y = 730;
    G.encounter.onStroke({ kind: 'swipe', x: 990, y: 730, a: 0, range: 74, pigment: 'blue' });
    const enemy = G.encounter.members[0];
    enemy.x = 1100; enemy.y = 730; enemy.clearingPhase = 'tell'; enemy.clearingT = 0.4; enemy.clearingDX = -1; enemy.clearingDY = 0;
    G.now = 3; return { note: 'authored clearing warning and dodge direction' };
  };
  S['clearing-complete'] = G => {
    beginRun(G); G.enemies = []; G.banners = []; G._tut = [];
    G.player.x = 990; G.player.y = 730; G.cam.x = 990; G.cam.y = 730;
    G.encounter.phase = 'complete'; G.encounter.completed = true; G.encounter.round = 2;
    G.now = 3; return { note: 'completed clearing and replay invitation' };
  };
  S['boss-silt-wyrm'] = (G) => bossFrame(G, { variant: 'wyrm', phase: 'surfaced', hpFrac: 0.75 });
  S['boss-hollow-warden'] = (G) => bossFrame(G, { variant: 'warden', phase: 'mawOpen', hpFrac: 0.75 });
  S['boss-hollow-warden-awaken'] = (G) => bossFrame(G, { variant: 'warden', phase: 'mawOpen', awakened: true });
  S['boss-umbral-wyrm'] = (G) => bossFrame(G, { variant: 'umbra', phase: 'surfaced', hpFrac: 0.7 });
  S['boss-umbral-deep-dark'] = (G) => bossFrame(G, { variant: 'umbra', phase: 'surfaced', awakened: true, hpFrac: 0.3 });

  // ---- Reeds descent (lantern) / Black Reeds ----
  S['reeds-descent'] = (G) => {
    beginRun(G, null, null, { campaignFloor: 1 });
    G.enemies = []; G.orbs = [];
    G.player.x = 2000; G.player.y = 780; G.cam.x = 2000; G.cam.y = 780;
    G.lantern.fuel = 1; G.lantern.lit = true;
    G.now = 9; return { note: 'Reeds descent — lantern lit' };
  };
  S['black-reeds-descent'] = (G) => {
    beginRun(G, null, null, { campaignFloor: 3 });
    G.enemies = []; G.orbs = [];
    G.player.x = 2400; G.player.y = 800; G.cam.x = 2400; G.cam.y = 800;
    G.lantern.fuel = 0.6; G.lantern.lit = true;
    G.now = 9; return { note: 'Black Reeds, the fourth and final dungeon depth' };
  };
  S['warden-maw-open'] = (G) => {
    beginRun(G, null, null, { campaignFloor: 2 });
    // Force the Warden into its maw-open window and frame the arena.
    const w = G.world.w;
    G.heron = { kind: 'warden', warden: true, maxHp: 48000, hp: 40000,
      phase: 'mawOpen', phaseT: 5, surfIdx: 0, tasteFactor: 1, awakened: false };
    G.player.x = w - 700; G.player.y = 760; G.cam.x = w - 500; G.cam.y = 780; G.zoom = 1; G.now = 7;
    return { note: "Warden's maw open (paintable window)" };
  };

  // ---- end-screen recap ----
  S['end-recap'] = (G) => {
    beginRun(G, null, null, { campaignFloor: 3 });
    G._endRun('victory'); G.endT = 2; G.runT = 2400;
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

// Current 36-scene set. The finite dungeon replaces retired shops/prestige and
// cycle-boss variants with camp choices, free painting and the clearing. Older
// polish-specific captures remain individually selectable for visual comparison.
const BASELINE_SCENES = [
  'title', 'options', 'camp-depth-one', 'camp-depth-two',
  'camp-depth-three', 'camp-selected-reward', 'sketchbook-empty', 'free-repainting',
  'paint-red', 'paint-blue', 'paint-green', 'paint-dry', 'paint-water', 'paint-vegetation',
  'enemy-beetle', 'enemy-mosquito', 'enemy-toad', 'enemy-wisp', 'enemy-serpent', 'enemy-leech',
  'status-burn', 'status-freeze', 'status-root',
  'boss-gray-heron', 'boss-gray-heron-awaken', 'clearing-warning', 'clearing-complete',
  'boss-silt-wyrm', 'boss-hollow-warden', 'boss-hollow-warden-awaken',
  'boss-umbral-wyrm', 'boss-umbral-deep-dark',
  'reeds-descent', 'black-reeds-descent', 'warden-maw-open', 'end-recap',
];
// The known polish AFTER-scenes (registered in the in-page S map above). A
// --scenes request must name scenes that exist; validate against BASELINE + the
// polish set so a typo fails loudly rather than silently capturing 0 frames.
const POLISH_SCENES = [
  'beetle-hitstop', 'toad-hitstop',                 // J1 (v1.9)
  'arc-red', 'arc-blue', 'arc-green', 'arc-water', 'arc-charged', // J2 (v1.9)
  'toad-kill-burst', 'beetle-kill-burst', 'boss-kill-burst',      // J3 (v1.9)
  'frog-idle-breathe', 'frog-hurt-stagger', 'frog-low-HP', 'frog-victory-pose', // J4 (v1.9)
  'world-mist-a', 'world-mist-b', 'world-fireflies', 'world-pollen',          // L1 (v1.9)
  'swamp-light-pools', 'swamp-light-pools-b', 'charged-paint-glow', 'boss-gray-heron-awaken-halo', // L2 (v1.9)
  'beetle-lowers', 'toad-inflates', 'mosquito-weave', 'wisp-flee-from-lantern',                   // L3 (v1.9)
];
const KNOWN_SCENES = BASELINE_SCENES.concat(POLISH_SCENES);
if (SCENE_FILTER) {
  const bad = SCENE_FILTER.filter((n) => !KNOWN_SCENES.includes(n));
  if (bad.length) { console.log(`[frames] unknown scene(s): ${bad.join(', ')} (known: ${KNOWN_SCENES.join(', ')})`); process.exit(3); }
}
const SCENES = SCENE_FILTER ? SCENE_FILTER.filter((n) => KNOWN_SCENES.includes(n)) : BASELINE_SCENES;

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
if (pageErrors.length) { console.log('[page errors]', pageErrors.slice(0, 10)); process.exit(2); }
if (manifest.length && ok.length < Math.min(MIN_FRAMES, manifest.length)) {
  console.log(`FRAME SET INCOMPLETE (<${Math.min(MIN_FRAMES, manifest.length)} of ${manifest.length} frames non-trivial)`);
  process.exit(2);
}
const relOut = path.relative(ROOT, FRAMES_DIR);
console.log(`FRAME SET COMPLETE — ${ok.length} frames captured under ${relOut}/`);
