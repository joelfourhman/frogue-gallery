// Freely repaintable scenery. Color is run-local decoration, never currency,
// a puzzle requirement or collision. Fixed pools; no gameplay RNG consumption.
import { PIGMENTS, strokeTouches } from './logic.js';
import { TAU } from './math.js';
import { centerText, uiFont, paperPanel, paperEnd, INK } from './ui.js';

export const REPAINT_CAP = 64;
const KINDS = ['lily', 'mushrooms', 'flowers', 'stones'];
const DEEP_KINDS = ['lanterns', 'reeds', 'mushrooms', 'lily'];
const NAMES = { lily: 'water lilies', mushrooms: 'mushrooms', flowers: 'wildflowers', stones: 'smooth stones',
  lanterns: 'hanging lanterns', reeds: 'whisper reeds' };

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
      this.props.push({ x, y, cluster, kind: deep ? DEEP_KINDS[j] : KINDS[j], pigment: 'dry', pulse: 0, seed: i * 1.73, r: 27 });
      if (!this.clusters[cluster]) this.clusters.push({ x: 0, y: 0, completed: false, bloom: 0 });
      this.clusters[cluster].x += x / 4; this.clusters[cluster].y += y / 4;
    }
  }

  get paintedCount() { return this.props.reduce((sum, prop) => sum + (prop.pigment !== 'dry' ? 1 : 0), 0); }
  get completedClusters() { return this.clusters.reduce((sum, cluster) => sum + (cluster.completed ? 1 : 0), 0); }

  onStroke(stroke) {
    if (!stroke || !PIGMENTS[stroke.pigment] || !['swipe', 'splash'].includes(stroke.kind) ||
      ![stroke.x, stroke.y, stroke.a, stroke.range].every(Number.isFinite) || stroke.range < 0) return 0;
    let changed = 0, mushroom = false, bloomed = false;
    for (const prop of this.props) {
      if (prop.pigment === stroke.pigment || !strokeTouches(stroke, prop.x, prop.y, prop.r)) continue;
      prop.pigment = stroke.pigment;
      prop.pulse = 1;
      mushroom ||= prop.kind === 'mushrooms' && stroke.pigment !== 'dry';
      changed++;
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
      this.game.sfx(bloomed ? 'awaken-bloom' : mushroom ? 'frog-chime' : 'pickup-streak');
      this.soundT = mushroom || bloomed ? 0.65 : 0.24;
    }
    return changed;
  }

  update(dt) {
    this.soundT = Math.max(0, this.soundT - dt);
    for (const prop of this.props) prop.pulse = Math.max(0, prop.pulse - dt * 1.3);
    for (const cluster of this.clusters) cluster.bloom = Math.max(0, cluster.bloom - dt * 0.45);
  }

  draw(ctx, view, now) {
    for (const prop of this.props) {
      if (prop.x < view.x - 65 || prop.x > view.x + view.w / view.scale + 65 ||
        prop.y < view.y - 65 || prop.y > view.y + view.h / view.scale + 65) continue;
      drawRepaintProp(ctx, prop, now);
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
      centerText(ctx, 'A little garden, alive with color', cluster.x, cluster.y - 54 - spread * 15,
        uiFont(15, { weight: 700 }), '#fff5d7');
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
    centerText(c, nearest.kind === 'mushrooms' ? 'Hold left click · Recolor the caps to hear their song'
      : 'Move close · Hold left click · Q / E changes color', g.cw / 2, y + 47, uiFont(14), '#3b5651');
    paperEnd(ctx);
    return true;
  }
}

export function drawRepaintProp(ctx, prop, now) {
  const painted = prop.pigment !== 'dry', color = painted ? PIGMENTS[prop.pigment].color : '#d4d6c3';
  const pulse = prop.pulse, sway = painted ? Math.sin(now * 2.2 + prop.seed) * 0.035 : 0;
  ctx.save(); ctx.translate(prop.x, prop.y); ctx.rotate(sway);
  const size = 1 + Math.sin(pulse * Math.PI) * 0.22;
  ctx.scale(size, size);
  ctx.strokeStyle = painted ? '#3e6255' : '#7b897a'; ctx.lineWidth = 1.6;
  ctx.fillStyle = '#607c6b'; ctx.globalAlpha = 0.16;
  ctx.beginPath(); ctx.ellipse(0, 12, 31, 10, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  if (prop.kind === 'lily') {
    ctx.fillStyle = painted ? '#67916a' : '#a1af95';
    ctx.beginPath(); ctx.ellipse(0, 5, 27, 16, -0.15, 0, TAU); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 9, -4 + Math.sin(a) * 5, 13, 6, a, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = painted ? '#f5da91' : '#eee7cf'; ctx.beginPath(); ctx.arc(0, -4, 5, 0, TAU); ctx.fill();
  } else if (prop.kind === 'lanterns') {
    ctx.strokeStyle = '#6c654e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-26, 16); ctx.lineTo(-26, -54); ctx.quadraticCurveTo(-24, -72, 2, -63); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(2, -63); ctx.lineTo(2, -43); ctx.stroke();
    if (painted) {
      ctx.globalAlpha = 0.13 + Math.sin(now * 2 + prop.seed) * 0.025;
      ctx.fillStyle = PIGMENTS[prop.pigment].light; ctx.beginPath(); ctx.arc(2, -21, 37, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = color; ctx.strokeStyle = '#53604b';
    ctx.beginPath(); ctx.ellipse(2, -22, 17, 22, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#f2e6c4'; ctx.beginPath(); ctx.moveTo(2, -42); ctx.lineTo(2, -2); ctx.stroke();
    ctx.fillStyle = '#736549'; ctx.fillRect(-8, -45, 20, 4); ctx.fillRect(-7, 0, 18, 4);
    ctx.fillStyle = painted ? '#fff1bf' : '#d4cbb0'; ctx.beginPath(); ctx.ellipse(2, -21, 4, 8, 0, 0, TAU); ctx.fill();
  } else if (prop.kind === 'reeds') {
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 10, top = -24 - (i % 3) * 13;
      const bend = painted ? Math.sin(now * 2.3 + prop.seed + i * 0.4) * 9 : 2;
      ctx.strokeStyle = painted ? '#638655' : '#8c9981'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, 17); ctx.quadraticCurveTo(x + bend * 0.3, -7, x + bend, top); ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x + bend, top, 4.5, 13, 0.14 + bend * 0.025, 0, TAU); ctx.fill();
      if (painted) {
        ctx.globalAlpha = 0.18; ctx.fillStyle = PIGMENTS[prop.pigment].light;
        ctx.beginPath(); ctx.ellipse(x + bend, top, 8, 18, 0.14, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      }
    }
  } else if (prop.kind === 'mushrooms') {
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 18, y = i === 1 ? -6 : 7, r = i === 1 ? 18 : 12;
      ctx.fillStyle = '#e2d5b4'; ctx.fillRect(x - 3, y, 6, 15);
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, -0.1, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f9efd4'; ctx.beginPath(); ctx.arc(x - 5, y - r * 0.35, 2.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 4, y - r * 0.48, 2, 0, TAU); ctx.fill();
    }
    if (painted && pulse > 0) {
      ctx.globalAlpha = pulse; ctx.strokeStyle = '#fff2c9'; ctx.fillStyle = '#fff2c9'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 19, y = -35 - (1 - pulse) * 24 - i * 6;
        ctx.beginPath(); ctx.ellipse(x, y, 4, 2.5, -0.4, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 3, y); ctx.lineTo(x + 3, y - 12); ctx.lineTo(x + 8, y - 9); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  } else if (prop.kind === 'flowers') {
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 13, y = -8 - Math.sin(i * 2 + prop.seed) * 8;
      ctx.strokeStyle = painted ? '#527a4b' : '#819078'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, 14); ctx.quadraticCurveTo(x - 5, 0, x, y); ctx.stroke();
      for (let p = 0; p < 5; p++) {
        const a = p * TAU / 5;
        ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 6, 3.7, a, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#f4dc99'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill();
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 18, y = i % 2 * 9;
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, 15, 10, i * 0.7, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#f5ead1'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y - 1, 6, Math.PI, TAU); ctx.stroke(); ctx.strokeStyle = '#64796b';
    }
  }
  // Each color leaves its own quiet life: warm fireflies, blue water rings,
  // green leaflets. The same plants can be repainted indefinitely.
  if (painted) {
    if (prop.pigment === 'blue') {
      ctx.strokeStyle = '#84c4dc'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.45;
      ctx.beginPath(); ctx.ellipse(0, 9, 29 + Math.sin(now * 2 + prop.seed) * 3, 15, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    } else for (let i = 0; i < 2; i++) {
      const a = now * 0.9 + prop.seed + i * Math.PI;
      ctx.fillStyle = prop.pigment === 'red' ? '#ffe5a0' : '#91b765';
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * 24, -14 + Math.sin(a) * 11, prop.pigment === 'red' ? 2.4 : 5, 2.3, a, 0, TAU); ctx.fill();
    }
  }
  if (pulse > 0) {
    ctx.globalAlpha = pulse; ctx.strokeStyle = painted ? color : '#f6edcf'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 2, 30 + (1 - pulse) * 22, 18 + (1 - pulse) * 12, 0, 0, TAU); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 + prop.seed, r = 28 + (1 - pulse) * 22;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r * 0.55 - 8, 2, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
