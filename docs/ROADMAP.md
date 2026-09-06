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

## v1.2 — "The Collection" (PLANNED — next milestone after v1.1)

Theme: make the *meta* as fun as the run. v1.1 proved the expedition; v1.2
gives the player something to collect, master, and show off — while keeping
the 15–20 min run, the "painting is the game" pillar, and the zero-dependency
boundary intact. Every item lands with a smoke stage (or documented probe),
the suite green, and docs updated per commit.

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
| E4 | Orb "streak" bonus: 3+ orbs collected without taking a hit grant a small bank bump + a distinct chime | rewards the dodge/hop skill the PT3 fly-fairness rebalance introduced; scales with the existing `bankGain` (pure fn, testable) | ⬜ |

### M11 — Presentation & feel

| ID | Item | Notes | Status |
|---|---|---|---|
| V1 | Painted-world "reveal": the swamp literally gains color as you paint it this run — a visible saturation bar + a subtle end-of-run "how much color did you restore?" tally on the end screen | the design pillar ("every stroke restores color to the swamp") is currently invisible; surfacing it makes the fantasy legible. Reuses `worldColorSat` + `restoreColor` (already tracked); tally feeds best-run | ⬜ |
| V2 | Heron Awaken "bloom" beat: a short, dramatic full-screen color bloom + screen shake when the heron enters Awakened, and a bloom on victory (already in design.md, currently under-sold) | sells the single most important moment of the fight; particle-budget aware (≤220 cap holds) | ⬜ |
| V3 | Audio: a per-zone ambient bed shift (4 subtle Web Audio drones cross-faded as you cross zone boundaries) | extends P9's music bus into the run; loopback-local synth, no assets; reuses the `musicBus` bed system | ⬜ |
| V4 | End-screen "exhibition": frame the heron + your 2-slot loadout as a titled, signed piece for the run, with a shareable title string | ties combat to the collection theme; data-only (no new rendering engine), reuses the P8 frame renderer | ⬜ |

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
| T1 | Guided first expedition: a scripted, low-stakes opening zone where the player is coaxed to paint a beetle (red = burn), a mosquito (blue = slow/freeze), and a toad (green = root) — each with an on-screen goal + a "try it" prompt, not a wall of text | reuses the existing tutorial/banner state machine (P1) but makes it interactive; a dedicated `tutorial` expedition flag so it can be re-entered from the Field Guide ("Watch me") | ⬜ |
| T2 | Interactive pigment-mechanic drills: three micro-moments, one per pigment, where the player must *achieve* the status effect (burn a beetle to death, freeze a mosquito, root a toad) before the tutorial advances — teaches the "colors change how you approach" pillar directly | each drill is a tiny deterministic scene (a few enemies, god-mode frog); success = the status applies, so the player learns the *interaction* (red→fire, blue→freeze on 2nd coat, green→root) by causing it | ⬜ |
| T3 | Mini heron: a small, low-HP "sketch" heron that teaches the color-awaken loop (paint all three hues → it Awakens → paint hard while it shimmers) in under 30s, with a clear win/lose and a "you got it — now the real one" handoff to the full boss | reuses `bossStep` + the 3-hue awaken logic at a reduced HP/tuning; the payoff that the real 30k-HP heron fight is a *known* pattern, not a surprise | ⬜ |
| T4 | Tutorial progress + re-entry: track which drills are done (persisted in the save), show a "✓ learned" state, and let the player re-open any drill from the Field Guide ("Watch me" per topic) | extends the save schema (new `tutorial` field, migrated by `migrateSave`); makes the Field Guide (P6) a real reference+retraining tool instead of a static cheat sheet | ⬜ |

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
