// Integrated with smoke.mjs so these checks use its seeded real-Game harness.
import { Player } from '../src/player.js';
import { Input } from '../src/input.js';
import { freshSave, makeTuning, MOSQUITO_FLIGHT } from '../src/logic.js';
import { spawnEnemy } from '../src/enemies.js';

export function testSlice({ Game, makeCanvas, assert }) {
  console.log('== Astra: escape controls, fly fairness, teaching and victory ==');
  const canvas = makeCanvas();
  canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 640, height: 400 });
  const input = new Input(canvas);
  input._mm({ clientX: 330, clientY: 220 });
  assert(input.mouse.x === 640 && input.mouse.y === 400, 'CSS-scaled canvas maps pointer to logical pixels');
  input._md({ clientX: 330, clientY: 220, button: 2 });
  input._mu({ button: 2 });
  assert(input.mouse.rReleased && !input.mouse.rDown, 'physical RMB release produces one fire edge');
  input.reset();
  assert(!input.mouse.rReleased && !input.mouse._physR && input.kb.size === 0, 'blur clears every held input and edge');

  const tuning = makeTuning();
  const world = { collideCircle: (x, y) => [x, y], pigmentAt: () => ({ green: 0 }) };
  const p = new Player(100, 100, tuning);
  input.mouse.worldX = 300; input.mouse.worldY = 100; input.kb.add(' ');
  p.update(1 / 60, input, tuning, world); input.endFrame();
  for (let i = 0; i < 10; i++) p.update(1 / 60, input, tuning, world);
  assert(p.x > 150 && Math.abs(p.y - 100) < 0.01, 'stationary Space hops toward aim with useful escape distance');
  p.hopT = 0; p.hopCd = 0.04; input.kb.add(' ');
  p.update(0.02, input, tuning, world); input.endFrame();
  p.update(0.02, input, tuning, world); p.update(0.02, input, tuning, world);
  assert(p.hopT > 0, 'hop pressed just before cooldown ends is buffered');

  const fly = spawnEnemy('mosquito', p.x + 70, p.y, tuning);
  const hp = p.hp; p.iframes = 0;
  fly.update(0.016, p, tuning, world, 1);
  assert(fly.flight === 'tell' && fly.flightT === MOSQUITO_FLIGHT.tell && p.hp === hp, 'fly warns before a committed strike');
  const dx = fly.dartX; p.y += 150;
  for (let i = 0; i < 40; i++) fly.update(0.016, p, tuning, world, 1 + i * 0.016);
  assert(fly.flight === 'dart' && fly.dartX === dx, 'fly strike locks direction, letting the frog dodge');
  fly.status = { type: 'slow', t: 1, max: 1 };
  fly.update(0.016, p, tuning, world, 2);
  assert(fly.flight === 'recover', 'blue paint cancels a fly strike');
  assert(Math.hypot(fly.vx, fly.vy) <= fly.speed * MOSQUITO_FLIGHT.speed, 'fly speed is bounded');

  const g = new Game(makeCanvas()); g.save = freshSave(); g._beginExpedition(true);
  g.tutorial.target.dead = true; g.tutorial.target.hp = 0; g.tutorial.target.status = null;
  const old = g.tutorial.target; g._tutorialTick();
  assert(g.tutorial.target !== old && !g.tutorial.target.dead, 'wrong-color practice kill respawns the lesson instead of softlocking');
  g._skipTutorial(); g.input.kb.add('p'); g._updateExpedition(0.016);
  assert(g.paused, 'pause works after completing or skipping the tutorial');
  g.input.reset(); g.paused = false; g.heron._intro = 0; g.tutorial = null;
  g._startRetrain(0); const practice = g.tutorial.target; g._endRetrain();
  assert(g.heron._intro === 0 && !g.enemies.includes(practice), 'retraining restores an active boss and removes its practice target');
  g._endRun('victory'); g._cine = { t: 1.8, dur: 4, firstBeat: true };
  g.world.worldColorSat = () => 0.25;
  g._drawAll();
  assert(true, 'first victory cinematic renders its saturation reveal without const assignment crash');
}
