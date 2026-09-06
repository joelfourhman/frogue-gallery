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