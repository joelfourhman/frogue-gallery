# Project state — Astra Q1 complete (biome/reward-group study registry)

Updated 2026-10-12. **Q1 is implemented and verified**: study definitions are
now biome/reward-group aware, the swamp gold reward is pinned to an explicit
required-ID group, and Reeds carries zero living studies until Q2. The exact
next task is **Q2 — implement Lantern Garden end to end** in
docs/QWEN_BACKLOG.md.

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

Implement **Q2 — Implement Lantern Garden end to end** (first optional
painting discovery in ordinary Reeds): one fixed safe location, green→blue→red
coats via the existing stroke hook and caps, stems/dew/moths presentation,
one completion message, persistent completion + postcard memory. Q1's
`studiesForBiome`/`STUDY_GROUPS` are the extension points: register the new
definition with `biome: 'reeds'` and a new reward group; keep zero swamp or
challenge leaks. Do not revive historical next actions.

No known reproducible game-breaking issue remains in exercised paths.
Human friend feedback, physical controllers, Firefox/Safari and hosted iframe
behavior remain unverified. No touch UI, mid-run resume or cloud persistence.
