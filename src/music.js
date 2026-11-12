// Original chamber-adventure score. Audio-clock scheduling, bounded voices,
// shared room acoustics; no assets, timers, game RNG or gameplay side effects.
import { SCORE } from './score.js';

export function musicScene(g = {}) {
  if (g.state === 'camp') return 'rest';
  if (g.state === 'end') return g.endKind === 'victory' ? 'victory' : 'defeat';
  if (g.state !== 'expedition') return 'title';
  const h = g.heron;
  if (h?.hp > 0 && h._intro <= 0 && !h.flying && !h.sinking)
    return ({ gray: 'gray', wyrm: 'silt', warden: 'warden', umbra: 'umbral' })[h.kind] || 'gray';
  if (g.encounter?.active) return 'clearing';
  if (g.campaign?.floor === 2) return 'sanctuary';
  return ['swamp', 'reeds', 'blackReeds'].includes(g.runBiome) ? g.runBiome : 'swamp';
}

export const INSTRUMENTS = Object.freeze({
  piano:    { harmonics: [1,.48,.24,.12,.06,.03], attack:.006, decay:.34, sustain:.16, release:.28, level:.26, cutoff:3400 },
  harp:     { harmonics: [1,.32,.20,.09,.04], attack:.009, decay:.20, sustain:.08, release:.30, level:.21, cutoff:4200 },
  flute:    { harmonics: [1,.18,.06,.035], attack:.055, decay:.16, sustain:.80, release:.14, level:.24, cutoff:5400, vibrato:5 },
  clarinet: { harmonics: [1,.02,.35,.01,.14,.01,.05], attack:.045, decay:.13, sustain:.72, release:.16, level:.22, cutoff:3800, vibrato:3 },
  musicbox: { harmonics: [1,.05,.38,.02,.12,.04], attack:.004, decay:.24, sustain:.06, release:.40, level:.29, cutoff:6400 },
  strings:  { harmonics: [1,.40,.25,.16,.11,.08,.05,.03], attack:.16, decay:.25, sustain:.64, release:.36, level:.20, cutoff:2300, vibrato:4 },
  bass:     { harmonics: [1,.30,.10,.03], attack:.012, decay:.18, sustain:.42, release:.10, level:.30, cutoff:900 },
  kick: { attack:.003, release:.14, level:.26 },
  hat: { attack:.002, release:.07, level:.055 },
  snare: { attack:.003, release:.13, level:.11 },
});
export const MUSIC_LIMITS = Object.freeze({ voices:64, layers:3, eventsPerTick:96, lookahead:.18 });
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const disconnect = node => { try { node.disconnect(); } catch {} };

export class MusicPlayer {
  constructor(ctx, output) {
    this.ctx = ctx; this.output = output;
    this.layers = []; this.voices = []; this.current = null;
    this.quiet = false; this.lowHp = false; this.phase = false;
    this.master = ctx.createGain(); this.master.gain.value = 1.25; this.master.connect(output);
    this.waves = {};
    for (const [name, spec] of Object.entries(INSTRUMENTS)) {
      if (!spec.harmonics || !ctx.createPeriodicWave) continue;
      const real = new Float32Array(spec.harmonics.length + 1);
      const imag = new Float32Array([0, ...spec.harmonics]);
      this.waves[name] = ctx.createPeriodicWave(real, imag);
    }
    // One deterministic noise buffer and room for the entire orchestra.
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    let seed = 71821;
    const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed / 2147483648 - 1; };
    const n = this.noise.getChannelData(0);
    for (let i=0;i<n.length;i++) n[i]=random();
    this.room = null;
    if (ctx.createConvolver) {
      this.room = ctx.createConvolver();
      const impulse = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 1.45), ctx.sampleRate);
      for (let ch=0;ch<2;ch++) {
        const d=impulse.getChannelData(ch);
        for(let i=0;i<d.length;i++) d[i]=random()*Math.exp(-i/ctx.sampleRate*5.2)*.22;
      }
      this.room.buffer=impulse;
      this.wet=ctx.createGain(); this.wet.gain.value=.19;
      this.room.connect(this.wet); this.wet.connect(this.master);
    }
    this.vibrato=ctx.createOscillator(); this.vibrato.frequency.value=5.1; this.vibrato.start();
  }

  setMood({quiet=false,lowHp=false,phase=false}={}) {
    if (this.quiet !== quiet) this.master.gain.setTargetAtTime(quiet ? .625 : 1.25,this.ctx.currentTime,.22);
    this.quiet=quiet; this.lowHp=lowHp; this.phase=phase;
  }

  setTrack(id) {
    if (!SCORE[id]) id='title';
    if (this.current?.id===id) return;
    const now=this.ctx.currentTime;
    for(const layer of this.layers) if(layer.fadeAt===undefined) this._fade(layer,now);
    while(this.layers.length>=MUSIC_LIMITS.layers) this._retire(this.layers.shift());
    const gain=this.ctx.createGain(); gain.gain.setValueAtTime(.0001,now);
    gain.gain.linearRampToValueAtTime(1,now+.8); gain.connect(this.master);
    if(this.room) gain.connect(this.room);
    const score=SCORE[id];
    this.current={id,score,gain,start:now+.035,index:0,cycle:0,step:0};
    this.layers.push(this.current);
  }

  _fade(layer,now) {
    layer.fadeAt=now;
    layer.gain.gain.cancelScheduledValues?.(now);
    layer.gain.gain.setTargetAtTime(.0001,now,.24);
  }
  _retire(layer) {
    for(const v of this.voices) if(v.layer===layer) this._endVoice(v);
    disconnect(layer.gain);
  }
  _endVoice(v) {
    if(v.ended)return;
    v.ended=true;
    try { v.source.stop(); } catch {}
    if(v.modulation) { try { this.vibrato.disconnect(v.modulation); } catch {} }
    for(const n of v.nodes) disconnect(n);
  }
  stop() {
    const now=this.ctx.currentTime;
    for(const layer of this.layers) if(layer.fadeAt===undefined) this._fade(layer,now);
    this.current=null;
  }
  dispose() {
    for(const layer of this.layers) this._retire(layer);
    this.layers.length=0; this.voices.length=0; this.current=null;
    this.vibrato.stop(); disconnect(this.vibrato);
    if(this.room) { disconnect(this.room); disconnect(this.wet); }
    disconnect(this.master);
  }

  tick() {
    const now=this.ctx.currentTime;
    for(const v of this.voices) if(v.end<=now) this._endVoice(v);
    this.voices=this.voices.filter(v=>!v.ended);
    for(let i=this.layers.length-1;i>=0;i--) {
      const layer=this.layers[i];
      if(layer.fadeAt!==undefined && now-layer.fadeAt>1.6) {this._retire(layer);this.layers.splice(i,1);}
    }
    const layer=this.current;
    if(!layer)return;
    const {score}=layer, seconds=60/score.bpm, beats=score.bars*score.beatsPerBar;
    const end=now+MUSIC_LIMITS.lookahead, events=score.events;
    let at=layer.start+(layer.cycle*beats+events[layer.index].beat)*seconds;
    // Suspended tabs resume at the current musical position, never play a backlog.
    if(at<now-.08) {
      const elapsed=Math.max(0,(now-layer.start)/seconds);
      layer.cycle=Math.floor(elapsed/beats);
      const beat=elapsed-layer.cycle*beats;
      let lo=0,hi=events.length;
      while(lo<hi){const mid=(lo+hi)>>>1;if(events[mid].beat<beat)lo=mid+1;else hi=mid;}
      layer.index=lo;
      if(lo===events.length){layer.index=0;layer.cycle++;}
    }
    for(let count=0;count<MUSIC_LIMITS.eventsPerTick;count++) {
      const event=events[layer.index];
      at=layer.start+(layer.cycle*beats+event.beat)*seconds;
      if(at>=end)break;
      this.note(event,Math.max(now+.002,at),seconds,layer);
      if(this.lowHp && event.instrument==='bass' && event.beat%4===0)
        this.note({instrument:'kick',midi:36,duration:.12,velocity:.22,pan:0},Math.max(now+.002,at),seconds,layer);
      layer.step++; layer.index++;
      if(layer.index===events.length){layer.index=0;layer.cycle++;}
    }
  }

  note(event,at,seconds,layer=this.current) {
    if(!layer || this.voices.length>=MUSIC_LIMITS.voices)return;
    const ctx=this.ctx, spec=INSTRUMENTS[event.instrument]||INSTRUMENTS.piano;
    const duration=Math.max(.045,event.duration*seconds);
    const percussion=['hat','snare','kick'].includes(event.instrument);
    const noise=event.instrument==='hat'||event.instrument==='snare';
    const source=noise?ctx.createBufferSource():ctx.createOscillator();
    if(noise)source.buffer=this.noise;
    else {
      source.frequency.setValueAtTime(event.instrument==='kick'?125:hz(event.midi),at);
      if(event.instrument==='kick')source.frequency.exponentialRampToValueAtTime(42,at+.13);
      else if(this.waves[event.instrument])source.setPeriodicWave(this.waves[event.instrument]);
      else source.type=event.instrument==='strings'?'triangle':'sine';
    }
    const gain=ctx.createGain(), filter=ctx.createBiquadFilter();
    const nodes=[source,gain,filter];
    filter.type=noise?'highpass':'lowpass'; filter.Q.value=.5;
    filter.frequency.value=noise?(event.instrument==='hat'?6500:1700):(spec.cutoff||220);
    const peak=spec.level*event.velocity*(this.phase&&percussion?1.14:1);
    const attack=Math.min(spec.attack,duration*.25), release=spec.release;
    gain.gain.setValueAtTime(.0001,at);
    gain.gain.linearRampToValueAtTime(peak,at+attack);
    const sustain=percussion?.0001:Math.max(.0001,peak*spec.sustain);
    gain.gain.exponentialRampToValueAtTime(sustain,at+Math.min(duration,attack+(spec.decay||release)));
    gain.gain.setValueAtTime(sustain,at+duration);
    gain.gain.exponentialRampToValueAtTime(.0001,at+duration+release);
    source.connect(filter);filter.connect(gain);
    if(ctx.createStereoPanner){const pan=ctx.createStereoPanner();pan.pan.value=event.pan||0;gain.connect(pan);pan.connect(layer.gain);nodes.push(pan);}
    else gain.connect(layer.gain);
    let modulation=null;
    if(spec.vibrato&&source.detune){modulation=ctx.createGain();modulation.gain.value=spec.vibrato;this.vibrato.connect(modulation);modulation.connect(source.detune);nodes.push(modulation);}
    const end=at+duration+release+.025;
    const voice={source,nodes,layer,end,modulation,ended:false};this.voices.push(voice);
    source.onended=()=>this._endVoice(voice);
    source.start(at);source.stop(end);
  }
}
