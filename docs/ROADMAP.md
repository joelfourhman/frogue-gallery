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

## v1.3 — "The Second Expedition" (✅ COMPLETE — 2026-09-06)

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
| N4 | Expedition modifiers (player-chosen) | Three hand-tuned, **data-driven** modifiers (`MODIFIERS` table in `logic.js`: `id -> {name, desc, apply(t)}`) the player picks ONE of at the "Next Expedition" prompt (a picker overlay on the end/title screen — the N1 flow now opens the picker first; the run starts on confirm). First-time (cycle 0) runs get none — no choice, no effect, byte-identical. Each feeds the **existing** tuning/spawn/render paths only (no new AI/art/systems): **High Tide** (water zones wider `waterWidthMult 1.25` + enemies 10% faster `enemySpeedMult 1.1`), **Grey Morning** (desaturated world `satFloor 0.35` render cap + enemy contact dmg +20% `contactDmgMult 1.2`), **Dry Brush Season** (splash charge +35% slower `splashCharge ×1.35` + orb value +25% `pickupValue ×1.25`). Choice persisted per cycle in flat `save.ngModifier` (a `MODIFIERS` id or `null`), SAVE_VERSION 4→5 migration (old saves → `null`/no-modifier). `applyModifier(t, id)` is NG+-gated (`ngCycle >= 1`) and called only after `applyNGPlus`. Smoke stage 49: table shape, each modifier's tuning mutation, the enemies pick up the speed/dmg, the picker selects+persists, and a cycle-0 run stays byte-identical. | ✅ DONE (2026-09-06) |

### M15 — Gold pigment: a meta economy pass

Gold is explicitly scoped as a **meta pigment** (earned from the meta, spent
in the meta) — *not* a 4th combat brush color. This keeps the "painting is
the game" pillar and the 3-hue awakening mechanic untouched; the
combat-color interpretation of the parked deferred item stays deferred
(DECISIONS entry at implementation time).

| ID | Item | Notes | Status |
|----|------|-------|--------|
| G1 | Gold units in `logic.js` economy | **Gold is META-ONLY** (earned from the meta, spent in the meta — G2 onward): it is NOT a 4th combat brush color and does NOT feed `makeTuning`/combat (the 3-hue pillar + combat tuning stay byte-identical). Earned ONLY from first-time meta achievements, via pure `goldEarn(save, {key, amount}) -> amount` + event builders in `logic.js`, idempotent per event via a `save.goldEarned = {[key]:true}` latch (each fires exactly once a career): **first kill of each boss type** (gray heron 15 / green NG+ heron 20), **first completion of each synergy duo** (8 × 3 duos), **first 100 orbs in a single run** (8) → **67 gold lifetime** (covers both G2 gold paintings at 25 + 40 = 65). `save.gold` counter + `save.goldEarned` map added by a SAVE_VERSION 5→6 migration (legacy v5 saves → gold 0 / `{}`); no death-loss rule (meta currency isn't dropped on a wipe). The atelier bank strip shows gold as a distinct gold dot (a display, not a pigment). Acceptance: pure `goldEarn` unit-tested headless (each rule fires once, totals correct, old saves migrate to 0); smoke stage 50; displayed in the atelier. | ✅ DONE (2026-09-06) |
| G2 | Two gold-tier paintings (catalog 8 → 10) | Two **gold-tier** paintings added to the `PAINTINGS` catalog (8 → 10), flagged `goldTier: true` and priced in **GOLD** (not pigment): **Gilded Meridian** (25 gold; **+10% all orb value** permanently) and **Verdant Crown** (40 gold; **+1 green heal**). Owned (NOT a loadout slot) → applied in `makeTuning` (a new `owned` param; a first-time save owns neither → cycle-0 tuning byte-identical). Purchased from the atelier via the EXISTING buy flow, gold-denominated (`_buyGoldPainting` + `canAffordGold`), and **NG+-gated** (`ngCycle >= 1`): the Paintings tab shows the card but the button reads "NG+ only" / is disabled at cycle 0 (a first-time player never buys them). Art reuses the existing motif renderer (`king`/`garden` shapes — no new art pipeline). The **Curator's Ledger lists all 10** with gold-tier styling (gilded border + a "◆ GOLD" tag). The Rehung-Frame retire bar stays keyed to the 8 PIGMENT paintings (`PAINTINGS.filter(!goldTier)`) so G2 does NOT raise the v1.2 M9 prestige requirement. Acceptance: catalog length 10; gold purchase/apply pure + tested; ledger lists all 10; smoke stage 51. | ✅ DONE (2026-09-06) |
| G3 | "Gilded Frame" — one-time NG+ prestige tier | A **ONE-TIME, permanent, saved** option to spend **50 gold** on a *Gilded Frame* — a prestige tier ON TOP OF the existing Rehung-Frame `galleryBonus` (a SEPARATE field `save.gildedFrame`, NOT a `galleryBonus` level, so it stacks distinctively). Effect: a modest, permanent tuning bump applied in `makeTuning` **AFTER** the existing `applyGalleryBonus` (a new `gilded` param; **`+3 start ink of each color` + `+15% orb value`**, via `GILDED_FRAME = {cost:50, ink:3, orbMult:1.15}`), so it stacks with Rehung Frame (e.g. Rehung level 2 + Gilded = `+7` ink / `1.38×` orb). **NG+/gold-gated** (`ngCycle >= 1 AND save.gold >= 50`): a cycle-0 player can never buy it, so **cycle-0 tuning stays byte-identical** (a fresh save owns no gilded frame → the `gilded` param defaults false and the new keys are absent). One-time: `canBuyGildedFrame(save)` is pure (returns false once owned); the buy is refused on repeat and does not re-deduct. `SAVE_VERSION 6→7` with a `SAVE_MIGRATIONS` step + `normalizeGildedFrame` (legacy v6 saves → `gildedFrame: false`, no error). Presented in the **Curator's Ledger** as a gilded bar above the Rehung-Frame bar with a state-aware gild button (price / NG+ gate / owned). Acceptance: pure cost/flag functions in `logic.js`; `makeTuning` gilded bump tested (fresh=none, post-buy=applied, save/load persist, STACKS with galleryBonus, gold deducted + not repeatable, old-format migration); smoke stage 52. | ✅ DONE (2026-09-06) |
| G4 | Gold UI + ledger completion (presentation polish) | Pure **UI/data reuse** of the gold economy's presentation — **NO new mechanics, NO new persistent state** (gold values, `PAINTINGS`, the existing frame renderer, and the A1 one-liner machinery are reused). (a) A **gold BALANCE READOUT** (`_goldReadout()`, a pure read of `save.gold` + `ngCycle` + `isGilded`) renders on the **atelier header** (a line between the subtitle and the bank strip; the strip moves 96→104 to make room) AND on the **Next Expedition prompt** (below the "Swim On" button): the balance plus a state-aware hint of what it buys (a fresh save → "a meta pigment — earned from boss defeats, first synergies & the 100-orb run (spent in NG+ only)"; an NG+ save with ≥ 50g → "spend 50g in the Curator's Ledger to hang the Gilded Frame (+3 ink · +15% orb)"; a gilded save → "the Gilded Frame is hung — it is forever yours"). (b) The **gold-tier Curator's Ledger rows** show their **gold price + owned state distinctly** (unowned → `"<cost>g · NG+ only"` in gold ink; owned → the `collected` / `★ hung in the loadout` state) alongside the existing gilded thumbnail frame + "◆ GOLD" tag (from G2). (c) A short **gold LEGEND line** on the Curator's Ledger tab explains what gold is + where it comes from ("gold is a meta pigment — earned from boss defeats, first synergies & the 100-orb run, spent here on gold-tier works & the Gilded Frame (NG+ only)"). No `makeTuning` change → **cycle-0 tuning stays byte-identical**. Acceptance: headless `fillText`-recording asserts the gold balance renders (header + Next Expedition) and the gold-tier ledger rows show price + owned state; smoke stage 53. | ✅ DONE (2026-09-06) |

### M16 — Season wrap: presentation + content closure

| ID | Item | Notes | Status |
|----|------|-------|--------|
| C1 | Atelier one-liner batch 2 (NG+ reactions) | A **SECOND, NG+-context line pool** per A1 resident (`ng` pool: 3 lines each for Mabel/Giuseppe/Monet — 9 new one-liners) drawn **only when `ngCycle >= 1`** (a returning expedition). Mabel reacts to the gold piling up / the Gilded Frame; Giuseppe reacts to a high `ngCycle` (tally, prices, the gold shelf); Monet comments on the gilded frame / second-campaign collection. Reuses the **EXACT A1 machinery**: a new `ng` context slot in the `_pickAtelierSay` priority chain (just-made-purchase > **ng** > last-result > best-run > general), rotating pools, no-repeat-last, typewriter reveal — and **NO new persistent state** (a plain `save.ngCycle` read). Pure display data in `game.js`; the trigger predicate (`ngCycle >= 1`) is a trivial pure read. Smoke stage 54 (NG+ save gets NG+-pool lines distinct from the cycle-0 pools; rotation/no-repeat holds; purchase still wins over ng; typewriter starts fresh; nothing persisted). | ✅ DONE (2026-09-06) |
| C2 | Victory "Season" summary block | The victory end screen (below the V4 exhibition, in the V4 card's existing empty bottom band — the 540px card's spend hint ends at py+420, so **nothing below it moves** and the end-screen buttons keep their exact rects) gains a compact **"Season" summary** for the NG+ season a victory belongs to: the current **NG+ cycle**, the **modifier** chosen for it (name or "none"), **gold earned this expedition** (the delta since run start — `runGold` is captured in `_beginExpedition`, in-run only, never persisted) + the **career gold total**, the **Gilded Frame** state ("hung" / "not yet"), and the **paintings carried this expedition** (the 2-slot loadout, named). A pure `_seasonSummary()` read of the run + save (`ngCycle`, `saveModifier(save)`, `save.gold`, `isGilded(save)`, `save.loadout` + `PAINTINGS`), drawn ONLY on a victory (victory-only, like the V4 exhibition). **No new persistence, no tuning change** — cycle-0 tuning + first-time pacing stay byte-identical; a first-time (cycle 0) victory sees the block with its own values (cycle 0, no modifier, no frame, its carried painting). Reuses the V4 card layout (`paperPanel`/`centerText`) + the save fields. Acceptance: headless `fillText`-recording asserts the block renders the correct values for a representative NG+ save (cycle 2, High Tide, +17 earned / 70 total, Gilded Frame hung, the 2 carried paintings) AND a first-time save (cycle 0, no modifier, 0/0, not hung, 1 painting); absent on a defeat; button rects unchanged; nothing persisted. Smoke stage 55. | ✅ DONE (2026-09-06) |
| C3 | Paper-grain presentation toggle | An options toggle (default OFF) overlays a subtle PROCEDURAL paper-grain texture on the canvas — NO image assets, NO scanlines/CRT (explicitly excluded: they fight the watercolor identity). Synthesized as a CACHED offscreen tile of low-opacity noise speckles (two grain scales — a fine 128px tile + a coarse 64px tile — for variation), drawn LAST in the render loop at low alpha so it sits over every screen. Wired into the P9 options machinery: a fourth toggle row ("Paper grain") added to `_optionsLayout` (panel 380→424; the back button stays anchored to the panel bottom, so its rect moves down with the taller panel) + `_toggleOpt('grain')` routing + `_drawToggle` draw; the toggle PERSISTS through the existing options save. `freshOptions()` defaults `grain` OFF and `migrateOptions` migrates old options blobs (no `grain` field) to OFF WITHOUT ERROR (presentation unchanged for returning players). **Implemented 2026-09-06.** `logic.freshOptions`/`migrateOptions` gain `grain` (default off; `!!raw.grain` so only an explicit true turns it on); `game.js` adds `_buildGrain()` (two cached low-opacity speckle tiles + `createPattern`, built once per Game) + `_drawGrain(ctx)` (two low-alpha pattern fills, drawn last, a no-op when the option is off or `createPattern` is unavailable — headless-safe). Smoke stage 56 (grain defaults OFF; a legacy options blob (no `grain` field) migrates to OFF without error; an explicit `grain:true` is honored; a fresh Game loads OFF; the overlay is NOT built/drawn while OFF; it IS built (fine+coarse tiles, both patterns) + drawn when ON; the tiles are CACHED (built once, not rebuilt per frame); the toggle row is clickable, persists to the options blob, and the grain re-skips when toggled back off). | ✅ DONE (2026-09-06) |
| C4 | Regression pass + season audit | Full-suite regression: smoke (all stages, including new NG+/gold stages), `pace.mjs` + `humance.mjs` (fresh save unchanged), `bosspace.mjs` + `ngpace.mjs` in range; then a v1.3 audit in PROJECT_STATE.md mirroring the release audit (items verified, DoD-checked). Acceptance: all probes in target ranges, suite green, audit table present. | ✅ DONE (2026-09-06) — full suite: `smoke.mjs` **56/56 stages, green 3x consecutive**; `pace.mjs` first-time **~18.5 min** (15–20 band ✅); `humance.mjs` **18.4 min** (15–20 band ✅); `ngpace.mjs` NG+ cycle-1 **19.5 min** (15–20 band ✅); `bosspace.mjs` gray-heron analytic 36.8s (~1.0 min human). **Cycle-0 byte-identity re-verified**: `makeTuning` output for 27 input combos is byte-identical across v1.2 (`08b954a`) → HEAD (JSON compare). **Zero new dependencies** since `08b954a` (no package.json/lockfile/require/import changes; `grep` clean). Tree clean. The v1.3 season audit table is in PROJECT_STATE.md. |

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

## v1.4 — "Make It Amazing" (APPROVED — executing)

**Theme: juice, presence, and moments.** Three versions have made the game
mechanically deep and complete — the missing layer is how it *feels*. v1.4
adds no new rules and no systems of consequence; it makes the same game feel
alive in the hand, alive in the world, and alive in the ear. Every item
reuses existing systems (named in each Notes) and stays inside the
zero-dependency, procedural-only, 60fps, painted-world invariants.

**Why this order — juice first, because it multiplies everything after.**
Camera, hit-stop, and body feel on the *current* art and audio are already a
big leap in feel — and they make the art and audio that land on top of them
read better. Frog hop feel (J4) comes before the living-world pass (L1) so
the character is already animated when the world starts moving; the living
world lands before the title screen (L3) so the title reuses the same
animation code; the melodic zone theme (S1) lands after the first art pass so
the visual + audio upgrade hit together; the first-victory cinematic (M1)
lands last, when it has the best swamp to bloom; Encore + easter eggs are pure
delight that depend on nothing. Batches of 3 (last batch 2), one conventional
commit per item, full smoke suite green after every commit, and a 60fps
acceptance check on every juice/art item: the P10 culling stage is the
headless budget guard, and every item either re-runs it or adds its own
per-frame budget assertion.

### Module J — Game feel / juice (the #1 lever)

- [x] **J1 — Wet paint that lingers** — `paint.js` / `game.js`
  - **What:** short-lived "wet marks" on surfaces. When a swipe/splash hits
    terrain or an enemy, 3–6 low-alpha watercolor blots (pigment color,
    wobbly edges via `math.js` shapes, slightly darker wet rim) persist
    2–6 s and fade. The swipe trail in `paint.js:drawTrails` becomes a
    tapered wet-stroke ribbon (3–4 fading segments) that lingers ~0.4 s
    instead of vanishing in a frame.
  - **Notes:** store the wet marks in a capped list (reuse the `particles`
    array with a new `kind`, or a parallel cap on the world); HARD CAP ~120
    active wet marks, oldest dropped first (P10 discipline — same rule as
    the culling invariant). No persistent paint data (deferred list).
  - **Acceptance:** new smoke stage: swipe + splash spawn wet marks, count
    never exceeds the cap, all fade out within 7 s; P10 stage still passes.
    Status: DONE (2026-09-06, v1.4 BATCH 1). Implemented in `paint.js`: a
    capped (~120) `wet` pool of short-lived low-alpha marks, `_addWet()`
    pushes oldest past the cap, decayed in `update()`, drawn by `drawWet()`
    (render hook added in `game.js` `_drawAll`, under the active stroke).
    Swipe ribbon lifetime 0.28s → 0.4s. Draw/particles-time only — no
    persistent paint data, no gameplay change. Smoke stage 58 green; P10
    (stage 24) still passes; first-time pacing unaffected (presentation-only).

- [x] **J2 — Hit-stop + shake escalation + boss-defeat slow-mo** — `game.js`
  - **What:** a single `timeScale` on the frame loop (default 1). Small
    hits: 60–90 ms at 0.3× (hit-stop pop on beetle kill, orb-streak hit,
    pigment pickup). Big moments: heron defeat → ~0.8 s at 0.35× + white
    flash frame + shake spike; the boss lunge telegraph already exists
    (`enemies.js`), add a 1-frame pre-hit freeze when the lunge connects.
  - **Notes:** `timeScale` scales `dt` for world/particles/enemies only —
    never the UI or the input buffer; shake reuses `addShake`
    (`game.js:323`) with new escalation values; the existing
    `options.shake` toggle gates all of it.
  - **Acceptance:** smoke stage: timeScale spikes to <0.5 on a scripted big
    hit and recovers to 1 within 1 s; defeat triggers the slow-mo window;
    P10 still passes (timeScale changes time, not frames-per-second).
    Status: DONE (2026-09-06, v1.4 BATCH 1). Implemented in `game.js` (no
    pure-logic change): a single `this.timeScale` (default 1) drives the
    whole WORLD sim via `simDt = dt * timeScale` in the ambient block of
    `_frame` — world + particles + expedition (player, enemies, runT) all
    tick with `simDt`, while banners/UI/input keep raw `dt`. Because `runT`
    advances with the sim (not wall-clock), a full run's measured `runT` is
    **invariant** to hit-stops — a dip only stretches real wall-clock, so
    pace/humance/ngpace stay in band (re-verified 2026-09-06: ~18.5 / ~18.7 /
    19.5 min). `hitStop(secs, scale)` (gated by `options.shake`) sets
    `timeScale` for `secs` of real time (the frame loop restores it to 1);
    `_hitstopT` is real-time (raw `dt`). Triggers: `_onEnemyDead` → 0.075 s @
    0.3 (small-hit pop), pigment pickup → 0.06 s @ 0.35, `_onHeronDefeated` →
    0.8 s @ 0.35 + `whiteFlash()` (a 0.22 s real-time screen flash drawn last
    in `_drawAll`) + `addShake(22)` spike. `freezePreHit()` arms a 1-frame
    `_freezeFrames` latch consumed at the top of `_frame` (zeros `simDt` for
    that frame while the UI keeps ticking); it is armed the frame the heron
    enters the lunge (`'lunge-start'` event sets `h._lungeArmed`) and consumed
    by the ongoing lunge-contact check. The post-victory heron flight is routed
    through `simDt` so the ~0.8 s defeat slow-mo visibly stretches the heron's
    bloom (runT is frozen during flight, so this never affects the measured run
    length). All three effects are no-ops when `options.shake` is OFF.

- [x] **J3 — Camera polish: lead, lag, boss framing, awaken moment** — `game.js`
  - **What:** replace the plain `approach` follow (`game.js:2245`) with:
    (a) input-direction look-ahead (up to ~40 px, eases in/out); (b) mild
    lag when the frog moves fast, so the world feels weighted; (c) boss
    fights: camera widens and centers on the frog–heron midpoint; (d) the
    awaken moment: when a heron rises (especially the Great Green Heron
    reveal), a 1.2 s zoom-out + hold on the heron, then back to follow.
  - **Notes:** all in the existing `cam` object + `drawWorld` view math;
    `addShake` still applies on top. No new camera system.
  - **Acceptance:** smoke stage: cam converges to the look-ahead target,
    boss midpoint centering holds within tolerance, awaken hold fires once
    per rise; P10 still passes.
    Status: DONE (2026-09-06, v1.4 BATCH 1). Implemented in `game.js`
    `_updateCamera` (no pure-logic change): the plain `approach` follow is
    replaced by four presentation branches, all on the existing `cam` object
    (shake still rides on top in `_view`). Everything is PRESENTATION — the
    camera follows the frog's already-simmed position and runs on real `dt`
    (never `simDt`), so it stays smooth during J2's slow-mo and never feeds
    the measured runT: (a) input-direction look-ahead up to ~40 px toward the
    held movement dir (eases in on input, eases back onto the frog when idle);
    (b) mild lag at speed — the follow ease rate drops (4 vs 7) while a
    movement key is held, so the world feels weighted, and snaps back when
    at rest; (c) boss framing — while the heron is live (hp>0, not fleeing,
    intro done) the camera centers on the frog–heron midpoint and widens
    (`zoomTarget = 0.92`), and while it is fleeing (victory flight) it chases
    the heron (the existing beat); (d) the awaken moment — the final heron's
    `res === 'awaken'` handler sets `_awakenHoldT = 1.2`, during which the
    camera holds on the rising heron with a zoom-out (`zoomTarget = 0.88`)
    then eases back to follow. `paintBoss` (logic.js) returns `'awaken'`
    exactly once per rise (gated by `h.awakened`), so the hold fires once per
    rise. No new camera system, no new dependencies. Smoke stage 60 drives
    `_updateCamera` directly: look-ahead leads ~40 px then eases back, boss
    framing centers on the midpoint + widens, the awaken hold is active for
    ~1.2 s / zooms out / fires once per rise. P10 (stage 24) still passes.

- [x] **J4 — Frog hop feel: squash, stretch, dust, ripple** — `player.js` / `particles.js` / `audio.js`
  - **What:** hop start → stretch (x0.85/y1.15, 0.1 s); landing (`hopT`→0)
    → squash (x1.2/y0.8, 0.1 s) + a soft dust/water puff (new
    `particles.dustPuff`) + a single ripple ring on open water; a soft low
    "boing" sfx (synth, no asset). Draw-time only — `player.js` physics is
    untouched, so pacing probes stay unchanged.
  - **Notes:** pose flags live on the player, read by the draw pass in
    `game.js`; amplitude small (painted-world, not bouncy-arcade).
  - **Acceptance:** smoke stage: hop spawns exactly one dust puff and the
    squash/pose flags transition; `pace.mjs` / `humance.mjs` medians
    unchanged (draw-only check); P10 still passes.
    Status: DONE (2026-09-06, v1.4 BATCH 2). Implemented draw-time only: the
    existing `player.squash` field (already mapped to `ctx.scale(squash,
    2-squash)` in `Player.draw`) now stretches to 0.85 on hop START
    (x0.85/y1.15) and squashes to 1.2 on landing (x1.2/y0.8); it relaxes to 1
    in `update` (existing lerp). Landing is detected in `Player.update` when
    `hopT` crosses from >0 to ≤0 (checked after the decrement) → sets the
    one-shot `_hopLanded` flag (consumed by game.js so it fires exactly
    once). game.js, right after `p.update`, consumes the flag and fires
    `particles.dustPuff(p.x, p.y, 5)` (a new 5-mote low-alpha soft puff,
    kind 0) + `particles.ripple(p.x, p.y)` (a new single expanding+fading
    ring, kind 6, drawn in `particles.draw` via a `grow = 1 - fade` radius) +
    the new synth `'boing'` SFX (a low pitch-down sine + soft overtone, no
    asset). `player.js` physics (vx/vy/hopLift/hopCd/iframes) is untouched, so
    pace/humance medians are unchanged (re-verified: pace ~18.6 min). Smoke
    stage 61: a hop STRETCHES (x<1/y>1), a landing SQUASHES (x>1/y<1) + sets
    the one-shot flag (fires at most once), `dustPuff` spawns exactly 5 motes,
    `ripple` spawns exactly one kind-6 ring, and a real hop landing fires
    exactly one dust puff + one ripple + one 'boing' (via spies). P10 (stage
    24) still passes.

- [x] **J5 — Pickup / ink / UI micro-animations** — `game.js` / `particles.js`
  - **What:** pickups pop (scale 1.3→1, 0.15 s) + `sparkles` burst; HUD
    numbers float up-and-fade instead of swapping; the orb streak gains a
    short fading trail; UI: buttons hover-wobble 1–2 px, panels open with a
    0.15 s slide+fade instead of hard cuts (menus, pause, game-over card).
  - **Notes:** built on the `ui.js` primitives (`drawButton`, panel helper)
    so every screen inherits the transitions for free; a tiny per-widget `t`
    clock — no animation library.
  - **Acceptance:** smoke stage: pickup increments a floating-text count,
    panel open state interpolates (not a hard cut); P10 still passes.
    Status: DONE (2026-09-06, v1.4 BATCH 2). Implemented presentation-only in
    `game.js` (the world-sim `runT` is untouched, so pacing is invariant).
    (a) a screen-space `_floats` array pops a "+n" number near the collected
    pigment's HUD jar on each orb pickup (rises + fades on real time, decays in
    the frame loop, capped at ~24, drawn at the end of `_drawHud` with a quick
    scale-in pop); the existing world-space `paint.note()` (+streak) and the
    `sparkles` burst already fire on the same pickup, so the pop + sparkles
    acceptance is met. (b) a short `_streakTrail` (capped ~19) is captured
    behind the frog every frame the orb streak is ACTIVE (`orbStreakState().active`),
    decays in the frame loop + draws as a fading streak in `_drawHud` (world→
    screen via `_view`). (c) the pause panel opens with a 0.15 s slide+fade
    (`_pauseOpenT`, advanced in the paused frame branch, eased via
    `clamp(t/0.15,0,1)`): backdrop + card rise+fade in, button hit-rects stay at
    their final positions (unchanged). No animation library, no new dependencies.
    Smoke stage 62: a pickup pops a HUD "+n" float (count 0→1) that decays away,
    the orb streak leaves a fading trail while moving (capped, decays to empty),
    the pause open state INTERPOLATES 0→0.53→1 (not a hard cut) + the frame loop
    advances the clock, and the pickup pop fires a sparkles burst. P10 (stage 24)
    still passes.

### Module L — Art direction / presence

- [x] **L1 — Living world pass: swaying reeds, drifting mist, water shimmer**
  — `world.js`
  - **What:** reeds sway (per-reed sine, phase from the existing reed
    `seed`, small amplitude); 2–3 soft mist bands drift across the
    playfield at very low alpha (procedural ellipses, slow parallax); a
    handful of staggered shimmer glints on open-water cells. All inside the
    existing view culling (P10).
  - **Notes:** `world.js:drawProps` already receives `now` — pure
    draw-time modulation of existing geometry; no new world data.
  - **Acceptance:** smoke stage: reed tip x-offset changes across frames
    (animated, not static) and shimmer count stays bounded; P10 stage still
    passes.
    Status: DONE (2026-09-06, v1.4 BATCH 2). Implemented pure draw-time in
    `world.js drawProps` (which already receives `now`), all inside the
    existing view culling — **no new per-world state, no world-sim change**, so
    P10 and the pacing probes (runT) are untouched. Three additions, each a
    small pure function of `now` + existing data: (a) **reed sway** — `reedSway(seed,
    now)` returns a small (±5px) per-reed sine (phase from the reed's `seed`),
    scaled by the growth factor; the reed's tip + cattail head ride the offset
    while the planted base holds (original bend/wobble + burn color preserved).
    (b) **drifting mist bands** — a module constant `MIST_BANDS` (3 very-low-
    alpha procedural ellipses, alpha ≤ 0.05) tiled across the view with a
    slow-parallax tile scroll `S = (1+parallax)*view.x + now*speed` (parallax
    < 1 so each band lags the camera = farther), plus a slow vertical bob;
    culled to the visible rect. (c) **water shimmer** — a handful of staggered
    glints on the existing `ripples` (open-water markers), capped at
    `SHIMMER_CAP = 12`, each pulsing on `shimmerGlint(i, now)` (a staggered
    sine so they twinkle out of sync). No new dependencies. Smoke stage 63:
    `reedSway` is time-animated + small (≤~5px), `shimmerGlint` is bounded
    [0,1] + staggered, there are 2-3 very-low-alpha slow-parallax mist bands,
    the world draw is still culled (localized < full), and the shimmer count
    is bounded. P10 (stage 24) still passes.

- [x] **L2 — Layered watercolor render pass: wet edges + stroke texture**
  — `world.js` / `math.js`
  - **What:** (a) wet edges: freshly painted cells get a darker wet rim that
    lightens over ~5 s (reuse the paint-cell state — no new persistence);
    (b) stroke texture: short directional brush strokes pre-baked ONCE at
    world build into an offscreen canvas per zone (seeded via `math.js`
    wobbly shapes), drawn as one cached image per zone per frame; (c) prop
    outlines get a second offset "watercolor double-stroke" at low alpha.
  - **Notes:** the pre-bake is the budget trick — stroke texture costs one
    `drawImage` per zone per frame, not thousands of strokes; bake on
    `world.build()` so it rides the existing seed system (same seed → same
    texture).
  - **Acceptance:** smoke stage: offscreen canvases created once per zone
    (count stable across frames), wet-rim alpha decays over time; P10
    still passes (this item is the one most likely to regress 60fps —
    verify the cached path, not the raw one). Status: DONE (stage 64).

- [x] **L3 — Breathing title screen + vignette/lighting polish** — `game.js` / `ui.js`
  - **What:** the title screen becomes the swamp breathing: a slow
    `worldColorSat` swell (0.35↔0.55, 8 s sine) on the existing living
    backdrop; a **scale/opacity oscillation** on the title text (a few %,
    slow sine — `titleBreatheSwell`); a frog sits idle on a lily pad (reuses
    J4's poses); menu items fade in staggered. Lighting: a soft warm radial
    glow around the frog in-expedition, plus a subtle always-on warm vignette
    layer under the existing low-HP vignette pass (gated by the same
    `options.vignette` toggle).
  - **Notes:** the title camera drift stays; the saturation swell is a
    draw-only modulation of the `worldColorSat` read — not a change to world
    state (the color-reveal single-source-of-truth invariant is preserved:
    the swell only affects the title backdrop). Pure, testable helpers
    (`titleColorSat`, `titleBreatheSwell`, `titleItemAlpha`,
    `warmVignetteAlpha`) live at the top of `game.js`.
  - **Acceptance:** smoke stage: title colorSat oscillates between the two
    bounds, the breath swell is a small bounded oscillation, menu items
    appear staggered not simultaneous, warm vignette is a bounded edge
    darkening; P10 still passes. Status: DONE (stage 65).

### Module S — Audio

- [x] **S1 — Melodic zone themes (real themes, not just drone)** — `audio.js`
  - **What:** a small lookahead step-sequencer schedules short pentatonic
    loops per zone on a new per-zone melody gain, layered ABOVE the existing
    ambient drone (drone stays as the bed; the melody is quiet, ~-4 dB under
    the ambient bed's level, wobbly detune via `_tone`'s detune param).
    Melody crossfades on zone change (its own per-zone gain ramps down while
    the new one ramps up; both ride `melodyMaster -> musicBus`, so `musicBus`
    inherits the music slider + mute for free).
  - **Notes:** scheduling via `ctx.currentTime` lookahead in the rAF tick
    (`tickMusic`, driven from `game.js`'s frame loop) — no `setInterval`, no
    audio files, no new deps; theme data is plain note arrays per zone
    (deterministic per zone: distinct root / scale / 16-step pattern / tempo
    / detune for the 4 zones + a safe fallback). `setZoneTheme` is called
    alongside `setZoneAmbient` (zone entry), `clearZoneTheme` on run end /
    quit. `_tone` gained an optional `target` node (defaults to the sfx bus)
    so the melody notes route through the zone gain.
  - **Acceptance:** smoke stage (headless AudioContext): melody gains are
    created per zone, zone switch crossfades (old melody gain ramps down +
    muted, new ramps up, both coexist during the fade), the music slider
    still scales the melody; P10 still passes. Status: DONE (stage 66).

- [ ] **S2 — Boss music + victory/defeat stingers** — `audio.js` / `game.js`
  - **What:** when the heron engages: a tense layer (low pulse + faster
    tempo) on top of the zone theme, cut on defeat. Victory stinger (major
    arpeggio swell) on boss defeat / victory screen; soft minor-descent
    defeat stinger on the player-death sequence. Trigger points all already
    exist in `game.js` (boss engage, defeat, death sequence).
  - **Notes:** the boss layer reuses the S1 sequencer (extra voices + tempo
    multiplier); stingers are short one-shots built from `_tone` / `_noise`
    — same shape as existing `sfx()`.
  - **Acceptance:** smoke stage: engage schedules the boss layer, defeat
    fires the victory stinger + cuts the boss layer, death fires the defeat
    stinger; audio scheduling does not affect frame timing (P10 passes).
    Status: TODO.

- [ ] **S3 — Painting sound-design pass: thicker brush, pigment timbres**
  — `audio.js`
  - **What:** the swipe becomes a thicker wet-brush swish (filtered noise
    with a lowpass sweep + a droplet pluck); each pigment gets a distinct
    pluck timbre — red warm/bright, blue cool/low, green mid with a shimmer;
    the splash gains a watery "blub". All through the existing `sfx()` name
    map, so the SFX slider + mute apply unchanged.
  - **Notes:** all `_noise` / `_tone` recipes — no assets; pigments pass an
    `opt` to `sfx()` (`game.js:289`) to select the timbre variant.
  - **Acceptance:** smoke stage: swipe/splash per pigment dispatches a
    distinct sfx variant (assert the variant key, not the waveform); P10
    still passes. Status: TODO.

### Module M — Moments / delight

- [ ] **M1 — First-victory cinematic (letterbox bloom, skippable)** — `game.js`
  - **What:** on a first Normal victory only (new save flag
    `firstVictoryShown`, **SAVE_VERSION 7→8** with a migration): letterbox
    bars slide in, the camera drifts slowly over the fully-colored swamp as
    `worldColorSat` eases to 1 (reuses `restoreColor`), ~7 s, with the S2
    victory stinger. Any key/click skips straight to the victory screen.
    Never plays again; NG+ victories go straight to the victory screen.
  - **Notes:** purely presentational — reuses the end screen,
    `restoreColor`, and the L3 vignette; the cinematic is a thin wrapper
    state, not a new game state with its own rules.
  - **Acceptance:** smoke stage: first Normal victory plays the cinematic,
    sets the flag (SAVE_VERSION 8 round-trips), skip aborts to the victory
    screen, second victory skips straight; pacing probes unchanged.
    Status: TODO.

- [ ] **M2 — "Encore" gallery viewing screen** — `game.js` / `ui.js`
  - **What:** an "Encore" button on the victory screen opens a leisurely
    browse of the collection: the run's paintings first, then everything
    unlocked; full-color render, per-painting detail (atelier one-liner,
    pigments used, time to paint, expedition number), soft page-turn sfx,
    Esc/vision back. No timers, no fail state — just looking at the art.
  - **Notes:** reuses the existing gallery-wall rendering (gallery screen)
    + atelier one-liner pools + save painting records; a new screen in the
    state machine, no new data.
  - **Acceptance:** smoke stage: opens from the victory screen, renders
    every painting in the save, detail view shows one-liner + pigments,
    closes cleanly back to the victory screen; P10 still passes.
    Status: TODO.

- [ ] **M3 — Two tasteful easter eggs** — `game.js` / `world.js` / field guide
  - **What:** (1) **The other frog:** a tiny dark frog in a far Reedy Mire
    corner; aim the brush at it within 60 px for 2 s and it blinks, croaks
    once (synth), and paints one small leaf — recorded as a hidden field
    guide entry ("You are not alone."). (2) **The signed canvas:** after
    50 total lifetime paintings (save stat `paintingsCreated` already
    exists), a small signed canvas appears in the atelier with the curator's
    signature + a one-line joke on hover.
  - **Notes:** reuse field guide data, atelier UI, and existing save stats;
    both are discoverable-not-required (no map marker, no objective) —
    delight, not content.
  - **Acceptance:** smoke stage: each egg fires deterministically under its
    condition, is recorded in the save (guide entry / atelier flag), and
    does not affect run pacing; P10 still passes. Status: TODO.

### Deferred past v1.4 (and why)

- **Gamepad** — needs an input-mapping layer across `input.js` + every
  screen; an accessibility-adjacent workstream, not juice. Revisit as its
  own milestone.
- **Accessibility pass** (captions, screen-reader) — the UI is
  canvas-drawn; proper a11y needs an architecture review, not a v1.4 item.
- **Gold combat color** — combat-adjacent gold would break the meta-only
  discipline that made the v1.3 gold economy safe. Revisit only if the gold
  economy itself grows.
- **Co-op / multiplayer** — contradicts the loopback-only, single-session,
  localStorage architecture; an architecture mismatch, not a polish item.
- **Procgen** — the world is hand-tuned for the 15–20 min Normal pacing
  target; generated worlds risk that pacing. Revisit post-release.
- **Persistent paint data beyond the cell layer** — P10 budget; v1.4's wet
  marks (J1) are deliberately short-lived. A permanent extra paint layer
  would fight the culling invariant.
- **Image/audio/font assets** — invariant: zero dependencies, procedural
  only; everything above is built from `math.js` shapes, canvas, and
  WebAudio synth.
- **CRT/scanlines/retro filter** — rejected twice (v1.3); stays rejected.
  The painted-world identity has no retro mode.
