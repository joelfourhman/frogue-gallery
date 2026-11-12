import assert from 'node:assert/strict';
import path from 'node:path';

export async function swampStoryBrowser({ page, tick, out, report }) {
  await page.setViewportSize({ width: 1280, height: 820 });
  const rendered = () => page.evaluate(() => {
    const g = window.__game, lines = [], original = g.ctx.fillText;
    g.ctx.fillText = function(text, ...args) { lines.push(String(text)); return original.call(this, text, ...args); };
    try { g._drawAll(); } finally { g.ctx.fillText = original; }
    return lines;
  });
  const noDungeon = lines => assert(!lines.some(s => /dungeon|\bdepth\b|descend/i.test(s)), 'player-facing story is our swamp');
  await page.evaluate(() => { const g = window.__game; g._quitToTitle(); g.banners = []; });
  let lines = await rendered(); noDungeon(lines);
  assert(lines.some(s => /Umbral Wyrm.*stole our color/.test(s)));
  assert(lines.includes('Reclaim our swamp'));
  await page.screenshot({ path: path.join(out, '48-our-swamp-title.png') });
  await page.keyboard.press('Enter'); await tick(1);
  assert.equal(await page.evaluate(() => window.__game.state), 'expedition');
  await page.evaluate(() => { const g = window.__game; g._endRun('victory'); g.banners = []; });
  lines = await rendered(); noDungeon(lines); assert(lines.includes('Rest by the water'));
  await page.screenshot({ path: path.join(out, '49-swamp-rest.png') });
  const finale = await page.evaluate(() => {
    const g = window.__game; g._beginExpedition(false, { campaignFloor: 3 });
    g.player.x = g.world.w - 500; g.player.y = 750; g.cam.x = g.player.x; g.cam.y = g.player.y;
    g._endRun('victory'); g.endT = 3; g.banners = [];
    let sat = -1, darkness = 0;
    const background = g.world.drawBackground, light = g._drawReedsLight;
    g.world.drawBackground = function(ctx, view, value) { sat = value; return background.call(this, ctx, view, value); };
    g._drawReedsLight = () => darkness++;
    try { g._drawAll(); } finally { g.world.drawBackground = background; g._drawReedsLight = light; }
    return { sat, darkness };
  });
  assert.deepEqual(finale, { sat: 1, darkness: 0 });
  lines = await rendered(); noDungeon(lines);
  assert(lines.includes('Our swamp has its color back.'));
  await page.screenshot({ path: path.join(out, '50-color-returned.png') });
  report.push('Our swamp story: title names the color thief, regions/rests avoid dungeon language, final victory returns full color and removes darkness.');
}
