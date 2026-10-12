# Project state — Astra Q1–Q3 complete (registry, Lantern Garden, Echo Pool)

Updated 2026-10-12. **Q3 is implemented and verified**: the Echo Pool paints
end to end in ordinary Reeds (blue→red→green), and completing BOTH reeds
studies earns the cosmetic woven-reed postcard border (exactly-once banner,
order-independent, survives migration). Milestone 1's study content is now
complete. The exact next task is **Q4 — model the optional painted crossing**
in docs/QWEN_BACKLOG.md.

## Q3 record (2026-10-12)

- `src/logic.js`: registered `echo-pool` in `FIELD_STUDIES`
  (`biome: 'reeds'`, `group: 'reeds'`, colors blue→red→green, fixed at
  x=1150 y=720 — banks above the flood floor, below gravity pocket 1,
  ~500 px from the nearest rest stones). `STUDY_GROUPS.reeds.required` now
  pins BOTH `lantern-garden` + `echo-pool` — the border needs the whole
  reeds group, in any completion order.
- `src/studio.js`: new 'echo' motif (faint pool ring at step 0, blue outward
  ripples, red reflected stars, green water birds; bounded 4+7+3 elements,
  no allocations). Reward-group banners now fire EXACTLY once — on the
  completion that first satisfies the group (a `before`-list comparison), so
  finishing a second-biome study can never re-announce an earned group.
  `drawPostcard` gained a `bordered` flag (woven double frame + corner
  knots, cosmetic only) driven by `studyRewardEarned(completed, 'reeds')`
  from both the sketchbook and the PNG export. Sketchbook study list rows
  tighten to fit five entries.
- Tests: Q1/Q2 group assertions updated to the both-IDs border semantics;
  new Q3 slice assertions (fixed spot + pigment order, selector order,
  pool-first completion via real `trySwipe` strokes through both studies,
  border banner exactly once with no golden-lily re-announcement, both
  memories on the late page, bordered postcard render, round-trip keeps the
  border earned). The border's real-pixel proof moved to the
  vertical-slice journey (the smoke canvas is a stub context): the journey
  now paints BOTH reeds studies in a fresh Reeds expedition, asserts the
  border banner, and pixel-diffs the bordered vs unbordered postcard frame
  in real Chromium.
- Acceptance: each motif reads differently (echo stages distinct from
  lantern stages by design; both verified), border needs exactly the reeds
  group and survives migration (asserted), swamp gold signature still works
  (group truth table + unchanged signed path), no swamp/challenge leak
  (selector tests), Reeds pacing untouched. SAVE_VERSION stays 12,
  GAME_VERSION 1.0.0. Full check --browser: all 19 gates pass (19/19 in
  .cache/checks); dist rebuilt; browser-dist journey PASSED.

## Q2 record (2026-10-12)

- `src/logic.js`: registered `lantern-garden` in `FIELD_STUDIES`
  (`biome: 'reeds'`, `group: 'reeds'`, colors green→blue→red, fixed at
  x=3300 y=780 — on the banks above the flood floor 900, ~460 px from the
  nearest rest stone, ~1800 px short of the Silt Wyrm arena x>=5100) and added
  the `reeds` reward group (required: exactly `lantern-garden`).
- `src/studio.js`: new 'lantern' motif in `drawLivingStudy` — inert stems,
  green leaves, blue dew-lights, red orbiting moths (bounded: 6+6+8 elements,
  no allocations). All other Q1 plumbing (selector, stroke hook, archive,
  postcard memory, sketchbook list) picked it up with no new code paths.
- Tests: 9 new slice assertions (fixed spot + pigment order, wrong-pigment
  rejection, 3-stage paint progression through real `trySwipe` strokes,
  completion persistence + reeds reward group, reeds postcard page memory,
  round-trip, Reeds selector truth table incl. challenge/wander exclusions)
  and a real-browser vertical-slice stage: a fresh Reeds expedition
  (`_beginExpedition(false, { reeds: true })`) with real strokes, no god mode.
- Visual evidence: the four motif stages are pairwise pixel-distinct in
  headless Chromium (sampled signatures differ; nonzero 9216/9247/9271/9271);
  the journey screenshot is tests/.out/astra/10-lantern-garden.png.
- Acceptance: painting changes all three stages (verified), completion
  persists (save + reload asserted), the exported postcard shows the garden
  memory (journey asserts page.studies includes lantern-garden), no swamp or
  challenge leak (selector tests), Reeds pacing untouched (probe in band).
  SAVE_VERSION stays 12, GAME_VERSION 1.0.0. Full check --browser: all 19
  gates pass; dist rebuilt (15 files, 927 KiB).

## Q1 record (2026-10-12)

- `src/logic.js`: each `FIELD_STUDIES` entry now names `biome: 'swamp'` and
  `group: 'swamp'` (IDs, names, positions, pigment orders, verbs unchanged).
  New pure exports: `STUDY_GROUPS` (swamp requires exactly
  first-light + rain-choir + borrowed-sky), `studiesForBiome(biome,
  {challenge, wander})` (challenge/wander always yield none), and
  `studyRewardEarned(completed, group)`.
- `src/studio.js`: the studio instance builds from the pure selector instead
  of a hardcoded `runBiome === 'swamp'`; the golden-lily banner and the gold
  postcard seal (drawPostcard's `signed` flag) now use `studyRewardEarned`
  instead of `completed.length === 3`, so later-registered study IDs (Q2/Q3)
  cannot break or dilute the swamp reward.
- `tests/slice.mjs`: 11 new Q1 assertions — definition stability, selector
  truth table (swamp/reeds/blackReeds/unknown × normal/challenge/wander),
  reward-group truth table, future-ID immunity, schema-12 partial-progress
  round-trip, Reeds zero-studies + brush-hop preserved, wander exclusion,
  default swamp restore.
- Behavior on the current swamp: unchanged (same three scenes, same reward
  trigger, same postcard seal). SAVE_VERSION stays 12, GAME_VERSION 1.0.0.

## What shipped

- Three living field studies: First Light, Rain Choir and Borrowed Sky.
- First-study shelter, earned colored brush-hop and a cosmetic signature.
- Eight-page sketchbook of actual sampled strokes, illustrated study memories
  and local 1600×960 PNG export.
- Fair fly tell/dart/recovery and blue interruption; aimed stationary hop,
  120ms input buffer, reliable splash release and physical-input cleanup.
- Responsive canvas/pointer mapping, controller aim/paint, readable HUD,
  safe guided practice/retraining and defeat/restart/victory transitions.
- Visible Silt/Umbral geometry, readable cached lantern lighting, an Umbral
  arena inside world bounds, corrected Atelier/end-screen layout.
- Local server, enforced test command, deterministic static ZIP, current
  design/state docs and a concrete Qwen continuation plan.

Code checkpoints: 46f5912 controls/fly repairs; 43b3b0a studio/sketchbook;
48eea42 final visual stabilization. Delivery tooling/docs are the subsequent
commit. Prior planning logs are preserved in docs/history and Git c1ea26b.

## Balance record

| Change | Before → after | Why |
|---|---|---|
| Fly movement multiplier | 40 → 1 | Remove extreme pursuit speed |
| Fly tell/dart/recover | New 0.60/0.30/0.85s cycle | Readable committed attacks and escape |
| Welcome red | 5 → 6 (blue 9, green 5 unchanged) | Preserve by-zone-3 buying power after corrected fly movement |
| Warden HP | 52,000 → 50,000 | All six estimates fit original 2–4m band (3.93–4.03 → 3.54–3.90m) |
| Umbral surfaceY | 1500 → 1240 | Leave 260px below the maw inside a 1500px world; estimate 3.90 → 3.73m |

Baseline and final balance telemetry: no flags. Pressure curve at level 0:
1.22/1.64/1.76/2.20. Charged single-target splash ratio 0.84×. Cheapest
two-painting loadout affordable by zone 3. SAVE_VERSION 12 / GAME_VERSION 1.0.0
remain unchanged; new save fields are optional and normalized.

## Verification

`node scripts/check.mjs --browser` — all 19 entries pass.
Smoke ends ALL SMOKE TESTS PASSED. Nine pacing probes in band:
Normal 17.2m analytical / 18.3m mixed measured+analytic; Reeds 22.2m; NG+ 19.5m;
Warden 3.54–3.90m; Black Reeds 25.8m; Umbral 3.73m;
Wander 16.9–17.8m / Reeds 21.6–22.7m.

Source/dist journeys verify real brush study progression and PNG export,
all seven lessons, save reload, 640/960/1920 layouts, full-HP boss victory
and defeat/restart. God mode is used only for the isolated boss journey.
36 render scenes pass; final changed frames were visually inspected.
Effects stress: 203 legacy juice elements within 220 plus 24 capped brush wakes;
peak/ceiling/sustained CPU submission p95: 1.10/1.30/1.60ms.
These are bot/model and CPU measurements, not human duration or displayed FPS.
Full detail and limitations: docs/VALIDATION.md.

## Run and distribute

```sh
node scripts/dev.mjs
node scripts/check.mjs --browser
node scripts/build.mjs
node scripts/dev.mjs --dist
```

Ready artifact: dist/frogue-gallery.zip (15 runtime files, approximately 924KiB).
Hash/source file list: dist/manifest.json.
Current local preview: http://127.0.0.1:8766.
No public deployment/account changes. docs/DEPLOYMENT.md recommends the
HTML5 itch.io path and records alternatives.

## Next session

Implement **Q4 — model the optional painted crossing** (pure state
transitions for green crossing / blue current / red bramble in logic.js +
world.js): keep the main corridor open in every state, rebuild bounded
collision data on transitions only, validate enemy spawns against the new
solids. Milestone 1 is now COMPLETE (Q1–Q3) — Q4 is Milestone 2's
collision-safe foundation. Do not revive historical next actions.

No known reproducible game-breaking issue remains in exercised paths.
Human friend feedback, physical controllers, Firefox/Safari and hosted iframe
behavior remain unverified. No touch UI, mid-run resume or cloud persistence.
