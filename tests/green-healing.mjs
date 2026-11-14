import assert from 'node:assert/strict';
import { Player } from '../src/player.js';
import { Paint } from '../src/paint.js';
import { makeTuning, paintDamage, applyCampaignRewards } from '../src/logic.js';

const tuning = makeTuning();
let ground = 0;
const world = { collideCircle: (x, y) => [x, y], pigmentAt: () => ({ green: ground }),
  paintSwipe() {}, paintSplash() {} };
const input = { moveVec: () => [0, 0], mouse: { worldX: 100, worldY: 0 }, pressed: () => false };
const player = new Player(0, 0, tuning), sounds = [];
const paint = new Paint(player, world, tuning, key => sounds.push(key), { splatter() {} });
const tick = seconds => {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    player.update(1 / 60, input, tuning, world, {});
    paint.update(1 / 60);
  }
};
const target = (extra = {}) => ({ kind: 'beetle', x: 30, y: 0, r: 15, hp: 100, maxHp: 100, ...extra });
const swipe = targets => { tick(0.25); return paint.trySwipe(targets); };

// Reproduce the old failure: spending time off moss created negative credit,
// then the 0.5 hit credit decayed between strokes without ever restoring HP.
tick(60);
assert.equal(player._healAcc, 0, 'walking at full health cannot build healing debt');
player.hp = 3;
tick(30);
player.pigment = 'green';
const enemy = target();
swipe([enemy]);
assert.equal(player.hp, 4, 'the first landed green stroke immediately restores one HP');
assert.equal(enemy.hp, 96, 'base green swipe does only four damage (red does eleven)');
assert(paintDamage(7, 'green', tuning) < paintDamage(7, 'blue', tuning));
assert(paintDamage(7, 'green', tuning) < paintDamage(7, 'red', tuning));
tick(2);
assert.equal(player.hp, 4, 'leaving moss cannot remove hit healing');
swipe([enemy]);
assert.equal(player.hp, 5, 'spaced hits keep healing without a hidden accumulator');
assert.equal(sounds.filter(key => key === 'heal').length, 2);

swipe([]);
swipe([target({ x: 1000 })]);
swipe([target({ dead: true })]);
swipe([target({ burrower: true, phase: 'burrowed' })]);
assert.equal(player.hp, 5, 'misses, corpses and untargetable enemies do not heal');
for (const pigment of ['red', 'blue', 'dry']) {
  player.pigment = pigment; swipe([target()]);
}
assert.equal(player.hp, 5, 'other pigments do not grant hit healing');

player.pigment = 'green';
const crowd = [target(), target(), target()];
player.splashCharge = 1;
paint.trySplash(crowd);
assert.equal(player.hp, 6, 'a charged splash heals once regardless of target count');
assert(crowd.every(e => e.hp === 64), 'green splash damage is 36 per unarmored target (red does 96)');

const boss = () => target({ hue: { red: 0, blue: 0, green: 0 }, awakened: false });
swipe([]);
const guardian = boss();
paint.paintBossHit(guardian, 'green', tuning.bossPaintHit);
assert.equal(player.hp, 7, 'a landed guardian stroke also heals');
paint.paintBossHit(guardian, 'green', tuning.bossPaintHit);
assert.equal(player.hp, 7, 'boss checks between actual strokes cannot heal per frame');
swipe([target()]);
paint.paintBossHit(guardian, 'green', tuning.bossPaintHit);
assert.equal(player.hp, 8, 'one stroke hitting a minion and boss still heals only once');
swipe([]);
paint.paintBossHit({ ...boss(), x: 1000 }, 'green', tuning.bossPaintHit);
assert.equal(player.hp, 8, 'out-of-range bosses do not heal');

applyCampaignRewards(tuning, { rewards: ['mend'] });
swipe([target()]);
assert.equal(player.hp, 9.35, 'Kind moss preserves its 35 percent hit-heal bonus');
swipe([target()]);
assert.equal(player.hp, player.maxHp, 'healing is capped at maximum health');
const chimes = sounds.filter(key => key === 'heal').length;
swipe([target()]);
assert.equal(sounds.filter(key => key === 'heal').length, chimes, 'no false heal sound at full health');

// Ground healing stays separate, starts promptly, and carries its remainder.
player.hp = 3; player._healAcc = -100; ground = 1;
tick(0.5);
assert.equal(player.hp, 5, 'standing on moss recovers even from legacy negative credit');
assert(player._healAcc >= 0 && player._healAcc < 1);
player.hp = 0; player.alive = false;
swipe([target()]); tick(1);
assert.equal(player.hp, 0, 'neither ground nor hit healing resurrects a defeated frog');
console.log('GREEN HEALING PASSED: immediate hit healing, light damage, once per action, bosses, caps, gifts and ground recovery.');
