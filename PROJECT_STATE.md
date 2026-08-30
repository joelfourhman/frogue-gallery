# Project State

## Current Status

Frogue Gallery is an early, partially integrated browser-game implementation. The repository has one committed foundation milestone and five untracked files left by the interrupted Hermes session. Preserve and review that untracked work; it is not disposable.

The game does not currently boot: `index.html` imports `src/game.js`, which does not exist. No claim of a playable loop is currently supported.

## Current Milestone

Integrate the existing subsystems into the first bootable vertical slice without restarting or rewriting completed foundation work.

## Completed Milestones

- Initialized the project-local Git repository, environment documentation, and cleanup documentation.
- Committed pure gameplay rules and tuning in `src/logic.js`.
- Committed world generation and environmental paint interactions in `src/world.js`.
- Committed shared math, input, UI, audio, and particle modules.
- Documented the initial pigments, enemies, paintings, economy, and Great Gray Heron design in `docs/design.md`.
- Drafted but did not commit `index.html`, `src/player.js`, `src/paint.js`, `src/enemies.js`, and `src/save.js` during the interrupted session.

## Next Milestones

1. Review the untracked modules against `MISSION.md`, then implement `src/game.js` to wire only the smallest bootable title/game shell.
2. Perform a browser boot smoke test and fix integration errors without expanding scope.
3. Add focused tests for pure logic and save migration; commit the recovered vertical-slice foundation.
4. Build the playable Atelier and expedition loop in bounded slices.
5. Integrate enemy encounters, pigment collection, death/return, paintings, and progression.
6. Integrate and balance the Great Gray Heron, victory, persistence, and final polish.

## Important Design Decisions

- Vanilla HTML/CSS/JavaScript with Canvas 2D and browser APIs; no framework is currently required.
- Painting is combat and world interaction, not cosmetic projectile tinting.
- Red emphasizes damage/burning, blue control/freezing, and green growth/rooting/sustain.
- Pure rules belong in `src/logic.js` so they can be tested separately from rendering.
- Paintings are a limited two-slot build system; progression uses banked pigments.
- The repository, this state file, and Git replace long conversational memory.

## Important Files

- `MISSION.md` — permanent requirements and autonomous-work rules.
- `PROJECT_STATE.md` — current recovery and continuation state.
- `RESUME_HERMES.md` — small prompt for a fresh Hermes conversation.
- `docs/design.md` — detailed gameplay decisions already made.
- `src/logic.js` — pure rules, tuning, boss logic, paintings, and save schema.
- `src/world.js` — world and environmental painting behavior.
- `index.html` — untracked browser entry point; currently imports missing `src/game.js`.
- `src/player.js`, `src/paint.js`, `src/enemies.js`, `src/save.js` — untracked interrupted-session work requiring review, not deletion.

## Known Bugs

- `src/game.js` is missing, so the browser entry point cannot boot.
- There is no integrated title screen, Atelier, expedition controller, boss presentation, or complete game-state loop yet.
- The `tests/` directory is empty.
- `README.md` does not yet exist.
- The five interrupted-session implementation files are untracked and therefore not protected by a commit.

## Latest Test Status

On 2026-08-30, syntax checks passed for `src/logic.js`, `src/world.js`, `src/player.js`, `src/paint.js`, `src/enemies.js`, and `src/save.js` using the existing Hermes-bundled Node runtime in module mode. No gameplay, browser, or automated test suite passed because `src/game.js` is missing and `tests/` is empty.

## Environment Status

- Development is contained in this repository.
- Existing user-level Python, uv, Node, Hermes, NInfer, and Qwen installations must not be modified.
- Any development server must bind to `127.0.0.1` only and be stopped after testing.
- `SYSTEM_CHANGES.md` and `CLEANUP.md` describe the project-local environment and reversal steps.

## Immediate Next Action

Read `MISSION.md`, inspect `git status`, and review only the five untracked implementation files plus their direct committed dependencies. Then create the smallest `src/game.js` integration needed to boot `index.html`, run a focused browser smoke test, update this state file with verified results, and commit the coherent recovery milestone. Continue immediately to the next incomplete Definition of Done item during an active `/goal`; the checkpoint is not a stopping point.
