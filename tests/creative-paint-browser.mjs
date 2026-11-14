import assert from 'node:assert/strict';
import path from 'node:path';

// Positions are staged; every color, stroke, erase and splash uses real DOM
// controls. These checks distinguish part-level painting from flat recoloring.
export async function creativePaintBrowser({ page, tick, out, report }) {
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.evaluate(() => {
    const g = window.__game; g.options.wander = false; g._beginExpedition();
    g.enemies = []; g.spawnT = 999; g.banners = []; g._tut = null;
    g.player.iframes = 999; g._creativeProp = g.studio.garden.props.find(p => p.kind === 'mushrooms');
  });
  const paintPart = async (index, color, angle = 0) => {
    await page.keyboard.press(String(['red', 'blue', 'green', 'dry'].indexOf(color) + 1)); await tick(1);
    const target = await page.evaluate(({ index, angle }) => {
      const g = window.__game, prop = g._creativeProp, part = prop.parts[index];
      const x = prop.x + part.x, y = prop.y + part.y;
      g.player.x = x - Math.cos(angle) * g.tuning.swipeRange;
      g.player.y = y - Math.sin(angle) * g.tuning.swipeRange;
      g.player.vx = g.player.vy = 0; g.paint.swipeCd = 0; g.player.swipeT = 0;
      g.cam.x = g.player.x; g.cam.y = g.player.y; g.input.reset();
      const v = g._view(), c = g.canvas.getBoundingClientRect(); g.input.setView(v); g._drawAll();
      return { x: c.x + (x - v.x) * v.scale * c.width / g.cw,
        y: c.y + (y - v.y) * v.scale * c.height / g.ch };
    }, { index, angle });
    await page.mouse.click(target.x, target.y); await tick(1);
  };
  const admire = async filename => {
    await page.evaluate(() => {
      const g = window.__game, p = g._creativeProp;
      g.input.reset(); g.player.x = p.x - 100; g.player.y = p.y + 65;
      g.player.vx = g.player.vy = 0; g.runT = 15; g.banners = [];
      g.cam.x = g.player.x; g.cam.y = g.player.y; g.input.setView(g._view());
    });
    await tick(60); // Let brush juice settle so the artwork itself is visible.
    await page.screenshot({ path: path.join(out, filename) });
  };
  await paintPart(0, 'red'); await paintPart(1, 'green'); await paintPart(2, 'blue');
  assert.deepEqual(await page.evaluate(() => window.__game._creativeProp.parts.map(p => p.pigment)), ['red', 'green', 'blue']);
  await admire('48-mushroom-palette.png');
  await paintPart(2, 'blue', -Math.PI / 2);
  assert(await page.evaluate(() => window.__game._creativeProp.marks.some(m => m.part === 2 && Math.abs(m.a + Math.PI / 2) < .01)));
  await paintPart(1, 'dry');
  assert.deepEqual(await page.evaluate(() => window.__game._creativeProp.parts.map(p => p.pigment)), ['red', 'dry', 'blue']);
  assert.equal(await page.evaluate(() => window.__game._creativeProp.marks.some(m => m.part === 1)), false);
  await page.keyboard.press('3'); await tick(1);
  await page.evaluate(() => {
    const g = window.__game, p = g._creativeProp;
    g.player.x = p.x; g.player.y = p.y - 8; g.player.vx = g.player.vy = 0;
    g.cam.x = g.player.x; g.cam.y = g.player.y; g.input.setView(g._view());
    g.paint.splashCd = 0; g.player.splashCharge = 0;
  });
  await page.mouse.down({ button: 'right' }); await tick(40); await page.mouse.up({ button: 'right' }); await tick(1);
  assert.deepEqual(await page.evaluate(() => window.__game._creativeProp.parts.map(p => p.pigment)), ['green', 'green', 'green']);
  assert(await page.evaluate(() => window.__game._creativeProp.marks.some(m => m.kind === 'splash')));
  await admire('49-splash-speckles.png');

  await page.evaluate(() => {
    const g = window.__game; g._beginExpedition(false, { campaignFloor: 1 });
    g.enemies = []; g.spawnT = 999; g.banners = []; g._tut = null; g.player.iframes = 999;
    // The first generated lantern can have solid reeds to its left. Staging
    // the frog there lets collision move it before the stroke, beyond reach.
    // Select a real lantern with clear brush positions for all three panels.
    g._creativeProp = g.studio.garden.props.find(p => p.kind === 'lanterns' && p.parts.every(part => {
      const x = p.x + part.x - g.tuning.swipeRange, y = p.y + part.y;
      const [cx, cy] = g.world.collideCircle(x, y, g.player.r);
      return Math.hypot(cx - x, cy - y) < .001;
    }));
    if (!g._creativeProp) throw new Error('No lantern with clear test brush positions');
  });
  await paintPart(0, 'red'); await paintPart(1, 'green'); await paintPart(2, 'blue');
  const lanternState=await page.evaluate(()=>{const g=window.__game;return {parts:g._creativeProp.parts.map(p=>p.pigment),paused:g.paused,locked:g.input.pointerLocked,mouse:g.input.mouse,player:{x:g.player.x,y:g.player.y,a:g.player.aimA,pigment:g.player.pigment},prop:{x:g._creativeProp.x,y:g._creativeProp.y},strokes:g.studio.strokes.slice(-3)};});
  assert.deepEqual(lanternState.parts, ['red', 'green', 'blue'],JSON.stringify(lanternState));
  await admire('50-stained-lantern.png');
  assert(await page.evaluate(() => window.__game.studio.garden.props.every(p => p.marks.length <= 8)));
  report.push('Actual DOM painting preserves red/green/blue mushroom caps and lantern panels, directional stripes, splash speckles, touched-part erasure and bounded marks.');
}
