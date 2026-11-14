# Current state — reclaim our swamp's color

**2026-11-12.** The Umbral Wyrm stole the color from our swamp. The playable
game is one journey across four regions to paint our home back to life, with
a fresh run build, three rests and the color thief as final boss. New Game+ and its progression
systems are removed. Runtime version remains 1.0.0 and save schema remains 12.
The owner's correction supersedes the earlier generic room-clearing framing
and combat coaching captions. Creative scenery, visually readable attacks,
quiet story/route cues, varied gifts and numeric previews support the swamp.
See ROADMAP.md for current priorities and PROJECT_STATE.md for verified checks.

## The playable loop

Title → optional guided practice or new journey → Watercolor Marsh / Great Gray
Heron → rest → Sunken Reeds / Silt Wyrm → rest → Hollow Sanctuary / Hollow Warden
→ rest → Black Reeds / Umbral Wyrm → final victory. Death ends the run and a new
attempt begins in the marsh. Hollow Sanctuary reuses the authored Reeds terrain
with its own guardian; these are four regions, not four new biomes.

Health, run time, score and collected pigment carry across regions. Each rest
heals 35% of maximum health, rounded up and capped, and requires one gift
selection followed by Continue. Brighter paint increases brush/splash/burn
damage 20%; Lily heart adds 2 maximum health and fills the added capacity;
Flowing brush multiplies dodge/splash cooldowns by 0.88. Three specialties add
Broad brush (swipe reach ×1.20, splash radius ×1.15), Quick strokes (swipe
cooldown ×0.85), and Kind moss (green ground/on-paint healing ×1.35).
Only three selections can occur, and they last for that run. Repeated gifts
stack when offered again.

Exactly three cards appear at every rest. The first offers the original power,
health and flow gifts; the second keeps Lily heart plus two specialties, and
the third keeps Flowing brush plus two specialties. Specialty pairs are fixed
by run seed and region index, separate from combat randomness. The rule layer rejects
unoffered choices. Cards preview rounded numeric before-and-after values from
the current tuning, including already earned gifts.

New runs use base tuning for Gentle/Normal/Bold, ignoring saved purchased
upgrades and equipped paintings. No standalone shop, challenge, Wander or
post-victory cycle is offered. Green and Gilded Herons, gold-tier purchases,
prestige bonuses and New Game+ scaling/modifiers are removed. Hollow Warden and
Umbral Wyrm are normal campaign guardians.

The earlier component pacing estimates do not measure a human's full journey
duration. Current campaign simulations test actual combat/progression, while
human enjoyment and long-run balance still require playtesting.

## Systems that exist

| System | Current behavior |
|---|---|
| Movement | Responsive stops/reversal, full-speed ordinary painting, short Space dodge, stationary aim direction, 120ms early-input buffer |
| Brush | Unlimited swipe and release-fired charged splash; pigment aim mark at actual reach, with continuous ground washes; mouse clicks capture relative aiming, Escape releases/pauses and menus release automatically |
| Colors | Red damage/burn, blue slow/freeze/interrupt, green light damage/root + 1 HP per landed action (including bosses), dry status clear/restoration |
| Threats | Swamp/Reeds visual telegraphs and pigment counters; repeated attack/opening/blue-stop/boss coaching captions removed |
| Campaign | Four region guardians in fixed order; run-only gifts; final victory returns the color stolen by Umbral |
| World | Zone encounters, checkpoints, optional side guardian, weather, Bold hazards, Reeds flooding/darkness/lantern |
| Lily Clearing | Optional marsh bell encounter; blue-to-red adds 50% direct damage; result card shows battle time, rounds, dodge uses and colors; no repeat reward farming |
| Free painting | 64 objects per region with individually colored parts, directional stripe/speckle marks, musical caps and distinct reactions; 16 bounded cluster blooms without completion text |
| Route guidance | Short stolen-color story arrivals, quiet exploration objective, open guardian landmarks and atlas destinations; all guidance yields during fights |
| Presentation | Procedural watercolor, paper UI, visible boss bodies, cached darkness mask, bounded particles, Web Audio |
| Soundtrack | 13 original 16/32-bar pieces; distinct region/guardian/rest/end themes, chamber-style synth voices, stereo room, smooth transitions and quieter menu mix |
| Persistence | Browser-local save, in-memory fallback, validated JSON import/export; no active-run resume |

Region guardians stay dormant until the final 900 pixels. Painting cannot wake
a remote boss. The final boss is the fourth guardian, not the first swamp heron.
Guardian landmarks mark that same arena threshold without adding collision or
another unlock. Intro/objective rendering never changes simulation; guidance
yields to menus, tutorials, teaching cards, event banners and all nearby combat,
including active bosses. The final arrival, landmark and atlas identify Umbral
as the color thief rather than presenting a generic final room.

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
input. Guardian arenas are shaded and marked; the marsh includes its
Lily Clearing bell. The atlas is a field sketch rather than a collision map.

Free gardens use four objects per cluster. Coloring all four triggers one
short bloom without completion text; a latch prevents erase/repaint farming.
Each mushroom cluster, lantern and stone group has three paintable parts;
flowers have four heads, reeds five, and lilies six petals. Swipes target one
part along the aim ray and leave directional stripes. Splashes add speckles
to reached parts. Dry removes touched colors/details while keeping neighbors.
There are at most eight retained marks per prop. Mushroom caps bounce and
sound individual notes; flowers lean toward the brush, lilies turn/ripple,
reeds bend and lanterns have colored fireflies. Sound cooldowns and fixed
effect slots bound repeated input. These are not new light fuel, collision,
combat or save systems. Garden counts reset with each region; only that
region's 64 props and 16 clusters are live.

Each world has 24 decorative dragonflies/pond skaters from a separate seeded
random stream. Nearby paint prompts a 3.4-second response. They are culled
outside the viewport and never affect combat, collision, loot or saves.

## Sketchbook and save compatibility

J opens a paused sketchbook from a run or menu. Eight recent unpinned pages and
two pins retain up to 180 quantized strokes each, sampled from actual successful
brush actions. Pages are souvenirs, not complete replays. Study completion,
opening the book, leaving for the title and run endings file/update pages.
Each region has its own world/stroke journal; saved earlier pages remain.
The run-end screen shows earned gift names and stack counts beside the latest
postcard, including a useful empty-build message for an early defeat.

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
| src/game.js | Frame/state orchestration, region transitions, combat integration, HUD/menus and controller routing |
| src/logic.js | Pure campaign transitions, seeded gift offers/previews, tuning, save normalization and painting/combat rules |
| src/dungeon.js | Rest choices/numeric previews, Continue control and four-region progress/route presentation; legacy internal filename |
| src/journey-ui.js | Swamp story arrivals, quiet exploration objective, guardian landmarks and earned build summary |
| src/encounter.js | Bounded replayable Lily Clearing and completion statistics |
| src/combat-ui.js | Close-range brush and charge/dodge presentation without combat-coaching captions |
| src/repaint.js | Per-region individual-part painting, stripe/speckle marks, local reactions and bounded garden blooms |
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
