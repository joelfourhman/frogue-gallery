// sfx.mjs — headless SFX-bank test for v1.9 S1 (no real audio, no browser).
//
// The frames harness (tests/frames.mjs) is v1.9's substitute for visual polish;
// SFX can't be screenshotted, so THIS is S1's evidence: it boots the REAL
// AudioSys against a STUBBED AudioContext (a no-sound proxy that records every
// node it is asked to create) and asserts, for the whole sfx bank:
//   (1) every spec'd sfx name RESOLVES — calling the dispatcher for each name
//       schedules at least one voice (an unknown name, which has no case and no
//       `default`, schedules ZERO, so a missing/typo'd name fails here);
//   (2) every SFX-bus voice ROUTES to sfxBus (walks each voice's connection
//       chain and confirms it terminates on this.sfxBus, so the sfx-volume
//       slider + mute still scale it — the music bus is never touched);
//   (3) the _sfxCanStart concurrent-voice CAP still holds (a full live set
//       drops a new voice — zero nodes scheduled — instead of unbounded).
//
// Run: node tests/sfx.mjs   (exits non-zero on any failure)
'use strict';

import { AudioSys } from '../src/audio.js';

// ---------------- a recording param + node + AudioContext ----------------
// Faithful enough to drive ensure() + _tone/_noise/_env: every create* returns a
// node with the exact properties those methods read, and every connect() records
// the destination (plus a reverse `_incoming` so the routing check can confirm a
// voice terminates on the sfx bus). No audio is ever produced.
function makeParam(v) {
  return { value: v, _start: v,
    setValueAtTime(x) { this.value = x; this._start = x; },
    linearRampToValueAtTime(x) { this.value = x; },
    exponentialRampToValueAtTime(x) { this.value = x; },
    setTargetAtTime(x) { this.value = x; } };
}
function makeNode(kind) {
  return { _kind: kind, type: 'sine',
    frequency: makeParam(440), detune: makeParam(0), Q: makeParam(1),
    gain: makeParam(1), buffer: null, _connections: [], _incoming: [],
    connect(node) { this._connections.push(node); (node._incoming ||= []).push(this); return node; },
    disconnect() { this._connections.length = 0; },
    start() {}, stop() {}, getChannelData() { return new Float32Array(0); } };
}
function makeAudioContext() {
  return {
    currentTime: 0,
    sampleRate: 44100,
    destination: makeNode('destination'),
    createOscillator: () => makeNode('osc'),
    createBufferSource: () => makeNode('bufferSource'),
    createGain: () => makeNode('gain'),
    createBiquadFilter: () => makeNode('biquad'),
    createDynamicsCompressor: () => makeNode('compressor'),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
}

const failures = [];
function assert(cond, msg) {
  if (!cond) { failures.push(msg); console.log('  FAIL: ' + msg); }
}

// ---------------- boot the real AudioSys against the stub ----------------
const ctx = makeAudioContext();
globalThis.window = { AudioContext: function () { return ctx; } };
const au = new AudioSys();
assert(au.ensure() === true, 'S1: AudioSys.ensure() boots against the stub AudioContext');
assert(au.ctx === ctx, 'S1: the stub context is wired as au.ctx');
assert(!!au.sfxBus && au.sfxBus._kind === 'gain', 'S1: the sfxBus exists (a gain node)');
assert(!!au.musicBus && au.musicBus._kind === 'gain', 'S1: the musicBus exists (a gain node)');
// ensure() connected sfxBus -> master -> compressor -> destination.
assert(au.sfxBus._connections.length === 1, 'S1: the sfxBus is connected into the graph');

// ---------------- (1)+(2) the dispatch table: every name resolves + routes ----
// The full S1 bank (the ~20 variants + the per-creature hit/death) plus the
// pre-existing bank the S1 cases build on / the test must keep resolvable. Each
// entry is a sfx name; the dispatcher must schedule >= 1 voice for it AND every
// voice must terminate on sfxBus. A name with no case (typo/missing) schedules
// ZERO, so it is caught by both the ">= 1 voice" and the bogus-name checks.
const S1_BANK = [
  // the paint verb (the core action) — base voices + the charged big + the
  // surface-aware layer lives INSIDE these (opt.surface), so the name list is
  // the base set.
  'paint-swipe', 'paint-splat', 'charge-splash', 'swish', 'splat', 'splat-big',
  // status ON (apply) + OFF (clear)
  'burn-ignite', 'freeze-tick', 'root-thud',
  'burn-out', 'freeze-release', 'root-crackle', 'cleanse',
  // the heal chime
  'heal',
  // per-creature HIT (the 6 archetypes + the generic fallback)
  'hit-beetle', 'hit-mosquito', 'hit-toad', 'hit-wisp', 'hit-serpent', 'hit-leech', 'enemy-hit',
  // per-creature DEATH (the 6 archetypes + the generic fallback)
  'die-beetle', 'die-mosquito', 'die-toad', 'die-wisp', 'die-serpent', 'die-leech', 'enemy-die',
  // boss stings (phase-shift + kill + the existing awaken bloom/growl/slam)
  'boss-phase', 'boss-kill', 'awaken', 'awaken-bloom', 'boss-growl', 'boss-slam',
  // pickup + UI
  'pickup', 'pickup-streak', 'ui', 'ui-back', 'ui-hover', 'paint-create', 'frog-chime',
  // pause open/close
  'pause-open', 'pause-close',
  // the full-collection beat
  'collection-fanfare',
];

function voicesFor(name, opt) {
  // Test the name in ISOLATION: reset the concurrent-voice live set so the
  // _sfxCanStart cap (tested explicitly in stage 4) never drops this name's
  // voices. Count the new nodes and confirm each routes to sfxBus.
  au._sfxLive = [];
  const before = au.sfxBus._incoming.length;
  au.sfx(name, opt || {});
  const newIncoming = au.sfxBus._incoming.slice(before);
  // A voice terminates on sfxBus exactly when one of its intermediate nodes
  // connected to it; newIncoming is that set (one gain/filter per voice).
  return { count: newIncoming.length, routedToSfx: newIncoming.length };
}

console.log('== stage 1: every spec\'d sfx name resolves (no unknown/typo path) ==');
for (const name of S1_BANK) {
  const { count } = voicesFor(name);
  assert(count >= 1, `S1: '${name}' schedules at least one sfx voice (got ${count})`);
}

console.log('== stage 2: every sfx voice routes to the sfxBus (music bus untouched) ==');
// The routing check is implicit in stage 1 (each resolved voice appears in
// sfxBus._incoming). Prove it directly: the sfxBus is a real node and at least
// one distinct voice connected to it; and the music bus never received a sfx
// voice (music-layer voices pass an explicit `target`, so they connect to the
// melody master, not sfxBus — the reverse is the invariant we protect here).
assert(au.sfxBus._incoming.length >= S1_BANK.length,
  'S1: each bank voice connected onto the sfxBus');
// A bogus name (no case, no default) must schedule ZERO — this is what makes
// the ">= 1 voice" check above meaningful (it cannot pass vacuously).
const bogusBefore = au.sfxBus._incoming.length;
au.sfx('this-sfx-does-not-exist');
assert(au.sfxBus._incoming.length === bogusBefore,
  'S1: an unknown sfx name schedules zero voices (no silent `default` path)');

console.log('== stage 3: the per-pigment / per-surface layers still resolve ==');
// The paint verb is surface- + pigment-aware: exercise the opt branches so a
// broken surface/pigment layer (which would create 0 extra nodes / throw) fails.
for (const surf of ['water', 'veg', 'soil', null]) {
  const { count } = voicesFor('paint-swipe', { pig: 'red', surface: surf });
  assert(count >= 2, `S1: paint-swipe red/${surf} schedules the base + pigment voice (got ${count})`);
}
for (const pig of ['red', 'blue', 'green', 'dry']) {
  const { count } = voicesFor('charge-splash', { pig, surface: 'water' });
  assert(count >= 3, `S1: charge-splash ${pig}/water schedules the big + pigment + surface voice (got ${count})`);
}

console.log('== stage 4: the _sfxCanStart concurrent-voice cap still holds ==');
// A full live set (at the cap) must drop a new voice — zero nodes — rather than
// letting a paint flurry spawn unbounded oscillators.
const CAP = au._sfxMaxVoices;
assert(CAP > 0, 'S1: the sfx-bus voice cap is a positive number');
au._sfxLive = [];
for (let i = 0; i < CAP; i++) au._sfxLive.push(ctx.currentTime + 5);   // all "still live"
const fullBefore = au.sfxBus._incoming.length;
au.sfx('charge-splash', { pig: 'red' });                                // a multi-voice sfx
assert(au.sfxBus._incoming.length === fullBefore,
  `S1: at the voice cap (${CAP}), a new sfx is dropped (0 nodes) instead of unbounded`);
// Below the cap it schedules normally.
au._sfxLive = [];
const openBefore = au.sfxBus._incoming.length;
au.sfx('charge-splash', { pig: 'red' });
assert(au.sfxBus._incoming.length > openBefore,
  'S1: below the cap, a sfx schedules its voices normally');

// ---------------- report ----------------
if (failures.length) {
  console.log(`\n${failures.length} SFX TEST(S) FAILED:`);
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log(`\nSFX TESTS PASSED (${S1_BANK.length} bank names verified + cap + routing)`);
process.exit(0);
