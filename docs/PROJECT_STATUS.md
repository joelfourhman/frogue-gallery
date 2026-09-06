# Frogue Gallery — Project Status (PM)

Concise PM view. Durable status/next-action detail lives in root
`PROJECT_STATE.md` (read that first); milestones in `docs/ROADMAP.md`;
consequential decisions in `docs/DECISIONS.md`.

**Last PM audit: 2026-09-06 (v1.1 COMPLETE; v1.2 "The Collection" — M9 Batch 1 A1–A3 done + A4 Rehung Frame done + E1 Painted Heron done + E2 weather/tide phases done + E3 Bold-only zone hazards done + E4 orb-streak bonus done + V1 color-reveal bar done + V2 heron awaken bloom done + V3 per-zone ambient audio done + V4 end-screen exhibition done + M13 T1 guided first expedition done + M13 T2 interactive pigment drills done + M13 T3 mini sketch heron done; Batch 2/3/4/5 COMPLETE, Batch 6 T3 committed)**

## Current state

- Release DoD: **all 12 items satisfied** (final audit 2026-09-05).
- **v1.1 COMPLETE**: M7 (B1–B6), M7.5 (PT1–PT5), M8 (P10/P12/P7/P8/P6/P9/P11).
- **Active phase: v1.2 "The Collection"** (M9 Atelier/collection, M10
  Expedition depth, M11 Presentation, M13 Tutorial; accessibility deferred).
  Driven in bounded batches of ~3 items — see `PROJECT_STATE.md` →
  Immediate Next Action for the batch order. **Batch 1 (A1–A3) COMPLETE: A1 ✅
  (atelier one-liners), A2 ✅ (painting synergy pairs), A3 ✅ (Curator's Ledger).**
  **Batch 2 COMPLETE: A4 ✅ (Rehung Frame — permanent saved Gallery Bonus,
  prestige-lite, `SAVE_VERSION` 1→2), E1 ✅ (Painted Heron — mid-run
  "half-heron" set-piece, non-blocking, reuses `bossStep`/`paintBossHit`),
  E2 ✅ (weather/tide phases — Rain/Drought ambient buffs, deterministic
  per run seed + zone, eased transient multiplier on live tuning).**
  **Batch 3 (COMPLETE): E3 ✅ (Bold-only zone hazards — Thorn Reed roots,
  Mud Pool slows; Bold-only gate so Normal 15–20 min pacing untouched,
  difficulty-gated so pacing probes intentionally NOT re-run; pure seeded
  placement in logic.js, player slow/root state, thin game.js wiring),
  E4 ✅ (orb-streak bonus — clean-orb streak multiplies orb value ×1.40 max,
  resets on a hit, pure logic.js + in-run counter + top-right HUD chip +
  distinct chime; pacing re-verified 18.7/19.2 min, in band),
  V1 ✅ (color-reveal progress bar — thin top HUD bar fills gray→full color
  as world saturation recovers; pure read of worldColorSat() through a pure
  revealProgress() mapping in logic.js so the bar always matches the world;
  pure HUD, zero gameplay change, no run-time added),
  V2 ✅ (heron awaken bloom — the moment the final heron turns colorful: a
  world-space radial 3-pigment color wash + a render-only world saturation
  surge + a distinctive `awaken-bloom` SFX; wired to the real `paintBossHit →
  'awaken'` path so it fires exactly when the flag flips; pure presentation —
  the surge is render-only and never mutates worldColorSat(), the V1 bar's
  single source of truth, so pacing is untouched),
  V3 ✅ (per-zone ambient audio bed — a soft looping ambient layer that shifts
  by zone, synthesized from the existing WebAudio osc/noise/filter nodes, wired
  `voices → zg → _ambMaster(0.6) → musicBus` so it inherits the music slider +
  mute; crossfades between zones on entry and fades out at run end; pure
  presentation — only *adds* sound, no gameplay timing change, so pacing is
  untouched),
  V4 ✅ (end-screen exhibition — the victory end-screen shows the paintings
  carried this expedition (the 2-slot loadout) as a framed "Curator's Wall":
  each titled, in a row, with a soft staggered fade+rise reveal animated on
  endT; reuses the P8 Gallery Wall frame look + painting data, no new art; the
  victory card grows to 540px via _endCardH() shared by draw + click rects;
  pure presentation, so pacing is untouched),
  T1 ✅ (guided first expedition — a fresh-save-only "Guided First Expedition"
  button starts a low-stakes teaching run on the opening zone: three on-screen
  goal chips (beetle/red→burn-to-death, mosquito/blue→freeze, toad/green→root),
  each advancing only when the player actually causes the real effect via
  logic.tutorialDrillSatisfied; fully skippable (SKIP/Escape persists
  save.flags.tutorialSkipped); the timed clock is FROZEN while it runs so it
  never inflates the 15–20 min timed expedition; schema v3),
  T2 ✅ (interactive pigment drills — the same guided run gains three explicit
  per-pigment "do it" drills as a later phase (TUTORIAL_PHASES idx 3-5): the
  player must CAUSE a beetle to die from burn / a mosquito to freeze / a toad
  to root; advancement reads the enemy's REAL status/death (logic.js, never a
  brush stroke); each completion persists save.tutorialDrills so T3/T4 "Watch
  me" retraining can reference which drills were done; partial completion is
  preserved across a mid-drills skip),
  T3 ✅ (mini "sketch" heron — the guided run's FINAL phase (idx 6): a low-HP
  "sketch" heron (SKETCH_HERON config, 240 HP vs 30000, awakenNeed ~1 hue,
  maxPhase 2, contactDmg 0) reuses the real heron's bossStep + 3-hue awaken
  machinery; it is pinned in brush reach and the beat completes when the
  player paints all three hues to AWAKEN it — the same 3-hue loop the 30k-HP
  fight uses, so the real boss is a known pattern; completion persists
  save.tutorialDrills.awaken=true (tutorialDone reads it), SKIP during the
  sketch does NOT record awaken (finishing is optional); frozen teaching layer
  so it adds no timed-run time).**
  - Smoke suite: **44 stages, ALL PASSED** (stage 34 = v1.2 M10 E1 Painted Heron; stage 35 = v1.2 M10 E2 weather/tide phases; stage 36 = v1.2 M10 E3 Bold-only zone hazards; stage 37 = v1.2 M10 E4 orb-streak bonus; stage 38 = v1.2 M11 V1 color-reveal bar; stage 39 = v1.2 M11 V2 heron awaken bloom; stage 40 = v1.2 M11 V3 per-zone ambient audio bed; stage 41 = v1.2 M11 V4 end-screen exhibition; **stage 42 = v1.2 M13 T1 guided first expedition; stage 43 = v1.2 M13 T2 interactive pigment drills; stage 44 = v1.2 M13 T3 mini sketch heron**). Pacing
  probes green on Normal: `pace.mjs` (analytic ~18.7 min) + `humance.mjs` (simulated
  human, ~18.7 min full-run / 53s cross-swamp) + `bosspace.mjs` (re-verified after
  T1/T2/T3; the frozen tutorial pre-run layer adds no timed-run time). Real-browser: 60 fps title / full world.
- Git: v1.1 fully committed; v1.2 roadmap + M13 tutorial
  swap committed (`5258d13`, `543d1cd`).

## Active work

**v1.2 "The Collection" — in progress, driven in bounded batches of ~3 items.**
Batch order (one conventional commit per item, docs + suite green per commit):
M9 A1→A2→A3 → A4 / M10 E1→E2 → E3→E4 / M11 V1 → V2→V3→V4 → M13 T1→T2→T3→T4.
**Batch 1 (A1–A3) COMPLETE. Batch 2 (A4 Rehung Frame ✅ + E1 Painted Heron ✅ + E2 weather/tide phases ✅) COMPLETE — suite 35/35, pacing in band on Normal. Batch 3 (E3 Bold-only zone hazards ✅ → E4 orb-streak bonus ✅ → V1 color-reveal bar ✅) COMPLETE — suite 38/38, pacing 18.7/19.2 min in band. Batch 4 (M11 Presentation, presentation-only — pacing untouched): V2 ✅ (heron awaken bloom) + V3 ✅ (per-zone ambient audio) + V4 ✅ (end-screen exhibition) COMPLETE — suite 41/41. Batch 5 (M13 Tutorial): T1 ✅ (guided first expedition) + T2 ✅ (interactive pigment drills) COMPLETE — suite 43/43, pacing 18.7/18.9 min (the tutorial is a frozen pre-run layer that adds no timed-run time).** See
`PROJECT_STATE.md` → Immediate Next Action.

## Blockers

None. Loopback dev server, Node, and all tests are healthy.

## Known bugs / risks

- No open confirmed gameplay bugs; v1.1 hardening (B2–B6) is done.
- Risk: v1.2 feature creep — the deferred list in docs/ROADMAP.md is the
  boundary; gold pigment / gamepad / NG+ / multiplayer / accessibility stay
  out of v1.2.
- Risk: `src/game.js` is ~1935 lines and holds state-machine + HUD; new
  screens/features must stay thin there, logic in `src/logic.js` where possible.
- Risk: the PM runs on a local model with a hard context ceiling — long runs
  crash mid-edit. Mitigation: bounded batches (~3 items/session), each ending
  in a clean commit so a fresh session resumes losslessly.

## Technical debt

- `game.js` size (above) — manage by keeping new features out of it.
- No unit tests beyond smoke.mjs/pace probes — acceptable for project size;
  keep pure logic in logic.js so that stays true.

## Next priority

**v1.2 Batch 4 (M11 Presentation) — COMPLETE (presentation-only; pacing
untouched; no pace/humance re-run needed).** All three items done:
**V2 ✅ (heron awaken bloom)**, **V3 ✅ (per-zone ambient audio bed)**,
**V4 ✅ (end-screen exhibition)** — suite 41/41. Next up: **M13 T1
(guided first expedition)** — the opt-out tutorial that teaches "painting is
the game." Each item ships with a smoke stage or documented check, the suite
green, and PROJECT_STATE.md / docs/ROADMAP.md / docs/PROJECT_STATUS.md
updated before committing.

## Release readiness

Release: ready (DoD met, suite green). v1.1: **complete** — M7 + M7.5 + M8
all done; smoke 29/29; pacing probes green (human est. 18.3–19.4 min, in the
15–20 min target). v1.2: **in progress** (M9–M13, bounded batches); the
release stays playable at every commit.
