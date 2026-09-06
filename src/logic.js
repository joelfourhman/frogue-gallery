// logic.js — PURE game rules. No DOM, no canvas: importable by Node tests.
// All tuning lives here so balance passes are one-file edits.
'use strict';

// ---------------------------------------------------------------- pigments
export const PIGMENTS = {
  red:   { id: 'red',   name: 'Crimson', color: '#c8452c', light: '#e8836b', dmgMult: 1.3,  status: 'burn'  },
  blue:  { id: 'blue',  name: 'Cobalt',  color: '#3a6fd8', light: '#8fb0f0', dmgMult: 1.0,  status: 'slow'  },
  green: { id: 'green', name: 'Moss',    color: '#5a9e3d', light: '#9ed483', dmgMult: 0.9,  status: 'root'  },
  dry:   { id: 'dry',   name: 'Dry Brush', color: '#9a8f80', light: '#c9c0b2', dmgMult: 0.5, status: null   },
};
export const PIGMENT_ORDER = ['red', 'blue', 'green', 'dry'];

// ---------------------------------------------------------------- enemies
export const ENEMIES = {
  beetle: {
    id: 'beetle', name: 'Mud Beetle', hp: 36, speed: 40, dmg: 6, radius: 16,
    armor: 0.35,          // fraction of physical damage blocked (burn ignores it)
    burnArmor: false,     // burns fully pierce armor
    fly: false, score: 20, paintTintDecay: 0.25,
  },
  mosquito: {
    id: 'mosquito', name: 'Mosquito', hp: 14, speed: 150, dmg: 5, radius: 10,
    armor: 0, fly: true, score: 10, paintTintDecay: 0.4,
  },
  toad: {
    id: 'toad', name: 'Grumpy Toad', hp: 52, speed: 58, dmg: 6, radius: 19,
    armor: 0.08, score: 30, paintTintDecay: 0.2,
    dizzyPaintChance: 0.22,  // chance a paint hit stuns the toad (sits, +50% dmg)
    dizzyDuration: 2.2,
  },
};

// ---------------------------------------------------------------- statuses
// Status applied when a paint hit lands. Returns { status, note }.
export function paintStatusFor(pigmentId, enemy, now) {
  if (pigmentId === 'dry') return { status: null, note: null };
  if (pigmentId === 'red') {
    return { status: { type: 'burn', t: 2.6, appliedAt: now }, note: 'burning' };
  }
  if (pigmentId === 'blue') {
    const prev = enemy.status;
    if (prev && prev.type === 'slow' && (now - prev.appliedAt) <= 1.0) {
      return { status: { type: 'freeze', t: 1.3, appliedAt: now }, note: 'frozen' };
    }
    const t = enemy.fly ? 1.0 : 1.6; // aerials are nimbler
    return { status: { type: 'slow', t, appliedAt: now }, note: 'slowed' };
  }
  // green
  if (enemy.fly) return { status: null, note: 'immune-root' }; // flies ignore root
  return { status: { type: 'root', t: 1.6, appliedAt: now }, note: 'rooted' };
}

// Step active status timers; returns events: { burnTick: dmg } etc.
export function stepStatus(enemy, dt, tuning, now) {
  const ev = { tick: 0, expired: null };
  if (!enemy.status) return ev;
  const s = enemy.status;
  s.t -= dt;
  if (s.type === 'burn') {
    enemy.burnAccum = (enemy.burnAccum || 0) + tuning.burnDps * dt;
    if (enemy.burnAccum >= 1) {
      const whole = Math.floor(enemy.burnAccum);
      enemy.burnAccum -= whole;
      ev.tick = whole;
      enemy.hp -= whole;
    }
  }
  if (s.t <= 0) {
    ev.expired = s.type;
    enemy.status = null;
    enemy.burnAccum = 0;
  }
  return ev;
}

// Physical (tooth/chomp) damage vs armor.
export function physicalDamage(base, enemy, tuning, dmgReduce) {
  const armor = enemy.armor || 0;
  let d = base * (1 - armor) * (1 - (dmgReduce || 0));
  return Math.max(1, Math.round(d));
}

// Paint damage: base * pigment * power * painting bonus * status bonus, armor applied
// unless the pigment ignores it (burn/DoT bypass; direct paint partially bypasses).
export function paintDamage(base, pigmentId, tuning, opts = {}) {
  const p = PIGMENTS[pigmentId] || PIGMENTS.dry;
  const enemy = opts.enemy || {};
  let d = base * p.dmgMult * (tuning.power || 1) * (opts.paintingMult || 1);
  // status amplifiers
  if (opts.statusBonus) d *= opts.statusBonus;
  // armor: paint gets 50% through armor; dry brush is physical
  const armor = (pigmentId === 'dry') ? (enemy.armor || 0) : (enemy.armor || 0) * 0.5;
  d *= (1 - armor) * (1 - (opts.dmgReduce || 0));
  if (enemy.status && enemy.status.type === 'dizzy') d *= 1.5;
  return Math.max(1, Math.round(d));
}

// ---------------------------------------------------------------- tuning
export function makeTuning(upgrades = {}, loadout = []) {
  const t = {
    // player
    maxHp: 10 + (upgrades.vitality || 0),
    power: 1 + 0.15 * (upgrades.power || 0),
    capacity: 6 + 3 * (upgrades.capacity || 0),
    iframes: 0.9,
    hopIframes: 0.18,
    // PT3 (M7.5) fly/dodge fairness: the Space-hop is the frog's only air-dodge.
    // It previously had NO cooldown and i-frames (0.30s) exceeded the 0.22s hop,
    // so mashing Space = near-continuous invulnerability. hopCooldown is the
    // "stamina" cost: a gap after each hop before you may hop again.
    hopCooldown: 0.7,
    // paint
    swipeDamage: 7,
    swipeRange: 74,
    swipeArc: 1.25,          // radians of fan
    swipeCooldown: 0.2,
    splashDamage: 5,
    splashRadius: 58,
    splashCharge: 0.55,
    splashCooldown: 1.5,
    paintResidualDps: 2,     // standing in fresh paint
    // statuses
    burnDps: 4,
    freezeDuration: 1.3,
    slowFactor: 0.45,
    rootDuration: 1.6,
    // P4: green mends 3 HP per paint — meaningful early, still slow to
    // refill a full pool (keeps the heron fight from being a free medkit).
    greenHeal: 3,
    // economy
    pickupValue: 1,
    pickupMagnet: 70,
    deathKeepFraction: 0.5,
    victoryBonus: 2,         // per pigment color
    // boss
    bossMaxHp: 30000,  // P5: ≈ 2.5–3 min human fight (bot ceiling ~773 DPS → ~39s; human ~40% → ~150s)
    bossAwakenNeed: { red: 45, blue: 45, green: 45 },
    bossAwakenDuration: 6,
    bossPaintHit: 6,         // hue per paint hit
    // damage taken
    contactCooldown: 0.7,
  };
  const has = (id) => loadout.includes(id);
  if (has('moonlit-pond')) { t.freezeDuration *= 1.4; t.slowFactor *= 0.75; t.bossAwakenNeed.blue *= 0.7; }
  if (has('dancing-salamander')) { t.burnDps *= 1.5; t.swipeDamage *= 1.1; t.bossAwakenNeed.red *= 0.7; }
  if (has('spring-garden')) { t.greenHeal += 1; t.bossAwakenNeed.green *= 0.7; }
  if (has('self-portrait')) { t.maxHp += 1; t.iframes *= 1.4; t.hopIframes *= 1.5; }
  if (has('king-frog')) { t.pickupValue *= 1.3; }
  if (has('storm-cloud')) { t.splashRadius *= 1.35; t.splashDamage *= 1.15; }
  if (has('beetle-armor')) { t.dmgReduce = 0.1; }
  if (has('croaksworth')) { t.power *= 1.18; }
  return t;
}

// ---------------------------------------------------------------- upgrades
export const UPGRADES = {
  capacity: {
    name: 'Pigment Satchel', desc: 'Carry more pigment on expeditions.',
    levels: [ { cost: { red: 3, blue: 3, green: 3 } },
              { cost: { red: 5, blue: 5, green: 5 } },
              { cost: { red: 8, blue: 8, green: 8 } } ],
  },
  power: {
    name: 'Brush Craft', desc: 'Your strokes hit harder.',
    levels: [ { cost: { red: 4, blue: 2, green: 2 } },
              { cost: { red: 7, blue: 4, green: 4 } },
              { cost: { red: 10, blue: 7, green: 7 } } ],
  },
  vitality: {
    name: 'Swamp Vitality', desc: 'One more lily pad of health.',
    levels: [ { cost: { red: 2, blue: 5, green: 3 } },
              { cost: { red: 4, blue: 8, green: 6 } },
              { cost: { red: 6, blue: 12, green: 10 } } ],
  },
};

// ---------------------------------------------------------------- paintings
export const PAINTINGS = [
  { id: 'moonlit-pond', name: 'Moonlit Pond', cost: { red: 2, blue: 5, green: 2 },
    desc: 'Blue lingers longer; freezes bite deeper.',
    art: { bg: '#22335e', shape: 'pond', accent: '#cfd8ff' } },
  { id: 'dancing-salamander', name: 'Dancing Salamander', cost: { red: 6, blue: 1, green: 2 },
    desc: 'Burns smolder longer; strokes ignite easier.',
    art: { bg: '#5e2222', shape: 'salamander', accent: '#ffb08a' } },
  { id: 'spring-garden', name: 'Spring Garden', cost: { red: 2, blue: 2, green: 6 },
    desc: 'Moss restores an extra point of health per hit.',
    art: { bg: '#2f5e2a', shape: 'garden', accent: '#d7f0c8' } },
  { id: 'self-portrait', name: 'Self Portrait', cost: { red: 3, blue: 3, green: 4 },
    desc: '+1 max health; your invulnerability lingers.',
    art: { bg: '#5e5222', shape: 'portrait', accent: '#9ed483' } },
  { id: 'king-frog', name: 'King Frog', cost: { red: 4, blue: 4, green: 4 },
    desc: 'Royalty collects more from every drop.',
    art: { bg: '#4a3d6b', shape: 'king', accent: '#ffd75e' } },
  { id: 'storm-cloud', name: 'Storm Cloud', cost: { red: 5, blue: 6, green: 1 },
    desc: 'Charged splashes burst far wider.',
    art: { bg: '#2c3a4a', shape: 'storm', accent: '#bcd7ff' } },
  { id: 'beetle-armor', name: 'Beetle\'s Armor', cost: { red: 6, blue: 3, green: 5 },
    desc: 'Borrowed chitin. -10% damage taken.',
    art: { bg: '#3a3a33', shape: 'armor', accent: '#b8a06a' } },
  { id: 'croaksworth', name: 'Sir Croaksworth (Portrait)', cost: { red: 5, blue: 5, green: 5 },
    desc: 'He finally admits art is useful. +18% brush damage.',
    art: { bg: '#33303f', shape: 'knight', accent: '#c8b8ff' }, locked: true },
];

export function canAfford(bank, cost) {
  return cost.every(c => (bank[c.color] || 0) >= c.amount);
}
export function payCost(bank, cost) {
  const b = { ...bank };
  cost.forEach(c => { b[c.color] -= c.amount; });
  return b;
}
// Flatten {red,blue,green} cost into [{color,amount}]
export function costArray(costObj) {
  return Object.keys(costObj).map(k => ({ color: k, amount: costObj[k] })).filter(c => c.amount > 0);
}

// ---------------------------------------------------------------- early-economy safety net (PT4, M7.5)
// A brand-new player's very first run can end with almost nothing banked
// (orbs + enemy drops * deathKeepFraction, floored), leaving them unable to
// afford ANY upgrade or painting — a soft-lock of the progression. So the
// first expedition is granted a one-time welcome amount of each pigment:
// enough to buy the cheapest single-level upgrade (Swamp Vitality,
// {red:2, blue:5, green:3}) plus a little cushion. Deterministic + pure.
export const WELCOME_GRANT = { red: 3, blue: 6, green: 4 };
export function applyWelcomeGrant(save) {
  if (!save || !save.flags || save.flags.welcomeGranted) return save;
  save.flags.welcomeGranted = true;
  for (const k of ['red', 'blue', 'green']) save.bank[k] += WELCOME_GRANT[k];
  return save;
}

// ---------------------------------------------------------------- economy
// Pigments collected during a run -> bank gain on return.
export function bankGain(collected, { died, victory, tuning }) {
  const frac = died ? tuning.deathKeepFraction : 1;
  const gain = {};
  let bonus = victory ? tuning.victoryBonus : 0;
  for (const k of ['red', 'blue', 'green']) {
    let v = Math.floor((collected[k] || 0) * frac);
    if (victory) v += bonus;
    gain[k] = v;
  }
  return gain;
}

// ---------------------------------------------------------------- boss AI
// Pure step function for the Great Gray Heron.
// heron: { hp, maxHp, phase, state, stateT, x, y, hue, awakened, summonT, lungeDir, targetX, jumpSpots }
// Returns list of events: 'slam', 'summon', 'sweep', 'lunge', 'awaken', 'defeated'
export function bossStep(h, dt, view, tuning, now) {
  const ev = [];
  if (h.hp <= 0) { ev.push('defeated'); return ev; }
  // Awakened (vulnerable): slowed, no attacks, takes 2x paint damage.
  if (h.awakened) {
    h.awakenedT = (h.awakenedT || 0) - dt;
    if (h.awakenedT <= 0) {
      h.awakened = false;
      h.hue = { red: h.hue.red * 0.5, blue: h.hue.blue * 0.5, green: h.hue.green * 0.5 };
      h.state = 'recover'; h.stateT = 1.2;
    }
    return ev;
  }
  h.stateT -= dt;

  const hpFrac = h.hp / h.maxHp;
  if (hpFrac <= 0.33 && h.phase < 3) { h.phase = 3; ev.push('phase3'); h.state = 'leap'; h.stateT = 0.8; }
  else if (hpFrac <= 0.66 && h.phase < 2) { h.phase = 2; ev.push('phase2'); h.state = 'flap'; h.stateT = 0.9; }

  const speed = h.phase === 3 ? 1.4 : h.phase === 2 ? 1.15 : 1.0;
  const px = view.playerX;

  switch (h.state) {
    case 'idle': {
      // drift toward the player, circling a bit
      h.x += Math.sign(px - h.x) * 26 * speed * dt;
      h.x = Math.min(view.right, Math.max(view.left, h.x));
      if (h.stateT <= 0) {
        const roll = Math.random();
        if (roll < 0.34) { h.state = 'telegraph-scoop'; h.stateT = 0.75 / speed; h.scoopX = px; }
        else if (roll < 0.62) { h.state = 'telegraph-sweep'; h.stateT = 0.8 / speed; }
        else if (roll < 0.85) { h.state = 'telegraph-dive'; h.stateT = 0.9 / speed; h.targetX = px; }
        else { h.state = 'telegraph-storm'; h.stateT = 1.0 / speed; h.lungeDir = Math.sign(px - h.x) || 1; }
      }
      break;
    }
    case 'flap': case 'recover':
      if (h.stateT <= 0) { h.state = 'idle'; h.stateT = 1.6 / speed; }
      break;
    case 'telegraph-scoop':
      if (h.stateT <= 0) { h.state = 'scoop'; h.stateT = 0.3; h.scoopFrom = h.x; }
      break;
    case 'scoop': {
      h.x += (h.scoopX - h.scoopFrom) * (dt / 0.3);
      h.x = Math.min(view.right, Math.max(view.left, h.x));
      if (h.stateT <= 0) { h.state = 'idle'; h.stateT = 1.4 / speed; }
      break;
    }
    case 'telegraph-sweep':
      if (h.stateT <= 0) { h.state = 'sweep'; h.stateT = 0.45; ev.push('sweep'); h.sweepSide = Math.random() < 0.5 ? -1 : 1; }
      break;
    case 'sweep':
      if (h.stateT <= 0) { h.state = 'idle'; h.stateT = 1.3 / speed; }
      break;
    case 'telegraph-dive':
      h.diveH = 0;
      if (h.stateT <= 0) {
        h.state = 'dive'; h.stateT = 0.5; h.targetX = Math.min(view.right, Math.max(view.left, px));
        // re-aim once at dive start
      }
      break;
    case 'dive': {
      h.diveH = Math.sin(Math.PI * (1 - h.stateT / 0.5)) * 170;
      h.x += (h.targetX - h.x) * (dt / 0.5);
      if (h.stateT <= 0) {
        h.state = 'slam'; h.stateT = 0.35; h.diveH = 0;
        ev.push('slam');
      }
      break;
    }
    case 'slam':
      if (h.stateT <= 0) { h.state = 'idle'; h.stateT = 1.5 / speed; }
      break;
    case 'telegraph-storm':
      if (h.stateT <= 0) {
        h.state = 'storm-lunge'; h.stateT = 0.55;
        h.lungeFrom = h.x;
        h.lungeTo = h.lungeDir > 0 ? view.right - 60 : view.left + 60;
        ev.push('lunge-start');
      }
      break;
    case 'storm-lunge':
      h.x = h.lungeFrom + (h.lungeTo - h.lungeFrom) * ((0.55 - h.stateT) / 0.55);
      if (h.stateT <= 0) { h.state = 'idle'; h.stateT = 1.1 / speed; }
      break;
    case 'leap': { // phase-3 splash jump with telegraphed landing spots
      if (!h.spots) {
        h.spots = [];
        for (let i = 0; i < 3; i++) {
          h.spots.push(view.left + 90 + Math.random() * (view.right - view.left - 180));
        }
        h.spotIdx = 0;
      }
      if (h.stateT <= 0) {
        const from = h.x;
        const to = h.spots[h.spotIdx % h.spots.length];
        h.leap = { from, to, t: 0, dur: 0.5 };
        h.spotIdx++;
        h.state = 'airborne'; h.stateT = 0.5;
      }
      break;
    }
    case 'airborne': {
      h.leap.t += dt / h.leap.dur;
      const k = Math.min(1, h.leap.t);
      h.x = h.leap.from + (h.leap.to - h.leap.from) * k;
      h.diveH = Math.sin(Math.PI * k) * 200;
      if (k >= 1) { h.state = 'idle'; h.stateT = 1.0 / speed; h.diveH = 0; ev.push('landing'); }
      break;
    }
  }
  // Summons in phase 2+
  if (h.phase >= 2 && !h.awakened) {
    h.summonT = (h.summonT || 0) - dt;
    if (h.summonT <= 0) {
      h.summonT = 9;
      ev.push('summon');
    }
  }
  return ev;
}

// Apply paint to boss: accumulates hue; awakens when all thresholds met.
export function paintBoss(h, pigmentId, amount, tuning) {
  if (!PIGMENTS[pigmentId] || pigmentId === 'dry') return 0;
  h.hue[pigmentId] = Math.min(99, (h.hue[pigmentId] || 0) + amount);
  const need = tuning.bossAwakenNeed;
  if (!h.awakened && h.hue.red >= need.red && h.hue.blue >= need.blue && h.hue.green >= need.green) {
    h.awakened = true;
    h.awakenedT = tuning.bossAwakenDuration;
    return 'awaken';
  }
  return 0;
}

// ---------------------------------------------------------------- save
export const SAVE_KEY = 'frogue_gallery_save';
export const OPTIONS_KEY = 'frogue_gallery_options';

// B6: save schema versioning. `saveVersion` is the authoritative current schema
// version, written into every save and read back on load. Legacy saves stored
// it under the field `v`; migrateSave() accepts both and re-stamps to the
// current version.
export const SAVE_VERSION = 1;

// Ordered schema-migration chain. Each entry upgrades a save from `from` to
// `to` by remapping an already-normalized save. The loader walks entries in
// `from` order, so a save written at any older version migrates forward step
// by step up to SAVE_VERSION. v1 is the initial version, so the chain starts
// empty — append `{ from: 1, to: 2, fn }` (and bump SAVE_VERSION) when the
// next schema lands.
const SAVE_MIGRATIONS = [];

export function freshSave() {
  return {
    saveVersion: SAVE_VERSION,
    bank: { red: 0, blue: 0, green: 0 },
    owned: [],            // painting ids
    loadout: [],          // up to 2 painting ids
    upgrades: { capacity: 0, power: 0, vitality: 0 },
    flags: { intro: false, firstOrb: false, firstHurt: false, firstAtelier: false, firstDefeat: false, croaksworthAsked: false, croaksworthGiven: false, heronDefeated: false, welcomeGranted: false },
    stats: { expeditions: 0, victories: 0, deaths: 0, heronsPainted: 0, treasures: 0 },
    bestRun: null,        // {pigments, time, cleared}
  };
}

// B2: corrupt-save handling. migrateSave never throws and always returns a
// schema-complete save. The non-enumerable `_case` property documents which
// outcome applied (non-enumerable so it is never persisted by JSON.stringify):
//   'migrated' — parsed object with recognizable save fields; those fields are
//                merged into a fresh schema (keep what we can)
//   'fresh'    — parsed but no recognizable fields, or non-object JSON
//                (string/number/array/null); fresh save, nothing preserved
// (The unparseable-JSON and missing-key cases are handled one level up in
// SaveSys.load(), which returns null so the caller starts a fresh game.)
const SAVE_FIELDS = ['bank', 'owned', 'loadout', 'upgrades', 'flags', 'stats', 'bestRun'];

function isPlainObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }

function withCase(save, caseName) {
  Object.defineProperty(save, '_case', { value: caseName, enumerable: false, writable: true, configurable: true });
  return save;
}

export function migrateSave(raw) {
  if (!isPlainObj(raw)) return withCase(freshSave(), 'fresh');
  const recognizable = SAVE_FIELDS.some(k => k in raw);
  if (!recognizable) return withCase(freshSave(), 'fresh'); // junk object: drop everything
  const f = freshSave();
  const out = { ...f };
  out.saveVersion = SAVE_VERSION;
  // bank: keep per-color values, coerce/clip the rest
  if (isPlainObj(raw.bank)) {
    for (const c of ['red', 'blue', 'green']) out.bank[c] = Math.max(0, Number(raw.bank[c]) || 0);
  }
  // owned: keep only known painting ids
  out.owned = Array.isArray(raw.owned) ? raw.owned.filter(id => PAINTINGS.some(p => p.id === id)) : [];
  out.loadout = (Array.isArray(raw.loadout) ? raw.loadout : []).filter(id => out.owned.includes(id)).slice(0, 2);
  if (isPlainObj(raw.upgrades)) {
    for (const k of Object.keys(f.upgrades)) out.upgrades[k] = Math.max(0, Number(raw.upgrades[k]) || 0);
  }
  if (isPlainObj(raw.flags)) {
    for (const k of Object.keys(f.flags)) out.flags[k] = !!raw.flags[k];
  }
  if (isPlainObj(raw.stats)) {
    for (const k of Object.keys(f.stats)) out.stats[k] = Math.max(0, Number(raw.stats[k]) || 0);
  }
  out.bestRun = isPlainObj(raw.bestRun) ? raw.bestRun : f.bestRun;
  // B6: apply the version migration chain, then stamp the current version.
  // Legacy saves stored the version under `v`; read either key. The chain
  // rewrites `out` in place (mutating the normalized fields) as it walks
  // forward; it is a no-op today (SAVE_MIGRATIONS empty) and runs on a future
  // schema bump.
  const fromVer = Number(raw.saveVersion ?? raw.v ?? 1) || 1;
  let version = Math.max(1, fromVer);
  for (const m of SAVE_MIGRATIONS) {
    if (version === m.from) { m.fn(out); version = m.to; }
  }
  out.saveVersion = SAVE_VERSION;
  return withCase(out, 'migrated');
}

export function freshOptions() {
  return { volume: 0.7, muted: false };
}
export function migrateOptions(raw) {
  const o = freshOptions();
  if (raw && typeof raw === 'object') {
    o.volume = Math.min(1, Math.max(0, Number(raw.volume) || 0.7));
    o.muted = !!raw.muted;
  }
  return o;
}