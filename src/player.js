// player.js — the tiny frog painter: movement, hop, brush aim, damage, charm.
'use strict';
import { TAU, clamp, lerp, dist, traceBlob, wobble } from './math.js';
import { INK, sat } from './ui.js';
import { PIGMENTS, hopLift, inGravityPocket, floodedWaterFactor, REEDS_POCKETS, REEDS_FLOOD_FLOOR } from './logic.js';

export class Player {
  constructor(x, y, tuning) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = 15;
    this.hp = tuning.maxHp;
    this.maxHp = tuning.maxHp;
    this.aimA = 0;
    this.facing = 1;
    this.pigment = 'red';
    this.hopT = 0;          // 0..1 while hopping
    this.hopCd = 0;         // PT3: stamina gap before the next hop (fly-fairness)
    this.hopDir = [1, 0];
    this.iframes = 0;
    this.hurtT = 0;         // red flash timer
    this.squash = 1;        // squash-and-stretch scale (x; y = 2 - squash)
    this._hopLanded = false; // J4: one-shot flag — true the frame a hop lands (consumed by game.js to fire dust puff + ripple + boing)
    this.swipeT = 0;         // brush swing animation timer
    this.slowT = 0;          // E3: slowed (mud pool)
    this.rootT = 0;          // E3: rooted (thorn reed) — cannot move
    this.splashCharge = 0;
    this.alive = true;
    this._blinkT = 1.5 + Math.random() * 3;
    // R3 (v1.6): the SILT LEECH cling. `leechAttached` is true while a leech is
    // clung (movement slowed 25% — see speedFactor); the game flips it on
    // contact / on paint-off / on hop-off. `leechCd` is the shared re-attach
    // window (seconds, ~6) — while > 0 no leech can latch again.
    this.leechAttached = false;
    this.leechCd = 0;
  }

  get speed() { return 230; }

  // E3: movement speed factor from environmental hazard states (1 = free).
  // Root (thorn reed) is hard: it zeros speed in update; slow (mud pool) eases
  // back. Pure enough to read headless.
  speedFactor() {
    let f = 1;
    if (this.rootT > 0) f = 0;
    else if (this.slowT > 0) f = 0.55;
    return f;
  }

  // R3 (v1.6): the leech's STRANGLE — while a leech is clung, ground movement is
  // reduced 25% (a pure 0.75 factor). Read by update() only when a leech is
  // attached (Reeds), so a cycle-0 swamp run is byte-identical.
  leechFactor() { return this.leechAttached ? 0.75 : 1; }

  update(dt, input, tuning, world, view) {
    const mv = input.moveVec();
    const moving = !!(mv[0] || mv[1]);
    this.aimA = Math.atan2(input.mouse.worldY - this.y, input.mouse.worldX - this.x);
    this.facing = Math.cos(this.aimA) >= 0 ? 1 : -1;

    // hop / dodge (Space). PT3 (M7.5 fly-fairness): gated on a stamina cooldown
    // (hopCd) so mashing Space no longer chains into near-continuous i-frames.
    if (input.pressed(' ') && this.hopT <= 0 && this.hopCd <= 0 && this.alive) {
      let [hx, hy] = mv;
      if (!hx && !hy) { hx = Math.cos(this.aimA); hy = Math.sin(this.aimA); }
      this.hopDir = [hx, hy];
      this.hopT = 0.22;
      this.hopCd = tuning.hopCooldown || 0.7;
      this.iframes = Math.max(this.iframes, tuning.hopIframes + 0.12);
      // J4: stretch on hop START (x0.85 / y1.15) — the body elongates as it
      // lifts off. Draw-only (the draw pass reads this.squash as the x scale,
      // y = 2 - squash); physics is untouched.
      this.squash = 0.85;
    }
    // J4: landing detection — a hop "lands" the frame hopT crosses from >0 to
    // <= 0 (checked AFTER the decrement). Set the one-shot flag (game.js fires
    // the dust puff + ripple + boing) and SQUASH the body (x1.2 / y0.8).
    // Draw-only.
    if (this.hopT > 0) {
      this.hopT -= dt;
      if (this.hopT <= 0) { this._hopLanded = true; this.squash = 1.2; }
    }
    if (this.hopCd > 0) this.hopCd -= dt;
    // R3 (v1.6): tick the shared leech re-attach window (a second leech cannot
    // latch while > 0). Reeds-only (a cycle-0 player never has a leech attached).
    if (this.leechCd > 0) this.leechCd -= dt;

    // movement: base speed, boosted mid-hop; E3 slow/root modifiers
    let spd = this.speed;
    if (this.hopT > 0.04) spd *= 2.6;
    spd *= this.speedFactor();
    // R3 (v1.6): a clinging leech STRANGLES the frog — movement reduced 25%
    // (the pure leechFactor, 0.75 while clung). Reeds-only; byte-identical
    // otherwise (a cycle-0 player never has a leech attached).
    if (this.leechAttached) spd *= this.leechFactor();
    // R2 (v1.6): the Reeds FLOODED LOWER BANKS — moving through the open dark
    // water (low elevation) slows ground movement. A pure factor from
    // logic.js (1.0 outside a flood band, 0.72 inside). Gated by the world
    // variant so a cycle-0 swamp run's movement is byte-identical.
    // G1 (v1.8): a BLACK REEDS run threads the world's OWN deeper/faster flood
    // band (world.reedsWater — REEDS_DARK_FLOOD_FLOOR / _FACTOR); a cycle-0
    // Reeds run (world.reedsWater.floor === REEDS_FLOOD_FLOOR) reads the SAME
    // band as before (byte-identical). A base swamp (reedsVariant false) never
    // enters here.
    if (world && world.reedsVariant) {
      const rw = world.reedsWater || { floor: REEDS_FLOOD_FLOOR };
      spd *= floodedWaterFactor(this.x, this.y, rw.floor, rw.factor);
      // G1: cache the variant pocket list for the cosmetic hop sign-flip in
      // draw() (which has no world param). Reeds run = its pockets; otherwise
      // null (a base swamp's hop uses the default REEDS_POCKETS = no-op).
      this._reedsPockets = world.reedsPockets || null;
    }
    if (this.rootT > 0) spd = 0;
    this.vx = lerp(this.vx, mv[0] * spd, 1 - Math.exp(-14 * dt));
    this.vy = lerp(this.vy, mv[1] * spd, 1 - Math.exp(-14 * dt));
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const [cx, cy] = world.collideCircle(this.x, this.y, this.r);
    this.x = cx; this.y = cy;

    // timers
    if (this.iframes > 0) this.iframes -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.swipeT > 0) this.swipeT -= dt;
    if (this.slowT > 0) this.slowT -= dt;
    if (this.rootT > 0) this.rootT -= dt;
    // squash relaxes toward 1
    this.squash = lerp(this.squash, 1, 1 - Math.exp(-10 * dt));
    this._blinkT -= dt;
    if (this._blinkT < -0.12) this._blinkT = 1.5 + Math.random() * 3;

    // fresh-paint residual: standing in green paint heals slowly.
    // K4 (v1.5 M2): the GILDED Heron's plume (p._plumeSuppress) DEVOURS this heal
    // while it is live — the frog must heal in the plume's cooldown gap. No-op
    // for the gray/green herons (flag is false), so first-time runs heal
    // byte-identically.
    const cell = world.pigmentAt(this.x, this.y);
    if (!this._plumeSuppress && cell.green > 0.4 && this.hp < this.maxHp) this._healAcc = (this._healAcc || 0) + dt * (tuning.greenHeal);
    else this._healAcc = (this._healAcc || 0) - dt * 2;
    if (this._healAcc >= 1) { this._healAcc = 0; this.hp = Math.min(this.maxHp, this.hp + 1); }
    return this;
  }

  hurt(dmg, tuning, drain = false) {
    // R3 (v1.6): a leech DRAIN tick (drain=true) bypasses i-frames and does no
    // hit-flash/iframes — it is a continuous small HP loss while the leech
    // clings (like burn ticking), not a discrete contact hit. Default (drain
    // false) is the normal contact/strike path — byte-identical.
    if (!this.alive || (!drain && this.iframes > 0)) return false;
    this.hp -= Math.max(1, Math.round(dmg));
    if (drain) {
      if (this.hp <= 0) { this.hp = 0; this.alive = false; }
      return true;
    }
    this.iframes = tuning.iframes;
    this.hurtT = 0.35;
    this.squash = 0.7;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return true;
  }

  // ---------------------------- rendering
  draw(ctx, view, now) {
    // R2 (v1.6): the hop lift is now a PURE function of (hopT, x, y) — inside an
    // inverted-gravity pocket the sign flips (the hop becomes a downward "clump"
    // that rides the ceiling); the pure hopLift reverts to the normal upward
    // lift outside a pocket, so there is no stuck state on exit. Outside the
    // Reeds biome (no pockets at a given x,y) this is byte-identical to the
    // pre-R2 expression.
    // G1 (v1.8): a BLACK REEDS run flips the hop sign in its OWN (extra) pocket
    // list (cached on the player by update() as _reedsPockets = the world's
    // reedsPockets). A base swamp / cycle-0 Reeds run uses the DEFAULT
    // REEDS_POCKETS (byte-identical — the first 3 of REEDS_DARK_POCKETS are
    // identical, and a base swamp is never inside any pocket).
    const lift = hopLift(this.hopT, this.x, this.y, this._reedsPockets || REEDS_POCKETS);
    const y = this.y - lift;
    const blink = this._blinkT < 0 ? 0.15 : 1;
    const hurt = this.hurtT > 0 ? Math.sin(this.hurtT * 40) * 0.5 + 0.5 : 0;
    const bodyCol = hurt > 0.5 ? '#e08a76' : '#69a24e';

    ctx.save();
    ctx.translate(this.x, this.y);

    // shadow (grows smaller when hopping)
    ctx.fillStyle = 'rgba(30,50,40,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, this.r * 0.75, this.r * (1 - lift * 0.015), this.r * 0.4 * (1 - lift * 0.02), 0, 0, TAU);
    ctx.fill();

    ctx.rotate((this.vx - this.vy) * 0.0006);
    ctx.scale(this.squash, 2 - this.squash);
    if (this.iframes > 0 && this.hopT <= 0 && Math.floor(now * 24) % 2 === 0) ctx.globalAlpha = 0.55;

    // legs
    ctx.fillStyle = bodyCol;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-this.r * 0.85, this.r * 0.45, 7, 5, -0.5, 0, TAU);
    ctx.ellipse(this.r * 0.85, this.r * 0.45, 7, 5, 0.5, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // body — wobbly watercolor blob
    const wob = wobble(7, Math.floor(now * 3), 1.5);
    ctx.fillStyle = bodyCol;
    traceBlob(ctx, 0, 0, this.r + wob, 7, 0.09, 12);
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = INK;
    traceBlob(ctx, 0, 0, this.r + wob, 7, 0.09, 12);
    ctx.stroke();
    // belly
    ctx.fillStyle = 'rgba(244,234,216,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, this.r * 0.35, this.r * 0.62, this.r * 0.4, 0, 0, TAU);
    ctx.fill();

    // eyes — expressive, look toward aim
    const ex = Math.cos(this.aimA) * 2.5, ey = Math.sin(this.aimA) * 1.8;
    for (const side of [-1, 1]) {
      const bx = side * this.r * 0.45, by = -this.r * 0.55;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(bx, by, 6, 6 * blink, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (blink > 0.5) {
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(bx + ex, by + ey, 2.6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(bx + ex - 0.8, by + ey - 0.9, 0.9, 0, TAU);
        ctx.fill();
      }
    }
    // cheeks
    ctx.fillStyle = 'rgba(232,131,107,0.4)';
    ctx.beginPath();
    ctx.ellipse(-this.r * 0.62, -this.r * 0.12, 3.4, 2.2, 0, 0, TAU);
    ctx.ellipse(this.r * 0.62, -this.r * 0.12, 3.4, 2.2, 0, 0, TAU);
    ctx.fill();

    // beret — tilted, sits on head
    ctx.save();
    ctx.rotate(-0.18 + Math.sin(now * 2) * 0.02);
    ctx.fillStyle = '#8a3a4a';
    traceBlob(ctx, 2, -this.r * 0.95, 11, 31, 0.14, 10);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    traceBlob(ctx, 2, -this.r * 0.95, 11, 31, 0.14, 10);
    ctx.stroke();
    ctx.fillStyle = '#6e2c3a';
    ctx.beginPath();
    ctx.ellipse(2, -this.r * 0.8, 9, 3.4, -0.15, 0, TAU);
    ctx.fill();
    ctx.restore();

    // brush arm — oversized paintbrush toward aim, with swing animation
    const swing = this.swipeT > 0 ? Math.sin((1 - this.swipeT / 0.14) * Math.PI) * 0.9 : 0;
    ctx.save();
    ctx.rotate(this.aimA + swing * 0.4);
    const bx = this.r * 0.6;
    // arm
    ctx.strokeStyle = bodyCol;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx - 4, 2);
    ctx.lineTo(bx + 10, 4);
    ctx.stroke();
    // brush handle
    ctx.strokeStyle = '#8a5a33';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(bx + 8, 4);
    ctx.lineTo(bx + 34, 0);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(bx + 8, 2.6);
    ctx.lineTo(bx + 34, -1.4);
    ctx.stroke();
    // ferrule + bristles in current pigment color
    const pcol = PIGMENTS[this.pigment];
    ctx.fillStyle = '#c9c0b2';
    ctx.fillRect(bx + 32, -3.4, 6, 7);
    ctx.fillStyle = pcol.color;
    traceBlob(ctx, bx + 42, 0, 6.5, 91, 0.25, 8);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    traceBlob(ctx, bx + 42, 0, 6.5, 91, 0.25, 8);
    ctx.stroke();
    // bristle tip highlight
    ctx.fillStyle = pcol.light;
    ctx.beginPath();
    ctx.ellipse(bx + 45, -1.4, 3.4, 2, 0.4, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }
}