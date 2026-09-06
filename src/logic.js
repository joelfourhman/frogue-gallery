// logic.js — PURE game rules. No DOM, no canvas: importable by Node tests.
// All tuning lives here so balance passes are one-file edits.
'use strict';

import { mulberry32 } from './math.js';

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
// M8 P7: difficulty multipliers. Normal = 1 across the board (current
// released balance). Gentle eases the heron fight and the damage you take;
// Bold is the challenge run. Difficulty is a per-run choice on the title and
// never changes save/upgrade state.
export const DIFFICULTIES = {
  gentle: { id: 'gentle',   label: 'Gentle', desc: 'the swamp is kind',            enemyHp: 0.85, bossHp: 0.75, dmgTaken: 0.75 },
  normal: { id: 'normal',   label: 'Normal', desc: 'the released balance',         enemyHp: 1.0,  bossHp: 1.0,  dmgTaken: 1.0  },
  bold:   { id: 'bold',     label: 'Bold',   desc: 'for frogs who like it gray',   enemyHp: 1.35, bossHp: 1.4,  dmgTaken: 1.3  },
};
// Apply a difficulty multiplier to a tuning object, in place and returning it.
// Pure (no DOM). Unknown ids are ignored (treated as normal).
export function applyDifficulty(t, difficulty) {
  const d = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  t.enemyHp = d.enemyHp;
  t.bossMaxHp = Math.round(t.bossMaxHp * d.bossHp);
  t.dmgTakenMult = d.dmgTaken;
  return t;
}

// A2 (v1.2 M9): painting synergy pairs. When TWO specific paintings are both
// in the 2-slot loadout, a named "duo" effect activates. The SYNERGIES table
// is keyed by the sorted pair key `a|b` (a < b) and each entry carries a name
// plus a pure `apply(t)` that mutates an already-built tuning object. It is
// pure + unit-testable (no DOM), and makeTuning calls it AFTER the per-painting
// loadout modifiers so the duo stacks on top of its two parts.
//
// Only real, consumed tuning fields are modified (splashCharge/splashRadius,
// burnDps, swipeDamage, greenHeal) — no new status system is introduced.
const _pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
export const SYNERGIES = {
  [_pairKey('moonlit-pond', 'storm-cloud')]: {
    pair: ['moonlit-pond', 'storm-cloud'],
    name: 'Flooded Night',
    desc: 'charged splashes linger far longer over the drowned reeds',
    apply(t) { t.splashCharge *= 0.7; t.splashRadius *= 1.15; },
  },
  [_pairKey('dancing-salamander', 'storm-cloud')]: {
    pair: ['dancing-salamander', 'storm-cloud'],
    name: 'Stormfire',
    desc: 'the storm feeds the smolder — burn and splash bite harder',
    apply(t) { t.burnDps *= 1.4; t.splashDamage *= 1.2; },
  },
  [_pairKey('spring-garden', 'king-frog')]: {
    pair: ['king-frog', 'spring-garden'],
    name: 'Royal Meadow',
    desc: 'the garden mends the court — extra health per green touch',
    apply(t) { t.greenHeal += 2; },
  },
};
// Active synergy for a loadout, or null. Pure (no DOM).
export function activeSynergy(loadout = []) {
  const ids = [...new Set(loadout)].sort();
  if (ids.length < 2) return null;
  return SYNERGIES[_pairKey(ids[0], ids[1])] || null;
}
export function makeTuning(upgrades = {}, loadout = [], difficulty = 'normal', gallery = 0) {
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
    // A4 (v1.2 M9): 'Rehung Frame' gallery bonus — a permanent, saved tuning
    // bump minted by retiring a completed collection (prestige-lite, no wipe).
    // Off (level 0) by default; applyGalleryBonus() fills these from the save
    // level. ink = +2 pigment of each color at the start of every run;
    // orb = a small permanent multiplier on orb/pickup value.
    galleryInkBonus: 0,
    galleryOrbMult: 1,
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
  // A2: painting synergy pairs — after the per-painting modifiers above, an
  // active "duo" stacks on top. Pure + testable; surfaces in the Gallery wall.
  const synergy = activeSynergy(loadout);
  if (synergy) { t.synergy = synergy.name; synergy.apply(t); }
  // M8 P7: scale the run by the chosen difficulty (after loadout modifiers).
  applyDifficulty(t, difficulty);
  // A4 (v1.2 M9): the permanent 'Rehung Frame' gallery bonus is a saved
  // tuning bump applied via the standard makeTuning path so it stacks after
  // loadout + difficulty. Pure + testable (no DOM).
  applyGalleryBonus(t, gallery);
  return t;
}

// ----------------------------------------------------------------
// A4 (v1.2 M9): 'Rehung Frame' — a prestige-lite, NOT save-wipe. Retiring a
// fully-completed collection (all 8 paintings owned + at least one ★-hung)
// mints a permanent, saved `galleryBonus` level. Each level is a small
// permanent bump applied through makeTuning via applyGalleryBonus:
//   +2 pigment of every color at the start of each run (start ink)
//   +10% orb / pickup value (orb value)
// It is repeatable — the level is a counter, not a one-time flag. Pure.
export const GALLERY_BONUS = {
  inkPerLevel: 2,       // flat +N of each pigment color at run start / level
  orbPerLevel: 0.10,    // +10% orb value / level (multiplicative on base)
};
export function galleryBonusLevel(save) {
  return Math.max(0, Math.floor(Number(save && save.galleryBonus) || 0));
}
// Fill t.galleryInkBonus / t.galleryOrbMult for a given (non-negative) level.
// Called by makeTuning; safe to call on any already-built tuning object.
export function applyGalleryBonus(t, gallery) {
  const lvl = Math.max(0, Math.floor(Number(gallery) || 0));
  t.galleryInkBonus = lvl * GALLERY_BONUS.inkPerLevel;
  t.galleryOrbMult = 1 + lvl * GALLERY_BONUS.orbPerLevel;
  t.pickupValue *= t.galleryOrbMult;
  return t;
}
// Retire-eligibility check: all 8 paintings owned AND at least one hung in the
// loadout. Pure.
export function canRetireCollection(save) {
  const owned = (save && Array.isArray(save.owned)) ? save.owned : [];
  const allOwned = PAINTINGS.every(p => owned.includes(p.id));
  const hung = (save && Array.isArray(save.loadout)) ? save.loadout.length > 0 : false;
  return allOwned && hung;
}
// Mint one level of the gallery bonus (repeatable; does NOT wipe the save).
// Returns the new level. Caller persists the save.
export function retireCollection(save) {
  if (!canRetireCollection(save)) return galleryBonusLevel(save);
  save.galleryBonus = galleryBonusLevel(save) + 1;
  return save.galleryBonus;
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

// ---------------------------------------------------------------- orb streak bonus (E4, v1.2 M10)
// Chaining pigment-orb collection WITHOUT taking a hit builds a small streak
// multiplier on orb/pickup value. It rewards the dodge/hop skill the PT3
// fly-fairness rebalance introduced. Deliberately modest so the Normal 15-20
// min pacing is untouched (a scoring bonus adds no run time — it only makes
// clean streaks pay a little more pigment). Pure + testable; game.js owns the
// streak counter (in-run, not persisted) and resets it on a hit.
export const ORB_STREAK = {
  min: 4,        // streaks of this many clean orbs unlock the bonus
  per: 0.10,     // +10% orb value per tier
  tiers: 4,      // up to 4 tiers
};
export function orbStreakMax() { return ORB_STREAK.min - 1 + ORB_STREAK.tiers; }
// The streak multiplier on pickup value for a given clean-orb streak count.
// Below `min` there is no bonus; beyond the tier cap it plateaus. Pure.
export function orbStreakMult(streak) {
  const s = Math.max(0, Math.floor(streak || 0));
  if (s < ORB_STREAK.min) return 1;
  const tiers = Math.min(ORB_STREAK.tiers, s - (ORB_STREAK.min - 1));
  return 1 + tiers * ORB_STREAK.per;
}
// Effective orb/pickup value at this streak, for a base tuning pickup value.
export function orbValueAt(streak, baseValue) {
  return baseValue * orbStreakMult(streak);
}
// Full streak state for the HUD (count, tiers lit, whether the bonus is live).
export function orbStreakState(streak) {
  const s = Math.max(0, Math.floor(streak || 0));
  const tiers = s < ORB_STREAK.min ? 0 : Math.min(ORB_STREAK.tiers, s - (ORB_STREAK.min - 1));
  return { streak: s, tiers, active: tiers > 0, mult: orbStreakMult(s), max: orbStreakMax() };
}

// ---------------------------------------------------------------- color-reveal progress (V1, v1.2 M11)
// The painted-world "color-reveal" progress: how much of the swamp's color has
// been restored THIS run (gray -> full color) as the frog paints. The single
// source of truth is the world's actual saturation, `world.worldColorSat()` —
// the same value the terrain draw uses — so a HUD bar reading this always
// matches what the world actually shows.
//
// The world starts slightly gray (a natural "before" state, `_colorSat ?? 0.25`
// in world.js) and is clamped to [0,1]. We map that real span to a clean 0..1
// "color restored" fraction: the baseline reads as 0% restored, a fully-saturated
// world (1.0) reads as 100%. Pure + testable (takes the raw saturation in, so a
// test can sample it directly against `worldColorSat()`).
export const REVEAL_BASELINE = 0.25; // the world's un-restored gray (matches world.js)
export function revealProgress(worldColorSat) {
  const sat = Math.max(0, Math.min(1, worldColorSat ?? REVEAL_BASELINE));
  const span = 1 - REVEAL_BASELINE;              // 0.75 of recoverable saturation
  if (sat <= REVEAL_BASELINE) return 0;          // at/under baseline -> 0% restored
  return Math.max(0, Math.min(1, (sat - REVEAL_BASELINE) / span));
}

// ----------------------------------------------------------------
// E1 (v1.2 M10): the Painted Heron — a mid-expedition "half-heron" set-piece.
// A small re-use of the existing bossStep + 3-hue awaken machinery at reduced
// scale. It is a pure config; game.js spawns it at a zone boundary, wires the
// paint/draw, and rewards its defeat. Reusing bossStep means the mid-heron
// inherits the real telegraph/awaken cadence (the "3-hue awaken" reads the same).
//
// Scaled down: ~1/10 the final heron's HP, a smaller awaken need (about one
// hue of each color to trigger the shimmer window), and phase escalation
// capped at 2 (no phase-3 "Gray Storm") so it reads as a guardian, not a wall.
// It is NON-blocking — the frog can walk past it (optional), and it appears on
// Normal+ difficulties.
export const MID_HERON = {
  difficulties: ['normal', 'bold'],   // Normal+ (optional; Gentle skips it)
  x: 0.75,                            // end of zone 3 (Bramble Thicket → The Gray Shore) = 4050/5400
  y: 750,                             // on the ground corridor
  trigger: 430,                       // it wakes when the frog comes within this range
  hp: 3000,                           // ~10% of the final heron's 30000
  awakenNeed: { red: 24, blue: 24, green: 24 }, // ~1 hue to awaken (final = 45)
  maxPhase: 2,                        // cap phase escalation at 1-2 phases
  contactDmg: 4,                      // its body hurts on contact (scaled down)
  rewardOrbs: 3,                      // pigment orbs granted on defeat
};
// Pure: is the Painted Heron active for this difficulty? (Normal+)
export function midHeronAllowed(difficulty) {
  return MID_HERON.difficulties.includes(difficulty);
}

// ----------------------------------------------------------------
// T3 (v1.2 M13): the "sketch" heron — the FINAL phase of the guided first
// expedition (a fresh save's teaching run). It reuses the real heron's
// bossStep + 3-hue awaken machinery at a low-HP scale so a first-timer meets
// the 3-hue awaken cadence BEFORE the 30k-HP fight: the real boss is then a
// "known pattern", not a surprise.
//
// Much smaller than the final heron (a few hundred HP — a low-HP "sketch"),
// awakens on about one hue of each color, and its phase escalation is capped
// at 2 (no phase-3 "Gray Storm"). It only ever appears inside the guided
// teaching layer (runT frozen), so it never inflates the 15-20 min timed
// expedition. game.js spawns/drives it (see Game._setupSketchHeron); this
// config keeps its rules pure + testable headless.
export const SKETCH_HERON = {
  x: 90,                                 // offset ahead of the frog (spawned relative to the player)
  y: 0,                                  // the frog's ground level (spawned relative to the player)
  hp: 240,                               // a few hundred HP (the real heron = 30000)
  awakenNeed: { red: 12, blue: 12, green: 12 }, // ~1 hue to awaken (final = 45)
  maxPhase: 2,                           // cap phase escalation at 1-2 (no Gray Storm)
  contactDmg: 0,                         // low-stakes teaching: the sketch never hurts
};

// ----------------------------------------------------------------
// E3 (v1.2 M10): Bold-only zone hazards. Two environmental hazards give
// Bold a reason to exist beyond "harder numbers": a THORN REED that briefly
// roots the frog on touch, and a MUD POOL that slows it. They spawn ONLY on
// Bold (Gentle/Normal are untouched, so the 15-20 min Normal pacing target is
// unaffected — difficulty-gated, no in-run time added on Normal). The player
// slow/root state is applied by game.js; placement is here so it is pure +
// deterministically seeded per (runSeed, zone) and testable headless.
export const BOLD_HAZARDS = {
  allowed: ['bold'],                       // Gentle/Normal never spawn them
  types: {
    thornReed: { id: 'thornReed', name: 'Thorn Reed', r: 46,  rootDur: 1.1, color: '#7fb069', desc: 'roots you for a moment' },
    mudPool:   { id: 'mudPool',   name: 'Mud Pool',   r: 56,  slowDur: 2.0, color: '#6b5644', desc: 'slows your stride'   },
  },
};
// Pure: is a hazard run active for this difficulty? (Bold only)
export function boldHazardsAllowed(difficulty) {
  return BOLD_HAZARDS.allowed.includes(difficulty);
}
// Place this zone's hazards (deterministic per (seed, zoneIndex)). Returns an
// array of { kind, x, y } placed along the corridor the frog actually travels
// (world h ~1500, walkable band y 480-980), a little ahead of the zone entry.
export function placeZoneHazards(seed, zoneIndex, zone, worldW, worldH) {
  const start = worldW * (zone.x - 0.04);
  const end = worldW * (zone.x + 0.16);
  const yMin = Math.max(500, worldH * 0.32), yMax = Math.min(980, worldH * 0.66);
  const rng = mulberry32(((seed + 1) ^ 0) * 2654435761 + zoneIndex * 7919 + 13) >>> 0;
  const r = mulberry32(rng);
  const n = 2 + (Math.floor(r() * 2));    // 2-3 hazards per zone
  const kinds = Object.keys(BOLD_HAZARDS.types);
  const out = [];
  for (let i = 0; i < n; i++) {
    const kind = kinds[Math.floor(r() * kinds.length) % kinds.length];
    const x = start + (i + 0.5) * ((end - start) / n) + (r() - 0.5) * 90;
    const y = yMin + r() * (yMax - yMin);
    out.push({ kind, x: Math.round(x), y: Math.round(y) });
  }
  return out;
}

// ----------------------------------------------------------------
// E2 (v1.2 M10): weather / tide phases — short ambient "phase" events during a
// zone that nudge the run's tuning for their duration (informational buffs,
// non-punishing). Each phase multiplies one already-consumed tuning field (via
// the same in-place `apply` shape as the synergy pairs) with a short fade-in /
// fade-out. They are derived DETERMINISTIC-ISH from the run seed + zone index
// (mulberry32), so the same run replays the same weather. Pure; game.js wires
// the timer + banner + in-place multiplier application.
export const WEATHER_PHASES = [
  {
    id: 'rain', name: 'Rain', tint: '#5a93c9',
    desc: 'Rain — the blue brush sweeps wider (splash radius +30%)',
    duration: 20, mult: 1.3, fields: ['splashRadius'],
  },
  {
    id: 'drought', name: 'Drought', tint: '#c8862c',
    desc: 'Drought — the red burn bites harder (burn damage +40%)',
    duration: 15, mult: 1.4, fields: ['burnDps'],
  },
];
// Eased factor to multiply the BASE field by at time `t` into the phase:
// 1.0 (no effect) -> phase.mult (full) -> 1.0 (fully faded at expiry). The
// multiplier ramps in over `rampIn` seconds and ramps out over `fade` seconds,
// so the effect never jumps and always returns exactly to the base value.
export function weatherFactor(phase, t, fade = 1.2, rampIn = 0.8) {
  const span = phase.mult - 1; // amount of change between "no effect" and "full"
  if (t <= 0) return 1;
  if (t >= phase.duration) return 1;
  if (t < rampIn) return 1 + span * (t / rampIn);
  const outAt = phase.duration - fade;
  if (t > outAt) return 1 + span * Math.max(0, (phase.duration - t) / fade);
  return phase.mult;
}
// Deterministic-ish: which weather (if any) fires in a given zone of a given
// run, and roughly when (mid-zone, in seconds). ~60% of zones get one.
export function weatherFor(seed, zoneIndex) {
  const s = (seed + zoneIndex * 7919 + 101) >>> 0;
  const rng = mulberry32(s);
  if (rng() > 0.6) return null;                       // many zones stay calm
  const phase = WEATHER_PHASES[Math.floor(rng() * WEATHER_PHASES.length) % WEATHER_PHASES.length];
  const atSec = 6 + rng() * 18;                       // mid-zone, after the entry beat
  return { phase, atSec };
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
  // E1: a mid-run heron caps its phase escalation via h.maxPhase (default 3 for
  // the final heron, so the default path is unchanged).
  const maxPhase = h.maxPhase || 3;
  if (hpFrac <= 0.33 && h.phase < 3 && h.phase < maxPhase) { h.phase = 3; ev.push('phase3'); h.state = 'leap'; h.stateT = 0.8; }
  else if (hpFrac <= 0.66 && h.phase < 2 && h.phase < maxPhase) { h.phase = 2; ev.push('phase2'); h.state = 'flap'; h.stateT = 0.9; }

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
// E1: a heron may carry its own (smaller) awakenNeed — a mid-run heron "awakens
// on about one hue"; otherwise the final heron's tuning.bossAwakenNeed is used.
export function paintBoss(h, pigmentId, amount, tuning) {
  if (!PIGMENTS[pigmentId] || pigmentId === 'dry') return 0;
  h.hue[pigmentId] = Math.min(99, (h.hue[pigmentId] || 0) + amount);
  const need = h.awakenNeed || tuning.bossAwakenNeed;
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
export const SAVE_VERSION = 3;

// Ordered schema-migration chain. Each entry upgrades a save from `from` to
// `to` by remapping an already-normalized save. The loader walks entries in
// `from` order, so a save written at any older version migrates forward step
// by step up to SAVE_VERSION. v1 is the initial version.
// A4 (v1.2 M9): v2 adds the `galleryBonus` counter (the 'Rehung Frame'
// prestige-lite level). Old v1 saves (no such field) migrate forward with the
// bonus defaulted to 0, so they keep loading unchanged.
// T1 (v1.2 M13): v3 adds the tutorial layer — `save.flags.tutorialSkipped`
// (dismissed the guided first expedition) and `save.tutorialDrills`
// ({burn,freeze,root}), the per-pigment drill completion map. A v2 save
// (no tutorialDrills) migrates forward with the drills defaulted to all-false,
// so returning players keep loading unchanged.
const SAVE_MIGRATIONS = [
  {
    from: 1, to: 2,
    fn: (out) => { out.galleryBonus = Math.max(0, Math.floor(Number(out.galleryBonus) || 0)); },
  },
  {
    from: 2, to: 3,
    fn: (out) => { out.tutorialDrills = normalizeDrills(out.tutorialDrills); },
  },
];

export function freshSave() {
  return {
    saveVersion: SAVE_VERSION,
    bank: { red: 0, blue: 0, green: 0 },
    owned: [],            // painting ids
    loadout: [],          // up to 2 painting ids
    upgrades: { capacity: 0, power: 0, vitality: 0 },
    flags: { intro: false, firstOrb: false, firstHurt: false, firstAtelier: false, firstDefeat: false, croaksworthAsked: false, croaksworthGiven: false, heronDefeated: false, welcomeGranted: false, tutorialSkipped: false },
    stats: { expeditions: 0, victories: 0, deaths: 0, heronsPainted: 0, treasures: 0 },
    bestRun: null,        // {pigments, time, cleared}
    galleryBonus: 0,      // A4 (v1.2 M9): 'Rehung Frame' prestige-lite level
    tutorialDrills: { burn: false, freeze: false, root: false, awaken: false }, // T1/T3 (v1.2 M13)
  };
}

// T1 (v1.2 M13): normalize the per-pigment drill completion map so a legacy
// save (no field, or a partial/garbled one) always reads back as a complete
// {burn,freeze,root} booleans object. Pure — testable headless.
function normalizeDrills(raw) {
  const base = { burn: false, freeze: false, root: false, awaken: false };
  if (!isPlainObj(raw)) return base;
  for (const k of ['burn', 'freeze', 'root', 'awaken']) base[k] = !!raw[k];
  return base;
}

// T1 (v1.2 M13): a player is eligible for the guided first expedition when they
// have NOT finished a run (heron never defeated) AND have not explicitly
// skipped the tutorial. A returning player (either condition true) never sees
// it. Pure — driven by save state only.
export function tutorialEligible(save) {
  if (!save || !isPlainObj(save.flags)) return false;
  return !save.flags.heronDefeated && !save.flags.tutorialSkipped;
}

// T2 (v1.2 M13): has a specific drill been completed+persisted? `id` is one of
// 'burn' | 'freeze' | 'root'. Pure.
export function tutorialDrillDone(save, id) {
  if (!save || !isPlainObj(save.tutorialDrills)) return false;
  return !!save.tutorialDrills[id];
}

// T2 (v1.2 M13): are all three per-pigment drills complete?
export function tutorialDrillsAllDone(save) {
  return tutorialDrillDone(save, 'burn') && tutorialDrillDone(save, 'freeze') && tutorialDrillDone(save, 'root');
}

// T2 (v1.2 M13): the per-drill advancement predicates. These are the CORE of
// the interactive drills: each reads the enemy's REAL status/death state, not
// "a brush stroke happened" (Paint never sets these). `drill` is 'burn' |
// 'freeze' | 'root'. `enemy` is a live-or-just-dead Enemy-like: { status,
// _burnedOut, deathCause }.
//   burn   — the target actually died WHILE burning (burn tick carried it to
//            0, or the burn status lapsed after it was already down).
//   freeze — the mosquito is currently frozen (blue-on-blue chain).
//   root   — the toad is currently rooted (green).
// Pure — driven by the enemy's real state only.
export function tutorialDrillSatisfied(drill, enemy) {
  if (!enemy) return false;
  const st = enemy.status && enemy.status.type;
  if (drill === 'burn') {
    const burnedOut = !!enemy._burnedOut || enemy.deathCause === 'burn';
    return (enemy.hp <= 0 || enemy.dead) && (burnedOut || st === 'burn');
  }
  if (drill === 'freeze') return st === 'freeze';
  if (drill === 'root') return st === 'root';
  return false;
}

// T3 (v1.2 M13): has the guided first expedition been COMPLETED? This is the
// "tutorial progress" reference (T4): true when ALL of the three pigment drills
// (burn/freeze/root) AND the sketch-heron (awaken) are recorded in
// save.tutorialDrills. Pure.
export function tutorialDone(save) {
  const d = (save && isPlainObj(save.tutorialDrills)) ? save.tutorialDrills : null;
  if (!d) return false;
  return !!(d.burn && d.freeze && d.root && d.awaken);
}

// T4 (v1.2 M13): is "Watch me" retraining available for this save? It must be
// reachable only for a player who has some tutorial context to replay — i.e. a
// fresh save (eligible to run the guided expedition) or a save that has already
// started/completed at least one drill or the sketch. A truly empty save
// (nothing done, not eligible) offers nothing to retrain. Pure.
export function retrainAllowed(save) {
  if (!save || !isPlainObj(save.flags)) return false;
  if (save.flags.heronDefeated) return true;          // finished at least one run
  if (save.flags.tutorialSkipped) return true;        // dismissed the guided run
  const d = isPlainObj(save.tutorialDrills) ? save.tutorialDrills : null;
  if (d && (d.burn || d.freeze || d.root || d.awaken)) return true; // some progress
  return tutorialEligible(save);                       // fresh, eligible to start
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
const SAVE_FIELDS = ['bank', 'owned', 'loadout', 'upgrades', 'flags', 'stats', 'bestRun', 'galleryBonus', 'tutorialDrills'];

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
  // A4 (v1.2 M9): galleryBonus is a top-level scalar counter; normalize so an
  // old-format save (no field) defaults to 0 instead of leaking undefined.
  out.galleryBonus = Math.max(0, Math.floor(Number(raw.galleryBonus) || 0));
  // T1 (v1.2 M13): carry the per-pigment drill map forward (default all-false
  // for a legacy v2 save, real values for a v3 save). The v2->v3 migration
  // step re-normalizes defensively.
  out.tutorialDrills = normalizeDrills(raw.tutorialDrills);
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

// P9: options split into separate music (ambient bed) / SFX volumes and add
// screen-shake + low-HP vignette accessibility toggles. The legacy `volume`
// field (a single master) is still honored by migrateOptions so pre-P9 saves
// keep working; new fields default sensibly.
export function freshOptions() {
  return { volume: 0.8, muted: false, difficulty: 'normal', musicVol: 0.6, sfxVol: 0.7, shake: true, vignette: true };
}
export function migrateOptions(raw) {
  const o = freshOptions();
  if (raw && typeof raw === 'object') {
    const v = Math.min(1, Math.max(0, Number(raw.volume) || 0.7));
    o.volume = v;
    o.muted = !!raw.muted;
    o.difficulty = (DIFFICULTIES[raw.difficulty] ? raw.difficulty : 'normal');
    // P9: new split volumes. If a field is present, honor it; otherwise seed
    // from the legacy master `volume` so a pre-P9 save keeps its old level.
    o.musicVol = raw.musicVol !== undefined ? Math.min(1, Math.max(0, Number(raw.musicVol))) : v;
    o.sfxVol = raw.sfxVol !== undefined ? Math.min(1, Math.max(0, Number(raw.sfxVol))) : v;
    // shake / vignette: default on; only an explicit false turns them off.
    o.shake = raw.shake !== false;
    o.vignette = raw.vignette !== false;
  }
  return o;
}