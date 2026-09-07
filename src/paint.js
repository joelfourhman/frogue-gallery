// paint.js — the magical paintbrush: swipes, charged splashes, pigment trails.
// Painting is combat AND environmental interaction: every swipe writes to the
// world paint layer and applies pigment damage + statuses to anything it touches.
'use strict';
import { TAU, clamp, dist } from './math.js';
import { PIGMENTS, paintDamage, paintStatusFor, stepStatus, paintBoss, frontDeflectFactor, cragSleepBonus } from './logic.js';

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
    // J1 (v1.4): short-lived "wet" residue marks left on surfaces. Draw-only
    // (never read by logic/save), capped so the pool can't grow unbounded.
    this.wet = [];
    this.MAX_WET = 120;
  }

  // J1: drop a capped set of wet marks. Oldest are pushed out past the cap so
  // the array length is always <= MAX_WET (no unbounded allocation).
  _addWet(x, y, r, pig, life) {
    this.wet.push({ x, y, r, t: life, max: life, pig, seed: Math.random() * 100 });
    if (this.wet.length > this.MAX_WET) this.wet.shift();
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
    // J1: decay the short-lived wet marks (they linger a moment then vanish)
    for (let i = this.wet.length - 1; i >= 0; i--) {
      this.wet[i].t -= dt;
      if (this.wet[i].t <= 0) this.wet.splice(i, 1);
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
    // v1.4 color rework (Joel): the dry brush is the WORLD-RESTORER — it
    // recovers swamp color the most of any stroke (it is "cleaning," not
    // staining), so a dry swipe restores more than a pigment swipe.
    this._restoreAcc = (this._restoreAcc || 0) + (pig === 'dry' ? 0.010 : 0.009);

    // write the stroke into the world paint layer (environmental residue)
    this.world.paintSwipe(p.x, p.y, a, R, pig);
    // visual ribbon — J1: a tapered wet-stroke swipe that lingers ~0.4s (up
    // from 0.28s) so the brush stroke reads as wet before it dries.
    const TR = 0.4;
    this.trails.push({
      x0: p.x + Math.cos(a) * p.r, y0: p.y + Math.sin(a) * p.r,
      x1: p.x + Math.cos(a) * R, y1: p.y + Math.sin(a) * R,
      w: 16, t: TR, max: TR, pig, seed: Math.random() * 100,
    });
    // J1: a couple of short-lived wet marks left on the surface the stroke
    // passed over (draw-only residue). Capped by _addWet.
    const mx = p.x + Math.cos(a) * R * 0.6, my = p.y + Math.sin(a) * R * 0.6;
    this._addWet(mx, my, 9 + Math.random() * 6, pig, 0.9 + Math.random() * 0.5);
    this._addWet(p.x + Math.cos(a) * R * 0.9, p.y + Math.sin(a) * R * 0.9, 6 + Math.random() * 4, pig, 0.7 + Math.random() * 0.4);
    // S3 (v1.4): a pigment-colored swipe voice (wet "shh" + a per-pigment
    // signature) replaces the plain generic swish.
    this.sfx('paint-swipe', { pig });

    // fan-shaped hit test
    const arc = this.tuning.swipeArc;
    const hits = [];
    for (const e of enemies) {
      if (e.dead) continue;
      // R3 (v1.6 Module R): the MUD SERPENT is invisible + UNHITTABLE while
      // burrowed / recovering (under the water line). It is paintable while
      // telegraphing or surfaced (the counterplay is a painted-ring interrupt
      // before it surfaces; see the game's _bestiarySwipe).
      if (e.burrower && (e.phase === 'burrowed' || e.phase === 'recover')) continue;
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
    // v1.4: dry splash is the strongest single world-restore action.
    this._restoreAcc = (this._restoreAcc || 0) + (pig === 'dry' ? 0.04 : 0.025);
    this.world.paintSplash(p.x, p.y, R, pig);
    // S3 (v1.4): a pigment-colored splash voice (wet "splat" + a per-pigment
    // signature) replaces the plain generic splat.
    this.sfx('paint-splat', { pig, big: 1 });
    // R3 (v1.6 Module R): the serpent is unhittable while burrowed/recovering
    // (see trySwipe) — a blue splash that blinds a wisp still counts, but the
    // serpent stays planted under the water line.
    const hits = enemies.filter(e => !e.dead
      && !(e.burrower && (e.phase === 'burrowed' || e.phase === 'recover'))
      && dist(p.x, p.y, e.x, e.y) <= R + e.r);
    this._applyHits(hits, pig, 'splash');
    // cosmetic ring
    this.trails.push({ ring: true, x: p.x, y: p.y, r: R, t: 0.35, max: 0.35, pig });
    // J1: a wet splash leaves a ring of short-lived marks around the frog
    for (let s = 0; s < 5; s++) {
      const aa = Math.random() * TAU;
      const rr = R * (0.4 + Math.random() * 0.55);
      this._addWet(p.x + Math.cos(aa) * rr, p.y + Math.sin(aa) * rr, 7 + Math.random() * 7, pig, 0.9 + Math.random() * 0.5);
    }
    return hits;
  }

  _applyHits(hits, pig, kind) {
    const base = kind === 'swipe' ? this.tuning.swipeDamage : this.tuning.splashDamage;
    const p = this.player;
    // S3 (v1.4): fire each status blip at most ONCE per action (a big splash
    // hitting many enemies should not be a blip machine-gun). Maps a status
    // type to its tiny sting.
    const fired = {};
    const blip = { burn: 'burn-ignite', freeze: 'freeze-tick', root: 'root-thud' };
    for (const e of hits) {
      // K1 (v1.5 M1) front-arc SHELL deflection (the Mud Turtle). The factor is
      // computed from the player position; side/back paint deals full damage
      // and RED BURN bypasses it entirely (it never routes through a paint
      // hit — it is applied per status-tick).
      const deflect = frontDeflectFactor(e, p);
      // K2 (v1.5 M2): an ASLEEP cragfrog is vulnerable — ×1.5 paint damage.
      const sleepBonus = cragSleepBonus(e);
      const dmg = paintDamage(base, pig, this.tuning, {
        enemy: e, deflectFactor: deflect, sleepBonus,
      });
      e.hp -= dmg;
      // floating damage number (pigment-colored); a deflected hit says "shell!"
      if (deflect < 1) {
        this.note(e.x, e.y - e.r - 18, 'shell', pig);
      } else {
        this.note(e.x, e.y - e.r - 18, '-' + Math.round(dmg), pig);
      }
      // v1.4 color rework (Joel): the dry brush CLEANS — scrubbing off the
      // enemy's active status (burn/slow/freeze/root). Dizzy is a toad quirk,
      // not a stain, so it's left alone.
      if (pig === 'dry') {
        if (e.status && e.status.type !== 'dizzy') {
          e.status = null; e.burnAccum = 0;
          this.note(e.x, e.y - e.r - 6, 'cleanse', 'dry');
          // S3: the scrub-whoosh, once per action.
          if (!fired.cleanse) { fired.cleanse = true; this.sfx('cleanse'); }
        }
      // toad special: any non-dry paint can dizzy instead of the normal status
      } else if (e.dizzyPaintChance && Math.random() < e.dizzyPaintChance) {
        e.status = { type: 'dizzy', t: e.dizzyDuration || 1.2, appliedAt: e._now || 0 };
        this.note(e.x, e.y - e.r - 6, 'dizzy!', 'green');
      } else {
        const res = paintStatusFor(pig, e, e._now || 0);
        if (res.status) {
          e.status = res.status;
          if (res.note && res.note !== 'immune-root') this.note(e.x, e.y - e.r - 6, res.note, pig);
          // S3: a tiny "it just happened" blip for the status that landed,
          // once per action (slow is folded into the freeze blip; only
          // burn/freeze/root get their own sting).
          const st = res.status.type;
          const stKey = st === 'slow' ? 'freeze' : st;
          if (blip[stKey] && !fired[stKey]) { fired[stKey] = true; this.sfx(blip[stKey]); }
        }
      }
      // enemy gets coated with the pigment color (visual reaction)
      e.tint = pig; e.tintT = 0.6;
      // droplet splatter off the enemy
      this.particles.splatter(e.x, e.y, PIGMENTS[pig].color, 6, 160);
      if (e.hp <= 0 && !e.dead) e.onDeath && e.onDeath();
    }
    // v1.4 color rework (Joel): painting enemies with GREEN heals the frog a
    // little — the heal is per ACTION (not per enemy) so a big green splash
    // is not a free medkit. The float is drained by player.update.
    // K4 (v1.5 M2): the GILDED Heron's plume (p._plumeSuppress) ABSORBS this
    // heal while it is live — both green heal sources (paint-on-green AND
    // standing-in-green) drop to 0 during the plume. No-op otherwise.
    if (pig === 'green' && hits.length && p.hp < p.maxHp && !p._plumeSuppress) {
      p._healAcc = (p._healAcc || 0) + (this.tuning.greenHealOnPaint || 0.5);
      this.note(p.x, p.y - p.r - 14, 'heal', 'green');
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
    if (res && pig !== 'dry') {
      let d = paintDamage(this.tuning.swipeDamage, pig, this.tuning, { enemy: heron });
      if (heron.awakened) d *= 2;
      this.note(heron.x, heron.y - 150, '-' + Math.round(d), pig);
    }
    return res;
  }

  _bossPaint(h, pig, amount) {
    // direct paint damage while painting the boss
    let dmg = paintDamage(this.tuning.swipeDamage, pig, this.tuning, { enemy: h });
    if (h.awakened) dmg *= 2; // the shimmer window: double paint damage (see bossStep)
    // N3 (v1.3 M14): the Great Green Heron's reed-pin vulnerable window — while
    // pinned (held in place by the player's Moss paint) it takes 2x paint damage,
    // mirroring the awaken window. The gray heron never carries `pinned`, so this
    // is a no-op for the first-time run.
    if (h.pinned > 0) dmg *= 2;
    h.hp -= dmg;
    const res = paintBoss(h, pig, amount, this.tuning);
    if (res === 'awaken') return 'awaken';
    return 1;
  }

  // (logic.js paintBoss imported at module level to keep this stateless)
  note(x, y, text, pig) {
    if (this.hitNotes.length > 24) return;
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

  // J1 (v1.4): draw the short-lived wet residue marks. Soft, low-alpha blobs
  // (watercolor "wet" look) that fade as they dry. Draw-only — these never
  // influence combat, save data, or pacing; they only linger a moment.
  drawWet(ctx) {
    if (!this.wet.length) return;
    for (const m of this.wet) {
      const k = Math.max(0, m.t / m.max);
      const col = PIGMENTS[m.pig];
      const r = m.r * (0.8 + 0.4 * k); // dries down slightly as it fades
      ctx.globalAlpha = k * 0.42;
      ctx.fillStyle = col.color;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, r, r * 0.72, m.seed, 0, TAU);
      ctx.fill();
      // a lighter wet sheen at the center
      ctx.globalAlpha = k * 0.28;
      ctx.fillStyle = col.light;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, r * 0.55, r * 0.4, m.seed, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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