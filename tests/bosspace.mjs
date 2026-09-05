// bosspace.mjs — measure the REAL heron fight duration with a pigment-cycling
// bot (builds red+blue+green hue to trigger the 2× awaken window, as a human
// would). Prints the fight time so bossMaxHp can be set for target pacing.
'use strict';
const windowListeners = {};
const windowStub = { addEventListener(t, fn) { (windowListeners[t] ||= []).push(fn); }, removeEventListener() {} };
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

const { Game } = await import('../src/game.js');
const game = new Game(makeCanvas());
game.start();
frames(5);
game._beginExpedition();
frames(2);
game.heron._intro = 0;
const p = game.player, h = game.heron;
p.iframes = 9999;
p.x = h.x - 50; p.y = h.y - 40;

// pigment cycling: spend ~2.5s per hue to build it to the awaken threshold,
// then burst through the 2× window. Mirrors how a human would actually fight it.
const need = game.tuning.bossAwakenNeed;
const cycleOrder = ['red', 'blue', 'green'];
let idx = 0, phaseT = 0;
const t0 = game.runT;
let guard = 0;
function aim() { const v = game._view(); game.input.mouse.x = (h.x - v.x) * v.scale; game.input.mouse.y = (h.y - 100 - v.y) * v.scale; game.input.update(); }
while (h.hp > 0 && !h.flying && guard < 60 * 900) {
  frames(1); guard++;
  aim();
  phaseT += 1 / 60;
  // switch pigment roughly every 2.5s (human-like cycling)
  if (phaseT >= 2.5) { phaseT = 0; idx = (idx + 1) % 3; p.pigment = cycleOrder[idx]; }
  game.input.mouse.lDown = true;
  // keep point-blank range
  p.x = h.x - 50; p.y = h.y - 40; p.iframes = 99;
}
const fight = game.runT - t0;
console.log(`heron fight (hp ${game.tuning.bossMaxHp}, 3-hue cycling, 2.5s/pigment): ${fight.toFixed(1)}s = ${(fight / 60).toFixed(2)} min`);
console.log(`  (human adds dodging + misses → ×~1.6 → ~${(fight / 60 * 1.6).toFixed(1)} min)`);