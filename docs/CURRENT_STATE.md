# Current state — The Living Sketchbook

**2026-11-11.** Astra, Q1–Q9 and the Living Sketchbook expansion are implemented. This document describes
the implementation. Future work lives in ROADMAP.md and QWEN_BACKLOG.md.
The runtime version remains 1.0.0 and save version remains 12.

## The playable loop

Title → optional guided practice or Atelier → expedition → living studies,
encounters and checkpoints → boss → victory/defeat → bank pigment and revisit
the Atelier. The swamp has four encounter zones across 5400 world pixels.
Beneath the Reeds is a 6000-pixel post-victory descent. Black Reeds extends
the unlocked NG+ descent to 7200 pixels.

The Normal pacing model targets 15–20 minutes. Its current estimates are
17.2 minutes analytically and 18.3 minutes for measured bot traversal/boss
plus an analytic wave allowance. These are **models, not measured human
playtest durations**. Studies are optional and add unmeasured exploration time.

## Systems that exist

| System | Current behavior |
|---|---|
| Movement | Smooth movement, collision, Space hop with brief invulnerability; stationary hop follows aim; 120ms early-input buffer |
| Brush | Aimed swipe, wet fields, charged splash fired on release; unlimited pigment use |
| Paint roles | Red damage/burn, blue slow/freeze, green root/healing, dry weak damage/status clear/world restoration |
| Threats | Beetle, mosquito, toad, turtle, cragfrog; Reeds wisp, serpent and leech; telegraphs and pigment counters |
| Fly counterplay | Approach → 0.60s locked-direction tell → 0.30s dart → 0.85s recovery; only dart contacts hurt; blue interrupts |
| Bosses | Gray, Green and Gilded Herons; Silt Wyrm, Hollow Warden and Umbral Wyrm. The smaller Painted/Sketch Herons reuse heron rules |
| World | Four zone beats, checkpoint rests, optional guardian, weather; Bold hazards; Reeds flooding, darkness and lantern |
| Atelier | Ten-painting catalog, two equip slots, synergies, upgrades, collection/NG+ progression and local challenge rewards |
| Wander | Optional bounded content shuffle and seeds; defaults off |
| Presentation | Correctly rendered Silt/Umbral bodies, cached lantern darkness mask, Canvas watercolor layers, paper UI, particles with caps, bloom, telegraphs, Web Audio music/SFX |
| Persistence | LocalStorage plus in-memory fallback, validated save import/export, backwards-compatible defaults |

## New field studio

Three hand-authored studies occupy the normal swamp and two occupy ordinary
Reeds when Wander is off. They are absent from Curator Challenges, Wander and
Black Reeds runs. Nearby paper cards show the active pigment/verb and coat
count, including brief guidance for an aimed wrong-color stroke. Instructions
draw above the Reeds darkness; the target circles remain in the world.

| Study | Position | Painting sequence | Result |
|---|---|---|---|
| First Light | 640, 750 | Blue → green → red | Water, lilies, dancing fireflies |
| The Rain Choir | 2300, 720 | Green → blue → red | Reeds, rain, warm flower bells |
| A Borrowed Sky | 3940, 760 | Red → blue → green | Sun, reflection, flying birds |

Reeds adds The Lantern Garden and The Echo Pool. Completing the Reeds pair
grants a cosmetic woven border independently of the swamp's golden signature.
The optional painted crossing near Rain Choir responds to green/blue/red;
the optional Reeds lantern-moth nook teaches green flowers and blue interruption.

V opens a paused Field Atlas with the frog, live study progress, remembered
studies, visited checkpoints, lantern rests and available authored side paths.
It also opens from the pause menu with mouse/controller. V/Esc, Return or
controller B closes it, preserving prior pause and clearing held actions.
Landmarks are mode-aware. The atlas is a field sketch, not a collision map.

Each world has 24 decorative dragonflies/pond skaters from a separate seeded
random stream. Nearby paint elicits a 3.4-second pigment response; rendering is
culled outside the viewport. They do not affect combat, collision or saves.

Aim at the active numbered circle and apply three coats per stage. Wrong
colors and distant/backward strokes do not count. Each completed stage
changes the scene immediately; completion produces a bloom, heals fully once
per study per run, records progression, and files a sketchbook page.
First Light's 205-pixel teaching area protects a player who has not learned
brush-hop and suppresses new waves there. Its shelter ends on completion.

Completing any study permanently unlocks brush-hop in non-challenge runs.
Painting during a hop leaves at most 24 marks for 1.25 seconds, radius 27.
Red briefly burns, blue slows/interrupts flies, green roots ground enemies.
An enemy is affected at most once per hop; stronger existing status is not
shortened. It is a defensive movement reward, with no extra boss-damage path.
All three completion flags unlock the gold postcard signature.

## Sketchbook and saves

J opens a paused sketchbook from a run or menu. It retains the latest eight
unpinned expeditions plus at most two pinned pages, with up to 180 quantized
strokes per page. X or the pin button toggles protection. Strokes come from
actual successful brush actions and brush-hop marks, sampled with a
deterministic reservoir as a run gets longer. This is an illustrated souvenir,
not a pixel-perfect screenshot or combat replay.

Pages are filed at study completion, opening the in-run book, quitting to the
title, and the run ending. Re-filing the same expedition updates its page.
The postcard combines real sampled marks with illustrations of completed
studies. Name page opens a native plain-text editor (48 code points); Enter or
Save title confirms, Esc/Cancel discards. Typing owns input, so J/X and gameplay
shortcuts do not fire. Edited captions survive re-filing. Mouse and D-pad/A/B
reach these controls; typing requires a keyboard or OS on-screen keyboard.
Exhibit on title screen explicitly chooses a pinned page; remove or unpin clears
it, with no automatic replacement. Book, title keepsake and local 1600×960 PNG
share the postcard renderer and caption. Nothing is uploaded.

Schema 12 has optional `studio.completed`, `sketchbook`, `sketchPins` and
`sketchExhibit` fields, plus a page `named` flag for preserving edited captions.
Old saves default to empty values; imported arrays, numbers, identifiers and
titles are bounded before rendering. No mid-expedition resume is provided.
Options retain volume zero correctly. Storage denial falls back to memory;
the existing warning tells the player that progress may not persist.

## Architecture

| File | Responsibility and boundary |
|---|---|
| index.html | Responsive 1280×800 logical canvas; catches module boot errors; loopback-only debug handle |
| src/game.js | State machine, frame orchestration, world/boss integration, HUD/menus, gamepad routing |
| src/logic.js | Pure rules, tuning, progression, save normalization, study and wake rules |
| src/studio.js | FieldStudy presentation/runtime, bounded stroke journal, sketchbook UI, PNG export |
| src/atlas.js | Paused field map and live expedition landmark presentation |
| src/wildlife.js | Fixed-cap cosmetic pond life, separate RNG and expiring pigment response |
| src/player.js | Movement, hop, collision, damage/heal/death |
| src/paint.js | Swipe/splash, paint surfaces, enemy/boss paint application; onStroke callback for studio |
| src/enemies.js | Enemy instances, behavior and procedural art; boss render/state helpers |
| src/world.js | Terrain, pigment cells, obstacles, zones, procedural variation, environmental layers |
| src/input.js | Mouse/keyboard ownership, pointer scaling and edge capture |
| src/save.js | Thin localStorage adapter, storage fallback |
| src/ui.js / audio.js / particles.js / math.js | Drawing primitives, synthesized audio, capped effects, math |
| scripts/dev.mjs / build.mjs / check.mjs | Loopback server, reproducible runtime-only ZIP, enforced regression gates |

Rules belong in logic.js. Studio receives successful paint actions through
`paint.onStroke`; it does not inspect arbitrary held input to award coats.
The Game owns one FieldStudio per expedition. Starting a new run resets its
transient pages/wakes while preserving saved completion flags.
The sketchbook runs before expedition updates and resets input on open/close.

## Controls and accessibility

See README.md for the complete keyboard/mouse and gamepad table.
Controller aim/paint now uses right stick/RT; the title displays controller
instructions when a pad is connected. Physical mouse ownership survives pad
disconnect. Blur clears held movement and paint.

Responsive letterboxing fits 640×480 through 1920×1080 tested viewports;
pointer coordinates convert CSS pixels to logical canvas coordinates.
A small window fits but text is naturally smaller. Existing volume, mute,
shake, grain and vignette options remain available. Color names/numbers
help study identification. Canvas UI has limited screen-reader support.

## Known limitations and technical debt

- Human enjoyment and first-ten-minute pacing need external friend playtests.
  Scripted input and visual inspection do not establish those outcomes.
- Physical controller hardware, Firefox, Safari and touch devices were not
  tested in this pass. No touch interface is implemented.
- Saves are local to each origin/browser. Reload loses the active expedition;
  saved progression and filed pages survive. Eight rolling pages plus two pins.
- Fixed studies do not adapt to Wander or appear in Black Reeds; ordinary Reeds has two.
- game.js remains large and mixes orchestration, menus and boss presentation.
  Avoid broad refactors while adding content; extract a boundary only with tests.
- Several legacy probes duplicate a headless harness and rely partly on
  analytic wave estimates. scripts/check.mjs enforces their bands, but does
  not turn the estimates into empirical human timings.
- GPU/display-frame performance is not measured by the draw-submission probe.
  Object caps and relative CPU costs are verified.
- Old design/status files are preserved under docs/history; they are not
  current instructions. Source and tests outrank any document.

No reproducible game-breaking defect remains from this pass's tested paths.
See VALIDATION.md for the exact evidence and coverage limits.
