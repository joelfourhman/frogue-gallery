# Project State

_Pm note (2026-09-05):_ this file is the live next-action tracker (kept per
project convention). The concise PM overview is `docs/PROJECT_STATUS.md`;
milestones in `docs/ROADMAP.md`; decisions in `docs/DECISIONS.md`; durable
agent instructions in `AGENTS.md`.

_Last verified: 2026-09-05. `node tests/smoke.mjs` = **ALL 29 STAGES PASSED** (…stage 29 = M8 P9 Options overlay). Pacing probes green: `pace.mjs` (analytic, human est. ~18.7 min) + **`humance.mjs` (P11, new — simulated imperfect human on the real sim: measured cross-swamp ~52s + measured heron ~134–166s → full-run 18.3–19.4 min across 4 seeds, in the 15–20 min target)** + `bosspace.mjs`. Real-browser probe (P9): audio buses + options overlay verified live. DoD: all 12 items satisfied. **v1.1 COMPLETE: B1–B6 ✅, M7.5 PT1–PT5 ✅, M8 P10/P12/P7/P8/P6/P9/P11 ✅.**_

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
| `tests/smoke.mjs` | **Headless runtime test — 29 stages, all passing.** Real `Game` class, stubbed canvas/localStorage/AudioContext, synthetic keys/mouse |
| `tests/pace.mjs`, `tests/bosspace.mjs`, `tests/humance.mjs` | **Pacing probes (informational, not assertions).** pace.mjs = analytic lower-bound + human model; bosspace.mjs = real pigment-cycling bot heron fight; humance.mjs (P11) = simulated imperfect human on the real sim (measured cross + boss) |
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
| B2 | Corrupt-save handling: detect on load, "keep what we can" vs "start fresh", never crash boot | ✅ 2026-09-05 — commit `14b50a3`: `migrateSave` merges recognizable fields (bank/owned/loadout/upgrades/flags/stats/bestRun) into a fresh schema, coerces/clips numbers, filters unknown painting ids; non-object or unrecognizable → pure fresh; unparseable → null (fresh boot). `_case` tag (migrated\|fresh) non-enumerable, never persisted. Smoke stage 17 (17 stages total). PM-verified: diff + full suite green. |
| B3 | Dry-brush softlock audit: prove a pigment-starved frog can still beat the heron | ✅ 2026-09-05 — commit `a32a721`: audit proves no softlock (dry never damages the heron by design; in-run wet pigment is unlimited; 30k-HP heron falls in bounded ~84 awaken cycles; heron damage-locked states are transient). Regression guard in smoke stage 17 (fails if a wet pigment goes to 0 dmg or awaken becomes unreachable). PM-verified: code claims confirmed + suite green. |
| B4 | Tab-hidden time spike: verify dt cap / pause behavior on long hidden-tab gaps | ✅ 2026-09-05 — commit `2ed1c9a`: dt cap (0.05s) holds; `last = t` uses the real timestamp so no catch-up spiral; all physics integrates on clamped dt (absolute `now` only for animation/status/UI timing). Smoke stage 18 injects a 300,000ms delta: wall clock jumps 30s, player/enemy motion bounded to one frame, no NaN, clean recovery. PM-verified. |
| B5 | Storage-failure fallback: localStorage unavailable → in-memory + one-time notice | ✅ 2026-09-05 — `src/save.js` in-memory fallback + `SaveSys.storageOK`; one-time banner in `game.js _beginExpedition`; smoke stage 20 (throwing localStorage). PM-verified. |
| B6 | Save schema versioning: `saveVersion` field on every write + migration chain + smoke stage | ✅ 2026-09-05 — commit `599a599`: `logic.js` `SAVE_VERSION = 1`, saves stamped `saveVersion` (legacy `v` field read + re-stamped on load), `SAVE_MIGRATIONS` ordered chain for future schema bumps. Smoke stage 19. PM-verified: diff + full suite green. |
| PT1 | Painting consumption: verify paint effects consume cost/rate (fix if free) | ✅ 2026-09-05 — audit: swipe/splash already rate-gated (swipeCd 0.2s, splash needs charge + 0.9s cd); in-run wet pigment unlimited by design (B3). No code change; regression guard added as smoke stage 21. |
| PT2 | Onboarding: tighten/clarify first-run flow | ✅ 2026-09-05 — first-run heron reveal deferred 6.5s → 38s so it lands after the 5-step tutorial (was mid-lesson); returning players unchanged (3.2s). Verified via headless `onb` scenario. |
| PT3 | Fly/dodge fairness: audit cost/range/stamina + rebalance | ✅ 2026-09-05 — Space-hop now has a `hopCooldown = 0.7s` stamina gate (was unlimited; i-frames 0.30s > 0.22s hop = near-continuous invuln when mashing). Hop i-frames/range unchanged. Smoke stage 22. |
| PT4 | Early-economy safety net: fresh save can afford ≥1 upgrade/painting | ✅ 2026-09-05 — one-time `WELCOME_GRANT = {red:3, blue:6, green:4}` (+13) on first expedition (pure `applyWelcomeGrant`, gated on `flags.welcomeGranted`). Fresh save now buys capacity/vitality lvl1 + moonlit-pond/self-portrait. Smoke stage 23. |
| P6 | In-game "?" reference overlay (pigment roles, counterplay, heron hint, controls) | ✅ 2026-09-05 — "Field Guide" overlay, H/? to toggle; pauses the run (frozen sim, verified: held W does not move the frog). Controls + keyed pigment swatches + Splash + heron telegraph counterplay; shared `_helpGeom()` for draw + click; fresh runs start closed. Smoke stage 28. |
| P7 | Difficulty select (Gentle/Normal/Bold, persisted; Normal = current balance) | ✅ 2026-09-05 — `logic.js` `applyDifficulty()` + `DIFFICULTIES` (Gentle 0.75× boss/dmg, Bold 1.35× boss/enemy/dmg, Normal identity); `options.difficulty` persisted; three pills on the title (G/N/B keys + click). |
| P8 | The Gallery Wall — framed, titled owned paintings in the Atelier with passive tooltips | ✅ 2026-09-05 — third Atelier tab "The Gallery" (key 3 / click): every painting hung in a gold frame; owned = lit full-color motif + title placard + passive bonus + "★ hung" when in loadout, unowned = dimmed silhouette, sealed = "???". Display-only (buying/hanging stays on the Paintings tab). Smoke stage 27. |
| P9 | Audio/options polish: separate music/SFX sliders, screen-shake + vignette toggles | ✅ 2026-09-05 — `logic.js` `freshOptions`/`migrateOptions` now carry `musicVol`/`sfxVol` (0..1, clamped; legacy `volume` seeds them) + `shake`/`vignette` toggles. `audio.js` splits the graph into `musicBus` (a new synthesized ambient bed: detuned-pair drone + slow LFO + filtered swish pad) and `sfxBus` (all SFX); `setMusicVolume`/`setSfxVolume` drive the buses independently. `game.js` adds an **Options overlay** (title, `O` or the "Options" button): master/music/SFX sliders (drag or click) + shake & vignette toggles + a live "Music/SFX off" note, all persisted via `SaveSys.saveOptions`. `input.js` gains a `dragging` slot for the sliders. Smoke stage 29 (layout, setters→bus gains, toggle round-trip, save→fresh-Game reload). |
| P10 | Performance pass: cull off-screen enemy AI/decoration updates; 60fps with full 5400px world | ✅ 2026-09-05 — `world.js` view-culls grass/ripples/soil/slicks/veg/reeds/pads/obstacles to the visible rect (draw calls 9527 full-world → ~1464 localized, 0.15×); `game.js` skips full enemy AI beyond 500px (burn still ticks). Smoke stage 24 + real-browser probe (60.2 fps across x=5%→95%). |
| P11 | Human-pace pacing probe (`tests/humance.mjs`, simulated human input) | ✅ 2026-09-05 — full-run 18.3–19.4 min across 4 seeds (15–20 min target) |
| P12 | Zone character: distinct visual accent + signature encounter motif per zone | ✅ 2026-09-05 — `game.js` `ZONES` now carry a per-zone `accent` + a `sig` signature encounter; `_zoneBeat` spawns an elite "signature guardian" (`_spawnZoneElite`, `ELITE = {hp:1.9, dmg:1.3, radius:1.35, score:3}`) of the zone's emblematic enemy, ringed in the zone accent (`enemies.js` drawEnemy scales the body to the elite hitbox + draws a pulsing accent halo) and sets a 2.6s fading zone-accent wash (`_drawZoneTint`) so crossing a boundary reads as a place-shift. Accents: Reed `#c9a94e`, Slick `#5a93c9`, Bramble `#7fb069`, Gray `#9a9a8f` (guards: Reed beetle×1, Slick mosquito×2, Bramble toad×1, Gray beetle×2 = 6 total). `pace.mjs` folds the 6 guardians into the human model (~18.7 min, inside target). Smoke stage 25. 60.5 fps real-browser (no JS errors). |

Optional (after all of the above is green): gold pigment, gamepad support, New Game+.

### Balance Log (M7.5 — before → after, 2026-09-05)

Normal-difficulty balance is the baseline; every number that moved is logged.

| Item | Knob | Before | After | Why |
|---|---|---|---|---|
| PT3 | `tuning.hopCooldown` (Space-hop stamina) | *none* (unlimited hops; effective i-frames 0.30s > 0.22s hop) | `0.7s` (≈1.4 hops/s) | Mashing Space chained into near-continuous invulnerability — the reported "unfair fly." A real dodge is preserved; spam is not. |
| PT3 | `tuning.hopIframes` | `0.18` (+0.12 = 0.30 effective) | unchanged | A single hop keeps its dodge value; only the repeat rate changed. |
| PT2 | `heron._intro` (first-run boss reveal) | `6.5s` (mid-tutorial) | `38s` (after 5-step tutorial, ~36s) | Newcomers met the boss before finishing the lesson. Returning players: `3.2s` unchanged. |
| PT4 | Fresh-save bank | `{red:0, blue:0, green:0}` | `{red:3, blue:6, green:4}` (one-time `WELCOME_GRANT`, +13) | Early death kept ~0 (`deathKeepFraction 0.5` floor) → soft-lock at the shop. Grant buys ≥1 upgrade and ≥1 painting. |
| PT1 | swipe/splash rate | `swipeCd 0.2s`, splash charge→`0.9s cd` | unchanged (verified, not free) | "Infinite wet" is the attack *rate* gate, already correct; no change. |

### Balance Log (M8 — before → after, 2026-09-05)

| Item | Knob | Before | After | Why |
|---|---|---|---|---|
| P12 | zone combat beat | named zone beat only (beetle/mosquito/toad `mix`) | + an elite **signature guardian** of the zone's emblematic enemy, `ELITE = {hp:1.9, dmg:1.3, radius:1.35, score:3}` (6 across the run) | v1.1 wanted each zone to have "character." An elite + a per-zone accent wash gives a memorable set-piece without a wall: 1.9× HP is a couple of swipes, and the pace probe still lands inside the 15–20 min target (~18.7 min). |
| P12 | zone entry cue | banner text only | + 2.6s fading full-screen zone-accent wash (`_drawZoneTint`), peak alpha 0.16 | A color shift on crossing a boundary reads as a place-shift, not just a new banner; kept subtle so it never obscures the world. |
| P7 | difficulty select | none (single Normal tuning) | 3 tiers via `applyDifficulty()`: **Gentle** bossHp 0.75 / dmgTaken 0.75, **Normal** identity, **Bold** bossHp 1.35 / enemyHp 1.35 / dmgTaken 1.3. Normal is byte-for-byte the released tuning (boss 30000). | v1.1 asked for an Easy/Normal/Hard select with Normal unchanged. Scaling boss HP + enemy HP + damage-taken (the three levers that change difficulty most, without touching paint/economy) keeps Normal the reference and gives a real range. |

**v1.1 acceptance criteria** (see MISSION.md): every P/B item has a passing smoke stage or regression test; full suite green in one command; 15–20 min run target still holds on Normal; docs accurate; git clean with one conventional commit per chunk.

## Immediate Next Action

**v1.1 is COMPLETE — nothing is left to do.** The working tree is clean and the
full v1.1 roadmap (M7 B1–B6, M7.5 PT1–PT5, M8 P10/P12/P7/P8/P6/P9/P11) is
committed and verified. Latest commits: v1.1 status-docs pass (`3c590be`),
M8 P10 (`5e95fbf`), P12 (`0ab27e8`), P7 (`7457229`), P8 (`4118146`), P6
(`27bdd22`), P9 (audio/options), and P11 (`tests/humance.mjs`, this pass).
Smoke: **29 stages green**; `pace.mjs` / `humance.mjs` / `bosspace.mjs` all run.

The two most recent passes, for the record:

**M8 P9 (audio/options polish) — implemented + tested.** The single
master volume is split into **independent music / SFX buses** and the title
gains an **Options** overlay (key `O` or the new "Options" button, right of
the Atelier button) with three sliders (Master / Music / SFX — click or drag)
and two accessibility toggles (Screen shake / Low-HP vignette). Concretely:

- `src/logic.js` — `freshOptions()` now returns `musicVol`/`sfxVol` (0–1) plus
  `shake`/`vignette` (both default `true`); `migrateOptions()` seeds the split
  volumes from the legacy `volume` when absent and clamps/normalizes all four.
- `src/audio.js` — the graph is split under `master` into `musicBus` and
  `sfxBus` (each a `GainNode`). A new **synthesized ambient bed** (`startMusic`
  / `stopMusic`) runs a detuned-pair drone + a slow LFO swell + a filtered
  swish pad through `musicBus`. All SFX now connect to `sfxBus`.
  `setMusicVolume` / `setSfxVolume` drive the two buses independently (the
  `muted` master still wins when on).
- `src/game.js` — the overlay (`_optionsLayout` / `_updateOptions` /
  `_drawOptions`, a shared `_drawSliderTrack`), the `O` key + title "Options"
  button, `shake` gating in `_view()`, `vignette` gating on the low-HP wash,
  and the options state resets on `_quitToTitle`.
- `src/input.js` — a `dragging` slot so a slider can be held and dragged.
- Smoke **stage 29** (layout present, setters drive the bus gains, toggle
  round-trips, save → fresh-Game reload) + real-browser verification (6
  ambient nodes, bus gains track the sliders, no JS errors).

**Next: v1.1 COMPLETE** — all of M7 (B1–B6), M7.5 (PT1–PT5), and M8 (P10, P12, P7, P8, P6, P9, P11) are done and committed. The final item, **P11 (human-pace pacing probe)**, is `tests/humance.mjs`: a god-mode simulation of an imperfect human on the real sim (burst/hesitate walk, Field-Guide zone reads, noisy aim, back-off on heron telegraphs) that *measures* the two tractable components — cross-swamp (~52s) and the heron fight (~134–166s) — and composes them with `pace.mjs`'s analytic wave-fighting. Full-run estimate **18.3–19.4 min across seeds 1337/7/42/2026**, in the 15–20 min target, and both measured components are more conservative than pace.mjs's flat multipliers (sim cross 52s vs analytic 38s; sim boss 134–166s vs analytic 136s), so the target holds. Smoke: 29 stages green; pace/humance/bosspace probes all run.

- (recorded) **PT1 — painting consumption (verified, no code change).** The plan flagged
  "painting might be free / infinite wet." Audit result: swipes and splashes
  are already rate-gated — `swipeCd = tuning.swipeCooldown (0.2s)` arms on every
  fire and blocks re-fire until it expires; the charged splash requires
  `splashCharge → 1.0` (a ~1.2s build) then a `splashCooldown (0.9s)` and fires
  only once. In-run wet pigment is intentionally unlimited (B3 design), so
  "consumption" = the attack *rate* gate, which holds. Smoke stage 21 asserts
  the swipe cooldown arms, re-fires are refused, and the swipe rate is bounded
  to ~floor(budget/cd) (10 in 2s @ 0.2s cd), and splash is refused at 0 charge.
- **PT2 — onboarding (first-run flow clarified).** The 5-step first-run
  tutorial runs to ~36s, but the Great Gray Heron boss reveal fired at 6.5s —
  mid-tutorial — so a newcomer met the boss before finishing the lesson.
  **Before:** `heron._intro = 6.5s` on first run. **After:** `heron._intro =
  38s` (just after the last tutorial step) on first run; returning players
  unchanged at 3.2s. Verified with the `onb` scenario: first-run banners now
  read the welcome-kit + movement lesson (no premature "THE GREAT GRAY HERON").
- **PT3 — fly/dodge fairness (rebalanced).** The Space-hop is the frog's only
  air-dodge. **Before:** no cooldown and effective i-frames
  (`hopIframes 0.18 + 0.12 = 0.30s`) exceeded the 0.22s hop duration, so
  mashing Space chained into near-continuous invulnerability. **After:** added a
  stamina cooldown `hopCooldown = 0.7s` that must expire before the next hop;
  hop i-frames and range are unchanged (a single hop is still a real dodge).
  The frog now dodges ~1.4×/s instead of unlimited. Smoke stage 22 asserts the
  cooldown arms, an immediate re-hop is refused, the timer counts down, and the
  hop re-arms once it expires.
- **PT4 — early-economy safety net (welcome grant).** A brand-new player who
  died early banked ~0 pigment (`deathKeepFraction 0.5`, `floor`) and could not
  afford anything — a soft-lock. **Before:** fresh bank {0,0,0}. **After:** a
  one-time `WELCOME_GRANT = {red:3, blue:6, green:4}` (+13 pigment) is granted
  on the first expedition (pure `applyWelcomeGrant` in logic.js, gated on
  `flags.welcomeGranted`). A fresh save can now afford ≥1 upgrade and ≥1
  painting (verified: capacity lvl1, vitality lvl1, moonlit-pond, self-portrait
  all affordable). Smoke stage 23 asserts the grant is one-time/idempotent and
  leaves the bank strictly positive.

Full plan: `docs/PLAN-v1.1-next.md`.

## Known risks / open questions

- Smoke stage 16 asserts the title start-button label — P7 (difficulty select on title) will touch the same UI; update the stage when implementing.
- P10 culling (this pass): guarded by smoke stage 24 (draw-cull ratio + enemy
  AI-cull behavior) and a real-browser 60fps probe. Keep future world-decor
  loops culled to the view rect so 60fps holds as density grows.
- `browser_exec` is still dead; visual verification (P8, P12, zone art) relies on `desktop_preview` or screenshots via the dev server / the headless driver (`tests/headless.mjs`).