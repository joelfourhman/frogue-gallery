// player.js — the tiny frog painter: movement, hop, brush aim, damage, charm.
'use strict';
import { TAU, clamp, lerp, dist, traceBlob, wobble } from './math.js';
import { INK, sat } from './ui.js';
import { PIGMENTS } from './logic.js';

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
    this.hopDir = [1, 0];
    this.iframes = 0;
    this.hurtT = 0;         // red flash timer
    this.squash = 1;        // squash-and-stretch scale
    this.swipeT = 0;        // brush swing animation timer
    this.splashCharge = 0;
    this.alive = true;
    this._blinkT = 1.5 + Math.random() * 3;
  }

  get speed() { return 230; }

  update(dt, input, tuning, world, view) {
    const mv = input.moveVec();
    const moving = !!(mv[0] || mv[1]);
    this.aimA = Math.atan2(input.mouse.worldY - this.y, input.mouse.worldX - this.x);
    this.facing = Math.cos(this.aimA) >= 0 ? 1 : -1;

    // hop / dodge (Space)
    if (input.pressed(' ') && this.hopT <= 0 && this.alive) {
      let [hx, hy] = mv;
      if (!hx && !hy) { hx = Math.cos(this.aimA); hy = Math.sin(this.aimA); }
      this.hopDir = [hx, hy];
      this.hopT = 0.22;
      this.iframes = Math.max(this.iframes, tuning.hopIframes + 0.12);
      this.squash = 1.35;
    }
    if (this.hopT > 0) this.hopT -= dt;

    // movement: base speed, boosted mid-hop
    let spd = this.speed;
    if (this.hopT > 0.04) spd *= 2.6;
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
    // squash relaxes toward 1
    this.squash = lerp(this.squash, 1, 1 - Math.exp(-10 * dt));
    this._blinkT -= dt;
    if (this._blinkT < -0.12) this._blinkT = 1.5 + Math.random() * 3;

    // fresh-paint residual: standing in green paint heals slowly
    const cell = world.pigmentAt(this.x, this.y);
    if (cell.green > 0.4 && this.hp < this.maxHp) this._healAcc = (this._healAcc || 0) + dt * (tuning.greenHeal * 0.5);
    else this._healAcc = (this._healAcc || 0) - dt * 2;
    if (this._healAcc >= 1) { this._healAcc = 0; this.hp = Math.min(this.maxHp, this.hp + 1); }
    return this;
  }

  hurt(dmg, tuning) {
    if (!this.alive || this.iframes > 0) return false;
    this.hp -= Math.max(1, Math.round(dmg));
    this.iframes = tuning.iframes;
    this.hurtT = 0.35;
    this.squash = 0.7;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return true;
  }

  // ---------------------------- rendering
  draw(ctx, view, now) {
    const hopLift = this.hopT > 0 ? Math.sin(Math.PI * (1 - this.hopT / 0.22)) * 26 : 0;
    const y = this.y - hopLift;
    const blink = this._blinkT < 0 ? 0.15 : 1;
    const hurt = this.hurtT > 0 ? Math.sin(this.hurtT * 40) * 0.5 + 0.5 : 0;
    const bodyCol = hurt > 0.5 ? '#e08a76' : '#69a24e';

    ctx.save();
    ctx.translate(this.x, this.y);

    // shadow (grows smaller when hopping)
    ctx.fillStyle = 'rgba(30,50,40,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, this.r * 0.75, this.r * (1 - hopLift * 0.015), this.r * 0.4 * (1 - hopLift * 0.02), 0, 0, TAU);
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