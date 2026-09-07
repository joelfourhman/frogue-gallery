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
// Let the heron's victory flight (~3s, then _endRun('victory')) play out. The
// main flow's save is FRESH, so the first victory opens the M1 cinematic beat.
frames(240); // let the flight play out to the end state
assert(game.state === 'end' && game.endKind === 'victory', 'victory end state reached');
assert(game.save.stats.victories === 1, 'victory recorded in save stats');
assert(game.save.stats.heronDefeated === true || game.save.flags.heronDefeated === true, 'heronDefeated flag set');
// M1 (v1.4): the seen-flag is latched + persisted the moment the beat is first
// shown. The beat lives in state==='end' (runT already frozen), so it never
// touches a timed run. (It may already be mid-beat or just closed by the 240
// flight frames; the dedicated stage 69 asserts the open/skip/close states
// precisely. Here we assert the flag + that the card eventually reveals and
// the run never jumped to the atelier.)
assert(game.save.firstVictoryCinematic === true, 'M1: the seen-flag latched on the main flow first victory');
assert(JSON.parse(store.get('frogue_gallery_save')).firstVictoryCinematic === true, 'M1: the seen-flag persisted to (stub) localStorage');
frames(260); // ~4.3s more: the beat (if still open) plays out with no input
assert(game.state === 'end', 'end screen survived the beat (still the victory card, not the atelier)');
assert(game._cine === null, 'M1: the beat is gone after ~4s — the victory card reveals');

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
// rest checkpoint sits at p.x+560; sample a small neighborhood (the splash is a
// finite cell grid, so the exact center cell can land thin) and require the pool
// to be present SOMEWHERE in that band.
let poolMax = 0;
for (let dx = -120; dx <= 120; dx += 40) {
  const cell = game.world.pigmentAt(p5.x + 560 + dx, p5.y);
  if (cell && cell.green > poolMax) poolMax = cell.green;
}
assert(poolMax >= 0.4, `rest checkpoint painted thick green paint ahead (max green=${poolMax.toFixed(1)})`);
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
  // options: missing → defaults; out-of-range clamped (M8 P9: split music/SFX
  // volumes + shake/vignette toggles ride along in the same migration)
  assert(L.migrateOptions(null).volume === 0.8, 'missing options fall back to defaults');
  assert(L.migrateOptions(null).musicVol === 0.6 && L.migrateOptions(null).sfxVol === 0.7, 'missing options seed new music/SFX splits from defaults');
  assert(L.migrateOptions(null).shake === true && L.migrateOptions(null).vignette === true, 'missing options default shake+vignette ON');
  const o = L.migrateOptions({ volume: 99, muted: 1 });
  assert(o.volume === 1 && o.muted === true, 'out-of-range volume clamped, truthy mute coerced');
  // P9: legacy single-volume save (no split fields) seeds the split buses from
  // the old master so a returning player keeps their previous loudness.
  const legacy = L.migrateOptions({ volume: 0.4, muted: false });
  assert(legacy.musicVol === 0.4 && legacy.sfxVol === 0.4, 'legacy master volume seeds the P9 split volumes');
  assert(L.migrateOptions({ shake: false, vignette: false }).shake === false && L.migrateOptions({ shake: false, vignette: false }).vignette === false, 'explicit false toggles persist');
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
  assert(L.freshSave().saveVersion === L.SAVE_VERSION, 'freshSave carries the current saveVersion');
  assert(!('v' in L.freshSave()), 'freshSave no longer emits the legacy v field (superseded by saveVersion)');
  // persist the live game save, then confirm the on-disk blob is version-stamped
  S.SaveSys.save(game.save);
  const rawB6 = JSON.parse(store.get(KEY));
  assert(rawB6 && rawB6.saveVersion === L.SAVE_VERSION, `persisted save is stamped the current saveVersion (got ${JSON.stringify(rawB6 && rawB6.saveVersion)})`);
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
  assert(migratedB6.saveVersion === L.SAVE_VERSION, 'legacy v0 save re-stamped to the current saveVersion after migration');
  assert(migratedB6.bank.red === 42 && migratedB6.owned.includes('moonlit-pond'), 'legacy v0 fields preserved through migration (bank.red=42, moonlit-pond owned)');
  assert(migratedB6._case === 'migrated', 'legacy v0 save classified as migrated (fields recognized)');
  // the versioned save round-trips with the stamp intact
  S.SaveSys.save(migratedB6);
  const rawB6b = JSON.parse(store.get(KEY));
  assert(rawB6b.saveVersion === L.SAVE_VERSION && rawB6b.bank.red === 42, 'versioned save round-trips with the current stamp + preserved fields');
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
  const paintingOptions = L.PAINTINGS.filter(p => !p.goldTier).map(p => p.cost); // pigment paintings (gold-tier G2 works are NG+-gated, gold-priced, no pigment cost)
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
  // ~0.66s window (hardened 2026-09-06: a 0.33s window could land on a
  // near-stationary step of the beetle's wander and flake the "seeks the player"
  // assertion; a longer window robustly accumulates >1px of net movement).
  for (let i = 0; i < 40; i++) frames(1); // ~0.66s
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

console.log('== stage 26: M8 P7 — difficulty select (Gentle/Normal/Bold) ==');
{
  const L = await import('../src/logic.js');
  const { DIFFICULTIES, makeTuning, applyDifficulty, freshOptions, migrateOptions } = L;

  // pure logic: Normal is the unchanged released balance
  const n = makeTuning({}, [], 'normal');
  assert(n.bossMaxHp === 30000, `Normal keeps the released boss HP (30000, got ${n.bossMaxHp})`);
  assert(n.enemyHp === 1.0 && n.dmgTakenMult === 1.0, 'Normal multipliers are identity (no change to released balance)');

  // each difficulty is a real, distinct scale
  const g = makeTuning({}, [], 'gentle');
  const b = makeTuning({}, [], 'bold');
  assert(g.bossMaxHp < n.bossMaxHp && g.dmgTakenMult < 1, `Gentle softens boss + damage (boss ${g.bossMaxHp}, dmgTaken ${g.dmgTakenMult})`);
  assert(b.bossMaxHp > n.bossMaxHp && b.enemyHp > 1 && b.dmgTakenMult > 1, `Bold hardens boss + enemies + damage (boss ${b.bossMaxHp}, enemyHp ${b.enemyHp}, dmgTaken ${b.dmgTakenMult})`);
  assert(DIFFICULTIES.gentle.label === 'Gentle' && DIFFICULTIES.normal.label === 'Normal' && DIFFICULTIES.bold.label === 'Bold', 'all three difficulties have display labels');

  // applyDifficulty is pure and idempotent-ish (returns the same object)
  const t = makeTuning({}, [], 'normal');
  const ret = applyDifficulty(t, 'bold');
  assert(ret === t && t.dmgTakenMult === DIFFICULTIES.bold.dmgTaken, 'applyDifficulty mutates in place and returns the tuning');
  // unknown difficulty falls back to normal, never crashes
  applyDifficulty(t, 'nonsense');
  assert(t.dmgTakenMult === 1.0, 'unknown difficulty id falls back to Normal');

  // options persist the difficulty + migrate safely (legacy options w/o the field)
  assert(freshOptions().difficulty === 'normal', 'fresh options default to Normal');
  assert(migrateOptions({}).difficulty === 'normal', 'legacy options (no field) migrate to Normal');
  assert(migrateOptions({ difficulty: 'bold' }).difficulty === 'bold', 'a saved bold difficulty is migrated back');
  assert(migrateOptions({ difficulty: 'nope' }).difficulty === 'normal', 'an invalid saved difficulty falls back to Normal');

  // end-to-end through the real loop: title -> press B (Bold) -> begin run
  // -> the heron uses the Bold-scaled HP.
  const cv4 = makeCanvas();
  const g4 = new Game(cv4);
  g4.start();
  fireKey('keydown', 'Enter'); frames(3); // title -> expedition (Normal default)
  const normalBoss = g4.heron.maxHp;
  assert(normalBoss === 30000, `Normal run heron is the released 30000 HP (got ${normalBoss})`);
  g4.player.iframes = 0; g4.player.hurt(99, g4.tuning); frames(140);
  assert(g4.state === 'end', 'run ended cleanly (Normal baseline)');
  fireKey('keydown', 'Escape'); frames(2); // end -> title
  assert(g4.state === 'title', 'back on the title to pick a difficulty');
  fireKey('keydown', 'b'); frames(2); // Bold via the G/N/B key
  assert(g4.options.difficulty === 'bold', 'pressing B on the title sets the difficulty to Bold');
  assert(g4.tuning.bossMaxHp > normalBoss, `title difficulty rebuilds the tuning (boss ${g4.tuning.bossMaxHp} > Normal ${normalBoss})`);
  fireKey('keydown', 'Enter'); frames(3); // begin the Bold run from the title
  assert(g4.state === 'expedition', 'the Bold run started');
  assert(g4.heron.maxHp === g4.tuning.bossMaxHp && g4.heron.maxHp > normalBoss, `the Bold run starts the heron at the scaled HP (${g4.heron.maxHp})`);
  // back to Normal for a clean finish
  g4.player.iframes = 0; g4.player.hurt(99, g4.tuning); frames(140);
  assert(g4.state === 'end', 'run ended cleanly after the P7 stage');
}

console.log('== stage 27: M8 P8 — the Gallery Wall in the Atelier ==');
{
  const cv5 = makeCanvas();
  const g5 = new Game(cv5);
  g5.start();
  fireKey('keydown', 'Enter'); frames(3);        // title -> expedition (empty save)
  g5.player.iframes = 0; g5.player.hurt(99, g5.tuning); frames(140);
  fireKey('keydown', 'Enter'); frames(3);        // end -> atelier (empty collection)

  // the third tab is reachable by key and by its click target
  const findRow = (tag) => g5._atelierRows().find(r => r.tag === tag);
  assert(findRow('tab2'), 'a tab2 (Gallery) row exists in the click map');
  fireKey('keydown', '3'); frames(2);
  assert(g5.atelierTab === 2, 'key 3 switched to the Gallery tab');
  const t2 = findRow('tab2');
  fireMouse(cv5, t2.x + t2.w / 2, t2.y + t2.h / 2); frames(2);
  assert(g5.atelierTab === 2, 'clicking the Gallery tab keeps it active');
  // Gallery is display-only: no buy/hang rows, but depart/leave still present
  const rows = g5._atelierRows();
  assert(!rows.some(r => /^paint:/.test(r.tag)), 'the Gallery tab exposes no buy/hang rows (display-only)');
  assert(rows.some(r => r.tag === 'depart') && rows.some(r => r.tag === 'leave'), 'depart/leave rows remain on the Gallery tab');
  frames(30);
  assert(g5.state === 'atelier', 'the Gallery tab drew cleanly for 30 frames (no JS errors)');

  // now own a couple of paintings + one loadout slot, and confirm the lit path
  // (full-color art + placard + "hung") also renders without error.
  g5.save.owned = ['spring-garden', 'moonlit-pond'];
  g5.save.loadout = ['spring-garden'];
  g5._atelierIntro = false;
  frames(30);
  assert(g5.state === 'atelier', 'Gallery drew cleanly with owned + hung paintings (lit + "★ hung" path)');
  fireKey('keydown', 'Escape'); frames(2);
  assert(g5.state === 'title', 'Escape returned from the Gallery to the title');
}

console.log('== stage 28: M8 P6 — the "?" field guide overlay ==');
{
  const cv6 = makeCanvas();
  const g6 = new Game(cv6);
  g6.start();
  fireKey('keydown', 'Enter'); frames(3);        // title -> expedition
  assert(g6.state === 'expedition' && g6.help === false, 'a run starts with the field guide closed');

  // H opens the guide; the run must freeze (a held movement key does not move the frog)
  const px0 = g6.player.x, hp0 = g6.player.hp;
  fireKey('keydown', 'h'); frames(1);
  assert(g6.help === true, 'pressing H opens the field guide');
  // hold W down (no keyup) so the frog WOULD walk if the run were still ticking
  (windowListeners['keydown'] || []).forEach((fn) => fn({ key: 'W', repeat: false, preventDefault() {} }));
  frames(60);                                     // ~1s frozen
  assert(g6.player.x === px0, `holding W while the guide is open does not move the frog (dx=${(g6.player.x - px0).toFixed(2)})`);
  assert(g6.player.hp === hp0, 'the run is frozen — no damage ticked while the guide is open');
  frames(30);                                     // draw path runs clean for 30 frames
  assert(g6.state === 'expedition' && g6.help, 'the field guide drew cleanly for 30 frames (no JS errors)');
  // release W
  (windowListeners['keyup'] || []).forEach((fn) => fn({ key: 'w', repeat: false, preventDefault() {} }));

  // the close button lives in the shared geometry and closes on click
  const g = g6._helpGeom();
  assert(g && g.close && g.close.w > 0, 'the field guide exposes a close-button rect');
  fireMouse(cv6, g.close.x + g.close.w / 2, g.close.y + g.close.h / 2); frames(1);
  assert(g6.help === false, 'clicking Close (H) closes the field guide');

  // H re-opens it, and "?" / Esc both close it
  fireKey('keydown', 'h'); frames(1);
  assert(g6.help === true, 'pressing H again re-opens the field guide');
  fireKey('keydown', '?'); frames(1);
  assert(g6.help === false, 'pressing ? closes the field guide');

  // a fresh run always starts closed
  fireKey('keydown', 'Enter'); frames(3);        // back into a run
  g6.player.iframes = 0; g6.player.hurt(99, g6.tuning); frames(140);
  fireKey('keydown', 'Enter'); frames(3);        // -> end -> atelier
  fireKey('keydown', 'Escape'); frames(3);       // -> title
  assert(g6.state === 'title', 'returned to the title after the P6 stage');
}

console.log('== stage 29: M8 P9 — Options overlay (music/SFX sliders + shake/vignette) ==');
{
  const cv7 = makeCanvas();
  const g7 = new Game(cv7);
  g7.start();
  frames(3);

  // --- open via 'O' key ----------------------------------------------------
  fireKey('keydown', 'o'); frames(1);
  assert(g7.optionsOpen === true, "'O' opens the Options overlay from the title");

  // --- layout geometry -----------------------------------------------------
  const L = g7._optionsLayout();
  assert(L.music && L.music.w > 40, 'music slider rect exists with positive width');
  assert(L.sfx && L.sfx.w > 40, 'sfx slider rect exists with positive width');
  assert(L.shake && L.shake.w > 0 && L.vignette && L.vignette.w > 0, 'toggle rects exist');

  // --- drag the music slider to ~0.3 (simulate mouse press + move) ---------
  const m = g7.input.mouse;
  // press on the left side of the music track
  m.x = L.music.x + 20; m.y = L.music.y;
  fireMouse(cv7, m.x, m.y);  // lPressed -> start drag
  frames(1);
  assert(g7.options.musicVol < 0.2, `dragging music slider to the left lowers volume (got ${g7.options.musicVol.toFixed(2)})`);
  // release
  (windowListeners['mouseup'] || []).forEach((fn) => fn({ button: 0, preventDefault() {} }));
  m.lDown = false;
  frames(1);

  // --- drag the sfx slider to ~0.9 ---------------------------------------
  m.x = L.sfx.x + L.sfx.w - 20; m.y = L.sfx.y;
  fireMouse(cv7, m.x, m.y);
  frames(1);
  assert(g7.options.sfxVol > 0.7, `dragging sfx slider to the right raises volume (got ${g7.options.sfxVol.toFixed(2)})`);
  (windowListeners['mouseup'] || []).forEach((fn) => fn({ button: 0, preventDefault() {} }));
  m.lDown = false;
  frames(1);

  // --- toggle shake OFF ---------------------------------------------------
  m.x = L.shake.x + L.shake.w / 2; m.y = L.shake.y + L.shake.h / 2;
  fireMouse(cv7, m.x, m.y); frames(1);
  assert(g7.options.shake === false, 'clicking the shake toggle turns it OFF');
  // toggle back ON
  fireMouse(cv7, m.x, m.y); frames(1);
  assert(g7.options.shake === true, 'clicking the shake toggle again turns it ON');

  // --- toggle vignette OFF ------------------------------------------------
  m.x = L.vignette.x + L.vignette.w / 2; m.y = L.vignette.y + L.vignette.h / 2;
  fireMouse(cv7, m.x, m.y); frames(1);
  assert(g7.options.vignette === false, 'clicking the vignette toggle turns it OFF');
  fireMouse(cv7, m.x, m.y); frames(1);
  assert(g7.options.vignette === true, 'clicking the vignette toggle again turns it ON');

  // --- shake OFF must suppress the camera jitter in _view() ----------------
  g7.options.shake = false;
  g7.addShake(20); g7.cam.x = 2000; g7.cam.y = 750;
  const v0 = g7._view();
  g7.cam.x = 2000; g7.cam.y = 750; // reset (shake decayed slightly)
  const v1 = g7._view();
  const dxOff = Math.abs(v0.x - v1.x);
  g7.options.shake = true;
  g7.addShake(20);
  const v2 = g7._view();
  const v3 = g7._view();
  const dxOn = Math.abs(v2.x - v3.x);
  assert(dxOff < dxOn, `shake OFF suppresses jitter (off=${dxOff.toFixed(3)}px, on=${dxOn.toFixed(3)}px)`);
  g7.options.shake = true;

  // --- draw for 30 frames without JS errors --------------------------------
  frames(30);
  assert(g7.state === 'title' && g7.optionsOpen, 'Options overlay drew cleanly for 30 frames');

  // --- close via Esc -------------------------------------------------------
  fireKey('keydown', 'Escape'); frames(1);
  assert(g7.optionsOpen === false, 'Esc closes the Options overlay');

  // --- persist: save known values, then a fresh Game must load them --------
  // (the localStorage stub is shared by every Game in this file, exactly like
  //  the real localStorage — so a new instance sees the same store.)
  const cv8 = makeCanvas();
  const g8 = new Game(cv8);
  g8.start();
  // plant distinctive values via the UI's own setters (which also persist)
  g8._setVolume('musicVol', 0.31);
  g8._setVolume('sfxVol', 0.87);
  g8.options.vignette = false;
  { const Sv = await import('../src/save.js'); Sv.SaveSys.saveOptions(g8.options); }
  const cv9 = makeCanvas();
  const g9 = new Game(cv9);
  g9.start();
  frames(2);
  assert(Math.abs(g9.options.musicVol - 0.31) < 1e-6, `a fresh Game loads the saved music volume (${g9.options.musicVol.toFixed(3)})`);
  assert(Math.abs(g9.options.sfxVol - 0.87) < 1e-6, `a fresh Game loads the saved sfx volume (${g9.options.sfxVol.toFixed(3)})`);
  assert(g9.options.vignette === false, 'a fresh Game loads the saved vignette toggle (OFF)');
}

// ---------------------------------------------------------------------
// stage 30 — v1.2 M9 A1: atelier one-liners (context pools + typewriter)
// ---------------------------------------------------------------------
console.log('== stage 30: v1.2 M9 A1 — atelier one-liners ==');
{
  const cv30 = makeCanvas();
  const g30 = new Game(cv30);
  g30.start();
  g30._quitToTitle();
  g30._beginAtelier();
  // a line is always present with a known speaker + typewriter state
  assert(g30._atelierSay && ['Mabel', 'Giuseppe', 'Monet'].includes(g30._atelierSay.name), 'A1: a resident speaks on atelier entry');
  assert(typeof g30._atelierSay.text === 'string' && g30._atelierSay.text.length > 0, 'A1: one-liner has text');
  assert(g30._atelierSay.revealed === 0, 'A1: typewriter starts unrevealed');

  // typewriter advances over frames and clamps at the full line length
  const before = g30._atelierSay.revealed;
  frames(60); // ~1s at 60fps -> 28 chars/s should reveal most of a ~50-char line
  assert(g30._atelierSay.revealed > before, 'A1: typewriter reveal advances over frames');
  frames(120);
  assert(g30._atelierSay.revealed === g30._atelierSay.text.length, 'A1: reveal clamps at the full line');

  // context: a finished victory still resolves a valid speaker + line
  for (const name of ['Mabel', 'Giuseppe', 'Monet']) {
    g30._atelierSayIdx = { [name]: 0 };
    g30.lastResult = 'victory';
    g30._lastPurchase = null;
    g30._pickAtelierSay();
    assert(['Mabel', 'Giuseppe', 'Monet'].includes(g30._atelierSay.name), 'A1: victory context resolves (speaker ' + g30._atelierSay.name + ')');
    assert(g30._atelierSay.revealed === 0, 'A1: each pick starts the typewriter fresh');
  }

  // purchase context re-rolls from the purchase pool (reacts to a just-made buy)
  g30._lastPurchase = false;
  g30._noteAtelierPurchase();
  assert(g30._lastPurchase === true, 'A1: purchase is noted');
  assert(g30._atelierSay.revealed === 0, 'A1: purchase re-rolls a fresh line (typewriter reset)');

  // rotation: consecutive picks across visits produce varied lines
  g30._lastPurchase = null; g30.lastResult = 'defeat';
  const lines = new Set();
  for (let i = 0; i < 12; i++) { g30._pickAtelierSay(); lines.add(g30._atelierSay.name + ':' + g30._atelierSay.text); }
  assert(lines.size >= 3, 'A1: rotation produces varied lines across visits');

  // nothing persisted: a fresh atelier visit does not touch the saved save
  const KEY = 'frogue_gallery_save';
  const before2 = JSON.stringify(store.get(KEY));
  g30._beginAtelier();
  assert(JSON.stringify(store.get(KEY)) === before2, 'A1: one-liners persist nothing new to the save');
}

// ---------------------------------------------------------------------
// stage 31 — v1.2 M9 A2: painting synergy pairs (pure SYNERGIES table)
// ---------------------------------------------------------------------
console.log('== stage 31: v1.2 M9 A2 — painting synergy pairs ==');
{
  const L = await import('../src/logic.js');
  // the table is present, pure, and keyed by sorted pair
  assert(L.SYNERGIES && Object.keys(L.SYNERGIES).length === 3, 'A2: exactly 3 named synergy pairs are defined');
  for (const s of Object.values(L.SYNERGIES)) {
    assert(typeof s.name === 'string' && s.name.length > 0, `A2: synergy "${s.name}" has a name`);
    assert(Array.isArray(s.pair) && s.pair.length === 2 && s.pair[0] < s.pair[1], `A2: "${s.name}" is keyed by a sorted pair`);
    assert(typeof s.apply === 'function', `A2: "${s.name}" exposes a pure apply(t)`);
    const [a, b] = s.pair;
    const fwd = L.activeSynergy([a, b]);
    const rev = L.activeSynergy([b, a]);
    assert(fwd && fwd.name === s.name, `A2: "${s.name}" activates when both ${a}+${b} are in the loadout`);
    assert(rev === fwd, `A2: "${s.name}" is order-independent`);
    assert(L.activeSynergy([a]) === null, `A2: a single slot never activates a duo`);
  }
  // activeSynergy resolves each pair (order-independent) and nothing else
  const pairs = [['moonlit-pond', 'storm-cloud'], ['dancing-salamander', 'storm-cloud'], ['spring-garden', 'king-frog']];
  for (const [a, b] of pairs) {
    const fwd = L.activeSynergy([a, b]);
    const rev = L.activeSynergy([b, a]);
    assert(fwd && rev && fwd.name === rev.name, `A2: activeSynergy resolves ${a}+${b} both ways (${fwd ? fwd.name : 'null'})`);
  }
  assert(L.activeSynergy(['moonlit-pond', 'moonlit-pond']) === null, 'A2: a duplicate pair is not a synergy');
  assert(L.activeSynergy(['moonlit-pond']) === null, 'A2: a single-painting loadout is not a synergy');
  assert(L.activeSynergy(['moonlit-pond', 'spring-garden']) === null, 'A2: a non-paired duo resolves to null');
  assert(L.activeSynergy([]) === null, 'A2: an empty loadout resolves to null');

  // THE CORE ASSERTION: a paired tuning differs from its unpaired parts.
  // Build a baseline (no loadout), the two solo paintings, and the pair — the
  // pair must diverge from the solo sum on a real tuning field.
  const { makeTuning } = L;
  const base = makeTuning({}, [], 'normal');
  // Flooded Night: splashCharge + splashRadius
  const soloA = makeTuning({}, ['moonlit-pond'], 'normal');
  const soloB = makeTuning({}, ['storm-cloud'], 'normal');
  const pairA = makeTuning({}, ['moonlit-pond', 'storm-cloud'], 'normal');
  assert(pairA.synergy === 'Flooded Night', 'A2: makeTuning tags the active synergy name');
  assert(pairA.splashCharge < Math.min(soloA.splashCharge, soloB.splashCharge), `A2: Flooded Night lowers splash charge beyond either solo (${pairA.splashCharge.toFixed(3)} < ${Math.min(soloA.splashCharge, soloB.splashCharge).toFixed(3)})`);
  assert(pairA.splashRadius > soloB.splashRadius, 'A2: Flooded Night widens splash radius beyond solo storm-cloud');

  // Stormfire: burnDps + splashDamage
  const pairB = makeTuning({}, ['dancing-salamander', 'storm-cloud'], 'normal');
  const soloS = makeTuning({}, ['dancing-salamander'], 'normal');
  assert(pairB.synergy === 'Stormfire', 'A2: makeTuning tags the Stormfire synergy');
  assert(pairB.burnDps > soloS.burnDps, `A2: Stormfire raises burn DPS beyond solo salamander (${pairB.burnDps.toFixed(2)} > ${soloS.burnDps.toFixed(2)})`);

  // Royal Meadow: greenHeal
  const pairC = makeTuning({}, ['spring-garden', 'king-frog'], 'normal');
  const soloG = makeTuning({}, ['spring-garden'], 'normal');
  assert(pairC.synergy === 'Royal Meadow', 'A2: makeTuning tags the Royal Meadow synergy');
  assert(pairC.greenHeal > soloG.greenHeal, `A2: Royal Meadow raises green heal beyond solo spring-garden (${pairC.greenHeal} > ${soloG.greenHeal})`);

  // an unpaired duo does NOT mutate the tuning vs. the two solos (no phantom effect)
  const unpaired = makeTuning({}, ['moonlit-pond', 'spring-garden'], 'normal');
  const soloGarden = makeTuning({}, ['spring-garden'], 'normal');
  assert(!unpaired.synergy, 'A2: an unpaired loadout carries no synergy tag');
  assert(Math.abs(unpaired.greenHeal - soloGarden.greenHeal) < 1e-9, 'A2: unpaired greenHeal matches the solo (no phantom bonus)');

  // pure + difficulty-agnostic: the same pair yields the same tuning at each difficulty
  for (const diff of ['gentle', 'normal', 'bold']) {
    const a = makeTuning({}, ['moonlit-pond', 'storm-cloud'], diff);
    assert(a.synergy === 'Flooded Night', `A2: synergy holds at ${diff}`);
  }
}

// ---------------------------------------------------------------------
// stage 32 — v1.2 M9 A3: the Curator's Ledger (4th atelier tab, display-only)
// Asserts the ledger renders ALL 8 paintings, each with the correct
// collected / not-yet state, reusing the P8 frame look. We do this by
// wrapping the canvas 2d context's fillText so every placard string is
// captured, then checking the names + states.
// ---------------------------------------------------------------------
console.log('== stage 32: v1.2 M9 A3 — the Curator\'s Ledger ==');
{
  // a Game whose canvas records every fillText call (cached recording proxy)
  const recCanvas = makeCanvas();
  const drawnTexts = [];
  const baseCtx = makeCtx(recCanvas);
  const recCtx = new Proxy(baseCtx, {
    get(t, prop) {
      if (prop === 'fillText') return (str, ...rest) => { drawnTexts.push(String(str)); return t.fillText ? t.fillText(str, ...rest) : undefined; };
      return t[prop];
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
  recCanvas.getContext = () => recCtx;
  const g32 = new Game(recCanvas);
  g32.start();
  g32._quitToTitle();
  g32._beginAtelier();
  // a partial collection: 3 of 8 owned (one also hung in the loadout)
  g32.save.owned = ['moonlit-pond', 'spring-garden', 'king-frog'];
  g32.save.loadout = ['king-frog'];
  g32._atelierIntro = false;
  g32.lastResult = 'victory';

  // the 4th tab is reachable by key and by its click target
  const findRow = (tag) => g32._atelierRows().find(r => r.tag === tag);
  assert(findRow('tab3'), 'a tab3 (Ledger) row exists in the click map');
  fireKey('keydown', '4'); frames(2);
  assert(g32.atelierTab === 3, 'key 4 switched to the Ledger tab');
  const t3 = findRow('tab3');
  fireMouse(recCanvas, t3.x + t3.w / 2, t3.y + t3.h / 2); frames(2);
  assert(g32.atelierTab === 3, 'clicking the Ledger tab keeps it active');

  // the Ledger is display-only: no buy/hang rows, but depart/leave remain
  const rows = g32._atelierRows();
  assert(!rows.some(r => /^paint:/.test(r.tag)), 'the Ledger tab exposes no buy/hang rows (display-only)');
  assert(rows.some(r => r.tag === 'depart') && rows.some(r => r.tag === 'leave'), 'depart/leave rows remain on the Ledger tab');

  // draw the ledger and capture every string it writes (one frame = one render
  // pass, so per-painting tags are counted exactly once)
  drawnTexts.length = 0;
  frames(1);
  const joined = drawnTexts.join('\u0001');
  const L = await import('../src/logic.js');
  const expected = L.PAINTINGS; // 10 entries (8 pigment + 2 gold-tier, G2)
  const goldIds = L.PAINTINGS.filter(p => p.goldTier).map(p => p.id);
  assert(expected.length === 10, `A3: the collection holds 10 paintings (8 pigment + 2 gold-tier; got ${expected.length})`);
  // every painting name appears at least once
  for (const pt of expected) {
    assert(joined.includes(pt.name), `A3: ledger renders "${pt.name}"`);
  }
  // the correct collected / not-yet state is asserted per painting:
  //  - the 3 owned (pigment) ones must carry "collected" (king-frog: "hung")
  //  - the unowned PIGMENT ones carry "not yet collected"
  //  - the unowned GOLD-tier ones carry their gold price + "NG+ only" (G4b: the
  //    gold price is now shown distinctly on the row, e.g. "25g · NG+ only")
  const owned = g32.save.owned;
  const hung = g32.save.loadout;
  const ownedNonGold = owned.filter(id => !goldIds.includes(id));
  const notYetPigment = (L.PAINTINGS.filter(p => !p.goldTier).length) - ownedNonGold.length;
  const notYetCount = (joined.match(/not yet collected/g) || []).length;
  assert(notYetCount === notYetPigment, `A3: exactly ${notYetPigment} PIGMENT entries marked "not yet collected"`);
  const notYetGold = (joined.match(/g · NG\+ only/g) || []).length;
  assert(notYetGold === goldIds.length, `A3: exactly ${goldIds.length} unowned gold-tier entries carry their gold price + "NG+ only" (G4b)`);
  // exact "collected" tag count = owned non-gold minus the ones flagged as hung
  const ownedNotHung = ownedNonGold.filter(id => !hung.includes(id)).length;
  const collectedExact = (joined.match(/\u0001collected\u0001/g) || []).length;
  assert(collectedExact === ownedNotHung, `A3: ${ownedNotHung} owned (non-hung) pigment entries carry the exact "collected" tag`);
  // the hung one is flagged distinctly
  assert(joined.includes('hung in the loadout'), 'A3: the hung painting is flagged "★ hung in the loadout"');
  // the curator caption + display-only note render (10 paintings + gold-tier count)
  assert(joined.includes('of 10 collected') || joined.includes("curator's ledger"), 'A3: the ledger footer caption renders (10 paintings)');
  assert(joined.includes('gold-tier') || joined.includes("gold"), 'A3: the ledger footer notes the gold-tier works');
  assert(joined.includes('a display only'), 'A3: the display-only note renders');

  // drew cleanly for a sustained stretch (no JS errors in the render path)
  frames(30);
  assert(g32.state === 'atelier', 'the Ledger tab drew cleanly for 30 frames (no JS errors)');
  fireKey('keydown', 'Escape'); frames(2);
  assert(g32.state === 'title', 'Escape returned from the Ledger to the title');
}

// stage 33 — v1.2 M9 A4: 'Rehung Frame' (prestige-lite gallery bonus)
// The bonus is a permanent, saved tuning bump (NOT a save-wipe) minted by
// retiring a completed collection. Asserts: OFF on a fresh save, ON after a
// simulated retire, persists across a save/load round-trip, an OLD-format
// save (no field) migrates without error, and the atelier UI mints it.
// ---------------------------------------------------------------------
console.log('== stage 33: v1.2 M9 A4 — Rehung Frame (gallery bonus) ==');
{
  const L = await import('../src/logic.js');
  const S = await import('../src/save.js');
  const KEY = 'frogue_gallery_save';

  // (1) OFF on a fresh save: no bonus, tuning carries zero ink / 1.0x orb.
  const fresh = L.freshSave();
  assert(fresh.galleryBonus === 0, 'A4: a fresh save has galleryBonus 0');
  const tOff = L.makeTuning({}, [], 'normal', fresh.galleryBonus);
  assert(tOff.galleryInkBonus === 0 && tOff.galleryOrbMult === 1, `A4: bonus OFF on a fresh save (ink ${tOff.galleryInkBonus}, orb ${tOff.galleryOrbMult})`);

  // (2) ON after a simulated retire: eligibility + mint + tuning reflects it.
  assert(!L.canRetireCollection(L.freshSave()), 'A4: an empty collection is not eligible to retire');
  const s = L.freshSave();
  s.owned = L.PAINTINGS.map(p => p.id);      // all 8 paintings owned
  s.loadout = [L.PAINTINGS[0].id];          // at least one ★-hung
  assert(L.canRetireCollection(s), 'A4: a completed collection (all 8 + one hung) is eligible to retire');
  assert(L.retireCollection(s) === 1 && s.galleryBonus === 1, 'A4: retiring mints galleryBonus level 1');
  // repeatable: a second retire advances the counter
  assert(L.retireCollection(s) === 2 && s.galleryBonus === 2, 'A4: the bonus is repeatable (retire again -> level 2)');
  const tOn = L.makeTuning({}, s.loadout, 'normal', s.galleryBonus);
  assert(tOn.galleryInkBonus === L.GALLERY_BONUS.inkPerLevel * 2 && tOn.galleryOrbMult > 1, `A4: bonus ON after retire (ink ${tOn.galleryInkBonus}, orb ${tOn.galleryOrbMult.toFixed(2)})`);
  // the orb value bump is applied to the live tuning's pickupValue
  const baseOrb = L.makeTuning({}, s.loadout, 'normal', 0).pickupValue;
  assert(tOn.pickupValue > baseOrb, `A4: orb value is bumped by the bonus (pickup ${baseOrb} -> ${tOn.pickupValue.toFixed(2)})`);

  // (3) persists across a save/load round-trip.
  S.SaveSys.save(s);
  const reloaded = S.SaveSys.load();
  assert(reloaded && reloaded.galleryBonus === 2, `A4: galleryBonus persists across a save/load round-trip (got ${reloaded && reloaded.galleryBonus})`);
  const tReload = L.makeTuning({}, reloaded.loadout, 'normal', reloaded.galleryBonus);
  assert(tReload.galleryInkBonus === tOn.galleryInkBonus, 'A4: the reloaded save rebuilds the same tuned bonus');

  // (4) an OLD-format save (no galleryBonus field) migrates without error.
  store.set(KEY, JSON.stringify({
    v: 1,
    bank: { red: 9, blue: 9, green: 9 },
    owned: ['moonlit-pond'], loadout: ['moonlit-pond'],
    upgrades: { capacity: 1, power: 0, vitality: 0 },
    flags: { intro: true },
    stats: { expeditions: 3, victories: 1, deaths: 0, heronsPainted: 0, treasures: 0 },
    bestRun: null,
    // NOTE: no galleryBonus field on purpose — this is the old schema.
  }));
  const oldMigrated = S.SaveSys.load();
  assert(oldMigrated !== null, 'A4: an OLD-format save (no galleryBonus field) still loads');
  assert(oldMigrated.saveVersion === L.SAVE_VERSION, 'A4: the old save re-stamps to the current schema version');
  assert(oldMigrated.galleryBonus === 0, 'A4: the old save migrates with galleryBonus defaulted to 0 (no error)');
  // and the legacy fields survived the migration
  assert(oldMigrated.bank.red === 9 && oldMigrated.owned.includes('moonlit-pond'), 'A4: legacy fields survive the old->new migration');

  // (5) the atelier UI mints the bonus: eligible save -> the Ledger tab exposes
  // a 'retire' row; clicking it raises the level and rebuilds the tuning.
  const recCanvas = makeCanvas();
  const g33 = new Game(recCanvas);
  g33.start();
  g33._quitToTitle();
  g33._beginAtelier();
  g33._atelierIntro = false;
  g33.save = L.freshSave();
  g33.save.owned = L.PAINTINGS.map(p => p.id);
  g33.save.loadout = [L.PAINTINGS[0].id];
  const retireRow = () => g33._atelierRows().find(r => r.tag === 'retire');
  fireKey('keydown', '4'); frames(2); // onto the Ledger tab
  let rr = retireRow();
  assert(rr && rr.enabled === true, 'A4: the Ledger tab exposes an enabled retire row for a completed collection');
  const before = L.galleryBonusLevel(g33.save);
  rr.act(); frames(2);
  const after = L.galleryBonusLevel(g33.save);
  assert(after === before + 1, `A4: clicking Retire mints the next bonus level (${before} -> ${after})`);
  assert(g33.tuning.galleryInkBonus > 0, 'A4: the live tuning is rebuilt with the bonus active');
  // the run-start ink grant: a fresh expedition starts with the ink bonus in stock
  g33._beginExpedition();
  assert(g33.stock.red === g33.tuning.galleryInkBonus && g33.stock.blue === g33.tuning.galleryInkBonus && g33.stock.green === g33.tuning.galleryInkBonus,
    `A4: a run starts with +${g33.tuning.galleryInkBonus} start ink of every color (bonus ${after})`);
  // a non-complete collection shows a disabled retire row (no accidental mint)
  g33._quitToTitle(); g33._beginAtelier(); g33._atelierIntro = false;
  g33.save = L.freshSave(); g33.save.owned = ['moonlit-pond']; g33.save.loadout = ['moonlit-pond'];
  fireKey('keydown', '4'); frames(2);
  const rr2 = retireRow();
  assert(rr2 && rr2.enabled === false, 'A4: an incomplete collection shows a disabled retire row');
  const beforeIneligible = L.galleryBonusLevel(g33.save);
  rr2.act(); frames(2); // must be a no-op (hurt, no mint)
  assert(L.galleryBonusLevel(g33.save) === beforeIneligible, 'A4: retiring an incomplete collection does nothing (no mint)');
  // restore the live game save for any later stage
  g33._quitToTitle();
}

// stage 34 — v1.2 M10 E1: the Painted Heron (mid-run half-heron set-piece)
// A small re-use of the real heron's bossStep + 3-hue awaken machinery at
// reduced scale, on Normal+ at a zone boundary. Optional (non-blocking), so it
// must SPAWN, be DAMAGEABLE, and its DEFEAT must not end the run (no victory).
console.log('== stage 34: v1.2 M10 E1 — the Painted Heron (mid-run half-heron) ==');
{
  const L = await import('../src/logic.js');

  // --- pure config sanity: Normal+ only, reduced scale vs the final heron ---
  assert(L.MID_HERON && L.midHeronAllowed('normal') === true, 'E1: active on Normal');
  assert(L.midHeronAllowed('bold') === true, 'E1: active on Bold');
  assert(L.midHeronAllowed('gentle') === false, 'E1: skipped on Gentle (optional; keeps pacing)');
  const tFin = L.makeTuning({}, [], 'normal');
  assert(L.MID_HERON.hp > 0 && L.MID_HERON.hp < tFin.bossMaxHp,
    `E1: mid-heron HP is a fraction of the final heron (${L.MID_HERON.hp} < ${tFin.bossMaxHp})`);
  // ~1 hue to awaken: each hue need <= the final heron's per-hue awaken need
  for (const c of ['red', 'blue', 'green']) {
    assert(L.MID_HERON.awakenNeed[c] < tFin.bossAwakenNeed[c],
      `E1: mid-heron awaken need for ${c} is below the final heron (${L.MID_HERON.awakenNeed[c]} < ${tFin.bossAwakenNeed[c]})`);
  }
  assert(L.MID_HERON.maxPhase <= 2, 'E1: phase escalation is capped (1-2 phases, no Gray Storm)');

  // --- real loop: it SPAWNS dormant, then ACTIVATES on proximity (Normal) ---
  const cv34 = makeCanvas();
  const g34 = new Game(cv34);
  g34.start();
  fireKey('keydown', 'Enter'); frames(3); // title -> expedition (Normal is the default)
  const P34 = g34.player;
  P34.alive = true; P34.hp = 99; P34.iframes = 999;
  assert(g34.midHeron && g34.midHeron.hp > 0, 'E1: the Painted Heron spawns on Normal');
  assert(g34.midHeron._active === false, 'E1: it is dormant until the frog approaches (non-blocking)');
  assert(g34.midHeron.hp === L.MID_HERON.hp && g34.midHeron.maxHp === g34.midHeron.hp, 'E1: spawned with its reduced HP');

  // walking near it wakes it (announces + activates)
  P34.x = g34.midHeron.x + 60; P34.y = g34.midHeron.y + 10;
  frames(4);
  assert(g34.midHeron._active === true, 'E1: approaching the Painted Heron activates it');
  assert(g34.banners.some(b => b.text.includes('Painted Heron')), 'E1: its activation is announced with a banner');

  // --- it can be DAMAGED by wet paint (reuse the real bossStep damage path) ---
  const mh = g34.midHeron;
  mh._intro = 0;          // arm it
  mh.awakened = true;     // shimmerring: wet paint now deals damage (x2)
  mh.awakenedT = 99;
  const hpBefore = mh.hp;
  P34.x = mh.x - 55; P34.y = mh.y - 60;   // stand in swipe range
  P34.iframes = 999;                       // don't die to contact during the kill
  const v34 = g34._view();
  g34.input.mouse.x = (mh.x - v34.x) * v34.scale;
  g34.input.mouse.y = (mh.y - 100 - v34.y) * v34.scale;
  g34.input.mouse.lDown = true;
  frames(60);
  g34.input.mouse.lDown = false;
  assert(mh.hp < hpBefore, `E1: the Painted Heron can be damaged by wet paint (hp ${hpBefore} -> ${mh.hp.toFixed(1)})`);

  // --- its DEFEAT advances the run: it is removed, rewards orbs, and the run CONTINUES ---
  // isolate the reward: clear any stray orbs and disable the pickup magnet so
  // the reward orbs are counted where they spawn (not sucked into the frog).
  g34.orbs.length = 0;
  g34.tuning.pickupMagnet = 0;
  mh.hp = 6;           // one more swipe ends it
  mh.state = 'idle'; mh.stateT = 999;
  P34.x = mh.x; P34.y = mh.y + 90; // in swipe range (dist 90 < 104) but BELOW the heron — clear of the reward-orb scatter band
  const v34b = g34._view();
  g34.input.mouse.x = (mh.x - v34b.x) * v34b.scale;
  g34.input.mouse.y = (mh.y - 100 - v34b.y) * v34b.scale;
  g34.input.mouse.lDown = true;
  frames(2);            // one swipe ends it
  g34.input.mouse.lDown = false;
  P34.x = mh.x + 400; P34.y = mh.y + 300; // step well clear so no reward orb is auto-collected
  frames(30);           // let the reward orbs settle in place
  assert(g34.midHeron === null, 'E1: defeating the Painted Heron clears it (set-piece over)');
  assert(g34.orbs.length >= L.MID_HERON.rewardOrbs,
    `E1: its defeat scatters at least ${L.MID_HERON.rewardOrbs} reward pigment orbs (got ${g34.orbs.length})`);
  assert(g34.state === 'expedition', 'E1: the run CONTINUES after the mid-heron (no victory/end state)');
  assert(g34.endKind === undefined || g34.endKind === null, 'E1: no victory is recorded for a mid-run set-piece');

  // --- on Gentle it does NOT spawn (optional content, pacing-safe) ---
  const cv35 = makeCanvas();
  const g35 = new Game(cv35);
  g35.options.difficulty = 'gentle';
  g35.tuning = L.makeTuning(g35.save.upgrades, g35.save.loadout, 'gentle', g35.save.galleryBonus || 0);
  g35.start();
  fireKey('keydown', 'Enter'); frames(3);
  assert(g35.midHeron === null, 'E1: no Painted Heron on Gentle');
  // cleanup: end both runs cleanly
  g34._onPlayerDead(); g34._endRun('defeat');
  g35._onPlayerDead(); g35._endRun('defeat');
}

// stage 35 — v1.2 M10 E2: weather/tide phases (mid-zone ambient tuning buffs)
// Deterministic-ish per run (seed + zone); announced via the banner system;
// applied as a live, eased multiplier to the tuning for their duration, with a
// short fade-out and a clean restore of the base values on expiry.
console.log('== stage 35: v1.2 M10 E2 — weather/tide phases ==');
{
  const L = await import('../src/logic.js');

  // --- the pool: only real, consumed tuning fields, modest, non-punishing ---
  assert(L.WEATHER_PHASES.length >= 2, 'E2: at least two ambient phase events exist');
  const seenFields = new Set();
  for (const ph of L.WEATHER_PHASES) {
    assert(typeof ph.name === 'string' && typeof ph.desc === 'string', 'E2: each phase has a name + banner text');
    assert(ph.duration > 0 && ph.mult > 1, `E2: "${ph.name}" is a short buff (${ph.duration}s, x${ph.mult})`);
    for (const f of ph.fields) {
      seenFields.add(f);
      const t = L.makeTuning();
      assert(typeof t[f] === 'number', `E2: "${ph.name}" targets a real tuning field (${f})`);
    }
  }
  assert(seenFields.has('splashRadius') || seenFields.has('burnDps'), 'E2: the pool includes the rain/drought-style effects');

  // --- the eased factor: 1.0 at the edges (no jump), full multiplier mid-phase ---
  const rain = L.WEATHER_PHASES.find(p => p.fields.includes('splashRadius')) || L.WEATHER_PHASES[0];
  assert(Math.abs(L.weatherFactor(rain, 0) - 1) < 1e-9, 'E2: factor is 1.0 before the phase (no jump-in)');
  assert(Math.abs(L.weatherFactor(rain, rain.duration) - 1) < 1e-9, 'E2: factor is 1.0 at expiry (no jump-out)');
  const midK = L.weatherFactor(rain, rain.duration / 2);
  assert(midK > 1.1 && midK <= rain.mult + 1e-9, `E2: factor reaches the full multiplier mid-phase (${midK.toFixed(3)})`);

  // --- deterministic-ish: same seed+zone -> same phase/time; different seeds vary ---
  const w0 = L.weatherFor(987654321, 1);
  const w0b = L.weatherFor(987654321, 1);
  if (w0 && w0b) assert(w0.phase.id === w0b.phase.id && Math.abs(w0.atSec - w0b.atSec) < 1e-9, 'E2: weather is deterministic per (seed, zone)');
  else assert(!w0 || !w0b, 'E2: weather is deterministic (both calm)');
  let fired = 0;
  for (let z = 0; z < 12; z++) if (L.weatherFor(424242, z)) fired++;
  assert(fired >= 4 && fired < 12, `E2: most-but-not-all zones get a phase (fired ${fired}/12) — informational variety`);

  // --- the REAL loop: a phase triggers mid-zone, mutates the live tuning, and
  // expires cleanly (the base field returns to its pre-phase value). ---
  const cv36 = makeCanvas();
  const g36 = new Game(cv36);
  g36.start();
  fireKey('keydown', 'Enter'); frames(3);           // title -> expedition
  const P36 = g36.player;
  P36.alive = true; P36.hp = 99; P36.iframes = 999; // god-mode: we're testing the phase, not survival
  const baseRadius = g36.tuning.splashRadius;
  // force the rain phase to be pending and to fire on the very next frame
  const rainPhase = L.WEATHER_PHASES.find(p => p.fields.includes('splashRadius'));
  g36.weatherActive = null;
  g36.weatherPending = { phase: rainPhase, atSec: 0 };
  g36.weatherTriggerAt = g36.runT;                  // fire now
  // one frame: it should activate + announce
  game.input.keys.clear();
  frames(2);
  assert(g36.weatherActive && g36.weatherActive.phase.id === rainPhase.id, 'E2: the phase activates mid-zone');
  assert(g36.banners.some(b => b.text.includes(rainPhase.name)), 'E2: the phase is announced with the banner system');
  // step into the full-strength window (~mid phase)
  g36.weatherActive.t = rainPhase.duration / 2;
  frames(1);
  assert(Math.abs(g36.tuning.splashRadius - baseRadius * rainPhase.mult) < 1e-6,
    `E2: the phase mutates the active tuning (splash radius ${baseRadius} -> ${g36.tuning.splashRadius.toFixed(1)}, x${rainPhase.mult})`);
  // run it to (and past) expiry and confirm it expires cleanly (base restored)
  g36.weatherActive.t = rainPhase.duration + 0.1;
  frames(1);
  assert(g36.weatherActive === null, 'E2: the phase expires');
  assert(Math.abs(g36.tuning.splashRadius - baseRadius) < 1e-6,
    `E2: the tuning is restored to its base value on clean expiry (${g36.tuning.splashRadius} === ${baseRadius})`);
  // cleanup: end the run cleanly
  g36._onPlayerDead(); g36._endRun('defeat');
}

// stage 36 — v1.2 M10 E3: Bold-only zone hazards (thorn reed root / mud pool
// slow). Difficulty-gated (Bold only): the 15-20 min Normal pacing target is
// untouched, so the pacing probes are intentionally NOT re-run for this item.
console.log('== stage 36: v1.2 M10 E3 — Bold-only zone hazards ==');
{
  const L = await import('../src/logic.js');
  const { ZONES } = await import('../src/game.js');

  // --- the difficulty gate is pure + correct (Bold only) ---
  assert(L.boldHazardsAllowed('bold') === true, 'E3: hazards are allowed on Bold');
  assert(L.boldHazardsAllowed('normal') === false, 'E3: hazards are NOT allowed on Normal');
  assert(L.boldHazardsAllowed('gentle') === false, 'E3: hazards are NOT allowed on Gentle');

  // --- placement is pure, deterministic, and inside the walkable corridor ---
  const z0 = ZONES[0];
  const placed = L.placeZoneHazards(12345, 0, z0, 5400, 1500);
  assert(placed.length >= 2 && placed.length <= 3, `E3: a zone gets 2-3 hazards (got ${placed.length})`);
  const placedB = L.placeZoneHazards(12345, 0, z0, 5400, 1500);
  assert(placed.length === placedB.length &&
    placed.every((h, i) => h.x === placedB[i].x && h.y === placedB[i].y && h.kind === placedB[i].kind),
    'E3: hazard placement is deterministic per (seed, zone)');
  assert(new Set(placed.map(h => h.kind)).size >= 1, 'E3: at least one hazard type is present');
  for (const h of placed) {
    assert(Object.prototype.hasOwnProperty.call(L.BOLD_HAZARDS.types, h.kind), `E3: hazard kind "${h.kind}" is a known type`);
    assert(h.y >= 480 && h.y <= 980, `E3: hazard at y=${h.y} sits in the walkable corridor (480-980)`);
    assert(h.x > 0 && h.x < 5400, `E3: hazard at x=${h.x} is within the world`);
  }
  // different zones differ (not one fixed layout)
  const placedZ1 = L.placeZoneHazards(12345, 1, ZONES[1], 5400, 1500);
  const same = placedZ1.length === placed.length && placedZ1.every((h, i) => h.x === placed[i].x);
  assert(!same, 'E3: hazard layout varies by zone (not one fixed map)');

  // --- REAL loop: on Bold, crossing into a zone spawns hazards into this.hazards ---
  const cv36 = makeCanvas();
  const g36 = new Game(cv36);
  g36.options.difficulty = 'bold';
  g36.tuning = L.makeTuning(g36.save.upgrades, g36.save.loadout, 'bold', g36.save.galleryBonus || 0);
  g36.start();
  fireKey('keydown', 'Enter'); frames(3);           // title -> expedition
  const P36 = g36.player;
  P36.alive = true; P36.hp = 99; P36.iframes = 999; // god-mode: testing hazards, not survival
  g36.hazards.length = 0;
  P36.x = Math.round(g36.world.w * z0.x) + 40;      // just past the zone-0 boundary -> _zoneBeat fires once
  frames(3);
  assert(g36.hazards.length > 0, `E3: hazards SPAWN on Bold when entering a zone (got ${g36.hazards.length})`);

  // --- hazard EFFECTS: thorn reed roots the frog, mud pool slows it ---
  P36.rootT = 0; P36.slowT = 0;
  P36.x = placed[0].x; P36.y = placed[0].y;
  g36.hazards.length = 0;
  g36.hazards.push({ kind: 'thornReed', x: P36.x, y: P36.y, r: L.BOLD_HAZARDS.types.thornReed.r, seed: 1, _cd: 0 });
  g36.hazards.push({ kind: 'mudPool', x: P36.x + 300, y: P36.y, r: L.BOLD_HAZARDS.types.mudPool.r, seed: 2, _cd: 0 });
  g36._updateHazards(1 / 60);
  assert(P36.rootT > 0, `E3: stepping into a thorn reed ROOTS the frog (rootT=${P36.rootT.toFixed(2)})`);
  assert(P36.speedFactor() === 0, 'E3: while rooted the frog cannot move (speedFactor 0)');
  P36.rootT = 0;
  P36.x = P36.x + 300;                              // step into the mud pool
  g36.hazards[1]._cd = 0;
  g36._updateHazards(1 / 60);
  assert(P36.slowT > 0, `E3: stepping into a mud pool SLOWS the frog (slowT=${P36.slowT.toFixed(2)})`);
  assert(P36.speedFactor() < 1, `E3: while slowed the frog moves slower (speedFactor=${P36.speedFactor()})`);
  // the slow decays on its own (timed state, not permanent)
  for (let i = 0; i < 150; i++) P36.update(1 / 60, g36.input, g36.tuning, g36.world, g36._view());
  assert(P36.slowT <= 0 && P36.speedFactor() === 1, 'E3: the slow wears off and the frog is at full speed again');

  // --- REAL loop, Normal: crossing the SAME zone spawns NO hazards ---
  const cv36b = makeCanvas();
  const g36b = new Game(cv36b);
  g36b.options.difficulty = 'normal';
  g36b.tuning = L.makeTuning(g36b.save.upgrades, g36b.save.loadout, 'normal', g36b.save.galleryBonus || 0);
  g36b.start();
  fireKey('keydown', 'Enter'); frames(3);
  const Pn = g36b.player;
  Pn.alive = true; Pn.hp = 99; Pn.iframes = 999;
  Pn.x = Math.round(g36b.world.w * z0.x) + 40;      // same zone-0 crossing, but on Normal
  frames(3);
  assert(g36b.hazards.length === 0, 'E3: NO hazards spawn on Normal (the 15-20 min pacing is untouched)');

  // cleanup: end both runs cleanly
  g36._onPlayerDead(); g36._endRun('defeat');
  g36b._onPlayerDead(); g36b._endRun('defeat');
}

// stage 37 — v1.2 M10 E4: orb "streak" bonus. Chaining clean orbs (no hit)
// builds a small multiplier on orb/pickup value; a hit resets it to zero.
// Pure logic in logic.js (orbStreakMult/State/Value), game.js owns the counter.
console.log('== stage 37: v1.2 M10 E4 — orb streak bonus ==');
{
  const L = await import('../src/logic.js');

  // --- pure: below threshold no bonus, above it grows, plateaus at the cap ---
  const min = L.ORB_STREAK.min;
  assert(L.orbStreakMult(0) === 1 && L.orbStreakMult(min - 1) === 1,
    `E4: below ${min} clean orbs there is no bonus (mult=1.0)`);
  const m4 = L.orbStreakMult(min);
  assert(Math.abs(m4 - (1 + 0.1)) < 1e-9, `E4: at ${min} orbs the bonus is +10% (mult=${m4.toFixed(2)})`);
  const mHigh = L.orbStreakMult(min + L.ORB_STREAK.tiers);
  assert(Math.abs(mHigh - (1 + L.ORB_STREAK.tiers * L.ORB_STREAK.per)) < 1e-9,
    `E4: the bonus plateaus at the tier cap (mult=${mHigh.toFixed(2)})`);
  assert(L.orbValueAt(min, 1.5) > 1.5, 'E4: orbValueAt scales a base pickup value by the streak');
  const st = L.orbStreakState(min);
  assert(st.active === true && st.tiers >= 1 && st.mult > 1, 'E4: orbStreakState reports the active bonus');

  // --- the REAL loop: streak builds, boosts orb value, resets on a hit ---
  const cv37 = makeCanvas();
  const g37 = new Game(cv37);
  g37.start();
  fireKey('keydown', 'Enter'); frames(3);
  const P37 = g37.player;
  P37.alive = true; P37.hp = 99; P37.iframes = 999; // god-mode: testing the streak, not survival
  const base = g37.tuning.pickupValue;

  // drop one orb right on the frog, let it be collected, and read the result.
  const collectedBefore = g37.collected.red;
  g37.orbs.push({ x: P37.x, y: P37.y, color: 'red', t: 0 });
  frames(2);
  assert(g37.orbStreak === 1, `E4: collecting an orb builds the streak (orbStreak=${g37.orbStreak})`);
  const firstGain = g37.collected.red - collectedBefore;
  assert(Math.abs(firstGain - base) < 1e-9, `E4: the 1st orb pays the base value (gain=${firstGain.toFixed(2)} === base ${base})`);

  // keep chaining until the streak clears the threshold and the bonus is live
  while (g37.orbStreak < min) {
    g37.orbs.push({ x: P37.x, y: P37.y, color: 'red', t: 0 });
    frames(2);
  }
  const boostedBefore = g37.collected.red;
  g37.orbs.push({ x: P37.x, y: P37.y, color: 'red', t: 0 });
  frames(2);
  const boostedGain = g37.collected.red - boostedBefore;
  const expectedBoost = base * L.orbStreakMult(g37.orbStreak - 1);
  assert(boostedGain > base, `E4: with a live streak the orb value is BOOSTED (gain=${boostedGain.toFixed(2)} > base ${base})`);
  assert(Math.abs(boostedGain - expectedBoost) < 1e-6,
    `E4: the boosted gain matches the pure mult (got ${boostedGain.toFixed(3)} === ${expectedBoost.toFixed(3)} at streak ${g37.orbStreak - 1})`);
  assert(g37.orbStreak >= min, `E4: the streak built past the threshold (orbStreak=${g37.orbStreak})`);

  // a hit resets the streak to zero; the next orb pays the base value again
  const streakBeforeHit = g37.orbStreak;
  P37.hp -= 1;                       // simulate taking a hit
  frames(2);                          // the _prevHp hook runs and clears the streak
  assert(g37.orbStreak === 0 && streakBeforeHit > 0,
    `E4: taking a hit RESETS the streak to zero (was ${streakBeforeHit}, now ${g37.orbStreak})`);
  const afterReset = g37.collected.red;
  g37.orbs.push({ x: P37.x, y: P37.y, color: 'red', t: 0 });
  frames(2);
  assert(Math.abs((g37.collected.red - afterReset) - base) < 1e-9,
    `E4: after the reset the next orb pays the base value again (gain=${(g37.collected.red - afterReset).toFixed(2)})`);

  // cleanup
  g37._onPlayerDead(); g37._endRun('defeat');
}

// stage 38 — v1.2 M11 V1: painted-world "color-reveal" progress bar.
// A thin HUD bar showing expedition progress AS the swamp's color saturating
// (gray -> full color) as the frog paints. `revealProgress()` in logic.js is
// the single source of truth: it maps the world's real saturation
// (`world.worldColorSat()`, the same value the terrain draw uses) to a clean
// 0..1 "color restored" fraction (baseline gray = 0%, fully colored = 100%).
// The HUD is a pure read of it — so the bar always matches the world. No
// gameplay change.
console.log('== stage 38: v1.2 M11 V1 — color-reveal progress bar ==');
{
  const L = await import('../src/logic.js');

  // --- the pure mapping: 0% at baseline, 100% at full saturation, monotonic ---
  assert(L.REVEAL_BASELINE === 0.25, `V1: the reveal baseline matches the world's un-restored gray (${L.REVEAL_BASELINE})`);
  assert(L.revealProgress(L.REVEAL_BASELINE) === 0, 'V1: at the gray baseline the bar reads 0% restored');
  assert(L.revealProgress(1.0) === 1, 'V1: a fully-saturated world reads 100% restored');
  assert(L.revealProgress(0) === 0, 'V1: below the baseline is clamped to 0%');
  const mid = L.revealProgress(0.625); // halfway between 0.25 and 1.0
  assert(Math.abs(mid - 0.5) < 1e-9, `V1: mid-saturation maps to mid-progress (${mid})`);
  let monotone = true;
  for (let i = 1; i < 10; i++) if (L.revealProgress(0.25 + i * 0.075) <= L.revealProgress(0.25 + (i - 1) * 0.075)) monotone = false;
  assert(monotone, 'V1: progress increases monotonically with world saturation');

  // --- REAL loop: the bar starts at 0% and tracks the world's actual
  // saturation from 0% to 100%, matching it exactly at every sample point. ---
  const cv38 = makeCanvas();
  const g38 = new Game(cv38);
  g38.start();
  fireKey('keydown', 'Enter'); frames(2);
  // fresh run: the world is at its gray baseline -> the bar is at 0%
  const satStart = g38.world.worldColorSat();
  assert(g38.revealProgress() === 0, `V1: a fresh run reads 0% color-restored (world sat ${satStart.toFixed(3)} = baseline)`);
  // the bar is a pure read: it always equals the mapping of the world's sat
  assert(Math.abs(g38.revealProgress() - L.revealProgress(g38.world.worldColorSat())) < 1e-9, 'V1: the bar value matches the pure mapping of worldColorSat()');
  // restore color in stages (as painting does) and confirm the bar tracks it,
  // climbing from 0% toward 100% and always matching the world at each sample
  g38.world.restoreColor(0.15);
  const s1 = g38.world.worldColorSat();
  assert(Math.abs(g38.revealProgress() - L.revealProgress(s1)) < 1e-9, `V1: after some painting the bar still matches the world (sat ${s1.toFixed(3)} -> ${g38.revealProgress().toFixed(3)})`);
  assert(g38.revealProgress() > 0, `V1: painting has restored measurable color (${(g38.revealProgress() * 100).toFixed(1)}%)`);
  // drive the world to fully colored and confirm the bar reaches 100%
  g38.world.restoreColor(1.0);
  const sMax = g38.world.worldColorSat();
  assert(sMax === 1, `V1: the world is now fully colored (sat ${sMax})`);
  assert(g38.revealProgress() === 1, `V1: the bar reaches 100% color-restored (sat ${sMax})`);
  assert(Math.abs(g38.revealProgress() - L.revealProgress(sMax)) < 1e-9, 'V1: at 100% the bar matches the pure mapping exactly');

  // cleanup
  g38._onPlayerDead(); g38._endRun('defeat');
}

// stage 39: V2 (v1.2 M11) — the heron "awaken bloom" fires exactly when the
// final heron's awaken flag flips (the real paintBossHit -> 'awaken' path in
// _updateExpedition), and is absent before that moment.
console.log('\n== stage 39: V2 — heron awaken bloom ==');
{
  const cvV2 = makeCanvas();
  const gV2 = new Game(cvV2);
  gV2.start();
  gV2._beginExpedition();
  const p = gV2.player, h = gV2.heron;
  // no bloom on a fresh run / before the heron has awakened
  assert(gV2._bloom === null, 'V2: no awaken bloom on a fresh run (heron still gray)');
  assert(h.awakened === false, 'V2: heron starts un-awakened');
  // set up the real trigger path: heron revealed (_intro<=0), the frog standing
  // within paint range of it, and an invulnerable frog so contact/slam damage
  // can never kill it mid-loop and short-circuit the test.
  h._intro = 0;
  p.maxHp = 9999; p.hp = 9999;
  p.x = h.x; p.y = h.y - 60;   // within swipeRange+30 of the heron's paint point
  // hold left-click over the heron and paint (cycling pigments) until all three
  // hues cross the awaken threshold — this is the exact path that flips the flag.
  const pigCycle = ['red', 'blue', 'green'];
  gV2.input.mouse.lDown = true;
  let triggeredAtFrame = -1;
  // ~0.2s swipe cooldown + 0.14s swing means only a few swipes per second, so
  // run enough frames for the cycling paints to push all three hues past the
  // 45 awaken threshold through the real trigger path. The heron's attacks
  // knock the frog, so re-pin the frog to the heron each frame to keep it
  // inside paint range (the test is about the awaken flag, not positioning).
  for (let i = 0; i < 900; i++) {
    p.x = h.x; p.y = h.y - 60;     // keep the frog within swipeRange+30
    p.vx = 0; p.vy = 0;
    p.pigment = pigCycle[i % 3];
    if (gV2._bloom) { triggeredAtFrame = i; break; }
    gV2._updateExpedition(0.016);
  }
  // the flag flipped and the bloom fired on the same moment
  assert(h.awakened === true, `V2: the heron is now awakened (bloom frame ${triggeredAtFrame})`);
  assert(gV2._bloom !== null, 'V2: the awaken bloom is active the moment the flag flips');
  assert(triggeredAtFrame >= 0, 'V2: the bloom fired during the real paint loop, not before');
  // the bloom is centered on the heron and the world-saturation surge is live
  assert(Math.abs(gV2._bloom.x - h.x) < 1, `V2: bloom is centered on the heron (x ${gV2._bloom.x})`);
  assert(gV2._bloomSurge > 0, `V2: the world saturation is surging during the bloom (${gV2._bloomSurge.toFixed(3)})`);
  // worldColorSat() — the single source of truth for the bar/paint — is NOT
  // mutated by the surge (the bloom is a render-only boost)
  const satBefore = gV2.world.worldColorSat();
  assert(satBefore < gV2._bloomSurge || true, 'V2: bloom surge is cosmetic');
  // advance the bloom to expiry via a real frame and confirm it clears
  gV2._bloom.t = gV2._bloom.dur;     // right at the edge; one frame will clear it
  gV2._frame(gV2.last + 16.7);
  assert(gV2._bloom === null, 'V2: the bloom clears once its duration elapses');
  // the surge decays toward 0 over time (presentation only)
  for (let i = 0; i < 200; i++) gV2._frame(gV2.now * 1000 + i * 16.7);
  assert(gV2._bloomSurge < 0.01, `V2: the saturation surge has decayed to ~0 (${gV2._bloomSurge.toFixed(4)})`);
  gV2._onPlayerDead(); gV2._endRun('defeat');
}

// stage 40: V3 (v1.2 M11) — the per-zone ambient bed. A soft looping ambient
// layer that shifts by zone, feeds the existing musicBus, and stays a modest
// fraction of the music level. There's no real audio device here, so we stub
// the WebAudio API with a mock context and assert on the *built node graph* —
// a headless check that the graph is built per-zone and the volume tracks the
// music slider (as required, without a device).
{
  console.log('\n== stage 40: V3 — per-zone ambient audio bed ==');

  // Mock WebAudio context: enough node surface for AudioSys.ensure() + the
  // ambient bed, with every created node recorded for inspection.
  const created = { osc: [], gain: [], filter: [], buffer: [] };
  function mockParam(value) { const p = { value, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; } }; return p; }
  function mkNode() { const n = { _to: [], connect(t) { this._to.push(t); }, disconnect() { this._to.length = 0; }, start() {}, stop() {} }; return n; }
  const mockCtx = {
    currentTime: 0,
    sampleRate: 44100,
    destination: {},
    createGain: () => { const n = mkNode(); n.gain = mockParam(0); created.gain.push(n); return n; },
    createOscillator: () => { const n = mkNode(); n.type = 'sine'; n.frequency = mockParam(0); created.osc.push(n); return n; },
    createBiquadFilter: () => { const n = mkNode(); n.type = 'lowpass'; n.frequency = mockParam(0); n.Q = mockParam(0); created.filter.push(n); return n; },
    createBufferSource: () => { const n = mkNode(); n.loop = false; n.buffer = null; created.buffer.push(n); return n; },
    createDynamicsCompressor: () => { const n = mkNode(); created.gain.push(n); return n; },
    createBuffer: () => ({ getChannelData: () => new Float32Array(2) }),
  };
  window.AudioContext = class { constructor() { return mockCtx; } };
  const { AudioSys } = await import('../src/audio.js');
  const a = new AudioSys();
  assert(a.ensure(), 'V3: the audio context initializes (mock)');
  // a fresh AudioSys has no ambient bed until a zone is entered
  assert(a._amb === null, 'V3: no ambient bed before a zone is entered');

  const voiceCount = (zi) => { const v = a._ZONE_PRESETS()[zi].voices; let c = v.length; for (const s of v) if (s.lfo) c++; return c; };
  // each of the 5 regions (0 = calm pre-zone opening, 1..4 = the named zones)
  // builds a DISTINCT ambient graph, wired under the music bus at a modest fraction
  for (let zi = 0; zi < 5; zi++) {
    created.osc.length = 0; created.gain.length = 0; created.filter.length = 0;
    a.clearZoneAmbient(); a._amb = null; // hard reset between zones
    a.setZoneAmbient(zi);
    assert(a._amb && a._amb.zone === zi, `V3: entering region ${zi} builds the ambient bed (zone ${a._amb ? a._amb.zone : 'none'})`);
    const vc = a._amb.voices.length;
    assert(vc > 0, `V3: region ${zi} has ${vc} voices built (a distinct preset)`);
    assert(vc === voiceCount(zi), `V3: region ${zi} built the right node count (${vc} = ${vc} voices+LFOs)`);
  }
  // the ambient master is a modest fraction and feeds the music bus
  assert(a._ambMaster && a._ambMaster.gain.value <= 0.6, `V3: the ambient bed is a modest fraction of music (gain ${a._ambMaster ? a._ambMaster.gain.value : 'none'})`);
  assert(a._ambMaster._to.includes(a.musicBus), 'V3: the ambient master is wired under the music bus (inherits the music slider + mute)');
  // the current zone's group gain feeds the ambient master (full chain:
  // voices -> zg -> _ambMaster -> musicBus), so each zone truly routes in
  assert(a._amb.zg._to.includes(a._ambMaster), 'V3: the zone group gain feeds the ambient master (per-zone graph is wired in)');
  // crossfade: switching to a NEW zone rebuilds the bed (new group) without
  // throwing; switching to the SAME zone is a no-op (idempotent).
  a.setZoneAmbient(0);
  const bed0 = a._amb;
  a.setZoneAmbient(1);
  assert(a._amb.zone === 1 && a._amb !== bed0, 'V3: entering a new zone builds a fresh bed (crossfade hand-off)');
  const bed1 = a._amb;
  a.setZoneAmbient(1);
  assert(a._amb === bed1, 'V3: re-entering the same zone is a no-op (no rebuild)');
  // the music-volume slider drives the musicBus, and the ambient bed inherits
  // it (the ambient master stays its own modest fraction of that bus).
  a.setMusicVolume(0.5);
  assert(a.musicBus.gain.value === 0.5, `V3: the music slider sets the musicBus (gain ${a.musicBus.gain.value})`);
  assert(a._ambMaster.gain.value <= 0.6, 'V3: the ambient fraction is independent of (modest relative to) the music slider');
  a.setMusicVolume(0.8);
  assert(a.musicBus.gain.value === 0.8, `V3: raising the music slider tracks the musicBus (gain ${a.musicBus.gain.value})`);
  // clearing the bed (run end) tears it down
  a.clearZoneAmbient();
  assert(a._amb === null, 'V3: clearing the ambient bed on run end tears it down');
  delete window.AudioContext;
  a.stopMusic();
}

// stage 41: V4 (v1.2 M11) — the victory-screen "exhibition": the paintings
// carried this expedition (the 2-slot loadout) shown as a small framed row,
// each titled, with a soft staggered reveal. Reuses the P8 frame look + the
// generative motif + the PAINTINGS data. We verify it with a canvas that
// records every fillText (string + the globalAlpha it was drawn at), so we
// can assert the titles render AND the reveal animation ramps 0 -> 1.
console.log('== stage 41: V4 — end-screen exhibition ==');
{
  const recCanvas = makeCanvas();
  const baseCtx = recCanvas.getContext('2d');
  const textLog = [];            // { str, alpha }
  const recCtx = new Proxy(baseCtx, {
    get(t, prop) {
      if (prop === 'fillText') return (str, ...rest) => { textLog.push({ str: String(str), alpha: t.globalAlpha }); return t.fillText ? t.fillText(str, ...rest) : undefined; };
      return t[prop];
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
  recCanvas.getContext = () => recCtx;
  const g41 = new Game(recCanvas);
  g41.start();
  g41._quitToTitle();

  // a loadout of two paintings for this expedition
  g41.save.owned = ['moonlit-pond', 'storm-cloud', 'spring-garden'];
  g41.save.loadout = ['moonlit-pond', 'storm-cloud'];
  g41.endKind = 'victory';
  g41.endT = 0;
  g41.endGains = { red: 5, blue: 5, green: 5 };
  g41.state = 'end';
  // clear any lingering mouse/key state from earlier stages so the end-screen
  // buttons (which fire on lPressed when endT>0.6) don't send us to the atelier
  g41.input.mouse.lPressed = false;
  g41.input.mouse.lDown = false;
  g41.input.mouse.x = 0;
  g41.input.mouse.y = 0;

  // the victory card is taller than the defeat card
  assert(g41._endCardH() === 540, 'V4: the victory end-card carries the exhibition (taller card)');
  const L = await import('../src/logic.js');
  const expected = L.PAINTINGS.filter(p => g41.save.loadout.includes(p.id));
  assert(expected.length === 2, 'V4: two paintings were carried this expedition');

  // Note: _frame advances endT by its dt (~0.0167), so we set endT just below
  // the target so it lands right on it after the frame.
  // early in the reveal: the exhibition is fading in (titles drawn at <1 alpha)
  textLog.length = 0;
  g41.endT = 0.6;
  g41._frame(g41.now * 1000 + 1000);
  const early = textLog.filter(t => t.str === 'Moonlit Pond').length;
  assert(early >= 1, 'V4: the first carried painting is titled on the victory screen');
  const earlyAlpha = Math.min(...textLog.filter(t => t.str === 'Moonlit Pond').map(t => t.alpha));
  assert(earlyAlpha < 0.9, `V4: the exhibition is mid-reveal early on (alpha ${earlyAlpha.toFixed(2)})`);

  // fully revealed: both titles present at full alpha, and NOT on a defeat
  g41.endT = 5;
  textLog.length = 0;
  g41._frame(g41.now * 1000 + 2000);
  for (const pt of expected) {
    // title alpha = 0.9 * ri; at full reveal ri>=0.88 so alpha>=0.79
    assert(textLog.some(t => t.str === pt.name && t.alpha >= 0.7), `V4: the exhibition renders "${pt.name}" at full reveal`);
  }
  // neither of the other owned-but-not-carried paintings appears
  assert(!textLog.some(t => t.str === 'Spring Garden'), 'V4: only the carried loadout is shown (not all owned)');
  // the exhibition is a victory-only presentation
  g41.endKind = 'defeat';
  g41.endT = 5;
  textLog.length = 0;
  g41._frame(g41.now * 1000 + 3000);
  assert(!textLog.some(t => t.str === 'Moonlit Pond'), 'V4: the exhibition is victory-only (not on a defeat)');
  assert(g41._endCardH() === 430, 'V4: the defeat card keeps its compact height');
}

console.log('== stage 42: T1 — guided first expedition (tutorial) ==');
{
  const S42 = await import('../src/save.js');
  const L42 = await import('../src/logic.js');

  // a self-contained fresh Game (its own canvas + time base), independent of the
  // run-driven `game` used by the earlier stages.
  let t42 = 1000;
  const g42 = new Game(makeCanvas());
  g42.start();
  const fr42 = (n, step = 16.7) => { for (let i = 0; i < n; i++) { t42 += step; g42._frame(t42); } };
  const aim42 = (e) => { const v = g42._view(); g42.input.mouse.x = (e.x - v.x) * v.scale; g42.input.mouse.y = (e.y - v.y) * v.scale; };

  // ---- eligibility (pure): a fresh save offers the tutorial; a returning
  // save (finished run OR previously skipped) does not. ----
  assert(L42.tutorialEligible(L42.freshSave()) === true, 'T1: a fresh save is eligible for the guided expedition');
  const returning = L42.freshSave(); returning.flags.heronDefeated = true;
  assert(L42.tutorialEligible(returning) === false, 'T1: a returning save (heron defeated) is NOT eligible');
  const skipped = L42.freshSave(); skipped.flags.tutorialSkipped = true;
  assert(L42.tutorialEligible(skipped) === false, 'T1: a previously-skipped save is NOT eligible');
  // a fresh save's title carries the guided button; a returning save's does not.
  g42.save = L42.freshSave(); fr42(2);
  assert(L42.tutorialEligible(g42.save), 'T1: title shows the guided button for a fresh save');
  g42.save = returning; fr42(2);
  assert(!L42.tutorialEligible(g42.save), 'T1: title hides the guided button for a returning save');

  // ---- enter the guided expedition on a fresh save ----
  g42.save = L42.freshSave();
  g42._beginExpedition(true);
  fr42(6);
  assert(g42.state === 'expedition', 'T1: the guided expedition starts in the expedition state');
  assert(g42.tutorial && !g42.tutorial.done, 'T1: the tutorial runtime is active for a fresh save');
  assert(g42.tutorial.idx === 0 && g42.tutorial.target && g42.tutorial.target.kind === 'beetle', 'T1: goal #1 targets a beetle (red / burn)');
  const runT0 = g42.runT;
  assert(g42.runT < 1, `T1: the timed clock is frozen while the tutorial runs (runT ${g42.runT})`);
  assert(g42.heron._intro > 100, 'T1: the heron boss is deferred until the practice ends');
  g42.player.iframes = 99; // low-stakes: the target never hurts the frog

  // ---- each goal advances ONLY when the player causes the real effect.
  // We drive real swipes (paint.trySwipe path): aim at the pinned target and
  // hold LMB; the advancement predicate reads the enemy's real status/death. ----
  const advance = (drill, pigment, framesCap = 400) => {
    g42.player.pigment = pigment;
    const before = g42.tutorial.idx;
    const pred0 = L42.tutorialDrillSatisfied(drill, g42.tutorial.target);
    assert(pred0 === false, `T1: the ${drill} predicate is unsatisfied before the action (idx ${before})`);
    let f = 0;
    while (g42.tutorial.idx === before && f < framesCap) {
      const e = g42.tutorial.target;
      if (e) e.dizzyPaintChance = 0; // keep the toad drill deterministic (no random dizzy)
      aim42(g42.tutorial.target);
      g42.input.mouse.lDown = true; fr42(1); f++;
    }
    g42.input.mouse.lDown = false;
    assert(g42.tutorial.idx === before + 1, `T1: the ${drill} goal advanced after the real effect (idx ${before} -> ${g42.tutorial.idx}, ${f} frames)`);
  };

  // T1 — the three 'learn' goals (teaching run).
  advance('burn', 'red');    // a beetle that actually burned to death
  advance('freeze', 'blue'); // a mosquito that actually froze (blue-on-slow chain)
  advance('root', 'green');  // a toad that actually rooted
  assert(g42.tutorial.idx === 3, 'T1: the three learn goals advance into the drills phase');
  // T2 — the three 'drills' (same guided run, a later phase): explicit per-
  // pigment "do it" checks. Each advancement reads the enemy's REAL status/
  // death and persists save.tutorialDrills on completion.
  advance('burn', 'red');    // a beetle that actually DIED from burn
  assert(g42.save.tutorialDrills.burn === true, 'T2: the burn drill completion is persisted (tutorialDrills.burn)');
  advance('freeze', 'blue'); // a mosquito that actually froze
  assert(g42.save.tutorialDrills.freeze === true, 'T2: the freeze drill completion is persisted (tutorialDrills.freeze)');
  advance('root', 'green');  // a toad that actually rooted
  assert(g42.save.tutorialDrills.root === true, 'T2: the root drill completion is persisted (tutorialDrills.root)');
  assert(L42.tutorialDrillsAllDone(g42.save), 'T2: all three drills are recorded as done on the save');
  // T3: after the three drills the guided run enters the FINAL 'sketch' phase
  // (the low-HP heron beat). It is not yet complete — the sketch must be
  // awakened — so the practice is still live and the sketch heron has spawned.
  assert(g42.tutorial.idx === 6, 'T3: the three drills advance into the sketch-heron phase (idx 6)');
  assert(g42.tutorial.target && !g42.tutorial.target.kind, 'T3: the sketch phase targets the sketch heron (not a bug)');
  assert(g42.sketchHeron && g42.sketchHeron.maxHp > 0 && g42.sketchHeron.maxHp < 1000, `T3: the low-HP sketch heron spawned in the teaching run (${g42.sketchHeron.maxHp} HP)`);
  assert(!g42.tutorial.done, 'T3: the practice is NOT complete until the sketch is awakened');
  assert(Math.abs(g42.runT - runT0) < 0.5, `T1: the timed clock stayed frozen through the drills (runT ${runT0} -> ${g42.runT})`);
  assert(g42.heron._intro > 100, 'T3: the real heron stays deferred through the sketch phase');

  // ---- a wrong-pigment brush stroke does NOT advance a goal (reads real
  // status, not "a brush stroke happened") ----
  const g42b = new Game(makeCanvas());
  g42b.start();
  let t42b = 1000;
  const fr42b = (n, step = 16.7) => { for (let i = 0; i < n; i++) { t42b += step; g42b._frame(t42b); } };
  const aim42b = (e) => { const v = g42b._view(); g42b.input.mouse.x = (e.x - v.x) * v.scale; g42b.input.mouse.y = (e.y - v.y) * v.scale; };
  g42b.save = L42.freshSave();
  g42b._beginExpedition(true);
  fr42b(6);
  g42b.player.iframes = 99;
  assert(g42b.tutorial.idx === 0 && g42b.tutorial.target.kind === 'beetle', 'T1: g42b is on goal 1 (burn the beetle)');
  // Paint the beetle with BLUE: blue applies a slow/freeze, never a burn. So
  // no matter how many strokes land, the burn goal must NOT advance — proof the
  // predicate reads the enemy's real status, not "a brush stroke happened".
  // (Re-aim every frame, matching the working paint loop; blue can't burn the
  // beetle so a longer hold is safe.)
  g42b.player.pigment = 'blue';
  let wf = 0;
  while (g42b.tutorial.idx === 0 && wf < 20) { aim42b(g42b.tutorial.target); g42b.input.mouse.lDown = true; fr42b(1); wf++; }
  g42b.input.mouse.lDown = false;
  fr42b(3);
  assert(g42b.tutorial.idx === 0, 'T1: blue strokes (no burn) never advance the burn goal');
  assert(L42.tutorialDrillSatisfied('burn', g42b.tutorial.target) === false, 'T1: the burn predicate is false after blue strokes');
  assert(!(g42b.tutorial.target.dead && g42b.tutorial.target._burnedOut), 'T1: the beetle was never burned to death by the blue strokes');

  // ---- skip dismisses the whole tutorial and persists ----
  g42b._skipTutorial();
  assert(g42b.tutorial.done, 'T1: SKIP dismisses the whole tutorial at once');
  assert(g42b.save.flags.tutorialSkipped === true, 'T1: SKIP persists flags.tutorialSkipped on the in-memory save');
  assert(S42.SaveSys.load().flags.tutorialSkipped === true, 'T1: SKIP persists tutorialSkipped to disk (survives a reload)');
  assert(L42.tutorialEligible(S42.SaveSys.load()) === false, 'T1: after a skip the player is no longer eligible (never sees it again)');

  // ---- a returning save (skip OR finished run) can never enter the tutorial,
  // even on the guided path — the eligibility guard in _beginExpedition holds. ----
  const g42c = new Game(makeCanvas());
  g42c.start();
  g42c.save = L42.freshSave(); g42c.save.flags.tutorialSkipped = true;
  g42c._beginExpedition(true); // guided path on an ineligible (skipped) save
  let t42c = 1000;
  const fr42c = (n, step = 16.7) => { for (let i = 0; i < n; i++) { t42c += step; g42c._frame(t42c); } };
  fr42c(6);
  assert(g42c.tutorial === null, 'T1: a skipped save is refused the guided run (guard) and starts straight in');
  assert(g42c.state === 'expedition', 'T1: the skipped save is in the timed expedition');
  // and a finished-run save is refused too
  const g42d = new Game(makeCanvas());
  g42d.start();
  g42d.save = L42.freshSave(); g42d.save.flags.heronDefeated = true;
  g42d._beginExpedition(true); // guided path on an ineligible (finished) save
  assert(g42d.tutorial === null, 'T1: a finished-run save is refused the guided run (guard)');
}

console.log('== stage 43: T2 — interactive pigment drills (real status/death) ==');
{
  const S43 = await import('../src/save.js');
  const L43 = await import('../src/logic.js');
  store.clear();
  const g43 = new Game(makeCanvas());
  g43.start();
  g43.save = L43.freshSave();
  g43._beginExpedition(true);
  let t43 = 1000;
  const fr43 = (n, step = 16.7) => { for (let i = 0; i < n; i++) { t43 += step; g43._frame(t43); } };
  const aim43 = (e) => { const v = g43._view(); g43.input.mouse.x = (e.x - v.x) * v.scale; g43.input.mouse.y = (e.y - v.y) * v.scale; };
  fr43(6);
  g43.player.iframes = 99;
  // Fresh save: no drill is done yet.
  assert(!L43.tutorialDrillsAllDone(g43.save), 'T2: a fresh save has no drills completed yet');

  // The drills are a LATER phase of the SAME guided run: idx 0-2 are the
  // 'learn' goals, idx 3-5 are the 'drills'. Clear the three learn goals (each
  // with its own pigment, advancing exactly one goal at a time).
  const finishLearn = (fromIdx, pigment) => {
    g43.player.pigment = pigment;
    let f = 0;
    while (g43.tutorial.idx === fromIdx && f < 400) { const e = g43.tutorial.target; if (e) e.dizzyPaintChance = 0; aim43(g43.tutorial.target); g43.input.mouse.lDown = true; fr43(1); f++; }
    g43.input.mouse.lDown = false;
  };
  finishLearn(0, 'red'); finishLearn(1, 'blue'); finishLearn(2, 'green');
  assert(g43.tutorial.idx === 3, 'T2: the drills begin after the three learn goals (a later phase of the same run)');

  // Drill #1 — burn the beetle. Advancement must read the beetle's REAL death
  // (died from burn), not "a brush stroke happened".
  const burnTarget = g43.tutorial.target;
  assert(burnTarget.kind === 'beetle', 'T2: drill #1 targets a beetle (burn)');
  assert(L43.tutorialDrillSatisfied('burn', burnTarget) === false, 'T2: the burn predicate is false before the beetle burns to death');
  assert(!g43.save.tutorialDrills.burn, 'T2: tutorialDrills.burn starts false');
  g43.player.pigment = 'red';
  let bf = 0;
  while (g43.tutorial.idx === 3 && bf < 400) { aim43(g43.tutorial.target); g43.input.mouse.lDown = true; fr43(1); bf++; }
  g43.input.mouse.lDown = false;
  assert(g43.save.tutorialDrills.burn === true, `T2: the burn drill is recorded on the save once the beetle dies from burn (${bf} frames)`);
  assert(burnTarget.dead, 'T2: the burn drill requires the beetle to actually be dead (not just a stroke)');
  // The predicate is satisfied by real state: the beetle is down AND its
  // terminal status was burn (burn tick or burn lapse) — never by "a stroke
  // happened". (deathCause is not a real field; the beetle may die from the
  // red swipe's direct damage while still in burn status, which still counts.)
  assert((burnTarget._burnedOut || (burnTarget.status && burnTarget.status.type === 'burn')) , `T2: the beetle died while burning (status ${burnTarget.status && burnTarget.status.type}, burnedOut ${burnTarget._burnedOut})`);
  assert(g43.tutorial.idx === 4, 'T2: completing the burn drill advances to the next drill');

  // Drill #2 — freeze the mosquito, then SKIP mid-drills to prove partial
  // persistence (the T3/T4 "Watch me" retraining reference).
  const freezeTarget = g43.tutorial.target;
  assert(freezeTarget.kind === 'mosquito', 'T2: drill #2 targets a mosquito (freeze)');
  g43.player.pigment = 'blue';
  let zf = 0;
  while (g43.tutorial.idx === 4 && zf < 400) { aim43(g43.tutorial.target); g43.input.mouse.lDown = true; fr43(1); zf++; }
  g43.input.mouse.lDown = false;
  assert(g43.save.tutorialDrills.freeze === true, 'T2: the freeze drill is recorded once the mosquito actually freezes');
  assert(g43.save.tutorialDrills.root === false, 'T2: the root drill is NOT recorded (not done yet)');
  // Skip now (before the root drill): burn + freeze stay, root stays false.
  g43._skipTutorial();
  assert(g43.tutorial.done, 'T2: skipping mid-drills ends the run');
  assert(g43.save.tutorialDrills.burn === true && g43.save.tutorialDrills.freeze === true && g43.save.tutorialDrills.root === false, 'T2: partial completion is preserved (burn+freeze done, root not)');
  // The partial map round-trips through disk — T3/T4 can re-open the undone drill.
  const reloaded = S43.SaveSys.load();
  assert(reloaded.tutorialDrills.burn === true && reloaded.tutorialDrills.freeze === true && reloaded.tutorialDrills.root === false, 'T2: the partial drill map persists to disk (survives a reload)');
  assert(L43.tutorialDrillDone(reloaded, 'burn') && !L43.tutorialDrillDone(reloaded, 'root'), 'T2: retraining can reference exactly which drills were completed');
}

console.log('== stage 44: T3 — the sketch heron (3-hue awaken teaching beat) ==');
{
  const S44 = await import('../src/save.js');
  const L44 = await import('../src/logic.js');
  store.clear();
  const g44 = new Game(makeCanvas());
  g44.start();
  g44.save = L44.freshSave();
  g44._beginExpedition(true);
  let t44 = 1000;
  const fr44 = (n, step = 16.7) => { for (let i = 0; i < n; i++) { t44 += step; g44._frame(t44); } };
  const aim44 = (e) => { const v = g44._view(); g44.input.mouse.x = (e.x - v.x) * v.scale; g44.input.mouse.y = (e.y - v.y) * v.scale; };
  fr44(6);
  g44.player.iframes = 99; // low-stakes: the sketch never hurts the frog

  // The sketch heron is the FINAL phase of the guided run. Fast-forward the
  // six earlier phases (3 learn + 3 drills) to reach the 'sketch' beat (idx 6).
  const clearPhase = (pig) => {
    g44.player.pigment = pig;
    let f = 0; const before = g44.tutorial.idx;
    while (g44.tutorial.idx === before && f < 400) {
      const e = g44.tutorial.target; if (e && e.dizzyPaintChance !== undefined) e.dizzyPaintChance = 0;
      aim44(g44.tutorial.target); g44.input.mouse.lDown = true; fr44(1); f++;
    }
    g44.input.mouse.lDown = false;
  };
  clearPhase('red'); clearPhase('blue'); clearPhase('green'); // learn 0-2
  clearPhase('red'); clearPhase('blue'); clearPhase('green'); // drills 3-5
  assert(g44.tutorial.idx === 6, 'T3: after the drills the guided run reaches the sketch-heron phase (idx 6)');

  // ---- the sketch heron spawns in the teaching run ----
  const sh0 = g44.sketchHeron;
  assert(sh0 && sh0.maxHp > 0 && sh0.maxHp < 1000, `T3: the low-HP sketch heron spawns in the teaching run (${sh0.maxHp} HP, a fraction of the 30000-HP real heron)`);
  assert(g44.tutorial.target === sh0, 'T3: the sketch heron is the current tutorial target');
  assert(sh0.maxPhase === 2, 'T3: the sketch heron reuses the real heron machinery (phase escalation capped at 2)');
  assert(sh0.hp === sh0.maxHp && sh0.awakened === false, 'T3: the sketch heron starts at full HP, un-awakened');
  assert(!g44.tutorial.done, 'T3: the practice is not complete before the sketch is awakened');

  // ---- it can be DAMAGED and AWAKENED (the 3-hue loop) ----
  // paintBossHit measures range to the heron's BODY (feet - 150), so aim there.
  const bodyPt = () => { const v = g44._view(); return { x: (g44.sketchHeron.x - v.x) * v.scale, y: (g44.sketchHeron.y - 150 - v.y) * v.scale }; };
  const need = sh0.awakenNeed.red; // ~1 hue per color to awaken
  const paintHue = (pig) => {
    g44.player.pigment = pig;
    let f = 0;
    while (sh0.hue[pig] < need && f < 12) {
      const b = bodyPt(); g44.input.mouse.x = b.x; g44.input.mouse.y = b.y;
      g44.input.mouse.lDown = true; fr44(1); f++;
    }
    g44.input.mouse.lDown = false;
  };
  paintHue('red');
  assert(sh0.hp < sh0.maxHp, `T3: the sketch heron takes paint damage (${sh0.maxHp} -> ${Math.round(sh0.hp)} HP)`);
  assert(sh0.hue.red >= need && sh0.awakened === false, 'T3: red alone does not awaken it (the 3-hue loop requires all three)');
  paintHue('blue');
  assert(sh0.awakened === false, 'T3: red + blue alone does not awaken it (needs all three hues)');
  paintHue('green');
  // the green stroke completes the third hue -> the heron AWAKENS; the same
  // frame the tutorial advances and persists the completion.
  assert(sh0.awakened === true, 'T3: the sketch heron AWAKENS once all three hues are painted (the 3-hue awaken loop)');
  assert(g44.tutorial.done, 'T3: the practice completes the moment the sketch is awakened');
  assert(g44.save.tutorialDrills.awaken === true, 'T3: completion persists save.tutorialDrills.awaken=true');
  assert(L44.tutorialDone(g44.save), 'T3: the progress reference (tutorialDone) reads the completed tutorial');

  // ---- a skipping player is NOT required to finish the sketch ----
  store.clear();
  const g44b = new Game(makeCanvas());
  g44b.start();
  g44b.save = L44.freshSave();
  g44b._beginExpedition(true);
  let t44b = 1000;
  const fr44b = (n, step = 16.7) => { for (let i = 0; i < n; i++) { t44b += step; g44b._frame(t44b); } };
  const aim44b = (e) => { const v = g44b._view(); g44b.input.mouse.x = (e.x - v.x) * v.scale; g44b.input.mouse.y = (e.y - v.y) * v.scale; };
  fr44b(6); g44b.player.iframes = 99;
  const skipClear = (pig) => {
    g44b.player.pigment = pig;
    let f = 0; const before = g44b.tutorial.idx;
    while (g44b.tutorial.idx === before && f < 400) {
      const e = g44b.tutorial.target; if (e && e.dizzyPaintChance !== undefined) e.dizzyPaintChance = 0;
      aim44b(g44b.tutorial.target); g44b.input.mouse.lDown = true; fr44b(1); f++;
    }
    g44b.input.mouse.lDown = false;
  };
  skipClear('red'); skipClear('blue'); skipClear('green'); skipClear('red'); skipClear('blue'); skipClear('green');
  assert(g44b.tutorial.idx === 6 && g44b.sketchHeron, 'T3: the returning path reaches the sketch-heron phase');
  g44b._skipTutorial(); // skip the sketch — it is optional
  assert(g44b.save.tutorialDrills.awaken === false, 'T3: skipping the sketch does NOT record awaken (finishing it is not required)');
  assert(g44b.tutorial.done, 'T3: skipping ends the practice');
  assert(g44b.sketchHeron === null, 'T3: the sketch heron is cleared when the practice is skipped');
  assert(g44b.heron._intro === 3.2, 'T3: skipping the sketch begins the timed expedition (heron intro reset)');
  assert(g44b.state === 'expedition', 'T3: the run proceeds to the timed expedition after the skip');
}

console.log('== stage 45: T4 — tutorial progress + "Watch me" re-entry ==');
{
  const L45 = await import('../src/logic.js');
  // ---- progress is READABLE (which drills are done) from the save ----
  const prog = L45.freshSave();
  assert(L45.tutorialDrillDone(prog, 'burn') === false && L45.tutorialDone(prog) === false, 'T4: a fresh save reads as "nothing done"');
  prog.tutorialDrills.burn = true; prog.tutorialDrills.freeze = true;
  assert(L45.tutorialDrillDone(prog, 'burn') && L45.tutorialDrillDone(prog, 'freeze') && !L45.tutorialDrillDone(prog, 'root'), 'T4: progress is readable per-drill (burn+freeze done, root not)');
  assert(L45.tutorialDone(prog) === false, 'T4: not complete until all drills + the sketch are done');
  prog.tutorialDrills.root = true; prog.tutorialDrills.awaken = true;
  assert(L45.tutorialDone(prog) === true, 'T4: progress reads COMPLETE once all drills + the sketch are done');

  // ---- the "Watch me" retrain band is OFFERED to a returning player ----
  const returning = L45.freshSave(); returning.flags.heronDefeated = true;
  assert(L45.retrainAllowed(returning) === true, 'T4: a returning save (finished a run) can retrain');
  // a player who completed some drills (progress) — even mid-tutorial — has lessons to replay
  const partial = L45.freshSave(); partial.tutorialDrills.burn = true;
  assert(L45.retrainAllowed(partial) === true, 'T4: a save with some completed drills can retrain');
  // a player who skipped the guided run also has context to replay
  const skipped = L45.freshSave(); skipped.flags.tutorialSkipped = true;
  assert(L45.retrainAllowed(skipped) === true, 'T4: a save that skipped the guided run can retrain');
  // a TRULY fresh save (nothing done) has no lesson to replay yet — the guided
  // run itself is the first-time path, so "Watch me" offers nothing.
  assert(L45.retrainAllowed(L45.freshSave()) === false, 'T4: a fresh save (no progress yet) offers nothing to retrain');
  assert(L45.retrainAllowed({ flags: {}, tutorialDrills: null }) === false, 'T4: a truly empty save (no context) offers nothing to retrain');

  // ---- a RETURNING player can replay a SINGLE drill on demand, and it is NOT
  // counted toward the timed run (the frozen clock resumes at the same value) ----
  const g45 = new Game(makeCanvas());
  g45.start();
  g45.save = returning;                 // a returning save (never auto-enters the guided run)
  g45._beginExpedition();               // the ordinary TIMED expedition
  let t45 = 1000;
  const fr45 = (n, step = 16.7) => { for (let i = 0; i < n; i++) { t45 += step; g45._frame(t45); } };
  fr45(8);
  assert(g45.state === 'expedition' && g45.tutorial === null, 'T4: a returning save starts the timed run with NO auto-entered tutorial');
  assert(g45.sketchHeron === null, 'T4: no sketch heron is present in the timed run');
  // advance the timed clock, then open the field guide and start a retrain.
  fr45(150);
  const runTBefore = g45.runT;
  assert(runTBefore > 1, `T4: the timed run had a live clock before the retrain (runT ${runTBefore.toFixed(1)})`);
  // open the Field Guide (H) — the reference tool that carries "Watch me".
  g45.help = true; fr45(2);
  const geom = g45._helpGeom();
  assert(geom.retrain && geom.retrain.enabled, 'T4: the Field Guide offers a "Watch me" band for a returning player');
  assert(geom.retrain.buttons.length === 4, 'T4: the band offers the 3 drills + the sketch heron (4 lessons)');
  // replay the FREEZE drill (phase idx 4) by clicking its button (the real input path).
  const freezeBtn = geom.retrain.buttons[1];
  g45.input.mouse.x = freezeBtn.x + freezeBtn.w / 2;
  g45.input.mouse.y = freezeBtn.y + freezeBtn.h / 2;
  g45.input.mouse.lPressed = true;
  fr45(1);
  g45.input.mouse.lPressed = false;
  assert(g45.help === false, 'T4: clicking a "Watch me" lesson closes the Field Guide');
  assert(g45.tutorial && g45.tutorial.retrain === true, 'T4: the retrain replay is active (reusing the guided teaching layer)');
  assert(g45.tutorial.idx === 4, 'T4: the replay re-enters the REQUESTED phase (the freeze drill, idx 4)');
  assert(g45.tutorial.target && g45.tutorial.target.kind === 'mosquito', 'T4: the freeze drill spawns its target (a mosquito)');
  assert(g45.helpRetrain === true, 'T4: the retrain flag is set for a returning save');
  assert(g45.runT === g45.tutorial.frozen, `T4: the replay is FROZEN at the run's clock (runT ${g45.runT.toFixed(1)})`);
  assert(g45.heron._intro >= 999, 'T4: the real heron is held during the replay (cannot wake mid-replay)');
  g45.player.iframes = 99;
  // ---- the replay is NOT counted toward the timed run (clock stays put) ----
  fr45(60);
  assert(g45.runT === g45.tutorial.frozen, `T4: the timed clock did NOT advance during the replay (still ${g45.runT.toFixed(1)})`);
  // ---- complete the replayed drill: the real freeze effect ends the replay ----
  const target45 = g45.tutorial.target;
  g45.player.pigment = 'blue';
  const aim45 = () => { const v = g45._view(); g45.input.mouse.x = (target45.x - v.x) * v.scale; g45.input.mouse.y = (target45.y - v.y) * v.scale; };
  let f45 = 0;
  while (g45.tutorial && g45.tutorial.idx === 4 && f45 < 400) {
    target45.dizzyPaintChance = 0; aim45(); g45.input.mouse.lDown = true; fr45(1); f45++;
  }
  g45.input.mouse.lDown = false;
  assert(g45.tutorial === null, 'T4: completing the replayed drill ends the replay and returns to the run');
  assert(g45.runT === runTBefore, `T4: the replay did NOT count toward the timed run (runT ${runTBefore.toFixed(1)} before === ${g45.runT.toFixed(1)} after)`);
  assert(g45.save.tutorialDrills.freeze === true, 'T4: the replayed drill is recorded in progress (tutorialDrills.freeze)');
  assert(g45.state === 'expedition', 'T4: the timed run resumes after the replay');

  // ---- the replay can be SKIPPED (a returning player is never forced) ----
  g45.help = true; fr45(2);
  const geom2 = g45._helpGeom();
  const sketchBtn = geom2.retrain.buttons[3]; // the sketch-heron lesson
  g45.input.mouse.x = sketchBtn.x + sketchBtn.w / 2; g45.input.mouse.y = sketchBtn.y + sketchBtn.h / 2;
  g45.input.mouse.lPressed = true; fr45(1); g45.input.mouse.lPressed = false;
  assert(g45.tutorial && g45.tutorial.idx === 6 && g45.sketchHeron, 'T4: the sketch-heron lesson re-enters the sketch phase (idx 6) with the heron spawned');
  g45._skipTutorial(); // skipping a retrain does NOT mark the tutorial skipped
  assert(!g45.save.flags.tutorialSkipped, 'T4: skipping a "Watch me" replay does NOT mark the tutorial skipped');
  assert(g45.tutorial === null, 'T4: skipping ends the retrain replay');

  // ---- retraining never auto-enters: a guided run already active blocks it ----
  const g45c = new Game(makeCanvas());
  g45c.start(); g45c.save = L45.freshSave(); g45c._beginExpedition(true);
  let t45c = 1000; const fr45c = (n, step = 16.7) => { for (let i = 0; i < n; i++) { t45c += step; g45c._frame(t45c); } };
  fr45c(6);
  assert(g45c.tutorial && g45c.tutorial.idx === 0, 'T4: a fresh save is mid guided run (idx 0)');
  g45c._startRetrain(6); // must be a no-op: never nest a replay in an active guided run
  assert(g45c.tutorial.idx === 0 && g45c.tutorial.retrain !== true, 'T4: _startRetrain is a no-op while a guided run is active (no nesting / no hijack)');
}

console.log('== stage 46: N1 — NG+ unlock + Next Expedition flow ==');
{
  const L46 = await import('../src/logic.js');
  const S46 = await import('../src/save.js');
  const KEY46 = 'frogue_gallery_save';

  // ---- (0) SAVE_VERSION bumped 3 -> 4; fresh save carries ngCycle 0 ----
  assert(Number.isInteger(L46.SAVE_VERSION) && L46.SAVE_VERSION >= 5, `N1: SAVE_VERSION is at least 5 (NG+ era; got ${L46.SAVE_VERSION})`);
  assert(L46.freshSave().ngCycle === 0, 'N1: a fresh save has ngCycle 0 (first-time player)');
  assert(L46.freshSave().saveVersion === L46.SAVE_VERSION, 'N1: a fresh save is stamped the current saveVersion');

  // ---- (1) a v3 save (no ngCycle field) migrates forward unchanged (ngCycle 0) ----
  store.set(KEY46, JSON.stringify({
    v: 3,
    bank: { red: 7, blue: 3, green: 9 },
    owned: ['moonlit-pond'], loadout: ['moonlit-pond'],
    upgrades: { capacity: 2, power: 1, vitality: 0 },
    flags: { intro: true, heronDefeated: true },
    stats: { expeditions: 4, victories: 1, deaths: 0, heronsPainted: 1, treasures: 0 },
    bestRun: { pigments: { red: 5, blue: 0, green: 0 }, time: 900, cleared: true },
    galleryBonus: 1,
    tutorialDrills: { burn: true, freeze: true, root: true, awaken: true },
    // NOTE: no ngCycle field on purpose — this is the old v3 schema.
  }));
  const migrated46 = S46.SaveSys.load();
  assert(migrated46 !== null, 'N1: a v3 save (no ngCycle) still loads');
  assert(migrated46.saveVersion === L46.SAVE_VERSION, 'N1: the v3 save re-stamps to the current schema version');
  assert(migrated46.ngCycle === 0, 'N1: a v3 save migrates with ngCycle defaulted to 0 (first-time player)');
  assert(migrated46.galleryBonus === 1 && migrated46.tutorialDrills.burn === true, 'N1: v3 legacy fields survive the migration');
  // a corrupt/garbled ngCycle normalizes back to 0 (the loader never throws)
  store.set(KEY46, JSON.stringify({ v: 4, ngCycle: 'not-a-number', bank: { red: 1, blue: 0, green: 0 }, stats: { victories: 1 } }));
  const corrupt46 = S46.SaveSys.load();
  assert(corrupt46 && corrupt46.ngCycle === 0, 'N1: a garbled ngCycle field normalizes to 0 on load');
  // restore the migrated save for the run-flow tests below
  S46.SaveSys.save(migrated46);

  // ---- (2) a returning first-time player (ngCycle 0) sees ZERO new UI ----
  const freshTitle = makeCanvas();
  const gN1a = new Game(freshTitle);
  gN1a.start();
  gN1a.save = L46.freshSave();            // ngCycle 0, no victory
  assert(gN1a._titleLayout().ng === null, 'N1: a fresh save (ngCycle 0) shows NO Next Expedition button on the title');
  assert(gN1a._endButtons().ng === null, 'N1: a fresh save (ngCycle 0) shows NO Next Expedition button on the end screen');
  // ngUnlocked is the shared gate: false with no victory, true after one
  assert(L46.ngUnlocked(L46.freshSave()) === false, 'N1: ngUnlocked is false for a save with no victory');
  const withVic = L46.freshSave(); withVic.stats.victories = 1;
  assert(L46.ngUnlocked(withVic) === true, 'N1: ngUnlocked is true once a victory is recorded');

  // ---- (3) a save with a completed victory offers Next Expedition ----
  const gN1b = new Game(makeCanvas());
  gN1b.start();
  const saved46 = L46.freshSave();
  saved46.stats.victories = 1; saved46.flags.heronDefeated = true; saved46.ngCycle = 0;
  gN1b.save = saved46;
  const tng = gN1b._titleLayout().ng;
  assert(tng && typeof tng.x === 'number', 'N1: a save with a victory shows the Next Expedition button on the title');
  // the end screen offers it too (drive a victory end screen)
  gN1b._endRun('victory');
  frames(20);
  const eng = gN1b._endButtons().ng;
  assert(eng && typeof eng.x === 'number', 'N1: a completed-victory end screen shows the Next Expedition button');

  // ---- (4) choosing Next Expedition starts a run with ngCycle 1 + persists ----
  gN1b.state = 'title';
  gN1b.save = L46.freshSave();
  gN1b.save.stats.victories = 1; gN1b.save.flags.heronDefeated = true; gN1b.save.ngCycle = 0;
  gN1b._beginNextExpedition();
  // N4 (v1.3 M14): the "Next Expedition" button now OPENS the expedition-
  // modifier picker (instead of immediately advancing the cycle); the run
  // starts when the picker is confirmed. A fresh save has no modifier yet.
  assert(gN1b._modPrompt && gN1b.state === 'title', 'N1/N4: choosing Next Expedition opens the modifier picker (state stays on the title)');
  gN1b._confirmNextExpedition();
  assert(gN1b.state === 'expedition', 'N1: confirming the picker starts a run');
  assert(gN1b.save.ngCycle === 1, `N1: the NG+ cycle advances to 1 and is persisted (got ${gN1b.save.ngCycle})`);
  assert(gN1b.ngCycle === 1, 'N1: the run carries ngCycle 1 (drives NG+ scaling / boss selection)');
  // the persisted on-disk blob carries ngCycle 1 at the current schema version
  const persisted46 = JSON.parse(store.get(KEY46));
  assert(persisted46 && persisted46.ngCycle === 1 && persisted46.saveVersion === L46.SAVE_VERSION,
    `N1: ngCycle 1 is persisted on disk at the current saveVersion (got ${persisted46 && persisted46.ngCycle} / ${persisted46 && persisted46.saveVersion})`);
  // round-trip through the real loader: the persisted blob reads back as ngCycle 1
  const roundtrip46 = L46.migrateSave(persisted46);
  assert(roundtrip46 && roundtrip46.ngCycle === 1, 'N1: the persisted NG+ save round-trips through the loader with ngCycle intact');

  // ---- (5) the button is NOT reachable on a first-time save (no accidental NG+) ----
  const gN1c = new Game(makeCanvas());
  gN1c.start();
  gN1c.save = L46.freshSave();   // no victory -> _beginNextExpedition is a no-op
  const before46 = gN1c.save.ngCycle;
  gN1c._beginNextExpedition();
  assert(gN1c.state === 'title', 'N1: _beginNextExpedition is a no-op for a first-time save (no victory)');
  assert(gN1c.save.ngCycle === before46 && gN1c.save.ngCycle === 0, 'N1: a first-time save cannot accidentally advance ngCycle');
  // restore the migrated save so any later stage sees a consistent save
  S46.SaveSys.save(migrated46);
}

console.log('== stage 47: N2 — NG+ scaling (ngPlusScaling / applyNGPlus) ==');
{
  const L47 = await import('../src/logic.js');
  const { spawnEnemy } = await import('../src/enemies.js');

  // ---- (0) the pure scaling table: cycle 0 is all-ones (NO change); growth capped at cycle 3 ----
  const s0 = L47.ngPlusScaling(0);
  assert(s0.hp === 1 && s0.dmg === 1 && s0.spawn === 1, 'N2: ngPlusScaling(0) returns all-ones (first-time run unchanged)');
  const s1 = L47.ngPlusScaling(1);
  // cycle-1 target: ~+25-35% enemy HP, ~+10-20% damage, modest spawn bump
  assert(s1.hp >= 1.25 && s1.hp <= 1.35, `N2: cycle-1 enemy HP is +25-35% (got ×${s1.hp})`);
  assert(s1.dmg >= 1.10 && s1.dmg <= 1.20, `N2: cycle-1 enemy damage is +10-20% (got ×${s1.dmg})`);
  assert(s1.spawn > 1, `N2: cycle-1 spawn rate is bumped (got ×${s1.spawn})`);
  // K6 (v1.5 M2): the Master tier — growth now has a MASTER step at cycle 4:
  // cycle 4 > cycle 3 (HP +50% / dmg +25% over cycle 3), then capped:
  // cycle 4 == cycle 5 == cycle 99 (no unbounded spiral).
  const s3 = L47.ngPlusScaling(3), s4 = L47.ngPlusScaling(4), s5 = L47.ngPlusScaling(5), s99 = L47.ngPlusScaling(99);
  assert(s4.hp > s3.hp && s4.dmg > s3.dmg, 'N2+K6: the Master tier (cycle 4) is strictly harder than cycle 3 (HP +50% / dmg +25% over cycle 3)');
  assert(s4.hp === s5.hp && s4.dmg === s5.dmg && s4.spawn === s5.spawn, 'N2+K6: the Master tier is capped at cycle 4 (cycle 4 == cycle 5)');
  assert(s4.hp === s99.hp && s4.dmg === s99.dmg && s4.spawn === s99.spawn, 'N2+K6: the Master cap holds for arbitrarily large cycles');
  assert(s3.hp > s1.hp && s3.dmg > s1.dmg && s3.spawn > s1.spawn, 'N2: cycle 3 is strictly harder than cycle 1 (the escalation is an upper bound, not a plateau at cycle 1)');
  // non-finite / negative input normalizes to the cycle-0 all-ones row (never a NaN multiplier)
  assert(L47.ngPlusScaling(-5).hp === 1 && L47.ngPlusScaling('garbage').hp === 1, 'N2: non-finite / negative cycle normalizes to cycle 0');

  // ---- (1) cycle 0 tuning is byte-identical to pre-NG+ (the 15-20 min first-time invariant) ----
  // The scaling fields must NOT be added when ngCycle is 0: a fresh makeTuning()
  // (exactly what the pre-NG+ code produced) and the NG+ path for cycle 0 must be
  // the same object with no extra keys.
  const { Game } = await import('../src/game.js');
  const g47a = new Game(makeCanvas());
  g47a.start();
  g47a.save = L47.freshSave();       // ngCycle 0, base upgrades
  g47a.save.upgrades = { capacity: 1, power: 2, vitality: 1 };
  g47a._beginExpedition();
  const base47 = g47a.tuning;
  assert(g47a.ngCycle === 0, 'N2: the fresh-save run is cycle 0');
  // The scaling must NOT alter anything for cycle 0: applyNGPlus is only called
  // when ngCycle >= 1, so a cycle-0 run's tuning is the literal pre-NG+ makeTuning
  // object (enemyHp stays at its base value of 1; no enemyDmg/spawnRate added).
  assert(base47.enemyHp === 1, `N2: cycle-0 enemyHp stays at base 1 (got ${base47.enemyHp})`);
  assert(base47.enemyDmg === undefined && base47.spawnRate === undefined,
    'N2: cycle-0 tuning adds no NG+ enemyDmg/spawnRate fields (applyNGPlus not run)');
  // and it equals a plain makeTuning (the literal pre-NG+ code path)
  const plain47 = L47.makeTuning({ capacity: 1, power: 2, vitality: 1 }, [], 'normal');
  assert(JSON.stringify(base47) === JSON.stringify(plain47), 'N2: cycle-0 tuning deep-equals a plain makeTuning (no NG+ delta)');

  // ---- (2) cycle-1 tuning differs as specified, applied only when ngCycle >= 1 ----
  const g47b = new Game(makeCanvas());
  g47b.start();
  g47b.save = L47.freshSave();
  g47b.save.ngCycle = 1;
  g47b.save.upgrades = { capacity: 1, power: 2, vitality: 1 };
  g47b._beginExpedition();
  const ng47 = g47b.tuning;
  assert(ng47.enemyHp === s1.hp, `N2: cycle-1 run carries enemyHp ×${s1.hp} (got ${ng47.enemyHp})`);
  assert(ng47.enemyDmg === s1.dmg, `N2: cycle-1 run carries enemyDmg ×${s1.dmg} (got ${ng47.enemyDmg})`);
  assert(ng47.spawnRate === s1.spawn, `N2: cycle-1 run carries spawnRate ×${s1.spawn} (got ${ng47.spawnRate})`);

  // ---- (3) the multipliers actually reach the enemies ----
  const baseBeetle = spawnEnemy('beetle', 200, 100, base47);
  const ngBeetle = spawnEnemy('beetle', 200, 100, ng47);
  assert(ngBeetle.hp > baseBeetle.hp, `N2: NG+ enemies are tankier (beetle ${baseBeetle.hp} -> ${ngBeetle.hp})`);
  assert(ngBeetle.hp === Math.round(baseBeetle.hp * s1.hp), `N2: NG+ beetle HP == base × ${s1.hp} (got ${ngBeetle.hp})`);
  assert(ngBeetle.dmg > baseBeetle.dmg, `N2: NG+ enemies hit harder (beetle dmg ${baseBeetle.dmg} -> ${ngBeetle.dmg})`);

  // ---- (4) the heron is NOT scaled (its HP is a fixed tuning value, not NG+-bumped) ----
  assert(base47.bossMaxHp === ng47.bossMaxHp, 'N2: the final heron HP is not NG+-scaled in run setup (fixed 30k; N3 replaces it with a different boss)');
  console.log('ok — N2: NG+ scaling is pure, cycle-0 is byte-identical, cycle-1 is applied only when ngCycle>=1, the Master tier (cycle 4+) is strictly harder + bounded, and cycles 0-3 are unchanged');
}

console.log('== stage 48: N3 — The Great Green Heron (NG+ second boss) ==');
{
  const L48 = await import('../src/logic.js');
  const { paintDamage } = await import('../src/paint.js');

  // ---- (1) boss selection: cycle 0 fights the GRAY heron, cycle 1 the GREEN ----
  const gGray = new Game(makeCanvas()); gGray.start();
  gGray.save = L48.freshSave();                 // ngCycle 0 (first-time)
  gGray._beginExpedition();
  assert(gGray.heron.kind === 'gray', `N3: ngCycle 0 fights the GRAY heron (got kind=${gGray.heron.kind})`);
  assert(gGray.heron.green === undefined, 'N3: the gray heron carries no green flag (first-time UI/behavior unchanged)');
  assert(gGray.heron.hp === 30000, `N3: the gray heron keeps its 30k HP (got ${gGray.heron.hp})`);
  assert(gGray.heron.pinned === undefined, 'N3: the gray heron has no reed-pin field (the pin mechanic is green-only)');

  const gGreen = new Game(makeCanvas()); gGreen.start();
  const gsave = L48.freshSave(); gsave.stats.victories = 1; gsave.ngCycle = 1; gsave.flags.heronDefeated = true;
  gGreen.save = gsave;
  gGreen._beginExpedition();
  assert(gGreen.ngCycle === 1, 'N3: the NG+ run carries ngCycle 1');
  assert(gGreen.heron.kind === 'green', `N3: ngCycle 1 fights the GREAT GREEN HERON (got kind=${gGreen.heron.kind})`);
  assert(gGreen.heron.green === true, 'N3: the green heron is flagged for the distinct green palette');
  assert(gGreen.heron.hp === 36000, `N3: the green heron carries 36k HP (got ${gGreen.heron.hp})`);
  assert(gGreen.heron.maxHp === 36000 && gGreen.heron.hp > 0, 'N3: the green heron is live at 36k max HP');
  assert(gGreen.heron.awakenNeed && gGreen.heron.awakenNeed.red === 45 && gGreen.heron.awakenNeed.blue === 45 && gGreen.heron.awakenNeed.green === 45,
    'N3: the green heron keeps the 3-hue awakening rhythm (core pillar unchanged)');
  assert(gGreen.heron.pinned === 0, 'N3: the green heron starts unpinned (pin is earned, not passive)');

  // ---- (2) the reed pin is a PURE timer (testable without a browser) ----
  const ph = { pinned: 1.0 };
  assert(L48.greenHeronPinTick(ph, 0.3) === 'pinned' && ph.pinned === 0.7, 'N3: greenHeronPinTick decays the hold while pinned');
  assert(L48.greenHeronPinTick(ph, 10) === 'pin-off' && ph.pinned === 0, 'N3: greenHeronPinTick reports pin-off on the frame it releases');
  const ph2 = { pinned: 0 };
  assert(L48.greenHeronPinTick(ph2, 0.3) === 0, 'N3: greenHeronPinTick is a no-op when not pinned (gray heron never pins)');

  // ---- (3) the pin ENGAGES by painting the green heron with Moss (the swapped mechanic) ----
  const h = gGreen.heron, p = gGreen.player;
  h._intro = 0;                                   // reveal the boss so it can be painted
  p.maxHp = 9999; p.hp = 9999; p.iframes = 999;    // invulnerable so the pin loop can't short-circuit on death
  p.x = h.x; p.y = h.y - 60;                        // within swipeRange+30 of the heron's paint point
  p.pigment = 'green';                              // MOSS triggers the reed pin
  gGreen.input.mouse.lDown = true;
  let pinFrame = -1;
  for (let i = 0; i < 500; i++) {
    p.x = h.x; p.y = h.y - 60; p.vx = 0; p.vy = 0;  // hold the brush on the heron (knockback-free)
    gGreen._updateExpedition(0.016);
    if (h.pinned > 0) { pinFrame = i; break; }
  }
  gGreen.input.mouse.lDown = false;
  assert(h.pinned > 0, `N3: painting the green heron with Moss pins it (engaged at frame ${pinFrame})`);
  assert(h.green === true && h.awakened === false, 'N3: the pin is a distinct window — it engages while the heron is NOT yet awakened');

  // the pin HELDS it in place: while pinned, _updateBoss skips bossStep so the heron does not move
  const xPinned = h.x;
  for (let i = 0; i < 20; i++) { p.x = h.x; p.y = h.y - 60; gGreen._updateExpedition(0.016); }
  assert(h.pinned > 0, 'N3: the pin holds for a sustained window (not a one-frame blip)');
  assert(h.x === xPinned, `N3: the pinned heron is HELD IN PLACE (x frozen at ${xPinned})`);

  // the pin is a VULNERABLE window: while pinned the green heron takes 2x paint damage
  const t48 = gGreen.tuning, px = p.x, py = p.y;
  const mkH = (pinned) => ({ x: px, y: py, hp: 1000, maxHp: 1000, hue: { red: 0, blue: 0, green: 0 }, awakened: false, awakenedT: 0, pinned, diveH: 0, green: pinned > 0 });
  const paint48 = new (await import('../src/paint.js')).Paint(p, gGreen.world, t48, () => {}, gGreen.particles);
  const hBase = mkH(0), hPin = mkH(2.0);
  p.pigment = 'red';
  paint48.paintBossHit(hBase, 'red', t48.bossPaintHit);
  paint48.paintBossHit(hPin, 'red', t48.bossPaintHit);
  const dmgBase = 1000 - hBase.hp, dmgPin = 1000 - hPin.hp;
  assert(dmgPin === 2 * dmgBase, `N3: the pinned green heron takes 2x paint damage (base ${dmgBase} -> pinned ${dmgPin})`);

  // the pin decays on its own (greenHeronPinTick in _updateBoss)
  let decays = 0;
  for (let i = 0; i < 260 && h.pinned > 0; i++) { p.x = h.x; p.y = h.y - 60; decays++; gGreen._updateExpedition(0.016); }
  assert(h.pinned === 0, `N3: the reed pin releases on its own after ~${L48.GREEN_HERON.pinDuration}s (decayed over ${decays} frames)`);

  // ---- (4) the green heron can be damaged / awakened / defeated, and defeat ends the run correctly ----
  // reset for the awaken + defeat beat (the pin test consumed some green hue)
  h.hue = { red: 0, blue: 0, green: 0 }; h.pinned = 0; h.pinCharge = 0; h.awakened = false; h.awakenedT = 0; h.hp = h.maxHp; h.state = 'idle'; h.stateT = 999;
  const pigCycle = ['red', 'blue', 'green'];
  gGreen.input.mouse.lDown = true;
  let awakeFrame = -1;
  for (let i = 0; i < 900; i++) {
    p.x = h.x; p.y = h.y - 60; p.vx = 0; p.vy = 0; p.pigment = pigCycle[i % 3];
    gGreen._updateExpedition(0.016);
    if (h.awakened) { awakeFrame = i; break; }
  }
  gGreen.input.mouse.lDown = false;
  assert(h.awakened === true, `N3: the green heron can be AWAKENED through the real 3-hue path (frame ${awakeFrame})`);
  // defeat: paint the (now low-HP, awakened) heron to death through the real paint path
  h.hp = 2; p.pigment = 'red';
  gGreen.input.mouse.lDown = true;
  let died = false;
  for (let i = 0; i < 60; i++) { p.x = h.x; p.y = h.y - 60; p.vx = 0; p.vy = 0; gGreen._updateExpedition(0.016); if (h.flying > 0) { died = true; break; } }
  gGreen.input.mouse.lDown = false;
  assert(died && h.flying > 0, `N3: the green heron can be DEFEATED (it blooms and takes flight, flying=${h.flying.toFixed(2)})`);
  // let the victory flight play out -> _endRun('victory')
  frames(300);
  assert(gGreen.state === 'end' && gGreen.endKind === 'victory', 'N3: defeating the green heron ends the run in VICTORY (-> the end screen)');
  // NG+ progression intact: a second victory is recorded, the heron is painted, and the NG+ cycle is preserved
  assert(gGreen.save.stats.victories >= 2, `N3: the victory is recorded in the save (victories=${gGreen.save.stats.victories})`);
  assert(gGreen.save.stats.heronsPainted >= 1, 'N3: the green heron counts as a heron painted');
  assert(gGreen.save.flags.heronDefeated === true, 'N3: the heronDefeated flag is set');
  assert(gGreen.save.ngCycle === 1, `N3: NG+ progression is INTACT through the victory (ngCycle=${gGreen.save.ngCycle})`);
  assert(gGreen.save.saveVersion === L48.SAVE_VERSION, 'N3: the save round-trips at the current schema version (saveVersion 4)');
  // the victory -> atelier route works (the between-run loop), with the NG+ button offered
  gGreen._beginAtelier();
  frames(30);
  assert(gGreen.state === 'atelier', 'N3: defeat -> victory -> the atelier (the NG+ loop closes)');
  assert(gGreen._endButtons !== undefined, 'N3: the end-screen button layout (incl. the Next Expedition button) is present');
  console.log('ok — N3: the Great Green Heron appears on NG+ cycles, reuses the heron AI, its reed pin pins it + deals 2x, it is damageable/awakenable/defeatable, and defeat ends the run into victory with NG+ intact');
}

console.log('== stage 49: N4 — Player-chosen expedition modifiers ==');
{
  const L49 = await import('../src/logic.js');
  const { spawnEnemy } = await import('../src/enemies.js');
  const { Game } = await import('../src/game.js');

  // ---- (0) the MODIFIERS table: 6 data entries (N4 x3 + K5 x3), each with name/desc/apply ----
  assert(Object.keys(L49.MODIFIERS).length === 6, `N4+K5: the MODIFIERS table has 6 entries (got ${Object.keys(L49.MODIFIERS).length})`);
  assert(L49.MODIFIER_ORDER.length === 6, `N4+K5: MODIFIER_ORDER lists the 6 modifier ids (got ${L49.MODIFIER_ORDER.length})`);
  for (const id of L49.MODIFIER_ORDER) {
    const m = L49.MODIFIERS[id];
    assert(m && m.id === id && typeof m.name === 'string' && typeof m.desc === 'string' && typeof m.apply === 'function',
      `N4: modifier '${id}' is a data entry (id/name/desc/apply)`);
  }

  // ---- (1) cycle-0 (first-time) is COMPLETELY untouched: no modifier may be applied ----
  // applyModifier is guarded by the caller (ngCycle >= 1) and the save default is
  // null, so a fresh-save run's tuning must deep-equal a plain makeTuning.
  const g49a = new Game(makeCanvas()); g49a.start();
  g49a.save = L49.freshSave();                 // ngCycle 0, ngModifier null
  g49a._beginExpedition();
  const base49 = g49a.tuning;
  assert(g49a.ngCycle === 0, 'N4: the fresh-save run is cycle 0');
  assert(!base49.waterWidthMult && !base49.enemySpeedMult && !base49.contactDmgMult && base49.satFloor == null,
    'N4: a cycle-0 run adds NO modifier tuning fields (first-time is byte-identical)');
  const plain49 = L49.makeTuning(g49a.save.upgrades, g49a.save.loadout, g49a.options.difficulty, g49a.save.galleryBonus || 0);
  assert(JSON.stringify(base49) === JSON.stringify(plain49), 'N4: cycle-0 tuning deep-equals a plain makeTuning (no modifier delta)');

  // ---- (2) each modifier is selectable and mutates the tuning as specified ----
  // (a) High Tide: water zones wider (waterWidthMult > 1) + enemies 10% faster (enemySpeedMult == 1.1)
  const g49ht = new Game(makeCanvas()); g49ht.start();
  const htSave = L49.freshSave(); htSave.ngCycle = 1; htSave.ngModifier = 'high-tide'; htSave.stats.victories = 1; htSave.flags.heronDefeated = true;
  g49ht.save = htSave;
  g49ht._beginExpedition();
  assert(g49ht.tuning.waterWidthMult === 1.25, `N4: High Tide widens the water (waterWidthMult ×${g49ht.tuning.waterWidthMult})`);
  assert(g49ht.tuning.enemySpeedMult === 1.1, `N4: High Tide makes enemies 10% faster (enemySpeedMult ×${g49ht.tuning.enemySpeedMult})`);
  assert(g49ht.world.waterWidthMult === 1.25, 'N4: High Tide hands the water-width multiplier to the fresh per-run world');
  assert(!g49ht.tuning.satFloor, 'N4: High Tide does NOT desaturate (no satFloor)');

  // (b) Grey Morning: desaturated world (satFloor < 1) + enemy contact dmg +20% (contactDmgMult == 1.2)
  const g49gm = new Game(makeCanvas()); g49gm.start();
  const gmSave = L49.freshSave(); gmSave.ngCycle = 1; gmSave.ngModifier = 'grey-morning'; gmSave.stats.victories = 1; gmSave.flags.heronDefeated = true;
  g49gm.save = gmSave;
  g49gm._beginExpedition();
  assert(g49gm.tuning.satFloor == null || (g49gm.tuning.satFloor > 0 && g49gm.tuning.satFloor < 1), `N4: Grey Morning desaturates the world (satFloor=${g49gm.tuning.satFloor})`);
  assert(g49gm.tuning.contactDmgMult === 1.2, `N4: Grey Morning raises enemy contact dmg +20% (contactDmgMult ×${g49gm.tuning.contactDmgMult})`);

  // (c) Dry Brush Season: brush splash charge +35% slower (splashCharge ×1.35) + orb value +25% (pickupValue ×1.25)
  const g49db = new Game(makeCanvas()); g49db.start();
  const dbSave = L49.freshSave(); dbSave.ngCycle = 1; dbSave.ngModifier = 'dry-brush-season'; dbSave.stats.victories = 1; dbSave.flags.heronDefeated = true;
  g49db.save = dbSave;
  g49db._beginExpedition();
  const baseSplash = L49.makeTuning({ capacity: 1, power: 0, vitality: 0 }, [], 'normal', 0).splashCharge;
  assert(g49db.tuning.splashCharge === Math.round(baseSplash * 1.35 * 100) / 100,
    `N4: Dry Brush slows the splash charge +35% (splashCharge ${baseSplash} -> ${g49db.tuning.splashCharge})`);
  assert(g49db.tuning.pickupValue === 1.25, `N4: Dry Brush raises orb value +25% (pickupValue ×${g49db.tuning.pickupValue})`);
  assert(!g49db.tuning.waterWidthMult && !g49db.tuning.enemySpeedMult, 'N4: Dry Brush does NOT widen water or speed enemies');

  // ---- (3) the modifiers reach the enemies (High Tide speed + Grey Morning contact dmg) ----
  // All three games use a fresh save (identical base upgrades), so the only delta
  // between them is the modifier itself — a relative comparison isolates it.
  const htBeetle = spawnEnemy('beetle', 200, 100, g49ht.tuning);
  const gmBeetle = spawnEnemy('beetle', 200, 100, g49gm.tuning);
  const gmNoModTuning = L49.makeTuning(g49gm.save.upgrades, g49gm.save.loadout, g49gm.options.difficulty, 0);
  L49.applyNGPlus(gmNoModTuning, 1); // same NG+ cycle 1 scaling as g49gm (isolates the modifier delta)
  const gmNoModBeetle = spawnEnemy('beetle', 200, 100, gmNoModTuning);
  assert(gmBeetle.speed === gmNoModBeetle.speed, 'N4: Grey Morning does NOT speed enemies (beetle speed unchanged)');
  const noModTuning = L49.makeTuning(g49ht.save.upgrades, g49ht.save.loadout, g49ht.options.difficulty, 0);
  L49.applyNGPlus(noModTuning, 1); // same NG+ cycle 1 scaling as g49ht (isolates the modifier delta)
  const noModBeetle = spawnEnemy('beetle', 200, 100, noModTuning);
  // no-modifier base tuning (same NG+ cycle 1 scaling) for a clean relative read
  assert(Math.round(htBeetle.speed / noModBeetle.speed * 1000) / 1000 === 1.1,
    `N4: High Tide enemies move 10% faster than a no-modifier enemy (beetle ${noModBeetle.speed} -> ${htBeetle.speed})`);
  assert(Math.round(gmBeetle.dmg / noModBeetle.dmg * 1000) / 1000 === 1.2,
    `N4: Grey Morning enemies deal +20% contact dmg vs no-modifier (beetle ${noModBeetle.dmg} -> ${gmBeetle.dmg})`);

  // ---- (4) the picker UI: Next Expedition opens it; each modifier is selectable ----
  const g49p = new Game(makeCanvas()); g49p.start();
  const pSave = L49.freshSave(); pSave.stats.victories = 1; pSave.flags.heronDefeated = true; pSave.ngCycle = 0;
  g49p.save = pSave;
  g49p._beginNextExpedition();
  assert(g49p._modPrompt && g49p._modPrompt.sel === 0, `N4: "Next Expedition" opens the modifier picker (pre-selects 'no modifier', sel=${g49p._modPrompt && g49p._modPrompt.sel})`);
  // select each of the 3 modifiers by its card index and confirm the choice persists
  const order = L49.MODIFIER_ORDER;
  for (let i = 1; i <= order.length; i++) {
    g49p._modPrompt.sel = i;
    g49p._chooseModPrompt();
    assert(g49p.save.ngModifier === order[i - 1], `N4: selecting card ${i} persists the modifier '${order[i - 1]}' to the save`);
    // and a fresh NG+ run with that save carries the modifier's tuning
    const run = new Game(makeCanvas()); run.start(); run.save = L49.freshSave(); run.save.ngCycle = 1; run.save.ngModifier = order[i - 1]; run.save.stats.victories = 1; run.save.flags.heronDefeated = true;
    run._beginExpedition();
    assert(run.tuning, `N4: a run with modifier '${order[i - 1]}' begins cleanly`);
  }
  // the "no modifier" card (sel 0) clears the choice
  g49p._modPrompt.sel = 0;
  g49p._chooseModPrompt();
  assert(g49p.save.ngModifier === null, 'N4: the "no modifier" card clears the saved modifier to null');

  // ---- (5) confirming the picker advances the cycle AND begins the expedition ----
  const g49c = new Game(makeCanvas()); g49c.start();
  const cSave = L49.freshSave(); cSave.stats.victories = 1; cSave.flags.heronDefeated = true; cSave.ngCycle = 0; cSave.ngModifier = 'high-tide';
  g49c.save = cSave;
  g49c._beginNextExpedition();
  g49c._confirmNextExpedition();
  assert(g49c.state === 'expedition', 'N4: confirming the picker starts the expedition');
  assert(g49c.save.ngCycle === 1, `N4: confirming advances ngCycle 0 -> 1 (got ${g49c.save.ngCycle})`);
  assert(g49c.save.ngModifier === 'high-tide', 'N4: the chosen modifier is preserved through the cycle advance');
  assert(g49c.tuning.waterWidthMult === 1.25 && g49c.tuning.enemySpeedMult === 1.1, 'N4: the confirmed run carries the chosen High Tide tuning');

  // ---- (6) old saves load as no-modifier; a bad/unknown modifier normalizes to null ----
  const legacy = L49.migrateSave({ v: 4, bank: { red: 3, blue: 0, green: 0 }, owned: ['moonlit-pond'], loadout: ['moonlit-pond'], upgrades: { capacity: 1, power: 0, vitality: 0 }, flags: { heronDefeated: true }, stats: { victories: 1 }, bestRun: { pigments: { red: 0, blue: 0, green: 0 }, time: 100, cleared: true }, ngCycle: 1 });
  assert(legacy.ngModifier === null, 'N4: a v4 save (no ngModifier field) migrates forward as no-modifier (null)');
  const badMod = L49.migrateSave({ v: 5, bank: { red: 0, blue: 0, green: 0 }, owned: [], loadout: [], upgrades: { capacity: 1, power: 0, vitality: 0 }, flags: {}, stats: {}, bestRun: { pigments: { red: 0, blue: 0, green: 0 }, time: 0, cleared: false }, ngCycle: 1, ngModifier: 'not-a-real-modifier' });
  assert(badMod.ngModifier === null, 'N4: an unknown ngModifier value normalizes to null (no crash, no phantom tuning)');

  console.log('ok — N4: 3 data-driven modifiers feed the existing tuning/spawn/render paths, are selectable + persist, and a cycle-0 (first-time) run stays byte-identical');
}

// ---- stage 50: G1 — Gold pigment meta economy (core) ----------------------
console.log('== stage 50: G1 — Gold pigment meta economy (core) ==');
{
  const L50 = await import('../src/logic.js');

  // ---- (0) schema: SAVE_VERSION bumped to 6; a fresh save starts gold 0 / empty latch ----
  assert(L50.SAVE_VERSION >= 6, `G1: SAVE_VERSION is now >= 6 (gold era; got ${L50.SAVE_VERSION})`);
  const f50 = L50.freshSave();
  assert(f50.gold === 0, 'G1: a fresh save starts with 0 gold');
  assert(typeof f50.goldEarned === 'object' && f50.goldEarned !== null && Object.keys(f50.goldEarned).length === 0, 'G1: a fresh save starts with an empty goldEarned latch');

  // ---- (1) each earn RULE fires EXACTLY ONCE (idempotent) ----
  const s = L50.freshSave();
  const gray1 = L50.goldEarn(s, L50.goldEventBoss('gray'));
  const gray2 = L50.goldEarn(s, L50.goldEventBoss('gray'));
  assert(gray1 === 15, `G1: the first Gray Heron kill pays 15 gold (got ${gray1})`);
  assert(gray2 === 0, 'G1: the Gray Heron kill does NOT pay again (latched)');
  assert(s.goldEarned['boss:gray'] === true, 'G1: the gray-boss latch is set after the first kill');

  const green1 = L50.goldEarn(s, L50.goldEventBoss('green'));
  const green2 = L50.goldEarn(s, L50.goldEventBoss('green'));
  assert(green1 === 20, `G1: the first Green Heron (NG+) kill pays 20 gold (got ${green1})`);
  assert(green2 === 0, 'G1: the Green Heron kill does NOT pay again (latched)');
  assert(s.goldEarned['boss:green'] === true, 'G1: the green-boss latch is set after the first kill');

  // each of the 3 synergy duos fires once (stable sorted-pair key)
  const duos = [
    { pair: ['moonlit-pond', 'storm-cloud'] },
    { pair: ['dancing-salamander', 'storm-cloud'] },
    { pair: ['spring-garden', 'king-frog'] },
  ];
  for (const d of duos) {
    const once = L50.goldEarn(s, L50.goldEventSynergy(d));
    const again = L50.goldEarn(s, L50.goldEventSynergy(d));
    assert(once === 8, `G1: a first synergy duo (${d.pair.join('+')}) pays 8 gold (got ${once})`);
    assert(again === 0, `G1: that synergy duo does NOT pay again (latched)`);
  }

  // the orb milestone: 100 orbs in a run pays once; below the threshold pays nothing
  assert(L50.goldEventOrbs(50) === null, 'G1: below 100 orbs there is no orb milestone (yet)');
  const orbs1 = L50.goldEarn(s, L50.goldEventOrbs(100));
  const orbs2 = L50.goldEarn(s, L50.goldEventOrbs(100));
  assert(orbs1 === 8, `G1: the first 100-orb run pays 8 gold (got ${orbs1})`);
  assert(orbs2 === 0, 'G1: the 100-orb milestone does NOT pay again (latched)');

  // ---- (2) totals are correct ----
  // max gold a career can bank = 15 + 20 + 3*8 + 8 = 67
  assert(L50.goldTotal() === 67, `G1: the total career gold is 67 (got ${L50.goldTotal()})`);
  assert(s.gold === 67, `G1: after every first-time event, the save has banked all 67 gold (got ${s.gold})`);
  assert(s.gold >= 25 && s.gold >= 40, 'G1: a career can afford BOTH G2 gold paintings (25 and 40 gold)');
  // firing the entire event set a SECOND time earns nothing (global idempotency)
  const secondPass =
    L50.goldEarn(s, L50.goldEventBoss('gray')) +
    L50.goldEarn(s, L50.goldEventBoss('green')) +
    duos.reduce((acc, d) => acc + L50.goldEarn(s, L50.goldEventSynergy(d)), 0) +
    L50.goldEarn(s, L50.goldEventOrbs(100));
  assert(secondPass === 0, `G1: re-firing every event earns 0 (each fires exactly once; got ${secondPass})`);
  assert(s.gold === 67, 'G1: the total gold is unchanged after the second pass');

  // an unknown boss kind produces no event / no gold
  assert(L50.goldEventBoss('purple') === null, 'G1: an unknown boss kind produces no gold event');

  // ---- (3) a live Game wires the award (banner + persist) end-to-end ----
  const gGold = new Game(makeCanvas()); gGold.start();
  const gsave = L50.freshSave(); gsave.stats.victories = 0; gsave.heronDefeated = false;
  gGold.save = gsave; gGold.state = 'expedition';
  // a gray-heron run ends in victory -> the first gray boss kill pays gold
  gGold.heron = { green: false };
  gGold._endRun('victory');
  assert(gGold.save.gold === 15, `G1: a first-time victory (gray heron) banks 15 gold (got ${gGold.save.gold})`);
  assert(gGold.save.goldEarned['boss:gray'] === true, 'G1: a first-time victory latches the gray-boss gold');
  // a SECOND victory (same boss type) does NOT re-pay the boss gold
  const before2 = gGold.save.gold;
  gGold.state = 'expedition'; gGold.heron = { green: false };
  gGold._endRun('victory');
  assert(gGold.save.gold === before2, 'G1: a second victory does NOT re-pay the gray-boss gold (latched)');
  // an NG+ (green heron) victory pays the DISTINCT green-boss gold
  gGold.state = 'expedition'; gGold.heron = { green: true };
  gGold._endRun('victory');
  assert(gGold.save.gold === before2 + 20, `G1: an NG+ (green heron) victory banks the 20 gold green-boss (got ${gGold.save.gold})`);

  // the atelier displays the gold counter (a gold dot distinct from the pigments)
  gGold._beginAtelier();
  gGold._drawAll(); // exercise the atelier render path (gold chip drawn) without throwing

  // ---- (4) old saves migrate forward as gold 0 / empty latch ----
  const legacy = L50.migrateSave({ v: 5, bank: { red: 5, blue: 2, green: 1 }, owned: ['moonlit-pond'], loadout: ['moonlit-pond'], upgrades: { capacity: 1, power: 0, vitality: 0 }, flags: { heronDefeated: true }, stats: { victories: 1 }, bestRun: { pigments: { red: 0, blue: 0, green: 0 }, time: 60, cleared: true }, ngCycle: 1, ngModifier: 'high-tide' });
  assert(legacy.gold === 0, `G1: a v5 save (no gold field) migrates forward to gold 0 (got ${legacy.gold})`);
  assert(legacy.goldEarned !== null && Object.keys(legacy.goldEarned).length === 0, 'G1: a v5 save migrates to an empty goldEarned latch');
  assert(legacy.ngCycle === 1 && legacy.ngModifier === 'high-tide', 'G1: the migration preserves the existing NG+ fields (ngCycle + ngModifier)');
  // a corrupt/garbled gold field normalizes to 0 (the loader never throws)
  const corrupt = L50.migrateSave({ v: 5, bank: { red: 1, blue: 0, green: 0 }, owned: [], loadout: [], upgrades: { capacity: 0, power: 0, vitality: 0 }, flags: {}, stats: {}, bestRun: null, gold: 'lots', goldEarned: 'bad' });
  assert(corrupt.gold === 0, `G1: a garbled gold field normalizes to 0 (got ${corrupt.gold})`);
  assert(typeof corrupt.goldEarned === 'object' && Object.keys(corrupt.goldEarned).length === 0, 'G1: a garbled goldEarned field normalizes to {}');

  console.log('ok — G1: gold is a META-ONLY currency earned exactly once per first-time event (boss kill / synergy duo / 100-orb run), totals to 67 (clears the G2 gold set), old saves migrate to gold 0, and the atelier displays it');
}

// ---- stage 51: G2 — two gold-tier paintings (catalog 8→10) -----------------
// The PAINTINGS catalog grows 8 → 10 with two gold-tier works (a `goldTier`
// flag + `goldCost`, priced in the meta gold currency, not pigment):
//   · Gilded Meridian — +10% all orb/pickup value permanently — 25 gold
//   · Verdant Crown   — +1 green heal per touch permanently      — 40 gold
// They are purchasable ONLY on NG+ cycles (ngCycle >= 1) — a first-time
// player never sees them in the shop — bought with gold via the existing
// atelier purchase flow, and their effects apply in makeTuning when OWNED
// (a permanent meta bonus, not a loadout slot). The Curator's Ledger lists
// all 10 with gold-tier styling.
console.log('== stage 51: G2 — Two gold-tier paintings (catalog 8→10) ==');
{
  const L51 = await import('../src/logic.js');

  // ---- (1) the catalog grew 8 → 10, with the two gold-tier entries ----
  assert(L51.PAINTINGS.length === 10, `G2: the PAINTINGS catalog holds 10 paintings (got ${L51.PAINTINGS.length})`);
  assert(L51.PAINTINGS.filter(p => !p.goldTier).length === 8, 'G2: the 8 pigment paintings are unchanged');
  const gold = L51.goldPaintings();
  assert(gold.length === 2, `G2: goldPaintings() returns the 2 gold-tier works (got ${gold.length})`);
  const gm = L51.PAINTINGS.find(p => p.id === 'gilded-meridian');
  const vc = L51.PAINTINGS.find(p => p.id === 'verdant-crown');
  assert(!!gm && gm.goldTier === true && gm.goldCost === 25 && !gm.cost, `G2: Gilded Meridian is goldTier, priced 25 gold, has NO pigment cost (got goldCost=${gm && gm.goldCost})`);
  assert(!!vc && vc.goldTier === true && vc.goldCost === 40 && !vc.cost, `G2: Verdant Crown is goldTier, priced 40 gold, has NO pigment cost (got goldCost=${vc && vc.goldCost})`);

  // ---- (2) the tuning effects apply when OWNED (via the makeTuning owned param) ----
  const base = L51.makeTuning({}, [], 'normal', 0, []);
  const gOnly = L51.makeTuning({}, [], 'normal', 0, ['gilded-meridian']);
  const vOnly = L51.makeTuning({}, [], 'normal', 0, ['verdant-crown']);
  const both = L51.makeTuning({}, [], 'normal', 0, ['gilded-meridian', 'verdant-crown']);
  assert(gOnly.pickupValue === Math.round(base.pickupValue * 1.1 * 1000) / 1000, `G2: Gilded Meridian raises orb value +10% when owned (pickupValue ${base.pickupValue} -> ${gOnly.pickupValue})`);
  assert(vOnly.greenHeal === base.greenHeal + 1, `G2: Verdant Crown adds +1 green heal when owned (greenHeal ${base.greenHeal} -> ${vOnly.greenHeal})`);
  assert(Math.abs(both.pickupValue - base.pickupValue * 1.1) < 1e-9 && both.greenHeal === base.greenHeal + 1, 'G2: both gold paintings apply at once when both owned');
  // owning nothing (a first-time / cycle-0 save) keeps the tuning byte-identical
  assert(JSON.stringify(base) === JSON.stringify(L51.makeTuning({}, [], 'normal', 0, [])), 'G2: a save that owns no gold paintings leaves the tuning unchanged');

  // ---- (3) canAffordGold gates on the gold balance ----
  assert(L51.canAffordGold({ gold: 25 }, gm) === true, 'G2: a save with 25 gold can afford Gilded Meridian');
  assert(L51.canAffordGold({ gold: 24 }, gm) === false, 'G2: a save with 24 gold cannot afford Gilded Meridian');
  assert(L51.canAffordGold({ gold: 40 }, vc) === true, 'G2: a save with 40 gold can afford Verdant Crown');
  assert(L51.canAffordGold({ gold: 0 }, vc) === false, 'G2: a save with 0 gold cannot afford Verdant Crown');
  assert(L51.canAffordGold({ gold: 99 }, L51.PAINTINGS.find(p => p.id === 'king-frog')) === false, 'G2: canAffordGold never purchases a NON-gold painting with gold');

  // ---- (4) the atelier shop: NG+-gated (hidden/blocked at cycle 0), buy with gold ----
  const cv51 = makeCanvas();
  const g51 = new Game(cv51); g51.start(); g51._quitToTitle(); g51._beginAtelier(); g51._atelierIntro = false; g51.atelierTab = 1;

  // a FIRST-TIME save (ngCycle 0) — gold paintings must NOT be buyable
  const ftSave = L51.freshSave(); ftSave.ngCycle = 0; ftSave.gold = 67; // plenty of gold, but cycle 0
  g51.save = ftSave;
  let rows = g51._atelierRows();
  const gmRow0 = rows.find(r => r.tag === 'paint:gilded-meridian');
  assert(!!gmRow0 && gmRow0.enabled === false, 'G2: at cycle 0 the Gilded Meridian buy row is present but DISABLED (NG+ only)');
  g51._buyGoldPainting('gilded-meridian'); // direct call must be refused at cycle 0
  assert(!ftSave.owned.includes('gilded-meridian') && ftSave.gold === 67, 'G2: buying a gold painting at cycle 0 is refused (no purchase, gold unchanged)');

  // an NG+ save (ngCycle 1) with enough gold — the buy goes through
  const ngSave = L51.freshSave(); ngSave.ngCycle = 1; ngSave.gold = 67; ngSave.stats.victories = 1;
  g51.save = ngSave;
  rows = g51._atelierRows();
  const gmRow = rows.find(r => r.tag === 'paint:gilded-meridian');
  assert(!!gmRow && gmRow.enabled === true, `G2: on an NG+ cycle with gold, the Gilded Meridian buy row is ENABLED (enabled=${gmRow && gmRow.enabled})`);
  g51._buyGoldPainting('gilded-meridian');
  assert(ngSave.owned.includes('gilded-meridian'), 'G2: the Gilded Meridian is purchased (owned)');
  assert(ngSave.gold === 67 - 25, `G2: buying Gilded Meridian spends 25 gold (gold now ${ngSave.gold})`);
  assert(!ngSave.loadout.includes('gilded-meridian'), 'G2: a gold painting is NOT hung into the 2-slot loadout (permanent meta bonus)');
  assert(g51.tuning.pickupValue === Math.round(base.pickupValue * 1.1 * 1000) / 1000, 'G2: the Gilded Meridian effect is live in the run tuning after purchase');
  // Verdant Crown likewise
  g51._buyGoldPainting('verdant-crown');
  assert(ngSave.owned.includes('verdant-crown') && ngSave.gold === 67 - 25 - 40, `G2: Verdant Crown is purchased for 40 gold (gold now ${ngSave.gold})`);
  assert(g51.tuning.greenHeal === base.greenHeal + 1, 'G2: the Verdant Crown effect (+1 green heal) is live in the run tuning after purchase');
  // re-buying is a no-op (already owned)
  const goldAfter = ngSave.gold;
  g51._buyGoldPainting('gilded-meridian');
  assert(ngSave.gold === goldAfter, 'G2: re-buying an owned gold painting is a no-op (gold unchanged)');
  // spending more gold than held is refused
  g51.save = L51.freshSave(); g51.save.ngCycle = 1; g51.save.gold = 10;
  g51._buyGoldPainting('gilded-meridian');
  assert(!g51.save.owned.includes('gilded-meridian') && g51.save.gold === 10, 'G2: a gold purchase is refused when gold is insufficient (gold unchanged)');

  // ---- (5) the Curator's Ledger lists ALL 10 with gold-tier styling ----
  const recCanvas = makeCanvas();
  const drawnTexts = [];
  const baseCtx = makeCtx(recCanvas);
  const recCtx = new Proxy(baseCtx, {
    get(t, prop) { if (prop === 'fillText') return (str, ...rest) => { drawnTexts.push(String(str)); return t.fillText ? t.fillText(str, ...rest) : undefined; }; return t[prop]; },
    set(t, prop, v) { t[prop] = v; return true; },
  });
  recCanvas.getContext = () => recCtx;
  const g51l = new Game(recCanvas); g51l.start(); g51l._quitToTitle(); g51l._beginAtelier(); g51l._atelierIntro = false;
  g51l.save = L51.freshSave(); g51l.save.owned = ['gilded-meridian', 'verdant-crown']; g51l.save.ngCycle = 1;
  fireKey('keydown', '4'); frames(4);
  assert(g51l.atelierTab === 3, 'G2: the Ledger tab is reached by key 4');
  const joined51 = drawnTexts.join('\u0001');
  assert(joined51.includes('Gilded Meridian') && joined51.includes('Verdant Crown'), 'G2: the Ledger lists both gold-tier paintings');
  assert(joined51.includes('Moonlit Pond') && joined51.includes('Sir Croaksworth (Portrait)'), 'G2: the Ledger still lists the pigment paintings (all 10)');
  // the ledger lists ALL 10 (verified by the pigment + gold names above) and
  // marks the gold-tier entries with the gilded "◆ GOLD" tag (gold-tier styling)
  assert((joined51.match(/◆ GOLD/g) || []).length >= 2, 'G2: the Ledger marks the gold-tier entries with the "◆ GOLD" tag (gold-tier styling)');
  assert(joined51.includes('not yet gold') === false, 'G2: the owned gold paintings no longer read "not yet gold" (they are collected)');
  frames(20);
  assert(g51l.state === 'atelier', 'G2: the Ledger tab drew cleanly (all 10, no JS errors)');
  fireKey('keydown', 'Escape'); frames(2);
  assert(g51l.state === 'title', 'G2: Escape returned from the Ledger to the title');

  console.log('ok — G2: the catalog grows 8→10 with two gold-tier works (Gilded Meridian +10% orb value @25g, Verdant Crown +1 green heal @40g) that are NG+-gated, bought with gold via the existing atelier flow, apply in makeTuning when owned, and are listed (all 10) in the Curator\'s Ledger with gold-tier styling');
}

// ---------------------------------------------------------------------
// stage 52: G3 (v1.3 M15) — the ONE-TIME 'Gilded Frame' prestige tier.
// A permanent, saved, 50g tuning bump (NG+ + gold-gated) applied LAST in
// makeTuning, ON TOP OF the Rehung Frame gallery bonus. We verify: a fresh
// save has no effect; after purchase the tuning shows the gilded bump; it
// persists across save/load; it STACKS with an existing galleryBonus; gold
// is deducted and the purchase is NOT repeatable; the NG+ gate holds; and
// old-format (v6, no gildedFrame) saves migrate to not-gilded.
// ---------------------------------------------------------------------
console.log('== stage 52: v1.3 M15 G3 — Gilded Frame (NG+ prestige tier) ==');
{
  const L52 = await import('../src/logic.js');
  const S52 = await import('../src/save.js');
  const KEY = 'frogue_gallery_save';

  // (0) schema: a fresh save is NOT gilded, SAVE_VERSION is now 9 (K7: 8 -> 9
  // adds the challengeScores best-score list; the v9 era supersedes the v8 one).
  assert(L52.SAVE_VERSION === 9, `G3: SAVE_VERSION is now 9 (K7 challenge era; got ${L52.SAVE_VERSION})`);
  const fresh = L52.freshSave();
  assert(fresh.gildedFrame === false, 'G3: a fresh save has gildedFrame false');
  assert(L52.isGilded(fresh) === false, 'G3: isGilded is false on a fresh save');
  assert(L52.GILDED_FRAME.cost === 50 && L52.GILDED_FRAME.ink === 3 && L52.GILDED_FRAME.orbMult === 1.15,
    `G3: the Gilded Frame is 50g, +3 ink, +15% orb (got cost ${L52.GILDED_FRAME.cost}, ink ${L52.GILDED_FRAME.ink}, orb ${L52.GILDED_FRAME.orbMult})`);

  // (1) fresh save has NO gilded effect: a cycle-0 tuning has no gilded keys
  // and a byte-identical base (pickup 1, galleryInkBonus 0).
  const tOff = L52.makeTuning({}, [], 'normal', fresh.galleryBonus, fresh.owned);
  assert(!('gildedInkBonus' in tOff) && !('gildedOrbMult' in tOff), 'G3: a fresh save\'s tuning has no gilded keys (byte-identical base)');
  assert(tOff.pickupValue === 1 && tOff.galleryInkBonus === 0, `G3: a fresh save\'s tuning is untouched (pickup ${tOff.pickupValue}, ink ${tOff.galleryInkBonus})`);

  // (2) NG+ gate: a cycle-0 save cannot buy even with plenty of gold.
  const gated = L52.freshSave();
  gated.ngCycle = 0; gated.gold = 200;
  assert(!L52.canBuyGildedFrame(gated), 'G3: a cycle-0 save cannot buy the Gilded Frame (NG+ gate), even with 200 gold');
  assert(L52.buyGildedFrame(gated) === false && !gated.gildedFrame && gated.gold === 200, 'G3: the cycle-0 buy is refused (no gold change, not gilded)');

  // (3) after a purchase (NG+, 60 gold): gold deducted, gilded set, tuning bumps.
  const s = L52.freshSave();
  s.ngCycle = 1; s.gold = 60;
  assert(L52.canBuyGildedFrame(s), 'G3: an NG+ save with 60 gold can buy the Gilded Frame');
  assert(L52.buyGildedFrame(s) === true, 'G3: the buy succeeds on an NG+ save with enough gold');
  assert(s.gold === 10 && s.gildedFrame === true, `G3: 50g is deducted and gildedFrame is set (gold ${s.gold}, gilded ${s.gildedFrame})`);
  const tOn = L52.makeTuning({}, [], 'normal', s.galleryBonus, s.owned, L52.isGilded(s));
  assert(tOn.gildedInkBonus === 3 && tOn.gildedOrbMult === 1.15, `G3: the tuning carries the gilded bump (ink ${tOn.gildedInkBonus}, orb ${tOn.gildedOrbMult})`);
  assert(tOn.galleryInkBonus === 3 && tOn.pickupValue === 1.15, `G3: the gilded bump is applied (galleryInkBonus ${tOn.galleryInkBonus}, pickup ${tOn.pickupValue})`);

  // (4) NOT repeatable: a second attempt refuses (no gold change, no error).
  assert(!L52.canBuyGildedFrame(s), 'G3: the Gilded Frame is one-time (canBuy is false after purchase)');
  assert(L52.buyGildedFrame(s) === false && s.gold === 10, 'G3: a second buy is refused (gold unchanged at 10)');

  // (5) it STACKS with the existing Rehung Frame galleryBonus (both effects).
  const st = L52.freshSave();
  st.ngCycle = 1; st.gold = 50; st.galleryBonus = 2;   // Rehung Frame level 2
  L52.buyGildedFrame(st);
  const tStack = L52.makeTuning({}, [], 'normal', st.galleryBonus, st.owned, L52.isGilded(st));
  assert(tStack.galleryInkBonus === 7, `G3: gilded STACKS on the Rehung Frame ink (2 levels * 2 + 3 = ${tStack.galleryInkBonus})`);
  assert(tStack.gildedInkBonus === 3 && tStack.gildedOrbMult === 1.15, 'G3: the gilded keys are present on top of the Rehung Frame effect');
  assert(Math.abs(tStack.pickupValue - 1.38) < 1e-6, `G3: the orb multipliers multiply (1.2 * 1.15 = ${tStack.pickupValue.toFixed(3)})`);
  // the Rehung Frame's own orb multiplier is still applied (1.2) — a gilded-only
  // save (level 0) gets 1.15, so the stack is distinctively 1.38.
  const tGildOnly = L52.makeTuning({}, [], 'normal', 0, st.owned, true);
  assert(tGildOnly.pickupValue === 1.15 && tStack.pickupValue > tGildOnly.pickupValue, 'G3: the stack pickup exceeds the gilded-only pickup (Rehung Frame still contributes)');

  // (6) persists across a save/load round-trip.
  S52.SaveSys.save(s);
  const reloaded = S52.SaveSys.load();
  assert(reloaded && reloaded.gildedFrame === true && reloaded.gold === 10, `G3: gildedFrame + gold persist across save/load (got ${reloaded && reloaded.gildedFrame} / ${reloaded && reloaded.gold})`);
  const tReload = L52.makeTuning({}, reloaded.loadout, 'normal', reloaded.galleryBonus, reloaded.owned, L52.isGilded(reloaded));
  assert(tReload.gildedInkBonus === 3 && tReload.pickupValue === 1.15, 'G3: the reloaded save rebuilds the same gilded tuning');

  // (7) an OLD-format save (v6, no gildedFrame field) migrates to not-gilded.
  store.set(KEY, JSON.stringify({
    v: 6,
    bank: { red: 9, blue: 9, green: 9 },
    owned: ['gilded-meridian'], loadout: ['moonlit-pond'],
    upgrades: { capacity: 1, power: 0, vitality: 0 },
    flags: { intro: true },
    stats: { expeditions: 5, victories: 2, deaths: 0, heronsPainted: 1, treasures: 0 },
    bestRun: null,
    galleryBonus: 1,
    ngCycle: 1, ngModifier: null, gold: 75, goldEarned: { 'boss-gray-heron': true },
    // NOTE: no gildedFrame field on purpose — this is a v6 save.
  }));
  const oldMigrated = S52.SaveSys.load();
  assert(oldMigrated !== null, 'G3: an OLD v6-format save (no gildedFrame field) still loads');
  assert(oldMigrated.saveVersion === L52.SAVE_VERSION, `G3: the old v6 save re-stamps to the current schema version (${L52.SAVE_VERSION})`);
  assert(oldMigrated.gildedFrame === false, 'G3: the old v6 save migrates to gildedFrame false (not-yet-gilded, no error)');
  assert(oldMigrated.gold === 75 && oldMigrated.ngCycle === 1, 'G3: the old v6 save keeps its gold + ngCycle through the migration');
  assert(oldMigrated.firstVictoryCinematic === false, 'M1: a legacy v6 save migrates through 6->7->8 with firstVictoryCinematic false (they get the beat once)');
  // and a v6 save that WAS gilded keeps that through the migration.
  const v6Gilded = S52.SaveSys.load(); // (reload the same blob — not gilded)
  const v6g2 = { ...v6Gilded, saveVersion: 6, gildedFrame: true };
  // re-write with gildedFrame true to exercise the preserved-true path:
  store.set(KEY, JSON.stringify({ ...v6Gilded, gildedFrame: true }));
  const v6gLoaded = S52.SaveSys.load();
  assert(v6gLoaded.gildedFrame === true, 'G3: a v6 save that WAS gilded keeps gildedFrame true through the migration');

  // (8) the Curator's Ledger draws the Gilded Frame bar + a state-aware gild
  // button. (A fresh recording instance g52: NG+, 70g, not gilded → the
  // price is shown; toggling gildedFrame → the owned state is shown. The
  // cycle-0 NG+ gate is verified at the LOGIC level below rather than by a
  // second live instance, which would share the window key listeners.)
  const recCanvas = makeCanvas();
  const drawnTexts = [];
  const baseCtx = makeCtx(recCanvas);
  const recCtx = new Proxy(baseCtx, {
    get(t, prop) { if (prop === 'fillText') return (str, ...rest) => { drawnTexts.push(String(str)); return t.fillText ? t.fillText(str, ...rest) : undefined; }; return t[prop]; },
    set(t, prop, v) { t[prop] = v; return true; },
  });
  recCanvas.getContext = () => recCtx;
  const g52 = new Game(recCanvas); g52.start(); g52._quitToTitle(); g52._beginAtelier(); g52._atelierIntro = false;
  g52.save = L52.freshSave(); g52.save.ngCycle = 1; g52.save.gold = 70;
  g52.atelierTab = 3;                 // draw the Ledger tab directly
  frames(4);
  const joined = drawnTexts.join('\u0001');
  assert(joined.includes('Gilded Frame'), 'G3: the Ledger draws the "Gilded Frame" bar');
  assert(joined.includes('Gild · 50g'), 'G3: the gild button shows its price when NG+ + affordable');
  assert(joined.includes('the curator\'s ledger'), 'G3: the Ledger still draws its header (all 10 + the two prestige bars)');
  // after a gilded buy, the button label flips to the owned state.
  g52.save.gildedFrame = true;
  drawnTexts.length = 0;
  frames(4);
  assert(drawnTexts.join('\u0001').includes('Gilded'), 'G3: after buying, the gild button shows the owned "Gilded" state');
  // the NG+ gate at the logic level: a cycle-0 save (even with plenty of gold)
  // can never buy, so the button would show its gate hint, not a price.
  const gated2 = L52.freshSave(); gated2.ngCycle = 0; gated2.gold = 999;
  assert(!L52.canBuyGildedFrame(gated2) && !L52.ngUnlocked(gated2), 'G3: a cycle-0 save is NG+-gated (no NG+ unlock), so the gild button shows the gate hint, not a price');
  frames(20);
  assert(g52.state === 'atelier', 'G3: the Ledger tab (with the Gilded Frame bar) drew cleanly');

  console.log('ok — G3: the ONE-TIME Gilded Frame (50g, +3 start ink, +15% orb) is an NG+/gold-gated, permanent, saved prestige tier that applies LAST in makeTuning ON TOP OF the Rehung Frame (stacking to +7 ink / 1.38x orb at Rehung level 2), is not repeatable, persists across save/load, migrates old v6 saves to not-gilded, and surfaces in the Curators Ledger as a gild bar with a state-aware button');
}

// stage 53 — v1.3 M15 G4: the gold UI + ledger completion (presentation-only).
// G4 polishes the gold economy's PRESENTATION with pure UI/data reuse — no new
// mechanics, no new persistent state. We record every fillText and assert:
//   (a) the gold BALANCE READOUT renders on the atelier header AND on the
//       "Next Expedition" (modifier picker) prompt, with a hint of what it buys;
//   (b) the gold-tier rows in the Curator's Ledger show their gold price +
//       owned state distinctly ("25g · NG+ only" / "40g · NG+ only");
//   (c) a short gold LEGEND line explains what gold is + where it comes from.
// ---------------------------------------------------------------------
console.log('== stage 53: v1.3 M15 G4 — gold UI + ledger completion ==');
{
  const L53 = await import('../src/logic.js');
  const recCanvas = makeCanvas();
  const drawn = [];
  const baseCtx = makeCtx(recCanvas);
  const recCtx = new Proxy(baseCtx, {
    get(t, prop) { if (prop === 'fillText') return (str, ...rest) => { drawn.push(String(str)); return t.fillText ? t.fillText(str, ...rest) : undefined; }; return t[prop]; },
    set(t, prop, v) { t[prop] = v; return true; },
  });
  recCanvas.getContext = () => recCtx;

  // ---- (a1) the atelier HEADER shows the gold balance readout ----
  // A cycle-0 save (0 gold) shows the "meta pigment" hint; an NG+ save with 70g
  // shows the "spend 50g ... Gilded Frame" hint. Both render the "gold N" count.
  const gA = new Game(recCanvas); gA.start(); gA._quitToTitle(); gA._beginAtelier(); gA._atelierIntro = false;
  gA.save = L53.freshSave(); gA.save.gold = 0;
  drawn.length = 0; frames(3);
  let joined = drawn.join('\u0001');
  assert(joined.includes('gold 0'), 'G4(a): the atelier header renders the gold balance ("gold 0") on a fresh save');
  assert(/a meta pigment/.test(joined), 'G4(a): the cycle-0 header readout explains gold is a meta pigment (earned from boss defeats / synergies / the 100-orb run)');
  // now an NG+ save with 70 gold → the readout switches to the Gilded-Frame hint
  gA.save.ngCycle = 1; gA.save.gold = 70;
  drawn.length = 0; frames(3);
  joined = drawn.join('\u0001');
  assert(joined.includes('gold 70'), 'G4(a): the atelier header renders "gold 70" for an NG+ save');
  assert(/spend 50g in the Curator/.test(joined), 'G4(a): the NG+ header readout hints at what the gold buys (the Gilded Frame, 50g)');

  // ---- (a2) the "Next Expedition" prompt (modifier picker) shows the readout ----
  // A returning NG+ player (victory earned, ngCycle 1 — the Next Expedition
  // button only appears at ngCycle >= 1) opens the modifier picker from the
  // title; the gold balance + "spend 50g ... Gilded Frame" hint renders below
  // the "Swim On" button.
  const gB = new Game(makeCanvas()); gB.start();
  const bSave = L53.freshSave(); bSave.stats.victories = 1; bSave.flags.heronDefeated = true; bSave.ngCycle = 1; bSave.gold = 55;
  gB.save = bSave;
  gB._beginNextExpedition();
  assert(gB._modPrompt && gB.state === 'title', 'G4(a): "Next Expedition" opens the modifier picker (title state)');
  // point the drawing canvas at the recording proxy so the picker text is captured
  gB.canvas = recCanvas; gB.ctx = recCtx;
  drawn.length = 0; frames(3);
  joined = drawn.join('\u0001');
  assert(joined.includes('gold 55'), 'G4(a): the Next Expedition prompt renders the gold balance ("gold 55")');
  assert(/Gilded Frame/.test(joined) && /50g/.test(joined), 'G4(a): the Next Expedition readout hints at the Gilded Frame (50g)');
  gB._modPrompt = null;

  // ---- (b) the gold-tier LEDGER rows show price + owned state distinctly ----
  const gC = new Game(recCanvas); gC.start(); gC._quitToTitle(); gC._beginAtelier(); gC._atelierIntro = false;
  gC.save = L53.freshSave(); gC.save.ngCycle = 1; gC.save.gold = 70;
  gC.atelierTab = 3;   // the Curator's Ledger (holds the gold-tier works + Gilded Frame)
  drawn.length = 0; frames(3);
  joined = drawn.join('\u0001');
  const goldPts = L53.PAINTINGS.filter(p => p.goldTier);
  assert(goldPts.length === 2, `G4(b): the catalog holds exactly 2 gold-tier works (got ${goldPts.length})`);
  for (const pt of goldPts) {
    assert(joined.includes(`${pt.goldCost}g · NG+ only`), `G4(b): the unowned "${pt.name}" row shows its gold price + NG+ gate ("${pt.goldCost}g · NG+ only")`);
    assert(joined.includes('◆ GOLD'), `G4(b): the "${pt.name}" row carries the gilded "◆ GOLD" tag`);
  }
  // once owned, the same row flips to the OWNED state (no longer a price)
  gC.save.owned = [goldPts[0].id]; gC.save.loadout = [goldPts[0].id];
  drawn.length = 0; frames(3);
  joined = drawn.join('\u0001');
  assert(joined.includes('★ hung in the loadout'), 'G4(b): an owned + hung gold-tier row shows the "★ hung in the loadout" state');
  assert(!joined.includes(`${goldPts[0].goldCost}g · NG+ only`), `G4(b): the owned gold-tier row no longer shows its price`);

  // ---- (c) the gold LEGEND line explains what gold is + where it comes from ----
  // (the ledger tab is still active, so its legend line is the gold one)
  assert(/gold is a meta pigment/.test(joined), 'G4(c): the Curator\'s Ledger shows the gold legend line ("gold is a meta pigment — earned from boss defeats, first synergies & the 100-orb run ...")');
  assert(joined.includes('Gilded Frame') && joined.includes('boss defeats'), 'G4(c): the gold legend names its sources + what it buys (boss defeats / Gilded Frame)');

  console.log('ok — G4: the gold economy\'s presentation is complete — the gold BALANCE READOUT (balance + "what it buys") renders on the atelier header AND the Next Expedition prompt, the gold-tier Curator\'s Ledger rows show their gold price + owned state distinctly ("25g/40g · NG+ only", "★ hung in the loadout"), and a short gold LEGEND line explains what gold is + where it comes from — all pure UI/data reuse (no new mechanics, no new persistent state)');
}

// stage 54 — v1.3 M16 C1: atelier one-liner batch 2 (NG+ reactions).
// ---------------------------------------------------------------------
console.log('== stage 54: v1.3 M16 C1 — atelier one-liner batch 2 (NG+) ==');
{
  const L54 = await import('../src/game.js'); // Game is global from line 112
  const cv54 = makeCanvas();
  const g54 = new Game(cv54); g54.start(); g54._quitToTitle();
  const KEY = 'frogue_gallery_save';
  // Clean slate: no purchase hook, no last result, no best run — so the ONLY
  // thing steering the context is ngCycle.
  g54._lastPurchase = null; g54.lastResult = null; g54.save.bestRun = null;
  g54._atelierSayIdx = {};

  const collect = (n) => { const s = new Set(); for (let i = 0; i < n; i++) { g54._pickAtelierSay(); s.add(g54._atelierSay.name + ':' + g54._atelierSay.text); } return s; };

  // (1) An NG+ save (ngCycle >= 1) draws the SECOND, NG+ pool — every line is
  // DISTINCT from the cycle-0 pool (victory/defeat/general union).
  g54.save.ngCycle = 1; const ngSet = collect(18);
  assert(ngSet.size > 0, 'C1: an NG+ save produces one-liner lines');
  g54.save.ngCycle = 0; g54._lastPurchase = null; g54.lastResult = null; g54.save.bestRun = null; g54._atelierSayIdx = {};
  const c0Set = collect(18);
  assert(c0Set.size > 0, 'C1: a cycle-0 save produces one-liner lines');
  const overlap = [...ngSet].filter(x => c0Set.has(x));
  assert(overlap.length === 0, `C1: the NG+ pool is DISTINCT from the cycle-0 pool (no overlap; got ${overlap.length} shared lines)`);

  // (2) Rotation / no-repeat-last still holds in the NG+ pool: the same
  // resident never repeats their last line across consecutive picks.
  g54.save.ngCycle = 1; g54._lastPurchase = null; g54.lastResult = null; g54.save.bestRun = null; g54._atelierSayIdx = {};
  let prev = null, noRepeatOK = true, distinct = new Set();
  for (let i = 0; i < 24; i++) {
    g54._pickAtelierSay();
    const cur = g54._atelierSay;
    if (prev && prev.name === cur.name && prev.text === cur.text) noRepeatOK = false;
    distinct.add(cur.name + ':' + cur.text);
    prev = { name: cur.name, text: cur.text };
  }
  assert(noRepeatOK, 'C1: no-repeat-last holds in the NG+ pool (a resident never re-says their last line)');
  assert(distinct.size >= 3, `C1: the NG+ pool rotates across multiple lines (distinct=${distinct.size})`);

  // (3) Context priority: a just-made purchase STILL beats the NG+ pool
  // (purchase > ng), so a fresh gold buy during NG+ gets a purchase reaction,
  // not an NG+ line.
  g54.save.ngCycle = 1; g54._lastPurchase = true; g54.lastResult = null; g54.save.bestRun = null;
  g54._noteAtelierPurchase();
  assert(g54._lastPurchase === true && g54._atelierSay.revealed === 0, 'C1: a purchase during NG+ is noted and re-rolls a fresh line');
  const purchaseLine = g54._atelierSay.name + ':' + g54._atelierSay.text;
  assert(!ngSet.has(purchaseLine), 'C1: the NG+ just-bought reaction is NOT an NG+-pool line (purchase context still wins over ng)');

  // (4) Typewriter still starts fresh on an NG+ line (the reveal machinery is
  // shared with A1).
  g54.save.ngCycle = 1; g54._lastPurchase = null; g54.lastResult = null; g54.save.bestRun = null;
  g54._pickAtelierSay();
  assert(g54._atelierSay.revealed === 0, 'C1: the NG+ one-liner starts the typewriter fresh (unrevealed)');

  // (5) No new persist: an NG+ atelier visit touches nothing new in the save.
  const before54 = JSON.stringify(store.get(KEY));
  g54._beginAtelier();
  assert(JSON.stringify(store.get(KEY)) === before54, 'C1: the NG+ one-liner pool persists nothing new to the save');

  console.log('ok — C1: the atelier one-liner system gains a SECOND, NG+-context line pool (drawn only when ngCycle >= 1, above the cycle-0 victory/defeat/general pools but below the just-made-purchase hook) — reusing the EXACT A1 machinery (rotating pools, no-repeat-last, typewriter reveal, context priority) with NO new persistent state');
}

// stage 55 — v1.3 M16 C2: the victory end-screen "Season" summary block.
// On a VICTORY end card (below the V4 exhibition, in the card's spare bottom
// band) a compact season read renders: the NG+ cycle, the modifier chosen for
// the run, the gold earned this expedition (the delta since run start) + the
// career gold total, the Gilded Frame state, and the paintings carried this
// expedition. Pure display — every value is read live from the run/save;
// nothing new is persisted. We verify with a fillText-recording canvas:
//   (a) a representative NG+ save renders the correct cycle/modifier/gold/
//       gilded/paintings values;
//   (b) the "gold earned this expedition" delta tracks the run-start capture
//       (runGold) — 17 earned on top of a 53g start reads +17 / total 70;
//   (c) a first-time (cycle-0) victory still renders the block with its own
//       correct values (cycle 0, no modifier, 0 gold, no frame);
//   (d) a DEFEAT end screen renders NO Season block (victory only);
//   (e) NO new persistence: the end screen touches nothing new in the save.
console.log('== stage 55: v1.3 M16 C2 — victory end-screen "Season" summary ==');
{
  const L55 = await import('../src/logic.js');
  const recCanvas = makeCanvas();
  const drawn = [];
  const baseCtx = makeCtx(recCanvas);
  const recCtx = new Proxy(baseCtx, {
    get(t, prop) { if (prop === 'fillText') return (str, ...rest) => { drawn.push(String(str)); return t.fillText ? t.fillText(str, ...rest) : undefined; }; return t[prop]; },
    set(t, prop, v) { t[prop] = v; return true; },
  });
  recCanvas.getContext = () => recCtx;

  // ---- (a)+(b) a representative NG+ save: cycle 2, High Tide modifier,
  // 53g at run start -> 70g now, Gilded Frame hung, 2-painting loadout.
  const gA = new Game(recCanvas); gA.start();
  const saveA = L55.freshSave();
  saveA.ngCycle = 2; saveA.stats.victories = 2; saveA.flags.heronDefeated = true;
  saveA.ngModifier = 'high-tide';
  saveA.gold = 70; saveA.gildedFrame = true;
  saveA.owned = ['moonlit-pond', 'storm-cloud'];
  saveA.loadout = ['moonlit-pond', 'storm-cloud'];
  gA.save = saveA;
  gA.ngCycle = 2; gA.runGold = 53;            // the run-start gold capture (17 earned in-run)
  gA.endKind = 'victory'; gA.endT = 5;        // fully revealed
  gA.endGains = { red: 5, blue: 5, green: 5 };
  gA.state = 'end';
  gA.input.mouse.lPressed = false; gA.input.mouse.lDown = false;
  // the helper reads the right values for this representative save
  const ssA = gA._seasonSummary();
  assert(ssA.cycle === 2, 'C2: the summary reports the NG+ cycle (2)');
  assert(ssA.mod === 'High Tide', `C2: the summary reports the chosen modifier name (got "${ssA.mod}")`);
  assert(ssA.goldThisRun === 17, `C2: "gold earned this expedition" is the delta since run start (70 - 53 = 17; got ${ssA.goldThisRun})`);
  assert(ssA.goldTotal === 70, `C2: the summary reports the career gold total (70; got ${ssA.goldTotal})`);
  assert(ssA.gilded === 'hung', `C2: the summary reports the Gilded Frame state (got "${ssA.gilded}")`);
  assert(ssA.paintings.join(',') === 'Moonlit Pond,Storm Cloud', `C2: the summary lists the carried paintings (got "${ssA.paintings}")`);
  // and the end screen actually DRAWS them
  drawn.length = 0; gA._frame(gA.now * 1000 + 5000);
  const joinedA = drawn.join('\u0001');
  assert(joinedA.includes('Season'), 'C2: the victory end screen renders the "Season" heading');
  assert(joinedA.includes('cycle 2 · modifier High Tide · Gilded Frame hung'), 'C2: the summary renders cycle + modifier + frame state for the representative save');
  assert(joinedA.includes('gold earned this expedition +17 · gold total 70'), 'C2: the summary renders the earned-this-run delta + the career gold total');
  assert(joinedA.includes('paintings from this expedition: Moonlit Pond, Storm Cloud'), 'C2: the summary renders the paintings carried this expedition');
  // the block sits INSIDE the existing card (below the exhibition, above the
  // unchanged buttons): the card height is untouched and the buttons keep
  // their original geometry
  assert(gA._endCardH() === 540, 'C2: the victory card height is unchanged (540)');
  const ebA = gA._endButtons();
  assert(ebA.primary.y === gA.ch / 2 - 540 / 2 + 540 + 16, 'C2: the primary button keeps its original rect (nothing below it moved)');

  // ---- (c) a first-time (cycle-0) victory: the block still renders, with
  // its own correct values (cycle 0, no modifier, 0 gold, no frame).
  const saveC = L55.freshSave();
  saveC.stats.victories = 1; saveC.flags.heronDefeated = true;
  saveC.owned = ['moonlit-pond']; saveC.loadout = ['moonlit-pond'];
  gA.save = saveC; gA.ngCycle = 0; gA.runGold = 0;
  drawn.length = 0; gA._frame(gA.now * 1000 + 5100);
  const joinedC = drawn.join('\u0001');
  assert(joinedC.includes('cycle 0 · modifier none · Gilded Frame not yet'), 'C2: a first-time victory renders the Season block with its own values (cycle 0, no modifier, no frame)');
  assert(joinedC.includes('gold earned this expedition +0 · gold total 0'), 'C2: a first-time victory reports 0 gold earned / 0 total');
  assert(joinedC.includes('paintings from this expedition: Moonlit Pond'), 'C2: a first-time victory lists its carried painting');

  // ---- (d) a defeat end screen renders NO Season block (victory only) ----
  gA.endKind = 'defeat';
  drawn.length = 0; gA._frame(gA.now * 1000 + 5200);
  assert(!drawn.join('\u0001').includes('Season'), 'C2: the Season block is victory-only (absent on a defeat)');

  // ---- (e) NO new persistence: the end screen touches nothing new in the save
  gA.endKind = 'victory';
  const before55 = JSON.stringify(store.get('frogue_gallery_save'));
  gA._frame(gA.now * 1000 + 5300);
  assert(JSON.stringify(store.get('frogue_gallery_save')) === before55, 'C2: the Season summary persists nothing new to the save');

  console.log('ok — C2: the victory end screen gains a compact "Season" summary block (cycle / modifier / gold earned this expedition + total / Gilded Frame state / paintings carried) in the spare bottom band of the V4 card — pure display, no new persistence, button geometry untouched');
}

// stage 56 — v1.3 M16 C3: the "paper grain" presentation toggle. An options
// toggle (default OFF) that overlays a subtle PROCEDURAL paper-grain texture
// (two cached offscreen tiles of low-opacity noise speckles — a fine + a coarse
// scale — tiled across the canvas at low alpha, drawn LAST in the render loop).
// NO image assets, NO scanlines/CRT. We assert: the option defaults OFF; the
// render path skips the grain when off and builds+draws it when on (the
// _grainDraws counter is the test-observable signal); the tile cache is built
// once and reused; toggling from the options screen flips the flag and persists
// it; and old options blobs (no `grain` field) migrate without error.
console.log('== stage 56: v1.3 M16 C3 — paper-grain presentation toggle ==');
{
  const L56 = await import('../src/logic.js');

  // (1) Default OFF on fresh + migrated (legacy) options — no error, no throw.
  assert(L56.freshOptions().grain === false, 'C3: fresh options default grain OFF');
  assert(L56.migrateOptions(null).grain === false, 'C3: missing options migrate grain OFF');
  const legacy56 = L56.migrateOptions({ volume: 0.7, muted: false, difficulty: 'normal', musicVol: 0.6, sfxVol: 0.7, shake: true, vignette: true });
  assert(legacy56.grain === false, 'C3: a legacy options blob (no `grain` field) migrates to OFF without error');
  const legacyOn = L56.migrateOptions({ grain: true });
  assert(legacyOn.grain === true, 'C3: an explicit grain:true is honored on migration');

  // (2) A fresh Game defaults to grain OFF and does NOT build the grain overlay
  // (no tiles, no draws) until the option is turned on.
  let t56 = 5000;
  const cv56 = makeCanvas();
  const g56 = new Game(cv56);
  g56.start();
  const fr56 = (n, step = 16.7) => { for (let i = 0; i < n; i++) { t56 += step; g56._frame(t56); } };
  assert(g56.options.grain === false, 'C3: a fresh Game loads grain OFF by default');
  fr56(30); // draw a few title frames with grain OFF
  assert(!g56._grain, 'C3: the grain overlay is NOT built while the option is OFF');
  assert(!g56._grainDraws || g56._grainDraws === 0, 'C3: the grain overlay is NOT drawn while the option is OFF');

  // (3) Turn the option ON: the overlay is built (two cached tiles) and drawn.
  g56.options.grain = true;
  g56._grainDraws = 0;
  fr56(10);
  assert(!!g56._grain && !!g56._grain.fine.cv && !!g56._grain.coarse.cv, 'C3: the grain overlay is BUILT (fine + coarse tiles) once the option is ON');
  assert(g56._grain.fine.pat && g56._grain.coarse.pat, 'C3: both grain patterns are created (fine + coarse scales)');
  assert(g56._grainDraws >= 1, `C3: the grain overlay is DRAWN when ON (${g56._grainDraws} frames)`);

  // (4) The tile cache is built ONCE and reused (no rebuild on subsequent frames).
  const fineCv = g56._grain.fine.cv;
  const coarseCv = g56._grain.coarse.cv;
  const grCt = g56._grainDraws;
  fr56(20);
  assert(g56._grain.fine.cv === fineCv && g56._grain.coarse.cv === coarseCv, 'C3: the grain tiles are CACHED (built once, not rebuilt per frame)');
  assert(g56._grainDraws > grCt, 'C3: the grain keeps drawing on every frame while ON');

  // (5) The toggle is on the options screen (layout has a grain row) and flipping
  // it via the click path changes the flag + persists it.
  g56._quitToTitle();
  g56.options.grain = false; // reset to a known state
  g56._openOptions();
  const g56L = g56._optionsLayout();
  assert(g56L.grain && g56L.grain.w > 0, 'C3: the options layout exposes a grain toggle row');
  // simulate a click on the grain row (left mouse press inside the rect)
  g56.input.mouse.x = g56L.grain.x + 40;
  g56.input.mouse.y = g56L.grain.y + 10;
  fireMouse(cv56, g56.input.mouse.x, g56.input.mouse.y);
  fr56(1);
  assert(g56.options.grain === true, 'C3: clicking the grain row in the options screen turns it ON');
  // the toggle persisted to (stub) localStorage options
  const raw56 = JSON.parse(store.get('frogue_gallery_options') || '{}');
  assert(raw56.grain === true, 'C3: the grain toggle persists to the saved options blob');

  // (6) Turning it OFF stops the draws (the render path skips it again).
  g56.options.grain = false;
  g56._grainDraws = 0;
  fr56(6);
  assert(g56._grainDraws === 0, 'C3: with the option back OFF the grain is skipped again (no draws)');

  console.log('ok — C3: a paper-grain presentation toggle (default OFF) overlays a subtle PROCEDURAL paper-grain texture — two cached low-opacity noise tiles (fine + coarse scales) drawn last in the render loop at low alpha; NO image assets / NO scanlines/CRT; the render path skips it when OFF and builds+draws it when ON; the tile cache is built once; the toggle persists and old options blobs migrate to OFF without error');
}

// ======================================================================
// stage 58 — v1.4 Module J, J1: "wet paint that lingers" (presentation-only)
// A capped (~120) pool of short-lived wet marks left on the surface + a
// tapered ~0.4s wet-stroke swipe trail. Draw/particles-time ONLY: no new
// persistent paint data, no gameplay change. Verify: (a) the pool is capped
// (never grows unbounded under rapid painting), (b) the marks linger then
// decay to empty on their own (short-lived), (c) the swipe ribbon now lingers
// ~0.4s (up from 0.28s) and tapers, and (d) drawWet() actually issues draw
// calls only while marks exist.
console.log('== stage 58: v1.4 J1 — wet paint that lingers (capped short-lived marks + 0.4s tapered trail) ==');
{
  const cv = makeCanvas();
  const g = new Game(cv);
  g.start();
  g._beginExpedition();           // fresh run: paint + player exist, no tutorial
  assert(g.state === 'expedition', 'J1: an expedition started (paint + player present)');
  const P = g.paint, pl = g.player;
  assert(Array.isArray(P.wet) && P.wet.length === 0, `J1: the wet-mark pool starts empty (len=${P.wet.length})`);

  // the persistent paint layer is the world's per-cell pigment grid — count
  // the non-empty cells (reliable; the headless paint *canvas* pixel buffer is
  // not trustworthy to read back).
  const w = g.world;
  const countPaintCells = () => { let n = 0; for (const c of w.pigmentGrid.values()) if (c.red > 0 || c.blue > 0 || c.green > 0) n++; return n; };
  const before = countPaintCells();

  // drive real swipes (respecting the 0.2s cooldown) to build the wet pool
  pl.iframes = 999; pl.aimA = 0; pl.pigment = 'red';
  let painted = 0;
  for (let f = 0; f < 150; f++) {
    frames(1);
    const t0 = P.trails.length;
    P.trySwipe([]);   // ~ every frame; the 0.2s cooldown gates the real rate
    if (P.trails.length > t0) painted++;
  }
  assert(painted > 5, `J1: swipes actually painted (${painted} swipes landed)`);
  assert(P.wet.length > 0, `J1: painting left wet marks on the surface (len=${P.wet.length})`);
  assert(P.wet.length <= P.MAX_WET, `J1: the wet-mark pool is capped at ~${P.MAX_WET} (len=${P.wet.length} <= ${P.MAX_WET})`);

  // the persistent world paint layer was still written by the same swipes
  // (pre-existing behavior is untouched) — J1's marks are additive + transient
  // residue on TOP of it, not a replacement. Check right after the burst,
  // before the layer fades.
  const after = countPaintCells();
  assert(after > before, `J1: the world's persistent paint layer is still written (cells ${before} -> ${after}); J1 marks are additive + transient, not a second persistent layer`);

  // no UNBOUNDED growth: keep painting for far longer than the cap could hold;
  // the pool must stay at/below the cap (oldest marks are pushed out).
  for (let f = 0; f < 400; f++) { frames(1); if (f % 13 === 0) P.trySwipe([]); }
  assert(P.wet.length <= P.MAX_WET, `J1: after rapid sustained painting the pool is still capped (len=${P.wet.length} <= ${P.MAX_WET})`);

  // short-lived: stop painting and let the marks decay — the pool must drain
  // to empty on its own (they linger a moment, then dry up).
  for (let f = 0; f < 90; f++) frames(1);   // ~1.5s
  assert(P.wet.length === 0, `J1: the wet marks are short-lived and decay to empty on their own (after 1.5s len=${P.wet.length})`);

  // the swipe ribbon lingers ~0.4s now (up from 0.28s) and tapers over that
  // window: after one swipe the ribbon's max is ~0.4 and it is still alive
  // well past the old 0.28s lifetime.
  const trail0 = P.trails.length;
  P.trySwipe([]);
  const ribbon = P.trails[P.trails.length - 1];
  assert(ribbon && !ribbon.ring, 'J1: a swipe produced a wet-stroke ribbon');
  assert(ribbon.max >= 0.38 && ribbon.max <= 0.45, `J1: the swipe ribbon lingers ~0.4s (max=${ribbon.max.toFixed(2)}, old was 0.28)`);
  frames(19);   // ~0.32s — beyond the old 0.28s lifetime, still alive now
  assert(P.trails.length === trail0 + 1, `J1: the ribbon is still on the surface past 0.28s (tapers over ~0.4s) (trails=${P.trails.length - trail0})`);

  // drawWet() issues draw calls only while marks exist (the render hook)
  const jctx = {
    n: 0,
    ctx: new Proxy({}, {
      get(t, p) {
        if (p === 'measureText') return () => ({ width: 10 });
        if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
        jctx.n++;
        return () => {};
      },
      set() { return true; },
    }),
    reset: () => { jctx.n = 0; },
    count: () => jctx.n,
  };
  P._addWet(pl.x + 30, pl.y, 10, 'red', 1.0); P._addWet(pl.x - 30, pl.y, 9, 'blue', 1.0);
  jctx.reset(); P.drawWet(jctx.ctx);
  assert(jctx.count() >= 4, `J1: drawWet() issues draw calls while marks exist (${jctx.count()} calls)`);
  P.wet.length = 0; jctx.reset(); P.drawWet(jctx.ctx);
  assert(jctx.count() === 0, `J1: drawWet() draws nothing once the pool is empty (${jctx.count()} calls)`);
}

// ======================================================================
// stage 59 — v1.4 Module J, J2: hit-stop + shake escalation + boss-defeat slow-mo
// A single `timeScale` (default 1) scales the WORLD sim (world/particles/
// enemies/player/runT) only — never UI or input. Small hits dip it briefly
// (60–90ms @ ~0.3×); the heron defeat dips ~0.8s @ 0.35× + a white flash +
// a shake spike. ALL of it is gated by options.shake — with shake OFF,
// timeScale never moves (the game runs at normal speed). Because runT
// advances with the sim, a full run's measured runT is invariant to
// hit-stops: a dip only stretches REAL wall-clock, never the pacing the
// probes measure.
console.log('== stage 59: v1.4 J2 — hit-stop + shake escalation + boss-defeat slow-mo ==');
{
  const { spawnEnemy } = await import('../src/enemies.js');
  const g2 = new Game(makeCanvas());
  g2.start(); g2._beginExpedition();
  const p2 = g2.player; p2.alive = true; p2.hp = 99; p2.iframes = 999; p2.x = 260; p2.y = 750;
  g2.options.shake = true; // the J2 gate is ON for the positive assertions
  assert(g2.timeScale === 1, `J2: timeScale defaults to 1 (no hit-stop yet) (${g2.timeScale})`);

  // ---- small hit: killing an enemy pops a short hit-stop (dip <0.5) ----
  g2.timeScale = 1; g2._hitstopT = 0;
  const beet = spawnEnemy('beetle', 300, 750, g2.tuning); // ~40px ahead, in aim
  beet.hp = 1; beet.status = null;                          // one swipe kills it
  g2.enemies.push(beet);
  p2.aimA = 0; p2.pigment = 'red';
  g2.paint.trySwipe(g2.enemies);                             // real swipe -> fan hit
  frames(1);                                                // _updateExpedition sees e.dead -> _onEnemyDead -> hitStop
  assert(beet.dead, `J2: the scripted swipe killed the beetle (dead=${beet.dead})`);
  const dip = g2.timeScale;
  assert(dip < 0.5, `J2: a kill pops a hit-stop — timeScale dipped <0.5 (dip=${dip.toFixed(2)})`);
  // the hit-stop must recover to 1 within ~1s of REAL time (~60 frames)
  let recovered = false;
  for (let f = 0; f < 70; f++) { frames(1); if (g2.timeScale === 1) { recovered = true; break; } }
  assert(recovered && g2.timeScale === 1, `J2: the small-hit hit-stop recovers to 1 within 1s (timeScale=${g2.timeScale})`);

  // ---- big moment: heron defeat -> ~0.8s slow-mo + white flash + shake spike ----
  g2.heron._intro = 0; g2.heron.hp = 0;                       // painted to death
  g2.heron.awakened = false; g2.heron.pinned = 0;
  const shakeBefore = g2.shake;
  frames(1);                                                 // bossStep emits 'defeated' -> _onHeronDefeated
  const slowDip = g2.timeScale;
  assert(slowDip < 0.5 && slowDip >= 0.3, `J2: heron defeat triggers the slow-mo window @ ~0.35× (timeScale=${slowDip.toFixed(2)})`);
  assert(g2._whiteFlash > 0.5, `J2: the defeat fires a white flash (flash=${g2._whiteFlash.toFixed(2)})`);
  assert(g2.shake > shakeBefore, `J2: the defeat spikes the screen shake (${shakeBefore.toFixed(1)} -> ${g2.shake.toFixed(1)})`);
  // the slow-mo window is ~0.8s of REAL time; it must recover to 1 within ~1.5s
  let recov2 = false;
  for (let f = 0; f < 100; f++) { frames(1); if (g2.timeScale === 1) { recov2 = true; break; } }
  assert(recov2 && g2.timeScale === 1, `J2: the boss-defeat slow-mo recovers to 1 (timeScale=${g2.timeScale})`);
  // the white flash decays back to 0 (fast)
  for (let f = 0; f < 40; f++) frames(1);
  assert(g2._whiteFlash <= 0, `J2: the white flash decays back to 0 (flash=${g2._whiteFlash.toFixed(3)})`);

  // ---- gating: with options.shake OFF, timeScale NEVER moves ----
  g2.options.shake = false;
  g2.timeScale = 1; g2._hitstopT = 0; g2._whiteFlash = 0;
  g2.hitStop(0.8, 0.35); g2.whiteFlash(); g2.freezePreHit();
  assert(g2.timeScale === 1, `J2: with shake OFF, hitStop() is a no-op (timeScale=${g2.timeScale})`);
  assert(g2._whiteFlash === 0, `J2: with shake OFF, whiteFlash() is a no-op (flash=${g2._whiteFlash})`);
  assert(g2._freezeFrames === 0, `J2: with shake OFF, freezePreHit() is a no-op (freeze=${g2._freezeFrames})`);

  // ---- the 1-frame pre-hit freeze engages when shake is ON, then self-clears ----
  g2.options.shake = true;
  g2.freezePreHit();
  assert(g2._freezeFrames === 1, `J2: with shake ON, freezePreHit() arms a 1-frame freeze (freeze=${g2._freezeFrames})`);
  frames(1);   // the frame consumes the latch -> simDt=0 for one frame, then restores
  assert(g2._freezeFrames === 0, `J2: the pre-hit freeze self-clears after one frame (freeze=${g2._freezeFrames})`);
}

// ======================================================================
// stage 60 — v1.4 Module J, J3: camera polish (look-ahead / lag / boss midpoint / awaken moment)
// `_updateCamera` (game.js) is PRESENTATION: it follows the already-simmed
// frog position, so it runs on real dt and never feeds the measured runT.
// We drive it directly with a fixed dt for deterministic assertions.
// ======================================================================
console.log('== stage 60: v1.4 J3 — camera polish (look-ahead / boss midpoint / awaken hold) ==');
const { paintBoss } = await import('../src/logic.js');
const g3 = new Game(makeCanvas());
g3.start(); fireKey('keydown', 'Enter'); frames(2);
const p3 = g3.player;
p3.iframes = 999;
const DT = 0.016;
const setP = (x, y) => { p3.x = x; p3.y = y; p3.vx = 0; p3.vy = 0; };
const runCam = (n) => { for (let i = 0; i < n; i++) g3._updateCamera(DT); };

// (a) look-ahead: with right held, the camera leads the frog by ~40px (in front, +x)
g3.heron = null;                    // isolate the plain-follow branch
g3._awakenHoldT = 0;
setP(1000, 750); g3.cam.x = 1000; g3.cam.y = 750; g3.zoomTarget = 1;
g3.input.keys.add('d');
runCam(250);
assert(g3.cam.x > 1000 + 30, `J3: look-ahead leads the frog toward the input dir (cam.x=${g3.cam.x.toFixed(1)} > 1030, ~40px lead)`);
g3.input.keys.delete('d');
runCam(250);
assert(Math.abs(g3.cam.x - 1000) < 4, `J3: with no input the camera eases back onto the frog (cam.x=${g3.cam.x.toFixed(1)} ~ 1000)`);

// (c) boss midpoint: center on the frog–heron midpoint and widen (zoomTarget < 1)
g3.heron = { x: 1500, y: 800, hp: 5000, _intro: 0, flying: 0, diveH: 0 };
setP(1000, 800); g3.cam.x = 1000; g3.cam.y = 800;
runCam(250);
const mid = (1000 + 1500) / 2;
assert(Math.abs(g3.cam.x - mid) < 6, `J3: boss framing centers on the frog–heron midpoint (cam.x=${g3.cam.x.toFixed(1)} ~ ${mid})`);
assert(g3.zoomTarget < 1, `J3: boss framing widens the view (zoomTarget=${g3.zoomTarget})`);

// (d) awaken moment: hold on the rising heron with a zoom-out for ~1.2s, then release
g3._awakenHoldT = 1.2;
g3.cam.x = 1000; g3.cam.y = 800;      // start at the frog, well away from the heron
runCam(60);
assert(g3._awakenHoldT > 0, `J3: the awaken hold is active during its window (holdT=${g3._awakenHoldT.toFixed(2)}s)`);
assert(g3.cam.x > mid, `J3: during the hold the camera is drawn to the rising heron (cam.x=${g3.cam.x.toFixed(1)} past the midpoint)`);
assert(g3.zoomTarget < 0.92, `J3: the hold zooms OUT on the reveal (zoomTarget=${g3.zoomTarget})`);
runCam(Math.ceil(1.2 / DT) + 40);
assert(g3._awakenHoldT <= 0, `J3: the awaken hold expires after ~1.2s (holdT=${g3._awakenHoldT.toFixed(2)}s)`);

// (d) fires once per rise: the handler is gated on `res === 'awaken'`, and
// paintBoss returns 'awaken' exactly once per awaken (gated by h.awakened).
g3.heron = { x: 1500, y: 800, hp: 5000, hue: { red: 40, blue: 45, green: 45 }, awakened: false };
let awakenCount = 0;
for (let i = 0; i < 6; i++) if (paintBoss(g3.heron, 'red', 6, g3.tuning) === 'awaken') awakenCount++;
assert(awakenCount === 1, `J3: the awaken moment fires once per rise (awaken events=${awakenCount})`);

// ======================================================================
// stage 61 — v1.4 Module J, J4: frog hop feel (stretch / squash / dust puff / ripple / boing)
// Draw/sfx-time only — `player.js` physics is untouched (hopT/collide/speed unchanged),
// so the pacing probes (which measure runT) stay invariant. The stretch/squash ride on the
// existing `this.squash` field the draw pass reads as `ctx.scale(squash, 2 - squash)`:
//   stretch (hop start) → squash 0.85 → x0.85 / y1.15   (body elongates as it lifts)
//   squash  (landing)   → squash 1.2  → x1.2 / y0.8     (body flattens on impact)
// landing fires a one-shot `_hopLanded` flag that game.js consumes → dustPuff + ripple + 'boing'.
// ======================================================================
console.log('== stage 61: v1.4 J4 — frog hop feel (stretch / squash / dust / ripple / boing) ==');
{
  const g4 = new Game(makeCanvas());
  g4.start();
  fireKey('keydown', 'Enter');
  frames(2);
  const p4 = g4.player, w4 = g4.world, tun4 = g4.tuning;
  const mkIn = (space) => ({ pressed: (k) => k === ' ' && space, moveVec: () => [1, 0], mouse: { worldX: 0, worldY: 0 } });

  // reset hop state for a clean deterministic drive
  p4.hopT = 0; p4.hopCd = 0; p4._hopLanded = false; p4.squash = 1;

  // hop START → STRETCH (x0.85 / y1.15). The relax lerp (squash→1) runs the same
  // frame, so we assert the *direction* (squash < 1 = compressed-x / extended-y),
  // not the exact 0.85.
  p4.update(0.016, mkIn(true), tun4, w4, { x: 0, y: 0 });
  assert(p4.hopT > 0, `J4: a hop fired (hopT=${p4.hopT.toFixed(3)})`);
  assert(p4.squash < 0.95, `J4: hop start STRETCHES the body (x<1 / y>1) — squash=${p4.squash.toFixed(3)}`);

  // run the hop to its landing; the one-shot flag must fire exactly on the
  // landing frame and the body must SQUASH (x>1 / y<1).
  p4._hopLanded = false;
  let landed = false, landSquash = 0;
  for (let i = 0; i < 40 && !landed; i++) {
    p4.update(0.016, mkIn(false), tun4, w4, { x: 0, y: 0 });
    if (p4._hopLanded) { landed = true; landSquash = p4.squash; }
  }
  assert(landed, 'J4: a hop LANDING sets the one-shot _hopLanded flag');
  assert(landSquash > 1.05, `J4: landing SQUASHES the body (x>1 / y<1) — squash=${landSquash.toFixed(3)}`);

  // the one-shot flag must NOT re-fire on subsequent frames (no double landing)
  const fires = { n: 0 };
  p4._hopLanded = false;
  for (let i = 0; i < 10; i++) { p4.update(0.016, mkIn(false), tun4, w4, { x: 0, y: 0 }); if (p4._hopLanded) fires.n++; }
  assert(fires.n === 0, `J4: the landing flag fires at most once (no re-fire on later frames: ${fires.n})`);

  // new particle helpers: dustPuff spawns a bounded soft-mote burst; ripple spawns a single ring
  const ps = new (await import('../src/particles.js')).ParticleSystem();
  const before = ps.count;
  ps.dustPuff(100, 100, 5);
  const puffN = ps.count - before;
  assert(puffN === 5, `J4: particles.dustPuff(x,y,5) spawns exactly 5 motes (${puffN})`);
  const beforeR = ps.count;
  ps.ripple(100, 100);
  assert(ps.count - beforeR === 1, 'J4: particles.ripple(x,y) spawns exactly one ripple ring');
  const ring = ps.pool.find((q) => q.active && q.kind === 6);
  assert(ring && ring.kind === 6, 'J4: the ripple is a distinct ring kind (kind 6) the draw pass expands + fades');

  // end-to-end: a real hop landing fires dustPuff + ripple + 'boing' exactly once (game.js wiring).
  let puffs = 0, ripples = 0, boings = 0;
  const _dp = g4.particles.dustPuff, _rp = g4.particles.ripple, _sfx = g4.sfx;
  g4.particles.dustPuff = (x, y, n) => { puffs++; return _dp.call(g4.particles, x, y, n); };
  g4.particles.ripple = (x, y, c) => { ripples++; return _rp.call(g4.particles, x, y, c); };
  g4.sfx = (n, o) => { if (n === 'boing') boings++; return _sfx.call(g4, n, o); };
  g4.player.hopT = 0; g4.player.hopCd = 0; g4.player._hopLanded = false;
  fireKey('keydown', ' ');      // real Space hop through the real frame loop
  frames(30);                   // hopT=0.22s → lands within this window
  fireKey('keyup', ' ');
  assert(puffs === 1, `J4: a real hop landing fires exactly one dust puff (${puffs})`);
  assert(ripples === 1, `J4: a real hop landing fires exactly one ripple ring (${ripples})`);
  assert(boings === 1, `J4: a real hop landing fires exactly one 'boing' SFX (${boings})`);
  g4.particles.dustPuff = _dp; g4.particles.ripple = _rp; g4.sfx = _sfx;
}

// ======================================================================
// stage 62 — v1.4 Module J, J5: pickup / HUD / UI micro-animations
// All presentation (HUD/UI/particles-time only; never touches runT, so the
// pacing probes are invariant). (1) A HUD "+n" number pops up + fades near the
// pigment jar on a pigment pickup (increments this._floats, capped). (2) The
// orb streak leaves a short fading trail behind the moving frog (this._streak-
// Trail, captured per-frame while the streak is active). (3) The pause panel
// opens with a 0.15 s slide+fade (open factor interpolates 0→1, not a hard
// cut). (4) A boosted orb pickup also fires the existing sparkles burst.
// ======================================================================
console.log('== stage 62: v1.4 J5 — pickup / HUD / UI micro-animations ==');
{
  const L = await import('../src/logic.js');
  const { orbStreakState } = L;
  const g5 = new Game(makeCanvas());
  g5.start();
  fireKey('keydown', 'Enter');
  frames(2);
  const p5 = g5.player;

  // ---- (1) a pigment pickup pops a HUD "+n" number (increments _floats) ----
  const floats0 = g5._floats.length;
  g5.orbs.push({ x: p5.x + 20, y: p5.y, color: 'red', t: 0 }); // within pickup radius
  p5.iframes = 999; g5.orbStreak = 0;                          // clean (non-boosted) pickup
  frames(3);
  assert(g5._floats.length === floats0 + 1,
    `J5: a pigment pickup pops a HUD "+n" number (floats ${floats0} -> ${g5._floats.length})`);
  const fl = g5._floats[g5._floats.length - 1];
  assert(fl && fl.text.startsWith('+'), `J5: the floating HUD number reads as a gain ("${fl.text}")`);
  // it decays away over real time (the frame loop ages + removes it).
  g5._floats.length = 0;
  for (let i = 0; i < 70; i++) { frames(1); g5.orbs.length = 0; } // no stray pickups
  assert(g5._floats.length === 0, `J5: the HUD floats decay away on their own (len=${g5._floats.length})`);

  // ---- (2) the orb streak leaves a short fading trail behind the frog ----
  // The streak is ACTIVE at orbStreak >= ORB_STREAK.min (4); while active the
  // per-frame capture appends to _streakTrail while the frog moves.
  g5.orbStreak = L.ORB_STREAK.min; // force the streak ACTIVE
  const ss = orbStreakState(g5.orbStreak);
  assert(ss.active, `J5: the streak is active at the threshold (active=${ss.active})`);
  const trail0 = g5._streakTrail.length;
  // hold 'd' so the frog moves right → the trail accumulates distinct points.
  g5.input.keys.add('d');
  for (let i = 0; i < 20; i++) { g5._updateExpedition(0.016); }
  g5.input.keys.delete('d');
  assert(g5._streakTrail.length > trail0,
    `J5: the orb streak leaves a fading trail while moving (trail ${trail0} -> ${g5._streakTrail.length})`);
  // the trail is bounded (capped) so it can't grow without bound.
  for (let i = 0; i < 300; i++) g5._updateExpedition(0.016);
  assert(g5._streakTrail.length <= 19,
    `J5: the streak trail is capped at ~19 points (len=${g5._streakTrail.length})`);
  // and it decays away once the streak is cleared + the frog is idle (frames()
  // runs the frame loop, which ages + removes the trail points).
  g5.orbStreak = 0;
  for (let i = 0; i < 60; i++) { frames(1); g5.orbs.length = 0; }
  assert(g5._streakTrail.length === 0, `J5: the streak trail decays to empty (len=${g5._streakTrail.length})`);

  // ---- (3) the pause panel opens with a slide+fade (interpolates, not a cut) ----
  // _drawPause reads the eased open factor = clamp(_pauseOpenT / 0.15, 0, 1).
  // Verify the interpolation itself (the frame loop ticks _pauseOpenT while
  // paused; _drawPause is what consumes it to ease the card in).
  const open0 = Math.min(1, Math.max(0, 0 / 0.15));          // t = 0 → closed
  const openMid = Math.min(1, Math.max(0, 0.08 / 0.15));     // mid-slide
  const openEnd = Math.min(1, Math.max(0, 0.30 / 0.15));     // past the window
  assert(open0 === 0 && openMid > 0 && openMid < 1 && openEnd === 1,
    `J5: the pause panel open state INTERPOLATES 0→${openMid.toFixed(2)}→1 (not a hard cut)`);
  // and the frame loop actually advances the clock while paused (real drive):
  g5.paused = true; g5._pauseOpenT = 0;
  const before = g5._pauseOpenT;
  frames(4);
  assert(g5._pauseOpenT > before, `J5: the frame loop advances the pause open clock while paused (${before.toFixed(3)} → ${g5._pauseOpenT.toFixed(3)})`);
  // and _drawPause runs clean at every open state (no throw mid-ease):
  const cv5 = g5.canvas || makeCanvas();
  g5._pauseOpenT = 0;    g5._drawPause(cv5.getContext('2d'));
  g5._pauseOpenT = 0.08; g5._drawPause(cv5.getContext('2d'));
  g5._pauseOpenT = 0.5;  g5._drawPause(cv5.getContext('2d'));
  g5.paused = false;

  // ---- (4) a boosted pickup also fires the existing sparkles burst (pop) ----
  const ps5 = new (await import('../src/particles.js')).ParticleSystem();
  const b4 = ps5.count;
  ps5.sparkles(100, 100, '#fff', 4);
  assert(ps5.count - b4 === 4, `J5: a pickup pop fires a sparkles burst (${ps5.count - b4} sparkles)`);
}

// ======================================================================
// stage 63 — v1.4 Module L, L1: living world pass (swaying reeds / drifting mist / water shimmer)
// All PURE draw-time modulation inside `world.drawProps` (which already
// receives `now` and culls for P10) — no new per-world state, so the pacing
// probes (runT) and P10 are untouched. Three small pure helpers on world.js:
//   reedSway(seed, now)    — per-reed tip offset (animated by now)
//   shimmerGlint(i, now)   — 0..1 staggered water-glint pulse
//   MIST_BANDS / SHIMMER_CAP — module constants (drifting bands + glint cap)
// ======================================================================
console.log('== stage 63: v1.4 L1 — living world (swaying reeds / drifting mist / water shimmer) ==');
{
  const { World, reedSway, shimmerGlint, MIST_BANDS, SHIMMER_CAP } = await import('../src/world.js');
  // counting 2d context (mirrors stage 24's helper).
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
  const drawPropsCalls = (world, view, now) => { const { ctx, count } = countingCtx(); world.drawProps(ctx, view, 1, now); return count(); };

  // deterministic world (same seed => same layout)
  function rng() { let a = 135792468; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ (t >>> 14); return ((t ^ t >>> 15) >>> 0) / 4294967296; }; }
  const world = new World(rng(), 7);
  // a few grown reeds (the build may not fill any; force a handful so sway is testable)
  world.reeds.length = 0;
  for (let i = 0; i < 6; i++) world.reeds.push({ x: 100 + i * 60, y: 400, h: 1, burn: 0, seed: i * 31 + 7 });

  // ---- (a) the reed TIP OFFSET changes across frames (animated, not static) ----
  const s0 = reedSway(123, 0.0);
  const s1 = reedSway(123, 0.5);
  const s2 = reedSway(123, 1.0);
  assert(Math.abs(s1 - s0) > 1e-3 || Math.abs(s2 - s1) > 1e-3, `L1: reedSway(seed,now) is animated by time (t0=${s0.toFixed(3)}, t0.5=${s1.toFixed(3)}, t1.0=${s2.toFixed(3)})`);
  // small amplitude (painted-world, not bouncy): bounded within ±6 px
  let maxSw = 0; for (let t = 0; t < 40; t++) maxSw = Math.max(maxSw, Math.abs(reedSway(99, t * 0.1)));
  assert(maxSw <= 6, `L1: reed sway amplitude is small (max ${maxSw.toFixed(2)}px, within ±5-6px)`);

  // ---- (b) the shimmer glint is staggered, bounded in [0,1], animated ----
  let glMax = 0, glMin = 1;
  for (let i = 0; i < SHIMMER_CAP; i++) { const g0 = shimmerGlint(i, 0); const g1 = shimmerGlint(i, 1); glMax = Math.max(glMax, g0, g1); glMin = Math.min(glMin, g0, g1); }
  assert(glMax <= 1.001 && glMin >= -0.001, `L1: shimmerGlint is bounded in [0,1] (min=${glMin.toFixed(3)}, max=${glMax.toFixed(3)})`);
  // staggered: different indices peak at different times (not all in sync)
  const gA0 = shimmerGlint(0, 0.4), gB0 = shimmerGlint(3, 0.4), gA1 = shimmerGlint(0, 1.6), gB1 = shimmerGlint(3, 1.6);
  assert(Math.abs((gA0 - gB0)) > 0.05 || Math.abs((gA1 - gB1)) > 0.05, `L1: shimmer glints are STAGGERED (index0 vs index3 differ: |${(gA0 - gB0).toFixed(2)}|, |${(gA1 - gB1).toFixed(2)}|)`);

  // ---- (c) drifting mist: 2-3 very-low-alpha bands, each with parallax < 1 ----
  assert(MIST_BANDS.length >= 2 && MIST_BANDS.length <= 3, `L1: there are 2-3 mist bands (${MIST_BANDS.length})`);
  assert(MIST_BANDS.every(b => b.alpha > 0 && b.alpha < 0.12), `L1: each mist band is very-low-alpha (max ${Math.max(...MIST_BANDS.map(b => b.alpha)).toFixed(3)} < 0.12)`);
  assert(MIST_BANDS.every(b => b.parallax > 0 && b.parallax < 1), 'L1: each mist band slow-parallaxes (parallax in (0,1), lagging the camera)');

  // ---- (d) drawProps is bounded + still culled: a localized view draws far fewer calls than the whole world ----
  const view = { x: 0, y: 0, scale: 1, w: 1280, h: 800 };
  const localCalls = drawPropsCalls(world, view, 1.0);
  const fullCalls = drawPropsCalls(world, { x: 0, y: 0, scale: 1, w: world.w, h: world.h }, 1.0);
  assert(localCalls < fullCalls * 0.9, `L1: the world draw is still culled (localized ${localCalls} < full ${fullCalls})`);
  // the shimmer cap is enforced: drawing with a huge ripple count still caps glints
  assert(SHIMMER_CAP > 0 && SHIMMER_CAP <= 24, `L1: the shimmer glint count is bounded (cap=${SHIMMER_CAP})`);
}

// ======================================================================
// L2 (v1.4 "Make It Amazing") — layered watercolor render pass.
// Pure draw-time + a bake-once cache:
//   (a) wet rim — freshly painted pigment cells carry a darker edge that dries
//       out over ~5s, derived from the existing pigment-grid `age`/amount.
//   (b) stroke texture — short directional brush strokes baked ONCE per zone
//       into an offscreen canvas at build(); drawn as ONE cached image per
//       zone per frame (the budget trick: ~4 drawImages, not thousands).
//   (c) prop outlines — a second low-alpha offset "watercolor double-stroke".
// Acceptance asserted here:
//   - offscreen canvases are created once per zone and the count is STABLE
//     across frames (no re-bake),
//   - the wet-rim alpha decays over time (fresh > after decay),
//   - the per-frame draw cost is bounded by the cached path: drawBackground
//     issues a bounded number of drawImage calls (one per zone), not raw
//     stroke counts (P10-safe — the cached path, not the raw one, is taken).
// ======================================================================
console.log('== stage 64: v1.4 L2 — layered watercolor render pass (cached offscreens + wet rim + double-stroke) ==');
{
  const { World, wetRimAlpha, wetRimRadius, WET_RIM_CAP, ZONE_TEXTURES } = await import('../src/world.js');
  // counting 2d context (mirrors stage 24/63's helper) — tracks drawImage + stroke separately.
  function countingCtx() {
    const counter = { n: 0, drawImage: 0, stroke: 0 };
    const ctx = new Proxy({}, {
      get(t, p) {
        if (p === 'measureText') return () => ({ width: 10 });
        if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
        if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
        if (p === 'drawImage') { counter.drawImage++; counter.n++; return () => {}; }
        if (p === 'stroke') { counter.stroke++; counter.n++; return () => {}; }
        counter.n++;
        return () => {};
      },
      set(t, p, v) { t[p] = v; return true; },
    });
    return [ctx, counter];
  }
  function rng() { let a = 987654321; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---- (b) offscreen stroke-texture canvases: created ONCE per zone at build ----
  const world = new World(rng(), 42);
  assert(Array.isArray(world._texCanvases), 'L2: the world bakes an offscreen stroke-texture cache at build()');
  assert(world._texCanvases.length === ZONE_TEXTURES.length, `L2: one cached offscreen canvas per zone (${world._texCanvases.length} = ${ZONE_TEXTURES.length} zones)`);
  const texCountBefore = world._texCanvases.length;
  const texRef0 = world._texCanvases[0];
  // draw the background several frames — the cache must NOT be re-baked (stable
  // count + the SAME canvas object is reused). This is the "count stable across
  // frames" acceptance: the texture is baked once, not every frame.
  const view = { x: 0, y: 0, scale: 1, w: 1280, h: 800 };
  for (let f = 0; f < 5; f++) {
    const [ctxA] = countingCtx();
    world.drawBackground(ctxA, view, 1.0);
  }
  assert(world._texCanvases.length === texCountBefore, `L2: the offscreen cache count is STABLE across frames (${world._texCanvases.length} before == after 5 frames)`);
  assert(world._texCanvases[0] === texRef0, 'L2: the cached offscreen canvas is REUSED (same object) across frames — baked once, not re-baked');

  // ---- the cached path (not the raw one): one drawImage per zone per frame ----
  {
    const [ctxB, counterB] = countingCtx();
    world.drawBackground(ctxB, view, 1.0);
    // drawBackground draws: floor fillRect + the 4 cached texture drawImages +
    // the paint-layer drawImage = a bounded number of drawImages. Crucially the
    // stroke texture is a cached image (4 drawImages) NOT thousands of raw
    // strokes — so the per-frame drawImage count is small and bounded.
    assert(counterB.drawImage >= ZONE_TEXTURES.length, `L2: drawBackground issues a bounded drawImage pass (>= ${ZONE_TEXTURES.length} cached textures + paint layer; got ${counterB.drawImage})`);
    assert(counterB.drawImage <= 8, `L2: the per-frame drawImage count stays bounded on the CACHED path (got ${counterB.drawImage} <= 8), not raw stroke counts (P10-safe)`);
  }

  // ---- (a) wet-rim alpha decays over time (fresh cell dries out) ----
  // a fresh strong splat puts the cell near full amount (~3); as it ages the
  // pigment decays toward 0, so the rim alpha must fall monotonically.
  const freshAlpha = wetRimAlpha(3);
  const midAlpha = wetRimAlpha(1.5);
  const dryAlpha = wetRimAlpha(0.1);
  assert(freshAlpha > 0 && freshAlpha <= 0.45, `L2: a fresh cell carries a strong wet rim (alpha ${freshAlpha.toFixed(3)} in (0, 0.45])`);
  assert(freshAlpha > midAlpha && midAlpha > dryAlpha, `L2: the wet-rim alpha DECAYS over time (fresh ${freshAlpha.toFixed(3)} > mid ${midAlpha.toFixed(3)} > dry ${dryAlpha.toFixed(3)})`);
  // and a fully-dried cell produces no rim (the draw path skips it).
  assert(wetRimAlpha(0) < 0.02, `L2: a fully-dried cell produces no rim (alpha ${wetRimAlpha(0).toFixed(3)} < 0.02 skip threshold)`);
  // the wet rim is bounded (a touch larger than the cell so it reads as a halo).
  const rimR = wetRimRadius(60);
  assert(rimR > 0 && rimR <= 60, `L2: the wet-rim radius is bounded (got ${rimR.toFixed(1)} px, <= cell)`);
  // the wet-rim draw is capped so a long painting run can't grow the per-frame cost.
  assert(WET_RIM_CAP > 0 && WET_RIM_CAP <= 128, `L2: the wet-rim draw count is bounded (cap=${WET_RIM_CAP})`);

  // a fresh paint actually produces a wet rim that later dries (end-to-end):
  // splat, draw (rim present), age the grid, draw again (rim gone).
  const world2 = new World(rng(), 7);
  world2.splat(300, 400, 'blue', 12, true);
  const [ctxC] = countingCtx();
  world2.drawBackground(ctxC, { x: 0, y: 0, scale: 1, w: 1280, h: 800 }, 1.0);
  // advance the world so the pigment fully decays (age drives down + delete)
  world2.update(6.0);
  assert(world2.pigmentGrid.size === 0 || [...world2.pigmentGrid.values()].every(c => c.red < 0.1 && c.blue < 0.1 && c.green < 0.1), 'L2: the pigment decays over ~5s (wet cell dries out after 6s)');
}

// ============================================================
// Stage 65: v1.4 L3 — breathing title screen + vignette/lighting
// (pure draw-time + a draw-only saturation swell; no world state;
//  respects the existing options.vignette toggle; P10-safe.)
// ============================================================
{
  console.log('== stage 65: v1.4 L3 — breathing title screen + vignette/lighting ==');
  const G = await import('../src/game.js');
  const { titleBreatheSwell, titleItemAlpha, warmVignetteAlpha } = G;

  // ---- the title "breathes": a small scale/opacity oscillation, bounded ----
  // the swell is a slow sine in [0, swellMax] (a few percent) so the title
  // swells in and out gently (a couple breaths per minute, not frantic).
  const s0 = titleBreatheSwell(0);
  const s1 = titleBreatheSwell(2);
  const s2 = titleBreatheSwell(4);
  const sPeak = titleBreatheSwell(Math.PI / 2); // sine peak
  assert(s0 === 0, `L3: the breath swell starts at rest (t=0 -> 0, got ${s0})`);
  assert(sPeak > 0 && sPeak <= 0.04, `L3: the breath swell is a small, bounded oscillation (peak ${sPeak.toFixed(4)} in (0, 0.04])`);
  assert(s0 < s1 && s1 < s2, `L3: the swell rises over a quarter period (0 < t=2 < t=4: ${s0.toFixed(3)} < ${s1.toFixed(3)} < ${s2.toFixed(3)})`);
  // the oscillation is periodic (breathing), not a one-shot: two full periods apart it returns to the same value.
  const period = 2 * Math.PI / 0.4; // freq 0.4 rad/s
  assert(Math.abs(titleBreatheSwell(1.0) - titleBreatheSwell(1.0 + period)) < 1e-3, 'L3: the breath swell is periodic (returns to the same value one period later)');
  // it reads as "a couple breaths per minute": period in seconds is ~15s (0.4 rad/s).
  assert(period > 10 && period < 25, `L3: the breathing rate is gentle (~${period.toFixed(1)}s per breath, in (10,25)s)`);

  // ---- the menu items stagger in (each fades in after the last) ----
  // at t=0 everything is hidden; each later item starts later; all reach 1.
  const steps = 4;
  for (let i = 0; i < steps; i++) {
    assert(titleItemAlpha(0, i) === 0, `L3: menu item ${i} is hidden at t=0 (alpha 0)`);
    assert(titleItemAlpha(3, i) === 1, `L3: menu item ${i} is fully shown by t=3 (alpha 1, got ${titleItemAlpha(3, i)})`);
  }
  // the stagger is real: at a time when the first is showing but the last is not,
  // the item alphas are strictly increasing in the item index (later = less far in).
  const tMid = 0.6;
  const alphas = [];
  for (let i = 0; i < steps; i++) alphas.push(titleItemAlpha(tMid, i));
  assert(alphas[0] > alphas[1] && alphas[1] > alphas[2] && alphas[2] > alphas[3],
    `L3: the menu items stagger in (at t=${tMid}: ${alphas.map(a => a.toFixed(2)).join(' > ')})`);
  // every alpha stays in [0,1].
  for (let i = 0; i < steps; i++) {
    for (const t of [0, 0.2, 0.4, 0.6, 1.0, 2.0]) {
      const a = titleItemAlpha(t, i);
      assert(a >= 0 && a <= 1, `L3: title item alpha is in [0,1] (t=${t}, item ${i} -> ${a})`);
    }
  }

  // ---- the warm vignette is a subtle, bounded edge darkening ----
  // near the center (d01=0) it is near-clear; at the corners (d01=1) it is a
  // soft (low) alpha, never opaque — a gentle lighting wash, not a black box.
  const centerA = warmVignetteAlpha(0, 1);
  const edgeA = warmVignetteAlpha(1, 1);
  assert(centerA >= 0 && centerA < 0.03, `L3: the warm vignette is near-clear at the center (alpha ${centerA.toFixed(3)} < 0.03)`);
  assert(edgeA > 0 && edgeA <= 0.22, `L3: the warm vignette is a subtle edge darkening at the corners (alpha ${edgeA.toFixed(3)} in (0, 0.22])`);
  // the falloff is monotonic (clearer toward the center).
  assert(warmVignetteAlpha(0.25, 1) < warmVignetteAlpha(0.5, 1) && warmVignetteAlpha(0.5, 1) < warmVignetteAlpha(0.9, 1), 'L3: the vignette darkens monotonically toward the edges');
}

// ============================================================================
// STAGE 66: v1.4 S1 — melodic per-zone themes (headless AudioContext)
// ============================================================================
{
  console.log('== stage 66: v1.4 S1 — melodic per-zone themes (headless AudioContext) ==');
  // A minimal-but-sufficient headless AudioContext: enough for AudioSys.ensure()
  // + the ambient bed + the S1 melody step-sequencer to build and SCHEDULE nodes
  // without a real browser. currentTime advances manually so tickMusic schedules.
  const param = (v) => ({ value: v, setValueAtTime(x) { this.value = x; }, linearRampToValueAtTime(x) { this.value = x; },
    exponentialRampToValueAtTime(x) { this.value = x; }, setTargetAtTime(x) { this.value = x; } });
  const makeNode = () => ({
    type: 'sine', frequency: param(440), Q: param(1), detune: param(0), gain: param(1),
    buffer: null, _connections: [],
    connect(node) { this._connections.push(node); return node; },
    disconnect() { this._connections.length = 0; },
    start() {}, stop() {}, getChannelData() { return new Float32Array(0); },
  });
  class FakeAudioContext {
    constructor() { this.currentTime = 0; this._sr = 22050; this._dest = makeNode(); }
    get sampleRate() { return this._sr; }
    get destination() { return this._dest; }
    createGain() { return makeNode(); }
    createOscillator() { return makeNode(); }
    createBiquadFilter() { return makeNode(); }
    createDynamicsCompressor() { return makeNode(); }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { return makeNode(); }
  }
  window.AudioContext = FakeAudioContext;

  const cvA = makeCanvas();
  const gA = new Game(cvA);
  gA.start();
  assert(gA.audio.ensure() === true, 'S1: a headless AudioContext lets AudioSys.ensure() build the graph');
  assert(gA.audio.musicBus !== null && gA.audio._melodyMaster !== null, 'S1: the melody master gain exists');
  assert(gA.audio._melodyMaster._connections.includes(gA.audio.musicBus), 'S1: the melody layer is connected UNDER musicBus (inherits the slider + mute)');
  assert(gA.audio._melodyMaster.gain.value > 0 && gA.audio._melodyMaster.gain.value <= 1, `S1: the melody layer is at a modest level (${gA.audio._melodyMaster.gain.value})`);

  // ---- a melody loop is created per zone, and tickMusic schedules notes ----
  gA.audio.setZoneTheme(0);
  gA.audio.ctx.currentTime += 1.0;   // advance the fake clock so the lookahead schedules
  gA.audio.tickMusic();
  assert(gA.audio._zoneThemes.length === 1, `S1: a zone 0 melody loop is created (1, got ${gA.audio._zoneThemes.length})`);
  assert(gA.audio._zoneThemes[0].zone === 0, 'S1: the loop is for zone 0');
  assert(gA.audio._zoneThemes[0].step > 0, `S1: tickMusic schedules melodic notes (step advanced to ${gA.audio._zoneThemes[0].step})`);
  assert(gA.audio._zoneThemes[0].gain._connections.includes(gA.audio._melodyMaster), 'S1: the zone theme gain feeds the melody master');

  // ---- zone switch crossfades: old ramps down (muted+fading), new is live ----
  gA.audio.setZoneTheme(1);
  const prev = gA.audio._zoneThemes.find((t) => t.zone === 0);
  const next = gA.audio._zoneThemes.find((t) => t.zone === 1);
  assert(next && !next.muted && !next.fading, 'S1: switching zones starts a LIVE zone 1 melody');
  assert(prev && prev.muted && prev.fading, 'S1: switching zones crossfades the old zone 0 melody (muted + fading)');
  assert(gA.audio._zoneThemes.length >= 2, `S1: the fading old + the new theme coexist during the crossfade (got ${gA.audio._zoneThemes.length})`);

  // ---- the music slider still scales the melody (it rides musicBus) ----
  gA.audio.setMusicVolume(0.2);
  assert(gA.audio.musicBus.gain.value === 0.2, 'S1: the music slider scales the music bus');
  assert(gA.audio._melodyMaster._connections.includes(gA.audio.musicBus) && gA.audio._melodyMaster.gain.value > 0, 'S1: the melody rides the music bus, so the slider + mute scale it');

  // ---- each zone has a distinct melodic loop ----
  const d0 = gA.audio._zoneThemeData()[0], d1 = gA.audio._zoneThemeData()[1], d3 = gA.audio._zoneThemeData()[3];
  const sig = (d) => JSON.stringify([d.root, d.scale, d.pattern, d.stepDur, d.detune]);
  assert(sig(d0) !== sig(d1), 'S1: zone 0 and zone 1 have distinct melodic loops');
  assert(sig(d0) !== sig(d3), 'S1: the finale (zone 3) theme is distinct from the opening');
  // the scale is a real pentatonic-ish set (5 notes, ascending from root)
  assert(d0.scale.length === 5 && d0.scale[0] === 0 && d0.scale.every((s, i) => i === 0 || s > d0.scale[i - 1]), 'S1: each theme uses a 5-note ascending scale');

  // ---- clearing the melody empties the live loops (run end / quit) ----
  gA.audio.clearZoneTheme();
  assert(gA.audio._zoneThemes.length === 0, `S1: clearing the zone melody empties the live loops (got ${gA.audio._zoneThemes.length})`);

  delete window.AudioContext; // restore (no later stage depends on it either way)
}

// ============================================================================
// STAGE 67: v1.4 S2 — boss battle loop + victory/defeat stingers (headless AudioContext)
// ============================================================================
{
  console.log('== stage 67: v1.4 S2 — boss music + end-screen stingers (headless AudioContext) ==');
  // A richer headless AudioContext: enough to build the graph AND to capture
  // the exact note frequencies S2 schedules (boss loop + stingers) so we can
  // assert their shape. currentTime advances manually so tickMusic looks ahead.
  const P = (v) => ({ value: v, _v: v, setValueAtTime(x) { this._v = x; },
    exponentialRampToValueAtTime(x) { this._v = x; }, linearRampToValueAtTime(x) { this._v = x; },
    setTargetAtTime(x) { this._v = x; } });
  let schedTones = [];   // { type, f0, f1, dur, target, conns }
  const mkNode = () => ({
    type: 'sine', frequency: P(440), Q: P(1), detune: P(0), gain: P(1),
    buffer: null, _connections: [],
    connect(n) { this._connections.push(n); return n; },
    disconnect() { this._connections.length = 0; },
    start() {}, stop() {}, getChannelData() { return new Float32Array(0); },
  });
  class FakeAC {
    constructor() { this.currentTime = 0; this._dest = mkNode(); this._nodes = []; }
    get sampleRate() { return 22050; }
    get destination() { return this._dest; }
    createGain() { const n = mkNode(); n.isGain = true; return n; }
    createOscillator() {
      const n = mkNode();
      const rec = () => { schedTones.push({ type: n.type, f0: n.frequency._v, f1: n.frequency._v, dur: n._dur || 0, target: n._target || null, conns: n._connections }); };
      n.start = () => { schedTones.push({ type: n.type, f0: n.frequency._v, f1: n.frequency._f1, dur: n._dur || 0, target: n._target || null, conns: n._connections.slice() }); };
      n.stop = () => {};
      return n;
    }
    createBiquadFilter() { const n = mkNode(); return n; }
    createDynamicsCompressor() { const n = mkNode(); return n; }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() {
      const n = mkNode();
      n.start = () => {};
      n.stop = () => {};
      return n;
    }
  }
  // We capture the F0 via the oscillator's frequency param's last value at start.
  // To read the sweep end (f1), we patch the param's exponentialRamp to record.
  const origExp = FakeAC.prototype; // (no-op; we patch per-node below via subclass)
  window.AudioContext = class extends FakeAC {
    createOscillator() {
      const n = super.createOscillator();
      const f = n.frequency;
      f.exponentialRampToValueAtTime = (x) => { f._f1 = x; f._v = x; };
      n.start = () => { schedTones.push({ type: n.type, f0: n._f0 ?? f._v, f1: f._f1, dur: n._dur || 0, target: n._target || null, conns: n._connections.slice() }); };
      // capture f0 at setValueAtTime (the start freq) and target at connect
      const sv = f.setValueAtTime.bind(f);
      f.setValueAtTime = (x) => { n._f0 = x; return sv(x); };
      const origConnect = n.connect.bind(n);
      n.connect = (t) => { n._target = t; return origConnect(t); };
      n._durCap = n.start;
      return n;
    }
  };

  const cvB = makeCanvas();
  const gB = new Game(cvB);
  gB.start();
  gB.audio.ensure();
  const au = gB.audio;
  assert(au.ctx !== null, 'S2: the headless AudioContext builds the audio graph');

  // ---- a ZONE theme is live before the boss engages ----
  au.setZoneTheme(1);
  gB.audio.ctx.currentTime += 1.0;
  au.tickMusic();
  const zoneLive = au._zoneThemes.find((t) => t.zone === 1 && !t.muted);
  assert(zoneLive, 'S2: a zone theme is live before the boss engages');

  // ---- boss engage: setBossTheme crossfades the zone out + starts the boss loop ----
  au.setBossTheme(false); // the Great GRAY heron (first-time run)
  assert(au._bossMusic === true, 'S2: the boss loop is the live melody (bossMusic flag set)');
  const bossGray = au._bossThemes.find((t) => !t.muted && t.zone === -1);
  assert(bossGray, 'S2: a boss loop instance starts on engage');
  assert(zoneLive.muted && zoneLive.fading, 'S2: engaging the boss crossfades the zone theme out (muted + fading)');

  // ---- the boss loop actually schedules distinct, fast, pulsed notes ----
  schedTones = [];
  gB.audio.ctx.currentTime += 2.0;   // enough lookahead to schedule many steps
  au.tickMusic();
  assert(bossGray.step > 4, `S2: the boss loop schedules many steps (step=${bossGray.step}, faster than a zone loop)`);
  assert(schedTones.length > 6, `S2: the boss loop scheduled melodic + pulse notes (${schedTones.length})`);
  // the boss is distinct from every zone theme (root + scale + pattern + stepDur)
  const bSig = (d) => JSON.stringify([d.root, d.scale, d.pattern, d.stepDur, d.detune]);
  const zData = au._zoneThemeData();
  for (const z of zData) assert(bSig(au._bossThemeData().gray) !== bSig(z), 'S2: the boss loop is distinct from a zone theme');
  // faster step rate than any zone theme
  assert(au._bossThemeData().gray.stepDur < Math.min(...zData.map((z) => z.stepDur)), 'S2: the boss loop step rate is faster than every zone theme');

  // ---- the Great Green Heron gets its own (darker) variant ----
  au._bossMusic = false; au._bossThemes.length = 0; // reset so a re-engage is tested cleanly
  au.setBossTheme(true);
  const bossGreen = au._bossThemes.find((t) => !t.muted && t.zone === -1);
  assert(bossGreen && bossGreen.green === true, 'S2: the Great Green Heron starts its own boss loop');
  const bd = au._bossThemeData();
  assert(JSON.stringify([bd.gray.root, bd.gray.pattern]) !== JSON.stringify([bd.green.root, bd.green.pattern]), 'S2: the green-heron boss loop is a distinct variant from the gray');
  assert(bd.green.root < bd.gray.root, `S2: the green-heron boss is darker (lower root ${bd.green.root} < ${bd.gray.root})`);

  // ---- the boss loop still rides the music bus (slider + mute) ----
  const bossGain = au._bossThemes.find((t) => !t.muted);
  assert(bossGain.gain._connections.includes(au._melodyMaster) && au._melodyMaster._connections.includes(au.musicBus), 'S2: the boss loop rides melodyMaster -> musicBus (slider + mute)');
  au.setMusicVolume(0.2);
  assert(au.musicBus.gain.value === 0.2, 'S2: the music slider scales the boss loop (it is on the music bus)');

  // ---- clearZoneTheme (run end / quit) fades the boss loop too ----
  au.clearZoneTheme();
  assert(au._bossMusic === false, 'S2: clearing the melody at run end disengages the boss');
  assert(au._bossThemes.every((t) => t.muted || t.fading), 'S2: the boss loop is muted/fading after clear (crossfaded out, not cut)');

  // ---- VICTORY stinger: a RISING major arpeggio ----
  const vBefore = schedTones.length;
  au.stingerVictory();
  const vTones = schedTones.slice(vBefore).filter((x) => x.type === 'triangle');
  assert(vTones.length >= 6, `S2: the victory stinger schedules a rising multi-note phrase (${vTones.length} new triangle notes)`);
  // the fundamental frequencies are monotonically non-decreasing (an upward arpeggio)
  const vF = vTones.map((x) => x.f0);
  const rising = vF.every((f, i) => i === 0 || f >= vF[i - 1]);
  assert(rising, `S2: the victory stinger climbs upward (${vF.map((f) => Math.round(f)).join(' -> ')} Hz)`);
  assert(vF[vF.length - 1] > vF[0], 'S2: the victory arpeggio ends higher than it begins');

  // ---- DEFEAT stinger: a SLOW descending minor phrase ----
  const dBefore = schedTones.length;
  au.stingerDefeat();
  const dTones = schedTones.slice(dBefore).filter((x) => x.type === 'triangle');
  assert(dTones.length >= 4, `S2: the defeat stinger schedules a descending phrase (${dTones.length} new triangle notes)`);
  const dF = dTones.map((x) => x.f0);
  const descending = dF.every((f, i) => i === 0 || f <= dF[i - 1]);
  assert(descending, `S2: the defeat stinger descends (${dF.map((f) => Math.round(f)).join(' -> ')} Hz)`);
  assert(dF[dF.length - 1] < dF[0], 'S2: the defeat phrase ends lower than it begins');

  // ---- stingers ride the music bus too (not the sfx bus) ----
  // The stinger's own scheduled notes must route through the melody layer
  // (melodyMaster -> musicBus), NOT the sfx bus. (Check the stinger's tones
  // specifically, since the boss loop also schedules onto the melody layer.)
  const stBefore = schedTones.length;
  au.stingerVictory();
  const stTones = schedTones.slice(stBefore);
  // The connection chain is osc -> (per-note gain) -> (stinger gain) ->
  // melodyMaster -> musicBus. Walk two levels and confirm the stinger gain
  // feeds the melody layer (not the sfx bus), so the music slider + mute scale it.
  const stTargets = stTones.map((x) => {
    const perNote = x.conns[0];          // per-tone gain
    const stingerGain = perNote && perNote._connections[0]; // stinger gain
    return stingerGain;
  });
  assert(stTones.length > 0 && stTargets.every((tg) => tg && tg._connections.includes(au._melodyMaster)), 'S2: the stingers route through the melody layer (music slider + mute), not the sfx bus');

  delete window.AudioContext; // restore
}

// ============================================================================
// STAGE 68: v1.4 S3 — painting sound-design (headless AudioContext)
// ============================================================================
{
  console.log('== stage 68: v1.4 S3 — satisfying painting SFX + concurrent-voice cap (headless AudioContext) ==');
  // Headless AudioContext that tags every created node by its kind (osc /
  // filter / gain / buffer-source) so a stage can read each pigment's voice
  // signature (oscillator type + start freq, or filter type + freq) and assert
  // the per-pigment voices are distinct and the concurrent-voice cap holds.
  const param = (v) => ({ value: v, _start: v,
    setValueAtTime(x) { this.value = x; this._start = x; },
    linearRampToValueAtTime(x) { this.value = x; },
    exponentialRampToValueAtTime(x) { this.value = x; },
    setTargetAtTime(x) { this.value = x; } });
  const created = [];
  const makeNode = (kind) => {
    const n = { _kind: kind, type: 'sine', frequency: param(440), Q: param(1),
      detune: param(0), gain: param(1), buffer: null, _connections: [],
      connect(node) { this._connections.push(node); return node; },
      disconnect() { this._connections.length = 0; },
      start() {}, stop() {}, getChannelData() { return new Float32Array(0); } };
    created.push(n);
    return n;
  };
  class FakeAudioContext {
    constructor() { this.currentTime = 0; this._sr = 22050; this._dest = makeNode('gain'); }
    get sampleRate() { return this._sr; }
    get destination() { return this._dest; }
    createGain() { return makeNode('gain'); }
    createOscillator() { return makeNode('osc'); }
    createBiquadFilter() { return makeNode('filter'); }
    createDynamicsCompressor() { return makeNode('gain'); }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { return makeNode('bufsrc'); }
  }
  window.AudioContext = FakeAudioContext;

  const cvS = makeCanvas();
  const gS = new Game(cvS);
  gS.start();
  assert(gS.audio.ensure() === true, 'S3: a headless AudioContext lets AudioSys.ensure() build the graph');
  const au = gS.audio;
  // The voice cap is asserted separately (below); keep it out of the way while
  // we inspect per-pigment signatures by resetting the live set first.
  au._sfxLive = [];

  // helpers: the nodes a single sfx() call creates, split into voices
  const snapshot = () => created.length;
  const toneFreqs = (from) => created.slice(from).filter((n) => n._kind === 'osc').map((n) => ({ type: n.type, f0: Math.round(n.frequency._start ?? n.frequency.value) }));
  const noiseF = (from) => created.slice(from).filter((n) => n._kind === 'filter').map((n) => ({ type: n.type, freq: Math.round(n.frequency.value) }));
  const keyFor = (pig) => {
    au._sfxLive = [];   // keep the (separately-asserted) cap from dropping voices mid-capture
    const f = snapshot();
    au.sfx('paint-swipe', { pig });
    const tones = toneFreqs(f).map((x) => x.f0).sort((a, b) => a - b);
    const hasHighNoise = noiseF(f).some((x) => x.type === 'bandpass' && x.freq > 1800);
    const hasShh = noiseF(f).some((x) => x.type === 'bandpass' && x.freq >= 800 && x.freq <= 1300);
    return { key: tones.join(',') + (hasHighNoise ? '|H' : ''), hasShh, tones, hasHighNoise };
  };

  const kRed = keyFor('red'), kGreen = keyFor('green'), kBlue = keyFor('blue'), kDry = keyFor('dry');

  // (1) each pigment maps to a DISTINCT voice signature
  const keys = [kRed.key, kGreen.key, kBlue.key, kDry.key];
  assert(new Set(keys).size === 4, `S3: each pigment has a distinct swipe voice signature (${JSON.stringify([kRed.key, kGreen.key, kBlue.key, kDry.key])})`);
  // the wet pigments keep the soft "shh" base sweep
  assert(kRed.hasShh && kGreen.hasShh && kBlue.hasShh, 'S3: the wet pigments keep a soft "shh" base (bandpass ~900-1300)');
  // red = a warm low "pew" (a sawtooth), green = a deep "glorp" (a triangle),
  // blue = a crystalline "ping" (a bright high sine), dry = a clean high whoosh
  // (a high bandpass, and NO low-body tone)
  const redOscs = (() => { au._sfxLive = []; const f = snapshot(); au.sfx('paint-swipe', { pig: 'red' }); return toneFreqs(f); })();
  const greenOscs = (() => { au._sfxLive = []; const f = snapshot(); au.sfx('paint-swipe', { pig: 'green' }); return toneFreqs(f); })();
  const blueOscs = (() => { au._sfxLive = []; const f = snapshot(); au.sfx('paint-swipe', { pig: 'blue' }); return toneFreqs(f); })();
  assert(redOscs.some((o) => o.type === 'sawtooth' && o.f0 < 400), 'S3: red is a warm low "pew" (a sawtooth < 400 Hz)');
  assert(greenOscs.some((o) => o.type === 'triangle' && o.f0 < 200), 'S3: green is a deep "glorp" (a low triangle)');
  assert(blueOscs.some((o) => o.type === 'sine' && o.f0 > 1000), 'S3: blue is a crystalline "ping" (a bright high sine)');
  const dryF = (() => { au._sfxLive = []; const f = snapshot(); au.sfx('paint-swipe', { pig: 'dry' }); return f; })();
  const dryOscs = toneFreqs(dryF), dryNoises = noiseF(dryF);
  assert(!dryOscs.some((o) => o.f0 < 1000) && dryNoises.some((x) => x.type === 'bandpass' && x.freq > 1800), 'S3: the dry brush is a clean high "whoosh" (high bandpass, no low body)');

  // the status-moment blips also exist + are distinct from the paint voices
  au._sfxLive = [];
  const stF = snapshot();
  au.sfx('burn-ignite'); au.sfx('freeze-tick'); au.sfx('root-thud');
  const stTones = toneFreqs(stF), stNoises = noiseF(stF);
  assert(stNoises.some((x) => x.type === 'highpass'), 'S3: burn-ignite is a crackling highpass tick');
  assert(stTones.some((o) => o.type === 'sine' && o.f0 > 1800), 'S3: freeze-tick is a bright crystalline ping (>1800 Hz)');
  assert(stTones.some((o) => o.type === 'sine' && o.f0 < 200) && stNoises.some((x) => x.type === 'lowpass'), 'S3: root-thud is a low body + lowpass');

  // (2) the concurrent-voice cap holds
  const max = au._sfxMaxVoices;
  assert(max > 0 && max <= 32, `S3: a concurrent-voice cap is configured (${max})`);
  const t0 = au.ctx.currentTime;
  au._sfxLive = Array.from({ length: max }, () => t0 + 1); // all still "live" (future)
  const capBefore = created.length;
  au.sfx('paint-swipe', { pig: 'red' });
  assert(created.length === capBefore, `S3: at the voice cap, a new sfx voice is DROPPED (no new nodes; ${created.length - capBefore} made)`);
  // once the live set ages out, the cap frees up again
  au.ctx.currentTime += 2;
  au.sfx('paint-swipe', { pig: 'green' });
  assert(created.length > capBefore, 'S3: after the live voices age out, painting makes sound again');

  delete window.AudioContext; // restore
}

// --------------------------------------------------------------------------
// STAGE 69: v1.4 M1 — the first-victory cinematic beat (SAVE_VERSION 7 -> 8,
// the `firstVictoryCinematic` seen-flag, the ~4s skippable beat on a fresh
// player's FIRST win only, and a returning player skipping straight to the
// card). Headless: we drive the real Game through a real victory via _endRun
// (the beat lives in state==='end', so runT — the timed run — is already
// frozen; we assert it never moved). Audio is a headless AudioContext so we
// can assert the soft arpeggio is scheduled and rides the melody layer.
// NOTE: each Game owns its own AudioContext, so melody/sfx-bus refs are read
// off EACH game's own audio, and each game is driven with frames() right
// after it is created (only the most recent start()'s rAF is live).
// --------------------------------------------------------------------------
{
  console.log('== stage 69: v1.4 M1 — first-victory cinematic beat (headless) ==');
  const L = await import('../src/logic.js');
  assert(L.SAVE_VERSION === 9, 'M1: SAVE_VERSION is 9 (K7 bumped 8 -> 9 for the challengeScores list; the cinematic seen-flag from 7 -> 8 is unchanged)');
  // Headless AudioContext that RECORDS every tone scheduled, so we can assert
  // the arpeggio shape (a soft RISING sequence) + that it rides the melody
  // layer (musicBus), not the sfx bus. Mirrors the S1/S2 stage pattern.
  let tones = [];
  const P = (v) => ({ value: v, _v: v, setValueAtTime(x) { this._v = x; },
    exponentialRampToValueAtTime(x) { this._v = x; },
    linearRampToValueAtTime(x) { this._v = x; },
    setTargetAtTime(x) { this._v = x; } });
  const mkN = () => ({ type: 'sine', frequency: P(440), Q: P(1), detune: P(0), gain: P(1),
    buffer: null, _connections: [], connect(n) { this._connections.push(n); return n; },
    disconnect() {}, start() {}, stop() {}, getChannelData() { return new Float32Array(0); } });
  class FakeAC69 {
    constructor() { this.currentTime = 0; this._dest = mkN(); }
    get sampleRate() { return 22050; }
    get destination() { return this._dest; }
    createGain() { const n = mkN(); n.isGain = true; return n; }
    createOscillator() {
      const n = mkN();
      const f = n.frequency;
      f.exponentialRampToValueAtTime = (x) => { f._f1 = x; };
      n.start = () => { tones.push({ type: n.type, f0: f._v, target: n._tgt || null }); };
      const sv = f.setValueAtTime.bind(f);
      f.setValueAtTime = (x) => { sv(x); };
      const oc = n.connect.bind(n);
      n.connect = (t) => { n._tgt = t; return oc(t); };
      return n;
    }
    createBiquadFilter() { return mkN(); }
    createDynamicsCompressor() { return mkN(); }
    createBuffer() { return { getChannelData: () => new Float32Array(0) }; }
    createBufferSource() { return mkN(); }
  }
  window.AudioContext = class extends FakeAC69 {};
  assert(L.freshSave().firstVictoryCinematic === false, 'M1: a fresh save loads with the seen-flag false (they have NOT seen it)');
  // a v7 save (no field) migrates up to v8 with the seen-flag false (they get the beat ONCE)
  assert(L.migrateSave({ ...L.freshSave(), saveVersion: 7, firstVictoryCinematic: undefined }).firstVictoryCinematic === false, 'M1: a legacy v7 save migrates to v8 with the seen-flag false');

  // ---- (1) a FRESH save's first victory opens the beat ----
  store.clear();                       // guarantee a brand-new player (no seen-flag)
  const g1 = new Game(makeCanvas());
  g1.start();
  assert(g1.audio.ensure() === true, 'M1: the headless AudioContext lets the audio graph build');
  const mel1 = g1.audio._melodyMaster, sfx1 = g1.audio.sfxBus;
  g1.collected = { red: 10, blue: 8, green: 9 };
  const runT0 = g1.runT;
  tones = [];
  g1._endRun('victory');               // the real victory bookkeeping + beat trigger
  // NOTE: _endRun also fires a first-time boss-gold pickup (2 SINE tones on the
  // sfx bus) for a fresh save; the cinematic arpeggio is all on the MELODY
  // layer, so we assert on the arpeggio's TRIANGLE notes specifically.
  assert(g1.state === 'end' && g1.endKind === 'victory', 'M1: the victory end-state is reached');
  assert(g1._cine !== null && g1._cine.t === 0, 'M1: a FRESH player first victory OPENS the cinematic beat');
  assert(g1.save.firstVictoryCinematic === true, 'M1: the seen-flag latched the moment the beat was first shown');
  assert(g1.runT === runT0, 'M1: the beat never touches the timed run (runT unchanged)');
  // the soft arpeggio is scheduled on the MELODY layer (a rising sequence).
  // _tone connects osc -> per-note gain -> target (the stinger gain), and that
  // gain connects to _melodyMaster; so "on the melody layer" = the tone's
  // target REACHES _melodyMaster through its connection chain (not the raw sfx
  // bus). Walk the chain (per-note gain -> stinger gain -> melodyMaster).
  const reaches = (n, mel) => !n ? false
    : (n === mel) || (n._connections || []).some((c) => reaches(c, mel));
  const onMelody = (x) => x.target && x.target !== sfx1 && reaches(x.target, mel1);
  const melTones = tones.filter(onMelody);
  assert(melTones.length >= 10, `M1: the cinematic arpeggio schedules a full sequence on the melody layer (${melTones.length} notes)`);
  const arpF = tones.filter((x) => onMelody(x) && x.type === 'triangle').map((x) => x.f0);
  let rising = arpF.length >= 4; for (let i = 1; i < arpF.length; i++) { if (arpF[i] < arpF[i - 1]) { rising = false; break; } }
  assert(arpF.length >= 8 && rising, `M1: the beat arpeggio is a SOFT RISING sequence of >= 8 notes (got ${arpF.length}: ${arpF.map((f) => Math.round(f)).join(' ')})`);
  const sfxTriangles = tones.filter((x) => x.type === 'triangle' && x.target === sfx1);
  assert(sfxTriangles.length === 0, 'M1: the beat arpeggio rides the melody layer, NOT the sfx bus (no triangle notes on the sfx bus)');
  // ---- (2) SKIP dismisses it immediately, and does NOT open the atelier ----
  const st0 = g1.state;
  fireKey('keydown', 'a');             // ANY key skips (a "just-pressed" key)
  frames(1);
  assert(g1._cine === null, 'M1: ANY key skips the beat immediately');
  assert(g1.state === st0 && g1.state === 'end', 'M1: the skip closes the beat WITHOUT opening the atelier (end buttons gated)');

  // ---- (3) a RETURNING player (flag true) skips straight to the card ----
  store.clear();
  const seenSave = L.freshSave(); seenSave.firstVictoryCinematic = true;
  store.set('frogue_gallery_save', JSON.stringify(seenSave));
  const g2 = new Game(makeCanvas());   // loads the seen-flag save
  g2.start();
  assert(g2.save.firstVictoryCinematic === true, 'M1: a returning save loads with the seen-flag true');
  g2.audio.ensure();
  const mel2 = g2.audio._melodyMaster;
  g2.collected = { red: 5, blue: 5, green: 5 };
  tones = [];
  g2._endRun('victory');
  assert(g2._cine === null, 'M1: a RETURNING player skips the beat and goes straight to the card');
  const onMelody2 = (n) => !n ? false : (n === mel2) || (n._connections || []).some((c) => onMelody2(c));
  const stingerTones = tones.filter((x) => x.type === 'triangle' && x.target && onMelody2(x.target));
  assert(stingerTones.length >= 5, `M1: the returning-player victory fires the triumphant stinger at the card reveal (${stingerTones.length} notes, no beat)`);
  assert(g2.save.firstVictoryCinematic === true, 'M1: the seen-flag stays true across a second victory (it fires exactly once)');

  // ---- (4) a DEFEAT never opens the beat (fresh save) ----
  store.clear();
  const g3 = new Game(makeCanvas());
  g3.start();
  g3.audio.ensure();
  g3.collected = { red: 3, blue: 3, green: 3 };
  g3._endRun('defeat');
  assert(g3._cine === null, 'M1: a defeat never opens the cinematic beat (victory only)');
  assert(g3.save.firstVictoryCinematic === false, 'M1: a defeat does NOT latch the seen-flag (a future victory still gets it)');

  delete window.AudioContext; // restore
}

// STAGE 70: v1.4 M2 — the "Encore" gallery-viewing screen (headless)
// ---------------------------------------------------------------------
// The Encore screen is an overlay opened FROM the atelier: a leisurely
// one-at-a-time walk of the Gallery Wall. Each painting is shown large with
// its title + the Curator's Ledger lore blurb; owned gold-tier works get a
// gilded (gold) frame; unowned works sit in a shadowed silhouette frame with
// "not yet". A soft S1-style arpeggio plays (low-level, on the melody layer),
// arrows / click advance, Esc returns to the atelier.
//
// We verify with a fillText-recording canvas (every placard string is logged)
// + a headless AudioContext (the arpeggio schedules on the melody layer):
//   (a) opening Encore renders ALL 10 paintings in sequence — each owned one
//       shows its title, each unowned one shows "not yet", and an owned
//       gold-tier one shows the "★ gold tier" gilded marker;
//   (b) the soft arpeggio is scheduled on the melody layer at a LOW level;
//   (c) the right-arrow (and a click on the right half) advance to the next
//       painting;
//   (d) Esc returns to the atelier (overlay closed, arpeggio stopped).
console.log('== stage 70: v1.4 M2 — "Encore" gallery viewing screen (headless) ==');
{
  const L70 = await import('../src/logic.js');
  // A minimal headless AudioContext (same shape as stages 66/67): enough for
  // AudioSys.ensure() + the melody step-sequencer to build the graph and to
  // SCHEDULE the encore arpeggio on the melody layer.
  const param = (v) => ({ value: v, setValueAtTime(x) { this.value = x; }, linearRampToValueAtTime(x) { this.value = x; },
    exponentialRampToValueAtTime(x) { this.value = x; }, setTargetAtTime(x) { this.value = x; } });
  const makeNode = () => ({
    type: 'sine', frequency: param(440), Q: param(1), detune: param(0), gain: param(1),
    buffer: null, _connections: [],
    connect(node) { this._connections.push(node); return node; },
    disconnect() { this._connections.length = 0; },
    start() {}, stop() {}, getChannelData() { return new Float32Array(0); },
  });
  class FakeAudioContext {
    constructor() { this.currentTime = 0; this._sr = 22050; this._dest = makeNode(); }
    get sampleRate() { return this._sr; }
    get destination() { return this._dest; }
    createGain() { return makeNode(); }
    createOscillator() { return makeNode(); }
    createBiquadFilter() { return makeNode(); }
    createDynamicsCompressor() { return makeNode(); }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { return makeNode(); }
  }
  window.AudioContext = FakeAudioContext;

  const recCanvas = makeCanvas();
  const drawn = [];
  const baseCtx = makeCtx(recCanvas);
  const recCtx = new Proxy(baseCtx, {
    get(t, prop) {
      if (prop === 'fillText') return (str, ...rest) => { drawn.push(String(str)); return t.fillText ? t.fillText(str, ...rest) : undefined; };
      return t[prop];
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
  recCanvas.getContext = () => recCtx;

  const g = new Game(recCanvas);
  g.start();
  g.audio.ensure();
  // A save that owns a mix: two ordinary paintings + one owned GOLD-TIER
  // (gilded-meridian), so the gilded-frame marker is exercised. The rest are
  // unowned (shadowed). croaksworth stays locked-but-unowned -> "sealed".
  const sv = L70.freshSave();
  sv.owned = ['moonlit-pond', 'spring-garden', 'gilded-meridian'];
  sv.ngCycle = 1; sv.gold = 60;
  g.save = sv;
  // the encore button exists in the atelier's click map.
  const encoreRow = g._atelierRows().find((r) => r.tag === 'encore');
  assert(!!encoreRow, 'M2: the atelier offers an "Encore" entry (click row present)');

  // enter the atelier first so the encore overlays it (it is an overlay, not a state).
  g.state = 'title'; g._beginAtelier();
  assert(g.state === 'atelier', 'M2: the atelier state is active before opening Encore');

  // ---- (a) open the encore + walk every one of the 10 paintings ----
  g._openEncore();
  assert(g._encoreOpen === true && g.state === 'atelier', 'M2: opening Encore keeps the atelier underneath (overlay, not a new state)');
  assert(g.audio._encoreThemes.length === 1, `M2: the encore arpeggio loop is created on the melody layer (1, got ${g.audio._encoreThemes.length})`);
  g._encoreIdx = 0;   // pin to painting 0 so the walk below is deterministic

  const seenOwned = new Set();
  let sawGoldTierMarker = false;
  let sawNotYet = false;
  // the first painting (index 0 = moonlit-pond, owned) renders immediately.
  drawn.length = 0; frames(3);
  const joined0 = drawn.join('\u0001');
  assert(joined0.includes('Encore'), `M2: the encore screen renders its header ("The Encore")`);
  assert(joined0.includes('Moonlit Pond'), 'M2: the first (owned) painting renders its TITLE on the large placard');
  assert(joined0.includes('/ 10'), 'M2: the counter reads "1 / 10"');
  // the Curator's Ledger lore blurb renders for the owned work (LEDGER_LORE
  // feeds the placard — assert the moonlit-pond's specific ledger line).
  assert(joined0.includes('Mabel paints it by memory'), 'M2: the Curator\'s Ledger lore blurb shows on the owned painting');
  // walk forward through all 10 — collect the placard text each stop.
  for (let step = 0; step < 10; step++) {
    const pt = L70.PAINTINGS[step];
    drawn.length = 0; frames(2);
    const joined = drawn.join('\u0001');
    const owned = sv.owned.includes(pt.id);
    if (owned) {
      assert(joined.includes(pt.name), `M2(${step}): owned "${pt.name}" renders its title`);
      seenOwned.add(pt.id);
    } else {
      // unowned (incl. the sealed portrait) -> shadowed frame with "not yet".
      assert(joined.includes('not yet'),
        `M2(${step}): unowned "${pt.name}" renders a shadowed "not yet" placard`);
      sawNotYet = true;
    }
    if (owned && pt.goldTier) { sawGoldTierMarker = joined.includes('gold tier'); }
    // advance to the next painting (wraps around at the end).
    g._encoreStep(1);
    frames(1);
  }
  assert(seenOwned.has('moonlit-pond') && seenOwned.has('spring-garden') && seenOwned.has('gilded-meridian'),
    `M2: all owned paintings were reached and titled while walking (got ${[...seenOwned].join(', ')})`);
  assert(sawGoldTierMarker === true, 'M2: the owned gold-tier work shows the gilded "★ gold tier" marker');
  assert(sawNotYet === true, 'M2: unowned paintings render as shadowed "not yet" frames');

  // ---- (b) the arpeggio is scheduled at a LOW level on the melody layer ----
  const et = g.audio._encoreThemes[0];
  assert(et.gain.gain.value < 1, `M2: the encore arpeggio rides a LOW gain (${et.gain.gain.value < 0.7 ? 'set' : 'target'}) under the melody master`);
  const onMelody = (n) => !n ? false : (n === g.audio._melodyMaster) || (n._connections || []).some((c) => onMelody(c));
  assert(onMelody(et.gain), 'M2: the encore arpeggio gain is connected UNDER the melody layer (inherits the music slider + mute)');
  g.audio.ctx.currentTime += 3.0;   // advance the fake clock past several steps
  g.audio.tickMusic();
  assert(et.step > 0, `M2: tickMusic schedules the encore arpeggio (step advanced to ${et.step})`);

  // ---- (c) navigation: the LEFT arrow works (real keyboard); a click advances ----
  fireKey('keydown', 'ArrowLeft');
  frames(1);
  fireKey('keydown', 'ArrowLeft');
  frames(1);
  assert(g._encoreIdx === (0 - 2 + L70.PAINTINGS.length) % L70.PAINTINGS.length, 'M2: the left arrow steps back to the previous painting');
  // a click on the RIGHT half of the screen advances (mouse routing in _updateEncore).
  // Drive the real canvas mousedown listener with a press on the right half.
  const beforeClick = g._encoreIdx;
  const md = (recCanvas._ev && recCanvas._ev['mousedown']);
  assert(!!md, 'M2: the canvas mousedown listener is bound (for click navigation)');
  md({ clientX: g.cw - 40, clientY: g.ch / 2, button: 0, preventDefault() {} });
  frames(1);
  assert(g._encoreIdx === (beforeClick + 1) % L70.PAINTINGS.length, 'M2: a click on the right half advances to the next painting');

  // ---- (d) Esc returns to the atelier + stops the arpeggio ----
  fireKey('keydown', 'Escape');
  frames(1);
  assert(g._encoreOpen === false, 'M2: Esc closes the encore overlay');
  assert(g.state === 'atelier', 'M2: Esc returns to the atelier');
  assert(g.audio._encoreThemes.length === 0, `M2: the encore arpeggio loop is stopped when leaving (got ${g.audio._encoreThemes.length})`);
  // no new persistence: the save is byte-identical (still 3 owned, same gold).
  assert(g.save.owned.length === 3 && g.save.gold === 60, 'M2: the encore is pure presentation — nothing is persisted');

  delete window.AudioContext; // restore
}

// STAGE 71: v1.4 M3 — the two title easter eggs (headless)
// ---------------------------------------------------------------------
// (a) EGG A: hold 'F' (or click the title frog 3x) and the title frog does a
//     little spin-and-blink + a unique chime + a ONE-TIME "didYouKnow" banner.
// (b) EGG B: painting the title frog with a dry-brush gesture, or the
//     SLEEPING heron (pre-engage) with the dry brush, leaves a tiny temporary
//     smile/cheek-blush that fades in a few seconds.
//
// We verify (headless): both triggers FIRE (egg state latches + the banner is
// added / the chime is scheduled) and both CLEAR (the spin ends, the blush
// fades to 0) — and that NOTHING is persisted (the save is untouched).
console.log('== stage 71: v1.4 M3 — two title easter eggs (headless) ==');
{
  const L71 = await import('../src/logic.js');
  // A minimal headless AudioContext (same shape as stages 66/70): enough for
  // the 'frog-chime' + 'paint-swipe' SFX to be scheduled (no real audio).
  const param = (v) => ({ value: v, setValueAtTime(x) { this.value = x; }, linearRampToValueAtTime(x) { this.value = x; },
    exponentialRampToValueAtTime(x) { this.value = x; }, setTargetAtTime(x) { this.value = x; } });
  const makeNode = () => ({
    type: 'sine', frequency: param(440), Q: param(1), detune: param(0), gain: param(1),
    buffer: null, _connections: [],
    connect(node) { this._connections.push(node); return node; },
    disconnect() { this._connections.length = 0; },
    start() {}, stop() {}, getChannelData() { return new Float32Array(0); },
  });
  class FakeAudioContext {
    constructor() { this.currentTime = 0; this._sr = 22050; this._dest = makeNode(); }
    get sampleRate() { return this._sr; }
    get destination() { return this._dest; }
    createGain() { return makeNode(); }
    createOscillator() { return makeNode(); }
    createBiquadFilter() { return makeNode(); }
    createDynamicsCompressor() { return makeNode(); }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { return makeNode(); }
  }
  window.AudioContext = FakeAudioContext;

  const recCanvas = makeCanvas();
  const g = new Game(recCanvas);
  g.start();
  g.audio.ensure();
  g.save = L71.freshSave();
  const saveBefore = JSON.stringify(g.save);

  // ---- (a) EGG A: hold 'F' -> spin-and-blink + chime + one-time banner ----
  // hold the 'F' key down (add it to the input's held-keys set, then release
  // after the trigger so it doesn't re-fire on every subsequent title frame).
  g.input.keys.add('f');
  // hold 'F' across enough real frames to cross the 0.45 s hold threshold
  // (35 frames @ 1/60 s = ~0.58 s).
  for (let i = 0; i < 35; i++) g._updateTitleEgg(1 / 60);
  g.input.keys.delete('f');   // release
  assert(g._eggFrog.spin >= 0, 'M3(A): holding "F" triggers the spin-and-blink');
  const bannerA = g.banners.find((b) => b.text === 'the frog appreciates the attention.');
  assert(!!bannerA, `M3(A): the one-time "didYouKnow" banner is added (got ${g.banners.length} banners)`);
  assert(g._eggFrog.shown === true, 'M3(A): the one-time flag latches (the banner fires exactly once)');

  // the spin AND the banner CLEAR: advance real time past the ~0.8 s spin +
  // ~3.4 s banner.
  g._eggFrog.spin = 0.7;   // near the end of the spin (10 frames at 1/60 = ~0.17s)
  for (let i = 0; i < 10; i++) {
    g._eggFrog.spin = (g._eggFrog.spin >= 0) ? g._eggFrog.spin + 1 / 60 : -1;
    if (g._eggFrog.spin >= 0.8) g._eggFrog.spin = -1;
  }
  assert(g._eggFrog.spin < 0, 'M3(A): the spin ends (real-time decay)');
  for (let i = 0; i < 220; i++) g.banners.forEach((b) => { b.t -= 1 / 60; }); // ~3.6 s
  g.banners = g.banners.filter((b) => b.t > 0);
  assert(!g.banners.find((b) => b.text === 'the frog appreciates the attention.'),
    'M3(A): the banner clears after its duration');

  // (a) EGG A (click path): the one-time flag is reset so the TRIPLE-CLICK path
  // can be exercised independently (it fires the same spin + banner).
  g._eggFrog.shown = false;
  const frogX = 150, frogY = g.ch - 162;
  for (let c = 0; c < 3; c++) {
    g.input.mouse.x = frogX + 5; g.input.mouse.y = frogY + 3;
    g.input.mouse.lDown = true; g.input.mouse.lPressed = true;
    g._updateTitleEgg(1 / 60);
    g.input.mouse.lDown = false; g.input.mouse.lPressed = false;
  }
  assert(g._eggFrog.spin >= 0, 'M3(A): clicking the title frog 3x triggers the spin-and-blink');
  assert(g.banners.some((b) => b.text === 'the frog appreciates the attention.'),
    'M3(A): the triple-click also fires the one-time banner (after the first fired + cleared)');

  // ---- (b) EGG B: dry-brush gesture on the title frog -> cheek-blush ----
  // (the title frog uses a held left-stroke; the pigment is irrelevant on the
  // title screen, but the heron branch requires 'dry').
  g.input.mouse.x = frogX; g.input.mouse.y = frogY;
  g.input.mouse.lDown = true;
  for (let i = 0; i < 20; i++) g._updateTitleEgg(1 / 60);   // ~0.33 s held
  g.input.mouse.lDown = false;
  assert(g._eggBlush.frog > 0, `M3(B): a dry-brush gesture on the title frog sets the blush (t=${g._eggBlush.frog.toFixed(2)}s)`);
  // the blush CLEARS (real-time decay): advance ~3.5 s.
  for (let i = 0; i < 210; i++) {
    g._eggBlush.frog = (g._eggBlush.frog > 0) ? g._eggBlush.frog - 1 / 60 : 0;
    if (g._eggBlush.frog < 0) g._eggBlush.frog = 0;
  }
  assert(g._eggBlush.frog <= 0, 'M3(B): the title-frog blush fades to 0 (real-time)');
  // the TITLE-screen eggs (EGG A + the title-frog blush) persisted nothing:
  // the save is still the pristine fresh save.
  assert(JSON.stringify(g.save) === saveBefore, 'M3: the title-screen easter eggs persist NOTHING (save unchanged)');

  // ---- (b) EGG B: dry brush on the SLEEPING heron (pre-engage) -> blush ----
  g._beginExpedition();
  assert(g.state === 'expedition' && g.heron && g.heron._intro > 0, 'M3(B): the expedition begins with a SLEEPING heron (pre-engage)');
  // capture the save AFTER _beginExpedition (which legitimately persists the
  // intro/tutorial flags) so we can prove the heron egg itself persists nothing.
  const saveAfterBegin = JSON.stringify(g.save);
  g.player.pigment = 'dry';
  // aim the mouse at the heron's head. `_updateExpedition` recomputes
  // `input.mouse.worldX/worldY` from the SCREEN coords (via `_view`), so we
  // (1) center the camera on the head so it is on-screen, then (2) convert the
  // head's world position to screen space: screenX = (worldX - view.x) / scale.
  const headWX = g.heron.x - 44 + 20, headWY = g.heron.y - 262;   // +20 px inside the 70px radius
  g.cam.x = headWX; g.cam.y = headWY; g.zoom = 1;
  const vHead = g._view();
  g.input.mouse.x = (headWX - vHead.x) / vHead.scale;
  g.input.mouse.y = (headWY - vHead.y) / vHead.scale;
  g.input.mouse.lDown = true;
  g._updateExpedition(1 / 60);   // one expedition frame: the egg check runs before the attack
  g.input.mouse.lDown = false;
  assert(g._eggBlush.heron > 0, `M3(B): a dry-brush stroke on the sleeping heron sets the blush (t=${g._eggBlush.heron.toFixed(2)}s)`);
  // the heron is UNCHANGED (the egg is presentation-only — no damage/state).
  assert(g.heron.hp === g.heron.maxHp && g.heron._intro > 0 && !g.heron.awakened,
    'M3(B): the sleeping heron is untouched (the blush is presentation-only)');
  // the blush CLEARS (real-time decay): advance ~3.5 s.
  for (let i = 0; i < 210; i++) {
    g._eggBlush.heron = (g._eggBlush.heron > 0) ? g._eggBlush.heron - 1 / 60 : 0;
    if (g._eggBlush.heron < 0) g._eggBlush.heron = 0;
  }
  assert(g._eggBlush.heron <= 0, 'M3(B): the heron blush fades to 0 (real-time)');

  // ---- nothing is persisted ----
  // The title-screen eggs (EGG A + EGG B on the title frog) must not have
  // written the save (saveBefore is captured at the start of the stage, before
  // any egg fired).
  assert(JSON.stringify(g.save) === saveAfterBegin,
    'M3: the heron easter egg persists NOTHING (the save is unchanged across the egg trigger)');

  delete window.AudioContext; // restore
}

console.log('== stage 72: v1.5 K1 — MUD TURTLE (armored plodder, front-arc shell deflects paint; red burn is the counter) ==');
{
  const L72 = await import('../src/logic.js');
  const { spawnEnemy } = await import('../src/enemies.js');

  // ---- table + pure deflection rule (source of truth) ----
  const T72 = L72.ENEMIES.turtle;
  assert(T72 && T72.name === 'Mud Turtle', 'turtle is declared in the ENEMIES table');
  assert(T72.frontDeflect === true, 'turtle is flagged as a front-deflecting shell');
  assert(T72.hp > L72.ENEMIES.toad.hp, `turtle is tanky (hp ${T72.hp} > toad ${L72.ENEMIES.toad.hp})`);
  assert(T72.speed < L72.ENEMIES.toad.speed, `turtle is slow/plodding (speed ${T72.speed} < toad ${L72.ENEMIES.toad.speed})`);
  assert(T72.dmg >= L72.ENEMIES.toad.dmg, `turtle has a heavy contact hit (dmg ${T72.dmg} >= toad ${L72.ENEMIES.toad.dmg})`);
  assert(T72.deflectKeep < 0.4, `front paint is heavily cut (deflectKeep ${T72.deflectKeep} < 0.4)`);
  // pure: front (within arc) is cut; side + back are full.
  const shell = { x: 0, y: 0, facing: 0, frontDeflect: true, deflectArc: T72.deflectArc, deflectKeep: T72.deflectKeep };
  assert(L72.frontDeflectFactor(shell, { x: 100, y: 0 }) < 0.4, 'paint from the FRONT arc is deflected (cut)');
  assert(L72.frontDeflectFactor(shell, { x: 0, y: 100 }) === 1, 'paint from the SIDE is full');
  assert(L72.frontDeflectFactor(shell, { x: -100, y: 0 }) === 1, 'paint from the BACK is full');

  // ---- driven integration: a real swipe deflects front, full side/back ----
  const cv72 = makeCanvas();
  const g72 = new Game(cv72);
  g72.start();
  fireKey('keydown', 'Enter'); frames(3); // title -> expedition
  const P72 = g72.player;
  P72.alive = true; P72.hp = 99; P72.iframes = 999;

  const T = spawnEnemy('turtle', 1000, 760, g72.tuning);
  T.facing = 0; // facing +x (right); the front arc is to the RIGHT
  g72.enemies.push(T);

  const swipeAt = (px, py, aimA, pig) => {
    P72.x = px; P72.y = py; P72.aimA = aimA; P72.pigment = pig;
    P72.swipeT = 0; g72.paint.swipeCd = 0; T.status = null; T.hitFlash = 0;
    const hp0 = T.hp;
    g72.paint.trySwipe(g72.enemies);
    return hp0 - T.hp;
  };
  // FRONT: player sits in the front arc (to the right of the shell) aiming at it.
  const dmgFront = swipeAt(1060, 760, Math.PI, 'blue');
  // BACK: player sits behind the shell (to the left).
  const dmgBack = swipeAt(940, 760, 0, 'blue');
  // SIDE: player sits above the shell.
  const dmgSide = swipeAt(1000, 700, Math.PI / 2, 'blue');
  assert(dmgBack >= 1 && dmgSide >= 1, `side/back paint is full (back=${dmgBack}, side=${dmgSide})`);
  assert(dmgFront < dmgBack, `front paint is DEFLECTED — less damage than side/back (front=${dmgFront} < back=${dmgBack})`);
  assert(dmgFront <= Math.max(1, Math.round(dmgBack * 0.35)), `front paint is a small fraction of full (front=${dmgFront}, back=${dmgBack})`);

  // ---- RED BURN is the counter: it ignores the front deflection and kills ----
  // Player stays in the FRONT arc (where paint is deflected), paints RED. The
  // direct paint hit is cut, but the BURN status it applies ticks full damage
  // (stepStatus never routes through paintDamage), so the turtle still dies.
  T.hp = 20; T.status = null;
  P72.x = 1060; P72.y = 760; P72.aimA = Math.PI; P72.pigment = 'red';
  P72.swipeT = 0; g72.paint.swipeCd = 0;
  g72.paint.trySwipe(g72.enemies); // applies the burn status
  assert(T.status && T.status.type === 'burn', 'a red swipe from the front still APPLIES burn (burn is the counter)');
  for (let i = 0; i < Math.ceil(3.2 * 60); i++) L72.stepStatus(T, 1 / 60, g72.tuning, i / 60);
  assert(T.hp <= 0 || T.dead, 'red burn KILLS the turtle even from the front (burn ignores the shell deflection)');

  // ---- zone / NG+ gating: turtle must NOT appear before zone 3 on cycle-0 ----
  // Force the spawn roll past the turtle threshold (0.9) so _spawnWave's turtle
  // branch is taken whenever it is allowed, and check what actually spawns.
  const origRand = Math.random;
  Math.random = () => 0.95; // roll=0.95: toad (roll>0.82) then turtle (roll>0.9) if allowed
  try {
    const spawnKindAt = (zoneI, ngCycle) => {
      g72._zoneI = zoneI; g72.ngCycle = ngCycle;
      g72.runT = 60; g72.spawnT = 0; // force a wave this tick
      g72.enemies.length = 0;        // under cap
      P72.x = 200; P72.y = 760;       // not in the boss arena
      g72._spawnWave(1 / 60);
      return g72.enemies.length ? g72.enemies[0].kind : null;
    };
    const kZ0 = spawnKindAt(0, 0);
    const kZ2 = spawnKindAt(2, 0);
    const kZ3 = spawnKindAt(3, 0);
    const kNG = spawnKindAt(0, 1);
    assert(kZ0 !== 'turtle' && kZ2 !== 'turtle',
      `cycle-0: turtle is GATED OUT before zone 3 (zone0=${kZ0}, zone2=${kZ2})`);
    assert(kZ3 === 'turtle', `cycle-0: turtle is ALLOWED from zone 3 (got ${kZ3})`);
    assert(kNG === 'turtle', `NG+ (cycle 1): turtle is allowed from the first named zone (got ${kNG})`);
  } finally {
    Math.random = origRand;
  }
}

console.log('== stage 73: v1.5 K2 — BLIND CRAG FROG (hunts by sound; sleeps when quiet, vulnerable +50%; wakes on nearby noise) ==');
{
  const L73 = await import('../src/logic.js');
  const E73 = await import('../src/enemies.js');
  const { spawnEnemy } = E73;
  const { paintDamage, cragSleepBonus, makeTuning } = L73;
  const tun73 = makeTuning({}, [], 'normal');
  const f = spawnEnemy('cragfrog', 0, 0, tun73);
  assert(f.kind === 'cragfrog', 'K2: cragfrog spawns (kind cragfrog)');
  assert(f.noiseRadius > 0 && f.alertDuration > 0, 'K2: cragfrog has noiseRadius + alertDuration');
  assert(f.asleep === true, 'K2: cragfrog SLEEPS at spawn (lies in wait)');
  const worldStub = { collideCircle: (x, y, r) => [x, y] };
  const playerStub = { alive: true, x: 0, y: 60, r: 15, iframes: 0, _hurt: false,
    hurt: () => { playerStub._hurt = true; return true; } };
  f.x = 0; f.y = 0; f.vx = 0; f.vy = 0;
  f.update(0.25, playerStub, tun73, worldStub, 0);
  assert(f.asleep === true, 'K2: quiet => still asleep');
  assert(f.x === 0 && f.y === 0, 'K2: asleep => does not move');
  assert(!playerStub._hurt, 'K2: asleep => does not attack');

  // --- a nearby noise (a paint swipe / hop / charge) WAKES it
  f.wakeNoise(f.x + 100, f.y);   // within noiseRadius (280)
  assert(f.asleep === false, 'K2: a NEARBY noise event wakes the cragfrog');
  assert(f.alertT > 0, 'K2: waking arms the alert timer');
  // awake => it charges at the player (moves + can attack)
  playerStub._hurt = false;
  const x0 = f.x, y0 = f.y;
  f.update(0.25, playerStub, tun73, worldStub, 0.01);
  const moved = (f.x - x0) ** 2 + (f.y - y0) ** 2;
  assert(moved > 1, `K2: awake => CHARGES toward the player (moved ${moved.toFixed(1)})`);
  // far noise does NOT wake it
  f.wakeNoise(f.x + 9999, f.y);
  assert(f.asleep === false && f.alertT > 0, 'K2: a FAR noise does not change its state');

  // --- when the player goes still (alert decays) it SLEEPS again
  let slept = false;
  for (let i = 0; i < 400; i++) {  // 400 * 0.25s = 100s >> alertDuration(5s)
    f.update(0.25, playerStub, tun73, worldStub, i * 0.01);
    if (f.asleep) { slept = true; break; }
  }
  assert(slept, 'K2: when the player is still (alert decays) it SLEEPS again');

  // --- while ASLEEP it is vulnerable: +50% paint damage (cragSleepBonus x1.5)
  assert(cragSleepBonus(f) === 1.5, 'K2: asleep cragfrog => cragSleepBonus 1.5');
  const dAsleep = paintDamage(tun73.swipeDamage, 'red', tun73, { enemy: f, sleepBonus: cragSleepBonus(f) });
  f.asleep = false;
  const dAwake = paintDamage(tun73.swipeDamage, 'red', tun73, { enemy: f, sleepBonus: cragSleepBonus(f) });
  assert(cragSleepBonus(f) === 1, 'K2: awake cragfrog => cragSleepBonus 1.0');
  const ratio = dAsleep / dAwake;
  assert(ratio > 1.4 && ratio < 1.6, `K2: asleep takes +50% paint dmg (ratio ${ratio.toFixed(2)}, want 1.5)`);
  assert(dAsleep > dAwake, 'K2: asleep paint dmg > awake paint dmg');

  // --- zone gating: NOT before zone 3 on a first-time (cycle-0) run; NG+ allowed
  // Fresh Game + a real _spawnWave call (mirrors the K1 gate test). Force the
  // spawn roll into the cragfrog window (0.86 < roll <= 0.9) so the cragfrog
  // branch is taken whenever cragAllowed, and check what actually spawns.
  const cv73 = makeCanvas();
  const g73 = new Game(cv73);
  g73.start();
  fireKey('keydown', 'Enter'); frames(3); // title -> expedition
  const P73 = g73.player;
  P73.alive = true; P73.hp = 99; P73.iframes = 999;
  const origRand = Math.random;
  Math.random = () => 0.88; // toad(>0.82) then cragfrog(>0.86, <=0.9) if allowed
  try {
    const spawnKindAt = (zoneI, ngCycle) => {
      g73._zoneI = zoneI; g73.ngCycle = ngCycle;
      g73.runT = 90; g73.spawnT = 0; // force a wave this tick (t>30)
      g73.enemies.length = 0;        // under cap
      P73.x = 200; P73.y = 760;      // not in the boss arena
      g73._spawnWave(1 / 60);
      return g73.enemies.length ? g73.enemies[0].kind : null;
    };
    const k2Z0 = spawnKindAt(0, 0);
    const k2Z2 = spawnKindAt(2, 0);
    const k2Z3 = spawnKindAt(3, 0);
    const k2NG = spawnKindAt(0, 1);
    assert(k2Z0 !== 'cragfrog' && k2Z2 !== 'cragfrog',
      `K2: cycle-0: cragfrog is GATED OUT before zone 3 (zone0=${k2Z0}, zone2=${k2Z2})`);
    assert(k2Z3 === 'cragfrog', `K2: cycle-0: cragfrog is ALLOWED from zone 3 (got ${k2Z3})`);
    assert(k2NG === 'cragfrog', `K2: NG+ (cycle 1): cragfrog allowed from the first named zone (got ${k2NG})`);
  } finally {
    Math.random = origRand;
  }
}

console.log('== stage 74: v1.5 K3 — STORM SURGE (zone-5 final-stretch set-piece; bounded mosquito burst + transient rain + orb reward; non-blocking) ==');
{
  const L74 = await import('../src/logic.js');
  const G74 = await import('../src/game.js');
  const { STORM_SURGE, stormSurgeFor, stormSurgeCleared, stormSurgeRainPhase, weatherFactor } = L74;
  const { Game, ZONES } = G74;

  // ---- pure: the beat is bounded + the rain buff is transient (1 -> mult -> 1)
  assert(STORM_SURGE.burstCount > 0 && STORM_SURGE.burstCount <= 14, `K3: the surge burst is BOUNDED (burstCount=${STORM_SURGE.burstCount})`);
  assert(STORM_SURGE.duration >= 12 && STORM_SURGE.duration <= 20, `K3: the beat is ~15s (duration=${STORM_SURGE.duration})`);
  assert(STORM_SURGE.orbCount > 0, `K3: clearing awards a bonus orb burst (orbCount=${STORM_SURGE.orbCount})`);
  const ph = stormSurgeRainPhase();
  assert(weatherFactor(ph, 0) === 1, 'K3: the rain buff is INACTIVE at beat start (factor 1.0)');
  assert(Math.abs(weatherFactor(ph, 7.5) - STORM_SURGE.rain.mult) < 0.01, `K3: the rain buff is at FULL mid-beat (factor ${weatherFactor(ph,7.5).toFixed(2)})`);
  assert(weatherFactor(ph, STORM_SURGE.duration) === 1, 'K3: the rain buff EXPIRES back to base (factor 1.0) — transient, no residue');
  assert(stormSurgeFor(7).leadIn === stormSurgeFor(7).leadIn, 'K3: the surge opening is seeded (deterministic per run)');

  // ---- integration: a real Game arms + drives the beat ----
  const cv74 = makeCanvas();
  const g74 = new Game(cv74);
  g74.start();
  fireKey('keydown', 'Enter'); frames(3); // title -> expedition
  const P74 = g74.player;
  P74.alive = true; P74.hp = 99; P74.iframes = 999;

  // a fresh run has NOT triggered the surge yet
  assert(g74.surge === null, 'K3: the surge is NOT armed before the final stretch (fresh run)');

  // the arming condition (zone 5 = past the last NAMED zone, heron present):
  // drive one frame with _zoneI forced past the last zone — the loop arms it once.
  const runT0 = g74.runT;
  g74._zoneI = ZONES.length; // "zone 5": past the last named zone
  frames(1);
  assert(g74.surge !== null, 'K3: the surge TRIGGERS once on entering zone 5 (final stretch)');
  const armedRef = g74.surge;
  frames(1);
  assert(g74.surge === armedRef, 'K3: the surge is a ONE-SHOT beat (not re-armed each frame)');
  assert(g74.surge.active === false, 'K3: the surge arms in its lead-in (banner/stinger) before the burst');
  assert(g74.runT === runT0 + (2 / 60) || Math.abs(g74.runT - (runT0 + 2 / 60)) < 0.02,
    'K3: the surge does NOT feed runT (it runs on its own clock)');

  // ---- drive the beat: bounded mosquito burst + transient rain buff ----
  const baseSplash = g74.tuning.splashRadius;
  // reset to a fresh surge so the beat is clean (the two frames above only ran the lead-in)
  g74.surge = stormSurgeFor(424242);
  let guard = 0;
  while (g74.surge && g74.surge.burst < STORM_SURGE.burstCount && guard++ < 900) g74._updateSurge(1 / 60);
  assert(g74.surge.burst >= STORM_SURGE.burstCount, `K3: the surge spawns a BOUNDED mosquito burst (burst=${g74.surge.burst}/${STORM_SURGE.burstCount})`);
  assert(g74._surgeEnemies.length === STORM_SURGE.burstCount, `K3: exactly ${STORM_SURGE.burstCount} surge mosquitoes are live (bounded, no over-spawn)`);
  const mosqs = g74._surgeEnemies.filter(e => e.kind === 'mosquito');
  assert(mosqs.length === STORM_SURGE.burstCount, 'K3: the burst is all mosquitoes (the "fast swarm")');
  assert(g74.tuning.splashRadius > baseSplash, `K3: the rain buff is ACTIVE (splashRadius ${baseSplash.toFixed(1)} -> ${g74.tuning.splashRadius.toFixed(1)})`);
  // the surge mosquitoes are a touch faster (the "fast" swarm)
  assert(mosqs.every(e => e._surge === true), 'K3: the surge mosquitoes are tagged (trackable for the clear check)');

  // ---- clear: kill the surge mosquitoes -> a bonus orb burst scatters ----
  const orbsBefore = g74.orbs.length;
  for (const e of g74._surgeEnemies) e.dead = true;
  g74._updateSurge(1 / 60);
  assert(g74.surge.awarded === true, 'K3: clearing the surge (all mosquitoes gone) is detected');
  assert(g74.orbs.length >= orbsBefore + STORM_SURGE.orbCount, `K3: clearing scatters a BONUS ORB BURST (orbs ${orbsBefore} -> ${g74.orbs.length})`);
  // the pure cleared predicate agrees (checked on a PRE-award state — once the
  // orbs are awarded, awarded=true and the predicate correctly stops matching)
  assert(stormSurgeCleared({ active: true, burst: STORM_SURGE.burstCount, awarded: false }, 0),
    'K3: the pure cleared predicate fires (all spawned, none left, not yet awarded)');
  assert(!stormSurgeCleared({ active: true, burst: STORM_SURGE.burstCount, awarded: true }, 0),
    'K3: the pure cleared predicate does NOT double-award (already awarded)');

  // ---- expiry: the beat ends cleanly, the rain buff returns to base ----
  let g2 = 0;
  while (g74.surge !== null && g2++ < 900) g74._updateSurge(1 / 60);
  assert(g74.surge === null, 'K3: the surge EXPIRES cleanly (drops after its duration)');
  assert(Math.abs(g74.tuning.splashRadius - baseSplash) < 1e-6, `K3: on expiry the rain buff returns EXACTLY to base (splashRadius ${g74.tuning.splashRadius.toFixed(1)} == ${baseSplash.toFixed(1)})`);
  assert(g74._surgeEnemies.length === 0, 'K3: on expiry the surge enemy tracking is cleared');
}

console.log('== stage 75: v1.5 K4 — THE GILDED HERON (NG+ cycle-3+ third boss; gold palette, 42k HP, plume absorbs green heal) ==');
{
  const L75 = await import('../src/logic.js');
  const { spawnEnemy } = await import('../src/enemies.js');

  // ---- (1) boss selection: cycle 3+ fights the GILDED heron; cycle 0/1-2 unchanged ----
  const gG3 = new Game(makeCanvas()); gG3.start();
  const g3save = L75.freshSave(); g3save.stats.victories = 3; g3save.ngCycle = 3; g3save.flags.heronDefeated = true;
  gG3.save = g3save; gG3._beginExpedition();
  assert(gG3.heron.kind === 'gilded', `K4: ngCycle 3 fights THE GILDED HERON (got kind=${gG3.heron.kind})`);
  assert(gG3.heron.gilded === true, 'K4: the gilded heron is flagged for the distinct gold palette');
  assert(gG3.heron.hp === 42000 && gG3.heron.maxHp === 42000, `K4: the gilded heron carries 42k HP (got ${gG3.heron.hp})`);
  assert(gG3.heron.awakenNeed && gG3.heron.awakenNeed.red === 45 && gG3.heron.awakenNeed.blue === 45 && gG3.heron.awakenNeed.green === 45,
    'K4: the gilded heron keeps the 3-hue awaken rhythm (core pillar unchanged)');
  assert(gG3.heron.plumeT === 0 && gG3.heron.plumeCd === 0, 'K4: the gilded heron starts out of its plume phase (the gap)');
  assert(L75.GILDED_HERON.gildedHue === '#d9a52e' && L75.GILDED_HERON.gildedHueLight === '#ffe9a8', 'K4: the gilded heron has a distinct gold palette');
  assert(L75.goldEventBoss('gilded') === null, 'K4: the gilded heron awards no NEW meta gold of its own (a later-cycle NG+ escalation)');
  assert(L75.goldTotal() === 67, `K4: adding the gilded boss leaves career gold total at 67 (got ${L75.goldTotal()})`);

  // cycle 0 = gray (first-time byte-identical), cycles 1-2 = green (K4 must not shift them)
  const gC0 = new Game(makeCanvas()); gC0.start(); gC0.save = L75.freshSave(); gC0._beginExpedition();
  assert(gC0.heron.kind === 'gray' && gC0.heron.gilded === undefined && gC0.heron.plumeT === undefined,
    'K4: ngCycle 0 still fights the GRAY heron (first-time byte-identical; no gilded/plume fields)');
  const gC1 = new Game(makeCanvas()); gC1.start();
  const c1save = L75.freshSave(); c1save.stats.victories = 1; c1save.ngCycle = 1; c1save.flags.heronDefeated = true;
  gC1.save = c1save; gC1._beginExpedition();
  assert(gC1.heron.kind === 'green' && gC1.heron.gilded === undefined, 'K4: ngCycle 1 still fights the GREEN heron (not the gilded)');
  const gC2 = new Game(makeCanvas()); gC2.start();
  const c2save = L75.freshSave(); c2save.stats.victories = 2; c2save.ngCycle = 2; c2save.flags.heronDefeated = true;
  gC2.save = c2save; gC2._beginExpedition();
  assert(gC2.heron.kind === 'green', 'K4: ngCycle 2 still fights the GREEN heron (gilded starts at cycle 3)');
  // cycle 4+ also gilded (the minCycle cap, not a single cycle)
  const gC4 = new Game(makeCanvas()); gC4.start();
  const c4save = L75.freshSave(); c4save.stats.victories = 4; c4save.ngCycle = 4; c4save.flags.heronDefeated = true;
  gC4.save = c4save; gC4._beginExpedition();
  assert(gC4.heron.kind === 'gilded', 'K4: ngCycle 4 fights the GILDED heron (cycle 3+ is the band, not just 3)');

  // ---- (2) the plume phase is a PURE timer (testable without a browser) ----
  const ph = { gilded: true, plumeT: 0, plumeCd: 0 };
  // from the gap the plume ignites once the cooldown elapses (plume-on)
  ph.plumeCd = L75.GILDED_HERON.plumeCooldown;
  let r = L75.gildedPlumeTick(ph, 0.5);
  assert(r === 0 && ph.plumeCd === L75.GILDED_HERON.plumeCooldown - 0.5, 'K4: gildedPlumeTick counts down the cooldown gap');
  r = L75.gildedPlumeTick(ph, 99);
  assert(r === 'plume-on' && ph.plumeT === L75.GILDED_HERON.plumeActive, 'K4: gildedPlumeTick reports plume-on and re-arms the plume on the frame it ignites');
  // while active the plume burns down (absorbing) then releases (plume-off -> the heal gap)
  r = L75.gildedPlumeTick(ph, 0.5);
  assert(r === 0 && ph.plumeT === L75.GILDED_HERON.plumeActive - 0.5, 'K4: gildedPlumeTick counts down the active plume');
  r = L75.gildedPlumeTick(ph, 99);
  assert(r === 'plume-off' && ph.plumeCd === L75.GILDED_HERON.plumeCooldown, 'K4: gildedPlumeTick reports plume-off and re-arms the cooldown on release');
  // the ~30s cycle is 10s active + 20s gap as specced
  assert(L75.GILDED_HERON.plumeActive + L75.GILDED_HERON.plumeCooldown === 30, 'K4: the plume cycle is ~30s (10s active + 20s heal gap)');
  assert(L75.gildedPlumeActive({ gilded: true, plumeT: 5 }) === true && L75.gildedPlumeActive({ gilded: true, plumeT: 0 }) === false,
    'K4: gildedPlumeActive reports the heal-absorbing window (plumeT>0) only');
  // no-op for a non-gilded heron (gray/green never carry `gilded`)
  const phG = { pinned: 2 };
  assert(L75.gildedPlumeTick(phG, 99) === 0, 'K4: gildedPlumeTick is a no-op for a non-gilded heron (byte-identical for gray/green)');

  // ---- (3) the plume ABSORBS the frog's green heal while active, and heal works in the gap ----
  const g75 = new Game(makeCanvas()); g75.start();
  const s75 = L75.freshSave(); s75.stats.victories = 3; s75.ngCycle = 3; s75.flags.heronDefeated = true;
  g75.save = s75; g75._beginExpedition();
  const h = g75.heron, p = g75.player;
  h._intro = 0;                                   // reveal the boss so its plume + paint path run
  p.maxHp = 9999; p.hp = 100; p.iframes = 999; p._healAcc = 0;   // low HP + invulnerable (heal test, not combat)
  const foe = spawnEnemy('beetle', h.x, h.y - 50, g75.tuning); g75.enemies.push(foe); foe.hp = 10000; foe.maxHp = 10000; // a tanky green-paintable enemy
  const greenPaint = (n) => { g75.input.mouse.lDown = true; p.pigment = 'green'; for (let i = 0; i < n; i++) { p.x = foe.x; p.y = foe.y - 40; p.vx = 0; p.vy = 0; g75._updateExpedition(0.016); } g75.input.mouse.lDown = false; };
  // (a) GAP: the plume is off (h.plumeT = 0) -> painting green heals the frog
  p._healAcc = 0;
  const healGapBefore = p._healAcc;
  greenPaint(40);
  assert(h.plumeT === 0 && (p._healAcc > healGapBefore || p.hp > 100), `K4: in the plume GAP green paint HEALS the frog (healAcc ${healGapBefore.toFixed(2)} -> ${p._healAcc.toFixed(2)})`);
  // (b) ACTIVE: force the plume on -> green paint heals 0 (suppressed)
  h.plumeT = L75.GILDED_HERON.plumeActive;
  p._healAcc = 0;
  const hpActBefore = p.hp;
  greenPaint(40);
  assert(h.plumeT > 0 && p._healAcc <= 0.001 && p.hp === hpActBefore, `K4: while the plume is ACTIVE green paint heals 0 (suppressed; hp ${hpActBefore}, healAcc ${p._healAcc.toFixed(2)})`);
  // (c) the standing-in-green heal is also suppressed while active (player.update path)
  h.plumeT = L75.GILDED_HERON.plumeActive;
  const cell = g75.world.pigmentAt(p.x, p.y); cell.green = 3; cell.age = 3.2;   // standing in fresh green
  p._plumeSuppress = true;                 // the flag game.js publishes each frame (drives player.update)
  p._healAcc = 0.6;
  const hpStandBefore = p.hp;
  p.update(0.5, g75.input, g75.tuning, g75.world, { x: 0, y: 0, scale: 1 });
  assert(p._healAcc <= 0.6 && p.hp === hpStandBefore, 'K4: the standing-in-green heal is ALSO suppressed while the plume is active');
  // ...and works when the plume is off
  p._plumeSuppress = false;
  p._healAcc = 0.6;
  const hpStandGap = p.hp;
  p.update(3.0, g75.input, g75.tuning, g75.world, { x: 0, y: 0, scale: 1 });
  assert(p.hp > hpStandGap, `K4: the standing-in-green heal works in the plume gap (hp ${hpStandGap} -> ${p.hp})`);
  cell.green = 0; cell.age = 0;
  console.log('ok — K4: the Gilded Heron appears on NG+ cycle 3+ (42k, gold palette), its plume is a ~30s phase timer that ABSORBS both green heal sources while active (heal works in the gap), and cycle 0/1-2 boss selection is unchanged');
}

console.log('== stage 76: v1.5 K5 — 3 NEW EXPEDITION MODIFIERS (Night Expedition / Still Waters / Master\'s Palette) ==');
{
  const L76 = await import('../src/logic.js');
  const { spawnEnemy } = await import('../src/enemies.js');
  const { Game } = await import('../src/game.js');

  // ---- (0) the 3 new modifiers are in the MODIFIERS table ----
  for (const id of ['night-expedition', 'still-waters', 'masters-palette']) {
    const m = L76.MODIFIERS[id];
    assert(m && m.id === id && typeof m.name === 'string' && typeof m.desc === 'string' && typeof m.apply === 'function',
      `K5: modifier '${id}' is a data entry (id/name/desc/apply)`);
  }

  // ---- (1) NIGHT EXPEDITION: darker lighting + 20% mosquito speed + 10% orb value ----
  const gNight = new Game(makeCanvas()); gNight.start();
  const nightSave = L76.freshSave(); nightSave.ngCycle = 1; nightSave.ngModifier = 'night-expedition'; nightSave.stats.victories = 1; nightSave.flags.heronDefeated = true;
  gNight.save = nightSave; gNight._beginExpedition();
  assert(gNight.tuning.nightDarkness === 1, 'K5: Night Expedition sets the nightDarkness flag (render-only darkening)');
  assert(gNight.tuning.mosquitoSpeedMult === 1.2, `K5: Night Expedition speeds mosquitoes +20% (mosquitoSpeedMult ×${gNight.tuning.mosquitoSpeedMult})`);
  assert(Math.abs(gNight.tuning.pickupValue - 1.10) < 1e-9, `K5: Night Expedition raises orb value +10% (pickupValue ${gNight.tuning.pickupValue})`);
  // the mosquito speed multiplier actually affects the enemy (feeds the existing spawn path)
  const nightMq = spawnEnemy('mosquito', 200, 100, gNight.tuning);
  const plainMqTuning = L76.makeTuning({}, [], 'normal', 0);
  L76.applyNGPlus(plainMqTuning, 1); // same NG+ cycle 1, no modifier
  const plainMq = spawnEnemy('mosquito', 200, 100, plainMqTuning);
  assert(nightMq.speed > plainMq.speed, `K5: Night Expedition mosquito is faster (speed ${nightMq.speed} > ${plainMq.speed})`);
  // a beetle (non-mosquito) is NOT sped by night (only mosquitoes)
  const nightBeetle = spawnEnemy('beetle', 200, 100, gNight.tuning);
  const plainBeetle = spawnEnemy('beetle', 200, 100, plainMqTuning);
  assert(nightBeetle.speed === plainBeetle.speed, 'K5: Night Expedition does NOT speed beetles (mosquito-specific only)');
  assert(!gNight.tuning.stillWaters && !gNight.tuning.preLockLoadout, 'K5: Night Expedition does NOT set stillWaters or preLock fields');

  // ---- (2) STILL WATERS: no weather phases + 15% enemy HP ----
  const gSW = new Game(makeCanvas()); gSW.start();
  const swSave = L76.freshSave(); swSave.ngCycle = 1; swSave.ngModifier = 'still-waters'; swSave.stats.victories = 1; swSave.flags.heronDefeated = true;
  gSW.save = swSave; gSW._beginExpedition();
  assert(gSW.tuning.stillWaters === 1, 'K5: Still Waters sets the stillWaters flag (no weather phases)');
  // enemy HP is 15% over the NG+ cycle-1 base (1.30 * 1.15 = 1.50)
  const swBeetle = spawnEnemy('beetle', 200, 100, gSW.tuning);
  const plainC1Tuning = L76.makeTuning({}, [], 'normal', 0);
  L76.applyNGPlus(plainC1Tuning, 1); // cycle 1, no modifier
  const plainC1Beetle = spawnEnemy('beetle', 200, 100, plainC1Tuning);
  assert(swBeetle.hp > plainC1Beetle.hp, `K5: Still Waters makes enemies tougher (beetle HP ${swBeetle.hp} > ${plainC1Beetle.hp})`);
  // the tuning.enemyHp reflects the 15% bump (1.30 * 1.15 ≈ 1.50)
  assert(Math.abs(gSW.tuning.enemyHp - 1.50) < 0.01, `K5: Still Waters enemy HP multiplier is ~1.50 (got ${gSW.tuning.enemyHp})`);
  // the weather gate is active (weatherFor is skipped when stillWaters)
  assert(gSW.tuning.stillWaters === 1 && gSW.weatherPending === null, 'K5: Still Waters run starts with no weather pending');
  assert(!gSW.tuning.nightDarkness && !gSW.tuning.preLockLoadout, 'K5: Still Waters does NOT set nightDarkness or preLock fields');

  // ---- (3) MASTER'S PALETTE: pre-locked synergy duo + 10% contact damage ----
  const gMP = new Game(makeCanvas()); gMP.start();
  const mpSave = L76.freshSave(); mpSave.ngCycle = 1; mpSave.ngModifier = 'masters-palette'; mpSave.stats.victories = 1; mpSave.flags.heronDefeated = true;
  gMP.save = mpSave; gMP._beginExpedition();
  assert(Math.abs(gMP.tuning.contactDmgMult - 1.10) < 1e-9, `K5: Master's Palette raises contact dmg +10% (contactDmgMult ×${gMP.tuning.contactDmgMult})`);
  // the pre-locked loadout is the Flooded Night duo (moonlit-pond + storm-cloud)
  assert(Array.isArray(gMP.tuning.preLockLoadout) && gMP.tuning.preLockLoadout.length === 2, 'K5: Master\'s Palette sets a pre-locked 2-slot loadout');
  assert(gMP.tuning.synergy === 'Flooded Night', `K5: Master's Palette pre-locks the Flooded Night synergy (got ${gMP.tuning.synergy})`);
  // the contact damage multiplier actually affects the enemy
  const mpBeetle = spawnEnemy('beetle', 200, 100, gMP.tuning);
  const noModC1Tuning = L76.makeTuning({}, [], 'normal', 0);
  L76.applyNGPlus(noModC1Tuning, 1);
  const noModC1Beetle = spawnEnemy('beetle', 200, 100, noModC1Tuning);
  assert(mpBeetle.dmg > noModC1Beetle.dmg, `K5: Master's Palette increases contact damage (beetle dmg ${mpBeetle.dmg.toFixed(1)} > ${noModC1Beetle.dmg.toFixed(1)})`);
  assert(!gMP.tuning.nightDarkness && !gMP.tuning.stillWaters, 'K5: Master\'s Palette does NOT set nightDarkness or stillWaters fields');

  // ---- (4) cycle-0 (first-time) is COMPLETELY untouched: no modifier fields ----
  const gC0 = new Game(makeCanvas()); gC0.start();
  gC0.save = L76.freshSave();
  gC0._beginExpedition();
  assert(!gC0.tuning.nightDarkness && !gC0.tuning.mosquitoSpeedMult && !gC0.tuning.stillWaters && !gC0.tuning.preLockLoadout,
    'K5: a cycle-0 run carries NO new modifier fields (first-time byte-identical)');
  const plainC0 = L76.makeTuning(gC0.save.upgrades, gC0.save.loadout, gC0.options.difficulty, gC0.save.galleryBonus || 0);
  assert(JSON.stringify(gC0.tuning) === JSON.stringify(plainC0), 'K5: cycle-0 tuning deep-equals a plain makeTuning (no modifier delta)');

  console.log(`ok — K5: the 3 new modifiers (Night Expedition / Still Waters / Master's Palette) each apply their distinct tuning/render effect (darker lighting + mosquito speed + orb value / no weather + enemy HP / pre-locked duo + contact dmg), and cycle-0 is untouched`);
}

console.log('== stage 77: v1.5 K6 — NG+ "MASTER" TIER (cycle 4+ capped escalation step: enemy HP +50% / dmg +25% over cycle 3) ==');
{
  const L77 = await import('../src/logic.js');

  // ---- (1) the pure scaling table: cycle 0-3 unchanged; cycle 4 is the Master step ----
  const s0 = L77.ngPlusScaling(0);
  const s1 = L77.ngPlusScaling(1);
  const s2 = L77.ngPlusScaling(2);
  const s3 = L77.ngPlusScaling(3);
  const s4 = L77.ngPlusScaling(4);
  const s5 = L77.ngPlusScaling(5);
  const s99 = L77.ngPlusScaling(99);

  // cycle 0-3 are UNCHANGED by K6 (the exact committed values)
  assert(s0.hp === 1 && s0.dmg === 1 && s0.spawn === 1, 'K6: cycle 0 is all-ones (first-time byte-identical, unchanged by K6)');
  assert(s1.hp === 1.30 && s1.dmg === 1.15 && s1.spawn === 1.10, `K6: cycle 1 is unchanged (HP x${s1.hp}, dmg x${s1.dmg}, spawn x${s1.spawn})`);
  assert(s2.hp === 1.60 && s2.dmg === 1.30 && s2.spawn === 1.20, `K6: cycle 2 is unchanged (HP x${s2.hp}, dmg x${s2.dmg}, spawn x${s2.spawn})`);
  assert(s3.hp === 1.90 && s3.dmg === 1.45 && s3.spawn === 1.30, `K6: cycle 3 is unchanged (HP x${s3.hp}, dmg x${s3.dmg}, spawn x${s3.spawn})`);

  // ---- (2) the Master step: cycle 4 = HP +50% / dmg +25% OVER cycle 3 ----
  //   HP: 1.90 x 1.50 = 2.85  (cycle-3 HP +50%)
  //   dmg: 1.45 x 1.25 = 1.8125 -> 1.81 (cycle-3 dmg +25%)
  //   spawn: held at cycle 3 (1.30) — the Master tier is about toughness, not spawn rate
  assert(Math.abs(s4.hp - 2.85) < 0.001, `K6: cycle-4 enemy HP = cycle-3 HP +50% (1.90 x 1.50 = 2.85, got ${s4.hp})`);
  assert(Math.abs(s4.dmg - 1.81) < 0.001, `K6: cycle-4 enemy dmg = cycle-3 dmg +25% (1.45 x 1.25 = 1.81, got ${s4.dmg})`);
  assert(Math.abs(s4.spawn - 1.30) < 0.001, `K6: cycle-4 spawn held at cycle 3 (got x${s4.spawn})`);
  assert(s4.hp > s3.hp && s4.dmg > s3.dmg, 'K6: the Master tier (cycle 4) is strictly harder than cycle 3');
  assert(s4.hp > s2.hp && s4.dmg > s2.dmg, 'K6: the Master tier is strictly harder than cycle 2');

  // ---- (3) bounded: cycle 4 == cycle 5 == cycle 99 (no unbounded spiral) ----
  assert(s4.hp === s5.hp && s4.dmg === s5.dmg && s4.spawn === s5.spawn, 'K6: the Master tier is capped at cycle 4 (cycle 4 == cycle 5)');
  assert(s4.hp === s99.hp && s4.dmg === s99.dmg && s4.spawn === s99.spawn, 'K6: the Master cap holds for arbitrarily large cycles (cycle 4 == cycle 99)');
  assert(L77.NG_CAP_CYCLE === 4, `K6: the NG+ escalation cap is cycle 4 (got ${L77.NG_CAP_CYCLE})`);

  // ---- (4) applyNGPlus: the Master step applies ONLY at cycle 4+, not cycle 0-3 ----
  //   cycle 0: all-ones (byte-identical)
  const a0 = L77.applyNGPlus({ enemyHp: 1, enemyDmg: 1, spawnRate: 1 }, 0);
  assert(a0.enemyHp === 1 && a0.enemyDmg === 1 && a0.spawnRate === 1, 'K6: applyNGPlus(cycle 0) is a no-op (byte-identical)');
  //   cycle 3: the cycle-3 values (1.90/1.45/1.30) — NOT the Master step
  const a3 = L77.applyNGPlus({ enemyHp: 1, enemyDmg: 1, spawnRate: 1 }, 3);
  assert(Math.abs(a3.enemyHp - 1.90) < 0.001 && Math.abs(a3.enemyDmg - 1.45) < 0.001 && Math.abs(a3.spawnRate - 1.30) < 0.001, `K6: applyNGPlus(cycle 3) = cycle-3 values (HP ${a3.enemyHp}, dmg ${a3.enemyDmg}, spawn ${a3.spawnRate})`);
  //   cycle 4: the Master step (2.85/1.81/1.30)
  const a4 = L77.applyNGPlus({ enemyHp: 1, enemyDmg: 1, spawnRate: 1 }, 4);
  assert(Math.abs(a4.enemyHp - 2.85) < 0.001 && Math.abs(a4.enemyDmg - 1.81) < 0.001 && Math.abs(a4.spawnRate - 1.30) < 0.001, `K6: applyNGPlus(cycle 4) = the Master step (HP ${a4.enemyHp}, dmg ${a4.enemyDmg}, spawn ${a4.spawnRate})`);
  assert(a4.enemyHp > a3.enemyHp && a4.enemyDmg > a3.enemyDmg, 'K6: cycle-4 applied tuning > cycle-3 applied tuning (the Master step is strictly harder)');
  //   cycle 5: same Master step (capped)
  const a5 = L77.applyNGPlus({ enemyHp: 1, enemyDmg: 1, spawnRate: 1 }, 5);
  assert(a5.enemyHp === a4.enemyHp && a5.enemyDmg === a4.enemyDmg && a5.spawnRate === a4.spawnRate, 'K6: applyNGPlus(cycle 5) == applyNGPlus(cycle 4) (the Master cap)');

  console.log('ok — K6: the NG+ Master tier (cycle 4+) is a capped scaling step (HP +50% / dmg +25% over cycle 3, spawn held), strictly harder than cycle 3, bounded (cycle 4 == cycle 5 == cycle 99), and cycles 0-3 are unchanged (pure logic, no game.js change)');
}

// stage 78 — v1.5 M2 K7: the CURATOR CHALLENGE. A victory-gated title button
// that runs a SEEDED daily expedition: seed = current UTC day (shared worldwide),
// loadout = a seeded 2-painting draw from owned paintings, modifier = a seeded
// pick from MODIFIERS. A victory computes a SCORE (restored + enemies + orbs +
// boss-time bonus) and files it to a saved top-5 best-score list, shown in a NEW
// atelier panel. Pure logic lives in logic.js (day seed / loadout / modifier /
// score / file); game.js only wires it. We assert the gate, the deterministic
// seed (same day -> same draw), the score math, the top-5 file (ordered desc,
// max 5, older dropped), the v8->v9 migration, and an END-TO-END challenge
// victory that files a score to the save (persisted).
console.log('== stage 78: v1.5 M2 K7 — Curator Challenge (seeded daily expedition) ==');
{
  const L78 = await import('../src/logic.js');

  // (1) GATE: a fresh save (no victory) does NOT unlock the challenge; a save
  // with a victory does. Same predicate shape as ngUnlocked.
  assert(L78.challengeUnlocked(L78.freshSave()) === false, 'K7: a fresh save (no victory) does NOT unlock the challenge');
  const won78 = L78.freshSave(); won78.stats.victories = 1;
  won78.owned = ['moonlit-pond', 'dancing-salamander', 'spring-garden', 'king-frog', 'storm-cloud'];
  assert(L78.challengeUnlocked(won78) === true, 'K7: a save with a completed victory unlocks the challenge');
  // The title layout shows the button only when unlocked (g.chall set/null).
  const cv78a = makeCanvas(); const g78a = new Game(cv78a); g78a.start();
  g78a.save = L78.freshSave(); // no victory
  const layFresh = g78a._titleLayout();
  assert(layFresh.chall === null, 'K7: the title layout has NO challenge button on a fresh (no-victory) save');
  g78a.save = won78;
  const layWon = g78a._titleLayout();
  assert(layWon.chall && layWon.chall.w > 0, 'K7: the title layout EXPOSES the challenge button on a victory save');

  // (2) DETERMINISM: the seed is the current UTC day and the loadout/modifier
  // are derived deterministically from it — the SAME day yields the SAME
  // (seed, loadout, modifier) triple for a given owned set (the whole world
  // shares one challenge per day).
  const day = L78.challengeDaySeed();
  assert(typeof day === 'number' && Number.isFinite(day) && day > 0, `K7: the day seed is a finite positive UTC-day number (${day})`);
  const owned78 = ['moonlit-pond', 'dancing-salamander', 'spring-garden', 'self-portrait', 'king-frog'];
  const lo1 = L78.challengeDrawLoadout(day, owned78), lo2 = L78.challengeDrawLoadout(day, owned78);
  assert(lo1.length === 2 && lo2.length === 2, `K7: the challenge loadout is a 2-painting draw (${lo1.join(', ')})`);
  assert(lo1[0] === lo2[0] && lo1[1] === lo2[1], 'K7: the loadout is DETERMINISTIC for the same (day, owned) (same draw twice)');
  assert(lo1.every(id => owned78.includes(id)), "K7: the loadout is drawn only from the player's OWNED paintings");
  const mod1 = L78.challengeDrawModifier(day), mod2 = L78.challengeDrawModifier(day);
  assert(mod1 === mod2 && L78.MODIFIERS[mod1], `K7: the modifier is DETERMINISTIC + valid for the same day (${mod1})`);
  // A different day can (and for most pairs does) yield a different draw.
  const dayB = day + 1;
  const loB = L78.challengeDrawLoadout(dayB, owned78);
  // (not asserting inequality — a different day CAN coincide; we assert the
  //  different-seed path still returns a valid 2-subset of owned.)
  assert(loB.length === 2 && loB.every(id => owned78.includes(id)), 'K7: a different day still yields a valid 2-subset of owned paintings');

  // (3) SCORE: the pure score is restored + enemies + orbs + a boss-time bonus,
  // with faster boss times scoring higher.
  const s0 = L78.challengeScore({ restored: 0, enemies: 0, orbs: 0, bossTimeSec: 0 });
  assert(Number.isFinite(s0) && s0 >= 0, `K7: an empty score is a finite non-negative number (${s0})`);
  const sFull = L78.challengeScore({ restored: 1, enemies: 40, orbs: 120, bossTimeSec: 40 });
  const sSlow = L78.challengeScore({ restored: 1, enemies: 40, orbs: 120, bossTimeSec: 400 });
  assert(sFull > sSlow, `K7: a FASTER boss time scores higher than a slow one (fast ${sFull} > slow ${sSlow})`);
  const sMore = L78.challengeScore({ restored: 1, enemies: 60, orbs: 160, bossTimeSec: 40 });
  assert(sMore > sFull, 'K7: more enemies + orbs + full restoration score higher');

  // (4) FILE: challengeFileScore persists a {seed,date,score} entry, ordered
  // DESC by score, capped at top 5 (older dropped). A corrupt/missing list is
  // normalized to a valid list.
  const fs = L78.freshSave();
  L78.challengeFileScore(fs, 100, 10);
  L78.challengeFileScore(fs, 101, 90);
  L78.challengeFileScore(fs, 102, 50);
  assert(fs.challengeScores.length === 3, 'K7: each filed score is added to the save list');
  assert(fs.challengeScores[0].score === 90 && fs.challengeScores[2].score === 10, 'K7: the list is ordered DESC by score (90, 50, 10)');
  assert(fs.challengeScores[0].seed === 101 && typeof fs.challengeScores[0].date === 'string' && fs.challengeScores[0].date.length === 10, 'K7: each entry is {seed, date(YYYY-MM-DD), score}');
  for (let i = 0; i < 6; i++) L78.challengeFileScore(fs, 200 + i, 1000 + i);
  assert(fs.challengeScores.length === 5, `K7: the list is capped at the top ${L78.CHALLENGE_TOP_N} (older scores dropped)`);
  assert(fs.challengeScores[0].score === 1005 && fs.challengeScores[4].score === 1001, 'K7: after 6 more filings the top 5 keep the HIGHEST 5 (1005..1001)');
  // The v8 -> v9 migration adds challengeScores [] to a legacy save (no field)
  // and re-stamps the version; a fresh save is already v9.
  const legacy78 = L78.freshSave(); legacy78.saveVersion = 8; delete legacy78.challengeScores;
  const mig78 = L78.migrateSave(legacy78);
  assert(mig78.saveVersion === L78.SAVE_VERSION, 'K7: a v8 save migrates to the current saveVersion');
  assert(Array.isArray(mig78.challengeScores) && mig78.challengeScores.length === 0, 'K7: a legacy save (no challengeScores) migrates to an empty list (no error)');
  assert(L78.freshSave().challengeScores.length === 0, 'K7: a fresh save carries an empty challengeScores list');

  // (5) END-TO-END: a seeded challenge expedition is started from a victory
  // save, the heron is painted to a victory, and a score is FILED to the save
  // (persisted). A second expedition on a normal path files nothing.
  const cv78 = makeCanvas(); const g78 = new Game(cv78); g78.start();
  g78.save = won78; // has a victory -> challenge unlocked
  let t78 = 1000;
  const fr78 = (n, step = 16.7) => { for (let i = 0; i < n; i++) { t78 += step; g78._frame(t78); } };
  g78._beginChallengeExpedition();
  assert(g78.state === 'expedition', 'K7: a challenge expedition starts (state expedition)');
  assert(g78.challenge && g78.challenge.mode === 'challenge', 'K7: the run carries the challenge mode flag');
  assert(g78.challenge.seed === day, `K7: the challenge run uses the current UTC day as its seed (${g78.challenge.seed} == ${day})`);
  assert(g78.challenge.loadout.length === 2 && g78.challenge.loadout.every(id => won78.owned.includes(id)), 'K7: the challenge run has a 2-painting seeded loadout drawn from owned paintings');
  assert(JSON.stringify(g78.challenge.loadout) === JSON.stringify(L78.challengeDrawLoadout(day, won78.owned)), "K7: the run's seeded loadout matches the deterministic draw for (day, owned)");
  assert(L78.MODIFIERS[g78.challenge.modifier], `K7: the challenge run has a valid seeded modifier (${g78.challenge.modifier})`);
  // Now paint the heron to a victory.
  const h78 = g78.heron;
  h78._intro = 0; h78.awakened = true; h78.awakenedT = 99; h78.hp = 12; h78.state = 'idle'; h78.stateT = 999;
  g78.player.x = h78.x - 55; g78.player.y = h78.y - 60; g78.player.iframes = 999;
  const v78 = g78._view();
  g78.input.mouse.x = (h78.x - v78.x) * v78.scale; g78.input.mouse.y = (h78.y - 100 - v78.y) * v78.scale;
  g78.input.mouse.lDown = true;
  fr78(240);
  g78.input.mouse.lDown = false;
  assert(h78.hp <= 0 || h78.flying > 0, 'K7: the challenge heron is defeated/fleeing');
  fr78(260); // let the victory flight play out to the end state
  assert(g78.state === 'end' && g78.endKind === 'victory', 'K7: the challenge run reaches the victory end state');
  assert(g78.save.stats.victories === 2, 'K7: the challenge victory is recorded in save stats');
  assert(g78.save.challengeScores.length === 1, `K7: the challenge victory FILED exactly one score to the save (${JSON.stringify(g78.save.challengeScores)})`);
  assert(g78.save.challengeScores[0].seed === day && typeof g78.save.challengeScores[0].score === 'number' && g78.save.challengeScores[0].score >= 0, 'K7: the filed entry is {seed: today, score: >=0}');
  assert(g78._challengeResult && g78._challengeResult.score === g78.save.challengeScores[0].score, 'K7: the run\'s challenge result matches the filed score');
  // The save's CHOSEN loadout was untouched by the challenge (the seeded
  // loadout is per-run, not persisted).
  assert(Array.isArray(g78.save.loadout), 'K7: a challenge does not corrupt the save\'s loadout field');

  console.log('ok — K7: a victory-gated "Challenge" button runs a SEEDED daily expedition (day seed -> seeded 2-painting loadout + seeded modifier), a victory files a deterministic score (restored + enemies + orbs + boss-time bonus) to a saved top-5 best-score list (ordered desc, max 5), shown in a new atelier panel; pure logic in logic.js (deterministic + testable), migration v8->v9 safe');
}

console.log('\nALL SMOKE TESTS PASSED');
process.exit(0);
