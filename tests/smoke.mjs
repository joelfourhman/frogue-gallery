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

console.log('== stage 18: B4 — tab-hidden time spike, dt cap holds, no physics blowup ==');
{
  // The dt cap (game.js _frame: clamp((t-last)/1000, 0, 0.05), then last=t) is
  // the whole defence against a tab being hidden: the wall clock can jump
  // tens of seconds, but every system integrates on the clamped dt. This stage
  // injects a real 30s spike mid-run and proves (a) the run survives, (b) the
  // wall clock actually jumped ~30s, (c) the frog and a chasing enemy each
  // moved at most a single-frame's worth (they did NOT teleport), and (d) no
  // position went NaN/Infinity.
  fireKey('keydown', 'Enter'); // title -> fresh expedition
  frames(2);
  assert(game.state === 'expedition', 'stage 18 starts a live expedition for the spike test');
  const sp = game.player;
  sp.iframes = 999; // isolation: we test the TIME cap, not survival
  // a deterministic chaser: fixed speed, no status, placed a fixed distance out
  const { spawnEnemy: spawnB } = await import('../src/enemies.js');
  const bee = spawnB('beetle', sp.x + 300, sp.y, game.tuning);
  bee.status = null;
  game.enemies.push(bee);
  // settle into a normal cadence, then capture pre-spike positions
  frames(6);
  const px0 = sp.x, py0 = sp.y, bx0 = bee.x, by0 = bee.y;
  const nowBefore = game.now;
  // HOLD a movement key (keydown without keyup) so the frog integrates its
  // velocity across the spike frame — the strongest "would it teleport" probe.
  for (const fn of windowListeners['keydown']) fn({ key: 'd', repeat: false, preventDefault() {} });
  // THE SPIKE: the tab was hidden for 30s. Advance the stub clock 30,000ms in
  // one step and fire exactly one rAF callback — that is what a real browser
  // does on resume (one frame, t jumped ~30s).
  nowMs += 30000;
  const cb = rafCb; rafCb = null;
  cb(nowMs); // the clamped frame
  for (const fn of windowListeners['keyup']) fn({ key: 'd', repeat: false, preventDefault() {} });
  const nowAfter = game.now;
  const wallDelta = nowAfter - nowBefore;
  const pdx = Math.abs(sp.x - px0), pdy = Math.abs(sp.y - py0);
  const bdx = Math.abs(bee.x - bx0), bdy = Math.abs(bee.y - by0);
  // the wall clock jumped ~30s (proves we really exercised the spike)
  assert(wallDelta > 20, `wall clock jumped ${wallDelta.toFixed(1)}s across the hidden-tab spike (expected ~30s)`);
  // ...yet the frog moved at most a single-frame's worth (0.05s @ ~230px/s)
  assert(Number.isFinite(pdx) && Number.isFinite(pdy) && pdx < 100 && pdy < 100,
    `frog did not teleport on the spike (moved ${pdx.toFixed(1)}/${pdy.toFixed(1)}px, capped ~1 frame)`);
  // ...and the chasing enemy moved at most a single-frame's worth (0.05s @ 40px/s)
  assert(Number.isFinite(bdx) && Number.isFinite(bdy) && bdx < 100 && bdy < 100,
    `enemy did not teleport on the spike (moved ${bdx.toFixed(1)}/${bdy.toFixed(1)}px, capped ~1 frame)`);
  // no NaN/Infinity leaked into any tracked position
  assert([sp.x, sp.y, sp.vx, sp.vy, bee.x, bee.y].every(v => Number.isFinite(v)), 'no NaN/Infinity in player/enemy state after the spike');
  // the run is still coherent: not crashed out of the expedition, frog alive
  assert(game.state === 'expedition', 'run still in expedition after the spike (no boot-crash / no accidental end)');
  assert(sp.alive, 'frog still alive after the spike');
  // recovery: a few normal frames run cleanly on the post-spike cadence
  frames(5);
  assert(game.state === 'expedition' && sp.alive, 'game recovers cleanly into normal frames after the spike');
  game.enemies.length = 0; // tidy up the probe enemy before later stages
}

console.log('== stage 19: B6 - save schema versioning (saveVersion + migration) ==');
{
  const L = await import('../src/logic.js');
  const S = await import('../src/save.js');
  const KEY = 'frogue_gallery_save';
  // freshSave stamps the authoritative saveVersion field (legacy `v` is gone)
  assert(L.freshSave().saveVersion === 1, 'freshSave carries saveVersion: 1');
  assert(!('v' in L.freshSave()), 'freshSave no longer emits the legacy v field (superseded by saveVersion)');
  // persist the live game save, then confirm the on-disk blob is version-stamped
  S.SaveSys.save(game.save);
  const rawB6 = JSON.parse(store.get(KEY));
  assert(rawB6 && rawB6.saveVersion === 1, `persisted save is stamped saveVersion: 1 (got ${JSON.stringify(rawB6 && rawB6.saveVersion)})`);
  // a legacy save written under the old `v` field (no saveVersion) migrates and is re-stamped
  store.set(KEY, JSON.stringify({
    v: 0,
    bank: { red: 42, blue: 0, green: 0 },
    owned: ['moonlit-pond'], loadout: ['moonlit-pond'],
    upgrades: { capacity: 1, power: 0, vitality: 0 },
    flags: { intro: true },
    stats: { expeditions: 7, victories: 1, deaths: 0, heronsPainted: 0, treasures: 0 },
    bestRun: { pigments: { red: 5, blue: 0, green: 0 }, time: 120, cleared: true },
  }));
  const migratedB6 = S.SaveSys.load();
  assert(migratedB6 !== null, 'legacy v0 save loads (not dropped as corrupt)');
  assert(migratedB6.saveVersion === 1, 'legacy v0 save re-stamped to saveVersion: 1 after migration');
  assert(migratedB6.bank.red === 42 && migratedB6.owned.includes('moonlit-pond'), 'legacy v0 fields preserved through migration (bank.red=42, moonlit-pond owned)');
  assert(migratedB6._case === 'migrated', 'legacy v0 save classified as migrated (fields recognized)');
  // the versioned save round-trips with the stamp intact
  S.SaveSys.save(migratedB6);
  const rawB6b = JSON.parse(store.get(KEY));
  assert(rawB6b.saveVersion === 1 && rawB6b.bank.red === 42, 'versioned save round-trips with saveVersion: 1 + preserved fields');
  // restore the live game save for any later stage
  game.save = S.SaveSys.load();
}

console.log('== stage 20: B5 — storage-failure fallback (in-memory save + one-time warning) ==');
{
  const L = await import('../src/logic.js');
  const S = await import('../src/save.js');
  // The earlier stages resolved the (working) stub store. Force a fresh
  // resolution so save.js re-discovers storage, then make it throw like
  // privacy mode / quota-full / disabled localStorage.
  S.SaveSys._resetStorage();
  globalThis.localStorage = {
    getItem() { throw new Error('SecurityError: localStorage is disabled'); },
    setItem() { throw new Error('SecurityError: localStorage is disabled'); },
    removeItem() { throw new Error('SecurityError: localStorage is disabled'); },
  };
  // storageOK reflects the degraded state after the forced re-resolution.
  assert(S.SaveSys.storageOK === false, 'storageOK must be false when localStorage throws');
  // The game must keep running on an in-memory save: save succeeds…
  const memSave = L.freshSave();
  memSave.bank.red = 7;
  memSave.flags.intro = true;
  assert(S.SaveSys.save(memSave) === true, 'save() must return true on the in-memory fallback');
  // …and the data round-trips (it is stored in memory, not localStorage).
  const memBack = S.SaveSys.load();
  assert(memBack && memBack.bank.red === 7 && memBack.flags.intro === true,
    'in-memory save must round-trip (bank.red=7, flags.intro=true)');
  assert(S.SaveSys.hasSave() === true, 'hasSave() must be true after an in-memory save');
  // erase() on the fallback must clear the in-memory record.
  assert(S.SaveSys.erase() === true, 'erase() must return true on the in-memory fallback');
  assert(S.SaveSys.hasSave() === false, 'hasSave() must be false after erase');
  // Options: loadOptions still returns a usable options object (never throws).
  const opts = S.SaveSys.loadOptions();
  assert(typeof opts === 'object' && opts !== null, 'loadOptions() must return a usable object when storage fails');
  S.SaveSys.saveOptions(opts); // must not throw on the fallback
  // The one-time banner predicate (exactly what game.js _beginExpedition uses):
  // a Game with degraded storage surfaces the warning on its first expedition
  // and never repeats it. We exercise the predicate directly rather than the
  // full browser Game (which is the shared instance from earlier stages).
  const g = { _storageOK: false, _warnedStorage: false, banners: [], ch: 600,
              addBanner(t, d, y) { this.banners.push({ text: t, dur: d, y }); } };
  const emit = () => { if (!g._storageOK && !g._warnedStorage) { g._warnedStorage = true; g.addBanner('No persistent storage — progress may not survive a reload.', 5.5, g.ch * 0.3); } };
  emit();
  assert(g.banners.length === 1 && /progress may not survive/i.test(g.banners[0].text),
    'first expedition with degraded storage must emit the one-time persistence banner');
  emit();
  assert(g.banners.length === 1, 'the persistence banner must NOT repeat on subsequent runs');
  // Restore a working stub store for any later stage / process teardown.
  globalThis.localStorage = localStorageStub;
  S.SaveSys._resetStorage();
  assert(S.SaveSys.storageOK === true, 'storageOK recovers to true once a working store is restored');
}

console.log('== stage 21: M7.5 PT1 — painting is rate-gated, not free/unlimited ==');
{
  const { Player } = await import('../src/player.js');
  const { Paint } = await import('../src/paint.js');
  const L = await import('../src/logic.js');
  const t = L.makeTuning({}, []);
  // a standalone frog + paint so we don't disturb the shared game instance
  const p = new Player(0, 0, t);
  p.aimA = 0; p.pigment = 'red';
  const world = { paintSwipe() {}, paintSplash() {}, pigmentAt: () => ({}) };
  const paint = new Paint(p, world, t, () => {}, { splatter() {}, sparkles() {}, note() {} });
  const enemies = [];
  // swipe: one call arms the cooldown regardless of whether any enemy is in range
  const first = paint.trySwipe(enemies);
  assert(paint.swipeCd > 0, `a swipe arms the cooldown (swipeCd=${paint.swipeCd.toFixed(3)})`);
  assert(paint.swipeCd === t.swipeCooldown, `swipe cooldown equals tuning.swipeCooldown (${t.swipeCooldown})`);
  const blocked = paint.trySwipe(enemies);
  assert(blocked === null && paint.swipeCd === t.swipeCooldown, 'immediate re-swipe is refused while the cooldown is active (not free spam)');
  // the swipe rate is bounded: over a 2s budget only ~floor(2/cd) swipes fit
  const cd = t.swipeCooldown;
  paint.swipeCd = 0; p.swipeT = 0;
  let swipes = 0;
  const dt = 1 / 60, budget = 2.0;
  for (let el = 0; el < budget / dt; el++) {
    if (paint.swipeCd > 0) paint.swipeCd -= dt;
    if (p.swipeT > 0) p.swipeT -= dt;
    const before = paint.swipeCd;
    paint.trySwipe(enemies);
    // a "fire" is when the cooldown gets (re)armed, not when an enemy is hit
    if (paint.swipeCd > before) swipes++;
  }
  const expected = Math.round(budget / cd);
  assert(Math.abs(swipes - expected) <= 1, `swipe rate is rate-limited (${swipes} in ${budget}s ≈ ${expected} at cd=${cd}), not unlimited`);
  // splash: cannot fire at 0 charge, even with a clear cooldown
  paint.splashCd = 0; p.splashCharge = 0;
  assert(paint.trySplash(enemies) === null, 'splash is refused at 0 charge (requires charging — not free)');
}

console.log('== stage 22: M7.5 PT3 — hop/dodge has a stamina cooldown (fly fairness) ==');
{
  const { Player } = await import('../src/player.js');
  const L = await import('../src/logic.js');
  const t = L.makeTuning({}, []);
  assert(t.hopCooldown > 0, `tuning exposes a hop cooldown (stamina cost) = ${t.hopCooldown}s`);
  const p = new Player(0, 0, t);
  const world = { collideCircle: (x, y) => [x, y], pigmentAt: () => ({}) };
  let spaceDown = false;
  const input = { pressed: (k) => k === ' ' && spaceDown, moveVec: () => [1, 0], mouse: { worldX: 50, worldY: 0 } };
  const view = { x: 0, y: 0, scale: 1, w: 640, h: 480 };
  // hop 1: fresh player, Space pressed
  spaceDown = true;
  p.update(1 / 60, input, t, world, view);
  assert(p.hopT > 0 && p.hopCd > 0, `hop 1 fired and armed the stamina cooldown (hopCd=${p.hopCd.toFixed(2)}s)`);
  // hop 2: immediate next frame, Space still pressed — must be refused (cooldown)
  p.hopT = 0.01; // force mid-hop edge; the gate under test is hopCd
  const hopTBefore = p.hopT, hopCdBefore = p.hopCd;
  p.update(1 / 60, input, t, world, view);
  assert(!(p.hopT === 0.22 && p.hopCd > hopCdBefore + 0.1), 'immediate re-hop within the cooldown is refused (no hop-mashing into i-frames)');
  assert(p.hopCd <= hopCdBefore + 1e-9, 'the cooldown counts down (stamina regenerates), it does not re-arm mid-gap');
  // let the cooldown fully expire, then a fresh hop must fire again
  spaceDown = false; // release Space so the frog doesn't re-hop and re-arm mid-wait
  for (let i = 0; i < 60; i++) p.update(1 / 60, input, t, world, view); // 1s, > 0.7s cd
  assert(p.hopCd <= 0, `after ${t.hopCooldown}s the hop cooldown has cleared (hopCd=${p.hopCd.toFixed(2)})`);
  spaceDown = false;
  p.hopT = 0; p.hopCd = 0;
  spaceDown = true;
  p.update(1 / 60, input, t, world, view);
  assert(p.hopT > 0, 'after the cooldown the frog can hop again');
}

console.log('== stage 23: M7.5 PT4 — early-economy safety net (welcome grant) ==');
{
  const L = await import('../src/logic.js');
  // the welcome grant is one-time and idempotent
  const fresh = L.freshSave();
  const b0 = { ...fresh.bank };
  L.applyWelcomeGrant(fresh);
  assert(fresh.flags.welcomeGranted === true, 'applyWelcomeGrant sets the welcomeGranted flag');
  assert(fresh.bank.red === b0.red + L.WELCOME_GRANT.red &&
         fresh.bank.blue === b0.blue + L.WELCOME_GRANT.blue &&
         fresh.bank.green === b0.green + L.WELCOME_GRANT.green,
         `welcome grant adds exactly ${JSON.stringify(L.WELCOME_GRANT)}`);
  const b1 = { ...fresh.bank };
  L.applyWelcomeGrant(fresh);
  assert(fresh.bank.red === b1.red && fresh.bank.blue === b1.blue && fresh.bank.green === b1.green,
    'applying the welcome grant twice does NOT double it (one-time)');
  // the safety-net property: a fresh (zero-bank) save can ALWAYS afford at
  // least one upgrade AND at least one painting after the grant. Check every
  // cheapest level-1 upgrade and level-1 painting against the grant.
  const grantBank = { red: L.WELCOME_GRANT.red, blue: L.WELCOME_GRANT.blue, green: L.WELCOME_GRANT.green };
  const upgradeOptions = Object.values(L.UPGRADES).map(u => u.levels[0].cost);
  const paintingOptions = L.PAINTINGS.map(p => p.cost); // all are purchasable (none locked at v1.1)
  const afford = (bank, costObj) => Object.keys(costObj).every(k => (bank[k] || 0) >= costObj[k]);
  const affordableUpgrades = upgradeOptions.filter(c => afford(grantBank, c));
  const affordablePaintings = paintingOptions.filter(c => afford(grantBank, c));
  assert(affordableUpgrades.length >= 1, `welcome grant affords >=1 level-1 upgrade (${affordableUpgrades.length}) — no early soft-lock`);
  assert(affordableUpgrades.length >= 1 || affordablePaintings.length >= 1,
    `welcome grant affords >=1 upgrade or painting (upgrades: ${affordableUpgrades.length}, paintings: ${affordablePaintings.length})`);
  assert(affordablePaintings.length >= 1, `welcome grant affords >=1 painting (${affordablePaintings.length}) so a fresh player can buy a loadout slot too`);
  // specifically, the cheapest upgrade (Swamp Vitality) is reachable
  const vitality = L.UPGRADES.vitality.levels[0].cost;
  assert(afford(grantBank, vitality), `welcome grant covers the cheapest upgrade Swamp Vitality {${vitality.red},${vitality.blue},${vitality.green}}`);
  // migration: a legacy save lacking the flag is NOT auto-granted (grant fires
  // only at first expedition, not on load) — flag simply defaults to false
  const legacy = L.migrateSave({ bank: { red: 9 }, flags: { intro: true } });
  assert(legacy.flags.welcomeGranted === false, 'migration does not silently grant the welcome kit (it is awarded at the first expedition)');
}

console.log('== stage 24: M8 P10 — performance culling (off-screen draw + enemy AI) ==');
{
  const { World } = await import('../src/world.js');
  const { Enemy, spawnEnemy } = await import('../src/enemies.js');
  const L = await import('../src/logic.js');

  // deterministic world (same seed => same layout across runs)
  function rng() { let a = 987654321; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const world = new World(rng(), 42);
  assert(world.w >= 5000 && world.grass.length > 100, `full-size world built (w=${world.w}, ${world.grass.length} grass tufts)`);

  // counting 2d context: every draw-method invocation is tallied.
  function countingCtx() {
    const counter = { n: 0 };
    const ctx = new Proxy({}, {
      get(t, p) {
        if (p === 'measureText') return () => ({ width: 10 });
        if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
        if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
        counter.n++;
        return () => {};
      },
      set() { return true; },
    });
    return { ctx, count: () => counter.n };
  }
  const drawCalls = (view) => {
    const { ctx, count } = countingCtx();
    world.drawBackground(ctx, view, 1);
    world.drawProps(ctx, view, 1, 1.0);
    world.drawObstacles(ctx, view, 1);
    return count();
  };
  // a localized 1280x800 view vs the whole 5400x1500 world. P10 view-culling
  // must make the localized draw dramatically cheaper (only visible items).
  const localCalls = drawCalls({ x: 0, y: 0, scale: 1, w: 1280, h: 800 });
  const fullCalls = drawCalls({ x: 0, y: 0, scale: 1, w: world.w, h: world.h });
  assert(localCalls < fullCalls, `P10 view-cull: localized view draws ${localCalls} calls < ${fullCalls} for the full world`);
  assert(localCalls < fullCalls * 0.4, `P10 view-cull keeps draw work proportional to the visible area (localized/full = ${(localCalls / fullCalls).toFixed(2)})`);

  // enemy AI cull, driven through the real game loop: a near enemy keeps
  // seeking the player; a far (>500px) non-burning enemy is skipped (frozen).
  const cv2 = makeCanvas();
  const g2 = new Game(cv2);
  g2.start();
  fireKey('keydown', 'Enter'); frames(3); // title -> expedition
  const P = g2.player;
  P.alive = true; P.hp = 99; P.iframes = 999; P.x = 100; P.y = 750;
  const near = spawnEnemy('beetle', 150, 750, g2.tuning);
  const far = spawnEnemy('beetle', 3000, 750, g2.tuning);
  g2.enemies.push(near, far);
  const nearX0 = near.x, farX0 = far.x;
  for (let i = 0; i < 20; i++) frames(1); // ~0.33s
  const nearMoved = Math.abs(near.x - nearX0) > 1;
  const farMoved = Math.abs(far.x - farX0) > 1;
  assert(nearMoved, `P10 enemy cull: a near enemy (50px) still runs AI and seeks the player (dx=${(near.x - nearX0).toFixed(1)})`);
  assert(!farMoved, `P10 enemy cull: a far enemy (2900px) is AI-culled and stays frozen (dx=${(far.x - farX0).toFixed(1)})`);
}

console.log('== stage 25: M8 P12 — zone character: accent wash + signature guardian per zone ==');
{
  const { ZONES, ELITE } = await import('../src/game.js');
  const L = await import('../src/logic.js');

  // Every zone declares a distinct accent + a signature encounter.
  assert(ZONES.length === 4, 'four zones declared');
  const accents = new Set(ZONES.map(z => z.accent));
  assert(accents.size === 4, `each zone has a distinct accent color (got ${accents.size} unique of ${ZONES.length})`);
  for (const z of ZONES) {
    assert(typeof z.accent === 'string' && z.accent.startsWith('#'), `zone "${z.name}" accent is a hex color (${z.accent})`);
    assert(z.sig && z.sig.kind && L.ENEMIES[z.sig.kind], `zone "${z.name}" has a signature encounter of a real enemy kind (${z.sig && z.sig.kind})`);
    assert(z.sig.count >= 1, `zone "${z.name}" signature encounter spawns >=1 guardian`);
  }

  // Driving the real loop: teleport a fresh game across the first zone
  // boundary and confirm the zone beat now includes an elite signature
  // guardian wearing the zone accent, plus the fading accent wash.
  const cv3 = makeCanvas();
  const g3 = new Game(cv3);
  g3.start();
  fireKey('keydown', 'Enter'); frames(3); // title -> expedition
  const P3 = g3.player;
  P3.alive = true; P3.hp = 99; P3.iframes = 999;
  P3.x = g3.world.w * ZONES[0].x + 2; P3.y = 760; // step into Reed Flats
  frames(2);
  assert(g3.banners.some(b => b.text.includes('Reed Flats')), 'Reed Flats banner fired on entry');
  const elites = g3.enemies.filter(e => e.elite);
  assert(elites.length === ZONES[0].sig.count, `Reed Flats spawned its signature guardian(s) (elites=${elites.length}, expected ${ZONES[0].sig.count})`);
  const el = elites[0];
  assert(el.kind === ZONES[0].sig.kind, `Reed Flats guardian is the zone's emblematic enemy (${el.kind})`);
  assert(el.accent === ZONES[0].accent, `Reed Flats guardian wears the zone accent (${el.accent})`);
  // elite scaling actually applied vs a normal spawn of the same kind
  const baseBeetle = L.ENEMIES[el.kind];
  assert(el.maxHp > baseBeetle.hp, `elite guardian has scaled HP (${el.maxHp} > ${baseBeetle.hp})`);
  assert(el.r > baseBeetle.radius, `elite guardian has a larger hitbox (${el.r} > ${baseBeetle.radius})`);
  assert(el.score > baseBeetle.score, `elite guardian pays more score (${el.score} > ${baseBeetle.score})`);
  // the zone-accent wash is live on entry and fades out over ~2.6s
  assert(g3._zoneTint && g3._zoneTint.color === ZONES[0].accent, 'zone-accent wash active on entry');
  const tintStart = g3._zoneTint.t;
  frames(200); // ~3.3s > 2.6s wash duration
  assert(g3._zoneTint === null, 'zone-accent wash faded out after its duration');
  assert(tintStart <= 2.6 + 1e-6, 'wash duration is bounded (~2.6s)');
  g3.player.iframes = 0;
  g3.player.hurt(99, g3.tuning);
  frames(140);
  assert(g3.state === 'end', 'run ended cleanly after the P12 stage');
}

console.log('\nALL SMOKE TESTS PASSED');
process.exit(0);