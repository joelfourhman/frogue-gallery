# Frogue Gallery — Roadmap

Milestones only — see `docs/PROJECT_STATUS.md` for live status, bugs, and
debt.

## Release (✅ shipped — 2026-09-05)

| M | Scope |
|---|---|
| M1 | Playable vertical slice: loop, HUD, boss, smoke test |
| M2 | The Atelier: between-run economy (shop, loadout, persistence) |
| M3 | Balance pass: awakened-boss 2× damage, HP/damage re-tune |
| M4 | Croaksworth story beat, best-run tracking, M-mute |
| M5 | Polish: low-HP vignette, real pause menu, intro banners |
| M6 | Final sweep: erase-save UI, docs accuracy, 11-stage smoke suite |
| P1–P5 | Post-release polish: first-run tutorial, combat juice, atelier onboarding, first-time balance, run pacing (5400px world, 4 zones, real 30k-HP heron) |

## v1.1 — Improvements & bug fixes (✅ COMPLETE — 2026-09-05)

### M7 — Bug fixes & robustness (current)

| ID | Item | Status |
|---|---|---|
| B1 | Commit the uncommitted release-sweep work (git lags the verified state) | ✅ 2 commits |
| B2 | Corrupt-save handling: detect, "keep what we can" vs fresh start, never crash boot | ✅ `14b50a3` |
| B3 | Dry-brush softlock audit: prove a pigment-starved frog can still beat the heron | ✅ `a32a721` |
| B4 | Tab-hidden time-spike verification (dt cap exists: 0.05s; confirm no physics blowups) | ✅ `2ed1c9a` |
| B5 | localStorage unavailable → in-memory fallback + one-time notice | ✅ 2026-09-05 (save.js in-memory fallback + `storageOK`, one-time banner in `_beginExpedition`, smoke stage 20) |
| B6 | Save schema versioning: `saveVersion` in the save, migration test (foundations in logic.js) | ✅ 2026-09-05 (commit `599a599` — `SAVE_VERSION`/`SAVE_MIGRATIONS` in logic.js, smoke stage 19) |

Acceptance: each item has a passing test; smoke suite green; no behavior
change to Normal difficulty.

### M7.5 — Playtest feedback pass (DONE 2026-09-05 — user-reported)

Player-tested the game; five issues fixed as one cohesive UX pass
(implemented in order, each reported + verified):

| ID | Item | Notes | Status |
|---|---|---|---|
| PT1 | Painting consumption | swipe/splash already rate-gated (verified, not free); regression guard added | ✅ 2026-09-05 (smoke stage 21) |
| PT2 | Onboarding | first-run heron reveal deferred 6.5s → 38s (after tutorial) | ✅ 2026-09-05 (headless `onb`) |
| PT3 | Fly fairness | Space-hop `hopCooldown 0.7s` stamina gate added | ✅ 2026-09-05 (smoke stage 22) |
| PT4 | Early-economy safety net | one-time `WELCOME_GRANT {3,6,4}` on first expedition | ✅ 2026-09-05 (smoke stage 23) |
| PT5 | Grey box in the swamp | duplicate camera transform in world.js terrain painters — removed | ✅ 2026-09-05 (commit `ed287a4`) |

Acceptance: each fix shipped with a test or documented manual check; full
suite green; Normal-difficulty baseline preserved (balance numbers logged
in PROJECT_STATE.md before/after).

### M8 — Player-facing improvements (after M7)

| ID | Item | Status |
|---|---|---|
| P6 | In-game "?" reference overlay (controls, pigments, enemies) | ✅ 2026-09-05 — a **"Field Guide"** overlay toggled with **H** (or `?`), pausing the run so it's readable mid-fight. Two columns: **Controls** (move / paint / splash / hop / pause / mute) + **Pigments** (keyed swatches with accurate roles: red burns + ignores armor, blue slows then a second coat within 1s freezes, green roots ground enemies — flies immune — and heals), a **Splash** note, and a **Great Gray Heron** counterplay card (watch the telegraphs — dive/scoop/sweep/storm — and paint it while it recovers). Closing via H, ?, Esc, or the Close button resumes cleanly; a fresh run always starts with it closed. Smoke stage 28. |
| P7 | Difficulty select on title (Gentle/Normal/Bold; Normal = current balance) | ✅ 2026-09-05 — three pills on the title (keys G/N/B, click, or the pills); choice persists in `options.difficulty`. `applyDifficulty()` in `logic.js` scales boss HP / enemy HP / damage-taken; Normal is exactly the released tuning. |
| P8 | The Gallery Wall: framed, titled owned paintings in the Atelier | ✅ 2026-09-05 — third Atelier tab "The Gallery" (key 3 / click): every painting hung in a gold frame. Owned works are lit (full-color motif + title placard + passive bonus, "★ hung" when in the loadout); unowned are dimmed silhouettes (cost hint); sealed Croaksworth shows "???" (earned). Display-only — buying/hanging stays on the Paintings tab. Smoke stage 27. |
| P9 | Audio/options polish: separate music/SFX sliders, shake & vignette toggles | ✅ 2026-09-05 — the master volume splits into **independent music / SFX buses** (`src/audio.js`: `musicBus` carries a new synthesized ambient bed — detuned-pair drone + slow LFO swell + filtered swish pad; `sfxBus` carries all SFX; `setMusicVolume` / `setSfxVolume` drive each bus, muted master still wins). A new **Options overlay** on the title (key `O` or the "Options" button) exposes Master / Music / SFX sliders (click or drag) plus **Screen shake** and **Low-HP vignette** toggles (both default on); every change persists through `SaveSys.saveOptions`. `logic.js` `freshOptions` / `migrateOptions` seed the split volumes from the legacy `volume` and clamp/normalize the four new fields. `game.js` gates the `_view()` shake on `options.shake` and the low-HP wash on `options.vignette`; `input.js` adds a `dragging` slot for the sliders. Smoke stage 29 + real-browser check (6 ambient nodes, bus gains track the sliders, no JS errors). |
| P10 | Performance pass: cull off-screen enemy AI; hold 60fps across the full world | ✅ 2026-09-05 (view-cull decor + enemy AI beyond 500px; draw calls 9527→~1464 localized; 60.2 fps real-browser; smoke stage 24) |
| P11 | Human-pace pacing probe (simulated human input, not bot-optimal) | ✅ 2026-09-05 — `tests/humance.mjs` (informational): god-mode sim of an imperfect human (burst/hesitate walk, Field-Guide zone reads, noisy aim, back-off on heron telegraphs). MEASURED cross-swamp ~52s + MEASURED heron boss ~134–166s, composed with pace.mjs's analytic wave-fighting → **full-run 18.3–19.4 min across seeds 1337/7/42/2026**, in the 15–20 min target. |
| P12 | Zone character: distinct accent + signature encounter per zone | ✅ 2026-09-05 (per-zone accent wash + an elite "signature guardian" of the zone's emblematic enemy — 1.9× HP / 1.35× size / 3× score, ringed in the zone accent; accents Reed #c9a94e, Slick #5a93c9, Bramble #7fb069, Gray #9a9a8f; pace probe updated, human est. ~18.8 min; smoke stage 25; 60.5 fps real-browser) |

Acceptance: each item shipped with a smoke stage or regression test;
full suite green; 15–20 min run target still holds on Normal; docs accurate.

### Deferred (explicitly out of v1.1 scope)

- Gold pigment / fourth brush color
- Gamepad support
- New Game+ (post-victory loop)
- CRT/paper-texture visual filters beyond current style

## v1.2 — "The Collection" (✅ COMPLETE 2026-09-06)

Theme: make the *meta* as fun as the run. v1.1 proved the expedition; v1.2
gives the player something to collect, master, and show off — while keeping
the 15–20 min run, the "painting is the game" pillar, and the zero-dependency
boundary intact. Every item lands with a smoke stage (or documented probe),
the suite green, and docs updated per commit.

**Status: all four milestones done — M9 (A1–A4) ✅, M10 (E1–E4) ✅, M11 (V1–V4) ✅, M13 (T1–T4) ✅.
Full suite 45/45; pacing `pace.mjs` ~18.7 min + `humance.mjs` ~18.8 min (15–20 min band on
Normal). The M13 tutorial + "Watch me" retraining are a separate frozen layer that adds no
timed-run time.**

### M9 — Atelier & collection depth

| ID | Item | Notes | Status |
|---|---|---|---|
| A1 | Atelier characters come alive: Mabel / Giuseppe / Monet get short, rotating one-liners (contextual: reacts to your last run, purchases, best run) | ✅ 2026-09-06 — a rotating one-liner from Mabel / Giuseppe / Monet speaks in the Atelier on a pinned paper chip (typewriter reveal, ~28 chars/s). Context priority: a purchase just made this visit → last finished run (victory/defeat) → best run → general banter; each character has victory/defeat/purchase/general pools and rotates without repeating the last line. Pure display data in `game.js` (`ATELIER_CHARS`, `_pickAtelierSay`, `_noteAtelierPurchase`); no new art, no save changes. Smoke stage 30. | ✅ |
| A2 | Painting synergy pairs: certain 2-slot loadout combos unlock a named "duo" effect (e.g. Moonlit Pond + Storm Cloud = "Flooded Night": blue splash also slows) | ✅ 2026-09-06 — 3 pairs in a pure `SYNERGIES` table + `activeSynergy(loadout)` in `logic.js`, called in `makeTuning` after the per-painting loadout modifiers (stacks on top of the two parts): **Flooded Night** (moonlit-pond + storm-cloud, `splashCharge ×0.7`, `splashRadius ×1.15`), **Stormfire** (dancing-salamander + storm-cloud, `burnDps ×1.4`, `splashDamage ×1.2`), **Royal Meadow** (king-frog + spring-garden, `greenHeal +2`). Only real, consumed tuning fields are modified — no new status system. The active duo is named in the Paintings-tab legend of the Atelier. Smoke stage 31. | ✅ |
| A3 | Curator's Ledger: a persistent per-painting "story" unlocked on first purchase + first victory with it (short prose, 1–2 lines each) | ✅ 2026-09-06 — a 4th atelier tab ("Curator's Ledger", key 4) lists all 8 paintings, each with a short lore/collectible blurb and its collected / not-yet / ★-hung state; reuses the P8 Gallery wall frame look (paperPanel + gilded frame + generative motif) and the same painting data. Display-only — no buy rows. Data-only lore in `game.js` (`LEDGER_LORE`, `ledgerEntry`); nothing persisted. New smoke stage 32 (fillText-recording canvas) asserts every painting renders with its collected-state correct (5 "not yet", 2 exact "collected", 1 "★ hung"). | ✅ |
| A4 | Atelier prestige-lite "Rehung Frame": retire an owned painting to a bonus for its next tier (e.g. +1 capacity) without erasing the collection | ✅ 2026-09-06 — a permanent, saved **Gallery Bonus** (`save.galleryBonus`, counter) minted from the Curator's Ledger (tab 3) when the player **retires a fully-completed collection** (all 8 paintings owned + ≥1 ★-hung). Prestige-lite, NOT a save-wipe: the bank + collection remain and it is **repeatable** (a counter, not a flag). Each level is a small permanent tuning bump applied via `makeTuning` → `applyGalleryBonus`: **+2 pigment of each color at run start** (start ink) and **+10% orb/pickup value** (`pickupValue × 1.1`). Save schema bumped `SAVE_VERSION 1→2` with a `SAVE_MIGRATIONS` entry (`from:1,to:2` defaulting `galleryBonus:0`) so old saves load unchanged. Pure logic in `logic.js` (`GALLERY_BONUS`, `galleryBonusLevel`, `canRetireCollection`, `retireCollection`, `applyGalleryBonus`); a "Rehung Frame" bar + Retire button on the Ledger tab in `game.js`. Smoke stage 33 asserts: OFF on a fresh save, ON after a simulated retire (repeatable), persists across a save/load round-trip, and an old-format save (no field) migrates without error. | ✅ |

### M10 — Expedition depth (in-run, not meta)

| ID | Item | Notes | Status |
|---|---|---|---|
| E1 | A second boss: the "Painted Heron" — a mid-run guardian of a chosen zone that uses the same 3-hue Awaken mechanic at ~30% scale | design.md's pillar is the paint-the-boss mechanic; one mid-boss makes the 15–20 min journey have two beats instead of one. Reuses `bossStep` + `paintBossHit` with a scale factor; new zone accent | ✅ 2026-09-06 — the **Painted Heron** is a mid-expedition "half-heron" set-piece at the **end of zone 3 (x=0.75, 4050/5400, Bramble Thicket → Gray Shore)** on **Normal+** (Gentle skips it). It is a small re-use of the real heron's `bossStep`/`paintBossHit` machinery at reduced scale: **HP 3000 (~1/10 of the 30000 final)**, **~1 hue to awaken** (per-heron `awakenNeed` {24,24,24} vs the final 45 — `paintBoss` honors `h.awakenNeed`), **phase escalation capped at 2** (`bossStep` respects `h.maxPhase`), and its own `contactDmg` 4. It is **NON-BLOCKING/optional**: dormant until the frog comes within 430px, then announces itself (banner) and runs; the frog can walk past it, so it never gates the run. Defeat scatters 3 pigment orbs and **the run CONTINUES** (no victory state). Config `MID_HERON` + `midHeronAllowed()` live in `logic.js` (pure); spawn/update/draw wiring in `game.js` (`_updateMidHeron`, `_onMidHeronDefeated`, painted the same as the final heron). Pacing re-verified on Normal: **pace.mjs ~18.7 min, humance.mjs 16.7 min (cross-swamp 58s unchanged)** → still in the 15–20 min band, so it stays optional on Normal (not gated to Bold/Hard). Smoke stage 34 (E1): spawns on Normal, dormant-until-approach, awaken-need < final, phase cap, **damaged by wet paint**, **defeat clears it + scatters reward orbs + run continues (no victory)**, absent on Gentle |
| E2 | Weather / tide phase per expedition: a light environmental modifier (e.g. "Mist": enemies telegraph longer; "Ember tide": red fire spreads faster) chosen from a small pool, shown on the title + first banner | adds run-to-run variety with *tunable*, non-punishing modifiers (Gentle/Normal/Bolt stay the reference). Data table + `applyDifficulty`-style hook in `logic.js`; documented in `DECISIONS.md` | ✅ 2026-09-06 — **Weather/tide phases**: 2 short ambient events in the pool — **Rain** (blue brush splash radius +30% for 20s) and **Drought** (red burn dps +40% for 15s). Each is a transient, eased multiplier (0.8s ramp-in / 1.2s ramp-out) applied to the live `makeTuning` output fields it targets (`WEATHER_PHASES` table + pure `weatherFactor`/`weatherFor` in `logic.js`), announced via the banner system. **Deterministic-ish per run seed + zone** (`weatherFor(seed, zoneIndex)` via `mulberry32`): ~60% of zones get a phase, firing mid-zone (6–24s after entry); the rest stay calm. Non-punishing/informational — it never blocks or gates the run. game.js arms the phase on zone entry (`_zoneI` advance), fires it at `weatherTriggerAt` in `_updateWeather`, and restores the affected fields **exactly** to their captured base on expiry. Pacing re-verified on Normal: pace.mjs ~18.6 min, humance.mjs 18.8 min (in the 15–20 min band). Smoke stage 35: pool shape + durations, factor =1.0 at start/expiry and full mid, deterministic per (seed,zone), most-but-not-all zones fire, **a phase triggers mid-zone, mutates the active tuning (splashRadius 58→75.4 x1.3), and expires cleanly back to base (58===58)** |
| E3 | Zone-specific hazard on Bold only: one signature set-piece per zone (e.g. Slick Hollow = a slick patch that slows the frog unless hopped) | gives Bold a reason to exist beyond numbers; off by default (Gentle/Normal unchanged). Reuses existing status/telegraph systems | ✅ 2026-09-06 — **two Bold-only environmental hazards**: a **Thorn Reed** (roots the frog ~1.1s on touch) and a **Mud Pool** (slows the frog to ~0.55× for 2.0s). Spawns **ONLY on Bold** via `boldHazardsAllowed(difficulty)` (gate lives next to `midHeronAllowed` in `logic.js`); Gentle/Normal never get them, so the **15–20 min Normal pacing target is untouched** (difficulty-gated → pacing probes intentionally NOT re-run for this item, per the plan). Placement is **pure + deterministic per (runSeed, zone)** in `placeZoneHazards()` (`logic.js`, mulberry32-seeded), 2–3 hazards per zone placed in the walkable corridor (y 480–980). Player slow/root state (`slowT`/`rootT` + `speedFactor()`) lives on `player.js`; the per-frame contact check (`_updateHazards`) + spawn-on-zone-entry (`_zoneBeat` → `_spawnZoneHazards`) + watercolor draw (`_drawHazards`) are thin wiring in `game.js`. Smoke stage 36 (E3): gate is Bold-only, placement is deterministic + in-corridor, **hazards SPAWN on Bold when crossing a zone and NOT on Normal**, thorn reed roots (speedFactor 0), mud pool slows (speedFactor 0.55) and wears off |
| E4 | Orb "streak" bonus: 3+ orbs collected without taking a hit grant a small bank bump + a distinct chime | rewards the dodge/hop skill the PT3 fly-fairness rebalance introduced; scales with the existing `bankGain` (pure fn, testable) | ✅ 2026-09-06 — a **clean-orb streak** (collect pigment orbs without taking a hit) builds a small multiplier on orb/pickup value: `ORB_STREAK` in `logic.js` (pure, unit-testable) — threshold **4 clean orbs**, **+10% per tier, capped at 4 tiers (×1.40)** via `orbStreakMult(streak)` / `orbValueAt` / `orbStreakState`. Deliberately modest — a **scoring bonus adds no run time**, so Normal 15–20 min pacing is untouched (pacing re-verified after the in-run change: `pace.mjs` ~18.7 min, `humance.mjs` 19.2 min full-run, both in band). `game.js` owns the in-run counter `orbStreak` (not persisted), applies `orbStreakMult` to the bankable `collected` total in `_updateOrbs` (with a floating `+v ×N.NN` note + streak chime), and **resets it to 0 on any hit** at the central `_prevHp` damage hook. A top-right HUD chip shows `streak N/4` then `streak ×N.NN` when the bonus is live (reads the same pure `orbStreakState`). A distinct 3-note `pickup-streak` chime (`audio.js`) marks boosted orbs. Smoke stage 37 (E4): no bonus below 4, +10% at 4, plateau at cap, streak **builds on collect, boosts orb value (1.21 vs base 1.10), and resets on a hit (then pays base again)**. Suite green: 37/37 |

### M11 — Presentation & feel

| ID | Item | Notes | Status |
|---|---|---|---|
| V1 | **Painted-world "reveal" progress bar** — a thin HUD bar (top edge) that fills gray → full color as the world's saturation recovers this run. Reads `world.worldColorSat()` (the same value the terrain draw uses) through a pure `revealProgress()` mapping, so the bar always matches the world actually shown; zero gameplay change | the design pillar ("every stroke restores color to the swamp") was previously invisible; surfacing it makes the fantasy legible. Reuses `worldColorSat` + `restoreColor` (already tracked) | ✅ |
| V2 | Heron Awaken "bloom" beat: a short, dramatic full-screen color bloom + screen shake when the heron enters Awakened, and a bloom on victory (already in design.md, currently under-sold) | sells the single most important moment of the fight; particle-budget aware (≤220 cap holds). **v1.2 Batch 4:** the bloom fires exactly when the heron's `awakened` flag flips (real `paintBossHit → 'awaken'` path in `_updateExpedition`); a world-space radial 3-pigment color wash (`_drawBloom`) + a **render-only** saturation surge (`_bloomSurge` — never mutates `worldColorSat()`, the V1 bar's single source of truth) + a distinctive `awaken-bloom` SFX (rising C-E-G-C arpeggio + shimmer, reuses `_tone`/`_noise`). Pure presentation — no gameplay/pacing change | ✅ |
| V3 | Audio: a per-zone ambient bed shift (4 subtle Web Audio drones cross-faded as you cross zone boundaries) | extends P9's music bus into the run; loopback-local synth, no assets; reuses the `musicBus` bed system | ✅ (v1.2 Batch 4: `AudioSys.setZoneAmbient(zi)` builds a distinct per-zone bed — calm opening + Reed Flats water-drone, Slick Hollow wind pad, Bramble Thicket hum, Gray Shore sparse chimes — all synthesized from the existing osc/noise/filter nodes, wired `voices → zg → _ambMaster (0.6) → musicBus` so it inherits the music slider + mute; crossfades between zones on entry and fades out at run end. Pure presentation — no gameplay/pacing change) |
| V4 | End-screen "exhibition": frame the heron + your 2-slot loadout as a titled, signed piece for the run, with a shareable title string | ties combat to the collection theme; data-only (no new rendering engine), reuses the P8 frame renderer | ✅ (v1.2 Batch 4: the **victory** end-screen now shows the paintings carried this expedition (the 2-slot loadout) as a small framed exhibition — "Curator's Wall" — reusing the P8 Gallery Wall look (gilded double frame + `_drawPaintingMotif`) + the painting data, each **titled**, laid out in a row with a **soft staggered fade+rise reveal** animated on `endT`. The victory card grows to 540px (defeat stays 430) via a single `_endCardH()` shared by the draw AND the end-state click rects so the buttons stay in place. Pure presentation — no new art, no gameplay/pacing change) |

### M13 — Tutorial (the taught journey)

The game has first-run banners + a Field Guide overlay (P1, P6), but they're
passive: they tell the player what things *are*, not how to *use* them in a
moment of pressure. M13 turns that into an active, hands-on, **skippable**
tutorial that teaches the pigment roles and the heron's color mechanic *by
doing*, so the first real run starts confident instead of confused. Design
pillar: the tutorial must teach "painting is the game" — not just "move and
shoot." It is **opt-out** (a "Skip" button on the first screen) so return
players are never forced through it.

| ID | Item | Notes | Status |
|---|---|---|---|
| T1 | Guided first expedition: a scripted, low-stakes opening zone where the player is coaxed to paint a beetle (red = burn), a mosquito (blue = slow/freeze), and a toad (green = root) — each with an on-screen goal + a "try it" prompt, not a wall of text | reuses the existing tutorial/banner state machine (P1) but makes it interactive; a dedicated `tutorial` expedition flag so it can be re-entered from the Field Guide ("Watch me") | ✅ (v1.2 Batch 5: a **"Guided First Expedition"** button on the title (fresh save only — hidden for any returning save) starts a low-stakes teaching run on the opening zone. `TUTORIAL_PHASES` drives three on-screen **goal chips** (bottom-left card: pigment swatch + one-line prompt + `step n/3` + a **SKIP** button) — goal #1 beetle/red→burn-to-death, #2 mosquito/blue→freeze, #3 toad/green→root. Each target is spawned close + pinned (low-stakes, the frog can't be hurt), and each goal **advances only when the player actually causes the real effect** via `logic.tutorialDrillSatisfied` (reads the enemy's real burn-death / freeze / root — never "a brush stroke happened"). **Fully skippable:** SKIP button or Escape dismisses the whole run and persists `save.flags.tutorialSkipped`. While active the timed clock (`runT`) is **frozen** and the heron deferred, so it is a separate pre-run layer that **never inflates the 15–20 min timed expedition** (verified: `runT` held at 0 through the full practice; `pace.mjs`/`humance.mjs` re-checked after T1+T2). Schema v3 migration (`tutorialSkipped` + forward `tutorialDrills`) keeps old saves loading. `game.js` stays thin — the predicates + eligibility live in pure `logic.js`. Smoke stage 42: fresh-save eligibility, each goal advances only on the real action (and a wrong-pigment stroke does NOT advance), skip dismisses + persists + blocks re-entry, returning saves (skip or finished run) are refused the guided run. T2 appends the per-pigment "do it" drills as a later phase of the same run.) |
| T2 | Interactive pigment-mechanic drills: three micro-moments, one per pigment, where the player must *achieve* the status effect (burn a beetle to death, freeze a mosquito, root a toad) before the tutorial advances — teaches the "colors change how you approach" pillar directly | each drill is a tiny deterministic scene (a few enemies, god-mode frog); success = the status applies, so the player learns the *interaction* (red→fire, blue→freeze on 2nd coat, green→root) by causing it | ✅ (v1.2 Batch 5: appends three `phase:'drills'` entries to the SAME `TUTORIAL_PHASES` run (idx 3–5) — a later phase after the three 'learn' goals, reusing T1's chip + advance machinery, no new system. Each drill's advance predicate reads the enemy's REAL status/death via `logic.tutorialDrillSatisfied` (a beetle that actually died while burning / a mosquito actually frozen / a toad actually rooted) — never "a brush stroke happened". Each completion persists `save.tutorialDrills[drill]=true` (v3 schema field established in T1) so T3/T4 "Watch me" retraining can reference which drills were done. The learn→drills crossing plays a "now prove it" beat. Smoke stage 43: fresh save has no drills done; the drills begin after the three learn goals; the burn drill requires the beetle to actually die while burning (not just a stroke) and records `tutorialDrills.burn`; the freeze drill records `freeze` while `root` stays false; skipping mid-drills preserves the partial map (burn+freeze done, root not) across a save/load round-trip — the T3/T4 retraining reference. `game.js` stays thin; the predicates live in pure `logic.js`. Pacing re-verified: `humance.mjs` 18.9 min / `pace.mjs` ~18.7 min — the frozen pre-run layer adds no timed-run time.) |
| T3 | Mini heron: a small, low-HP "sketch" heron that teaches the color-awaken loop (paint all three hues → it Awakens → paint hard while it shimmers) in under 30s, with a clear win/lose and a "you got it — now the real one" handoff to the full boss | reuses `bossStep` + the 3-hue awaken logic at a reduced HP/tuning; the payoff that the real 30k-HP heron fight is a *known* pattern, not a surprise | ✅ (v1.2 Batch 6: the FINAL phase of the guided run (`phase:'sketch'`, idx 6) spawns a low-HP **"sketch" heron** — a re-use of the real heron's `bossStep` + 3-hue awaken machinery at a few-hundred-HP scale (`SKETCH_HERON` in pure `logic.js`: **HP 240** vs the 30000 final, `awakenNeed` {12,12,12} ≈ 1 hue, `maxPhase` 2, `contactDmg` 0 so it never hurts the frog). It spawns just ahead of the frog and becomes the tutorial's `target`; `_updateSketchHeron` runs the shared `bossStep` and `_tutorialTick` pins it in reach + completes the beat the moment all three hues AWAKEN it (the 3-hue loop the real heron uses — `tutorialDrills.awaken` records it, `tutorialDone(save)` reads the completed tutorial). Completing/skipping persists `save.tutorialDrills.awaken`; a skip leaves it false. It is a **teaching-only layer** (spawned/cleared by the 'sketch' phase, `runT` frozen, the real heron deferred) so it never enters the timed run. `game.js` stays thin — config + predicates in pure `logic.js`. Smoke stage 44: the sketch heron spawns in the teaching run (240 HP, a fraction of 30000) and reuses the real machinery (`maxPhase` 2); it can be DAMAGED and AWAKENED by all three hues (red alone / red+blue do NOT); completion persists `tutorialDrills.awaken=true` and `tutorialDone` reads it; a skipping player is NOT required to finish it (skip → `awaken` stays false, the practice ends, the timed run begins). Pacing re-verified: `humance.mjs` 18.7 min / `pace.mjs` ~18.7 min — the frozen teaching layer adds no timed-run time.) |
| T4 | Tutorial progress + re-entry: track which drills are done (persisted in the save), show a "✓ learned" state, and let the player re-open any drill from the Field Guide ("Watch me" per topic) | makes the Field Guide (P6) a real reference+retraining tool; reuses `TUTORIAL_PHASES` + `save.tutorialDrills` (no new save field / no v4 migration) | ✅ (v1.2 Batch 6: the Field Guide (H/?) — the reference tool — gains a **"Watch me" retraining band** (drawn in `_drawHelp`, shared `_helpGeom()`) offering 4 one-click lessons (burn/freeze/root drills + the sketch heron). **`_startRetrain(phaseIdx)`** re-enters the guided teaching layer at the requested phase (`retrain:true`, `runT` frozen) reusing the T1–T3 phases; completing OR skipping the replay resumes the timed run at its exact frozen clock (a retrain is a paused aside, never counted), and a retrain skip does NOT set `tutorialSkipped` (the retrain check runs before the skip-persistence). **Opt-in + never auto-enters** (a guarded `_startRetrain` refuses to nest inside an active guided run) and **never enters the timed expedition** (the real heron's intro is stashed + held at 999, restored exactly on end). Progress is **readable + persisted** via `save.tutorialDrills`/`tutorialSkipped` with pure references `tutorialDone(save)` (all drills + awaken) and `retrainAllowed(save)` (a returning player with ≥1 completed lesson; a fresh save has nothing to replay yet — the guided run is the first-time path). Smoke stage 45: progress readable per-drill + complete; the band is offered to a returning save (hidden for a fresh one); clicking a lesson re-enters that phase on demand (freeze drill / sketch heron) with its target spawned; the frozen clock is unchanged before/after (not counted); the replayed drill is recorded; skipping a replay does NOT mark the tutorial skipped; and `_startRetrain` is a no-op while a guided run is active. Pacing unchanged (tutorial-only): `pace.mjs` ~18.7 min + `humance.mjs` 18.8 min stay in the 15–20 min band.) |

Acceptance (v1.2): each item ships with a smoke stage or a documented probe;
the tutorial is fully skippable and never blocks a return player (fresh-save
players get it once, then it's off unless re-opened); full suite green in one
command; the 15–20 min **real** run target still holds (the tutorial is a
separate, opt-in layer — it does not inflate the measured expedition length,
verified with `pace.mjs` + `humance.mjs`); docs accurate; zero new
dependencies; loopback-only.

### Explicitly deferred past v1.2 (revisit later)

- Gold pigment / fourth brush color (needs a full pigment-system pass)
- Gamepad support (needs an input-abstraction layer + a test rig)
- New Game+ / post-victory campaign loop
- Multiplayer / local co-op
- CRT / paper-texture visual filters
- Procedural (infinite) expedition generation
- Accessibility & input (deprioritized by Joel 2026-09-05): colorblind pigment
  glyphs, remappable paint keys, text-size toggle — revisit after v1.2

---

## v1.3 — "The Second Expedition" (APPROVED — executing in bounded batches)

**Theme.** v1.1 hardened the game; v1.2 deepened collection + feel. v1.3
pushes the **experience loop itself**: what a player does *after* the first
full clear. A designed New Game+ loop is the spine — the biggest parked
deferred item, and the natural home for the rest of the season — the
gold-pigment economy gives the meta a second resource and a goal between
cycles, and a second heron plus expedition modifiers keep the 15–20 min
expedition fresh.

**Direction justification.** The loop today ends at victory; the meta
(paintings, galleryBonus, ledger) has no second-act purpose. NG+ is the
minimal change that gives the collection systems v1.2 built a reason to be
expanded — and it lets us spend the parked deferred items (NG+, gold,
presentation filter) in one coherent season instead of as random patches.
Nothing here touches the Normal first-time run: all new content is gated
behind a completed victory, so the pace/humance invariants (18.7–18.8 min)
apply unchanged to a fresh save.

**Invariants (unchanged):** zero dependencies, loopback-only, pure rules in
`logic.js`, 15–20 min expedition (per applicable run), ≤ 220 particles, no
per-frame hot-path allocations, smoke suite green after every commit, one
conventional commit per item/chunk, save schema stays migrated (v3 → v4).

### M14 — New Game+ as a designed loop

| ID | Item | Notes | Status |
|----|------|-------|--------|
| N1 | NG+ unlock + "Next Expedition" flow | After the first victory, the victory screen offers "Next Expedition" (alongside the existing exhibition/retreat). Starts the next expedition with cycle = 1; `save.ngCycle` (number, 0 = first-time player) persisted via a SAVE_VERSION 3→4 migration (a flat field, not a nested `ngPlus` object — simpler, same effect). NG+ expeditions reuse the existing expedition run end-to-end (zones, checkpoints, pacing). Acceptance: fresh save never shows NG+; post-victory button appears; cycle increments across sessions; smoke stage covers unlock + persistence. | ✅ DONE (2026-09-06) |
| N2 | NG+ scaling in `logic.js` | Pure `ngPlusScaling(cycle)` + `applyNGPlus(t, cycle)`. Levers: **enemy HP / enemy damage / spawn rate** (the batch spec's three — the heron is NOT scaled here because N3 swaps in a different NG+ boss instead of bumping the gray heron's fixed 30k). Cycle 0 = all-ones (first-time run byte-identical to pre-NG+; `applyNGPlus` is a no-op and never called for cycle 0). Modest cycle-1: +30% enemy HP / +15% dmg / +10% spawn; growth capped at cycle 3 (held for all later cycles — no unbounded spiral). `tests/ngpace.mjs` (modeled on humance.mjs): NG+ cycle-1 competent-returner run lands 18.4–19.2 min across seeds (15–20 band ✅); later cycles are deliberately longer. First-time probes unchanged (pace 18.8 / humance 19.0). Balance entry in PROJECT_STATE.md. Acceptance: pure function unit-tested in smoke (cycle-0 byte-identical + cycle-1 applied only when ngCycle≥1); ngpace probe in range; `pace.mjs`/`humance.mjs` unchanged. | ✅ DONE (2026-09-06) |
| N3 | Second boss — The Great Green Heron | A **second** final boss that appears on NG+ cycles (`ngCycle >= 1`) **instead of** the Great Gray Heron (the gray heron stays the first-time boss). Reuses the existing heron AI/phase machine (`bossStep`) + the 3-hue awakening end-to-end; differs by a distinct **green palette** + **ONE swapped mechanic**: painting it with **Moss** pins it in place briefly (the E1/MidHeron reed-pinning idea at boss scale — held, no attacks, 2× paint-damage window). It carries 36k HP (+20% over the gray heron's 30k) to keep the fight in a similar time band (the pin offsets the HP bump). Acceptance: bosspace-style expected fight time documented; 3-hue awakening unchanged; art reuses heron shapes + a new green palette (no new art pipeline); smoke stage asserts gray-vs-green selection, the pin engages/holds/2×/decays, and defeat → victory with NG+ intact. | ✅ DONE (2026-09-06) |
| N4 | Expedition modifiers (player-chosen) | Three hand-tuned modifiers; player picks one pre-expedition on NG+ runs (first-time runs get none — no choice, no effect). Each reuses existing systems only, e.g. "High Tide" (M10 weather/tide phases 2× as often), "Grey Morning" (a zone-2 heron moved up, one extra), "Dry Brush Season" (+1 hazard per zone via `placeZoneHazards`, +10% enemy HP). Modifier id persisted in `save.ngPlus.modifier`. Acceptance: each modifier is a data entry feeding existing generators (no new AI/art); choice UI reuses the difficulty-select pattern; smoke stage asserts each modifier changes world generation deterministically. | TODO |

### M15 — Gold pigment: a meta economy pass

Gold is explicitly scoped as a **meta pigment** (earned from the meta, spent
in the meta) — *not* a 4th combat brush color. This keeps the "painting is
the game" pillar and the 3-hue awakening mechanic untouched; the
combat-color interpretation of the parked deferred item stays deferred
(DECISIONS entry at implementation time).

| ID | Item | Notes | Status |
|----|------|-------|--------|
| G1 | Gold units in `logic.js` economy | Gold is a 4th banked unit, earned only from meta moments: boss defeat (e.g. 3), each painting synergy-pair first completion (1), galleryBonus milestone (1). Same death rule as pigments (50% banked on death). `bankGold(cap)` + `GOLD_CAP` in `logic.js`; save v4 field `gold`. Acceptance: pure function unit-tested; no gold possible in a first-time pre-victory run; displayed in the atelier HUD strip. | TODO |
| G2 | Two gold-tier paintings (catalog 8 → 10) | New paintings cost gold + pigment mix, each adds `galleryBonus` (e.g. +2% each), with new art motifs that reuse the existing per-painting motif renderer (no new art pipeline). At least one requires the NG+ completion flag to be *unlocked* (shown dimmed + "???" on the Gallery Wall until then). Acceptance: catalog length 10; galleryBonus math pure in `logic.js` (tested); Gallery Wall + Paintings tab render the two new frames with the existing frame renderer; smoke stage. | TODO |
| G3 | "Gilded Frame" — one-time galleryBonus tier | Reuses the Rehung-Frame mechanism (M9) as a purchasable one-time upgrade: costs a gold + pigment bundle, adds a fixed galleryBonus on top of the rehung bonus, purchasable once (flag in save). Acceptance: cost/flag pure in `logic.js`; atelier row follows the existing `_atelierRows` pattern; total galleryBonus caps at a documented max (no unbounded stacking); smoke stage. | TODO |
| G4 | Gold UI + ledger entries + scope decision | Atelier shows gold as a 4th currency (ink-bronze accent); Curator's Ledger gains gold-specific entries ("First gold banked", "Gilded Frame hung", "Green Heron painted awake"). DECISIONS.md entry recording: gold = meta pigment; 4th *combat* color remains deferred. Acceptance: ledger reuses the M9 entry system; no new persistent data beyond save v4 fields; manual check on first NG+ playthrough. | TODO |

### M16 — Season wrap: presentation + content closure

| ID | Item | Notes | Status |
|----|------|-------|--------|
| C1 | Atelier one-liner batch 2 | ~8 new one-liners: Monet/Mabel/Giuseppe/Croaksworth respond to NG+ cycles and gold milestones (reuses the M9 one-liner system; no new characters). Acceptance: trigger predicates pure in `logic.js` (predicate + id, tested); display reuses M9 UI. | TODO |
| C2 | Victory "Season" summary block | Victory screen (M11 exhibition) gains a compact block for NG+ runs: cycles completed, frames rehung, gold banked this cycle, best galleryBonus. Reuses the existing victory-screen layout. Acceptance: appears only on cycle ≥ 1; numbers sourced from the save (no new stats system); smoke/manual check. | TODO |
| C3 | Paper-grain presentation toggle | Folds in the parked CRT/paper filter item, scoped to **paper only**: a pre-rendered vignette + paper-grain overlay drawn once to an offscreen canvas, composited with a single `drawImage` alpha, toggle in options (default **off**), zero new dependencies. No per-frame generation, no new particle budget. Acceptance: toggle persists in `options`; 60 fps with toggle on (single drawImage, no per-frame allocations); CRT scanlines explicitly NOT included (watercolor identity). | TODO |
| C4 | Regression pass + season audit | Full-suite regression: smoke (all stages, including new NG+/gold stages), `pace.mjs` + `humance.mjs` (fresh save unchanged), `bosspace.mjs` + `ngpace.mjs` in range; then a v1.3 audit in PROJECT_STATE.md mirroring the release audit (items verified, DoD-checked). Acceptance: all probes in target ranges, suite green, audit table present. | TODO |

### Explicitly deferred past v1.3 (not forgotten)

- **Gamepad support** — no natural module fit in v1.3; needs its own
  input-abstraction + focus/selection pass (UI is mouse/keyboard-first).
  Revisit as a standalone milestone.
- **Accessibility (X1 colorblind glyphs, X2 remappable keys, X3 text-size
  toggle)** — still deprioritized by Joel; tracked in MISSION.md. X2 (key
  remapping) becomes more relevant *after* gamepad lands, so the pair stays
  parked together.
- **Gold as a 4th *combat* brush color** — v1.3 ships gold as meta-only
  (M15). A combat gold would rebalance the 3-hue pillar (burn/slow/root
  symmetry, awakening thresholds) and needs its own design spike.
- **CRT scanline look** — paper grain ships (C3); scanlines would fight the
  watercolor identity. If ever wanted, they land as a separate toggle.
- **Multiplayer / local co-op** — unchanged from the v1.2 deferral list;
  no near-term plan.
- **Procedural (infinite) expedition generation** — unchanged; hand-tuned
  zones + modifiers (N4) keep variety without a generation system.
- **Further boss variety (3rd+ heron, non-heron boss)** — one new heron in
  v1.3; a genuinely new boss archetype is a future-version item.
