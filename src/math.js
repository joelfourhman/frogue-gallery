// math.js — small, allocation-light math + shape helpers (no DOM).
'use strict';

export const TAU = Math.PI * 2;

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }
export function norm(x, y) { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
export function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}
// Framerate-independent exponential approach.
export function approach(cur, target, rate, dt) { return lerp(cur, target, 1 - Math.exp(-rate * dt)); }

// Deterministic RNG (mulberry32).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable "wobble" hash for organic per-entity outline jitter.
export function wobble(seed, i, amp) {
  let h = (seed * 374761393 + i * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  h = h ^ (h >>> 16);
  return ((h % 1000) / 1000 - 0.5) * 2 * amp;
}

// Draw a closed blob path around (cx,cy) with radius + wobble.
export function traceBlob(ctx, cx, cy, r, seed, amp = 0.12, points = 14) {
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * TAU;
    const rr = r * (1 + wobble(seed, i % points, amp));
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.92;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Open wobbly polyline (used for reeds, ripples).
export function traceWobblyLine(ctx, x0, y0, x1, y1, seed, segs = 6, amp = 4) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  const [nx, ny] = norm(x1 - x0, y1 - y0);
  const px = -ny, py = nx;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const off = wobble(seed, i, amp);
    ctx.lineTo(x0 + (x1 - x0) * t + px * off, y0 + (y1 - y0) * t + py * off);
  }
}

export function pick(rand, arr) { return arr[Math.floor(rand() * arr.length) % arr.length]; }