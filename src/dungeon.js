// Rest beside the water and the route through our swamp. Rendering never advances
// a floor or grants a reward; Game owns input, pure logic owns those rules.
import { CAMPAIGN, CAMPAIGN_REWARDS, campaignFloor, campaignRewardOffers, campaignRewardPreview } from './logic.js';
import { centerText, uiFont, paperPanel, paperEnd, uiButton, INK } from './ui.js';
import { TAU } from './math.js';

const BOSS_NAMES = { gray: 'Great Gray Heron', wyrm: 'Silt Wyrm', warden: 'Hollow Warden', umbra: 'Umbral Wyrm' };
const ACCENTS = ['#c8452c', '#578341', '#3a6fd8'];
const hover = (g, r) => {
  const m = g.input?.mouse;
  return !!m && m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h;
};

export function dungeonCampLayout(g) {
  const w = Math.min(1080, g.cw - 32), h = Math.min(650, g.ch - 32);
  const x = (g.cw - w) / 2, y = (g.ch - h) / 2;
  const tight = h < 570, gap = w < 700 ? 10 : 20;
  const cardsY = y + (tight ? 194 : 246), cardH = h - (tight ? 329 : 408);
  const cardW = (w - 48 - gap * 2) / 3;
  const cards = campaignRewardOffers(g.campaign).map((reward, i) => ({
    id: reward.id, x: x + 24 + i * (cardW + gap), y: cardsY, w: cardW, h: cardH,
  }));
  const buttonW = Math.min(430, w - 64);
  return {
    panel: { x, y, w, h }, cards, tight,
    descend: { x: g.cw / 2 - buttonW / 2, y: y + h - 103, w: buttonW, h: 48 },
  };
}

function wrapped(ctx, text, x, y, width, size, color = INK, lineHeight = size * 1.35) {
  ctx.save(); ctx.font = uiFont(size); ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let line = '', row = 0;
  for (const word of String(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      ctx.fillText(line, x, y + row++ * lineHeight); line = word;
    } else line = next;
  }
  if (line) ctx.fillText(line, x, y + row * lineHeight);
  ctx.restore();
}

function route(ctx, run, x, y, w, labels = true) {
  const current = Math.min(CAMPAIGN.length - 1, Math.max(0, run?.floor || 0));
  const cleared = run?.cleared?.length || 0;
  const step = w / CAMPAIGN.length;
  ctx.save(); ctx.strokeStyle = '#b2b79b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + step / 2, y); ctx.lineTo(x + w - step / 2, y); ctx.stroke();
  for (let i = 0; i < CAMPAIGN.length; i++) {
    const cx = x + step * (i + 0.5), complete = i < cleared;
    ctx.fillStyle = complete ? '#557e52' : i === current ? '#f5dd99' : '#e3dcc9';
    ctx.strokeStyle = '#53634c'; ctx.lineWidth = i === current ? 3 : 1.5;
    ctx.beginPath(); ctx.arc(cx, y, 13, 0, TAU); ctx.fill(); ctx.stroke();
    centerText(ctx, complete ? '✓' : String(i + 1), cx, y + 1, uiFont(14, { weight: 700 }), complete ? '#fff8e7' : INK);
    if (labels) wrapped(ctx, CAMPAIGN[i].name, cx, y + 28, step - 12, step < 180 ? 12 : 14);
  }
  ctx.restore();
}

export function drawDungeonCamp(g, ctx) {
  if (!g.campaign) return;
  const l = dungeonCampLayout(g), p = l.panel, floor = campaignFloor(g.campaign);
  const next = CAMPAIGN[Math.min(CAMPAIGN.length - 1, g.campaign.floor + 1)];
  const offers = campaignRewardOffers(g.campaign);
  const selected = offers.find(reward => reward.id === g._campChoice);
  const pad = g._gp?.connected && g.options?.gamepad !== 'off';
  ctx.save(); ctx.fillStyle = 'rgba(25,39,33,0.76)'; ctx.fillRect(0, 0, g.cw, g.ch); ctx.restore();
  const c = paperPanel(ctx, p.x, p.y, p.w, p.h, { seed: 107 });
  centerText(c, 'Rest by the water', g.cw / 2, p.y + 37, uiFont(l.tight ? 26 : 34, { weight: 700 }), '#355a48');
  centerText(c, `${BOSS_NAMES[floor.boss] || floor.boss} defeated · Region ${g.campaign.floor + 1} of ${CAMPAIGN.length} opened`,
    g.cw / 2, p.y + (l.tight ? 66 : 78), uiFont(p.w < 700 ? 14 : 18), INK);
  route(c, g.campaign, p.x + 28, p.y + (l.tight ? 90 : 120), p.w - 56);
  const health = value => Number.isFinite(value) ? String(Math.round(Math.max(0, value) * 10) / 10) : '—';
  centerText(c, `Health ${health(g.player?.hp)} / ${health(g.player?.maxHp)} · Rest heals 35% of max health, up to full`,
    g.cw / 2, p.y + (l.tight ? 137 : 171), uiFont(l.tight ? 12 : 16), '#355a48');
  const gifts = CAMPAIGN_REWARDS.map(reward => {
    const count = g.campaign.rewards.filter(id => id === reward.id).length;
    return count ? `${reward.name}${count > 1 ? ` ×${count}` : ''}` : '';
  }).filter(Boolean);
  centerText(c, gifts.length ? `Carried gifts: ${gifts.join(' · ')}` : 'Your first brush gift awaits below',
    g.cw / 2, p.y + (l.tight ? 155 : 193), uiFont(l.tight ? 12 : 16), '#455545');
  centerText(c, 'Choose one brush upgrade for this run', g.cw / 2, p.y + (l.tight ? 176 : 221),
    uiFont(l.tight ? 17 : 22, { weight: 700 }), INK);
  paperEnd(c);

  for (let i = 0; i < l.cards.length; i++) {
    const r = l.cards[i], reward = offers[i], chosen = selected?.id === reward.id;
    const c = paperPanel(ctx, r.x, r.y, r.w, r.h, { seed: 108 + i, fill: chosen ? '#fff8e7' : hover(g, r) ? '#f9efdc' : '#e9dfcc' });
    c.strokeStyle = chosen ? ACCENTS[i] : '#b1a98e'; c.lineWidth = chosen ? 4 : 1;
    c.strokeRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12);
    const compact = l.tight, numberY = r.y + (compact ? 22 : 30);
    c.fillStyle = ACCENTS[i]; c.beginPath(); c.arc(r.x + r.w / 2, numberY, compact ? 12 : 15, 0, TAU); c.fill();
    centerText(c, String(i + 1), r.x + r.w / 2, numberY, uiFont(compact ? 15 : 18, { weight: 700 }), '#fff8e7');
    wrapped(c, reward.name, r.x + r.w / 2, r.y + (compact ? 47 : 65), r.w - 24, r.w < 230 ? 15 : 21, INK);
    if (!compact) wrapped(c, reward.description, r.x + r.w / 2, r.y + (r.w < 230 ? 91 : 104), r.w - 28, r.w < 230 ? 13 : 17, '#455545');
    const preview = campaignRewardPreview(g.tuning, reward.id);
    preview.forEach((line, row) => centerText(c, line, r.x + r.w / 2,
      compact ? r.y + 76 + row * 18 : r.y + r.h - 69 + row * 19,
      uiFont(compact ? 11 : r.w < 230 ? 12 : 14, { weight: 700 }), '#355a48'));
    centerText(c, chosen ? 'Selected' : pad ? 'Choose with A' : `Press ${i + 1} or click`, r.x + r.w / 2, r.y + r.h - (compact ? 15 : 22),
      uiFont(r.w < 230 ? 13 : 16, { weight: chosen ? 700 : 400 }), chosen ? ACCENTS[i] : '#655f52');
    paperEnd(c);
  }

  const b = l.descend;
  centerText(ctx, `Next: ${next.name} · ${BOSS_NAMES[next.boss] || next.boss}`, g.cw / 2, b.y - 17,
    uiFont(p.w < 700 ? 13 : 17, { weight: 700 }), INK);
  ctx.save(); ctx.globalAlpha = selected ? 1 : 0.48;
  uiButton(ctx, b.x, b.y, b.w, b.h, selected ? `Continue · ${pad ? 'A' : 'Enter'}` : 'Choose an upgrade above', !!selected && hover(g, b), false,
    { seed: 112, size: 20 });
  ctx.restore();
  centerText(ctx, pad ? 'D-pad ↑↓ choose · A confirms · B clears choice' : '1–3 choose · Enter continues · Health and upgrades carry onward', g.cw / 2, p.y + p.h - 32,
    uiFont(p.w < 700 ? 11 : 14), '#4c5c4d');
}

export function drawDungeonProgress(g, ctx) {
  if (!g.campaign || g.state !== 'expedition' || g.help || g.paused || g._bookOpen || g._atlasOpen || g.encounter?.nearby || g.encounter?.active) return;
  const studio = g.studio, player = g.player;
  if (player && studio && (
    studio.studies?.some(s => Math.hypot(s.x - player.x, s.y - player.y) < 280) ||
    studio.garden?.props?.some(p => Math.hypot(p.x - player.x, p.y - player.y) < 150) ||
    (!studio.unlocked && studio.studies?.[0]?.step < 3 && player.x <= 1000)
  )) return; // Let the painting card own the bottom of the screen.
  const floor = campaignFloor(g.campaign), final = floor.final;
  const text = `${floor.name} · ${g.campaign.floor + 1} / ${CAMPAIGN.length}${final ? ' · The color thief' : ''}`;
  const w = Math.min(450, g.cw - 420), x = (g.cw - w) / 2;
  if (w < 220) return;
  ctx.save(); ctx.fillStyle = 'rgba(244,234,216,0.92)'; ctx.fillRect(x, g.ch - 42, w, 29);
  centerText(ctx, text, g.cw / 2, g.ch - 27, uiFont(14, { weight: 700 }), '#355345'); ctx.restore();
}

// Optional title-screen subtitle; parent chooses its location in title layout.
export function drawDungeonRoute(g, ctx, x, y, w) {
  route(ctx, g.state === 'title' ? null : g.campaign, x, y, w, true);
}
