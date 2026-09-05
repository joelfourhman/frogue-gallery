// pace.mjs — headless LOWER-BOUND pacing probe (not part of the assertion suite).
// Simulates an ideal player: sprints the full swamp width, then paints the
// heron continuously from point-blank. Real players are slower (dodging,
// learning, wandering, missed swipes), so this is a floor on run length.
// Run: node tests/pace.mjs
'use strict';
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
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      t._fns++;
      return () => {};
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}
function makeCanvas() {
  const cv = {
    width: 1280, height: 800, hidden: false, style: {}, _ctx: null,
    getContext() { if (!this._ctx) this._ctx = makeCtx(this); return this._ctx; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 800 }; },
    addEventListener(t, fn) { (this._ev || (this._ev = {}))[t] = fn; },
    removeEventListener() {},
  };
  return cv;
}
const store = new Map();
const localStorageStub = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  get length() { return store.size; },
  key: (i) => [...store.keys()][i] ?? null,
};

let rafCb = null;
let nowMs = 0;
globalThis.window = windowStub;
globalThis.document = { createElement: (t) => (t === 'canvas' ? makeCanvas() : {}), getElementById: () => null };
globalThis.localStorage = localStorageStub;
globalThis.performance = { now: () => nowMs };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
globalThis.cancelAnimationFrame = () => {};

function frames(n) {
  for (let i = 0; i < n; i++) {
    nowMs += 16.7;
    const cb = rafCb; rafCb = null;
    cb(nowMs);
  }
}
function keydown(key) {
  const ev = { key, repeat: false, preventDefault() {} };
  for (const fn of windowListeners['keydown'] || []) fn(ev); // held down (no keyup)
}
function keyup(key) {
  const ev = { key, repeat: false, preventDefault() {} };
  for (const fn of windowListeners['keyup'] || []) fn(ev);
}

const { Game } = await import('../src/game.js');
const canvas = makeCanvas();
const game = new Game(canvas);
game.start();
frames(5);
game._beginExpedition();
frames(2);
game.player.iframes = 9999; // god-mode: measuring movement + painting, not combat
game.heron._intro = 0;      // heron live immediately

const W = game.world.w;
const HX = game.heron.x;
console.log(`world width ${W}px, heron at x=${HX}, player start x=${game.player.x}`);

// ---------- Phase A: sprint straight across ----------
keydown('d'); // hold right
const t0 = game.runT;
let guard = 0;
while (game.player.x < HX - 70 && game.player.alive && guard < 60 * 900) {
  frames(1); guard++;
}
keyup('d');
const travelT = game.runT - t0;
console.log(`A) sprint ${HX - game.player.x < 90 ? (HX - 260) : ''} px: ${travelT.toFixed(1)}s`);
if (!game.player.alive) console.log('   (player died — obstacles/enemies on the straight line; real players detour)');

// ---------- Phase B: paint the heron from point-blank ----------
game.player.x = HX - 50;
game.player.y = game.heron.y - 30;
function aim() {
  const v = game._view();
  game.input.mouse.x = (game.heron.x - v.x) * v.scale;
  game.input.mouse.y = (game.heron.y - 100 - v.y) * v.scale;
  game.input.update();
}
aim();
game.input.mouse.lDown = true;
const b0 = game.runT;
guard = 0;
while (game.heron.hp > 0 && !game.heron.flying && guard < 60 * 600) {
  frames(1); guard++;
  aim();
  // keep point-blank range as the heron repositions
  game.player.x = game.heron.x - 50;
  game.player.y = game.heron.y - 30;
  game.player.iframes = 99;
}
const bossT = game.runT - b0;
console.log(`B) heron (hp ${game.tuning.bossMaxHp}): ${bossT.toFixed(1)}s of continuous point-blank painting`);

// ---------- Phase C: realistic boss (normal swipe range, no god-mode) ----------
// A competent player fights the heron from brush range (not point-blank), takes
// hits, and spends time dodging. Model: effective paint-DPS fraction vs god-mode.
const bossGod = bossT;                 // point-blank, god-mode, perfect aim
const dpsFraction = 0.42;              // human: range + misses + dodging + pigment mgmt
const bossHuman = bossGod / dpsFraction;
const avgMoveFrac = 0.55;              // humans average ~55% of max move speed (stops, detours)
const travelHuman = (HX - 260) / (230 * avgMoveFrac);
// encounters: named zone beats (P5) + background spawn waves
const zoneCombat = 4 * 40;               // 4 zones × ~40s of fight+reposition for a competent player
const enemyWaves = Math.floor((travelHuman + zoneCombat + bossHuman) / 2.4);
const background = enemyWaves * 5;        // ~5s of extra attention per background wave
const humanTotal = travelHuman + zoneCombat + background + bossHuman;

console.log(`\nLOWER-BOUND (ideal player, god-mode): ${game.runT.toFixed(0)}s = ${(game.runT / 60).toFixed(1)} min`);
console.log(`HUMAN ESTIMATE (competent player): ~${(humanTotal / 60).toFixed(1)} min`);
console.log(`  travel (55% avg speed): ${travelHuman.toFixed(0)}s`);
console.log(`  zone beats (4 named encounters): ~${zoneCombat}s`);
console.log(`  background waves (~${enemyWaves}): ~${background}s`);
console.log(`  heron boss (${game.tuning.bossMaxHp} hp, human DPS): ~${bossHuman.toFixed(0)}s = ${(bossHuman / 60).toFixed(1)} min`);
console.log(`Target is 15–20 min. First runs run longer (learning curve) — see note below.`);