# Frogue Gallery — Project Status (PM)

Concise PM view. Durable status/next-action detail lives in root
`PROJECT_STATE.md` (read that first); milestones in `docs/ROADMAP.md`;
consequential decisions in `docs/DECISIONS.md`.

**Last PM audit: 2026-09-06 (v1.1 COMPLETE; v1.2 "The Collection" — M9 Batch 1 A1–A3 done + A4 Rehung Frame done + E1 Painted Heron done + E2 weather/tide phases done + E3 Bold-only zone hazards done + E4 orb-streak bonus done + V1 color-reveal bar done + V2 heron awaken bloom done + V3 per-zone ambient audio done + V4 end-screen exhibition done; Batch 2 COMPLETE, Batch 3 COMPLETE, Batch 4 (M11) COMPLETE)**

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
  pure presentation, so pacing is untouched).**
  - Smoke suite: **42 stages, ALL PASSED** (stage 34 = v1.2 M10 E1 Painted Heron; stage 35 = v1.2 M10 E2 weather/tide phases; stage 36 = v1.2 M10 E3 Bold-only zone hazards; stage 37 = v1.2 M10 E4 orb-streak bonus; stage 38 = v1.2 M11 V1 color-reveal bar; stage 39 = v1.2 M11 V2 heron awaken bloom; stage 40 = v1.2 M11 V3 per-zone ambient audio bed; stage 41 = v1.2 M11 V4 end-screen exhibition; **stage 42 = v1.2 M13 T1 guided first expedition**). Pacing
  probes green on Normal: `pace.mjs` (analytic ~18.7 min) + `humance.mjs` (simulated
  human, ~19.2 min full-run / 54s cross-swamp) + `bosspace.mjs`. Real-browser: 60 fps title / full world.
- Git: v1.1 fully committed; v1.2 roadmap + M13 tutorial
  swap committed (`5258d13`, `543d1cd`).

## Active work

**v1.2 "The Collection" — in progress, driven in bounded batches of ~3 items.**
Batch order (one conventional commit per item, docs + suite green per commit):
M9 A1→A2→A3 → A4 / M10 E1→E2 → E3→E4 / M11 V1 → V2→V3→V4 → M13 T1→T2→T3→T4.
**Batch 1 (A1–A3) COMPLETE. Batch 2 (A4 Rehung Frame ✅ + E1 Painted Heron ✅ + E2 weather/tide phases ✅) COMPLETE — suite 35/35, pacing in band on Normal. Batch 3 (E3 Bold-only zone hazards ✅ → E4 orb-streak bonus ✅ → V1 color-reveal bar ✅) COMPLETE — suite 38/38, pacing 18.7/19.2 min in band. Batch 4 (M11 Presentation, presentation-only — pacing untouched): V2 ✅ (heron awaken bloom) + V3 ✅ (per-zone ambient audio) + V4 ✅ (end-screen exhibition) COMPLETE — suite 41/41. Batch 5 (M13 Tutorial) IN PROGRESS: T1 ✅ (guided first expedition) committed — suite 42/42.** See
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
