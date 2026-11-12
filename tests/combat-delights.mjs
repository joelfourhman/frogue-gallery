import assert from 'node:assert/strict';
import { drawCombatReadout } from '../src/combat-ui.js';
import { OpeningEncounter } from '../src/encounter.js';
import { Enemy } from '../src/enemies.js';
import { Paint } from '../src/paint.js';
import { CLEARING, makeTuning, mosquitoStep, wardenStep, WARDEN } from '../src/logic.js';

export function testCombatDelights() {
  const tuning = makeTuning(), world = { collideCircle: (x, y) => [x, y] };
  const player = { alive: true, x: 100, y: 120, hp: 5, maxHp: 10, r: 15, hopT: 0,
    aimA: 0, pigment: 'blue', splashCharge: 0, hopCd: 0, _healAcc: 0 };
  const enemy = new Enemy('mosquito', 145, 120, tuning);
  mosquitoStep(enemy, 0.01, player);
  assert.equal(enemy.flight, 'tell');
  const paint = new Paint(player, world, tuning, () => {}, { splatter() {} });
  paint._applyHits([enemy], 'blue', 'swipe');
  mosquitoStep(enemy, 0.01, player);
  assert.equal(enemy.flight, 'recover');
  enemy.status = null;

  const warden = { kind: 'warden', hp: 100, maxHp: 100, phase: 'telegraph', phaseT: 0.01, _intro: 0 };
  wardenStep(warden, 0.02, {}, tuning, 0);
  assert.equal(warden.phase, 'mawOpen');
  wardenStep(warden, WARDEN.mawOpen + 1, {}, tuning, 0);
  assert.equal(warden.phase, 'mawClosed');

  const calls = [], ctx = new Proxy({}, { get: (_, name) => (...args) => {
    assert(args.every(v => typeof v !== 'number' || Number.isFinite(v)), `${name} geometry is finite`);
    calls.push([name, ...args]);
  }, set: () => true });
  const g = { player, tuning, enemies: [enemy], paint, input: { mouse: { rDown: false } } };
  const snapshot = JSON.stringify(g);
  drawCombatReadout(g, ctx, { x: 0, y: 0, w: 800, h: 600, scale: 1 });
  assert(!calls.some(([name]) => name === 'fillText'), 'recovery has no coaching caption');
  for (const phase of ['tell', 'recover']) {
    enemy.flight = phase; g.heron = { ...warden, phase: 'mawOpen' };
    calls.length = 0; drawCombatReadout(g, ctx, { x: 0, y: 0, w: 800, h: 600, scale: 1 });
    assert(!calls.some(([name]) => name === 'fillText'), 'attacks and bosses use visual tells, not instruction popups');
  }
  delete g.heron; enemy.flight = 'recover';
  assert.equal(JSON.stringify(g), snapshot, 'combat feedback does not change damage, actors, aim or timers');
  calls.length = 0; g.paused = true;
  drawCombatReadout(g, ctx, { x: 0, y: 0, w: 800, h: 600, scale: 1 });
  assert.equal(calls.length, 0, 'paused scenes have no live threat captions');

  Object.assign(player, { x: CLEARING.x, y: CLEARING.y });
  let blooms = 0;
  Object.assign(g, { runBiome: 'swamp', options: {}, world, dying: false, paused: false, enemies: [],
    _tutorialActive: () => false, sfx() {}, _triggerBloom() { blooms++; } });
  const encounter = new OpeningEncounter(g);
  const bell = { x: CLEARING.x - 50, y: CLEARING.y, a: 0, range: 74, kind: 'swipe', pigment: 'red' };
  assert(encounter.onStroke(bell));
  g.cw = 1280; g.ch = 800; calls.length = 0; encounter.drawHint(ctx);
  assert.equal(calls.filter(([name]) => name === 'fillText').length, 1, 'active clearing shows only compact round progress');
  // Three real authored rounds, with direct stroke observations and hop edges.
  for (let guard = 0; guard < 40 && encounter.phase !== 'complete'; guard++) {
    for (const member of encounter.members) if (!member.dead) {
      encounter.onStroke({ ...bell, x: member.x - 20, y: member.y, pigment: guard % 2 ? 'blue' : 'red' });
      member.dead = true; member.hp = 0;
    }
    player.hopT = guard % 2 ? 0.2 : 0;
    encounter.update(1);
    if (encounter.phase === 'between') { encounter.update(1); assert(encounter.onStroke(bell)); }
  }
  assert.equal(encounter.phase, 'complete');
  assert.equal(encounter.result.rounds, 3);
  assert(encounter.result.seconds > 0 && encounter.result.dodges > 0 && encounter.result.colors === 2);
  assert.equal(blooms, 1); assert.equal(player.hp, player.maxHp, 'first completion still heals');
  const complete = encounter.result;
  encounter.update(10); assert.equal(encounter.result, complete, 'result does not accumulate time while admiring it');
  calls.length = 0; g.cw = 1280; g.ch = 800;
  encounter.drawHint(ctx);
  assert(calls.some(([name, text]) => name === 'fillText' && /battle time/.test(text)));
  assert(encounter.onStroke(bell)); assert.equal(encounter.result, null); assert.equal(encounter.dodges, 0);
  assert.equal(encounter.colorsUsed.size, 0, 'replaying resets only the new attempt stats');
  encounter.cancel(); assert.equal(blooms, 1, 'cancelling/replaying never adds a completion reward');
  console.log('Quiet combat: no attack/recovery/boss coaching, real blue interrupt, compact progress and clearing results PASS');
}

testCombatDelights();
