# Twenty delights — 2026-11-11

- Added deeper-floor painting, hanging lanterns, whisper reeds, mushroom music
  and bounded garden completion celebrations: 64 props per floor.
- Added live attack/opening/blue-stop captions, boss phase instructions and
  a clearing result card with battle time, dodges and color use.
- Added floor introductions, contextual objectives, guardian landmarks,
  atlas arena/clearing markers and an end-screen brush-build recap.
- Added seeded later-rest offers, Broad brush, Quick strokes and Kind moss,
  with actual before/after tuning previews. Still only three run-only gifts.
- Removed duplicate attack captions and a clearing/depth UI overlap.
- All 19 required gates pass; base balance telemetry is unchanged. See
  ROADMAP.md Milestone 4 and VALIDATION-delights.md for the 20-item mapping.

# One continuous dungeon — 2026-11-11

- Connected Watercolor Marsh, Sunken Reeds, Hollow Sanctuary and Black Reeds
  into a single run. Great Gray Heron, Silt Wyrm and Hollow Warden guard the
  route; only the Umbral Wyrm ends it in victory.
- Three inter-floor rests heal 35% of maximum health and offer a run-only
  damage, health or recharge gift. Select a gift, then explicitly descend.
- Fresh runs begin at base difficulty stats; health and run totals carry
  between floors. Death/restart resets the route and gifts.
- Removed New Game+ cycles/scaling/modifiers, Green/Gilded Heron variants,
  gold-tier progression, gilded frames and prestige bonuses. Removed the
  standalone shop, Wander and challenge flows.
- Retained sketchbooks, pins, page names, title exhibitions, ordinary artwork
  collections and learned study interactions. Legacy purchased stats no longer
  affect starting builds. Save 12 / game 1.0.0 remain compatible.
- Added campaign transition/reward/save regressions and a complete simulated
  combat journey. Human enjoyment and full-dungeon duration remain unmeasured;
  see PROJECT_STATE.md for the verified results and limits.

Older entries below record previous behavior and can describe removed systems.

# Lily Clearing and free painting — 2026-11-11

- Optional three-round bell encounter, readable committed attacks and safe recovery.
- Blue interrupts; blue-to-red gains 50% direct damage against clearing bugs.
- 64 freely recolorable lilies, mushrooms, flowers and stones, kept for the run.
- One brush marker; plain color/action labels and contextual painting instructions.
- Bosses wait until their final arena; no early remote summons or boss music.
- Replay without loot/heal farming; leave to cancel. Painting a bug wins over bell input.
- Browser regressions cover real painting, bell, dodge, combo and pointer input.

# Responsive controls — 2026-11-11

- Tighter stopping/reversal and an immediate, short dodge hop.
- Ordinary brush hits keep movement at full speed; strong impacts retain weight.
- Q/E and wheel color selection; quick clicks reliably paint once.
- Visible brush reach, hittable-target ring, local splash and hop readiness.
- Larger HUD action text; repeated hits replace overlapping damage/status labels.
- Splash releases consistently; canceled charges cannot fire on a later click.
- Warden health reduced 4% to preserve its existing pacing band.

# The Living Sketchbook — 2026-11-11

- V opens a paused Field Atlas with current study progress, remembered scenes,
  nearest unfinished study and the expedition's available side paths/rests.
  Mouse and controller access also live in the pause menu.
- Study instruction cards show the needed pigment, action and coat count;
  aimed wrong-color strokes get quiet guidance, including above Reeds darkness.
- 24 decorative dragonflies and pond skaters quietly respond to nearby paint,
  with a separate deterministic random stream and bounded, fading effects.
- First-click aiming now resolves fresh pointer coordinates immediately,
  preventing a fast stroke from using the prior frame's direction.
- Reconciled the roadmap with completed Q1–Q9 work and prepared the anonymous
  five-player facilitator kit. Save 12 / Game 1.0.0 remain compatible.

# Astra Vertical Slice — 2026-09-26

Built on c1ea26b; no runtime/save-version bump.

- Added three living field paintings, a protected first studio, permanent
  colored brush-hop, and a three-study cosmetic signature.
- Added an eight-page sketchbook with sampled real strokes and local PNG export.
- Repaired fly speed/telegraphs, stationary hop/buffering, splash release,
  physical input ownership, controller aim/paint, responsive scaling, tutorial
  softlocks/retraining, pause behavior and victory rendering.
- Fixed invisible Silt/Umbral bodies caused by array/object coordinate mismatch;
  added finite-geometry checks. Lantern lighting now reveals underlying art
  with a reused mask. Corrected boss HUD names and overlapping/clipped UI.
- Retuned Warden HP52,000→50,000 to honor its original pacing band; welcome
  red5→6 preserves early buying power after corrected fly movement.
- Added seeded enforced checks, source/dist browser journeys, reusable browser
  discovery, deterministic ZIP packaging and a loopback-only local server.
- Replaced stale live plans with current design/state docs and a concrete Qwen
  roadmap/backlog. Historical material is preserved under docs/history.

Validation: smoke, all nine pacing gates, balance, UI/audio, source/dist
journeys,36 scenes, effects stress and package checks. See VALIDATION.md for
measurements and limits. Static upload ready; not publicly deployed.

---

# Frogue Gallery — Changelog

Release history, newest first. One block per version; the in-repo docs
(`docs/ROADMAP.md`) hold the full per-item detail, the git log the per-commit
detail (SHAs below are representative, not exhaustive). The project is
single-branch (`main`) with one conventional commit per item, so every line of
history is a coherent milestone.

## v1.8 — "The Full Collection" (2026-09-08) — the 1.0 release version

The release milestone. The meta loop gets its end-state, the Reeds get a
deeper second act, the game gets a sixth boss, and the release surface
(README + version string + this changelog) lands. `SAVE_VERSION` 11 → 12;
smoke suite 104 → 106 stages; 10 headless probes in band; a 1.0.0 version
string with a single source of truth.

- **G1** — the Black Reeds, the NG+ Reeds variant (`ngCycle >= 1` + a Reeds
  victory; a distinct `REEDS_DARK` layout: darker palettes, deeper pools,
  denser light pockets, the same geometry — no new collision code).
  `4ec7d07`
- **G2** — the Umbral Wyrm, the 6th boss archetype and the Black Reeds apex
  (a 2–4 min human band, a dual-phase deep-dark subterranean wyrm, a
  deep-dark lantern mandate). `49f74a8`
- **G3** — the end-of-Reeds boss-selection verification (Umbral Wyrm for NG+
  Reeds, Silt Wyrm for cycle-0 Reeds, the Hollow Warden for Wander × Reeds)
  + the `blackpace` probe. `3b5949d`
- **H1** — the "Full Collection" ledger (the pure `galleryCompletion` check,
  the one-time `galleryComplete` latch, the permanent capstone `galleryBonus`
  at completion, the new `flags.bossDefeats` array; `SAVE_VERSION` 11 → 12,
  both new fields default OFF/empty for legacy saves). `7be0d5f`
- **H2** — the Gallery Wall completion beat (the `X / 10` + `Y / 6` progress
  readout, the full-collection gold glow, the title "collection complete"
  badge, the completion cinematic). `c57b4d0`
- **R1** — the release surface (the README + the `GAME_VERSION = '1.0.0'`
  single source of truth rendered on the title + the Options header).
- **R2** — this changelog + the v1.8 decision close-out.
- **A1** — the 1.0.0 season audit (the final in-band confirmation, run in a
  fresh session).

## v1.7 — "The Ever-Shifting Swamp" (2026-09-07)

The Wander — a bounded, seeded procedural expedition variant (default OFF) —
plus a fifth boss and QoL. The hand-tuned path stays byte-identical; the
generated path is a new opt-in mode.

- **D1** — the Wander core: pure seeded bounded-procgen expedition content
  (default OFF, no new save field). `22c5d85`
- **D2** — the Wander "taste": a seeded flavor archetype that biases the run
  in-band. `b093ebf`
- **D3** — Wander NG+ + Reeds parity + the `wandpace` probe. `5f5e8af`
- **D4** — the Wander options toggle + save export/import parity. `6612442`
- **F1** — the Hollow Warden, the 5th boss archetype (the Wander-apex).
  `f21dcab`
- **O1/O2** — the pre-expedition Wander seed card + the end-of-run Wander
  recap line (seed + taste + a "Wandering expedition" tag).
- **I1** — the v1.7 season audit (signed off 2026-09-08). `144fb1c` also
  made the smoke suite deterministic (the flake-pin that later gated the
  v1.8 audit).

## v1.6 — "Beneath the Reeds" (2026-09-07)

The Reeds biome (a victory-gated, dark, lantern-lit second expedition),
gamepad support, and save export/import. `SAVE_VERSION` 9 → 10.

- **R1** — the Reeds biome shell + The Lantern (the deep-dark rule). `ded401e`
- **R2** — the Reeds encounter content (Wisp / Serpent / Leech) + the Silt
  Wyrm deep boss. `b2102f5`
- **W1** — gamepad support (raw Gamepad API; left stick moves, face buttons
  paint, shoulders hop/lantern, hold B to splash; Auto/Off toggle).
- **Q3** — save export/import (paste-based, loopback-only; the sanctioned
  carry-your-gallery escape hatch).

## v1.5 — "The Living Swamp" (2026-09-07)

The swamp becomes a living place: new residents, a weather system, a
third heron, and a storm set-piece. `SAVE_VERSION` 8 → 9.

- **K1** — the Mud Turtle (armored plodder; front-arc shell deflects paint,
  red burn is the counter). `1efb1a9`
- **K2** — the Blind Crag Frog (hunts by sound; sleeps when quiet and is +50%
  vulnerable; wakes on nearby paint/hop/charge). `b43fcac`
- **K3** — the Storm Surge (a zone-5 final-stretch set-piece: a bounded
  mosquito burst + a transient rain buff + a bonus-orb reward; non-blocking,
  never feeds `runT`). `e867a6f`
- **K4** — the Gilded Heron (the NG+ cycle-3+ third boss: a gold palette, a
  plume that absorbs the frog's green heal). `8dceb42`
- Plus the weather/tide system and the v1.5 release-readiness line.

## v1.4 — "Make It Amazing" (2026-09-07)

A polish + content pass: the "Encore" gallery viewing screen, two title
easter eggs, and the v1.4 completion (`SAVE_VERSION` 7 → 8, the
first-victory cinematic flag). `d031005` / `87d1848` / `dddbcaf`.

## v1.3 — "The Second Expedition" (2026-09-06)

New Game+ becomes the experience loop: a second heron, a gold-pigment
economy, expedition modifiers, and per-cycle scaling. All new content is
gated behind a completed victory, so a fresh save's 15–20 min pace is
unchanged. `SAVE_VERSION` 3 → 7 (NG+ cycle, modifier, the gold economy, and
the Gilded Frame tier). `58d5524` / `e201284` / `2f446c5`.

## v1.2 — "The Collection" (2026-09-06)

The collection deepens: the Curator's Ledger, painting synergy pairs, the
"Rehung Frame" prestige-lite bonus, the atelier one-liners, a mid-run Painted
Heron set-piece, weather/tide phases, and the M13 tutorial (guided first
expedition + interactive pigment drills). `SAVE_VERSION` 1 → 3. `913af17` /
`24eb5e5` / `08b954a`.

## v1.1 — Improvements & bug fixes (2026-09-05)

The hardening pass: the M7 bug fixes (B1–B6), the M8 improvements (P6–P12:
new-player guidance, juice, atelier onboarding, the 15–20 min run pacing with
`pace`/`bosspace` probes, the 4 named zones + rest checkpoints, difficulty
select, the Gallery Wall, the field guide, and the audio/options panel), and
the PM infrastructure (AGENTS.md, PROJECT_STATUS, ROADMAP, DECISIONS). The
release Definition of Done was marked complete this version. `f315c3a` /
`d556f90` / `a895da9`.

## v1.0 — the playable vertical slice (2026-08-30)

The game: a tiny frog painter exploring a watercolor swamp, painting back the
color, and facing the Great Gray Heron. The rules layer, world gen, audio,
particles, UI, input, the 4-zone swamp, the Atelier economy, the boss, the
first-run flow, the low-HP vignette + pause menu, and the 11-stage smoke
suite. `94b419b` / `089fa06` / `a18e494`.
