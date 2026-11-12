import assert from 'node:assert/strict';

export function testSwampStoryGame(Game, makeCanvas) {
  const g = new Game(makeCanvas());
  const seen = [], original = g.ctx.fillText;
  g.ctx.fillText = function(text, ...args) { seen.push(String(text)); return original.call(this, text, ...args); };
  const checkWords = () => assert(!seen.some(line => /dungeon|\bdepth\b|descend/i.test(line)), 'screens tell the swamp story');
  g._drawTitle(g.ctx); checkWords();
  assert(seen.some(line => /Umbral Wyrm.*stole our color/.test(line)));
  assert(seen.includes('Reclaim our swamp'));
  g._beginExpedition(); g._endRun('victory'); seen.length = 0; g._drawAll(); checkWords();
  assert(seen.includes('Rest by the water'));
  g._beginExpedition(false, { campaignFloor: 3 });
  const raw = g.world.worldColorSat();
  g._endRun('victory'); g.endT = 3;
  let saturation = 0, masks = 0;
  const background = g.world.drawBackground;
  g.world.drawBackground = function(ctx, view, sat) { saturation = sat; return background.call(this, ctx, view, sat); };
  g._drawReedsLight = () => masks++;
  seen.length = 0; g._drawAll(); checkWords();
  assert.equal(saturation, 1, 'defeating the color thief returns full world color');
  assert.equal(masks, 0, 'the final victory is no longer covered in stolen-color darkness');
  assert.equal(g.world.worldColorSat(), raw, 'victory presentation does not rewrite painting data');
  assert(seen.includes('Our swamp has its color back.'));
  assert(seen.some(line => /releases the stolen color/.test(line)));
  g.ctx.fillText = original;
  console.log('Swamp story: our home/stolen-color title, regional rests and final color return PASS');
}
