# Twenty delights validation — 2026-11-11

All 19 gates pass with `node scripts/check.mjs --browser`: smoke through
stage 131, campaign rules/combat, seven retained pacing bands, balance,
UI/audio, package, source/dist browser journeys, 36 scenes and performance.
The report/logs are in ignored `.cache/checks/`. The static build now contains
22 runtime files; no dependency, remote request or save-version change.

## Coverage of the 20 ideas

| Ideas | Evidence |
|---|---|
| 1–5: deeper painting, lanterns, reeds, mushroom music, garden blooms | paint-delights.mjs exercises all floors, fixed caps, real studio stroke routing, erase/repaint and no save/tuning/heal effects. Browser uses real keys/mouse to paint four props per deeper floor and complete a cluster; all 64 props per floor have a collision-resolved approach within brush reach. |
| 6–10: attack/opening/interrupt/boss cues and clearing results | combat-delights.mjs checks live phase/status rules, bounded captions and frozen replay statistics. Browser interrupts an actual windup with blue, earns the result through the final paint hit, checks a Warden phase transition and unlit Umbral cue. |
| 11–15: intros/objective/arena/atlas/build recap | journey-ui.mjs checks four floor identities, context, render purity and landmarks. Browser captures each intro, opens the actual atlas at the final approach, verifies the boss remains dormant and renders the build recap. |
| 16–20: seeded offers and three specialty gifts with previews | brush-gifts.mjs covers 100 seeds, unique/stable offers, rejecting unoffered gifts, stacking, real Game tuning and fresh resets. Browser chooses all three specialties through DOM input and checks live tuning against the displayed preview. |

Compact and desktop screenshots were reviewed. A discovered overlap between
the clearing card and depth label was fixed: the clearing owns that space.
Old DODGE/Paint now captions were removed while retaining attack geometry.
Evidence: `tests/.out/astra/40–47`, `combat-*.png`, and
`.cache/paint-delights-review/`, `.cache/journey-review/`.

## Balance and bounds

Before telemetry is `.cache/checks/balance-before-delights.log`; after is
`.cache/checks/balance.log`. They are byte-identical: base combat values and
the original power/heart/flow journey are unchanged, with no flagged imbalance.
The clearing combat probes remain 45.0s red-only and 44.4s blue/red. The
four-boss combat probe remains 292.7s, excluding traversal/human decisions.

New gifts are optional, run-only tuning: range ×1.20 and splash radius ×1.15;
swipe cooldown ×0.85; green healing ×1.35. Exactly three total gifts remain
possible. Tests verify their values and reset behavior; the existing balance
telemetry does not establish that every specialty build is equally strong.

Each floor has 64 decorative props and 16 cluster records. Bloom animation
decays; holding the same color does not retrigger it. Combat display selects
at most two nearby enemy captions and one boss cue. No particle pool or
persistent storage grows with repeated painting or drawing.

Existing headless draw-submission gates pass (peak p95 1.0ms, ceiling 1.1ms,
sustained 1.3ms). These are CPU submission measurements, not GPU/display FPS,
and do not constitute an exhaustive benchmark of every newly decorated view.
No browser errors occurred in source or packaged journeys. Physical controller
and human whole-run enjoyment/balance testing remain outside these checks.
