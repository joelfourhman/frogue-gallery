# Frogue Gallery — one long painted descent

## Current direction — a finite dungeon campaign

The owner's 2026-11-11 request supersedes the previous plan to pause content
expansion: remove New Game+ and its progression systems, and connect the game
into one long dungeon run with bosses and a final boss. The earlier movement,
readable combat, simple brush marker and free painting improvements remain.

The route is Watercolor Marsh → Sunken Reeds → Hollow Sanctuary → Black Reeds.
The Great Gray Heron, Silt Wyrm and Hollow Warden guard the first three floors;
the Umbral Wyrm ends the entire dungeon. The two Reeds floors reuse the authored
Reeds environment with different guardians. This is a connected campaign,
not four newly created biomes.

## Milestone 1 — Connect the descent

- Start every new run on floor one with base stats for the selected difficulty.
- Carry health, elapsed time, score and collected pigment between floors.
- After each of the first three bosses, pause at a rest that heals 35% of maximum
  health, rounded up and capped at maximum health.
- Choose one gift: Brighter paint (+20% brush, splash and burn damage), Lily
  heart (+2 maximum health), or Flowing brush (12% faster dodge/splash recharge).
  Gifts stack within the run; there are exactly three selections in a full run.
- Require a selected gift and an explicit Descend action. Show the four-floor
  route and current depth so the next objective is clear.
- End in victory only after the Umbral Wyrm. Defeat or a fresh start returns to
  floor one; no harder cycle, prestige retirement or permanent stat farming.

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
not establish human enjoyment or a measured human duration for the new dungeon.

## Next — tune the connected experience from play

1. Replay the entire descent and check whether the next floor, guardian and
   gift choice are understandable without explanation.
2. Measure actual human damage, healing and gift choices across floors. Adjust
   repeated frustration or dominant choices before expanding the reward pool.
3. Check that the two Reeds floors feel meaningfully different through their
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
