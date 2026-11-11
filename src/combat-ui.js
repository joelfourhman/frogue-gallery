// Combat information belongs beside the frog, where attention already is.
// This draws above darkness, never changes targets, damage, aim or simulation.
import { brushHitsCircle, PIGMENTS } from './logic.js';
import { clamp, TAU } from './math.js';
import { uiFont, centerText } from './ui.js';

export function drawCombatReadout(g, ctx, view) {
  const p = g.player;
  if (!p?.alive || g.dying || g.paused || g.help || g._bookOpen || g._atlasOpen || g._cine) return;
  const t = g.tuning, color = PIGMENTS[p.pigment].color;
  let target = null, distance = Infinity;
  for (const e of g.enemies) {
    if (e.dead || (e.burrower && (e.phase === 'burrowed' || e.phase === 'recover'))) continue;
    if (!brushHitsCircle(p.x, p.y, p.aimA, t.swipeRange, t.swipeArc, e)) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < distance) { target = e; distance = d; }
  }
  ctx.save(); ctx.translate(-view.x * view.scale, -view.y * view.scale); ctx.scale(view.scale, view.scale);
  const charging = p.splashCharge > 0 && g.input.mouse.rDown;
  // The marker sits at ACTUAL melee reach, not at a distant mouse pointer.
  if (!charging) {
    const a = p.aimA, r = t.swipeRange, half = t.swipeArc / 2;
    ctx.strokeStyle = '#fff8e7'; ctx.lineWidth = 4; ctx.globalAlpha = target ? 0.9 : 0.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, a - half, a + half); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, a - half, a + half); ctx.stroke();
    const tipX = p.x + Math.cos(a) * r, tipY = p.y + Math.sin(a) * r;
    ctx.globalAlpha = 1; ctx.fillStyle = color; ctx.strokeStyle = '#fff8e7'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(tipX, tipY, 4, 0, TAU); ctx.fill(); ctx.stroke();
    if (target) {
      ctx.strokeStyle = target.hitFlash > 0 ? '#fff8e7' : color;
      ctx.lineWidth = target.hitFlash > 0 ? 3 : 2;
      ctx.beginPath(); ctx.arc(target.x, target.y, target.r + 5, 0, TAU); ctx.stroke();
    }
  } else {
    const full = p.splashCharge >= 1;
    ctx.globalAlpha = 0.1; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(p.x, p.y, t.splashRadius, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.9; ctx.strokeStyle = '#fff8e7'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, t.splashRadius, 0, TAU); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, t.splashRadius, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p.splashCharge, 0, 1)); ctx.stroke();
    const label = g.paint.splashCd > 0 ? `Recovering ${g.paint.splashCd.toFixed(1)}s` : full ? 'RELEASE · SPLASH' : 'Charging splash';
    ctx.globalAlpha = 0.95; ctx.fillStyle = '#f4ead8'; ctx.fillRect(p.x - 86, p.y + t.splashRadius + 9, 172, 25);
    ctx.globalAlpha = 1; centerText(ctx, label, p.x, p.y + t.splashRadius + 27, uiFont(14, { weight: 700 }), '#2b3932');
  }
  // A quiet readiness arc at the frog's feet; unchanged hop cooldown/iframes.
  const ready = 1 - clamp(p.hopCd / (t.hopCooldown || 0.7), 0, 1);
  ctx.globalAlpha = 0.85; ctx.strokeStyle = '#fff8e7'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(p.x, p.y, 24, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
  ctx.strokeStyle = '#456b46'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, 24, Math.PI * 0.2, Math.PI * (0.2 + ready * 0.6)); ctx.stroke();
  ctx.restore();
}
