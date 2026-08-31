# Project State

_Last verified: 2026-08-30, end of M1 checkpoint. `node tests/smoke.mjs` = ALL 6 STAGES PASSED. `node --check` clean on every module._

## Current Status

Frogue Gallery is now a **bootable, playable vertical slice** (M1 complete). The full
expedition loop works and is verified end-to-end by the headless smoke test:

title → expedition → directional swipe combat → charged splash → pigment orbs →
wave spawning → Great Gray Heron boss (3 phases) → victory flight / defeat →
end screen with bank gains → back to title. Painting restores swamp color
(the core fantasy), and save persistence round-trips through localStorage.

The Atelier (M2) — spending banked pigments on upgrades/paintings between runs —
is the next milestone and is **not yet built**. The save schema and
`canAfford`/`payCost` helpers in `src/logic.js` already support it.

## Current Milestone

M2 — Atelier: bank display, upgrade purchase (capacity/power/vitality),
painting ownership + two-slot loadout, wired between runs (end screen or
title → Atelier → expedition). Must use existing `logic.js` data
(`UPGRADES`, `PAINTINGS`, `canAfford`, `payCost`, `SaveSys`) without
rewriting M1 modules.

## Completed Milestones

- M0 — project-local Git repo, MISSION/PROJECT_STATE/RESUME/SYSTEM_CHANGES/CLEANUP docs,
  `docs/design.md`, pure rules `src/logic.js`, world gen `src/world.js`,
  math/input/UI/audio/particles modules (all committed).
- M1 — **playable vertical slice** (this checkpoint):
  - `src/game.js` — the orchestrator (was missing): main loop, camera, state
    machine (title/expedition/end + pause), wave spawning, combat wiring,
    boss presentation via `bossStep`, HUD (hearts, pigment slots, charge
    meter, boss bar, swamp-color meter, banners, off-screen boss arrow),
    title/pause/end screens with mouse + keyboard.
  - Core-fantasy wiring: every paint stroke accumulates `Paint.restoreAcc`,
    drained by the game into `world.restoreColor()`; boss paint also restores.
  - Bug fixes found & fixed this session: `world.js` ripples typo
    (`this.ripping`), `input.js` screen→world formula (old offset convention →
    mouse aiming was NaN), `mixColorHex`→`mixColor` typo, undefined `sat01`
    in HUD, `_updateBoss` early-returned at hp≤0 so the `defeated` event never
    fired (victory could not trigger), post-victory flight never stepped
    (expedition kept simulating).
  - `tests/smoke.mjs` — headless Node harness (stubbed DOM/canvas/rAF) driving
    the real `Game` class through all 6 stages above. Run: `node tests/smoke.mjs`.
  - Recovered the 5 interrupted-session files (`index.html`, `save.js`,
    `player.js`, `paint.js`, `enemies.js`) — reviewed, fixed, and committed.

## Known Bugs / Open Items

- No `README.md` yet (final-deliverable requirement).
- Atelier missing (M2). No upgrade spending, no painting ownership UI.
- Balance unverified at scale (M5): tuning values are first-pass.
- `bestRun` in the save schema is unused (reserved).
- No `package.json`; tests run via plain `node tests/smoke.mjs`.
- Mouse-driven UI is click-only (no hover cursor changes on canvas); acceptable
  for now.

## Latest Test Status

2026-08-30: `node --check` clean on all 12 `src/*.js`. `node tests/smoke.mjs`
passes all 6 stages (boot/title, expedition start, directional swipe combat +
color restore, charged splash, boss→victory→stats, defeat→save persist).
Browser boot verified in desktop preview pane (no fallback/crash).

## Important Files

- `MISSION.md` — permanent requirements and autonomous-work rules.
- `PROJECT_STATE.md` — this file.
- `RESUME_HERMES.md` — fresh-session recovery prompt.
- `docs/design.md` — gameplay decisions.
- `src/logic.js` — pure rules, tuning, `UPGRADES`, `PAINTINGS`, boss AI, save
  schema, `canAfford`/`payCost` (M2's data layer).
- `src/game.js` — orchestrator; states, HUD, screens, boss presentation.
- `src/world.js`, `src/player.js`, `src/paint.js`, `src/enemies.js`,
  `src/save.js`, `src/input.js`, `src/audio.js`, `src/particles.js`,
  `src/ui.js`, `src/math.js` — subsystem modules.
- `index.html` — entry point (`new Game(canvas); game.start();`).
- `tests/smoke.mjs` — headless end-to-end smoke test.

## Immediate Next Action

Build the Atelier (M2): a `src/atelier.js` module with paper-panel UI over the
existing save data — bank totals, three upgrade rows with costs, painting
shelf (owned/available), two loadout slots — entered from the title screen and
after each run's end screen. Wire purchases through `canAfford`/`payCost` +
`SaveSys.save()`. Verify with a new smoke-test stage (purchase, loadout,
re-enter expedition), then update this file and commit.