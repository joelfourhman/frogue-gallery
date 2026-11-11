import assert from 'node:assert/strict';
import { CLEARING, clearingAllowed, clearingStep, clearingCombo, makeTuning, paintDamage } from '../src/logic.js';
import { OpeningEncounter } from '../src/encounter.js';
import { Enemy, drawAttackWarning } from '../src/enemies.js';
import { Paint } from '../src/paint.js';

export function testOpeningEncounter() {
  const tuning = makeTuning();
  const world = { collideCircle: (x, y) => [x, y] };
  const player = { x: CLEARING.x, y: CLEARING.y, r: 12, hp: 10, maxHp: 20, alive: true, iframes: 0, hurt() { this.hp--; return true; } };
  let blooms = 0;
  const g = { runBiome: 'swamp', options: {}, challenge: null, ngCycle: 0, tuning, world, player, enemies: [], dying: false,
    input: { mouse: { lDown: false, rDown: false } }, _tutorialActive: () => false, sfx() {}, _triggerBloom() { blooms++; } };
  assert(clearingAllowed(g));
  for (const extra of [{ runBiome: 'reeds' }, { options: { wander: true } }, { challenge: {} }, { campaign: { floor: 1 } }]) assert(!clearingAllowed({ ...g, ...extra }));
  const e = new Enemy('beetle', 0, 0, tuning); e._clearing = true;
  const target = { ...player, x: 90, y: 0 };
  clearingStep(e, 1 / 60, target); assert.equal(e.clearingPhase, 'tell');
  const direction = [e.clearingDX, e.clearingDY]; target.y = 100;
  for (let i = 0; i < 10; i++) clearingStep(e, 1 / 60, target);
  assert.deepEqual([e.clearingDX, e.clearingDY], direction, 'warning locks the actual strike direction');
  assert.equal(e.clearingPhase, 'tell', 'windup grants a real reaction window');
  e.status = { type: 'slow', t: 1 };
  clearingStep(e, 0.1, target); assert.equal(e.clearingPhase, 'recover', 'blue stops the queued strike');
  assert.equal(clearingCombo('red', e), 1.5);
  assert.equal(clearingCombo('red', { ...e, _clearing: false }), 1, 'bonus stays local to authored fight');
  const ordinaryDamage = paintDamage(tuning.swipeDamage, 'red', tuning, { enemy: e });
  assert(paintDamage(tuning.swipeDamage, 'red', tuning, { enemy: e, statusBonus: clearingCombo('red', e) }) > ordinaryDamage);
  e.status = null; e.clearingPhase = 'tell'; e.clearingT = 0.3; e.x = 0; e.y = 0; target.x = 16; target.y = 0;
  const health = target.hp; e.update(1 / 60, target, tuning, world, 0);
  assert.equal(target.hp, health, 'touching a winding-up enemy is safe');
  e.clearingPhase = 'dash'; e.clearingT = 0.1; e.clearingDX = 1; e.clearingDY = 0;
  e.update(1 / 60, target, tuning, world, 1); assert(target.hp < health, 'dash itself can hit');
  target.hp = health; target.x = 20; target.y = 70; e.x = 0; e.attackCd = 0;
  e.update(1 / 60, target, tuning, world, 1.1); assert.equal(target.hp, health, 'sideways dodge escapes the committed lane');
  e.clearingPhase = 'recover'; e.clearingT = 0.8; target.x = e.x; target.y = e.y;
  e.update(1 / 60, target, tuning, world, 1.2); assert.equal(target.hp, health, 'recovery is a real punish window');

  const encounter = new OpeningEncounter(g);
  const stroke = { x: CLEARING.x - 50, y: CLEARING.y, a: 0, range: 74, kind: 'swipe', pigment: 'red' };
  assert(!encounter.onStroke({ ...stroke, x: 0 }), 'distant paint cannot start encounter');
  const blockingEnemy = new Enemy('beetle', CLEARING.x, CLEARING.y, tuning); g.enemies.push(blockingEnemy);
  assert(!encounter.onStroke(stroke), 'combat intent wins when the stroke touches a bug and bell');
  assert.equal(blockingEnemy.x, CLEARING.x, 'combat target is not relocated mid-stroke'); g.enemies = [];
  assert(encounter.onStroke(stroke)); assert.equal(g.enemies.length, 2); assert(encounter.active && encounter.suppressesWaves);
  assert(!encounter.onStroke(stroke), 'holding paint cannot skip a round');
  assert(g.enemies.every(e => e._clearing && e._noLoot));
  const outsider = new Enemy('beetle', 2400, 700, tuning); g.enemies.push(outsider);
  player.x = CLEARING.x + CLEARING.leaveRange + 1; encounter.update(0.1);
  assert.equal(encounter.phase, 'ready'); assert.deepEqual(g.enemies, [outsider], 'leaving removes only encounter actors');
  player.x = CLEARING.x; encounter.update(1); assert(encounter.onStroke(stroke));
  let killed = 0;
  for (let guard = 0; guard < 40 && encounter.phase !== 'complete'; guard++) {
    for (const member of encounter.members) if (!member.dead) { member.hp = 0; member.dead = true; killed++; }
    g.enemies = g.enemies.filter(e => !e.dead);
    encounter.update(1);
    assert(g.enemies.filter(e => e._clearing && !e.dead).length <= CLEARING.cap);
    if (encounter.phase === 'between') { assert(encounter.suppressesWaves); encounter.update(1); assert(encounter.onStroke(stroke)); }
  }
  assert.equal(killed, 12); assert.equal(encounter.phase, 'complete'); assert.equal(player.hp, player.maxHp); assert.equal(blooms, 1);
  encounter.update(1); assert(encounter.onStroke(stroke), 'completed clearing can be replayed');
  player.hp = 5; encounter.round = 2; encounter.queued = CLEARING.rounds[2].length;
  for (const member of encounter.members) { member.hp = 0; member.dead = true; }
  encounter.update(1); assert.equal(player.hp, 5, 'replays cannot farm full heals'); assert.equal(blooms, 1);
  const calls = [];
  const ctx = new Proxy({}, { get: (_, k) => (...args) => { calls.push(k); assert(args.every(v => typeof v !== 'number' || Number.isFinite(v))); }, set: () => true });
  drawAttackWarning(ctx, { ...e, clearingPhase: 'tell', clearingT: 0.4 }); assert(calls.includes('stroke'));
  const paint = new Paint(player, world, tuning, () => {}, { splatter() {} });
  const comboEnemy = new Enemy('beetle', 0, 0, tuning); comboEnemy._clearing = true; comboEnemy.hp = comboEnemy.maxHp = 1000;
  paint._applyHits([comboEnemy], 'blue', 'swipe');
  const before = comboEnemy.hp; paint._applyHits([comboEnemy], 'red', 'swipe');
  assert(before - comboEnemy.hp > ordinaryDamage, 'actual Paint path applies the switch bonus');
  console.log('Opening clearing: mode gates, committed dodge lane, blue interruption, combo, bounded rounds, cancel and replay PASS');
}

testOpeningEncounter();
