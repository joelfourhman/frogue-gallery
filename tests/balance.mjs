// balance.mjs — v1.10 M1: the BALANCE TELEMETRY probe (informational, NOT part
// of the assertion smoke suite). This is the FIRST version that MEASURES the
// game's combat/economy numbers so B1–B4 can retune against a committed
// baseline and show the deltas.
//
// What it prints (a clean table to stdout):
//   1. Per-enemy TIME-TO-KILL for EVERY enemy kind (beetle/mosquito/toad +
//      the Reeds bestiary wisp/serpent/leech) × EVERY pigment (red/blue/green/
//      dry), at BOTH a god-mode DPS baseline AND a "competent human" estimate
//      (the same dpsFrac convention pace.mjs / humance.mjs use, so the numbers
//      are comparable to the pacing probes).
//   2. ZONE PRESSURE: for each of the 4 zones, the total enemy threat budget
//      (count × effective HP, in human-DPS seconds of fighting time) vs the
//      zone's traversal time budget — at upgrade level 0, 1, and 3 (the
//      progression curve: is zone 1 teachable, zone 4 pressure?).
//   3. CHARGED-SPLASH VALUE: charged vs uncharged paint DPS ratio (is charging
//      worth its cooldown?).
//   4. PIGMENT ECONOMY: income per zone (orbs/banked) vs the pigment costs of
//      the 10 paintings + the 3 upgrade tracks — can a first-time player
//      plausibly afford a 2-slot loadout by zone 3–4?
//   5. A short list of FLAGGED IMBALANCES (judgment + the number that's off).
//
// Deterministic: no wall-clock (frames() advances a virtual clock), no
// unseeded Math.random (stubbed with a fixed-seed mulberry32, as wardpace does).
// No runtime files are touched — this only READS logic.js + drives the sim.
//
// Run:   node tests/balance.mjs
'use strict';

// ------------------------------------------------------------------ RNG
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ harness
// (mirrors pace.mjs / humance.mjs / wardpace.mjs: stub window/canvas/local-
// Storage, drive frames on a virtual clock, seed Math.random deterministically)
const windowListeners = {};
const windowStub = { addEventListener(t, fn) { (windowListeners[t] ||= []).push(fn); }, removeEventListener() {} };
function makeCtx(canvas) {
  const target = { canvas, _fns: 0 };
  const grad = { addColorStop() {} };
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad;
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      t._fns++; return () => {};
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
// Deterministic: pin Math.random to a fixed seed (wardpace convention). The
// seeded run-RNG stream is untouched (it uses its own mulberry32 from the seed).
Math.random = mulberry32(20260911);
function frames(n) { for (let i = 0; i < n; i++) { nowMs += 16.7; const cb = rafCb; rafCb = null; cb(nowMs); } }
function frame() { nowMs += 16.7; const cb = rafCb; rafCb = null; cb(nowMs); }

const { Game, ZONES } = await import('../src/game.js');
const L = await import('../src/logic.js');
const { spawnEnemy } = await import('../src/enemies.js');

// ------------------------------------------------------------------ constants
// The "competent human" DPS fraction — the SAME convention pace.mjs uses
// (0.42: range + misses + dodging + pigment management). We reuse it so the
// TTK numbers here line up with the pacing probes' human estimates.
const HUMAN_DPS_FRAC = 0.42;
// Average human movement speed fraction (humance.mjs measures ~40–45%; we use
// the conservative 0.45 for the zone-traversal time budget).
const HUMAN_MOVE_FRAC = 0.45;
const PLAYER_SPEED = 230; // player.js `get speed()` — the frog's max move speed
// Measured economy verdict (populated by SECTION 4, read by the SECTION 5
// flags): cumulative banked bank at each zone boundary + whether a first-timer
// can afford the cheapest 2-painting loadout by zone 3 / zone 4.
let ECON = null;

// Enemy kinds to measure: the 3 base archetypes + the Reeds bestiary trio.
const ENEMY_KINDS = ['beetle', 'mosquito', 'toad', 'wisp', 'serpent', 'leech'];
const PIGMENTS = ['red', 'blue', 'green', 'dry'];

// ------------------------------------------------------------------ setup
const game = new Game(makeCanvas());
game.start();
frames(5);
game.save.flags.intro = true;
game.tuning = L.makeTuning(game.save.upgrades, game.save.loadout, 'normal');
game._beginExpedition();
frames(2);
const W = game.world.w;
const pl = () => game.player;
function keepAlive() { pl().iframes = 99; }
keepAlive();

// Aim helper: point the brush at a world-space target (mouse is screen-space,
// so convert through the current view transform — same as bosspace/humance).
function aimAt(wx, wy) {
  const v = game._view();
  game.input.mouse.x = (wx - v.x) * v.scale;
  game.input.mouse.y = (wy - v.y) * v.scale;
  game.input.update();
}

// ============================================================================
// SECTION 1 — PER-ENEMY TIME-TO-KILL (god-mode DPS baseline + human estimate)
// ============================================================================
// For each (enemy kind × pigment): spawn ONE fresh enemy of that kind at a
// fixed offset from the frog, put the frog in god-mode (invincible, so the
// measurement is pure DPS, not survival), hold LMB continuously while painting
// with that pigment, and record how long until the enemy dies. The enemy is
// parked in place (vx/vy zeroed + position pinned each frame) so it never
// wanders out of brush range — this isolates the DAMAGE model, which is what
// B1 wants to retune.
//
// God-mode TTK = hp / sustained-paint-DPS. Human TTK = god TTK / HUMAN_DPS_FRAC
// (the same analytical multiplier pace.mjs applies to its boss figure).
function ttkFor(kind, pig) {
  // Fresh tuning (level 0, no loadout) so the table reflects the BASE game.
  game.tuning = L.makeTuning({}, [], 'normal');
  game.paint = new (Object.getPrototypeOf(game.paint).constructor)(pl(), game.world, game.tuning, () => {}, game.particles);
  const e = spawnEnemy(kind, pl().x + 40, pl().y, game.tuning);
  e.burrower && (e.phase = 'surface'); // serpent: start surfaced (paintable)
  game.enemies.length = 0;
  game.enemies.push(e);
  pl().pigment = pig;
  pl().iframes = 9999;
  // Park the enemy in front of the brush, within swipe range.
  const px = pl().x, py = pl().y;
  const ex = px + 40, ey = py;
  const t0 = game.runT;
  let guard = 0;
  while (e.hp > 0 && !e.dead && guard < 60 * 60) {
    // pin the enemy in place (no wander, no chase) so it stays in the fan
    e.x = ex; e.y = ey; e.vx = 0; e.vy = 0;
    if (e.burrower) e.phase = 'surface'; // keep the serpent paintable
    aimAt(ex, ey);
    game.input.mouse.lDown = true;
    keepAlive();
    frame();
    guard++;
  }
  const dt = game.runT - t0;
  game.input.mouse.lDown = false;
  game.enemies.length = 0;
  return { ttks: dt, dps: dt > 0 ? e.maxHp / dt : 0 };
}

console.log('================================================================');
console.log(' FROGUE GALLERY — v1.10 M1 BALANCE TELEMETRY (baseline)');
console.log(` world ${W}px · SAVE_VERSION ${L.SAVE_VERSION} · GAME_VERSION ${L.GAME_VERSION}`);
console.log(` human DPS fraction ${HUMAN_DPS_FRAC} (pace.mjs convention)`);
console.log('================================================================');
console.log('\n[1] PER-ENEMY TIME-TO-KILL  (seconds to kill one enemy, continuous paint)');
console.log('    god = invincible bot, perfect aim, full DPS');
console.log('    human = god TTK / ' + HUMAN_DPS_FRAC + ' (range+misses+dodging, pace.mjs convention)\n');
const ttkTable = [];
for (const kind of ENEMY_KINDS) {
  const row = { kind, cells: {} };
  for (const pig of PIGMENTS) {
    const r = ttkFor(kind, pig);
    row.cells[pig] = { god: r.ttks, human: r.ttks / HUMAN_DPS_FRAC, dps: r.dps };
  }
  ttkTable.push(row);
}
{
  const hdr = 'kind'.padEnd(9) + PIGMENTS.map(p => p.padStart(9)).join('');
  console.log(hdr);
  console.log('-'.repeat(hdr.length));
  for (const row of ttkTable) {
    let line = row.kind.padEnd(9);
    for (const pig of PIGMENTS) {
      const c = row.cells[pig];
      line += `${c.god.toFixed(1)}s/${c.human.toFixed(1)}s`.padStart(9);
    }
    console.log(line);
  }
  console.log('\n    (format: godTtk s / humanTtk s per cell)');
}

// ============================================================================
// SECTION 2 — ZONE PRESSURE (threat budget vs traversal budget, levels 0/1/3)
// ============================================================================
// Threat budget = Σ over the zone's mix (base count) + signature elite(s) of
//   (effective HP in human-DPS seconds). Effective HP = base HP × ELITE scale
//   (for elites) divided by the human paint DPS (so it's "seconds of fighting").
// Traversal budget = zone width / (player speed × HUMAN_MOVE_FRAC). The RATIO
//   fightSeconds / travelSeconds tells you whether a zone is teachable (<~0.5),
//   balanced (~0.5–1), or pressure-heavy (>1). We compute it at upgrade level
//   0, 1, and 3 (power upgrade raises DPS → lowers fight seconds).
const ELITE_HP = 1.9; // game.js ELITE.hp
function zonePressure(level) {
  const ups = { capacity: 0, power: level, vitality: 0 };
  const tun = L.makeTuning(ups, [], 'normal');
  // Sustained human paint DPS (swipe rate × damage × power × avg pigment mult).
  // A competent human cycles pigments; we use the AVERAGE dmgMult across the
  // 4 pigments (red 1.6, blue 1.0, green 0.6, dry 0.5 → mean 0.925) as the
  // representative single-target damage per hit.
  const avgMult = (1.6 + 1.0 + 0.6 + 0.5) / 4;
  const swipeRate = 1 / tun.swipeCooldown; // swipes per second
  const godDps = swipeRate * tun.swipeDamage * tun.power * avgMult;
  const humanDps = godDps * HUMAN_DPS_FRAC;
  const rows = [];
  for (let zi = 0; zi < ZONES.length; zi++) {
    const z = ZONES[zi];
    const zNext = ZONES[zi + 1] ? ZONES[zi + 1].x : 1.0;
    const zoneWidth = (zNext - z.x) * W;
    const travelSec = zoneWidth / (PLAYER_SPEED * HUMAN_MOVE_FRAC);
    // Threat: base mix counts + the signature elite(s).
    let threatSec = 0;
    let detail = [];
    for (const [kind, n] of Object.entries(z.mix)) {
      const hp = L.ENEMIES[kind].hp;
      const sec = (n * hp) / humanDps;
      threatSec += sec;
      detail.push(`${kind}×${n}:${sec.toFixed(1)}s`);
    }
    if (z.sig) {
      const hp = L.ENEMIES[z.sig.kind].hp * ELITE_HP * (z.sig.count || 1);
      const sec = hp / humanDps;
      threatSec += sec;
      detail.push(`elite(${z.sig.kind})×${z.sig.count || 1}:${sec.toFixed(1)}s`);
    }
    const ratio = travelSec > 0 ? threatSec / travelSec : 0;
    rows.push({ zone: z.name, travelSec, threatSec, ratio, detail });
  }
  return { humanDps, rows };
}

console.log('\n[2] ZONE PRESSURE  (fight time vs traversal time, by upgrade level)');
console.log('    fight = Σ(zone mix + signature elite HP)/human-DPS · travel = zone width/(speed×0.45)');
console.log('    ratio = fight/travel  (zone 1 = the teaching zone, zone 4 = the finale)');
console.log('    healthy curve: zone 1 is the LIGHTEST, escalating to zone 4 (monotonic)\n');
for (const level of [0, 1, 3]) {
  const { humanDps, rows } = zonePressure(level);
  console.log(`  upgrade level ${level}  (human paint DPS ≈ ${humanDps.toFixed(1)} hp/s)`);
  const hdr = 'zone'.padEnd(18) + 'travel'.padStart(8) + 'fight'.padStart(8) + 'ratio'.padStart(8) + '  vs zone 1';
  console.log('  ' + hdr);
  const z1r = rows[0].ratio;
  for (const r of rows) {
    const rel = z1r > 0 ? (r.ratio / z1r) : 0;
    const tag = r === rows[0] ? 'baseline' : (rel >= 1.05 ? `+${((rel - 1) * 100).toFixed(0)}%` : rel <= 0.95 ? `-${((1 - rel) * 100).toFixed(0)}%` : '≈z1');
    console.log('  ' + r.zone.padEnd(18) + r.travelSec.toFixed(1).padStart(8) + r.threatSec.toFixed(1).padStart(8) + r.ratio.toFixed(2).padStart(8) + '  ' + tag);
  }
  // curve check: is the pressure monotone non-decreasing (ease-in → finale)?
  const ratios = rows.map(r => r.ratio);
  const nonMono = ratios.findIndex((v, i) => i > 0 && v < ratios[i - 1] - 0.05);
  console.log('  curve: ' + (nonMono < 0
    ? 'zone 1 → zone 4 monotonically heavier ✓'
    : `zone ${nonMono + 1} (${rows[nonMono].zone}, ${ratios[nonMono].toFixed(2)}) is lighter than zone ${nonMono} (${rows[nonMono - 1].zone}, ${ratios[nonMono - 1].toFixed(2)}) — a breather (intended? the zone-2 dip is)`));
  console.log('');
}

// ============================================================================
// SECTION 3 — CHARGED-SPLASH VALUE (charged vs uncharged paint DPS)
// ============================================================================
// Uncharged = the swipe verb (rate-limited to swipeCooldown, single-target
// fan). Charged = the splash verb (hold-to-charge splashCharge, then a radial
// AoE burst every splashCooldown). We compare the SUSTAINED DPS each verb can
// deliver: swipe DPS = swipeRate × swipeDamage × power; splash DPS =
// (burst per cycle) / (charge + cooldown). Charging is "worth it" when the
// splash's per-second damage (especially vs groups, via radius) beats the
// swipe's single-target DPS.
{
  const tun = L.makeTuning({}, [], 'normal');
  const avgMult = (1.6 + 1.0 + 0.6 + 0.5) / 4;
  const swipeDps = (1 / tun.swipeCooldown) * tun.swipeDamage * tun.power * avgMult;
  // One charged splash hits everything in splashRadius. Vs a SINGLE target it
  // deals splashDamage once per (charge+cooldown) cycle; vs a GROUP it scales
  // with how many enemies fit in the radius. We report both the single-target
  // DPS and the "group" DPS assuming N targets in the radius.
  const splashCycle = tun.splashCharge + tun.splashCooldown;
  const splashSingleDps = (tun.splashDamage * tun.power * avgMult) / splashCycle;
  // How many enemy radii fit in the splash radius (rough group factor).
  const groupFactor = Math.max(1, Math.floor((tun.splashRadius / 16) ** 2 / 4)); // rough packing
  const splashGroupDps = splashSingleDps * groupFactor;
  const ratio = swipeDps > 0 ? splashSingleDps / swipeDps : 0;
  console.log('[3] CHARGED-SPLASH VALUE');
  console.log(`    swipe (uncharged) sustained DPS        : ${swipeDps.toFixed(1)} hp/s`);
  console.log(`    splash (charged) single-target DPS     : ${splashSingleDps.toFixed(1)} hp/s  (cycle ${splashCycle.toFixed(2)}s = charge ${tun.splashCharge}s + cd ${tun.splashCooldown}s)`);
  console.log(`    splash (charged) group DPS (~${groupFactor} targets in radius ${tun.splashRadius}): ${splashGroupDps.toFixed(1)} hp/s`);
  console.log(`    charged-vs-uncharged single-target ratio: ${ratio.toFixed(2)}×  (${ratio >= 1 ? 'charging wins even solo' : 'charging only pays off vs groups'})`);
  console.log('');
}

// ============================================================================
// SECTION 4 — PIGMENT ECONOMY (income vs cost of paintings + upgrades)
// ============================================================================
// Income: MEASURE the actual orb income of a full first-time run by driving a
// god-mode traversal (same rig as humance.mjs) and reading game.collected at
// each zone boundary + on finishing. That is the raw per-run orb income; the
// banked value a first-timer actually keeps is bankGain(collected) on a clean
// victory (deathKeepFraction only applies on a defeat). Cost: the 10 pigment
// paintings + the 3 upgrade tracks. Question: can a first-timer plausibly
// afford a 2-slot loadout by zone 3–4?
{
  const welcome = L.WELCOME_GRANT;
  console.log('[4] PIGMENT ECONOMY  (first-time player, measured orb income by zone)');
  console.log('    running a god-mode full traversal and reading collected orbs at each zone...\n');
  // ---- drive a full first-time run, sampling collected[] at zone boundaries ----
  const game = new Game(makeCanvas());
  game.start(); frames(2);
  game.save.flags.intro = true;
  game._beginExpedition(); frames(2);
  const pl = game.player; pl.iframes = 999;
  const W = game.world.w;
  const HX = game.heron.x;
  const zoneOrbs = [];                       // cumulative collected at each zone boundary
  for (const z of ZONES) zoneOrbs.push({ x: z.x * W, taken: false });
  const snapshot = () => ({ red: game.collected.red, blue: game.collected.blue, green: game.collected.green });
  let zi = 0; let crossed = 0;
  while (pl.x < HX - 20 && crossed < 60 * 2000) {
    game.input.keys.clear(); game.input.keys.add('d');
    game.input.mouse.x = 640; game.input.mouse.y = 400; game.input.update();
    pl.iframes = 999;
    frame(); crossed++;
    if (zi < ZONES.length && pl.x >= zoneOrbs[zi].x && !zoneOrbs[zi].taken) {
      zoneOrbs[zi].taken = true; zoneOrbs[zi].collected = snapshot(); zi++;
    }
  }
  const runIncome = snapshot();   // raw orbs collected over the WHOLE run (victory path)
  // Banked: what a clean victory keeps (bankGain on a victory — deathKeep = 1.0).
  const banked = L.bankGain(runIncome, { died: false, victory: true, tuning: game.tuning });
  // Per-pigment cumulative banked bank at each zone boundary: bankGain on the
  // collected[] sampled AT that boundary (collected only grows, so the snapshot
  // is already the cumulative-to-here income), plus the first-run welcome grant.
  const zoneBank = zoneOrbs.map((z) => {
    const c = z.collected || { red: 0, blue: 0, green: 0 };
    // cumulative collected up to this boundary: the sampled value at the boundary
    // already IS cumulative (collected only grows), so use it directly.
    const g = L.bankGain(c, { died: false, victory: true, tuning: game.tuning });
    return { red: welcome.red + g.red, blue: welcome.blue + g.blue, green: welcome.green + g.green };
  });
  console.log(`    run orb income (raw collected, full run): red ${runIncome.red} · blue ${runIncome.blue} · green ${runIncome.green}`);
  console.log(`    banked on a clean victory:               red ${banked.red} · blue ${banked.blue} · green ${banked.green}`);
  console.log(`    (welcome grant: red ${welcome.red} · blue ${welcome.blue} · green ${welcome.green})\n`);
  const upgradeCosts = {};
  for (const [id, u] of Object.entries(L.UPGRADES)) upgradeCosts[id] = u.levels.map(lv => lv.cost);
  // Cumulative banked pigment available at each zone boundary (measured).
  console.log('    cumulative banked pigment by zone boundary (welcome + collected-to-here):');
  for (let i = 0; i < ZONES.length; i++) {
    const b = zoneBank[i];
    console.log(`      zone ${i+1} (${ZONES[i].name}): red ${b.red} · blue ${b.blue} · green ${b.green}`);
  }
  // Can they afford a 2-slot loadout (2 paintings) by zone 3 / zone 4?
  const affordable = (bank, need) => need.every(c => bank[c.color] >= c.amount);
  const paintList = L.PAINTINGS.filter(p => p.cost && !p.goldTier).map(p => [p.id, p.cost]);
  const combos = [];
  for (let i = 0; i < paintList.length; i++)
    for (let j = i + 1; j < paintList.length; j++) {
      const [a, ca] = paintList[i], [b, cb] = paintList[j];
      const merged = { red: (ca.red||0)+(cb.red||0), blue: (ca.blue||0)+(cb.blue||0), green: (ca.green||0)+(cb.green||0) };
      combos.push({ a, b, merged });
    }
  combos.sort((x, y) => (x.merged.red+x.merged.blue+x.merged.green) - (y.merged.red+y.merged.blue+y.merged.green));
  const cheapest2 = combos[0];
  const need = (m) => [{color:'red',amount:m.red||0},{color:'blue',amount:m.blue||0},{color:'green',amount:m.green||0}];
  console.log(`\n    cheapest 2-painting loadout: ${cheapest2.a} + ${cheapest2.b} = red ${cheapest2.merged.red||0}/blue ${cheapest2.merged.blue||0}/green ${cheapest2.merged.green||0}`);
  console.log('\n    upgrade track costs (per level):');
  for (const [id, levels] of Object.entries(upgradeCosts)) {
    const l = levels.map(c => `r${c.red||0}/b${c.blue||0}/g${c.green||0}`).join(' ');
    console.log(`      ${id.padEnd(10)}: ${l}`);
  }
  const byZ3 = affordable(zoneBank[2], need(cheapest2.merged));
  const byZ4 = affordable(zoneBank[3], need(cheapest2.merged));
  // Publish for the SECTION 5 flags (module scope).
  ECON = { byZ3, byZ4, bank4: zoneBank[3], cheapest: cheapest2.merged, cheapestNames: `${cheapest2.a}+${cheapest2.b}`, note: 'a straight-line god-mode sweep under-collects orbs vs a human who dawdles/detours — treat as a LOWER bound on income' };
  console.log(`\n    VERDICT: cheapest 2-slot loadout affordable by zone 3? ${byZ3 ? 'YES' : 'NO'} · by zone 4? ${byZ4 ? 'YES' : 'NO'}`);
  console.log('');
}

// ============================================================================
// SECTION 5 — FLAGGED IMBALANCES (judgment + the number that's off)
// ============================================================================
console.log('[5] FLAGGED IMBALANCES  (M1 judgment — B1–B4 fix these)');
const flags = [];
// (a) TTK spread within the base archetypes: is any enemy a tank-filler?
{
  const beetleRed = ttkTable.find(r => r.kind === 'beetle').cells.red.god;
  const toadRed = ttkTable.find(r => r.kind === 'toad').cells.red.god;
  const mosqRed = ttkTable.find(r => r.kind === 'mosquito').cells.red.god;
  const max = Math.max(beetleRed, toadRed, mosqRed);
  const min = Math.min(beetleRed, toadRed, mosqRed);
  if (max > 0 && max / min > 2.5) {
    const slow = beetleRed === max ? 'beetle' : toadRed === max ? 'toad' : 'mosquito';
    const fast = beetleRed === min ? 'beetle' : toadRed === min ? 'toad' : 'mosquito';
    flags.push(`TTK spread: ${slow} ${max.toFixed(1)}s vs ${fast} ${min.toFixed(1)}s (×${(max/min).toFixed(1)}) — ${slow} is tank-filler, not a distinct fight`);
  }
}
// (b) Zone pressure curve. Intended shape: zone 1 = the lightest teaching
// zone, zone 2 = a deliberate breather (≈ zone 1 or a touch lighter), then a
// clean escalation to the zone 4 finale. So we flag: (i) a LATE zone (3 or 4)
// lighter than zone 1 (the teaching zone isn't the baseline), (ii) zone 4 not
// being the heaviest (the finale isn't the peak), (iii) an over-heavy finale.
{
  const { rows } = zonePressure(0);
  const z1 = rows[0].ratio, z3 = rows[2].ratio, z4 = rows[3].ratio;
  const ratios = rows.map(r => r.ratio);
  if (z3 < z1 - 0.05 || z4 < z1 - 0.05) {
    const late = z3 < z4 ? 2 : 3; // index of the lighter late zone
    flags.push(`zone ${late + 1} (${rows[late].zone}, ratio ${ratios[late].toFixed(2)}) is lighter than the teaching zone 1 (${z1.toFixed(2)}) — zone 1 is not the baseline of the escalation`);
  }
  const heaviest = ratios.indexOf(Math.max(...ratios));
  if (heaviest !== 3) flags.push(`zone 4 (${rows[3].zone}, ratio ${z4.toFixed(2)}) is not the heaviest zone — zone ${heaviest + 1} (${rows[heaviest].zone}, ${ratios[heaviest].toFixed(2)}) out-pressure it; the finale should be the peak`);
  if (z4 / z1 > 2.0) flags.push(`zone 4 (${rows[3].zone}) finale ratio ${z4.toFixed(2)} is ${(z4 / z1).toFixed(1)}× zone 1's ${z1.toFixed(2)} — a big jump at the end (verify the finale is intentional)`);
}
// (c) Charged splash: is it dead weight (single-target ratio << 1 and group small)?
{
  const tun = L.makeTuning({}, [], 'normal');
  const avgMult = (1.6 + 1.0 + 0.6 + 0.5) / 4;
  const swipeDps = (1 / tun.swipeCooldown) * tun.swipeDamage * tun.power * avgMult;
  const splashSingleDps = (tun.splashDamage * tun.power * avgMult) / (tun.splashCharge + tun.splashCooldown);
  const ratio = splashSingleDps / swipeDps;
  if (ratio < 0.6) flags.push(`charged splash single-target DPS ${splashSingleDps.toFixed(1)} is only ${ratio.toFixed(2)}× the swipe's ${swipeDps.toFixed(1)} — charging rarely pays off vs a single target`);
}
// (d) Economy: can't afford a loadout by zone 3 / 4 (measured income in SECTION 4)?
{
  const bank = ECON.bank4, c = ECON.cheapest;
  const z3Short = !ECON.byZ3, z4Short = !ECON.byZ4;
  const fmt = (o) => `r${o.red}/b${o.blue}/g${o.green}`;
  const parts = [];
  if (z3Short) parts.push(`by zone 3`);
  if (z4Short) parts.push(`by zone 4`);
  if (parts.length) {
    flags.push(`economy: a first-timer can't afford the cheapest 2-painting loadout (${ECON.cheapestNames}, ${fmt(c)}) ${parts.join(' or ')} — the bank by zone 4 is only ${fmt(bank)} (measured orb income is a lower bound; a real player collects more, but the margin is thin)`);
  }
}
if (flags.length === 0) console.log('    (none flagged — the baseline looks balanced)');
else for (const f of flags) console.log(`    • ${f}`);
console.log('\n================================================================');
console.log(' end of balance telemetry — re-run after B1–B4 to show the deltas');
console.log('================================================================');
