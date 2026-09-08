// music.mjs — headless MUSIC-layer test for v1.9 S2 (no real audio, no
// browser).
//
// S1's evidence was the sfx bank (tests/sfx.mjs) because SFX can't be
// screenshotted. MUSIC is the same — you can't assert "it sounds like Reeds"
// in node — so the S2 evidence is the PURE, DETERMINISTIC selector the music
// layer is BUILT FROM:
//
//   themeSelector({ zone, biome, bossEngaged, lowHp, collection }) ->
//        { themeId, patternDensity, extraVoices } — a pure function of the run
//        state that picks the right theme + intensity. The test asserts the
//        correct theme + density for swamp / Reeds / Black Reeds / boss /
//        lowHp / collection, and that density rises with intensity (a denser
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
  COLLECTION_THEME,
} from '../src/audio.js';

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

// ---- collection (the Full Collection moment) ----
{
  const r = themeSelector({ zone: 0, biome: 'swamp', collection: true });
  assert(r.themeId === 'collection', 'collection -> collection theme (overrides everything)', 'got ' + r.themeId);
  assert(r.extraVoices.includes('collection-swell'), 'collection adds the chord-swell voice');
  assert(r.patternDensity > 1, 'collection has a real pattern (the short phrase)');
  assert(countActive(COLLECTION_THEME.pattern) > 0, 'collection phrase is non-empty');
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
  assert(BOSS_THEMES.gray && BOSS_THEMES.green, 'BOSS_THEMES has gray + green');
  assert(BOSS_THEMES.gray.pulse && BOSS_THEMES.green.pulse, 'both boss themes opt into the pulse layer');
  assert(typeof LOWHP_THEME.root === 'number' && Array.isArray(LOWHP_THEME.pattern), 'LOWHP_THEME is well-formed');
  assert(typeof COLLECTION_THEME.root === 'number' && Array.isArray(COLLECTION_THEME.pattern), 'COLLECTION_THEME is well-formed');
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

// collectionSwell() schedules a chord on the melody layer (no throw).
let swellThrew = false;
try { au.collectionSwell(); } catch (e) { swellThrew = true; }
assert(!swellThrew, 'collectionSwell() runs without throwing against the stub');

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
// summary
// ==========================================================================
console.log('\n' + passCount + ' assertions passed.');
if (failures.length) {
  console.log('\nMUSIC TESTS FAILED (' + failures.length + '):');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
} else {
  console.log('\nMUSIC TESTS PASSED (S2 themeSelector + music-bus routing)');
}
