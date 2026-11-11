# Responsive controls — design and validation, 2026-11-11

## Reason for this pass

The owner reported that the game was not fun and identified movement/combat
as awkward. The previous roadmap added exploration and presentation, but did
not address the feel of steering and fighting. This pass changes those basics.
The report is qualitative owner feedback, not five completed playtest sessions.

## Changes and measurements

| Behavior | Before | After |
|---|---|---|
| Release drift from full walking speed, 60Hz | 14.57px | 4.32px |
| Reverse direction from full walking speed | 3 frames | 2 frames |
| Stationary hop's first-frame velocity | 124.45px/s | 506px/s |
| Hop displacement after 13 frames | 82.66px | 92.45px |
| Simulation advanced during 3s of ordinary connected painting | 2.673s | 3.000s |
| Repeated damage/status labels | Several overlapping copies | One latest hit + one status per creature |

Measurements use deterministic 60Hz inputs; the combat fixture has a stationary
durable beetle to isolate feedback without kills. They are not human enjoyment
measurements. Local baseline artifacts: `.cache/feel-before.json` and
`.cache/feel-after.json`; browser regression repeats the new release/attack tests.

Ground response rates move from a shared 14/s to acceleration 26/s, brake 38/s,
reverse 36/s. Hop starts immediately, with its target multiplier reduced from
2.6 to 2.2 to keep the dodge short. Walking top speed, hop cooldown and damage
invulnerability remain unchanged. Pure rule helpers live in logic.js.

Ordinary strokes retain their enemy flash, ink, sound and a smaller camera
impulse, but no longer repeatedly dilate the movement clock. Kills, charged
impacts and boss-defeat feedback remain. Quick mouse clicks between animation
frames now produce one swipe. Q/E and the wheel cycle combat colors; dry stays
on 4. Numeric selection and controller selection still work.

The brush arc uses actual melee range, and its target ring shares the same
circle/fan rule as Paint.trySwipe. It is informational, never aim assist.
Splash charging shows the actual radius, progress and release cue beside the
frog. A small foot arc shows hop recovery. These draw above Reeds darkness and
hide behind paused overlays. HUD action words are larger. Hit text replaces
per-creature labels rather than piling up; storage caps at 24 labels and expires.

Splash follows the displayed hold/release contract: full release fires; early
release cancels; a later press cannot fire an old stored charge. Input reset
clears a stale charge on the next active simulation frame. No new damage rule.

## Pacing and harness correction

All nine original pacing bands remain enforced. The Warden's 50,000 HP produced
3.81–4.11m after the control changes. Lowering health 4% to 48,000 gives
3.60–3.99m across the existing six samples. Attack/tell windows are unchanged.

Reeds/Black Reeds traversal probes used to inject vx=230 with no held input,
then apply braking every frame. The new stronger brake revealed that this was
not a walking measurement. They now hold D during that idealized traversal,
release it before the boss, and retain all old bounds. The same corrected
probes were run against an archived pre-pass runtime under `.cache/feel-baseline`:

| Corrected probe | Old runtime | New runtime |
|---|---|---|
| Reeds traversal / Silt fight | 23.0s / 99.9s | 23.0s / 99.1s |
| Black Reeds traversal / Umbral fight | 28.5s / 105.7s | 28.5s / 105.9s |

Final estimates: Normal 17.3m; human model 18.4m; heron 37.0s; Reeds 22.2m;
Warden 3.60–3.99m; Black Reeds 25.7m; Umbral 3.79m; NG+ 19.5m; Wander
16.9–17.8m and Wander/Reeds 21.6–22.7m. These remain models, not playtest times.

Balance before/after has no flags. TTK, zone pressure and charged-splash ratios
are unchanged. The seeded traversal collects a different pigment mix after
movement changes: banked red/blue/green 3/7/4 → 3/5/6. The intended affordable
loadout still passes; prices and drops were not retuned to hide that difference.

## Verification

`node scripts/check.mjs --browser`: **all 19 gates PASS**. Full smoke ends
`ALL SMOKE TESTS PASSED`. Stage 123 covers movement, frame-rate response,
quick clicks, color shortcuts, charge cancellation/release, exact reach,
bounded hit text and render purity/overlay ownership. Stage 59b now explicitly
guards full-speed ordinary hits; existing heavy-impact checks remain.

Source and packaged Chromium journeys use real DOM keys, mouse movement,
wheel, short click and hold/release. New checks verify <5px stopping drift,
immediate hop movement, color selection, uninterrupted attack clock, no more
than two labels for the target, and charged-impact feedback. The combat target
has staged 1000 HP and zero speed for isolation; the frog does not use god mode.
Existing five-study, moth, crossing, lessons, full boss, gallery, export and
restart journeys still pass.

Reviewed screenshots in `tests/.out/astra/`: 29-close-combat.png,
30-splash-readiness.png, 31-combat-640.png. The 36-scene harness passed.
Whole-frame CPU draw-submission p95: quiet 1.00ms, peak 1.20ms, ceiling 1.10ms,
sustained 1.50ms. All caps/decay/relative-cost gates pass, real peak paint pool
203/220. These are not GPU timings or a universal displayed-FPS guarantee.

Runtime ZIP SHA-256:
`c8c96a53843d4e7f2b0d229d5da0a9abf69f74cd04b039bad59ed5f57769b9c1`.
Game 1.0.0 / Save 12 remain compatible. No installs, remote services or uploads.

Next evidence: the owner should replay movement, dodging and a short fight.
Additional people, physical controllers and Firefox/Safari remain unverified.
Automated responsiveness checks cannot establish that the game is now fun.
