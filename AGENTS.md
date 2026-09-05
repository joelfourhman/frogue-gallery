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
src/enemies.js      3 archetypes (beetle/mosquito/toad) + heron boss
src/logic.js        PURE rule logic: save schema, migrations, balance,
                    economy, pacing. No browser APIs — importable by tests.
src/save.js         thin localStorage adapter over the logic.js schema
src/world.js        5400px swamp: 4 zones, checkpoints, pigments, decor
src/paint.js        wet-paint brush physics + status fields
src/particles.js    splash/ink particle system
src/ui.js           paper-styled canvas UI primitives
src/audio.js        Web Audio synth: SFX + ambient (no audio files)
src/math.js         vector/geometry/wobbly-shape helpers
src/input.js        keyboard + mouse capture
tests/smoke.mjs     16-stage headless suite (ALL SMOKE TESTS PASSED = green)
tests/pace.mjs      full-run pacing probe (headless)
tests/bosspace.mjs  boss-fight pacing probe (headless)
docs/design.md      design pillars and mechanics
docs/ROADMAP.md     milestones (release + v1.1)
docs/DECISIONS.md   consequential decisions log
docs/PROJECT_STATUS.md   current milestone, bugs, debt, risks
```

## Commands

| Action | Command |
|---|---|
| Run the game | `python -m http.server 8765 --bind 127.0.0.1` in the repo root → http://127.0.0.1:8765 (loopback only, never 0.0.0.0) |
| Run all tests | `node tests/smoke.mjs` (16 stages; must end `ALL SMOKE TESTS PASSED`) |
| Run pacing probes | `node tests/pace.mjs` and `node tests/bosspace.mjs` |
| Check state | `git status --short`, `git log --oneline -8`, read `PROJECT_STATE.md` |

## Working conventions

- **Workflow:** WORK → TEST → UPDATE PROJECT_STATE.md → COMMIT → CONTINUE.
  A checkpoint is never a stopping point during an active goal.
- **Commits:** one coherent conventional-commit per milestone/fix
  (`feat:`, `fix:`, `balance:`, `polish:`). Never bundle unrelated changes.
- **Never discard uncommitted user work.** Check `git status` before any
  destructive-looking operation; stage only what you changed.
- **Pure logic stays pure:** balance, save migration, and economy rules live
  in `src/logic.js` so tests can import them without a browser. Don't push
  rule logic into `game.js`.
- **No new dependencies.** If you reach for npm/pip/a framework, stop and
  reconsider; the project's constraint is zero dependencies by design.
- **Performance:** avoid uncontrolled allocations/particles/persistent paint
  data; the game must hold 60fps on an ordinary modern browser.
- **Balance changes** get a short entry in `PROJECT_STATE.md` with the
  before/after numbers and the reason.
- **Every feature/fix ships with a smoke-test stage or assertion** where
  practical; the smoke suite is the project's only CI.

## Definition of done (per work item)

1. Implemented in the codebase, not just documented.
2. Verified by a passing test, probe, or documented manual check.
3. `PROJECT_STATE.md` updated (what changed, why, numbers).
4. Committed with a clear message.
5. No regressions: full smoke suite green.

## Release Definition of Done

All 12 items in MISSION.md — verified satisfied in the 2026-09-05 final
audit. Active scope now lives in `docs/ROADMAP.md` (v1.1).

## Boundaries

- Loopback-only server, browser-local data. No cloud LLM APIs, no remote
  services, no external accounts.
- Use `uv` for any Python environment work; never `pip` directly.
- Docs: keep `PROJECT_STATE.md` current, `SYSTEM_CHANGES.md` for
  environment changes, `CLEANUP.md` accurate.
