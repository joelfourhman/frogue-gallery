import assert from 'node:assert/strict';
import { RepaintGarden, REPAINT_CAP } from '../src/repaint.js';
import { FIELD_STUDIES } from '../src/logic.js';

const makeGame = (floor = 1) => ({ campaign: { floor }, runBiome: floor === 3 ? 'blackReeds' : 'reeds',
  options: { wander: false }, challenge: false, world: { w: 6200, h: 1500 },
  player: { x: 300, y: 630 }, enemies: [], cw: 1280, ch: 800, sfx() {} });
const strokeAt = (prop, pigment) => ({ kind: 'splash', x: prop.x, y: prop.y, a: 0, range: 1, pigment });

export function testPaintDelights() {
  for (let floor = 1; floor < 4; floor++) {
    const g = makeGame(floor), studies = floor === 3 ? [] : FIELD_STUDIES.filter(s => s.biome === 'reeds');
    const originalRandom = Math.random;
    let garden;
    Math.random = () => { throw Error('Decorative layout must not consume gameplay RNG'); };
    try { garden = new RepaintGarden(g, studies); } finally { Math.random = originalRandom; }
    assert.equal(garden.props.length, REPAINT_CAP);
    assert.equal(garden.clusters.length, 16);
    assert(garden.props.some(p => p.kind === 'lanterns'));
    assert(garden.props.some(p => p.kind === 'reeds'));
    assert(garden.props.every(p => p.x > 0 && p.x < g.world.w - 900 && p.y > 0 && p.y < g.world.h), 'scenery stays before the boss arena');
    assert(garden.props.every(p => studies.every(s => Math.hypot(p.x - s.x, p.y - s.y) > 180)), 'study dioramas remain distinct');
    const sounds = []; g.sfx = name => sounds.push(name);
    const mushrooms = garden.props.find(p => p.kind === 'mushrooms');
    assert(garden.onStroke(strokeAt(mushrooms, 'blue')) > 0);
    assert.equal(sounds[0], 'frog-chime', 'painting mushroom caps plays the existing three-note melody');
    assert.equal(garden.onStroke(strokeAt(mushrooms, 'blue')), 0, 'held paint cannot repeat the melody');
    assert.equal(sounds.length, 1);
    garden.update(1);
    garden.onStroke(strokeAt(mushrooms, 'red'));
    assert.equal(sounds.length, 2, 'recoloring after the sound cooldown plays another song');
    for (const p of garden.props.slice(0, 4)) { garden.update(1); garden.onStroke(strokeAt(p, 'green')); }
    assert.equal(garden.completedClusters, 1);
    assert.equal(garden.paintedCount, 4);
    assert.equal(garden.clusters[0].bloom, 1);
    assert(sounds.includes('awaken-bloom'), 'finishing a four-prop garden celebrates');
    const blooms = sounds.filter(s => s === 'awaken-bloom').length;
    garden.update(3);
    assert.equal(garden.clusters[0].bloom, 0);
    garden.onStroke(strokeAt(garden.props[0], 'dry'));
    assert.equal(garden.paintedCount, 3);
    garden.update(1); garden.onStroke(strokeAt(garden.props[0], 'blue'));
    assert.equal(garden.completedClusters, 1);
    assert.equal(garden.clusters[0].bloom, 0, 'erase/repaint cannot repeat completion effects');
    assert.equal(sounds.filter(s => s === 'awaken-bloom').length, blooms);

    let draws = 0;
    const ctx = new Proxy({ beginPath() { draws++; } }, {
      get: (o, k) => k in o ? o[k] : () => {}, set: (o, k, v) => { o[k] = v; return true; },
    });
    const snapshot = JSON.stringify({ props: garden.props, clusters: garden.clusters });
    garden.draw(ctx, { x: 0, y: 0, w: 1280, h: 800, scale: 1 }, 3);
    assert(draws > 0, 'new lantern/reed shapes render');
    assert.equal(JSON.stringify({ props: garden.props, clusters: garden.clusters }), snapshot, 'rendering is read-only');
    draws = 0;
    garden.draw(ctx, { x: -5000, y: -5000, w: 100, h: 100, scale: 1 }, 3);
    assert.equal(draws, 0, 'offscreen new scenery is culled');
    for (let i = 0; i < 1000; i++) { garden.onStroke(strokeAt(garden.props[i % REPAINT_CAP], i % 2 ? 'red' : 'blue')); garden.update(1 / 60); }
    assert.equal(garden.props.length, REPAINT_CAP);
    assert.equal(garden.clusters.length, 16);
    assert(garden.completedClusters <= 16, 'completion storage stays bounded');
    assert.equal(new RepaintGarden({ ...g, challenge: true }).props.length, 0);
    assert.equal(new RepaintGarden({ ...g, options: { wander: true } }).props.length, 0);
  }
  console.log('Paint delights: three deeper floors, lanterns/reeds, mushroom melody, one-time cluster blooms and fixed bounds PASS');
}

export function testPaintDelightsGame(Game, makeCanvas) {
  const g = new Game(makeCanvas());
  for (let floor = 1; floor < 4; floor++) {
    g._beginExpedition(false, { campaignFloor: floor });
    const garden = g.studio.garden;
    assert.equal(garden.props.length, REPAINT_CAP, 'actual campaign floor receives repaint scenery');
    const original = JSON.stringify(g.save), hp = g.player.hp, tuning = JSON.stringify(g.tuning);
    for (const prop of garden.props.slice(0, 4)) g.studio.onStroke(strokeAt(prop, 'red'));
    assert.equal(garden.completedClusters, 1, 'real studio stroke hook completes the garden');
    assert.equal(g.player.hp, hp, 'painting celebration has no hidden healing');
    assert.equal(JSON.stringify(g.tuning), tuning, 'no hidden combat bonus');
    assert.equal(JSON.stringify(g.save), original, 'decorative garden never mutates persistent progress');
  }
}

testPaintDelights();
