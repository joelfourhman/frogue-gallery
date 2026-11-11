# Current state — one continuous dungeon

**2026-11-11.** The playable game is one four-floor descent with a fresh run
build, three inter-floor rests and a final boss. New Game+ and its progression
systems are removed. Runtime version remains 1.0.0 and save schema remains 12.
See ROADMAP.md for current priorities and PROJECT_STATE.md for verified checks.

## The playable loop

Title → optional guided practice or new dungeon → Watercolor Marsh / Great Gray
Heron → rest → Sunken Reeds / Silt Wyrm → rest → Hollow Sanctuary / Hollow Warden
→ rest → Black Reeds / Umbral Wyrm → final victory. Death ends the run and a new
attempt begins on floor one. Hollow Sanctuary reuses the authored Reeds terrain
with its own guardian; these are four floors, not four new biomes.

Health, run time, score and collected pigment carry across floors. Each rest
heals 35% of maximum health, rounded up and capped, and requires one gift
selection followed by Descend. Brighter paint increases brush/splash/burn
damage 20%; Lily heart adds 2 maximum health and fills the added capacity;
Flowing brush multiplies dodge/splash cooldowns by 0.88. Repeated gifts stack.
Only three selections can occur, and they last for that run.

New runs use base tuning for Gentle/Normal/Bold, ignoring saved purchased
upgrades and equipped paintings. No standalone shop, challenge, Wander or
post-victory cycle is offered. Green and Gilded Herons, gold-tier purchases,
prestige bonuses and New Game+ scaling/modifiers are removed. Hollow Warden and
Umbral Wyrm are normal campaign guardians.

The earlier component pacing estimates do not measure a human's full dungeon
duration. Current campaign simulations test actual combat/progression, while
human enjoyment and long-run balance still require playtesting.

## Systems that exist

| System | Current behavior |
|---|---|
| Movement | Responsive stops/reversal, full-speed ordinary painting, short Space dodge, stationary aim direction, 120ms early-input buffer |
| Brush | Unlimited swipe and release-fired charged splash; one brush marker at actual reach; local charge/dodge cues |
| Colors | Red damage/burn, blue slow/freeze/interrupt, green root/healing, dry status clear/restoration |
| Threats | Swamp and Reeds creatures with telegraphs and pigment counters; mosquitoes commit to a lane and recover |
| Campaign | Four floor guardians in fixed order; run-only gifts; final victory only after Umbral |
| World | Zone encounters, checkpoints, optional side guardian, weather, Bold hazards, Reeds flooding/darkness/lantern |
| Lily Clearing | Optional first-floor three-round bell encounter; blue interrupts, blue-to-red adds 50% direct damage; no repeat reward farming |
| Free painting | 64 opening plants/stones accept any paint color and retain it for the current floor |
| Presentation | Procedural watercolor, paper UI, visible boss bodies, cached darkness mask, bounded particles, Web Audio |
| Persistence | Browser-local save, in-memory fallback, validated JSON import/export; no active-run resume |

Floor guardians stay dormant until the final 900 pixels. Painting cannot wake
a remote boss. The final boss is the fourth guardian, not the first swamp heron.

## Living studies and exploration

Three studies occupy the swamp and two occupy ordinary Reeds. Black Reeds has
no authored studies. Nearby cards show the needed color/action and coat count,
with brief aimed wrong-color guidance. Cards remain above Reeds darkness.

| Study | Position | Sequence | Result |
|---|---|---|---|
| First Light | 640, 750 | Blue → green → red | Water, lilies, dancing fireflies |
| The Rain Choir | 2300, 720 | Green → blue → red | Reeds, rain, warm flower bells |
| A Borrowed Sky | 3940, 760 | Red → blue → green | Sun, reflection, flying birds |

Reeds adds The Lantern Garden and The Echo Pool. The painted crossing and
lantern-moth nook are optional authored detours. Three coats complete each
study stage. Finishing a study heals fully once per current-floor instance,
records its memory and files a sketchbook page. All three swamp memories grant
a golden signature; the Reeds pair grants a woven border. These are cosmetics,
not the removed gold-tier economy.

Completing any study teaches brush-hop for later play: hold paint during a hop
to leave a defensive wake. At most 24 marks last 1.25 seconds with radius 27;
each enemy is affected at most once per hop. Stronger status is not shortened,
and there is no added boss-damage path. First Light shelters an untrained frog
within its 205-pixel teaching area until completion.

V opens the paused Field Atlas, also reachable from pause with mouse/controller.
It shows the frog, live/remembered studies, checkpoints, lantern rests and
available detours. Closing restores the prior pause state and clears held
input. The atlas is a field sketch rather than a collision map.

Each world has 24 decorative dragonflies/pond skaters from a separate seeded
random stream. Nearby paint prompts a 3.4-second response. They are culled
outside the viewport and never affect combat, collision, loot or saves.

## Sketchbook and save compatibility

J opens a paused sketchbook from a run or menu. Eight recent unpinned pages and
two pins retain up to 180 quantized strokes each, sampled from actual successful
brush actions. Pages are souvenirs, not complete replays. Study completion,
opening the book, leaving for the title and run endings file/update pages.
Each floor has its own world/stroke journal; saved earlier pages remain.

Page names use a native plain-text editor limited to 48 code points. Typing
owns input. Edited captions survive re-filing. A selected pinned page appears
on the title; unpinning/removing it clears that choice. Book, title exhibition
and local 1600×960 PNG export share the postcard renderer. Nothing is uploaded.

Migration preserves existing sketchbooks, pins, names, exhibition, studio
memories and ordinary collected artwork, while discarding obsolete New Game+
fields and gold-tier entries. Legacy bank/upgrades may remain as compatible
save data, but purchased stats do not feed new-run tuning. Save writes pass
through normalization so obsolete fields cannot leak back into storage.

Schema 12 and game 1.0.0 remain unchanged. Imported identifiers, numbers,
arrays and text are bounded. Storage denial falls back to memory. Reload loses
the active campaign, including its gifts; already filed pages remain saved.

## Architecture

| File | Responsibility |
|---|---|
| index.html | Responsive logical canvas, boot error reporting, loopback-only debug handle |
| src/game.js | Frame/state orchestration, floor transitions, combat integration, HUD/menus and controller routing |
| src/logic.js | Pure campaign transitions/rewards, ordinary tuning, save normalization and painting/combat rules |
| src/dungeon.js | Rest choices, Descend control and four-floor progress/route presentation |
| src/encounter.js | Bounded replayable Lily Clearing |
| src/combat-ui.js | Close-range brush, charge and dodge presentation |
| src/repaint.js | Bounded freely repaintable scenery |
| src/studio.js | Authored studies, brush wake, stroke journal, sketchbook and PNG export |
| src/atlas.js / wildlife.js | Paused map and bounded cosmetic pond life |
| src/player.js / paint.js / enemies.js | Movement, brush combat, creature/boss behavior and rendering |
| src/world.js | Terrain, pigment cells, obstacles, zones and environmental layers |
| src/input.js / save.js | Input ownership/scaling and localStorage adapter/fallback |
| src/ui.js / audio.js / particles.js / math.js | Drawing, synthesis, capped effects and geometry |
| scripts/dev.mjs / build.mjs / check.mjs | Loopback server, deterministic runtime ZIP and regression checks |

Rules stay pure in logic.js. Studio receives successful paint actions through
paint.onStroke; it does not inspect arbitrary held input to award coats.
Campaign progression is transient and validates the expected boss/order before
advancing. The rest UI cannot grant a gift merely by drawing or selecting it.

## Verification and limitations

Run `node scripts/check.mjs --browser` for current required regression gates;
see PROJECT_STATE.md for the actual results of this integration. Ordinary
combat/study/save tests remain alongside finite-campaign tests. Obsolete mode
checks are retired rather than forcing removed features back into the game.

- Human enjoyment, complete-run length and gift balance need human sessions.
- Component analytic estimates and scripted play are not human measurements.
- Physical controllers, Firefox and Safari need additional verification. No
  touch UI is implemented; Canvas has limited screen-reader support.
- Small windows fit by letterboxing but reduce text size. Volume, mute, shake,
  grain and vignette settings remain. Saves belong to a browser/site origin.
- Active runs have no resume save. The sketchbook is bounded to eight rolling
  pages plus two pins, not an unlimited run archive.
- game.js remains large. Pure rules and the separate rest renderer reduce the
  scope of new logic, but broader orchestration cleanup remains future work.
- Draw-submission probes do not measure GPU/display-frame performance.
- Historical design/status files can mention removed systems; source, tests
  and the current roadmap take precedence.
