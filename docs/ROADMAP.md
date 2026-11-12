# Frogue Gallery — bring our swamp's color home

## Current direction — our stolen-color swamp

The owner's latest 2026-11-11 correction is the design anchor: this is **our
swamp**, and **the final boss stole its color**. We paint it back to life and
reclaim our home. A finite, connected journey replaces New Game+, but generic
dungeon language and text coaching over attacks lost that purpose. Remove
those distractions; keep responsive movement, visual danger and free painting.

The route is Watercolor Marsh → Sunken Reeds → Hollow Sanctuary → Black Reeds.
The Great Gray Heron, Silt Wyrm and Hollow Warden guard the first three regions;
the Umbral Wyrm is the color thief and final boss. The two Reeds regions reuse the authored
Reeds environment with different guardians. This is a connected campaign,
not four newly created biomes.

## Milestone 1 — Connect the journey (complete)

- Start every new run in the marsh with base stats for the selected difficulty.
- Carry health, elapsed time, score and collected pigment between regions.
- After each of the first three bosses, pause at a rest that heals 35% of maximum
  health, rounded up and capped at maximum health.
- Choose one gift: Brighter paint (+20% brush, splash and burn damage), Lily
  heart (+2 maximum health), or Flowing brush (12% faster dodge/splash recharge).
  Gifts stack within the run; there are exactly three selections in a full run.
- Require a selected gift and an explicit Continue action. Show the four-region
  route so the next destination is clear.
- End in victory only after the Umbral Wyrm. Defeat or a fresh start returns to
  the marsh; no harder cycle, prestige retirement or permanent stat farming.

These systems are implemented in the campaign rules, game integration and
rest-screen UI. Current verification results belong in PROJECT_STATE.md.

## Milestone 2 — Remove the conflicting progression

Remove New Game+ cycles/scaling, run modifiers, Green/Gilded Heron variants,
gold-tier purchases, gilded frames and prestige bonuses. Remove standalone
Wander, challenge and shop entry points. The Hollow Warden and Umbral Wyrm
become ordinary guardians within the single campaign.

Keep saved sketchbook pages, pins, names, the selected title exhibition and
ordinary collected artwork. Legacy purchased upgrades and equipped paintings
do not alter a new run's stats. Save schema 12 and game version 1.0.0 remain;
migration strips obsolete New Game+ fields without discarding the sketchbook.
Learned brush-hop and authored study memories remain part of painting progress.

## Milestone 3 — Verify the complete journey

Run `node scripts/check.mjs --browser` and the campaign browser journey. Cover
all four real boss fights, three rests, reward stacking, invalid transitions,
death/restart, final victory, old-save migration, keyboard/mouse/controller
menu routing and the packaged runtime. Retain ordinary combat, painting,
study, save and performance checks. Retired mode tests must not keep removed
features alive merely to satisfy their previous assumptions.

Record observed test results and limits in PROJECT_STATE.md before committing.
Scripted combat and pacing estimates establish regressions and bounds; they do
not establish human enjoyment or a measured human duration for the whole journey.

## Milestone 4 — Twenty delights (2026-11-11; corrected by owner feedback)

The owner requested 20 ideas and trusted implementation. This pass concentrates
on painting, readable combat, navigation and meaningful brush choices. The
four-region campaign and absence of New Game+ remain unchanged. The owner then
rejected the combat text spam and generic framing. Rows 6–9 and 12 below record
that correction rather than treating the original captions as a success.

| # | Improvement | Implemented behavior |
|---|---|---|
| 1 | Paint the deeper swamp | 64 repaintable props in every region |
| 2 | Hanging lanterns | Recolorable lanterns with warm animated light |
| 3 | Whisper reeds | Painted reeds sway, glow and react locally |
| 4 | Musical mushrooms | Recoloring caps plays a short existing chime and animated notes |
| 5 | Garden celebrations | Each four-prop garden blooms once when fully colored |
| 6 | Clear attack warnings | Keep visible warning lanes; remove repeated coaching captions |
| 7 | Readable openings | Enemy recovery poses carry the cue, without "paint now" text |
| 8 | Blue-stop feedback | Paint/status effects confirm the interruption, without a text popup |
| 9 | Boss phase cues | Keep visible attacks and vulnerabilities; remove repeated instructions |
| 10 | Clearing result card | Battle time, dodges, color use and an encouraging next step |
| 11 | Regional introductions | Four short arrivals connect our home to the stolen-color story |
| 12 | Current objective | Quiet exploration direction; no instruction overlay during fights |
| 13 | Guardian landmarks | Open reed arches mark the arena approach, without locking movement |
| 14 | Atlas landmarks | Guardian arenas and optional Lily Clearing appear on the map |
| 15 | Run-build recap | End screen shows the gifts that shaped this attempt |
| 16 | Varied rest choices | Later rests offer stable seed-based specialties beside a familiar gift |
| 17 | Broad brush | 20% longer brush reach and 15% larger splash radius |
| 18 | Quick strokes | 15% shorter swipe cooldown |
| 19 | Kind moss | 35% stronger green-ground and direct-paint healing |
| 20 | Gift previews | Cards display current → resulting values before selection |

The first rest still teaches the original three gifts. The second retains
Lily heart and the third Flowing brush, each alongside two distinct specialties
chosen from Broad brush, Quick strokes and Kind moss. Choices never reroll on
redraw, and only offered gifts can be granted. Three gifts total still limits
the run's growth. Decorative gardens grant no currency or combat advantages.

See PROJECT_STATE.md and VALIDATION-delights.md for tests and limitations.

## Current correction — creative ownership, quiet combat

- Keep the story explicit: Umbral stole the color; painting restores our home.
- Use region names and Continue rather than Depth/Descend or dungeon labels.
- Suppress story/objective overlays whenever enemies or an active boss need
  attention. Preserve visual warning geometry and optional paused help.
- Make ordinary scenery a creative surface: different colors on individual
  parts, brush-shaped marks, splash speckles and local erasing. Reactions should
  belong to the object, not another generic completion banner or currency.
- Keep art playful and bounded, with no hidden recipe required to participate.

## Next — tune the swamp journey from play

1. Replay the whole journey and check whether the next region, guardian and
   gift choice are understandable without explanation.
2. Measure actual human damage, healing and gift choices across floors. Adjust
   repeated frustration or dominant choices before expanding the reward pool.
3. Check that the two Reeds regions feel meaningfully different through their
   guardian and encounter pacing; add authored variety where observations
   show repetition.
4. Continue making ordinary scenery rewarding to paint, with bounded local
   reactions and clear combat visibility.
5. Use the existing five-player playtest kit when participants are available;
   record observations separately from opinions and bot estimates.

Public hosting remains a separate task. No account, backend, online economy,
new currency or repeat-cycle progression is needed for this direction.

## Previous work

Lily Clearing, 64 freely repaintable props, responsive controls, five living
studies, the Field Atlas, decorative wildlife and the curated sketchbook are
implemented foundations. Historical implementation records remain in the
changelog, PROJECT_STATE.md and docs/history. Older mode/progression plans are
historical, not instructions to restore removed features.
