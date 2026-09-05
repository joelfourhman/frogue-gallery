# Project State

_Pm note (2026-09-05):_ this file is the live next-action tracker (kept per
project convention). The concise PM overview is `docs/PROJECT_STATUS.md`;
milestones in `docs/ROADMAP.md`; decisions in `docs/DECISIONS.md`; durable
agent instructions in `AGENTS.md`.

_Last verified: 2026-09-05, final DoD audit sweep (items 1–12). `node tests/smoke.mjs` = ALL 16 STAGES PASSED (118 assertions). Pacing probes: `tests/pace.mjs` lower-bound 1.3 min / competent-player ≈17 min (DoD #9 target 15–20); `tests/bosspace.mjs` real heron fight 36.8s bot / ~1–2.3 min human. DoD #1: HTTP 200 on the documented 8765 loopback launch. DoD #2: title now labels the start button "Continue Expedition" when a save has progress (else "Begin Expedition"), footer explains New Game = erase-save link; stage 16 asserts it. DoD #11: stage 15 focused migration/failure tests (corrupt JSON, old-schema saves, options clamping). DoD #12: SYSTEM_CHANGES.md launch workflow + 8765 port corrected, CLEANUP.md accurate. All P1–P5 committed (see git log). **Definition of Done: all 12 items satisfied.**_

## Current Status

Frogue Gallery is a **balanced, feature-complete cozy action roguelite** — the full Definition of Done is satisfied (M1–M6, final sweep done):

- **Core fantasy**: paint with 3 pigments (red damages, blue slows/freezes, green heals/restores world color). Every stroke literally restores color to the swamp.
- **Run loop** (verified by smoke test): title → expedition (waves, swipe + charged-splash combat, orb collection) → boss (Great Gray Heron: 3-hue awaken cycle, 2× paint damage while shimmering) → victory/defeat end screen → **Atelier** (shop) → next run.
- **Between-run economy** (M2): bank pigments, 9 upgrades, 8 paintings (2-slot loadout), persisted via localStorage.
- **Balance** (M3 + P4 + P5): 10 HP frog, ~2-hits-to-kill enemies, heron 30000 HP (~2.3 min human fight, ~37s ceiling bot), green heal 3 HP/paint-tick on thick moss (P4: maxHp 7→10, beetle/toad contact dmg 8/9→6 — before P4 a single beetle hit *one-shot* a first-time player at 7 HP before they learned green heals).
- **Run structure** (P5, DoD #9): world 5400px (was 2400), heron at the world edge, **4 named expedition zones** (Reed Flats → Slick Hollow → Bramble Thicket → The Gray Shore) each with an entry banner, a staged combat beat, and a rest checkpoint (green heal pool + orbs). Pacing: lower-bound (god-mode) 1.3 min; competent player ≈ 17 min — inside the 15–20 min target. Probes: `tests/pace.mjs` (lower-bound + human model) and `tests/bosspace.mjs` (real pigment-cycling bot fight).
- **Meta/charm** (M4): best-run record (title + end screens), M-mute (persisted), **Croaksworth story beat** (portrait unseals after first victory; buying it triggers his thanks + silver coin +5/each pigment).
- **Pause** (P/Esc) works; audio unlock on first gesture; banners for story beats.
- **New-player guidance** (P1): staged 5-step first-run tutorial (one banner at a time, timed), one-time contextual tips (first hit / first orb / first atelier / first defeat), pigment roles stated on the title card, banners render on all screens.

## File Map (all under `frogue-gallery/`)

| File | Role |
|---|---|
| `index.html` | Canvas 1280×800, boot: `new Game(canvas).start()` |
| `src/game.js` (~1500 lines) | **The orchestrator.** State machine (title/expedition/atelier/end/pause), rAF loop, camera, HUD, boss dir, atelier UI, end/title screens, M4 meta features |
| `src/logic.js` | Pure game logic: tuning, UPGRADES, PAINTINGS, bossStep, bankGain, paintDamage (2× awakened), canAfford/payCost/costArray |
| `src/world.js` | Procedural swamp (5400px, density scales with width), splats, fire/reed growth, `restoreColor()`, lily-pad corridor + rest spots |
| `src/paint.js` | Brush: swipe fan, charged splash, `_bossPaint` (2× while awakened), restoreAcc |
| `src/player.js` | Frog: hop, iframes, green-heal tick (3× greenHeal), satchel stock (cosmetic) |
| `src/enemies.js` | beetle / mosquito / toad spawners + AI |
| `src/input.js` | Keys (kb/pressed), mouse→world via `setView` |
| `src/audio.js` | WebAudio synth SFX, `setMuted`/`setVolume` |
| `src/particles.js`, `src/ui.js`, `src/math.js` | FX, paper-UI helpers, math |
| `src/save.js` | SaveSys: save/options (localStorage, try/catch) |
| `tests/smoke.mjs` | **Headless runtime test — 16 stages, all passing (118 assertions).** Real `Game` class, stubbed canvas/localStorage/AudioContext, synthetic keys/mouse |
| `tests/pace.mjs`, `tests/bosspace.mjs` | **Pacing probes (informational, not assertions).** Lower-bound run length + human model; real pigment-cycling heron fight timing |
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
- **Post-M6 (P4)** ✅ Balance re-pass for the now-taught first-time player: maxHp 7→10, beetle/toad contact dmg 8/9→6 (no more one-shot by the first beetle), greenHeal 1→3 per paint tick (meaningful early, still slow vs a full pool).
- **Post-M6 (P5)** ✅ Run pacing (DoD #9): world widened 2400→5400px (decoration density scales with width, pads cover the full corridor, heron relocated to `world.w - 350`); 4 named expedition zones with entry banners, staged combat beats (escalating beetle→mosquito→toad compositions), and rest checkpoints (thick green heal paint + pigment orbs); bossMaxHp 2200→30000 so the heron is a real fight (~2.3 min human, ~37s ceiling bot). Two headless pacing probes added (`pace.mjs`, `bosspace.mjs`); smoke stage 14 (14 stages total).
- **Next / status**: **Definition of Done (all 12 items) satisfied** as of the final audit sweep — boot (#1, HTTP 200 documented launch), Continue/New Game/Erase (#2, title affordance + two-click erase + auto-load), loop (#3), responsiveness (#4), pigment roles (#5), 3 enemy archetypes (#6), paintings loadout (#7), heron flows (#8), 15–20 min pacing (#9, pace.mjs), polish pass (#10, M5+P2), migration/logic tests (#11, stage 15), docs (#12). Original goal complete; project now runs on the **v1.1 plan** below.

## v1.1 Plan — Improvements & bug fixes (active, 2026-09-05)

Full spec lives in `MISSION.md` ("Post-release v1.1"). Working order:

**Track B first (cheap, de-risks everything), then Track A in order.**

| ID | Item | Status |
|---|---|---|
| B1 | Commit the uncommitted release-sweep work (game.js start-button fix, smoke stages 15–16, doc corrections) | ✅ 2026-09-05 — two commits (`fix: DoD #2 title affordance...`, `docs: v1.1 plan...`), tree clean |
| B2 | Corrupt-save handling: detect on load, "keep what we can" vs "start fresh", never crash boot | ⬜ |
| B3 | Dry-brush softlock audit: probe proving a pigment-starved frog can beat the heron | ⬜ |
| B4 | Tab-hidden time spike: verify dt cap / pause behavior on long hidden-tab gaps | ⬜ |
| B5 | Storage-failure fallback: localStorage unavailable → in-memory + one-time notice | ⬜ |
| B6 | Save schema versioning: `version` field on every write + migration smoke stage | ⬜ |
| P6 | In-game "?" reference overlay (pigment roles, counterplay, heron hint, controls) | ⬜ |
| P7 | Difficulty select (Easy/Normal/Hard, persisted; Normal = current balance) | ⬜ |
| P8 | The Gallery Wall — framed, titled owned paintings in the Atelier with passive tooltips | ⬜ |
| P9 | Audio/options polish: separate music/SFX sliders, screen-shake + vignette toggles | ⬜ |
| P10 | Performance pass: cull off-screen enemy AI/decoration updates; 60fps with full 5400px world | ⬜ |
| P11 | Human-pace pacing probe (≈260 px/s walker model) | ⬜ |
| P12 | Zone character: distinct visual accent + signature encounter motif per zone | ⬜ |

Optional (after all of the above is green): gold pigment, gamepad support, New Game+.

**v1.1 acceptance criteria** (see MISSION.md): every P/B item has a passing smoke stage or regression test; full suite green in one command; 15–20 min run target still holds on Normal; docs accurate; git clean with one conventional commit per chunk.

## Immediate Next Action

**B1:** from `frogue-gallery/`, run `node tests/smoke.mjs` to confirm 16 stages / 118 assertions still pass, then commit the working-tree changes (game.js, tests/smoke.mjs, PROJECT_STATE.md, SYSTEM_CHANGES.md) as `fix: release sweep — Continue/New Game start-button label, smoke stages 15–16, doc accuracy (DoD #2/#11/#12)`. Then start B2: implement corrupt-save handling in `src/save.js` (graceful detection + user choice), extend a smoke stage to drive it, update this file, commit. Continue through Track B → Track A without stopping at checkpoints.

## Known risks / open questions

- Smoke stage 16 asserts the title start-button label — P7 (difficulty select on title) will touch the same UI; update the stage when implementing.
- B5/B6 both touch `src/save.js`; do B6 (version field) before B5 (failure fallback) so the fallback path versions in-memory saves too.
- P10 culling must not change visible behavior — guard with an existing smoke stage plus a 60fps timing probe.
- `browser_exec` is still dead; visual verification (P8, P12, zone art) relies on `desktop_preview` or screenshots via the dev server.