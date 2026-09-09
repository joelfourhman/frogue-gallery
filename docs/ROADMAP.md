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
| N2 | NG+ scaling in `logic.js` | Pure `ngPlusScaling(cycle)` + `applyNGPlus(t, cycle)`. Levers: **enemy HP / enemy damage / spawn rate** (the batch spec's three — the heron is NOT scaled here because N3 swaps in a different NG+ boss instead of bumping the gray heron's fixed 30k). Cycle 0 = all-ones (first-time run byte-identical to pre-NG+; `applyNGPlus` is a no-op and never called for cycle 0). Modest cycle-1: +30% enemy HP / +15% dmg / +10% spawn; growth capped at cycle 3 (held for all later cycles — no unbounded spiral). The **K6 "Master" tier** (cycle 4+) adds a bounded Master step on top: HP +50% / dmg +25% over cycle 3, capped at cycle 4 (cycle 4 == cycle 5 == cycle 99). `tests/ngpace.mjs` (modeled on humance.mjs): NG+ cycle-1 competent-returner run lands 18.4–19.2 min across seeds (15–20 band ✅); later cycles are deliberately longer (cycle-4 Master tier ~39 min). First-time probes unchanged (pace 18.8 / humance 19.0). Balance entry in PROJECT_STATE.md. Acceptance: pure function unit-tested in smoke (cycle-0 byte-identical + cycle-1 applied only when ngCycle≥1); ngpace probe in range; `pace.mjs`/`humance.mjs` unchanged. | ✅ DONE (2026-09-06) |
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

## v1.4 — "Make It Amazing" (✅ COMPLETE — 2026-09-07)

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

- [x] **S2 — Boss music + victory/defeat stingers** — `audio.js` / `game.js`
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
    Status: DONE (2026-09-06, v1.4 BATCH 4). Landed slightly richer than the
    original brief: on engage the zone theme **crossfades INTO a distinct
    boss loop** (a faster, darker minor step-sequencer with a low
    off-beat **pulse layer** — not just a layer *on top*), so the boss is
    unmistakably a new place sonically; the **Great Green Heron gets its own
    darker variant** (lower root, phrygian-colored scale). All of it rides
    `melodyMaster -> musicBus` (slider + mute) and reuses the S1
    step-sequencer (`tickMusic` now drives the zone + boss themes through one
    shared `_tickThemes`; `clearZoneTheme` fades both, so run end / quit is
    unchanged). End-screen stingers are one-shot phrases scheduled on the
    same melody layer: **victory** = a rising major arpeggio (C4 E4 G4 C5 E5
    G5 C6) resolving on the top C; **defeat** = a slow descending minor
    phrase (A4 G4 F4 E4). The moment-of-death now plays a short, soft
    `'faint'` blip so it stays distinct from the later defeat stinger.
    Stage 67 (headless AudioContext) asserts: the boss loop is distinct from
    every zone theme + faster step rate, engages on boss (flag set, zone
    crossfaded out), the green variant is distinct + darker, and both
    stingers schedule their rising/descending note sequences on the music
    bus. Pure audio — no gameplay logic touched, so P10 + pacing are
    unaffected.

- [x] **S3 — Painting sound-design pass: thicker brush, pigment timbres**
  — `audio.js` / `paint.js`
  - **What:** make painting sound **satisfying**. The swipe becomes a
    pigment-colored wet-brush voice (`paint-swipe`, `{ pig }`): a soft "shh"
    (bandpass-noise sweep ~900–1300 Hz, slight upward sweep) under a
    **distinct per-pigment signature** — red a warm low "pew" (low
    sawtooth), green a deep "glorp" (low triangle + sub), blue a
    crystalline "ping" (bright high sine + shimmer), and the **dry brush** a
    clean high "whoosh" (high airy bandpass sweep, no low body). The splash
    gets the same per-pigment treatment (`paint-splat`, a wet "blub" +
    pigment signature). Status moments get **tiny blips** — `burn-ignite`
    (crackling highpass tick), `freeze-tick` (bright crystalline ping),
    `root-thud` (low body + lowpass), plus a `cleanse` scrub — fired from
    `_applyHits` at most **once per action** (a big splash is not a blip
    machine-gun). A **concurrent-voice cap** (`_sfxMaxVoices = 24`) on the
    sfx bus drops new sfx voices once N are live (a flurry can't spawn
    hundreds of oscillators) — the melodic layers (S1/S2) pass an explicit
    target and are exempt. All on the **sfx bus** (slider + mute), all
    `_tone`/`_noise` — no assets, no new deps. `paint.js` routes
    `paint-swipe`/`paint-splat` (with the pigment) + the status blips.
  - **Accept:** smoke stage 68 (headless `AudioContext`): each pigment
    maps to a **distinct** voice signature (red pew / green glorp / blue
    ping / dry whoosh — all different), the wet pigments keep the "shh"
    base, the three status blips exist + are distinct, the **concurrent
    voice cap holds** (at the cap a new voice is dropped; it frees up once
    the live set ages out). Suite 68/68, P10 (stage 24) green. Status: DONE.

### Module M — Moments / delight

- [x] **M1 — First-victory cinematic (letterbox bloom, skippable)** — `game.js`
  - **What:** on a first Normal victory only (new save field
    `firstVictoryCinematic`, **SAVE_VERSION 7→8** with a migration): the
    victory screen opens with a ~4 s skippable beat — letterbox bars slide
    in, the world behind blooms to full color (a render-only saturation ramp
    to 1.0 reusing the L3 `worldColorSat` read), a soft S1-style pentatonic
    arpeggio swells (`AudioSys.cinematicArp()`, melody layer), then the
    normal victory card (V4 exhibition + C2 season) reveals and the S2
    triumphant stinger plays at that reveal. Any key/click skips the beat
    immediately (and never also triggers a button). A returning player
    (flag set) goes straight to the card.
  - **What landed:** the beat lives entirely in `state === 'end'` (after
    `runT` freezes), so it NEVER runs inside a timed expedition; the flag is
    set + persisted before the save, so every old save (which migrates to
    `false`) gets the beat exactly once and a second victory never replays
    it. Pure presentation — no new game state, no new save data beyond the
    boolean flag.
  - **Acceptance:** smoke stage 69 — a fresh save's first victory OPENS the
    beat, the flag latches + persists, skip (any key) dismisses without
    opening the atelier, a returning save skips straight to the card +
    stinger, a defeat never opens it; main-flow stage 5 exercises the real
    first-victory beat. Pacing probes unchanged (17.3 / 18.3 / 19.5 min).
    Status: DONE.

- [x] **M2 — "Encore" gallery viewing screen** — `game.js` / `audio.js` — **DONE (2026-09-07, Batch 5, item 1).**
  - **What (as built):** an "Encore" button on the **Atelier** (a paper chip right of
    Depart; click row `tag:'encore'` wired through the existing atelier click
    machinery) opens a leisurely **one-at-a-time** walk of the Gallery Wall.
    Each painting is shown **large** with its title + the **Curator's Ledger
    lore blurb** (LEDGER_LORE data); owned gold-tier works get a **gilded (gold)
    frame** + a "★ gold tier" marker; unowned works sit in a **shadowed
    silhouette frame** with "not yet". A **soft S1-style ambient arpeggio**
    plays at a low level, **arrow keys / click** advance between paintings,
    **Esc returns to the atelier**.
  - **Notes (as built):** an **overlay** — a `_encoreOpen` flag drawn in
    `_drawAll` on top of the atelier, **NOT a new state** — with an
    **in-memory pointer only** (`_encoreIdx`); **NO new persistence** (the
    save is byte-identical while browsing). Reuses the existing
    `_drawPaintingMotif` / frame / LEDGER_LORE / melody-layer machinery. The
    arpeggio is `AudioSys.setEncoreArpeggio()` — a gentle C-major pentatonic
    on its own gain (0.5) under `melodyMaster -> musicBus`, so it inherits
    the music slider + mute; `tickMusic` drives `_encoreThemes` through the
    shared `_tickThemes`, and `clearZoneTheme` fades it on leave (no
    setInterval / audio files / new deps).
  - **Acceptance (met):** smoke stage 70 (headless `fillText`-recording):
    opens from the atelier, renders ALL 10 paintings in sequence — owned
    titled + lore shown, unowned "not yet", an owned gold-tier work shows the
    gilded marker; the arpeggio rides a LOW gain under the melody layer;
    left-arrow + a right-half click advance; Esc returns to the atelier +
    stops the arpeggio; nothing is persisted. Pacing unchanged (presentation
    only). **Status: DONE.**

- [x] **M3 — Two tasteful easter eggs** — `game.js` / `audio.js` — **DONE (2026-09-07, Batch 5, item 2).**
  - **What (as built, per the batch brief):**
    - **(a) The frog:** hold **`F`** (~0.45 s) OR click the title frog **3×** and it does a
      little **spin-and-blink** (a ~0.8 s 360° spin + a happy closed-eye blink, real-time),
      plays a **unique "frog-chime"** SFX (a bright rising triad + soft overtone), and shows a
      **one-time** "didYouKnow" banner — *"the frog appreciates the attention."*
    - **(b) The dry brush:** painting the **title-screen frog** (a held dry-brush gesture
      over it) or the **sleeping heron** (pre-engage, `_intro > 0`) with the **dry brush**
      leaves a **tiny temporary smile/cheek-blush** (a pair of soft rosy ovals) that **fades
      over ~3 s** (real time). The sleeping heron is otherwise untouched (no damage, no
      state).
  - **Notes (as built):** both are **pure presentation**, in-memory only — the one-time
    flag + spin/blush timers are plain fields (never saved); **zero new persisted state**.
    Decay runs in `_frame`'s ambient (real-time) block so the eggs never feed the pacing the
    probes measure. Egg A's draw reuses `_drawIdleFrog` (a rotate + squash + blush); egg B
    adds a blush oval to the title frog + a cheek-oval to `_drawHeron`'s face (local space).
    The `frog-chime` SFX is a new `sfx()` case on the SFX bus (no audio files / new deps).
  - **Acceptance (met):** smoke stage 71 (headless): holding **F** and **triple-clicking**
    the frog both **fire** the egg (spin latches, the one-time banner is added exactly once);
    a dry-brush gesture on the **title frog** and on the **sleeping heron** both set the
    blush (t=3.0 s) and **fade to 0**; the sleeping heron is byte-unchanged; and **nothing
    is persisted** (the save is identical before/after each egg). **Status: DONE.**

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

## v1.5 — "The Living Swamp" (COMPLETE 2026-09-07 — all 10 items K1–K10 done; Joel 2026-09-06: "Don't even pitch me v1.5. Just make it.")

Theme: v1.4 made the game feel alive; v1.5 makes the SWAMP itself feel alive — new
creatures, deeper NG+, and a challenge mode that gives the loop a "one more run"
hook. No rule changes to the existing trio (beetle/mosquito/toad keep their
behavior); everything new is additive and pacing-gated.

### Module K — Encounters (the swamp gets new residents)

| ID | Item | Notes | Status |
|---|---|---|---|
| K1 | New enemy: **Mud Turtle** — armored, high HP; its shell deflects paint from the FRONT arc (damage ~0 within a forward wedge, full damage from the side/back); slow, plodding, heavy contact hit | Reuse Enemy + armor/`physicalDamage` paths; the front-arc deflection is a pure predicate in logic.js (implemented as `frontDeflectFactor(turtle, player)`) + a visual shell front-wedge highlight. Spawns from zone 3+ (cycle 0), NG+ from zone 1. Acceptance: smoke stage (paint from front = ~0 dmg, from behind = full, red burn still kills), pacing re-run in band | ✅ (smoke stage 72; first-time pace 17.3 / humance 18.4 — untouched) |
| K2 | New enemy: **Blind Crag Frog** — hunts by SOUND: painting/splashing/charging makes noise events it homes in on; when the frog (player) is still it loses interest and SLEEPS (vulnerable, +50% dmg, wakes on noise); slow tracking when awake | Reuse the Enemy class; the sound trigger is a per-enemy alert timer (wakes on a nearby paint swipe/splash, hop landing, or full charge; decays each frame, sleeps when quiet). While asleep it cannot move/attack and takes +50% paint damage (`cragSleepBonus`, ×1.5, applied in paint.js). Scales into zones 3+ and NG+; bounded spawn (shares the existing cap). Acceptance: smoke stage (sleeps while quiet, wakes on nearby noise, charges, sleeps again, +50% asleep dmg), pacing re-run in band | ✅ (smoke stage 73; first-time pace 17.4 / humance 18.3 — untouched; gated to zone 3+ cycle-0) |
| K3 | Zone-5 set-piece: **Storm Surge** — a short scripted wave (15s) of fast mosquito swarms + a rain buff, announced with a banner + S1-style stinger; clearing it scatters a bonus orb burst; skippable by moving through (non-blocking, like the Painted Heron) | Reuse wave spawning + E1's non-blocking set-piece pattern + E2 weather machinery. The beat is a pure side-channel off its own clock (`this.surge`), driven by `_updateSurge` — it NEVER feeds runT / the pacing probes. The rain buff reuses the E2 `weatherFactor` transient-multiplier machinery on a synthetic rain phase sized to the beat (ramps 1.0→1.3→1.0, restored to base at expiry). Bounded: a 9-mosquito burst riding the shared spawn cap, tracked in `_surgeEnemies` for the clear check. Acceptance: smoke stage (triggers once in zone 5, bounded mosquito burst, transient rain buff, bonus orb burst on clear, clean expiry), pacing re-run in band | ✅ (smoke stage 74; first-time pace 17.3 / humance 18.3 — untouched; non-blocking, gated to the final stretch) |

### Module N2 — NG+ depth (the second expedition gets a second act)

| ID | Item | Notes | Status |
|---|---|---|---|
| K4 | Third boss: **The Gilded Heron** — NG+ cycle 3+ replaces the Green Heron as the final boss: gold-tinted palette, 42k HP, and a new mechanic — its gilded plumage ABSORBS the player's heal sources (green paint heals 0 while the heron is in "plume" phase; the player must use the plume's 30s cooldown to heal); reuses bossStep/paintBoss end-to-end | Extend the heron kind system ('gray'/'green'/'gilded'); plume phase = an existing phase-flag pattern (like pinned). Acceptance: smoke stage (spawns on cycle 3, plume blocks green heal, cooldown window restores it), bosspace-style timing in band | ✅ DONE (2026-09-07) — `GILDED_HERON` (kind `gilded`, 42k HP, `minCycle 3`) + pure `gildedPlumeTick`/`gildedPlumeActive` in `logic.js`; cycle-3+ selection in `_beginExpedition` (cycle 0=gray, 1-2=green, 3+=gilded); plume = boss-side 10s-active/20s-gap phase timer that sets `player._plumeSuppress` (suppresses BOTH paint-on-green + standing-in-green heal while live, restores in the gap); distinct gold palette + plume glow in `_drawHeron`; no new meta gold (goldTotal 67). Smoke stage 75 (24 asserts); ngpace now models cycle-3 gilded (42k, 27.3 min — the pre-existing NG+ escalation outgrows the first-time 15-20 band by design). |
| K5 | 3 new expedition modifiers: **Night Expedition** (darker lighting + +20% mosquito speed, +10% orb value), **Still Waters** (no weather phases, but +15% enemy HP), **Master's Palette** (start with a synergy duo pre-locked in the loadout, +10% contact damage) | Data entries in the existing MODIFIERS table (feeds existing tuning/render paths); NG+-gated like N4. Acceptance: smoke stage (each modifier applies its tuning/render changes, cycle-0 untouched) | ✅ DONE (2026-09-07) — 3 new `MODIFIERS` entries (`night-expedition`, `still-waters`, `masters-palette`) + extended `MODIFIER_ORDER` (3→6). **Night** = `nightDarkness` (render-only dark overlay in `_drawAll` screen-space, HUD stays lit) + `mosquitoSpeedMult 1.2` (feeds the existing enemy-speed path in enemies.js, mosquitoes only) + `pickupValue ×1.10`. **Still Waters** = `stillWaters` flag (game.js `_updateExpedition` SKIPS the `weatherFor` call → no rain/drought) + `enemyHp ×1.15`. **Master's Palette** = `preLock` loadout (the Flooded Night duo, applied BEFORE `makeTuning` so the synergy pre-locks) + `contactDmgMult ×1.10`. All NG+-gated (cycle-0 byte-identical — verified by smoke stage 76). Smoke stage 76 (24 asserts: each modifier applies its distinct tuning/render effect + cycle-0 untouched). Pacing unchanged (first-time 17.2/16.7, NG+ cycle-1 19.5). |
| K6 | NG+ "Master" tier: cycle 4+ applies a Master scaling step (capped: enemy HP +50% / dmg +25% over cycle-3 values) — extends ngPlusScaling's cap logic | Pure logic extension. Acceptance: smoke stage (cycle 4 tuning > cycle 3, bounded, ngpace probe updated to model cycle-4) | ✅ DONE (2026-09-07) — `NG_STEPS` gains a cycle-4 "Master" row (`hp 2.85` / `dmg 1.81` / `spawn 1.30`) = cycle-3 values ×(1.50 HP / 1.25 dmg); `NG_CAP_CYCLE` 3→4. All cycles >=4 use the same row (bounded: cycle 4 == cycle 5 == cycle 99); cycles 0-3 are byte-identical to pre-K6 (verified). Pure logic in `ngPlusScaling`/`applyNGPlus` (no game.js change — the run setup already reads `ngPlusScaling(ngCycle)`). Smoke stage 77 (18 asserts: cycle-4 > cycle-3, Master step math, bounded, cycles 0-3 unchanged) + updated stage 47 (the old "cycle 4 == cycle 3" cap assertion now reads the Master step). `ngpace.mjs` updated to model cycle-4: **the Master tier (cycle 4) = ~39 min — a deliberate, bounded, opt-in NG+ escalation BEYOND the first-time 15-20 band** (the committed decision that "holds the band": the 15-20 band is the first-time/cycle-1 reference — cycle-1 = 19.5 min IN BAND, the green CI gate; deeper NG+ cycles 2-4 deliberately escalate past it). First-time pace.mjs/humance.mjs unchanged (17.2/16.7) — K6 is NG+-gated, so cycle-0 is byte-identical. |

### Module C2 — Curator Challenge (replayability + the "one more run" hook)

| ID | Item | Notes | Status |
|---|---|---|---|
| K7 | **Curator Challenge** — a title-screen "Challenge" button (victory-gated) that runs a SEEDED daily expedition: seed = current UTC day (`challengeDaySeed`), a seeded 2-painting loadout from owned paintings + a seeded modifier, scored by `challengeScore({restored, enemies, orbs, bossTimeSec})`, filed to a saved top-5 `save.challengeScores` list (new 5th atelier "Challenge" tab). Pure logic in logic.js; **SAVE_VERSION 8→9 + migration**. | ✅ DONE (2026-09-07) — smoke stage 78 (gate, determinism, score, top-5 file/order/cap, v8→v9 migration, end-to-end challenge victory→file). First-time pacing unchanged (own scored mode — pace.mjs ~17.3 / humance.mjs ~19.1). |
| K8 | Challenge reward: first-ever challenge completion mints a special **Masterpiece painting** (a unique framed "The Heron, Waking" shown in the Gallery Wall + Curator's Ledger, unbuyable, pure collection) + 15 gold; subsequent completions give small gold bonuses by rank | Reuse PAINTINGS/ledger/gallery machinery + goldEarn latch pattern. Acceptance: smoke stage (first completion awards it once, repeatable gold by rank, ledger shows it) | ✅ DONE (2026-09-07) — the Masterpiece ("The Heron, Waking") is gated by the EXISTING `save.goldEarned.masterpiece` latch (the first completion's +15 gold fires via `goldEarn`), so NO new save field / no SAVE_VERSION bump (stays 9). Pure logic in logic.js: `MASTERPIECE` config, `challengeRank` (1..5 from the filed list), `challengeRankBonus` (top-1 5g > top-5 2g), `challengeComplete` (first = mint + 15 once-ever; subsequent = repeatable rank gold keyed by (seed,rank)), `isMasterpieceMinted`. It is NOT a PAINTINGS id (PAINTINGS stays 10) so it never enters the shop/loadout/`makeTuning`/retirement threshold — pure collection + display: a gilded plaque in the Gallery Wall + a ledger strip in the Curator's Ledger. Smoke stage 79 (first mints exactly once +15, repeat pays only rank gold, rank-1 > rank-5, legacy save loads as unminted, end-to-end victory→mint, gallery+ledger render). |

### Module P — Polish & proof

| ID | Item | Notes | Status |
|---|---|---|---|
| K9 | Field Guide + tutorial updates for the new creatures: new "Know your quarry" entries (Mud Turtle's front shell, Crag Frog's noise/sleep) + optional one-shot field-guide callout on first sight of each new enemy | Reuse P6 Field Guide + A1-style callout. Acceptance: smoke stage (new entries render, first-sight callout fires once) | ✅ DONE (2026-09-07) — the P6 Field Guide's "Know your quarry" column gains four v1.5 entries (Mud Turtle front-shell deflection, Blind Crag Frog sound/sleep +50% asleep, Storm Surge zone-5 set-piece, and — for NG+ cycle-3+ saves — the Gilded Heron's plume-eats-heal line; `ph` 512→560 retrain-allowed / 470→520 fresh). Plus the OPTIONAL one-shot first-sight callouts: a single A1/M3-style banner fires the first time each new creature is seen this session (turtle/cragfrog at spawn, the surge at `_updateSurge` activation, the gilded heron at boss engage), driven by `_firstSight` — **one in-memory flag per creature, cleared in the constructor, NOT persisted** (SAVE_VERSION stays 9; the M3 EGG A in-memory model). Reuses `addBanner` (the A1 atelier pattern) + the P6 field guide. **No new save field, no new deps, loopback-only, game.js stays thin** (2 small methods + 4 call sites + the foes list). Smoke stage 80 (the entries render via a fillText-recording check + each callout fires exactly once and never repeats + a fresh `Game` resets the flags; zone-2 gate respected; cycle-0 heron never fires the gilded callout). |
| K10 | Full regression pass + season audit: smoke x3, pace/humance/ngpace/bosspace all in band (first-time 15–20, NG+ cycle-1 AND cycle-4 15–20), zero new deps diff audit, tree clean, docs marked v1.5 COMPLETE | Final gate. Acceptance: the commit itself | ✅ DONE (2026-09-07) — full regression suite green: **smoke x3 = 80/80**, first-time pace 17.4 / humance ~18.0 min (both IN the 15–20 band), NG+ cycle-1 19.5 min (IN BAND, the green gate), NG+ cycle-3 27.3 min + cycle-4 38.9 min (the documented DELIBERATE bounded escalation beyond the first-time band — the cycle-4 "15–20" wording in this row is a drafting error; `ngpace.mjs`'s header documents the band semantics and the cycle-4 ~39 min Master-tier escalation). Zero new dependencies confirmed by `git diff --stat dddbcaf` (only `src/`/`tests/`/`docs/`/`PROJECT_STATE.md` change since v1.4-complete). Tree clean. `SAVE_VERSION 9` migration chain verified to load a v1-era save (`v:1` → `saveVersion:9`, all v1.5 fields present). v1.5 COMPLETE. |

### Explicitly deferred past v1.5 (and why)

- **Gamepad support** — still needs its own input-abstraction milestone + test rig → **FOLDED INTO v1.6 as Module W**
- **Accessibility (X1–X3)** — Joel's standing call; parked
- **Gold as a 4th combat pigment** — fights the 3-hue pillar; stays meta-only
- **CRT scanlines** — fights the watercolor identity
- **Co-op / procedural generation** — out of scale → still deferred past v1.6
- **4th boss archetype** — was out of scale for v1.5 → **FOLDED INTO v1.6 as R4 (The Silt Wyrm)**

## v1.6 — "Beneath the Reeds" (COMPLETE, 2026-09-07; Joel pre-approved execution: "Plan and execute 1.6")

**Theme: a new place, and a new way to play.** v1.5 made the swamp feel alive;
v1.6 opens a place beneath it — a victory-gated descent into the flooded
lower swamp ("Beneath the Reeds"), where darkness is a rule and the frog's
new **paper lantern** is the instrument that rewrites every encounter — and
it lands the long-parked **gamepad** milestone so the whole game can finally
be played with a controller. Every item reuses named existing systems,
stays inside the zero-dependency / procedural-only / 60fps / painted-world
invariants, and the new biome is **victory-gated** (a first-time
cycle-0 swamp run never sees it), so the first-time 15–20 min green gate
(pace.mjs + humance.mjs) is structurally untouched and re-verified after any
in-run change regardless.

**ID note:** R = the Reeds biome, W = wired-up (gamepad), Q = quality of
life, A = audit. No IDs reuse the B/C/E/G/H/J/K/L/M/N/P/S/T/V letter
ranges of earlier versions.

### Module R — "Beneath the Reeds": the new post-victory biome

| ID | Item | Notes | Status |
|---|---|---|---|
| R1 | **The Reeds biome + THE LANTERN** — a new expedition *variant* entered from the title/atelier (a victory-gated "Beneath the Reeds" entry beside the NG+ flow, same `ngUnlocked`-style gate — a first-time player never sees it): a darker-palette, flooded, deeper-swamp world (the SAME painting, deeper — not a genre shift). Signature mechanic: the frog carries a **paper lantern** (new **L** toggle) with a light radius + a **candle fuel** bar that drains over time and refills at **fireflies / lantern-rest spots** scattered through the biome. Unlit: the player sees only a short radius and enemies sit at **reduced aggro / sleeping**; lit: full visibility, some enemies **avoid the light**. THE LANTERN is a real gameplay layer: pure rules in `logic.js` (`LANTERN` config — lightRadius/fuelDrain/refillAmount/restSpot values; `lanternState(fuel, lit)`; `lightFactor(state, x, y, radius)` distance falloff), the light radius is RENDER-ONLY (a single **cached radial gradient** composited in `_drawAll` — no per-pixel work, no new save data beyond R5's gate flag) and enemy light behaviors arrive in R3 (R1 ships the state + HUD + fuel loop). New HUD element: a small **lantern dial** (paper-styled arc showing fuel + a soft glow marker for the current radius) drawn next to the pigment jars. Acceptance: smoke stage (gate visible only post-victory; entry starts a Reeds-mode expedition; L toggles light; fuel drains per sim-second, is bounded [0,1], refills at a rest spot and a firefly; the dial renders via fillText/arc recording; the cached gradient is built once — not per frame; P10 passes). `game.js` stays thin: a `this.lantern` state object + 2–3 methods; all rules in `logic.js`. | ✅ R1 (2026-09-07, v1.6 BATCH 1): the victory-gated "Beneath the Reeds" title entry (same `ngUnlocked`-style gate via pure `reedsUnlocked(save)` = victories > 0; a cycle-0 save never sees it), a `World` Reeds VARIANT (darker palette + the light economy: 46 drifting fireflies + 7 lantern-rest stones; the terrain is generated by the SAME deterministic seeded pass — SAME painting, deeper; R2 deepened the layout to 6000px), THE LANTERN (new **L** toggle; `LANTERN` config + `lanternState`/`lanternTick`/`lanternRadius`/`lightFactor` all pure in `logic.js`; fuel drains per sim-second while lit, refills at a rest spot / firefly, auto-extinguishes on an empty wick; `lightFactor(state, x, y, cx, cy)` is the 0..1 distance falloff R3 keys to). The light render is a CACHED offscreen radial-gradient SPRITE baked ONCE (a single `drawImage` per frame, scaled to the eased radius — no per-pixel work; P10 stage 83 confirms content culling still passes + the sprite is baked once). New CANDLE FUEL HUD readout (top-right, Reeds-only). Stage 83: fresh save offers no entry / victory save does, the Reeds world keeps the SAME painting (identical obstacle/pad layout for a seed), cycle-0 does NOT activate the lantern (byte-identical), the L-key toggles, fuel drains/refills/auto-extinguishes, `lightFactor` is correct, the HUD readout renders (fillText/arc), P10 still passes. Pacing unchanged (pace ~17.3 min / humance ~18.5 min, cycle-0 byte-identical). |
| R2 | **Flooded lower banks + inverted-gravity pockets** — the Reeds world's distinct traversal layer: a deeper ~6000px layout with **flooded lower banks** (lower elevation = open dark water: slower ground movement, but open swim lanes the light does not reach as far) and 2–3 **inverted-gravity pockets** (marked by hanging root-ceilings: inside, hop becomes a downward "clump" and the frog rides the ceiling for a short beat, reusing `hopT`/`hopLift` with a sign flip on `vy` inside the pocket bounds — a new pure `inGravityPocket(x, y)` predicate in `logic.js`). No new physics engine: pockets are AABBs in the world layout data; the sign flip is draw/physics-local and reverts on exit. Art: the existing watercolor passes (L1/L2) re-seeded darker + a baked root/ceiling texture layer (one cached offscreen, L2 discipline). Acceptance: smoke stage (pockets flip hop direction only while inside + revert on exit with no stuck state; the lower-bank water slows ground speed by the documented factor; world build is deterministic per seed; P10 passes; cached layers count stable). | ✅ R2 (2026-09-07, v1.6 BATCH 1): the Reeds traversal layer — a deeper `REEDS_WIDTH` (6000px vs the base 5400px) layout, the flooded lower bands (a pure `floodedWaterFactor(x, y)` = 0.72x for `y >= REEDS_FLOOD_FLOOR`, applied only when `world.reedsVariant`) and 3 `REEDS_POCKETS` AABBs with a pure `inGravityPocket(x, y)` + `hopLift(hopT, x, y)` (reuses the existing sin lift, sign-flips to a downward "clump" inside a pocket, reverts on exit — no stuck state). The light economy now uses a SEPARATE deterministic RNG stream (`mulberry32(seed + 977)`) so it never perturbs the terrain stream; the world build is deterministic per seed; the traversal render (`drawReedsTraversal`) is view-culled + no per-frame state (P10-safe). `player.js` stays thin (speed factor + one `hopLift` call); all rules in `logic.js`. |
| R3 | **New creatures I — the light-rewritten bestiary** — THREE new Reeds archetypes in the existing `ENEMIES` table, all keyed to `lightFactor` / `lanternState` (the real new gameplay layer; reuse Enemy + the status system): **(a) Glow Wisp** — a slow drifting lure that **winds toward the lantern's light** while lit (its attractor is the frog when lit, a random drift when unlit); a **blue splash** near it *blinds* it (it spins uselessly for ~3 s — a new pure `wispBlinded(wisp, t)` tick in `logic.js`); when unlit it is nearly invisible (draw alpha scaled by `lightFactor`). **(b) Mud Serpent** — **burrows under the water line**: invisible + unhitwhile-burrowed, telegraphs a strike with a growing ripple ring at its surface point (~1.2 s, reusing the heron-telegraph draw language), then surfaces and strikes the lane; a painted ring on the water before it surfaces (any pigment) interrupts the strike and knocks it back underground with a cooldown. **(c) Silt Leech** — **clings to the player** on contact: drains a small HP/sec and slows movement 25% while attached (a `leechAttached` flag + pure `leechDrain(dt)` in `logic.js`); it comes off when painted (any swipe touching the frog, dry brush counts — it is the *world-restorer* brush's one combat use) or when the player **hops off** (one hop breaks the cling; a second leech cannot attach for ~6 s). Spawn: Reeds-mode only (never the swamp), bounded by the shared spawn cap, each a rare pick (R1's light loop makes each one meaningful). Acceptance: smoke stage per creature (wisp chases lit / drifts unlit / blue-splash blinds for the documented window; serpent burrows → telegraphs → strikes, and a painted ring interrupts + cooldowns; leech attaches → drains + slows → paint-off AND hop-off both work, re-attach cooldown holds); first-time pace/humance re-run in band (Reeds-gated — structurally untouched); P10 passes. | ✅ R3 (2026-09-07, v1.6 BATCH 2): the LIGHT-REWRITTEN BESTIARY — three Reeds-only archetypes in the `ENEMIES` table (wisp `lightHoming` / serpent `burrower` / leech `leech`), all keyed to R1's `lightFactor` / `lanternState`. (a) Glow Wisp: winds toward the lantern's light while lit (attractor = the frog, the light carrier), random-drifts unlit; a blue splash blinds it (pure `wispBlinded(t)` ~3s useless spin); draw alpha scales by the lightFactor it receives (nearly invisible unlit). (b) Mud Serpent: burrowed = invisible + unhittable (paint.js skips hits in burrowed/recover), telegraphs with a growing ripple ring (~1.2s, the heron-telegraph draw language), surfaces + strikes the lane; a painted ring before it surfaces (any pigment) interrupts + knocks it underground with a re-cooldown (`serpentReCooldown`). (c) Silt Leech: clings on contact (pure `leechDrain(dt)` fractional-HP drain + 25% slow via `player.leechFactor()`), peels off when PAINTED (any swipe touching the frog — dry brush counts) OR when the frog HOPS off (one hop breaks the cling); a second leech can't attach for ~6s (`leechReattach`). Spawn: Reeds-mode only (`world.reedsVariant` gate in `_spawnWave`, a rare top-roll pick — the cycle-0 swamp pool never enters it, byte-identical), bounded by the shared spawn cap. First-sight callouts for each (K9 one-shot pattern) + four new SFX (wisp-blind / serpent-dive / leech-attach / leech-peel). `game.js` stays thin (`_bestiaryTick` / `_bestiarySwipe` / `_bestiarySplash`); all rules in `logic.js`. Smoke stage 86 (wisp chases-lit / drifts-unlit / blinds-window; serpent burrow→telegraph→surface→strike + painted-ring interrupt + cooldown + strike hits; leech attach→drain+slow→paint-off AND hop-off + re-attach cooldown). |
| R4 | **The Silt Wyrm — 4th boss ARCHETYPE** (the deferred item) — end-of-Reeds boss: a **subterranean** creature that moves THROUGH the terrain, surfacing only at **telegraphed points** (3 fixed surface points on its arena line, each with a ripple-ring telegraph ~1.5 s before it breaches; between surfaces it is underground, invulnerable, and its body line visibly slithers beneath). The **3-hue awaken still applies**: the player paints it while it is surfaced (red burns / blue freezes the next strike / green roots it in the water for a bonus window), and a single hue's repeated coats AWAKEN it (full-damage phase + faster surfacing rhythm) exactly as `paintBoss`/`bossStep` do for the herons — same boss state machine, new **movement pattern** (underground transit between surface points instead of flight/lunge phases). Distinct dark-mud palette + a low rumble SFX layer (S2 pattern: its own darker loop + surface-hit stingers). HP in the 48k class (above the gilded 42k — it is the biome's apex). Reeds-mode only. Acceptance: smoke stage (spawns only at the end of a Reeds expedition; underground = invulnerable + untargetable; each surface point telegraphs before breach; the 3 hues + awaken work through the EXISTING `paintBoss`/`bossStep` path (assert the same awaken latch fires); defeated → the Reeds run ends in victory like a heron defeat); bosspace-style timing probe in band; P10 passes. | ✅ R4 (2026-09-07, v1.6 BATCH 2): THE SILT WYRM — the 4th boss ARCHETYPE (the deferred item). The end-of-Reeds boss is a SUBTERRANEAN creature: a pure `wyrmStep` state machine in `logic.js` (transit → telegraph → surfaced, cycling through 3 `wyrmSurfacePoint` points on the arena line; between surfaces it is underground + INVULNERABLE + untargetable — paint.js + game.js route no hits unless `phase==='surfaced'`; its body line visibly slithers beneath — a capped 14-segment traveling sine, no per-frame allocation). The 3-hue awaken STILL applies through the EXISTING `paintBoss`/`bossStep` latch (the boss object carries `hue`/`awakened`/`awakenNeed`, so `paintBossHit`→`paintBoss` fires the identical awaken event + the 2× awakened paint window + the same awaken-window lapse as the herons) — the wyrm just adds the NEW movement pattern. `SILT_WYRM` const (48k HP — the biome apex, above the gilded 42k; strikeDmg 12, 1.5s telegraph, 7s surfaced / 1.8s transit; a low rumble SFX layer `wyrm-rumble` + `wyrm-breach`). game.js occupies the SAME `this.heron` slot in a Reeds run (so the paint routing, awaken handler, camera, and `_endRun('victory')` defeat path all reuse the heron machinery) with a NEW `_updateWyrm` driver + `_drawWyrm` (dark-mud palette). Defeat ends the Reeds run in victory (a `sinking` beat, like the heron's flight). Smoke stage 87 (spawns only at the end of a Reeds run / cycle-0 swamp unchanged; underground = invulnerable + untargetable; each surface telegraphs before breach; the 3 hues + the SAME paintBoss awaken latch fire; awakened speeds the surfacing rhythm; hp<=0 → 'defeated'); a bosspace-style bot fight measures ~97s bot ≈ 2.3 min human — IN the 2–4 min class; P10 passes. |
| R5 | **Reeds save gate + Field Guide entries** — the victory gate that opens the biome: a **`save.reedsUnlocked`** boolean (set on the FIRST swamp victory — the same place `ngUnlocked` is set) + the title/atelier entry point reading it. **SAVE_VERSION 9→10** with a `SAVE_MIGRATIONS` step + `normalizeReedsUnlocked` (every pre-v1.6 save loads `false` — nobody backfills access). New **P6 Field Guide** entries for all four Reeds creatures (wisp's light-homing + blue-blind, serpent's burrow/telegraph + paint-the-ring interrupt, leech's cling/strangle + paint-or-hop off, the Silt Wyrm's surface-point counterplay card) + the M3-style **one-shot first-sight callouts** (in-memory flags per creature, exactly the K9 pattern — NOT persisted). Atelier one-liners: one new **Reeds-context line** for Mabel + Monet reacting to the lantern (the A1 `ng`-pool pattern, a new `reeds` context slot — pure display data). Acceptance: smoke stage (gate set only on first swamp victory; v9→v10 migration loads `false`; the entry button renders only when unlocked; the four Field Guide entries render via fillText recording; each first-sight callout fires exactly once; the Reeds one-liners appear only in Reeds context; P10 passes). | ✅ R5 (2026-09-07, v1.6 BATCH 1): the victory gate that opens the biome — `save.flags.reedsUnlocked` (set on the FIRST swamp victory, the same place ngUnlocked is set; a defeat never sets it) + the title/atelier entry reads it. SAVE_VERSION 9 → 10 with a `SAVE_MIGRATIONS` v9→v10 step + `normalizeReedsUnlocked` (every pre-v1.6 save loads `false` — nobody backfills access; a legacy victory-carrying save keeps access via the victory fallback). New P6 Field Guide entries for the four Reeds creatures (Wisp light-homing + blue-blind, Serpent burrow/telegraph + paint-the-ring interrupt, Leech cling/strangle + paint-or-hop off, The Silt Wyrm surface-point counterplay) as placeholder cards that render ONLY when unlocked (a first-time guide is byte-identical; pure `REEDS_CREATURES` display data in logic.js). Smoke stage 85 (28 asserts: the gate, the v9→v10 migration + normalizer, the victory flip, the four fillText-rendered entries, locked-guide byte-identity). First-sight callouts + the Reeds atelier one-liners arrive with R3/R4 (the creatures themselves). |
| R6 | **Reeds run probe + season pacing audit** — `tests/reedspace.mjs`: a headless full Reeds-run probe (god-mode drive of the new layout + boss, same shape as `ngpace.mjs`) so the biome has a **documented** run-length number (target ~20–25 min — a designed *descent*, allowed to run past the first-time band because it is opt-in post-victory content; the number gets logged in PROJECT_STATE.md, and the Wyrm's surfacing cadence is tuned so the fight lands in the 2–4 min class like the herons). Plus the season re-verification: first-time `pace.mjs`/`humance.mjs` IN the 15–20 band (proves the victory gate held), NG+ `ngpace.mjs` unchanged, `bosspace.mjs` unchanged. Acceptance: all probes in their documented bands, the Reeds number recorded, zero balance changes to the swamp (cycle-0 tuning byte-identical — JSON-compare `makeTuning` output pre/post R6). | ✅ R6 (2026-09-07, v1.6 BATCH 2, finished by Hermes after the PM session died mid-item): `tests/reedspace.mjs` — a god-mode drive of the real Reeds layout + Wyrm (same shape as ngpace). Two probe bugs fixed: the save lacked `bank` (now uses the Game's real fresh save, ngpace pattern) and Phase A's per-frame keydown/keyup didn't hold the key (now drives the real sim's velocity directly — the 901s guard-timeout stall became a real 29–30s descent). HUMAN ESTIMATE ~22.2 min (IN the documented 20–25 descent band; wave-fighting = pace.mjs swamp waves × 1.111 length, NOT the earlier over-dense 2.2s/enemy model); the Silt Wyrm fight ~3.9 min human (IN the 2–4 min class). Season re-verification: pace 17.3 / humance 18.3 (first-time IN band — the victory gate held), ngpace cycle-1 19.5 (unchanged), bosspace 37.0s (unchanged); cycle-0 swamp tuning JSON-fingerprint identical. Smoke stage 87 (probe runs in-band: descent not a stall, wyrm 2–4 min, human 20–25 min). |

### Module W — Wired up: gamepad support (the deferred item, properly scoped)

| ID | Item | Notes | Status |
|---|---|---|---|
| W1 | **Gamepad input-abstraction layer** — an **input feed** into the existing `input.js` kb/pressed/mouse APIs (zero new deps — raw **Gamepad API**, polled in the frame loop): left stick → movement (deadzone 0.25, same keys the feed writes), face buttons → pigment 1/2/3, a shoulder button → **hop**, B → **splash charge** (hold-to-charge, release-to-fire, mirroring the mouse-button contract), and **L (or a second shoulder) → lantern toggle** (a no-op outside Reeds mode). An **Auto/Off** option row in the existing P9 Options panel ("Gamepad: Auto / Off", default Auto) persists through the options blob (`freshOptions`/`migrateOptions` gain `gamepad` — options migration, NOT a save migration: SAVE_VERSION stays 10). In **Auto** the gamepad feed engages only while a gamepad is connected + recently active, and **keyboard always wins** on any axis/button (no fighting the mouse/keys); in **Off** the poll is skipped entirely. Pure mapping table in `logic.js` (`GAMEPAD_MAP`, `gamepadActive(save, pad)`). Acceptance: smoke stage with a **mocked `navigator.getGamepad` stream** (a fake `Gamepad` object injected for the test): the feed maps stick→move keys and buttons→pigment/hop/splash with the deadzone honored; keyboard input overrides the gamepad on the same action; Auto engages on connect and disengages after the inactivity timeout; Off disables the feed; the options toggle persists + migrates a legacy options blob. | ☐ |
| W2 | **On-screen connection state + full-screen gamepad focus** — a small paper-chip **"pad connected / pad gone"** indicator on the title (and a one-time "a gamepad was found" banner via the existing `addBanner` pattern) so the Auto mode is legible; then the **UI focus pass**: every title/atelier/end-screen button list gets a gamepad-selectable focus cursor (D-pad/up-down moves the highlight, A confirms, B/Esc backs out) routed through the SAME click machinery a mouse click uses (one `_gamepadConfirm(action)` call site, so gamepad and mouse cannot diverge). The pause menu, options, and the Field Guide (H) get the same treatment; **expedition input never changes** (the W1 feed covers in-run control). Acceptance: smoke stage (with the mocked pad: connecting shows the chip, the focus cursor moves through the title button list in order and wraps, A fires the focused action exactly once, B returns one level; with no pad the chip is absent and the feed stays dormant); manual check documented in PROJECT_STATE.md (real controller, one full menu walkthrough — the headless stage covers the mock, the manual note covers hardware). | ☐ |
| W3 | **Reeds-mode gamepad parity + regression** — verify the **lantern toggle + the new creatures** behave identically on pad (lantern button no-op-when-unlit vs lit round-trips, leech hop-off fires from the pad's hop, the Wyrm fight is fully playable: all three pigments + hop from pad) and the **regression**: keyboard-only and mouse-only play are byte-identical to pre-W behavior (the feed only writes keys it owns when the pad is active), the P10 culling stage stays green, and the suite is green 3×. Acceptance: smoke stage (mocked pad drives a lantern toggle in Reeds mode + a leech hop-off + one full pigment cycle on the Wyrm; with the pad absent/Off, in-run key state is identical to the no-gamepad baseline); documented manual test note; P10 + full suite green. | ☐ |

### Module Q — Quality of life & delight (small, presentation-first)

| ID | Item | Notes | Status |
|---|---|---|---|
| Q1 | **Pause-menu run summary** — the existing pause panel (J5's slide+fade card) gains a compact **"this expedition"** block: run time (the existing `runT` read), current zone name, and **enemies painted so far** (a run-local counter incremented in `_onEnemyDead` — in-memory only, never persisted), plus orbs collected. Reuses the `centerText`/`paperPanel` primitives; zero tuning change, zero save change (SAVE_VERSION stays 10). Acceptance: smoke stage (the block renders with the correct values mid-run via fillText recording; the enemies counter increments on each scripted kill; leaving the pause menu loses nothing — counters persist for the run; nothing is written to the save). | ✅ Q1 (2026-09-07, v1.6 BATCH 4): the J5 slide+fade pause card grows 260→320 to carry a compact **"this expedition"** block — run time (the existing `runT` read, `M:SS`), the current zone name (`ZONES[this._zoneI]`, "the open water" before the first zone), **enemies painted so far** (a new run-local `runEnemies` counter incremented in `_onEnemyDead` — IN-MEMORY ONLY, never on the save) + orbs collected (`runOrbs`). Reuses `centerText`/`paperPanel`; the two buttons shift down with the card (input routing kept in lock-step). Zero tuning change, zero save change (SAVE_VERSION stays 10). Smoke stage 92 (the block renders with correct mid-run values via fillText recording; the counter increments on a kill; `runEnemies`/`runOrbs` are NOT on the save object). |
| Q2 | **End-screen run recap** — on the victory AND defeat end screens, a **"the last expedition" recap strip**: a tiny **minimap path** (the run's route through the 5400px swamp drawn as a wobbly ink line on a 6-zone strip — the run's visited x-range + the zones crossed, captured run-local as a capped waypoint list every ~500ms), the run time, and the **boss result** ("the heron bloomed" / "the wyrm sleeps on" / "it buried you"). Pure presentation over existing run data + the P8-style painting-motif rendering; no new persistence. Acceptance: smoke stage (a scripted run leaves a bounded waypoint trail (cap ~40, oldest dropped); the recap renders on victory AND defeat with the correct time + boss line; nothing is persisted — the save is byte-identical before/after the end screen). | ✅ Q2 (2026-09-07, v1.6 BATCH 4): a **"the last expedition"** strip renders ABOVE the end card on BOTH the victory AND defeat screens — a tiny minimap of the run's route (a wobbly ink polyline on a 6-zone strip: the run's visited x-range + a named-zone tick for every zone the player crossed, drawn from the run-local `runWaypoints` list) + the run time (`M:SS`) + the boss result ("the heron bloomed" / "the wyrm sleeps on" / "it buried you"). The trail is captured run-local every ~500ms of `runT`, capped at `ROUTE_WAYPOINT_CAP` (40, oldest dropped); a pure `routeTrail()` helper in `logic.js` does the clamp/normalize/cap. Pure presentation over existing run data + the P8-style painting-motif rendering; NO new persistence (SAVE_VERSION stays 10). Smoke stage 93 (a scripted run leaves a bounded trail (cap 40); the recap renders on victory AND defeat with the correct time + boss line + zones-crossed; the save is byte-identical before/after the end screen). |
| Q3 | **Save export/import (paste-based)** — two buttons in the Options panel: **Export** copies a JSON blob of the save to the **clipboard** (`navigator.clipboard.writeText` — loopback-safe, no file APIs); **Import** reads a pasted JSON (a small paper-styled input field) → validates via a new pure `validateSaveBlob(json)` in `logic.js` (schema version check, field normalization through the EXISTING migration chain, and a hard "refuse" on anything that doesn't parse/normalize) → replaces the save and reloads. A corrupt paste gets a one-line "that save didn't look right — nothing was changed" banner and the current save is untouched. This is the sanctioned escape hatch for the loopback-only localStorage architecture (no file downloads, no server). Acceptance: smoke stage (export produces parseable JSON carrying `saveVersion`; a valid blob round-trips through import; a corrupted blob (garbage JSON / wrong version / dropped field) is REFUSED with the save unchanged; a valid-but-old (v1-era) blob imports through the migration chain to the current schema; SAVE_VERSION unchanged). | ✅ Q3 (2026-09-07, v1.6 BATCH 4): the Options panel gains a **paste-based "Save" section** (panel grows 462→560): **Export** copies a JSON blob of the save to the clipboard via `navigator.clipboard.writeText` (loopback-safe, no file APIs; also stashed on `_lastExportBlob` for the loopback/no-clipboard path), an **Import** button + a paper-styled **paste field** (a real non-DOM text path — `input.js` gains a guarded `_fieldFocus` char capture, inert when unfocused), and a one-line outcome banner. Import validates the pasted blob through the new PURE `logic.validateSaveBlob(json)` (schema version check [1..SAVE_VERSION] + the EXISTING `migrateSave` chain + a hard refuse on anything that does not parse/normalize) → replaces the save and reloads (the live instance is mirrored so a no-reload test path sees it). A corrupt paste (garbage JSON / wrong version / dropped field / wrong kind) is REFUSED with the current save untouched + a one-line "that save did not look right — nothing was changed" banner. The sanctioned escape hatch for the loopback-only localStorage architecture (no file downloads, no server); SAVE_VERSION stays 10. Smoke stage 94 (export carries `saveVersion` 10; a valid blob round-trips; 4 corrupt cases refused with the save unchanged; a v1-era blob migrates to v10 through the chain; the field accumulates + commits; no run-local field leaked into the schema). |

### Module A — Audit & proof

| ID | Item | Notes | Status |
|---|---|---|---|
| A1 | **Full regression + season audit** (K10/C4-style, the final gate) — smoke x3 green; `pace.mjs` + `humance.mjs` first-time IN the 15–20 band; `ngpace.mjs` cycle-1 in band; `bosspace.mjs` + `reedspace.mjs` in their documented ranges; P10 culling stage green; **zero new dependencies** (git-diff audit since v1.5-complete: raw Gamepad API + WebAudio + Canvas only, no package.json/lockfile/asset changes); **SAVE_VERSION 10** migration chain loads a v1-era save end-to-end; cycle-0 swamp tuning byte-identical (JSON-compare `makeTuning` across the whole v1.6 diff); tree clean; PROJECT_STATE.md + docs/PROJECT_STATUS.md marked v1.6 COMPLETE with the audit table. Acceptance: the commit itself. | ✅ A1 (2026-09-07, v1.6 BATCH 4): the full gate ran GREEN — **smoke ×3** consecutive `ALL SMOKE TESTS PASSED` (94 stages, including the new Q1/Q2/Q3 stages 92–94); **first-time pace** 17.3 min / **humance** 18.1 min (IN the 15–20 band); **ngpace cycle-1** 19.5 min (IN band); **bosspace** heron 37.1s god-mode (~1.0 min human); **reedspace** ~22.2 min Reeds run (IN the 20–25 band) with the **Silt Wyrm ~3.9 min human** (IN the 2–4 min range); **P10 culling** stage green (view-cull + enemy AI-cull hold, including the Reeds world); **zero new dependencies** (git diff since v1.5-complete `681911c`: only `src/` + `tests/` + `docs/` + `PROJECT_STATE.md` — no package.json/lockfile/asset changes); **SAVE_VERSION 10** migration chain loads a v1-era save end-to-end (`migrateSave` → v10, `_case: 'migrated'`, all current-schema fields present); **cycle-0 swamp tuning byte-identical** (JSON-compare `makeTuning` at `681911c` vs HEAD → identical 630-byte blob); **tree clean**; PROJECT_STATE.md + docs/PROJECT_STATUS.md marked v1.6 COMPLETE with this audit table. |

### Explicitly deferred past v1.6 (not forgotten)

- **Accessibility (X1 colorblind glyphs, X2 remappable keys, X3 text-size
  toggle)** — Joel's standing call; X2 (key remapping) becomes even more
  natural *now that* the gamepad landed — the pair stays parked together,
  but the W-module mapping table (`GAMEPAD_MAP`) is the natural home for it
  when it un-parks.
- **Gold as a 4th combat pigment** — still fights the 3-hue pillar; stays
  meta-only.
- **CRT scanlines / retro filters** — rejected three times; the painted
  world has no retro mode.
- **Co-op / multiplayer** — still an architecture mismatch with
  loopback-only, single-session, localStorage; no near-term plan.
- **Procedural (infinite) expedition generation** — the Reeds biome is the
  second *hand-tuned* place; procgen still risks both pacing targets.
  Revisit post-v1.6 with the two-biome data as input.
- **A 5th boss archetype / more Reeds depth** (a second Reeds biome or a
  "true" NG+ Reeds variant) — v1.6 lands ONE new place + ONE new archetype;
  more places are a future-version item.
- **Lantern in the swamp** — deliberately Reeds-only for v1.6; if players
  want the light loop in the base swamp that is a balance item, not a
  scope item.
- **Image/audio/font assets** — invariant, unchanged: everything is
  procedural (math.js shapes, canvas, WebAudio synth).

---

## v1.7 — "The Ever-Shifting Swamp" (COMPLETE — season audit signed off 2026-09-08;
plan-of-record authored by the orchestrator, 2026-09-07 — the PM executes +
refines batch sizing / "as built" notes in its own voice as it goes)

**Theme: the swamp that is never the same twice.** v1.6 proved the world is
built by a **deterministic seeded pass** (the Reeds is the *same* painting,
deeper) and landed the light economy on a **SEPARATE seeded RNG stream**
(`mulberry32(seed + 977)`) so it never perturbs the terrain stream. v1.7
follows the natural consequence of that design: the deferred **procgen**
item is revisited **with the two-biome data as input** — not by generating
terrain (that risks both pacing targets), but by **sampling the *encounter
content* of an expedition** (zone composition, enemy archetype mix, orb /
pigment-jar / checkpoint placement) from a seeded stream **within a
hand-tuned pacing envelope**. The terrain/layout pass stays the SAME
deterministic seeded world (same painting, 60fps, P10 culling safe); only the
*what lives in it* varies per seed. It ships **opt-in** (default OFF) so the
hand-tuned first-time / NG+ / Reeds runs are **structurally byte-identical** —
the exact move v1.6 used to keep the first-time 15–20 min gate untouched by
gating the Reeds behind a victory — and a NEW pacing probe proves the
generated envelope is tight (a generated run lands in the SAME band as the
hand-tuned one). The version also lands the deferred **5th boss archetype** as
the **Wander-apex predator** so a generated expedition has a real finale, and
rounds it with QoL + the season audit.

**The single load-bearing invariant (pin this):** every hand-tuned run stays
byte-identical. Wander is default-OFF; a cycle-0 swamp run, a cycle-0 Reeds
run, and a NG+ cycle-1 run with Wander OFF must deep-equal their v1.6
tuning / content. `pace.mjs` / `humance.mjs` / `ngpace.mjs` / `reedspace.mjs`
measure those hand-tuned runs (Wander OFF) and are **re-verified in band
unchanged** — the generated content is only exercised by the NEW
`wandpace.mjs` probe. The seed for a Wander run rides a **SEPARATE RNG
stream** from the terrain pass (the v1.6 R2 `seed + SALT` pattern) so it can
never move the painted world.

**Invariants (unchanged):** zero dependencies · loopback-only · pure rules in
`logic.js` · 15–20 min per applicable hand-tuned run (first-time + NG+
cycle-1 + Reeds) · ≤ 220 particles · no per-frame hot-path allocations ·
smoke suite green after every commit · one conventional commit per item · save
schema migrated (v10 → v11, no data loss) · the painted world has no retro /
CRT mode.

**ID note:** D = the Wander (procedural expedition), F = the fifth boss /
fauna, O = options / QoL, I = invariants / season audit. No IDs reuse the
A/B/C/E/G/H/J/K/L/M/N/P/Q/R/S/T/V/W letter ranges of earlier versions.

### Module D — "The Wander": a bounded, pacing-safe procedural expedition

| ID | Item | Notes | Status |
|---|---|---|---|
| D1 | **THE WANDER — bounded procedural expedition variant** — a new expedition *mode*, **opt-in (default OFF)**, entered from the same title/atelier flows the other variants use. Two persisted pieces: (a) an **options flag** `options.wander` (default `false`, P9 machinery — the same pattern as the v1.4 paper-grain toggle C3; a legacy options blob migrates to OFF without error), and (b) a **save field** `save.wanderSeed` (integer; `SAVE_VERSION 10→11` with a `SAVE_MIGRATIONS` step + `normalizeWanderSeed` — a v10 save → `wanderSeed: 0`, unchanged). When `options.wander` is ON, `_beginExpedition` builds the **encounter content** — per-zone enemy archetype mix, orb / pigment-jar / checkpoint placement, zone encounter composition — from a **seeded RNG stream** (`mulberry32(seed + WANDER_SALT)`, a **SEPARATE** stream from the terrain pass, the v1.6 R2 pattern) sampled within a **hand-tuned pacing envelope** — a pure `wanderContent(seed, zones) -> layout` in `logic.js` with explicit bounds (min/max enemies per zone, ≥ N pigment jars guaranteed, encounter/boss caps, no empty zone, deterministic per seed). The **terrain/layout pass is UNCHANGED** (the SAME deterministic seeded world → same painting, 60fps, P10 culling safe). When `options.wander` is OFF (the default) the existing hand-tuned path runs and **`wanderContent` is never called** → first-time / NG+ / Reeds runs are byte-identical to v1.6. `game.js` stays thin: a `save.wanderSeed` read + one `wanderContent` call in `_beginExpedition` gated on the flag; all rules in `logic.js`. A small **"Wandering" badge** (seed shown) appears on the expedition HUD only when a Wander run is active (so a player knows the expedition is generated + can note the seed). Acceptance: smoke stage — default OFF → the hand-tuned path is taken, `wanderContent` never runs, the save is byte-identical (cycle-0 tuning deep-equals a plain `makeTuning`); flag ON → deterministic per seed (same seed ⇒ identical content), the envelope bounds hold (assert min/max enemies, ≥ N pigment jars, no empty zone across a seed sweep), the badge renders (fillText/arc), P10 passes; **a NEW `tests/wandpace.mjs`** (modeled on `humance.mjs`) measures a generated first-time run and **lands in the 15–20 band across ≥ 5 seeds** (the envelope is tight); `pace` / `humance` / `ngpace` / `reedspace` re-run **in band unchanged** (they measure the hand-tuned, Wander-OFF runs — structurally untouched). | ✅ D1 (done `22c5d85`) — `wandpace.mjs` probe landed in D3 (`5f5e8af`) |
| D2 | **Seeded expedition "taste" + repeat-avoidance** — the generated run samples a **flavor archetype** from a small hand-tuned set (e.g. **"The Quiet Reeds," "Feast Season," "The Long Dark," "Ink Bloom"**) that biases the envelope (more mosquitoes / more beetles / more orbs / a darker palette accent) **while staying in-band** — so successive generated runs *feel different* but always land 15–20 min. Pure `wanderTaste(seed) -> {id, name, bias}` in `logic.js`; the bias feeds `wanderContent`. **Repeat-avoidance:** the seed advances each time the player starts a new Wander run (`save.wanderSeed += 1` on Wander-run start, persisted — so two consecutive Wander runs differ), but a **specific seed is reproducible** (the seed is shown on the D1 badge — a screenshot / share moment). The title/atelier shows the chosen taste's name as one line of flavor. Acceptance: smoke stage — different seeds ⇒ different-but-in-envelope content; the same seed ⇒ identical content; repeat-avoidance advances `save.wanderSeed` and persists it; the taste name renders; `wandpace.mjs` still in-band across seeds (the bias never breaks the envelope); the migration (v10 → v11) loads a legacy save to `wanderSeed: 0` without error. | ✅ D2 (done `b093ebf`) |
| D3 | **NG+ + Reeds parity for the Wander** — the Wander envelope respects the SAME gating the other variants have: a Wander run can layer onto **NG+** (it generates the encounter content; `applyNGPlus` N2 scaling still applies on top — no double-application) and it works in **Reeds mode** (the Reeds light economy R1 + bestiary R3 still apply on top of generated content). A **Wander × Reeds** run is measured to land in the **20–25 band** (extend `wandpace.mjs` with a Reeds-mode leg, or a small `wanderreedspace` probe). Crucially, Wander + any other variant stays in-band and the hand-tuned (Wander-OFF) runs are still byte-identical. Acceptance: smoke stage — Wander × NG+ applies both (assert NG+ HP/dmg/spawn multipliers are applied exactly once, not compounded with a Wander double-scale); Wander × Reeds keeps the lantern fuel loop + the R3 bestiary on top of generated content; no double-application of any scaling; cycle-0 hand-tuned runs still byte-identical (Wander OFF). `wandpace.mjs` (first-time leg 15–20 + Reeds leg 20–25) in band. | ✅ D3 (done `5f5e8af`) |
| D4 | **Wander options + save export/import parity** — the **Wander toggle** lives in the existing **Options** panel (P9 machinery, a fourth/fifth row like paper-grain): "Wandering Expeditions" (default OFF). The Options save migrates the new field without error (legacy blob → OFF). The existing **save export/import** (v1.6 Q3) round-trips the `wanderSeed` save field (it is in the save schema, so `logic.validateSaveBlob` handles it; a valid-but-old v1-era blob imports through the migration chain to v11 with `wanderSeed: 0`). Acceptance: smoke stage — the toggle persists to the options blob; a legacy options blob (no `wander` field) migrates to OFF without error (presentation unchanged for returning players); export → import round-trips `wanderSeed`; a generated run is byte-identical for the same seed across a save/load cycle; P10 passes. | ✅ D4 (done `6612442`) |

### Module F — The fifth boss: the Wander-apex predator

| ID | Item | Notes | Status |
|---|---|---|---|
| F1 | **The Hollow Warden — 5th boss ARCHETYPE, the Wander-apex** (the deferred "5th boss / more Reeds depth" item) — a new end-of-run boss that appears **only as the finale of a Wander expedition** (the hand-tuned first-time / NG+ / Reeds apexes keep their herons / Silt Wyrm — Wander-OFF runs never meet it). A **pale, lantern-eating** creature: while the player's lantern is **lit** it **siphons candle fuel** (a new pure `wardenFuelSiphon(warden, lantern, dt)` tick in `logic.js` — drains fuel at a documented rate, stops when the lantern is unlit or empty); when **unlit** it is slower / evasive. It is only vulnerable while its **maw is open** — a telegraphed ~1.5 s window reusing the Silt-Wyrm ripple-ring telegraph language; between openings it is invulnerable. Its aggression is **seeded by the Wander taste** (D2): a "Feast Season" Warden is more aggressive / faster siphon; a "Quiet Reeds" Warden is more evasive — the same boss feels different per run, tying F to D (the Wander has its own apex predator). The **3-hue awaken still applies** through the EXISTING `paintBoss` / `bossStep` path (a new `kind:'warden'` variant + a distinct pale palette in `_drawBoss`); a single hue's repeated coats AWAKEN it (full-damage window) exactly as the herons / wyrm do. **Reeds parity:** in a Wander × Reeds run the siphon INTERACTS with the lantern economy (the Warden siphons your fuel, which in the Reeds also shrinks your vision radius — a genuine synergy, not a bolt-on). HP in the **~52k class** (above the Silt Wyrm's 48k — the Wander apex). Wander-mode only. Acceptance: smoke stage — spawns only at the end of a Wander expedition (a hand-tuned apex run never meets it); invulnerable except maw windows (reusing the wyrm telegraph); the siphon drains fuel while lit + stops when unlit / empty; the 3 hues + awaken work through the EXISTING `paintBoss` / `bossStep` path (assert the same awaken latch fires); the taste shifts aggression (Feast > Quiet siphon/aggression, asserted via the taste bias); defeated → the Wander run ends in victory like a heron / wyrm defeat; a Wander × Reeds run keeps the lantern economy + the siphon interplay; a bosspace-style timing probe in band; P10 passes. | ✅ F1 (done `f21dcab`) — maw-open window tuned to 10.5s (vs the wyrm’s 7.0s) so the 52k HP lands in the 2–4 min human band (~3.9–4.1 min via `tests/wardpace.mjs`); the spec’s ~1.5s is preserved as the TELEGRAPH duration |


### Module O — Options / quality of life

| ID | Item | Notes | Status |
|---|---|---|---|
| O1 | **Pre-expedition "seed card" + taste preview** — before starting a **Wander** run, a small pre-expedition card (reusing the paper-panel / journey-map machinery) shows the **generated seed + taste name + a one-line flavor** (e.g. *"Feast Season — the swarms are hungry tonight"*), so the player knows what they are walking into (and can note / share the seed). Pure presentation, **in-memory only** (no new persistence). Absent for hand-tuned (Wander-OFF) runs. Acceptance: smoke stage — the card renders with seed + taste + flavor for a Wander run (headless fillText-recording); absent for hand-tuned runs; nothing is persisted; P10 passes. | ✅ O1 (done `8033942`) — the title’s “Begin Expedition” (Enter/Space + the big button) opens the card when `options.wander` is ON (via `_startExpeditionOrCard`); the card shows the seed + taste name + one-line flavor; “Set out” starts the run with THAT exact seed (`opts.seed`, deterministic); “Esc” backs out; in-memory only, absent for hand-tuned runs (smoke stage 101) |
| O2 | **Wander run recap line** — extend the v1.6 Q2 **end-screen run recap** to include, for a **Wander** run, the **seed + taste + a "Wandering expedition" tag**, so the end screen tells the story of a unique run. Pure presentation, reuses the Q2 `routeTrail` / recap machinery (a run-local read — never persisted). A hand-tuned run's recap is byte-identical. Acceptance: smoke stage — a Wander victory AND defeat recap shows the seed + taste + tag; a hand-tuned run's recap is unchanged; nothing is persisted; P10 passes. | ✅ O2 (done `237abfb`) — the Q2 recap strip gains a second line for a WANDER run ONLY: the taste name + its one-line flavor + the “Wandering expedition · seed N” tag (a run-local read, in-memory only; a hand-tuned run’s recap is unchanged; shows on both a victory AND a defeat; smoke stage 100) |

### Module I — Invariants / season audit

| ID | Item | Notes | Status |
|---|---|---|---|
| I1 | **Full regression + season audit** (K10 / C4 / A1-style — the final gate) — smoke ×3 green; `pace.mjs` + `humance.mjs` first-time IN the 15–20 band (hand-tuned, Wander OFF); `ngpace.mjs` cycle-1 in band; `bosspace.mjs` + `reedspace.mjs` in their documented ranges; **NEW `wandpace.mjs`** — a generated first-time Wander run IN the 15–20 band across ≥ 5 seeds AND a Wander × Reeds run IN the 20–25 band (the procgen envelope is tight); P10 culling stage green (view-cull + enemy AI-cull hold **across a generated world**); **zero new dependencies** (git-diff audit since v1.6-complete: no package.json/lockfile/asset changes); **SAVE_VERSION 11** migration chain loads a v1-era save end-to-end (`migrateSave` → v11 with `wanderSeed: 0`, `_case: 'migrated'`, all current-schema fields present); **cycle-0 swamp + cycle-0 Reeds tuning byte-identical** (the default-OFF Wander path deep-equals v1.6 `makeTuning` — JSON-compare `makeTuning` across the whole v1.7 diff); tree clean; PROJECT_STATE.md + docs/PROJECT_STATUS.md marked v1.7 COMPLETE with the audit table. Acceptance: the commit itself. | ✅ I1 (done 2026-09-08, fresh-session audit — full audit table below) |

**I1 — the v1.7 season-audit table (fresh session, 2026-09-08, all on the committed tree):**

| Gate | Result | Band / expectation | Verdict |
|---|---|---|---|
| `smoke.mjs` ×3 (consecutive) | 3/3 `ALL SMOKE TESTS PASSED` | green, deterministic | ✅ |
| `smoke.mjs` 10-run flakecheck (on the v1.7 stage) | 10/10 green | the `144fb1c` flake-pin stays green (suite deterministic) | ✅ |
| `pace.mjs` (hand-tuned, Wander OFF) | ~17.3 min | 15–20 min | ✅ IN |
| `humance.mjs` (full-run sim, first-time) | 18.7 min | 15–20 min | ✅ IN |
| `ngpace.mjs` (NG+ cycle-1) | 19.5 min | 15–20 min | ✅ IN (probe prints IN BAND) |
| `bosspace.mjs` (heron 30k, 3-hue) | 37.0 s god-mode (~1.0 min human) | the heron lower-bound probe | ✅ |
| `reedspace.mjs` (Reeds run + Silt Wyrm) | ~22.2 min run / 97.7 s Wyrm god (~3.9 min human) | 20–25 min / 2–4 min | ✅ IN |
| `wandpace.mjs` — LEG 1 (first-time Wander, 8 seeds) | band [16.9, 17.8] min (8/8) | 15–20 min | ✅ IN |
| `wandpace.mjs` — LEG 2 (Wander × Reeds, 8 seeds) | band [21.6, 22.7] min (8/8) | 20–25 min | ✅ IN |
| `wardpace.mjs` (the Hollow Warden, 52k, 6 seed/taste runs) | god 98–104 s (mean 103 s) → ~3.9–4.1 min human | ~2–4 min class (comparable to the Silt Wyrm's 3.9 min) | ✅ IN (the documented `f21dcab` tuning: maw-open 10.5 s) |
| **Byte-identity (Wander OFF = default)** | `makeTuning` + `applyNGPlus(1)` (normal/gentle/hard) **deep-equal the v1.6-complete (`f746938`) values** (JSON-compare across the whole v1.7 diff) | hand-tuned runs byte-identical to v1.6 | ✅ IDENTICAL |
| Save-schema delta vs v1.6 | `freshSave` differs ONLY in `saveVersion` (10→11) + the added `wanderSeed: 0` field | the intended v1.7 migration, nothing else | ✅ |
| Zero new dependencies (git-diff since `f746938`) | only `src/` (audio/game/logic) + `tests/` (smoke + new wandpace/wardpace) + `docs/` + `PROJECT_STATE.md`; **no** package.json / lockfile / asset / node_modules | no new deps | ✅ |
| `SAVE_VERSION` | 11 (unchanged by F1/O1/O2 — each adds no save field) | stays 11 | ✅ |
| P10 culling (smoke stage 24) + green across a generated world | green (asserted in stages 24 / 95 / 99) | ≤ 220 particles, no per-frame hot-path alloc | ✅ |
| No `http.server` 8765 left running | none found (checked via `netstat`) | loopback-only, nothing left running | ✅ |

**v1.7 COMPLETE** — all 9 items (D1–D4, F1, O1, O2, I1) committed; every gate green
on the committed tree; the load-bearing invariant (hand-tuned runs byte-identical
with Wander OFF) holds. The season is signed off.

### Explicitly deferred past v1.7 (not forgotten)

- **A "true" NG+ Reeds variant / a second Reeds biome** — v1.7 lands the
  Wander-apex 5th boss (F1) as the new depth; a dedicated NG+ Reeds *layout*
  variant (a deeper lower-bank / denser bestiary / Silt Wyrm "twin") is the
  next depth item and stays parked (the Wander × Reeds parity in D3 already
  gives NG+ players generated Reeds content, so the need is reduced).
- **Accessibility (X1 colorblind glyphs, X2 remappable keys, X3 text-size
  toggle)** — Joel's standing call; X2 (key remapping) is the natural
  companion to the v1.6 gamepad and stays parked with it.
- **Gold as a 4th combat pigment** — still fights the 3-hue pillar; stays
  meta-only.
- **CRT scanlines / retro filters** — rejected three times; the painted world
  has no retro mode.
- **Co-op / multiplayer** — still an architecture mismatch with loopback-only,
  single-session, localStorage; no near-term plan.
- **Lantern in the swamp** — deliberately Reeds-only for v1.6; a balance item,
  not a scope item.
- **Unbounded / infinite procedural generation** — v1.7's Wander is a
  **bounded, pacing-envelope** variant, not an infinite generator; a true
  open-ended generator still risks both pacing targets and stays out until the
  envelope data from `wandpace.mjs` proves a wider generation is safe.
- **Image/audio/font assets** — invariant, unchanged: everything is
  procedural (math.js shapes, canvas, WebAudio synth).
---

## v1.8 — "The Full Collection" (COMPLETE — 1.0.0 season audit signed off 2026-09-08; the 1.0 release version)

**Theme:** the gallery is *full*. Every version so far has added a *way to
play* (the tutorial, gold/NG+, Reeds, the gamepad, QoL, Wander procgen + the
Warden). v1.8 closes the loop it has been implying since the game was named:
**the gallery actually completes**, the last deferred depth item (a "true" NG+
Reeds variant / a dedicated 6th boss) lands, and the game gets a real **1.0
release surface** (README + version string + a one-line changelog). It is the
version a player can actually be *finished* on.

**Scope (small-to-medium; the version that ships 1.0):**

### A. The NG+ Reeds descent + the 6th boss archetype (the deferred depth item)

The deferred list named this explicitly and v1.7 reduced (but did not close)
the need: D3's Wander × Reeds parity gives NG+ players *generated* Reeds
content, but a **dedicated, hand-tuned NG+ Reeds layout** — a deeper lower-bank
with a denser bestiary and a Silt Wyrm "twin" — is still the named next-depth
item. v1.8 lands it as a real place, not a procgen roll.

- **G1 — the "Black Reeds" (NG+ Reeds variant).** ✅ **DONE `4ec7d07` (2026-09-08).** A second Reeds *layout*
  variant, victory-gated **AND NG+-gated** (unlocks at `ngCycle >= 1` and a
  Reeds victory, mirroring how Reeds itself gates on a swamp victory). A NEW
  `REEDS_DARK` layout table (or a parameterized variant of the existing one):
  a deeper descent, a denser Wisp/Serpent/Leech bestiary, an extra flood /
  gravity pocket, and its own lantern-economy tuning. The v1.6 Reeds layout
  (cycle-0 Reeds) is **untouched** — a cycle-0 Reeds run stays byte-identical.
- **G2 — the "Umbral Wyrm" (6th boss archetype).** ✅ **DONE `49f74a8` (2026-09-08).** The Black Reeds' apex
  predator: the Silt Wyrm's *twin*, a darker, faster, **dual-phase** boss that
  uses both the fuel-siphon (Warden-inherited) and the flood-pocket (Wyrm-
  inherited) mechanics. A NEW `logic.js` `UMBRA_WYRM` tuning + `umbrStep`
  alongside `SILT_WYRM`/`wyrmStep`. ~60k HP, 3-hue awaken via the existing
  `paintBoss`/`bossStep` path, a telegraphed dual maw + a "deep dark" final
  phase where the lantern is mandatory. Default-OFF (it only appears in the
  NG+ Reeds variant), so every existing run is byte-identical. A NEW
  `tests/umbrapace.mjs` probe targets a **2.5–4 min** human band (the longest
  Reeds boss, one tier above the Silt Wyrm's ~3.9).
- **G3 — the selection wiring + a `blackpace.mjs` probe.** ✅ **DONE `3b5949d` (2026-09-08).** The end-of-Reeds-
  descent boss is the Umbral Wyrm (NG+ Reeds variant) vs the Silt Wyrm (cycle-0
  Reeds) vs the Wander-apex Warden (Wander × Reeds). A NEW
  `tests/blackpace.mjs` probe measures the Black Reeds run (a new hand-tuned
  22–26 min band, one tier above Reeds) + the Umbral Wyrm (the 2.5–4 min band).
  A smoke stage proves: cycle-0 Reeds is byte-identical (the new variant only
  activates at NG+), the Umbral Wyrm is only-in-Black-Reeds, the dual-phase +
  siphon + maw mechanics, and the gate logic.

**The load-bearing invariant for G1–G3 (pin this):** every *existing* run
stays byte-identical. The Black Reeds variant + Umbral Wyrm are gated behind
`ngCycle >= 1` AND a Reeds victory, so a cycle-0 Reeds run, a Wander × Reeds
run, and a hand-tuned (Wander-OFF) Reeds run must deep-equal their v1.7
tuning / content. `reedspace.mjs` (the cycle-0 Reeds probe) is **re-verified
in band unchanged** (20–25 min); only the NEW `blackpace.mjs` /
`umbrapace.mjs` probes measure the new content.

### B. The gallery completes (the namesake payoff)

The game is called *Frogue Gallery* but a player can never be *finished* on it.
v1.8 gives the gallery a **completion state**.

- **H1 — the "Full Collection" ledger.** ✅ **DONE `7be0d5f` (2026-09-08).** A NEW `logic.js` `GALLERY_COMPLETE`
  tuning + a `galleryCompletion(save)` pure check: the catalog of 10 paintings
  **all owned** + every boss defeated at least once (gray / green / gilded /
  Silt Wyrm / Warden / Umbral Wyrm) + a first-time victory + a Reeds victory.
  The existing `galleryBonus` "Rehung Frame" meta (A4) becomes the *capstone*:
  at Full Collection the player unlocks a **permanent** `galleryBonus` level (a
  saved, persistent tuning bump — the "the museum keeps you better" payoff) +
  a one-time cinematic (reusing the v1.5 first-victory cinematic machinery,
  the "full gallery blooms" beat). A NEW `save.galleryComplete` boolean latch
  (SAVE_VERSION 11 → 12, migration defaults `false` for legacy saves).
- **H2 — the ledger UI + the completion beat.** ✅ **DONE `c57b4d0` (2026-09-08).** The existing gallery / ledger
  frame (the G2 gilded-frame presentation) gains a **progress readout**
  (X / 10 paintings, Y / 6 bosses) so a player can *see* what they are missing.
  At Full Collection, a title-screen "collection complete" badge + the capstone
  cinematic. Pure presentation over `galleryCompletion(save)`.

### C. Release surface (productization)

- **R1 — the README + version string.** ✅ **DONE `119a0f1` (2026-09-08, session
  v18-r).** A `README.md` (the game's public face): what it is, how to play
  (open `index.html` in a browser — the loopback-only note), the controls
  (keyboard + gamepad, from the v1.6 W1 map — every claim re-verified against
  `input.js` + the `GAMEPAD_MAP`), the meta (build → expedition → gallery),
  the NG+ / Reeds / Wander modes, and the architecture note. The title screen +
  the Options header carry a **`1.0.0`** version string from a single
  display-only source of truth (`GAME_VERSION = '1.0.0'` in `logic.js`, beside
  `SAVE_VERSION`); a smoke stage asserts the value + that it is referenced.
  `docs/PROJECT_STATUS.md` gets the "v1.8 = 1.0.0 release" marker.
- **R2 — the changelog + DECISIONS.md close-out.** ✅ **DONE (2026-09-08,
  session v18-r).** `docs/CHANGELOG.md` (NEW) records the full release history
  (1.0.0/v1.8 → v1.1 → the tutorial-era milestone line) with representative
  SHAs + the `SAVE_VERSION` history; `docs/DECISIONS.md` rows 15–18 record the
  1.0 call + the v1.8 scope decisions (the Black Reeds gating, the Umbral Wyrm
  band + lantern mandate, the Full Collection criteria + capstone choice + the
  11→12 migration, the 1.0.0 versioning choice). `docs/ROADMAP.md` already
  carries the post-v1.8 deferred list below.

### D. Season audit (the final gate)

- **A1 — the v1.8 audit (K10/C4/A1-style, the 1.0 gate):** smoke ×3 green;
  `pace.mjs` + `humance.mjs` first-time IN the 15–20 band (hand-tuned, Wander
  OFF); `ngpace.mjs` cycle-1 in band; `bosspace.mjs` + `reedspace.mjs` in their
  documented ranges **UNCHANGED**; the NEW `blackpace.mjs` (Black Reeds 22–26
  min + Umbral Wyrm) and `umbrapace.mjs` (2.5–4 min) in their bands; the NEW
  Full Collection gate (a save with every painting + every boss + both
  victories → `galleryCompletion` true + the capstone `galleryBonus` applied);
  the byte-identity re-check (a cycle-0 Reeds run, a Wander × Reeds run, and a
  hand-tuned run all deep-equal their v1.7 tuning / content — JSON-compare
  `makeTuning` / `applyNGPlus` across the whole v1.8 diff); P10 culling green;
  **zero new dependencies** (git-diff since v1.7-complete `34eeda2`: only
  `src/` + `tests/` + `docs/` + `PROJECT_STATE.md` + the new `README.md`);
  **SAVE_VERSION 12** migration chain loads a v1-era save end-to-end; tree
  clean; PROJECT_STATE.md + docs/PROJECT_STATUS.md marked v1.8 / **1.0.0
  COMPLETE** with the audit table. Acceptance: the commit itself. ✅ **A1
  (done 2026-09-08, FRESH-session audit — full audit table below)**

**A1 — the v1.8 season-audit table (fresh session, 2026-09-08, all on the committed tree `6e87cd8`; the 1.0.0 gate):**

| Gate | Result | Band / expectation | Verdict |
|---|---|---|---|
| `smoke.mjs` ×3 (consecutive) | 3/3 `ALL SMOKE TESTS PASSED` (106 stages) | green, deterministic | ✅ |
| `smoke.mjs` 10-run flakecheck (144fb1c pin) | 10/10 green | the `144fb1c` determinism pin stays green | ✅ |
| `pace.mjs` (hand-tuned, Wander OFF, first-time) | ~17.4 min | 15–20 min | ✅ IN (UNCHANGED vs v1.7) |
| `humance.mjs` (full-run sim, first-time) | 16.7 min | 15–20 min | ✅ IN (UNCHANGED vs v1.7) |
| `ngpace.mjs` (NG+ cycle-1) | 19.5 min | 15–20 min | ✅ IN (probe prints IN BAND) |
| `bosspace.mjs` (heron 30k, 3-hue) | 37.1 s god-mode (~1.0 min human) | the heron lower-bound probe | ✅ (UNCHANGED) |
| `reedspace.mjs` (cycle-0 Reeds + Silt Wyrm) | ~22.2 min run / 97.7 s Wyrm god (~3.9 min human) | 20–25 min / 2–4 min | ✅ IN (byte-identical to v1.7) |
| `wandpace.mjs` — LEG 1 (first-time Wander, 8 seeds) | band [16.9, 17.8] min (8/8) | 15–20 min | ✅ IN |
| `wandpace.mjs` — LEG 2 (Wander × Reeds, 8 seeds) | band [21.6, 22.7] min (8/8) | 20–25 min | ✅ IN |
| `wardpace.mjs` (the Hollow Warden, 52k) | god 98–104 s (mean 103 s) → ~3.9–4.1 min human | ~2–4 min class (comparable to the Silt Wyrm) | ✅ IN |
| `blackpace.mjs` (Black Reeds + Umbral Wyrm) | ~25.9 min run / 105.5 s Umbral god (~4.2 min human) | 22–26 min | ✅ IN (new v1.8 probe) |
| `umbrapace.mjs` (the Umbral Wyrm, 60k) | ~3.89 min human (98.1 s god) | 2.5–4 min | ✅ IN (new v1.8 probe) |
| **Byte-identity (v1.7 `34eeda2` baseline)** | `makeTuning` + `applyNGPlus(1)` **deep-equal v1.7-complete across all 216 arg combos** (JSON-compare across the whole v1.8 diff); cycle-0 NG+ step a no-op; a cycle-0 (Wander-OFF, no-NG+) first-time swamp tuning is byte-identical to v1.7 | hand-tuned / cycle-0 runs byte-identical to v1.7 | ✅ IDENTICAL |
| Save-schema delta vs v1.7 | `freshSave` differs ONLY in `saveVersion` (11→12), the added top-level `galleryComplete: false`, and `flags` gaining `bossDefeats: []` | the intended v1.8 Full-Collection migration, nothing else | ✅ |
| `SAVE_VERSION` 11→12 migration | a v11-era save migrates to `saveVersion 12` with `galleryComplete false` + `flags.bossDefeats []` (both defaulted OFF) and **plays byte-identically** (makeTuning-feeding fields unchanged); a v1-era save migrates end-to-end to v12 (`_case: 'migrated'`, all 19 top-level fields present) | the v1.8 migration chain + legacy walk | ✅ |
| `GAME_VERSION` | `'1.0.0'` in `logic.js` (single source of truth), referenced in the title corner ("Frogue Gallery · v1.0.0") + the Options header line (`v${GAME_VERSION}`) | the 1.0.0 release string rendered, not dead | ✅ |
| Zero new dependencies (git-diff since `34eeda2`) | only `src/` (game/logic/player/world) + `tests/` (smoke + new blackpace/umbrapace) + `docs/` (CHANGELOG/DECISIONS/PROJECT_STATUS/ROADMAP) + `PROJECT_STATE.md` + the new `README.md`; **no** package.json / lockfile / asset / node_modules | no new deps (zero-dep invariant holds) | ✅ |
| P10 culling (smoke stage 24) + green across the Reeds / Black Reeds worlds | green (view-cull 0.15 localized/full + enemy AI-cull; re-asserted on the Reeds + Black Reeds worlds) | no per-frame hot-path alloc | ✅ |
| `README.md` accuracy spot-check | run command (`python -m http.server 8765 --bind 127.0.0.1`), the 6 named bosses, 5400px/4 zones/10 paintings/2 slots, the controls (title enter/space+a/o/g/n/b/c/r; run 1/2/3/4→pigment, space hop, WASD/arrows, H/?/P/M) — all re-verified against the actual `input.js`/`game.js` code | README matches the code | ✅ |
| No `http.server` 8765 left running | none found (checked via `netstat` BEFORE + AFTER the audit) | loopback-only, nothing left running | ✅ |

**v1.8 COMPLETE** — all 7 items (G1–G3, H1–H2, R1–R2, A1) committed; every
gate green on the committed tree; the load-bearing invariant (a cycle-0 /
Wander-OFF / no-NG+ hand-tuned run is byte-identical to v1.7-complete
`34eeda2`) holds; the 1.0.0 release is signed off. **v1.8 = the 1.0.0
release — the game's Full Collection.**

### Explicitly deferred past v1.8 (not forgotten)

- **Accessibility (X1 colorblind glyphs, X2 remappable keys, X3 text-size
  toggle)** — Joel's standing call; X2 (key remapping) is the natural companion
  to the v1.6 gamepad and stays parked with it.
- **Gold as a 4th combat pigment** — still fights the 3-hue pillar; stays
  meta-only.
- **CRT scanlines / retro filters** — rejected three times; the painted world
  has no retro mode.
- **Co-op / multiplayer** — still an architecture mismatch with loopback-only,
  single-session, localStorage; no near-term plan.
- **Lantern in the swamp** — deliberately Reeds-only for v1.6; a balance item,
  not a scope item.
- **Unbounded / infinite procedural generation** — v1.7's Wander is a
  **bounded, pacing-envelope** variant, not an infinite generator; a true
  open-ended generator still risks both pacing targets and stays out until the
  envelope data from `wandpace.mjs` proves a wider generation is safe.
- **A second expedition *biome* (a new hand-tuned place beyond swamp + Reeds +
  Black Reeds)** — v1.8 lands the Black Reeds as the *third* place (a variant
  of Reeds, not a net-new biome); a genuinely new biome (e.g. a "Gallery
  Underground" / "the Atelier at night") is a future-version item.
- **Image/audio/font assets** — invariant, unchanged: everything is
  procedural (math.js shapes, canvas, WebAudio synth).---

## v1.9 — "The Living Swamp" (COMPLETE — 2026-09-09; all 13 items T0/S1–S3/J1–J4/L1–L4 + **A1** landed; the A1 fresh-session quality audit signed the season off — every gate GREEN)

**Theme:** the game is *complete* in content (9 pacing probes, 6 bosses, 106-stage
deterministic suite) but its **feel layers are the thinnest part**: the whole
game runs on ~6 synthesized SFX functions, and every visual judgment so far
has been agent text-eyeballing — **nobody has actually SEEN the game frames**.
v1.9 is the quality pass: sound design, juice on the core action (painting),
a living world, and a frame-evidence process so polish is judged on real
pixels. Theme: a swamp that *feels* alive.

**The single load-bearing invariant (pin this):** every S/J/L item below is
**presentation-only** — zero tuning changes. All 9 pacing probes stay in band
UNCHANGED, the byte-identity invariant holds (makeTuning identical), and the
smoke suite stays green after every commit. Feel work must never move a number
a player experiences in time.

**Process fix (NEW for v1.9):** a **frame-evidence harness** — a small
dev-only screenshot tool (playwright-core is the sanctioned dev tooling;
gitignored, no runtime dep) that drives the real page over loopback and
captures ~20 keyframes: title, atelier, mid-swamp with paint in flight, each
enemy, heron phases, Reeds lantern + flood, Black Reeds, Warden maw, Umbral
deep-dark, gallery wall, full-collection glow. Every S/J/L item ships with its
before/after frames saved under a gitignored `frames/` dir (recorded in the
commit message), and the A1 audit is a before/after review of the frame set.
No polish item ships without its frames.

**Invariants (unchanged):** zero runtime dependencies (playwright-core stays
dev-only/gitignored) · loopback-only · pure rules in `logic.js` · no
per-frame hot-path allocations (the environmental-life items MUST respect the
≤ 220 particle cap and object pools — verify with P10) · smoke suite green
after every commit (deterministic) · one conventional commit per item ·
SAVE_VERSION stays 12 · all 9 pacing probes in band unchanged · no
`http.server` 8765 left running.

### T0 — the eyes (process; FIRST)
| ID | Item | Acceptance |
|---|---|---|
| T0 | **The frame harness** — `tools/frames.mjs` (dev-only, gitignored with its deps): boots the game on 127.0.0.1 (a free port, NOT 8765), drives it headless (seeded save states via the existing save-import/`localStorage` path — no manual clicking), and captures the ~20 keyframes above as PNGs under `frames/` (gitignored). A `frames:baseline` run produces the v1.9-BASELINE set every later item diffs against. Smoke-adjacent: a node check that the harness runs + emits all frames (dev tooling, not a game test). | `node tools/frames.mjs` → 20+ PNGs, baseline set committed to the session record; harness is dev-only (no runtime import, gitignored); no 8765 server left running. |

### T1 — sound design (the thinnest layer)
| ID | Item | Acceptance |
|---|---|---|
| S1 | **The SFX bank** — the ~6 SFX functions become a ~20-function synthesized bank (all WebAudio-synthesized, pooled, no assets): paint swish / splat / charge (pitch varies with stroke speed + charge), per-enemy hit + death (beetle clang vs mosquito buzz vs toad splat vs wisp hiss vs serpent slither), burn/freeze/root status on/off, pickup, boss phase stings (3), UI confirm/back, heal, lantern light/extinguish, Full Collection fanfare. The existing buses (music/sfx under master, the S1-step machinery) are the home; volume slider + mute inherit for free. | A smoke/dev check enumerates the bank (each sfx id → a synth recipe); the sfxBus still inherits the master mute; no audio files; particle/audio budget unchanged (P10 green). **✅ LANDED (v1.9, session v19-s1, `f765b61`) — the ~6 SFX functions became a 62-case bank: surface-aware `paint-swipe`/`paint-splat` + `charge-splash` (the core paint verb, pitch/texture by surface: water/veg/soil), per-creature `hit-{6}`/`die-{6}` (turtle/cragfrog fall back to generic `enemy-hit`/`enemy-die`), status on/off (`burn-ignite`/`freeze-tick`/`root-thud` + `burn-out`/`freeze-release`/`root-crackle` + dry-scrub off + `heal` chime), pickup + UI (`pickup`/`pickup-streak`, `ui`/`ui-back`, `ui-hover`, `pause-open`/`pause-close`), boss stings (`boss-phase` shared by all 4 archetypes + `boss-kill` + `collection-fanfare`), all on the sfxBus through the existing `_tone`/`_noise` helpers + the `_sfxCanStart` voice cap; the music bus + music layer untouched. Evidence (`tests/sfx.mjs`, a node check that enumerates the bank — each id → ≥1 synth voice — and asserts sfxBus routing + the voice cap; the per-sfx trigger manifest is in the commit message). Invariant held: `makeTuning` byte-identical, SAVE_VERSION 12, smoke green, all 9 probes in band unchanged. **Next: S2 (music dynamics).**
| S2 | **Music dynamics** — the ambient bed + step-sequencer melody gain INTENSITY LAYERS: a danger swell (zone entry, low HP, boss phase transitions layer in denser patterns), distinct Reeds (low, watery) and Black Reeds (darker) themes, the Full Collection moment's own chord. All synthesized on the existing sequencer (no assets, no deps). | The sequencer exposes a pure "theme/intensity" selector (testable in node: theme id + pattern density for each of swamp / Reeds / Black Reeds / boss / collection); the music slider still controls it; nothing allocates per-frame in the tick path. **✅ LANDED (v1.9, session v19-s1, `9ad0618`) — distinct per-biome zone themes (a REAL Reeds set: low/watery/slow wet-minor drone; a Black Reeds set: darker/lower/sparser; the swamp set stays byte-identical to the hand-tuned v1.7 baseline) + a PURE `themeSelector({ zone, bossEngaged, lowHp, collection }) -> { themeId, patternDensity, extraVoices }` (patternDensity = the real active-step count: boss > zone = "denser = more intense"); the INTENSITY/DANGER layer (a low boss off-beat pulse + a sparser high uneasy low-HP ostinato + a brief zone-entry swell + the Full-Collection chord swell, all on `melodyMaster -> musicBus` so the music slider + mute inherit); `bossPhaseUp()` swaps the live boss loop to a denser/faster pre-built phase-2 variant. Evidence (`tests/music.mjs`, the S2 section: 38 assertions — the right theme + density for swamp/Reeds/Black Reeds/boss/lowHp/collection + the melodyMaster -> musicBus routing). Invariant held: `makeTuning` byte-identical (logic.js untouched), SAVE_VERSION 12, smoke green, all 9 probes in band unchanged, P10 (nothing allocates per-frame in the tick — all danger voices pre-built lazily). **Next: S3 (ambient life).**
| S3 | **Ambient life audio** — synthesized ambient loops on the ambient bus: insects (sparse chirps, seeded), water droplets, wind in the reeds (filtered noise), a distant heron call (rare, seeded). Seeded + sparse so it never becomes a wall of sound; inherits mute/volume. | Ambient events are seeded/deterministic in node (a pure "next ambient event" sampler); the ambient bus rides the music slider; no setInterval (rAF tick only). **✅ LANDED (v1.9, session v19-s1, `7ec519c`) — a PURE `nextAmbientEvent({ biome, rng, t }) -> { type, flavor, t } | null` sampler (no Math.random/browser/global state; the caller's seeded mulberry32 stream is the only source, advanced in a fixed per-slot draw order so the same (biome, seed, t-cadence) yields the same event times) + `AMBIENT_KINDS`/`AMBIENT_P` (the 4 kinds + per-biome per-slot probabilities); SPARSE — most slots null, a few events/min, WATER is a WET-BIOME-ONLY kind (reeds/blackReeds), the heron RARE. The VOICES (a new `_ambLifeMaster` bus -> musicBus so the music slider + mute inherit): `_ambChirp`/`_ambDrip`/`_ambWind`/`_ambHeronCall` (all a few-percent peak — a bed, never a wall). The STEPPER (`stepAmbientLife(dt)`, driven by the rAF tick, NO setInterval) accumulates a run clock + runs the pure sampler once per whole second; P10 (per-frame: a clock add + ≤1 voice/s). `startAmbientLife(biome, seed)`/`stopAmbientLife()` at run start/end (seeded by the run's world seed). Evidence (`tests/music.mjs`, the S3 section: 20 assertions — sparsity, biome-gating, determinism, kind/flavor validity + the `_ambLifeMaster -> musicBus` routing). Invariant held: `makeTuning` byte-identical (logic.js untouched), SAVE_VERSION 12, smoke green, all 9 probes in band unchanged (headless no-op). **Next: J1 (hitstop — the T2 juice pass).**

### T2 — juice on the core action ("painting is the game")
| ID | Item | Acceptance |
|---|---|---|
| J1 | **Hitstop** — a 40–70 ms freeze (+ 1-frame impact flash) on paint connect, longer (~110 ms) on charged splat and on enemy KILL. Implemented as a real-time `hitstopT` in the draw/update gate (presentation clock — the game clock keeps its own integrity; the existing J5 real-time pattern is the model). | Hitstop is a real-time presentation clock (a smoke check: it exists, is clamped, and never touches tuning or the seeded RNG stream); frame evidence: a connect frame shows the flash. **✅ LANDED (v1.9, session v19-juice, `bd02f38`)** — the paint-CONNECT hitstop (a real 50 ms swipe dip @ ~0.3×; ~110 ms on a charged-splat connect + on an enemy KILL; a SHORT ~30 ms on player self-damage) reuses the v1.4 real-time `hitStop` (`timeScale` dip, gated by `options.shake`, never touches tuning/runT/the seeded RNG) + the white-hot IMPACT RIM (a rim ring + core wash that peaks at the connect instant while `e.hitFlash > 0`). The connect's RULE OUTCOME is provably invariant: smoke stage 59b drives two identical runs (A = hitstop fires, B = `hitStop` no-op), the connect deals identical damage in both (hp 191 = 191), A's `_hitstopT` budget drains, and A's game-time advances LESS over the same real frames (0.0434 s vs 0.0668 s) — pure presentation, provably. Frame evidence: `tests/frames/after-J1/beetle-hitstop.png` + `toad-hitstop.png` (before = baseline `enemy-beetle.png`/`enemy-toad.png`). |
| J2 | **Paint arc upgrade** — the brush trail is the core verb: arc fidelity (the existing arc-trail + splatter gets curve interpolation), droplet physics (a few pooled droplets with gravity + fade), a charged-slate feel (slower, heavier, wetter), and ink that LANDS (painted soil darkens, painted water ripples) on the existing paint layer. | The paint layer + particle budget unchanged (P10 green; ≤ 220); the new droplets are pooled; frame evidence: a charged stroke vs a normal stroke read differently. **✅ LANDED (v1.9, session v19-juice, `e4ffff0`)** — the swipe ribbon now BOWS into a quadratic-bezier curve (arc fidelity — not a straight start→end), POOLED ink droplets (a capped 48-slot pool in paint.js, gravity + drag + settle, seeded — ZERO new `Math.random` draws on the paint path) spray off the tip, the CHARGED-splat throws MORE + a wider/denser arc (a dense inner ring) + a denser landing, and the ink LANDS (a darker wet soil blotch on land / a spreading ripple ring over water). P10-safe: the world ParticleSystem stays a fixed 240 pool; the total on-screen paint juice after a full-power burst is asserted ≤ 220 (120 measured) in smoke stage 59c (19 assertions: the curve bows, droplets pooled + capped + have velocity+color, the charged splash throws more, ink lands + decays, P10 budget holds). Frame evidence: `tests/frames/after-J2/arc-{red,blue,green,water,charged}.png` (before = baseline `paint-{red,blue,green,water}.png`). |
| J3 | **Kill quality** — every enemy death is an ink burst that takes the palette of the pigment that killed it (painted-body tint extended to the death), enemies dissolve into the palette (a few frames of the painted blob bleeding away), boss deaths get the full bloom (the existing victory bloom is the model). | Death bursts are pooled + seeded (deterministic); frame evidence: a red-kill vs a blue-kill vs a green-kill death each read in their hue. **✅ LANDED (v1.9, session v19-kill, `a93cd2e`)** — a separate **draw-only ink-burst pool** in `paint.js` (position-seeded, pooled, capped at `MAX_INKBURST` 192, decayed in `paint.update`): a regular kill pops a 22-blob burst in the enemy's painted tint (a **neutral** ink splat if never painted — the world remembers what you painted), the boss kill pops a LARGER 64-blob burst (its last-painted pigment `h._lastPig` + a wider neutral-ink ring) + a brief **camera hold** (`_awakenHoldT` 1.1s + `zoomTarget` 0.9, the v1.4 awaken-moment pattern) alongside the existing `boss-kill` sfx. Hooked AFTER the rules decide the death (`_onEnemyDead` / `_onHeronDefeated`) — damage / drops / death timing / `runT` / the seeded RNG are untouched. A full wave + boss stays ≤ the cap AND the P10 total-juice budget (≤ 220) and decays to 0 (smoke stage 107, 16 assertions: real-death-path burst, painted-tint vs neutral, boss burst + camera hold, P10 cap, decay-to-0, deterministic A/B, draw-only). Frame evidence: `tests/frames/after-J3/toad-kill-burst.png` + `beetle-kill-burst.png` + `boss-kill-burst.png` (before = baseline `enemy-toad.png` / `enemy-beetle.png` / `boss-gray-heron.png`). |
| J4 | **The frog** — idle breathing (subtle scale oscillation), hop anticipation (pre-hop crouch before the stretch), a hurt stagger (brief wobble + ink spatter on the frog, not just the enemy), a low-HP tremble (tiny shake under 2 hp), a victory pose (the blooming moment: the frog rears, tail flick, a painted heart or splash). Draw-only; physics untouched (the J4-squash pattern from v1.4 is the model). | All draw-only (a smoke check: the frog's physics/hp/invuln timing are untouched by the new draw states); frame evidence: idle vs hurt vs victory frames. **✅ LANDED (v1.9, session v19-kill, `8a22d46`)** — the frog's OWN liveness, all **draw-state** (the v1.4 `squash`/blink pattern extended): an **idle breathe** (a subtle dt-accumulated squash oscillation when standing still, OFF while moving / hopping / staggering / posing — a living frog, not a static sprite), a **hurt stagger** (`_staggerT` set by the real `hurt()`, a decaying wobble + flinch layered ON TOP of the J1 hitstop that freezes the WORLD — the frog's own reaction), a **low-HP tremble** (below ~30% HP a faint high-freq position jitter + the eyes narrow + a worried brow rises; fades out above the 30% line), and a **victory pose** (`_victoryHopT` set by `game.js` at the moment the boss is defeated, BEFORE the victory-screen transition — a small contented hop + squash-and-settle reusing the existing `hopLift` shape, decays on its own). The draw-state timers feed NO physics / HP / i-frame number: `hurt()`'s i-frame window + damage are byte-identical, the boss-defeat timing + drops are untouched (smoke stage 108, 16 assertions: idle breathe is a small positive squash offset + OFF while moving; hurt() sets the stagger WITHOUT changing iframes (0.9 base) or the damage (hp 10 -> 9, the real rule); the low-HP desperate brow is a draw-only quadraticCurveTo present at 15% HP, ABSENT at 31% + 50%; the boss defeat arms the victory pose at 1.0 and it decays to 0). Frame evidence: `tests/frames/after-J4/frog-idle-breathe.png` + `frog-hurt-stagger.png` + `frog-low-HP.png` + `frog-victory-pose.png` (before = baseline `title.png` idle frog). |

### T3 — a living world
| ID | Item | Acceptance |
|---|---|---|
| L1 | **Environmental life** — a parallax layer-0 of living elements: fireflies (Reeds/Black Reeds), drifting leaves/pollen (swamp), surface ripples on water bands, breathing mist (a slow alpha/offset oscillation on the existing parallax bands). All pooled, seeded, capped into the existing particle budget. | P10 green with the new layer active (cap respected); the layer is seeded (deterministic positions); frame evidence: two frames 2 s apart show the mist breathing. **✅ LANDED (v1.9, session v19-world, `ed8f2fa`)** — a parallax layer-0 of living elements (the first of L1–L4), all **PRESENTATION-ONLY** (the load-bearing invariant held: `src/logic.js` byte-identical to `6c9e09e`, SAVE_VERSION 12, GAME_VERSION 1.0.0, no tuning / runT / logic number moves). **Breathing mist** — `mistBreath(seed, now)`: a slow ~9 s alpha/offset oscillation on the EXISTING v1.4 parallax mist bands (each band's alpha swells `b.alpha * (0.45 + 0.9 * breath)` + the band drifts ±8 px, phased per band so they breathe out of sync); the v1.4 MIST_BANDS constants (alpha/parallax) are untouched so the v1.4 L1 test (stage 63) still passes. **Ambient fireflies** — a small capped twinkling swarm (Reeds / Black Reeds ONLY), a SEPARATE pool from the lantern light-economy `fireflies` (the bright lantern refills), each pulsing on a staggered `fireflyTwinkle`. **Drifting pollen** — small drifting motes (swamp ONLY), a slow seeded Lissajous-ish drift + sway. **Surface ripples** — a few soft expanding rings on the open-water bands (every world) on a staggered `ripplePhase`. **SEEDED**: positions from a dedicated `mulberry32(seed + 731)` stream built once in `World.build()` (a distinct stream from the terrain + light-economy streams) so a fixed seed gives the same layout (the A/B invariance holds); motion is a pure function of the wall-clock `now` — NO global `Math.random` in the hot path, no per-frame allocation. **POOLED + view-culled** (capped small pools: pollen 14 / ambient fireflies 18 / ripples 13; the draw cull identical to `ambientCounts`): the on-screen total stays capped into the existing P10 particle budget (combined paint-juice + ambient asserted ≤ 220 with the layer on), and the v1.4 "one drawImage per zone" parallax-band draw budget is untouched (a small pooled set drawn in the world-space pass on top of the terrain so ripples read on the water). New **smoke stage 109** (14 assertions): determinism at a fixed seed + seed variance, the Reeds-ambient / swamp-pollen pool split, the pool caps + view-cull, the P10 combined-on-screen cap with the layer on, and the mist-breathing oscillation. Frame evidence: the frames harness registers 4 after-L1 scenes — `tests/frames/after-L1/world-mist-a.png` + `world-mist-b.png` (the SAME world + camera ~2.2 s apart, **md5-differing = the mist BREATHES**) / `world-fireflies.png` (the Reeds ambient swarm) / `world-pollen.png` (the swamp drifting pollen). Invariant held: all 9 probes in band UNCHANGED (pace ~17.2 / humance ~18.9 / ngpace cycle-1 19.5 / bosspace 37.0 s / reedspace ~22.1 / wandpace both legs / wardpace ~3.9 / blackpace ~25.7 / umbrapace ~3.66). **Next: L2 (+ L3).** |
| L2 | **Lighting pass** — glow from charged paint (a soft radial on the stroke while charged), awaken bloom (the boss's Awakened state gets a light halo), lantern light pools EXTENDED into the base swamp as pure light (the parked "lantern in the swamp" item, done as LIGHT — no fuel, no mechanics, the frog carries a faint glow trail; the balance version stays deferred). | Pure draw (no new state in the save, no tuning change); the swamp light is a faint trail only (frame evidence: a night-tone frame shows the glow pool); P10 green. **✅ LANDED (v1.9, session v19-light, `35c3d78`)** — the three lighting beats, all **PRESENTATION-ONLY** (the load-bearing invariant held: `src/logic.js` byte-identical to `6c9e09e`, SAVE_VERSION 12, GAME_VERSION 1.0.0, no tuning / runT / logic number moves; no new save state). **Charged-paint glow** — the frog's `draw` (player.js) adds a soft radial halo at the brush tip whose alpha + radius ride `splashCharge` (brightest at full charge, the charge that triggers a swipe); the radial is drawn with a per-frame `createRadialGradient` only while `splashCharge > 0.02` (a charged stroke), so an idle/low-charge frame is byte-identical to before (no per-frame gradient allocation on the normal path). **Awaken bloom** — the heron's `_drawHeron` adds a pulsing light halo behind the boss while `awakened` (the Awakened / high-HP state gets a light corona; `now`-driven pulse, no allocation, gated on `h.awakened`). **Lantern light pools extended into the base swamp as PURE LIGHT** — the parked "lantern in the swamp" done as LIGHT (no fuel, no mechanics): a small SEEDED pool of soft warm light pools (`world.swampLightPools`, built once in `World.build()` from a dedicated `mulberry32(seed + 1571)` stream) drawn into the world-space pass right after `drawBackground` (so they read as the ground glowing faintly along the path); the frog carries a faint glow via the existing v1.4 warm vignette (already on by default). **SEEDED**: the pool is a pure function of the world seed (a fixed seed gives the same layout — the A/B invariance holds); base-swamp ONLY (a Reeds variant's pool is empty → the draw is a no-op, a Reeds run renders exactly as before). **POOLED + view-culled + baked-once** (capped at 6; `swampLightCounts` culls to the view → the on-screen total stays capped into the P10 budget; the glow sprite is `document.createElement('canvas')`-baked ONCE and `drawImage`d — one drawImage per pool, NO per-frame gradient allocation). New **smoke stage 110** (13 assertions): the light-pool layout is a pure function of the seed + seed variance, the swamp-pool / Reeds-empty split, the cap + view-cull (a full-world view ≤ cap, an off-screen view culls to 0), the Reeds no-op draw, one drawImage per on-screen pool, sprite-reuse (no re-bake on a second draw), and the P10 paint-juice ≤ 220 with the pools active. Frame evidence: the frames harness registers 4 after-L2 scenes — `tests/frames/after-L2/swamp-light-pools.png` + `swamp-light-pools-b.png` (the SAME world + camera ~1.4 s apart, **md5-differing = the pools BREATHE**) / `charged-paint-glow.png` (the brush radial at full splashCharge) / `boss-gray-heron-awaken-halo.png` (the Awakened halo). Invariant held: all 9 probes in band UNCHANGED (pace ~17.2 / humance ~18.9 / ngpace cycle-1 19.5 / bosspace 37.1 s / reedspace ~22.1 / wandpace both legs / wardpace ~3.9 / blackpace ~25.7 / umbrapace ~3.66). **Next: L3 (LANDED, `7bcdcd1`).** |
| L3 | **Enemy liveness** — telegraph variety (each enemy gets a distinct pre-attack tell beyond the current flash: beetle lowers, toad inflates, mosquito widens its weave), panic states (a painted-but-not-frozen enemy briefly flees), small behaviors (beetles dig a tell, a toad licks paint off its body between attacks, a wisp drifts away from the lantern when lit). Seeded; per-enemy AI stays within the existing hot-path budget. | Each new behavior is seeded (deterministic at a fixed seed — a smoke stage samples 3 enemies × 3 seeds); P10 AI-cull green; frame evidence: a tell frame per enemy. **✅ LANDED (v1.9, session v19-light, `7bcdcd1`)** — distinct SEEDED telegraphs + panic/lick/flee, all **PRESENTATION-ONLY** (the load-bearing invariant held: `src/logic.js` byte-identical to `6c9e09e`, SAVE_VERSION 12, GAME_VERSION 1.0.0, no tuning / runT / logic number moves; the painted/frozen/root/burn rules stay byte-identical). Every behavior is a **DRAW-ONLY state** computed by the new pure `l3Draw(e, now)` (enemies.js) — a function of `(e._seed, e.tintT, e._light, now)` with **NO `Math.random`, NO per-frame allocation** (it writes scalar fields `e._l3dx/_l3dy/_l3scale/_l3crouch/_l3lick`) — so a fixed seed gives the same offsets every frame (deterministic). `l3Draw` is called from `drawEnemy` (render time) and **NEVER touches `e.x`/`e.y`/`e.r` (the collision body), `hp`, `dmg`, `status`, `tintT` decay, death timing, or the seeded RNG stream**; it feeds no movement, so the P10 AI-cull (near-seeks / far-culls) is unaffected. **Telegraph variety** — the beetle LOWERS (a slow crouch down a few px once per ~2.6 s, driven by a seeded `l3Pulse(now, phase, 2.6, 0.34)`; the SAME 0..1 amount drives the dirt "dig" tell — a mound of kicked-up dirt at its base that swells as it crouches), the toad INFLATES (a body puff up to ~12% once per ~3.2 s; the collision radius `e.r` is untouched — only the rendered sprite scales), the mosquito WIDENS its weave (an EXTRA horizontal sway up to ~13 px that swells for a beat; the baseline 2 px sway keeps it lively, the pulse adds the width — the collision body is untouched). **Panic state** — a freshly-painted, NOT-frozen creature briefly DARTS away a few px (a short local offset up to ~9 px, fading as `tintT` decays below ~0.25; direction is seeded per enemy). The shadow stays at the collision body (`e.x`/`e.y`) while the sprite shifts — the visual proof the hitbox did not move. **Small behaviors** — a toad LICKS the paint off its own back between attacks (a tongue flick + a pigment bead in its own paint tint, gated on `e.tintT > 0`, a visual "peeling the paint off" read of the existing paint state, not a new rule), and a wisp DRIFTS AWAY from the lantern when lit (a small sway whose amplitude grows with the light it receives `e._light`; a no-op when unlit, so an unlit wisp renders as before). **SEEDED + A/B-PROVEN**: new **smoke stage 111** (8 assertions) — the 3-enemy × 3-seed deterministic matrix (beetle crouch / toad inflate / mosquito widen are identical for the same seed across two fresh spawns, and differ for a different seed), `l3Pulse` bounded 0..1, the toad-inflate bounded (1.0..~1.12, 1 for the other kinds), the dart is seeded + `tintT`-driven (fresh > faded; a different seed gives a different dart), **the A/B swipe invariance** (the SAME paint + player drives one swipe at a freshly-painted beetle with the L3 layer ON (dart active) vs OFF → identical hit outcome: hp / status / alive / tint all match, while the collision x is untouched), and **l3Draw does NOT move any enemy's collision x** (near 150→150, far 3000→3000 — the P10 AI-cull is unaffected by the liveness layer). Frame evidence: the frames harness registers 4 after-L3 scenes (one tell frame per behavior) — `tests/frames/after-L3/beetle-lowers.png` (the crouch + dig) / `toad-inflates.png` (the body puff) / `mosquito-weave.png` (the widened sway) / `wisp-flee-from-lantern.png` (the lit-wisp flee sway). Invariant held: all 9 probes in band UNCHANGED (pace ~17.2 / humance ~18.3–18.9 / ngpace cycle-1 19.5 / bosspace 37.1 s / reedspace ~22.1 / wandpace both legs / wardpace ~3.9 / blackpace ~25.7 / umbrapace ~3.58–3.66). **No known-scope-decision** — every behavior was made presentation-only (the hitbox-never-moves guarantee is proven by the A/B + the collision-x assertions), so nothing had to be deferred to the orchestrator. **Next: L4.** |
| L4 | **Visual identity pass** — one color-grade discipline across every screen (a consistent paper/pigment palette mapping, the existing grain/vignette options as the grade), UI consistency (the paper theme end-to-end: every panel, the HUD, the title, the gallery wall, the seed card, the recap strip share one typeface/weight/spacing scale), and the frame-set review pass (the before/after review of the T0 baseline vs the v1.9 set). | A node check enumerates the shared UI constants (typeface/weight/spacing scale + palette map) referenced by the panels (no per-panel ad-hoc fonts); the frame review is recorded in the A1 audit. **✅ LANDED (v1.9, session v19-identity, `4877487`)** — ONE shared UI grade, all **PRESENTATION-ONLY** (the load-bearing invariant held: `src/logic.js` byte-identical to `6c9e09e`, SAVE_VERSION 12, GAME_VERSION 1.0.0, no new runtime dep; all 9 pacing probes in band UNCHANGED — logic.js untouched ⇒ sim-identical; `node tests/smoke.mjs` green). The shared constants live in a small module-level `UI` object in `src/ui.js`: a **palette** (single source of truth for the paper/ink grade — `paper`/`paperDark`/`paperLight`/`ink`/`gold`/`green`; the existing `INK`/`PAPER`/`PAPER_DARK` consts now DERIVE from `UI.palette` so there is one place to change the grade), **three NAMED typefaces** (ONE serif `Georgia, serif` voice + the `display` cursive exception for the title/banner buttons + the `mono` `Courier New` exception for the save-blob preview field — both exceptions are *recorded decisions*, not drift), and a **25-step named type scale** (`UI.sizes.micro…megaLg`). A memoized `uiFont(size, {weight, italic, display, mono})` factory is the ONLY way the UI builds a font (P10: the memo cache is bounded — finite size-scale × small weight set — so steady-state draws are allocation-free, matching the pre-L4 profile where font LITERALS were interned). Every one of the **~195 static** UI font sites across `game.js` (title/options/atelier/gallery/seed-card/recap/HUD/pause/banners), `enemies.js` (the serpent "!" telegraph + the crag-frog drifting "z"), and `paint.js` (the hit-notes) now routes through `uiFont(UI.sizes.<step>, …)` — **zero raw font literals remain** (a strict scan confirms it). The 3 genuinely DYNAMIC sizes (the float-text pop `Math.round(15*pop)`, the `uiButton` height-scaled label, and the factory's own `px`) pass a computed number and are the documented exceptions. The grain + vignette options are KEPT as the shared grade (no new rendering mode added). **Rendering-identity proof:** `uiFont()` reproduces every pre-L4 font string byte-for-byte (verified by mapping all 196 pre-L4 literals through the factory → identical) and NO color value changed across the diff (the only "change" is the `#fdf6e9` hover/label hex now spelled as `UI.palette.paperLight`, the same value) — so this is a pure consistency/centralization pass, provably rendering-identical to pre-L4 (the full T0 frame set re-captured 36/36 non-trivial; the 6 UI-heavy screens spot-checked — the frame harness is pixel-NONDETERMINISTIC on this GPU (two identical runs differ), so the byte-identity proof above is the authoritative evidence, not an md5 diff). **Frame-set review for the A1 audit:** the before/after of the T0 baseline vs the post-pass set is a no-op by construction (rendering-identical); the A1 fresh session should confirm by eye against `tests/frames/` (the 36 baselines, re-captured post-pass) and note the named exceptions (display cursive + save-blob mono). |

### A1 — the quality audit (final gate)
| ID | Item | Acceptance |
|---|---|---|
| A1 | **The v1.9 quality audit** (K10/C4/A1-style): smoke ×3 green (deterministic); all 9 pacing probes IN band UNCHANGED (byte-identity: makeTuning + applyNGPlus deep-equal the v1.8-complete `6c9e09e` values); the P10 culling stage green WITH the new environmental layer + hitstop + droplets active; zero new runtime deps (the frames harness is dev-only/gitignored — audit the diff for it); SAVE_VERSION stays 12; the frame-evidence set complete (every S/J/L item has its before/after); no 8765 server left running. | The commit itself + the audit table (probe bands + frame-set completeness list). **✅ LANDED (v1.9, session v19-a1, FRESH session — the implementer does not sign its own work, 2026-09-09) — every gate GREEN; v1.9 marked COMPLETE.** Ran the full A1 spec (all measured values below). The load-bearing invariant held end-to-end: `git diff 6c9e09e..HEAD -- src/logic.js` is **EMPTY** (0 lines) — every v1.9 item is presentation-only. Full audit table + frame-review note + the named-exceptions list appended directly below. |

#### A1 audit table (measured values, session `v19-a1`, 2026-09-09)

| # | Gate | Expected | Measured | Status |
|---|---|---|---|---|
| 1a | `node tests/smoke.mjs` ×3 consecutive | ALL SMOKE TESTS PASSED ×3 | **10/10 consecutive PASSED** (a 10-run flakecheck, 0 failures; exceeds the ×3 ask; 108 stages; the `144fb1c` determinism pin green) | ✅ |
| 2a | `pace.mjs` first-time human | 15–20 min | **~16.9–17.3 min** (deterministic file, ~±0.4 min run-to-run from the fresh unseeded world's wave count) | ✅ |
| 2b | `humance.mjs` first-time human | 15–20 min | **~18.0–18.4 min** (measured cross-swamp 53–58 s) | ✅ |
| 2c | `ngpace.mjs` cycle-1 | 15–20 min | **19.4–19.5 min** (IN BAND ✅ per the probe's own gate) | ✅ |
| 2d | `bosspace.mjs` heron god fight | in range | **37.0 s** (0.62 min god-mode) | ✅ |
| 2e | `reedspace.mjs` | ~22.2 (20–25) | **~22.1–22.2 min** | ✅ |
| 2f | `wandpace.mjs` both legs | 15–20 + 20–25 | **first-time 16.9–17.8 (8/8 in band) + Wander×Reeds 21.6–22.7 (8/8 in band)** | ✅ |
| 2g | `wardpace.mjs` | ~2–4 min | **3.9–4.0 min human** (god 98–104 s) | ✅ |
| 2h | `blackpace.mjs` | ~22–26 min | **~25.8–25.9 min** | ✅ |
| 2i | `umbrapace.mjs` | ~2.5–4 min | **~3.6–3.9 min human** (god 91.5–98.0 s) | ✅ |
| — | **UNCHANGED, proven (not assumed)** | probes identical to `6c9e09e` | the identical 9 probes re-run in a **baseline worktree at `6c9e09e`** give the same distributions (pace 17.0–17.3 / humance 18.0–18.3 / ngpace 19.4 / bosspace 37.0 s / reedspace 22.2 / blackpace 25.8 / umbrapace 3.6–3.9 / wardpace 3.9–4.1 / wandpace same bands); **all 9 probe files + `src/logic.js` byte-identical to `6c9e09e`** | ✅ |
| 3 | `git diff 6c9e09e..HEAD -- src/logic.js` | EMPTY (0 lines) | **EMPTY — 0 lines** (blob hash `e742877` == baseline `e742877`) — every v1.9 item is presentation-only | ✅ |
| 4a | `node tests/sfx.mjs` | SFX TESTS PASSED | **PASSED** (44 bank names verified + cap + routing) | ✅ |
| 4b | `node tests/music.mjs` | MUSIC TESTS PASSED | **PASSED** (143 assertions) | ✅ |
| 4c | `node tests/ui.mjs` | UI TESTS PASSED | **PASSED** (78 assertions) | ✅ |
| 5 | P10 culling WITH the new layers | stages green, ≤220 budget | **stages 59c / 107 / 108 / 109 / 110 / 111 all present + green** in the passing run (108 stages; hitstop + droplets + kill-bursts + L1 environmental + L2 lighting + L3 enemy-liveness all active; the ≤220 paint-juice budget asserted in 59c + 107 + 109) | ✅ |
| 6a | frame set COMPLETE | every S/J/L item has before/after | **36/36 baseline non-trivial** (re-captured via `node tests/frames.mjs`, 0 failed) + **26 after-frames** (after-J1 ×2, after-J2 ×5, after-J3 ×3, after-J4 ×4, after-L1 ×4, after-L2 ×4, after-L3 ×4); total 62 PNGs | ✅ |
| 6b | by-eye frame review (6 UI-heavy + gameplay) | L4 identity coherent; the 3 named exceptions the only divergences | see the **frame-review note** below | ✅ (with 1 pre-existing finding) |
| 7a | zero new runtime deps | diff touches only `src/`+`tests/`+`docs/`+`PROJECT_STATE.md` | diff touches `src/`, `tests/`, `docs/`, `PROJECT_STATE.md` + `.gitignore` (the frames PNG/manifest gitignore rule); **no package.json / lockfile committed** | ✅ |
| 7b | `node_modules` NOT tracked | `git ls-files \| grep node_modules` empty | **empty** (exit 1) | ✅ |
| 7c | frames harness dev-only / gitignored | PNGs + manifests gitignored | `.gitignore` ignores `tests/frames/**/*.png` + `*.manifest.json`; `node_modules/` ignored | ✅ |
| 8a | SAVE_VERSION | 12 | **`export const SAVE_VERSION = 12;`** (logic.js:2533) | ✅ |
| 8b | GAME_VERSION | '1.0.0' | **`export const GAME_VERSION = '1.0.0';`** (logic.js:2539) | ✅ |
| 9 | no `http.server 8765` left running | netstat empty before + after | **no 8765 listener (before + after)** — the harness runs on a free port and kills its own server | ✅ |

**Every gate GREEN → v1.9 marked COMPLETE.**

#### A1 frame-review note (by-eye, `tests/frames/`)

Reviewed the 6 UI-heavy screens (title, options, atelier-loadout, gallery-wall-full,
wander-seed-card, end-recap) + 2 gameplay frames (paint-red, boss-gray-heron-awaken) —
**308 text draws** captured across 8 staged scenes via a `fillText` hook on `G.ctx`
(dev-only, since removed).

- **L4 identity COHERENT:** zero typeface drift — every draw routes through Georgia
  (the single serif voice) or one of the three **named exceptions** (the
  `uiFont({display:true})` display-cursive path, the `uiFont({mono:true})` Courier
  New save-blob path, the 9px `UI.sizes.micro` Georgia crag-frog "z"). Zero
  off-scale sizes (all px values map onto the `UI.sizes` 25-step scale). One
  typeface/weight/spacing discipline holds end-to-end — the L4 pass reads as one
  coherent identity, not per-panel ad-hoc fonts.
- **No misaligned panels, no broken font** on any reviewed scene.
- **One CLIPPED-TEXT finding (PRE-EXISTING, NOT a v1.9 regression — routed to the
  post-1.0 backlog):** the title/options **footer** (the "expeditions · victories ·
  herons painted" stats line + the "G/N/B to set difficulty …" help line) and the
  end-recap **"return to the pond (Esc)"** label render at/below the 1280×800 canvas
  bottom. Measured bboxes: stats line y=796 (bottom y≈803 → ~3 px of its lower half
  clipped); the help line y=816 (entirely below the 800 px canvas — **not visible**);
  end-recap return label y=830 (below the visible canvas). Pixel ground-truth on the
  real PNGs confirms it: `title.png` shows 0 inked pixels below y=799, and
  `end-recap.png`'s bottom row (y796–799) is sparser than the rows above. **Why this
  is not a v1.9 defect:** `git diff 6c9e09e..HEAD` shows the footer/end y-geometry
  (the `_titleLayout` `aby/abh/fpush` block + the `_endButtons` `ret` rect) is
  **byte-identical** to the v1.8 baseline — v1.9's L4 changed **only** the font-string
  literal → the same-size `uiFont()` call. The clip predates v1.9 (it is a
  title-screen layout issue that surfaces on the tall, victory-unlocked title where
  the Reeds button pushes the footer down). Fix = nudge the footer up / reflow the
  title layout (a v1.10 / post-1.0 item); it is NOT a v1.9 regression and does not
  block the sign-off.

#### Named-exceptions list (the only divergences from Georgia serif)

1. **Display cursive** — `UI.display: '"Comic Sans MS", "Segoe Print", cursive'`,
   routed ONLY through `uiFont(px, { display: true })` (title wordmark, banner
   buttons). A recorded decision (the game's playful voice), not drift.
2. **Mono save-blob font** — `UI.mono: '"Courier New", monospace'`, routed ONLY
   through `uiFont(px, { mono: true })` (the export/save-blob preview field — a
   code-like text dump reads best monospaced). A recorded decision.
3. **9px crag-frog "z"** — the sleeping Blind Crag Frog's drifting "z" puff uses
   `uiFont(UI.sizes.micro, { weight: 700 })` (9 px), the smallest step on the named
   scale — a deliberate tiny "sleep" glyph, not a body-text size.

Beyond these three, every UI draw is Georgia serif at a named `UI.sizes` step.

**Batch plan:** T0 (the harness + baseline frames) → S1 (the SFX bank — the
highest single-impact lever) + S2 → S3 + J1 → J2 + J3 → J4 + **L1 (LANDED,
`ed8f2fa`)** + **L2 (LANDED, `35c3d78`)** + **L3 (LANDED, `7bcdcd1`)** +
**L4 (LANDED, `4877487`)** → A1 (a FRESH session — the implementer does not sign
its own work). ~13 items, ~5 sessions.

### Explicitly deferred past v1.9 (not forgotten)
- **The true "lantern in the swamp" BALANCE version** (a fuel loop in the base
  swamp) — v1.9's L2 lands it as LIGHT only; the mechanics version stays a
  balance item.
- **Accessibility (X1 colorblind glyphs, X2 remappable keys, X3 text-size)** —
  Joel's standing call; X2 is the natural companion to the gamepad.
- **Gold as a 4th combat pigment** — still fights the 3-hue pillar; stays
  meta-only.
- **CRT scanlines / retro filters** — rejected; the painted world has no
  retro mode.
- **Co-op / multiplayer** — architecture mismatch with loopback-only,
  single-session, localStorage.
- **Unbounded / infinite procedural generation** — v1.7's Wander is bounded;
  a true open-ended generator stays out until the envelope data proves it safe.
- **A fourth hand-tuned biome** (Gallery Underground / the Atelier at night) —
  a content item for a future version.
- **60fps / high-refresh guarantee** — the game targets a stable frame budget
  (P10); a hard 120Hz high-refresh mode is out of scope (the feel targets are
  tuned at the current cadence).
- **Image/audio/font assets** — invariant: everything stays procedural
  (math.js shapes, canvas, WebAudio synth).
