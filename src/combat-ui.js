// Combat information belongs beside the frog, where attention already is.
// This draws above darkness, never changes targets, damage, aim or simulation.
import { PIGMENTS, umbrDeepDark } from './logic.js';
import { clamp, TAU } from './math.js';
import { uiFont, centerText } from './ui.js';

// Read the live attack state instead of inventing another combat timer. These
// captions explain the existing red lane and blue interrupt, above darkness.
const CUES = Object.freeze({
  warn: { text: 'Dodge sideways', color: '#8c3828', priority: 3 },
  serpent: { text: 'Paint the ring or dodge', color: '#8c3828', priority: 3 },
  blue: { text: 'Blue stopped it!', color: '#245f91', priority: 2 },
  open: { text: 'Your opening · paint!', color: '#345f40', priority: 1 },
});
export function enemyCombatCue(e) {
  if (!e || e.dead || e.hp <= 0) return null;
  const status = e.status?.type;
  const blueStops = (status === 'freeze' || status === 'slow') &&
    (e._clearing || e.kind === 'mosquito' || e.kind === 'moth');
  if (blueStops) return CUES.blue;
  if (status && ['freeze', 'slow', 'root', 'dizzy'].includes(status)) return null;
  const phase = e.kind === 'mosquito' ? e.flight : e._clearing ? e.clearingPhase : e.kind === 'moth' ? e.mothPhase : null;
  if (phase === 'tell') return CUES.warn;
  if (e.kind === 'serpent' && e.phase === 'telegraph') return CUES.serpent;
  // A burrowing serpent's recovery is invulnerable: never invite a wasted hit.
  if (phase === 'recover') return CUES.open;
  return null;
}

export function bossCombatCue(h, lantern) {
  if (!h || h.hp <= 0 || h.flying > 0 || h.sinking > 0 || h._intro > 0) return '';
  if (h.kind === 'umbra' && umbrDeepDark(h) && !lantern?.lit) return 'Deep dark · Light your lantern [L]';
  if (h.phase === 'dual-telegraph') return 'Two ripples · Dodge clear of both';
  if (h.phase === 'telegraph') return 'Breach coming · Leave the ripple';
  if (h.phase === 'mawClosed' || h.phase === 'transit') return 'Below the water · Reposition';
  if (h.phase === 'surfaced' || h.phase === 'mawOpen') return 'Maw open · Paint with all three colors';
  const warning = {
    'telegraph-scoop': 'Beak strike · Step aside',
    'telegraph-sweep': 'Wing sweep · Dodge away',
    'telegraph-dive': 'Dive coming · Keep moving',
    'telegraph-storm': 'Charge coming · Dodge sideways',
  }[h.state];
  if (warning) return warning;
  if (h.state === 'recover') return 'Stunned · Your opening!';
  if (h.state === 'idle') return h.phase >= 2 ? 'Frenzy · Paint between attacks' : 'Paint between attacks';
  return '';
}

function caption(ctx, text, x, y, color, size = 13) {
  const w = Math.min(310, text.length * size * 0.55 + 18);
  ctx.fillStyle = 'rgba(255,248,230,.94)'; ctx.fillRect(x - w / 2, y - 12, w, 23);
  ctx.fillStyle = color; ctx.fillRect(x - w / 2, y - 12, 3, 23);
  centerText(ctx, text, x, y + 1, uiFont(size, { weight: 700 }), color);
}

function drawThreatCaptions(g, ctx, view) {
  // Two nearby readable cues, with warning priority. A fixed two-slot selection
  // avoids allocating/sorting a list for a crowded combat frame.
  let first = null, second = null, firstRank = -Infinity, secondRank = -Infinity;
  for (const e of g.enemies || []) {
    const cue = enemyCombatCue(e);
    if (!cue) continue;
    const d = Math.hypot(e.x - g.player.x, e.y - g.player.y);
    if (d > 290 || e.x < view.x || e.y < view.y ||
      e.x > view.x + view.w / view.scale || e.y > view.y + view.h / view.scale) continue;
    const rank = cue.priority * 1000 - d;
    if (rank > firstRank) { second = first; secondRank = firstRank; first = e; firstRank = rank; }
    else if (rank > secondRank) { second = e; secondRank = rank; }
  }
  if (first) {
    const cue = enemyCombatCue(first);
    caption(ctx, cue.text, first.x, first.y + (first.r || 16) + 30, cue.color);
  }
  if (second && (Math.abs(second.x - first.x) > 145 || Math.abs(second.y - first.y) > 45)) {
    const cue = enemyCombatCue(second);
    caption(ctx, cue.text, second.x, second.y + (second.r || 16) + 30, cue.color);
  }
  const h = g.heron, bossText = bossCombatCue(h, g.lantern);
  if (bossText && Number.isFinite(h.x) && Number.isFinite(h.y) &&
    h.x >= view.x && h.x <= view.x + view.w / view.scale &&
    h.y >= view.y && h.y <= view.y + view.h / view.scale) {
    caption(ctx, bossText, h.x, h.y + 78, '#574366', 14);
  }
}

export function drawCombatReadout(g, ctx, view) {
  const p = g.player;
  if (!p?.alive || g.dying || g.paused || g.help || g._bookOpen || g._atlasOpen || g._cine) return;
  const t = g.tuning, color = PIGMENTS[p.pigment].color;
  ctx.save(); ctx.translate(-view.x * view.scale, -view.y * view.scale); ctx.scale(view.scale, view.scale);
  drawThreatCaptions(g, ctx, view);
  const charging = p.splashCharge > 0 && g.input.mouse.rDown;
  // One paintbrush, at actual reach. A remote crosshair implied that strokes
  // would hit distant things, while the fan and target rings competed with it.
  // The tip is anchored to the same aim/range used by the swipe; no auto-aim.
  if (!charging) {
    const tipX = p.x + Math.cos(p.aimA) * t.swipeRange;
    const tipY = p.y + Math.sin(p.aimA) * t.swipeRange;
    ctx.save(); ctx.translate(tipX, tipY); ctx.rotate(p.aimA);
    ctx.globalAlpha = 0.95; ctx.lineCap = 'round';
    ctx.strokeStyle = '#fff8e7'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-21, 0); ctx.lineTo(-7, 0); ctx.stroke();
    ctx.strokeStyle = '#72503a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-21, 0); ctx.lineTo(-7, 0); ctx.stroke();
    ctx.fillStyle = color; ctx.strokeStyle = '#fff8e7'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(-5, 0, 5, 4, 0, 0, TAU); ctx.fill(); ctx.stroke();
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
