// Original, authored music for our swamp. No samples, borrowed tunes, RNG or
// browser state: this module is the score; music.js supplies the instruments.
// Beat = a quarter note. The second chorus changes orchestration and answers
// the lead with a quiet countermelody rather than choosing random pitches.

const NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(name) {
  const m = /^([A-G])([#b]?)([0-8])$/.exec(name);
  if (!m) throw new Error(`Invalid score note: ${name}`);
  return (+m[3] + 1) * 12 + NOTES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

// Voiced above the bass: thirds/sevenths and gentle ninths keep these chords
// warm without stacking muddy root-position triads in the low register.
const CHORDS = {
  G: ['G2', 'B3 D4 A4'], C: ['C3', 'B3 E4 G4'], D: ['D3', 'C4 F#4 A4'],
  C7: ['C3', 'Bb3 E4 G4'],
  Ds: ['D3', 'C4 G4 A4'], Em: ['E3', 'B3 D4 G4'], Am: ['A2', 'C4 E4 G4'],
  Bm: ['B2', 'D4 F#4 A4'], B: ['B2', 'D#4 F#4 A4'],
  F: ['F2', 'A3 C4 E4'], Fm: ['F2', 'Ab3 C4 Eb4'],
  Bb: ['Bb2', 'A3 D4 F4'], Eb: ['Eb3', 'G3 Bb3 D4'],
  Cm: ['C3', 'Eb4 G4 Bb4'], Dm: ['D3', 'F4 A4 C5'],
  A: ['A2', 'C#4 E4 G4'], E: ['E3', 'G#3 B3 D4'],
  Fsm: ['F#2', 'A3 C#4 E4'], Fs: ['F#2', 'A#3 C#4 E4'],
};
for (const key of Object.keys(CHORDS)) {
  const [bass, tones] = CHORDS[key];
  CHORDS[key] = { bass: midi(bass), tones: tones.split(' ').map(midi) };
}

// The opening G–B–D–E–D is the frog's "home" melody. Its contour returns in
// the marsh, the rest, and the victory; Umbral bends its third into minor.
const HOME = [
  'G4:1 B4:.5 D5:.5 E5:1 D5:1', 'B4:1 A4:.5 G4:.5 D5:1 r:1',
  'E5:1 G5:1 F#5:.5 E5:.5 D5:1', 'C5:1 B4:1 A4:1 r:1',
  'G4:.5 B4:.5 D5:1 F#5:1 E5:1', 'D5:1 B4:.5 A4:.5 G4:1 E4:1',
  'A4:1 B4:.5 C5:.5 D5:1 F#4:1', 'G4:2 r:1 D4:1',
  'B4:1 D5:1 G5:1 F#5:.5 E5:.5', 'D5:1 E5:.5 D5:.5 B4:1 r:1',
  'C5:1 E5:1 G5:.5 E5:.5 D5:1', 'F#5:1 E5:.5 D5:.5 A4:2',
  'B4:1 D5:.5 E5:.5 G5:1 F#5:1', 'E5:1 D5:1 B4:1 G4:1',
  'A4:.5 B4:.5 C5:1 F#4:1 A4:1', 'G4:3 r:1',
];
const MARSH = [
  'G4:.5 B4:.5 D5:1 E5:.5 D5:.5 B4:1', 'A4:.5 B4:.5 D5:1 B4:1 G4:1',
  'E5:1 G5:.5 E5:.5 D5:1 B4:1', 'A4:1 F#4:.5 A4:.5 D5:1 r:1',
  'B4:.5 D5:.5 E5:1 G5:1 E5:.5 D5:.5', 'C5:1 E5:.5 G5:.5 E5:1 C5:1',
  'A4:.5 C5:.5 E5:1 D5:.5 C5:.5 A4:1', 'F#4:.5 A4:.5 D5:1 G4:1 r:1',
  'G5:1 F#5:.5 E5:.5 D5:1 B4:1', 'E5:.5 G5:.5 A5:1 G5:1 E5:1',
  'D5:1 F#5:.5 A5:.5 F#5:1 D5:1', 'E5:.5 D5:.5 B4:1 G4:1 r:1',
  'C5:1 E5:.5 D5:.5 C5:1 B4:1', 'A4:1 C5:.5 E5:.5 D5:1 C5:1',
  'B4:.5 A4:.5 G4:1 A4:.5 C5:.5 F#4:1', 'G4:2 D5:1 r:1',
];
const REEDS = [
  'E5:1.5 B4:.5 G4:1 B4:1', 'D5:2 B4:1 r:1',
  'C5:1 E5:1 G5:1 E5:1', 'F#5:1 E5:.5 D5:.5 A4:2',
  'G4:1 B4:1 E5:1 F#5:1', 'G5:1.5 F#5:.5 E5:1 B4:1',
  'C5:1 A4:1 E5:1 D5:1', 'D#5:1 F#5:1 B4:1 r:1',
  'B4:.5 E5:.5 G5:2 F#5:1', 'D5:1 G5:1 B5:1 A5:1',
  'G5:1 E5:1 D5:.5 C5:.5 B4:1', 'A4:2 F#4:1 r:1',
  'E5:1 G5:.5 F#5:.5 E5:1 D5:1', 'C5:1 E5:1 A4:1 C5:1',
  'B4:1 D#5:.5 F#5:.5 A5:1 F#5:1', 'E5:3 r:1',
];
const SANCTUARY = [
  'D5:1 A4:1 F5:1 E5:1', 'D5:1 C5:1 A4:1 r:1',
  'Bb4:1 D5:1 F5:1 A5:1', 'G5:1 F5:.5 E5:.5 C5:2',
  'A4:.5 D5:.5 F5:1 E5:1 D5:1', 'C5:1 F5:1 A5:1 G5:1',
  'E5:1 G5:1 Bb5:1 G5:1', 'E5:1 C#5:1 A4:1 r:1',
  'F5:1.5 E5:.5 D5:1 A4:1', 'Bb4:1 F5:1 D5:1 C5:1',
  'A4:1 C5:1 F5:1 G5:1', 'A5:1 G5:.5 F5:.5 E5:2',
  'G5:1 E5:1 C5:1 E5:1', 'F5:1 D5:1 Bb4:1 D5:1',
  'C#5:1 E5:1 G5:.5 E5:.5 C#5:1', 'D5:3 r:1',
];
const NIGHT = [
  'E5:2 B4:1 r:1', 'G4:1 A4:1 B4:2',
  'C5:1.5 B4:.5 G4:1 E4:1', 'F#4:1 A4:1 B4:1 r:1',
  'E5:1 G5:1 F#5:1 E5:1', 'D5:2 B4:1 G4:1',
  'A4:1 C5:1 B4:1 A4:1', 'D#5:1 B4:2 r:1',
  'G5:2 E5:1 B4:1', 'F#5:1.5 E5:.5 D5:1 B4:1',
  'E5:1 C5:1 G4:1 C5:1', 'A4:2 E5:1 r:1',
  'B4:1 E5:1 G5:1 F#5:1', 'E5:1 D5:1 C5:1 A4:1',
  'F#4:1 B4:1 D#5:1 F#5:1', 'E5:3 r:1',
];
const CLEARING = [
  'D5:.5 G5:.5 B5:.5 A5:.5 G5:1 D5:1', 'E5:.5 G5:.5 E5:1 C5:1 r:1',
  'A4:.5 C5:.5 E5:.5 D5:.5 C5:1 A4:1', 'D5:1 F#5:.5 E5:.5 D5:1 A4:1',
  'B4:.5 D5:.5 G5:1 D5:.5 B4:.5 G4:1', 'C5:1 E5:.5 G5:.5 A5:1 G5:1',
  'F#5:.5 E5:.5 D5:1 A4:.5 B4:.5 C5:1', 'B4:1 G4:2 r:1',
  'G5:.5 A5:.5 B5:1 G5:1 E5:1', 'D5:.5 E5:.5 G5:1 B4:1 D5:1',
  'C5:.5 E5:.5 G5:1 E5:.5 D5:.5 C5:1', 'A4:1 D5:1 F#5:1 r:1',
  'E5:.5 G5:.5 B5:1 A5:1 G5:1', 'E5:.5 D5:.5 C5:1 A4:1 C5:1',
  'D5:.5 F#5:.5 A5:1 F#5:.5 E5:.5 D5:1', 'G5:2 D5:1 r:1',
];
const HERON = [
  'E5:.5 B4:.5 E5:.5 G5:.5 F#5:1 E5:1', 'D5:.5 B4:.5 D5:.5 F#5:.5 A5:1 F#5:1',
  'G5:1 E5:.5 D5:.5 C5:1 E5:1', 'D#5:.5 F#5:.5 B5:1 A5:1 F#5:1',
  'G5:.5 E5:.5 B4:1 E5:.5 G5:.5 B5:1', 'A5:.5 G5:.5 E5:1 C5:1 A4:1',
  'F#5:.5 A5:.5 D5:1 F#5:.5 E5:.5 D5:1', 'D#5:1 B4:1 E5:1 r:1',
  'B5:1 G5:.5 E5:.5 G5:1 F#5:1', 'D5:.5 F#5:.5 A5:1 G5:1 F#5:1',
  'E5:1 G5:.5 A5:.5 B5:1 G5:1', 'F#5:.5 E5:.5 D#5:1 B4:1 F#5:1',
  'E5:.5 G5:.5 B5:1 A5:.5 G5:.5 E5:1', 'C5:.5 E5:.5 A5:1 G5:1 E5:1',
  'D#5:.5 F#5:.5 A5:1 F#5:.5 D#5:.5 B4:1', 'E5:2 B4:1 r:1',
];
const SILT = [
  'D4:.5 D5:.5 A4:1 F5:1 E5:1', 'D5:1 F5:.5 G5:.5 A5:1 F5:1',
  'Bb4:.5 D5:.5 F5:1 D5:1 Bb4:1', 'C#5:1 E5:.5 G5:.5 A5:1 E5:1',
  'F5:.5 E5:.5 D5:1 A4:.5 D5:.5 F5:1', 'G5:1 E5:.5 C5:.5 E5:1 G5:1',
  'Bb5:1 F5:1 D5:1 Bb4:1', 'C#5:.5 E5:.5 G5:1 E5:1 r:1',
  'A5:.5 F5:.5 D5:1 F5:.5 A5:.5 C6:1', 'Bb5:1 A5:.5 G5:.5 F5:1 D5:1',
  'E5:.5 G5:.5 C6:1 G5:1 E5:1', 'F5:1 A5:1 C6:1 A5:1',
  'G5:.5 E5:.5 C5:1 E5:.5 G5:.5 Bb5:1', 'F5:1 D5:1 Bb4:1 D5:1',
  'E5:.5 G5:.5 A5:1 G5:.5 E5:.5 C#5:1', 'D5:2 A4:1 r:1',
];
const WARDEN = [
  'B4:1 F#5:.5 D5:.5 B4:1 A4:1', 'G4:.5 B4:.5 D5:1 F#5:1 G5:1',
  'E5:1 B4:.5 E5:.5 G5:1 F#5:1', 'A#4:.5 C#5:.5 F#5:1 E5:1 C#5:1',
  'B4:.5 D5:.5 F#5:1 A5:1 F#5:1', 'G5:1 E5:1 D5:.5 B4:.5 G4:1',
  'E5:1 G5:.5 B5:.5 A5:1 G5:1', 'F#5:1 C#5:1 A#4:1 r:1',
  'D5:1 F#5:.5 A5:.5 B5:1 A5:1', 'G5:.5 F#5:.5 E5:1 B4:1 G4:1',
  'C#5:1 E5:.5 G5:.5 A5:1 E5:1', 'D5:.5 F#5:.5 A5:1 F#5:1 D5:1',
  'G5:1 B5:1 A5:.5 G5:.5 F#5:1', 'E5:1 G5:.5 F#5:.5 E5:1 B4:1',
  'C#5:.5 E5:.5 F#5:1 A#5:1 F#5:1', 'B4:2 F#5:1 r:1',
];
const UMBRAL = [
  'E5:1 G5:.5 B5:.5 C6:1 B5:1', 'G5:1 F#5:.5 E5:.5 B5:1 r:1',
  'C6:1 E6:1 D6:.5 C6:.5 B5:1', 'A5:1 G5:1 F#5:1 D#5:1',
  'E5:.5 G5:.5 B5:1 D6:1 C6:1', 'B5:1 G5:.5 F#5:.5 E5:1 C5:1',
  'F#5:1 G5:.5 A5:.5 B5:1 D#5:1', 'E5:2 B4:1 r:1',
  'B5:.5 A5:.5 G5:1 E5:.5 G5:.5 B5:1', 'D6:1 B5:.5 A5:.5 G5:1 D5:1',
  'C6:.5 B5:.5 A5:1 E5:.5 A5:.5 C6:1', 'D#6:1 B5:1 F#5:1 D#5:1',
  'E6:1 B5:.5 G5:.5 E5:1 G5:1', 'C6:1 A5:.5 G5:.5 E5:1 C5:1',
  'D#5:.5 F#5:.5 B5:.5 A5:.5 F#5:1 D#5:1', 'E5:2 B4:1 r:1',
];
const REST = [
  'G4:1 B4:1 D5:2', 'E5:1 D5:1 B4:1 r:1',
  'C5:1 E5:1 G5:2', 'F#5:1 D5:2 r:1',
  'B4:1 D5:1 E5:2', 'C5:1 A4:1 E4:2',
  'A4:1 F#4:1 D4:1 r:1', 'G4:3 r:1',
];
const VICTORY = [
  'G4:1 B4:.5 D5:.5 E5:1 D5:1', 'B4:1 D5:1 G5:2',
  'E5:1 G5:.5 A5:.5 B5:1 G5:1', 'F#5:1 A5:1 D6:2',
  'G5:1 B5:1 A5:.5 G5:.5 E5:1', 'D5:1 G5:1 B5:1 A5:1',
  'G5:1 E5:1 C5:1 A4:1', 'D5:1 F#5:1 G5:1 r:1',
  'B5:1 A5:.5 G5:.5 D5:1 G5:1', 'E5:1 G5:1 C6:1 B5:1',
  'A5:1 E5:1 C5:1 E5:1', 'F#5:1 A5:1 D6:1 C6:1',
  'B5:1 G5:1 E5:1 D5:1', 'C5:1 E5:1 G5:1 E5:1',
  'D5:1 F#5:1 A5:1 D5:1', 'G5:3 r:1',
];
const DEFEAT = [
  'E5:1 G5:1 B5:1 A5:1', 'G5:2 E5:1 r:1',
  'C5:1 E5:1 G5:2', 'F#5:1 D5:2 r:1',
  'E5:1 B4:1 G4:2', 'A4:1 C5:1 E5:1 r:1',
  'F#4:1 B4:1 D#5:1 r:1', 'E5:3 r:1',
];

function build({ title, bpm, lead, melody, chords, style, bars = 32, transpose = 0, groove = 'straight' }) {
  const events = [];
  const put = (beat, note, duration, velocity, instrument, pan = 0) => {
    events.push({ beat, midi: note, duration, velocity, instrument, pan });
  };
  const battle = style === 'battle', quiet = style === 'quiet';
  for (let bar = 0; bar < bars; bar++) {
    const start = bar * 4, chorus = Math.floor(bar / melody.length);
    const chord = CHORDS[chords[bar % chords.length]];
    if (!chord) throw new Error(`Missing chord in ${title}`);
    const lift = bar % 16 >= 8 ? 1.08 : 0.93;
    let beat = 0;
    for (const token of melody[bar % melody.length].split(' ')) {
      const [note, length] = token.split(':');
      const duration = +length;
      if (note !== 'r') put(start + beat, midi(note) + transpose,
        duration * (battle ? .88 : .94), (quiet ? .43 : .58) * lift, lead, -.08);
      beat += duration;
    }
    if (Math.abs(beat - 4) > .001) throw new Error(`${title} bar ${bar}: ${beat} beats`);
    // Widely voiced harmony; short release tails smooth the next chord.
    const chordVoice = battle || style === 'night' ? 'strings' : 'piano';
    chord.tones.slice(0, 3).forEach((n, i) => {
      put(start + i * .025, n, quiet ? 3.4 : 3.65, (chordVoice === 'strings' ? .15 : .17) * lift,
        chordVoice, (i - 1) * .25);
    });
    put(start, chord.bass, quiet ? 2.9 : 1.6, battle ? .56 : .39, 'bass', 0);
    if (!quiet) put(start + 2, chord.bass + (bar % 2 ? 7 : 12), 1.6, battle ? .45 : .29, 'bass');
    // Written accompaniment patterns have room around the lead and a different
    // contour in each style; they are not independent random arpeggios.
    const watery = style === 'watery';
    const arp = quiet ? [0, 2] : style === 'night' ? [0, 2, 1, 2] : watery ? [2, 1, 0, 1] : [0, 1, 2, 1, 0, 2];
    const times = quiet ? [.5, 2.5] : style === 'night' ? [.5, 1.5, 2.5, 3.5] : watery ? [.75, 1.5, 2.75, 3.5] : [.5, 1, 1.5, 2.5, 3, 3.5];
    arp.forEach((degree, i) => put(start + times[i], chord.tones[degree] + 12,
      quiet ? .8 : .42, (quiet ? .18 : battle ? .25 : .23) * (i % 2 ? .85 : 1),
      style === 'night' ? 'musicbox' : 'harp', .30));
    // A second-chorus answer appears only in gaps / long lead notes. This gives
    // the repeated A/B melody a new color without doubling its every note.
    if (chorus && bar % 4 === 3) {
      put(start + 2.5, chord.tones[1] + 12, .42, .23, 'musicbox', -.35);
      put(start + 3, chord.tones[2] + 12, .7, .20, 'musicbox', .35);
    }
    if (battle || style === 'playful' || style === 'bright') {
      put(start, 36, .22, battle ? .56 : .25, 'kick');
      if (groove !== 'heavy') put(start + 2, 36, .22, battle ? .46 : .20, 'kick');
      if (groove === 'urgent' && bar % 2) put(start + 3.5, 36, .18, .34, 'kick');
      if (battle) {
        if (groove === 'heavy') put(start + 2, 38, .22, .39, 'snare', -.10);
        else {
          put(start + 1, 38, .16, groove === 'clock' ? .20 : .30, 'snare', -.10);
          put(start + 3, 38, .16, groove === 'clock' ? .24 : .36, 'snare', -.10);
        }
      }
      for (const at of (groove === 'heavy' ? [1.5, 3.5] : groove === 'clock' ? [0, 1, 2, 3] : [.5, 1.5, 2.5, 3.5])) put(start + at, 42, .08,
        battle ? .22 : .12, 'hat', .20);
    }
  }
  events.sort((a, b) => a.beat - b.beat);
  return Object.freeze({ title, bpm, bars, beatsPerBar: 4, lead,
    events: Object.freeze(events.map(Object.freeze)) });
}

const majorPath = ['G', 'Em', 'C', 'D', 'Bm', 'C', 'Am', 'D', 'G', 'Em', 'C', 'D', 'Em', 'Am', 'D', 'G'];
const minorPath = ['Em', 'G', 'C', 'D', 'Em', 'G', 'Am', 'B', 'Em', 'G', 'C', 'D', 'Em', 'Am', 'B', 'Em'];
export const SCORE = Object.freeze({
  title: build({ title: 'A Home Worth Painting', bpm: 88, lead: 'musicbox', melody: HOME,
    chords: majorPath, style: 'warm' }),
  swamp: build({ title: 'Brushes and Lily Pads', bpm: 104, lead: 'flute', melody: MARSH,
    chords: ['G', 'Bm', 'C', 'D', 'Em', 'C', 'Am', 'D', 'G', 'C', 'D', 'G', 'C', 'Am', 'D', 'G'], style: 'playful' }),
  reeds: build({ title: 'Letters on the Water', bpm: 82, lead: 'clarinet', melody: REEDS,
    chords: minorPath, style: 'watery' }),
  sanctuary: build({ title: 'Lanterns Remember', bpm: 90, lead: 'musicbox', melody: SANCTUARY,
    chords: ['Dm', 'F', 'Bb', 'C', 'Dm', 'F', 'C7', 'A', 'Dm', 'Bb', 'F', 'C', 'C', 'Bb', 'A', 'Dm'], style: 'night' }),
  blackReeds: build({ title: 'Where the Colors Went', bpm: 76, lead: 'flute', melody: NIGHT,
    chords: minorPath, style: 'night', transpose: -12 }),
  clearing: build({ title: 'A Splash of Courage', bpm: 122, lead: 'clarinet', melody: CLEARING,
    chords: ['G', 'C', 'Am', 'D', 'G', 'C', 'D', 'G', 'Em', 'G', 'C', 'D', 'Em', 'Am', 'D', 'G'], style: 'playful' }),
  gray: build({ title: 'Wings Across Our Water', bpm: 132, lead: 'strings', melody: HERON,
    chords: ['Em', 'D', 'C', 'B', 'Em', 'Am', 'D', 'B', 'Em', 'D', 'C', 'B', 'Em', 'Am', 'B', 'Em'], style: 'battle' }),
  silt: build({ title: 'Beneath the Painted Current', bpm: 116, lead: 'clarinet', melody: SILT,
    chords: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'C', 'Bb', 'A', 'Dm', 'Bb', 'C', 'F', 'C7', 'Bb', 'A', 'Dm'], style: 'battle', groove: 'heavy' }),
  warden: build({ title: 'The Hollow Lantern', bpm: 126, lead: 'musicbox', melody: WARDEN,
    chords: ['Bm', 'G', 'Em', 'Fs', 'Bm', 'G', 'Em', 'Fs', 'Bm', 'Em', 'A', 'D', 'G', 'Em', 'Fs', 'Bm'], style: 'battle', groove: 'clock' }),
  umbral: build({ title: 'Give Us Back the Dawn', bpm: 144, lead: 'strings', melody: UMBRAL,
    chords: ['Em', 'Em', 'C', 'B', 'Em', 'C', 'B', 'Em', 'Em', 'G', 'Am', 'B', 'Em', 'Am', 'B', 'Em'], style: 'battle', groove: 'urgent' }),
  rest: build({ title: 'Rest by the Water', bpm: 72, lead: 'flute', melody: REST,
    chords: ['G', 'Em', 'C', 'D', 'Em', 'Am', 'D', 'G'], style: 'quiet', bars: 16 }),
  victory: build({ title: 'All Our Colors, Home Again', bpm: 108, lead: 'flute', melody: VICTORY,
    chords: ['G', 'G', 'C', 'D', 'Em', 'G', 'Am', 'D', 'G', 'C', 'Am', 'D', 'Em', 'C', 'D', 'G'], style: 'bright' }),
  defeat: build({ title: 'The Brush Is Still Here', bpm: 68, lead: 'musicbox', melody: DEFEAT,
    chords: ['Em', 'Em', 'C', 'D', 'Em', 'Am', 'B', 'Em'], style: 'quiet', bars: 16 }),
});
