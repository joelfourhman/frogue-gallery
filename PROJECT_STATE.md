# Project state — Q8 rules complete; Q9 encounter in progress

Q8 closed 2026-10-31: pure bounded approach/tell/dash/settle rules,
600ms direction-locked warning, dash-only contact, player-owned lantern lure,
blue interruption, green-flower settlement and a one-time +2 blue reward latch.
Enemy and actual landed Paint adapters implemented; moth is NOT in any live
spawn table. Maximum-two predicate; freeze/root/dizzy recovery, death/darkness,
wrong pigments/range, repeat settlement and enemy contact/glide covered by
stage 117 (`tests/moth.mjs`). Four vertical RED/GREEN slices observed for missing
rules, counter/reward/cap, Enemy adapter and landed blue paint routing.
`node scripts/check.mjs`: all 15 core gates PASS, all nine pacing bands IN,
balance none flagged. Existing combat values/mixes and versions unchanged.
Next: Q9 authored optional ordinary post-victory Reeds encounter, presentation,
actual browser inputs and cleanup matrix, then all 19 browser gates.

# Previous checkpoint — Q6/Q7 personal exhibition complete

Q6 closed 2026-10-31: stage 115 characterizes the real Game pin UI (controller
focus, X, mouse, cap banner, immediate localStorage persistence, input cleanup).
Real Chromium source/dist journeys exercise key/mouse pin toggles and suspension;
`node scripts/check.mjs --browser`: all 19 gates PASS.

Q7 implemented 2026-10-31: 48-code-point plain-text captions, native text editor
with explicit input ownership, mouse/controller save/cancel, explicit pinned-page
title-screen exhibit/remove, and shared postcard rendering for book/title/PNG.
Edited captions survive re-filing the same expedition; unpin clears the exhibit.
Old/malformed saves default safely. Duplicate imported pinned IDs no longer bypass
the ten-page cap; object-shaped IDs cannot throw during normalization. Versions
remain Game 1.0.0 / Save 12; no combat, dependency or publication changes.

Tests: stage 116 imports tests/exhibition.mjs; RED observed for missing rename,
missing browser editor, duplicate-ID overflow and malformed object-ID migration,
then GREEN. Final `node scripts/check.mjs --browser`: all 19 gates PASS;
nine pacing bands unchanged, no balance flags. Full-cap escaped-Unicode artwork
including pin/exhibit metadata: 57,333 UTF-8 bytes (< 81,920). Real Chromium
source/dist journeys pass key/mouse editing/cancel,
shortcut isolation, Gamepad API D-pad/A/B pin/name/exhibit/export at 640x480,
save reload and actual downloaded PNG pixel identity with the shared renderer.
Mouse/controller PNG downloads are byte-identical; title canvas keepsake pixels
match the shared postcard renderer. Screens 12–15 in tests/.out/astra show the
pinned/named book, 640px editor and title keepsake; reviewed for layout/readability.
Physical controller hardware and Firefox/Safari remain unverified; text entry
requires a keyboard or OS on-screen keyboard (no new controller alphabet picker).

Next active mission: Q8/Q9 lantern-moth encounter, authorized by Joel's
"Keep going" after Q6/Q7 completion. Plan: docs/PLAN-lantern-moth.md.
Implement bounded rules first, then one optional post-victory Reeds encounter;
full core/browser gates required. No publication or participant outreach.
Historical implementation records below are retained, not current next actions.

# Previous checkpoint — Astra Q1–Q5 complete (registry, studies, painted crossing loop)

Q1–Q5 completed 2026-10-12. Q6 core/UI shipped at 5b31f92/56db0dc;
verification closed at 6306452. Q7 is complete as recorded above.

## Q6 implementation record (2026-10-12; verified 2026-10-31)

- `src/logic.js` (pure, committed as the checkpoint): `STUDIO.pinCap: 2`;
  `normalizeSketchPins` (non-array/garbage → [], string-coerced ids, deduped,
  capped at 2 — first two win); `normalizeSketchbook(raw, pins)` — pinned
  pages keep their slot against the rolling window (pageCap 8 counts ONLY
  non-pinned pages, taken from the newest end; no pins = the old
  last-pageCap behavior, asserted unchanged); `pinSketchPage` /
  `unpinSketchPage` (idempotent, capped, no-op-safe, missing-id-safe);
  `freshSave().sketchPins: []` and the `migrateSave` per-field carry with
  stale-pin pruning (the book normalizes WITH the pins, then pins are pruned
  to ids that survived). NO SAVE_VERSION bump (optional validated field,
  mirroring the flags-object pattern).
- Tests: new smoke stage 114 — 35 assertions (pin-cap truth table, 20-filing
  retention with a pinned survivor + deterministic non-pinned eviction, cap
  refusal at 2, idempotent re-pin, unpin restores normal retention,
  re-filing never duplicates (pinned or not), migration round-trip keeps
  pins, legacy load → [], garbled/stale imports degrade safely, full-cap
  artwork 29,152 bytes < 80 KiB). Full smoke: ALL SMOKE TESTS PASSED.
- **Done this session (committed):** the UI — `bookLayout().pin` (154×34,
  top-right above the postcard); the button-row entry ('Pin page · X' /
  'Unpin page · X', only drawn when a page is open); the brass pin glyph +
  '· PINNED' caption on pinned pages; `_updateSketchbook` wiring (X key —
  verified free — + mouse rect + the dispatch with pin/unpin/cap banners and
  `SaveSys.save` on every toggle); and the sketchbook gamepad focus list now
  includes the pin rect when a page is open. Smoke: ALL SMOKE TESTS PASSED
  after the wiring.
- **Verified:** stage 115 covers the real Game pin UI; source/dist journeys
  exercise DOM keyboard/mouse input, suspension and saved pin reload. All
  19 gates passed at closure. SAVE_VERSION stays 12, GAME_VERSION 1.0.0.

## Q5 record (2026-10-12)

- `src/logic.js`: `CROSSING.zoneR` (90px effect zone; the main route sits
  240px from the mouth, so the effects never reach the corridor),
  `inCrossingZone` (closed disc), `strokeTouchesCrossing` (stroke segment vs
  mouth radius + 26px reach margin; dry/null/non-finite/pigment-less strokes
  are clean no-ops), and `normalizeCrossingPainted` +
  `freshSave().flags.crossingPainted` + the `migrateSave` per-field carry
  (false for legacy saves; NO SAVE_VERSION bump — the field lives on the
  existing flags object, mirroring reedsUnlocked/reedsVictory).
- `src/player.js`: the blue current slows the frog to 0.72× while inside the
  zone (a no-op unless the world's crossing is actually 'current').
- `src/game.js`: `_paintCrossingStroke` routes real swipes/splashes to
  `world.paintCrossing` (transition SFX + banner + the one-time stamp latch
  `save.flags.crossingPainted`, persisted immediately; "postcards now wear
  the crossing's stamp" banner on the first transition only). Bramble sting:
  a red-painted mouth stings ONCE when the frog enters the zone (3×
  dmgTakenMult), latched per entry so a standing frog is not bled; the way
  itself is never blocked. The frog's position feeds `drawProps` for the
  nearby hint.
- `src/audio.js`: the 'crossing-part' beat — a brush-through bandpass sweep
  down under a low leafy thud plus a small bright lift (reuses the existing
  _tone/_noise voices, no new assets).
- `src/studio.js`: the postcard STAMP — a perforated 'CROSSING' postage stamp
  (the leafy arch over a water line) in the card's top-right corner once the
  latch is set (sketchbook view + 1600×960 PNG export; cosmetic, bounded).
- `src/world.js`: `drawCrossing` — the four state silhouettes (unpainted:
  thorny wall with a breathing "paintable" pulse; crossing: a safe leafy
  arch with soft light rays; current: blue water with drifting flow marks
  and ripples; bramble: red thorns with a warning pulse) plus the nearby
  hint. Draw-only, P10-culled like every other prop, bounded elements, no
  allocations, seed-independent (the mouth is fixed by design).
- Tests: smoke stage 113 — 21 assertions (zone geometry incl. the main-route
  exclusion, the stroke-reach truth table incl. dry/null/non-finite/
  pigment-less no-ops, latch normalization + the migrateSave round-trip +
  legacy load). Fixed a WIP defect found in verification: the round-trip
  assertions were written against `validateSaveBlob`'s `{ok, save}` shape,
  but `migrateSave` returns the save itself — they now assert
  `_case === 'migrated'` (the stronger, correct check).
- Browser journey (tests/vertical-slice.mjs, real Chromium, fresh normal
  swamp expedition, real swipe path): a corner hop landing off-center in
  the wall's corner is pushed out every frame and never trapped (an
  exactly-centered landing is unreachable in play — the push-out keeps the
  frog ≥ r+46 from any blob center); the corridor anchor is never pushed in
  any state (main passage open); green (solids 4→0, stamp latch + banner);
  the detour entered and the return route left; blue (the frog measured
  44.8px vs 70.9px over 20 frames in-zone vs out — the current slows);
  red (3 HP sting on entry, no bleed while standing, stings again on
  re-entry — once per entry); repaint green (safe revisit, no damage).
  Effects stay capped after all the crossing beats (particles ≤ 240 pool,
  brush wakes ≤ 24).
- Frame evidence: four state screenshots (tests/.out/astra/
  11-crossing-{unpainted,crossing,current,bramble}.png) + six pairwise
  pixel diffs of the four states (each > 400 distinct samples — all partial
  states render) + a postcard stamp pixel diff on a real Q2 page (latch on
  vs off).
- Pacing gate: all nine probes IN band, unchanged from the Q4 baseline
  (Normal 17.2m analytic / 18.3m measured; Reeds 22.2m; Warden 3.5–3.9m;
  Black Reeds 25.8m; Umbral 3.73m; NG+ 19.5m; Wander 16.9–17.8m /
  Wander×Reeds 21.6–22.7m) — the crossing is optional content and the
  corridor stays open, so the pacing models do not change.
- SAVE_VERSION stays 12, GAME_VERSION 1.0.0. Q5 keeps the crossing
  OPTIONAL by design: no mandatory route lock, no new economy; the loop is
  discoverable through the wall's paintable pulse and the nearby hint.
- Note: this session has no vision tool, so the four crossing frames are
  verified by the pairwise pixel assertions above rather than by eye.

## Q4 record (2026-10-12)

- `src/logic.js`: pure crossing model — `CROSSING` (fixed mouth at x=2300
  y=460, north of the central corridor, above the Rain Choir; 4 bramble
  blobs, r=46, 70px pitch → continuous ~300px wall), `CROSSING_STATES`,
  `crossingPigmentState` (green→crossing, blue→current, red→bramble,
  anything else a no-op), `crossingTransition` (idempotent by construction),
  `crossingPassable` (only 'unpainted' blocks), `crossingSpeedFactor`
  (current = 0.72, the flood factor), `crossingDamageOnEntry` (bramble = 3),
  and `crossingSolids` (bounded: 4 circles ONLY while unpainted — every
  painted state is open, so no state can trap the frog and the main
  corridor is never touched).
- `src/world.js`: `build()` seeds `crossingState = 'unpainted'` +
  `crossingSolids` (fixed, seed-independent; present in every variant
  including the Reeds — the deeper painting keeps the same mouth).
  `collideCircle` pushes out of the wall (the enemy-spawn validation path —
  a spawn placed in the wall is cleared every frame). `paintCrossing(pigment)`
  returns the new state on a real transition, null on a no-op, and rebuilds
  the collision data ONLY on real transitions. `isValidSpawn(x, y, r)` is a
  pure predicate (obstacles + wall; corridor reeds excluded on purpose).
- Tests: new smoke stage 112 (37 assertions) — pure transition truth table
  (incl. idempotence + dry/null no-ops), passability/return-path, speed and
  damage values, the exact fixed wall geometry, both ends of the crossing
  (mouth blocked while unpainted, corridor and detour anchors never pushed),
  spawn validation (valid on the corridor, invalid in the wall, enemy
  pushed out), transition-only rebuild (green→null on repeat,
  green→current→bramble), restart cleanup (fresh world unpainted + wall
  rebuilt), and the Reeds variant keeping the fixed geometry.
- Acceptance: every state has a valid return path (painted states carry no
  solids), repeated painting is idempotent (no rebuild), enemy spawn
  validation respects the new solid (per-frame collideCircle + isValidSpawn),
  main passage open in every state (asserted at the corridor anchor; all nine
  pacing probes in band — the bot is never walled). SAVE_VERSION stays 12,
  GAME_VERSION 1.0.0. Full check --browser: all 19 gates pass.
- Q4 intentionally ships WITHOUT presentation or the stroke hook (those are
  Q5: the detour, the silhouettes, the postcard stamp, and the real paint
  actions in game.js).

## Q3 record (2026-10-12)

- `src/logic.js`: registered `echo-pool` in `FIELD_STUDIES`
  (`biome: 'reeds'`, `group: 'reeds'`, colors blue→red→green, fixed at
  x=1150 y=720 — banks above the flood floor, below gravity pocket 1,
  ~500 px from the nearest rest stones). `STUDY_GROUPS.reeds.required` now
  pins BOTH `lantern-garden` + `echo-pool` — the border needs the whole
  reeds group, in any completion order.
- `src/studio.js`: new 'echo' motif (faint pool ring at step 0, blue outward
  ripples, red reflected stars, green water birds; bounded 4+7+3 elements,
  no allocations). Reward-group banners now fire EXACTLY once — on the
  completion that first satisfies the group (a `before`-list comparison), so
  finishing a second-biome study can never re-announce an earned group.
  `drawPostcard` gained a `bordered` flag (woven double frame + corner
  knots, cosmetic only) driven by `studyRewardEarned(completed, 'reeds')`
  from both the sketchbook and the PNG export. Sketchbook study list rows
  tighten to fit five entries.
- Tests: Q1/Q2 group assertions updated to the both-IDs border semantics;
  new Q3 slice assertions (fixed spot + pigment order, selector order,
  pool-first completion via real `trySwipe` strokes through both studies,
  border banner exactly once with no golden-lily re-announcement, both
  memories on the late page, bordered postcard render, round-trip keeps the
  border earned). The border's real-pixel proof moved to the
  vertical-slice journey (the smoke canvas is a stub context): the journey
  now paints BOTH reeds studies in a fresh Reeds expedition, asserts the
  border banner, and pixel-diffs the bordered vs unbordered postcard frame
  in real Chromium.
- Acceptance: each motif reads differently (echo stages distinct from
  lantern stages by design; both verified), border needs exactly the reeds
  group and survives migration (asserted), swamp gold signature still works
  (group truth table + unchanged signed path), no swamp/challenge leak
  (selector tests), Reeds pacing untouched. SAVE_VERSION stays 12,
  GAME_VERSION 1.0.0. Full check --browser: all 19 gates pass (19/19 in
  .cache/checks); dist rebuilt; browser-dist journey PASSED.

## Q2 record (2026-10-12)

- `src/logic.js`: registered `lantern-garden` in `FIELD_STUDIES`
  (`biome: 'reeds'`, `group: 'reeds'`, colors green→blue→red, fixed at
  x=3300 y=780 — on the banks above the flood floor 900, ~460 px from the
  nearest rest stone, ~1800 px short of the Silt Wyrm arena x>=5100) and added
  the `reeds` reward group (required: exactly `lantern-garden`).
- `src/studio.js`: new 'lantern' motif in `drawLivingStudy` — inert stems,
  green leaves, blue dew-lights, red orbiting moths (bounded: 6+6+8 elements,
  no allocations). All other Q1 plumbing (selector, stroke hook, archive,
  postcard memory, sketchbook list) picked it up with no new code paths.
- Tests: 9 new slice assertions (fixed spot + pigment order, wrong-pigment
  rejection, 3-stage paint progression through real `trySwipe` strokes,
  completion persistence + reeds reward group, reeds postcard page memory,
  round-trip, Reeds selector truth table incl. challenge/wander exclusions)
  and a real-browser vertical-slice stage: a fresh Reeds expedition
  (`_beginExpedition(false, { reeds: true })`) with real strokes, no god mode.
- Visual evidence: the four motif stages are pairwise pixel-distinct in
  headless Chromium (sampled signatures differ; nonzero 9216/9247/9271/9271);
  the journey screenshot is tests/.out/astra/10-lantern-garden.png.
- Acceptance: painting changes all three stages (verified), completion
  persists (save + reload asserted), the exported postcard shows the garden
  memory (journey asserts page.studies includes lantern-garden), no swamp or
  challenge leak (selector tests), Reeds pacing untouched (probe in band).
  SAVE_VERSION stays 12, GAME_VERSION 1.0.0. Full check --browser: all 19
  gates pass; dist rebuilt (15 files, 927 KiB).

## Q1 record (2026-10-12)

- `src/logic.js`: each `FIELD_STUDIES` entry now names `biome: 'swamp'` and
  `group: 'swamp'` (IDs, names, positions, pigment orders, verbs unchanged).
  New pure exports: `STUDY_GROUPS` (swamp requires exactly
  first-light + rain-choir + borrowed-sky), `studiesForBiome(biome,
  {challenge, wander})` (challenge/wander always yield none), and
  `studyRewardEarned(completed, group)`.
- `src/studio.js`: the studio instance builds from the pure selector instead
  of a hardcoded `runBiome === 'swamp'`; the golden-lily banner and the gold
  postcard seal (drawPostcard's `signed` flag) now use `studyRewardEarned`
  instead of `completed.length === 3`, so later-registered study IDs (Q2/Q3)
  cannot break or dilute the swamp reward.
- `tests/slice.mjs`: 11 new Q1 assertions — definition stability, selector
  truth table (swamp/reeds/blackReeds/unknown × normal/challenge/wander),
  reward-group truth table, future-ID immunity, schema-12 partial-progress
  round-trip, Reeds zero-studies + brush-hop preserved, wander exclusion,
  default swamp restore.
- Behavior on the current swamp: unchanged (same three scenes, same reward
  trigger, same postcard seal). SAVE_VERSION stays 12, GAME_VERSION 1.0.0.

## What shipped

- Three living field studies: First Light, Rain Choir and Borrowed Sky.
- First-study shelter, earned colored brush-hop and a cosmetic signature.
- Eight-page sketchbook of actual sampled strokes, illustrated study memories
  and local 1600×960 PNG export.
- Fair fly tell/dart/recovery and blue interruption; aimed stationary hop,
  120ms input buffer, reliable splash release and physical-input cleanup.
- Responsive canvas/pointer mapping, controller aim/paint, readable HUD,
  safe guided practice/retraining and defeat/restart/victory transitions.
- Visible Silt/Umbral geometry, readable cached lantern lighting, an Umbral
  arena inside world bounds, corrected Atelier/end-screen layout.
- Local server, enforced test command, deterministic static ZIP, current
  design/state docs and a concrete Qwen continuation plan.

Code checkpoints: 46f5912 controls/fly repairs; 43b3b0a studio/sketchbook;
48eea42 final visual stabilization. Delivery tooling/docs are the subsequent
commit. Prior planning logs are preserved in docs/history and Git c1ea26b.

## Balance record

| Change | Before → after | Why |
|---|---|---|
| Fly movement multiplier | 40 → 1 | Remove extreme pursuit speed |
| Fly tell/dart/recover | New 0.60/0.30/0.85s cycle | Readable committed attacks and escape |
| Welcome red | 5 → 6 (blue 9, green 5 unchanged) | Preserve by-zone-3 buying power after corrected fly movement |
| Warden HP | 52,000 → 50,000 | All six estimates fit original 2–4m band (3.93–4.03 → 3.54–3.90m) |
| Umbral surfaceY | 1500 → 1240 | Leave 260px below the maw inside a 1500px world; estimate 3.90 → 3.73m |

Baseline and final balance telemetry: no flags. Pressure curve at level 0:
1.22/1.64/1.76/2.20. Charged single-target splash ratio 0.84×. Cheapest
two-painting loadout affordable by zone 3. SAVE_VERSION 12 / GAME_VERSION 1.0.0
remain unchanged; new save fields are optional and normalized.

## Verification

`node scripts/check.mjs --browser` — all 19 entries pass.
Smoke ends ALL SMOKE TESTS PASSED. Nine pacing probes in band:
Normal 17.2m analytical / 18.3m mixed measured+analytic; Reeds 22.2m; NG+ 19.5m;
Warden 3.54–3.90m; Black Reeds 25.8m; Umbral 3.73m;
Wander 16.9–17.8m / Reeds 21.6–22.7m.

Source/dist journeys verify real brush study progression and PNG export,
all seven lessons, save reload, 640/960/1920 layouts, full-HP boss victory
and defeat/restart. God mode is used only for the isolated boss journey.
36 render scenes pass; final changed frames were visually inspected.
Effects stress: 203 legacy juice elements within 220 plus 24 capped brush wakes;
peak/ceiling/sustained CPU submission p95: 1.10/1.30/1.60ms.
These are bot/model and CPU measurements, not human duration or displayed FPS.
Full detail and limitations: docs/VALIDATION.md.

## Run and distribute

```sh
node scripts/dev.mjs
node scripts/check.mjs --browser
node scripts/build.mjs
node scripts/dev.mjs --dist
```

Ready artifact: dist/frogue-gallery.zip (15 runtime files, approximately 924KiB).
Hash/source file list: dist/manifest.json.
Current local preview: http://127.0.0.1:8766.
No public deployment/account changes. docs/DEPLOYMENT.md recommends the
HTML5 itch.io path and records alternatives.

## Next session

The approved Q6/Q7 mission is complete. Q8/Q9 remain unimplemented backlog;
human playtests (Q10) and publication still require their own scope/authorization.
Do not revive historical next actions. See docs/VALIDATION.md for this pass.

No known reproducible game-breaking issue remains in exercised paths.
Human friend feedback, physical controllers, Firefox/Safari and hosted iframe
behavior remain unverified. No touch UI, mid-run resume or cloud persistence.
