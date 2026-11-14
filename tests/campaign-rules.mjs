import assert from 'node:assert/strict';
import { Player } from '../src/player.js';
import { Paint } from '../src/paint.js';
import { Enemy } from '../src/enemies.js';
import { makeTuning, ENEMIES } from '../src/logic.js';

// Removed systems must not survive as hidden tuning hooks when an old caller
// still supplies their fields. Exercise actual heal and damage paths directly.
const tuning = makeTuning();
const world = { collideCircle: (x, y) => [x, y], pigmentAt: () => ({ green: 1 }) };
const input = { moveVec: () => [0, 0], mouse: { worldX: 100, worldY: 0 }, pressed: () => false };
const player = new Player(0, 0, tuning);
player.hp = 5; player._plumeSuppress = true;
for (let i = 0; i < 24; i++) player.update(1 / 60, input, tuning, world, {});
assert.equal(player.hp, 6, 'legacy plume field cannot suppress ordinary green ground healing');

const particles = { splatter() {} };
const paint = new Paint(player, world, tuning, () => {}, particles);
player._healAcc = 0;
const enemy = new Enemy('beetle', 30, 0, tuning);
paint._applyHits([enemy], 'green', 'swipe');
assert.equal(player.hp, 6 + tuning.greenHealOnPaint, 'green direct paint heals immediately despite an obsolete plume field');

const boss = pinned => ({ hp: 1000, maxHp: 1000, pinned, awakened: false,
  hue: { red: 0, blue: 0, green: 0 }, awakenedT: 0 });
const plain = boss(0), legacy = boss(9);
paint._bossPaint(plain, 'red', 1); paint._bossPaint(legacy, 'red', 1);
assert.equal(plain.hp, legacy.hp, 'legacy green-heron pin field cannot amplify boss damage');
const legacyTuning = { ...tuning, enemySpeedMult: 3, mosquitoSpeedMult: 3, enemyDmg: 3, contactDmgMult: 3 };
for (const kind of ['beetle', 'mosquito']) {
  const actor = new Enemy(kind, 0, 0, legacyTuning);
  assert.equal(actor.speed, ENEMIES[kind].speed, 'removed modifier speed cannot affect the dungeon');
  assert.equal(actor.dmg, ENEMIES[kind].dmg, 'removed cycle damage cannot affect the dungeon');
}
console.log('Campaign rules: removed plume, pin and cycle modifiers are inert; ordinary healing remains intact PASS');
