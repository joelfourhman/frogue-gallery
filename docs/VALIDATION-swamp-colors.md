# Our swamp, our colors — validation, 2026-11-11

The owner rejected combat text spam and generic dungeon framing. This pass
restores the stolen-color premise and makes environmental painting expressive.

Final `node scripts/check.mjs --browser`: all 19 required gates passed,
including smoke, campaign/pacing, balance, audio/UI, packaging, source and
dist browser journeys, frame capture and performance. Source/dist journeys
completed in 23.8/23.7 seconds. Final painting and victory captures reviewed.

## Regression coverage

- Smoke stages 132–134 cover the title/rest/finale story, full-color final
  victory, safe musical notes, individual part palettes, brush patterns,
  touched-part erasure, fixed storage and fresh-run reset.
- Existing combat tests now assert the absence of attack, recovery, blue-stop
  and boss coaching captions. Actual blue interruption, phase transitions,
  warning geometry, damage and clearing completion mechanics remain covered.
- Source/dist browser journeys use real input to retain red/green/blue on
  separate mushroom caps and lantern panels, change swipe direction, erase
  only the middle cap and charge/release a speckled splash.
- Browser title/rest/finale checks reject player-facing dungeon/depth/descend
  language and verify Umbral stole our color. The staged finale renders world
  saturation 1 without the darkness mask; the separate campaign combat probe
  still verifies actual kills through all four guardians.
- Screenshots were reviewed for the quiet fight UI, multicolor scenery, title
  and finale. A study/painting-card overlap with the region footer was found
  and fixed by yielding that space to the painting card.
- The earlier Chrome launcher remains covered by the package gate, including
  server readiness, loopback binding, safe reuse and unrelated-port refusal.

## Balance and limits

`.cache/checks/balance-before-swamp.log` and the after log are byte-identical:
no base tuning, enemy timing, gift values or progression rules changed. The
first three guardians still lead to rests; the Umbral Wyrm is the final boss.
The original full combat probe remains 292.7 seconds, not a human playtime.

Painting uses 64 props per region, at most six parts and eight marks per prop.
No new particles, persistence, currency, combat boosts or external assets.
Drawing consumes no gameplay RNG and does not mutate the saved artwork.
Two short garden-note voices share the existing SFX mute/volume/voice budget.
Final-victory palette fallback is draw-only and preserves customized colors.

Creative scenery resets with the current region/run; saved postcards remain
the lasting artwork. Automated inputs establish function and bounds, not
human enjoyment or the ease of fine aiming. That needs the owner's playtest.

Evidence: `.cache/checks/`, `tests/.out/astra/48-our-swamp-title.png`,
`49-swamp-rest.png`, `50-color-returned.png`, `48-mushroom-palette.png`,
`49-splash-speckles.png`, `50-stained-lantern.png`, and `combat-*.png`.
