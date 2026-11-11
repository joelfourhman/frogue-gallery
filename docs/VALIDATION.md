# Validation — Astra Vertical Slice

## Lily Clearing follow-up — 2026-11-11

The new authored fight, repaintable scenery, simplified brush/UI and late boss
gates are covered in [VALIDATION-lily-clearing.md](VALIDATION-lily-clearing.md).
Human timing and enjoyment remain unmeasured; scripted results are labeled.

## Control-feel follow-up — 2026-11-11

Owner feedback prioritized awkward movement/combat. All 19 gates pass after
the responsive movement/brush UI pass. See
[VALIDATION-control-feel.md](VALIDATION-control-feel.md) for measured response,
the 4% Warden-health retune, probe correction, screenshots and remaining limits.

## Living Sketchbook follow-up — 2026-11-11

All 19 core/browser gates pass with the paused Field Atlas, study feedback,
bounded pond wildlife and immediate first-click aim repair. See
[VALIDATION-living-sketchbook.md](VALIDATION-living-sketchbook.md) for coverage,
reviewed screenshots, unchanged pacing, artifact hash and remaining limits.

## Lantern moth follow-up — 2026-10-31 (Q8/Q9)

Milestone 4 is complete. See `docs/VALIDATION-lantern-moth.md` for the rule/
live integration coverage, actual-input source/dist encounter evidence, frame/
SFX artifacts, cleanup regressions, all 19 gates and remaining limits.

## Personal exhibition follow-up — 2026-10-31 (Q6/Q7)

`node scripts/check.mjs --browser`: all 19 gates PASS, including all nine
unchanged pacing bands, no balance flags, source/dist Chromium journeys,
36 frame scenes, deterministic package and bounded effects/performance checks.
Game 1.0.0 / Save 12 and zero runtime dependencies remain unchanged.

- Stage 115 characterizes shipped Q6 behavior through the real Game: X and
  mouse pin/unpin, controller focus, two-pin refusal/banner, immediate save,
  input cleanup. Existing stage 114 retains pin/eviction/re-file/migration checks.
- Stage 116 (`tests/exhibition.mjs`) covers 48-code-point plain-text captions,
  whitespace/control/bidi cleanup, empty/malformed defaults, missing page no-op,
  preserving names across re-filing, explicit pinned-only exhibit, unpin clear,
  missing/stale/malformed exhibit fallback and unchanged legacy art/strokes.
- Full-cap fixture: ten pages × 180 maximum-coordinate strokes, all study IDs,
  maximum metadata and escaped Unicode captions/IDs, including pin/exhibit
  metadata: **57,333 UTF-8 bytes**, below **81,920 bytes (80 KiB)**.
- New regressions reproduce and fix malformed duplicate pinned IDs exceeding
  the ten-page cap, and object-shaped JSON IDs throwing during migration.
- Actual DOM key/mouse tests open, type, confirm/cancel and reload captions.
  Long ASCII and astral Unicode draft text stay within 48 code points live.
  J/X/M typed into the editor never close the book, toggle pins or enter gameplay.
- An injected Gamepad API device exercises the real polling/focus/click path:
  D-pad navigation, A pin/unpin/name/save/exhibit/remove/PNG export, B cancel.
  Editor confirm/cancel are the only focus targets while editing; B does not
  close the surrounding book. This is not physical controller hardware testing.
- Mouse and controller download identical PNG bytes. Decoded **1600×960**
  browser download matches the shared postcard renderer with **zero differing
  channel values**; a changed caption changes **16,967** caption-region values.
- After real localStorage reload, the edited name, pin and explicit selection
  remain. The actual title-canvas postcard region matches the shared renderer
  pixel-for-pixel; removing the exhibit changes **175,016** channel values.
- Evidence: `tests/.out/astra/{12-pinned-book,13-named-book,14-editor-640,
  15-exhibition-title-640}.png`, `postcard.png`, `controller-postcard.png`,
  `report.json`. Changed book/editor/title frames were visually reviewed.
  A crowded book subtitle was moved clear of the new control row and covered
  by a layout regression. 640×480 editor field and save/cancel stay on-screen;
  title menu buttons remain unobscured. Fine print naturally shrinks at 640px.

RED/GREEN evidence was observed for the absent caption API/editor, live input
bound, malformed-save defects and header clearance. Generated logs/artifacts
are ignored under `.cache/` and `tests/.out/`; no fake renderer screenshots.
The smoke canvas remains a stub for logic/layout; pixel claims above come from
real Chromium source AND built-runtime journeys.
An exact-pixel test exposed intermittent Chromium GPU/readback rounding (one
channel value by one, not changed content). Browser journeys now request
`willReadFrequently` CPU rasterization in the test harness only; exact zero-diff
assertions remain intact. Twenty consecutive built-runtime journeys then passed.
The separate frame/performance harnesses still exercise the normal canvas path.

Limits: typing uses a keyboard or OS on-screen keyboard; no controller alphabet
picker was added. Physical controllers, real IME hardware input, Firefox/Safari,
human enjoyment and hosted iframe/download behavior remain unverified. No
publication or account/profile configuration changes occurred. The available
Discord tools expose reads/thread/admin actions but no message-send action, so
commit handles are reported in the delivery summary instead of channel pings.

## Original Astra validation record

Recorded 2026-09-26. Reproduce with `node scripts/check.mjs --browser`.
This command fails on nonzero exits, missing success markers and any enforced
pacing band violation. Full output and timings are saved in .cache/checks/.
Runtime dependencies remain zero.

## Automated results

| Check | Result / interpretation |
|---|---|
| Smoke | ALL SMOKE TESTS PASSED; existing 111-stage suite plus Astra regression assertions |
| Normal pace | 17.2m analytical estimate, within 15–20 |
| Human-input probe | Boss defeated;55s traversal +97s fight +945s analytic waves =18.3m, within 15–20 |
| Heron cycling bot | 37.0s full 30,000 HP fight;20–90s sanity gate (this gate is newly explicit) |
| Reeds pace | 22.2m model,  within 20–25 |
| Warden | Six samples3.54–3.90m, each within 2–4 |
| Black Reeds | 25.8m model,  within 22–26 |
| Umbral fight | 3.73m model,  within 2.5–4 |
| NG+ cycle 1 | 19.5m model,  within 15–20 |
| Wander | Eight seeds16.9–17.8m swamp /21.6–22.7m Reeds; all within respective bands |
| Balance | No flagged imbalances |
| UI |78 assertions,12 heavy UI draws |
| SFX / music |44 bank names + voice cap/routing;161 music assertions |
| Package |15 runtime files; two builds byte-identical; ZIP data/hashes match manifest; stale generated output removed; runtime-only HTTP allowlist |
| Browser source / dist | Real browser input and simulation journeys pass with no page/console errors |
| Frame set |36/36 nontrivial frames, zero page errors; visual inspection described below |
| Effects stress | All gates pass, including24 brush wakes, bounded existing pools and decay |

Pacing tests seed global random/time so rendering/world sampling is repeatable.
The human-input probe still uses invulnerability and an analytic wave allowance.
No test here represents a measured human session.

## Balance before / after

Baseline c1ea26b already had no balance-telemetry flags.
The pass changes fairness and a small amount of pacing/economy:

| Item | Before | After | Reason |
|---|---|---|---|
| Fly chase multiplier |40 |1 | Remove thousands-of-pixels-per-second pursuit |
| Fly tell / dart / recovery | No committed strike cycle |0.60 /0.30 /0.85s | Visible dodge window and blue interruption |
| Welcome bank | red5 / blue9 / green5 | red6 / blue9 / green5 | Preserve early two-painting affordability after corrected movement changed sampled income |
| Warden HP |52,000 |50,000 | Fit every sample in original 2–4m band |
| Seeded Warden range |3.93–4.03m |3.54–3.90m | Correct a previously printed but unenforced overrun |
| Umbral surface line |1500 (world boundary) |1240 | Leave260px of movement/display space below the maw |
| Pressure at level0, zones1–4 |1.22 /1.64 /1.76 /2.20 | Same | Preserve the rising pressure curve |
| Charged single-target ratio |0.84× |0.84× | Preserve splash's group-value role |
| Two paintings affordable by zone3 | YES | YES | Preserve the M1 economy target |

Raw baseline/iteration logs are retained locally in .cache/astra-logs/.
The Warden's timing windows are unchanged. SAVE_VERSION 12 and GAME_VERSION 1.0.0
are unchanged. The new defensive wake is capped and adds no boss damage path.

## Browser journeys

tests/vertical-slice.mjs runs twice, against source and the built directory.
It uses an isolated Chromium profile, seeded randomness and manual animation
frames so input and state progression are reproducible.

- Start through a real Enter key event; walk the opening with simulated held
  keys and actual paint actions. Complete First Light, unlock brush-hop and
  file a page at full10/10HP with no god-mode override.
- Full RMB charge and release via DOM mouse events; pointer scaling included.
- Open J, verify simulation time stays frozen, export a PNG through the
  rendered button and save it as a browser download.
- Complete the other two studies with staged entry positions and real strokes.
- Render the formerly crashing low-saturation victory beat.
- Reload and verify persisted study flags/art; inspect640×480,960×720 and
  1920×1080 canvas bounds.
- Complete all seven guided lessons using the real paint/update path; hold
  red on the sketch heron long enough to test its single-color recovery.
- Fight the full 30,000 HP heron and reach the actual victory/end state.
  Arena positioning and invulnerability isolate the boss state machine.
- Trigger defeat, return through the title, start again and verify a live
  player with clean transient state.

The bot's first study takes about3.27 simulated seconds because it knows
every target. This is a reachability check, not a predicted onboarding time.

## Rendering and visual review

Real frames inspected include title/opening, the restored pond, sketchbook,
PNG export,640px book, full boss victory, defeat, Atelier welcome, Silt Wyrm
and deep-dark Umbral Wyrm.

The final review caught defects that whole-frame pixel variance could not:
clipped Atelier copy, overlapping gold/loadout controls, lantern/stock HUD
overlap, banners covering the end recap, and invisible Silt/Umbral bodies.
The bodies used `cur.x` on coordinates returned as `[x,y]`; the fix now has
finite-coordinate assertions across surfaced/transit/telegraph states.
Reeds light now uses a cached sprite to cut a viewing circle out of a reused
full-canvas darkness layer, preserving creature colors. No per-frame canvas or
gradient is allocated. The two compositing draws are covered by smoke and
stress tests. The legacy frame harness now also fails on actual page exceptions and stages
a lit lantern before judging a Reeds boss frame.

A nontrivial image alone is not proof that every object rendered correctly.
Keep visually reviewing changed scenes in addition to running the harness.

## Performance evidence and limits

tests/perf.mjs measures CPU submission of drawing calls in headless Chromium.
The corrected harness measures the real composite before filling the
synthetic ceiling, and includes the new24-mark wake pool.

The real composite contains203 on-screen paint-juice elements (budget220),
plus the separately capped24 wake marks. The artificial all-pools-full
ceiling reaches405 paint elements and then decays to160 after the one-second
pass. Per-pool caps and relative p95-cost gates pass.

These numbers do not measure GPU completion, monitor FPS or all hardware.
A real browser/device playtest is still necessary for broad performance claims.

## Reproduction and artifacts

```sh
node scripts/check.mjs --browser
node scripts/dev.mjs --dist
```

- .cache/checks/report.json: pass/fail and runtime per check.
- .cache/checks/*.log: full evidence, including current CPU timings.
- tests/.out/astra/: journeys, postcards and report.json.
- tests/frames/astra/:36 staged scene PNGs.
- dist/manifest.json: exact output hashes.
- dist/frogue-gallery.zip: uploadable static game.

All generated artifacts are ignored by Git. Tests own and close their
free-port loopback servers/browsers. Optional browser tooling is
playwright-core 1.63.0 plus installed Chromium/Chrome/Edge.

## Not claimed

Five-friend enjoyment/learning evidence, physical gamepad testing,
Firefox/Safari behavior, touch support, hosted iframe storage/download
behavior, universal60fps or a public deployment. No game-breaking defect
remains known in the exercised paths; undiscovered defects remain possible.
