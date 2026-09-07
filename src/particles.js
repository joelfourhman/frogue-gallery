// particles.js — pooled painterly particles. Capped, no per-frame alloc.
'use strict';

const MAX = 240;

export class ParticleSystem {
  constructor() {
    this.pool = new Array(MAX);
    for (let i = 0; i < MAX; i++) {
      this.pool[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, color: '', kind: 0, rot: 0, vrot: 0, grav: 0, fade: 1 };
    }
    this.count = 0;
    this.spawnCursor = 0;
  }

  spawn(x, y, vx, vy, life, size, color, kind = 0, grav = 0) {
    const p = this.pool[this.spawnCursor];
    this.spawnCursor = (this.spawnCursor + 1) % MAX;
    p.active = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.maxLife = life; p.size = size; p.color = color;
    p.kind = kind; p.rot = Math.random() * 6.28; p.vrot = (Math.random() - 0.5) * 8;
    p.grav = grav; p.fade = 1;
    this.count++;
  }

  // burst helpers ------------------------------------------------------
  splatter(x, y, color, n = 8, speed = 180) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + Math.random() * 0.3,
        1.5 + Math.random() * 3, color, 0, 300);
    }
  }
  droplets(x, y, color, n = 5) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const s = 120 + Math.random() * 160;
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.5 + Math.random() * 0.3,
        2 + Math.random() * 2.5, color, 1, 600);
    }
  }
  inkSpatter(x, y, color, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 120;
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.25 + Math.random() * 0.2,
        1 + Math.random() * 2, color, 2, 0);
    }
  }
  leafPuff(x, y, color, n = 5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 80;
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s - 60, 0.6 + Math.random() * 0.4,
        2 + Math.random() * 2, color, 3, 200);
    }
  }
  embers(x, y, n = 4) {
    for (let i = 0; i < n; i++) {
      this.spawn(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 40, -40 - Math.random() * 60,
        0.4 + Math.random() * 0.3, 1.5 + Math.random() * 1.5, '#ff9a4a', 4, -100);
    }
  }
  sparkles(x, y, color, n = 5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 30 + Math.random() * 70;
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s - 30, 0.5, 1.5 + Math.random() * 1.5, color, 5, -50);
    }
  }
  // J4 (v1.4): a soft dust/water puff for a frog hop landing — a few low-
  // alpha, slowly-rising soft motes (drawn as blurred ellipses, kind 0).
  dustPuff(x, y, n = 5) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const s = 30 + Math.random() * 50;
      this.spawn(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 4,
        Math.cos(a) * s, Math.sin(a) * s * 0.5, 0.35 + Math.random() * 0.25,
        2 + Math.random() * 2.5, 'rgba(220,210,190,0.5)', 0, -40);
    }
  }
  // J4 (v1.4): a single expanding + fading ripple ring (open water). kind 6,
  // the size grows with (1 - fade) in draw().
  ripple(x, y, color = 'rgba(255,255,255,0.6)') {
    this.spawn(x, y, 0, 0, 0.6, 6, color, 6, 0);
  }

  update(dt) {
    let n = 0;
    for (let i = 0; i < MAX; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += p.grav * dt;
      p.vx *= (1 - 2 * dt); p.vy *= (1 - (p.kind === 1 ? 0.5 : 1.5) * dt);
      p.rot += p.vrot * dt;
      p.fade = p.life / p.maxLife;
      n++;
    }
    this.count = n;
  }

  draw(ctx) {
    for (let i = 0; i < MAX; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      ctx.globalAlpha = Math.min(1, p.fade * 1.4);
      ctx.fillStyle = p.color;
      if (p.kind === 5) { // sparkle star
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.3, -s * 0.3); ctx.lineTo(s, 0);
        ctx.lineTo(s * 0.3, s * 0.3); ctx.lineTo(0, s); ctx.lineTo(-s * 0.3, s * 0.3);
        ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.3, -s * 0.3);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (p.kind === 3) { // leaf
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 1.6, p.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 6) { // J4: expanding + fading ripple ring
        const grow = 1 - p.fade; // 0 -> 1 over the particle's life
        const r = p.size * (0.4 + grow * 2.6);
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.fade * 0.7);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * 0.8, p.rot, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}