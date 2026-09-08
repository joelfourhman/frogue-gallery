// wandpace.mjs — D3 (v1.7) WANDER RUN PACING probe (informational, NOT a gate).
//
// Modeled on humance.mjs + reedspace.mjs. The WANDER generates ONLY the per-zone
// ENEMY ARCHETYPE MIX (z.mix / z.sig) via the pure `wanderContent(seed)`.
// Critically, the WANDER changes ONLY the z.mix-driven combat (the `_zoneBeat`
// zone encounters + their signature guardians). Everything else is SEED-INVARIANT
// (a generated run travels the SAME hand-tuned path, the background trickle comes
// from `_spawnWave` — which is driven by tuning.spawnRate/cap, NOT z.mix — and the
// boss is the same archetype):
//   * the measured cross-swamp / descent (god-mode lower bound)
//   * the background wave-fighting (seed-invariant `_spawnWave` trickle)
//   * the boss (same archetype: the gray heron first-time; the Silt Wyrm in Reeds)
// So the seed only moves the z.mix component. That is why a generated first-time
// run can stay in the 15–20 band (the z.mix band [18,30]/[4,7] is tight around the
// hand-tuned 23/6), while a Wander × Reeds run (longer 6000px descent + the 48k Silt
// Wyrm) sits in the 20–25 band.
//
// The final HUMAN estimate uses the documented seed-invariant anchors (the same
// component figures pace.mjs / reedspace.mjs report at ratio 1: first-time
// travel 38 / background 705 / heron 111 -> ~17.4 min; Reeds descent 48 /
// background 839 / Silt Wyrm 233 -> ~22.2 min) and scales ONLY the z.mix
// zone-beat by (seed total) / (hand-tuned 29). The god-mode cross + boss are ALSO
// MEASURED here (the real sim, seeded RNG) as a playability / lower-bound check,
// exactly as humance.mjs measures the cross + boss.
//
// Deterministic: the harness Math.random is a seeded stream (see tests/smoke.mjs),
// so a full run is reproducible. Seeds are FIXED (a default set; WANDER_SEEDS=...
// to override).
//
// Run:   node tests/wandpace.mjs
// Flags: WANDER_SEEDS=1,2,3  (comma list, default 8 spread seeds)
//        WANDER_VERBOSE=1    (per-seed figures)

'use strict';

// ---------------- DOM / canvas stubs (identical to the other probes) --------
const windowListeners = {};
const windowStub = {
  addEventListener(t, fn) { (windowListeners[t] ||= []).push(fn); },
  removeEventListener() {},
};
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
  const cv = {
    width: 1280, height: 800, hidden: false, style: {},
    _ctx: null,
    getContext() { if (!this._ctx) this._ctx = makeCtx(this); return this._ctx; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 800 }; },
    addEventListener(t, fn) { (this._ev || (this._ev = {}))[t] = fn; },
    removeEventListener() {},
  };
  return cv;
}
const documentStub = {
  createElement(tag) {
    if (tag === 'canvas') return makeCanvas();
    return {};
  },
  getElementById() { return null; },
};
const store = new Map();
const localStorageStub = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  get length() { return store.size; },
  key: (i) => [...store.keys()][i] ?? null,
};
let rafCb = null;
const performanceStub = { now: () => nowMs };
globalThis.window = windowStub;
globalThis.document = documentStub;
globalThis.localStorage = localStorageStub;
globalThis.performance = performanceStub;
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
globalThis.cancelAnimationFrame = () => {};
// SEEDED Math.random (the same hardening tests/smoke.mjs applies) -> the probe
// is byte-reproducible (the real-Game update path calls Math.random for wander /
// particle scatter, so without this a measurement would differ run-to-run).
(() => {
  let s = 0x9e3779b9;
  const mulberry32 = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Math.random = mulberry32;
})();

let nowMs = 0;
function frames(n, stepMs = 16.7) {
  for (let i = 0; i < n; i++) {
    nowMs += stepMs;
    if (!rafCb) throw new Error('no rAF callback registered');
    const cb = rafCb;
    rafCb = null;
    cb(nowMs);
  }
}

const { Game } = await import('../src/game.js');
const L = await import('../src/logic.js');
const { wanderContent, WANDER_BUDGET, REEDS_WIDTH } = L;

const ZONES = [
  { x: 0.24, name: 'A' }, { x: 0.44, name: 'B' },
  { x: 0.64, name: 'C' }, { x: 0.82, name: 'D' },
];
// the hand-tuned z.mix baseline (the anchor a seed scales against): 4/6/5/8 = 23
// normal + 1/2/1/2 = 6 elite = 29 enemies.
const BASE_TOTAL = 29;

const seedsRaw = (process.env.WANDER_SEEDS || '').split(',').map(s => Math.floor(Number(s.trim()) || 0)).filter(s => s > 0);
const SEEDS = seedsRaw.length >= 5 ? seedsRaw : [7, 42, 123, 999, 555, 811, 31337, 66666];
const VERBOSE = process.env.WANDER_VERBOSE === '1';

// documented seed-invariant component anchors (seconds) — the same component
// figures pace.mjs / reedspace.mjs report at the hand-tuned ratio 1. Only the
// zone-beat (z.mix) is seed-variable; the rest travel the identical path.
const ANCHORS = {
  // first-time expedition (pace.mjs: travel 38 / background 705 / heron 111 -> ~17.4)
  first: { travel: 38, background: 705, zoneBeatHand: 190, boss: 111 },
  // Wander × Reeds descent (reedspace.mjs: descent 48 / background 839 / wyrm 233 -> ~22.2).
  // background = 755 * (6000/5400) = 839 (the seed-invariant _spawnWave trickle,
  // length-scaled); zoneBeatHand = 190 * (6000/5400) = 211 (the z.mix beat, scaled).
  reeds: { travel: 48, background: 839, zoneBeatHand: 211, boss: 233 },
};
const LEN = REEDS_WIDTH / 5400;
// sanity: the anchor at ratio 1 must reproduce the documented hand-tuned figures.
const anchorFirst = (ANCHORS.first.travel + ANCHORS.first.background + ANCHORS.first.zoneBeatHand + ANCHORS.first.boss) / 60;
const anchorReeds = (ANCHORS.reeds.travel + ANCHORS.reeds.background + ANCHORS.reeds.zoneBeatHand + ANCHORS.reeds.boss) / 60;

function totalsOf(seed) {
  const lay = wanderContent(seed, ZONES);
  let normal = 0, elite = 0;
  for (const z of lay.zones) {
    const m = z.mix; normal += m.beetle + m.mosquito + m.toad; elite += z.sig.count;
  }
  return { normal, elite, total: normal + elite, ratio: (normal + elite) / BASE_TOTAL };
}
// human estimate for a seed: the seed-invariant anchors + the z.mix zone-beat
// scaled by the seed's enemy ratio (the ONLY seed-variable component).
function humanEstimate(mode, ratio) {
  const a = ANCHORS[mode];
  const secs = a.travel + a.background + a.zoneBeatHand * ratio + a.boss;
  return secs / 60;
}

// -------- MEASURE the god-mode cross + boss per mode (real sim; the lower-
// -------- bound + a playability check, exactly as humance.mjs measures). These
// are SEED-INVARIANT (z.mix does not change travel distance or the boss), so we
// measure them ONCE on a hand-tuned run per mode.
function measureCrossAndBoss(reeds) {
  const g = new Game(makeCanvas());
  g.start();
  frames(3);
  const s = g.save;
  s.flags.heronDefeated = true; s.stats.victories = 1;
  if (reeds) s.flags.reedsUnlocked = true;
  g._beginExpedition(false, { reeds });
  frames(2);
  const p = g.player;
  p.iframes = 9999;
  const arena = g.world.w - 460;
  const t0 = g.runT;
  let guard = 0;
  while (p.x < arena && guard < 60 * 900) {
    g.input.keys.add('d'); frames(1); guard++;
    if (p.hp <= 0) break;
  }
  g.input.keys.delete('d');
  const cross = g.runT - t0;
  const b0 = g.runT;
  const heron = g.heron;
  heron._intro = 0;
  frames(2);
  const cols = ['red', 'blue', 'green'];
  let ci = 0, g2 = 0;
  g.input.mouse.lDown = true;
  while (heron.hp > 0 && !heron.flying && g2 < 60 * 2400) {
    p.x = heron.x; p.y = heron.y; p.iframes = 99;
    p.pigment = cols[ci++ % 3];
    frames(1);
    g2++;
  }
  g.input.mouse.lDown = false;
  return { cross, boss: g.runT - b0, bossName: heron.wyrm ? 'Silt Wyrm' : 'gray Heron' };
}

console.log('WANDER RUN PACING probe (v1.7 D3). Seeded, deterministic (fixed RNG stream).');
console.log(`seeds (${SEEDS.length}): ${SEEDS.join(', ')}`);
console.log(`hand-tuned z.mix baseline: ${BASE_TOTAL} enemies (the anchor a seed scales against)`);
console.log(`seed-invariant anchors (documented, ratio 1): first-time ${anchorFirst.toFixed(1)} min (pace.mjs ~17.4), Reeds ${anchorReeds.toFixed(1)} min (reedspace.mjs ~22.2)`);

const mFirst = measureCrossAndBoss(false);
const mReeds = measureCrossAndBoss(true);
console.log(`\nmeasured god-mode (LOWER BOUND, real sim, seed-invariant):`);
console.log(`  expedition: cross ${mFirst.cross.toFixed(1)}s + ${mFirst.bossName} ${mFirst.boss.toFixed(1)}s`);
console.log(`  Reeds:      descent ${mReeds.cross.toFixed(1)}s + ${mReeds.bossName} ${mReeds.boss.toFixed(1)}s`);

// -------- LEG 1: first-time Wander (target 15–20) --------
const firstRes = [];
for (const seed of SEEDS) {
  const t = totalsOf(seed);
  const est = humanEstimate('first', t.ratio);
  firstRes.push({ seed, ...t, est, inBand: est >= 15 && est <= 20 });
}
const fMin = Math.min(...firstRes.map(r => r.est)), fMax = Math.max(...firstRes.map(r => r.est));
const fAll = firstRes.every(r => r.inBand);
console.log(`\n--- LEG 1: first-time Wander × expedition (target 15–20 min) ---`);
console.log(`first-time — HUMAN ESTIMATE across ${SEEDS.length} seeds: [${fMin.toFixed(1)}, ${fMax.toFixed(1)}] min (${firstRes.filter(r => r.inBand).length}/${SEEDS.length} in band)`);
for (const r of firstRes) {
  console.log(`  seed ${r.seed}  ${r.normal}n/${r.elite}e (${r.ratio.toFixed(2)}× baseline)  est ${r.est.toFixed(1)} min ${r.inBand ? '' : '<< OUT OF BAND'}`);
  if (VERBOSE) console.log(`     zone-beat ${Math.round(ANCHORS.first.zoneBeatHand * r.ratio)}s (hand-tuned ${ANCHORS.first.zoneBeatHand}s)`);
}

// -------- LEG 2: Wander × Reeds (target 20–25) --------
const reedsRes = [];
for (const seed of SEEDS) {
  const t = totalsOf(seed);
  const est = humanEstimate('reeds', t.ratio);
  reedsRes.push({ seed, ...t, est, inBand: est >= 20 && est <= 25 });
}
const rMin = Math.min(...reedsRes.map(r => r.est)), rMax = Math.max(...reedsRes.map(r => r.est));
const rAll = reedsRes.every(r => r.inBand);
console.log(`\n--- LEG 2: Wander × Reeds descent (target 20–25 min) ---`);
console.log(`Wander × Reeds — HUMAN ESTIMATE across ${SEEDS.length} seeds: [${rMin.toFixed(1)}, ${rMax.toFixed(1)}] min (${reedsRes.filter(r => r.inBand).length}/${SEEDS.length} in band)`);
for (const r of reedsRes) {
  console.log(`  seed ${r.seed}  ${r.normal}n/${r.elite}e (${r.ratio.toFixed(2)}× baseline)  est ${r.est.toFixed(1)} min ${r.inBand ? '' : '<< OUT OF BAND'}`);
}

console.log(`\nEnvelope check:`);
console.log(`  first-time: all in 15–20 min? ${fAll ? 'YES' : 'NO'}  (band [${fMin.toFixed(1)}, ${fMax.toFixed(1)}])`);
console.log(`  Wander × Reeds: all in 20–25 min? ${rAll ? 'YES' : 'NO'}  (band [${rMin.toFixed(1)}, ${rMax.toFixed(1)}])`);
if (!fAll || !rAll) {
  console.log(`  (If a seed lands out-of-band, WANDER_BUDGET is too loose — tighten it, do NOT loosen the band.)`);
  process.exitCode = 1;
}
