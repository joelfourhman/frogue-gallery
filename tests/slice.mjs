// Integrated with smoke.mjs so these checks use its seeded real-Game harness.
import { Player } from '../src/player.js';
import { Input } from '../src/input.js';
import { freshSave, makeTuning, MOSQUITO_FLIGHT, STUDIO, studyNode, paintStudy, normalizeSketchbook, migrateSave, migrateOptions, fileSketch } from '../src/logic.js';
import { FieldStudio, bookLayout, drawPostcard } from '../src/studio.js';
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
  g._startRetrain(6); g.sketchHeron.hp = -10; g._tutorialTick();
  assert(g.sketchHeron.hp === 1 && g._tutorialActive(), 'single-color painting cannot kill and softlock the sketch heron lesson');
  g._endRetrain();
  g._endRun('victory'); g._cine = { t: 1.8, dur: 4, firstBeat: true };
  g.world.worldColorSat = () => 0.25;
  g._drawAll();
  assert(true, 'first victory cinematic renders its saturation reveal without const assignment crash');

  console.log('== Astra: living studies, brush-hop and real stroke keepsakes ==');
  g.save = freshSave(); g._beginExpedition(); g.input.reset();
  const study = g.studio.studies[0];
  assert(g.studio.studies.length === 3 && !g.studio.unlocked, 'three finite field studies exist before their ability is earned');
  const node = studyNode(study);
  const wrong = { x: node.x - 30, y: node.y, a: 0, range: 70, pigment: 'red', kind: 'swipe' };
  assert(!paintStudy(study, wrong) && study.coats === 0, 'wrong pigment cannot complete a study');
  assert(!paintStudy(study, { ...wrong, pigment: 'blue', a: Math.PI }), 'painting away from a study cannot trigger it');
  assert(!paintStudy(study, { ...wrong, pigment: 'blue', x: node.x - 1000 }), 'distant painting cannot trigger a study');
  g.player.x = study.x - 100; g.player.y = study.y;
  assert(g.studio.sheltered(), 'the first field studio is a safe teaching space before its reward');
  for (let stage = 0; stage < 3; stage++) {
    const target = studyNode(study);
    g.player.x = target.x - 40; g.player.y = target.y; g.player.aimA = 0; g.player.pigment = target.pigment;
    for (let coat = 0; coat < STUDIO.coats; coat++) {
      g.player.swipeT = 0; g.paint.swipeCd = 0; g.paint.trySwipe([]);
    }
    assert(study.step === stage + 1, 'actual paint strokes transform field study stage ' + (stage + 1));
  }
  assert(g.studio.unlocked && !g.studio.sheltered(), 'finishing a study earns brush-hop and ends the teaching shelter');
  assert(g.save.sketchbook.length === 1 && g.save.sketchbook[0].strokes.length === 9, 'study completion files nine actual player strokes');
  const reload = migrateSave(JSON.parse(JSON.stringify(g.save)));
  assert(reload.studio.completed[0] === 'first-light' && reload.sketchbook[0].strokes.length === 9, 'progression and artwork survive save round-trip without changing version 12');
  const e = spawnEnemy('mosquito', g.player.x, g.player.y, g.tuning);
  g.enemies = [e]; g.player.pigment = 'blue'; g.player.hopT = 0.18; g._hopStart = true; g.input.mouse.lDown = true;
  g.studio.update(0.016); g._hopStart = false;
  assert(e.status?.type === 'slow' && e.flight === 'recover', 'earned blue brush-hop leaves a wake that interrupts a pursuing fly');
  const time = e.status.t; g.studio.update(0.016);
  assert(e.status.t === time, 'one hop cannot repeatedly refresh the same enemy status');
  for (let i = 0; i < 400; i++) g.studio.update(0.016);
  assert(g.studio.wakes.length <= STUDIO.wakeCap, 'brush wake storage stays bounded during sustained use');
  g.player.hopT = 0; g.input.reset(); g.studio.update(2);
  assert(g.studio.wakes.length === 0, 'all brush wakes expire');
  for (let i = 0; i < 12000; i++) g.studio.record({ x: i % 5000, y: 750, a: 0, range: 70, pigment: 'green', kind: 'swipe' });
  assert(g.studio.strokes.length === STUDIO.strokeCap, 'long expeditions keep only a bounded sample of strokes');
  g.studio.archive('victory'); g.studio.archive('victory');
  assert(g.save.sketchbook.length === 1, 'archiving the same expedition is idempotent');
  const page = g.save.sketchbook[0];
  for (let i = 0; i < 20; i++) fileSketch(g.save, { ...page, id: String(i) });
  assert(g.save.sketchbook.length === STUDIO.pageCap && g.save.sketchbook[0].id === '12', 'sketchbook retains the latest eight expeditions');
  const bad = normalizeSketchbook([{ strokes: [[NaN, 0, 0, 0, 1, 2], [-50, 9000, 10, 20, 99, 900]], seconds: Infinity, title: 'x'.repeat(1000) }]);
  assert(bad[0].strokes.length === 1 && bad[0].strokes[0][0] === 0 && bad[0].strokes[0][4] === 3 && bad[0].seconds === 0 && bad[0].title.length === 64, 'malformed artwork is rejected or clamped before drawing');
  drawPostcard(g.ctx, page, 0, 0, 1000, 600, 3);
  g._openSketchbook(); const runT = g.runT; const hpBook = g.player.hp;
  g._frame(g.last + 50);
  assert(g.runT === runT && g.player.hp === hpBook, 'sketchbook suspends gameplay');
  const layout = bookLayout(g);
  assert(g._gpMenuList().list.some(r => r === undefined) === false && layout.close.y + layout.close.h < g.ch, 'sketchbook exposes bounded mouse/controller targets');
  g._closeSketchbook(); g._beginExpedition();
  assert(g.studio.strokes.length === 0 && g.studio.wakes.length === 0 && g.studio.unlocked, 'restart clears transient art and wakes but preserves learned brush-hop');
  g.challenge = { mode: 'challenge', loadout: [], seed: 123 }; g.studio = new FieldStudio(g);
  assert(g.studio.studies.length === 0 && !g.studio.unlocked, 'daily challenges exclude studio rewards for a fixed competitive loadout');
  g.challenge = null;
  const pad = { axes: [0, 0, 1, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
  pad.buttons[7].pressed = true;
  g._gpWrite(pad, 500);
  assert(g.input.mouse.lDown && g.input.mouse.worldX > g.player.x && Math.abs(g.input.mouse.worldY - g.player.y) < 1, 'right stick aims and RT paints through the real controller path');
  g._gpClearOwned();
  assert(!g.input.mouse.lDown, 'controller disconnect releases its paint trigger');
  g.input.mouse._physL = true; g.input.mouse.lDown = true;
  g._gpWrite(pad, 600); g._gpClearOwned();
  assert(g.input.mouse.lDown, 'controller cleanup preserves a physically held mouse button');
  const options = migrateOptions({ volume: 0, musicVol: 'invalid', sfxVol: Infinity });
  assert(options.volume === 0 && options.musicVol === 0 && options.sfxVol === 0, 'zero volume persists and malformed audio values remain finite');
  g.save.stats.victories = 1; g.save.flags.heronDefeated = true; g.state = 'title';
  const title = g._titleLayout();
  assert(title.chall.x + title.chall.w <= title.abx, 'unlocked Challenge and Atelier buttons do not overlap');
}
