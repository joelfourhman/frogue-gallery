// Web Audio effects, swamp ambience and the original composed soundtrack.
import { mulberry32 } from './math.js';
import { MusicPlayer, musicScene } from './music.js';

export const _MIX = { musicVolume:.62, sfxVolume:.95, melodyLevel:.8 };

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
    this.ctx=null; this.master=null; this.musicBus=null; this.sfxBus=null;
    this.volume=.7; this.musicVolume=_MIX.musicVolume; this.sfxVolume=_MIX.sfxVolume;
    this.muted=false; this._noiseBuf=null; this._score=null;
    this._ambMaster=null; this._ambLifeMaster=null; this._amb=null;
    this._ambLifeOn=false; this._ambLifeBiome='swamp'; this._ambLifeT=0;
    this._lastSlot=-1; this._ambLifeRng=null; this._crossFade=1.6;
    this._melodyMaster=null; this._melodyLevel=_MIX.melodyLevel;
    this._sfxLive=[]; this._sfxMaxVoices=24;
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

  _musicPlayer() {
    if (!this.ctx || !this._melodyMaster) return null;
    return this._score ||= new MusicPlayer(this.ctx,this._melodyMaster);
  }
  startMusic() {
    this.ctx?.resume?.();
    const player=this._musicPlayer();
    if(player && !player.current)player.setTrack('title');
  }
  stopMusic() {
    this._score?.dispose(); this._score=null; this.clearZoneAmbient();
  }
  setMusicScene(game) {
    const player=this._musicPlayer(); if(!player)return;
    const id=musicScene(game);
    player.setTrack(id);
    player.setMood({quiet:!!(game.paused||game.help||game._bookOpen||game._atlasOpen),
      lowHp:game.state==='expedition' && game.player?.hp/game.player?.maxHp<.25,
      phase:!!game.heron?.awakened});
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
    // Unpitched water and wind leave room for the score's changing harmony.
    return [240,320,480,680,1300].map((f,i)=>({voices:[
      {type:'noise',filter:i===4?'highpass':'lowpass',f,q:.5,g:i===4?.009:.018}
    ]}));
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

  // Compatibility entry points for authored gameplay beats. The scene sync
  // also covers title, rest, clearing, defeat and finale on every real frame.
  setZoneTheme(zone,biome='swamp',region=0) {
    const p=this._musicPlayer();if(!p)return;
    if(['gray','silt','warden','umbral'].includes(p.current?.id))return;
    p.setTrack(region===2?'sanctuary':(['swamp','reeds','blackReeds'].includes(biome)?biome:'swamp'));
  }
  setBossTheme(kind) {
    const p=this._musicPlayer();if(!p)return;
    p.setTrack(({wyrm:'silt',umbra:'umbral',warden:'warden',gray:'gray'})[kind] || (kind===true?'silt':'gray'));
  }
  bossPhaseUp() { if(this._score)this._score.phase=true; }
  setLowHp(on) { if(this._score)this._score.lowHp=!!on; }
  zoneSwell() { /* The regional score carries its own entrance phrase. */ }
  clearZoneTheme() { this._score?.stop(); }

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

  // Endings are complete pieces now, rather than an arpeggio over silence.
  stingerVictory() { this._musicPlayer()?.setTrack('victory'); }
  stingerDefeat() { this._musicPlayer()?.setTrack('defeat'); }
  stormSurgeStinger() { this.bossPhaseUp(); }
  cinematicArp() { this._musicPlayer()?.setTrack('victory'); }
  tickMusic() { this._score?.tick(); }

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
      // Q5 (Astra): the PAINTED CROSSING takes a coat — the bramble parts with
      // a soft woody "shhk" (a bandpass noise sweep down, like a brush through
      // dry stems) under a low leafy thud. Reuses the existing _tone/_noise
      // voices, no new assets.
      // One quiet two-note wing motif: rise to announce the locked dash,
      // descend into a flower. Existing capped SFX bus, no assets/loop voices.
      case 'moth-tell': {
        this._tone(t, 'sine', 392, 440, 0.16, 0.07);
        this._tone(t + 0.18, 'triangle', 523.25, 587.33, 0.20, 0.045);
        break;
      }
      case 'moth-settle': {
        this._tone(t, 'sine', 587.33, 523.25, 0.2, 0.065);
        this._tone(t + 0.18, 'triangle', 440, 392, 0.32, 0.045);
        break;
      }
      case 'crossing-part': {
        this._noise(t, 0.42, 'bandpass', 1600, 2.2, 0.20);        // the brush-through
        this._tone(t + 0.05, 'sine', 98, 65, 0.4, 0.16);          // the leafy thud
        this._tone(t + 0.12, 'triangle', 392, 523.25, 0.3, 0.06); // a small bright lift
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
      case 'garden-note': {
        // Each painted mushroom cap is a small instrument. Stable pentatonic
        // pitches reward experimenting with cap/color combinations without
        // consuming the game's random stream or scheduling a melody loop.
        const note = Number.isFinite(opt?.note) ? Math.min(5, Math.max(0, Math.floor(opt.note))) : 0;
        const root = opt?.pig === 'blue' ? 523.25 : opt?.pig === 'green' ? 130.81 : 261.63;
        const frequency = root * Math.pow(2, [0, 2, 4, 7, 9, 12][note] / 12);
        this._tone(t, opt?.pig === 'red' ? 'triangle' : 'sine', frequency, frequency, 0.18, 0.07);
        this._tone(t + 0.012, 'sine', frequency * 2, frequency * 2, 0.10, 0.025);
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
      // bosses (the Gray Heron + the Silt Wyrm + Hollow Warden +
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

export { nextAmbientEvent, AMBIENT_KINDS, AMBIENT_P };
