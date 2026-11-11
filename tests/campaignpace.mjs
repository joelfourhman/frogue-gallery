// Actual four-boss campaign combat journey. God-mode, perfect positioning and
// full lantern fuel isolate progression/combat, not human traversal or difficulty.
'use strict';
import './seed.mjs';
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
const { CAMPAIGN } = await import('../src/logic.js');
const game = new Game(makeCanvas()); game.start(); game.options.shake = false;
game._beginExpedition();
const results = [];
for (let floor = 0; floor < 4; floor++) {
  if (game.campaign.floor !== floor || game.heron.kind !== CAMPAIGN[floor].boss) throw Error('Campaign skipped or repeated a boss');
  const h = game.heron, p = game.player, started = game.runT;
  h._intro = 0; p.iframes = 9999; game.spawnT = 9999; game.enemies = [];
  let guard = 0;
  while (game.state === 'expedition' && guard++ < 60 * 600) {
    p.iframes = 99;
    p.pigment = ['red', 'blue', 'green'][Math.floor(guard / 150) % 3];
    if (h.kind === 'gray') { p.x = h.x - 50; p.y = h.y - 40; }
    else { p.x = h.x; p.y = h.y; }
    const v = game._view();
    game.input.mouse.x = (h.x - v.x) * v.scale;
    game.input.mouse.y = (h.y - (h.kind === 'gray' ? 100 : 0) - v.y) * v.scale;
    game.input.update(); game.input.mouse.lDown = h.hp > 0;
    if (game.lantern) { game.lantern.fuel = 1; game.lantern.lit = true; }
    frames(1);
  }
  if (h.hp > 0) throw Error('Boss did not die through actual painting: ' + h.kind);
  results.push({ floor: floor + 1, boss: h.kind, seconds: +(game.runT - started).toFixed(1) });
  if (floor < 3) {
    if (game.state !== 'camp' || game.save.stats.victories !== 0) throw Error('Premature run victory');
    game._campChoice = ['power', 'heart', 'flow'][floor];
    if (!game._descendCampaign()) throw Error('Valid camp choice did not descend');
  }
}
if (game.state !== 'end' || game.endKind !== 'victory' || !game.campaign.complete || game.save.stats.victories !== 1) throw Error('Final boss did not finish exactly one campaign');
console.log(JSON.stringify(results));
console.log('Total combat-only simulation: ' + game.runT.toFixed(1) + 's; excludes dungeon traversal/painting and human decisions.');
console.log('FULL CAMPAIGN COMBAT JOURNEY PASSED');
