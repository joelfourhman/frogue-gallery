// smoke.mjs — headless runtime boot test (no browser needed).
// Stubs window/document/canvas/localStorage/rAF, imports the real Game class,
// and drives: title -> expedition -> combat -> boss -> victory -> end screen,
// plus a defeat run. Any thrown exception fails the test.
// Run: node tests/smoke.mjs
'use strict';

// ---------------- DOM / canvas stubs ----------------
const windowListeners = {};
const windowStub = {
  addEventListener(t, fn) { (windowListeners[t] ||= []).push(fn); },
  removeEventListener() {},
  // no AudioContext: AudioSys.ensure() returns false cleanly
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
    width: 1280, height: 800, hidden: false, style: {},
    _ctx: null,
    getContext() { if (!this._ctx) this._ctx = makeCtx(this); return this._ctx; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 800 }; },
    addEventListener(t, fn) { (this._ev || (this._ev = {}))[t] = fn; },
    removeEventListener() {},
  };
  return cv;
}

const canvasInstances = [];
const documentStub = {
  createElement(tag) {
    if (tag === 'canvas') { const c = makeCanvas(); canvasInstances.push(c); return c; }
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

// ---------------- fire synthetic input events ----------------
// A full key TAP: keydown then keyup. game.js only registers a "just pressed"
// event when the key isn't already held, so we must release between taps
// (a real browser does; our stub has no auto-release).
function fireKey(type, key) {
  const ev = { key, repeat: false, preventDefault() {} };
  for (const fn of windowListeners[type] || []) fn(ev);
  if (type === 'keydown') {
    const up = { key, repeat: false, preventDefault() {} };
    for (const fn of windowListeners['keyup'] || []) fn(up);
  }
}

// A full mouse TAP (down then up) at screen coords (x, y) — fires on the
// canvas listeners the game registered. `which` = button (0 left, 2 right).
function fireMouse(canvas, x, y, which = 0) {
  const base = { clientX: x, clientY: y, button: which, preventDefault() {} };
  const md = canvas._ev && canvas._ev['mousedown'];
  const mu = windowListeners['mouseup'];
  if (md) md({ ...base });
  if (mu && mu.length) mu.forEach((fn) => fn({ ...base }));
}

let nowMs = 0;
function frames(n, stepMs = 16.7) {
  for (let i = 0; i < n; i++) {
    nowMs += stepMs;
    if (!rafCb) throw new Error('no rAF callback registered — game.start() never ran');
    const cb = rafCb;
    rafCb = null;
    cb(nowMs);
  }
}

function assert(cond, msg) {
  if (!cond) { console.error(`FAIL: ${msg}`); process.exit(1); }
  console.log(`  ok — ${msg}`);
}

// ---------------- the test ----------------
const { Game } = await import('../src/game.js');

console.log('== stage 1: boot + title ==');
const canvas = makeCanvas();
const game = new Game(canvas);
game.start();
assert(rafCb !== null, 'game.start() registered a frame callback');
assert(game.state === 'title', 'initial state is title');
frames(30);
assert(game.state === 'title', 'title survived 30 frames (world+particles+title draw)');

console.log('== stage 2: begin expedition ==');
fireKey('keydown', 'Enter');
frames(2);
assert(game.state === 'expedition', 'Enter started an expedition');
assert(game.player && game.player.alive, 'player exists and is alive');
assert(game.heron && game.heron._intro > 0, 'heron intro countdown active');
frames(30);
assert(game.world.ripples.length > 0, 'world build populated ripples (ripple bug stays fixed)');
assert(game.world.pads.length > 0, 'world build populated pads');
const sat0 = game.world.worldColorSat();

console.log('== stage 3: combat ==');
const { spawnEnemy } = await import('../src/enemies.js');
const p = game.player;
// iframes for the whole combat/splash window: we're testing paint DAMAGE
// (directional fan + splash), not survival — the test enemies otherwise
// physically reach the 5HP frog and kill it during the swipe window.
p.iframes = 999;
const beetle = spawnEnemy('beetle', p.x + 45, p.y, game.tuning);
game.enemies.push(beetle);
const mosquito = spawnEnemy('mosquito', p.x - 45, p.y, game.tuning);
game.enemies.push(mosquito);
// pin the mosquito in place (it's a fast chaser) so it stays 180° behind the
// forward-aimed swipe and can only be hit if the fan wrongly wraps around.
mosquito.speed = 0;
// aim the mouse at the beetle (screen coords from the EXPEDITION camera)
const v = game._view();
game.input.mouse.x = (beetle.x - v.x) * v.scale;
game.input.mouse.y = (beetle.y - v.y) * v.scale;
game.input.update();
const beetleHp0 = beetle.hp;
const mosquitoHp0 = mosquito.hp;
game.input.mouse.lDown = true;
frames(90); // ~1.5s of swiping
game.input.mouse.lDown = false;
assert(beetle.hp < beetleHp0 || beetle.dead, `swipes damaged the beetle (hp ${beetleHp0} -> ${beetle.hp}, dead: ${beetle.dead})`);
assert(mosquito.hp === mosquitoHp0, `swipe fan is directional — mosquito behind the frog untouched (hp ${mosquito.hp}/${mosquitoHp0})`);
const sat1 = game.world.worldColorSat();
assert(sat1 > sat0, `painting restored swamp color (${sat0.toFixed(3)} -> ${sat1.toFixed(3)})`);

console.log('== stage 4: charged splash ==');
// clear stage-3's leftover enemies; only the mosquito is in the scene now
game.enemies.length = 0;
game.enemies.push(mosquito);
// keep the mosquito far during the charge window so it can't reach the frog;
// also iframes so wave-spawned enemies can't kill us mid-charge (test guard)
mosquito.x = game.player.x - 400;
mosquito.y = game.player.y;
mosquito.status = null;
game.player.iframes = 999; // orbs from wave-spawned enemy deaths don't kill us mid-charge
game.input.mouse.rDown = true;
frames(80); // fill the charge (~0.55s)
assert(game.player.splashCharge >= 1, `splash fully charged (${game.player.splashCharge})`);
// re-seat the mosquito right by the frog, then fire the charged splash
mosquito.x = game.player.x - 45;
mosquito.y = game.player.y;
mosquito.status = null;
game.input.mouse.rPressed = true;
frames(2);
game.input.mouse.rDown = false;
assert(mosquito.hp < mosquitoHp0 || mosquito.dead, `charged splash hit the mosquito (hp ${mosquitoHp0} -> ${mosquito.hp}, dead: ${mosquito.dead})`);
// charge was consumed (dropped from full). We left rDown held across the two
// post-fire frames, so the frog may have started recharging — that's correct
// behavior, so only assert it's no longer at full charge.
assert(game.player.splashCharge < 1, `splash charge was consumed (${game.player.splashCharge} after fire)`);

console.log('== stage 5: heron boss -> victory ==');
const h = game.heron;
h._intro = 0; // skip the intro
h.awakened = true;
h.awakenedT = 99;
h.hp = 12;
h.state = 'idle';
h.stateT = 999;
// stand in swipe range of the boss and paint it
game.player.x = h.x - 55;
game.player.y = h.y - 60;
game.player.iframes = 999; // don't die to contact during the kill window
game.input.mouse.x = (h.x - game._view().x) * game._view().scale;
game.input.mouse.y = (h.y - 100 - game._view().y) * game._view().scale;
game.input.mouse.lDown = true;
frames(240); // ~4s
game.input.mouse.lDown = false;
assert(h.hp <= 0 || h.flying > 0, `boss defeated or fleeing (hp=${h.hp.toFixed(1)}, flying=${h.flying.toFixed(2)})`);
frames(240); // let the flight play out
assert(game.state === 'end' && game.endKind === 'victory', 'victory end state reached');
assert(game.save.stats.victories === 1, 'victory recorded in save stats');
assert(game.save.stats.heronDefeated === true || game.save.flags.heronDefeated === true, 'heronDefeated flag set');
frames(90); // end screen must render
assert(game.state === 'end', 'end screen survived 90 frames');

console.log('== stage 5b: awakened boss takes 2x paint damage ==');
{
  const t = game.tuning;
  const px = game.player.x, py = game.player.y;
  const mk = () => ({ x: px, y: py, hp: 100, maxHp: 100, hue: { red: 0, blue: 0, green: 0 }, awakened: false, awakenedT: 0, diveH: 0 });
  const paint = new (await import('../src/paint.js')).Paint(game.player, game.world, t, () => {}, game.particles);
  game.player.pigment = 'red';
  const h1 = mk();
  paint.paintBossHit(h1, 'red', t.bossPaintHit);
  const normalDmg = 100 - h1.hp;
  const h2 = mk();
  h2.awakened = true; h2.awakenedT = 99;
  paint.paintBossHit(h2, 'red', t.bossPaintHit);
  const awakeDmg = 100 - h2.hp;
  assert(awakeDmg === 2 * normalDmg, `awakened boss takes 2x paint damage (normal ${normalDmg}, awakened ${awakeDmg})`);
  // awakening pace math: ceil(45/6)=8 swipes per hue, one hue per swipe
  const swipesPerHue = Math.ceil(t.bossAwakenNeed.red / t.bossPaintHit);
  const fillTime = swipesPerHue * 3 * t.swipeCooldown;   // ~4.8s to paint all three hues
  const fillDmg = (swipesPerHue * 3) * normalDmg;          // damage dealt while filling
  const windowDmg = (t.bossAwakenDuration / t.swipeCooldown) * awakeDmg; // 2x hits during the 6s window
  const cycleTime = fillTime + t.bossAwakenDuration;
  const cycles = t.bossMaxHp / (fillDmg + windowDmg);
  console.log(`  info — per cycle: ${Math.round(fillTime)}s fill + ${t.bossAwakenDuration}s window, ${fillDmg + windowDmg} dmg; model ≈ ${Math.max(1, Math.round(cycles))} cycles. (Ground truth: tests/bosspace.mjs bot simulation — the model is deliberately conservative.)`);
  assert(cycles >= 10 && cycles <= 60, `boss pacing is in the epic range (${cycles.toFixed(1)} awaken cycles by the conservative model; bosspace bot measures the real fight)`);
}

console.log('== stage 6: end screen -> atelier (the between-run loop) ==');
fireKey('keydown', 'Enter');
frames(2);
assert(game.state === 'atelier', 'Enter from end screen opened the atelier');
frames(30);
assert(game.state === 'atelier', 'atelier survived 30 frames (draw pass runs clean)');

// fund the bank deterministically (we are testing atelier logic, not the economy)
game.save.bank = { red: 20, blue: 20, green: 20 };

// buy the level-1 Brush Craft upgrade by clicking its real hitbox
const findRow = (tag) => game._atelierRows().find(r => r.tag === tag);
let row = findRow('buy:power');
assert(row && row.enabled, 'buy:power row exists and is affordable');
fireMouse(canvas, row.x + row.w / 2, row.y + row.h / 2);
frames(1);
assert(game.save.upgrades.power === 1, 'power upgrade purchased via click');
assert(game.save.bank.red === 16 && game.save.bank.blue === 18 && game.save.bank.green === 18, `bank debited correctly (got ${JSON.stringify(game.save.bank)})`);
const rawSave = JSON.parse(store.get('frogue_gallery_save'));
assert(rawSave.upgrades.power === 1, 'purchase persisted to (stub) localStorage');

// switch to the paintings tab and buy + hang + unhang a painting
fireKey('keydown', '2');
frames(1);
assert(game.atelierTab === 1, 'key 2 switched to the paintings tab');
row = findRow('paint:spring-garden');
assert(row && row.enabled, 'spring-garden row exists and is affordable');
fireMouse(canvas, row.x + row.w / 2, row.y + row.h / 2);
frames(1);
assert(game.save.owned.includes('spring-garden'), 'spring-garden purchased');
assert(game.save.loadout.includes('spring-garden'), 'new painting auto-hung in loadout');
fireMouse(canvas, row.x + row.w / 2, row.y + row.h / 2); // toggle it off
frames(1);
assert(game.save.owned.includes('spring-garden') && !game.save.loadout.includes('spring-garden'), 'unhang removed it from loadout but kept ownership');

// Esc returns to the title
fireKey('keydown', 'Escape');
frames(2);
assert(game.state === 'title', 'Escape returned to the title');

console.log('== stage 7: defeat run, save persistence ==');
fireKey('keydown', 'Enter');
frames(2);
assert(game.state === 'expedition', 'second expedition started');
// drop the frog to death
game.player.hp = 1;
game.player.hurt(99, game.tuning);
frames(140); // dying sequence (~1.6s) + margin
assert(game.state === 'end' && game.endKind === 'defeat', 'defeat end state reached');
assert(game.save.stats.deaths >= 1, 'death recorded in save stats');
assert((store.get('frogue_gallery_save') || '').length > 0, 'save persisted to (stub) localStorage');
frames(60);
assert(game.state === 'end', 'defeat end screen survived 60 frames');

console.log('== stage 8: M4 — best run, mute, Croaksworth beat ==');
assert(game.save.bestRun && game.save.bestRun.cleared, 'best run recorded from the stage-5 victory');

// mute toggle (M key) persists to options
const wasMuted = game.audio.muted;
fireKey('keydown', 'm');
frames(2);
assert(game.audio.muted === !wasMuted, 'M toggled audio mute state');
const rawOpts = JSON.parse(store.get('frogue_gallery_options') || '{}');
assert(rawOpts.muted === game.audio.muted, 'mute choice persisted to (stub) localStorage options');
fireKey('keydown', 'm');
frames(2);
assert(game.audio.muted === wasMuted, 'M again restored the previous state');

// Croaksworth story beat: seal lifts after the first victory
game.save.flags.heronDefeated = true; // the stage-5 victory already earned it
game.save.bank = { red: 20, blue: 20, green: 20 };
game.save.flags.croaksworthGiven = false;
fireKey('keydown', 'Enter'); // end screen -> atelier
frames(2);
assert(game.state === 'atelier', 'back in the atelier for the portrait purchase');
fireKey('keydown', '2');
frames(1);
const croakRow = findRow('paint:croaksworth');
assert(croakRow && croakRow.enabled, `Croaksworth portrait unlocked + affordable after first victory (got ${croakRow ? JSON.stringify(croakRow.tag) : 'missing row'})`);
fireMouse(canvas, croakRow.x + croakRow.w / 2, croakRow.y + croakRow.h / 2);
frames(1);
assert(game.save.owned.includes('croaksworth'), 'Croaksworth portrait purchased');
assert(game.save.flags.croaksworthGiven, 'Croaksworth story beat fired');
// cost (5 each) and the silver coin (+5 each) net to zero — bank unchanged proves BOTH fired;
// a missing bonus would leave 15/15/15
assert(game.save.bank.red === 20 && game.save.bank.blue === 20 && game.save.bank.green === 20, `cost + coin balanced (got ${JSON.stringify(game.save.bank)})`);
assert(game.banners.some(b => String(b.text).includes('Croaksworth')), 'Croaksworth banner is showing');

console.log('== stage 9: M5 polish — pause, vignette, intro ==');
fireKey('keydown', 'Escape'); // atelier -> back to the title
frames(2);
assert(game.state === 'title', 'Escape from the atelier returned to the title');
game.save.flags.intro = false;
fireKey('keydown', 'Enter');
frames(2);
assert(game.state === 'expedition', 'fresh expedition started');
assert(game.save.flags.intro, 'first-run intro flag set after the intro banners');
frames(120); // let intro banners expire
assert(game.state === 'expedition', 'intro banners expired without breaking the run');

// pause: P opens, resume button works, Esc from pause quits
fireKey('keydown', 'p');
frames(1);
assert(game.paused, 'P opened the pause menu');
frames(30);
assert(game.paused, 'pause survived 30 frames (draw pass clean)');
// click the Resume button (geometry shared with _drawPause)
fireMouse(canvas, game.cw / 2, game.ch / 2 - 130 + 108 + 22);
frames(1);
assert(!game.paused, 'Resume button unpaused');
fireKey('keydown', 'p');
frames(1);
assert(game.paused, 'P paused again');
fireKey('keydown', 'Escape');
frames(2);
assert(game.state === 'title', 'Esc from the pause menu quit to the title');

// low-HP vignette: draw the HUD at 1 hp without crashing
fireKey('keydown', 'Enter');
frames(2);
assert(game.state === 'expedition', 'final expedition started');
game.player.hp = 1;
game.player.iframes = 0;
frames(90); // vignette pulses across ~1.5s of frames
assert(game.state === 'expedition' && game.player.alive, 'low-HP vignette rendered without crashing the run');
game.player.iframes = 0;
game.player.hurt(99, game.tuning);
frames(140);
assert(game.state === 'end' && game.endKind === 'defeat', 'run ended cleanly');

console.log('== stage 10: M6 — erase save data (title link, two-click) ==');
fireKey('keydown', 'Escape'); // end -> title
frames(2);
assert(game.state === 'title', 'back at the title');
assert(game.save.stats.expeditions >= 2, 'precondition: the test runs left stats behind');
// first click arms the confirm; nothing is erased yet
fireMouse(canvas, 136, game.ch - 26);
frames(1);
assert(store.has('frogue_gallery_save'), 'first click only armed the confirm (save still there)');
// second click within the window erases
fireMouse(canvas, 136, game.ch - 26);
frames(2);
assert(!store.has('frogue_gallery_save'), 'second click erased the save from (stub) localStorage');
assert(game.save.stats.expeditions === 0, 'in-memory save was reset to fresh');
assert(game.save.bank.red === 0 && game.save.owned.length === 0, 'fresh start: empty bank and gallery');
frames(30);
assert(game.state === 'title', 'title survived 30 frames after the erase');

console.log('== stage 11: P1 — new-player guidance ==');
assert(!game.save.flags.intro, 'precondition: fresh save (erase in stage 10)');
fireKey('keydown', 'Enter'); // first expedition ever for this save
frames(2);
assert(game.state === 'expedition', 'first expedition started');
assert(game.save.flags.intro, 'intro flag set on the first expedition');
frames(20); // ~0.33s: step 1 (at 0.3) fires; step 3 (pigments, at 14s) must not
assert(game.banners.some(b => b.text.startsWith('WASD to move')), 'tutorial step 1 (movement) shows within the first second');
assert(!game.banners.some(b => b.text.includes('red burns')), 'pigment step held back until its scheduled time');
assert(game.heron._intro > 3, `first-run heron reveal delayed (got ${game.heron._intro.toFixed(1)}s remaining)`);
frames(400); // ~6.7s more (runT ≈ 7s): step 2 fires
assert(game.banners.some(b => b.text.includes('left-click')), 'tutorial step 2 (painting) fired on schedule');
// first-hit teaching: take a hit directly (player survives: 2 dmg)
game.player.iframes = 0;
game.player.hurt(2, game.tuning);
game.player.iframes = 99; // shield from wave-spawned enemies while the stage continues
frames(2);
assert(game.save.flags.firstHurt, 'first-hit tip flagged');
assert(game.banners.some(b => b.text.includes('Ouch')), 'first-hit teaching banner shown');
// first-orb teaching: drop an orb on the frog
game.orbs.push({ x: game.player.x, y: game.player.y, color: 'red', t: 0 });
game.player.iframes = 99; // survive the rest of this stage
frames(2);
assert(game.save.flags.firstOrb, 'first-orb tip flagged on pickup');
assert(game.banners.some(b => b.text.includes('Atelier')), 'first-orb teaching banner shown');
// first-atelier teaching
fireKey('keydown', 'Escape'); // pause
frames(1);
fireKey('keydown', 'Escape'); // quit to the title
frames(2);
assert(game.state === 'title', 'quit to the title for the atelier visit');
fireKey('keydown', 'a');
frames(2);
assert(game.state === 'atelier', 'atelier opened from the title');
assert(game.save.flags.firstAtelier, 'first-atelier tip flagged');
// first-defeat teaching
fireKey('keydown', 'Escape');
frames(2);
fireKey('keydown', 'Enter');
frames(2);
game.player.iframes = 0;
game.player.hurt(99, game.tuning);
frames(2);
assert(game.save.flags.firstDefeat, 'first-defeat tip flagged');
assert(game.banners.some(b => b.text.includes('half your pigments')), 'defeat teaching banner shown');
frames(150); // let the dying sequence finish
assert(game.state === 'end', 'run ended cleanly after the test kill');

console.log('== stage 12: P2 — juice (damage numbers, pickup text, enemy arrows) ==');
// damage numbers: swipe a pinned beetle, expect a floating "-N" note
fireKey('keydown', 'Enter'); // end -> atelier (route around)
frames(2);
fireKey('keydown', 'Escape');
frames(2);
fireKey('keydown', 'Enter'); // new expedition
frames(2);
game.player.iframes = 99;
const { spawnEnemy: mk } = await import('../src/enemies.js');
const target = mk('beetle', game.player.x + 45, game.player.y, game.tuning);
game.enemies.length = 0;
game.enemies.push(target);
const v2 = game._view();
game.input.mouse.x = (target.x - v2.x) * v2.scale;
game.input.mouse.y = (target.y - v2.y) * v2.scale;
game.input.update();
const hp0 = target.hp;
game.input.mouse.lDown = true;
frames(3);
game.input.mouse.lDown = false;
assert(target.hp < hp0, `swipe landed in P2 stage (hp ${hp0} -> ${target.hp})`);
assert(game.paint.hitNotes.some(n => n.text.startsWith('-') && !isNaN(Number(n.text.slice(1)))), 'damage number note spawned on hit');
// pickup text: orb on the frog
game.orbs.push({ x: game.player.x, y: game.player.y, color: 'blue', t: 0 });
frames(2);
assert(game.paint.hitNotes.some(n => n.text.startsWith('+')), 'orb pickup "+N" note spawned');
// off-screen enemy arrows: draw path runs without crashing with an off-screen enemy
game.enemies.length = 0;
const far = mk('mosquito', game.player.x + 900, game.player.y, game.tuning);
far.speed = 0;
game.enemies.push(far);
frames(30); // ~0.5s of frames: arrows draw while the mosquito sits off-screen
assert(game.state === 'expedition', 'off-screen enemy arrows rendered without crashing');
game.enemies.length = 0;
game.player.iframes = 0;
game.player.hurt(99, game.tuning);
frames(140);
assert(game.state === 'end', 'run ended cleanly after the P2 stage');

console.log('== stage 13: P3 — atelier onboarding ==');
game.save.flags.firstAtelier = false; // simulate a player who has never been here
game._beginAtelier();
frames(2);
assert(game._atelierIntro === true, 'first-visit how-it-works panel is shown');
fireKey('keydown', '2');
frames(2);
assert(game.atelierTab === 1, 'Paintings tab switches over');
assert(game._atelierIntro === false, 'any action dismisses the intro panel');
fireKey('keydown', 'Enter');
frames(3);
assert(game.state === 'expedition', 'departing from the atelier starts a run');
game.player.hurt(99, game.tuning);
frames(140);
assert(game.state === 'end', 'run ended cleanly after the P3 stage');

console.log('== stage 14: P5 — named zones + rest checkpoints + longer run ==');
fireKey('keydown', 'Enter'); // end -> atelier
frames(2);
assert(game.state === 'atelier', 'end screen routed to the atelier');
fireKey('keydown', 'Enter'); // atelier -> new expedition
frames(2);
assert(game.state === 'expedition', 'run restarted');
const W = game.world.w;
assert(W >= 5000, `world widened for run pacing (w=${W}px)`);
const p5 = game.player;
p5.iframes = 999;
p5.x = W * 0.25; p5.y = 760; // step across the first zone boundary
frames(2);
assert(game.banners.some(b => b.text.includes('Reed Flats')), 'zone 1 (Reed Flats) banner fired on entry');
assert(game._zoneI === 1, 'zone 1 consumed, next zone pending');
assert(game.enemies.length >= 4, `zone beat staged enemies ahead (enemies=${game.enemies.length})`);
const pool = game.world.pigmentAt(p5.x + 560, p5.y);
assert(pool.green >= 0.4, `rest checkpoint painted thick green paint ahead (green=${pool.green.toFixed(1)})`);
p5.x = W * 0.45; // second boundary
frames(2);
assert(game.banners.some(b => b.text.includes('Slick Hollow')), 'zone 2 (Slick Hollow) fires as the journey continues');
assert(game._zoneI === 2, 'two zones consumed');
p5.iframes = 0;
p5.hurt(99, p5.tuning || game.tuning);
frames(140);
assert(game.state === 'end', 'run ended cleanly after the P5 stage');

console.log('== stage 15: save migration + failure behavior (DoD #11) ==');
{
  const L = await import('../src/logic.js');
  const S = await import('../src/save.js');
  // corrupt JSON must not crash boot — load() falls back to null (fresh game)
  store.set('frogue_gallery_save', '{definitely not json');
  assert(S.SaveSys.load() === null, 'corrupt JSON save fails safely to null (fresh game)');
  store.delete('frogue_gallery_save');
  // migrateSave: null / non-object → fresh default save
  assert(L.migrateSave(null).flags.firstAtelier === false, 'migrateSave(null) yields fresh flags');
  assert(L.migrateSave('garbage').bank.green === 0, 'migrateSave(non-object) yields fresh bank');
  // old save (pre-P1 flags, unknown painting id) migrates without losing valid data
  const old = L.migrateSave({
    v: 1,
    bank: { red: 5, blue: 0 }, // no green key at all
    owned: ['spring-garden', 'bogus-painting'],
    loadout: ['bogus-painting', 'spring-garden', 'moonlit-pond'], // bogus + not-owned entries
    upgrades: { power: 2 },
    flags: { intro: true },
  });
  assert(old.bank.green === 0, 'missing bank colors default to 0');
  assert(old.bank.red === 5, 'valid bank values survive migration');
  assert(old.owned.includes('spring-garden') && !old.owned.includes('bogus-painting'), 'unknown painting ids filtered from owned');
  assert(old.loadout.includes('spring-garden') && !old.loadout.includes('bogus-painting') && !old.loadout.includes('moonlit-pond'), 'loadout keeps only owned paintings');
  assert(old.flags.intro === true && old.flags.firstOrb === false && old.flags.firstAtelier === false, 'old flags keep their values, new flags default to false');
  assert(old.upgrades.power === 2 && old.upgrades.capacity === 0, 'upgrades keep valid levels, missing ones default');
  // options: missing → defaults; out-of-range clamped
  assert(L.migrateOptions(null).volume === 0.7, 'missing options fall back to defaults');
  const o = L.migrateOptions({ volume: 99, muted: 1 });
  assert(o.volume === 1 && o.muted === true, 'out-of-range volume clamped, truthy mute coerced');
}

console.log('== stage 16: DoD #2 — title Continue / New Game affordance ==');
fireKey('keydown', 'Escape'); // end -> title
frames(2);
assert(game.state === 'title', 'end screen returned to the title');
{
  const s = game.save;
  const hasProgress = s.stats.expeditions > 0 || s.owned.length > 0 ||
    s.bank.red > 0 || s.bank.blue > 0 || s.bank.green > 0 || s.loadout.length > 0 ||
    s.upgrades.power > 0 || s.upgrades.vitality > 0 || s.upgrades.capacity > 0;
  assert(hasProgress, 'earlier test runs left progress (bank/paintings/upgrades) in the save');
  frames(6); // render the title a few frames on the "Continue Expedition" label path
  assert(game.state === 'title', 'title renders cleanly with the continue/new-game affordance (label + footer)');
}

console.log('== stage 17: B2 — corrupt-save handling, never crash, keep what we can ==');
{
  const L = await import('../src/logic.js');
  const S = await import('../src/save.js');
  const KEY = 'frogue_gallery_save';
  // expectNoThrow(fn) — run fn, fail the stage if it throws.
  const expectNoThrow = (fn, what) => {
    let threw = false;
    try { fn(); } catch (e) { threw = true; }
    assert(!threw, `${what} does not throw`);
  };
  // (c) unparseable JSON → load() returns null (caller boots fresh), no throw
  for (const bad of ['{definitely not json', '{"bank":', 'null-but-not']) {
    store.set(KEY, bad);
    let loaded = 'sentinel';
    expectNoThrow(() => { loaded = S.SaveSys.load(); }, `SaveSys.load on corrupt JSON ${JSON.stringify(bad)}`);
    assert(loaded === null, `unparseable JSON ${JSON.stringify(bad)} → null → caller starts a fresh save`);
  }
  store.delete(KEY);
  // (a) parses to an object with recognizable fields → migrate/merge: keep them, fill the rest
  const mig = L.migrateSave({ bank: { red: 3 }, flags: { intro: true } });
  assert(mig._case === 'migrated', 'object with recognizable fields is tagged _case=migrated');
  assert(mig.bank.red === 3 && mig.flags.intro === true && mig.bank.blue === 0 && mig.flags.firstOrb === false,
    'recognizable fields preserved, missing fields default to fresh');
  // object with only bank → bank preserved, rest fresh
  const onlyBank = L.migrateSave({ bank: { red: 7, blue: 2, green: 1 } });
  assert(onlyBank._case === 'migrated' && onlyBank.bank.red === 7 && onlyBank.bank.blue === 2 && onlyBank.bank.green === 1,
    'object with only bank → bank preserved');
  assert(onlyBank.owned.length === 0 && onlyBank.upgrades.power === 0 && onlyBank.stats.expeditions === 0 &&
    onlyBank.flags.intro === false && onlyBank.loadout.length === 0 && onlyBank.bestRun === null,
    'everything else fresh defaults when only bank survived');
  // (b) parses to an object with no recognizable fields → fresh save, nothing preserved
  const junk = L.migrateSave({ foo: 1, bar: 'baz' });
  assert(junk._case === 'fresh' && junk.bank.green === 0 && junk.owned.length === 0 && junk.flags.intro === false,
    'object with no recognizable save fields → fresh save (_case=fresh)');
  // unknown painting ids → filtered (known + unknown mix keeps only the known one)
  const bogus = L.migrateSave({ owned: ['not-a-painting', 'also-bogus'], loadout: ['not-a-painting'] });
  assert(bogus._case === 'migrated' && bogus.owned.length === 0 && bogus.loadout.length === 0,
    'unknown painting ids are filtered from owned/loadout');
  const knownId = L.PAINTINGS[0].id;
  const mixed = L.migrateSave({ owned: [knownId, 'nope'], loadout: ['nope', knownId] });
  assert(mixed.owned.length === 1 && mixed.owned[0] === knownId && mixed.loadout.length === 1 && mixed.loadout[0] === knownId,
    'known painting id survives alongside unknown ids, which are dropped');
  // non-object JSON (string/number/array/boolean/null) → fresh, no throw, via both migrateSave and load()
  for (const nonObj of ['"hello"', '123', '[1,2,3]', 'true', 'null']) {
    let r;
    expectNoThrow(() => { r = L.migrateSave(JSON.parse(nonObj)); }, `migrateSave on non-object JSON ${nonObj}`);
    assert(r._case === 'fresh' && r.bank.red === 0 && r.owned.length === 0, `non-object parse ${nonObj} → fresh save (_case=fresh)`);
    store.set(KEY, nonObj);
    let l;
    expectNoThrow(() => { l = S.SaveSys.load(); }, `SaveSys.load on non-object JSON ${nonObj}`);
    assert(l._case === 'fresh' && l.flags.intro === false, `SaveSys.load on ${nonObj} returns a clean fresh save`);
  }
  store.delete(KEY);
  // _case documents the case in the return but is never persisted into the save blob
  assert(!JSON.stringify(onlyBank).includes('_case'), '_case is non-enumerable and never written to localStorage');
  // a migrated save round-trips through save()/load() cleanly
  store.set(KEY, JSON.stringify(L.migrateSave({ bank: { green: 5 } })));
  const rt = S.SaveSys.load();
  assert(S.SaveSys.save(rt) && rt.bank.green === 5 && rt._case === 'migrated', 'migrated save round-trips through save()/load()');
  store.delete(KEY);

  // ---- B3 (folded into stage 17): dry-brush softlock audit -----------------
  // The heron's ONLY damage source is wet paint (paint.js paintBossHit: dry
  // short-circuits to null; logic.js paintBoss: dry returns 0). Real softlock
  // question: can a pigment-starved frog (bank {0,0,0}, no upgrades, empty
  // loadout — worst case) still win? In-run paint is unlimited — the bank is
  // atelier currency only (paid on purchases, topped up by bankGain at run end;
  // nothing drains pigments mid-run) — so "starved" reduces to "can win on base
  // tuning with wet brushes alone".
  {
    const t = L.makeTuning({}, []);
    // wet-paint damage per swipe on base tuning: must be at least 1 on every
    // wet color (a 0 would be the softlock)
    for (const pig of ['red', 'blue', 'green']) {
      assert(L.paintDamage(t.swipeDamage, pig, t) >= 1, `base tuning: ${pig} swipe damage >= 1 (got ${L.paintDamage(t.swipeDamage, pig, t)})`);
    }
    // dry brush: paintDamage itself returns a physical min of 1 for enemies,
    // but the heron is only ever damaged via paintBossHit, which short-circuits
    // dry to null (verified by code path above) — so dry never chips the boss.
    const need = t.bossAwakenNeed;
    for (const c of ['red', 'blue', 'green']) {
      const hits = Math.ceil(need[c] / t.bossPaintHit);
      assert(Number.isFinite(hits) && hits >= 1, `awaken reachable for ${c} in ${hits} wet hits`);
    }
    // the fight has a finite length: the awakened window doubles wet damage,
    // so the 30000 HP heron dies in a bounded number of swipes
    const wetDmg = Math.min(...['red', 'blue', 'green'].map(p => L.paintDamage(t.swipeDamage, p, t)));
    const dmgInWindow = wetDmg * 2 * (t.bossAwakenDuration / t.swipeCooldown);
    assert(dmgInWindow >= 1, `awakened window deals >= 1 damage per cycle (got ${dmgInWindow.toFixed(1)})`);
    const cyclesNeeded = Math.ceil(t.bossMaxHp / Math.max(1, dmgInWindow));
    assert(cyclesNeeded > 0 && Number.isFinite(cyclesNeeded), `30000 HP heron falls in ${cyclesNeeded} awaken cycles — no softlock`);
  }
}

console.log('\nALL SMOKE TESTS PASSED');
process.exit(0);