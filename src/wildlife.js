// Decorative pond life: separate seeded stream, fixed storage, no gameplay state.
import { clamp, mulberry32, TAU } from './math.js';
import { sat } from './ui.js';

export const WILDLIFE_CAP = 24;
export const WILDLIFE_REACTION_SECONDS = 3.4;
const COLORS = { red: '#c86048', blue: '#528fc4', green: '#73a35d' };

export class PondLife {
  constructor(seed, width, height, reeds = false, dark = false) {
    const rng = mulberry32((seed ^ 0x71f3a9) >>> 0);
    this.time = 0;
    this.reeds = reeds;
    this.dark = dark;
    this.creatures = [];
    // Pairs along the corridor: a resting dragonfly and a pond skater.
    for (let i = 0; i < WILDLIFE_CAP; i++) {
      const x = 250 + Math.floor(i / 2) * (width - 500) / 12 + rng() * 100;
      const y = height * 0.5 + (i % 2 ? 125 : -135) + (rng() - 0.5) * 100;
      this.creatures.push({ homeX: x, homeY: y, x, y, phase: rng() * TAU,
        skater: i % 2 === 1, reaction: 0, color: '', targetX: x, targetY: y });
    }
  }

  paint(x, y, pigment) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Object.hasOwn(COLORS, pigment)) return;
    for (const f of this.creatures) {
      // A swipe has several splats; don't pin the ripple to its first frame.
      if (f.reaction > WILDLIFE_REACTION_SECONDS - 0.7 || Math.hypot(f.x - x, f.y - y) > 150) continue;
      f.color = COLORS[pigment];
      f.reaction = WILDLIFE_REACTION_SECONDS;
      f.targetX = clamp(x, f.homeX - 85, f.homeX + 85);
      f.targetY = clamp(y, f.homeY - 65, f.homeY + 65);
    }
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.time = (this.time + dt) % (TAU * 4000);
    for (const f of this.creatures) {
      f.reaction = Math.max(0, f.reaction - dt);
      const age = WILDLIFE_REACTION_SECONDS - f.reaction;
      const curiosity = f.reaction > 0 ? Math.min(1, age * 2, f.reaction) : 0;
      const phase = this.time * (f.skater ? 0.55 : 0.8) + f.phase;
      const drift = f.skater ? 16 : 28;
      f.x = f.homeX + Math.sin(phase) * drift * (1 - curiosity * 0.6)
        + (f.targetX - f.homeX) * curiosity;
      f.y = f.homeY + Math.cos(phase * 0.75) * drift * 0.4
        + (f.targetY - f.homeY) * curiosity;
      if (f.reaction === 0) f.color = '';
    }
  }

  draw(ctx, view, colorSat, px, py) {
    const left = view.x - 65, right = view.x + view.w / view.scale + 65;
    const top = view.y - 65, bottom = view.y + view.h / view.scale + 65;
    let drawn = 0;
    for (const f of this.creatures) {
      if (f.x < left || f.x > right || f.y < top || f.y > bottom) continue;
      let x = f.x, y = f.y;
      // Soft visual sidestep; drawing never changes simulation or wildlife state.
      if (Number.isFinite(px) && Number.isFinite(py)) {
        const dx = x - px, dy = y - py, d = Math.hypot(dx, dy);
        if (d < 85) {
          const shy = (1 - d / 85) * 24;
          x += (d > 0.01 ? dx / d : Math.cos(f.phase)) * shy;
          y += (d > 0.01 ? dy / d : Math.sin(f.phase)) * shy;
        }
      }
      ctx.save(); ctx.translate(x, y);
      const body = sat(f.color || (this.dark ? '#b8b4d1' : this.reeds ? '#9bc8b9' : '#456e68'), colorSat);
      if (f.reaction > 0) {
        const t = 1 - f.reaction / WILDLIFE_REACTION_SECONDS;
        ctx.globalAlpha = Math.sin(t * Math.PI) * 0.45;
        ctx.strokeStyle = body; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.ellipse(0, 8, 8 + t * 30, 3 + t * 11, 0, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 0.72;
      ctx.strokeStyle = body; ctx.fillStyle = body;
      ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      if (f.skater) {
        for (let i = -1; i <= 1; i++) {
          const spread = 9 + (i === 0 ? 3 : 0);
          ctx.beginPath(); ctx.moveTo(-spread, i * 6 + 3); ctx.lineTo(0, i * 3);
          ctx.lineTo(spread, i * 6 + 3); ctx.stroke();
        }
        ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 6, -0.15, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.2; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 6, 17, 5, 0, 0, TAU); ctx.stroke();
      } else {
        // Slow opening wings, no high-frequency flashes or glow effects.
        const wings = 0.6 + 0.4 * Math.sin(this.time * 2.2 + f.phase) ** 2;
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = this.reeds ? '#d6e8d9' : '#dce6ce';
        for (let side = -1; side <= 1; side += 2) {
          ctx.beginPath(); ctx.ellipse(side * 8, -3, 10, 3 * wings, side * -0.24, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.ellipse(side * 6, 2, 8, 2.7 * wings, side * 0.22, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = body; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(1, 13); ctx.stroke();
        ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, -6, 3, 0, TAU); ctx.fill();
      }
      ctx.restore();
      drawn++;
    }
    return drawn;
  }
}
