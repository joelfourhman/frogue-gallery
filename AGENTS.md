# AGENTS.md — Frogue Gallery (durable agent instructions)

Read this before touching anything. `PROJECT_STATE.md` at the repo root is the
live status/next-action file; this file holds only durable instructions.

## What this project is

Frogue Gallery is a small, polished browser game: a tiny frog painter with a
magical paintbrush exploring a watercolor swamp. Vanilla JS + Canvas 2D +
Web Audio. No frameworks, no build step, no package manager, no network
dependencies. Browser localStorage is the only persistence (keys prefixed
`frogue_gallery_`).

**The repository is the source of truth.** Docs and chat history can drift;
the code, tests, and Git history outrank both.

## Layout

```
index.html          entry point (Canvas 2D, ES module boot)
src/game.js         frame loop, state machine, HUD/screens (biggest file)
src/player.js       frog: movement, pigment paint, damage, death
src/enemies.js      the bestiary: 3 base archetypes (beetle/mosquito/toad),
                    the Reeds-biome wisp/serpent/leech, and the 6 bosses
                    (gray/green/gilded heron, Silt Wyrm, Hollow Warden,
                    Umbral Wyrm) + per-boss step functions
src/logic.js        PURE rule logic: save schema, migrations, balance,
                    economy, pacing, boss rules. No browser APIs — importable
                    by tests. In v1.10 its tuning numbers MAY change (that's
                    the retune's point).
src/save.js         thin localStorage adapter over the logic.js schema
src/world.js        3 biomes (swamp 5400px / Reeds / Black Reeds), 4 zones,
                    the bounded Wander content generator (default OFF),
                    checkpoints, pigments, decor
src/paint.js        wet-paint brush physics + status fields (swipe/splash)
src/particles.js    splash/ink particle system
src/ui.js           paper-styled canvas UI primitives
src/audio.js        Web Audio synth: SFX + per-biome ambient themes
src/math.js         vector/geometry/wobbly-shape helpers
src/input.js        keyboard + mouse (+ gamepad mapping) capture
tests/smoke.mjs     the ~111-stage headless regression suite — the project's
                    only CI; must end `ALL SMOKE TESTS PASSED`
tests/pace.mjs      full-run pacing probe (god bot + human 0.42-DPS estimate)
tests/humance.mjs   simulated-HUMAN full-run pacing probe
tests/bosspace.mjs  heron boss-fight pacing probe (pigment-cycling bot)
tests/reedspace.mjs Reeds-biome pacing probe (wisp/serpent/leech + wyrm)
tests/wardpace.mjs  Wander Hollow Warden pacing probe
tests/blackpace.mjs Black Reeds (NG+ apex) pacing probe
tests/umbrapace.mjs Umbral Wyrm (Black Reeds apex) pacing probe
tests/ngpace.mjs    NG+ scaling pacing probe
tests/wandpace.mjs  Wander content-generation pacing probe
tests/balance.mjs   v1.10 M1 balance-telemetry probe (per-enemy TTK × pigment,
                    zone-pressure curve, charged-splash value, pigment
                    economy, flagged imbalances) — the retune baseline
tests/sfx.mjs,tests/music.mjs,tests/ui.mjs  dev-only audio/UI probes
tests/frames.mjs    frame-evidence harness (dev-only playwright-core, 35
                    seeded scenes, free port — never 8765)
tests/headless.mjs  minimal headless boot check
docs/design.md      design pillars and mechanics
docs/ROADMAP.md     milestones (v1.10 "The Tuned Swamp" is active)
docs/DECISIONS.md   consequential decisions log
docs/PROJECT_STATUS.md   current milestone, bugs, debt, risks
```

## Commands

| Action | Command |
|---|---|
| Run the game | `python -m http.server 8765 --bind 127.0.0.1` in the repo root → http://127.0.0.1:8765 (loopback only, never 0.0.0.0) |
| Run all tests | `node tests/smoke.mjs` (~111 stages; must end `ALL SMOKE TESTS PASSED`) |
| Run pacing probes | the 9 probes: `node tests/{pace,humance,bosspace,reedspace,wardpace,blackpace,umbrapace,ngpace,wandpace}.mjs` — every one must stay IN band |
| Run balance telemetry | `node tests/balance.mjs` (v1.10 M1 baseline; re-run after B1–B4 for the deltas) |
| Run dev checks | `node tests/sfx.mjs` / `tests/music.mjs` / `tests/ui.mjs`; `node tests/frames.mjs` (dev-only playwright-core, free port) |
| Check state | `git status --short`, `git log --oneline -8`, read `PROJECT_STATE.md` |

## Working conventions

- **Workflow:** WORK → TEST → UPDATE PROJECT_STATE.md → COMMIT → CONTINUE.
  A checkpoint is never a stopping point during an active goal.
- **Commits:** one coherent conventional-commit per milestone/fix
  (`feat:`, `fix:`, `balance:`, `polish:`, `docs:`). Never bundle unrelated
  changes.
- **Never discard uncommitted user work.** Check `git status` before any
  destructive-looking operation; stage only what you changed.
- **Pure logic stays pure:** balance, save migration, economy, and boss rules
  live in `src/logic.js` so tests can import them without a browser. Don't push
  rule logic into `game.js`.
- **No new dependencies.** If you reach for npm/pip/a framework, stop and
  reconsider; the project's constraint is zero *runtime* dependencies by
  design. (Dev-only test tooling like playwright-core is sanctioned and
  gitignored — see `tests/frames.mjs`.)
- **Performance:** avoid uncontrolled allocations/particles/persistent paint
  data; the game must hold 60fps on an ordinary modern browser (the C-series
  repair items keep the worst-case frame in budget).
- **Balance changes** get a short entry in `PROJECT_STATE.md` with the
  before/after numbers and the reason. In v1.10, re-run `tests/balance.mjs`
  before/after to show the deltas against the M1 baseline.
- **Every feature/fix ships with a smoke-test stage or assertion** where
  practical; the smoke suite is the project's only CI.

## The v1.10 contract (was byte-identity)

v1.6–v1.9 gated on **byte-identity**: `logic.js` untouched, so tuning stayed
frozen and the probes were pure regression checks. v1.10 "The Tuned Swamp" is
the first retune pass — `src/logic.js` tuning numbers **may** now legitimately
change. It instead gates on:

1. **All 9 pacing probes stay IN band** — the bands are the contract; a retune
   may make runs *better*, never out-of-band.
2. **The M1 balance targets are met** (per `tests/balance.mjs`): the flagged
   imbalances (TTK spread, zone-pressure curve, charged-splash value, pigment
   economy) are fixed and the re-run shows the deltas.
3. **Smoke stays green after every commit** (`ALL SMOKE TESTS PASSED`).

`SAVE_VERSION` still stays at 12 and `GAME_VERSION` at 1.0.0 (a retune is not
a save-migration or a version bump). See `docs/ROADMAP.md` §v1.10 for the
M1 → B1–B4 → C1–C4 → D1–D2 → E1 plan.

## Definition of done (per work item)

1. Implemented in the codebase, not just documented.
2. Verified by a passing test, probe, or documented manual check.
3. `PROJECT_STATE.md` updated (what changed, why, numbers).
4. Committed with a clear message.
5. No regressions: full smoke suite green + probes in band.

## Release Definition of Done

All 12 items in MISSION.md — verified satisfied in the 2026-09-05 final
audit (the 1.0.0 release). Active scope now lives in `docs/ROADMAP.md`
(v1.10 "The Tuned Swamp").

## Boundaries

- Loopback-only server, browser-local data. No cloud LLM APIs, no remote
  services, no external accounts.
- Use `uv` for any Python environment work; never `pip` directly.
- Docs: keep `PROJECT_STATE.md` current, `SYSTEM_CHANGES.md` for
  environment changes, `CLEANUP.md` accurate.