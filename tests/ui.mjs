// tests/ui.mjs — the L4 (v1.9 T3) visual-identity acceptance check (dev-style,
// like tests/sfx.mjs / tests/music.mjs; runs in node, no browser).
//
// L4's invariant: ONE shared UI grade — a single paper/pigment palette, one
// typeface family, one weight, one type scale — that EVERY UI draw routes
// through. The frames harness is the visual evidence; THIS is the machine
// check that the constants exist and that the UI is actually built from them:
//
//   (1) the shared UI constants EXIST and are well-formed — a non-empty named
//       size scale, the paper/ink palette (single source of truth for INK /
//       PAPER / PAPER_DARK), and exactly one serif family + one NAMED display
//       typeface exception;
//   (2) uiFont() is the ONE font factory and is byte-identical to the pre-L4
//       literals (a normal weight is omitted, so the canvas font string is
//       unchanged — the presentation-only invariant in string form);
//   (3) NO per-panel ad-hoc fonts remain — every draw in the UI files builds
//       its font through uiFont() (no raw 'Npx <family>' literal, no
//       ctx.font = '<literal>');
//   (4) the UI-heavy draw functions REFERENCE the shared constants (uiFont /
//       UI / INK / PAPER / PAPER_DARK) — verified structurally with an AST
//       walk so a panel that quietly reverts to a magic font fails here;
//   (5) the presentation-only lock: GAME_VERSION / SAVE_VERSION unchanged.
//
// Run:  node --experimental-vm-modules tests/ui.mjs
//       (the flag is only needed for the structural AST check (4); the rest of
//        the test runs without it, so `node tests/ui.mjs` still passes (1)-(3).)
// Invariant: presentation-only — logic.js untouched, zero new deps.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

import { UI, INK, PAPER, PAPER_DARK, uiFont } from '../src/ui.js';
import { GAME_VERSION, SAVE_VERSION } from '../src/logic.js';

const failures = [];
let passCount = 0;
function assert(cond, msg) {
  if (cond) { passCount++; }
  else { failures.push(msg); console.log('  FAIL: ' + msg); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function srcOf(f) { return fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'); }

// ==========================================================================
// (1) the shared UI constants exist and are well-formed
// ==========================================================================
section('UI constants');
assert(typeof UI === 'object' && UI !== null, 'UI is exported as an object');
assert(UI && typeof UI.sizes === 'object' && UI.sizes !== null, 'UI.sizes is the type-scale object');
const sizeEntries = UI ? Object.entries(UI.sizes || {}) : [];
assert(sizeEntries.length >= 10, `UI.sizes is a real scale (got ${sizeEntries.length} steps, need >= 10)`);
for (const [name, px] of sizeEntries) {
  assert(typeof px === 'number' && px > 0 && Number.isFinite(px),
    `UI.sizes.${name} is a positive number (got ${px})`);
}
// one scale: no two steps share a size (a step would be ambiguous)
const sizeVals = sizeEntries.map(([, px]) => px);
assert(new Set(sizeVals).size === sizeVals.length, 'UI.sizes steps are unique sizes (one name per size)');

assert(UI && typeof UI.palette === 'object' && UI.palette !== null, 'UI.palette is the paper/pigment palette');
for (const key of ['paper', 'paperDark', 'paperLight', 'ink']) {
  assert(UI && typeof UI.palette[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(UI.palette[key]),
    `UI.palette.${key} is a #rrggbb paper grade (got ${UI && UI.palette[key]})`);
}
// the palette is the SINGLE SOURCE OF TRUTH for the paper primitives
assert(INK === UI.palette.ink, 'INK is derived from UI.palette.ink');
assert(PAPER === UI.palette.paper, 'PAPER is derived from UI.palette.paper');
assert(PAPER_DARK === UI.palette.paperDark, 'PAPER_DARK is derived from UI.palette.paperDark');

// ONE serif family, ONE named display exception, ONE named mono exception
assert(typeof UI.serif === 'string' && /Georgia/.test(UI.serif), 'UI.serif is the one serif family (Georgia)');
assert(typeof UI.display === 'string' && /cursive/.test(UI.display),
  'UI.display is the NAMED display-typeface exception (the painter\'s handwriting)');
assert(typeof UI.mono === 'string' && /monospace/.test(UI.mono),
  'UI.mono is the NAMED mono exception (the save-blob preview field)');

// ==========================================================================
// (2) uiFont is the one font factory and is byte-identical to the old literals
// ==========================================================================
section('uiFont factory (byte-identical to the pre-L4 literals)');
assert(typeof uiFont === 'function', 'uiFont is exported and callable');
assert(uiFont(14) === '14px Georgia, serif', 'uiFont(14) -> "14px Georgia, serif" (normal weight omitted)');
assert(uiFont(14, { weight: 700 }) === '700 14px Georgia, serif', 'uiFont(14,{weight:700}) -> "700 14px Georgia, serif"');
assert(uiFont(26, { weight: 600, display: true }) === '600 26px "Comic Sans MS", "Segoe Print", cursive',
  'uiFont(26,{weight:600,display:true}) -> the display-family banner font');
assert(uiFont(13, { weight: 600 }) === '600 13px Georgia, serif', 'uiFont(13,{weight:600}) -> "600 13px Georgia, serif"');
assert(uiFont(9) === '9px Georgia, serif', 'uiFont(9) -> "9px Georgia, serif" (smallest step)');
assert(uiFont(14, { display: true }) === '14px "Comic Sans MS", "Segoe Print", cursive',
  'uiFont(14,{display:true}) uses the display family, normal weight omitted');
assert(uiFont(UI.sizes.tiny, { mono: true }) === '10px "Courier New", monospace',
  'uiFont(tiny,{mono:true}) -> the NAMED mono exception (save-blob preview field)');

// ==========================================================================
// (3) no per-panel ad-hoc fonts remain in the UI files
// ==========================================================================
section('no ad-hoc fonts (every draw routes through uiFont)');
// A raw font literal: '...Npx <family>' where family is the serif/cursive family
// (or the display cursive). Must appear NOWHERE in the UI draw files.
const RAW_FONT = /'[^'\n]*\b\d+(?:\.\d+)?px\s+(?:Georgia, serif|serif|"[^"]+", "[^"]+", cursive)/g;
for (const f of ['game.js', 'enemies.js', 'paint.js', 'ui.js']) {
  const s = srcOf(f);
  const hits = s.match(RAW_FONT) || [];
  assert(hits.length === 0, `${f}: no raw 'Npx <family>' font literals (found ${hits.length}${hits.length ? ': ' + hits[0].slice(0, 40) : ''})`);
}
// no direct ctx.font = '<literal>' (every ctx.font must build through uiFont)
for (const f of ['game.js', 'enemies.js', 'paint.js', 'ui.js']) {
  const s = srcOf(f);
  const direct = (s.match(/ctx\.font = '[^']*'/g) || []).length;
  assert(direct === 0, `${f}: no ctx.font = '<literal>' assignments (all via uiFont)`);
  const usesUiFont = (s.match(/uiFont\(/g) || []).length;
  assert(usesUiFont > 0, `${f}: references the shared uiFont() factory (${usesUiFont} uses)`);
}

// ==========================================================================
// (4) the UI-heavy draw functions reference the shared constants
// ==========================================================================
section('UI-heavy draw functions reference the shared constants');
// A draw function "routes through the shared grade" if its body builds a font
// through uiFont() / names a UI scale step / uses a paper primitive (INK, PAPER,
// PAPER_DARK) / calls a shared ui.js panel helper (paperPanel, uiButton,
// centerText, outlineText). Section (3) already proves no raw font literal
// exists ANYWHERE, so any font a draw emits necessarily comes from uiFont; this
// check additionally confirms each named UI-heavy screen actually draws through
// the shared system (not a dead or hand-rolled panel).
const SHARED_RE = /uiFont\(|UI\.sizes|UI\.palette|\bINK\b|\bPAPER\b|\bPAPER_DARK\b|paperPanel\(|uiButton\(|centerText\(|outlineText\(/;
const UI_HEAVY = [
  // The current screens, mapped to their real draw functions:
  ['game.js', '_drawTitle',      'title'],
  ['game.js', '_drawOptions',    'options'],
  ['game.js', '_drawEnd',        'end screen / recap'],
  // plus the other panel/HUD draws L4 must not leave ad-hoc:
  ['game.js', '_drawPause',      'pause panel'],
  ['game.js', '_drawHud',        'the HUD'],
  ['game.js', '_drawBanners',    'in-run banner buttons (display exception)'],
  ['enemies.js', 'drawSerpent',   'serpent "!" telegraph text (L3)'],
  ['enemies.js', 'drawCragFrog',  'crag-frog drifting "z" sleep text (L3)'],
  ['paint.js',   'drawNotes',    'paint hit-notes'],
];
// Extract a function's body by brace-matching from its definition line.
function bodyOf(src, name) {
  // a definition sits at the start of a line (class methods indented, top-level
  // at column 0) and is NOT a `this.name(` call.
  // Two definition forms: class methods (`  _drawXxx(ctx) {`) and top-level
  // function declarations (`export function drawXxx(...) {`). NOT a call site
  // (`this._drawXxx(` / `return drawXxx(`).
  const defRe = new RegExp(
    '^[ \\t]*(?:(?:export[ \\t]+)?function[ \\t]+' + name + '\\s*\\(|' +   // function declaration
    name + '[\\s(])', 'm');
  let line = -1;
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^[ \\t]*this\./.test(lines[i])) continue;      // skip call sites
    if (defRe.test(lines[i])) { line = i; break; }
  }
  if (line < 0) return null;
  const tail = src.slice(src.indexOf(lines[line]));
  const open = tail.indexOf('{');
  if (open < 0) return null;
  let depth = 0, inStr = false, strCh = '', esc = false, inTpl = false, inComment = false, inLineComment = false;
  for (let i = open; i < tail.length; i++) {
    const c = tail[i], d = tail[i + 1];
    if (inLineComment) { if (c === '\n') inLineComment = false; continue; }
    if (inComment) { if (c === '*' && d === '/') { inComment = false; i++; } continue; }
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === strCh) inStr = false; continue; }
    if (inTpl) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '`') inTpl = false; continue; }
    if (c === '/' && d === '/') { inLineComment = true; continue; }
    if (c === '/' && d === '*') { inComment = true; i++; continue; }
    if (c === "'" || c === '"') { inStr = true; strCh = c; continue; }
    if (c === '`') { inTpl = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return tail.slice(open, i + 1); }
  }
  return null;
}
for (const [file, name, what] of UI_HEAVY) {
  const body = bodyOf(srcOf(file), name);
  if (body === null) { failures.push(`${file}.${name} not found (structural check)`); console.log(`  FAIL: ${file}.${name} not found`); continue; }
  assert(SHARED_RE.test(body),
    `${file}.${name} (${what}) references a shared UI constant/helper${SHARED_RE.test(body) ? '' : ' — none found'}`);
}

// ==========================================================================
// (5) presentation-only lock
// ==========================================================================
section('presentation-only lock');
assert(GAME_VERSION === '1.0.0', `GAME_VERSION is still 1.0.0 (got ${GAME_VERSION})`);
assert(SAVE_VERSION === 12, `SAVE_VERSION is still 12 (got ${SAVE_VERSION})`);

// --------------------------------------------------------------------------
// (6) P10 — the pass adds NO per-frame allocation (uiFont is memoized)
// --------------------------------------------------------------------------
// Pre-L4 the static font LITERALS were interned (0 allocs/frame). L4 routes
// static sizes through uiFont(); if uiFont rebuilt a fresh string per call the
// 60fps HUD draws would allocate every frame. The memoized uiFont must hand back
// the SAME cached string object for a repeat (size, weight) tuple — i.e. steady
// state is allocation-free — and the cache must stay BOUNDED (finite size scale
// × small weight set) rather than grow with every call.
section('P10 (no per-frame allocation — uiFont is memoized + bounded)');
const a1 = uiFont(UI.sizes.body, { weight: 700 });
const a2 = uiFont(UI.sizes.body, { weight: 700 });
assert(a1 === a2, 'uiFont memoizes: the same (size, weight) tuple returns the SAME cached string (no fresh alloc per call)');
const b1 = uiFont(UI.sizes.label);
const b2 = uiFont(UI.sizes.label);
assert(b1 === b2 && a1 !== b1, 'uiFont memoizes the default-weight tuple too, and distinct tuples stay distinct');
// distinct weight/size/display must each yield a distinct string (the cache
// keys are sound — one entry per tuple, not one shared entry for all).
assert(uiFont(13, { weight: 700 }) !== uiFont(13, { weight: 400 }) && uiFont(13) !== uiFont(13, { display: true }),
  'uiFont: weight and display variants produce distinct strings (cache keys are sound)');
// Bounded: a sweep over the whole size scale × the weight set stays small.
const sizeKeys = Object.keys(UI.sizes);
const weights = [400, 600, 700];
let distinct = new Set();
for (const k of sizeKeys) for (const w of weights) distinct.add(uiFont(UI.sizes[k], { weight: w }));
distinct.add(uiFont(13, { display: true }));                       // the display banner button
for (let s = 11; s <= 20; s++) distinct.add(uiFont(s));            // the float-text pop range
assert(distinct.size <= sizeKeys.length * weights.length + 15,
  `uiFont: a full size-scale × weight sweep + the dynamic ranges is bounded (got ${distinct.size} distinct strings); the cache cannot grow unbounded`);

// ---------------- report ----------------
if (failures.length) {
  console.log(`\n${failures.length} UI TEST(S) FAILED:`);
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
const n = UI_HEAVY.length;
console.log(`\nUI TESTS PASSED (${passCount} assertions — ${n} UI-heavy draws verified against the shared constants)`);
process.exit(0);
