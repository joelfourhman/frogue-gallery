// ui.js — shared canvas UI helpers (paper panels, wobbly buttons, text).
'use strict';
import { traceBlob, traceWobblyRect, wobble, clamp } from './math.js';

export const INK = '#2b2320';
export const PAPER = '#f4ead8';
export const PAPER_DARK = '#e7d9c2';

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Paper panel with an organic edge.
export function paperPanel(ctx, x, y, w, h, opts = {}) {
  const seed = opts.seed || 7;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(wobble(seed, 0, 0.004));
  ctx.translate(-w / 2, -h / 2);
  // shadow
  ctx.fillStyle = 'rgba(43,35,32,0.18)';
  traceWobblyRect(ctx, 4, 4, w, h, Math.min(22, h / 2), seed + 1, 0.015, 26);
  ctx.fill();
  // body
  ctx.fillStyle = opts.fill || PAPER;
  traceWobblyRect(ctx, 0, 0, w, h, Math.min(22, h / 2), seed, 0.015, 26);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.85;
  traceWobblyRect(ctx, 0, 0, w, h, Math.min(22, h / 2), seed, 0.015, 26);
  ctx.stroke();
  ctx.restore();
  // interior clip for content
  ctx.save();
  roundRectPath(ctx, x + 8, y + 8, w - 16, h - 16, 10);
  ctx.clip();
  return ctx;
}

export function paperEnd(ctx) { ctx.restore(); }

// Button with hover; returns {x,y,w,h,hover,clicked}
export function uiButton(ctx, x, y, w, h, label, hover, pressed = false, opts = {}) {
  const scale = pressed ? 0.96 : hover ? 1.04 : 1;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  const rr = Math.min(16, h / 2);
  ctx.fillStyle = pressed ? PAPER_DARK : hover ? '#fdf6e9' : PAPER;
  traceWobblyRect(ctx, 0, 0, w, h, rr, opts.seed || 3, 0.02, 22);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  traceWobblyRect(ctx, 0, 0, w, h, rr, opts.seed || 3, 0.02, 22);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `${opts.size || Math.min(20, h * 0.45)}px "Comic Sans MS", "Segoe Print", cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, h / 2 + 1);
  ctx.restore();
  const mx = opts.mouseX, my = opts.mouseY;
  const hovered = mx >= x && mx <= x + w && my >= y && my <= y + h;
  return { x, y, w, h, hover: hovered, clicked: hovered && (opts.mouseClicked || false) };
}

export function centerText(ctx, text, x, y, font, color = INK, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function outlineText(ctx, text, x, y, font, fill = '#fff', stroke = INK, lw = 4) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Heart / pip row
export function drawPips(ctx, x, y, r, count, filled, color) {
  for (let i = 0; i < count; i++) {
    const px = x + i * (r * 2.6);
    ctx.beginPath();
    ctx.arc(px, y, r, 0, Math.PI * 2);
    if (i < filled) { ctx.fillStyle = color; ctx.fill(); }
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

// Desaturate a hex color toward gray (for the "gray swamp" effect).
const _rgbCache = {};
function hexRgb(hex) {
  let c = _rgbCache[hex];
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = _rgbCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return c;
}
export function sat(hex, amount) { // amount 0..1 (1 = full color)
  const [r, g, b] = hexRgb(hex);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const rr = Math.round(lum + (r - lum) * amount);
  const gg = Math.round(lum + (g - lum) * amount);
  const bb = Math.round(lum + (b - lum) * amount);
  return `rgb(${rr},${gg},${bb})`;
}

export function mixColor(c1, c2, t) { // both hex
  const [r1, g1, b1] = hexRgb(c1);
  const [r2, g2, b2] = hexRgb(c2);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}