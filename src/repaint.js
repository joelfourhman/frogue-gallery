// Freely repaintable scenery. Color is run-local decoration, never currency,
// a puzzle requirement or collision. Fixed pools; no gameplay RNG consumption.
import { PIGMENTS, strokeTouches } from './logic.js';
import { TAU } from './math.js';
import { centerText, uiFont, paperPanel, paperEnd, INK } from './ui.js';

export const REPAINT_CAP = 64;
export const REPAINT_MARK_CAP = 8;
const KINDS = ['lily', 'mushrooms', 'flowers', 'stones'];
const DEEP_KINDS = ['lanterns', 'reeds', 'mushrooms', 'lily'];
const NATURAL_PALETTE = ['red', 'blue', 'green'];
const NAMES = { lily: 'water lilies', mushrooms: 'mushrooms', flowers: 'wildflowers', stones: 'smooth stones',
  lanterns: 'hanging lanterns', reeds: 'whisper reeds' };

// Fixed editable pieces follow the drawn silhouettes, not a large prop hitbox.
export function repaintParts(kind, seed = 0) {
  const part = (x, y, rx, ry) => ({ x, y, rx, ry, pigment: 'dry' });
  if (kind === 'lily') return Array.from({ length: 6 }, (_, i) => part(Math.cos(i * TAU / 6) * 14, -4 + Math.sin(i * TAU / 6) * 11, 13, 6));
  if (kind === 'mushrooms') return [-1, 0, 1].map(i => part(i * 23, i === 0 ? -16 : 0, i === 0 ? 19 : 14, i === 0 ? 12 : 9));
  if (kind === 'flowers') return Array.from({ length: 4 }, (_, i) => part((i - 1.5) * 17, -12 - Math.sin(i * 2 + seed) * 8, 10, 10));
  if (kind === 'reeds') return Array.from({ length: 5 }, (_, i) => part((i - 2) * 12, -24 - (i % 3) * 13, 5, 13));
  if (kind === 'lanterns') return [-1, 0, 1].map(i => part(2 + i * 11, -22, 5.5, 20));
  return [-1, 0, 1].map((i, n) => part(i * 20, n % 2 * 9, 16, 11));
}

export function repaintTargets(prop, stroke) {
  if (stroke.kind === 'splash') return prop.parts.map((p, i) =>
    strokeTouches(stroke, prop.x + p.x, prop.y + p.y, Math.min(p.rx, p.ry)) ? i : -1).filter(i => i >= 0);
  const dx = Math.cos(stroke.a), dy = Math.sin(stroke.a);
  let selected = -1, best = Infinity;
  for (let i = 0; i < prop.parts.length; i++) {
    const p = prop.parts[i], x = prop.x + p.x - stroke.x, y = prop.y + p.y - stroke.y;
    if (!strokeTouches(stroke, prop.x + p.x, prop.y + p.y, Math.min(p.rx, p.ry))) continue;
    const score = Math.abs(x * dy - y * dx) * 4 + Math.abs(stroke.range - x * dx - y * dy) * .12;
    if (score < best) { best = score; selected = i; }
  }
  return selected < 0 ? [] : [selected];
}

export class RepaintGarden {
  constructor(game, studies = []) {
    this.game = game;
    this.props = [];
    this.clusters = [];
    this.soundT = 0;
    const deep = game.campaign?.floor > 0 && game.campaign.floor < 4 &&
      ['reeds', 'blackReeds', 'reeds-dark'].includes(game.runBiome);
    // Every campaign floor has a bounded painting trail. Legacy standalone
    // diagnostic modes keep their original scenery and gameplay RNG stream.
    if ((!deep && game.runBiome !== 'swamp') || game.challenge || game.options.wander) return;
    for (let i = 0; i < REPAINT_CAP; i++) {
      const cluster = Math.floor(i / 4), j = i % 4;
      let x = deep ? 345 + cluster * (game.world.w - 1550) / 15 + j * 38
        : cluster === 0 ? 345 + j * 48 : 870 + (cluster - 1) * 287 + j * 38;
      let y = (deep ? 630 : 750) + (j % 2 ? 1 : -1) * (66 + (cluster % 3) * 31);
      // Leave the numbered teaching ponds visually separate from free painting.
      for (const study of studies) if (Math.hypot(x - study.x, y - study.y) < 230) y += y < study.y ? -165 : 165;
      if (game.world.collideCircle) [x, y] = game.world.collideCircle(x, y, 28, true);
      const kind = deep ? DEEP_KINDS[j] : KINDS[j], seed = i * 1.73;
      this.props.push({ x, y, cluster, kind, pigment: 'dry', pulse: 0, seed, r: 27,
        parts: repaintParts(kind, seed), marks: [], brushA: 0, note: -1 });
      if (!this.clusters[cluster]) this.clusters.push({ x: 0, y: 0, completed: false, bloom: 0 });
      this.clusters[cluster].x += x / 4; this.clusters[cluster].y += y / 4;
    }
  }

  get paintedCount() { return this.props.reduce((sum, prop) => sum + (prop.pigment !== 'dry' ? 1 : 0), 0); }
  get completedClusters() { return this.clusters.reduce((sum, cluster) => sum + (cluster.completed ? 1 : 0), 0); }

  onStroke(stroke) {
    if (!stroke || !PIGMENTS[stroke.pigment] || !['swipe', 'splash'].includes(stroke.kind) ||
      ![stroke.x, stroke.y, stroke.a, stroke.range].every(Number.isFinite) || stroke.range < 0) return 0;
    let changed = 0, mushroom = null, bloomed = false;
    const angle = Math.round(stroke.a * 8 / Math.PI) * Math.PI / 8;
    for (const prop of this.props) {
      if (!strokeTouches(stroke, prop.x, prop.y, 70)) continue;
      let touched = false;
      for (const index of repaintTargets(prop, stroke)) {
        const part = prop.parts[index];
        const sameMark = prop.marks.some(m => m.part === index && m.kind === stroke.kind && m.pigment === stroke.pigment && m.a === angle);
        if (part.pigment === stroke.pigment && (stroke.pigment === 'dry' || sameMark)) continue;
        part.pigment = stroke.pigment; touched = true;
        if (stroke.pigment === 'dry') prop.marks = prop.marks.filter(m => m.part !== index);
        else {
          if (prop.marks.length >= REPAINT_MARK_CAP) prop.marks.shift();
          prop.marks.push({ part: index, kind: stroke.kind, pigment: stroke.pigment, a: angle });
          if (prop.kind === 'mushrooms') { mushroom = { pig: stroke.pigment, note: index }; prop.note = index; }
        }
      }
      if (!touched) continue;
      prop.pigment = stroke.pigment === 'dry' ? prop.parts.find(p => p.pigment !== 'dry')?.pigment || 'dry' : stroke.pigment;
      prop.pulse = 1; prop.brushA = stroke.a; changed++;
    }
    if (changed) for (let i = 0; i < this.clusters.length; i++) {
      const cluster = this.clusters[i];
      let colored = true;
      for (let j = i * 4; j < i * 4 + 4; j++) if (this.props[j].pigment === 'dry') colored = false;
      if (!cluster.completed && colored) {
        cluster.completed = true; cluster.bloom = 1; bloomed = true;
      }
    }
    // The visual burst is drawn from pulse, not spawned into a particle pool.
    // Holding a color never repeats rewards, audio or effects on the same prop.
    // Existing three-note chime gives mushroom caps a little song. A cluster
    // gets one celebration per floor; erasing/repainting cannot farm it.
    if (changed && this.soundT <= 0) {
      this.game.sfx(bloomed ? 'awaken-bloom' : mushroom ? 'garden-note' : 'pickup-streak', mushroom || {});
      this.soundT = bloomed ? .65 : mushroom ? .18 : .24;
    }
    return changed;
  }

  update(dt) {
    this.soundT = Math.max(0, this.soundT - dt);
    for (const prop of this.props) prop.pulse = Math.max(0, prop.pulse - dt * 1.3);
    for (const cluster of this.clusters) cluster.bloom = Math.max(0, cluster.bloom - dt * 0.45);
  }

  draw(ctx, view, now) {
    const restored = this.game.state === 'end' && this.game.endKind === 'victory' && this.game.campaign?.complete;
    for (const prop of this.props) {
      if (prop.x < view.x - 65 || prop.x > view.x + view.w / view.scale + 65 ||
        prop.y < view.y - 65 || prop.y > view.y + view.h / view.scale + 65) continue;
      drawRepaintProp(ctx, prop, now, restored);
    }
    for (const cluster of this.clusters) {
      if (cluster.bloom <= 0 || cluster.x < view.x - 150 || cluster.x > view.x + view.w / view.scale + 150 ||
          cluster.y < view.y - 150 || cluster.y > view.y + view.h / view.scale + 150) continue;
      ctx.save(); ctx.globalAlpha = cluster.bloom; ctx.strokeStyle = '#f0dba2'; ctx.lineWidth = 2;
      const spread = 1 - cluster.bloom;
      ctx.beginPath(); ctx.ellipse(cluster.x, cluster.y, 38 + spread * 105, 20 + spread * 48, 0, 0, TAU); ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + spread * 0.5;
        ctx.fillStyle = ['#e8836b', '#8fb0f0', '#9ed483'][i % 3];
        ctx.beginPath(); ctx.ellipse(cluster.x + Math.cos(a) * (30 + spread * 95),
          cluster.y + Math.sin(a) * (20 + spread * 40) - spread * 28, 5, 2.5, a, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  drawHint(ctx) {
    const g = this.game;
    if (g.enemies?.some(e => !e.dead && Math.hypot(e.x - g.player.x, e.y - g.player.y) < 240)) return false;
    let nearest = null, distance = 150;
    for (const prop of this.props) {
      const d = Math.hypot(prop.x - g.player.x, prop.y - g.player.y);
      if (d < distance) { nearest = prop; distance = d; }
    }
    if (!nearest) return false;
    const width = Math.min(570, g.cw - 32), x = (g.cw - width) / 2, y = g.ch - 109;
    const c = paperPanel(ctx, x, y, width, 61, { seed: 86 });
    centerText(c, `Paint the ${NAMES[nearest.kind]} any color`, g.cw / 2, y + 25, uiFont(18, { weight: 700 }), INK);
    centerText(c, nearest.kind === 'mushrooms' ? 'Paint each cap a different color and hear its note'
      : 'Hold left click: stripes · Splash: speckles · 4: erase a part', g.cw / 2, y + 47, uiFont(14), '#3b5651');
    paperEnd(ctx);
    return true;
  }
}

function partPath(ctx, kind, p, index) {
  ctx.beginPath();
  if (kind === 'flowers') {
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5; ctx.ellipse(Math.cos(a) * 5, Math.sin(a) * 5, 6, 3.7, a, 0, TAU); }
  } else ctx.ellipse(0, 0, p.rx, p.ry, kind === 'lily' ? index * TAU / 6 : 0, 0, TAU);
}

export function drawRepaintProp(ctx, prop, now, restored = false) {
  const painted = restored || prop.parts.some(p => p.pigment !== 'dry'), pulse = prop.pulse;
  ctx.save(); ctx.translate(prop.x, prop.y);
  ctx.fillStyle = '#607c6b'; ctx.globalAlpha = .16;
  ctx.beginPath(); ctx.ellipse(0, 12, 35, 10, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  if (prop.kind === 'lily') {
    ctx.fillStyle = painted ? '#67916a' : '#a1af95'; ctx.strokeStyle = '#527254'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 5, 31, 20, -.15, 0, TAU); ctx.fill(); ctx.stroke();
    if (painted) { ctx.strokeStyle = '#84c4dc'; ctx.globalAlpha = .5;
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(0, 9, 34 + i * 9 + pulse * 12, 21 + i * 5, 0, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1; }
  }
  if (prop.kind === 'lanterns') {
    ctx.strokeStyle = '#6c654e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-26, 16); ctx.lineTo(-26, -54); ctx.quadraticCurveTo(-24, -72, 2, -63); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(2, -63); ctx.lineTo(2, -43); ctx.stroke();
    ctx.fillStyle = '#736549'; ctx.fillRect(-17, -45, 38, 4); ctx.fillRect(-17, 0, 38, 4);
  }
  prop.parts.forEach((p, index) => {
    // The final thief's defeat returns natural color to untouched pieces.
    // Keep the player's own palette exactly as painted; this is draw-only.
    const pigment = restored && p.pigment === 'dry' ? NATURAL_PALETTE[index % 3] : p.pigment;
    const colored = pigment !== 'dry', color = colored ? PIGMENTS[pigment].color : '#d4d6c3';
    const bend = prop.kind === 'reeds' && colored ? Math.sin(now * 2.3 + prop.seed + index * .7) * 4 + Math.cos(prop.brushA) * pulse * 8 : 0;
    const lean = prop.kind === 'flowers' && colored ? Math.cos(prop.brushA) * pulse * 6 : 0;
    if (prop.kind === 'mushrooms') { ctx.fillStyle = '#e2d5b4'; ctx.fillRect(p.x - 3, p.y, 6, 21); }
    if (prop.kind === 'flowers' || prop.kind === 'reeds') {
      ctx.strokeStyle = colored ? '#527a4b' : '#819078'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, 17); ctx.quadraticCurveTo(p.x - 5, 0, p.x + bend + lean, p.y); ctx.stroke();
    }
    ctx.save(); ctx.translate(p.x + bend + lean, p.y);
    if (prop.kind === 'lily') ctx.rotate(Math.sin(prop.brushA) * pulse * .25);
    if (prop.kind === 'mushrooms' && index === prop.note) ctx.scale(1 + Math.sin(pulse * Math.PI) * .16, 1 + Math.sin(pulse * Math.PI) * .22);
    if ((prop.kind === 'lanterns' || prop.kind === 'reeds') && colored) {
      ctx.globalAlpha = .18; ctx.fillStyle = PIGMENTS[pigment].light;
      ctx.beginPath(); ctx.ellipse(0, 0, p.rx + 9, p.ry + 9, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    partPath(ctx, prop.kind, p, index); ctx.fillStyle = color; ctx.strokeStyle = colored ? '#3e6255' : '#7b897a'; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke();
    ctx.save(); partPath(ctx, prop.kind, p, index); ctx.clip();
    for (const m of prop.marks) if (m.part === index) {
      ctx.save(); ctx.rotate(m.a); ctx.strokeStyle = PIGMENTS[m.pigment].light; ctx.fillStyle = PIGMENTS[m.pigment].light; ctx.lineWidth = 3;
      if (m.kind === 'swipe') {
        for (const y of [-4, 4]) { ctx.beginPath(); ctx.moveTo(-35, y); ctx.lineTo(35, y); ctx.stroke(); }
      } else for (let dot = 0; dot < 7; dot++) {
        const a = dot * 2.4 + index, radius = 3 + dot * 1.8;
        ctx.beginPath(); ctx.arc(Math.cos(a) * radius, Math.sin(a) * radius * .65, 2.4, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    if (prop.kind === 'flowers') { ctx.fillStyle = '#f4dc99'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (prop.kind === 'mushrooms' && index === prop.note && pulse > 0 && colored) {
      const y = p.y - 22 - (1 - pulse) * 25;
      ctx.globalAlpha = pulse; ctx.fillStyle = PIGMENTS[pigment].light; ctx.strokeStyle = PIGMENTS[pigment].color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, y, 4, 2.5, -.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(p.x + 3, y); ctx.lineTo(p.x + 3, y - 12); ctx.lineTo(p.x + 8, y - 9); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (prop.kind === 'lanterns' && colored) {
      const a = now * .8 + prop.seed + index * TAU / 3;
      ctx.fillStyle = PIGMENTS[pigment].light; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 24, 2.5, 0, TAU); ctx.fill();
    }
  });
  if (prop.kind === 'lily') { ctx.fillStyle = painted ? '#f5da91' : '#eee7cf'; ctx.beginPath(); ctx.arc(0, -4, 4, 0, TAU); ctx.fill(); }
  if (pulse > 0) {
    ctx.globalAlpha = pulse * .6; ctx.strokeStyle = '#f6edcf'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 2, 32 + (1 - pulse) * 20, 20 + (1 - pulse) * 10, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
