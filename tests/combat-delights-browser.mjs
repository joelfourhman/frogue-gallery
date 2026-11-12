import assert from 'node:assert/strict';
import path from 'node:path';

// Positions/last-wave HP are staged. Blue interruption, the final paint hit,
// hop and result transition still pass through real DOM input and Game frames.
export async function combatDelightsBrowser({ page, tick, out, report }) {
  await page.setViewportSize({ width: 1280, height: 820 });
  const texts = () => page.evaluate(() => {
    const g = window.__game, seen = [], original = g.ctx.fillText;
    g.ctx.fillText = function(text, ...args) { seen.push(String(text)); return original.call(this, text, ...args); };
    try { g._drawAll(); } finally { g.ctx.fillText = original; }
    return seen;
  });
  const aim = async target => {
    const at = await page.evaluate(({ x, y }) => {
      const g = window.__game, v = g._view(), c = g.canvas.getBoundingClientRect();
      return { x: c.x + (x - v.x) * v.scale * c.width / g.cw, y: c.y + (y - v.y) * v.scale * c.height / g.ch };
    }, target);
    await page.mouse.move(at.x, at.y);
  };
  const bell = await page.evaluate(async () => {
    const g = window.__game, { freshSave, CLEARING } = await import('./src/logic.js');
    window.testPad = null; g.save = freshSave(); g.options.wander = false;
    g._beginExpedition(); g.spawnT = 999; g.enemies = []; g.banners = []; g._tut = [];
    g.player.x = CLEARING.x - 55; g.player.y = CLEARING.y;
    g.cam.x = g.player.x; g.cam.y = g.player.y; g.input.reset(); g.input.setView(g._view());
    return { x: CLEARING.x, y: CLEARING.y };
  });
  await aim(bell); await page.mouse.down(); await tick(1); await page.mouse.up();
  assert.equal(await page.evaluate(() => window.__game.encounter.phase), 'fight');
  const target = await page.evaluate(() => {
    const g = window.__game, p = g.player, [a, b] = g.encounter.members;
    a.x = p.x + 48; a.y = p.y; a.hp = a.maxHp = 120;
    a.clearingPhase = 'tell'; a.clearingT = 0.7; a.clearingDX = -1; a.clearingDY = 0;
    a.status = null; a.tintT = 0; a.dead = false; a.vx = a.vy = 0;
    b.x = p.x + 800; b.clearingPhase = 'recover'; b.clearingT = 99;
    g.paint.swipeCd = 0; p.swipeT = 0;
    return { x: a.x, y: a.y };
  });
  assert(!(await texts()).includes('Dodge sideways'), 'live telegraph has no coaching text');
  await page.keyboard.press('2'); await tick(1); await aim(target);
  await page.mouse.down(); await tick(2); await page.mouse.up();
  assert.deepEqual(await page.evaluate(() => {
    const e = window.__game.encounter.members[0]; return { phase: e.clearingPhase, blue: ['slow', 'freeze'].includes(e.status?.type) };
  }), { phase: 'recover', blue: true }, 'real blue stroke cancels the attack');
  const blueText = await texts();
  assert.equal(blueText.filter(t => t === 'Blue stopped it!').length, 0, 'blue interrupt stays visual');
  assert(!blueText.includes('Dodge sideways'), 'cancelled attack no longer advertises a warning');
  await page.screenshot({ path: path.join(out, 'combat-blue-interrupt.png') });
  await page.evaluate(() => {
    const e = window.__game.encounter.members[0]; e.status = null; e.clearingPhase = 'recover'; e.clearingT = 1;
  });
  const openText = await texts();
  assert(!openText.includes('Blue stopped it!'), 'blue caption disappears with the actual status');
  assert(!openText.includes('Your opening · paint!'));

  // Stage the final remaining bug, then earn the finish with a real red stroke.
  await page.evaluate(async () => {
    const g = window.__game, { CLEARING } = await import('./src/logic.js');
    const a = g.encounter.members[0];
    g.enemies = [a]; g.encounter.members = [a]; g.encounter.round = 2;
    g.encounter.queued = CLEARING.rounds[2].length; g.encounter.elapsed = 61;
    a.hp = 1; a.status = null; a.clearingPhase = 'recover'; a.clearingT = 10;
    g.player.hopCd = 0; g.player.hp = 5; g.paint.swipeCd = 0;
  });
  await page.keyboard.press('Space'); await tick(15);
  // Reposition the staged last target after the real hop to retain brush reach.
  const finalTarget = await page.evaluate(() => {
    const g = window.__game, a = g.encounter.members[0];
    a.x = g.player.x + 48; a.y = g.player.y; return { x: a.x, y: a.y };
  });
  await page.keyboard.press('1'); await tick(1); await aim(finalTarget);
  await page.mouse.down(); await tick(2); await page.mouse.up(); await tick(2);
  const result = await page.evaluate(() => ({ phase: window.__game.encounter.phase, result: window.__game.encounter.result }));
  assert.equal(result.phase, 'complete'); assert.equal(result.result.rounds, 3);
  assert(result.result.dodges >= 1 && result.result.colors === 2);
  assert((await texts()).some(t => t.includes('battle time')));
  await page.screenshot({ path: path.join(out, 'combat-clearing-result.png') });
  await page.setViewportSize({ width: 640, height: 500 }); await tick(1);
  await page.screenshot({ path: path.join(out, 'combat-clearing-result-640.png') });
  await page.setViewportSize({ width: 1280, height: 820 });

  await page.evaluate(() => {
    const g = window.__game; g._beginExpedition(false, { campaignFloor: 2 });
    const h = g.heron;
    h._intro = 0; h.phase = 'telegraph'; h.phaseT = 0.04;
    g.player.x = h.x - 80; g.player.y = h.y; g.player.iframes = 99;
    g.cam.x = g.player.x; g.cam.y = g.player.y; g.spawnT = 999; g.enemies = []; g.banners = []; g._tut = [];
    g.input.reset(); g.input.setView(g._view());
  });
  assert(!(await texts()).includes('Breach coming · Leave the ripple'));
  await tick(4);
  assert.equal(await page.evaluate(() => window.__game.heron.phase), 'mawOpen');
  assert(!(await texts()).includes('Maw open · Paint with all three colors'), 'boss transitions have no text coaching');
  await page.screenshot({ path: path.join(out, 'combat-boss-phase.png') });
  await page.evaluate(() => {
    const g = window.__game; g._beginExpedition(false, { campaignFloor: 3 });
    const h = g.heron; h._intro = 0; h.phase = 'surfaced'; h.hp = h.maxHp * 0.3;
    g.lantern.lit = false; g.player.x = h.x - 70; g.player.y = h.y;
    g.cam.x = g.player.x; g.cam.y = g.player.y; g.enemies = []; g.banners = []; g._tut = [];
  });
  const finalPhaseText = await texts();
  assert(!finalPhaseText.includes('Deep dark · Light your lantern [L]'));
  assert(!finalPhaseText.includes('Maw open · Paint with all three colors'), 'unlit final-phase boss is not falsely advertised as paintable');
  report.push('Quiet combat DOM checks: live blue interrupt and boss transitions retain their mechanics without coaching captions; actual finishing hit earns the out-of-combat clearing result.');
}
