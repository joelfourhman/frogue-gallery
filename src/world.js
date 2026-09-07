// world.js — the swamp: terrain, paint layer, vegetation, soil, reeds.
'use strict';
import { traceBlob, wobble, clamp, dist2, TAU, mulberry32 } from './math.js';
import { INK, sat, mixColor } from './ui.js';

const WSCALE = 0.5; // paint layer resolution factor

// L1 (v1.4 "Make It Amazing"): the living-world pass. All of this is PURE
// draw-time modulation (functions of `now` + existing world data / constants)
// drawn inside drawProps's existing view culling — no new per-world state, so
// P10 (off-screen culling) and the pacing probes (runT) are untouched.

// Per-reed sway offset (world px). A low-frequency sine phased by the reed's
// own `seed`, small amplitude (painted-world, not bouncy). Deterministic.
export function reedSway(seed, now) {
  return Math.sin(now * 1.3 + (seed % 97) * 0.618) * 5;   // ±5 px
}

// Shimmer glint alpha (0..1) for the i-th open-water glint. A staggered slow
// pulse so a handful of glints twinkle out of sync. Deterministic, bounded.
export function shimmerGlint(i, now) {
  const s = (0.5 + 0.5 * Math.sin(now * 0.9 + i * 1.9));  // 0..1, staggered
  return s * s;                                            // ease (dimmer mid)
}

// Drifting mist bands: 2-3 very-low-alpha procedural ellipses. A module
// constant (not per-world data). `parallax` < 1 → the band lags the camera,
// reading as farther away; `speed` = slow world-px/s drift.
export const MIST_BANDS = [
  { y: 380, h: 210, r: 520, alpha: 0.05, speed: 7,  parallax: 0.78, seed: 11 },
  { y: 760, h: 250, r: 640, alpha: 0.045, speed: 5, parallax: 0.72, seed: 57 },
  { y: 1120, h: 200, r: 460, alpha: 0.05, speed: 9, parallax: 0.82, seed: 83 },
];

// Cap on open-water shimmer glints (bounded so the draw cost never grows).
export const SHIMMER_CAP = 12;

// L2 (v1.4 "Make It Amazing"): the layered watercolor render pass. Pure
// draw-time + a bake-once cache — no new per-frame state, so P10 (off-screen
// culling) and the pacing probes (runT) are untouched.
//   (a) wet rim  — freshly painted pigment cells grow a darker "wet edge"
//                  (the watercolor bloom) that lightens and dries over ~5s,
//                  derived from the EXISTING pigment-cell `age`/amount (no new
//                  persistence).
//   (b) stroke texture — short directional brush strokes baked ONCE into a
//                  per-zone offscreen canvas at world.build() (seeded via
//                  math.js mulberry32/wobble), drawn as ONE cached image per
//                  zone per frame (the budget trick: one drawImage, not
//                  thousands of strokes).
//   (c) prop outlines — rocks & bushes get a second low-alpha offset "watercolor
//                  double-stroke" (a soft ink echo) on top of the existing edge.
// The zone accents mirror game.js ZONES (kept here so world.js has no
// dependency on game.js — no circular import).
export const ZONE_TEXTURES = [
  { x: 0,   accent: '#c9a94e' },  // Reed Flats
  { x: 0.24, accent: '#5a93c9' },  // Slick Hollow
  { x: 0.44, accent: '#7fb069' },  // Bramble Thicket
  { x: 0.64, accent: '#9a9a8f' },  // The Gray Shore
];
// Reduced-res offscreen scale for the stroke texture (keeps the cached layers
// light; they are drawn scaled up over the floor, so the soft wash is
// resolution-independent).
const TEXTURE_SCALE = 0.25;

// Wet-rim alpha (0..~0.4): a fresh cell (amount ~3) carries the strongest rim,
// which lightens as the pigment decays (amount -> 0 over ~5s). Pure +
// deterministic (the smoke stage asserts the decay).
export function wetRimAlpha(amount) {
  const m = clamp(amount || 0, 0, 3);
  return (m / 3) * 0.4;
}
// Wet-rim stroke radius (world px) — a touch larger than the cell so it reads as
// a soft edge halo, not a hard line.
export function wetRimRadius(cell) {
  return cell * 0.66;
}
// Cap on the wet rims drawn per frame (the grid can hold many fresh cells after
// a long painting run; bounding the draw keeps the per-frame cost flat).
export const WET_RIM_CAP = 96;

export class World {
  constructor(rng, seed, opts = {}) {
    this.w = 5400; this.h = 1500;   // P5: widened for 15–20 min run pacing (was 2400)
    this.seed = seed;
    this.rng = rng;
    // R1 (v1.6): the Reeds VARIANT flag (opts.reeds). Set BEFORE build() so the
    // build pass can populate the light economy. A base world (opts.reeds
    // falsy) stays exactly as before.
    this.reedsVariant = !!opts.reeds;
    this.grass = [];
    this.ripples = [];
    this.obstacles = [];      // rocks/bushes: {x,y,r,seed,kind}
    this.pads = [];           // lily pads: {x,y,r} — safe, regen
    // R1 (v1.6): the Reeds biome's light economy — the frog's PAPER LANTERN
    // refills its candle fuel here. `fireflies` drift slowly and top up the
    // wick while the frog rests near one (a living, moving refill source);
    // `restSpots` are static lantern-rest stones (a fixed, reliable refill).
    // Only the Reeds variant (opts.reeds) populates them; a normal swamp
    // world carries empty arrays, so a first-time run is byte-identical.
    this.fireflies = [];       // {x,y,r,seed,ph} — drifting light, refills the lantern
    this.restSpots = [];       // {x,y,r,seed} — lantern-rest stones
    // R1 (v1.6): `this.reedsVariant` (set from opts.reeds above) marks the
    // Reeds VARIANT world. `this.reeds` (below) is the GROWN-REEDS array
    // (vegetation) — a different thing — hence the distinct flag.
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
    // R1 (v1.6): the Reeds VARIANT — a darker-palette, flooded, deeper-swamp
    // world (SAME painting, deeper — not a genre shift). The zone layout /
    // obstacles / pads / vegetation are IDENTICAL to the base swamp, so the
    // painting and traversal carry over; what changes is (a) the palette is
    // darker (a render-only cap, below) and (b) the light economy is populated
    // here: drifting fireflies + static lantern-rest stones where the frog's
    // paper lantern refills its candle fuel. A base (non-Reeds) world leaves
    // these arrays empty, so a first-time run is byte-identical.
    if (this.reedsVariant) {
      for (let i = 0; i < 46; i++) {
        this.fireflies.push({ x: 150 + rng() * (this.w - 300), y: 120 + rng() * (this.h - 240), r: 9 + rng() * 10, seed: (i * 37) % 991, ph: rng() * TAU });
      }
      // lantern-rest stones: ~7 spread along the corridor so the fuel loop is
      // winnable without backtracking (a rest roughly every 700 px of travel).
      const restXs = [700, 1400, 2150, 2900, 3650, 4400, 5050];
      restXs.forEach((x, i) => this.restSpots.push({ x: x + wobble(this.seed, i * 3, 60), y: (i % 2 ? 1150 : 430) + wobble(this.seed, i * 7 + 2, 90), r: 34, seed: (i * 53) % 997 }));
    }
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
    this._bakeTextures();
  }

  // L2 (b): bake the stroke-texture offscreen layers — ONCE, at build, so the
  // per-frame cost is a single drawImage per zone (not thousands of strokes).
  // Seeded independently from `this.seed` (mulberry32) so the same world seed
  // always produces the same texture, and it rides the existing seed system
  // without disturbing the main decoration RNG stream.
  _bakeTextures() {
    const trng = mulberry32((this.seed * 2654435761) >>> 0);
    const tw = Math.ceil(this.w * TEXTURE_SCALE);
    const th = Math.ceil(this.h * TEXTURE_SCALE);
    this._texCanvases = [];
    for (const z of ZONE_TEXTURES) {
      const z0 = z.x * this.w;
      // each zone's band spans from its start to the next zone's start; the last
      // (x:1) runs to the end of the world (the Gray Shore fills the rest).
      const zi = ZONE_TEXTURES.indexOf(z);
      const z1 = (zi < ZONE_TEXTURES.length - 1)
        ? ZONE_TEXTURES[zi + 1].x * this.w
        : this.w;
      const cv = document.createElement('canvas');
      cv.width = Math.max(2, Math.round(tw));
      cv.height = Math.max(2, Math.round(th));
      const g = cv.getContext('2d');
      const acc = z.accent;
      const base = sat(acc, 1);
      // Base wash: a handful of very-low-alpha accent blobs across the zone band.
      g.globalAlpha = 0.05;
      g.fillStyle = base;
      const washes = 6 + Math.round(trng() * 4);
      for (let i = 0; i < washes; i++) {
        const bx = (z0 + trng() * (z1 - z0)) * TEXTURE_SCALE;
        const by = trng() * th;
        const br = (90 + trng() * 130) * TEXTURE_SCALE;
        g.beginPath();
        g.ellipse(bx, by, br, br * 0.7, trng() * TAU, 0, TAU);
        g.fill();
      }
      // Stroke texture: short directional brush strokes (dark edge + light
      // highlight), oriented along a zone-consistent angle so each zone's
      // "hand" reads differently. Capped count so the bake is bounded.
      const angle = z.x * TAU; // per-zone base angle
      const N = 70 + Math.round(trng() * 30);
      g.lineCap = 'round';
      for (let i = 0; i < N; i++) {
        const sx = (z0 + trng() * (z1 - z0)) * TEXTURE_SCALE;
        const sy = trng() * th;
        const len = (10 + trng() * 26) * TEXTURE_SCALE;
        const a = angle + (trng() - 0.5) * 0.9;
        const dx = Math.cos(a) * len, dy = Math.sin(a) * len * 0.5;
        g.globalAlpha = 0.05 + trng() * 0.06;
        g.strokeStyle = INK;
        g.lineWidth = 1.2 * TEXTURE_SCALE + 0.4;
        g.beginPath();
        g.moveTo(sx - dx * 0.5, sy - dy * 0.5);
        g.lineTo(sx + dx * 0.5, sy + dy * 0.5);
        g.stroke();
        // light highlight echo offset a hair
        g.globalAlpha = 0.04 + trng() * 0.04;
        g.strokeStyle = mixColor(acc, '#ffffff', 0.5);
        g.lineWidth = 0.9 * TEXTURE_SCALE + 0.3;
        g.beginPath();
        g.moveTo(sx - dx * 0.5 + 0.8, sy - dy * 0.5 - 0.8);
        g.lineTo(sx + dx * 0.5 + 0.8, sy + dy * 0.5 - 0.8);
        g.stroke();
      }
      g.globalAlpha = 1;
      this._texCanvases.push(cv);
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

  // R1 (v1.6): draw the Reeds biome's LIGHT ECONOMY — the drifting fireflies
  // and the static lantern-rest stones. Called ONLY for the Reeds variant (from
  // _drawAll's world-space pass) in world space (the camera transform is already
  // applied by the caller). Both are cheap and VIEW-CULLED so they never add to
  // the P10 draw budget on a full-world view. Fireflies drift on a slow bounded
  // sine (a function of now + their seed — no per-frame world state, so pacing
  // probes are untouched) and pulse; rest stones carry a soft amber aura marking
  // where the paper lantern refills its candle fuel.
  drawReedsLights(ctx, view, now) {
    if (!this.reedsVariant) return;
    const vx = view.x - 60, vy = view.y - 60, vw = view.w + 120, vh = view.h + 120;
    // lantern-rest stones: a mossy rock with a soft warm aura + a tiny flame.
    for (const s of this.restSpots) {
      if (s.x < vx || s.x > vx + vw || s.y < vy || s.y > vy + vh) continue;
      const a = 0.5 + 0.2 * Math.sin(now * 1.2 + s.seed);
      ctx.save();
      ctx.globalAlpha = 0.35 * a;
      ctx.fillStyle = '#e8b24a';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 1.7, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#5a5142';
      traceBlob(ctx, s.x, s.y, s.r, s.seed, 0.14);
      ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(244,234,216,0.5)';
      ctx.beginPath(); ctx.arc(s.x, s.y - s.r * 0.35, 4.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffcf6b';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - s.r * 0.35 - 9);
      ctx.quadraticCurveTo(s.x + 4, s.y - s.r * 0.35 - 3, s.x, s.y - s.r * 0.35 + 2);
      ctx.quadraticCurveTo(s.x - 4, s.y - s.r * 0.35 - 3, s.x, s.y - s.r * 0.35 - 9);
      ctx.fill();
      ctx.restore();
    }
    // fireflies: drifting, pulsing points of light (a moving refill source).
    for (const f of this.fireflies) {
      const dx = f.x + Math.sin(now * 0.5 + f.ph) * 26;
      const dy = f.y + Math.cos(now * 0.4 + f.ph * 1.7) * 18;
      if (dx < vx || dx > vx + vw || dy < vy || dy > vy + vh) continue;
      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 1.8 + f.seed));
      ctx.save();
      ctx.globalAlpha = 0.5 * pulse;
      ctx.fillStyle = '#d6f36b';
      ctx.beginPath(); ctx.arc(dx, dy, f.r * 1.9, 0, TAU); ctx.fill();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#f2ffd0';
      ctx.beginPath(); ctx.arc(dx, dy, f.r * 0.5, 0, TAU); ctx.fill();
      ctx.restore();
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

    // L2 (b) — layered watercolor stroke texture: ONE cached image per zone
    // (the budget trick; ~4 drawImages/frame regardless of world size). The
    // base wash + directional brush strokes were baked once at build().
    if (this._texCanvases) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.imageSmoothingEnabled = true;
      for (let zi = 0; zi < this._texCanvases.length; zi++) {
        ctx.drawImage(this._texCanvases[zi], 0, 0, this.w, this.h);
      }
      ctx.restore();
    }

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
    // L2 (a) — wet rim: freshly painted pigment cells carry a darker edge that
    // dries out (derived from the existing grid `age`/amount; no new state).
    this.drawWetRims(ctx, inView);
  }

  // L2 (a): draw the wet-edge rims over the paint layer. Pure draw-time; reuses
  // the pigment grid's `amount` (which decays with `age` over ~5s) so a fresh
  // cell reads wet (strong rim) and dries to nothing. View-culled + capped for P10.
  drawWetRims(ctx, inView) {
    if (!this.pigmentGrid || this.pigmentGrid.size === 0) return;
    const rimR = wetRimRadius(this.cell);
    let drawn = 0;
    ctx.save();
    ctx.lineCap = 'round';
    for (const [key, c] of this.pigmentGrid) {
      if (drawn >= WET_RIM_CAP) break;
      const [cx, cy] = key.split(',');
      const x = (+cx + 0.5) * this.cell, y = (+cy + 0.5) * this.cell;
      if (!inView(x, y)) continue;
      const amount = Math.max(c.red, c.blue, c.green);
      const a = wetRimAlpha(amount);
      if (a < 0.02) continue; // fully dried
      // the freshest pigment color dictates the rim hue
      const hex = c.red >= c.blue && c.red >= c.green ? '#8a3420' : c.blue >= c.green ? '#2c5a9a' : '#3f6d28';
      ctx.globalAlpha = a;
      ctx.strokeStyle = hex;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(x, y, rimR, rimR * 0.9, 0, 0, TAU);
      ctx.stroke();
      drawn++;
    }
    ctx.restore();
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
      const k = rd.h;                    // 0..1 growth factor
      const hgt = 46 * k;                // pixel height
      // L1: the reed sways in a gentle breeze — the planted base holds while
      // the tip drifts on a per-reed sine (reedSway, small ±5px, scaled by the
      // growth factor so a sprout barely moves). Pure draw-time (a function of
      // `now` + rd.seed); the original bend/wobble is preserved.
      const sw = reedSway(rd.seed, now) * k;
      const tipx = rd.x + wobble(rd.seed, 1, 5) * k + sw;
      ctx.strokeStyle = rd.burn > 0 ? '#5a3b2a' : sat('#3a6d55', colorSat);
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(rd.x, rd.y);
      ctx.quadraticCurveTo(rd.x + 6 + sw * 0.5, rd.y - hgt * 0.6, tipx, rd.y - hgt);
      ctx.stroke();
      // cattail head (rides the swaying tip)
      if (k > 0.6) {
        ctx.fillStyle = rd.burn > 0 ? '#3b2a20' : sat('#7a5a3a', colorSat);
        ctx.beginPath();
        ctx.ellipse(tipx, rd.y - hgt - 4, 4, 9, 0, 0, TAU);
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

    // L1: drifting mist bands — 2-3 very-low-alpha procedural ellipses that
    // slow-parallax (lag the camera) and drift on their own. Pure draw-time:
    // the tile scroll S = (1+parallax)*view.x + now*speed, so on screen the
    // band advances at `parallax`× the camera plus a slow drift. Cull to view.
    const visL = view.x, visR = view.x + view.w / view.scale;
    for (const b of MIST_BANDS) {
      const span = 1200;
      const S = (1 + b.parallax) * view.x + now * b.speed + b.seed * 173;
      let k = Math.floor((visL - span - S) / span);
      for (let x = S + k * span; x < visR + span; x += span) {
        if (x + b.r < visL || x - b.r > visR) continue;
        const bob = Math.sin(now * 0.25 + b.seed) * 14;   // slow vertical drift
        ctx.globalAlpha = b.alpha;
        ctx.fillStyle = 'rgba(232,238,234,1)';
        ctx.beginPath();
        ctx.ellipse(x, b.y + bob, b.r, b.h * 0.5, 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // L1: a handful of staggered shimmer glints on the open water. Positions
    // come from the existing ripple spots (the open-water markers), capped at
    // SHIMMER_CAP so the draw cost never grows; each glint pulses on a
    // staggered sine (shimmerGlint) so they twinkle out of sync. Cull to view.
    let gl = 0;
    for (const rp of this.ripples) {
      if (gl >= SHIMMER_CAP) break;
      if (rp.x < visL || rp.x > visR || rp.y < view.y - 40 || rp.y > view.y + view.h / view.scale + 40) { gl++; continue; }
      const a = shimmerGlint(gl, now);
      if (a <= 0.02) { gl++; continue; }
      const gw = rp.r * (0.5 + 0.5 * a);
      ctx.globalAlpha = a * 0.5 * (0.4 + 0.6 * colorSat);
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, gw, gw * 0.4, 0, 0, TAU);
      ctx.fill();
      gl++;
    }
    ctx.globalAlpha = 1;
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
        // L2 (c): watercolor double-stroke — a second, low-alpha offset echo of
        // the edge so the outline reads as a hand-painted wash, not a hard line.
        this._doubleStroke(ctx, 0, 2, o.r, o.seed, 0.18, 9);
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
        // L2 (c): watercolor double-stroke (soft ink echo) for bushes too.
        this._doubleStroke(ctx, 0, 0, o.r, o.seed, 0.22, 11);
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

  // L2 (c): a second, low-alpha offset "watercolor double-stroke" — a soft ink
  // echo offset a hair from the main edge, at a slightly larger radius. Reads as
  // a hand-painted wash edge. Pure draw-time (one extra stroke per visible prop).
  _doubleStroke(ctx, cx, cy, r, seed, amp, points) {
    const off = 1.8;
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.18;
    traceBlob(ctx, cx + off, cy + off, r * 1.03, seed + 40, amp + 0.02, points);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // color "health" of the world: 0 gray -> 1 full
  worldColorSat() {
    return this._colorSat ?? 0.25;
  }
  restoreColor(amount) {
    this._colorSat = clamp((this._colorSat ?? 0.25) + amount, 0, 1);
  }
}