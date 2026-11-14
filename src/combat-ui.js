// Combat information belongs beside the frog, where attention already is.
// This draws above darkness, never changes targets, damage, aim or simulation.
import { PIGMENTS } from './logic.js';
import { clamp, TAU } from './math.js';
import { uiFont, centerText } from './ui.js';

export function drawCombatReadout(g, ctx, view) {
  const p = g.player;
  if (!p?.alive || g.dying || g.paused || g.help || g._bookOpen || g._atlasOpen || g._cine) return;
  const t = g.tuning, color = PIGMENTS[p.pigment].color;
  ctx.save(); ctx.translate(-view.x * view.scale, -view.y * view.scale); ctx.scale(view.scale, view.scale);

  const charging = p.splashCharge > 0 && g.input.mouse.rDown;
  // A small pigment mark shows where the middle of the swipe lands.
  if (!charging) {
    const tipX = p.x + Math.cos(p.aimA) * t.swipeRange;
    const tipY = p.y + Math.sin(p.aimA) * t.swipeRange;
    ctx.save(); ctx.translate(tipX, tipY); ctx.rotate(p.aimA);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -12);
    ctx.quadraticCurveTo(3, -9, 5, -4);
    ctx.moveTo(5, 4);
    ctx.quadraticCurveTo(3, 9, -5, 12);
    ctx.strokeStyle = '#29362f'; ctx.lineWidth = 4.5; ctx.stroke();
    ctx.strokeStyle = '#fff8e7'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = color; ctx.strokeStyle = '#fff8e7'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 0, 3.5, 2.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  } else {
    const full = p.splashCharge >= 1;
    ctx.globalAlpha = 0.1; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(p.x, p.y, t.splashRadius, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.9; ctx.strokeStyle = '#fff8e7'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, t.splashRadius, 0, TAU); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, t.splashRadius, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p.splashCharge, 0, 1)); ctx.stroke();
    const label = g.paint.splashCd > 0 ? 'Splash recharging' : full ? 'Release to splash!' : 'Hold to fill';
    ctx.globalAlpha = 0.95; ctx.fillStyle = '#f4ead8'; ctx.fillRect(p.x - 86, p.y + t.splashRadius + 9, 172, 25);
    ctx.globalAlpha = 1; centerText(ctx, label, p.x, p.y + t.splashRadius + 27, uiFont(14, { weight: 700 }), '#2b3932');
  }
  // Only show recovery when it matters; no unexplained permanent foot ring.
  if (p.hopCd > 0 && !charging) {
    const ready = 1 - clamp(p.hopCd / (t.hopCooldown || 0.7), 0, 1);
    ctx.globalAlpha = 0.9; ctx.fillStyle = '#fff8e7'; ctx.fillRect(p.x - 16, p.y + 29, 32, 5);
    ctx.fillStyle = '#456b46'; ctx.fillRect(p.x - 15, p.y + 30, 30 * ready, 3);
  }
  ctx.restore();
}
