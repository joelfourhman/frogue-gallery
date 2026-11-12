// Authored score + live scheduler regression checks. A recording graph proves
// scheduling/routing/resource behavior; actual sound is rendered in the browser
// gate. Neither a stub nor waveform metrics establish musical enjoyment.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { AudioSys, nextAmbientEvent, AMBIENT_KINDS, AMBIENT_P, _MIX } from '../src/audio.js';
import { SCORE } from '../src/score.js';
import { MusicPlayer, musicScene } from '../src/music.js';
import { mulberry32 } from '../src/math.js';

const trackIds = ['title', 'swamp', 'reeds', 'sanctuary', 'blackReeds', 'clearing',
  'gray', 'silt', 'warden', 'umbral', 'rest', 'victory', 'defeat'];
const instruments = new Set(['piano', 'flute', 'musicbox', 'clarinet', 'strings',
  'harp', 'bass', 'kick', 'hat', 'snare']);

export function testMusicScore() {
  assert.deepEqual(Object.keys(SCORE).sort(), [...trackIds].sort(), 'all music contexts have original scores');
  const signatures = new Set();
  for (const [id, score] of Object.entries(SCORE)) {
    assert.equal(typeof score.title, 'string', `${id}: named composition`);
    assert(score.bpm >= 45 && score.bpm <= 180, `${id}: musical tempo`);
    assert(Number.isInteger(score.bars) && score.bars >= 8 && score.bars <= 32, `${id}: long-form phrase`);
    assert.equal(score.beatsPerBar, 4);
    assert(score.events.length > 30 && score.events.length <= 1400, `${id}: bounded composed arrangement`);
    let previous = -1;
    const voices = new Set(), pitches = new Set();
    for (const event of score.events) {
      for (const prop of ['beat', 'midi', 'duration', 'velocity', 'pan']) {
        assert(Number.isFinite(event[prop]), `${id}: finite ${prop}`);
      }
      assert(event.beat >= previous && event.beat >= 0 && event.beat < score.bars * 4, `${id}: sorted within loop`);
      assert(event.duration > 0 && event.duration <= 16, `${id}: bounded note length`);
      assert(event.midi >= 0 && event.midi <= 127, `${id}: valid MIDI pitch`);
      assert(event.velocity > 0 && event.velocity <= 1, `${id}: valid velocity`);
      assert(event.pan >= -1 && event.pan <= 1, `${id}: valid stereo placement`);
      assert(instruments.has(event.instrument), `${id}: renderer supports ${event.instrument}`);
      previous = event.beat; voices.add(event.instrument); pitches.add(event.midi);
    }
    assert(voices.size >= 3, `${id}: more than a monophonic loop`);
    assert(pitches.size >= 8, `${id}: melodic/harmonic development`);
    assert(previous >= score.bars * 4 - 8, `${id}: composition reaches its final phrase`);
    signatures.add(JSON.stringify(score.events));
  }
  assert.equal(signatures.size, trackIds.length, 'every context has a distinct composition');
  const region = floor => ({ state: 'expedition', campaign: { floor }, runBiome: floor === 0 ? 'swamp' : floor === 3 ? 'blackReeds' : 'reeds' });
  assert.equal(musicScene({ state: 'title' }), 'title');
  assert.equal(musicScene({ state: 'camp' }), 'rest');
  assert.equal(musicScene({ state: 'end', endKind: 'victory' }), 'victory');
  assert.equal(musicScene({ state: 'end', endKind: 'defeat' }), 'defeat');
  for (const [floor, id] of ['swamp', 'reeds', 'sanctuary', 'blackReeds'].entries()) {
    assert.equal(musicScene(region(floor)), id, `region ${floor} selects ${id}`);
  }
  assert.equal(musicScene({ ...region(0), encounter: { active: true } }), 'clearing');
  for (const [kind, id] of [['gray', 'gray'], ['wyrm', 'silt'], ['warden', 'warden'], ['umbra', 'umbral']]) {
    assert.equal(musicScene({ ...region(0), heron: { kind, hp: 100, _intro: 0 } }), id, `${id} has its own battle score`);
    assert.equal(musicScene({ ...region(0), heron: { kind, hp: 0, _intro: 0 } }), 'swamp', 'dead boss cannot hold the battle score');
    assert.equal(musicScene({ ...region(0), heron: { kind, hp: 100, _intro: 2 } }), 'swamp', 'distant/unengaged boss does not start battle music');
  }
  assert.equal(musicScene({ ...region(0), collection: true }), 'swamp', 'retired collection mode cannot override the swamp');
  return { tracks: trackIds.length, notes: Object.values(SCORE).reduce((n, s) => n + s.events.length, 0) };
}

// Parameters reject NaN/Infinity and invalid times. Nodes record graph edges,
// start/stop times and disconnects without invoking browser audio APIs.
export function recordingContext() {
  const nodes = [], starts = [], params = [];
  function param(value = 0) {
    const p = { value };
    for (const method of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime']) {
      p[method] = (v, time, constant) => {
        assert(Number.isFinite(v) && Number.isFinite(time) && time >= 0, `finite ${method} scheduling`);
        if (method === 'exponentialRampToValueAtTime') assert(v > 0, 'positive exponential target');
        if (constant !== undefined) assert(Number.isFinite(constant) && constant > 0, 'valid time constant');
        p.value = v; params.push({ method, v, time }); return p;
      };
    }
    p.cancelScheduledValues = p.cancelAndHoldAtTime = time => { assert(Number.isFinite(time) && time >= 0); return p; };
    return p;
  }
  function node(kind) {
    const n = { kind, type: 'sine', frequency: param(440), detune: param(), Q: param(1),
      gain: param(1), pan: param(), delayTime: param(), playbackRate: param(1),
      threshold: param(), knee: param(), ratio: param(1), attack: param(), release: param(),
      _connections: [], disconnected: false,
      connect(target) { assert(target, 'connected to an existing node'); n._connections.push(target); return target; },
      disconnect(target) {
        if (target) n._connections = n._connections.filter(connection => connection !== target);
        else { n.disconnected = true; n._connections.length = 0; }
      },
      start(time = 0) { assert(Number.isFinite(time) && time >= 0); n.startAt = time; starts.push(n); },
      stop(time = 0) { assert(Number.isFinite(time) && time >= 0); n.stopAt = time; },
      setPeriodicWave(wave) { n.wave = wave; },
    };
    nodes.push(n); return n;
  }
  return {
    currentTime: 0, sampleRate: 22050, state: 'running', nodes, starts, params,
    destination: node('destination'),
    createGain: () => node('gain'), createOscillator: () => node('oscillator'),
    createBiquadFilter: () => node('filter'), createDynamicsCompressor: () => node('compressor'),
    createBufferSource: () => node('buffer'), createStereoPanner: () => node('panner'),
    createDelay: () => node('delay'), createConvolver: () => node('convolver'),
    createPeriodicWave: (real, imag) => ({ real, imag }),
    createBuffer(channels, length, sampleRate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: channel => data[channel] };
    },
    resume: async () => {}, suspend: async () => {},
  };
}

export function testMusicPlayback() {
  const ctx = recordingContext(), output = ctx.createGain(), player = new MusicPlayer(ctx, output);
  const reaches = (node, destination, seen = new Set()) => node === destination ||
    (!seen.has(node) && (seen.add(node), (node._connections || []).some(n => reaches(n, destination, seen))));
  let maxVoices = 0, started = 0;
  for (const id of trackIds) {
    player.setTrack(id);
    const layer = player.current;
    assert.equal(layer.id, id);
    player.setTrack(id); assert.equal(player.current, layer, 'same scene preserves phrase position');
    const before = ctx.starts.length, stopAt = ctx.currentTime + layer.score.bars * 4 * 60 / layer.score.bpm + 1;
    while (ctx.currentTime < stopAt) {
      player.tick();
      maxVoices = Math.max(maxVoices, player.voices.length);
      assert(player.voices.length <= 64 && player.layers.length <= 3, 'transport respects voice/layer caps');
      ctx.currentTime += .1;
    }
    assert(layer.cycle >= 1, `${id}: full composition loops on the audio clock`);
    assert(ctx.starts.length - before > 30, `${id}: instruments actually scheduled`);
    assert(player.voices.every(v => reaches(v.source, output)), `${id}: every active voice reaches the music output`);
    assert(player.vibrato._connections.length <= 64, 'persistent vibrato does not retain expired note nodes');
    started += ctx.starts.length - before;
    // The recorder is evidence, not production state; release old evidence
    // between compositions so the smoke harness itself stays modest.
    ctx.starts.length = 0; ctx.params.length = 0; ctx.nodes.length = 0;
  }
  player.setTrack('swamp'); const old = player.current; player.tick();
  player.setTrack('reeds');
  assert(old.fadeAt !== undefined && player.layers.includes(old), 'old phrase releases under the new region');
  assert(reaches(player.current.gain, output), 'new region routes through music output');
  ctx.currentTime += 2; player.tick(); player.tick();
  assert(!player.layers.includes(old) && old.gain.disconnected, 'faded region gain retires');

  for (let i = 0; i < 100; i++) { player.setTrack(trackIds[i % trackIds.length]); player.tick(); }
  assert(player.layers.length <= 3 && player.voices.length <= 64, 'rapid scene changes are bounded');
  ctx.currentTime += 600;
  const beforeStall = ctx.starts.length, beforeStep = player.current.step;
  player.tick();
  assert(player.current.step - beforeStep <= 96, 'a suspended tab never replays its backlog');
  assert(ctx.starts.slice(beforeStall).every(n => n.startAt >= ctx.currentTime), 'resume never schedules stale starts');
  player.setMood({ quiet: true, lowHp: true, phase: true });
  const quietGain = player.master.gain.value;
  player.setMood({ quiet: false });
  assert(player.master.gain.value > quietGain, 'pause/book duck releases on resume');
  player.stop(); assert.equal(player.current, null);
  ctx.currentTime += 20; player.tick(); player.tick();
  assert.equal(player.layers.length, 0, 'stopped layers retire');
  assert.equal(player.voices.length, 0, 'stopped voices retire');
  assert.equal(player.vibrato._connections.length, 0, 'all per-note vibrato connections retire');
  player.dispose(); assert(player.master.disconnected && player.vibrato.disconnected);
  assert.equal(player.vibrato._connections.length, 0, 'dispose disconnects the persistent modulation source');

  const originalWindow = globalThis.window, control = recordingContext();
  try {
    globalThis.window = { AudioContext: function () { return control; } };
    const au = new AudioSys(); assert(au.ensure()); au.startMusic();
    assert.equal(au._score.current.id, 'title');
    assert(au._melodyMaster._connections.includes(au.musicBus), 'score routes into independent music bus');
    assert(!reaches(au._score.master, au.sfxBus), 'music does not use SFX volume');
    au.setMusicVolume(.2); assert.equal(au.musicBus.gain.value, .2);
    const sfx = au.sfxBus.gain.value;
    au.setMusicVolume(0); assert.equal(au.musicBus.gain.value, 0); assert.equal(au.sfxBus.gain.value, sfx);
    au.setMuted(true); assert.equal(au.master.gain.value, 0);
    au.setMusicVolume(.4); au.setMuted(false); assert.equal(au.master.gain.value, au.volume);
    assert.equal(au.musicBus.gain.value, .4);
    assert(_MIX.musicVolume > 0 && _MIX.musicVolume <= 1 && _MIX.melodyLevel > 0 && _MIX.melodyLevel <= 1);
    au.setZoneTheme(0, 'swamp'); assert.equal(au._score.current.id, 'swamp');
    const swamp = au._score.current; au.setZoneTheme(1, 'swamp');
    assert.equal(au._score.current, swamp, 'zone boundaries do not restart a long regional phrase');
    for (const [kind, id] of [['gray', 'gray'], ['wyrm', 'silt'], ['warden', 'warden'], ['umbra', 'umbral']]) {
      au.setBossTheme(kind); assert.equal(au._score.current.id, id);
    }
    au.bossPhaseUp(); assert.equal(au._score.phase, true);
    au.setLowHp(true); assert.equal(au._score.lowHp, true);
    au.clearZoneTheme(); assert.equal(au._score.current, null);
    au.stingerVictory(); assert.equal(au._score.current.id, 'victory');
    au.stingerDefeat(); assert.equal(au._score.current.id, 'defeat');
    au.setMusicScene({ state: 'camp' }); assert.equal(au._score.current.id, 'rest');
    au.setMusicScene({ state: 'expedition', campaign: { floor: 2 }, runBiome: 'reeds', paused: true });
    assert.equal(au._score.current.id, 'sanctuary'); assert.equal(au._score.quiet, true);
    const sanctuary = au._score.current;
    au.setMusicScene({ state: 'expedition', campaign: { floor: 2 }, runBiome: 'reeds', player: { hp: 10, maxHp: 100 } });
    assert.equal(au._score.current, sanctuary, 'low health keeps the current phrase and key');
    assert.equal(au._score.lowHp, true); assert.equal(au._score.quiet, false);
    au.setMusicScene({ state: 'expedition', campaign: { floor: 2 }, runBiome: 'reeds', _bookOpen: true, player: { hp: 80, maxHp: 100 } });
    assert.equal(au._score.current, sanctuary, 'opening the sketchbook preserves musical position');
    assert.equal(au._score.lowHp, false); assert.equal(au._score.quiet, true);
    au.setMusicScene({ state: 'expedition', campaign: { floor: 2 }, runBiome: 'reeds', player: { hp: 80, maxHp: 100 } });
    assert.equal(au._score.current, sanctuary, 'resuming restores the same ongoing phrase');
    assert.equal(au._score.quiet, false);
    au.tickMusic(); au.stopMusic(); assert.equal(au._score, null, 'full shutdown disposes soundtrack');
    au.startMusic(); assert.equal(au._score.current.id, 'title', 'soundtrack can restart after teardown');
    au.stopMusic();
  } finally { globalThis.window = originalWindow; }
  return { started, maxVoices };
}

function testAmbientLife() {
  assert.equal(AMBIENT_KINDS.length, 4);
  function sample(biome, seed, slots) {
    const rng = mulberry32(seed), result = [];
    for (let t = 0; t < slots; t++) {
      const event = nextAmbientEvent({ biome, rng, t });
      if (event) {
        assert(AMBIENT_KINDS.includes(event.type));
        assert(event.flavor >= 0 && event.flavor <= 1);
        assert.equal(event.t, t); result.push(event);
      }
    }
    return result;
  }
  for (const biome of ['swamp', 'reeds', 'blackReeds']) {
    for (const kind of AMBIENT_KINDS) assert(AMBIENT_P[biome][kind] >= 0);
    assert(AMBIENT_P[biome].heron < AMBIENT_P[biome].insect);
  }
  assert.deepEqual(sample('reeds', 42, 600), sample('reeds', 42, 600), 'ambient timing stays deterministic');
  assert.notDeepEqual(sample('reeds', 42, 600), sample('reeds', 43, 600), 'ambient seeds remain distinct');
  assert(sample('reeds', 42, 600).length / 600 < .25, 'ambient wildlife remains sparse');
  assert.equal(sample('swamp', 7, 6000).filter(e => e.type === 'water').length, 0);
  assert(sample('reeds', 7, 6000).some(e => e.type === 'water'));
  const ctx = recordingContext(), originalWindow = globalThis.window;
  try {
    globalThis.window = { AudioContext: function () { return ctx; } };
    const au = new AudioSys(); assert(au.ensure());
    assert(au._ambLifeMaster._connections.includes(au.musicBus));
    au.startAmbientLife('watery', 1234); assert.equal(au._ambLifeBiome, 'swamp');
    au.startAmbientLife('reeds', 1234); assert.equal(au._ambLifeBiome, 'reeds');
    for (let i = 0; i < 10; i++) au.stepAmbientLife(1);
    const before = au._lastSlot; au.stepAmbientLife(0); assert.equal(au._lastSlot, before);
    au.stopAmbientLife(); assert.equal(au._ambLifeOn, false);
  } finally { globalThis.window = originalWindow; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Score:', testMusicScore());
  console.log('Transport:', testMusicPlayback());
  testAmbientLife();
  console.log('MUSIC TESTS PASSED (original compositions, scene routing, bounded transport, ambient life)');
}
