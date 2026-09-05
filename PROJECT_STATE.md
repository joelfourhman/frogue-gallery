# Project State

_Last verified: 2026-09-05, P3 (atelier onboarding). `node tests/smoke.mjs` = ALL 13 STAGES / 96 ASSERTIONS PASSED. `node --check` clean on every module. P1–P3 all committed (see git log)._

## Current Status

Frogue Gallery is a **balanced, feature-complete cozy action roguelite** — the full Definition of Done is satisfied (M1–M6, final sweep done):

- **Core fantasy**: paint with 3 pigments (red damages, blue slows/freezes, green heals/restores world color). Every stroke literally restores color to the swamp.
- **Run loop** (verified by smoke test): title → expedition (waves, swipe + charged-splash combat, orb collection) → boss (Great Gray Heron: 3-hue awaken cycle, 2× paint damage while shimmering) → victory/defeat end screen → **Atelier** (shop) → next run.
- **Between-run economy** (M2): bank pigments, 9 upgrades, 8 paintings (2-slot loadout), persisted via localStorage.
- **Balance** (M3): 7 HP frog, ~2-hits-to-kill enemies, boss 1600 HP ≈ 2.1 awaken cycles, green heal 1.0 HP/s on thick moss.
- **Meta/charm** (M4): best-run record (title + end screens), M-mute (persisted), **Croaksworth story beat** (portrait unseals after first victory; buying it triggers his thanks + silver coin +5/each pigment).
- **Pause** (P/Esc) works; audio unlock on first gesture; banners for story beats.
- **New-player guidance** (P1): staged 5-step first-run tutorial (one banner at a time, timed), one-time contextual tips (first hit / first orb / first atelier / first defeat), pigment roles stated on the title card, banners render on all screens.

## File Map (all under `frogue-gallery/`)

| File | Role |
|---|---|
| `index.html` | Canvas 1280×800, boot: `new Game(canvas).start()` |
| `src/game.js` (~1500 lines) | **The orchestrator.** State machine (title/expedition/atelier/end/pause), rAF loop, camera, HUD, boss dir, atelier UI, end/title screens, M4 meta features |
| `src/logic.js` | Pure game logic: tuning, UPGRADES, PAINTINGS, bossStep, bankGain, paintDamage (2× awakened), canAfford/payCost/costArray |
| `src/world.js` | Procedural swamp, splats, fire/reed growth, `restoreColor()` |
| `src/paint.js` | Brush: swipe fan, charged splash, `_bossPaint` (2× while awakened), restoreAcc |
| `src/player.js` | Frog: hop, iframes, green-heal tick (1.0× greenHeal), satchel stock (cosmetic) |
| `src/enemies.js` | beetle / mosquito / toad spawners + AI |
| `src/input.js` | Keys (kb/pressed), mouse→world via `setView` |
| `src/audio.js` | WebAudio synth SFX, `setMuted`/`setVolume` |
| `src/particles.js`, `src/ui.js`, `src/math.js` | FX, paper-UI helpers, math |
| `src/save.js` | SaveSys: save/options (localStorage, try/catch) |
| `tests/smoke.mjs` | **Headless runtime test — 13 stages, all passing.** Real `Game` class, stubbed canvas/localStorage/AudioContext, synthetic keys/mouse |
| `PROJECT_STATE.md` | This file (recovery memory) |
| `SYSTEM_CHANGES.md`, `CLEANUP.md` | System-change + cleanup records for the final report |

## Architecture Notes (for a fresh session)

- **Camera contract**: `view = {x, y, scale, w, h}`; `x,y` = world coords of screen TOP-LEFT. `input.update()` converts mouse screen px → world via `mouse.x / v.scale + v.x`.
- **`game.js` orchestrates everything**; 12 subsystem modules are stable. Don't restructure.
- **Atelier layout = single source of truth**: `_atelierGeom()` feeds both `_drawAtelier` and `_atelierRows()` (click map with `tag` fields: `tab0/1`, `buy:<id>`, `paint:<id>`, `hang:<id>`, `depart`, `leave`). If you change layout, change `_atelierGeom` only.
- **`_ptLocked(pt)`**: Croaksworth portrait sealed until `flags.heronDefeated`. All atelier lock checks route through it.
- **Best run** (`save.bestRun = {pigments, time, cleared}`): cleared victory with more pigments beats everything; else longer un-cleared run.
- **Mute**: `game._muteToggle()` — M key on title + end; persisted via `SaveSys.saveOptions`.
- **`bossStep`** (logic.js) is a pure state machine; game.js consumes its events (`sweep`, `slam`, `landing`, `lunge-start`, `summon`, `phase2/3`, `defeated`). It MUST run even at `hp <= 0` so `defeated` can fire.
- **Test harness**: `tests/smoke.mjs` — `fireKey` is a proper tap (keydown+keyup); `fireMouse` dispatches mousedown/mouseup on the canvas stub. Enemies get pinned/cleared between stages to isolate assertions.
- **Verification channels**: `node tests/smoke.mjs` (authoritative) + `node --check`. `browser_exec` is dead (Chrome popup never surfaced); `desktop_preview` exists but the canvas has no accessible elements for visual driving.
- **Environment**: Node v22, Python 3.11.16, Windows 11, git-bash. Personal PC — no elevation, nothing outside `frogue-gallery/`.
- **Patching gotcha**: the `patch` tool's fuzzy matcher has mangled indentation in `game.js` several times — always `node --check` after, and for multi-line structural edits prefer the Python-splice pattern (write a .py that asserts `s.count(old) == 1` then `s.replace(old, new, 1)`).

## Milestones

- **M1** ✅ Playable vertical slice (orchestrator, HUD, boss, smoke test) — commit `4fa45d9`+
- **M2** ✅ Atelier between-run economy — committed
- **M3** ✅ Balance pass (2× awakened, HP/dmg rebalance, 1600 HP boss) — committed
- **M4** ✅ Croaksworth story beat + best-run tracking + M-mute — committed
- **M5** ✅ Polish: low-HP vignette (pulsing red at ≤2 HP), real pause menu (Resume / Quit buttons + M-mute; pause input now lives in the frame router since `_updateExpedition` is skipped while paused), first-run intro banners (`flags.intro`), dead HUD code removed
- **M6** ✅ Final Definition-of-Done sweep + erase-save UI (two-click confirm, title bottom-left) + final report
- **Post-M6** ✅ Shape fix: paper panels/buttons were drawn as giant wobbly *circles* (`traceBlob` radius `max(w,h)·0.62`) — now `traceWobblyRect` (math.js); button labels centered. Fixed the title-screen overlap.
- **Post-M6 (P1)** ✅ New-player guidance: staged first-run tutorial (5 timed single-step banners), one-time contextual teaching banners (first hit, first orb, first atelier visit, first defeat, heron-reveal wording), improved title-card rows (pigment roles explicit), banners now render on every screen (was expedition/end only — title "save erased" banner was invisible), first-run heron reveal delayed to 6.5s. New save flags: `firstOrb/firstHurt/firstAtelier/firstDefeat` (merged via `migrateSave`).
- **Post-M6 (P2)** ✅ Juice: floating pigment-colored damage numbers on every paint hit (enemies + heron, showing true 2× awakened values), orb-pickup "+N" text, off-screen enemy edge arrows (tinted when the enemy is currently painted; heron keeps its own arrow), note cap 14→24.
- **Post-M6 (P3)** ✅ Atelier onboarding: first-visit "Welcome to the Atelier" paper panel (gated by `firstAtelier`, any tab/buy/action dismisses it, drawn above the shelves), persistent one-line legends under each tab (upgrades = permanent training paid in pigments; paintings = buy once, hang up to 2, real passives).
- **Next (P4)**: balance re-pass for new players who now understand green = heal; simulated fresh-save run; docs + final commit