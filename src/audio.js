// audio.js — Web Audio SFX + procedural ambient bed. All synthesized, no assets.
// P9: two buses under the master — musicBus (ambient) and sfxBus (effects) —
// so the user can adjust them independently.
'use strict';

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
    this._ambFrac = 0.5;      // ambient bed = a fraction of music volume
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
  _zoneThemeData() {
    // minor-pentatonic-leaning sets, each with a distinct character:
    // 0 Reed Flats (calm, open), 1 Slick Hollow (uneasy, minor), 2 Bramble
    // Thicket (folky, brighter), 3 The Gray Shore (tense, chromatic edge).
    // Index 4 exists as a safe fallback (same as 0) for an out-of-range zone.
    return [
      { root: 220.0, scale: [0, 3, 5, 7, 10],  pattern: [ 0, -1, 2, 4, -1, 3, -1, 2,  0, -1, 4, 2, -1, 3, 2, -1], stepDur: 0.34, detune: 6 },
      { root: 207.65, scale: [0, 3, 5, 7, 10], pattern: [ 0, 2, -1, 0, 3, -1, 4, 3,  2, -1, 0, -1, 5, 4, 3, -1], stepDur: 0.30, detune: -8 },
      { root: 233.08, scale: [0, 2, 5, 7, 9],  pattern: [ 0, 4, 2, -1, 3, 5, -1, 3,  4, 2, 5, -1, 7, 5, 4, 2 ], stepDur: 0.28, detune: 5 },
      { root: 196.0, scale: [0, 1, 5, 7, 10], pattern: [ 0, -1, 1, 0, 7, -1, 5, 1,  0, -1, 1, 7, 5, -1, 4, -1], stepDur: 0.26, detune: -6 },
      { root: 220.0, scale: [0, 3, 5, 7, 10], pattern: [ 0, -1, 2, 4, -1, 3, -1, 2,  0, -1, 4, 2, -1, 3, 2, -1], stepDur: 0.34, detune: 6 },
    ];
  }

  // Crossfade the melody to the zone just entered (game.js calls this from
  // _updateZoneAmbient alongside the ambient bed). The current theme keeps
  // looping but its notes stop (muted) while its zone gain ramps to ~0 over the
  // crossfade; the new theme starts at ~0 and ramps up. Both schedule through
  // melodyMaster -> musicBus, so the music slider + mute scale them all. A list
  // of active themes supports the ~1 s overlap during the fade.
  setZoneTheme(zoneI) {
    if (!this.ctx || !this._melodyMaster) return;
    if (this._bossMusic) return; // S2: the boss loop owns the melody while engaged
    if (zoneI === this._zoneThemeI) return; // idempotent (same zone)
    if (!this._zoneThemes) this._zoneThemes = [];
    const data = this._zoneThemeData();
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
  _bossThemeData() {
    // Each boss theme: { root, scale (semis from root), pattern (16 steps; -1
    // rest), stepDur (faster than any zone theme = the "faster step rate"),
    // detune, pulse (bool — the low off-beat thump layer), mode ('minor'|'major')
    // for the stinger flavor. The scale leans toward a darker, more chromatic
    // minor set than the zone themes, and stepDur is shorter -> the intensity.
    return {
      // Great GRAY Heron (first-time run): a tense minor drive on A, faster
      // than any zone loop, with a pulse layer underneath the melody.
      gray:   { root: 110.0,  scale: [0, 3, 6, 7, 10], pattern: [0, -1, 3, 0,  6, -1, 7, 6,  3, -1, 0, 7,  12, 10, 7, 6], stepDur: 0.18, detune: -6, pulse: true,  mode: 'minor' },
      // Great GREEN Heron (NG+): a darker, brooding variant — lower root, a
      // tritone-ish color (the 1-3-6 scale is a phrygian-flavored minor), the
      // same fast step rate so it reads as "the same fight, one shade darker".
      green:  { root: 98.0,   scale: [0, 1, 3, 6, 10], pattern: [0, 1, -1, 3,  6, -1, 10, 7,  3, 1, 0, -1,  11, 10, 6, -1], stepDur: 0.17, detune: -10, pulse: true,  mode: 'minor' },
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
    this._bossThemes.push({ zone: -1, green: !!green, theme, gain: zg, step: 0, nextAt: this.ctx.currentTime + 0.35, muted: false, fading: false });
  }

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

  // Fade the melody out and stop the loop (run end / quit to title). Ramps each
  // live zone gain down (a brief musical fade, not a cut), schedules a
  // disconnect for GC, and clears the active list so a new run starts fresh.
  // S2: the boss loop is stopped here too (it lives on the same melody layer),
  // so the "stop the melody layer" entry point covers both.
  clearZoneTheme() {
    if (!this.ctx) return;
    this._fadeMelodyLayer(this._zoneThemes || []);
    this._fadeMelodyLayer(this._bossThemes || []);
    this._zoneThemes = []; // no active loops remain — a new run seeds its own
    this._zoneThemeI = -1;
    this._bossThemes = [];
    this._bossMusic = false;
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
    }
  }
}