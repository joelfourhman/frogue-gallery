# Single dungeon validation — 2026-11-11

`node scripts/check.mjs --browser` passed all 19 gates. The final report and
individual logs are in ignored `.cache/checks/`. Smoke ends with
`ALL SMOKE TESTS PASSED`; stage 127 covers the new campaign. Source and packaged
browser journeys pass, along with 36 rendered scenes and bounded performance.
The build contains 21 runtime files and a reproducible ZIP.

## What was exercised

- Four ordered guardians; invalid/duplicate clears and duplicate choices denied.
- Three free rests; explicit choice and Descend, 35% capped healing, preserved
  wounds/time/score/drops, stacked rewards, fresh base stats after death/restart.
- Old saves with NG cycles, modifiers, prestige and purchased upgrades cannot
  restore removed bonuses; artwork and sketchbook migration remain covered.
- Actual four-boss combat through the Game frame loop. The invincible,
  perfectly positioned bot paints each boss to death rather than setting HP
  to zero. Combat-only times: Gray 37.3s, Silt 85.0s, Warden 80.3s, Umbral 90.0s.
- Real browser input selects rewards, descends, reaches final victory, waits
  through the end-screen input guard and starts fresh. Controller D-pad/A/B
  selection, cancellation, focus and confirmation are exercised through the
  Gamepad API. Browser fixtures stage bosses/progress for deterministic UI
  coverage; the separate combat probe supplies actual fight coverage.
- Existing painting, study, personal postcard, naming/pinning/exhibition, PNG
  pixels, atlas, moth, aiming, dodge, clearing and free-repainting regressions.
- Rest/title/final screens rendered and reviewed at desktop and compact sizes.
  Evidence: `tests/.out/astra/36-camp-{1,2,3}.png`,
  `39-dungeon-complete.png`, and `tests/frames/astra/`.

## Balance comparison

The archived before log is `.cache/checks/balance-before-campaign.log`.
Base enemy TTK is unchanged. Base zone-pressure ratios remain
1.22 / 1.64 / 1.76 / 2.20. Swipe DPS is 32.4, charged splash single-target
27.1 and three-target 81.2; single-target splash/swipe ratio remains 0.84.
No combat flags were raised. Higher old-upgrade rows are historical tuning
comparison math, not the new run's progression.

Shop affordability is no longer a playable requirement. Its telemetry now
checks actual camp rewards: power 1.00→1.20, max HP 10→12, hop cooldown
0.700→0.616s for one of each gift; free access, carry and reset all pass.

Seven unchanged component bands pass: swamp estimate 17.3m, simulated-human
swamp 19.4m, Gray fight 37.0s, Reeds estimate 22.2m, Warden estimate
3.55–3.93m, Black Reeds estimate 25.8m, Umbral estimate 3.79m.
These are component regressions; their assumptions differ and they must not
be summed into a claimed human dungeon length. The owner's removal request
supersedes NG+/standalone Wander gates; campaign coverage replaces them.

## Limits

The 292.7-second campaign bot excludes traversal, ordinary encounters,
painting and human decisions. Human duration, difficulty and enjoyment of
the complete connected run have not been measured. Hollow Sanctuary reuses
Reeds terrain with its own guardian. Active runs do not resume after reload.

Headless Chromium measured peak/ceiling draw-submission p95 at 1.1ms with
bounded pools and no browser errors. This is CPU submission evidence, not
displayed FPS or GPU timing. Physical controllers and other browsers were
not manually tested. No deployment or external service was involved.
