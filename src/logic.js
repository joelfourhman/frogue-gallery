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
  // v1.10 B2: dry is the SAFE CLEAR — weak, no status, the fallback, not a
  // competitor. Its damage is cut well below green (0.5 -> 0.35) so it is
  // never tied with the other paints in the TTK table (it is always the
  // slowest kill): a player reaches for dry to finish a straggler or clear
  // a swarm without spending a colored paint, NOT because it hits hard.
  dry:   { id: 'dry',   name: 'Dry Brush', color: '#9a8f80', light: '#c9c0b2', dmgMult: 0.35, status: null   },
};
export const PIGMENT_ORDER = ['red', 'blue', 'green', 'dry'];

// A fly commits to a visible target before striking. Seconds, world pixels.
export const MOSQUITO_FLIGHT = Object.freeze({ range: 155, tell: 0.6, dart: 0.3, recover: 0.85, speed: 2.1 });
export function mosquitoStep(e, dt, player) {
  if (e.status && ['freeze', 'root', 'dizzy', 'slow'].includes(e.status.type)) {
    e.flight = 'recover'; e.flightT = MOSQUITO_FLIGHT.recover;
    return;
  }
  e.flightT = Math.max(0, (e.flightT || 0) - dt);
  if (!e.flight) e.flight = 'approach';
  if (e.flight === 'approach' && Math.hypot(e.x - player.x, e.y - player.y) <= MOSQUITO_FLIGHT.range) {
    e.flight = 'tell'; e.flightT = MOSQUITO_FLIGHT.tell;
    const d = Math.hypot(player.x - e.x, player.y - e.y) || 1;
    e.dartX = (player.x - e.x) / d; e.dartY = (player.y - e.y) / d;
  } else if (e.flightT <= 0) {
    if (e.flight === 'tell') { e.flight = 'dart'; e.flightT = MOSQUITO_FLIGHT.dart; }
    else if (e.flight === 'dart') { e.flight = 'recover'; e.flightT = MOSQUITO_FLIGHT.recover; }
    else if (e.flight === 'recover') e.flight = 'approach';
  }
}

// Lantern moth: finite in-run rules. Only the frog's carried lantern owns the
// lure; ambient fireflies/rest stones never acquire an attack target. A frame
// crosses at most one boundary, so a long/resumed frame cannot skip the tell.
export const LANTERN_MOTH = Object.freeze({ cap: 2, tell: 0.6, dash: 0.35, recover: 1.4, range: 145, speed: 62, dashSpeed: 330, flowerRange: 130, reward: 2 });
export const MOTH_NOOK = Object.freeze({ x: 2650, y: 300, wakeRadius: 200, homeRadius: 210 });
export function mothEncounterAllowed({ reeds, victory, blackReeds, wander, challenge } = {}) {
  return !!reeds && !!victory && !blackReeds && !wander && !challenge;
}
export function mothCanSpawn(enemies) {
  return enemies.filter(e => e.kind === 'moth' && !e.dead).length < LANTERN_MOTH.cap;
}
export function mothPaint(e, pigment, flower) {
  if (pigment !== 'blue' || e.dead || e.hp <= 0 || e.mothSettled) return;
  e.mothPhase = 'settle'; e.mothT = LANTERN_MOTH.recover;
  e.mothFlowerTarget = flower?.green && Math.hypot(e.x - flower.x, e.y - flower.y) <= LANTERN_MOTH.flowerRange ? flower : null;
}
export function mothReward(e) {
  if (!e.mothSettled || e.mothRewarded || e.dead || e.hp <= 0) return 0;
  e.mothRewarded = true;
  return LANTERN_MOTH.reward;
}
export function mothContact(e) {
  return !e.dead && e.hp > 0 && e.mothPhase === 'dash' && !e.status;
}
export function mothStep(e, dt, light) {
  dt = Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0));
  e.mothPhase ||= 'approach';
  if (e.dead || e.hp <= 0 || !light?.alive) {
    e.mothPhase = e.mothSettled ? 'settle' : 'approach'; e.mothT = 0; e.mothFlowerTarget = null; return;
  }
  const stunned = e.status && ['freeze', 'root', 'dizzy'].includes(e.status.type);
  if (stunned && (e.mothPhase === 'tell' || e.mothPhase === 'dash')) {
    e.mothPhase = 'settle'; e.mothT = LANTERN_MOTH.recover;
  }
  if (e.mothPhase === 'settle') {
    if (e.mothSettled) return;
    if (e.mothFlowerTarget) {
      const f = e.mothFlowerTarget;
      if (!f.green) e.mothFlowerTarget = null;
      else {
        if (!stunned && Math.hypot(e.x - f.x, e.y - f.y) <= 8) e.mothSettled = true;
        return; // adapter glides to the flower after thaw; no re-armed dash
      }
    }
    if (!stunned) {
      e.mothT = Math.max(0, e.mothT - dt);
      if (e.mothT <= 1e-8) e.mothPhase = 'approach';
    }
    return;
  }
  if (!light.lit || light.owner !== 'player') { e.mothPhase = 'approach'; e.mothT = 0; return; }
  if (stunned) return;
  if (e.mothPhase === 'approach') {
    const d = Math.hypot(light.x - e.x, light.y - e.y);
    if (d <= LANTERN_MOTH.range) {
      e.mothPhase = 'tell'; e.mothT = LANTERN_MOTH.tell;
      e.mothDX = d > 0 ? (light.x - e.x) / d : 1;
      e.mothDY = d > 0 ? (light.y - e.y) / d : 0;
    }
  } else {
    e.mothT = Math.max(0, e.mothT - dt);
    if (e.mothT <= 1e-8) {
      if (e.mothPhase === 'tell') { e.mothPhase = 'dash'; e.mothT = LANTERN_MOTH.dash; }
      else { e.mothPhase = 'settle'; e.mothT = LANTERN_MOTH.recover; }
    }
  }
}

// ---------------------------------------------------------------- enemies
// Field studio rules: optional finite content; studio.js owns the presentation.
export const FIELD_STUDIES = [
  { id: 'first-light', name: 'First Light', x: 640, y: 750, motif: 'pond',
    colors: ['blue', 'green', 'red'], verbs: ['Wake the water', 'Grow the lilies', 'Light the fireflies'],
    biome: 'swamp', group: 'swamp' },
  { id: 'rain-choir', name: 'The Rain Choir', x: 2300, y: 720, motif: 'rain',
    colors: ['green', 'blue', 'red'], verbs: ['Raise the reeds', 'Invite the rain', 'Tune the bells'],
    biome: 'swamp', group: 'swamp' },
  { id: 'borrowed-sky', name: 'A Borrowed Sky', x: 3940, y: 760, motif: 'sky',
    colors: ['red', 'blue', 'green'], verbs: ['Warm the horizon', 'Reflect the sky', 'Give it wings'],
    biome: 'swamp', group: 'swamp' },
  // Q2: the first REEDS study. A fixed, optional discovery mid-descent: on the
  // banks (y < REEDS_FLOOD_FLOOR 900), clear of every rest stone (nearest are
  // ~460 px away) and ~1800 px short of the Silt Wyrm arena (x >= 5100).
  { id: 'lantern-garden', name: 'The Lantern Garden', x: 3300, y: 780, motif: 'lantern',
    colors: ['green', 'blue', 'red'], verbs: ['Grow the stems', 'String the dew', 'Wake the moths'],
    biome: 'reeds', group: 'reeds' },
  // Q3: the second REEDS study. Another fixed, optional discovery, earlier in
  // the descent: on the banks (y < REEDS_FLOOD_FLOOR 900), below gravity
  // pocket 1 (y < 480 ends above it), ~500 px from the nearest rest stones
  // and ~3950 px short of the Silt Wyrm arena (x >= 5100).
  { id: 'echo-pool', name: 'The Echo Pool', x: 1150, y: 720, motif: 'echo',
    colors: ['blue', 'red', 'green'], verbs: ['Ring the ripples', 'Light the stars', 'Set the birds loose'],
    biome: 'reeds', group: 'reeds' },
];
// Q1: explicit completion reward groups. The swamp gold postcard seal and
// golden-lily banner require EXACTLY these registered IDs — never "three
// completions" — so studies registered later (Reeds in Q2) cannot break or
// dilute the swamp reward.
// Q3: the reeds group earns its cosmetic postcard BORDER only when BOTH reeds
// studies are complete — the group is the border, and the order of completion
// does not matter.
export const STUDY_GROUPS = Object.freeze({
  swamp: Object.freeze({ biome: 'swamp', required: ['first-light', 'rain-choir', 'borrowed-sky'] }),
  reeds: Object.freeze({ biome: 'reeds', required: ['lantern-garden', 'echo-pool'] }),
});
// Q1: pure selector by biome and mode. Challenge and wander runs never carry
// living studies; every other mode carries exactly the definitions registered
// for that biome (Reeds/Black Reeds get zero until Q2/Q3 register their own).
export function studiesForBiome(biome, { challenge = false, wander = false } = {}) {
  if (challenge || wander) return [];
  return FIELD_STUDIES.filter(s => s.biome === biome);
}

// Field atlas: a bounded, read-only view of the current expedition. Landmarks
// come from live state; the map never invents a checkpoint or grants progress.
export function fieldAtlasSnapshot({ biome = 'swamp', width = 5400, height = 1500,
  player, studies = [], remembered = [], rests = [], checkpoints = [], crossingState, mothFlower,
  challenge = false, wander = false } = {}) {
  const w = Number.isFinite(width) && width > 0 ? width : 5400;
  const h = Number.isFinite(height) && height > 0 ? height : 1500;
  const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: Math.max(0, Math.min(w, p.x)), y: Math.max(0, Math.min(h, p.y)) } : null;
  const frog = point(player) || { x: 0, y: h / 2 };
  const live = Array.isArray(studies) ? studies : [];
  const subjects = studiesForBiome(biome, { challenge, wander }).map(def => {
    const state = live.find(s => s?.id === def.id);
    const step = Number.isFinite(state?.step) ? Math.max(0, Math.min(3, Math.floor(state.step))) : 0;
    const coats = step === 3 ? 0 : Number.isFinite(state?.coats) ? Math.max(0, Math.min(STUDIO.coats, Math.floor(state.coats))) : 0;
    return { id: def.id, name: def.name, x: def.x, y: def.y, step, coats,
      remembered: Array.isArray(remembered) && remembered.includes(def.id),
      complete: step === 3, color: def.colors[step] || null, verb: def.verbs[step] || 'A living memory' };
  }).sort((a, b) => a.x - b.x);
  const nearest = subjects.filter(s => !s.complete).sort((a, b) =>
    Math.hypot(a.x - frog.x, a.y - frog.y) - Math.hypot(b.x - frog.x, b.y - frog.y))[0] || null;
  const points = (items, cap) => Array.isArray(items) ? items.slice(0, cap).map(point).filter(Boolean) : [];
  const authored = !challenge && !wander;
  return { width: w, height: h, frog, studies: subjects, next: nearest,
    rests: biome === 'reeds' || biome === 'blackReeds' ? points(rests, 16) : [],
    checkpoints: points(checkpoints, 4),
    crossing: authored && biome === 'swamp' && CROSSING_STATES.includes(crossingState)
      ? { x: CROSSING.x, y: CROSSING.y, state: crossingState } : null,
    moth: authored && biome === 'reeds' && point(mothFlower)
      ? { ...point(mothFlower), resting: !!mothFlower.resting, green: !!mothFlower.green } : null,
    title: biome === 'blackReeds' ? 'The Black Reeds' : biome === 'reeds' ? 'Beneath the Reeds' : 'The Watercolor Swamp',
    mode: challenge ? 'Curator Challenge' : wander ? 'Wandering expedition' : 'An afternoon of discoveries' };
}
// Q1: pure reward check — true only when every ID of the group is completed.
export function studyRewardEarned(completed, group = 'swamp') {
  const g = STUDY_GROUPS[group];
  if (!g || !Array.isArray(completed)) return false;
  const have = new Set(completed);
  return g.required.every(id => have.has(id));
}

// Q4 (Astra): THE PAINTED CROSSING — a pure state machine + bounded collision
// data. A bramble wall blocks the mouth of the optional detour above the Rain
// Choir (x 2300, y 460 — north of the central corridor, OFF the main
// east-west route). Painting it changes its state; the MAIN CORRIDOR is never
// touched by any state (the wall only spans the ~300px mouth), and every
// painted state is passable in BOTH directions, so no state can ever trap
// the frog (every state has a valid return path). The collision data is
// bounded (4 circles max, only in the default state) and rebuilt ONLY when
// the state actually changes (see World.paintCrossing).
export const CROSSING_STATES = Object.freeze(['unpainted', 'crossing', 'current', 'bramble']);
export const CROSSING = Object.freeze({
  x: 2300, y: 460,                                   // mouth center
  r: 46,                                             // bramble blob radius
  blobOffsets: Object.freeze([-105, -35, 35, 105]),  // 70px pitch < 2r → continuous wall
  corridorY: 700,                                    // main-route test anchor (south end)
  pocketY: 300,                                      // detour-side test anchor (north end)
  zoneR: 90,                                         // effect zone radius (current slow / bramble sting)
  currentFactor: 0.72,                               // blue: slows (the flood factor)
  brambleDamage: 3,                                  // red: one small entry hit
});
// The state a pigment paints (green → safe crossing, blue → current, red →
// bramble; anything else, including dry/blank paint, is a no-op).
export function crossingPigmentState(pigment) {
  if (pigment === 'green') return 'crossing';
  if (pigment === 'blue') return 'current';
  if (pigment === 'red') return 'bramble';
  return null;
}
// Pure transition: the pigment's state if it paints one, else the current
// state. Idempotent by construction — repainting the same pigment is a no-op.
export function crossingTransition(state, pigment) {
  return crossingPigmentState(pigment) || state;
}
export function crossingPassable(state) { return state !== 'unpainted'; }
export function crossingSpeedFactor(state) { return state === 'current' ? CROSSING.currentFactor : 1; }
export function crossingDamageOnEntry(state) { return state === 'bramble' ? CROSSING.brambleDamage : 0; }
// The bounded collision data for a state: only 'unpainted' carries solids
// (the bramble wall). Every painted state is OPEN — the frog can always
// return the way it came, and the main corridor stays open in every state.
export function crossingSolids(state) {
  if (state !== 'unpainted') return [];
  return CROSSING.blobOffsets.map(dx => ({ x: CROSSING.x + dx, y: CROSSING.y, r: CROSSING.r }));
}
// Q5: the crossing's EFFECT ZONE — the circle around the mouth where the
// painted state's effect applies (the current slows movement, the bramble
// stings on entry). Pure geometry; the state's semantics stay above.
export function inCrossingZone(x, y) {
  const dx = x - CROSSING.x, dy = y - CROSSING.y;
  return dx * dx + dy * dy <= CROSSING.zoneR * CROSSING.zoneR;
}
// Q5: does a stroke REACH the crossing mouth? A stroke is the segment from
// (x, y) in direction a, length range (a swipe or splash from the player).
// True when the segment comes within the mouth radius + the brush's reach
// margin (26px, the wet-stroke width) of the mouth center. A missing pigment
// or geometry is a clean no-op (the dry brush never repaints the wall).
export function strokeTouchesCrossing(stroke, margin = 26) {
  const s = stroke || null;
  if (!s || s.pigment === 'dry' || s.pigment === undefined || s.pigment === null) return false;
  const x0 = Number(s.x), y0 = Number(s.y), a = Number(s.a), range = Number(s.range);
  if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(a) || !Number.isFinite(range)) return false;
  const x1 = x0 + Math.cos(a) * range, y1 = y0 + Math.sin(a) * range;
  const dx = x1 - x0, dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((CROSSING.x - x0) * dx + (CROSSING.y - y0) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = x0 + t * dx, py = y0 + t * dy;
  const ex = CROSSING.x - px, ey = CROSSING.y - py;
  const reach = CROSSING.r + margin;
  return ex * ex + ey * ey <= reach * reach;
}
// Control response, separate from travel speed and combat damage. Exponential
// response keeps acceleration/braking consistent across browser frame rates.
export const MOVEMENT = Object.freeze({ accelerate: 26, brake: 38, reverse: 36, hopSpeed: 2.2 });
// Final bosses belong to the last clearing, never to the opening paint lesson.
export function bossArenaReached(playerX, worldWidth) {
  return Number.isFinite(playerX) && Number.isFinite(worldWidth) && playerX > worldWidth - 900;
}

// One finite descent. The run, its boss progress and its rewards are transient:
// returning to the title or dying starts another floor-one run, never a cycle.
export const CAMPAIGN = Object.freeze([
  Object.freeze({ id: 'swamp', name: 'Watercolor Marsh', biome: 'swamp', boss: 'gray', final: false }),
  Object.freeze({ id: 'reeds', name: 'Sunken Reeds', biome: 'reeds', boss: 'wyrm', final: false }),
  Object.freeze({ id: 'hollow', name: 'Hollow Sanctuary', biome: 'reeds', boss: 'warden', final: false }),
  Object.freeze({ id: 'black-reeds', name: 'Black Reeds', biome: 'reeds', boss: 'umbra', final: true }),
]);
export const CAMPAIGN_REWARDS = Object.freeze([
  Object.freeze({ id: 'power', name: 'Brighter paint', description: '+20% brush, splash and burn damage for this run.' }),
  Object.freeze({ id: 'heart', name: 'Lily heart', description: '+2 maximum health for this run.' }),
  Object.freeze({ id: 'flow', name: 'Flowing brush', description: 'Dodge and splash recharge 12% faster for this run.' }),
  Object.freeze({ id: 'reach', name: 'Broad brush', description: 'Reach 20% farther. Splash covers a 15% wider radius.' }),
  Object.freeze({ id: 'tempo', name: 'Quick strokes', description: 'Paint again 15% sooner with each brush stroke.' }),
  Object.freeze({ id: 'mend', name: 'Kind moss', description: 'Green paint restores 35% more health.' }),
]);
// First rest teaches the original three gifts. Later rests keep one familiar
// choice in its original slot and offer two distinct specialties. Pure seeded
// sampling never consumes combat RNG or rerolls while a card is drawn.
export function campaignRewardOffers(run) {
  if (!campaignFloor(run) || run.complete || run.floor >= 3) return [];
  if (run.floor === 0) return CAMPAIGN_REWARDS.slice(0, 3);
  const random = mulberry32(((run.seed || 0) ^ Math.imul(run.floor + 1, 0x45d9f3b)) >>> 0);
  const pool = CAMPAIGN_REWARDS.slice(3);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const cards = pool.slice(0, 2);
  cards.splice(run.floor, 0, CAMPAIGN_REWARDS[run.floor]);
  return cards;
}
export function createCampaignRun(seed = 0) {
  return { seed: Number.isFinite(Number(seed)) ? Math.floor(Number(seed)) >>> 0 : 0,
    floor: 0, cleared: [], rewards: [], pendingReward: false, complete: false };
}
export function campaignFloor(run) {
  return run && Number.isInteger(run.floor) ? CAMPAIGN[run.floor] || null : null;
}
export function finishCampaignFloor(run, bossKind) {
  const floor = campaignFloor(run);
  if (!floor || run.complete || run.pendingReward || bossKind !== floor.boss ||
      !Array.isArray(run.cleared) || !Array.isArray(run.rewards) ||
      run.cleared.length !== run.floor || run.rewards.length !== run.floor ||
      !run.cleared.every((boss, index) => boss === CAMPAIGN[index].boss) ||
      !run.rewards.every(id => CAMPAIGN_REWARDS.some(reward => reward.id === id))) return false;
  run.cleared.push(floor.boss);
  run.pendingReward = !floor.final;
  run.complete = floor.final;
  return true;
}
export function chooseCampaignReward(run, id) {
  const floor = campaignFloor(run);
  if (!floor || floor.final || run.complete || !run.pendingReward ||
      !Array.isArray(run.cleared) || !Array.isArray(run.rewards) ||
      run.cleared.length !== run.floor + 1 || run.cleared[run.floor] !== floor.boss ||
      !run.cleared.every((boss, index) => boss === CAMPAIGN[index].boss) ||
      run.rewards.length !== run.floor || !campaignRewardOffers(run).some(reward => reward.id === id) ||
      !run.rewards.every(value => CAMPAIGN_REWARDS.some(reward => reward.id === value))) return false;
  run.rewards.push(id);
  run.floor++;
  run.pendingReward = false;
  return true;
}
// Apply once to a freshly constructed tuning object when entering a floor.
// Three gates means at most three rewards, even if an invalid caller adds more.
export function applyCampaignRewards(tuning, run) {
  const rewards = Array.isArray(run?.rewards) ? run.rewards.slice(0, CAMPAIGN.length - 1) : [];
  for (const id of rewards) {
    if (id === 'power') { tuning.power *= 1.2; tuning.burnDps *= 1.2; }
    if (id === 'heart') tuning.maxHp += 2;
    if (id === 'flow') { tuning.hopCooldown *= 0.88; tuning.splashCooldown *= 0.88; }
    if (id === 'reach') { tuning.swipeRange *= 1.2; tuning.splashRadius *= 1.15; }
    if (id === 'tempo') tuning.swipeCooldown *= 0.85;
    if (id === 'mend') { tuning.greenHeal *= 1.35; tuning.greenHealOnPaint *= 1.35; }
  }
  return tuning;
}
export function campaignRewardPreview(tuning, id) {
  const before = tuning || makeTuning();
  const after = applyCampaignRewards({ ...before }, { rewards: [id] });
  const pair = (label, field, digits, unit = '') => `${label}: ${before[field].toFixed(digits)} → ${after[field].toFixed(digits)}${unit}`;
  if (id === 'power') return [pair('Power', 'power', 2, '×'), pair('Burn', 'burnDps', 1, '/s')];
  if (id === 'heart') return [pair('Max health', 'maxHp', 0), '+2 health filled immediately'];
  if (id === 'flow') return [pair('Dodge', 'hopCooldown', 3, 's'), pair('Splash', 'splashCooldown', 3, 's')];
  if (id === 'reach') return [pair('Reach', 'swipeRange', 1), pair('Splash radius', 'splashRadius', 1)];
  if (id === 'tempo') return [pair('Stroke delay', 'swipeCooldown', 3, 's'), 'Shorter delay = quicker painting'];
  if (id === 'mend') return [pair('Ground heal', 'greenHeal', 2, '/s'), pair('Hit heal', 'greenHealOnPaint', 3)];
  return [];
}
export function movementVelocity(vx, vy, targetX, targetY, dt, launch = false) {
  if (launch) return [targetX, targetY];
  const idle = targetX === 0 && targetY === 0;
  const rate = idle ? MOVEMENT.brake : vx * targetX + vy * targetY < 0 ? MOVEMENT.reverse : MOVEMENT.accelerate;
  const a = 1 - Math.exp(-rate * Math.max(0, dt));
  const x = vx + (targetX - vx) * a, y = vy + (targetY - vy) * a;
  return [idle && Math.abs(x) < 0.5 ? 0 : x, idle && Math.abs(y) < 0.5 ? 0 : y];
}
// Cycling is for the three combat colors. Dry stays an explicit 4-key choice.
export function cycleCombatPigment(pigment, direction) {
  const colors = ['red', 'blue', 'green'];
  const i = colors.indexOf(pigment), step = direction < 0 ? -1 : 1;
  return colors[i < 0 ? step > 0 ? 0 : 2 : (i + step + 3) % 3];
}
export function splashChargeStep(charge, dt, held, released, duration) {
  return held ? Math.min(1, charge + dt / duration) : released ? charge : 0;
}
// Shared by actual swipe collision and its visual range preview.
export function brushHitsCircle(x, y, aim, range, arc, target) {
  const d = Math.hypot(target.x - x, target.y - y);
  if (d > range + target.r) return false;
  const angle = Math.atan2(target.y - y, target.x - x) - aim;
  const diff = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
  return diff < arc / 2 + Math.asin(Math.min(1, target.r / Math.max(d, 1)));
}

export const STUDIO = Object.freeze({ coats: 3, nodeRadius: 25, wakeLife: 1.25, wakeRadius: 27, wakeCap: 24, strokeCap: 180, pageCap: 8, pinCap: 2 });
export function studyNode(study, step = study.step || 0) {
  const offsets = [[-62, 16], [0, -28], [62, 16]];
  const xy = offsets[Math.min(2, step)];
  return { x: study.x + xy[0], y: study.y + xy[1], pigment: study.colors[Math.min(2, step)] };
}
export function strokeTouches(stroke, x, y, radius = STUDIO.nodeRadius) {
  const d = Math.hypot(x - stroke.x, y - stroke.y);
  if (d > stroke.range + radius) return false;
  if (stroke.kind === 'splash') return true;
  const angle = Math.atan2(y - stroke.y, x - stroke.x) - stroke.a;
  const diff = Math.atan2(Math.sin(angle), Math.cos(angle));
  return Math.abs(diff) <= 0.5 + Math.asin(Math.min(1, radius / Math.max(d, 1)));
}
export function paintStudy(study, stroke) {
  if (study.step >= 3 || stroke.kind === 'hop') return false;
  const node = studyNode(study);
  if (node.pigment !== stroke.pigment || !strokeTouches(stroke, node.x, node.y)) return false;
  study.coats = (study.coats || 0) + 1;
  if (study.coats >= STUDIO.coats) { study.coats = 0; study.step++; }
  return true;
}
export function brushWakeStatus(pigment, enemy) {
  if (pigment === 'red') return { type: 'burn', t: 0.65, max: 0.65 };
  if (pigment === 'blue') return { type: 'slow', t: 0.85, max: 0.85 };
  if (pigment === 'green' && !enemy.fly) return { type: 'root', t: 0.45, max: 0.45 };
  return null;
}
export function normalizeStudio(raw) {
  const completed = FIELD_STUDIES.filter(s => Array.isArray(raw?.completed) && raw.completed.includes(s.id)).map(s => s.id);
  return { completed };
}
const finiteBound = (n, min, max) => typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
// Q6: the PINNED SKETCHBOOK pages — at most STUDIO.pinCap (2) page ids that
// never age out of the rolling pageCap window. Optional validated save field
// (no SAVE_VERSION bump): the id list lives on the EXISTING save object,
// mirroring the flags-object pattern. Bounded normalization: a non-array or
// garbled field degrades to [], ids are string-coerced + deduped, and the
// list is capped at pinCap (the FIRST two wins — a corrupt blob can never
// carry more than two pins forward).
const sketchId = value => ['string', 'number', 'boolean'].includes(typeof value) ? String(value).slice(0, 48) : '';
export function normalizeSketchPins(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const v of raw) {
    const id = sketchId(v);
    if (id && !out.includes(id)) out.push(id);
  }
  return out.slice(0, STUDIO.pinCap);
}
export function normalizeSketchTitle(raw) {
  if (typeof raw !== 'string') return 'An afternoon in the swamp';
  const text = raw.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/gu, ' ').trim();
  return Array.from(text).slice(0, 48).join('') || 'An afternoon in the swamp';
}
export function renameSketchPage(save, id, title) {
  const page = save.sketchbook?.find(p => p.id === id);
  if (!page) return false;
  page.title = normalizeSketchTitle(title); page.named = true; return true;
}
export function exhibitSketchPage(save, id) {
  if (!save.sketchPins?.includes(id) || !save.sketchbook?.some(p => p.id === id)) return false;
  save.sketchExhibit = id; return true;
}
export function normalizeSketchbook(raw, pins = []) {
  if (!Array.isArray(raw)) return [];
  // Pinned pages keep their slot no matter how old they are; the rolling
  // window (pageCap) counts ONLY non-pinned pages, taken from the NEWEST end
  // (raw is in recency order: oldest first). Deterministic eviction: with
  // two pins and eight rolling pages, the OLDEST non-pinned page leaves —
  // a pinned page is never evicted by the window. (Backward compatible:
  // no pins → exactly the old last-pageCap behavior.)
  const pinSet = new Set(normalizeSketchPins(pins));
  const keepIdx = new Set();
  const seen = new Set(); // Imported duplicate IDs keep only their newest valid page.
  let rolling = 0;
  for (let i = raw.length - 1; i >= 0; i--) {
    const p = raw[i];
    if (!p || typeof p !== 'object' || !Array.isArray(p.strokes)) continue;
    const id = sketchId(p.id);
    if (seen.has(id)) continue;
    seen.add(id);
    if (pinSet.has(id)) { keepIdx.add(i); continue; }
    if (rolling < STUDIO.pageCap) { rolling++; keepIdx.add(i); }
  }
  return raw.filter((p, i) => keepIdx.has(i)).map(p => ({
    id: sketchId(p.id),
    seed: Math.round(finiteBound(p.seed, 0, 2147483647)),
    title: normalizeSketchTitle(p.title),
    named: p.named === true,
    biome: ['swamp', 'reeds', 'blackReeds'].includes(p.biome) ? p.biome : 'swamp',
    result: ['study', 'victory', 'defeat', 'unfinished'].includes(p.result) ? p.result : 'unfinished',
    seconds: Math.round(finiteBound(p.seconds, 0, 86400)),
    studies: normalizeStudio({ completed: p.studies }).completed,
    strokes: p.strokes.slice(0, STUDIO.strokeCap).filter(s => Array.isArray(s) && s.length === 6 && s.every(Number.isFinite))
      .map(s => [Math.round(finiteBound(s[0], 0, 1000)), Math.round(finiteBound(s[1], 0, 1000)), Math.round(finiteBound(s[2], 0, 1000)), Math.round(finiteBound(s[3], 0, 1000)), Math.round(finiteBound(s[4], 0, 3)), Math.round(finiteBound(s[5], 1, 30))]),
  }));
}
export function fileSketch(save, page) {
  const pins = normalizeSketchPins(save.sketchPins);
  const pages = normalizeSketchbook([page], pins);
  if (!pages.length || !pages[0].strokes.length) return false;
  const existing = save.sketchbook?.find(p => p.id === pages[0].id);
  if (existing?.named) { pages[0].title = existing.title; pages[0].named = true; }
  save.sketchbook = normalizeSketchbook([...(save.sketchbook || []).filter(p => p.id !== pages[0].id), pages[0]], pins);
  return true;
}
// Q6: PIN a page — idempotent, capped at pinCap, and only for pages actually
// in the book (a pin for a missing id is a clean no-op). Returns true when
// the pin was ADDED (so the caller can announce it), false otherwise.
export function pinSketchPage(save, id) {
  const page = (save.sketchbook || []).find(p => p.id === String(id || ''));
  if (!page) return false;
  const pins = normalizeSketchPins(save.sketchPins);
  if (pins.includes(page.id) || pins.length >= STUDIO.pinCap) return false;
  save.sketchPins = [...pins, page.id];
  return true;
}
// Q6: UNPIN a page — returns it to the normal retention policy (the rolling
// window may evict it on the next filing). Clean no-op when not pinned.
export function unpinSketchPage(save, id) {
  const pins = normalizeSketchPins(save.sketchPins);
  const idx = pins.indexOf(String(id || ''));
  if (idx < 0) return false;
  save.sketchPins = pins.filter((_, i) => i !== idx);
  if (save.sketchExhibit === String(id || '')) save.sketchExhibit = null;
  return true;
}

export const ENEMIES = {
  // Authored encounter only: deliberately absent from all wave/mode tables.
  moth: { id: 'moth', name: 'Lantern Moth', hp: 60, speed: 62, dmg: 4, radius: 16, armor: 0, fly: true, score: 10, paintTintDecay: 0.4 },
  beetle: {
    id: 'beetle', name: 'Mud Beetle', hp: 36, speed: 40, dmg: 6, radius: 16,
    armor: 0.35,          // fraction of physical damage blocked (burn ignores it)
    burnArmor: false,     // burns fully pierce armor
    fly: false, score: 20, paintTintDecay: 0.25,
  },
  mosquito: {
    // v1.10 B1: the mosquito is the FAST tier — a quick, darting nuisance.
    // HP raised a touch from 11 so a single paint isn't an instant kill (the
    // old 0.1s TTK made it a free point and stretched the 6-kind spread past
    // a healthy 2-3× vs the tanky tier). It stays the quickest kill in the
    // bestiary, now a clean "one or two quick strokes" rather than a pop.
    id: 'mosquito', name: 'Mosquito', hp: 16, speed: 120, dmg: 4, radius: 10,
    armor: 0, fly: true, score: 10, paintTintDecay: 0.4,
  },
  toad: {
    id: 'toad',
    // v1.10 B1 identity pass: the toad is a TANK that fights with a
    // risk/reward loop, not wall-filler. Its raw HP is cut so it is no
    // longer the slowest kill (now ~×3 mosquito, inside the healthy 2-3×
    // tier), and its armor is dropped so paint always lands (a toad sitting
    // dizzy in the bramble is exposed). The dizzy-when-painted window is now
    // the reward: paint it, it sits, you free-fire it at 1.5× — so a toad
    // reads as "a different kind of fight" (a punishable sit), not "more HP."
    name: 'Grumpy Toad', hp: 36, speed: 58, dmg: 6, radius: 19,
    armor: 0, score: 30, paintTintDecay: 0.2,
    dizzyPaintChance: 0.25,  // chance a paint hit stuns the toad (sits, +50% dmg)
    dizzyDuration: 2.4,
  },
  turtle: {
    id: 'turtle', name: 'Mud Turtle', hp: 95, speed: 24, dmg: 12, radius: 24,
    armor: 0.45, fly: false, score: 45, paintTintDecay: 0.18,
    frontDeflect: true,       // the shell turns paint away from the front
    deflectArc: 1.5,          // radians (~±86°) either side of its facing
    deflectKeep: 0.15,        // front paint deals this FRACTION of normal dmg
  },
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
    id: 'wisp', name: 'Glow Wisp', hp: 18, speed: 34, dmg: 3, radius: 13,
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
    id: 'leech', name: 'Silt Leech', hp: 14, speed: 64, dmg: 0, radius: 11,
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

// Returns the health actually restored; dead frogs cannot be revived by paint.
export function restoreHealth(player, amount) {
  if (player.alive === false || player.hp <= 0 || amount <= 0) return 0;
  const restored = Math.max(0, Math.min(amount, player.maxHp - player.hp));
  player.hp += restored;
  return restored;
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
export function makeTuning(upgrades = {}, loadout = [], difficulty = 'normal') {
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
    // v1.10 B2: the charged splash was a broken 0.07x single-target DPS
    // (a 5-damage burst on a 2.05s cycle = 2.3 hp/s vs the swipe's 32.4).
    // Raised to a real burst (5 -> 60) so charging PAYS: vs a group it is a
    // value spike (3 targets in the 58px radius ~= 2.5-3x the swipe's group
    // DPS in the same cycle) and vs a single tough target it lands at
    // roughly parity (a damage spike, not a slow trickle). The swipe is
    // untouched (still the bread-and-butter single-target verb); the splash
    // is now the deliberate choice for clusters / tanks.
    splashDamage: 60,
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
    // A landed green action heals immediately, once even when it hits a crowd.
    // Keep hit healing independent of the ground-paint accumulator.
    greenHealOnPaint: 1,
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
  // A2: painting synergy pairs — after the per-painting modifiers above, an
  // active "duo" stacks on top. Pure + testable; surfaces in the Gallery wall.
  const synergy = activeSynergy(loadout);
  if (synergy) { t.synergy = synergy.name; synergy.apply(t); }
  // M8 P7: scale the run by the chosen difficulty (after loadout modifiers).
  applyDifficulty(t, difficulty);
  return t;
}


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

export function challengeUnlocked(save) {
  return !!(save && save.stats && Number(save.stats.victories) > 0);
}

// Legacy accomplishment predicate, retained for old save/history readers.
// Campaign entry itself is controlled by finishCampaignFloor/chooseCampaignReward.
export function reedsUnlocked(save) {
  if (save && save.flags && !!save.flags.reedsUnlocked) return true;
  return !!(save && save.stats && Number(save.stats.victories) > 0);
}

// R5 (v1.6 Module R): normalize the reedsUnlocked gate flag to a boolean.
// Every pre-v1.6 save (no field) loads FALSE — nobody backfills access.
export function normalizeReedsUnlocked(raw) {
  return !!raw;
}
// Q5 (Astra): carry the PAINTED CROSSING's one-time postcard-stamp latch
// forward (false for a legacy save with no field, the real boolean for a
// save that painted the crossing). Mirrors normalizeReedsUnlocked.
export function normalizeCrossingPainted(raw) {
  return !!raw;
}

export function normalizeReedsVictory(raw) {
  return !!raw;
}


// D1 (v1.7): normalize THE WANDER's last-seed latch to a non-negative integer.
// A pre-v1.7 save (no field, or a non-finite/garbled value) loads 0 — the
// player has no Wander run yet, so nothing is backfilled. A real seed (a
// non-negative integer) survives. The seed is the reproducibility key for the
// generated layout; 0 is a valid seed too, but a FRESH Wander run always picks
// a non-zero seed (see pickWanderSeed) so the very first Wander expedition is
// never the degenerate all-zeros layout.
export function normalizeWanderSeed(raw) {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 0 ? n : 0;
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

// G1 (v1.8): the Black Reeds' lightFactor — the SAME pure smoothstep falloff as
// R1's lightFactor, but with the falloff extent (R) read from a tunable table
// (defaulting to LANTERN, so a cycle-0 Reeds run is byte-identical). The Black
// Reeds passes REEDS_DARK_LANTERN (a shorter reach) so the bestiary's light key
// matches the darker, shorter radius. Pure.
export function lanternLightFactor(state, x, y, cx, cy, tuning = LANTERN) {
  const st = lanternState(state && state.fuel, state && state.lit);
  const R = lanternRadiusFor(st, tuning);
  if (!st.lit || R <= 0) return 0;
  const d = Math.hypot(x - cx, y - cy);
  if (d >= R) return 0;
  const t = 1 - d / R;
  return t * t * (3 - 2 * t);
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

// G1 (v1.8): the BLACK REEDS' lantern-economy wrappers — the SAME pure rules as
// R1's lanternTick / lanternRadius, but reading from a tunable table
// (defaulting to LANTERN, so a cycle-0 Reeds run is byte-identical). The Black
// Reeds run passes REEDS_DARK_LANTERN (a faster drain + shorter radius) so the
// candle loop is a real layer and the "deep dark" is darker. Pure — no browser
// APIs. (lightFactor is UNCHANGED: it reads the radius from the state's fuel,
// which the dark tuning already shapes, so the bestiary's light key stays
// consistent.)
export function lanternRadiusFor(state, tuning = LANTERN) {
  const st = lanternState(state && state.fuel, state && state.lit);
  if (!st.lit) return 0;
  const min = (tuning && tuning.minRadius) || LANTERN.minRadius;
  const max = (tuning && tuning.lightRadius) || LANTERN.lightRadius;
  return min + (max - min) * st.fuel;
}
export function lanternTickFor(state, dt, lit, nearRest = false, nearFirefly = false, tuning = LANTERN) {
  const t = tuning || LANTERN;
  const st = lanternState(state && state.fuel, state && state.lit);
  let fuel = st.fuel;
  const isLit = !!lit;
  if (isLit) fuel -= (t.fuelDrain != null ? t.fuelDrain : LANTERN.fuelDrain) * dt;
  if (nearRest) fuel += (t.refillRestSpot != null ? t.refillRestSpot : LANTERN.refillRestSpot) * dt;
  if (nearFirefly) fuel += (t.refillFirefly != null ? t.refillFirefly : LANTERN.refillFirefly) * dt;
  fuel = Math.max(0, Math.min(1, fuel));
  const outLit = fuel <= 0 ? false : isLit;
  return { fuel, lit: outLit };
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
// AABB test over the pocket list (default REEDS_POCKETS). Outside all pockets
// (or a base-world point) it returns false, so the sign flip is a no-op there.
// Pure + deterministic.
// G1 (v1.8): the `pockets` param (defaulting to REEDS_POCKETS) lets the BLACK
// REEDS variant pass its OWN (extra) pocket list — a cycle-0 caller omits it and
// reads EXACTLY REEDS_POCKETS, so a cycle-0 run's hop is byte-identical.
export function inGravityPocket(x, y, pockets = REEDS_POCKETS) {
  const list = pockets || REEDS_POCKETS;
  for (const pk of list) {
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
// G1 (v1.8): the (floor, factor) params default to the Reeds constants so a
// cycle-0 caller (which omits them) is byte-identical; the BLACK REEDS variant
// passes its own deeper/faster flood band.
export function floodedWaterFactor(x, y, floor = REEDS_FLOOD_FLOOR, factor = REEDS_FLOOD_FACTOR) {
  return (typeof y === 'number' && y >= floor) ? factor : 1;
}

// R2: the hop DISPLACEMENT (px) for a frog mid-hop, SIGN-FLIPPED while inside
// an inverted-gravity pocket. It reuses the EXACT base-hop lift curve the
// player already uses — Math.sin(PI*(1 - hopT/HOP_DUR)) * HOP_LIFT (a 0->peak
// ->0 arc over the 0.22 s hopT) — and negates it inside a pocket so the frog
// "clumps" DOWN onto the ceiling instead of lifting up. hopT <= 0 -> 0 (not
// hopping). Outside a pocket the sign is + (normal upward hop), so the base
// swamp behavior is byte-identical. Pure.
// G1 (v1.8): the `pockets` param (defaulting to REEDS_POCKETS) threads the
// world's pocket list through so the BLACK REEDS extra pocket applies. A
// cycle-0 caller omits it and reads EXACTLY REEDS_POCKETS (byte-identical).
export const REEDS_HOP_DUR = 0.22;
export const REEDS_HOP_LIFT = 26;
export function hopLift(hopT, x, y, pockets = REEDS_POCKETS) {
  if (!(hopT > 0)) return 0;
  const lift = Math.sin(Math.PI * (1 - hopT / REEDS_HOP_DUR)) * REEDS_HOP_LIFT;
  return inGravityPocket(x, y, pockets) ? -lift : lift;
}

export const REEDS_DARK_WIDTH = 7200;     // the Black Reeds descent (deeper than REEDS_WIDTH 6000)

// G1 (v1.8): the FOUR inverted-gravity pockets of the Black Reeds — the three
// Reeds pockets (same coords) PLUS a 4th, so the ceiling-clump traversal has
// one more hazard. A SUPERSET of REEDS_POCKETS (the first three are identical),
// so a pocket-pinned smoke assertion against the Reeds coords still holds.
export const REEDS_DARK_POCKETS = [
  { x: 1150, y: 120, w: 520, h: 360 },   // pocket 1 — Slick Hollow reach (Reeds)
  { x: 2900, y: 90,  w: 560, h: 380 },   // pocket 2 — mid-swamp (Reeds)
  { x: 4550, y: 130, w: 540, h: 350 },   // pocket 3 — the approach to the deep (Reeds)
  { x: 5900, y: 100, w: 580, h: 370 },   // pocket 4 — the Black Reeds' extra ceiling (NEW)
];

// G1 (v1.8): the Black Reeds' DEEPER + FASTER flood band — the open dark water
// begins higher (a bigger flood) and the wade is slower than the Reeds' 0.72.
// A pure speed FACTOR for a world point: 1.0 on the banks, the factor in the
// flood. Cheaper-to-call than the Reeds band (a horizontal line), so it stays
// cheap per-frame.
export const REEDS_DARK_FLOOD_FLOOR = 780;   // the open water begins higher (deeper flood)
export const REEDS_DARK_FLOOD_FACTOR = 0.62; // a slower wade than the Reeds' 0.72

// G1 (v1.8): the Black Reeds' OWN lantern-economy tuning — an ABSOLUTE tuning
// table (the SAME shape as LANTERN) that REEDS_DARK_LANTERN's pure wrappers
// (lanternRadiusFor / lanternTickFor) read. Every field is the v1.6 Reeds'
// LANTERN value scaled: a faster drain (the candle burns ~35% faster) + a
// shorter reach (the "deep dark" is darker) + a tighter low-fuel floor + a
// tighter refill reach, while the refill RATES stay at LANTERN's. A pure table
// (one file edit to rebalance); the v1.6 Reeds (cycle-0) keeps the stock
// LANTERN constants untouched (byte-identical).
export const REEDS_DARK_LANTERN = {
  lightRadius: 213,        // ≈ LANTERN.lightRadius 260 × 0.82 — a shorter reach
  minRadius: 74,           // ≈ LANTERN.minRadius 88 × 0.84 — the low-fuel floor dims too
  fuelDrain: 0.054,        // ≈ LANTERN.fuelDrain 0.04 × 1.35 — the candle burns ~35% faster
  refillRestSpot: 0.6,     // = LANTERN.refillRestSpot (unchanged refill rate)
  refillFirefly: 0.45,     // = LANTERN.refillFirefly (unchanged refill rate)
  restSpotRadius: 81,      // ≈ LANTERN.restSpotRadius 90 × 0.9 — a touch tighter refill reach
  fireflyRadius: 64,       // = LANTERN.fireflyRadius (unchanged)
};

// G1 (v1.8): the Black Reeds' DENSER bestiary tuning — the Wisp/Serpent/Leech
// PICK THRESHOLDS (the top-of-roll ladder in _spawnWave). A Reeds wave rolls
// `rr = Math.random()` and picks a light-bestiary archetype when rr clears the
// top of the ladder: rr > wisp -> Wisp, else rr > serpent -> Serpent, else
// rr > leech -> Leech (each a RARE pick at the top of the roll, sharing the
// existing spawn cap so the enemy count never grows unbounded). CYCLE-0 REEDS
// uses REEDS_BESTIARY_DENSITY (the EXACT v1.6 thresholds — 0.965 / 0.935 /
// 0.905 = a 3.5% / 3.0% / 3.0% pick); the BLACK REEDS variant uses
// REEDS_DARK_BESTIARY_DENSITY (DENSER — 0.94 / 0.905 / 0.87 = a 6.0% / 3.5% /
// 3.5% pick, the darker world calls MORE of the light-bestiary). A base
// (non-Reeds) run never reads either (it skips the Reeds branch in _spawnWave
// entirely), so a first-time run is byte-identical. Pure data — testable.
export const REEDS_BESTIARY_DENSITY = { wisp: 0.965, serpent: 0.935, leech: 0.905 };
export const REEDS_DARK_BESTIARY_DENSITY = { wisp: 0.94, serpent: 0.905, leech: 0.87 };


// The rank a filed challenge score sits at in the top-5 list (1 = the top
// entry). Deterministic from the list (descending by score).
export function challengeRank(score, list) {
  const arr = Array.isArray(list) ? list : [];
  const sc = Number(score);
  let n = 0;
  for (const e of arr) if (Number(e && e.score) > sc) n += 1;
  return n + 1;
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
// The Silt Wyrm guards the second floor of the finite descent.
export const SILT_WYRM = {
  kind: 'wyrm',
  hp: 48000,
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

export const WARDEN = {
  kind: 'warden',
  hp: 48000,                    // Keeps 2–4m pacing with uninterrupted brush movement.
  awakenNeed: { red: 45, blue: 45, green: 45 }, // the SAME 3-hue rhythm as the herons / wyrm
  strikeDmg: 12,                // the maw-strike's damage (a big hit, dodgeable — same as the wyrm)
  strikeReach: 220,             // a frog within this of the surface point is hit
  surfacePoints: 3,             // the telegraphed maw points on the arena line (same geometry as the wyrm)
  telegraph: 1.5,               // the ripple-ring tell before the maw opens (~1.5 s — the wyrm's language)
  mawOpen: 10.5,                // the maw-open (PAINT IT) window — the dominant phase (the wyrm's surfaced 7.0 + the Warden's 3-hue-awaken tempo; cadence tuned to the 2–4 min human band, comparable to the Silt Wyrm)
  mawClosed: 2.4,               // the maw-closed (invulnerable) window it retreats behind
  surfaceY: 780,                // the arena water line (same line the wyrm slithers along)
  // F1 (v1.7): the FUEL SIPHON rate. Base drains a FULL wick (fuel 1→0) in
  // 60s while the lantern is LIT (0.01667/s = 1/60). The taste bias scales it
  // (a "Feast Season" Warden siphons faster, a "Quiet Reeds" Warden slower):
  //   feast  ×1.15 → 45s per wick · neutral ×1.0 → 60s · quiet ×0.85 → 75s.
  // This is distinct from the ambient LANTERN.fuelDrain (0.04/s while lit) —
  // the siphon is the Warden's active feeding, on TOP of the ambient burn, and
  // it auto-extinguishes the lantern when the wick empties. Deterministic +
  // pure in wardenFuelSiphon(warden, lantern, dt).
  siphonRate: 0.01667,          // fuel / second while the Warden is engaged + the lantern is LIT (a full wick in 60s, taste-scaled)
  paleHue: '#c8cfc4',           // the distinct PALE palette (a lantern-eating pallor, not the wyrm's mud)
  paleHueLight: '#eef0e6',
  mawGlow: '#e8836b',           // the maw's ember glow (the 3-hue awaken / maw-window tell)
  // P10: the body line is drawn as a CAPPED segment count (no per-frame
  // allocation), like the wyrm — the underground slither is the perf risk.
  bodySegments: 14,
};
// F1: the Warden's TASTE BIAS — a pure aggression / siphon multiplier keyed to
// the D2 Wander taste tag. A "Feast Season" Warden (tag 'swarm') is MORE
// aggressive: it moves faster AND siphons faster (> 1); a "Quiet Reeds" Warden
// (tag 'calm') is more evasive: slower, a gentler siphon (< 1); the neutral
// tags (grump / mixed) are the base rate (1.0). This is the D<->F tie: the
// SAME boss feels different per run, seeded by the taste. Deterministic on the
// tag (no Math.random). Pure.
export function wardenTasteFactor(taste) {
  const tag = taste && taste.tag;
  if (tag === 'swarm') return 1.15;   // Feast Season: the more aggressive / faster-siphon Warden
  if (tag === 'calm') return 0.85;    // Quiet Reeds: the more evasive Warden (slower, gentler siphon)
  return 1.0;                         // the neutral tags (grump / mixed) — the base rate
}
// F1: THE WARDEN STATE MACHINE (a pure movement pattern; testable headless, the
// wyrmStep template). h = the boss object (carries warden, phase, phaseT,
// surfIdx, tasteFactor). Advances dt; returns an event: 'maw-open' (the maw
// just snapped open — PAINT IT now; a maw-strike fires at the point) |
// 'maw-close' (the maw sealed shut — invulnerable) | 'defeated' (hp<=0) | 0.
// The RHYTHM (mirrors the wyrm): it RETREATS behind its maw (phase 'mawClosed',
// invulnerable + untargetable, the body slithers beneath), then TELEGRAPHS the
// maw with a growing ripple ring at its next surface point (phase 'telegraph').
// When the tell lapses the MAW OPENS (phase 'mawOpen' — PAINTABLE through the
// existing paintBoss path) and a maw-strike hits the lane at the point. The
// 3-hue awaken (h.awakened) speeds the RHYTHM + the taste (h.tasteFactor)
// scales the siphon: the same boss, a different tempo per taste.
export function wardenStep(h, dt, view, tuning, now) {
  h.phaseT -= dt;
  if (h.hp <= 0) return 'defeated';
  // The awaken WINDOW lapses exactly like the herons / wyrm (bossStep/wyrmStep):
  // after the bossAwakenDuration the Warden de-awakens and its hue resets, so
  // the 3-hue rhythm is a recurring CYCLE, not a permanent state.
  if (h.awakened) {
    h.awakenedT = (h.awakenedT || 0) - dt;
    if (h.awakenedT <= 0) { h.awakened = false; h.hue.red = 0; h.hue.blue = 0; h.hue.green = 0; }
  }
  // The taste bias + the awaken drive the CADENCE. The Warden's vulnerable
  // window (mawOpen) is a FIXED, fair mechanic — taste does not change how long
  // it can be painted, only HOW OFTEN it opens. An AGGRESSIVE taste (Feast,
  // tasteFactor > 1) closes the invulnerable gaps (mawClosed + telegraph) so the
  // maw opens MORE OFTEN (a frenetic, faster tempo); an EVASIVE taste (Quiet,
  // < 1) lengthens them (rarer windows, a slower fight). The awaken then speeds
  // the whole rhythm by the wyrm's 0.62 factor (all three phases). Deterministic
  // (reads h.tasteFactor, set from the seed at the arena entry).
  const gapScale = 1.0 / (h.tasteFactor || 1.0);   // aggressive → shorter gaps
  const awakenScale = h.awakened ? 0.62 : 1.0;
  if (h.phase === 'mawClosed') {
    // the maw is sealed (invulnerable) — the body slithers toward the next point.
    if (h.phaseT <= 0) {
      h.phase = 'telegraph';
      h.phaseT = WARDEN.telegraph * gapScale * awakenScale;
    }
  } else if (h.phase === 'telegraph') {
    // the growing ripple-ring tell at the NEXT surface point (the wyrm's language).
    if (h.phaseT <= 0) {
      h.phase = 'mawOpen';
      h.phaseT = WARDEN.mawOpen * awakenScale;
      return 'maw-open';   // the maw snaps open (paintable now) + a maw-strike at the point
    }
  } else if (h.phase === 'mawOpen') {
    if (h.phaseT <= 0) {
      // the maw seals shut and it begins the retreat toward the NEXT point.
      h.phase = 'mawClosed';
      h.phaseT = WARDEN.mawClosed * gapScale * awakenScale;
      h.surfIdx = (((h.surfIdx || 0) + 1) % WARDEN.surfacePoints);
      return 'maw-close';
    }
  }
  return 0;
}
// F1: the Warden's maw point (index 0..n-1), cycling on its arena line — the
// SAME geometry as the wyrm (the 3 points span the end-of-run arena). Pure;
// returns [x, y].
export function wardenSurfacePoint(h, surfIdx, worldW) {
  const n = WARDEN.surfacePoints;
  const i = ((surfIdx % n) + n) % n;
  const x = (worldW - 900) + (i / (n - 1)) * 750;   // arenaStart .. +750
  return [x, WARDEN.surfaceY];
}
// F1: THE WARDEN FUEL SIPHON (a pure tick). While the Warden is active (engaged,
// not defeated) and the player's lantern is LIT, it drains candle fuel at the
// taste-scaled rate — the pale creature FEEDS on the light. It siphons NOTHING
// when the lantern is UNLIT or its fuel is EMPTY (it is a lantern-eater, not a
// lantern-breaker — the player can dodge it by extinguishing the wick). In a
// Wander x Reeds run this INTERACTS with the Reeds lantern economy (the siphon
// also shrinks the light radius, which is what the Reeds bestiary keys to) — a
// genuine synergy, not a bolt-on. Returns a NEW lantern state (see lanternTick:
// a pure, non-mutating tick) so the caller reassigns this.lantern; the caller
// refreshes the eased radius / lightFactor from the returned state. Pure +
// deterministic.
export function wardenFuelSiphon(warden, lantern, dt) {
  const base = lanternState(lantern && lantern.fuel, lantern && lantern.lit);
  // Only siphon while the Warden is engaged + alive + the lantern is lit.
  const active = warden && warden._intro <= 0 && warden.hp > 0 && !warden.flying && !warden.sinking;
  // If the wick is already empty but the lantern claims to be lit, the auto-
  // extinguish rule (the lantern's own) must snap lit off — a lit lantern with
  // no fuel is impossible, and the Warden cannot feed on an already-empty wick.
  if (base.lit && base.fuel <= 0) return { fuel: 0, lit: false };
  if (!active || !base.lit || base.fuel <= 0 || dt <= 0) return base;
  const rate = WARDEN.siphonRate * (warden.tasteFactor || 1.0);
  const fuel = Math.max(0, base.fuel - rate * dt);
  return { fuel, lit: fuel > 0 ? base.lit : false };   // auto-extinguish at 0 (the lantern's own rule)
}

export const UMBRA_WYRM = {
  kind: 'umbra',
  hp: 60000,                    // ~60k HP — one tier above the Silt Wyrm's 48k
  surfaceY: 1240,               // flooded lower bank, with 260px below the maw inside the 1500px world
  surfacePoints: 4,             // 4 maw points (it pairs two of them — the DUAL maw)
  transit: 0.85,               // a BRIEF transit — the "faster twin": the body only ducks briefly between breaches (vs the Silt Wyrm's 1.8)
  transitDeep: 0.7,             // the "deep dark" phase transit multiplier (faster still)
  dualTelegraph: 0.85,          // the DUAL-maw telegraph (BOTH points marked at once) — v1.10 B4: lengthened 0.6→0.85 so the heavy dual strike is readable + dodgeable (a competent player must be able to react, not frame-perfect); was the one heavy-attack telegraph under the ~0.8 s fairness threshold
  surfaced: 6.7,                // the surfaced PAINT window (the dominant phase — the DUAL maws stay open; the danger is the dual strike, not invulnerability)
  surfacedDeep: 5.4,            // the "deep dark" surfaced window (still long — the phase-2 danger is the dark + siphon, not invulnerability)
  strikeReach: 170,             // a frog this close to a surf point takes the maw hit
  strikeDmg: 14,                // the maw-strike damage (a heavier twin)
  deepStrikeMult: 1.2,          // the "deep dark" maw-hit multiplier (heavier strikes in the final phase)
  awakenNeed: { red: 90, blue: 90, green: 90 },  // the 3-hue awaken (the SAME latch as every boss)
  deepDarkPhase: 0.4,           // HP fraction where the "deep dark" final phase begins
  siphonRate: 0.05,             // the FUEL SIPHON rate (Warden-inherited; lantern-eater)
  siphonDeep: 1.6,              // the "deep dark" siphon multiplier (it feeds harder in phase 2)
  hue: '#6d4a8f',               // the base indigo-violet head (a darker twin than the silt's brown)
  hueLight: '#c8a4e8',          // the base light hue
  deepHue: '#3b2566',           // the "deep dark" final-phase head (a deeper violet)
  deepHueLight: '#b478ff',      // the "deep dark" light hue (a cold glow)
  mudHueLight: 'rgba(150,120,200,0.6)',  // an indigo/violet hue (a darker twin than the silt's mud)
};

// G2: the Umbral Wyrm's maw point (index 0..n-1) — the SAME geometry as the Silt
// Wyrm (the points span the end-of-run arena). Pure; returns [x, y]. (The Black
// Reeds arena is wider (world.w 7200) so the arena start shifts — this reads the
// world width like wyrmSurfacePoint does.)
export function umbrSurfacePoint(h, surfIdx, worldW) {
  const n = UMBRA_WYRM.surfacePoints;
  const i = ((surfIdx % n) + n) % n;
  // the arena spans the right ~900px of the Black Reeds descent (4 points):
  const x = (worldW - 1050) + (i / (n - 1)) * 900;   // arenaStart .. +900 (4 points)
  return [x, UMBRA_WYRM.surfaceY];
}

// G2: the Umbral Wyrm's DUAL-maw partner point — the SECOND point it marks at
// the same time as its primary (h.surfIdx). It is the next point in the cycle
// (a distinct, adjacent point, so the two maws are never the same point). Pure;
// returns the partner's surfIdx (a 0..n-1 index).
export function umbrDualPartner(h) {
  const n = UMBRA_WYRM.surfacePoints;
  return (((h.surfIdx || 0) + 1) % n);   // the adjacent point (the dual maw's second head)
}

// G2: is the Umbral Wyrm in its "deep dark" final phase (phase 2)? A pure read
// of the HP fraction against deepDarkPhase. The game.js layer uses this to make
// the lantern MANDATORY (invulnerable while unlit) + ramp the siphon.
export function umbrDeepDark(h) {
  if (!h || !h.maxHp) return false;
  return (h.hp / h.maxHp) <= UMBRA_WYRM.deepDarkPhase;
}

// G2: the Umbral Wyrm's movement state machine — the Silt Wyrm's wyrmStep, made
// DUAL-PHASE + faster + deeper. h = the boss object (carries umbra, phase,
// phaseT, surfIdx, awakened, hue, hp, maxHp). It advances a pure per-phase
// timer (the SAME timing contract as wyrmStep / bossStep: phaseT counts down;
// on lap it sets the NEXT phase + that phase's duration). Phases:
//   'transit'         — underground, the body slithers to the next maw point
//                       (INVULNERABLE, untargetable).
//   'dual-telegraph'  — the DUAL maw tell: BOTH the primary point AND its
//                       adjacent partner ripple at once (~1 s; the heavier hit
//                       is telegraphed by a WIDER tell, per spec).
//   'surfaced'        — the maw points are open + PAINTABLE (the dominant
//                       phase; the player paints the head at a maw point).
// The "deep dark" (phase 2, hp/maxHp <= 0.5) escalates the cadence (a shorter
// transit + a shorter surfaced window) — the fight gets faster as the wyrm
// weakens. The 3-hue awaken (h.awakened) speeds the transit cadence (the
// "faster rhythm", shared with every boss). Pure + deterministic (no
// Math.random — the maw points are DETERMINISTIC: the primary cycles
// 0,1,2,3... and the partner is its adjacent point; the strike target is fixed
// by the arena geometry, not a roll). Returns an event string ('transit' on
// the re-submerge, 'dual-breach' on the dual maw surfacing, 'submerge' on the
// re-submerge, 'defeated' on hp<=0) or 0 (steady). The caller (game.js
// _updateUmbra) positions the head + handles the strike/defeat.
export function umbrStep(h, dt, view, tuning, now) {
  if (h.hp <= 0) { h.sinking = (h.sinking || 0) + dt; return 'defeated'; }
  // the 3-hue awaken window lapses exactly like the herons / the wyrm (the full
  // 3-hue rhythm is a recurring CYCLE, not a permanent state).
  if (h.awakened) {
    h.awakenedT = (h.awakenedT || 0) - dt;
    if (h.awakenedT <= 0) { h.awakened = false; h.hue.red = 0; h.hue.blue = 0; h.hue.green = 0; }
  }
  const phase2 = umbrDeepDark(h);
  const transitMult = (h.awakened ? 0.6 : 1.0) * (phase2 ? UMBRA_WYRM.transitDeep : 1.0);
  const transitDur = UMBRA_WYRM.transit * transitMult;
  const surfacedDur = (phase2 ? UMBRA_WYRM.surfacedDeep : UMBRA_WYRM.surfaced);
  h.phaseT -= dt;
  if (h.phase === 'transit' || h.phase == null) {
    // underground: the body slithers toward the current maw point. It re-
    // surfaces AT that point (the head sits at it while the DUAL telegraph
    // plays, both points marked — the player sees TWO ripples at once).
    if (h.phaseT <= 0) {
      h.phase = 'dual-telegraph';
      h.phaseT = UMBRA_WYRM.dualTelegraph * (h.awakened ? 0.6 : 1.0);
      h.strikeArmed = true;
    }
  } else if (h.phase === 'dual-telegraph') {
    // the DUAL maw telegraph ends — it SURFACES at its point (paint window
    // OPENS). The breach locks to the CURRENT surface point (like the wyrm);
    // the DUAL partner is its ADJACENT point (both ripples already marked).
    if (h.phaseT <= 0) {
      h.phase = 'surfaced';
      h.phaseT = surfacedDur;
      // the DUAL partner is the adjacent maw point (deterministic):
      h._partnerIdx = ((h.surfIdx || 0) + 1) % UMBRA_WYRM.surfacePoints;
      return 'dual-breach';
    }
  } else if (h.phase === 'surfaced') {
    if (h.strikeArmed && h.hp > 0) {
      h.strikeArmed = false;
      return 'strike';   // the maw-strike hits the lanes at the maw points
    }
    if (h.phaseT <= 0) {
      // withdraw + begin the transit toward the NEXT maw point. Remember where
      // it just was (the transit's start) so game.js interpolates the head
      // toward the next point; the new point is the next index.
      h._transitFromX = umbrSurfacePoint(h, h.surfIdx, view.worldW)[0];
      h.phase = 'transit';
      h.phaseT = transitDur;
      h.surfIdx = (((h.surfIdx || 0) + 1) % UMBRA_WYRM.surfacePoints);
    }
  }
  return 0;
}

// G2: the Umbral Wyrm's FUEL SIPHON (a pure tick) — the Warden-inherited
// lantern-eater. While the wyrm is engaged + alive and the player's lantern is
// LIT, it drains candle fuel (faster in the "deep dark" phase, the Warden's
// siphonDeep multiplier). It siphons NOTHING when the lantern is UNLIT or empty
// (a lantern-eater, not a breaker). Returns a NEW lantern state (see
// lanternTick: a pure, non-mutating tick) so the caller reassigns this.lantern.
// Pure + deterministic.
export function umbraFuelSiphon(umbra, lantern, dt) {
  const base = lanternState(lantern && lantern.fuel, lantern && lantern.lit);
  // Only siphon while the wyrm is engaged + alive + the lantern is lit.
  const active = umbra && umbra._intro <= 0 && umbra.hp > 0 && !umbra.flying && !umbra.sinking;
  // A lit lantern with no fuel is impossible — the auto-extinguish rule must
  // snap it off; the wyrm cannot feed on an already-empty wick.
  if (base.lit && base.fuel <= 0) return { fuel: 0, lit: false };
  if (!active || !base.lit || base.fuel <= 0 || dt <= 0) return base;
  const mult = umbrDeepDark(umbra) ? UMBRA_WYRM.siphonDeep : 1.0;
  const rate = UMBRA_WYRM.siphonRate * mult * (umbra.tasteFactor || 1.0);
  const fuel = Math.max(0, base.fuel - rate * dt);
  return { fuel, lit: fuel > 0 ? base.lit : false };   // auto-extinguish at 0 (the lantern's own rule)
}

// G2: is the Umbral Wyrm PAINTABLE right now (the "deep dark" lantern-mandatory
// rule)? A pure read: the wyrm is paintable while its maw is open (surfaced) AND
// (in the "deep dark" phase) the player's lantern is LIT. In phase 1 the maw
// being open is enough. In phase 2 an UNLIT lantern makes it INVULNERABLE (the
// deep dark only yields to light) — this is the mechanic that makes the lantern
// MANDATORY in the final phase. `lanternLit` is the caller's boolean (the
// player's lantern.lit). Pure + deterministic.
export function umbraPaintable(h, lanternLit) {
  if (!h || h.hp <= 0 || h.flying > 0 || h.sinking > 0) return false;
  if (h.phase !== 'surfaced') return false;
  if (umbrDeepDark(h) && !lanternLit) return false;   // the "deep dark" needs the lantern
  return true;
}


export const BOSS_IDS = ['gray', 'wyrm', 'warden', 'umbra'];
// The display name for each boss kind (read by the Gallery Wall ledger so a
// player can SEE which boss they are still missing).
export const BOSS_NAMES = {
  gray: 'The Great Gray Heron',
  wyrm: 'The Silt Wyrm',
  warden: 'The Warden of the Reeds',
  umbra: 'The Umbral Wyrm',
};
// True if the save has a recorded defeat of `kind`. Pure + defensive (a legacy
// save that was never migrated reads an empty list -> false for every kind).
export function bossDefeated(save, kind) {
  return !!(save && save.flags && Array.isArray(save.flags.bossDefeats)
    && save.flags.bossDefeats.includes(kind));
}
// Cosmetic collection completion: every ordinary painting owned +
// every boss in BOSS_IDS defeated at least once + a first-time victory
// (save.flags.heronDefeated) + a Reeds victory (save.flags.reedsVictory).
// Pure + deterministic; a fresh save is false.
export function galleryCompletion(save) {
  if (!save || !Array.isArray(save.owned)) return false;
  const owned = save.owned;
  const allPaintings = PAINTINGS.every(p => owned.includes(p.id));
  if (!allPaintings) return false;
  const beats = (save.flags && Array.isArray(save.flags.bossDefeats)) ? save.flags.bossDefeats : [];
  const allBosses = BOSS_IDS.every(k => beats.includes(k));
  if (!allBosses) return false;
  const firstWin = !!(save.flags && save.flags.heronDefeated);
  const reedsWin = !!(save.flags && save.flags.reedsVictory);
  return firstWin && reedsWin;
}
// H2 (v1.8): the Gallery Wall progress readout — the counts the player can SEE
// (paintings owned / total, bosses defeated / total) + the complete flag. Pure
// + deterministic; a fresh save has no paintings or boss defeats. This is the
// single source of truth for the Gallery Wall strip + the title badge + the
// full-collection glow, so the presentation never re-derives the bar itself.
export function galleryCompletionProgress(save) {
  const owned = (save && Array.isArray(save.owned)) ? save.owned : [];
  const paintingsOwned = PAINTINGS.filter(p => owned.includes(p.id)).length;
  const beats = (save && save.flags && Array.isArray(save.flags.bossDefeats)) ? save.flags.bossDefeats : [];
  const bossesDefeated = BOSS_IDS.filter(k => beats.includes(k)).length;
  return {
    paintingsOwned,
    paintingsTotal: PAINTINGS.length,
    bossesDefeated,
    bossesTotal: BOSS_IDS.length,
    complete: galleryCompletion(save),
  };
}


// ---------------------------------------------------------------- upgrades
export const UPGRADES = {
  capacity: {
    name: 'Pigment Satchel', desc: 'Carry more pigment on expeditions.',
    // v1.10 B3: per-level costs form a PROGRESSION, not a wall. L1 is reachable
    // on the first-run welcome grant; L2 is reached by zone 3–4; L3 is a
    // multi-run aspiration. L2/L3 were softened from the pre-B3 steep jump
    // (capacity L3 r8b8g8 → r7b7g7; vitality L2 b8/g6 → b7/g5, L3 b12/g10 → b10/g8)
    // so the track reads as a climb. L1 costs are UNCHANGED (the welcome-grant
    // safety net).
    levels: [ { cost: { red: 3, blue: 3, green: 3 } },
              { cost: { red: 5, blue: 5, green: 5 } },
              { cost: { red: 7, blue: 7, green: 7 } } ],
  },
  power: {
    name: 'Brush Craft', desc: 'Your strokes hit harder.',
    // L3 softened r10/b7/g7 → r9/b6/g6 (the red step 4→6→9 keeps a steady climb).
    levels: [ { cost: { red: 4, blue: 2, green: 2 } },
              { cost: { red: 6, blue: 4, green: 4 } },
              { cost: { red: 9, blue: 6, green: 6 } } ],
  },
  vitality: {
    name: 'Swamp Vitality', desc: 'One more lily pad of health.',
    // L2/L3 softened (b8/g6→b7/g5, b12/g10→b10/g8) — blue 5→7→10 and green
    // 3→5→8 keep a steady, reachable climb rather than a late wall.
    levels: [ { cost: { red: 2, blue: 5, green: 3 } },
              { cost: { red: 4, blue: 7, green: 5 } },
              { cost: { red: 6, blue: 10, green: 8 } } ],
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
// A fresh save (its FIRST expedition) banks a one-time welcome kit so a
// brand-new player can buy a first upgrade or a first loadout slot without
// grinding an entire zone. v1.10 B3: raised from r3/b6/g4 to r5/b9/g5 — the
// M1 lower-bound income model showed a first-timer's bank by zone 3/4 barely
// covered the cheapest 2-painting loadout with NOTHING left for a 3rd painting
// or a first upgrade level (no "choices, not exactly-one"). The extra +2 red /
// +3 blue / +1 green gives real margin so the player can take the cheapest
// 2-slot loadout AND still pick a 3rd painting (zone 3) or a first upgrade
// level (zone 4). One-time (gated by the welcomeGranted flag).
export const WELCOME_GRANT = { red: 6, blue: 9, green: 5 };
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

export const SAVE_VERSION = 12;

// R1 (v1.8): the game's RELEASE version string — the single source of truth.
// Display-only (the title screen + the Options panel render it); it is never
// part of the save schema and never feeds a run, so a version bump can never
// shift save migration or pacing. `tests/smoke.mjs` asserts its value.
export const GAME_VERSION = '1.0.0';

// Saves from every previous version are normalized directly by migrateSave.


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

function normalizeGalleryComplete(raw) {
  return !!raw;
}

// H1 (v1.8): normalize the boss-defeat list to a clean array of known BOSS_IDS
// (no duplicates, no unknown kinds). A missing / non-array field (every
// pre-v1.8 save) reads back as [] — nobody backfills defeats. Pure.
function normalizeBossDefeats(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const k of raw) {
    if (typeof k === 'string' && BOSS_IDS.includes(k) && !seen.has(k)) {
      seen.add(k); out.push(k);
    }
  }
  return out;
}


export function freshSave() {
  return {
    studio: { completed: [] },
    sketchbook: [],
    sketchPins: [],       // Q6: at most 2 pinned sketchbook page ids (never age out)
    sketchExhibit: null,  // Q7: explicit pinned title-screen keepsake; no automatic selection
    saveVersion: SAVE_VERSION,
    bank: { red: 0, blue: 0, green: 0 },
    owned: [],            // painting ids
    loadout: [],          // up to 2 painting ids
    upgrades: { capacity: 0, power: 0, vitality: 0 },
    flags: { intro: false, firstOrb: false, firstHurt: false, firstAtelier: false, firstDefeat: false, croaksworthAsked: false, croaksworthGiven: false, heronDefeated: false, welcomeGranted: false, tutorialSkipped: false, reedsUnlocked: false, reedsVictory: false, crossingPainted: false, bossDefeats: [] },
    stats: { expeditions: 0, victories: 0, deaths: 0, heronsPainted: 0, treasures: 0 },
    bestRun: null,        // {pigments, time, cleared}
    tutorialDrills: { burn: false, freeze: false, root: false, awaken: false }, // T1/T3 (v1.2 M13)
    firstVictoryCinematic: false, // M1 (v1.4): the first-victory cinematic beat has been SEEN (a fresh + every migrating-old save = false → they get it once)
    challengeScores: [],  // K7 (v1.5 M2): the CURATOR CHALLENGE best-score file — top 5, each {seed,date,score}, ordered desc by score
    wanderSeed: 0,        // D1 (v1.7): THE WANDER's last-seen seed (integer; 0 = no Wander run yet). Off by default (options.wander), so a default-OFF save never runs the generated-layout path.
    galleryComplete: false,
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
const SAVE_FIELDS = ['bank', 'owned', 'loadout', 'upgrades', 'flags', 'stats', 'bestRun', 'tutorialDrills', 'firstVictoryCinematic', 'challengeScores', 'wanderSeed', 'galleryComplete', 'studio', 'sketchbook', 'sketchPins'];

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
    for (const k of Object.keys(f.flags)) {
      // H1 (v1.8): flags.bossDefeats is an ARRAY (the list of boss kinds
      // defeated at least once), not a boolean — re-normalize it after the
      // loop (normalizeBossDefeats) instead of forcing it to a boolean here.
      if (k === 'bossDefeats') continue;
      out.flags[k] = !!raw.flags[k];
    }
  }
  // H1 (v1.8): carry the boss-defeat list forward (a clean array of known
  // boss ids; [] for a legacy save with no field, the real list for a v12
  // save). The v11->v12 migration step re-normalizes defensively on the way up.
  out.flags.bossDefeats = normalizeBossDefeats(raw.flags && raw.flags.bossDefeats);
  if (isPlainObj(raw.stats)) {
    for (const k of Object.keys(f.stats)) out.stats[k] = Math.max(0, Number(raw.stats[k]) || 0);
  }
  out.bestRun = isPlainObj(raw.bestRun) ? raw.bestRun : f.bestRun;
  out.tutorialDrills = normalizeDrills(raw.tutorialDrills);
  out.firstVictoryCinematic = normalizeFirstVictoryCinematic(raw.firstVictoryCinematic);
  out.challengeScores = normalizeChallengeScores(raw.challengeScores);
  out.galleryComplete = normalizeGalleryComplete(raw.galleryComplete);
  // R5 (v1.6 Module R): carry the reedsUnlocked gate flag forward
  // (false for a legacy v9 save with no field, the real boolean for a
  // v10 save). The v9->v10 migration step re-normalizes defensively.
  out.flags.reedsUnlocked = normalizeReedsUnlocked(raw.flags && raw.flags.reedsUnlocked);
  // G1 (v1.8): carry the BLACK REEDS gate flag forward (false for a legacy
  // save with no field, the real boolean for a save that beat the Reeds). The
  // generic flags loop above copies it too; this re-normalizes defensively
  // (mirroring reedsUnlocked). No SAVE_VERSION bump — the field lives on the
  // EXISTING save.flags object, which is already serialized wholesale.
  out.flags.reedsVictory = normalizeReedsVictory(raw.flags && raw.flags.reedsVictory);
  // Q5 (Astra): carry THE PAINTED CROSSING's postcard-stamp latch forward
  // (false for a legacy save with no field, the real boolean for a save that
  // painted the crossing). No SAVE_VERSION bump — the field lives on the
  // EXISTING save.flags object, which is already serialized wholesale
  // (mirroring reedsUnlocked / reedsVictory).
  out.flags.crossingPainted = normalizeCrossingPainted(raw.flags && raw.flags.crossingPainted);
  // D1 (v1.7): carry THE WANDER's last-seed latch forward (0 for a legacy
  // v10 save with no field, the real seed for a v11 save). The v10->v11
  // migration step re-normalizes defensively on the way up.
  out.wanderSeed = normalizeWanderSeed(raw.wanderSeed);
  out.studio = normalizeStudio(raw.studio);
  const rawPins = normalizeSketchPins(raw.sketchPins);
  out.sketchbook = normalizeSketchbook(raw.sketchbook, rawPins);
  out.sketchPins = rawPins.filter(id => out.sketchbook.some(p => p.id === id));
  out.sketchExhibit = typeof raw.sketchExhibit === 'string' && out.sketchPins.includes(raw.sketchExhibit) ? raw.sketchExhibit : null;
  // All supported versions now share this sanitizer; removed systems stay absent.
  out.saveVersion = SAVE_VERSION;
  return withCase(out, 'migrated');
}

// Q3 (v1.6): SAVE EXPORT/IMPORT validation. The sanctioned escape hatch for the
// loopback-only localStorage architecture is a PASTE-based round trip (no file
// APIs, no server): Export copies the save JSON to the clipboard; Import reads
// a pasted blob and must decide — hard REFUSE on anything that does not parse or
// normalize to a valid current-schema save, or accept. This is the PURE gate the
// import path runs every blob through. It reuses the EXISTING migration chain
// (migrateSave: per-field normalization of every supported version), so a
// valid-but-old (e.g. v1-era) blob migrates forward to the current schema
// exactly as a local load would.
//
// It is STRONGER than a bare migrateSave, because migrateSave is deliberately
// lenient (it fills missing fields with defaults and returns a fresh save for
// junk — B2 "keep what we can"). For an EXPLICIT player import we refuse
// aggressively instead:
//   (a) the blob must PARSE to a plain JS object (garbage JSON -> refuse);
//   (b) it must be a recognizable SAVE (a known top-level field present) —
//       a random object is not a Frogue save (refuse);
//   (c) a PRESENT saveVersion must be an integer in [1, SAVE_VERSION] — a
//       future/unknown or malformed version is refused (never trust a blob
//       ahead of us);
//   (d) PRESENT structural fields must be the right KIND (bank/flags objects,
//       owned/loadout arrays, reedsUnlocked a boolean) — a wrong kind would
//       crash migrateSave's accessors;
//   (e) the migration must run WITHOUT throwing and NOT collapse to 'fresh'
//       (the junk-object case) — any throw means the blob does not normalize.
// Returns { ok: true, save } on success (save is the migrated, SAVE_VERSION-10
// normalized object) or { ok: false, error } on refuse (error is a short
// human-readable reason). Never mutates any existing save.
export function validateSaveBlob(json) {
  let raw;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return { ok: false, error: 'that is not valid JSON — paste the exact Export blob' };
  }
  if (!isPlainObj(raw)) {
    return { ok: false, error: 'a Frogue save is an object — that was not one' };
  }
  if (!SAVE_FIELDS.some(k => k in raw)) {
    return { ok: false, error: 'no save fields found — that is not a Frogue Gallery save' };
  }
  // (c) a present saveVersion must be a whole number in [1, SAVE_VERSION].
  if (raw.saveVersion !== undefined && raw.saveVersion !== null) {
    const v = raw.saveVersion;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > SAVE_VERSION) {
      return { ok: false, error: `unsupported save version ${JSON.stringify(v)} (need 1..${SAVE_VERSION})` };
    }
  }
  // (d) present structural fields must be the right kind.
  if (raw.bank !== undefined && !isPlainObj(raw.bank)) {
    return { ok: false, error: 'the bank field was malformed (expected an object)' };
  }
  if (raw.flags !== undefined && !isPlainObj(raw.flags)) {
    return { ok: false, error: 'the flags field was malformed (expected an object)' };
  }
  if (raw.owned !== undefined && !Array.isArray(raw.owned)) {
    return { ok: false, error: 'the owned field was malformed (expected a list)' };
  }
  if (raw.loadout !== undefined && !Array.isArray(raw.loadout)) {
    return { ok: false, error: 'the loadout field was malformed (expected a list)' };
  }
  if (raw.reedsUnlocked !== undefined && typeof raw.reedsUnlocked !== 'boolean') {
    return { ok: false, error: 'the reedsUnlocked flag was malformed (expected true/false)' };
  }
  // D1 (v1.7): wanderSeed must be a whole number if present (the Wander
  // last-seed latch). A non-integer/garbled value is refused (the migration
  // would otherwise normalize it silently — refuse loudly on a bad paste).
  if (raw.wanderSeed !== undefined && raw.wanderSeed !== null) {
    const w = raw.wanderSeed;
    if (typeof w !== 'number' || !Number.isInteger(w) || w < 0) {
      return { ok: false, error: 'the wanderSeed field was malformed (expected a whole number)' };
    }
  }
  // (e) run the EXISTING migration chain; refuse on any throw or a 'fresh' result.
  let save;
  try {
    save = migrateSave(raw);
  } catch (e) {
    return { ok: false, error: 'that save could not be normalized' };
  }
  if (save && save._case === 'fresh') {
    return { ok: false, error: 'that save did not look right — nothing was changed' };
  }
  save.saveVersion = SAVE_VERSION;
  return { ok: true, save };
}

// P9: options split into separate music (ambient bed) / SFX volumes and add
// screen-shake + low-HP vignette accessibility toggles. The legacy `volume`
// field (a single master) is still honored by migrateOptions so pre-P9 saves
// keep working; new fields default sensibly.
// C3 (v1.3 M16): `grain` (default OFF) — a subtle PROCEDURAL paper-grain overlay
// (see game.js _buildGrain/_drawGrain). Presentation-only; an old options blob
// (no `grain` field) migrates forward to OFF so returning players see no change.
export function freshOptions() {
  return { volume: 0.8, muted: false, difficulty: 'normal', musicVol: 0.6, sfxVol: 0.7, shake: true, vignette: true, grain: false, gamepad: 'auto', wander: false };
}
export function migrateOptions(raw) {
  const o = freshOptions();
  if (raw && typeof raw === 'object') {
    const volume = (value, fallback) => value !== null && value !== undefined && Number.isFinite(Number(value)) ? Math.min(1, Math.max(0, Number(value))) : fallback;
    const v = volume(raw.volume, o.volume);
    o.volume = v;
    o.muted = !!raw.muted;
    o.difficulty = (DIFFICULTIES[raw.difficulty] ? raw.difficulty : 'normal');
    // P9: new split volumes. If a field is present, honor it; otherwise seed
    // from the legacy master `volume` so a pre-P9 save keeps its old level.
    o.musicVol = volume(raw.musicVol, v);
    o.sfxVol = volume(raw.sfxVol, v);
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
    // D1 (v1.7): THE WANDER toggle (default OFF). Only an explicit true turns it
    // on; a legacy options blob (field absent) migrates forward to OFF so
    // returning players keep the hand-tuned path byte-identical and the
    // generated-layout path never runs.
    o.wander = raw.wander === true;
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


// The salt that puts the Wander content stream on its OWN RNG lane, separate
// from the terrain pass (World is seeded off runSeed). A non-zero constant so
// seed + WANDER_SALT is never the degenerate all-zeros stream.
export const WANDER_SALT = 7331;

// The hand-tuned pacing envelope. Calibrated against the hand-tuned ZONES
// baseline: per-zone normal 4/6/5/8 (total 23), per-zone elite 1/2/1/2
// (total 6). The bounds allow a little per-zone swing but keep the RUN-WIDE
// total in-band (so a generated run is the same ~15-20 min shape, never
// faster). 4 zones = the unchanged hand-tuned structure.
export const WANDER_BUDGET = {
  zones: 4,
  normal: { perMin: 3, perMax: 9, totalMin: 18, totalMax: 30 }, // hand-tuned 4-8 / 23
  elite:  { perMin: 1, perMax: 2, totalMin: 4, totalMax: 7 },   // hand-tuned 1-2 / 6
  restOrbsPer: 2,                 // the guaranteed rest-checkpoint orbs (hand-tuned 2/zone)
};

// The three Expedition enemy archetypes (Reeds archetypes are a separate
// biome and never enter a Wander Expedition layout).
const WANDER_KINDS = ['beetle', 'mosquito', 'toad'];

// D1: a fresh Wander seed. PURE given (prevSeed, nowMs) — game.js feeds
// nowMs = Date.now() (the impure layer), so every Wander run gets a fresh
// seed and a repeat is impossible without deliberately re-entering the same
// (prevSeed, nowMs) pair. The result is always >= 1 (never the degenerate 0)
// and always differs from prevSeed (repeat-avoidance seed for D2).
export function pickWanderSeed(prevSeed, nowMs) {
  const prev = Math.floor(Number(prevSeed) || 0);
  const t = Math.floor(Number(nowMs) || 0);
  // mix both sources with the gold hash constant; fold to a 31-bit positive
  // integer. No Math.random — the ONLY entropy is the nowMs argument.
  let h = (Math.imul(t, 2654435761) + Math.imul(prev + 1, 40503)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h >>>= 0;
  let seed = (h % 2147483647) + 1;                    // in [1, 2147483647]
  if (seed === prev) seed = (seed % 2147483647) + 1;  // never equal the last seed
  return seed;
}

// --------------------------------------------------------------------------
// D2 (v1.7): THE WANDER "taste" — a small hand-tuned set of flavor archetypes
// that bias the generated run (mosquito-heavy / beetle-heavy / toad-heavy /
// orb-rich) so SUCCESSIVE generated runs FEEL different while each still lands
// in the 15-20 min band (the bias only re-weights which kinds fill the slots;
// it never changes the per-zone / total COUNTS, so the envelope always holds —
// wanderInBudget is green for a biased run exactly as for the neutral one).
//
// PURE: wanderTaste(seed) samples a taste from the set via mulberry32 on its OWN
// salted lane (seed + TASTE_SALT), separate from the content stream (seed +
// WANDER_SALT) and the terrain pass. Deterministic per seed — the same seed
// always yields the same {id, name, tag, bias}.
export const WANDER_TASTE_SALT = 4271;
// Each taste: id (stable), name (the in-run flavor line the player sees), tag
// (a short descriptor for the test), and bias.kindWeights (the per-archetype
// weights wanderContent folds into each zone's mix; >= 1 so a favored kind is
// boosted, not zeroed — a run is always a mix of all three).
export const WANDER_TASTES = [
  {
    id: 'quiet-reeds', name: 'The Quiet Reeds', tag: 'calm',
    bias: { kindWeights: { beetle: 2, mosquito: 1, toad: 1 } },
    note: 'the water is still and the beetles are bolder',
  },
  {
    id: 'feast-season', name: 'Feast Season', tag: 'swarm',
    bias: { kindWeights: { beetle: 1, mosquito: 2, toad: 1 } },
    note: 'a swarm of mosquitos rides the warm current',
  },
  {
    id: 'long-dark', name: 'The Long Dark', tag: 'grump',
    bias: { kindWeights: { beetle: 1, mosquito: 1, toad: 2 } },
    note: 'grumpy toads sit heavy in the murk',
  },
  {
    id: 'ink-bloom', name: 'Ink Bloom', tag: 'mixed',
    bias: { kindWeights: { beetle: 1, mosquito: 2, toad: 2 } },
    note: 'everything the swamp kept, at once',
  },
];
// PURE: pick the taste for a Wander seed. Deterministic on the seed's own
// salted lane (distinct from the content stream). Returns a reference to one
// of WANDER_TASTES (never a mutated copy — callers read, not write). Non-finite
// seeds normalize to 0 (the quiet-reeds default) so a corrupt seed never
// throws.
export function wanderTaste(seed) {
  const s = Math.floor(Number(seed) || 0);
  const r = mulberry32((s + WANDER_TASTE_SALT) >>> 0);
  return WANDER_TASTES[Math.floor(r() * WANDER_TASTES.length) % WANDER_TASTES.length];
}

// Internal: distribute a total `T` across `n` buckets, each in [min, max],
// using `rng`. Feasibility is guaranteed by the caller (T in
// [n*min, n*max]). Greedy: seed each bucket at `min`, then hand out the
// remainder one unit at a time to a random bucket still under `max`. O(T) —
// tiny (T <= 30). Returns an array of `n` integers.
function _distribute(rng, T, n, min, max) {
  const out = new Array(n).fill(min);
  let remaining = T - n * min;
  while (remaining > 0) {
    // pick a random bucket still under its cap (rejection-free: the count of
    // eligible buckets is >= 1 while remaining > 0 by the feasibility bound)
    const eligible = out.map((v, i) => (v < max ? i : -1)).filter(i => i >= 0);
    const pick = eligible[Math.floor(rng() * eligible.length)];
    out[pick] += 1;
    remaining -= 1;
  }
  return out;
}

// D1: THE WANDER layout. PURE + deterministic per `seed`.
//
//   wanderContent(seed, zones, bias = null) -> layout
//
// `zones` is the hand-tuned ZONES array (for the per-zone x-anchor / name /
// accent / tip — the terrain is UNCHANGED, so Wander reuses those and only
// regenerates the ENCOUNTER CONTENT). `bias` is a D2 taste object
// ({id,name,bias}); D1 ignores it (a null / missing bias is the neutral
// "base wander"), so the D1 layout is fully determined by (seed, zones).
//
// Returns a FRESH object (never mutates `zones`):
//   { seed, zones: [{x,name,accent,tip,mix:{beetle,mosquito,toad},
//                    sig:{kind,count}} x zones.length],
//     totals: { normal, elite, orbs }, bossEligible, restOrbsPer }
//
// Every field honors WANDER_BUDGET: per-zone + run-wide normal/elite within
// the band, >= restOrbsPer guaranteed per rest checkpoint, no empty zone
// (perMin >= 1), bossEligible always true. Same seed => identical layout.
export function wanderContent(seed, zones, bias = null) {
  const base = Array.isArray(zones) && zones.length ? zones : null;
  const n = WANDER_BUDGET.zones;
  // D2 (v1.7): the taste BIAS (see wanderTaste) only re-weights WHICH KINDS
  // fill each zone's already-bounded enemy slots (mosquito-heavy / beetle-heavy
  // / toad-heavy / orb-rich). It NEVER touches the per-zone or total COUNTS, so
  // a biased run is always in-band exactly as the neutral one is (wanderInBudget
  // holds for both). A null bias (or an unknown kind) is the D1 neutral mix.
  const kw = { beetle: 1, mosquito: 1, toad: 1 };
  if (bias && bias.kindWeights) {
    for (const k of WANDER_KINDS) if (bias.kindWeights[k] > 0) kw[k] = bias.kindWeights[k];
  }
  if (!base) {
    // degenerate: no zones supplied — return a structurally valid empty-ish
    // layout (should not happen; game.js always passes ZONES).
    return {
      seed: Math.floor(Number(seed) || 0),
      zones: [], totals: { normal: 0, elite: 0, orbs: 0 },
      bossEligible: true, restOrbsPer: WANDER_BUDGET.restOrbsPer,
    };
  }
  const s = Math.floor(Number(seed) || 0);
  // THE Wander content stream — its OWN lane (seed + WANDER_SALT), separate
  // from the terrain pass. Deterministic per seed.
  const rng = mulberry32((s + WANDER_SALT) >>> 0);

  // ---- (1) distribute the run-wide NORMAL enemy total across the zones ----
  // A total in [totalMin, totalMax] (hand-tuned 23 sits mid-band). Because
  // n*perMin (12) <= totalMin (18) and totalMax (30) <= n*perMax (36), any
  // such total is distributable with each zone in [perMin, perMax].
  const Nmin = WANDER_BUDGET.normal.totalMin, Nmax = WANDER_BUDGET.normal.totalMax;
  const totalNormal = Nmin + Math.floor(rng() * (Nmax - Nmin + 1));
  const perNormal = _distribute(rng, totalNormal, n, WANDER_BUDGET.normal.perMin, WANDER_BUDGET.normal.perMax);

  // ---- (2) distribute the run-wide ELITE total across the zones ----
  const Emin = WANDER_BUDGET.elite.totalMin, Emax = WANDER_BUDGET.elite.totalMax;
  const totalElite = Emin + Math.floor(rng() * (Emax - Emin + 1));
  const perElite = _distribute(rng, totalElite, n, WANDER_BUDGET.elite.perMin, WANDER_BUDGET.elite.perMax);

  // ---- (3) build each zone: keep the terrain identity, regenerate content ----
  const outZones = [];
  for (let i = 0; i < n; i++) {
    const src = base[i] || {};
    // split this zone's normal count across the 3 archetypes. Weighted so a
    // zone leans one archetype but never all-in on it (keeps the mix lively);
    // the split always sums to perNormal[i] and each zone has >= perMin >= 1
    // (no empty zone). D2 (v1.7): the taste bias scales each kind's weight so a
    // mosquito-heavy / beetle-heavy / toad-heavy run shifts the MIX within the
    // SAME per-zone count (the envelope is unchanged — only which kinds fill the
    // slots changes).
    const zn = perNormal[i];
    const w = [
      (1 + Math.floor(rng() * 4)) * kw.beetle,
      (1 + Math.floor(rng() * 4)) * kw.mosquito,
      (1 + Math.floor(rng() * 4)) * kw.toad,
    ];
    const wSum = w[0] + w[1] + w[2];
    const mix = { beetle: 0, mosquito: 0, toad: 0 };
    // apportion zn by the weights, remainder round-robin (keeps the sum exact)
    const keys = WANDER_KINDS;
    let rem = zn;
    for (let k = 0; k < keys.length; k++) {
      const share = Math.floor((zn * w[k]) / wSum);
      mix[keys[k]] = share; rem -= share;
    }
    for (let k = 0; rem > 0; k = (k + 1) % keys.length) { mix[keys[k]] += 1; rem -= 1; }
    // guarantee the zone is non-empty even in the (impossible) all-zero split
    if (mix.beetle + mix.mosquito + mix.toad < 1) mix.beetle = 1;

    // the elite signature: a kind + count within the per-zone elite band.
    const sigKind = WANDER_KINDS[Math.floor(rng() * WANDER_KINDS.length)];
    const sig = { kind: sigKind, count: perElite[i] };

    outZones.push({
      x: src.x, name: src.name, accent: src.accent, tip: src.tip,
      mix, sig,
    });
  }

  const totalOrbs = n * WANDER_BUDGET.restOrbsPer;
  return {
    seed: s,
    zones: outZones,
    totals: { normal: totalNormal, elite: totalElite, orbs: totalOrbs },
    bossEligible: true,
    restOrbsPer: WANDER_BUDGET.restOrbsPer,
  };
}

// D1: is a Wander layout within its pacing envelope? PURE. Returns { ok,
// reasons[] }. The smoke stage asserts ok === true across a seed sweep. This
// is the testable guarantee that the procgen cannot run away from the 15-20
// min band (it neither over- nor under-populates a run).
export function wanderInBudget(layout) {
  const reasons = [];
  if (!layout || !Array.isArray(layout.zones)) { reasons.push('no zones'); return { ok: false, reasons }; }
  const B = WANDER_BUDGET;
  const n = layout.zones.length;
  if (n !== B.zones) reasons.push(`zone count ${n} != ${B.zones}`);
  let normal = 0, elite = 0, empty = 0;
  layout.zones.forEach((z, i) => {
    const zn = (z.mix && (z.mix.beetle + z.mix.mosquito + z.mix.toad)) || 0;
    const ze = (z.sig && z.sig.count) || 0;
    if (zn < B.normal.perMin || zn > B.normal.perMax) reasons.push(`zone ${i} normal ${zn} out of [${B.normal.perMin},${B.normal.perMax}]`);
    if (ze < B.elite.perMin || ze > B.elite.perMax) reasons.push(`zone ${i} elite ${ze} out of [${B.elite.perMin},${B.elite.perMax}]`);
    if (zn < 1) empty++;
    if (!z.sig || !WANDER_KINDS.includes(z.sig.kind)) reasons.push(`zone ${i} bad sig kind`);
    normal += zn; elite += ze;
  });
  if (normal < B.normal.totalMin || normal > B.normal.totalMax) reasons.push(`run normal ${normal} out of [${B.normal.totalMin},${B.normal.totalMax}]`);
  if (elite < B.elite.totalMin || elite > B.elite.totalMax) reasons.push(`run elite ${elite} out of [${B.elite.totalMin},${B.elite.totalMax}]`);
  if (empty > 0) reasons.push(`${empty} empty zone(s)`);
  if (!layout.bossEligible) reasons.push('not boss-eligible');
  return { ok: reasons.length === 0, reasons };
}

// An optional early clearing: three bite-sized rounds, never a timed lock.
// Only authored actors opt into the lunge and blue-to-red bonus.
export const CLEARING = Object.freeze({
  x: 1050, y: 730, r: 25, range: 300, leaveRange: 580,
  windup: 0.8, dash: 0.28, recover: 1.15, dashSpeed: 290, triggerRange: 145,
  cap: 2, beetleHp: 120, mosquitoHp: 90,
  rounds: Object.freeze([
    Object.freeze(['beetle', 'beetle', 'mosquito']),
    Object.freeze(['mosquito', 'beetle', 'mosquito', 'beetle']),
    Object.freeze(['beetle', 'mosquito', 'beetle', 'mosquito', 'beetle']),
  ]),
});
export function clearingAllowed(g) {
  return g?.runBiome === 'swamp' && !g.options?.wander && !g.challenge && (!g.campaign || g.campaign.floor === 0);
}
export function clearingCombo(pigment, enemy) {
  return pigment === 'red' && enemy?._clearing && ['slow', 'freeze'].includes(enemy.status?.type) ? 1.5 : 1;
}
export function clearingStep(e, dt, player) {
  dt = Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0));
  e.clearingPhase ||= 'approach';
  if (!player?.alive || e.dead || e.hp <= 0) {
    e.clearingPhase = 'approach'; e.clearingT = 0; return;
  }
  if (['slow', 'freeze', 'root', 'dizzy'].includes(e.status?.type)) {
    e.clearingPhase = 'recover'; e.clearingT = CLEARING.recover; return;
  }
  e.clearingT = Math.max(0, (e.clearingT || 0) - dt);
  const distance = Math.hypot(e.x - player.x, e.y - player.y);
  if (e.clearingPhase === 'approach' && distance <= CLEARING.triggerRange) {
    e.clearingPhase = 'tell'; e.clearingT = CLEARING.windup;
    e.clearingDX = distance > 0 ? (player.x - e.x) / distance : 1;
    e.clearingDY = distance > 0 ? (player.y - e.y) / distance : 0;
  } else if (e.clearingT <= 0) {
    if (e.clearingPhase === 'tell') { e.clearingPhase = 'dash'; e.clearingT = CLEARING.dash; }
    else if (e.clearingPhase === 'dash') { e.clearingPhase = 'recover'; e.clearingT = CLEARING.recover; }
    else if (e.clearingPhase === 'recover') e.clearingPhase = 'approach';
  }
}
