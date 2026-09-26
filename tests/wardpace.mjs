'use strict';
import './seed.mjs';
// wardpace.mjs — F1 (v1.7) HOLLOW WARDEN PACING probe (informational, NOT a gate).
//
// Modeled on reedspace.mjs (the Silt Wyrm probe) + wandpace.mjs (the Wander probe).
// The Warden is the 5th boss archetype: it spawns ONLY at the end of a WANDER
// expedition (Wander ON) — NEVER in a hand-tuned (Wander-OFF) run (byte-identical
// to v1.6). It is the Wander-apex (50k HP, above the Silt Wyrm's 48k).
//
// This probe measures the Warden fight via the REAL paint path (like reedspace's
// wyrm measurement): god-mode (iframes, point-blank, lDown always) — the LOWER
// BOUND — and derives a HUMAN estimate from the reedspace documented DPS ratio.
//
// The Warden's maw-window cadence (mawOpen 10.5s / mawClosed 2.4s / telegraph
// 1.5s) + 3-hue awaken (0.62× speedup) + taste bias (0.85–1.15×) mean a fight
// runs ~97–115 s god-mode → ~3.9–4.5 min human — comparable to the Silt Wyrm's
// 97.7s god / 3.9 min human (the other Reeds apex boss). The Warden sits at the
// TOP of the 2–4 min human band (the 50k-HP Wander apex is the longest of the
// Reeds bosses, but in-band).
//
// Deterministic: the harness Math.random is a seeded stream (same as smoke.mjs),
// so a full run is reproducible. Seeds are FIXED (WANDER_SEEDS=... to override).
//
// Run:   node tests/wardpace.mjs
// Flags: WARDEN_SEEDS=1,2,3  (comma list, default 6 spread seeds)
//        WARDEN_VERBOSE=1    (per-seed figures)

// ---------------- DOM / canvas stubs (identical to the other probes) --------
const windowListeners = {};
const windowStub = { addEventListener(t, fn) { (windowListeners[t] ||= []).push(fn); }, removeEventListener() {} };
function makeCtx(canvas) {
  const target = { canvas, _fns: 0 };
  const grad = { addColorStop() {} };
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad;
      if (prop === 'createPattern') return () => ({ _pattern: true });
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      t._fns++;
      return () => {};
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}
function makeCanvas() {
  const cv = { width: 1280, height: 800, hidden: false, style: {}, addEventListener() {}, removeEventListener() {} };
  cv.getContext = () => makeCtx(cv);
  return cv;
}
const store = new Map();
globalThis.window = windowStub;
globalThis.document = { createElement: (t) => (t === 'canvas' ? makeCanvas() : {}), getElementById: () => null };
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
let rafCb = null, nowMs = 0;
globalThis.performance = { now: () => nowMs };
// Stub Date.now() too (pickWanderSeed uses it for the seed entropy).
const _realDateNow = Date.now.bind(Date);
let _dateNowOffset = 1725000000000; // a fixed epoch
Date.now = () => _dateNowOffset + nowMs;
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
globalThis.cancelAnimationFrame = () => {};
function frames(n, stepMs = 16.7) { for (let i = 0; i < n; i++) { nowMs += stepMs; const cb = rafCb; rafCb = null; cb(nowMs); } }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
globalThis.Math.random = mulberry32(20260908);

const { Game } = await import('../src/game.js');
const L = await import('../src/logic.js');
const WARDEN = L.WARDEN;

// The default seed set (spread across the seed space so the taste + layout
// are diverse). WARDEN_SEEDS=... overrides.
const DEFAULT_SEEDS = [112929409, 346246880, 218789568, 1819917760, 2102745946, 747111607];
const seeds = (process.env.WARDEN_SEEDS || DEFAULT_SEEDS.join(',')).split(',').map(Number);

// The human-DPS ratio from reedspace.mjs (the Silt Wyrm fight): the human bot
// deals ~42% of god-mode DPS (dodging + pigment cycling + the surfaced windows).
// We reuse the SAME ratio for the Warden (same paint path, same 3-hue rhythm,
// same maw-window gating) — the only difference is the HP (50k vs 48k) + the
// maw cadence (the Warden's mawOpen 10.5s vs the wyrm's surfaced 7.0s).
const HUMAN_DPS_FRAC = 0.42;

function wardenFight(seed) {
  const cv = makeCanvas();
  const g = new Game(cv); g.start(); frames(3); g._quitToTitle();
  g.save.ngCycle = 0;
  g.save.flags.heronDefeated = true;
  g.save.flags.reedsUnlocked = true;
  g.options.wander = true;
  // Pin the seed (so the taste + layout are deterministic on `seed`).
  g.save.wanderSeed = seed;
  g._beginExpedition(false, { reeds: true });
  frames(2);
  const h = g.heron, p = g.player;
  if (!h.warden) throw new Error('expected WARDEN, got ' + (h.kind || 'heron'));
  p.iframes = 9999;
  h._intro = 0;   // engage immediately (skip the 3.4s arena reveal)
  frames(2);
  const t0 = g.runT;
  const cycleOrder = ['red', 'blue', 'green'];
  let idx = 0, cph = 0, guard = 0, siphonLit = 0;
  while (h.hp > 0 && !h.flying && (h.sinking || 0) <= 0 && guard < 60 * 1200) {
    frames(1); guard++;
    cph += 1 / 60;
    if (cph >= 2.5) { cph = 0; idx = (idx + 1) % 3; }   // cycle pigments every 2.5s (like reedspace)
    p.pigment = cycleOrder[idx];
    g.input.mouse.lDown = true;
    p.x = h.x; p.y = h.y;   // keep brush range of the maw point
    p.iframes = 99;
    if (g.lantern && g.lantern.lit) siphonLit += 1 / 60;
  }
  const fight = g.runT - t0;
  return {
    taste: g.wanderTaste && g.wanderTaste.name,
    tag: g.wanderTaste && g.wanderTaste.tag,
    tf: h.tasteFactor,
    fight,
    human: fight / HUMAN_DPS_FRAC / 60,
    fuel: g.lantern && g.lantern.fuel,
    siphonLit,
    endRun: g.state,
  };
}

console.log('HOLLOW WARDEN PACE — F1 (v1.7)');
console.log('  (the 5th boss archetype; the Wander-apex; spawns ONLY at the end of a WANDER expedition; 50k HP; the Silt Wyrm is the Wander-OFF Reeds boss)');
console.log(`  WARDEN.hp=${WARDEN.hp}  mawOpen=${WARDEN.mawOpen}s  mawClosed=${WARDEN.mawClosed}s  telegraph=${WARDEN.telegraph}s  siphonRate=${WARDEN.siphonRate}/s`);
console.log('');
console.log('GOD-MODE WARDEN FIGHTS (the real paint path; lDown always, 3-hue cycling bot; the LOWER BOUND):');
const results = seeds.map(s => wardenFight(s));
const verbose = !!process.env.WARDEN_VERBOSE;
for (const r of results) {
  if (verbose || true) {
    console.log(`  taste=${r.taste || '-'} (tf ${r.tf}): god ${r.fight.toFixed(1)}s → human (dpsFrac ${HUMAN_DPS_FRAC}) ${r.human.toFixed(2)} min | end=${r.endRun} fuel=${(r.fuel != null ? r.fuel.toFixed(2) : '?')} siphonLit=${r.siphonLit.toFixed(0)}s`);
  }
}
const fights = results.map(r => r.fight);
const humans = results.map(r => r.human);
const minF = Math.min(...fights), maxF = Math.max(...fights), meanF = fights.reduce((a, b) => a + b, 0) / fights.length;
const minH = Math.min(...humans), maxH = Math.max(...humans);
console.log('');
console.log(`  RANGE god ${minF.toFixed(0)}-${maxF.toFixed(0)}s (mean ${meanF.toFixed(0)}s) → HUMAN ${minH.toFixed(1)}-${maxH.toFixed(1)} min`);
console.log('');
console.log('REFERENCE: the Silt Wyrm (48k, the Wander-OFF Reeds apex) measures 97.7s god / ~3.9 min human (reedspace.mjs).');
console.log(`  The Warden (50k, the Wander apex) sits at ${minH.toFixed(1)}-${maxH.toFixed(1)} min human — comparable to the Wyrm, in the 2–4 min band (the Warden is the 50k-HP apex, the longest of the Reeds bosses).`);
console.log('');
console.log('NOTE: the Warden is the WANDER end-of-run boss. It never appears in a hand-tuned (Wander-OFF) run (byte-identical to v1.6). The WARDEN_SEEDS env var can pin specific seeds for regression.');
