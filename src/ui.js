// ui.js — shared canvas UI helpers (paper panels, wobbly buttons, text).
'use strict';
import { traceBlob, traceWobblyRect, wobble, clamp } from './math.js';

// ---- L4 (v1.9): the shared UI grade. ONE paper/pigment palette, ONE typeface
// family, ONE type scale. Every panel / HUD / title / gallery / seed-card /
// recap draw routes its paper-theme colors through UI.palette and its fonts
// through uiFont() (below). Presentation-only: no layout or behavior change,
// no new font, no new rendering mode (grain + vignette remain the shared grade).
export const UI = {
  // The paper / ink grade — single source of truth for the paper theme.
  palette: {
    paper: '#f4ead8',      // panel body
    paperDark: '#e7d9c2',  // pressed / recessed paper
    paperLight: '#fdf6e9', // hover highlight, on-dark text
    ink: '#2b2320',        // the line + body ink
    gold: '#c9922a',       // gold-tier accent
    green: '#5a9e3d',      // the swamp's green accent
  },
  // One serif family is the voice of the paper UI. The display typeface (the
  // painter's handwriting) is a NAMED EXCEPTION used only by the title screen
  // and the in-run banner buttons — recorded here so it is a decision, not drift.
  serif: 'Georgia, serif',
  display: '"Comic Sans MS", "Segoe Print", cursive',
  // A SECOND named exception: the monospace family, used ONLY for the
  // export/save-blob preview field (a code-like text dump reads best monospaced).
  // It routes through uiFont({ mono: true }) so it is a decision, not drift.
  mono: '"Courier New", monospace',
  // The type scale — the canonical font sizes (px) the UI is drawn in. EVERY
  // static UI draw sizes its text from one of these named steps (via
  // uiFont(UI.sizes.<step>)); the handful of genuinely dynamic sizes (the
  // float-text pop, the uiButton height-scaled label) are the documented
  // exceptions and pass a computed number. One scale, no ad-hoc magic sizes.
  sizes: {
    micro: 9, tiny: 10, tinyPlus: 10.5, xsmall: 11, small: 12,
    smallPlus: 12.5, label: 13, body: 14, bodyPlus: 14.5, bodyLg: 15,
    sub: 16, subPlus: 17, subLg: 18, title: 19, titlePlus: 20,
    h3: 22, h2: 23, h1Sm: 24, h1: 26, heroSm: 30, display: 34,
    displayLg: 40, displayXl: 46, mega: 72, megaLg: 96,
  },
};

// Paper-theme primitives — derived from UI.palette (single source of truth).
export const INK = UI.palette.ink;
export const PAPER = UI.palette.paper;
export const PAPER_DARK = UI.palette.paperDark;

// L4: the font factory. Every UI draw builds its font through this so the
// typeface family, weight, and size all come from ONE scale. `display` routes
// to the named display-typeface exception; otherwise the serif family. A weight
// of 400 (normal) is omitted from the string — byte-identical to the pre-L4
// literals, so no frame changes except where L4 intends.
//
// P10 (the pass adds NO per-frame allocation): MEMOIZED. The same
// (size, weight, italic, display) tuple resolves to the SAME cached string after
// the first frame — matching the pre-L4 profile where static font LITERALS were
// interned (0 allocs/frame). The key set is BOUNDED: the finite 25-step size
// scale × a small weight set, and the few dynamic sizes (the float-text pop,
// 11–20, and the uiButton height-scaled label) each span only a bounded range —
// so the cache cannot grow unbounded. Steady-state UI draws are allocation-free.
const _uiFontCache = new Map();
export function uiFont(px, { weight = 400, italic = false, display = false, mono = false } = {}) {
  const key = px + '|' + weight + '|' + (italic ? 1 : 0) + '|' + (display ? 1 : 0) + '|' + (mono ? 1 : 0);
  let s = _uiFontCache.get(key);
  if (s === undefined) {
    const family = display ? UI.display : (mono ? UI.mono : UI.serif);
    const w = weight === 400 ? '' : `${weight} `;
    s = `${italic ? 'italic ' : ''}${w}${px}px ${family}`;
    _uiFontCache.set(key, s);
  }
  return s;
}

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
  ctx.font = uiFont(opts.size || Math.min(20, h * 0.45), { display: true });
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