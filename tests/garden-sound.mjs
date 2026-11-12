import assert from 'node:assert/strict';
import { AudioSys } from '../src/audio.js';

// Exercise the real dispatcher, voice cap and graph without replacing window
// or booting the unrelated noise buffer. Safe to import from the smoke suite.
const nodes = [];
const param = () => ({ value: 0, start: 0,
  setValueAtTime(value, time) { assert(Number.isFinite(value) && Number.isFinite(time)); this.value = this.start = value; },
  linearRampToValueAtTime(value, time) { assert(Number.isFinite(value) && Number.isFinite(time)); this.value = value; },
  exponentialRampToValueAtTime(value, time) { assert(Number.isFinite(value) && Number.isFinite(time)); this.value = value; },
});
const node = kind => {
  const n = { kind, frequency: param(), detune: param(), gain: param(), connections: [],
    connect(target) { this.connections.push(target); },
    start(time) { assert(Number.isFinite(time)); this.startTime = time; },
    stop(time) { assert(Number.isFinite(time)); this.stopTime = time; },
  };
  nodes.push(n); return n;
};
const audio = new AudioSys();
audio.ctx = { currentTime: 10, createOscillator: () => node('osc'), createGain: () => node('gain') };
audio.sfxBus = node('sfx'); audio.musicBus = node('music'); audio.master = node('master');
audio.sfxBus.connect(audio.master); audio.musicBus.connect(audio.master);
const play = opt => {
  audio._sfxLive = []; const before = nodes.length;
  const random = Math.random;
  try { Math.random = () => { throw new Error('garden notes must not consume gameplay randomness'); }; audio.sfx('garden-note', opt); }
  finally { Math.random = random; }
  const voices = nodes.slice(before).filter(n => n.kind === 'osc');
  assert.equal(voices.length, 2, 'one cap creates only two short voices');
  for (const voice of voices) {
    assert.equal(voice.connections[0].connections[0], audio.sfxBus, 'garden sounds inherit SFX volume');
    assert(voice.stopTime - voice.startTime <= .24, 'no long tail or queued melody');
    assert(voice.frequency.start >= 130 && voice.frequency.start <= 2100);
  }
  return voices[0].frequency.start;
};
for (const pig of ['red', 'blue', 'green']) {
  const pitches = Array.from({ length: 6 }, (_, note) => play({ pig, note }));
  assert.equal(new Set(pitches).size, 6, 'each cap index can play a distinct pentatonic pitch');
  assert(pitches.every((value, i) => !i || value > pitches[i - 1]));
}
assert.equal(new Set(['red', 'blue', 'green'].map(pig => play({ pig, note: 2 }))).size, 3, 'recoloring changes the voice register');
const lowest = play({ pig: 'red', note: 0 });
const highest = play({ pig: 'red', note: 5 });
assert.equal(play({ pig: 'red', note: -90 }), lowest);
assert.equal(play({ pig: 'red', note: 900 }), highest);
for (const note of [NaN, Infinity, -Infinity, '3', undefined]) assert.equal(play({ pig: 'red', note }), lowest);
assert.equal(play(null), lowest, 'malformed options have a finite fallback');
assert.equal(play({ pig: 'unexpected', note: 0 }), lowest);

audio.setSfxVolume(.2); assert.equal(audio.sfxBus.gain.value, .2);
audio.setSfxVolume(0); assert.equal(audio.sfxBus.gain.value, 0); play({ pig: 'blue', note: 2 });
audio.setMuted(true); const mutedCount = nodes.length;
audio.sfx('garden-note', { pig: 'red', note: 1 });
assert.equal(nodes.length, mutedCount, 'mute creates no garden voices');
assert.equal(audio.master.gain.value, 0);
audio.setMuted(false);
audio._sfxLive = Array(audio._sfxMaxVoices).fill(20);
const cappedCount = nodes.length;
audio.sfx('garden-note', { pig: 'red', note: 1 });
assert.equal(nodes.length, cappedCount, 'garden notes cannot exceed the existing SFX voice cap');
console.log('Garden sound: distinct color/cap notes, finite inputs, short capped voices, mute and SFX routing PASS');
