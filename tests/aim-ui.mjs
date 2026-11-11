import assert from 'node:assert/strict';
import { drawCombatReadout } from '../src/combat-ui.js';
import { makeTuning } from '../src/logic.js';

const g = {
  player: { alive: true, x: 80, y: 90, aimA: Math.PI / 2, pigment: 'blue', splashCharge: 0, hopCd: 0 },
  tuning: makeTuning(), input: { mouse: { rDown: false } }, paint: { splashCd: 0 },
};
const calls = [];
const ctx = new Proxy({}, {
  get: (_, name) => (...args) => {
    assert(args.every(v => typeof v !== 'number' || Number.isFinite(v)), `${name} receives finite geometry`);
    calls.push([name, ...args]);
  },
  set: () => true,
});
const view = { x: 5, y: 7, scale: 0.6 };
const before = JSON.stringify(g);
drawCombatReadout(g, ctx, view);
assert(calls.some(([name, x, y]) => name === 'translate' && Math.abs(x - 80) < 1e-8 && y === 90 + g.tuning.swipeRange), 'brush tip follows exact reach through world transform');
assert(calls.some(([name]) => name === 'ellipse'), 'ordinary aim is a paintbrush tip');
assert(!calls.some(([name]) => name === 'arc'), 'ordinary aim has no crosshair, targeting circles or permanent readiness ring');
assert.equal(JSON.stringify(g), before, 'aim rendering never changes state');

g.player.splashCharge = 0.4; g.input.mouse.rDown = true; calls.length = 0;
drawCombatReadout(g, ctx, view);
assert(calls.some(([name, text]) => name === 'fillText' && text === 'Hold to fill'));
assert(calls.some(([name, x, y, r]) => name === 'arc' && x === 80 && y === 90 && r === g.tuning.splashRadius), 'charge preview uses actual splash radius');
g.player.splashCharge = 1; calls.length = 0;
drawCombatReadout(g, ctx, view);
assert(calls.some(([name, text]) => name === 'fillText' && text === 'Release to splash!'));
g.paint.splashCd = 0.2; calls.length = 0;
drawCombatReadout(g, ctx, view);
assert(calls.some(([name, text]) => name === 'fillText' && text === 'Splash recharging'), 'cooldown never promises an available splash');
for (const overlay of ['paused', 'help', '_bookOpen', '_atlasOpen', '_cine', 'dying']) {
  g[overlay] = true; calls.length = 0; drawCombatReadout(g, ctx, view); g[overlay] = false;
  assert.equal(calls.length, 0, `${overlay} hides the in-world brush`);
}
console.log('Brush UI: one reachable brush tip, clear charge states and pure rendering PASS');
