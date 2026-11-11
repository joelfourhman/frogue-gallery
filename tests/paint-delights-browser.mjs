import assert from 'node:assert/strict';
import path from 'node:path';

// Scene positions are staged; colors and all four garden props are painted
// through real keyboard/mouse events and the actual brush geometry.
export async function paintDelightsBrowser({ page, tick, out, report }) {
  await page.setViewportSize({ width: 1280, height: 820 });
  const previousPad = await page.evaluate(() => window.__game.options.gamepad);
  for (let floor = 1; floor < 4; floor++) {
    const layout = await page.evaluate(async floor => {
      const g = window.__game, { freshSave } = await import('./src/logic.js');
      g.save = freshSave(); g.options.wander = false; g.options.gamepad = 'off';
      g._beginExpedition(false, { campaignFloor: floor });
      g.spawnT = 999; g.banners = []; g._tut = []; g.enemies = [];
      const garden = g.studio.garden;
      const approaches = garden.props.map(prop => {
        let nearest = Infinity;
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          const [x, y] = g.world.collideCircle(prop.x + Math.cos(a) * 52, prop.y + Math.sin(a) * 52, g.player.r);
          nearest = Math.min(nearest, Math.hypot(x - prop.x, y - prop.y));
        }
        return nearest;
      });
      return { count: garden.props.length, reachable: approaches.every(d => d <= g.tuning.swipeRange + 20),
        beforeArena: garden.props.every(p => p.x < g.world.w - 900) };
    }, floor);
    assert.equal(layout.count, 64);
    assert(layout.reachable, 'every prop has a collision-resolved approach within brush reach');
    assert(layout.beforeArena, 'free painting stays before the guardian arena');
    for (let i = 0; i < 4; i++) {
      const target = await page.evaluate(i => {
        const g = window.__game, prop = g.studio.garden.props[i];
        [g.player.x, g.player.y] = g.world.collideCircle(prop.x - 52, prop.y, g.player.r);
        g.player.vx = g.player.vy = 0; g.cam.x = g.player.x; g.cam.y = g.player.y;
        g.input.reset(); g.paint.swipeCd = 0; g.input.setView(g._view()); g._drawAll();
        return { x: prop.x, y: prop.y };
      }, i);
      await page.keyboard.press(String(i % 3 + 1)); await tick(1);
      const mouse = await page.evaluate(({ x, y }) => {
        const g = window.__game, v = g._view(), c = g.canvas.getBoundingClientRect();
        return { x: c.x + (x - v.x) * v.scale * c.width / g.cw, y: c.y + (y - v.y) * v.scale * c.height / g.ch };
      }, target);
      await page.mouse.move(mouse.x, mouse.y); await page.mouse.down(); await tick(18); await page.mouse.up();
      assert.equal(await page.evaluate(i => window.__game.studio.garden.props[i].pigment, i), ['red', 'blue', 'green'][i % 3]);
    }
    const result = await page.evaluate(() => {
      const g = window.__game; g.banners = []; g._drawAll();
      return { completed: g.studio.garden.completedClusters, painted: g.studio.garden.paintedCount,
        effects: g.studio.garden.clusters[0].bloom, bossDormant: g.heron._intro > 0 };
    });
    assert.equal(result.completed, 1);
    assert.equal(result.painted, 4);
    assert(result.effects > 0, 'finishing with actual brush strokes triggers the bloom');
    assert(result.bossDormant, 'painting early scenery does not wake the guardian');
    await page.screenshot({ path: path.join(out, `40-painted-depth-${floor + 1}.png`) });
  }
  await page.evaluate(mode => { window.__game.options.gamepad = mode; }, previousPad);
  report.push('All three deeper floors: 64 reachable repaint props, lantern/reed/mushroom/lily colors via real DOM painting, first garden celebration and dormant guardian PASS.');
}
