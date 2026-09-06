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

  _env(gainNode, t0, peak, attack, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.linearRampToValueAtTime(peak, t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  _noise(t0, dur, filterType, freq, q, peak) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    this._env(g, t0, peak, 0.005, dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  _tone(t0, type, f0, f1, dur, peak, detune = 0) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    o.detune.value = detune;
    const g = this.ctx.createGain();
    this._env(g, t0, peak, 0.004, dur);
    o.connect(g); g.connect(this.sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  // ------------------------------------------------------------- SFX
  sfx(name, opt = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'swish': {
        // brush arc: bandpass noise sweep
        this._noise(t, 0.14, 'bandpass', 900 + Math.random() * 300, 1.2, 0.25);
        break;
      }
      case 'splat': {
        const big = opt.big || 0;
        this._noise(t, 0.12 + big * 0.08, 'lowpass', 500 + big * 300, 0.7, 0.4 + big * 0.15);
        this._tone(t, 'sine', 160, 60, 0.16 + big * 0.08, 0.5);
        break;
      }
      case 'splat-big': this.sfx('splat', { big: 1 }); break;
      case 'hop': {
        this._tone(t, 'triangle', 300, 520, 0.12, 0.25);
        this._noise(t + 0.09, 0.06, 'lowpass', 800, 0.8, 0.15);
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