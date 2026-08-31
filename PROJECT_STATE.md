# Project State

_Last verified: 2026-08-30, end of M3 checkpoint. `node tests/smoke.mjs` = ALL 8 STAGES PASSED. `node --check` clean on every module._

## Current Status

Frogue Gallery is a **balanced, playable vertical slice + between-run economy**:

- Boot → title → expedition → combat → charged splash → heron boss → victory end screen → **Atelier** → title → defeat run → save persistence. All driven by `tests/smoke.mjs` (real `Game` class, headless Node, no browser needed).
- The **Atelier** (M2) is the between-run hub: spend bank pigments on 3 upgrades (capacity/power/vitality, 3 levels each) and 8 paintings, choose a 2-slot loadout, watch the living swamp drift behind the UI. Reached from the title ("Visit the Atelier", A key) and from every end screen ("Rest at the Atelier", Enter/Space).

## M3 Balance Pass (this session)

Applied tuning changes, each verified by smoke test:

| knob | before | after | why |
|---|---|---|---|
| player `maxHp` | 5 | 7 | frog was a one-hit kill vs several enemies; cozy game needs 2+ hits of contact |
| beetle `dmg` | 9 | 8 | contact should survive ~2 hits now |
| toad `dmg` | 13 | 9 | was a near-instant kill |
| green-paint heal rate | `greenHeal*0.5`/s | `greenHeal`/s | "paint yourself into a heal" loop now actually meaningful |
| heron contact `dmg` | 12/10/13/8 | 9/8/9/6 | scaled with the new HP pool |
| heron slam/landing | 14/12 | 11/9 | kept harder than contact (telegraphed big hits) but survivable |
| **awakened 2x damage** | *(documented, never implemented)* | **now real** in `_bossPaint` | the shimmer window was doing normal damage; the boss design hinged on 2x |
| heron `bossMaxHp` | 520 | 1600 | with 2x real, 520 died in one window; 1600 → ~2 awaken cycles, the cozy range |

**Boss pacing model** (asserted in smoke test): 8 swipes/hue @ 0.2s → ~4.8s fill + 6s window, ~756 dmg/cycle → 1600 hp ≈ **2.1 cycles ≈ ~25s of pure painting**, more with dodging. Smoke test logs this math each run and asserts cycles stay in [1.5, 4].

## Verified This Session

- `node tests/smoke.mjs` — **ALL 8 STAGES PASSED** (boot, expedition, combat, splash, boss victory, 2x awakened damage + pacing assert, atelier loop, defeat/save).
- `node --check` on all 12 modules + smoke test — clean.
- HTTP 200 on `http://127.0.0.1:8765/index.html`.## Architecture Notes (for a fresh session)

- **`game.js` is the orchestrator.** All 12 subsystems + `index.html` are complete. It wires the rAF loop, state machine (`title` / `expedition` / `atelier` / `end`), HUD, camera, boss, and the between-run economy.
- **Camera/view contract:** `view = {x, y (world top-left), scale, w, h}`. `input.setView` + `input.update()` convert mouse screen-px → world via `mouse.x / v.scale + v.x`.
- **`_screenSpace()`** resets the canvas transform to identity before HUD/screen draws.
- **Atelier:** `_beginAtelier` / `_updateAtelier` / `_drawAtelier` / `_atelierRows` (the click map, each row has a `tag` for the smoke test) / `_drawPaintingMotif` (little canvas thumbnails). All draw AND click geometry derives from `_atelierGeom()` — one source of truth.
- **Data layer (`logic.js`):** `UPGRADES` (3×3 levels), `PAINTINGS` (8, one `locked`), `canAfford`/`payCost` take `{color,amount}[]` via `costArray` (returns objects, NOT tuples). `makeTuning(upgrades, loadout)` applies both.
- **`freshSave.flags`** already has `croaksworthAsked` / `croaksworthGiven` / `intro` / `heronDefeated` — story beats scaffolded, not yet triggered.
- **Economy:** painting never consumes stock; the swipe cooldown is the only rate-limit. `stock`/`capacity` pips are cosmetic (Satchel upgrade effectively cosmetic too — known limitation).

## Next Milestone

- **M4:** trigger the Croaksworth story beats (first heron-defeat → `croaksworthAsked`, offer the `croaksworth` painting → `croaksworthGiven` + unlock), record `bestRun` in `_endRun`, and add a mute toggle (audio already has `setMuted`).
- **M5:** polish — low-HP vignette, first-time intro banner, audio unlock on first input.
- **M6:** final Definition-of-Done sweep + concise final report.

## How to Launch

```
python -m http.server 8765 --bind 127.0.0.1   # (still running in this session)
# open http://127.0.0.1:8765/index.html
```
Test: `node tests/smoke.mjs`

## System Changes / Cleanup

No changes outside `frogue-gallery/`. Nothing installed system-wide. The only running process is the local HTTP server bound to 127.0.0.1.