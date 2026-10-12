// Living field studies, a bounded brush wake, and the player's own sketchbook.
// Rule data/validation lives in logic.js. This module has no network or assets.
import { FIELD_STUDIES, STUDIO, PIGMENTS, PIGMENT_ORDER, studyNode, paintStudy, brushWakeStatus, normalizeStudio, fileSketch, studiesForBiome, studyRewardEarned } from './logic.js';
import { SaveSys } from './save.js';
import { clamp, TAU } from './math.js';
import { INK, uiButton, centerText, uiFont, paperPanel, paperEnd } from './ui.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pigmentKey = p => PIGMENT_ORDER.indexOf(p) + 1;

export class FieldStudio {
  constructor(game) {
    this.game = game;
    game.save.studio = normalizeStudio(game.save.studio);
    this.studies = studiesForBiome(game.runBiome, { challenge: !!game.challenge, wander: !!game.options.wander })
      .map(s => ({ ...s, step: 0, coats: 0, bloom: 0 }));
    this.strokes = []; this.seen = 0; this.wakes = []; this.hopId = 0; this.wakeT = 0;
    this.id = `${game.runSeed}-${game.save.stats.expeditions}`;
  }

  get unlocked() { return !this.game.challenge && this.game.save.studio.completed.length > 0; }
  sheltered() {
    const g = this.game, first = this.studies[0];
    return !!(first && first.step < 3 && !this.unlocked && g.player && distance(g.player, first) < 205);
  }

  record(stroke) {
    const g = this.game;
    const endX = stroke.x + Math.cos(stroke.a) * stroke.range;
    const endY = stroke.y + Math.sin(stroke.a) * stroke.range;
    const q = (v, size) => Math.round(clamp(v / size, 0, 1) * 1000);
    const s = [q(stroke.x, g.world.w), q(stroke.y, g.world.h), q(endX, g.world.w), q(endY, g.world.h), PIGMENT_ORDER.indexOf(stroke.pigment), stroke.kind === 'splash' ? 24 : stroke.kind === 'hop' ? 12 : 8];
    this.seen++;
    // Deterministic reservoir: a long expedition keeps strokes from the whole
    // journey, rather than retaining only its last few seconds. No global RNG.
    if (this.strokes.length < STUDIO.strokeCap) this.strokes.push(s);
    else {
      const hash = Math.imul(this.seen, 2654435761) >>> 0;
      const slot = hash % this.seen;
      if (slot < STUDIO.strokeCap) this.strokes[slot] = s;
    }
  }

  onStroke(stroke) {
    const g = this.game;
    if (g._tutorialActive()) return;
    this.record(stroke);
    for (const study of this.studies) {
      const before = study.step;
      if (!paintStudy(study, stroke)) continue;
      const node = studyNode(study, before);
      g.particles.splatter(node.x, node.y, PIGMENTS[stroke.pigment].color, 5, 50);
      if (study.step !== before) {
        g.sfx('pickup-streak');
        study.bloom = 1;
      }
      if (study.step === 3) {
        const wasUnlocked = this.unlocked;
        if (!g.save.studio.completed.includes(study.id)) g.save.studio.completed.push(study.id);
        g.player.hp = g.player.maxHp;
        g.player.iframes = Math.max(g.player.iframes, 1.5);
        g._triggerBloom(study.x, study.y);
        g.sfx('awaken-bloom');
        g.addBanner(study.name + ' comes alive. A page is saved in your sketchbook.', 4.2, 186);
        if (!wasUnlocked) g.addBanner('Brush-hop learned! Hold paint + Space to leave a colored wake.', 5.5, 224);
        else {
          // Q3: a reward-group banner fires EXACTLY once — on the completion
          // that first satisfies the group. `before` is the completed list
          // minus the study that just finished, so later studies in another
          // biome can never re-announce an already-earned group.
          const before = g.save.studio.completed.filter(id => id !== study.id);
          if (studyRewardEarned(g.save.studio.completed, 'swamp') && !studyRewardEarned(before, 'swamp')) g.addBanner('Three field studies — your signature now wears a golden lily.', 4.5, 224);
          else if (studyRewardEarned(g.save.studio.completed, 'reeds') && !studyRewardEarned(before, 'reeds')) g.addBanner('The Reeds remember you — your postcards now wear a woven reed border.', 4.5, 224);
        }
        this.archive('study', study.name);
      }
      break;
    }
  }

  update(dt) {
    const g = this.game, p = g.player;
    for (const study of this.studies) study.bloom = Math.max(0, study.bloom - dt * 0.5);
    for (const wake of this.wakes) wake.t -= dt;
    this.wakes = this.wakes.filter(w => w.t > 0);
    if (this.sheltered()) p.iframes = Math.max(p.iframes, 0.08);
    if (g._hopStart) { this.hopId++; this.wakeT = 0; }
    this.wakeT -= dt;
    if (this.unlocked && p.hopT > 0 && g.input.mouse.lDown && p.pigment !== 'dry' && this.wakeT <= 0) {
      this.wakeT = 0.045;
      const wake = { x: p.x, y: p.y, pigment: p.pigment, t: STUDIO.wakeLife, id: this.hopId };
      this.wakes.push(wake);
      if (this.wakes.length > STUDIO.wakeCap) this.wakes.shift();
      g.world.splat(p.x, p.y, p.pigment, 12, true);
      this.record({ x: p.x, y: p.y, a: p.aimA, range: 24, pigment: p.pigment, kind: 'hop' });
    }
    for (const enemy of g.enemies) {
      if (enemy.dead || enemy.burrower || enemy.clinging || enemy._practice) continue;
      for (const wake of this.wakes) {
        if (enemy._wakeHit === wake.id || distance(enemy, wake) > enemy.r + STUDIO.wakeRadius) continue;
        const status = brushWakeStatus(wake.pigment, enemy);
        if (!status) continue;
        enemy._wakeHit = wake.id;
        // Never shorten an existing stronger freeze/root/burn.
        if (!enemy.status || enemy.status.t < status.t) enemy.status = status;
        if (enemy.kind === 'mosquito') { enemy.flight = 'recover'; enemy.flightT = 0.85; }
        enemy.tint = PIGMENTS[wake.pigment].color; enemy.tintT = 0.5;
        break;
      }
    }
  }

  archive(result, title) {
    const g = this.game;
    const studies = this.studies.filter(s => s.step === 3).map(s => s.id);
    const lastStudy = FIELD_STUDIES.find(s => s.id === studies[studies.length - 1]);
    const page = { id: this.id, title: title || (result === 'victory' ? 'The day the swamp woke' : lastStudy ? lastStudy.name + ' · field notes' : 'A little color, left behind'), seed: g.runSeed,
      biome: g.runBiome, result, seconds: g.runT, studies, strokes: this.strokes };
    if (fileSketch(g.save, page)) SaveSys.save(g.save);
  }

  draw(ctx, view, now) {
    for (const wake of this.wakes) {
      ctx.save(); ctx.globalAlpha = 0.3 * wake.t / STUDIO.wakeLife;
      ctx.fillStyle = PIGMENTS[wake.pigment].color;
      ctx.beginPath(); ctx.ellipse(wake.x, wake.y, STUDIO.wakeRadius, STUDIO.wakeRadius * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    for (const s of this.studies) {
      if (s.x < view.x - 180 || s.x > view.x + view.w / view.scale + 180 || s.y < view.y - 160 || s.y > view.y + view.h / view.scale + 160) continue;
      ctx.save(); ctx.translate(s.x, s.y);
      drawLivingStudy(ctx, s, now);
      centerText(ctx, s.name, 0, -112, uiFont(18, { italic: true }), '#304b45');
      const nearby = distance(this.game.player, s) < 280;
      if (s.step < 3) {
        for (let i = 0; i < 3; i++) {
          const node = studyNode(s, i), x = node.x - s.x, y = node.y - s.y;
          ctx.globalAlpha = i === s.step ? 1 : i < s.step ? 0.7 : 0.24;
          ctx.fillStyle = i < s.step ? PIGMENTS[s.colors[i]].color : '#faf0d8';
          ctx.strokeStyle = PIGMENTS[s.colors[i]].color; ctx.lineWidth = i === s.step ? 3 : 1.5;
          ctx.beginPath(); ctx.arc(x, y, 19, 0, TAU); ctx.fill(); ctx.stroke();
          centerText(ctx, i < s.step ? '✓' : String(pigmentKey(s.colors[i])), x, y + 5, uiFont(16, { weight: 700 }), INK);
          if (i === s.step) {
            ctx.beginPath(); ctx.arc(x, y, 24, -Math.PI / 2, -Math.PI / 2 + TAU * s.coats / STUDIO.coats); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        if (nearby) {
          centerText(ctx, `${pigmentKey(s.colors[s.step])} · ${s.verbs[s.step]}`, 0, 100, uiFont(16, { weight: 700 }), INK);
          centerText(ctx, 'Aim at the numbered circle and hold paint', 0, 120, uiFont(12), '#3b5651');
        }
      } else if (nearby) centerText(ctx, 'Living study · saved in Sketchbook [J]', 0, 108, uiFont(13, { italic: true }), '#304b45');
      ctx.restore();
    }
  }

  drawHint(ctx) {
    const g = this.game;
    if (g._tutorialActive() || g.help || g.paused) return;
    const first = this.studies[0];
    if (!first || first.step === 3 || g.player.x > 1000 || this.unlocked) return;
    const c = paperPanel(ctx, 370, g.ch - 62, 540, 40, { seed: 87 });
    centerText(c, this.sheltered() ? 'A quiet studio. Paint the numbered circles — take your time.' : 'A little pond is waiting to be painted. Follow the path east →', 640, g.ch - 36, uiFont(14), INK);
    paperEnd(ctx);
  }
}

// The diorama changes after each pigment, then continues living in the world.
export function drawLivingStudy(ctx, s, now) {
  const colors = s.colors.slice(0, s.step);
  const blue = colors.includes('blue'), green = colors.includes('green'), red = colors.includes('red');
  ctx.fillStyle = '#d4d6b8'; ctx.strokeStyle = '#71806a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 0, 140, 82, -0.06, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = blue ? '#659dba' : '#a4aea4';
  ctx.beginPath(); ctx.ellipse(0, 10, 116, 55, 0, 0, TAU); ctx.fill();
  if (blue) for (let i = 0; i < 7; i++) {
    ctx.strokeStyle = '#c4ded7'; ctx.globalAlpha = 0.35;
    const x = Math.sin(i * 4.3) * 80, y = Math.cos(i * 3.2) * 34;
    ctx.beginPath(); ctx.ellipse(x, y + 10, 8 + ((now * 8 + i * 3) % 14), 3, 0, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (s.motif === 'lantern') {
    // Q2: The Lantern Garden — stems (green) lean up out of the dark water,
    // blue strings dew-lights that glow between them, and red wakes the moths
    // that orbit the glow. Bounded: 6 stems + 6 dew + 8 moths, no allocations.
    ctx.strokeStyle = green ? '#4e7d52' : '#5c6156'; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const x = -90 + i * 36, top = -58 + Math.sin(i * 2.3) * 10, sway = Math.sin(now * 0.8 + i) * 6;
      ctx.beginPath(); ctx.moveTo(x, 30); ctx.quadraticCurveTo(x - 10, (30 + top) / 2, x + sway, top); ctx.stroke();
      if (green) { ctx.fillStyle = '#5b8952'; ctx.beginPath(); ctx.ellipse(x + 5 + sway, top - 4, 9, 4, -0.5, 0, TAU); ctx.fill(); }
    }
    if (blue) for (let i = 0; i < 6; i++) {
      const x = -90 + i * 36, y = -50 + Math.sin(i * 2.3) * 10;
      ctx.fillStyle = '#bfe3f0'; ctx.globalAlpha = 0.7 + Math.sin(now * 2 + i * 1.7) * 0.3;
      ctx.beginPath(); ctx.arc(x + Math.sin(now * 0.8 + i) * 6, y + 10, 3.4, 0, TAU); ctx.fill();
    }
    if (red) for (let i = 0; i < 8; i++) {
      const a = now * 0.9 + i * 0.785, r = 46 + Math.sin(now * 1.6 + i * 2) * 22;
      const x = Math.cos(a) * r, y = -8 + Math.sin(a) * r * 0.55;
      ctx.fillStyle = '#f6e7c1'; ctx.globalAlpha = 0.5 + Math.sin(now * 3 + i) * 0.3;
      ctx.beginPath(); ctx.ellipse(x, y, 4.5, 2.6, a, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (s.motif === 'sky') {
    ctx.fillStyle = red ? '#e6aa60' : '#b8b7a3';
    ctx.beginPath(); ctx.arc(35, -30, 30, 0, TAU); ctx.fill();
    if (green) for (let i = 0; i < 6; i++) {
      const x = -90 + i * 32, y = -45 + Math.sin(now * 2 + i) * 8;
      ctx.strokeStyle = '#37655b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 8, y - 4); ctx.quadraticCurveTo(x, y + 7, x + 8, y - 4); ctx.stroke();
    }
  } else if (s.motif === 'echo') {
    // Q3: The Echo Pool — blue rings the ripples outward, red lights reflected
    // stars on the water, and green sets the water birds loose above it.
    // Bounded: 4 rings + 7 stars + 3 birds, no allocations.
    if (!blue) {
      ctx.strokeStyle = '#8a9a94'; ctx.lineWidth = 2; ctx.globalAlpha = 0.3;
      ctx.beginPath(); ctx.ellipse(0, 8, 34, 13, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (blue) for (let i = 0; i < 4; i++) {
      const r = 18 + ((now * 26 + i * 22) % 88);
      ctx.strokeStyle = '#7fb7d9'; ctx.lineWidth = 2; ctx.globalAlpha = Math.max(0.05, 0.55 - r / 160);
      ctx.beginPath(); ctx.ellipse(0, 8, r, r * 0.4, 0, 0, TAU); ctx.stroke();
    }
    if (red) for (let i = 0; i < 7; i++) {
      const x = -85 + i * 27, y = -4 + Math.sin(i * 2.7) * 16;
      ctx.fillStyle = '#f6d38a'; ctx.globalAlpha = 0.5 + Math.sin(now * 2.4 + i) * 0.35;
      ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 2, y - 1); ctx.lineTo(x + 6, y); ctx.lineTo(x + 2, y + 1); ctx.lineTo(x, y + 5); ctx.lineTo(x - 2, y + 1); ctx.lineTo(x - 6, y); ctx.lineTo(x - 2, y - 1); ctx.closePath(); ctx.fill();
    }
    if (green) for (let i = 0; i < 3; i++) {
      const x = -60 + i * 55, y = -46 + Math.sin(now * 1.8 + i * 2) * 6;
      ctx.strokeStyle = '#37655b'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.quadraticCurveTo(x - 3, y - 9, x, y - 2); ctx.quadraticCurveTo(x + 3, y - 9, x + 10, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    for (let i = 0; i < 7; i++) {
      const x = -100 + i * 31, y = Math.sin(i * 3) * 25 + 22;
      ctx.fillStyle = green ? '#5b8952' : '#959d84'; ctx.strokeStyle = '#456743';
      ctx.beginPath(); ctx.ellipse(x, y, 19, 9, Math.sin(i) * 0.4, 0, TAU); ctx.fill();
      if (green) {
        ctx.strokeStyle = '#577d49'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 9, y - 28, x + Math.sin(now + i) * 5, y - (s.motif === 'rain' ? 65 : 28)); ctx.stroke();
        ctx.fillStyle = red ? '#efba82' : '#e6dbb0'; ctx.beginPath(); ctx.ellipse(x, y - 26, 7, 4, 0, 0, TAU); ctx.fill();
      }
    }
    if (s.motif === 'rain' && blue) {
      ctx.strokeStyle = '#c3dee1'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) { const x = -100 + i * 16, y = -80 + ((now * 50 + i * 21) % 110); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 10); ctx.stroke(); }
    }
    if (red) for (let i = 0; i < 12; i++) {
      const x = Math.sin(now * 0.5 + i * 7.1) * 100, y = -40 + Math.cos(now + i * 3.7) * 35;
      ctx.fillStyle = '#f9d281'; ctx.globalAlpha = 0.5 + Math.sin(now * 2 + i) * 0.3;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  if (s.bloom > 0) { ctx.strokeStyle = '#f7edb8'; ctx.lineWidth = 3; ctx.globalAlpha = s.bloom; ctx.beginPath(); ctx.ellipse(0, 0, 140 + (1 - s.bloom) * 100, 82 + (1 - s.bloom) * 55, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
}

export function sketchbookButton(g) { return { x: 24, y: 18, w: 184, h: 34 }; }
export function bookLayout(g) {
  const x = (g.cw - 1080) / 2, y = (g.ch - 680) / 2;
  return { x, y, w: 1080, h: 680,
    prev: { x: x + 280, y: y + 610, w: 135, h: 38 }, next: { x: x + 435, y: y + 610, w: 135, h: 38 },
    export: { x: x + 595, y: y + 610, w: 215, h: 38 }, close: { x: x + 850, y: y + 610, w: 180, h: 38 },
    // Q6: the pin toggle — above the postcard's top-right corner (it acts on
    // the open page, so it is only drawn/enabled when a page exists).
    pin: { x: x + 876, y: y + 82, w: 154, h: 34 }
  };
}

export function drawPostcard(ctx, page, x, y, w, h, signed = false, bordered = false, stamped = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(w / 1000, h / 600);
  ctx.fillStyle = '#efe4cb'; ctx.fillRect(0, 0, 1000, 600);
  if (bordered) {
    // Q3: the reeds border — a woven double frame + corner knots, cosmetic
    // only. Drawn first so the card content sits inside it.
    ctx.strokeStyle = '#2f6a4f'; ctx.lineWidth = 3; ctx.strokeRect(12, 12, 976, 576);
    ctx.strokeStyle = '#527552'; ctx.lineWidth = 1.5; ctx.strokeRect(18, 18, 964, 564);
    ctx.fillStyle = '#2f6a4f';
    for (const [cx, cy] of [[12, 12], [988, 12], [12, 588], [988, 588]]) {
      ctx.beginPath(); ctx.moveTo(cx, cy - 7); ctx.lineTo(cx + 7, cy); ctx.lineTo(cx, cy + 7); ctx.lineTo(cx - 7, cy); ctx.closePath(); ctx.fill();
    }
  }
  const reeds = page.biome !== 'swamp';
  ctx.fillStyle = reeds ? '#567477' : '#b3c7ad'; ctx.fillRect(24, 24, 952, 482);
  ctx.save(); ctx.beginPath(); ctx.rect(24, 24, 952, 482); ctx.clip();
  // A simple landscape under the player's real, spatially preserved marks.
  ctx.fillStyle = reeds ? '#344e60' : '#7da5b0';
  ctx.beginPath(); ctx.moveTo(0, 300); ctx.bezierCurveTo(270, 90, 540, 470, 1000, 180); ctx.lineTo(1000, 440); ctx.bezierCurveTo(650, 550, 300, 250, 0, 480); ctx.closePath(); ctx.fill();
  // Translucent washes and ink reeds frame the player's marks. Completed
  // dioramas become illustrated memories, matching the scenes they restored.
  for (let i = 0; i < 55; i++) {
    const x = ((i * 173 + page.seed % 149) % 1000), y = 25 + (i * 97 % 475);
    ctx.globalAlpha = 0.045;
    ctx.fillStyle = ['#fbebad', '#719d86', '#468caa', '#d4dcb4'][i % 4];
    ctx.beginPath(); ctx.ellipse(x, y, 40 + i % 65, 15 + i % 32, Math.sin(i), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 22; i++) {
    const x = 35 + (i * 127 % 930), y = i % 2 ? 470 : 85;
    ctx.strokeStyle = '#527552'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 7, y - 20, x + Math.sin(i) * 9, y - 35); ctx.stroke();
    ctx.fillStyle = '#819b65'; ctx.beginPath(); ctx.ellipse(x + 5, y - 19, 12, 4, -0.6, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const memories = FIELD_STUDIES.filter(s => page.studies.includes(s.id));
  memories.forEach((s, i) => {
    ctx.save(); ctx.translate((i + 1) * 1000 / (memories.length + 1), 310 + Math.sin(i * 2) * 42);
    const scale = memories.length === 1 ? 1.65 : 1.05; ctx.scale(scale, scale);
    drawLivingStudy(ctx, { ...s, step: 3, bloom: 0 }, (page.seed % 50) / 10);
    ctx.restore();
  });
  const points = page.strokes;
  let minX = 1000, maxX = 0, minY = 1000, maxY = 0;
  for (const p of points) { minX = Math.min(minX, p[0], p[2]); maxX = Math.max(maxX, p[0], p[2]); minY = Math.min(minY, p[1], p[3]); maxY = Math.max(maxY, p[1], p[3]); }
  const sx = 850 / Math.max(120, maxX - minX), sy = 320 / Math.max(120, maxY - minY);
  for (let i = 0; i < points.length; i++) {
    const p = points[i], x0 = 75 + (p[0] - minX) * sx, y0 = 115 + (p[1] - minY) * sy;
    const x1 = 75 + (p[2] - minX) * sx, y1 = 115 + (p[3] - minY) * sy;
    ctx.strokeStyle = PIGMENTS[PIGMENT_ORDER[p[4]]].color; ctx.lineWidth = p[5]; ctx.lineCap = 'round'; ctx.globalAlpha = 0.45;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + Math.sin(i * 2) * 12, x1, y1); ctx.stroke();
    ctx.globalAlpha = 0.22; ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(x1 + Math.sin(i) * 8, y1 + Math.cos(i) * 8, p[5] * 0.55, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = '#766047'; ctx.lineWidth = 3; ctx.strokeRect(24, 24, 952, 482);
  if (stamped) {
    // Q5: the crossing's STAMP — a perforated postage stamp in the card's
    // top-right corner: the leafy arch (the safe crossing) over a water line,
    // with 'CROSSING' beneath. Cosmetic only; drawn after the frame so it
    // sits crisp on the card. Bounded: 2 arcs + 3 leaves + 1 line + text.
    ctx.save(); ctx.translate(852, 34);
    ctx.fillStyle = '#f6efdb'; ctx.fillRect(0, 0, 100, 118);
    ctx.strokeStyle = '#8a6f4d'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.strokeRect(4, 4, 92, 110); ctx.setLineDash([]);
    ctx.strokeStyle = '#4a6d43'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(16, 62); ctx.quadraticCurveTo(38, 26, 50, 24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(84, 62); ctx.quadraticCurveTo(62, 26, 50, 24); ctx.stroke();
    ctx.fillStyle = '#5b8952';
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.55;
      ctx.beginPath(); ctx.ellipse(50 + Math.cos(a) * 20, 38 + Math.sin(a) * 15, 8, 3.6, a + 0.5, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = '#468caa'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(24, 74); ctx.quadraticCurveTo(50, 81, 76, 74); ctx.stroke();
    ctx.font = uiFont(13, { weight: 700 }); ctx.fillStyle = '#6b5a3e'; ctx.textAlign = 'center';
    ctx.fillText('CROSSING', 50, 97);
    ctx.restore();
  }
  ctx.font = uiFont(25, { italic: true }); ctx.fillStyle = '#364d43'; ctx.textAlign = 'center'; ctx.fillText(page.title, 500, 545, 920);
  centerText(ctx, `${page.strokes.length} remembered strokes · ${page.studies.length} living ${page.studies.length === 1 ? 'study' : 'studies'} · ${page.result === 'unfinished' ? 'in progress' : page.result}`, 500, 574, uiFont(14), '#645e50');
  ctx.textAlign = 'right'; ctx.font = uiFont(16, { italic: true }); ctx.fillStyle = signed ? '#a87825' : '#53654b';
  ctx.fillText(signed ? '✦ Frogue' : 'Frogue', 950, 484);
  ctx.restore();
}

export function drawSketchbook(g, ctx) {
  const b = bookLayout(g), pages = g.save.sketchbook || [], page = pages[g._bookIndex];
  ctx.fillStyle = 'rgba(20,31,28,0.88)'; ctx.fillRect(0, 0, g.cw, g.ch);
  const c = paperPanel(ctx, b.x, b.y, b.w, b.h, { seed: 91 });
  centerText(c, 'The Field Sketchbook', g.cw / 2, b.y + 48, uiFont(31, { weight: 700 }), '#304b45');
  centerText(c, 'A painting only you could make.', g.cw / 2, b.y + 78, uiFont(16, { italic: true }), '#61705e');
  c.textAlign = 'left'; c.fillStyle = '#304b45'; c.font = uiFont(18, { weight: 700 }); c.fillText('Living studies', b.x + 34, b.y + 144);
  FIELD_STUDIES.forEach((s, i) => {
    const done = (g.save.studio?.completed || []).includes(s.id);
    const gap = FIELD_STUDIES.length > 3 ? 33 : 38;   // Q3: five rows fit the panel
    c.fillStyle = done ? '#3f7551' : '#7b796a'; c.font = uiFont(16); c.fillText((done ? '✓ ' : '○ ') + s.name, b.x + 34, b.y + 183 + i * gap);
  });
  c.font = uiFont(14); c.fillStyle = '#665f50';
  const lines = (g.save.studio?.completed.length || 0) > 0
    ? ['Brush-hop learned', 'Hold paint + Space.', 'Red burns pursuers.', 'Blue interrupts flies.', 'Green roots ground bugs.']
    : ['Find First Light near', 'the start of the swamp.', 'Paint its three circles', 'to learn the brush-hop.'];
  lines.forEach((line, i) => c.fillText(line, b.x + 34, b.y + 350 + i * 25));
  const pinned = !!page && (g.save.sketchPins || []).includes(page.id);
  if (page) {
    drawPostcard(c, page, b.x + 270, b.y + 125, 760, 456, studyRewardEarned(g.save.studio?.completed || [], 'swamp'), studyRewardEarned(g.save.studio?.completed || [], 'reeds'), !!(g.save.flags && g.save.flags.crossingPainted));
    // Q6: a pinned page gets a little brass pin stuck into the postcard's
    // top-left corner + a word in the caption — unmistakable that this page
    // will never age out of the book.
    if (pinned) {
      c.save(); c.translate(b.x + 292, b.y + 112);
      c.strokeStyle = '#a87825'; c.lineWidth = 2.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-7, 9); c.lineTo(2, -5); c.stroke();       // pin body
      c.beginPath(); c.arc(3.5, -8, 4.5, 0, TAU); c.stroke();           // pin head
      c.fillStyle = '#a87825';
      c.beginPath(); c.arc(-7, 9, 2.4, 0, TAU); c.fill();               // where it's stuck
      c.restore();
    }
    centerText(c, `Page ${g._bookIndex + 1} / ${pages.length} · latest eight expeditions kept` + (pinned ? ' · PINNED' : ''), b.x + 650, b.y + 595, uiFont(12), '#665f50');
  } else {
    centerText(c, 'Your first page is still waiting.', b.x + 660, b.y + 300, uiFont(25, { italic: true }), '#53654b');
    centerText(c, 'Paint a field study or finish an expedition to keep your strokes.', b.x + 660, b.y + 338, uiFont(15), '#665f50');
  }
  const bookBtns = [['prev', '← Previous'], ['next', 'Next →'], ['export', 'Save postcard · PNG'], ['close', 'Close · J / Esc']];
  if (page) bookBtns.push(['pin', pinned ? 'Unpin page · X' : 'Pin page · X']);   // Q6
  for (const [key, label] of bookBtns) {
    const r = b[key], disabled = key !== 'close' && (!page || (key === 'prev' && g._bookIndex === 0) || (key === 'next' && g._bookIndex >= pages.length - 1));
    uiButton(ctx, r.x, r.y, r.w, r.h, label, g._mouseIn(r.x, r.y, r.w, r.h), disabled, { seed: 92, size: 14 });
  }
  paperEnd(ctx);
}

export function exportPostcard(g) {
  const page = g.save.sketchbook?.[g._bookIndex];
  if (!page) return;
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 960;
  drawPostcard(canvas.getContext('2d'), page, 0, 0, 1600, 960, studyRewardEarned(g.save.studio?.completed || [], 'swamp'), studyRewardEarned(g.save.studio?.completed || [], 'reeds'), !!(g.save.flags && g.save.flags.crossingPainted));
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `frogue-${page.seed}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
