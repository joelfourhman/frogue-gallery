# Project state — Astra Vertical Slice

Updated 2026-09-26. The Astra feature/stabilization slice is implemented and
verified. Packaging and the final Qwen documentation are being finalized.
This user-authorized development cycle supersedes the old v1.10 feature freeze.
Prior logs are retained in docs/history/PROJECT_STATE-pre-astra.md.

## Implemented checkpoints

- Controls/fly repair committed as 46f5912. Responsive canvas and pointer
  mapping; stationary aimed hop + 120ms buffer; release-to-fire splash;
  input cleanup; tutorial/menu/crash fixes.
- Three living field studies, first-study sanctuary, permanent brush-hop,
  three-study cosmetic signature, eight-page actual-stroke sketchbook and
  local 1600×960 postcard export.
- Seven guided lessons now complete without damage or single-color softlocks.
  Retraining freezes surrounding danger. Controller right-stick aim / RT
  paint, Start pause / Back sketchbook; accurate controller title hints.
- Clear pigment effects and hop readiness in the HUD; corrected title/menu
  overlap, zero-volume persistence, tutorial rendering and pause behavior.
- Additive validated save fields; SAVE_VERSION 12 / GAME_VERSION 1.0.0 held.

## Balance and measurements

Mosquito movement multiplier 40 → 1; previously produced thousands of px/s.
New tell/dart/recover durations 0.60 / 0.30 / 0.85 seconds; blue interrupts.
Welcome red 5 → 6 (blue 9, green 5): retains by-zone-3 two-painting
affordability after the corrected fly path changed seeded orb collection.

Hollow Warden HP 52,000 → 50,000; timing windows unchanged. A newly enforced
2–4 minute gate exposed the old six-seed range 3.93–4.03m. New range
3.54–3.90m. The band was not widened. Baseline and final balance telemetry
both have no flags; the level-0 pressure curve remains 1.22/1.64/1.76/2.20,
charged single-target splash ratio 0.84×, and two-painting affordability YES.

Full smoke, nine seeded pacing probes, balance, UI, SFX and music pass.
Normal estimates 17.2m analytical / 18.3m mixed measured+analytic; Reeds22.2m;
NG+19.5m; Black Reeds25.8m; Umbral3.73m; Wander16.9–17.8m /
Reeds21.6–22.7m. These are bot/models, not human playtest durations.

Source and packaged Chromium journeys pass: study + PNG, save reload,
640/960/1920 layouts, seven lessons, real full-HP boss victory (god mode
used for that state test), defeat/restart. 36 rendered legacy scenes pass;
visual checks include new study, book, PNG and end states.
Effects stress includes 24 brush wakes; bounded pools pass.

## Final visual audit

The Silt/Umbral renderers treated [x,y] arrays as objects, silently producing
NaN geometry. Both now use tuple coordinates; smoke exercises finite drawing
coordinates across surfaced, transit and telegraph states. The lantern now
cuts a viewing circle through a reused darkness canvas with a cached sprite,
so creature art remains readable without an additive yellow wash.

Umbral surfaceY 1500 → 1240 leaves 260px of world below the maw (world
height is 1500), fixing a visibly clipped arena and adding movement room.
Umbral estimate 3.90 → 3.73m, inside 2.5–4; Black Reeds remains 25.8m.
No HP/damage/window change for this fix. Atelier copy/currency layout,
defeat recap, dark HUD contrast, lantern/stock overlap and boss names fixed.
Full integrated check: all 19 entries pass, including source/dist journeys,
36 frames and effects stress. Peak/ceiling/sustained p95 submission:
1.10/1.30/1.60ms; these are CPU timings, not displayed FPS.

## Immediate next action

Finish the delivery tooling/docs checkpoint, run its final integrated check,
commit it, and provide the build + Qwen handoff. Do not add more gameplay
systems to this milestone. No hosting/publication is authorized for this pass.
