// Campaign regression: this probe isolates one biome/boss at base power.
// It is not the total duration of the connected four-floor dungeon.
// umbrapace.mjs — measure the REAL Umbral Wyrm fight (the 6th boss archetype,
// the Black Reeds final boss) with a pigment-cycling bot (builds red+blue+green
// hue to trigger the 2× awaken window, as a human would). Prints the fight
// time + the god-mode lower bound + the human estimate so UMBRA_WYRM.hp can be
// verified against the target 2.5–4 min human band (one tier above the Silt
// Wyrm's ~3.9 min, per the v1.8 G2 plan-of-record).
//
// The probe runs a BLACK REEDS expedition (ngCycle >= 1 + reedsVictory → the
// REEDS_DARK world, 7200px; the end boss is the Umbral Wyrm, the Black Reeds
// apex). It drives the REAL umbrStep state machine: the bot holds the brush +
// cycles red/blue/green; the game routes paint to the Umbral Wyrm ONLY while
// it is surfaced (the transit / dual-telegraph windows are invulnerable), so
// the 60k HP is a real fight (the surfaced-window gating is what makes it take
// time). God-mode (iframes + point-range) is a pure LOWER BOUND; the human
// estimate divides by a human-DPS fraction (0.42, the SAME fraction the Silt
// Wyrm / heron probes use — one methodology across every boss probe).
// Run: node tests/umbrapace.mjs
'use strict';
import './seed.mjs';
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
const { UMBRA_WYRM, SILT_WYRM } = await import('../src/logic.js');

// The Game's REAL fresh save (so bank/upgrades/loadout/owned exist —
// _beginExpedition's applyWelcomeGrant reads save.bank) with the Black Reeds
// GATE set: ngCycle >= 1 AND a Reeds victory (reedsVictory latch). This is the
// exact state a player has when reaching the final dungeon floor — so the
// _beginExpedition gate fires blackReeds=true and the end boss is the Umbral
// Wyrm (not the Silt Wyrm).
const game = new Game(makeCanvas());
game.start();
frames(3);
game._quitToTitle();
game.save.stats = { victories: 1, deaths: 0, expeditions: 0 };
game.save.flags.intro = true;
game.save.flags.heronDefeated = true;
game.save.flags.reedsUnlocked = true;
game.save.flags.reedsVictory = true;   // G1: the "a Reeds victory" gate half
// START THE BLACK REEDS EXPEDITION (the final-floor apex).
game._beginExpedition(false, { campaignFloor: 3 });
frames(2);
const umbra = game.heron;
console.log(`Black Reeds layout: ${game.world.w}px (vs ${5400}px swamp, ${SILT_WYRM ? '6000' : ''}px second-floor Reeds), blackReeds=${game.world.blackReeds}`);
console.log(`End boss: ${umbra.umbra ? 'THE UMBRAL WYRM (6th archetype, ' + (umbra.maxHp / 1000) + 'k HP)' : 'NOT-UMBRA (got kind ' + umbra.kind + ')'}`);
if (!umbra.umbra) { console.log('FATAL: the Black Reeds run did not spawn the Umbral Wyrm'); process.exit(1); }

// Drive the REAL umbrStep state machine: engage it, then hold the brush + cycle
// red/blue/green (a human paints all three hues to hit the 3-hue awaken → the
// 2× paint window). The bot holds lDown always; the game routes paint to the
// Umbral Wyrm ONLY while it is surfaced (the transit / dual-telegraph windows
// are invulnerable, so they cost the bot real time — the surfaced-window
// gating is what makes 60k HP a real fight).
umbra._intro = 0;                           // engage immediately (the arena reveal)
frames(2);
const p = game.player;
p.iframes = 9999;
const b0 = game.runT;
const cycleOrder = ['red', 'blue', 'green'];
let idx = 0, cph = 0, guard = 0, surfacedAcc = 0, deepDarkAcc = 0;
while (umbra.hp > 0 && !umbra.sinking && guard < 60 * 1800) {
  frames(1); guard++;
  if (umbra.phase === 'surfaced') surfacedAcc += 1 / 60;
  if (umbra.hp / umbra.maxHp <= UMBRA_WYRM.deepDarkPhase) deepDarkAcc += 1 / 60;
  cph += 1 / 60;
  if (cph >= 2.5) { cph = 0; idx = (idx + 1) % 3; }
  p.pigment = umbra.awakened ? 'red' : cycleOrder[idx];
  game.input.mouse.lDown = true;
  // keep brush range of the Umbral Wyrm's CURRENT position (it slithers between
  // maw points; a human repositions to its breach points + stands clear of the
  // dual maw-strike during the telegraph).
  p.x = umbra.x; p.y = umbra.y;
  p.iframes = 99;
  // GOD MODE — the lantern is held LIT (a god player always has fuel). This is
  // the pure COMBAT lower bound (like reedspace.mjs's "no lantern management"):
  // the Umbral's fuel-siphon + the "deep dark" lantern-mandatory paint gate are
  // measured end-to-end in blackpace.mjs (a real run) + the pure umbraFuelSiphon
  // / umbraPaintable rules in the smoke suite, NOT here. Holding the lantern lit
  // keeps the deep-dark boss paintable so the god-mode lower bound is the pure
  // cadence (transit/telegraph/surfaced windows) × 60k HP.
  game.lantern.fuel = 1; game.lantern.lit = true;
}
const fight = game.runT - b0;
const surfacedFrac = fight > 0 ? surfacedAcc / fight : 0;
const deepDarkFrac = fight > 0 ? deepDarkAcc / fight : 0;
console.log(`\nUMBRA WYRM — GOD MODE (point-range, iframes, 3-hue cycling bot): ${fight.toFixed(1)}s = ${(fight / 60).toFixed(2)} min`);
console.log(`  surfaced (paintable) fraction: ${(surfacedFrac * 100).toFixed(0)}%  |  "deep dark" final phase: ${(deepDarkFrac * 100).toFixed(0)}% of the fight`);
// HUMAN estimate — the SAME 0.42 human-DPS fraction every boss probe uses
// (reedspace.mjs's Silt Wyrm, bosspace.mjs's heron). A competent player:
// dodges the dual maw-strike (stands clear of both marked points during the
// telegraph), manages the lantern (the siphon eats fuel + the "deep dark" phase
// REQUIRES the lantern to be lit to keep it paintable), and repaints the 3-hue
// awaken cycle as it lapses. 0.42 of god-mode DPS is the established,
// documented human band across the suite.
const dpsFraction = 0.42;
const human = fight / dpsFraction;
console.log(`UMBRA WYRM — HUMAN ESTIMATE (competent player, ${dpsFraction} god-DPS): ~${(human / 60).toFixed(2)} min`);
console.log(`  (vs the Silt Wyrm's ~3.9 min — the Umbral is ONE TIER ABOVE: 60k HP + the dual-maw strike + the deep-dark/lantern layer)`);
console.log(`Target is 2.5–4 min (the v1.8 G2 plan-of-record human band).`);
