// logic.js — PURE game rules. No DOM, no canvas: importable by Node tests.
// All tuning lives here so balance passes are one-file edits.
'use strict';

import { mulberry32, TAU } from './math.js';

// ---------------------------------------------------------------- pigments
export const PIGMENTS = {
  // v1.4 color rework (Joel): red = big damage + strong burn, blue = medium
  // damage + freeze (flies freeze solid; ground enemies slow-then-freeze),
  // green = minimal damage + heals the frog, dry = weak damage but the
  // world-restorer + status cleanse.
  red:   { id: 'red',   name: 'Crimson', color: '#c8452c', light: '#e8836b', dmgMult: 1.6,  status: 'burn'  },
  blue:  { id: 'blue',  name: 'Cobalt',  color: '#3a6fd8', light: '#8fb0f0', dmgMult: 1.0,  status: 'freeze' },
  green: { id: 'green', name: 'Moss',    color: '#5a9e3d', light: '#9ed483', dmgMult: 0.6,  status: 'root'  },
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
    id: 'mosquito', name: 'Mosquito', hp: 11, speed: 120, dmg: 4, radius: 10,
    armor: 0, fly: true, score: 10, paintTintDecay: 0.4,
  },
  toad: {
    id: 'toad', name: 'Grumpy Toad', hp: 52, speed: 58, dmg: 6, radius: 19,
    armor: 0.08, score: 30, paintTintDecay: 0.2,
    dizzyPaintChance: 0.22,  // chance a paint hit stuns the toad (sits, +50% dmg)
    dizzyDuration: 2.2,
  },
  // K1 (v1.5 M1): MUD TURTLE — the Living Swamp's armored plodder. High HP,
  // slow, heavy contact hit. Its SHELL deflects paint from the FRONT arc
  // (paint damage is cut to `deflectKeep` of normal within `deflectArc` of its
  // facing) — full damage from the side/back. RED BURN is the counter: burn
  // damage is applied per status-tick (stepStatus), never through a paint hit,
  // so it ignores the deflection entirely. Scales into zones 3+ and NG+.
  turtle: {
    id: 'turtle', name: 'Mud Turtle', hp: 95, speed: 24, dmg: 12, radius: 24,
    armor: 0.45, fly: false, score: 45, paintTintDecay: 0.18,
    frontDeflect: true,       // the shell turns paint away from the front
    deflectArc: 1.5,          // radians (~±86°) either side of its facing
    deflectKeep: 0.15,        // front paint deals this FRACTION of normal dmg
  },
  // K2 (v1.5 M2): BLIND CRAG FROG — hunts by SOUND. It cannot see; it wakes to
  // noise (a paint swipe/splash, a hop landing, a charge) inside `noiseRadius`
  // and homes in at full speed. When the player is still the alert timer decays
  // and it SLEEPS again — and while asleep it is vulnerable (+50% paint damage).
  // While awake it is fast with high contact damage. Scales into zones 3+ and
  // NG+; bounded spawn. Sleep/wake is modelled in enemies.js (per-enemy state);
  // the asleep damage bonus is the pure `cragSleepBonus` applied in paint.js.
  cragfrog: {
    id: 'cragfrog', name: 'Blind Crag Frog', hp: 34, speed: 150, dmg: 9,
    radius: 17, armor: 0.05, fly: false, score: 40, paintTintDecay: 0.3,
    noiseRadius: 280,         // a noise event within this wakes the frog
    alertDuration: 5.0,       // seconds awake after the most recent noise
  },
  // R3 (v1.6 Module R): the LIGHT-REWRITTEN BESTIARY — three Reeds archetypes,
  // all keyed to THE LANTERN (R1's lightFactor / lanternState), Reeds-mode-only
  // (a rare pick in the bounded spawn cap; never in the cycle-0 swamp pool).
  //
  // (a) GLOW WISP — a slow drifting LURE. While the lantern is LIT it WINDS
  // toward the lantern's light (the attractor is the frog, who carries it);
  // unlit it takes random drift. A BLUE SPLASH near it BLINDS it (a ~3s
  // useless spin — the pure wispBlinded() tick). It is nearly INVISIBLE unlit
  // (draw alpha scales by the lightFactor it receives). Low HP / low contact
  // damage — a trap that pulls the frog, not a brawler.
  wisp: {
    id: 'wisp', name: 'Glow Wisp', hp: 14, speed: 34, dmg: 3, radius: 13,
    armor: 0, fly: true, score: 22, paintTintDecay: 0.5,
    lightHoming: true,   // winds toward the lantern's light while lit
  },
  // (b) MUD SERPENT — burrows UNDER the water line (invisible + unhittable
  // while burrowed), TELEGRAPHS a strike with a growing ripple ring at its
  // fixed surface point (~1.2s, the heron-telegraph draw language), then
  // SURFACES and strikes the lane. A painted RING on the water before it
  // surfaces (ANY pigment) interrupts the strike and knocks it back
  // underground with a cooldown. State machine (burrowed/telegraph/surface)
  // lives in enemies.js; the surface/strike constants are below.
  serpent: {
    id: 'serpent', name: 'Mud Serpent', hp: 40, speed: 0, dmg: 9, radius: 18,
    armor: 0.2, fly: false, score: 35, paintTintDecay: 0.2,
    burrower: true,       // unhittable while burrowed (paint.js + game)
  },
  // (c) SILT LEECH — CLINGS to the player on contact: drains a small HP/sec
  // and SLOWS movement 25% while attached (the leechAttached flag + the pure
  // leechDrain(dt)). Comes off when PAINTED (any swipe touching the frog —
  // dry brush counts, its one combat use) OR when the player HOPS off (one
  // hop breaks the cling; a second leech cannot attach for ~6s — the pure
  // leechReattachCd). It has no contact attack of its own (it clings).
  leech: {
    id: 'leech', name: 'Silt Leech', hp: 10, speed: 64, dmg: 0, radius: 11,
    armor: 0, fly: false, score: 18, paintTintDecay: 0.4,
    leech: true,         // clings + drains + slows (no contact attack)
  },
};

// R3 (v1.6 Module R): the BESTIARY's pure rule constants + tick functions.
// All Reeds-bestiary numbers live here so a balance pass is one file edit.
export const REEDS_BESTIARY = {
  // (a) wisp: the useless spin a blue splash induces.
  wispBlindDuration: 3.0,      // seconds of spin after a blue splash
  wispBlindRadius: 140,        // a blue splash this close blinds the wisp
  wispHoming: 1.0,             // seek gain while the lantern lights the wisp
  wispDrift: 0.35,             // random-drift gain while unlit / not homing
  // (b) serpent: the burrow -> telegraph -> surface -> cooldown cycle.
  serpentTelegraph: 1.2,       // the growing ripple-ring tell (seconds)
  serpentSurface: 0.9,         // the surfaced strike window (seconds)
  serpentStrikeReach: 150,     // a frog this close to the strike lane takes the hit
  serpentBurrow: 4.0,          // time back underground before the next cycle
  serpentRecover: 1.4,         // the submerged swell after a strike (before re-burrowing)
  serpentReCooldown: 2.2,      // extra pause after a PAINTED-RING interrupt
  // (c) leech: the cling / strangle.
  leechDrainDps: 0.6,          // HP/sec drained while attached
  leechSlow: 0.25,             // 25% movement slowdown while attached
  leechReattach: 6.0,          // seconds a second leech cannot attach after one breaks
};

// R3 (a): the pure WISP-BLIND tick. A wisp carries `wispBlindT` (seconds of
// spin left, >0 while blind). This decrements it and returns true while it is
// still blind (the wisp is "useless" — spinning, no homing, no contact). A
// fresh wisp (0/undefined) is never blind. Pure.
export function wispBlinded(t) {
  const v = Number(t);
  return Number.isFinite(v) ? v > 0 : false;
}

// R3 (c): the pure LEECH-DRAIN tick. While a leech is attached it drains
// `dps` HP/sec off the player's hp and returns the HP lost this step (a float,
// the caller floors into a whole-hit or accumulates; the movement slowdown is
// the separate `leechSlow` factor applied by the player). No-op (0) with no
// leech. Pure — no browser APIs.
export function leechDrain(dt, dps = REEDS_BESTIARY.leechDrainDps) {
  if (!(dt > 0)) return 0;
  return Math.max(0, dt) * (Number(dps) || 0);
}

// K2 (v1.5 M2): an ASLEEP Blind Crag Frog is vulnerable — it takes this much
// paint damage (×1.5). Applied in paint.js when the target is asleep.
export const CRAG_SLEEP_BONUS = 1.5;
export function cragSleepBonus(e) {
  return (e && e.kind === 'cragfrog' && e.asleep) ? CRAG_SLEEP_BONUS : 1;
}

// K1 (v1.5 M1): front-arc deflection. A front-deflecting enemy (the Mud
// Turtle) turns paint away from the front: if the angle between its facing and
// the player (the brush) is within `deflectArc`, paint damage is cut to
// `deflectKeep` of normal. Side/back paint (and RED BURN — which never passes
// through a paint hit) deals full damage. Pure; called from paint.js.
export function frontDeflectFactor(e, player) {
  if (!e || !e.frontDeflect || !player) return 1;
  const toPlayer = Math.atan2(player.y - e.y, player.x - e.x);
  let diff = Math.abs(toPlayer - (e.facing || 0));
  if (diff > Math.PI) diff = TAU - diff;
  return diff <= (e.deflectArc || 1.5) ? (e.deflectKeep != null ? e.deflectKeep : 0.15) : 1;
}

// ---------------------------------------------------------------- statuses
// Status applied when a paint hit lands. Returns { status, note }.
// v1.4 color rework (Joel): blue now FREEZES. A flying target (mosquito)
// freezes solid on the first blue hit; a ground target is briefly slowed, and
// a second blue within that window (or the slow ticking out) turns it to ice.
// Net effect the player feels: blue = medium damage + freeze. The tutorial /
// Field Guide already promise "blue freezes," so this aligns the mechanic.
export function paintStatusFor(pigmentId, enemy, now) {
  if (pigmentId === 'dry') return { status: null, note: null };
  if (pigmentId === 'red') {
    return { status: { type: 'burn', t: 3.2, appliedAt: now }, note: 'burning' };
  }
  if (pigmentId === 'blue') {
    const prev = enemy.status;
    const alreadySlowed = prev && prev.type === 'slow' && (now - prev.appliedAt) <= 1.2;
    if (enemy.fly || alreadySlowed) {
      return { status: { type: 'freeze', t: enemy.fly ? 1.5 : 1.3, appliedAt: now }, note: 'frozen' };
    }
    return { status: { type: 'slow', t: 1.2, appliedAt: now }, note: 'slowed' };
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
  // K1 (v1.5 M1): front-arc SHELL deflection (the Mud Turtle). A front hit on a
  // front-deflecting shell is cut; side/back deals full. RED BURN never reaches
  // paintDamage (it is applied per status-tick), so it bypasses deflection —
  // the intended counter.
  if (opts.deflectFactor) d *= opts.deflectFactor;
  // K2 (v1.5 M2): an ASLEEP Blind Crag Frog is vulnerable (×1.5 paint).
  if (opts.sleepBonus) d *= opts.sleepBonus;
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
export function makeTuning(upgrades = {}, loadout = [], difficulty = 'normal', gallery = 0, owned = [], gilded = false) {
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
    burnDps: 7,
    freezeDuration: 1.3,
    slowFactor: 0.45,
    rootDuration: 1.6,
    // P4: green mends 3 HP per paint — meaningful early, still slow to
    // refill a full pool (keeps the heron fight from being a free medkit).
    greenHeal: 3,
    // v1.4 color rework (Joel): painting an enemy with green also heals the
    // frog a little (1 hp per ~2 green hits) — green = minimal damage + heal,
    // not just "stand in green paint."
    greenHealOnPaint: 0.5,
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
  // G2 (v1.3 M15): the two GOLD-tier paintings apply when OWNED (a permanent
  // meta bonus, not a loadout slot). A first-time save owns neither, so these
  // are no-ops and a cycle-0 tuning is byte-identical. `gilded-meridian` lifts
  // the consumed orb/pickup value +10%; `verdant-crown` adds +1 to the green
  // heal-per-touch. Both feed the EXISTING tuning fields.
  const owns = (id) => Array.isArray(owned) && owned.includes(id);
  if (owns('gilded-meridian')) { t.pickupValue *= 1.1; }
  if (owns('verdant-crown')) { t.greenHeal += 1; }
  // G3 (v1.3 M15): the ONE-TIME 'Gilded Frame' prestige tier — a permanent
  // tuning bump applied LAST, ON TOP OF the Rehung Frame gallery bonus
  // (+3 start ink of each color, +15% orb value), so it stacks distinctively
  // with it. NG+/gold-gated: a first-time (cycle-0, non-gilded) save never
  // passes gilded=true, so the gilded keys are added ONLY when on and a
  // cycle-0 tuning is byte-identical (no new keys, same values).
  if (gilded) {
    t.gildedInkBonus = GILDED_FRAME.ink;
    t.gildedOrbMult = GILDED_FRAME.orbMult;
    t.galleryInkBonus += GILDED_FRAME.ink;   // stacks on the Rehung Frame ink
    t.pickupValue = Math.round(t.pickupValue * GILDED_FRAME.orbMult * 100) / 100;
  }
  return t;
}

// ----------------------------------------------------------------
// N2 (v1.3 M14): New Game+ per-cycle scaling — PURE.
//
// ngPlusScaling(cycle) returns the multipliers for an NG+ cycle:
//   cycle 0 (the base, first-time game)  →  everything 1.0 (NO change to the
//                first-time run's 15–20 min pace band — the invariant).
//   cycle >= 1                          →  modest escalation:
//                · enemyHp   cycle 1 ≈ +30%  (beetles/mosquitoes/toads hit harder)
//                · enemyDmg  cycle 1 ≈ +15%  (contact hits sting a little more)
//                · spawnRate cycle 1 ≈ +10%  (waves arrive a touch sooner)
//     Growth is CAPPED from cycle 3 onward (a hard ceiling at cycle 3) so the
//     escalation is a deliberate "one more step up" rather than an unbounded
//     difficulty spiral. The cap keeps later cycles readable and the pacing
//     probes meaningful.
//
// Only applied in run setup when ngCycle >= 1. Because cycle 0 returns
// all-ones, a first-time player's tuning is byte-identical to pre-NG+ (the
// smoke suite asserts this), so the first-time 15–20 min run is unchanged.
// K6 (v1.5 M2): the "Master" tier — cycle 4+ applies a capped Master step on
// top of the cycle-3 escalation: enemy HP +50% and enemy damage +25% OVER the
// cycle-3 values (spawn held at cycle 3 — the Master tier is about enemy
// toughness, not spawn rate). All cycles >= 4 use the SAME Master row (bounded,
// no unbounded spiral).
export const NG_CAP_CYCLE = 4; // escalation is capped at cycle 4 (and every cycle after)
// per-cycle multipliers; index 0 = base game (no NG+). Grows +30/+15/+10 HP/dmg/spawn
// per step up to cycle 3, then the Master step (cycle 4+) adds HP +50% / dmg +25%
// over cycle 3 and holds.
export const NG_STEPS = [
  { hp: 1.00, dmg: 1.00, spawn: 1.00 }, // cycle 0 (base)
  { hp: 1.30, dmg: 1.15, spawn: 1.10 }, // cycle 1  (~ +30% / +15% / +10%)
  { hp: 1.60, dmg: 1.30, spawn: 1.20 }, // cycle 2
  { hp: 1.90, dmg: 1.45, spawn: 1.30 }, // cycle 3
  // K6 Master tier (cycle 4+): HP +50% / dmg +25% over cycle 3 (1.90×1.50=2.85,
  // 1.45×1.25=1.8125→1.81); spawn held at cycle 3 (1.30). Bounded — held for
  // all later cycles (cycle 4 == cycle 5 == cycle 99).
  { hp: 2.85, dmg: 1.81, spawn: 1.30 }, // cycle 4+ (MASTER — the capped peak)
];
export function ngPlusScaling(cycle) {
  let c = Math.floor(Number(cycle));
  if (!Number.isFinite(c) || c < 0) c = 0;
  // clamp into the table; anything >= NG_CAP_CYCLE uses the capped (cycle 3) row.
  const idx = Math.min(c, NG_STEPS.length - 1);
  return NG_STEPS[idx];
}

// N2: apply the NG+ cycle multipliers to a tuning object (mutates it). No-op
// for cycle 0 (all-ones) so first-time tuning is byte-identical. Pure.
export function applyNGPlus(t, cycle) {
  const s = ngPlusScaling(cycle);
  if (s.hp !== 1) t.enemyHp = Math.round((t.enemyHp || 1) * s.hp * 100) / 100;
  if (s.dmg !== 1) t.enemyDmg = Math.round((t.enemyDmg || 1) * s.dmg * 100) / 100;
  if (s.spawn !== 1) t.spawnRate = Math.round(s.spawn * 100) / 100;
  return t;
}

// ----------------------------------------------------------------
// N4 (v1.3 M14): Player-chosen expedition modifiers — PURE.
//
// At the "Next Expedition" (New Game+) prompt the player picks ONE modifier
// for the cycle. Modifiers are DATA (a MODIFIERS table of id -> {name, desc,
// apply(t)}) that mutate an already-built tuning object through the EXISTING
// tuning paths — no new systems. Each `apply(t)` sets only the few fields it
// touches and leaves every other field (and, for an unknown/null id, the WHOLE
// tuning) untouched, so a cycle-0 (first-time) run — which never runs a
// modifier — stays byte-identical to pre-N4.
//
// The tuning fields these feed:
//   waterWidthMult  — the world's water (ripples/slicks) draw radius multiplier
//                     (High Tide: wider water). Render + test surface only.
//   enemySpeedMult  — multiplied onto every enemy's base speed at spawn (High
//                     Tide: +10% enemy speed).
//   contactDmgMult  — multiplied onto enemy contact damage at spawn (Grey
//                     Morning: +20% contact dmg) — combat-only, no HP/spawn.
//   satFloor        — a render-only saturation floor so the world reads as a
//                     flat gray morning (Grey Morning). Render-only, zero
//                     gameplay effect.
//   splashCharge    — the right-click splash charge TIME; longer = slower
//                     charge (Dry Brush Season: +35% slower).
//   pickupValue     — the per-orb/pickup value, already gallery-bonus-scaled;
//                     the modifier multiplies it (Dry Brush Season: +25%).
//
// MODIFIERS is exported so tests + the atelier can read it without a browser.
export const MODIFIERS = {
  'high-tide': {
    id: 'high-tide',
    name: 'High Tide',
    desc: 'the water runs wide and the swamp moves faster — water zones wider, enemies 10% faster',
    apply(t) { t.waterWidthMult = 1.25; t.enemySpeedMult = 1.1; },
  },
  'grey-morning': {
    id: 'grey-morning',
    name: 'Grey Morning',
    desc: 'a flat grey light over the water — the world desaturates, enemy contact does +20% damage',
    apply(t) { t.contactDmgMult = 1.2; t.satFloor = 0.35; },
  },
  'dry-brush-season': {
    id: 'dry-brush-season',
    name: 'Dry Brush Season',
    desc: 'the paint is thin this season — splashes charge +35% slower, but every orb is worth +25%',
    apply(t) {
      // the splash charge is a TIME (base 0.55): +35% slower = 35% longer.
      t.splashCharge = Math.round(t.splashCharge * 1.35 * 100) / 100;
      // +25% orb value — stacked onto the already-final pickupValue (which
      // includes the gallery bonus), so it composes multiplicatively.
      t.pickupValue = Math.round(t.pickupValue * 1.25 * 100) / 100;
    },
  },
  // K5 (v1.5 M2): three new expedition modifiers — data entries that feed the
  // EXISTING tuning/spawn/render paths (no new systems). NG+-gated like N4:
  // a first-time (cycle-0) run never carries these fields, so it stays
  // byte-identical.
  'night-expedition': {
    id: 'night-expedition',
    name: 'Night Expedition',
    desc: 'the swamp sleeps under a dark sky — the world dims, mosquitoes fly 20% faster, every orb is worth +10%',
    // nightDarkness: a RENDER-ONLY flag read by game.js _drawAll (draws a
    // semi-transparent dark overlay over the world). It does NOT affect
    // logic/tuning — purely the "darker lighting" the K5 spec asks for.
    // mosquitoSpeedMult: feeds the existing enemy-speed path (enemies.js
    // Enemy constructor multiplies it in for mosquitoes only).
    // pickupValue: the existing orb/pickup value field (stacks multiplicatively).
    apply(t) {
      t.nightDarkness = 1;
      t.mosquitoSpeedMult = 1.2;
      t.pickupValue = Math.round(t.pickupValue * 1.10 * 100) / 100;
    },
  },
  'still-waters': {
    id: 'still-waters',
    name: 'Still Waters',
    desc: 'the water lies flat — no weather phases this cycle, but enemies are 15% tougher',
    // stillWaters: a flag read by game.js _updateExpedition to SKIP the
    // weatherFor call (no rain/drought phases). It does NOT affect tuning —
    // purely the "no weather phases" the K5 spec asks for.
    // enemyHp: the existing enemy-HP multiplier (stacks onto the NG+ cycle
    // multiplier already applied).
    apply(t) {
      t.stillWaters = 1;
      t.enemyHp = Math.round((t.enemyHp || 1) * 1.15 * 100) / 100;
    },
  },
  "masters-palette": {
    id: "masters-palette",
    name: "Master's Palette",
    desc: 'the atelier hands you a ready-made duo — the Flooded Night synergy is pre-locked in your loadout, and enemy contact does +10% damage',
    // preLock: the 2-slot loadout that game.js _beginExpedition uses INSTEAD
    // of the player\'s saved loadout when this modifier is active. It is read
    // BEFORE makeTuning (not from t) because it changes which paintings the
    // loadout contains, which makeTuning consumes. The `this` inside apply(t)
    // is the modifier object, so `this.preLock` is the array.
    preLock: ['moonlit-pond', 'storm-cloud'],
    apply(t) {
      t.contactDmgMult = (t.contactDmgMult || 1) * 1.10;
      t.preLockLoadout = this.preLock; // marker for tests + the smoke stage
    },
  },
};
export const MODIFIER_ORDER = ['high-tide', 'grey-morning', 'dry-brush-season', 'night-expedition', 'still-waters', 'masters-palette'];
// The active modifier for a save: a valid MODIFIERS id, or null (no modifier).
// Unknown/empty/garbled values normalize to null so old saves (pre-N4) and
// a "no modifier" choice both read as no-op. Pure (no DOM).
export function saveModifier(save) {
  const id = save && typeof save.ngModifier === 'string' ? save.ngModifier : '';
  return MODIFIERS[id] ? id : null;
}
// Apply a save's chosen modifier to a tuning object (in place, returns it).
// No-op for a null/unknown id, so a first-time (cycle 0) run that passes no
// modifier is byte-identical. Pure. Called by _beginExpedition ONLY on NG+
// cycles (ngCycle >= 1) — the base game never runs a modifier.
export function applyModifier(t, id) {
  const m = MODIFIERS[id];
  if (!m) return t;
  m.apply.call(m, t);
  return t;
}

// ----------------------------------------------------------------
// K7 (v1.5 M2): The CURATOR CHALLENGE — a SEEDED, SCORED expedition.
//
// A title-screen "Challenge" button, GATED behind a completed victory (the same
// ngUnlocked gate as NG+), so a first-time player never sees it. A challenge run
// is ONE shared world per day: the seed is the current UTC day (Date.now() /
// 86400000), so everyone who presses it that day draws the SAME loadout, the
// SAME modifier, and runs the SAME seeded world. The loadout is a RANDOM 2-
// painting draw from the player's OWNED paintings (not chosen by the player);
// the modifier is a RANDOM one from the MODIFIERS table. On a completed run the
// frog banks a SCORE (restored swamp + enemies + orbs + boss-time bonus) into a
// SAVED best-score file (top 5, each {seed, date, score}) shown in a new atelier
// panel.
//
// The whole RULE is pure + headless-testable (this block): the day seed, the
// seeded loadout/modifier draws, the score formula, and the top-5 file. game.js
// stays thin — it wires the button, drives the seeded expedition, and calls
// these functions. All draws use mulberry32 (src/math.js) so the same seed is
// deterministic forever.
//
// A challenge run is its OWN mode: it is NOT counted in the first-time Normal
// 15-20 min pace band (it is seeded from a player's post-victory save, and the
// first-time pace.mjs / humance.mjs probes never enter it).
//
// CHALLENGE_TOP_N — the size of the saved best-score file.
export const CHALLENGE_TOP_N = 5;

// K7: the shared "day seed" for a given instant. The whole world shares one
// challenge per UTC day: Math.floor(ms / 86400000). A non-finite `ms` falls
// back to the real clock. Pure.
export function challengeDaySeed(ms = Date.now()) {
  const t = Number(ms);
  if (!Number.isFinite(t)) return Math.floor(Date.now() / 86400000);
  return Math.floor(t / 86400000);
}

// K7: a short, human label for a day seed — the UTC calendar date (YYYY-MM-DD).
// Deterministic per seed; used in the atelier best-score file + the run banner.
export function challengeDate(seed) {
  const s = Math.floor(Number(seed));
  const d = new Date(s * 86400000);
  return d.toISOString().slice(0, 10);
}

// K7: the SEEDED 2-painting loadout draw from a player's OWNED paintings.
// `owned` is the list of owned painting ids. Uses mulberry32(seed) so the same
// (seed, owned) pair always draws the same two. A Fisher–Yates shuffle on the
// owned list, then take the first 2 (so the draw is a fair uniform 2-subset).
// If fewer than 2 are owned it returns whatever is available (a new challenger
// with 0–1 paintings still gets a valid — possibly empty — loadout). Returns a
// fresh array (never mutates `owned`). Pure.
export function challengeDrawLoadout(seed, owned) {
  const pool = Array.isArray(owned) ? owned.filter(id => typeof id === 'string' && id) : [];
  const out = [];
  if (pool.length <= 2) return pool.slice();
  const rnd = mulberry32((Math.floor(Number(seed)) | 0) ^ 0x9e3779b9);
  const a = pool.slice();
  // Fisher–Yates (partial) — only the first 2 picks are needed.
  for (let i = a.length - 1; i > a.length - 3; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return [a[a.length - 1], a[a.length - 2]];
}

// K7: the SEEDED modifier draw — one random id from the MODIFIERS table. Uses
// mulberry32(seed) with a distinct stream offset from the loadout draw (so the
// same seed yields a STABLE (loadout, modifier) pair, not two independent
// draws). Returns a valid MODIFIERS id, or null if the table is empty. Pure.
export function challengeDrawModifier(seed) {
  const ids = MODIFIER_ORDER.filter(id => MODIFIERS[id]);
  if (ids.length === 0) return null;
  const rnd = mulberry32((Math.floor(Number(seed)) | 0) ^ 0x51ed270b);
  const k = Math.floor(rnd() * ids.length) % ids.length;
  return ids[k];
}

// K7: the challenge SCORE constants. Chosen so a competent run lands in a
// satisfying, bounded range (roughly a few hundred to a couple thousand):
//   restored — the swamp's color restored this run (revealProgress 0..1) scaled
//              up: a fully-painted world is worth REVEAL_MAX.
//   enemies  — a flat bonus per enemy defeated in time.
//   orbs     — a small bonus per pigment orb collected in time.
//   bossTime — a bonus for finishing the heron FASTER: the faster the boss
//              fight (bossTimeSec), the larger the bonus, capped at BOSS_MAX.
export const CHALLENGE_SCORE = {
  revealMax: 600,        // fully restoring the swamp
  perEnemy: 12,
  perOrb: 3,
  bossMax: 400,
  bossTimeRef: 150,      // a 150s boss fight earns the FULL boss bonus
};

// K7: compute the challenge SCORE from a run's outcome. Pure + testable —
// game.js gathers the four real numbers (restored swamp fraction, enemies
// defeated, orbs collected, boss-fight time in seconds) and calls this.
// `restored` is the revealProgress fraction (0..1; the gray swamp at rest is 0,
// a fully colored swamp is 1). A negative boss time / negative counts are clamped
// to 0. The boss bonus is full at bossTimeRef seconds and linearly fades to 0 as
// the fight takes twice as long (so a very long boss fight earns no bonus).
export function challengeScore({ restored = 0, enemies = 0, orbs = 0, bossTimeSec = 0 } = {}) {
  const c = CHALLENGE_SCORE;
  const r = Math.max(0, Math.min(1, Number(restored) || 0));
  const e = Math.max(0, Math.floor(Number(enemies) || 0));
  const o = Math.max(0, Math.floor(Number(orbs) || 0));
  const bt = Math.max(0, Number(bossTimeSec) || 0);
  const reveal = Math.round(r * c.revealMax);
  const enemyPts = e * c.perEnemy;
  const orbPts = o * c.perOrb;
  // boss bonus: full at bt <= bossTimeRef, linear fade to 0 at bt >= 2*ref.
  let bossPts = 0;
  if (bt > 0) {
    const t = (bt - c.bossTimeRef) / c.bossTimeRef;   // 0 at ref, 1 at 2*ref
    bossPts = Math.round(c.bossMax * Math.max(0, Math.min(1, 1 - t)));
  }
  return reveal + enemyPts + orbPts + bossPts;
}

// K7: file a completed challenge's score into a save's best-score list (mutates
// save in place, returns the NEW list). Each entry is {seed, date, score}. The
// list is kept at most CHALLENGE_TOP_N, ordered DESCENDING by score (ties broken
// by the later date). A completed run ALWAYS files its score (it is the
// challenge's whole point — no rank gating at this layer; K8's rank-based gold
// reads the rank off this list). Old / corrupt lists are normalized first. Pure.
export function challengeFileScore(save, seed, score) {
  const s = Math.floor(Number(seed));
  const sc = Math.round(Number(score) || 0);
  const date = challengeDate(s);
  const list = normalizeChallengeScores(save && save.challengeScores);
  list.push({ seed: s, date, score: sc });
  list.sort((a, b) => (b.score - a.score) || b.date.localeCompare(a.date));
  const out = list.slice(0, CHALLENGE_TOP_N);
  if (save) save.challengeScores = out;
  return out;
}

// K7: a save has unlocked the Curator Challenge once at least one VICTORY is
// recorded (the same gate as NG+ — ngUnlocked). A first-time save (no victory)
// sees NO challenge button. Pure.
export function challengeUnlocked(save) {
  return !!(save && save.stats && Number(save.stats.victories) > 0);
}

// ----------------------------------------------------------------
// R5 (v1.6 Module R): BENEATH THE REEDS — the new VICTORY-GATED biome.
//
// The Reeds entry is VICTORY-GATED: a first-time (cycle-0 swamp) player NEVER
// sees it, so the first-time 15–20 min run stays byte-identical. R1 ships the
// entry + biome + lantern behind this "same ngUnlocked-style gate" — a save has
// at least one victory recorded. R5 (a later item) promotes this to a
// PERSISTENT `save.reedsUnlocked` latch (set on the first swamp victory, with a
// SAVE_VERSION 9→10 migration + normalizer so every pre-v1.6 save loads false —
// nobody backfills access) and makes the title/atelier entry read that field.
// For R1 the gate is the pure victory predicate below.
// R5: the gate is the PERSISTENT save.flags.reedsUnlocked latch (set on the
// FIRST swamp victory — the same place ngUnlocked is set). The victory
// fallback keeps a legacy save (already has victories, flag never set
// because it predates v1.6) able to enter; a fresh no-victory save is locked.
export function reedsUnlocked(save) {
  if (save && save.flags && !!save.flags.reedsUnlocked) return true;
  return !!(save && save.stats && Number(save.stats.victories) > 0);
}

// R5 (v1.6 Module R): normalize the reedsUnlocked gate flag to a boolean.
// Every pre-v1.6 save (no field) loads FALSE — nobody backfills access.
export function normalizeReedsUnlocked(raw) {
  return !!raw;
}

// R5 (v1.6 Module R): the four BENEATH-THE-REEDS creatures as placeholder
// Field Guide cards (the creatures land in R3/R4 — these entries may reference
// them by name and must render even before they exist). Pure display data.
export const REEDS_CREATURES = [
  { id: 'wisp',     name: 'Wisp',          note: 'homes to your lantern light; BLUE-BLIND — it ignores blue, so keep the glow low or stand it off with red.' },
  { id: 'serpent',  name: 'Serpent',       note: 'burrows and telegraphs its lunge; PAINT THE RING to interrupt the strike before it breaks the surface.' },
  { id: 'leech',    name: 'Leech',         note: 'clings and STRANGLES your color; PAINT it off or HOP clear before the strangle drains you.' },
  { id: 'siltwyrm', name: 'The Silt Wyrm', note: 'the deep boss — strike the SURFACE POINT as it breaches the water; the lantern marks the target.' },
];

// ----------------------------------------------------------------
// R1 (v1.6 Module R): THE LANTERN — the Reeds biome's signature mechanic.
//
// The frog carries a PAPER LANTERN (a new L-key toggle). It has a light RADIUS
// and a CANDLE FUEL bar that DRAINS over time and REFILLS at fireflies /
// lantern-rest spots scattered through the biome. Unlit: short visibility
// radius, enemies sit at reduced aggro / sleeping; lit: full visibility, some
// enemies avoid the light. THE LANTERN is a real gameplay layer:
//
//   · All RULES live here (pure). The light radius is RENDER-ONLY — a single
//     CACHED radial gradient composited in _drawAll (no per-pixel work, no new
//     save data beyond R5's gate flag). Enemy light behaviors arrive in R3; R1
//     ships the state + HUD + fuel loop.
//   · `lightFactor` (0..1) is the value the new bestiary (R3) keys to: how far
//     the lantern's light actually reaches for a given fuel level.
//
// The fuel is a bounded [0,1] scalar. It drains at a constant per-second rate
// while the lantern is LIT (an unlit lantern costs nothing — you can't burn a
// flame you never lit). When it hits 0 the lantern goes out (auto-extinguish,
// so the player can't hover the lit toggle on an empty wick). Refills at a rest
// spot (full) and at a firefly (a smaller top-up), both driven by the caller's
// proximity check.
export const LANTERN = {
  lightRadius: 260,     // px world-space radius of a fully-fueled lit lantern
  minRadius: 88,        // px — the radius floor when the fuel runs low (never 0)
  fuelDrain: 0.04,      // fuel / second while LIT (a full wick burns ~25s)
  refillRestSpot: 0.6,  // fuel added per second while standing on a rest spot
  refillFirefly: 0.45,  // fuel added per second while inside a firefly's glow
  restSpotRadius: 90,   // px — a rest spot refills within this distance
  fireflyRadius: 64,    // px — a firefly refills within this distance
  // The light radius EASES toward its target (rather than snapping) so a dying
  // wick visibly dims before it flares back — a render-only smoothing rate.
  radiusEase: 6,
};

// R1: a clean lantern STATE object. `fuel` is clamped to [0,1]; `lit` is a
// boolean. A missing/garbled input reads back as an unlit lantern at full fuel
// (the safe default — a fresh Reeds run starts lit-ready). Pure.
export function lanternState(fuel = 1, lit = false) {
  const f = Number(fuel);
  const c = Number.isFinite(f) ? Math.max(0, Math.min(1, f)) : 1;
  return { fuel: c, lit: !!lit };
}

// R1: THE LIGHT FACTOR (0..1) the bestiary (R3) keys to. It is the DISTANCE
// FALLOFF of the lantern's light at a world point (x, y) measured from the
// lantern's light source (cx, cy), using the state's CURRENT radius (set by
// fuel) as the falloff extent: 1.0 at the source, easing to 0.0 at/ beyond the
// radius. An UNLIT (or empty-wick) lantern lights nothing — it reaches 0
// everywhere (the player then sees only the short ambient radius). R3 reads
// this per-creature so light-homing / light-avoiding / blue-blind behaviors key
// to how much light a creature actually receives. Pure + deterministic.
export function lightFactor(state, x, y, cx, cy) {
  const st = lanternState(state && state.fuel, state && state.lit);
  const R = lanternRadius(st);
  if (!st.lit || R <= 0) return 0;
  const d = Math.hypot(x - cx, y - cy);
  if (d >= R) return 0;
  // a light-like falloff: full at the center, a gentle curve down to the edge
  const t = 1 - d / R;
  return t * t * (3 - 2 * t);   // smoothstep, 1 -> 0 across the radius
}

// R1: advance the lantern one simulation step. `dt` seconds; `lit` is whether
// the lantern is currently lit; `nearRest`/`nearFirefly` are the caller's
// proximity booleans. Rules: drain (lit only), refill (rest spot + firefly,
// both, bounded to 1), auto-extinguish at 0 fuel. Returns a NEW state object
// (the caller stores it). Pure — no browser APIs.
export function lanternTick(state, dt, lit, nearRest = false, nearFirefly = false) {
  const st = lanternState(state && state.fuel, state && state.lit);
  let fuel = st.fuel;
  const isLit = !!lit;
  if (isLit) fuel -= LANTERN.fuelDrain * dt;
  if (nearRest) fuel += LANTERN.refillRestSpot * dt;
  if (nearFirefly) fuel += LANTERN.refillFirefly * dt;
  fuel = Math.max(0, Math.min(1, fuel));
  // auto-extinguish: a lit lantern with an empty wick goes out (you cannot
  // keep a flame lit on nothing). An unlit lantern never "lights" here.
  const outLit = fuel <= 0 ? false : isLit;
  return { fuel, lit: outLit };
}

// R1: the lantern's rendered light RADIUS (px) for a state — the render-only
// value that drives the cached radial gradient. It is a pure function of the
// state's fuel: a full wick reaches LANTERN.lightRadius and an empty one the
// LANTERN.minRadius floor. 0 when UNLIT (the short ambient radius is handled by
// the dark overlay, not this gradient). Pure.
export function lanternRadius(state) {
  const st = lanternState(state && state.fuel, state && state.lit);
  if (!st.lit) return 0;
  return LANTERN.minRadius + (LANTERN.lightRadius - LANTERN.minRadius) * st.fuel;
}

// ----------------------------------------------------------------
// R2 (v1.6 Module R): FLOODED LOWER BANKS + INVERTED-GRAVITY POCKETS.
//
// The Reeds world's distinct TRAVERSAL layer. The base swamp is 5400px wide;
// the Reeds variant is a DEEPER ~6000px layout (REEDS_WIDTH) — same painting,
// longer. Two traversal features:
//
//   1. FLOODED LOWER BANKS — the lower half of the world (y >= the band floor)
//      is open dark water: ground movement is SLOWER there (a documented
//      speed factor) but the frog has open swim lanes the light does not reach
//      as far into. Pure: a speed FACTOR for a world point (1.0 on the banks /
//      a lower value in the flood).
//   2. INVERTED-GRAVITY POCKETS — 2-3 AABB "root-ceiling" pockets scattered
//      through the Reeds. Inside one, the frog's hop becomes a downward
//      "clump": it rides the CEILING for a short beat. Reuses the existing
//      hopT / hop-lift mechanics with a SIGN FLIP on the hop displacement while
//      the frog is inside a pocket; reverts the moment it exits. NO new
//      physics engine — the pockets are just AABBs (world layout data) and the
//      flip is physics-local.
//
// All of this is PURE (testable headless). The pockets are deterministic
// (fixed data — not RNG) so the build is reproducible per seed and the smoke
// stage can pin exact inside/outside coordinates.
// ----------------------------------------------------------------

// R2: the Reeds variant is a DEEPER world than the base 5400px swamp.
export const REEDS_WIDTH = 6000;

// R2: the three INVERTED-GRAVITY POCKETS (AABBs, world px). Deterministic
// layout data (not RNG) — fixed so the build is reproducible and the smoke
// stage can pin inside/outside coordinates. Each is a root-ceiling pocket in
// the upper band (the frog hops UP and, inverted, clumps down onto the
// ceiling). Inside one, the hop displacement is sign-flipped.
export const REEDS_POCKETS = [
  { x: 1150, y: 120, w: 520, h: 360 },   // pocket 1 — Slick Hollow reach
  { x: 2900, y: 90,  w: 560, h: 380 },   // pocket 2 — mid-swamp
  { x: 4550, y: 130, w: 540, h: 350 },   // pocket 3 — the approach to the deep
];

// R2: is the world point (x, y) INSIDE an inverted-gravity pocket? A pure
// AABB test over REEDS_POCKETS. Outside all pockets (or a base-world point)
// it returns false, so the sign flip is a no-op there. Pure + deterministic.
export function inGravityPocket(x, y) {
  for (const pk of REEDS_POCKETS) {
    if (x >= pk.x && x <= pk.x + pk.w && y >= pk.y && y <= pk.y + pk.h) return true;
  }
  return false;
}

// R2: the FLOODED LOWER BANKS. The lower band (y >= FLOOD_FLOOR) is open dark
// water — a pure speed FACTOR for a world point: 1.0 on the banks, a slower
// value in the flood (the frog wades / swims). A base (non-Reeds) world never
// applies it (the caller checks reedsVariant), so a cycle-0 run's movement is
// byte-identical. The documented factor is FLOOD_FACTOR.
export const REEDS_FLOOD_FLOOR = 900;   // world-y where the open water begins
export const REEDS_FLOOD_FACTOR = 0.72; // ground speed multiplier in the flood

// R2: the ground-speed FACTOR at (x, y) for the Reeds flooded lower banks.
// 1.0 above the flood floor (the banks / swim-lane ceiling), FLOOD_FACTOR in
// the open water. Pure — no world data needed (the band is a horizontal line),
// so it is cheap to call every frame and trivially testable.
export function floodedWaterFactor(x, y) {
  return (typeof y === 'number' && y >= REEDS_FLOOD_FLOOR) ? REEDS_FLOOD_FACTOR : 1;
}

// R2: the hop DISPLACEMENT (px) for a frog mid-hop, SIGN-FLIPPED while inside
// an inverted-gravity pocket. It reuses the EXACT base-hop lift curve the
// player already uses — Math.sin(PI*(1 - hopT/HOP_DUR)) * HOP_LIFT (a 0->peak
// ->0 arc over the 0.22 s hopT) — and negates it inside a pocket so the frog
// "clumps" DOWN onto the ceiling instead of lifting up. hopT <= 0 -> 0 (not
// hopping). Outside a pocket the sign is + (normal upward hop), so the base
// swamp behavior is byte-identical. Pure.
export const REEDS_HOP_DUR = 0.22;
export const REEDS_HOP_LIFT = 26;
export function hopLift(hopT, x, y) {
  if (!(hopT > 0)) return 0;
  const lift = Math.sin(Math.PI * (1 - hopT / REEDS_HOP_DUR)) * REEDS_HOP_LIFT;
  return inGravityPocket(x, y) ? -lift : lift;
}

// ----------------------------------------------------------------
// K8 (v1.5 M2): the CHALLENGE REWARD — the Masterpiece "The Heron, Waking".
//
// First-EVER Curator Challenge completion mints a UNIQUE MASTERPIECE painting:
// "The Heron, Waking" — a special framed work shown in the Gallery Wall + the
// Curator's Ledger. It is a PURE COLLECTION piece: unbuyable, not a loadout
// painting, not a purchase (it is minted by completing the daily challenge,
// not bought in the shop). SUBSEQUENT completions give a small repeatable gold
// bonus by rank (a top-1 finish pays more than a low rank). Reuses the
// existing gold/latch machinery: the FIRST-completion mint is idempotent (the
// masterpiece flag latches so it is awarded EXACTLY once, ever); the
// repeatable rank bonus is a fresh gold-earn event keyed by (seed, rank) so a
// given (day, rank) pays once but each new day/retry pays again.
//
// The masterpiece is gated by the save.goldEarned.masterpiece latch (set when
// the first completion's gold fires), NOT a PAINTINGS id — so it never appears
// in the shop, loadout, the retirement threshold (canRetireCollection),
// makeTuning, or the PAINTINGS catalog (which stays at 10). It is pure
// collection + display. No new save field is introduced, so SAVE_VERSION
// stays at 9.
export const MASTERPIECE = {
  id: 'the-heron-waking',          // a display id (NOT in PAINTINGS / owned)
  name: 'The Heron, Waking',
  desc: 'The Gilded Heron lifts from the gray shore at first light — a masterpiece the Curator hung in gold.',
  // a distinct gilded art palette (read by the gallery/ledger frame + motif):
  art: { bg: '#f3e6c4' },
  // first-ever challenge completion: mint the masterpiece + pay this much gold
  firstGold: 15,
  // subsequent completions: a small REPEATABLE bonus by rank (1 = best).
  rankGold: { 1: 5, 2: 3, 3: 3, 4: 2, 5: 2 },  // lower ranks fall back to the 5-rank value
};
// The rank a filed challenge score sits at in the top-5 list (1 = the top
// entry). Deterministic from the list (descending by score).
export function challengeRank(score, list) {
  const arr = Array.isArray(list) ? list : [];
  const sc = Number(score);
  let n = 0;
  for (const e of arr) if (Number(e && e.score) > sc) n += 1;
  return n + 1;
}
// The repeatable rank bonus for a rank (the rankGold table, clamped to 1..5).
export function challengeRankBonus(rank) {
  const r = Math.max(1, Math.min(5, Math.floor(Number(rank) || 5)));
  return MASTERPIECE.rankGold[r] || MASTERPIECE.rankGold[5];
}
// The repeatable gold-earn EVENT for a (seed, rank) — a fresh, per-day key so
// each new day / retry can pay again (the latch is per-key, not global). The
// amount is the rank bonus. Pure (builds the event; goldEarn applies it).
export function challengeRankEvent(seed, rank) {
  const r = Math.max(1, Math.min(5, Math.floor(Number(rank) || 5)));
  return { key: `chal-rank-${Math.floor(Number(seed))}-${r}`, amount: challengeRankBonus(r) };
}
// K8: has a save minted the Masterpiece yet? The mint is latched by the
// EXISTING gold-earn map (save.goldEarned.masterpiece) set when the first
// completion's +15 gold fires — the same idempotency mechanism the rest of the
// gold economy uses, so NO new save field (and no SAVE_VERSION bump) is needed.
// A legacy save (no goldEarned map, or no such key) reads false (not yet
// minted). Pure.
export function isMasterpieceMinted(save) {
  return !!(save && save.goldEarned && save.goldEarned.masterpiece);
}
// K8: the pure completion reward. Called by game.js on a challenge VICTORY,
// AFTER the score has been filed (challengeFileScore) so the rank is known.
// First-EVER completion: mint the Masterpiece (latch goldEarned.masterpiece) +
// pay MASTERPIECE.firstGold (15) — EXACTLY once, ever. Subsequent completions:
// a small REPEATABLE bonus by rank (top-1 pays more), keyed by (seed, rank) so
// each new day / retry can pay again. Returns { minted, gold, rank } (gold is
// the amount actually banked this call — 0 if the latch already held). Mutates
// save in place (the caller persists it). Pure with respect to world state.
export function challengeComplete(save, seed, score) {
  const res = { minted: false, gold: 0, rank: 1 };
  if (!save) return res;
  const list = normalizeChallengeScores(save && save.challengeScores);
  res.rank = challengeRank(score, list);
  if (!isMasterpieceMinted(save)) {
    // first-ever: mint the masterpiece + first gold (latched via goldEarn).
    res.minted = goldEarn(save, { key: 'masterpiece', amount: MASTERPIECE.firstGold }) > 0;
    res.gold += res.minted ? MASTERPIECE.firstGold : 0;
  } else {
    // subsequent: the repeatable rank bonus (fresh per (seed, rank) key).
    res.gold += goldEarn(save, challengeRankEvent(seed, res.rank));
  }
  return res;
}

// ----------------------------------------------------------------
// G1 (v1.3 M15): Gold — a NEW META-ONLY currency.
//
// Gold is earned ONLY from first-time meta achievements (the "milestones" of a
// longer career): the first kill of each boss type, the first completion of
// each painting-synergy duo, and an orb milestone (first 100 orbs in a run).
// It is deliberately META-ONLY:
//   · it is NOT a 4th paint color (the 3-hue red/blue/green pillar is untouched),
//   · it does NOT feed makeTuning / combat tuning (no balance impact), and
//   · it is banked once (idempotent per event) and spent later (G2 onward).
//
// The earn RULE is pure + headless-testable: `goldEarn(save, event)` inspects
// `save.goldEarned` (a {key:true} map) and, for an event not yet fired, adds the
// amount to `save.gold` and latches the key so it never fires twice. Legacy
// saves (no gold fields) migrate forward as gold 0 / empty goldEarned.
//
// Amounts (documented in PROJECT_STATE.md; tuned so a career that reaches NG+
// — first-time gray-heron kill + NG+ green-heron kill + the synergy duos + the
// orb milestone — banks enough to clear BOTH G2 gold paintings (25 + 40 = 65)):
//   first kill of the Great Gray Heron ......... 15
//   first kill of the Great Green Heron (NG+) .. 20
//   first completion of each synergy duo ........ 8  (3 duos -> 24)
//   first 100 orbs in a single run .............. 8
//   ----------------------------------------------
//   max gold a career can bank .................. 67
export const GOLD = {
  // boss: the GILDED Heron (K4, NG+ cycle 3+) pays no new gold of its own — it
  // is a later-cycle escalation of the NG+ boss (the player already banked the
  // green heron's 20 gold in cycle 1). goldTotal() counts it as 0.
  boss: { gray: 15, green: 20, gilded: 0 },
  synergyDuo: 8,
  orbMilestone: { at: 100, amount: 8 },
};

// Build the gold event for the FIRST kill of a heron boss type (`kind` =
// 'gray' | 'green' | 'gilded'). Returns null for an unknown kind (no event, no
// gold). The GILDED Heron (K4, NG+ cycle 3+) awards NO meta gold of its own
// (boss.gilded === 0): it is a later-cycle escalation of the NG+ boss, and the
// player has already banked the green heron's gold in cycle 1. Keeping the
// amount at 0 also leaves goldTotal() (and the G1/C2 smoke assertions)
// untouched.
export function goldEventBoss(kind) {
  const amount = GOLD.boss && GOLD.boss[kind];
  if (!amount) return null;
  return { key: `boss:${kind}`, amount };
}

// Build the gold event for the FIRST completion of a painting-synergy DUO.
// `synergy` is the object from activeSynergy/loadout (carries `pair: [a,b]`).
// The stable key is the sorted pair key (a|b) so each distinct duo latches once.
export function goldEventSynergy(synergy) {
  if (!synergy || !Array.isArray(synergy.pair) || synergy.pair.length < 2) return null;
  return { key: `synergy:${_pairKey(synergy.pair[0], synergy.pair[1])}`, amount: GOLD.synergyDuo };
}

// Build the gold event for the ORB MILESTONE (first time a run's orb count
// reaches GOLD.orbMilestone.at). runOrbs is the run's cumulative orb count.
export function goldEventOrbs(runOrbs) {
  const at = GOLD.orbMilestone.at;
  if (!(runOrbs >= at)) return null;
  return { key: `orbs:${at}`, amount: GOLD.orbMilestone.amount };
}

// The CORE gold earn rule (pure). `event` = { key, amount }. Returns the amount
// just banked (0 if the key already fired, the amount is invalid, or there is no
// save). Idempotent per event key via save.goldEarned; the save is mutated in
// place (the caller persists it).
export function goldEarn(save, event) {
  if (!save || !event) return 0;
  const key = typeof event.key === 'string' && event.key ? event.key : null;
  const amount = Math.floor(Number(event.amount));
  if (!key || !Number.isFinite(amount) || amount <= 0) return 0;
  if (!isPlainObj(save.goldEarned)) save.goldEarned = {};
  if (save.goldEarned[key]) return 0; // already banked — fires exactly once
  if (!Number.isFinite(Number(save.gold))) save.gold = 0;
  save.gold = Math.floor(Number(save.gold)) + amount;
  save.goldEarned[key] = true;
  return amount;
}

// The total gold a career could ever bank (sum of every event amount, once).
// Pure + handy for tests/docs (should be >= the G2 gold-painting prices).
export function goldTotal() {
  let total = 0;
  for (const kind of Object.keys(GOLD.boss)) total += GOLD.boss[kind];
  total += Object.keys(SYNERGIES).length * GOLD.synergyDuo;
  total += GOLD.orbMilestone.amount;
  return total;
}

// ----------------------------------------------------------------
// N3 (v1.3 M14): The Great Green Heron — the New Game+ final boss.
//
// A *second* final boss that appears on NG+ cycles (ngCycle >= 1) INSTEAD of the
// Great Gray Heron (the gray heron stays the first-time boss). It reuses the
// existing heron AI / phase machine (bossStep) and the 3-hue awakening (paint)
// end-to-end — the only differences are:
//   · a distinct GREEN palette (rendered in _drawHeron via h.green), and
//   · ONE swapped mechanic: painting it with MOSS (green) pins it in place
//     briefly (the E1/MidHeron "reed pinning" idea, reused at boss scale).
//
// It has slightly MORE HP than the gray heron (30k -> 36k, +20%). Because the
// heron is fixed-HP in tuning (deliberately NOT N2-scaled — see N2), the fight
// stays in the same ~2-3 min human band; the pin is a small extra damage window
// the player earns with green play, which offsets the HP bump and keeps the
// fight time close to the gray heron's (bosspace-style band; see the N3 note in
// PROJECT_STATE.md for the expected fight time).
export const GREEN_HERON = {
  kind: 'green',                 // the NG+ boss (vs the gray heron's 'gray')
  hp: 36000,                     // +20% over the gray heron's 30000 — same time band
  awakenNeed: { red: 45, blue: 45, green: 45 }, // 3-hue rhythm UNCHANGED (core pillar)
  greenHue: '#5a9e3d',           // moss green — the distinct palette
  greenHueLight: '#9ed483',
  pinNeed: 30,                   // Moss units to trigger a pin (~5 swipes @ 6/hit)
  pinDuration: 3.0,              // the Moss reed pin holds it in place ~3s (E1 reed-pin, boss scale)
};

// N3: the swapped boss mechanic — the Great Green Heron's reed pin, as a PURE
// timer so it is testable without a browser. Painting the green heron with MOSS
// (when it is not already pinned) accumulates h.pinCharge; once it reaches
// GREEN_HERON.pinNeed, game.js sets h.pinned = GREEN_HERON.pinDuration. While
// h.pinned > 0 the heron is HELD IN PLACE: _updateBoss skips its bossStep
// attacks (no retaliation / no movement), and it takes 2x paint damage (the
// vulnerable window — rewarding green play). greenHeronPinTick decays the hold;
// it returns 'pinned' while held, 'pin-off' on the frame it releases, or 0 when
// not pinned. The gray heron never carries `pinned`, so this is a no-op for it
// (first-time run byte-identical).
export function greenHeronPinTick(h, dt) {
  if (!h || !(h.pinned > 0)) return 0;
  h.pinned -= dt;
  if (h.pinned <= 0) { h.pinned = 0; return 'pin-off'; }
  return 'pinned';
}

// ----------------------------------------------------------------
// K4 (v1.5 M2): The GILDED HERON — the NG+ cycle-3+ final boss.
//
// A THIRD final boss that REPLACES the Great Green Heron as the cycle-3+ boss
// (cycle 0 stays the gray heron, cycles 1-2 stay the green heron). It reuses
// the existing heron AI / phase machine (bossStep) and the 3-hue awakening
// (paint) end-to-end, exactly like the green heron — the differences are:
//   · a distinct GOLD-tinted palette (rendered in _drawHeron via h.gilded),
//   · MORE fixed HP (36k -> 42k, +16% over the green heron — the boss is
//     deliberately NOT N2-scaled, so the escalation is a fixed bump), and
//   · ONE new mechanic: its GILDED PLUMAGE ABSORBS the player's heal sources.
//
// The plume mechanic: the heron runs a ~30s phase cycle (the GILDED_HERON.plume
// timing below). While it is in the ACTIVE "plume" phase, its gilded plumage
// glows and it ABSORBS healing — the player's green-paint heal sources (painting
// enemies green AND standing in green) heal 0. In the COOLDOWN gap between
// plumes the player's green heal works normally. This forces the player to
// heal in the gaps, adding a damage-avoidance rhythm on top of the 3-hue
// awaken.
//
// The plume is a PURE state machine (gildedPlumeTick) driven by h.plumeT so it
// is testable without a browser — the same pattern as the green heron's reed
// pin (greenHeronPinTick). game.js calls gildedPlumeTick each frame, reads
// gildedPlumeActive(h) to decide whether to suppress the player's green heal,
// and paints the glowing plumage while active. The gray and green herons never
// carry `plumeT`, so a first-time (cycle-0) and cycle-1/2 (green) run is
// byte-identical to pre-K4.
export const GILDED_HERON = {
  kind: 'gilded',                // the NG+ cycle-3+ boss (vs 'gray' / 'green')
  minCycle: 3,                   // the NG+ cycle from which it replaces the green heron
  hp: 42000,                     // +16% over the green heron's 36k (fixed-HP bump)
  awakenNeed: { red: 45, blue: 45, green: 45 }, // 3-hue rhythm UNCHANGED (core pillar)
  gildedHue: '#d9a52e',          // gold — the distinct palette
  gildedHueLight: '#ffe9a8',
  // The plume phase cycle: the plumage is ACTIVE (absorbing heal) for
  // plumeActive seconds, then rests (the heal gap) for plumeCooldown seconds,
  // then re-activates. A ~30s cycle as specced (10s active + 20s gap).
  plumeActive: 10.0,
  plumeCooldown: 20.0,
};

// K4: is the GILDED heron currently in its ACTIVE plume phase (absorbing heal)?
// Reads the plumeT state machine (see gildedPlumeTick): while plumeT > 0 the
// plumage is glowing and the player's green heal is suppressed. Pure.
export function gildedPlumeActive(h) {
  return !!(h && h.gilded && (h.plumeT || 0) > 0);
}

// K4: the plume phase state machine, as a PURE timer (testable headless).
// h.plumeT is the remaining ACTIVE-plume time (>0 = absorbing); h.plumeCd is
// the cooldown before the next plume fires. Returns 'plume-on' on the frame the
// plumage activates (glow + heal suppression begins), 'plume-off' on the frame
// it releases (the heal gap opens), or 0 when steady (no transition this frame).
//
// A gilded heron carries { plumeT, plumeCd, gilded: true }; the gray and green
// herons never carry `gilded`, so this is a no-op for them (byte-identical).
// The cycle: when the plumage is active (plumeT>0) it counts down to the gap;
// in the gap (plumeCd>0) it counts down to the next activation.
export function gildedPlumeTick(h, dt) {
  if (!h || !h.gilded) return 0;
  if ((h.plumeT || 0) > 0) {
    // ACTIVE plume: count down to the gap.
    h.plumeT -= dt;
    if (h.plumeT <= 0) { h.plumeT = 0; h.plumeCd = GILDED_HERON.plumeCooldown; return 'plume-off'; }
    return 0;
  }
  if ((h.plumeCd || 0) > 0) {
    // COOLDOWN gap: count down to the next activation.
    h.plumeCd -= dt;
    if (h.plumeCd <= 0) { h.plumeCd = 0; h.plumeT = GILDED_HERON.plumeActive; return 'plume-on'; }
    return 0;
  }
  return 0;
}

// ----------------------------------------------------------------
// R4 (v1.6): THE SILT WYRM — the 4th boss ARCHETYPE (the deferred item). The
// end-of-Reeds boss: a SUBTERRANEAN creature that moves THROUGH the terrain,
// surfacing only at 3 TELEGRAPHED fixed points (a ripple-ring tell ~1.5 s
// before it breaches; between surfaces it is underground + INVULNERABLE and
// its body line slithers beneath). The 3-hue awaken STILL applies through the
// SAME `paintBoss` latch (this object carries `hue`/`awakened`/`awakenNeed`,
// so `paintBossHit`→`paintBoss` fires the identical awaken event + the 2x
// awakened paint window) — this state machine is the NEW MOVEMENT pattern
// (underground transit between surface points instead of flight/lunge). HP in
// the 48k class (above the gilded 42k — the biome's apex). Reeds-mode only.
export const SILT_WYRM = {
  kind: 'wyrm',                 // the 4th boss archetype (vs gray/green/gilded)
  hp: 48000,                    // 48k — above the gilded 42k (the biome's apex)
  awakenNeed: { red: 45, blue: 45, green: 45 }, // the SAME 3-hue rhythm as the herons
  strikeDmg: 12,                // the surfaced strike's damage (a big hit, dodgeable)
  strikeReach: 220,             // a frog within this of the surface point is hit
  surfacePoints: 3,             // the telegraphed breach points on the arena line
  telegraph: 1.5,               // the ripple-ring tell before a breach (~1.5 s)
  surfaced: 7.0,                // the surfaced window (PAINT IT — the dominant phase)
  transit: 1.8,                 // underground transit between surface points (invulnerable)
  surfaceY: 780,                // the arena water line the body slithers along
  mudHue: '#2c2420',            // the distinct dark-mud palette
  mudHueLight: '#5a4a3e',
  // P10: the body line is drawn as a CAPPED segment count (no per-frame
  // allocation) so 60fps holds (the underground slither is the risk).
  bodySegments: 14,
};

// R4: THE WYRM STATE MACHINE (a pure movement pattern; testable headless).
// h = the boss object (carries wyrm, phase, phaseT, surfIdx, strikeArmed,
// awakened). Advances dt; returns an event: 'breach' (just surfaced at its
// point — paintable now) | 'strike' (the breach-strike fires — the caller
// applies strikeDmg if the frog is at the surface point) | 'defeated' (hp<=0)
// | 0 (steady).
//
// The RHYTHM (per the ROADMAP spec): the wyrm is SUBTERRANEAN — it moves
// THROUGH the terrain (phase 'transit', underground + INVULNERABLE +
// untargetable; the body slithers beneath), then TELEGRAPHS a breach with a
// growing ripple ring at its next surface point (phase 'telegraph'). When the
// tell lapses it SURFACES at that point (phase 'surfaced' — PAINTABLE through
// the existing paintBoss path) and its breach-strike hits the lane AT the
// surface point (the frog dodges by standing clear of the marked point during
// the tell; the lantern / ripple ring marks the target). The 3-hue awaken
// (h.awakened) speeds the RHYTHM: shorter transit + telegraph (the full-damage
// phase + faster surfacing cadence), exactly like the herons. Between surfaces
// the caller skips paint hits (unpaintable underground).
export function wyrmStep(h, dt, view, tuning, now) {
  h.phaseT -= dt;
  if (h.hp <= 0) return 'defeated';
  // The awaken WINDOW lapses exactly like the herons (bossStep): after the
  // bossAwakenDuration the wyrm de-awakens and its hue resets, so the 3-hue
  // rhythm is a recurring CYCLE (repaint all three to re-awaken), not a
  // permanent state. Same state-machine behavior as the herons.
  if (h.awakened) {
    h.awakenedT = (h.awakenedT || 0) - dt;
    if (h.awakenedT <= 0) { h.awakened = false; h.hue.red = 0; h.hue.blue = 0; h.hue.green = 0; }
  }
  const faster = h.awakened ? 0.62 : 1.0;   // the awaken speeds the surfacing cadence
  if (h.phase === 'transit') {
    // underground: the body slithers toward the next surface point.
    if (h.phaseT <= 0) {
      h.phase = 'telegraph';
      h.phaseT = SILT_WYRM.telegraph * faster;
      // the breach locks to THIS surface point — the ripple ring marks the
      // target so the frog stands clear of it during the tell.
      h.strikeArmed = true;
    }
  } else if (h.phase === 'telegraph') {
    // the growing ripple-ring tell at the NEXT surface point.
    if (h.phaseT <= 0) {
      h.phase = 'surfaced';
      h.phaseT = SILT_WYRM.surfaced;
      return 'breach';   // it surfaces at its point (paintable now)
    }
  } else if (h.phase === 'surfaced') {
    if (h.strikeArmed && h.hp > 0) {
      h.strikeArmed = false;
      return 'strike';   // the breach-strike hits the lane at the surface point
    }
    if (h.phaseT <= 0) {
      // withdraw underground and begin the transit toward the NEXT point.
      h.phase = 'transit';
      h.phaseT = SILT_WYRM.transit * faster;
      h.surfIdx = (((h.surfIdx || 0) + 1) % SILT_WYRM.surfacePoints);   // next surface point
    }
  }
  return 0;
}
// R4: the wyrm's surface point (index 0..n-1), cycling on its arena line. The
// 3 points span the boss ARENA (the last ~750px of the world, where the frog
// can reach them during the end-of-Reeds fight). Pure; returns [x, y].
export function wyrmSurfacePoint(h, surfIdx, worldW) {
  const n = SILT_WYRM.surfacePoints;
  const i = ((surfIdx % n) + n) % n;
  const x = (worldW - 900) + (i / (n - 1)) * 750;   // arenaStart .. +750
  return [x, SILT_WYRM.surfaceY];
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
// Retire-eligibility check: the FULL PIGMENT collection owned (the 8 base
// PAINTINGS — the two gold-tier G2 works are a separate NG+ meta tier and do
// NOT raise this bar) AND at least one hung in the loadout. Uses
// PAINTINGS.filter(!goldTier).every, so the bar tracks the pigment catalog
// (stable at 8). Pure.
export function canRetireCollection(save) {
  const owned = (save && Array.isArray(save.owned)) ? save.owned : [];
  const allOwned = PAINTINGS.filter(p => !p.goldTier).every(p => owned.includes(p.id));
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
  // G2 (v1.3 M15): two GOLD-tier paintings — priced in the meta gold currency
  // (not pigment), unlocked only on NG+ cycles, and applied when OWNED (a
  // permanent meta bonus, not a loadout slot). `goldTier: true` + `goldCost`
  // mark them; the existing pigment `cost` is absent. The motif renderer
  // reuses existing art shapes (no new art pipeline).
  { id: 'gilded-meridian', name: 'Gilded Meridian', goldTier: true, goldCost: 25,
    desc: 'The line is gilded. Every orb is worth +10%, forever.',
    art: { bg: '#4a3d6b', shape: 'king', accent: '#ffd75e' } },
  { id: 'verdant-crown', name: 'Verdant Crown', goldTier: true, goldCost: 40,
    desc: 'A crown of living moss. Moss mends +1 extra health per touch.',
    art: { bg: '#2f5e2a', shape: 'garden', accent: '#9ed483' } },
];

// G2 (v1.3 M15): the gold-tier subset of the catalog (the NG+-gated, gold-
// priced paintings). Pure.
export function goldPaintings() {
  return PAINTINGS.filter(p => p.goldTier);
}
// G2 (v1.3 M15): can a save buy this gold-tier painting? It must be a gold
// painting and the save must hold at least `pt.goldCost` gold. A non-gold
// painting is never bought with gold (returns false). Pure.
export function canAffordGold(save, pt) {
  if (!pt || !pt.goldTier) return false;
  const gold = save ? Number(save.gold) || 0 : 0;
  return gold >= pt.goldCost;
}

// G3 (v1.3 M15): the ONE-TIME 'Gilded Frame' prestige tier — a permanent,
// saved, gold-priced tuning bump applied LAST in makeTuning, ON TOP OF the
// existing 'Rehung Frame' gallery bonus. A single 50g purchase for:
//   +3 pigment of each color at the start of every run (start ink)
//   +15% orb / pickup value (orb value)
// It STACKS distinctively with the Rehung Frame: the gilded ink is added on
// top of the Rehung Frame ink (so a save with both gets galleryInkBonus =
// 2*level + 3), and the gilded orb multiplier is applied after the Rehung
// Frame orb multiplier (so pickupValue is multiplied by both). Both feed the
// SAME existing tuning fields (galleryInkBonus / pickupValue), so no new
// combat surface. Pure + testable.
//
// NG+/gold-gated: a first-time (cycle-0) save never qualifies (ngCycle < 1),
// so makeTuning is never called with gilded=true on a cycle-0 save — the
// gilded keys are added ONLY when gilded is truthy, keeping a cycle-0 tuning
// byte-identical (see the smoke test's deep-equal fingerprint).
export const GILDED_FRAME = {
  cost: 50,        // gold, ONE-TIME
  ink: 3,          // +3 of each pigment color at run start
  orbMult: 1.15,   // +15% orb / pickup value
};
// G3 (v1.3 M15): has this save already bought the Gilded Frame? Truthy check
// on save.gildedFrame (a boolean, set once and never removed). A missing /
// falsy field (a fresh or old-format save) means NOT bought. Pure.
export function isGilded(save) {
  return !!(save && save.gildedFrame);
}
// G3 (v1.3 M15): can a save buy the Gilded Frame? It must be an NG+ save
// (ngCycle >= 1), NOT already gilded (one-time), and hold at least
// GILDED_FRAME.cost gold. Pure.
export function canBuyGildedFrame(save) {
  if (!save) return false;
  if (isGilded(save)) return false;                       // one-time
  if ((Math.floor(Number(save.ngCycle) || 0)) < 1) return false;  // NG+ gate
  return (Number(save.gold) || 0) >= GILDED_FRAME.cost;
}
// G3 (v1.3 M15): attempt the one-time Gilded Frame purchase. On success:
// deduct the gold, set save.gildedFrame = true, and return true. Refuses
// (returns false, no change) when NG+-gated, insufficient gold, or already
// bought. Pure — no DOM.
export function buyGildedFrame(save) {
  if (!save) return false;
  if (!canBuyGildedFrame(save)) return false;
  save.gold = (Number(save.gold) || 0) - GILDED_FRAME.cost;
  save.gildedFrame = true;
  return true;
}

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

// K3 (v1.5 M3): the STORM SURGE — a short scripted set-piece in the final
// stretch (past The Gray Shore, i.e. zone index 4 = "zone 5"). A ~15 s beat:
// a bounded burst of fast mosquitoes + a rain buff (reuses the E2 weatherFactor
// transient-multiplier machinery on the rain phase). NON-blocking: the frog can
// push straight through it — the surge NEVER feeds runT / pacing. Clearing it
// (all its mosquitoes gone before it expires) scatters a bonus orb burst.
// Deterministic trigger so a run replays the same beat; bounded so the enemy
// count can never grow unbounded (it rides the shared spawn cap in game.js).
export const STORM_SURGE = {
  duration: 15,      // seconds the beat is live (rain buff rides this)
  burstCount: 9,     // total mosquitoes the surge throws out (bounded)
  burstWindow: 4.5,  // seconds over which the burst is spread
  leadIn: 1.0,       // banner/stinger lead-in before the first mosquito (base)
  rain: { fields: ['splashRadius'], mult: 1.3 },  // = the rain weather phase
  orbCount: 4,       // bonus orbs scattered on a clear
};
// Pure: build a fresh surge state for a given run seed. The opening has a
// seeded lead-in (0.0..2.0 s of jitter) so the banner + stinger land just
// before the first mosquito, and the same seed replays the same opening.
export function stormSurgeFor(seed) {
  const s = (seed * 2654435761 + 0x9e3779b9) >>> 0;
  const rng = mulberry32(s);
  const leadIn = STORM_SURGE.leadIn + rng() * 2;
  return { active: false, t: 0, leadIn, burst: 0, burstT: 0, spawnT: 0, fired: false, awarded: false, done: false };
}
// Pure: the synthetic rain phase the surge drives through the E2 weather
// machinery (a `weatherFactor`-sized multiplier on splashRadius for the whole
// beat). Sizing it to the surge means the buff ramps in, holds, and ramps out
// back to exactly base at expiry — transient, no residue.
export function stormSurgeRainPhase() {
  return {
    id: 'surge-rain', name: 'Storm Surge rain', tint: WEATHER_PHASES[0].tint,
    duration: STORM_SURGE.duration, mult: STORM_SURGE.rain.mult, fields: [...STORM_SURGE.rain.fields],
  };
}
// Pure: does a surge state count as "cleared" (all burst spawned & all its
// mosquitoes gone) with no bonus yet awarded? `surgeEnemiesLeft` is the count
// of live mosquitoes the surge spawned.
export function stormSurgeCleared(surge, surgeEnemiesLeft) {
  return surge && surge.active && !surge.awarded && surge.burst >= STORM_SURGE.burstCount
    && surgeEnemiesLeft === 0;
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
// (v1.4 M1: 7 → 8 adds the `firstVictoryCinematic` flag —
// a one-shot first-victory cinematic beat; old saves get the beat ONCE since
// they've never seen it, so the flag migrates forward as false.
// v1.5 K7: 8 → 9 adds the `challengeScores` list — the CURATOR CHALLENGE's
// saved best-score file (top 5, each {seed,date,score}); old saves (no such
// field) migrate forward with an empty list.)
// R5 (v1.6 Module R): bumped 9 -> 10 for the BENEATH-THE-REEDS gate flag (save.flags.reedsUnlocked) + the four Reeds Field Guide entries. A pre-v1.6 save loads reedsUnlocked FALSE (nobody backfills access) via the v9->v10 migration + normalizeReedsUnlocked.
export const SAVE_VERSION = 10;

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
// N1 (v1.3 M14): v4 adds `save.ngCycle` (the New Game+ cycle index; 0 = a
// first-time player who has never cleared a victory, no NG+ UI visible). Old
// v3 saves (no such field) migrate forward with ngCycle defaulted to 0, so a
// first-time save keeps loading unchanged and shows zero new UI.
// N4 (v1.3 M14): v5 adds `save.ngModifier` — the player-chosen expedition
// modifier for the current NG+ cycle (one of MODIFIERS' ids, or null/empty for
// "no modifier"). A v4 save (no such field) migrates forward with the modifier
// defaulted to null (no modifier), so old NG+ saves keep loading unchanged and
// run their cycle with no modifier.
// G1 (v1.3 M15): v6 adds `save.gold` (counter, META-ONLY — never touches
// combat tuning) and `save.goldEarned` ({[key]: true} map, idempotency latch
// so each first-time gold event fires exactly once). A v5 save (no such
// fields) migrates forward with gold defaulted to 0 and goldEarned to {}, so
// old saves keep loading unchanged and start with no gold / no latches.
// G3 (v1.3 M15): v7 adds `save.gildedFrame` (boolean) — the ONE-TIME,
// permanent 'Gilded Frame' prestige tier, bought with 50 gold on an NG+
// cycle. A v6 save (no such field) migrates forward with gildedFrame
// defaulted to false, so old saves keep loading unchanged and are simply
// NOT-yet-gilded.
const SAVE_MIGRATIONS = [
  {
    from: 1, to: 2,
    fn: (out) => { out.galleryBonus = Math.max(0, Math.floor(Number(out.galleryBonus) || 0)); },
  },
  {
    from: 2, to: 3,
    fn: (out) => { out.tutorialDrills = normalizeDrills(out.tutorialDrills); },
  },
  {
    from: 3, to: 4,
    fn: (out) => { out.ngCycle = normalizeNGCycle(out.ngCycle); },
  },
  {
    from: 4, to: 5,
    fn: (out) => { out.ngModifier = normalizeNGModifier(out.ngModifier); },
  },
  {
    from: 5, to: 6,
    fn: (out) => {
      // G1 (v1.3 M15): gold counter + idempotency map. A legacy v5 save
      // (no such fields) migrates forward with gold 0 / empty map.
      out.gold = Math.max(0, Math.floor(Number(out.gold) || 0));
      out.goldEarned = normalizeGoldEarned(out.goldEarned);
    },
  },
  {
    from: 6, to: 7,
    fn: (out) => {
      // G3 (v1.3 M15): the one-time Gilded Frame tier. A legacy v6 save
      // (no such field) migrates forward with gildedFrame defaulted to
      // false (not-yet-gilded), so old saves keep loading unchanged.
      out.gildedFrame = normalizeGildedFrame(out.gildedFrame);
    },
  },
  {
    from: 7, to: 8,
    fn: (out) => {
      // M1 (v1.4): the first-victory cinematic flag. Every save that migrates
      // forward (v7 or older) has NEVER seen the beat, so it reads back as
      // false — the player gets the beat exactly once on their next first
      // victory. A v8 save that already played it stays true.
      out.firstVictoryCinematic = normalizeFirstVictoryCinematic(out.firstVictoryCinematic);
    },
  },
  {
    from: 8, to: 9,
    fn: (out) => {
      // K7 (v1.5 M2): the Curator Challenge best-score file. A legacy v8 save
      // (no such field) migrates forward with an empty list — an old player
      // who has never run the challenge simply has no scores yet. A v9 save
      // with existing scores is normalized (shape-cleaned) in place.
      out.challengeScores = normalizeChallengeScores(out.challengeScores);
    },
  },
  {
    from: 9, to: 10,
    fn: (out) => {
      // R5 (v1.6 Module R): the BENEATH-THE-REEDS gate flag. Every
      // pre-v1.6 save (no field) migrates forward with reedsUnlocked
      // DEFAULTED TO FALSE — nobody backfills access to the new biome.
      out.flags.reedsUnlocked = normalizeReedsUnlocked(out.flags.reedsUnlocked);
    },
  },
];

// N1 (v1.3 M14): normalize the New Game+ cycle index — a non-negative integer
// (0 = first-time player). Non-finite / non-integer / negative values fall back
// to 0 so a corrupt field never breaks a load (the loader never throws).
function normalizeNGCycle(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// N4 (v1.3 M14): normalize the player-chosen expedition modifier. A valid
// MODIFIERS id is kept as-is; anything else (missing, non-string, unknown)
// normalizes to null (no modifier) so a corrupt/legacy field never breaks a
// load. Pure.
function normalizeNGModifier(v) {
  return typeof v === 'string' && MODIFIERS[v] ? v : null;
}

// G1 (v1.3 M15): normalize the gold idempotency map to a clean
// `{[key]: true}` object. A non-object (legacy/garbled) field normalizes to
// `{}`; any string key that is truthy is carried as `true`. Pure — testable
// headless. (Keys are internal to the gold system, so no fixed whitelist is
// required; this just guarantees the shape survives a round-trip.)
function normalizeGoldEarned(raw) {
  const out = {};
  if (!isPlainObj(raw)) return out;
  for (const k of Object.keys(raw)) if (typeof k === 'string' && raw[k]) out[k] = true;
  return out;
}

// G3 (v1.3 M15): normalize the one-time Gilded Frame flag — a boolean. A
// missing / falsy value (a fresh or legacy save) reads back as false
// (not-yet-gilded). Pure — testable headless.
function normalizeGildedFrame(raw) {
  return !!raw;
}

// M1 (v1.4): normalize the first-victory cinematic flag — a boolean. A
// missing / falsy value (a fresh save, or ANY save migrating up from v7 or
// older) reads back as false (the beat has NOT been seen — every old save gets
// it exactly once). A true value (a v8 save that already played the beat) stays
// true, so it never plays again. Pure — testable headless.
function normalizeFirstVictoryCinematic(raw) {
  return !!raw;
}

// K7 (v1.5 M2): normalize the Curator Challenge best-score file to a clean
// array of at most 5 entries, each {seed: int, date: string, score: number},
// ordered DESCENDING by score (ties broken by later date winning). A missing /
// non-array field normalizes to []; each entry is shape-cleaned (garbled or
// non-finite scores are dropped) so a corrupt list never breaks a load. Pure.
function normalizeChallengeScores(raw) {
  if (!Array.isArray(raw)) return [];
  const keep = [];
  for (const e of raw) {
    if (!isPlainObj(e)) continue;
    const score = Number(e.score);
    const seed = Math.floor(Number(e.seed));
    const date = typeof e.date === 'string' ? e.date : '';
    if (!Number.isFinite(score) || !Number.isFinite(seed)) continue;
    keep.push({ seed, date, score });
  }
  keep.sort((a, b) => (b.score - a.score) || b.date.localeCompare(a.date));
  return keep.slice(0, CHALLENGE_TOP_N);
}

// N1 (v1.3 M14): a save has earned the New Game+ unlock when at least one
// victory is recorded. Gating NG+ behind a completed victory keeps it out of the
// first-time run's pace band; a first-time player (ngCycle 0, no victory) sees
// no NG+ UI. A pure predicate so tests can import it without a browser.
export function ngUnlocked(save) {
  return !!(save && save.stats && Number(save.stats.victories) > 0);
}

export function freshSave() {
  return {
    saveVersion: SAVE_VERSION,
    bank: { red: 0, blue: 0, green: 0 },
    owned: [],            // painting ids
    loadout: [],          // up to 2 painting ids
    upgrades: { capacity: 0, power: 0, vitality: 0 },
    flags: { intro: false, firstOrb: false, firstHurt: false, firstAtelier: false, firstDefeat: false, croaksworthAsked: false, croaksworthGiven: false, heronDefeated: false, welcomeGranted: false, tutorialSkipped: false, reedsUnlocked: false },
    stats: { expeditions: 0, victories: 0, deaths: 0, heronsPainted: 0, treasures: 0 },
    bestRun: null,        // {pigments, time, cleared}
    galleryBonus: 0,      // A4 (v1.2 M9): 'Rehung Frame' prestige-lite level
    tutorialDrills: { burn: false, freeze: false, root: false, awaken: false }, // T1/T3 (v1.2 M13)
    ngCycle: 0,           // N1 (v1.3 M14): New Game+ cycle index (0 = first-time player, no NG+ UI)
    ngModifier: null,     // N4 (v1.3 M14): chosen expedition modifier for the NG+ cycle (MODIFIERS id or null)
    gold: 0,              // G1 (v1.3 M15): meta gold currency (META-ONLY — never touches combat tuning)
    goldEarned: {},       // G1 (v1.3 M15): {[key]: true} — the gold events already paid out (idempotency latch)
    gildedFrame: false,   // G3 (v1.3 M15): the ONE-TIME 'Gilded Frame' prestige tier (bought once, permanent)
    firstVictoryCinematic: false, // M1 (v1.4): the first-victory cinematic beat has been SEEN (a fresh + every migrating-old save = false → they get it once)
    challengeScores: [],  // K7 (v1.5 M2): the CURATOR CHALLENGE best-score file — top 5, each {seed,date,score}, ordered desc by score
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

// T4 (v1.2 M13): is "Watch me" retraining available for this save? It is the
// RE-ENTRY for a RETURNING player: there must be some lesson already completed
// to replay (a finished run, a dismissed guided run, or at least one completed
// drill/sketch). A truly fresh save (nothing done) has no lesson to replay yet
// and offers nothing — the guided run itself is the first-time path. Pure.
export function retrainAllowed(save) {
  if (!save || !isPlainObj(save.flags)) return false;
  if (save.flags.heronDefeated) return true;          // finished at least one run
  if (save.flags.tutorialSkipped) return true;        // dismissed the guided run
  const d = isPlainObj(save.tutorialDrills) ? save.tutorialDrills : null;
  if (d && (d.burn || d.freeze || d.root || d.awaken)) return true; // some progress
  return false;                                        // nothing done yet — nothing to replay
}

// Q2 (v1.6): the run's route — a PURE filter over a run-local waypoint list.
// Keeps only points whose x lies within the run's world width (drops test
// scaffolding / out-of-bounds samples) and, when the list exceeds the cap,
// keeps the NEWEST `cap` (the oldest are dropped, so a long run's tail — its
// approach to the boss — is always shown). Never mutates the input. The
// end-screen recap renders whatever this returns as a wobbly ink line on a
// 6-zone strip: pure presentation over existing run data, NO persistence.
export const ROUTE_WAYPOINT_CAP = 40;
export function routeTrail(waypoints, worldW, cap = ROUTE_WAYPOINT_CAP) {
  const w = (Number.isFinite(worldW) && worldW > 0) ? worldW : Infinity;
  const pts = Array.isArray(waypoints)
    ? waypoints.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= w)
    : [];
  return pts.length > cap ? pts.slice(pts.length - cap) : pts.slice();
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
const SAVE_FIELDS = ['bank', 'owned', 'loadout', 'upgrades', 'flags', 'stats', 'bestRun', 'galleryBonus', 'tutorialDrills', 'ngCycle', 'ngModifier', 'gold', 'goldEarned', 'gildedFrame', 'firstVictoryCinematic', 'challengeScores'];

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
  // N1 (v1.3 M14): carry the NG+ cycle forward (default 0 for a legacy v3 save
  // with no field, the real value for a v4 save). The v3->v4 migration step
  // re-normalizes defensively on the way up.
  out.ngCycle = normalizeNGCycle(raw.ngCycle);
  // N4 (v1.3 M14): carry the chosen expedition modifier forward (default null
  // for a legacy v4 save with no field, the real id for a v5 save). The
  // v4->v5 migration step re-normalizes defensively on the way up.
  out.ngModifier = normalizeNGModifier(raw.ngModifier);
  // G1 (v1.3 M15): carry the meta gold counter + idempotency map forward (0 / {}
  // for a legacy v5 save with no fields; a real value for a v6 save). The
  // v5->v6 migration step re-normalizes defensively on the way up.
  out.gold = Math.max(0, Math.floor(Number(raw.gold) || 0));
  out.goldEarned = normalizeGoldEarned(raw.goldEarned);
  // G3 (v1.3 M15): carry the one-time Gilded Frame flag forward (false for a
  // legacy v6 save with no field, the real boolean for a v7 save). The
  // v6->v7 migration step re-normalizes defensively on the way up.
  out.gildedFrame = normalizeGildedFrame(raw.gildedFrame);
  // M1 (v1.4): carry the first-victory cinematic flag forward (false for a
  // legacy v7 save with no field, the real boolean for a v8 save). The
  // v7->v8 migration step re-normalizes defensively on the way up.
  out.firstVictoryCinematic = normalizeFirstVictoryCinematic(raw.firstVictoryCinematic);
  // K7 (v1.5 M2): carry the Curator Challenge best-score list forward. A
  // legacy v8 save (no field) normalizes to []; a v9 save reloads its OWN
  // list (defensively normalized so a corrupt blob can't leak through). This
  // must be a per-field carry (like gold/galleryBonus) — the version-migration
  // chain below is a no-op on a same-version reload, so without this a v9 save
  // with filed scores would lose them on the next load.
  out.challengeScores = normalizeChallengeScores(raw.challengeScores);
  // R5 (v1.6 Module R): carry the reedsUnlocked gate flag forward
  // (false for a legacy v9 save with no field, the real boolean for a
  // v10 save). The v9->v10 migration step re-normalizes defensively.
  out.flags.reedsUnlocked = normalizeReedsUnlocked(raw.flags && raw.flags.reedsUnlocked);
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
// C3 (v1.3 M16): `grain` (default OFF) — a subtle PROCEDURAL paper-grain overlay
// (see game.js _buildGrain/_drawGrain). Presentation-only; an old options blob
// (no `grain` field) migrates forward to OFF so returning players see no change.
export function freshOptions() {
  return { volume: 0.8, muted: false, difficulty: 'normal', musicVol: 0.6, sfxVol: 0.7, shake: true, vignette: true, grain: false, gamepad: 'auto' };
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
    // C3: grain defaults OFF; only an explicit true turns it on. A legacy blob
    // (field absent) migrates to OFF — presentation unchanged.
    o.grain = !!raw.grain;
    // W1 (v1.6 Module W): `gamepad` ('auto' | 'off'). Defaults to 'auto'; only
    // an explicit persisted 'off' is honored, so a legacy options blob (field
    // absent) migrates forward to 'auto'. Presentation/input routing only —
    // never feeds runT, tuning, or the pacing probes.
    if (raw && (raw.gamepad === 'off' || raw.gamepad === 'auto')) o.gamepad = raw.gamepad;
  }
  return o;
}

// W1 (v1.6 Module W): GAMEPAD support — the raw-Gamepad-API mapping + the
// activation rule. PURE (no browser APIs) so the smoke test can import and
// unit-test the mapping without a real controller. The ONLY browser surface
// the game touches is `navigator.getGamepads()` (see game.js _pollGamepad);
// everything the feed decides from a pad's state is done here.
//
// Standard Gamepad API layout (the "standard" mapping):
//   axes[0] left-stick X, axes[1] left-stick Y
//   buttons: [0]=A [1]=B [2]=X [3]=Y (face)  [4]=LB [5]=RB (shoulders)
//
// The feed WRITES into the existing input.js kb/pressed/mouse APIs (it never
// invents a new input path), so a controller drives the exact same move keys,
// pigment keys, hop, splash and lantern the keyboard/mouse use:
//   left stick -> a/d/w/s (deadzone 0.25)
//   A(0) -> '1' (red)   X(2) -> '2' (blue)   Y(3) -> '3' (green)
//   RB(5) -> ' ' (hop)  LB(4) -> 'l' (lantern; a no-op outside the Reeds)
//   B(1)  -> splash charge (hold-to-charge / release-to-fire, mirrors RMB)
export const GAMEPAD_MAP = {
  deadzone: 0.25,
  axes: { x: 0, y: 1 },
  // In-RUN discrete just-pressed buttons (W1): index -> the input key the feed
  // writes into kb. Context-scoped to the expedition so these never leak into
  // the menus (space=Start, 1/2/3=atelier tabs, a=Atelier on the title).
  btn: { 0: '1', 2: '2', 3: '3', 4: 'l', 5: ' ' },
  // the splash-charge button (hold-to-charge / release-to-fire, mirrors mouse RMB)
  splash: 1,
  // MENU (W2) full-screen focus: the same physical buttons re-purpose outside
  // the expedition. A=confirm, B=back, D-pad up/down move the highlight (wraps)
  // — standard Gamepad API indices (0 A, 1 B, 12/13 dpad up/down, 14/15 left/right).
  // Routed through the SAME _mouseIn click machinery as a mouse click.
  menu: { confirm: 0, back: 1, up: 12, down: 13, left: 14, right: 15 },
};

// W1: is the gamepad feed ENGAGED this frame? Pure. `pad` is the (possibly
// null) connected Gamepad, `nowMs`/`lastActiveMs` are the frame clock + the
// last time the pad reported activity (game.js tracks both). `save` accepts
// either the save blob (options under save.options) or the options blob
// itself (game.js passes this.options). Off disables the feed entirely (game
// skips the poll); Auto engages on a FRESH connect (lastActiveMs === -1) and
// stays engaged while the pad was active within `inactivityMs`, then
// disengages (a quiet idle pad can't fight the keyboard/mouse).
export const GAMEPAD_INACTIVITY_MS = 6000;
export function gamepadActive(save, pad, nowMs, lastActiveMs, inactivityMs = GAMEPAD_INACTIVITY_MS) {
  const o = (save && save.options && typeof save.options === 'object') ? save.options : (save || {});
  if (o.gamepad === 'off') return false;      // Off skips the poll entirely
  if (!pad) return false;                      // nothing connected
  if (lastActiveMs === -1) return true;        // fresh connect: engage immediately
  if (lastActiveMs === undefined || lastActiveMs === null) return false;
  return (nowMs - lastActiveMs) <= inactivityMs; // connected + recently active
}