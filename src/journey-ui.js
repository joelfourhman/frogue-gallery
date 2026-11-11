// Quiet route guidance and authored floor identity. All functions only read the
// run: drawing never wakes a guardian, grants a gift or changes progression.
import { CAMPAIGN_REWARDS, campaignFloor, CLEARING } from './logic.js';
import { centerText, uiFont, INK } from './ui.js';
import { TAU, clamp } from './math.js';

export const GUARDIAN_NAMES = Object.freeze({ gray: 'Great Gray Heron', wyrm: 'Silt Wyrm', warden: 'Hollow Warden', umbra: 'Umbral Wyrm' });
const FLOOR_VOICES = Object.freeze([
  { color: '#48765b', line: 'A pale marsh waiting for your first brushstroke.' },
  { color: '#456c82', line: 'Lantern light catches color beneath the reeds.' },
  { color: '#8b703e', line: 'Old roots shelter a guardian of the hollow.' },
  { color: '#74618c', line: 'Carry your colors into the last of the dark.' },
]);
const visible = g => g.state === 'expedition' && g.player?.alive && !g.dying &&
  !g.paused && !g.help && !g._bookOpen && !g._atlasOpen && !g._tutorialActive?.();

export function journeyLandmarks(g) {
  const floor = campaignFloor(g.campaign);
  if (!floor || !g.world || g.challenge || g.options?.wander) return null;
  return {
    guardian: { x: Math.max(0, g.world.w - 900), y: 750, name: GUARDIAN_NAMES[floor.boss], final: floor.final,
      defeated: g.campaign.cleared.includes(floor.boss) },
    clearing: g.campaign.floor === 0 ? { x: CLEARING.x, y: CLEARING.y, name: 'Lily Clearing', complete: !!g.encounter?.completed } : null,
  };
}

// One objective at a time; nearby studies and the clearing own their existing
// teaching cards, so route guidance yields while those activities are in view.
export function journeyObjective(g) {
  const floor = campaignFloor(g.campaign);
  if (!floor || !g.player || !g.world) return '';
  const boss = g.heron;
  if (boss?.hp <= 0) return floor.final ? 'The last guardian is painted.' : 'Guardian painted · A rest awaits.';
  if (boss && boss._intro <= 0 && boss.flying <= 0) {
    if (floor.boss === 'warden') return 'Paint the open maw · Dodge when it lunges.';
    if (floor.boss === 'umbra') return 'Keep your lantern lit · Paint when the wyrm surfaces.';
    if (floor.boss === 'wyrm') return 'Watch the marked water · Paint the surfaced wyrm.';
    return 'Dodge the marked strike · Paint while the heron recovers.';
  }
  if (g.player.x >= g.world.w - 1200) return `${floor.final ? 'Final guardian' : 'Guardian'} ahead · ${GUARDIAN_NAMES[floor.boss]}`;
  if (g.encounter?.nearby || g.encounter?.active) return '';
  if (g.enemies?.some(e => !e.dead && e.hp > 0 && Math.hypot(e.x - g.player.x, e.y - g.player.y) < 260)) return '';
  if (g.studio?.studies?.some(s => Math.hypot(s.x - g.player.x, s.y - g.player.y) < 230)) return '';
  return 'Explore and paint · Follow the path right →';
}

export function journeyHudLayout(g) {
  const w = Math.min(520, Math.max(240, g.cw - 40));
  return { x: (g.cw - w) / 2, y: 145, w, h: 34,
    intro: { x: (g.cw - w) / 2, y: 145, w, h: 86 } };
}

export function drawJourneyHud(g, ctx) {
  if (!visible(g)) return;
  const floor = campaignFloor(g.campaign);
  if (!floor || g.challenge || g.options?.wander) return;
  // Intro uses this floor's time, so deeper entries work with a carried clock.
  const elapsed = Math.max(0, (g.runT || 0) - (g._floorStartT || 0));
  const intro = elapsed >= 0.3 && elapsed < 9 && !g.encounter?.active;
  const b = journeyHudLayout(g), voice = FLOOR_VOICES[g.campaign.floor];
  // A teaching or event banner already supplies the current instruction.
  if (g.banners?.some(banner => banner.t > 0)) return;
  if (intro) {
    const p = b.intro;
    ctx.save(); ctx.globalAlpha = clamp(Math.min(elapsed * 3, (9 - elapsed) * 2), 0, 1);
    ctx.fillStyle = '#f4ead8'; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = voice.color; ctx.fillRect(p.x, p.y, 5, p.h);
    centerText(ctx, `Depth ${g.campaign.floor + 1} · ${floor.name}`, g.cw / 2, p.y + 29, uiFont(g.cw < 800 ? 22 : 26, { weight: 700 }), voice.color);
    centerText(ctx, voice.line, g.cw / 2, p.y + 57, uiFont(g.cw < 800 ? 13 : 16), INK);
    centerText(ctx, floor.final ? 'The final guardian waits at the far shore.' : 'Paint, explore, then meet the guardian at the far shore.', g.cw / 2, p.y + 76, uiFont(12), '#526052');
    ctx.restore();
  } else {
    const text = journeyObjective(g);
    if (!text) return;
    ctx.save(); ctx.fillStyle = 'rgba(244,234,216,.92)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    centerText(ctx, text, g.cw / 2, b.y + 22, uiFont(g.cw < 800 ? 13 : 15), '#365347'); ctx.restore();
  }
}

// Call while ctx is in WORLD coordinates, alongside studio/world decoration.
// Two carved reeds frame an open path; this is a landmark, never a locked gate.
export function drawJourneyWorld(g, ctx, view) {
  if (g.state !== 'expedition' || g._tutorialActive?.()) return;
  const points = journeyLandmarks(g);
  if (!points) return;
  const mark = points.guardian;
  if (mark.x < view.x - 170 || mark.x > view.x + view.w / view.scale + 170 ||
      mark.y < view.y - 150 || mark.y > view.y + view.h / view.scale + 150) return;
  const voice = FLOOR_VOICES[g.campaign.floor];
  ctx.save(); ctx.translate(mark.x, mark.y);
  ctx.strokeStyle = '#4d5b47'; ctx.lineCap = 'round'; ctx.lineWidth = 8;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * 91, 46); ctx.quadraticCurveTo(side * 99, -18, side * 79, -86); ctx.stroke();
    ctx.strokeStyle = voice.color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(side * 91, 0); ctx.lineTo(side * 121, -22); ctx.moveTo(side * 89, -34); ctx.lineTo(side * 116, -50); ctx.stroke();
    ctx.strokeStyle = '#4d5b47'; ctx.lineWidth = 8;
  }
  ctx.fillStyle = '#e9dfc7'; ctx.fillRect(-114, -113, 228, 31);
  centerText(ctx, mark.final ? 'THE LAST GUARDIAN →' : 'GUARDIAN AHEAD →', 0, -92, uiFont(14, { weight: 700 }), voice.color);
  // Distinct emblems: feather, water rings, rooted eye, crescent.
  ctx.strokeStyle = voice.color; ctx.fillStyle = voice.color; ctx.lineWidth = 3;
  ctx.beginPath();
  if (g.campaign.floor === 0) {
    ctx.ellipse(0, -143, 9, 20, 0.4, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, -127); ctx.lineTo(9, -161); ctx.stroke();
  } else if (g.campaign.floor === 1) {
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, -138 - i * 7, 20 - i * 5, 7, 0, 0, TAU); ctx.stroke(); }
  } else if (g.campaign.floor === 2) {
    ctx.ellipse(0, -142, 23, 11, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -142, 5, 0, TAU); ctx.fill();
  } else {
    ctx.arc(0, -143, 18, 0.5, TAU - 0.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(5, -143, 10, 0.5, TAU - 0.5); ctx.stroke();
  }
  ctx.restore();
}

export function runBuildLines(g) {
  const rewards = g.campaign?.rewards || [];
  return CAMPAIGN_REWARDS.flatMap(reward => {
    const count = rewards.filter(id => id === reward.id).length;
    return count ? [`${reward.name}${count > 1 ? ` ×${count}` : ''}`] : [];
  });
}

// A 104px summary fits beside a postcard, or fills its empty space. The run
// allows three gifts total, so even three distinct names remain bounded.
export function drawRunBuild(g, ctx, x, y, w) {
  const gifts = runBuildLines(g);
  ctx.save(); ctx.fillStyle = '#e9e0cb'; ctx.fillRect(x, y, w, 104);
  centerText(ctx, 'Your brush this run', x + w / 2, y + 18, uiFont(14, { weight: 700 }), '#355848');
  const rows = gifts.length ? gifts.slice(0, 3) : ['A fresh brush', 'No guardian gifts yet'];
  rows.forEach((line, i) => centerText(ctx, line, x + w / 2, y + 44 + i * 21, uiFont(w < 300 ? 12 : 15), INK));
  ctx.restore();
}
