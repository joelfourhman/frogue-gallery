# Frogue Gallery — v1.1 execution plan (next actions)

**Authored:** 2026-09-05 by Joel's Hermes (default profile), on behalf of
frogue-gallery-pm. This is the pick-up brief: the PM agent reads this first.

## Context (why we're here)

- Release shipped 2026-09-05 (DoD 12/12). v1.1 is the post-release pass.
- M7 bug fixes: **B1 ✅, B2 ✅, B3 ✅, B4 ✅**, **B6 ✅ (this pass)**, **B5 ⬜**.
- M7.5 playtest pass: **PT5 ✅ (this pass)**, PT1–PT4 ⬜ (need a browser).
- M8 (P6–P12): ⬜ untouched, runs after M7 + M7.5 close.
- Working tree had one uncommitted in-flight change (`src/world.js`) —
  that was the PT5 fix. It is now verified and committed by this pass.

## What this pass shipped (done, committed)

1. **PT5 — grey box in the swamp (rendering artifact).**
   Root cause: `world.drawBackground/drawProps/drawObstacles` each applied a
   **second** camera transform (`beginTransform(view)`) on top of the one the
   render loop already applies in `game._drawAll` (`translate+scale`, wrapped
   in one save/restore). The double transform pushed the terrain off-screen;
   the cream page behind the canvas showed through = the "box".
   Fix: removed the per-function transforms so all three are consistent with
   `drawEnemy` / `player.draw` / `_drawOrbs`, which already rely on the single
   loop-level transform. Smoke green (18 stages).
2. **B6 — save schema versioning (foundation for B5).**
   - `src/logic.js`: `SAVE_VERSION = 1`; the save field is now the explicit
     `saveVersion` (accepts legacy `v` on load, so existing saves migrate);
     `freshSave().saveVersion = 1`; `migrateSave` coerces either key and
     stamps the current version, with a `_migrateToVersion(v)` chain point
     documented for the next schema bump.
   - `tests/smoke.mjs`: new **stage 19** — save carries `saveVersion: 1`;
     a legacy v0 blob (no `saveVersion`) migrates and is re-stamped to 1
     through `SaveSys.load()`; the version stamp never breaks a round-trip.

## What the PM picks up next (in order)

1. **B5 — localStorage unavailable → in-memory fallback + one-time notice.**
   B6's versioned schema is the substrate: the fallback store must persist the
   same `saveVersion`-stamped blob so an upgraded browser can adopt it if
   storage ever comes back. Scope:
   - Detect storage unavailability at boot (probe `setItem` in a try/catch;
     private-mode / quota / disabled-storage all read the same way).
   - Fall back to an in-memory store for the same `SAVE_KEY`/`OPTIONS_KEY`
     shape; surface a **one-time** notice ("save won't persist this session")
     via the existing banner system — no per-frame spam.
   - `SaveSys.load/save/erase/hasSave` must be storage-agnostic (they already
     call `localStorage.*` directly; introduce a thin storage shim that
     `SaveSys` calls instead, selected at boot).
   - Test: smoke stage that swaps the global `localStorage` stub for a throwing
     one before `Game.start()` and proves (a) boot doesn't crash, (b) the game
     still runs a full title→expedition→end cycle, (c) the notice fired once.
   - Acceptance: no Normal-difficulty behavior change; suite green; docs.
2. **M7.5 — PT1–PT4 playtest feedback pass** (user-reported, needs the browser).
   The in-repo `tests/headless.mjs` driver (headless Chrome via playwright-core,
   loopback :8901) is the intended tool:
   - **PT1 painting consumption** — verify painting effects actually consume
     cost/rate; fix if effects are free. Log before/after numbers.
   - **PT2 onboarding** — tighten/clarify the first-run flow; audit with the
     `onb` scenario (title + first-run banners).
   - **PT3 fly fairness** — the fly mechanic is judged unfair; audit the
     cost/range/stamina, rebalance, log before/after in PROJECT_STATE.md.
   - **PT4 early-economy safety net** — new players can soft-lock the bank
     early; add a floor (e.g. a guaranteed starting orb / minimum bankGain)
     and prove a fresh save can always afford at least one upgrade or painting.
   Each item: fix + a test or documented manual check; Normal baseline
   preserved; PROJECT_STATE.md before/after logs.
3. **M8 — P6–P12 player-facing improvements** (only after M7 + M7.5 close).
   Order of value: **P10 performance** (cull off-screen AI, hold 60fps across
   the 5400px world — unblocks everything else feeling smooth) → **P12 zone
   character** (accent + signature encounter per zone — high juice/value) →
   **P7 difficulty select** → **P8 gallery wall** → **P6 `?` overlay** →
   **P9 audio/options polish** → **P11 human-pace probe** (instrumentation).

## Rules of engagement (carried from PROJECT_STATE.md / AGENTS.md)

- Zero dependencies, no build step, vanilla JS + Canvas 2D + Web Audio.
- Loopback-only (127.0.0.1). Tests may use dev-only tooling (playwright-core,
  gitignored) — nothing ships in the game.
- Keep `src/game.js` thin: new screens stay small, logic in `src/logic.js`.
- Each milestone: implement → `node tests/smoke.mjs` (ALL PASSED) →
  update `PROJECT_STATE.md` + `docs/PROJECT_STATUS.md` → conventional commit
  (one per milestone) → continue. Never discard uncommitted user work.
- Normal-difficulty balance is the baseline; log any number that moves.
- Use `uv` for Python; never pip.
