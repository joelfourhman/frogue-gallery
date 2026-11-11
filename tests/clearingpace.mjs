// Diagnostic clearing probe: real Game/Player/Enemy/Paint, no invulnerability.
// This scripted input is not a human timing estimate or a release pacing gate.
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
const game = new Game(makeCanvas());
game.start();
const { CLEARING } = await import('../src/logic.js');
const { mulberry32 } = await import('../src/math.js');
const { World } = await import('../src/world.js');
// Check the bell and its painting approach against independent world seeds.
let blocked = 0;
let inaccessible = 0, displacedSpawns = 0;
for (let seed = 0; seed < 64; seed++) {
  const world = new World(mulberry32(seed), seed);
  const [x, y] = world.collideCircle(CLEARING.x - 55, CLEARING.y, 15);
  if (Math.hypot(x - (CLEARING.x - 55), y - CLEARING.y) > 5) blocked++;
  let open = 0;
  for (let i = 0; i < 8; i++) {
    const ax = CLEARING.x + Math.cos(i * Math.PI / 4) * 55, ay = CLEARING.y + Math.sin(i * Math.PI / 4) * 55;
    const [cx, cy] = world.collideCircle(ax, ay, 15);
    if (Math.hypot(cx - ax, cy - ay) < 5) open++;
  }
  if (!open) inaccessible++;
  for (let i = 0; i < 5; i++) {
    const ax = CLEARING.x + (i % 2 ? -1 : 1) * 170, ay = CLEARING.y + (i % 3 - 1) * 65;
    const [cx, cy] = world.collideCircle(ax, ay, 16);
    if (Math.hypot(cx-ax,cy-ay) > 5) displacedSpawns++;
  }
}
console.log(`Clearing approach displacement (>5px), 64 world seeds: ${blocked}`);
console.log(`No accessible bell approach: ${inaccessible}; displaced actor spawns: ${displacedSpawns}/320 (collision correction is applied)`);
if (inaccessible) throw new Error('An authored bell has no accessible approach');

for (const useColors of [false, true]) {
  store.clear(); game.save.flags.intro = true;
  game.options.shake = false; game._beginExpedition();
  const p = game.player;
  // Place the fresh, unupgraded frog at the activity entrance once. Thereafter
  // real movement, paint geometry, hop cooldowns and damage run without cheats.
  p.x = CLEARING.x - 65; p.y = CLEARING.y; game.enemies = [];
  let movement = [0, 0], elapsed = 0, damage = 0, hops = 0, lowHp = p.hp;
  let phase = game.encounter.phase, transitionPause = 0, dodgeUntil = 0, dodge = [0, 0];
  game.input.moveVec = () => movement;
  let guard = 0;
  while (p.alive && game.encounter.phase !== 'complete' && guard++ < 60 * 240) {
    const dt = 1 / 60;
    if (phase !== game.encounter.phase) { phase = game.encounter.phase; transitionPause = 0.9; }
    transitionPause = Math.max(0, transitionPause - dt);
    const live = game.enemies.filter(e => e._clearing && !e.dead && e.hp > 0);
    live.sort((a, b) => Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
    const target = live[0] || { x: CLEARING.x, y: CLEARING.y };
    const distance = Math.hypot(target.x-p.x,target.y-p.y) || 1;
    const dx = (target.x-p.x)/distance, dy = (target.y-p.y)/distance;
    const threatening = live.find(e => (e.clearingPhase === 'tell' && e.clearingT < 0.3) || (e.flight === 'tell' && e.flightT < 0.25));
    game.input.kb.delete(' ');
    if (threatening && p.hopCd <= 0 && Math.hypot(threatening.x-p.x,threatening.y-p.y) < 150) {
      const ax = threatening.dartX ?? threatening.clearingDX, ay = threatening.dartY ?? threatening.clearingDY;
      dodge = [-ay, ax]; dodgeUntil = elapsed + 0.25; game.input.kb.add(' '); hops++;
    }
    movement = elapsed < dodgeUntil ? dodge : distance > 56 ? [dx, dy] : [0, 0];
    if (useColors && target._clearing) {
      p.pigment = p.hp < p.maxHp * 0.6 ? 'green' : ['slow','freeze'].includes(target.status?.type) ? 'red' : 'blue';
    } else p.pigment = 'red';
    // Limited painting duty is a repeatable input model, not human evidence.
    game.input.mouse.lDown = transitionPause <= 0 && (phase !== 'fight' || elapsed % 1 < 0.55);
    const view = game._view();
    game.input.mouse.x = (target.x-view.x)*view.scale;
    game.input.mouse.y = (target.y-view.y)*view.scale;
    game.input.update();
    const before = p.hp;
    frames(1); elapsed += dt;
    if (p.hp < before) damage += before-p.hp;
    lowHp = Math.min(lowHp,p.hp);
  }
  console.log(JSON.stringify({ model: useColors?'blue/red + green when hurt':'red only', result:game.encounter.phase, alive:p.alive, seconds:Number(elapsed.toFixed(1)), damage, lowHp, hops, round:game.encounter.round+1 }));
  if (!p.alive || game.encounter.phase !== 'complete') console.log('  Scripted bot did not clear; this is a diagnostic, not a human difficulty verdict.');
}


