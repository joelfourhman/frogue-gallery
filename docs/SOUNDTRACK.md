# Music for our swamp

The soundtrack takes its direction from the inviting, melodic adventure mood
the owner enjoys in classic MapleStory: memorable tunes, soft instrumental
colors, warm harmonies, and places that feel worth lingering in. Every melody
and arrangement here is original. No recordings, samples, or transcriptions
from MapleStory are used.

The central musical idea belongs to the frog's home: G–B–D–E–D, followed by a
gentle answer. It introduces the title, becomes playful in the marsh, slows
down at the waterside rest, and comes home in the victory theme. The Umbral
Wyrm twists its contour into E minor. Even the darkest region retains a tune;
the swamp is a home to recover, not an anonymous place of dread.

## Composed tracks

| Scene | Original title | Character | Tempo | Loop |
|---|---|---|---:|---:|
| Title / pond | A Home Worth Painting | Music-box invitation, warm piano and harp | 88 BPM | 32 bars |
| Watercolor Marsh | Brushes and Lily Pads | Skipping flute melody, light footsteps in the rhythm | 104 BPM | 32 bars |
| Sunken Reeds | Letters on the Water | Flowing clarinet, descending harp answers | 82 BPM | 32 bars |
| Hollow Sanctuary | Lanterns Remember | D-minor music box, suspended nighttime colors | 90 BPM | 32 bars |
| Black Reeds | Where the Colors Went | Low flute, sparse bells, a fragile hopeful thread | 76 BPM | 32 bars |
| Lily Clearing | A Splash of Courage | Buoyant clarinet and a lively major-key tune | 122 BPM | 32 bars |
| Gray Heron | Wings Across Our Water | Quick string figures and a firm backbeat | 132 BPM | 32 bars |
| Silt Wyrm | Beneath the Painted Current | Heavy half-time rhythm, earthy clarinet | 116 BPM | 32 bars |
| Hollow Warden | The Hollow Lantern | Clocklike rhythm and an uneasy B-minor music box | 126 BPM | 32 bars |
| Umbral Wyrm | Give Us Back the Dawn | The home melody transformed; urgent strings and syncopated kicks | 144 BPM | 32 bars |
| Waterside rest | Rest by the Water | Spacious flute, bass and two harp answers per bar | 72 BPM | 16 bars |
| Final victory | All Our Colors, Home Again | Full major-key homecoming and a rising flute answer | 108 BPM | 32 bars |
| Defeat | The Brush Is Still Here | A quiet, reassuring music-box reflection | 68 BPM | 16 bars |

## Arrangement and implementation

`src/score.js` contains authored A/B melodies and chord progressions, compiled
into sorted, immutable note events. Each 32-bar track has a sixteen-bar melody
followed by another chorus with answering bells and phrase dynamics. Rest and
defeat have eight-bar melodies over two quieter choruses. Chord extensions,
spaced voicings, deliberate rests, and different percussion grooves keep the
arrangement from being a short arpeggio repeated indefinitely. Loops last
roughly 53–101 seconds at these tempos.

The score is pure data: MIDI pitch, start beat, duration in quarter-note beats,
velocity, instrument, and pan. It consumes no gameplay randomness. Each track
has fewer than 800 events; short release tails smooth the chord changes.
The music engine supplies synthesized instrument colors. These are stylized
flute, clarinet, strings, piano, harp and music-box voices, not acoustic
recordings or an orchestral sample library. The local, dependency-free game
does not download music or contact a service.

Music selection, transitions, gain, mute, and scheduler lifetime belong to the
audio engine and game integration, not this score. A test can establish valid
notes, coverage, routing and bounded voices; subjective musical quality still
needs listening and the owner's playtest.

The transport uses a 180ms audio-clock lookahead, at most 64 sounding/scheduled
voices and three crossfading score layers. Note graphs and vibrato connections
retire when their sound ends. Returning from a suspended tab skips missed notes
instead of playing a backlog. One shared deterministic stereo room gives the
instruments space. Ambient drones have been replaced with quiet unpitched water
and wind so they cannot clash with the new chord progressions.

Pause/help/map/sketchbook lower the score by 6dB without restarting it. Low
health adds a quiet beat-aligned pulse; awakened bosses slightly lift percussion.
The existing independent music/SFX sliders and mute still govern all audio.

`node tests/render-music.mjs` renders twelve seconds of every track through
Chromium's OfflineAudioContext and the real scheduler. It writes PCM measurements
and four WAV previews (title, marsh, Umbral, victory) into tests/.out/astra/.
The source/dist browser journeys run the same checks. These generated previews
are developer evidence, not runtime downloads or replacement audio assets.
