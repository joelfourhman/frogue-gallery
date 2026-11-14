// Campaign regression: this probe isolates one biome/boss at base power.
// It is not the total duration of the connected four-floor dungeon.
// reedspace.mjs — R6 (v1.6 Module R) REEDS RUN PACING probe (informational, NOT
// part of the assertion smoke suite). Modeled on ngpace.mjs (the NG+ pacing
// probe), which is itself modeled on humance.mjs / pace.mjs.
//
// What it estimates: how long a COMPETENT PLAYER takes to clear a BENEATH-THE-
// REEDS expedition (start -> The Silt Wyrm defeated). The Reeds biome is
// VICTORY-GATED opt-in post-victory content (a first-time player never sees it),
// so it is a DESIGNED DESCENT allowed to run PAST the first-time 15-20 min band:
// the target is ~20-25 min. This probe gives the biome a DOCUMENTED run-length
// number (recorded in PROJECT_STATE.md).
//
// Division of labor (mirrors ngpace.mjs):
//   * The cross-swamp WALK is MEASURED on the real Reeds sim (same human-like
//     burst/hesitate walk model as ngpace/humance; god-mode so the probe
//     measures PACING, not survival). The Reeds variant is DEEPER (REEDS_WIDTH
//     6000px vs 5400) and has FLOODED LOWER BANKS (ground speed x0.72 below the
//     water line) + inverted-gravity pockets, so the measured walk is longer than
//     the swamp's by design.
//   * The wave-fighting MIDDLE is carried ANALYTICALLY (not tractable as a human
//     input) — the same first-time analytic figure pace.mjs uses (755 waves +
//     160 zone beats + 30 guardians), scaled up for the Reeds' deeper layout
//     (more ground to cross = more background encounters) and the R3 bestiary
//     (three extra rare archetypes add a little fight time per encounter).
//   * THE SILT WYRM boss is MODELED analytically (bosspace-style, calibrated to
//     the MEASURED wyrm bot fight from R4: ~97s at 48k HP with the surfaced-
//     window gating) so it is stable.
//
// Run:   node tests/reedspace.mjs
// Flags: REEDS_SEED=<n>  heron/wyrm-fight seed (default 20260907)
//        REEDS_DEBUG=1   per-second trace

'use strict';
import './seed.mjs';

// ------------------------------------------------------------------ RNG
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (a >>> 7), 61 | a)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ harness
const windowListeners = {};
const windowStub = {
  addEventListener(t, fn) { (windowListeners[t] ||= []).push(fn); },
  removeEventListener() {},
};
function makeCtx(canvas) {
  const target = { canvas };
  const grad = { addColorStop() {} };
  return new Proxy(target, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => grad;
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}
function makeCanvas() {
  const cv = { width: 1280, height: 800, hidden: false, style: {}, _ctx: null,
    getContext() { if (!this._ctx) this._ctx = makeCtx(this); return this._ctx; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 800 }; },
    addEventListener() {}, removeEventListener() {} };
  return cv;
}
const store = new Map();
globalThis.window = windowStub;
globalThis.document = { createElement: (t) => (t === 'canvas' ? makeCanvas() : {}), getElementById: () => null };
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), get length() { return store.size; }, key: () => null };
let rafCb = null, nowMs = 0;
globalThis.performance = { now: () => nowMs };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
globalThis.cancelAnimationFrame = () => {};
function frames(n) { for (let i = 0; i < n; i++) { nowMs += 16.7; const cb = rafCb; rafCb = null; cb(nowMs); } }
function keydown(key) { const ev = { key, repeat: false, preventDefault() {} }; for (const fn of windowListeners['keydown'] || []) fn(ev); }
function keyup(key) { const ev = { key, repeat: false, preventDefault() {} }; for (const fn of windowListeners['keyup'] || []) fn(ev); }

const { Game } = await import('../src/game.js');
const { REEDS_WIDTH, REEDS_FLOOD_FLOOR } = await import('../src/logic.js');

// ------------------------------------------------------------------ config
// Deterministic probe: the sim's INTERNAL randomness (paint-splat radii,
// particle spawns, spawn rolls) is what made the wyrm-fight measurement
// wobble run-to-run (~97–101s) and occasionally trip the 4.0 min assertion
// boundary. The REEDS_SEED flag (documented in the header) was always
// intended to seed this — wire it here, the ngpace.mjs way: a seeded
// mulberry32 PRNG in place of Math.random for the whole probe.
const seed = parseInt(process.env.REEDS_SEED || '20260907', 10);
const rnd = mulberry32(seed);
globalThis.Math.random = rnd;
// A post-victory save (reedsUnlocked) so the Reeds entry is available. Use
// the Game's REAL fresh save (so bank/upgrades/loadout/owned exist —
// _beginExpedition's applyWelcomeGrant reads save.bank) and just flip the
// victory-gate flags, matching the ngpace.mjs pattern.
const game = new Game(makeCanvas());
game.start();
frames(3);
game._quitToTitle();
game.save.stats = { victories: 1, deaths: 0, expeditions: 0 };
game.save.flags.intro = true;
game.save.flags.heronDefeated = true;
game.save.flags.reedsUnlocked = true;
game.save.ngCycle = 0;
// START THE REEDS EXPEDITION (the victory-gated "Beneath the Reeds" entry).
game._beginExpedition(false, { reeds: true });
frames(2);
console.log(`Reeds layout: ${game.world.w}px (vs ${5400}px swamp), world-h ${game.world.h}px, flood floor y=${game.world.h - REEDS_FLOOD_FLOOR}`);
console.log(`End boss: ${game.heron.wyrm ? 'THE SILT WYRM (4th archetype, 48k HP)' : 'heron'}`);

// ---------- Phase A: the god-mode Reeds traversal (the DESCENT) ----------
// The Reeds is a DEEPER descent: the frog wades the flooded lower banks (the
// R2 flood factor slows ground movement in the low band) while the light-
// bestiary (R3) drifts through. God-mode: straight-line traversal at base move
// speed, no fighting, no lantern management (a pure LOWER BOUND on the descent
// — a real run is slower: the lantern is a real layer, the bestiary must be
// dealt with, and the flood slows the low ground).
const X0 = 260;
const wyrmArena = game.world.w - 460;   // the wyrm engages in the arena (end)
const p = game.player;
p.iframes = 9999;
let guard = 0;
// Hold movement intent as well as the idealized starting velocity. Without
// input the previous probe measured braking on every frame, so changing stop
// response incorrectly changed its traversal and subsequent boss setup.
game.input.keys.add('d');
while (p.x < wyrmArena && guard < 60 * 300) {
  p.vx = 230; p.vy = 0;               // base move speed (tuning.speed) rightward
  frames(1); guard++;
}
game.input.keys.delete('d');
const travelGod = game.runT;
console.log(`\nA) god-mode Reeds descent (260 -> ${Math.min(p.x, wyrmArena).toFixed(0)}px, the arena): ${travelGod.toFixed(1)}s (LOWER BOUND — no bestiary fighting, lantern, or flood slowdown applied to movement; a real descent is slower)`);

// ---------- Phase B: the wyrm fight (god-mode, pigment-cycling bot) ----------
// Drive the real wyrm state machine: engage it, then hold the brush + cycle
// red/blue/green (a human paints all three hues to hit the 3-hue awaken).
// The bot holds lDown always; the game routes paint to the wyrm ONLY while it
// is surfaced (the underground windows are invulnerable, so they cost the bot
// real time — the surfaced-window gating is what makes 48k HP a real fight).
const wyrm = game.heron;
wyrm._intro = 0;                           // engage immediately (the arena reveal)
frames(2);
const b0 = game.runT;
const cycleOrder = ['red', 'blue', 'green'];
let idx = 0, cph = 0;
guard = 0;
while (wyrm.hp > 0 && !wyrm.sinking && guard < 60 * 1200) {
  frames(1); guard++;
  cph += 1 / 60;
  if (cph >= 2.5) { cph = 0; idx = (idx + 1) % 3; }
  // Cycle hues to awaken the guardian, then use red during the damage window.
  p.pigment = wyrm.awakened ? 'red' : cycleOrder[idx];
  game.input.mouse.lDown = true;
  // keep brush range of the wyrm's CURRENT position (it slithers between
  // surface points; a human repositions to its breach points).
  p.x = wyrm.x; p.y = wyrm.y;
  p.iframes = 99;
}
const wyrmGod = game.runT - b0;
console.log(`B) the Silt Wyrm (hp ${wyrm.maxHp}, 3-hue cycling bot, point-range, lDown always — the surfaced windows gate the paint): ${wyrmGod.toFixed(1)}s = ${(wyrmGod / 60).toFixed(2)} min (god-mode)`);

// ---------- Phase C: the HUMAN Reeds estimate (the documented run-length) ----
// A competent player: ~55% avg move speed through a DEEPER flooded descent
// (the flood slows the low ground + the light-bestiary must be dealt with + the
// lantern is a real layer — so a ~15% slowdown vs the open-sweep god lower-
// bound), zone beats (the Reeds is deeper with the light-bestiary → ~45s each),
// signature guardians, background waves (denser: the 3 light-bestiary creatures
// are rare picks that draw attention), and the wyrm boss at a human DPS
// fraction (range + dodging the breach-strike + pigment management).
const dpsFraction = 0.42;                  // human effective paint-DPS vs god-mode (same as the heron probe)
const wyrmHuman = wyrmGod / dpsFraction;    // the wyrm fight, human
const avgMoveFrac = 0.55;
const floodPenalty = 1.15;                  // the Reeds descent is a deeper, flooded, light-lit wade
const travelHuman = (wyrmArena - X0) / (230 * avgMoveFrac) * floodPenalty;
// background waves: scale the SWAMP probe's measured wave count (pace.mjs
// 755 + 160 + 30 = ~945s of fighting at 5s/enemy, ~189 enemies) by the Reeds
// length ratio (6000/5400 = 1.11) — the biome is longer but NOT meaningfully
// denser (the 3 light-bestiary creatures are rare picks within the same spawn
// budget). Same 5s/enemy figure the swamp probes use.
const WAVES_SWAMP = (755 + 160 + 30);           // pace.mjs analytic (background + zone + guardians)
const background = WAVES_SWAMP * (REEDS_WIDTH / 5400);
const humanTotal = travelHuman + wyrmHuman + background;

console.log(`\nREEDS RUN — LOWER BOUND (god-mode descent + god wyrm): ${(travelGod + wyrmGod).toFixed(0)}s = ${((travelGod + wyrmGod) / 60).toFixed(1)} min`);
console.log(`REEDS RUN — HUMAN ESTIMATE (competent player): ~${(humanTotal / 60).toFixed(1)} min`);
console.log(`  descent (55% avg speed + flooded/lit penalty ×1.15): ${travelHuman.toFixed(0)}s`);
console.log(`  wave-fighting (ANALYTIC, pace.mjs swamp waves × ${REEDS_WIDTH / 5400} length): ${background.toFixed(0)}s = ${(background / 60).toFixed(1)} min`);
console.log(`  the Silt Wyrm (48k hp, human DPS): ~${wyrmHuman.toFixed(0)}s = ${(wyrmHuman / 60).toFixed(1)} min`);
console.log(`Target is ~20–25 min — a DESIGNED DESCENT (the second dungeon floor, isolated at base power).`);
console.log(`Note: this measures ONLY the second floor; run-only choices may improve real campaign time.`);

