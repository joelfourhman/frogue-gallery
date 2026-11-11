# The Living Sketchbook — validation, 2026-11-11

`node scripts/check.mjs --browser` completed with **all 19 gates PASS** on
the final runtime. Game 1.0.0 / Save 12, no new runtime dependencies.
The full command's logs/report are under `.cache/checks/`.

## Regression coverage

- Smoke stages 119–122 cover study progress/corrections/ownership, wildlife
  caps/expiry/finite geometry/RNG isolation, atlas selectors and real Game
  suspension/return/restart, and immediate pointer coordinate resolution.
  The full suite ends `ALL SMOKE TESTS PASSED`.
- The atlas uses live zone-rest positions and mode-safe authored definitions.
  Prior saved memory is separate from current expedition completion. Read-only
  viewing cannot mutate save progress. Invalid points are filtered and arrays
  capped. No collision-map accuracy or fast travel is implied.
- Wildlife tests compare all three biomes' pre-change terrain hashes and shared
  RNG positions. Population stays at 24; pigment responses expire after 3.4s,
  repeated splats cannot allocate more entities, and offscreen draw emits no
  Canvas calls. Each world gets a fresh cosmetic population.
- Study tests cover aimed wrong pigment, facing away, distance, successful coat,
  repeated completion, feedback expiry, pause/help/tutorial ownership and
  absent content in excluded modes. Healing and archive rules are preserved.

## Real Chromium journeys and visual evidence

Both source and generated runtime execute `tests/vertical-slice.mjs`, including
`tests/living-sketchbook-browser.mjs`, using actual DOM keyboard/mouse events.
Late-game positions are staged; this is not an unaided playthrough.

- V/Esc open/close; paused run time, position, HP, wave timer, wildlife and save
  state remain unchanged for 180 frames. Held mouse/movement cannot leak paint
  on return. Mouse controls work at 640×480 and preserve underlying pause.
- Injected Gamepad API D-pad/A/B opens and closes the atlas through pause focus.
  This exercises real input routing, not physical-controller hardware.
- Actual wrong-color and correct-color strokes exercise both swamp and Reeds
  study guidance. The test initially exposed stale first-click aiming in Reeds;
  resolving pointer coordinates in the mouse event fixes it. The assertion was
  retained. A separate smoke check covers translated/zoomed pointer transforms.
- A real brush stroke reaches World.splat, elicits nearby wildlife response,
  and its cosmetic state expires after painting stops.
- Existing five-study, crossing, moth, lesson, boss/end/restart, save-reload,
  caption/pin/exhibit and exact PNG export checks continue to pass.

Reviewed real screenshots in `tests/.out/astra/`:

| File | Evidence |
|---|---|
| 23-field-atlas.png | Swamp map, study cards and crossing |
| 24-field-atlas-640.png | Small-viewport map and Return button |
| 25-study-guidance.png | Actual wrong-color stroke and coat instruction |
| 26-reeds-study-guidance.png | Study card readable above lantern darkness |
| 27-reeds-atlas.png | Reeds rests, moth nook and partial study coats |
| 28-pond-life.png | Pigment reaction beside frog; bounded decorative scale |

Existing 02-first-light.png covers study completion. The separate 36-scene
frame harness also passed. Fine print shrinks with the whole canvas at 640px;
no text/button overflow was observed. No new touch or screen-reader UI.

## Balance and performance

Balance telemetry before/after reports **none flagged**. Combat numbers remain
unchanged, and all nine pacing probes retain their previous estimates/bands:
Normal 17.2m, human model 18.3m, heron 37.0s, Reeds 22.2m, Warden 3.54–3.90m,
Black Reeds 25.6m, Umbral 3.73m, NG+ 19.5m, Wander 16.9–17.8m and its Reeds
variant 21.6–22.7m. These are simulated models, not human session lengths.

Local CPU draw-submission p95: quiet **0.80ms**, peak **1.20ms**, synthetic
ceiling **1.20ms**, sustained **1.40ms**. All count/relative-cost/decay gates pass;
real peak paint juice is **203/220**. Decorative wildlife is separate from that
legacy paint-pool count and included in whole-frame drawing. These measurements
do not establish universal 60fps or GPU/display frame times.

## Artifact and next evidence

Built artifact: `dist/frogue-gallery.zip` (runtime only; deterministic package
checks passed). SHA-256:

`2e7c716d7a81b8be4cc79a2a4c97dd08821d44194c1ffa2f7a8e427c0eeb17dc`

The commit containing this document records the exact source. Its manifest is
`dist/manifest.json`; the generated runtime was exercised by the dist journey.
All test servers/browser profiles were harness-owned on loopback and closed.

PLAYTEST.md supplies five questions and timestamped anonymous observation
sheets. Automated input rehearsal and visual review are complete; facilitator
rehearsal with a person and five real sessions are pending. No participants were
contacted. Physical controllers, Firefox/Safari, human enjoyment and a hosted
origin remain unverified. No deployment or remote service was created.
