// paint.js — the magical paintbrush: swipes, charged splashes, pigment trails.
// Painting is combat AND environmental interaction: every swipe writes to the
// world paint layer and applies pigment damage + statuses to anything it touches.
'use strict';
import { TAU, clamp, dist } from './math.js';
import { PIGMENTS, paintDamage, paintStatusFor, stepStatus, paintBoss } from './logic.js';

export class Paint {
  constructor(player, world, tuning, sfx, particles) {
    this.player = player;
    this.world = world;
    this.tuning = tuning;
    this.sfx = sfx;
    this.particles = particles;
    this.swipeCd = 0;
    this.splashCd = 0;
    this.trails = [];   // transient stroke ribbons (visual only)
    this.hitNotes = []; // floating status notes ("burning", "frozen", ...)
  }

  get swipeRange() { return this.tuning.swipeRange; }
  // strokes since last read (game.js drains this to restore swamp color)
  get restoreAcc() { const a = this._restoreAcc; this._restoreAcc = 0; return a; }

  update(dt) {
    if (this.swipeCd > 0) this.swipeCd -= dt;
    if (this.splashCd > 0) this.splashCd -= dt;
    // decay trails
    for (let i = this.trails.length - 1; i >= 0; i--) {
      this.trails[i].t -= dt;
      if (this.trails[i].t <= 0) this.trails.splice(i, 1);
    }
    for (let i = this.hitNotes.length - 1; i >= 0; i--) {
      const n = this.hitNotes[i];
      n.t -= dt; n.y -= 14 * dt;
      if (n.t <= 0) this.hitNotes.splice(i, 1);
    }
  }

  // Called each frame while LMB is held: fire swipes at the cooldown rate.
  // enemies: array of {x,y,r,hp,maxHp,status,...} (boss handled separately).
  trySwipe(enemies) {
    const p = this.player;
    if (p.swipeT > 0 || this.swipeCd > 0) return null;
    const pig = p.pigment;
    this.swipeCd = this.tuning.swipeCooldown;
    p.swipeT = 0.14;
    const a = p.aimA;
    const R = this.swipeRange;
    this._restoreAcc = (this._restoreAcc || 0) + (pig === 'dry' ? 0.004 : 0.009);

    // write the stroke into the world paint layer (environmental residue)
    this.world.paintSwipe(p.x, p.y, a, R, pig);
    // visual ribbon
    this.trails.push({
      x0: p.x + Math.cos(a) * p.r, y0: p.y + Math.sin(a) * p.r,
      x1: p.x + Math.cos(a) * R, y1: p.y + Math.sin(a) * R,
      w: 16, t: 0.28, max: 0.28, pig, seed: Math.random() * 100,
    });
    this.sfx('swish');

    // fan-shaped hit test
    const arc = this.tuning.swipeArc;
    const hits = [];
    for (const e of enemies) {
      if (e.dead) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d > R + e.r) continue;
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      let diff = Math.abs(ang - a);
      if (diff > Math.PI) diff = TAU - diff;
      if (diff < arc / 2 + Math.asin(Math.min(1, e.r / Math.max(d, 1))) ) hits.push(e);
    }
    this._applyHits(hits, pig, 'swipe');
    return hits.length ? hits : null;
  }

  // Charged splash (RMB): AoE burst around the frog. Returns hits.
  trySplash(enemies) {
    const p = this.player;
    if (this.splashCd > 0 || p.splashCharge < 1) return null;
    this.splashCd = this.tuning.splashCooldown;
    p.splashCharge = 0;
    const R = this.tuning.splashRadius;
    const pig = p.pigment;
    this._restoreAcc = (this._restoreAcc || 0) + (pig === 'dry' ? 0.01 : 0.025);
    this.world.paintSplash(p.x, p.y, R, pig);
    this.sfx('splat', { big: 1 });
    const hits = enemies.filter(e => !e.dead && dist(p.x, p.y, e.x, e.y) <= R + e.r);
    this._applyHits(hits, pig, 'splash');
    // cosmetic ring
    this.trails.push({ ring: true, x: p.x, y: p.y, r: R, t: 0.35, max: 0.35, pig });
    return hits;
  }

  _applyHits(hits, pig, kind) {
    const base = kind === 'swipe' ? this.tuning.swipeDamage : this.tuning.splashDamage;
    const p = this.player;
    for (const e of hits) {
      const dmg = paintDamage(base, pig, this.tuning, { enemy: e });
      e.hp -= dmg;
      // toad special: any non-dry paint can dizzy instead of the normal status
      if (e.dizzyPaintChance && pig !== 'dry' && Math.random() < e.dizzyPaintChance) {
        e.status = { type: 'dizzy', t: e.dizzyDuration || 1.2, appliedAt: e._now || 0 };
        this.note(e.x, e.y - e.r - 6, 'dizzy!', 'green');
      } else {
        const res = paintStatusFor(pig, e, e._now || 0);
        if (res.status) {
          e.status = res.status;
          if (res.note && res.note !== 'immune-root') this.note(e.x, e.y - e.r - 6, res.note, pig);
        }
      }
      // enemy gets coated with the pigment color (visual reaction)
      e.tint = pig; e.tintT = 0.6;
      // droplet splatter off the enemy
      this.particles.splatter(e.x, e.y, PIGMENTS[pig].color, 6, 160);
      if (e.hp <= 0 && !e.dead) e.onDeath && e.onDeath();
    }
  }

  // Boss paint: swipes add hue toward awakening. Returns 'awaken' | hits.
  paintBossHit(heron, pig, amount) {
    const p = this.player;
    const d = dist(p.x, p.y, heron.x, heron.y - (heron.diveH || 0));
    if (d > this.swipeRange + 30) return null;
    this._bossNote = true;
    const res = (pig === 'dry') ? null : this._bossPaint(heron, pig, amount);
    if (res) this._restoreAcc = (this._restoreAcc || 0) + 0.012;
    this.particles.splatter(heron.x, heron.y - (heron.diveH || 0), PIGMENTS[pig].color, 5, 140);
    return res;
  }

  _bossPaint(h, pig, amount) {
    // direct paint damage while painting the boss
    const dmg = paintDamage(this.tuning.swipeDamage, pig, this.tuning, { enemy: h });
    h.hp -= dmg;
    const res = paintBoss(h, pig, amount, this.tuning);
    if (res === 'awaken') return 'awaken';
    return 1;
  }

  // (logic.js paintBoss imported at module level to keep this stateless)
  note(x, y, text, pig) {
    if (this.hitNotes.length > 14) return;
    this.hitNotes.push({ x, y, text, t: 0.9, max: 0.9, pig });
  }

  // ------------------------------ rendering (world space)
  drawTrails(ctx) {
    for (const t of this.trails) {
      const k = t.t / t.max;
      const col = PIGMENTS[t.pig];
      if (t.ring) {
        ctx.strokeStyle = col.color;
        ctx.globalAlpha = k * 0.8;
        ctx.lineWidth = 10 * k + 3;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * (1 - k * 0.5), 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      // tapered ribbon with a wobble — looks like a brush stroke
      const segs = 8;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let s = 0; s < segs; s++) {
        const a0 = s / segs, a1 = (s + 1) / segs;
        const wob = Math.sin(t.seed + s * 1.7) * 3;
        ctx.strokeStyle = col.color;
        ctx.globalAlpha = k * (0.5 + 0.4 * a1);
        ctx.lineWidth = (t.w * 0.35 + t.w * 0.65 * a1) * k + 1.5;
        ctx.beginPath();
        const x0 = t.x0 + (t.x1 - t.x0) * a0 + wob, y0 = t.y0 + (t.y1 - t.y0) * a0 + wob * 0.5;
        ctx.moveTo(x0, y0);
        const x1 = t.x0 + (t.x1 - t.x0) * a1 + wob, y1 = t.y0 + (t.y1 - t.y0) * a1 + wob * 0.5;
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      // bright tip
      ctx.globalAlpha = k;
      ctx.fillStyle = col.light;
      ctx.beginPath();
      ctx.arc(t.x1, t.y1, 4 * k + 1, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  drawNotes(ctx) {
    for (const n of this.hitNotes) {
      const k = n.t / n.max;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = '600 13px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(43,35,32,0.8)';
      ctx.strokeText(n.text, n.x, n.y);
      ctx.fillStyle = PIGMENTS[n.pig] ? PIGMENTS[n.pig].light : '#fff';
      ctx.fillText(n.text, n.x, n.y);
      ctx.globalAlpha = 1;
    }
  }
}