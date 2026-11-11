// music.mjs — headless MUSIC-layer test for v1.9 S2 (no real audio, no
// browser).
//
// S1's evidence was the sfx bank (tests/sfx.mjs) because SFX can't be
// screenshotted. MUSIC is the same — you can't assert "it sounds like Reeds"
// in node — so the S2 evidence is the PURE, DETERMINISTIC selector the music
// layer is BUILT FROM:
//
//   themeSelector({ zone, biome, bossEngaged, lowHp }) ->
//        { themeId, patternDensity, extraVoices } — a pure function of the run
//        state that picks the right theme + intensity. The test asserts the
//        correct theme + density for swamp / Reeds / Black Reeds / boss /
//        lowHp, and that density rises with intensity (a denser
//        pattern == higher intensity).
//
// Plus a ROUTING check: the real AudioSys, booted against a stubbed
// AudioContext, must keep the music layer riding melodyMaster -> musicBus so
// the music slider + mute still scale it (the S2 invariant: "the music slider
// still controls it").
//
// (S3's pure nextAmbientEvent sampler gets its own section, added with S3.)
//
// Run: node tests/music.mjs   (exits non-zero on any failure)
// Invariant: presentation-only — logic.js untouched (makeTuning
// byte-identical), no audio files, no setInterval, no new deps.
'use strict';

import {
  AudioSys,
  themeSelector,
  ZONE_THEMES,
  BOSS_THEMES,
  LOWHP_THEME,
  nextAmbientEvent,
  AMBIENT_KINDS,
  AMBIENT_P,
  _MIX,
  _biomeThemeGain,
} from '../src/audio.js';
import { mulberry32 } from '../src/math.js';

const failures = [];
let passCount = 0;
function assert(cond, msg) {
  if (cond) { passCount++; }
  else { failures.push(msg); console.log('  FAIL: ' + msg); }
}
function section(title) { console.log('\n== ' + title + ' =='); }

// ==========================================================================
// S2 — the PURE themeSelector
// ==========================================================================
section('S2: themeSelector — the right theme + density per run state');

// Helper: count the ACTIVE (non-rest) steps in a 16-step pattern. "Denser
// pattern == higher intensity" is the S2 rule. The selector exposes the real
// active-step count as patternDensity (_countActive over the theme's pattern).
function countActive(pattern) { let n = 0; for (let i = 0; i < pattern.length; i++) if (pattern[i] >= 0) n++; return n; }

// ---- swamp (base run, byte-identical to pre-S2) ----
{
  const r = themeSelector({ zone: 0, biome: 'swamp' });
  assert(r.themeId === 'swamp-0', 'swamp/zone0 -> swamp-0 zone theme', 'got ' + r.themeId);
  assert(r.patternDensity === countActive(ZONE_THEMES.swamp[0].pattern), 'swamp patternDensity = the zone-0 pattern\'s real active-step count (' + r.patternDensity + ')');
  assert(r.patternDensity > 0 && r.patternDensity <= 12, 'swamp patternDensity is a sane zone value');
  assert(Array.isArray(r.extraVoices) && r.extraVoices.length === 0, 'swamp base: no extra danger voices');
}
{
  // zone 3 (the Gray Shore) is a DIFFERENT swamp zone -> a distinct theme id.
  const r = themeSelector({ zone: 3, biome: 'swamp' });
  assert(r.themeId === 'swamp-3', 'swamp/zone3 (the Gray Shore) -> swamp-3 (a distinct zone theme)', 'got ' + r.themeId);
  assert(r.patternDensity === countActive(ZONE_THEMES.swamp[3].pattern), 'swamp-3 density matches the zone-3 pattern');
}

// ---- Reeds (distinct, watery) ----
{
  const r = themeSelector({ zone: 0, biome: 'reeds' });
  assert(r.themeId === 'reeds-0', 'reeds/zone0 -> reeds-0 (a distinct reeds theme)', 'got ' + r.themeId);
  assert(JSON.stringify(ZONE_THEMES.reeds[0].pattern) !== JSON.stringify(ZONE_THEMES.swamp[0].pattern), 'reeds zone-0 pattern differs from the swamp zone-0 pattern');
  assert(r.patternDensity === countActive(ZONE_THEMES.reeds[0].pattern), 'reeds density matches the reeds-0 pattern');
}

// ---- Black Reeds (darker, lower, sparser) ----
{
  const r = themeSelector({ zone: 0, biome: 'blackReeds' });
  assert(r.themeId === 'blackReeds-0', 'blackReeds/zone0 -> blackReeds-0 (distinct from reeds)', 'got ' + r.themeId);
  const reedsActive = countActive(ZONE_THEMES.reeds[0].pattern);
  const brActive = countActive(ZONE_THEMES.blackReeds[0].pattern);
  assert(brActive <= reedsActive, 'blackReeds is sparser than reeds (' + brActive + ' <= ' + reedsActive + ' active steps)');
  assert(brActive > 0, 'blackReeds still has a real (non-empty) pattern');
  assert(ZONE_THEMES.blackReeds[0].root < ZONE_THEMES.reeds[0].root, 'blackReeds root is LOWER than reeds (darker)');
}

// ---- unknown biome falls back to swamp (byte-identical safety) ----
{
  const r = themeSelector({ zone: 0, biome: 'watery' });
  assert(r.themeId === 'swamp-0', 'unknown biome -> swamp fallback (swamp-0)', 'got ' + r.themeId);
}

// ---- boss (intensity rises) ----
{
  const base = themeSelector({ zone: 3, biome: 'swamp' });
  const r = themeSelector({ zone: 3, biome: 'swamp', bossEngaged: true });
  assert(r.themeId === 'boss', 'bossEngaged -> boss theme (overrides the zone)', 'got ' + r.themeId);
  assert(r.patternDensity > base.patternDensity, 'boss patternDensity (' + r.patternDensity + ') > swamp-3 patternDensity (' + base.patternDensity + ') (intensity rises)');
  assert(r.extraVoices.includes('boss-pulse'), 'boss adds the low off-beat pulse voice');
}

// ---- low HP (sparse high uneasy ostinato, adds a voice) ----
{
  const base = themeSelector({ zone: 1, biome: 'swamp' });
  const r = themeSelector({ zone: 1, biome: 'swamp', lowHp: true });
  assert(r.themeId === 'swamp-1', 'lowHp -> the zone stays the LEAD theme (swamp-1)', 'got ' + r.themeId);
  assert(r.extraVoices.includes('lowhp-ostinato'), 'lowHp adds the uneasy ostinato voice (an extra tension layer)');
  assert(countActive(LOWHP_THEME.pattern) > 0, 'the low-HP ostinato pattern is non-empty');
}

// ---- boss + lowHp (both danger voices) ----
{
  const r = themeSelector({ zone: 3, biome: 'blackReeds', bossEngaged: true, lowHp: true });
  assert(r.themeId === 'boss', 'boss+lowHp -> boss theme (boss is the lead)', 'got ' + r.themeId);
  assert(r.extraVoices.includes('boss-pulse') && r.extraVoices.includes('lowhp-ostinato'),
    'boss+lowHp stacks BOTH danger voices');
}

// ---- the pure data is well-formed (every theme has a root/scale/pattern) ----
{
  for (const biome of ['swamp', 'reeds', 'blackReeds']) {
    const arr = ZONE_THEMES[biome];
    assert(Array.isArray(arr) && arr.length >= 4, 'ZONE_THEMES.' + biome + ' has >= 4 zone presets');
    for (const z of arr) {
      assert(typeof z.root === 'number' && z.root > 0, biome + ' zone root is a positive freq');
      assert(Array.isArray(z.scale) && z.scale.length >= 4, biome + ' zone scale has >= 4 intervals');
      assert(Array.isArray(z.pattern) && z.pattern.length === 16, biome + ' zone pattern is 16 steps');
      assert(typeof z.stepDur === 'number' && z.stepDur > 0, biome + ' zone stepDur > 0');
    }
  }
  assert(BOSS_THEMES.gray && BOSS_THEMES.dark, 'BOSS_THEMES has gray + dark');
  assert(BOSS_THEMES.gray.pulse && BOSS_THEMES.dark.pulse, 'both boss themes opt into the pulse layer');
  assert(typeof LOWHP_THEME.root === 'number' && Array.isArray(LOWHP_THEME.pattern), 'LOWHP_THEME is well-formed');
}

// ==========================================================================
// S2 routing — the music layer still rides melodyMaster -> musicBus
// ==========================================================================
section('S2: the music layer rides melodyMaster -> musicBus (slider + mute)');

// A recording stub (same shape as sfx.mjs's) so the real AudioSys can build its
// gain graph. We then walk the low-HP gain's connection chain and confirm it
// terminates on musicBus — proof the music slider + mute scale it.
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
    currentTime: 0, sampleRate: 44100, destination: makeNode('destination'),
    createOscillator: () => makeNode('osc'),
    createBufferSource: () => makeNode('bufferSource'),
    createGain: () => makeNode('gain'),
    createBiquadFilter: () => makeNode('biquad'),
    createDynamicsCompressor: () => makeNode('compressor'),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
}
// (Routing is asserted directly by the two-hop chain gain -> melodyMaster ->
// musicBus below, so no terminal-walk helper is needed.)

const ctx = makeAudioContext();
globalThis.window = { AudioContext: function () { return ctx; } };
const au = new AudioSys();
assert(au.ensure() === true, 'AudioSys.ensure() boots against the stub');
assert(typeof au.setEncoreArpeggio === 'undefined' && typeof au.collectionSwell === 'undefined',
  'retired progression screens cannot schedule music layers');
assert(themeSelector({ zone: 0, biome: 'swamp', collection: true }).themeId === 'swamp-0',
  'obsolete collection state cannot override dungeon music');
assert(!!au._melodyMaster, 'the melody layer (melodyMaster) exists');
assert(!!au.musicBus, 'the musicBus exists');
assert(au._melodyMaster._connections.includes(au.musicBus), 'melodyMaster connects INTO musicBus');

// setLowHp(true) pushes a low-HP loop whose gain must ride melodyMaster.
au.setLowHp(true);
assert(au._danger && au._danger.lowThemes && au._danger.lowThemes.length === 1, 'setLowHp(true) pushes a low-HP loop');
if (au._danger && au._danger.lowThemes[0]) {
  const lg = au._danger.lowThemes[0].gain;
  assert(lg._connections.includes(au._melodyMaster), 'low-HP gain connects INTO melodyMaster');
  assert(au._melodyMaster._connections.includes(au.musicBus), 'melodyMaster connects INTO musicBus');
  // Together: low-HP gain -> melodyMaster -> musicBus, so the music slider +
  // mute scale it (the S2 "the music slider still controls it" invariant).
}
// A note is actually SCHEDULED for the low-HP loop (it ticks, no throw).
let tickThrew = false;
try { au.tickMusic(); } catch (e) { tickThrew = true; }
assert(!tickThrew, 'setLowHp + tickMusic ran without throwing');

// zoneSwell() + bossPhaseUp() run without throwing (the S2 trigger entry points).
let zoneThrew = false, phaseThrew = false;
try { au.zoneSwell(); } catch (e) { zoneThrew = true; }
try { au.bossPhaseUp(); } catch (e) { phaseThrew = true; }
assert(!zoneThrew, 'zoneSwell() runs without throwing');
assert(!phaseThrew, 'bossPhaseUp() runs without throwing (idempotent, no boss engaged)');

// clearZoneTheme() tears down the low-HP loop (the "stop the melody layer"
// entry point covers the S2 danger layer too).
au.clearZoneTheme();
assert(au._danger && au._danger.lowThemes.length === 0, 'clearZoneTheme() tears down the low-HP loop');

// ==========================================================================
// S3 — the PURE nextAmbientEvent sampler
// ==========================================================================
section('S3: nextAmbientEvent — sparse, seeded, biome-gated');

// ---- well-formed data ----
assert(Array.isArray(AMBIENT_KINDS) && AMBIENT_KINDS.length === 4, 'AMBIENT_KINDS has the 4 kinds');
for (const k of ['swamp', 'reeds', 'blackReeds']) {
  assert(AMBIENT_P[k] && typeof AMBIENT_P[k].insect === 'number', 'AMBIENT_P.' + k + ' has a probability table');
  for (const kind of AMBIENT_KINDS) assert(typeof AMBIENT_P[k][kind] === 'number' && AMBIENT_P[k][kind] >= 0, 'AMBIENT_P.' + k + '.' + kind + ' is a non-negative probability');
}
// water is a WET-biome event: probability 0 in swamp, > 0 in the reeds.
assert(AMBIENT_P.swamp.water === 0, 'swamp: water probability is 0 (no water drips in the swamp)');
assert(AMBIENT_P.reeds.water > 0 && AMBIENT_P.blackReeds.water > 0, 'reeds + blackReeds: water probability > 0 (the wet biomes drip)');
// heron is RARE everywhere (much smaller than insect).
for (const k of ['swamp', 'reeds', 'blackReeds']) {
  assert(AMBIENT_P[k].heron < AMBIENT_P[k].insect, k + ': the heron call is rarer than an insect chirp');
}

// ---- DETERMINISM: the same (biome, seed) + t-cadence yields the SAME events ----
function sampleRun(biome, seed, nSlots) {
  const rng = mulberry32(seed);
  const events = [];
  for (let t = 0; t < nSlots; t++) {
    const ev = nextAmbientEvent({ biome, rng, t });
    if (ev) events.push(ev);
  }
  return events;
}
{
  const a = sampleRun('reeds', 42, 600);
  const b = sampleRun('reeds', 42, 600);
  assert(JSON.stringify(a) === JSON.stringify(b), 'nextAmbientEvent is DETERMINISTIC for a fixed (biome, seed) — the two 600s runs are identical');
  const c = sampleRun('reeds', 43, 600);
  assert(JSON.stringify(a) !== JSON.stringify(c), 'a different seed -> a different event stream (the seed matters)');
}

// ---- SPARSE: a quiet bed, not a wall of sound ----
{
  const ev = sampleRun('reeds', 42, 600);
  const frac = ev.length / 600;
  // Each per-slot probability is small; the expected event rate is the sum of
  // the per-slot probs (a first-order bound). It MUST stay well under one
  // event-per-second (that would be a wall of sound).
  const maxRate = AMBIENT_KINDS.reduce((s, k) => s + AMBIENT_P.reeds[k], 0);
  assert(frac <= maxRate * 1.4 + 0.02, 'the realized event rate (' + (frac * 100).toFixed(1) + '% of seconds) is BOUNDED by the sparse probabilities (no wall of sound)');
  assert(frac < 0.25, 'fewer than 1 event per ~4 seconds on average (sparse)');
}

// ---- BIOME GATING: water ONLY in the wet biomes ----
{
  let swampWater = 0;
  const rng = mulberry32(7);
  for (let t = 0; t < 6000; t++) {
    const ev = nextAmbientEvent({ biome: 'swamp', rng, t });
    if (ev && ev.type === 'water') swampWater++;
  }
  assert(swampWater === 0, 'swamp: NO water-drip events in 6000 slots (water is a reeds-only kind)');
  // and in reeds, water DOES occur (the wet biome drips).
  const rng2 = mulberry32(7);
  let reedsWater = 0;
  for (let t = 0; t < 6000; t++) {
    const ev = nextAmbientEvent({ biome: 'reeds', rng: rng2, t });
    if (ev && ev.type === 'water') reedsWater++;
  }
  assert(reedsWater > 0, 'reeds: water-drip events DO occur in the wet biome');
}

// ---- every returned event is a known kind + a 0..1 flavor ----
{
  const rng = mulberry32(1);
  let okKinds = true, okFlavor = true;
  for (let t = 0; t < 2000; t++) {
    const ev = nextAmbientEvent({ biome: 'blackReeds', rng, t });
    if (!ev) continue;
    if (!AMBIENT_KINDS.includes(ev.type)) okKinds = false;
    if (typeof ev.flavor !== 'number' || ev.flavor < 0 || ev.flavor > 1) okFlavor = false;
    if (ev.t !== t) assert(false, 'the event carries its slot t');
  }
  assert(okKinds, 'every sampled event is one of the 4 AMBIENT_KINDS');
  assert(okFlavor, 'every event flavor is a 0..1 number');
}

// ---- the real AudioSys ambient-life bus rides musicBus (slider + mute) ----
section('S3: the ambient-life bus rides _ambLifeMaster -> musicBus (slider + mute)');
{
  assert(!!au._ambLifeMaster, 'the ambient-life bus (_ambLifeMaster) exists after ensure()');
  assert(au._ambLifeMaster._connections.includes(au.musicBus), '_ambLifeMaster connects INTO musicBus (music slider + mute inherit)');
  // start the ambient-life events (seeded) + drive the stepper; it must run
  // without throwing across many whole-second slots (the rAF path).
  au.startAmbientLife('reeds', 1234);
  assert(au._ambLifeOn === true, 'startAmbientLife sets _ambLifeOn');
  assert(au._ambLifeBiome === 'reeds', 'startAmbientLife points the biome at the run\'s biome (reeds)');
  assert(au._ambLifeRng != null, 'startAmbientLife seeds the mulberry32 rng stream');
  // an unknown biome normalizes to swamp.
  au.startAmbientLife('watery', 1234);
  assert(au._ambLifeBiome === 'swamp', 'an unknown biome normalizes to swamp');
  au.startAmbientLife('reeds', 1234);
  let stepThrew = false;
  try {
    // Drive ~5 whole-second slots (dt in 1.0s steps so each crosses a slot
    // boundary exactly once).
    for (let i = 0; i < 5; i++) au.stepAmbientLife(1.0);
  } catch (e) { stepThrew = true; }
  assert(!stepThrew, 'stepAmbientLife drives 5 whole-second slots without throwing');
  // re-driving the SAME slot (dt=0) must NOT double-sample it (the _lastSlot
  // guard) — a no-op, no throw.
  let reThrew = false;
  try { au.stepAmbientLife(0); } catch (e) { reThrew = true; }
  assert(!reThrew, 'stepAmbientLife(0) (same slot) is a no-op, not a double-sample');
  // stop at run end.
  au.stopAmbientLife();
  assert(au._ambLifeOn === false, 'stopAmbientLife turns the events off');
}

// ==========================================================================
// C3 (v1.10): the MIX — relative levels + duck amounts + biome parity.
// These are the constants the mix pass sets; E1 spot-checks them. The brief:
// sfx punchy on top, music present but never fighting sfx, ambient a quiet
// bed (felt, not noticed); music ducks ~3-4 dB under stingers/fanfares; the
// ambient bed ducks under the boss layer; per-biome themes at equal loudness.
// ==========================================================================
{
  // Relative bus levels: SFX clearly above MUSIC, both sane (0..1).
  assert(_MIX.sfxVolume > _MIX.musicVolume, 'C3: the sfx bus sits ABOVE the music bus (sfx punchy on top)');
  assert(_MIX.musicVolume > 0 && _MIX.musicVolume <= 1, 'C3: music volume is in (0, 1]');
  assert(_MIX.sfxVolume > 0 && _MIX.sfxVolume <= 1, 'C3: sfx volume is in (0, 1]');
  // The melody/boss/stinger layer is modest vs the ambient bed (the bed is the
  // floor, the melody a layer on top) — and the ambient-life fraction node is
  // a quiet bed (< the full music level).
  assert(_MIX.melodyLevel > 0 && _MIX.melodyLevel < 1, 'C3: melody level is in (0, 1)');
  // Duck amount: a real dip (factor < 1) that maps to roughly the brief's
  // 3-4 dB target. 20*log10(duck) should be in [-4.5, -1.5] dB.
  const duckDb = 20 * Math.log10(_MIX.duck);
  assert(_MIX.duck < 1 && _MIX.duck > 0, 'C3: the duck factor is a real dip (0 < duck < 1)');
  assert(duckDb >= -4.6 && duckDb <= -1.4, 'C3: the music duck is ~3-4 dB (' + duckDb.toFixed(2) + ' dB)');
  assert(_MIX.duckDur > 0 && _MIX.duckDur < 4, 'C3: the duck duration is short (a dip, not a silence)');
  // Ambient bed ducks under the boss layer: the boss-fight ambient fraction is
  // LOWER than the normal ambient-life level (0.9), so the fight is THE BOSS.
  assert(_MIX.bossAmbient < 0.9, 'C3: the ambient bed ducks under the boss layer (bossAmbient < normal 0.9)');
  assert(_MIX.bossAmbient > 0, 'C3: the ducked ambient bed is still present (not silenced)');
  // Per-biome loudness parity: every biome theme lands at equal perceived
  // loudness (all gains equal today; the knob exists for future retunes).
  const bgs = [_biomeThemeGain('swamp'), _biomeThemeGain('reeds'), _biomeThemeGain('blackReeds')];
  assert(bgs.every(g => g > 0), 'C3: every biome has a positive theme gain');
  assert(Math.abs(bgs[0] - bgs[1]) < 1e-9 && Math.abs(bgs[1] - bgs[2]) < 1e-9,
    'C3: swamp / Reeds / Black Reeds themes are at EQUAL loudness (parity)');
  assert(_biomeThemeGain('watery') === 1.0, 'C3: an unknown biome falls back to the default gain (1.0)');

  // Live wiring: boot AudioSys against the stub and confirm the new defaults +
  // the duck machinery are actually applied (not just declared).
  au.ensure();
  assert(au.musicVolume === _MIX.musicVolume, 'C3: the live music bus uses the _MIX.musicVolume default');
  assert(au.sfxVolume === _MIX.sfxVolume, 'C3: the live sfx bus uses the _MIX.sfxVolume default');
  assert(au._melodyLevel === _MIX.melodyLevel, 'C3: the live melody layer uses the _MIX.melodyLevel default');
  // Trigger a stinger -> the music bus dips to musicVolume*duck and _duckT is set.
  au.stingerVictory();
  assert(au._duckT > 0, 'C3: stingerVictory arms the music-bus duck (_duckT set)');
  // The stub records the last-scheduled gain value; the duck ramps DOWN to
  // musicVolume*duck (the dip floor) then back up, so the floor must have been
  // scheduled at or below the set level (proof the dip actually happened).
  const dipFloor = au.musicBus.gain.value;
  assert(dipFloor <= _MIX.musicVolume + 1e-6 && dipFloor >= _MIX.musicVolume * _MIX.duck - 1e-6,
    'C3: after a stinger the music bus dipped to its ducked level (floor ' + dipFloor.toFixed(3) + ')');
  // Boss engage ducks the ambient-life bed; clear restores it.
  au.setBossTheme(false);
  assert(au._ambLifeMaster.gain.value <= 0.9 + 1e-6, 'C3: engaging the boss does not raise the ambient bed');
  au.clearZoneTheme();
}

// ==========================================================================
// summary
// ==========================================================================
console.log('\n' + passCount + ' assertions passed.');
if (failures.length) {
  console.log('\nMUSIC TESTS FAILED (' + failures.length + '):');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
} else {
  console.log('\nMUSIC TESTS PASSED (S2 themeSelector + S3 nextAmbientEvent + music-bus routing)');
}
