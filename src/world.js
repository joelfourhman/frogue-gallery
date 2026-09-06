// world.js — the swamp: terrain, paint layer, vegetation, soil, reeds.
'use strict';
import { traceBlob, wobble, clamp, dist2, TAU } from './math.js';
import { INK, sat, mixColor } from './ui.js';

const WSCALE = 0.5; // paint layer resolution factor

export class World {
  constructor(rng, seed) {
    this.w = 5400; this.h = 1500;   // P5: widened for 15–20 min run pacing (was 2400)
    this.seed = seed;
    this.rng = rng;
    this.grass = [];
    this.ripples = [];
    this.obstacles = [];      // rocks/bushes: {x,y,r,seed,kind}
    this.pads = [];           // lily pads: {x,y,r} — safe, regen
    this.veg = [];            // vegetation: {x,y,h,seed,burn,alive}
    this.soil = [];           // soil patches: {x,y,r}
    this.reeds = [];          // grown reeds: {x,y,h,burn}
    this.slick = [];          // fresh blue slick: {x,y,r,t}
    this.build();

    // paint layer
    const pw = Math.ceil(this.w * WSCALE), ph = Math.ceil(this.h * WSCALE);
    this.paintCanvas = document.createElement('canvas');
    this.paintCanvas.width = pw; this.paintCanvas.height = ph;
    this.pctx = this.paintCanvas.getContext('2d');
    this.pigmentGrid = new Map(); // key -> {red,blue,green,age}
    this.cell = 60;
  }

  build() {
    const rng = this.rng;
    const k = this.w / 2400; // P5: decoration density follows world width
    // grass tufts
    for (let i = 0; i < Math.round(260 * k); i++) {
      this.grass.push({ x: rng() * this.w, y: rng() * this.h, s: 2 + rng() * 4, seed: (i * 31) % 97 });
    }
    // ripples
    for (let i = 0; i < Math.round(40 * k); i++) {
      this.ripples.push({ x: rng() * this.w, y: rng() * this.h, r: 8 + rng() * 26, seed: (i * 17) % 89 });
    }
    // obstacles — clustered away from the central corridor
    const corridor = (x, y) => (y > 480 && y < 980 && x > 200 && x < this.w - 200);
    let tries = 0;
    while (this.obstacles.length < Math.round(26 * k) && tries++ < 600) {
      const x = 80 + rng() * (this.w - 160);
      const y = 80 + rng() * (this.h - 160);
      if (corridor(x, y) && rng() < 0.75) continue;
      if (this.obstacles.some(o => dist2(o.x, o.y, x, y) < 140 * 140)) continue;
      this.obstacles.push({ x, y, r: 22 + rng() * 26, seed: (this.obstacles.length * 53) % 997, kind: rng() < 0.5 ? 0 : 1 });
    }
    // lily pads along the corridor + pockets
    const padSpots = [
      [300, 720], [1000, 760], [1700, 700], [2400, 760], [3100, 700], [3800, 760],
      [4500, 700], [5100, 760],
      [600, 480], [1800, 1100], [3000, 480], [4200, 1100], [5000, 480], [1200, 1120],
    ];
    padSpots.forEach(([x, y], i) => this.pads.push({ x: x + wobble(this.seed, i, 30), y: y + wobble(this.seed, i + 50, 30), r: 46 + rng() * 14 }));
    // vegetation clusters (burnable, paintable)
    for (let i = 0; i < Math.round(24 * k); i++) {
      const x = 100 + rng() * (this.w - 200);
      const y = 100 + rng() * (this.h - 200);
      if (this.obstacles.some(o => dist2(o.x, o.y, x, y) < (o.r + 30) * (o.r + 30))) continue;
      this.veg.push({ x, y, h: 40 + rng() * 30, seed: (i * 71) % 991, burn: 0, alive: true });
    }
    // soil patches (green-grow spots)
    for (let i = 0; i < Math.round(12 * k); i++) {
      const x = 120 + rng() * (this.w - 240);
      const y = 120 + rng() * (this.h - 240);
      this.soil.push({ x, y, r: 34 + rng() * 22 });
    }
  }

  cellAt(x, y) {
    const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
    const key = cx + ',' + cy;
    let c = this.pigmentGrid.get(key);
    if (!c) { c = { red: 0, blue: 0, green: 0, age: 0 }; this.pigmentGrid.set(key, c); }
    return c;
  }

  // Player paints a swipe: arc of splat points from origin toward aim.
  paintSwipe(x0, y0, aimA, range, pigment) {
    for (let d = 14; d <= range; d += 16) {
      const x = x0 + Math.cos(aimA) * d + (Math.random() - 0.5) * 14;
      const y = y0 + Math.sin(aimA) * d + (Math.random() - 0.5) * 14;
      this.splat(x, y, pigment, 5 + Math.random() * 5, true);
    }
  }

  paintSplash(x, y, radius, pigment) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * TAU, d = Math.random() * radius;
      this.splat(x + Math.cos(a) * d, y + Math.sin(a) * d, pigment, 5 + Math.random() * 6, false);
    }
    this.splat(x, y, pigment, 14, true);
  }

  splat(x, y, pigment, r, strong) {
    if (x < 0 || y < 0 || x > this.w || y > this.h) return;
    const cell = this.cellAt(x, y);
    cell.age = 3.2;
    if (pigment !== 'dry') cell[pigment] = Math.min(3, cell[pigment] + (strong ? 1 : 0.6));
    // draw into paint layer
    const c = this.pctx;
    const col = pigment === 'red' ? 'rgba(200,69,44,0.28)' : pigment === 'blue' ? 'rgba(58,111,216,0.26)' : pigment === 'green' ? 'rgba(90,158,61,0.24)' : 'rgba(154,143,128,0.12)';
    c.globalAlpha = strong ? 1 : 0.6;
    c.fillStyle = col;
    c.beginPath();
    c.ellipse(x * WSCALE, y * WSCALE, r * WSCALE, r * 0.8 * WSCALE, Math.random() * TAU, 0, TAU);
    c.fill();
    // drips
    c.globalAlpha = 0.5;
    const drips = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < drips; i++) {
      const a = Math.random() * TAU, dl = r * (1.2 + Math.random());
      c.beginPath();
      c.ellipse((x + Math.cos(a) * dl) * WSCALE, (y + Math.sin(a) * dl) * WSCALE,
        (r * 0.18) * WSCALE, (r * 0.35) * WSCALE, a, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;

    // interactions -------------------------------------------------
    if (pigment === 'red') {
      // ignite vegetation
      for (const v of this.veg) {
        if (v.alive && v.burn <= 0 && dist2(v.x, v.y, x, y) < 42 * 42) {
          v.burn = 6;
          return 'ignite';
        }
      }
      // burn reeds
      for (const r of this.reeds) {
        if (!r.burn && dist2(r.x, r.y, x, y) < 40 * 40) { r.burn = 1.2; return 'ignite'; }
      }
    }
    if (pigment === 'blue') {
      this.slick.push({ x, y, r: 30 + r * 2, t: 5 });
    }
    if (pigment === 'green') {
      for (const s of this.soil) {
        if (dist2(s.x, s.y, x, y) < s.r * s.r && !this.reeds.some(rd => dist2(rd.x, rd.y, s.x, s.y) < 50 * 50)) {
          this.reeds.push({ x: s.x + wobble(this.seed, s.x | 0, 10), y: s.y + wobble(this.seed, s.y | 0, 10), h: 0, burn: 0, seed: (s.x * 7 + s.y) % 997 });
          return 'sprout';
        }
      }
      // restore burned vegetation
      for (const v of this.veg) {
        if (v.alive && v.burn > 0 && dist2(v.x, v.y, x, y) < 42 * 42) { v.burn = 0; }
      }
    }
    return null;
  }

  pigmentAt(x, y) { return this.cellAt(x, y); }

  update(dt) {
    // age & decay pigment grid
    for (const [key, c] of this.pigmentGrid) {
      if (c.age > 0) {
        c.age -= dt;
        const decay = dt / 3.2;
        c.red = Math.max(0, c.red - decay);
        c.blue = Math.max(0, c.blue - decay);
        c.green = Math.max(0, c.green - decay);
        if (c.age <= 0) this.pigmentGrid.delete(key);
      }
    }
    // slicks
    for (let i = this.slick.length - 1; i >= 0; i--) {
      this.slick[i].t -= dt;
      if (this.slick[i].t <= 0) this.slick.splice(i, 1);
    }
    // vegetation burn + spread
    for (const v of this.veg) {
      if (v.burn > 0) {
        v.burn -= dt;
        if (Math.random() < dt * 0.4) {
          // spread to a neighbor sometimes
          for (const o of this.veg) {
            if (o !== v && o.alive && o.burn <= 0 && dist2(o.x, o.y, v.x, v.y) < 110 * 110 && Math.random() < 0.5) {
              o.burn = 5;
              break;
            }
          }
        }
        if (v.burn <= 0) v.alive = false;
      }
    }
    // reeds grow / burn
    for (let i = this.reeds.length - 1; i >= 0; i--) {
      const r = this.reeds[i];
      if (r.burn > 0) {
        r.burn -= dt;
        if (r.burn <= 0) this.reeds.splice(i, 1);
      } else if (r.h < 1) {
        r.h = Math.min(1, r.h + dt * 1.6);
      }
    }
    // occasionally fade the paint layer (keeps it translucent, avoids buildup)
    this._fadeT = (this._fadeT || 0) + dt;
    if (this._fadeT > 0.4) {
      this._fadeT = 0;
      this.pctx.globalCompositeOperation = 'destination-out';
      this.pctx.fillStyle = 'rgba(0,0,0,0.06)';
      this.pctx.fillRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
      this.pctx.globalCompositeOperation = 'source-over';
    }
  }

  // Collision: push circle out of obstacles/reeds (blocks enemies too).
  collideCircle(x, y, r, passReeds = false) {
    let px = x, py = y;
    for (const o of this.obstacles) {
      const dx = px - o.x, dy = py - o.y;
      const d2 = dx * dx + dy * dy;
      const min = o.r + r;
      if (d2 < min * min && d2 > 0.001) {
        const d = Math.sqrt(d2);
        px = o.x + (dx / d) * min;
        py = o.y + (dy / d) * min;
      }
    }
    if (!passReeds) {
      for (const rd of this.reeds) {
        if (rd.h < 0.5) continue;
        const dx = px - rd.x, dy = py - rd.y;
        const d2 = dx * dx + dy * dy;
        const min = 12 + r;
        if (d2 < min * min && d2 > 0.001) {
          const d = Math.sqrt(d2);
          px = rd.x + (dx / d) * min;
          py = rd.y + (dy / d) * min;
        }
      }
    }
    px = clamp(px, r, this.w - r);
    py = clamp(py, r, this.h - r);
    return [px, py];
  }

  // ------------------------------------------------------------- rendering
  drawBackground(ctx, view, colorSat) {
    // Swamp floor: layered warm water. Fills the whole world in world-space.
    // The caller (_drawAll) already applied the single camera transform, so no
    // inner camera transform is applied here — the old double-transform pushed
    // all terrain off-screen and left the cream page background showing.
    ctx.fillStyle = sat('#6f9e8e', colorSat);
    ctx.fillRect(0, 0, this.w, this.h);

    // P10: cull per-item decoration to the visible world rect (off-screen items
    // are invisible anyway; skipping them is a zero-visible-change perf win that
    // holds 60fps across the full 5400px world). The floor fillRect above is a
    // single canvas-clipped call, so it stays.
    const m = 100;
    const cx0 = view.x - m, cy0 = view.y - m;
    const cx1 = view.x + view.w / view.scale + m, cy1 = view.y + view.h / view.scale + m;
    const inView = (x, y) => x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1;

    // deep patches (N4: High Tide widens water via this.waterWidthMult —
    // render-only, defaults to 1 so the first-time render is byte-identical)
    const wm = this.waterWidthMult || 1;
    for (const rp of this.ripples) {
      if (!inView(rp.x, rp.y)) continue;
      ctx.strokeStyle = `rgba(30,60,55,${0.14 * colorSat + 0.04})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rp.r * wm, rp.r * 0.5 * wm, 0, 0, TAU);
      ctx.stroke();
    }
    // grass tufts
    for (const g of this.grass) {
      if (!inView(g.x, g.y)) continue;
      const hgt = g.s * 3;
      ctx.strokeStyle = sat('#4d7a4a', colorSat);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.quadraticCurveTo(g.x + 3, g.y - hgt * 0.6, g.x + wobble(g.seed, 1, 3), g.y - hgt);
      ctx.moveTo(g.x, g.y);
      ctx.quadraticCurveTo(g.x - 3, g.y - hgt * 0.6, g.x + wobble(g.seed, 2, 3) - 4, g.y - hgt * 0.9);
      ctx.stroke();
    }
    // soil patches
    for (const s of this.soil) {
      if (!inView(s.x, s.y)) continue;
      ctx.fillStyle = sat('#8a6f4d', colorSat);
      ctx.globalAlpha = 0.55;
      traceBlob(ctx, s.x, s.y, s.r, s.x | 0, 0.15, 10);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // paint layer
    ctx.globalAlpha = 0.9;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.paintCanvas, 0, 0, this.w, this.h);
    ctx.globalAlpha = 1;
    // slicks (blue wet shine) — N4: High Tide widens these too
    for (const s of this.slick) {
      if (!inView(s.x, s.y)) continue;
      ctx.fillStyle = `rgba(120,170,240,${0.14 * Math.min(1, s.t)})`;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r * wm, s.r * 0.6 * wm, 0, 0, TAU);
      ctx.fill();
    }
  }

  drawProps(ctx, view, colorSat, now) {
    // vegetation, reeds, lily pads — in world space (caller applies the single
    // camera transform). No inner camera transform.
    // P10: cull to the visible world rect (off-screen = invisible; zero visual change).
    const m = 120;
    const cx0 = view.x - m, cy0 = view.y - m;
    const cx1 = view.x + view.w / view.scale + m, cy1 = view.y + view.h / view.scale + m;
    const inView = (x, y) => x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1;

    // vegetation (behind actors)
    for (const v of this.veg) {
      if (!inView(v.x, v.y)) continue;
      const hgt = v.h;
      if (v.burn > 0) {
        // charred
        ctx.strokeStyle = '#4a3b30';
        ctx.lineWidth = 3;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(v.x + i * 5, v.y);
          ctx.lineTo(v.x + i * 7 + wobble(v.seed, i + 5, 4), v.y - hgt * 0.4);
          ctx.stroke();
        }
        if (Math.random() < 0.25) { // ember flicker
          ctx.fillStyle = 'rgba(255,150,60,0.5)';
          ctx.beginPath();
          ctx.arc(v.x + wobble(v.seed, Math.floor(now * 8), 8), v.y - hgt * 0.3, 2.5, 0, TAU);
          ctx.fill();
        }
      } else if (v.alive) {
        ctx.strokeStyle = sat('#3f6d3a', colorSat);
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(v.x + i * 4, v.y);
          ctx.quadraticCurveTo(v.x + i * 9 + wobble(v.seed, i + 3, 5), v.y - hgt * 0.5, v.x + i * 12 + wobble(v.seed, i + 7, 6), v.y - hgt);
          ctx.stroke();
        }
        ctx.fillStyle = sat('#5a9e3d', colorSat);
        ctx.beginPath();
        ctx.ellipse(v.x - 8, v.y - hgt * 0.8, 6, 3.5, -0.5, 0, TAU);
        ctx.ellipse(v.x + 9, v.y - hgt * 0.65, 6, 3.5, 0.5, 0, TAU);
        ctx.fill();
      }
    }
    // reeds
    for (const rd of this.reeds) {
      if (!inView(rd.x, rd.y)) continue;
      const k = rd.h;
      const hgt = 46 * k;
      ctx.strokeStyle = rd.burn > 0 ? '#5a3b2a' : sat('#3a6d55', colorSat);
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(rd.x, rd.y);
      ctx.quadraticCurveTo(rd.x + 6, rd.y - hgt * 0.6, rd.x + wobble(rd.seed, 1, 5) * k, rd.y - hgt);
      ctx.stroke();
      // cattail head
      if (k > 0.6) {
        ctx.fillStyle = rd.burn > 0 ? '#3b2a20' : sat('#7a5a3a', colorSat);
        ctx.beginPath();
        ctx.ellipse(rd.x + wobble(rd.seed, 1, 5) * k, rd.y - hgt - 4, 4, 9, 0, 0, TAU);
        ctx.fill();
      }
    }
    // lily pads
    for (const p of this.pads) {
      if (!inView(p.x, p.y)) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = sat('#4f8a55', colorSat);
      traceBlob(ctx, 0, 0, p.r, p.x | 0, 0.08, 16);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = `rgba(43,35,32,${0.4 + 0.3 * colorSat})`;
      traceBlob(ctx, 0, 0, p.r, p.x | 0, 0.08, 16);
      ctx.stroke();
      // notch
      ctx.fillStyle = sat('#3f7048', colorSat);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(p.r * 0.9, -p.r * 0.18);
      ctx.lineTo(p.r * 0.85, p.r * 0.2);
      ctx.closePath();
      ctx.fill();
      // vein arcs
      ctx.strokeStyle = `rgba(255,255,255,${0.1 + 0.1 * colorSat})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const a = 0.6 + i * 0.9;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * p.r * 0.8, Math.sin(a) * p.r * 0.8);
        ctx.stroke();
      }
      // a flower on some pads
      if ((p.x | 0) % 3 === 0) {
        ctx.fillStyle = sat('#e8b6cc', colorSat);
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * TAU + now * 0.05;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * 7, Math.sin(a) * 7, 6, 3.5, a, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = sat('#ffd75e', colorSat);
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  drawObstacles(ctx, view, colorSat) {
    // rocks/bushes in world space (caller applies the single camera transform).
    // P10: cull to the visible world rect (off-screen = invisible; zero visual change).
    const m = 120;
    const cx0 = view.x - m, cy0 = view.y - m;
    const cx1 = view.x + view.w / view.scale + m, cy1 = view.y + view.h / view.scale + m;
    for (const o of this.obstacles) {
      if (o.x < cx0 || o.x > cx1 || o.y < cy0 || o.y > cy1) continue;
      ctx.save();
      ctx.translate(o.x, o.y);
      if (o.kind === 0) {
        // rock
        ctx.fillStyle = sat('#8a8578', colorSat);
        traceBlob(ctx, 0, 2, o.r, o.seed, 0.18, 9);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = INK;
        ctx.globalAlpha = 0.7;
        traceBlob(ctx, 0, 2, o.r, o.seed, 0.18, 9);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = sat('#a5a093', colorSat);
        traceBlob(ctx, -o.r * 0.25, -o.r * 0.3, o.r * 0.4, o.seed + 1, 0.2, 7);
        ctx.fill();
      } else {
        // bush
        ctx.fillStyle = sat('#557a45', colorSat);
        traceBlob(ctx, 0, 0, o.r, o.seed, 0.22, 11);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = INK;
        ctx.globalAlpha = 0.6;
        traceBlob(ctx, 0, 0, o.r, o.seed, 0.22, 11);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = sat('#6d9459', colorSat);
        for (let i = 0; i < 4; i++) {
          const a = i / 4 * TAU + o.seed;
          traceBlob(ctx, Math.cos(a) * o.r * 0.4, Math.sin(a) * o.r * 0.4, o.r * 0.4, o.seed + i, 0.2, 7);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // color "health" of the world: 0 gray -> 1 full
  worldColorSat() {
    return this._colorSat ?? 0.25;
  }
  restoreColor(amount) {
    this._colorSat = clamp((this._colorSat ?? 0.25) + amount, 0, 1);
  }
}