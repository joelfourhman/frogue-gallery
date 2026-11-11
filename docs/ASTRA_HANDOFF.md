# Astra handoff — 2026-09-26

Historical handoff. Q1–Q9 below have since shipped. For current work read
PROJECT_STATE.md and the 2026-11-11 ROADMAP.md; the recommended Q1 task at the
end of this historical record is no longer a next action.

The major development cycle is complete as **Astra Vertical Slice**.
Start with PROJECT_STATE.md, then CURRENT_STATE.md. Do not restart the old
v1.1/v1.10 plans. Read source and tests whenever a document disagrees.

## What I changed

The game already had a substantial campaign: three biomes, six bosses,
Atelier builds, NG+, Wander, lantern systems and presentation layers.
I built on that foundation rather than add another generic biome/boss.

- **Living field studies:** three small subjects transform in response to
  real strokes. They put painting itself at the center of exploration.
- **Brush-hop progression:** finish a study, gain a defensive paint wake.
  One useful ability and one cosmetic completion reward; no new currency.
- **Personal gallery:** actual sampled strokes, illustrated study memories,
  eight recent pages, local PNG export; defeat can still produce artwork.
- **Fairness/control repair:** the mosquito's chase multiplier was 40. It is
  now 1 with a committed tell/dart/recovery cycle and blue counterplay.
  Stationary hops now use their direction, early inputs buffer, splash fires
  on release, pointer scaling works, and blur clears held input.
- **Stabilization:** practice target recovery, harmless/frozen lessons,
  visible sketch heron, full lesson completion, pause/help after practice,
  retraining restores boss intro, victory saturation const crash fixed,
  title overlaps fixed, zero-volume options preserved.
- **Late visual audit:** Silt/Umbral drawing incorrectly read `[x,y]` as an
  object, making bodies invisible. Fixed with finite-coordinate regression
  checks. Reeds lighting now reveals the existing scene through a reused
  darkness mask instead of bleaching it with additive yellow. Boss names,
  stock/lantern layout, Atelier copy and defeat recap spacing were corrected.
  Umbral surfaceY 1500→1240 places the entire encounter inside the world;
  its model now estimates 3.73m, still within 2.5–4.
- **Controller:** right-stick aim/RT paint and explicit pause/book buttons.
- **Delivery:** runtime-only deterministic ZIP, no-cache loopback server,
  one regression command, browser journeys, current docs and this handoff.

Code checkpoints: 46f5912 (controls/threat repairs), 43b3b0a (studio,
sketchbook and stabilization), 48eea42 (boss rendering, lantern and final UI).
The subsequent delivery/docs commit completes
the milestone; use Git history for its exact hash.

## Major design decisions to preserve

- Unlimited paint; collected pigment is Atelier currency. Old empty ammo
  pips were misleading, so the HUD now names the effects.
- The first studio is protected until its reward is earned. It teaches a
  joyous use of paint before asking for combat proficiency.
- Brush-hop is defensive and bounded. No boss-damage shortcut; challenges
  keep their fixed loadout. Do not turn this into a talent tree by accident.
- Three authored scenes outperform an unbounded content generator for this
  milestone. Wander remains optional, and studies are omitted there.
- Sketchbook art contains real strokes but is a sampled illustration, not
  a replay. Preserve that honest description and explicit retention cap.
- Browser-only architecture, no runtime dependencies/backend. Static hosting
  is enough. No remote deployment or account change was made.

## Architecture

logic.js owns all rules/constants and normalization. studio.js owns the
FieldStudio runtime/rendering, bounded journal, book UI and PNG renderer.
paint.js emits `onStroke` only after a real brush action fires. game.js owns
one studio per expedition, routes opening/closing the paused book, and
archives before losing run state. input.js tracks physical ownership so a
controller disconnect cannot release a mouse button that is actually held.

Persistent optional fields: `studio.completed` and `sketchbook`.
Each page has id/title/seed/biome/result/seconds/studies/strokes. Six-number
quantized strokes keep it small. Eight pages × 180 strokes; 24 wake marks.
All imported values are bounded. Save 12 / Game 1.0.0 deliberately remain fixed.

The build copies only index.html, favicon.svg and src/*.js. ZIP timestamps
are fixed; manifest hashes identify the artifact. Tests are dev-only.
scripts/dev.mjs binds 127.0.0.1 and serves only runtime paths.

## Fragile areas

1. game.js is large. Pause/help/book/tutorial/retraining/cinematic branches
   interact. Test open/close, defeat/restart and held-input cleanup together.
2. Boss paint is a legacy per-frame path separate from normal swipe cadence.
   Any refactor there can radically alter all pacing probes; measure first.
3. Save normalization has many historical optional fields. Keep defaults,
   unknown-field behavior and old-save tests intact; do not casually bump 12.
4. Field rewards currently count the three swamp IDs. Q1 explicitly introduces
   groups before adding studies, so future IDs cannot break the gold signature.
5. Studio owns transient wakes and strokes; a run restart must allocate a new
   studio. Archive BEFORE incrementing expedition identity or clearing player.
6. Wander/Challenge/NG+/Reeds have distinct gating. Do not enable a reward in
   every mode merely because it exists in save data.
7. Frame timings measure CPU drawing calls, not real displayed FPS.
8. Human pacing probes combine simulated components with analytic waves.
   The repaired humance bot must defeat the boss; a capped fight is a failure.

## Tuning deltas and evidence

Welcome red 5→6 compensates the corrected fly path's seeded income change.
Warden HP 52,000→50,000 keeps all six samples inside the original 2–4m band:
3.93–4.03m before, 3.54–3.90m after. Windows/tells unchanged.

Smoke, all nine pacing gates, balance (no flags), UI/SFX/music, source/dist
browser journeys, 36 frames and effects stress pass. The real browser boss
test reduces the full 30,000 HP through game logic and reaches victory.
God mode/arena placement isolate that state test. Studies and seven lessons
pass with full 10 HP without a god-mode override. See VALIDATION.md for limits.

## Known bugs

No reproducible game-breaking bug remains in the tested milestone paths.
Do not interpret this as proof of universal correctness. There are no known
unfinished enabled experiments. Missing touch support, no mid-run resume and
the eight-page cap are scope limits, not secretly deferred bug fixes.

External human playtests, physical gamepad hardware, Firefox/Safari and the
final hosting iframe remain unverified. Do not claim a human 15–20m session
or universal 60fps from these automated results.

## Deferred ideas

Reeds memories, an optional painted side path, pinned/renamed artwork,
a lantern-moth encounter, animated exports. ROADMAP.md defines the selected
next expansions; QWEN_BACKLOG.md scopes implementation tasks.

## Recommended next task

**Q1 — Make study definitions aware of biomes and reward groups.**
Implement the selector/group boundary with unchanged swamp behavior and
save 12 compatibility. Then verify source/dist browser journeys before Q2
adds Lantern Garden. No new subsystem or data model rewrite is needed.

Useful commands:

```sh
node scripts/dev.mjs
node scripts/check.mjs
node scripts/check.mjs --browser
node scripts/build.mjs
node scripts/dev.mjs --dist
```

Runtime has no install. Optional browser tests use playwright-core 1.63.0 and
an installed Chromium/Chrome/Edge (`CHROME_PATH` overrides discovery).
Follow WORK → TEST → UPDATE STATE → COMMIT. Do not publish or contact
playtesters without the owner's instruction.
