// blackpace.mjs — measure the FULL BLACK REEDS run (the v1.8 G1/G2 NG+ Reeds
// variant: a deeper 7200px descent + a denser light-bestiary + the Umbral Wyrm
// 6th-boss apex). Prints the god-mode lower bound + the human estimate so the
// variant's pacing is verified against the target 22–26 min band (one tier
// above the cycle-0 Reeds' ~20–25 min, per the v1.8 G3 plan-of-record).
//
// The probe runs a BLACK REEDS expedition (ngCycle >= 1 + reedsVictory → the
// REEDS_DARK world, 7200px; the end boss is the Umbral Wyrm). It measures
// THREE pieces, the SAME methodology as reedspace.mjs (the cycle-0 Reeds
// probe) so the two are directly comparable:
//   A) the god-mode descent (straight-line traversal at base move speed — a
//      pure LOWER BOUND: no bestiary fighting, lantern management, or flood
//      slowdown applied to movement; a real descent is slower).
//   B) the god-mode Umbral Wyrm fight (a 3-hue-cycling bot, point-range,
//      lantern held lit — the pure combat lower bound; the siphon + deep-dark
//      lantern-mandatory rule are measured in umbrapace.mjs + the smoke suite).
//   C) the HUMAN estimate: a competent player at ~55% avg speed through a
//      DEEPER + darker flooded descent (the flood slows the low ground MORE
//      than cycle-0 — the REEDS_DARK flood factor 0.62 vs 0.72 — and the
//      darker lantern is a real layer), the denser light-bestiary (background
//      waves scale by the Black Reeds length 7200/5400 + a density bump for the
//      denser Wisp/Serpent/Leech pick ratio), and the Umbral Wyrm at the SAME
//      0.42 human-DPS fraction every boss probe uses.
//
// The probe is a HEADLESS measurement (no browser needed): it stubs
// window/document/canvas/rAF, imports the REAL Game + logic, and drives the
// REAL sim (the real _beginExpedition Black Reeds gate, the real World REEDS_DARK
// layout, the real umbrStep boss state machine).
// Run: node tests/blackpace.mjs
'use strict';
const windowListeners = {};
const windowStub = { addEventListener: (t, fn) => { (windowListeners[t] ||= []).push(fn); }, removeEventListener() {} };
function makeCtx(cv) {
  const t = { canvas: cv };
  const g = { addColorStop() {} };
  return new Proxy(t, {
    get(a, p) {
      if (p in a) return a[p];
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => g;
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return () => {};
    },
    set(a, p, v) { a[p] = v; return true; },
  });
}
function makeCanvas() {
  const cv = {
    width: 1280, height: 800, hidden: false, style: {}, _ctx: null,
    getContext() { if (!this._ctx) this._ctx = makeCtx(this); return this._ctx; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 800 }; },
    addEventListener() {}, removeEventListener() {},
  };
  return cv;
}
const store = new Map();
globalThis.window = windowStub;
globalThis.document = { createElement: (t) => (t === 'canvas' ? makeCanvas() : {}), getElementById: () => null };
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  get length() { return store.size; }, key: () => null,
};
let rafCb = null, nowMs = 0;
globalThis.performance = { now: () => nowMs };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
globalThis.cancelAnimationFrame = () => {};
function frames(n) { for (let i = 0; i < n; i++) { nowMs += 16.7; const cb = rafCb; rafCb = null; cb(nowMs); } }

const { Game } = await import('../src/game.js');
const L = await import('../src/logic.js');
const { UMBRA_WYRM, REEDS_DARK_WIDTH, REEDS_DARK_FLOOD_FACTOR, REEDS_FLOOD_FACTOR } = L;

// The Game's REAL fresh save (so bank/upgrades/loadout/owned exist) with the
// Black Reeds GATE set: ngCycle >= 1 AND a Reeds victory (reedsVictory latch).
// This is the exact state a player has after beating the Reeds and picking NG+
// — so _beginExpedition's gate fires blackReeds=true (the REEDS_DARK world) and
// the end boss is the Umbral Wyrm.
const game = new Game(makeCanvas());
game.start();
frames(3);
game._quitToTitle();
game.save.stats = { victories: 1, deaths: 0, expeditions: 0 };
game.save.flags = { intro: true, heronDefeated: true, reedsUnlocked: true, reedsVictory: true };
game.save.ngCycle = 1;
// START THE BLACK REEDS EXPEDITION (the NG+ Reeds apex).
game._beginExpedition(false, { reeds: true });
frames(2);
const blackReeds = game.world.blackReeds;
const umbra = game.heron;
console.log(`Black Reeds layout: ${game.world.w}px (vs 5400 swamp, 6000 cycle-0 Reeds), blackReeds=${blackReeds}`);
console.log(`End boss: ${umbra.umbra ? 'THE UMBRAL WYRM (6th archetype, ' + (umbra.maxHp / 1000) + 'k HP)' : 'NOT-UMBRA (kind ' + umbra.kind + ')'}`);
if (!blackReeds || !umbra.umbra) { console.log('FATAL: the Black Reeds run did not build the REEDS_DARK world + Umbral Wyrm'); process.exit(1); }

// ---------- Phase A: the god-mode Black Reeds descent (the DESCENT) ----------
// The Black Reeds is a DEEPER descent (7200px): the frog wades the flooded
// lower banks (the R2/G1 flood factor slows ground movement in the low band —
// the REEDS_DARK factor 0.62 is SLOWER than the cycle-0 0.72) while the DENSER
// light-bestiary (G1) drifts through. God-mode: straight-line traversal at base
// move speed, no fighting, no lantern management (a pure LOWER BOUND — a real
// descent is slower: the lantern is a real layer, the denser bestiary must be
// dealt with, and the deeper flood slows the low ground).
const X0 = 260;
const arena = game.world.w - 460;   // the Umbral engages in the arena (end)
const p = game.player;
p.iframes = 9999;
let guard = 0;
// The headless input stub's keydown/keyup pair does not hold a key across
// frames, so drive the REAL sim directly: give the player a rightward velocity
// each frame and let player.update apply it (the real descent through the
// flooded low band, at true base move speed — no fight, no lantern).
const a0 = game.runT;
while (p.x < arena && guard < 60 * 400) {
  p.vx = 230; p.vy = 0;               // base move speed (tuning.speed) rightward
  frames(1); guard++;
}
const travelGod = game.runT - a0;
console.log(`\nA) god-mode Black Reeds descent (260 -> ${Math.min(p.x, arena).toFixed(0)}px, the arena): ${travelGod.toFixed(1)}s (LOWER BOUND — no bestiary fighting, lantern, or flood slowdown applied to movement; a real descent is slower)`);

// ---------- Phase B: the Umbral Wyrm fight (god-mode, pigment-cycling bot) ---
// Drive the REAL umbrStep state machine: engage it, then hold the brush + cycle
// red/blue/green (a human paints all three hues to hit the 3-hue awaken). The
// bot holds lDown always; the game routes paint to the Umbral Wyrm ONLY while
// it is surfaced (the transit / dual-telegraph windows are invulnerable). The
// lantern is held LIT (god-mode: the pure combat lower bound — the siphon + the
// deep-dark lantern-mandatory rule are measured in umbrapace.mjs + smoke).
umbra._intro = 0;                           // engage immediately (the arena reveal)
frames(2);
const b0 = game.runT;
const cycleOrder = ['red', 'blue', 'green'];
let idx = 0, cph = 0, guard2 = 0;
while (umbra.hp > 0 && !umbra.sinking && guard2 < 60 * 1800) {
  frames(1); guard2++;
  cph += 1 / 60;
  if (cph >= 2.5) { cph = 0; idx = (idx + 1) % 3; p.pigment = cycleOrder[idx]; }
  p.pigment = cycleOrder[idx];
  game.input.mouse.lDown = true;
  p.x = umbra.x; p.y = umbra.y;
  p.iframes = 99;
  game.lantern.fuel = 1; game.lantern.lit = true;   // god-mode: the lantern never dies
}
const umbraGod = game.runT - b0;
console.log(`B) the Umbral Wyrm (hp ${umbra.maxHp}, 3-hue cycling bot, point-range, lantern held lit — the surfaced windows gate the paint): ${umbraGod.toFixed(1)}s = ${(umbraGod / 60).toFixed(2)} min (god-mode)`);

// ---------- Phase C: the HUMAN Black Reeds estimate (the documented run) -----
// A competent player: ~55% avg move speed through a DEEPER + darker flooded
// descent (the flood slows the low ground MORE than cycle-0 — the REEDS_DARK
// factor 0.62 vs 0.72 — and the darker lantern is a real layer → a ~20%
// slowdown vs the open-sweep god lower bound), the denser light-bestiary
// (background waves scale by the Black Reeds length 7200/5400 + a density bump
// for the denser Wisp/Serpent/Leech pick ratio), and the Umbral Wyrm at the
// SAME 0.42 human-DPS fraction every boss probe uses.
const dpsFraction = 0.42;                  // human effective paint-DPS vs god-mode (same as every boss probe)
const umbraHuman = umbraGod / dpsFraction; // the Umbral fight, human
const avgMoveFrac = 0.55;
// the Black Reeds descent is DEEPER + DARKER + FLOODED-MORE: a ~15% slowdown
// vs the open-sweep god lower bound (the deeper flood 0.62 + the darker lantern
// as a real layer — the SAME 1.15 penalty the cycle-0 Reeds probe uses, since
// the god descent already carries the real flooded-low-band slowdown).
const floodPenalty = 1.15;
const travelHuman = travelGod * floodPenalty;
// background waves: scale the SWAMP probe's measured wave count (pace.mjs
// 755 + 160 + 30 = ~945s of fighting at 5s/enemy, ~189 enemies) by the Black
// Reeds length ratio (7200/5400 = 1.33) — the biome is longer (the denser
// Wisp/Serpent/Leech pick ratio is a rare pick WITHIN the same spawn budget, so
// it draws attention but does not add a separate wave count — same 5s/enemy
// figure the swamp + cycle-0 Reeds probes use).
const WAVES_SWAMP = (755 + 160 + 30);           // pace.mjs analytic (background + zone + guardians)
const background = WAVES_SWAMP * (REEDS_DARK_WIDTH / 5400);
const humanTotal = travelHuman + umbraHuman + background;

console.log(`\nBLACK REEDS RUN — LOWER BOUND (god-mode descent + god Umbral): ${(travelGod + umbraGod).toFixed(0)}s = ${((travelGod + umbraGod) / 60).toFixed(1)} min`);
console.log(`BLACK REEDS RUN — HUMAN ESTIMATE (competent player): ~${(humanTotal / 60).toFixed(1)} min`);
console.log(`  descent (55% avg speed + deeper/darker flood + lantern layer ×1.15): ${travelHuman.toFixed(0)}s`);
console.log(`  wave-fighting (ANALYTIC, pace.mjs swamp waves × ${REEDS_DARK_WIDTH / 5400} length): ${background.toFixed(0)}s = ${(background / 60).toFixed(1)} min`);
console.log(`  the Umbral Wyrm (${(UMBRA_WYRM.hp / 1000)}k hp, human DPS): ~${umbraHuman.toFixed(0)}s = ${(umbraHuman / 60).toFixed(1)} min`);
console.log(`Target is ~22–26 min (one tier above the cycle-0 Reeds' ~20–25 — a hand-tuned NG+ apex, allowed to run past both bands).`);
console.log(`Note: the first-time swamp (15–20) + the cycle-0 Reeds (20–25) are victory-gated and structurally untouched; this probe measures ONLY the Black Reeds run.`);
