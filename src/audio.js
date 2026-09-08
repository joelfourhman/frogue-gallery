// audio.js — Web Audio SFX + procedural ambient bed. All synthesized, no assets.
// P9: two buses under the master — musicBus (ambient) and sfxBus (effects) —
// so the user can adjust them independently.
// S3 (v1.9): the seeded RNG for deterministic ambient-life event timing (the
// sampler itself is pure + node-tested; this is only used to BUILD the seeded
// stream the rAF stepper feeds it). math.js is pure (no browser APIs).
import { mulberry32 } from './math.js';
'use strict';

// ==================== S2 (v1.9): PURE music-dynamics data + selector ====================
// Module-level (NOT class-scoped) so the pure themeSelector() below can be
// imported + asserted by a node test with ZERO browser dependency (the S2
// evidence — the music layer can't be screenshotted, so the selector + its
// density/extra-voice contract IS the acceptance). The AudioSys class methods
// delegate to these same constants so the pure selector and the live music
// layer can never drift apart.
//
// Presentation-only invariant (v1.9): these are AUDIO PRESETS. logic.js
// (makeTuning) is untouched; the 9 pacing probes are unchanged (audio does not
// feed runT); SAVE_VERSION stays 12. A denser pattern (more non-rest steps) =
// a higher patternDensity = a more intense moment.

// The per-BIOME zone themes. Each biome is a 5-element array (zone index
// 0..4; index 4 is a safe out-of-range fallback = zone 0). `swamp` is the
// EXACT pre-S2 hand-tuned set (byte-identical to v1.4 S1) so the base swamp
// run sounds unchanged; `reeds` + `blackReeds` are new distinct biome themes
// (low / watery / slow, then darker / lower / sparser) so entering those
// places is sonically unmistakable (today they reused the swamp presets).
const ZONE_THEMES = {
  swamp: [
    { root: 220.0, scale: [0, 3, 5, 7, 10],  pattern: [ 0, -1, 2, 4, -1, 3, -1, 2,  0, -1, 4, 2, -1, 3, 2, -1], stepDur: 0.34, detune: 6 },
    { root: 207.65, scale: [0, 3, 5, 7, 10], pattern: [ 0, 2, -1, 0, 3, -1, 4, 3,  2, -1, 0, -1, 5, 4, 3, -1], stepDur: 0.30, detune: -8 },
    { root: 233.08, scale: [0, 2, 5, 7, 9],  pattern: [ 0, 4, 2, -1, 3, 5, -1, 3,  4, 2, 5, -1, 7, 5, 4, 2 ], stepDur: 0.28, detune: 5 },
    { root: 196.0, scale: [0, 1, 5, 7, 10], pattern: [ 0, -1, 1, 0, 7, -1, 5, 1,  0, -1, 1, 7, 5, -1, 4, -1], stepDur: 0.26, detune: -6 },
    { root: 220.0, scale: [0, 3, 5, 7, 10],  pattern: [ 0, -1, 2, 4, -1, 3, -1, 2,  0, -1, 4, 2, -1, 3, 2, -1], stepDur: 0.34, detune: 6 },
  ],
  // REEDS — low, watery, SLOW: a wet minor/mixolydian drone (mixolydian scale
  // [0,2,4,7,9] = 1 b3 4 5 b7), a low root, a long stepDur (slower than any
  // swamp zone) + a wider detune for a "wet" shimmer. Sparser than swamp.
  reeds: [
    { root: 146.83, scale: [0, 2, 4, 7, 9],  pattern: [ 0, -1, -1, 2,  -1, -1, 4, -1,  7, -1, -1, 5,  -1, 2, -1, -1], stepDur: 0.42, detune: 8 },
    { root: 130.81, scale: [0, 2, 4, 7, 9],  pattern: [ 0, -1, 4, -1,  2, -1, -1, 5,  -1, 3, -1, -1,  0, -1, -1, -1], stepDur: 0.40, detune: -6 },
    { root: 146.83, scale: [0, 2, 5, 7, 9],  pattern: [ 2, -1, -1, 0,  -1, 4, -1, -1,  5, -1, 2, -1,   0, -1, -1, -1], stepDur: 0.38, detune: 6 },
    { root: 123.47, scale: [0, 1, 4, 7, 9],  pattern: [ 0, -1, -1, 1,  -1, -1, 4, -1,  7, -1, -1, -1,  5, -1, -1, -1], stepDur: 0.36, detune: -8 },
    { root: 146.83, scale: [0, 2, 4, 7, 9],  pattern: [ 0, -1, -1, 2,  -1, -1, 4, -1,  7, -1, -1, 5,  -1, 2, -1, -1], stepDur: 0.42, detune: 8 },
  ],
  // BLACK REEDS — darker, LOWER, SPARSER: a sub-A root, a chromatic minor
  // color, the slowest stepDur of any theme, a wider negative detune (a "dark"
  // pull), and only 3-4 active steps per 16 (a near-silent, dread-filled bed).
  blackReeds: [
    { root: 110.00, scale: [0, 1, 4, 7, 10], pattern: [ 0, -1, -1, -1,  3, -1, -1, -1,  -1, -1, 5, -1,  -1, -1, 1, -1], stepDur: 0.50, detune: -10 },
    { root: 98.00,  scale: [0, 1, 4, 7, 10], pattern: [ 0, -1, -1, -1,  -1, -1, -1, 4,  -1, -1, 1, -1,  -1, 5, -1, -1], stepDur: 0.48, detune: -14 },
    { root: 103.83, scale: [0, 1, 3, 7, 10], pattern: [ 0, -1, -1, -1,  -1, -1, 3, -1,  -1, 1, -1, -1,   5, -1, -1, -1], stepDur: 0.46, detune: -12 },
    { root: 87.31,  scale: [0, 1, 4, 6, 10], pattern: [ 0, -1, -1, -1,  -1, -1, -1, -1,  6, -1, -1, -1,  1, -1, -1, -1], stepDur: 0.44, detune: -16 },
    { root: 110.00, scale: [0, 1, 4, 7, 10], pattern: [ 0, -1, -1, -1,  3, -1, -1, -1,  -1, -1, 5, -1,  -1, -1, 1, -1], stepDur: 0.50, detune: -10 },
  ],
};

// The BOSS battle patterns (the "faster than any zone" step rate = intensity).
// `gray` / `green` mirror the pre-S2 _bossThemeData values (byte-identical);
// a `pulse` flag marks the low off-beat thump layer the tick schedules.
const BOSS_THEMES = {
  gray:  { root: 110.0,  scale: [0, 3, 6, 7, 10], pattern: [0, -1, 3, 0,  6, -1, 7, 6,  3, -1, 0, 7,  12, 10, 7, 6], stepDur: 0.18, detune: -6,  pulse: true, mode: 'minor' },
  green: { root: 98.0,   scale: [0, 1, 3, 6, 10], pattern: [0, 1, -1, 3,  6, -1, 10, 7,  3, 1, 0, -1,  11, 10, 6, -1], stepDur: 0.17, detune: -10, pulse: true, mode: 'minor' },
};

// The FULL COLLECTION moment's own short phrase — a bright, DENSE triumphant
// climb (I-V-I color) on the melody layer. Its patternDensity (14) is the
// highest of any theme: the "the museum keeps you better" climax.
const COLLECTION_THEME = {
  themeId: 'collection', root: 261.63, scale: [0, 4, 7, 12],
  pattern: [0, -1, 1, 2,  3, 2, 1, 2,  0, -1, 1, 2,  3, 2, 1, 0], stepDur: 0.16, detune: 6,
};

// The LOW-HP uneasy ostinato — a sparse, HIGH, slightly dissonant pattern
// (an A4 root with a b9 / tritone neighbor), a slow stepDur (a sparse, uneasy
// pulse), kept at a low gain so it is a quiet layer under the zone/boss theme.
// Driven by setLowHp() + ticked through the same _tickThemes machinery (the
// tick only reads + schedules a bounded note — no per-frame allocation).
const LOWHP_THEME = {
  themeId: 'lowhp', root: 440.0, scale: [0, 3, 6, 10],
  pattern: [0, -1, -1, -1,  6, -1, -1, 3,  -1, -1, -1, -1, 0, -1, -1, -1], stepDur: 0.6, detune: 0,
};

function _countActive(pattern) {
  let n = 0;
  for (let i = 0; i < pattern.length; i++) if (pattern[i] >= 0) n++;
  return n;
}

// S2 (v1.9) PURE ACCEPTANCE: the music-dynamics selector. Given the current
// game state (which zone + biome, is the boss engaged, is the frog low-HP, is
// the full collection complete) it returns the theme to play, its
// patternDensity (a higher = more intense moment), and the EXTRA danger voices
// that should swell in on top. Pure (no browser, no Math.random, no time) so
// a node test asserts the right theme + density + voices for each of
// swamp / Reeds / Black Reeds / boss / lowHp / collection. The music slider
// still controls all of it (everything rides melodyMaster -> musicBus).
export function themeSelector(state) {
  const zone = (state && (state.zone | 0)) || 0;
  const biome = (state && state.biome) || 'swamp';
  const bossEngaged = !!(state && state.bossEngaged);
  const lowHp = !!(state && state.lowHp);
  const collection = !!(state && state.collection);

  const extraVoices = [];
  let themeId;
  let pattern;
  if (collection) {
    // The full-collection moment owns its own phrase (a triumphant swell on the
    // melody layer, under the sfxBus collection-fanfare).
    themeId = COLLECTION_THEME.themeId;
    pattern = COLLECTION_THEME.pattern;
    extraVoices.push('collection-swell');
  } else if (bossEngaged) {
    // The boss loop is the live melody; the low off-beat PULSE swells in under
    // it (and the boss drops to a faster pattern on a new phase — the wiring).
    themeId = 'boss';
    pattern = BOSS_THEMES.gray.pattern;
    extraVoices.push('boss-pulse');
  } else {
    // Normalize the biome so an UNKNOWN biome (e.g. 'watery') falls back to the
    // swamp set AND reports the swamp themeId (the S2 byte-identical safety).
    const effBiome = ZONE_THEMES[biome] ? biome : 'swamp';
    const arr = ZONE_THEMES[effBiome];
    const i = ((zone % arr.length) + arr.length) % arr.length;
    themeId = effBiome + '-' + i;
    pattern = arr[i].pattern;
  }
  if (lowHp && !collection) extraVoices.push('lowhp-ostinato');
  return { themeId, patternDensity: _countActive(pattern), extraVoices };
}

// ==================== S3 (v1.9): PURE ambient-life sampler ====================
// S3 (v1.9) PURE ACCEPTANCE: the ambient-life sampler. Given the run's current
// BIOME, a seeded RNG (mulberry32), and the run's ambient clock t (whole-second
// slot index), return the ambient-life event due in this slot (if any) + its
// random `flavor` (pitch/variant), or null. PURE + node-testable (no Math.random,
// no browser, no global state — only the caller's seeded `rng` is advanced, in a
// fixed per-slot draw order, so the same (biome, seed, t-cadence) always yields
// the same event times: deterministic in node).
//
// SPARSE — a quiet bed, never a wall of sound. Most slots return null; each
// event kind has a small per-slot probability (a few per minute), and the wet
// kinds (water) ONLY occur in the reeds biomes. `flavor` (0..1) is one extra
// seeded draw so a test can confirm determinism + the caller can vary pitch.
const AMBIENT_KINDS = ['insect', 'water', 'wind', 'heron'];   // the S3 event kinds
// per-slot probabilities (slot = 1 second): insect ~ a few/min, water (reeds
// only) ~ a few/min, wind a slow swell, heron RARE (~ once per zone).
const AMBIENT_P = {
  swamp:      { insect: 0.030, water: 0.000, wind: 0.010, heron: 0.0015 },
  reeds:      { insect: 0.026, water: 0.035, wind: 0.016, heron: 0.0020 },
  blackReeds: { insect: 0.018, water: 0.040, wind: 0.020, heron: 0.0020 },
};

// The pure S3 sampler. See the header comment above for the contract.
function nextAmbientEvent({ biome, rng, t }) {
  const p = AMBIENT_P[biome] || AMBIENT_P.swamp;   // unknown biome -> swamp set
  // Draw in a FIXED order (insect, water, wind, heron) so the rng stream is
  // deterministic for a given (biome, seed, t sequence). Return the FIRST kind
  // whose slot roll succeeds (at most one event per slot keeps it sparse).
  const kinds = ['insect', 'water', 'wind', 'heron'];
  for (let i = 0; i < kinds.length; i++) {
    const r = rng();                    // the gate draw (advance the stream)
    if (r < p[kinds[i]]) {
      const flavor = rng();             // one extra draw = the event's variant
      return { type: kinds[i], flavor, t };
    }
  }
  return null;
}

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.volume = 0.7;
    this.musicVolume = 0.55;
    this.sfxVolume = 0.7;
    this.muted = false;
    this._noiseBuf = null;
    this._musicNodes = []; // [osc1, osc2, gain1, gain2, lfo, lfoGain]
    // ---- V3 (v1.2 M11): per-zone ambient bed ----
    // A soft, looping ambient layer that shifts by zone. It sits under the
    // musicBus (so it inherits the music-volume slider + mute for free) and
    // is kept at a modest fraction of the music level. All synthesized from
    // the existing oscillator / noise-buffer nodes — no new assets.
    this._ambMaster = null;   // persistent gain -> musicBus (the ambient fraction)
    // S3 (v1.9): the AMBIENT LIFE bus — a persistent gain -> musicBus, so the
    // music slider + mute inherit (same shape as _ambMaster). The sparse
    // ambient-life events (insect chirps / water drips / wind / distant heron
    // call) route here. Their SCHEDULING is the pure nextAmbientEvent sampler
    // (module top, node-tested) driven by the rAF tick — no setInterval.
    // Presentation-only (logic.js untouched; makeTuning byte-identical).
    this._ambLifeMaster = null;
    // S3 (v1.9): the ambient-life STEPPER state (driven by the rAF tick via
    // stepAmbientLife, NOT setInterval). _ambLifeT is the run clock (seconds);
    // _lastSlot tracks the last whole-second slot already sampled (so each slot
    // is sampled exactly once); _ambLifeRng is the run's seeded mulberry32 (so
    // event timing is deterministic for a given seed). All lazy — start/stop by
    // startAmbientLife/stopAmbientLife (called from game.js on run start/end).
    this._ambLifeOn = false;
    this._ambLifeBiome = 'swamp';
    this._ambLifeT = 0;
    this._lastSlot = -1;
    this._ambLifeRng = null;
    this._crossFade = 1.6;    // seconds to crossfade between zones
    this._amb = null;         // { zone, voices: [{ node, gain }] } — current zone bed
    // ---- S1 (v1.4): melodic per-zone themes (a step-sequencer layer ABOVE the ambient bed) ----
    // A short pentatonic loop per zone, scheduled by ctx.currentTime LOOKAHEAD in the
    // rAF tick (tickMusic) — no setInterval, no audio files, no new deps. It sits on
    // melodyMaster -> musicBus, so it inherits the music slider + mute for free.
    // The ambient bed (V3) stays as the low drone; the melody is a quiet layer on top
    // (~-10 dB relative). Zone switches crossfade the melody (old ramps to 0, new up).
    this._melodyMaster = null; // persistent gain -> musicBus (the melody layer)
    this._melodyLevel = 0.32;  // melody loudness (kept modest vs the ambient bed)
    this._zoneTheme = null;    // { zone, theme, gain, step, nextAt } — the live loop
    this._zoneThemeI = -1;     // the zone index the live theme is for
    this._zoneThemes = [];     // all live/fading loop instances (overlaps during crossfade)
    // ---- S2 (v1.4): the boss battle loop + the end-screen stingers ----
    // A distinct INTENSE-but-beautiful loop that crossfades in when the final
    // heron engages. It reuses the S1 step-sequencer (melodyMaster -> musicBus)
    // so it inherits the music slider + mute for free; the Great Green Heron
    // gets its own darker variant. `setBossTheme` starts it; `clearZoneTheme`
    // (the "stop the melody layer" entry point, called at run end / quit) fades
    // it too. The end-screen stingers (stingerVictory/stingerDefeat) are
    // one-shot phrases scheduled on the same melody layer.
    this._bossMusic = false;   // true while the boss loop is the live melody
    this._bossThemes = [];     // live/fading boss loop instances (crossfade overlap)
    // ---- S2 (v1.9): the INTENSITY / DANGER layer (music dynamics) ----
    // A sparse tension layer on the SAME melody layer (melodyMaster -> musicBus)
    // that SWELLS IN under the zone/boss themes: (a) a low off-beat PULSE under
    // the boss fight, (b) a sparse high uneasy ostinato at low frog HP, (c) a
    // brief swell on zone entry, (d) a triumphant collection-swell phrase. The
    // PURE selector for theme + density + extra-voices is themeSelector
    // (exported, node-testable — the S2 evidence).
    //
    // P10 invariant: nothing allocates per-frame in the tick. The danger layer
    // is LAZILY built ONCE (on the first setLowHp) as a small set of persistent
    // gains; the tick only reads + schedules a bounded note through the shared
    // _tone (which itself builds one osc+gain per scheduled note — the same
    // bounded per-note allocation every other melody/boss note already makes,
    // exempt from the sfx-bus cap).
    this._danger = null;        // { master, lowOn, lowThemes[] } — lazy (setLowHp builds it)
    // ---- S3 (v1.4): a hard cap on simultaneously-LIVE sfx-bus voices ----
    // Painting is fast (several swipes/splashes + status blips per second, and a
    // charge is a burst). Without a cap a flurry could spawn hundreds of short
    // oscillators at once — a per-frame allocation burst that hurts 60fps. We
    // track the stop-time of each live sfx-bus voice and drop new ones once N
    // are alive. Cheap: a short number[] purged on each schedule. Only the sfx
    // bus is capped; the melodic layers (S1/S2) schedule a bounded 16-step
    // pattern and are exempt.
    this._sfxLive = [];        // [stopTime, ...] of live sfx-bus voices
    this._sfxMaxVoices = 24;   // concurrent-voice cap
  }

  // S3 (v1.4): may a new sfx-bus voice of the given duration start right now?
  // Purges finished voices, then reserves a slot at (now + dur) — if the live
  // set is already at the cap, returns false and the voice is skipped.
  _sfxCanStart(dur = 0.25) {
    if (!this.ctx) return true;
    const now = this.ctx.currentTime;
    const L = this._sfxLive;
    let n = 0;
    for (let i = 0; i < L.length; i++) if (L[i] > now) L[n++] = L[i];
    L.length = n;
    if (L.length >= this._sfxMaxVoices) return false;
    L.push(now + Math.max(dur, 0.04));
    return true;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicVolume;
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVolume;
      // S1 (v1.4): the melodic theme layer sits on its own gain under musicBus,
      // so it inherits the music slider + mute exactly like the ambient bed.
      this._melodyMaster = this.ctx.createGain();
      this._melodyMaster.gain.value = this._melodyLevel;
      this._melodyMaster.connect(this.musicBus);
      // S3 (v1.9): the ambient-life bus — same shape as _melodyMaster/_ambMaster
      // (a persistent gain under musicBus so the music slider + mute inherit).
      this._ambLifeMaster = this.ctx.createGain();
      this._ambLifeMaster.gain.value = 0.9;   // the events carry their own low peaks
      this._ambLifeMaster.connect(this.musicBus);
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      // pre-render a noise buffer
      const len = this.ctx.sampleRate * 1;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noiseBuf = buf;
      return true;
    } catch (e) {
      return false;
    }
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master && !this.muted) this.master.gain.value = this.volume;
  }
  setMusicVolume(v) {
    this.musicVolume = Math.min(1, Math.max(0, v));
    if (this.musicBus) this.musicBus.gain.value = this.musicVolume;
  }
  setSfxVolume(v) {
    this.sfxVolume = Math.min(1, Math.max(0, v));
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxVolume;
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  // ---- P9: procedural ambient bed (warm two-tone drone + slow LFO) ----
  // Called by game.js on run start / end. Idempotent: safe to call startMusic
  // multiple times; only the first call creates nodes.
  startMusic() {
    if (!this.ctx || this._musicNodes.length) return;
    try {
      const t = this.ctx.currentTime;
      const mk = (freq, gain) => {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.value = gain;
        o.connect(g);
        g.connect(this.musicBus);
        o.start(t);
        return [o, g];
      };
      const [o1, g1] = mk(110, 0.12);  // A2
      const [o2, g2] = mk(165, 0.09);  // E3 (perfect fifth)
      // slow LFO on the second oscillator's gain for a gentle swell
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.08;
      const lfoG = this.ctx.createGain();
      lfoG.gain.value = 0.04;
      lfo.connect(lfoG);
      lfoG.connect(g2.gain);
      lfo.start(t);
      this._musicNodes = [o1, g1, o2, g2, lfo, lfoG];
    } catch (e) { /* headless / unsupported */ }
  }
  stopMusic() {
    for (const n of this._musicNodes) {
      try { if (n.stop) n.stop(); n.disconnect(); } catch (e) {}
    }
    this._musicNodes = [];
    this.clearZoneAmbient();
  }

  // ---- V3 (v1.2 M11): per-zone ambient bed ----------------------------------
  // A soft looping ambient layer that shifts by the zone the frog is in. It
  // feeds the existing musicBus, so it inherits the music-volume slider and the
  // master mute for free; a dedicated _ambMaster (gain 0.6) keeps it a modest
  // *fraction* of the music level. Crossfades between zones. All synthesized
  // from the existing oscillator / noise-buffer nodes — no new assets.
  //
  // Each zone is a small preset of voices; every voice has its own gain (vg)
  // -> the per-zone group gain (zg, 0..1, crossfaded) -> _ambMaster -> musicBus.
  _ZONE_PRESETS() {
    return [
      { // index 0 — the calm pre-first-zone opening (a quiet, distant water hush)
        voices: [
          { type: 'sine',  f: 82,  g: 0.09 },
          { type: 'noise', filter: 'lowpass', f: 240, q: 0.5, g: 0.035 },
        ],
      },
      { // Reed Flats — a low water-drone under a soft filtered shimmer
        voices: [
          { type: 'sine',   f: 70,  g: 0.13 },
          { type: 'sine',   f: 95,  g: 0.06 },
          { type: 'noise',  filter: 'lowpass',  f: 320, q: 0.6, g: 0.05 },
        ],
      },
      { // Slick Hollow — a wind-ish pad: bandpassed air + a soft tone
        voices: [
          { type: 'noise',    filter: 'bandpass', f: 480, q: 0.5, g: 0.08 },
          { type: 'triangle', f: 220, g: 0.045 },
        ],
      },
      { // Bramble Thicket — a warm low drone
        voices: [
          { type: 'sine', f: 90,  g: 0.11 },
          { type: 'sine', f: 135, g: 0.055 },
        ],
      },
      { // The Gray Shore — sparse high chimes near the heron (LFO-gated so they
        // pulse in and out rather than ring constantly)
        voices: [
          { type: 'sine', f: 660, g: 0.030, lfo: { f: 0.14, depth: 0.028 } },
          { type: 'sine', f: 880, g: 0.020, lfo: { f: 0.09, depth: 0.019 } },
          { type: 'noise', filter: 'highpass', f: 1300, q: 0.8, g: 0.018 },
        ],
      },
    ];
  }

  // Enter / crossfade to the ambient bed for the given zone index (0..4).
  // Index 0 = the calm pre-first-zone opening; 1..4 = the four named zones
  // (Reed Flats, Slick Hollow, Bramble Thicket, The Gray Shore). Idempotent
  // per zone: switching to the current zone is a no-op.
  setZoneAmbient(zoneI) {
    if (!this.ctx || !this.musicBus) return;
    const zi = Math.max(0, Math.min(4, (zoneI | 0)));
    if (this._amb && this._amb.zone === zi) return;
    // persistent ambient fraction node (created once)
    if (!this._ambMaster) {
      this._ambMaster = this.ctx.createGain();
      this._ambMaster.gain.value = 0.6;      // a modest fraction of the music
      this._ambMaster.connect(this.musicBus);
    }
    // The outgoing bed (if any) — captured BEFORE we replace _amb so the
    // previous zone keeps sounding while the new one fades in (the crossfade).
    const prev = this._amb;
    try {
      const t = this.ctx.currentTime;
      const presets = this._ZONE_PRESETS();
      const zg = this.ctx.createGain();
      zg.gain.value = 0.0001;
      zg.connect(this._ambMaster);
      zg.gain.linearRampToValueAtTime(1, t + this._crossFade); // group eases in
      const voices = [];
      for (const spec of presets[zi].voices) {
        const vg = this.ctx.createGain();
        vg.gain.value = spec.g ?? 0.08;
        vg.connect(zg);
        let node;
        if (spec.type === 'noise') {
          node = this.ctx.createBufferSource();
          node.buffer = this._noiseBuf;
          node.loop = true;
          const filt = this.ctx.createBiquadFilter();
          filt.type = spec.filter; filt.frequency.value = spec.f; filt.Q.value = spec.q ?? 0.7;
          node.connect(filt); filt.connect(vg);
          node.start(t);
        } else {
          node = this.ctx.createOscillator();
          node.type = spec.type; node.frequency.value = spec.f;
          node.connect(vg); node.start(t);
          if (spec.lfo) {
            const lfo = this.ctx.createOscillator();
            lfo.type = 'sine'; lfo.frequency.value = spec.lfo.f;
            const lg = this.ctx.createGain(); lg.gain.value = spec.lfo.depth;
            lfo.connect(lg); lg.connect(vg.gain); lfo.start(t);
            voices.push({ node: lfo, gain: lg }); // track the LFO for cleanup
          }
        }
        voices.push({ node, gain: vg });
      }
      this._amb = { zone: zi, zg, voices };
      // fade the outgoing zone out (crossfade) and tear it down once quiet
      if (prev && prev !== this._amb) {
        try {
          prev.zg.gain.setTargetAtTime(0.0001, t, this._crossFade / 3);
          const p = prev;
          setTimeout(() => {
            try { for (const v of p.voices) v.node.stop(); } catch (e) {}
            try { p.zg.disconnect(); } catch (e) {}
          }, this._crossFade * 1.5 * 1000);
        } catch (e) { /* headless / already torn down */ }
      }
    } catch (e) { /* headless / unsupported */ }
  }

  // Fade out and tear down the ambient bed (run end / music stop).
  clearZoneAmbient() {
    if (!this.ctx || !this._amb) return;
    const a = this._amb;
    this._amb = null;
    try {
      a.zg.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);
      const b = a;
      setTimeout(() => {
        try { for (const v of b.voices) v.node.stop(); } catch (e) {}
        try { b.zg.disconnect(); } catch (e) {}
      }, 1200);
    } catch (e) { /* headless */ }
  }

  // ==================== S1 (v1.4): melodic per-zone themes ====================
  // A short pentatonic loop per zone, played by a LOOKAHEAD step-sequencer
  // (tickMusic, driven from game.js's rAF tick — no setInterval, no audio
  // files, no new deps). Each zone theme = { root, scale (intervals in
  // semitones from root), pattern (16 steps; -1 = rest), stepDur, detune }.
  // Deterministic per zone; the melody rides melodyMaster -> musicBus so it
  // inherits the music slider + mute for free, and sits ABOVE the V3 ambient
  // bed (which stays as the low drone).
  _zoneThemeData(biome) {
    // S2 (v1.9): delegate to the PURE per-biome data (ZONE_THEMES). `swamp` is
    // the exact pre-S2 hand-tuned set (byte-identical); `reeds` / `blackReeds`
    // are the new distinct biome themes. An unknown biome falls back to swamp.
    return ZONE_THEMES[biome] || ZONE_THEMES.swamp;
  }

  // Crossfade the melody to the zone just entered (game.js calls this from
  // _updateZoneAmbient alongside the ambient bed). The current theme keeps
  // looping but its notes stop (muted) while its zone gain ramps to ~0 over the
  // crossfade; the new theme starts at ~0 and ramps up. Both schedule through
  // melodyMaster -> musicBus, so the music slider + mute scale them all. A list
  // of active themes supports the ~1 s overlap during the fade.
  setZoneTheme(zoneI, biome) {
    if (!this.ctx || !this._melodyMaster) return;
    if (this._bossMusic) return; // S2: the boss loop owns the melody while engaged
    if (zoneI === this._zoneThemeI) return; // idempotent (same zone)
    if (!this._zoneThemes) this._zoneThemes = [];
    // S2 (v1.9): the per-BIOME zone theme (swamp | reeds | blackReeds). game.js
    // passes this.runBiome (see _updateZoneAmbient); a missing biome falls back
    // to swamp (byte-identical base-run behavior).
    const data = this._zoneThemeData(biome || 'swamp');
    const theme = data[((zoneI % data.length) + data.length) % data.length];
    // fade the previous theme(s) out: stop their notes, ramp the zone gain down.
    for (const th of this._zoneThemes) {
      th.muted = true;
      th.fading = true;
      th._fadeAt = this.ctx.currentTime;
      try {
        th.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, this._crossFade / 4);
        const b = th;
        setTimeout(() => { try { b.gain.disconnect(); } catch (e) {} }, this._crossFade * 1000 + 200);
      } catch (e) { /* headless */ }
    }
    const zg = this.ctx.createGain();
    zg.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    zg.gain.setTargetAtTime(1, this.ctx.currentTime + 0.05, this._crossFade / 4);
    zg.connect(this._melodyMaster);
    this._zoneThemes.push({ zone: zoneI, theme, gain: zg, step: 0, nextAt: this.ctx.currentTime + 0.35, muted: false, fading: false });
    this._zoneThemeI = zoneI;
  }

  // ==================== S2 (v1.4): boss battle loop ====================
  // A distinct, INTENSE-but-beautiful loop that crossfades in when the final
  // heron engages. It reuses the S1 step-sequencer (tickMusic/_tickThemes) so
  // it rides melodyMaster -> musicBus (music slider + mute for free) and needs
  // no setInterval / audio files / new deps. The Great Green Heron (NG+) gets
  // its own darker, slightly faster variant. `green` picks the variant.
  // S2 (v1.9): delegate to the PURE boss data (BOSS_THEMES) + the pre-built
  // phase-2 (denser / faster) variants the boss drops to on a phase change
  // (pre-built here at theme-setup time so `bossPhaseUp()` only SWAPS A
  // REFERENCE — no pattern allocation at the phase moment, the P10 invariant).
  _bossThemeData() {
    return {
      gray:  BOSS_THEMES.gray,
      green: BOSS_THEMES.green,
      // The DENSER phase-2 patterns (the boss "drops to a new phase"): the same
      // scale + faster stepDur (stepDur * 0.8) + a denser 16-step pattern (more
      // active steps) = a higher patternDensity = higher intensity. Pre-built.
      gray2:  { ...BOSS_THEMES.gray,  pattern: [0, 3, -1, 3,  6, 7, -1, 6,  3, 0, 7, 6,  12, 10, 7, 6], stepDur: BOSS_THEMES.gray.stepDur * 0.8 },
      green2: { ...BOSS_THEMES.green, pattern: [0, 1, 3, -1,  6, 7, 10, -1,  3, 1, 0, 3,  11, 10, 6, 10], stepDur: BOSS_THEMES.green.stepDur * 0.8 },
    };
  }

  // Engage the boss: crossfade the zone theme out and start the boss loop.
  // game.js calls this the moment the final heron's intro ends (boss-growl).
  // `green` selects the Great Green Heron variant (NG+). Idempotent while the
  // boss is already engaged (re-engaging the same heron is a no-op).
  setBossTheme(green) {
    if (!this.ctx || !this._melodyMaster) return;
    if (!this._bossThemes) this._bossThemes = [];
    if (this._bossMusic) return; // already engaged — don't double-start
    this._bossMusic = true;
    // Fade the zone theme(s) out: stop their notes, ramp the gain down (the
    // same crossfade machinery setZoneTheme uses).
    for (const th of (this._zoneThemes || [])) {
      th.muted = true; th.fading = true; th._fadeAt = this.ctx.currentTime;
      try {
        th.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, this._crossFade / 4);
        const b = th;
        setTimeout(() => { try { b.gain.disconnect(); } catch (e) {} }, this._crossFade * 1000 + 200);
      } catch (e) { /* headless */ }
    }
    // fade any prior boss loops (a re-engage after a clear)
    for (const th of this._bossThemes) {
      th.muted = true; th.fading = true; th._fadeAt = this.ctx.currentTime;
      try {
        th.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, this._crossFade / 4);
        const b = th;
        setTimeout(() => { try { b.gain.disconnect(); } catch (e) {} }, this._crossFade * 1000 + 200);
      } catch (e) { /* headless */ }
    }
    const data = this._bossThemeData();
    const theme = data[green ? 'green' : 'gray'];
    const zg = this.ctx.createGain();
    zg.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    zg.gain.setTargetAtTime(1, this.ctx.currentTime + 0.05, this._crossFade / 4);
    zg.connect(this._melodyMaster);
    this._bossThemes.push({ zone: -1, green: !!green, theme, gain: zg, step: 0, nextAt: this.ctx.currentTime + 0.35, muted: false, fading: false, _phase: 0 });
  }

  // S2 (v1.9): the boss DROPS TO A NEW PHASE — swap the live boss loop to its
  // pre-built DENSER phase-2 pattern (faster stepDur + more active steps = a
  // higher patternDensity = higher intensity). The denser patterns are pre-
  // built in _bossThemeData (gray2/green2), so this only SWAPS A REFERENCE on
  // the live theme object — no pattern allocation at the phase moment (the
  // P10 invariant: the tick path allocates nothing new). Idempotent per phase.
  bossPhaseUp() {
    if (!this.ctx || !this._bossMusic) return;
    const th = this._bossThemes && this._bossThemes[this._bossThemes.length - 1];
    if (!th || th._phase > 0) return; // already in the denser phase
    const data = this._bossThemeData();
    const denser = th.green ? data.green2 : data.gray2;
    if (denser) th.theme = denser; // swap to the pre-built denser pattern
    th._phase = 1;
  }

  // ==================== S2 (v1.9): the INTENSITY / DANGER layer =============
  // A sparse tension layer on the SAME melody layer (melodyMaster -> musicBus)
  // that SWELLS IN under the zone/boss themes:
  //   (a) the low off-beat PULSE under the boss fight — the boss themes carry
  //       `pulse: true`, so the existing _tickThemes pulse layer IS the boss
  //       swell (no extra wiring needed);
  //   (b) a sparse HIGH uneasy ostinato at low frog HP — a slow step-sequencer
  //       loop (LOWHP_THEME) driven through the SAME _tickThemes machinery;
  //   (c) a brief SWELL on zone entry — a short chord scheduled once;
  //   (d) a triumphant COLLECTION-SWELL phrase (the full-collection moment).
  // All of it rides melodyMaster -> musicBus (the music slider + mute inherit
  // for free). P10: the tick only reads + schedules one bounded note per
  // danger loop per scheduled step — no per-frame allocation of voice graphs.
  _dangerBuild() {
    if (this._danger) return this._danger;
    if (!this.ctx || !this._melodyMaster) return null;
    try {
      const g = this.ctx.createGain();
      g.gain.value = 1;
      g.connect(this._melodyMaster);
      this._danger = { master: g, lowOn: false, lowNext: 0, lowNote: 0, lowThemes: [] };
      return this._danger;
    } catch (e) { return null; /* headless */ }
  }
  // (b) low-HP unease: cross the sparse high ostinato in / out (a step loop,
  // not a per-frame voice — the same bounded machinery as a zone theme).
  setLowHp(on) {
    if (!this.ctx || !this._melodyMaster) return;
    const d = this._dangerBuild();
    if (!d) return;
    on = !!on;
    if (on === d.lowOn) return;
    d.lowOn = on;
    if (on) {
      try {
        const zg = this.ctx.createGain();
        zg.gain.value = 0.4; // a LOW level: an uneasy UNDERLAY, not a lead
        zg.connect(this._melodyMaster);
        d.lowThemes = [{ zone: -99, theme: { root: LOWHP_THEME.root, scale: LOWHP_THEME.scale, pattern: LOWHP_THEME.pattern, stepDur: LOWHP_THEME.stepDur, detune: LOWHP_THEME.detune }, gain: zg, step: 0, nextAt: this.ctx.currentTime + 0.4, muted: false, fading: false }];
      } catch (e) { d.lowThemes = []; /* headless */ }
    } else {
      this._fadeMelodyLayer(d.lowThemes);
      d.lowThemes = [];
    }
  }
  // (c) a brief zone-entry SWELL — a short chord scheduled once (not a loop).
  zoneSwell() {
    if (!this.ctx || !this._melodyMaster) return;
    try {
      const t = this.ctx.currentTime;
      const g = this.ctx.createGain();
      g.gain.value = 0.4;
      g.connect(this._melodyMaster);
      const f = [196.0, 246.94, 293.66, 392.0]; // a rising open minor-ish swell
      for (let i = 0; i < f.length; i++) {
        try { this._tone(t + i * 0.05, 'sine', f[i], f[i], 1.6, 0.12, 0, g); } catch (e) { /* headless */ }
      }
      try { this._tone(t, 'sine', 98.0, 98.0, 2.0, 0.1, 0, g); } catch (e) { /* headless */ }
    } catch (e) { /* headless */ }
  }
  // (d) the FULL COLLECTION moment — a short triumphant chord swell on the
  // melody layer (under the sfxBus collection-fanfare + the cinematicArp).
  collectionSwell() {
    if (!this.ctx || !this._melodyMaster) return;
    try {
      const t = this.ctx.currentTime;
      const g = this.ctx.createGain();
      g.gain.value = 0.55;
      g.connect(this._melodyMaster);
      const f = [261.63, 329.63, 392.0, 523.25]; // a rising major triad + octave
      for (let i = 0; i < f.length; i++) {
        try { this._tone(t + i * 0.14, 'triangle', f[i], f[i], 2.2, 0.2, 0, g); } catch (e) { /* headless */ }
        try { this._tone(t + i * 0.14, 'sine', f[i] * 2, f[i] * 2, 1.6, 0.06, 0, g); } catch (e) { /* headless */ }
      }
      try { this._tone(t + 0.5, 'sine', 130.81, 130.81, 2.6, 0.12, 0, g); } catch (e) { /* headless */ }
    } catch (e) { /* headless */ }
  }

  // ==================== S3 (v1.9): AMBIENT LIFE voices + rAF stepper ====================
  // The sparse ambient-life voices. Each routes to the _ambLifeMaster bus
  // (-> musicBus) so the music slider + mute inherit; each is QUIET (a
  // few-percent peak) — "a quiet bed, not a soundscape". The SCHEDULING is the
  // pure nextAmbientEvent sampler (module top) driven by stepAmbientLife below
  // from the game's rAF expedition tick — NO setInterval. P10: nothing
  // allocates per-frame — stepAmbientLife only accumulates a clock and calls
  // the sampler + one voice per slot.

  // A quiet tone routed to the ambient-life bus (exempt from the sfx cap — it
  // is a music-bus layer, like the melody notes).
  _ambTone(t0, type, f0, f1, dur, peak, detune = 0) {
    if (!this.ctx || !this._ambLifeMaster) return;
    try { this._tone(t0, type, f0, f1, dur, peak, detune, this._ambLifeMaster); } catch (e) { /* headless */ }
  }

  // A quiet filtered-noise burst routed to the ambient-life bus.
  _ambNoise(t0, dur, filterType, freq, q, peak) {
    if (!this.ctx || !this._ambLifeMaster) return;
    try {
      const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuf;
      const f = this.ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
      const g = this.ctx.createGain(); this._env(g, t0, peak, 0.005, dur);
      src.connect(f); f.connect(g); g.connect(this._ambLifeMaster);
      src.start(t0); src.stop(t0 + dur + 0.05);
    } catch (e) { /* headless */ }
  }

  // S3 voice: a sparse INSECT CHIRP (a few short high clicks, a faint flutter).
  _ambChirp(f) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = 2800 + f * 1400;   // a faint high flutter (2800–4200 Hz)
    const clicks = 2 + Math.floor(f * 3);   // 2–4 short clicks
    for (let i = 0; i < clicks; i++) {
      this._ambTone(t + i * 0.055, 'triangle', base * (1 - i * 0.04), base * 0.9, 0.05, 0.028);
    }
  }

  // S3 voice: a WATER DRIP (a short falling "plop" + a tiny surface plink) —
  // only ever scheduled in the Reeds / Black Reeds (the wet biomes).
  _ambDrip(f) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const top = 1500 + f * 700;   // the droplet's high start
    this._ambTone(t, 'sine', top, 380, 0.16, 0.05);            // the falling plop
    this._ambTone(t + 0.16, 'sine', 2200, 1800, 0.05, 0.02);   // the surface plink
  }

  // S3 voice: WIND IN THE REEDS (a slow filtered-noise swell — a long bandpass
  // whoosh that rises and falls). The one S3 voice with a custom slow envelope.
  _ambWind(f) {
    if (!this.ctx || !this._ambLifeMaster) return;
    try {
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource(); src.buffer = this._noiseBuf;
      src.loop = true;
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
      bp.frequency.setValueAtTime(300, t);
      bp.frequency.linearRampToValueAtTime(650 + f * 250, t + 3.0);   // the swell crests
      bp.frequency.linearRampToValueAtTime(280, t + 6.5);            // ...then eases off
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.03, t + 2.8);                 // a VERY quiet bed
      g.gain.linearRampToValueAtTime(0.0001, t + 6.5);
      src.connect(bp); bp.connect(g); g.connect(this._ambLifeMaster);
      src.start(t); src.stop(t + 6.6);
    } catch (e) { /* headless */ }
  }

  // S3 voice: a DISTANT HERON CALL (a rare, far, two-note "hrrr-oh" — a low
  // filtered call with a soft high harmonic, very quiet = distant).
  _ambHeronCall(f) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const low = 300 + f * 60;
    this._ambTone(t, 'sine', low, low * 0.85, 0.5, 0.05);
    this._ambTone(t + 0.55, 'sine', low * 0.7, low * 0.5, 0.7, 0.045);
    this._ambTone(t, 'triangle', low * 2.6, low * 2.2, 0.55, 0.012);   // a faint far harmonic
    this._ambNoise(t + 0.05, 0.4, 'bandpass', 1400, 3.5, 0.015);
  }

  // S3 stepper: drive the ambient-life events from the game's rAF expedition
  // tick (NO setInterval). Accumulates a run clock, and on each whole-second
  // slot calls the PURE nextAmbientEvent sampler with the run's seeded rng +
  // the run's biome, then plays the one event it returns (or nothing). P10:
  // per-frame this only adds to a clock + (once per second) runs the pure
  // sampler and schedules one short voice — no per-frame allocation.
  stepAmbientLife(dt) {
    if (!this.ctx || !this._ambLifeMaster || !this._ambLifeOn) return;
    this._ambLifeT += dt;
    const slot = Math.floor(this._ambLifeT);
    if (slot === this._lastSlot) return;   // already sampled this slot
    this._lastSlot = slot;
    if (!this._ambLifeRng) return;
    const ev = nextAmbientEvent({ biome: this._ambLifeBiome, rng: this._ambLifeRng, t: slot });
    if (!ev) return;
    if (ev.type === 'insect')      this._ambChirp(ev.flavor);
    else if (ev.type === 'water')  this._ambDrip(ev.flavor);
    else if (ev.type === 'wind')   this._ambWind(ev.flavor);
    else if (ev.type === 'heron')  this._ambHeronCall(ev.flavor);
  }

  // S3 lifecycle: start the sparse ambient-life events for a run (seeded by the
  // run's biome + seed so timing is deterministic; the game passes the run's
  // seed). Idempotent — a second call (a zone change) just re-points the biome.
  startAmbientLife(biome, seed) {
    if (!this.ctx || !this._ambLifeMaster) return;
    this._ambLifeOn = true;
    this._ambLifeBiome = (biome === 'reeds' || biome === 'blackReeds') ? biome : 'swamp';
    this._ambLifeT = 0;
    this._lastSlot = -1;
    try { this._ambLifeRng = mulberry32((seed >>> 0) ^ 0x9e3779b9); } catch (e) { this._ambLifeRng = null; }
  }
  // S3 lifecycle: stop the ambient-life events (run end).
  stopAmbientLife() { this._ambLifeOn = false; }

  // Stinger: a short one-shot melodic phrase, scheduled on the melody layer
  // (melodyMaster -> musicBus) so it inherits the music slider + mute. Used
  // for the victory / defeat end-screen beats (S2).
  _stingerGain() {
    if (!this.ctx || !this._melodyMaster) return null;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    g.gain.setTargetAtTime(1, this.ctx.currentTime + 0.03, 0.08);
    g.connect(this._melodyMaster);
    return g;
  }

  // Victory stinger: a RISING MAJOR arpeggio that resolves — a bright,
  // triumphant cadence (I -> V -> I, with the top note landing on the root's
  // octave). Sits on the melody layer so the music slider + mute scale it.
  stingerVictory() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this._stingerGain();
    if (!g) return;
    // A major triad arpeggio up an octave, then a resolving top note.
    // C major: C4 E4 G4 C5 E5 G5 C6 (rising), landing on the bright top C.
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this._tone(t + i * 0.11, 'triangle', f, f, 0.34, 0.5, 0, g);
      this._tone(t + i * 0.11, 'sine', f * 2, f * 2, 0.22, 0.12, 0, g); // sparkle octave
    });
    // a warm bass swell under the arpeggio + a soft shimmer on the resolution
    this._tone(t, 'sine', 130.81, 196.0, 1.1, 0.16, 0, g);
    this._noise(t + 0.5, 0.7, 'bandpass', 5000, 2, 0.06);
  }

  // Defeat stinger: a SLOW DESCENDING MINOR phrase — mournful, spaced out.
  // A minor: A4 G4 F4 E4 (descending), with a soft low pedal underneath.
  stingerDefeat() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this._stingerGain();
    if (!g) return;
    const notes = [440.0, 392.0, 349.23, 329.63]; // A4 G4 F4 E4 (descending)
    notes.forEach((f, i) => {
      this._tone(t + i * 0.28, 'triangle', f, f * 0.995, 0.5, 0.4, 0, g); // slight pitch dip
      this._tone(t + i * 0.28, 'sine', f / 2, f / 2, 0.6, 0.14, 0, g);     // low octave
    });
    // a slow, sinking bass note to settle the phrase
    this._tone(t, 'sine', 110.0, 55.0, 1.4, 0.14, 0, g);
  }

  // K3 (v1.5 M3): the STORM SURGE stinger — a SHORT, RUMBLING BUILD that reads
  // as "a storm is rolling in" (distinct from stingerVictory's bright cadence
  // and stingerDefeat's slow descent): a low rumbling bass swell + a rising
  // tremolo on a dark minor chord + a soft rain-shimmer noise bed. One-shot,
  // on the melody layer (music slider + mute scale it). No-op when the context
  // isn't ready (headless).
  stormSurgeStinger() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this._stingerGain();
    if (!g) return;
    // a low, ominous rumble that swells (A1 -> A2), the bed the storm builds on
    this._tone(t, 'sawtooth', 55.0, 110.0, 1.6, 0.14, -4, g);
    this._tone(t, 'sine', 110.0, 220.0, 1.6, 0.10, 0, g);
    // a dark minor chord tremolo rising (A minor: A3 C4 E4) — the "roll-in"
    for (const [f, dl] of [[220, 0], [261.63, 0.05], [329.63, 0.1]]) {
      this._tone(t + 0.1 + dl, 'triangle', f, f * 1.02, 1.2, 0.12, 2, g);
    }
    // a soft rain shimmer to sit under the swell (the weather reads as rain)
    this._noise(t + 0.15, 1.3, 'bandpass', 2600, 1.4, 0.05);
  }

  // M1 (v1.4): the FIRST-VICTORY cinematic beat's music — a SOFT, SLOW
  // rising pentatonic arpeggio that swells as the world blooms to full color
  // (the ~4 s beat, before the victory card reveals). Deliberately gentle and
  // spaced (long decays, low peak, no shimmer) so it reads as a tender "the
  // swamp blooms" swell, distinct from the bright triumphant stingerVictory()
  // that fires when the card itself reveals. On the melody layer (music slider
  // + mute scale it). No-op when the context isn't ready (headless).
  cinematicArp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this._stingerGain();
    if (!g) return;
    // C-major pentatonic, slow climb: C4 D4 E4 G4 A4 C5 E5 G5 (rising, ~3.6s).
    const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      const at = t + i * 0.45;
      this._tone(at, 'triangle', f, f, 1.35, 0.26, 0, g);          // soft voice
      this._tone(at, 'sine', f * 2, f * 2, 1.1, 0.07, 0, g);       // faint sparkle
    });
    // a warm sustained pad (root + fifth) that swells the whole beat, settling
    // on the top note — a gentle "world opening up" bed under the arpeggio.
    this._tone(t, 'sine', 130.81, 130.81, 3.9, 0.14, 0, g);
    this._tone(t, 'sine', 196.0, 196.0, 3.9, 0.10, 0, g);
  }

  // Lookahead scheduler — call from game.js every frame (the rAF tick).
  // Schedules each ACTIVE (non-muted) theme's notes ~0.25 s ahead of
  // ctx.currentTime so the audio clock, not the frame rate, keeps the rhythm
  // (robust to rAF jitter). Muted (fading) themes are skipped, and any that
  // have faded out are pruned. Drives the zone themes (S1) and the boss loop
  // (S2) through one shared helper. No-op when the context isn't ready
  // (headless).
  tickMusic() {
    if (!this.ctx || !this._melodyMaster) return;
    this._tickThemes(this._zoneThemes || []);
    this._tickThemes(this._bossThemes || []);
    this._tickThemes(this._encoreThemes || []); // M2: the encore arpeggio
    // S2 (v1.9): the LOW-HP uneasy ostinato — the same bounded step machinery.
    // `setLowHp(true)` pushed a slow loop here; the tick only reads + schedules
    // its (bounded) notes. No per-frame allocation (P10).
    if (this._danger && this._danger.lowThemes) this._tickThemes(this._danger.lowThemes);
  }

  // Shared lookahead step-scheduler for a list of { theme, gain, step, nextAt,
  // muted, fading } loops (zone themes + the boss loop). `theme.pulse` adds a
  // low off-beat thump (the S2 boss "pulse layer") underneath the melody.
  _tickThemes(list) {
    if (list.length === 0) return;
    const now = this.ctx.currentTime;
    const ahead = now + 0.25;
    for (let i = list.length - 1; i >= 0; i--) {
      const th = list[i];
      // prune themes whose fade has fully completed (~crossfade + 1.4 s grace)
      if (th.fading && (now - (th._fadeAt || now) > this._crossFade + 1.4)) { list.splice(i, 1); continue; }
      if (th.muted) continue; // fading: stop scheduling new notes
      let guard = 0;
      while (th.nextAt < ahead && guard++ < 16) {
        const step = th.step % th.theme.pattern.length;
        const note = th.theme.pattern[step];
        if (note >= 0) {
          const semi = th.theme.scale[((note % th.theme.scale.length) + th.theme.scale.length) % th.theme.scale.length]
            + 12 * Math.floor(note / th.theme.scale.length);
          const freq = th.theme.root * Math.pow(2, semi / 12);
          try { this._tone(th.nextAt, 'triangle', freq, freq, th.theme.stepDur * 1.9, 0.5, th.theme.detune, th.gain); } catch (e) { /* headless */ }
          // S2 pulse layer: a soft low thump on every OTHER step under the boss
          // melody (drives the "intense" feel). Only when the theme opts in.
          if (th.theme.pulse && (th.step % 2 === 0)) {
            try { this._tone(th.nextAt, 'sine', th.theme.root / 2, th.theme.root / 4, th.theme.stepDur * 0.9, 0.4, 0, th.gain); } catch (e) { /* headless */ }
          }
        }
        th.step++;
        th.nextAt += th.theme.stepDur;
      }
    }
  }

  // M2 (v1.4): the "Encore" viewing screen's soft arpeggio. Reuses the S1
  // melody step-sequencer (melodyMaster -> musicBus) so it inherits the music
  // slider + mute, but at a low level (its own gain of 0.5 under the melody
  // master) with a slow, gentle pattern — a "leisurely walk around the gallery"
  // arpeggio, not a zone theme. No setInterval / audio files / new deps.
  setEncoreArpeggio() {
    if (!this.ctx || !this._melodyMaster) return;
    if (!this._encoreThemes) this._encoreThemes = [];
    if (this._encoreThemes.length > 0) return; // idempotent
    const theme = {
      root: 261.63,                              // C4 — bright, gallery-warm
      scale: [0, 4, 7, 12],                      // major-ish pentatonic arpeggio
      pattern: [0, -1, 1, -1, 2, -1, 3, -1, 2, -1, 1, -1, 0, -1, 1, 2],
      stepDur: 0.42,                             // slow, leisurely
      detune: 6,
    };
    const zg = this.ctx.createGain();
    zg.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    zg.gain.setTargetAtTime(0.5, this.ctx.currentTime + 0.05, 0.6); // LOW level
    zg.connect(this._melodyMaster);
    this._encoreThemes.push({ zone: -1, theme, gain: zg, step: 0, nextAt: this.ctx.currentTime + 0.3, muted: false, fading: false });
  }

  // Fade the melody out and stop the loop (run end / quit to title). Ramps each
  // live zone gain down (a brief musical fade, not a cut), schedules a
  // disconnect for GC, and clears the active list so a new run starts fresh.
  // S2: the boss loop is stopped here too (it lives on the same melody layer),
  // so the "stop the melody layer" entry point covers both. M2: the encore
  // arpeggio is stopped here as well (it lives on the same melody layer), so
  // leaving the encore (to the atelier/title) fades it out cleanly.
  clearZoneTheme() {
    if (!this.ctx) return;
    this._fadeMelodyLayer(this._zoneThemes || []);
    this._fadeMelodyLayer(this._bossThemes || []);
    this._fadeMelodyLayer(this._encoreThemes || []);
    // S2 (v1.9): fade the low-HP uneasy ostinato too (the run's place ended).
    if (this._danger && this._danger.lowThemes) {
      this._fadeMelodyLayer(this._danger.lowThemes);
      this._danger.lowThemes = [];
      this._danger.lowOn = false;
    }
    this._zoneThemes = []; // no active loops remain — a new run seeds its own
    this._zoneThemeI = -1;
    this._bossThemes = [];
    this._bossMusic = false;
    this._encoreThemes = [];
  }

  // S2: ramp a list of melody loops to silence + schedule their disconnect.
  _fadeMelodyLayer(list) {
    if (!this.ctx) return;
    for (const th of list) {
      th.muted = true; th.fading = true; th._fadeAt = this.ctx.currentTime;
      try {
        th.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.35);
        const b = th;
        setTimeout(() => { try { b.gain.disconnect(); } catch (e) {} }, 1200);
      } catch (e) { /* headless */ }
    }
  }

  _env(gainNode, t0, peak, attack, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.linearRampToValueAtTime(peak, t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  _noise(t0, dur, filterType, freq, q, peak) {
    if (!this.ctx) return;
    // S3: _noise is always on the sfx bus — enforce the concurrent-voice cap.
    if (!this._sfxCanStart(dur)) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    this._env(g, t0, peak, 0.005, dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  _tone(t0, type, f0, f1, dur, peak, detune = 0, target = null) {
    if (!this.ctx) return;
    // S3: sfx-bus voices (target === null) are subject to the concurrent-voice
    // cap; melodic layers pass an explicit target (a zone/boss/stinger gain)
    // and are exempt.
    if (target == null && !this._sfxCanStart(dur)) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    o.detune.value = detune;
    const g = this.ctx.createGain();
    this._env(g, t0, peak, 0.004, dur);
    // S1: the melody notes route through their zone gain (target) instead of the
    // sfx bus, so a zone switch can crossfade the whole loop. Defaults to sfxBus.
    o.connect(g); g.connect(target || this.sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  // ------------------------------------------------------------- SFX
  sfx(name, opt = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    switch (name) {
      // S3 (v1.4): the wet-brush swipe. A soft "shh" (a bandpass-noise swish
      // with a slight upward pitch sweep) is the base; the PIGMENT colors it —
      // red a warm low "pew", green a deep "glorp", blue a crystalline "ping",
      // dry a clean high "whoosh". Each pigment adds a DISTINCT signature tone
      // (different type + freq) on the sfx bus so the strokes read differently.
      case 'paint-swipe': {
        const pig = opt.pig || null;
        // S1 (v1.9): a surface-aware layer (the paint verb's texture changes by
        // what the brush touches). The base pigment voice below is unchanged —
        // this only ADDS a short stinger for water / vegetation (soil is the
        // dry baseline, so it adds nothing). No-surface calls are byte-identical
        // to the S3 (v1.4) signature.
        const surf = opt.surface || null;
        if (surf === 'water') {
          this._tone(t + 0.02, 'sine', 620, 280, 0.1, 0.14);      // a soft liquid blip
          this._noise(t, 0.09, 'lowpass', 700, 0.7, 0.1);         // a soft plop tail
        } else if (surf === 'veg') {
          this._noise(t, 0.08, 'bandpass', 2800, 1.6, 0.12);      // a dry rustle
        }
        const sweep = 900 + Math.random() * 200;        // the "shh" center
        this._noise(t, 0.13, 'bandpass', sweep, 1.1, 0.22);
        this._noise(t + 0.02, 0.10, 'bandpass', sweep * 1.4, 1.3, 0.12); // airy top
        if (pig === 'dry') {
          // a CLEAN high whoosh — bright, no low body (it's scrubbing, not staining)
          this._noise(t, 0.16, 'bandpass', 2000 + Math.random() * 300, 1.6, 0.2);
        } else if (pig === 'red') {
          // a warm "pew" — a low-mid saw with a soft body
          this._tone(t, 'sawtooth', 300, 250, 0.13, 0.16);
          this._tone(t, 'sine', 150, 120, 0.14, 0.1);
        } else if (pig === 'green') {
          // a deep "glorp" — a blubby low sine
          this._tone(t, 'sine', 150, 88, 0.15, 0.18);
          this._tone(t + 0.03, 'triangle', 110, 90, 0.12, 0.08);
        } else if (pig === 'blue') {
          // a crystalline "ping" — a bright high sine with a sparkle
          this._tone(t, 'sine', 1500, 1650, 0.1, 0.14);
          this._tone(t + 0.02, 'sine', 2400, 2600, 0.06, 0.05);
        }
        break;
      }
      // S3 (v1.4): the charged splash. A wet "splat" with a low body; the
      // pigment adds a distinct signature (mirrors paint-swipe) so the AoE
      // burst reads in the same color language as the swipe.
      case 'paint-splat': {
        const big = opt.big || 0;
        const pig = opt.pig || null;
        // S1 (v1.9): a surface-aware layer (the charged splash's texture changes
        // by what it lands on). Base voice below is unchanged; water gets a
        // liquid body, vegetation a dry rustle, soil is the baseline.
        const surf = opt.surface || null;
        if (surf === 'water') {
          this._tone(t + 0.02, 'sine', 520, 220, 0.14, 0.16);     // a wet blip
          this._noise(t + 0.03, 0.12, 'lowpass', 600, 0.7, 0.12); // a soft ripple
        } else if (surf === 'veg') {
          this._noise(t, 0.1, 'bandpass', 2600, 1.6, 0.14);       // a dry scatter
        }
        this._noise(t, 0.12 + big * 0.08, 'lowpass', 500 + big * 300, 0.7, 0.4 + big * 0.12);
        this._tone(t, 'sine', 160, 60, 0.16 + big * 0.08, 0.4);
        if (pig === 'red') {
          this._tone(t, 'sawtooth', 300, 220, 0.18, 0.16);
          this._tone(t, 'sine', 140, 100, 0.2, 0.12);
        } else if (pig === 'green') {
          this._tone(t, 'sine', 140, 70, 0.2, 0.2);
          this._tone(t + 0.04, 'triangle', 100, 80, 0.16, 0.1);
        } else if (pig === 'blue') {
          this._tone(t, 'sine', 1500, 1700, 0.14, 0.14);
          this._tone(t + 0.03, 'sine', 2500, 2800, 0.08, 0.06);
        } else if (pig === 'dry') {
          this._noise(t, 0.2, 'bandpass', 2100 + Math.random() * 300, 1.6, 0.22);
        }
        break;
      }
      // S3 (v1.4): tiny status-moment blips — fired the instant a paint status
      // lands, so each color has a distinct "it just happened" sting. Kept
      // short + quiet (they sit under the paint swish, not over it).
      case 'burn-ignite': {
        // a crackling flick: a bright noise tick + a quick rising hiss
        this._noise(t, 0.06, 'highpass', 2400, 2, 0.16);
        this._tone(t, 'triangle', 300, 480, 0.07, 0.09);
        break;
      }
      case 'freeze-tick': {
        // a tiny crystalline click (a single bright, short ping)
        this._tone(t, 'sine', 2000, 2350, 0.05, 0.1);
        break;
      }
      case 'root-thud': {
        // a low, dull thud (the roots biting the ground)
        this._tone(t, 'sine', 120, 70, 0.09, 0.2);
        this._noise(t, 0.05, 'lowpass', 320, 0.8, 0.14);
        break;
      }
      case 'cleanse': {
        // a soft, gentle whoosh (the dry brush scrubbing the stain away)
        this._noise(t, 0.12, 'bandpass', 1200, 1.2, 0.12);
        this._noise(t + 0.03, 0.09, 'bandpass', 1600, 1.3, 0.08);
        break;
      }
      // legacy aliases (kept so any older call site still resolves)
      case 'swish': this.sfx('paint-swipe', { pig: 'wet' }); break;
      case 'splat': this.sfx('paint-splat', opt); break;
      case 'splat-big': this.sfx('splat', { big: 1 }); break;
      case 'faint': {
        // S2 (v1.4): the moment of death — a short, soft, deflating breath +
        // a low wobble. Kept brief so it reads as the instant the frog goes
        // under; the end-screen defeat STINGER (a slow descending minor phrase)
        // carries the "mournful" moment a moment later. Distinct voice from
        // the full 'defeat' phrase (which is now the stinger).
        this._noise(t, 0.22, 'lowpass', 500, 0.7, 0.28);
        this._tone(t, 'sine', 300, 70, 0.3, 0.3);
        this._tone(t + 0.05, 'triangle', 200, 90, 0.26, 0.16);
        break;
      }
      case 'hop': {
        this._tone(t, 'triangle', 300, 520, 0.12, 0.25);
        this._noise(t + 0.09, 0.06, 'lowpass', 800, 0.8, 0.15);
        break;
      }
      case 'boing': {
        // J4 (v1.4): a soft, low landing "boing" — a pitch-down sine with a
        // short overtone. Draw/sfx-time only (no gameplay effect).
        this._tone(t, 'sine', 240, 90, 0.16, 0.32);
        this._tone(t, 'triangle', 120, 60, 0.14, 0.18);
        this._noise(t, 0.06, 'lowpass', 600, 0.7, 0.1);
        break;
      }
      // R1 (v1.6): THE LANTERN — a soft paper "flick" for a real light toggle.
      // A brief airy bandpass swish + a warm low flick (the wick catching / the
      // flame dropping). No gameplay effect.
      case 'paperFlick': {
        const on = opt.on !== false;   // default: flipping ON
        this._noise(t, 0.09, 'bandpass', on ? 1400 : 900, 1.4, 0.12);
        this._tone(t, 'sine', on ? 520 : 300, on ? 700 : 160, 0.1, 0.1);
        break;
      }
      // R1 (v1.6): THE LANTERN — a quiet "wick catching" blip when fuel starts
      // refilling at a firefly / lantern-rest spot. A gentle rising sine + a
      // tiny high sparkle. Latched by the caller to fire once per source-entry.
      case 'wickCatch': {
        this._tone(t, 'sine', 600, 860, 0.16, 0.09);
        this._tone(t + 0.05, 'sine', 1500, 1800, 0.08, 0.045);
        break;
      }
      // R3 (v1.6): the LIGHT-REWRITTEN BESTIARY sfx. Quiet, watery, distinct —
      // each creature gets its own signature so the Reeds bestiary reads
      // differently from the swamp pool. (wisp-blind, serpent-dive,
      // leech-attach, leech-peel.)
      case 'wisp-blind': {
        // a soft blue "squelch" + a rising confused wobble (the spin begins)
        this._noise(t, 0.14, 'bandpass', 2400, 2.2, 0.18);
        this._tone(t + 0.03, 'sine', 900, 1400, 0.16, 0.08);
        break;
      }
      case 'serpent-dive': {
        // a deep mud "thwock" — the serpent dropping back under the water line
        this._tone(t, 'sine', 200, 70, 0.22, 0.2);
        this._noise(t, 0.18, 'lowpass', 500, 1.2, 0.16);
        break;
      }
      case 'leech-attach': {
        // a wet sticky "suck" + a low straining hum
        this._noise(t, 0.1, 'bandpass', 500, 2.4, 0.2);
        this._tone(t + 0.04, 'triangle', 140, 110, 0.2, 0.12);
        break;
      }
      case 'leech-peel': {
        // a clean "pop + slide" — the leech peeling off (paint or hop)
        this._tone(t, 'sine', 500, 900, 0.09, 0.14);
        this._noise(t + 0.03, 'bandpass', 1800, 1.8, 0.1);
        break;
      }
      // R4 (v1.6): THE SILT WYRM — its distinct low RUMBLE layer (S2 pattern: a
      // darker loop the boss engages + a surface-hit stinger). The rumble is a
      // deep, slow, muddy swell (felt more than heard); the breach is a heavy
      // mud "thwomp" with a low boom.
      case 'wyrm-rumble': {
        this._tone(t, 'sawtooth', 55, 40, 0.9, 0.16);
        this._tone(t + 0.15, 'sine', 70, 48, 0.7, 0.14);
        this._noise(t, 0.6, 'lowpass', 160, 0.8, 0.1);
        break;
      }
      case 'wyrm-breach': {
        // the surfaced breach-strike: a heavy mud thwomp + a low boom
        this._tone(t, 'sine', 120, 45, 0.3, 0.3);
        this._noise(t, 0.22, 'lowpass', 400, 1.4, 0.22);
        this._tone(t + 0.05, 'triangle', 90, 50, 0.2, 0.16);
        break;
      }
      // F1 (v1.7): THE HOLLOW WARDEN — its engage RUMBLE (S2 pattern, like the
      // wyrm but HOLLOW + COLD instead of muddy). A pale, echoing, hollow chime
      // that feels like light being drained — distinct from the wyrm's mud swell
      // (a higher, thinner sine + a hollow overtone, no low mud noise). Reuses
      // the existing 'wyrm-breach' thwomp for the maw-strike (no new asset).
      case 'warden-rumble': {
        this._tone(t, 'sine', 150, 90, 0.9, 0.14);
        this._tone(t + 0.12, 'triangle', 220, 150, 0.7, 0.12);
        this._tone(t + 0.2, 'sine', 70, 50, 0.6, 0.1);   // the hollow low undertone
        break;
      }
      case 'paint-hit': {
        const p = opt.pigment || 'dry';
        this._noise(t, 0.08, 'bandpass', p === 'red' ? 700 : p === 'blue' ? 500 : 900, 2, 0.35);
        this._tone(t, 'sine', p === 'red' ? 190 : p === 'blue' ? 150 : 210, 70, 0.1, 0.4);
        break;
      }
      case 'freeze': {
        this._tone(t, 'sine', 900, 1600, 0.18, 0.2);
        this._tone(t + 0.03, 'sine', 1400, 2200, 0.22, 0.12);
        break;
      }
      case 'ignite': {
        this._noise(t, 0.25, 'lowpass', 400, 0.6, 0.3);
        this._tone(t, 'sawtooth', 90, 40, 0.25, 0.12);
        break;
      }
      case 'sprout': {
        this._tone(t, 'triangle', 400, 700, 0.1, 0.18);
        this._tone(t + 0.06, 'triangle', 600, 900, 0.12, 0.14);
        break;
      }
      case 'enemy-hit': {
        this._tone(t, 'square', 140, 90, 0.09, 0.3);
        this._noise(t, 0.05, 'highpass', 2000, 1, 0.15);
        break;
      }
      case 'enemy-die': {
        this._tone(t, 'triangle', 300, 90, 0.22, 0.35);
        this._noise(t, 0.15, 'lowpass', 900, 0.7, 0.25);
        break;
      }
      case 'pickup': {
        this._tone(t, 'sine', 660, 990, 0.09, 0.2);
        this._tone(t + 0.07, 'sine', 990, 1320, 0.12, 0.18);
        break;
      }
      case 'pickup-streak': { // E4: a brighter two-note chime for streaked orbs
        this._tone(t, 'sine', 880, 1180, 0.08, 0.2);
        this._tone(t + 0.06, 'sine', 1180, 1560, 0.09, 0.18);
        this._tone(t + 0.13, 'sine', 1560, 1900, 0.1, 0.14);
        break;
      }
      case 'hurt': {
        this._tone(t, 'sawtooth', 220, 110, 0.18, 0.4);
        this._noise(t, 0.1, 'lowpass', 600, 0.8, 0.3);
        break;
      }
      case 'ui': {
        this._tone(t, 'sine', 520, 620, 0.05, 0.15);
        break;
      }
      case 'ui-back': {
        this._tone(t, 'sine', 500, 380, 0.07, 0.15);
        break;
      }
      case 'paint-create': {
        this._tone(t, 'triangle', 330, 330, 0.1, 0.2);
        this._tone(t + 0.1, 'triangle', 440, 440, 0.1, 0.2);
        this._tone(t + 0.2, 'triangle', 550, 550, 0.16, 0.22);
        this._noise(t + 0.2, 0.2, 'bandpass', 1400, 2, 0.1);
        break;
      }
      case 'boss-growl': {
        this._tone(t, 'sawtooth', 90, 50, 0.5, 0.4);
        this._tone(t, 'sawtooth', 95, 55, 0.5, 0.3, 12);
        this._noise(t, 0.4, 'lowpass', 250, 0.8, 0.2);
        break;
      }
      case 'boss-slam': {
        this._noise(t, 0.35, 'lowpass', 300, 0.8, 0.6);
        this._tone(t, 'sine', 120, 40, 0.4, 0.7);
        break;
      }
      case 'awaken': {
        this._tone(t, 'sine', 300, 900, 0.4, 0.25);
        this._tone(t + 0.1, 'sine', 400, 1200, 0.4, 0.2);
        this._tone(t + 0.2, 'sine', 500, 1500, 0.5, 0.2);
        this._noise(t, 0.5, 'bandpass', 2000, 3, 0.15);
        break;
      }
      // V2 (v1.2 M11): a short celebratory "bloom" when the heron turns
      // colorful — a warm rising major arpeggio (C-E-G-C) over a soft
      // shimmering pad. Distinctive from the plain 'awaken' blip; reuses the
      // existing _tone/_noise voices, no new assets.
      case 'awaken-bloom': {
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
        notes.forEach((f, i) => {
          this._tone(t + i * 0.12, 'sine', f, f, 0.55, 0.22);
          this._tone(t + i * 0.12, 'triangle', f * 2, f * 2, 0.4, 0.08); // sparkle octave
        });
        // a warm low swell underneath the arpeggio
        this._tone(t, 'sine', 130.81, 196.0, 0.9, 0.14);
        this._noise(t + 0.1, 0.8, 'bandpass', 4000, 2.5, 0.08); // airy shimmer
        break;
      }
      case 'victory': {
        const notes = [523, 659, 784, 1046];
        notes.forEach((f, i) => this._tone(t + i * 0.14, 'triangle', f, f, 0.3, 0.25));
        this._noise(t + 0.5, 0.5, 'bandpass', 3000, 2, 0.12);
        break;
      }
      case 'defeat': {
        [392, 330, 262, 196].forEach((f, i) => this._tone(t + i * 0.18, 'triangle', f, f * 0.98, 0.3, 0.22));
        break;
      }
      case 'heal': {
        this._tone(t, 'sine', 500, 700, 0.15, 0.15);
        break;
      }
      case 'charge-ready': {
        this._tone(t, 'sine', 700, 1100, 0.1, 0.12);
        break;
      }
      case 'frog-chime': {
        // M3 (v1.4 easter egg): the frog appreciates the attention — a unique,
        // happy three-note "sparkle" chime (a bright rising triad with a soft
        // overtone). SFX-bus, presentation only (no gameplay / pacing effect).
        this._tone(t, 'sine', 880, 880, 0.14, 0.18);
        this._tone(t + 0.09, 'sine', 1109, 1109, 0.14, 0.16);
        this._tone(t + 0.18, 'sine', 1319, 1760, 0.26, 0.16);
        this._tone(t + 0.09, 'triangle', 550, 1100, 0.2, 0.05);
        break;
      }
      // ---- S1 (v1.9): per-enemy HIT voices. A distinct signature sting per
      // creature so a paint hit reads as THAT enemy being struck (beetle clang /
      // mosquito buzz-sting / toad thud / wisp hiss / serpent slither-hiss /
      // leech slurp). All on the sfx bus via _tone/_noise (target null), short,
      // capped by _sfxCanStart. Presentation-only: no timing / tuning change.
      case 'hit-beetle': {   // armored CLANG — a metallic ring + a dull knock
        this._tone(t, 'square', 220, 160, 0.08, 0.26);
        this._tone(t, 'triangle', 880, 660, 0.12, 0.14);   // the armor ring
        this._noise(t, 0.04, 'highpass', 3200, 1.2, 0.12);
        break;
      }
      case 'hit-mosquito': { // BZ-STING — a fast buzzing zap
        this._tone(t, 'sawtooth', 1400, 900, 0.06, 0.14);
        this._tone(t + 0.03, 'sawtooth', 1600, 1000, 0.05, 0.10);
        this._noise(t, 0.03, 'bandpass', 5000, 3, 0.08);
        break;
      }
      case 'hit-toad': {     // THUD — a low, wet body knock
        this._tone(t, 'sine', 120, 70, 0.12, 0.34);
        this._noise(t, 0.06, 'lowpass', 500, 0.8, 0.16);
        break;
      }
      case 'hit-wisp': {     // HISS — a light airy exhale (it is made of light)
        this._noise(t, 0.12, 'bandpass', 4200, 2.5, 0.14);
        this._tone(t, 'sine', 1800, 2400, 0.1, 0.06);
        break;
      }
      case 'hit-serpent': {  // SLITHER-HISS — a low sliding scrape + hiss
        this._tone(t, 'sawtooth', 180, 90, 0.14, 0.16);
        this._noise(t, 0.1, 'bandpass', 2600, 1.5, 0.12);
        break;
      }
      case 'hit-leech': {    // SLURP — a wet suction blip
        this._tone(t, 'sine', 300, 120, 0.09, 0.22);
        this._noise(t, 0.05, 'lowpass', 1200, 1, 0.14);
        break;
      }
      // ---- S1 (v1.9): per-enemy DEATH voices. A distinct "last note" per
      // creature (vs the generic enemy-die) so a kill reads as THAT enemy going.
      case 'die-beetle': {   // the armor cracks — a clang that falls out
        this._tone(t, 'square', 300, 90, 0.18, 0.28);
        this._tone(t + 0.05, 'triangle', 990, 400, 0.2, 0.12);
        this._noise(t, 0.12, 'highpass', 2800, 1.2, 0.14);
        break;
      }
      case 'die-mosquito': { // the buzz cuts out — a descending zap
        this._tone(t, 'sawtooth', 1600, 300, 0.16, 0.16);
        this._noise(t, 0.08, 'bandpass', 4500, 3, 0.10);
        break;
      }
      case 'die-toad': {     // a heavy wet flop
        this._tone(t, 'sine', 140, 55, 0.24, 0.36);
        this._noise(t, 0.14, 'lowpass', 450, 0.8, 0.2);
        break;
      }
      case 'die-wisp': {     // it disperses — a fading shimmer
        this._tone(t, 'sine', 1400, 2200, 0.2, 0.12);
        this._tone(t + 0.06, 'sine', 1800, 2800, 0.22, 0.08);
        this._noise(t, 0.16, 'bandpass', 5000, 2.5, 0.08);
        break;
      }
      case 'die-serpent': {  // it sinks away — a low slither-fade
        this._tone(t, 'sawtooth', 200, 60, 0.26, 0.2);
        this._noise(t, 0.18, 'bandpass', 2000, 1.5, 0.12);
        break;
      }
      case 'die-leech': {    // it peels off and drops — a wet plop
        this._tone(t, 'sine', 320, 90, 0.14, 0.24);
        this._noise(t + 0.06, 0.08, 'lowpass', 1000, 1, 0.16);
        break;
      }
      // ---- S1 (v1.9): the FULL COLLECTION fanfare (the H2 completion beat).
      // A triumphant major arpeggio + a gilded shimmer — the "museum keeps you
      // better" moment. SFX-bus (distinct from the music-layer cinematicArp it
      // accompanies), presentation-only.
      case 'collection-fanfare': {
        const maj = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5 E5 G5 C6 E6
        maj.forEach((f, i) => {
          this._tone(t + i * 0.12, 'triangle', f, f, 0.4, 0.22);
          this._tone(t + i * 0.12, 'sine', f * 2, f * 2, 0.28, 0.08); // sparkle octave
        });
        this._tone(t + 0.6, 'sine', 261.63, 261.63, 1.0, 0.14);       // warm C4 swell
        this._noise(t + 0.5, 0.9, 'bandpass', 5000, 2.5, 0.1);       // gilded shimmer
        break;
      }
      // ---- S1 (v1.9): the CHARGED SPLASH (the big RMB burst). The core paint
      // verb's "charged big" — a heavier impact than the base splash with a low
      // body + a wide wet throw. Surface-aware (water/veg/soil) like the swipe.
      // SFX-bus, presentation-only (fires from paint.trySplash).
      case 'charge-splash': {
        const surf = opt.surface || null;
        this._tone(t, 'sine', 120, 45, 0.22, 0.42);                 // the deep impact
        this._noise(t, 0.2, 'lowpass', 480, 0.7, 0.42);             // the wide wet throw
        this._noise(t + 0.04, 0.16, 'bandpass', 1600, 1.2, 0.18);   // a spray of droplets
        this._tone(t + 0.03, 'triangle', 240, 140, 0.16, 0.14);     // a bright body
        if (surf === 'water') {
          this._tone(t + 0.05, 'sine', 540, 220, 0.16, 0.16);       // a liquid plunge
          this._noise(t + 0.06, 0.14, 'lowpass', 600, 0.7, 0.14);   // a soft ripple
        } else if (surf === 'veg') {
          this._noise(t, 0.12, 'bandpass', 2600, 1.6, 0.16);        // a dry scatter
        }
        break;
      }
      // ---- S1 (v1.9): status OFF voices — the counterpart to the S3 (v1.4)
      // ignite/freeze/root blips, fired the instant a status EXPIRES (or is
      // scrubbed by a dry brush) so each effect has a distinct "it's over" sting.
      case 'burn-out': {
        // the fire fizzles — a crackle that thins to nothing + a soft low fade
        this._noise(t, 0.12, 'highpass', 1800, 1.8, 0.12);
        this._noise(t + 0.05, 0.14, 'lowpass', 500, 0.9, 0.1);
        this._tone(t + 0.08, 'sine', 300, 140, 0.14, 0.08);
        break;
      }
      case 'freeze-release': {
        // the ice thaws — a soft crystal crack + a warm defrosting hum
        this._tone(t, 'sine', 2200, 1500, 0.07, 0.1);
        this._noise(t + 0.03, 0.09, 'highpass', 3200, 2, 0.08);
        this._tone(t + 0.06, 'sine', 400, 620, 0.12, 0.08);
        break;
      }
      case 'root-crackle': {
        // the roots give way — a low dry crackle + a thud of relief
        this._noise(t, 0.1, 'lowpass', 700, 1, 0.16);
        this._tone(t, 'sine', 130, 80, 0.1, 0.16);
        this._noise(t + 0.06, 0.08, 'bandpass', 1200, 1.4, 0.08);
        break;
      }
      // ---- S1 (v1.9): the BOSS PHASE-SHIFT sting. One shared sting for all four
      // bosses (the gray/green/gilded herons + the Silt Wyrm + Hollow Warden +
      // Umbral Wyrm all route through the same this.heron awaken latch). It is the
      // "the fight just escalated" hit — distinct from the awaken BLOOM (the
      // visual+arpeggio beat in _triggerBloom) and from the per-pigment awaken tone.
      // SFX-bus, presentation-only (fires at the boss's awaken/phase flip).
      case 'boss-phase': {
        this._tone(t, 'sawtooth', 180, 90, 0.3, 0.22);              // a rising roar
        this._tone(t + 0.08, 'sawtooth', 240, 120, 0.3, 0.18);
        this._noise(t, 0.24, 'lowpass', 600, 0.9, 0.18);            // a heavy body
        this._tone(t + 0.16, 'triangle', 520, 780, 0.28, 0.14);     // a rising resolve
        break;
      }
      // ---- S1 (v1.9): the UI HOVER tick — a very soft, high, dry "tick" for
      // moving the focus cursor between options (distinct from the fuller
      // 'ui' confirm click + 'ui-back' back step, which stay as-is).
      case 'ui-hover': {
        this._tone(t, 'sine', 1400, 1600, 0.03, 0.05);
        break;
      }
      // ---- S1 (v1.9): PAUSE open/close — a distinct, slightly larger panel
      // whoosh (vs the flat 'ui' tick) so the pause moment reads as a screen
      // state change, not a button click.
      case 'pause-open': {
        this._noise(t, 0.14, 'bandpass', 900, 1, 0.12);
        this._tone(t, 'sine', 300, 520, 0.14, 0.1);
        break;
      }
      case 'pause-close': {
        this._noise(t, 0.12, 'bandpass', 1400, 1, 0.1);
        this._tone(t, 'sine', 520, 300, 0.12, 0.1);
        break;
      }
      // ---- S1 (v1.9): the BOSS KILL (big) sting. The final blow that drops any
      // heron/wyrm/warden/umbra — a heavy impact + a rising resolve. SFX-bus,
      // presentation-only (fires alongside the existing awaken/hitStop beat).
      case 'boss-kill': {
        this._tone(t, 'sine', 90, 45, 0.5, 0.4);                     // the deep impact
        this._noise(t, 0.3, 'lowpass', 700, 0.8, 0.24);              // the body fall
        this._tone(t + 0.12, 'triangle', 392, 784, 0.4, 0.2);        // rising resolve
        this._tone(t + 0.24, 'triangle', 523, 1046, 0.5, 0.16);
        break;
      }
    }
  }
}

// S2 (v1.9): the PURE theme/density/extra-voices selector + the per-biome +
// boss + low-HP theme data are exported so a node test (tests/music.mjs) can
// assert the right theme + density for swamp / Reeds / Black Reeds / boss /
// lowHp / collection WITHOUT a browser or an AudioContext. Presentation-only
// (logic.js untouched; makeTuning byte-identical).
export { ZONE_THEMES, BOSS_THEMES, LOWHP_THEME, COLLECTION_THEME, nextAmbientEvent, AMBIENT_KINDS, AMBIENT_P };