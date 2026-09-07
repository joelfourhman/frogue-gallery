# Frogue Gallery — Project Status (PM)

Concise PM view. Durable status/next-action detail lives in root
`PROJECT_STATE.md` (read that first); milestones in `docs/ROADMAP.md`;
consequential decisions in `docs/DECISIONS.md`.

**Last PM audit: 2026-09-07 (v1.1 + v1.2 + v1.3 COMPLETE; v1.4 "Make It Amazing" COMPLETE — all 14 items (J1–J5 juice, L1–L3 presence, S1–S3 audio, M1–M3 moments) + the Joel color rework (`012ce0b`); smoke 71/71, pacing 17.3/18.3/19.5 min; **v1.5 "The Living Swamp" APPROVED — executing in bounded batches**)**

## Current state

- Release DoD: **all 12 items satisfied** (final audit 2026-09-05).
- **v1.1 COMPLETE**: M7 (B1–B6), M7.5 (PT1–PT5), M8 (P10/P12/P7/P8/P6/P9/P11).
- **v1.2 "The Collection" COMPLETE** (2026-09-06): M9 Atelier/collection,
  M10 Expedition depth, M11 Presentation, M13 Tutorial (accessibility
  deferred). Batches 1–6 all done; suite 45/45; pacing 18.7/18.8 min.
- **v1.3 "The Second Expedition" COMPLETE** (2026-09-06): NG+ loop M14 (N1–N4), gold meta economy M15 (G1–G4), season wrap M16 (C1–C4).
- **v1.4 "Make It Amazing" COMPLETE** (2026-09-07): all 14 items (J1–J5 juice, L1–L3 presence, S1–S3 audio, M1–M3 moments) + the Joel color rework (`012ce0b`: red big-dmg+burn / blue freeze / green light-dmg+heal / dry cleanse+world-restorer / mosquito nerf). Smoke 71/71; pacing 17.3/18.3/19.5 min.
- **Active phase: v1.5 "The Living Swamp" — APPROVED (Joel, 2026-09-06: "Don't even pitch me v1.5. Just make it"), executing** — K1–K10 in `docs/ROADMAP.md` (new enemy archetypes, zone-5 Storm Surge set-piece, 3rd NG+ boss The Gilded Heron, 3 new modifiers + Master tier, seeded daily Curator Challenge + Masterpiece reward, Field Guide updates, full audit). Batch order (one commit per item) in `PROJECT_STATE.md` → Immediate Next Action: 1) K1→K2→K3, 2) K4→K5→K6, 3) K7→K8, 4) K9→K10. First-time Normal run stays 15–20 min — new creatures scale into zones 3+ and NG+ (re-verify on any in-run change).
- Git: v1.1–v1.4 fully committed (v1.4 complete at `dddbcaf`); v1.5 approved and executing — **K1 (Mud Turtle) committed (smoke 72/72).**

## Active work

**v1.5 "The Living Swamp" — in progress (Batch 1: K1 → K2 → K3).** One
conventional commit per item; full per-item history lives in git log +
PROJECT_STATE.md. v1.1–v1.4 are all COMPLETE (see Current state).

## Blockers

None. Loopback dev server, Node, and all tests are healthy.

## Known bugs / risks

- No open confirmed gameplay bugs; v1.1 hardening (B2–B6) is done.
- Risk: v1.4 juice creep — every art/feel item carries a HARD 60fps
  acceptance (P10 stage + per-frame budget assertions); deferred list in
  `docs/ROADMAP.md` §v1.4 is the boundary (gamepad / accessibility /
  gold-combat-color / co-op / procgen stay out).
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

**v1.5 Batch 1 (K1 → K2 → K3):** K1 Mud Turtle (front-shell deflection) ·
K2 Blind Crag Frog (hunts sound, sleeps when quiet) · K3 zone-5 Storm Surge
set-piece. Full acceptance criteria in `docs/ROADMAP.md` §v1.5.

## Release readiness

Release: ready (DoD met, suite green). v1.1: **complete** — M7 + M7.5 + M8
all done. v1.2: **complete** — M9 + M10 + M11 + M13 all done; smoke 45/45;
pacing 18.7/18.8 min (in the 15–20 min target). v1.3: **complete** — M14
(NG+) + M15 (gold meta) + M16 (season wrap) all done; smoke 56/56; pacing
pace ~18.5 / humance 18.4 / ngpace 19.5 (all in band). v1.4 "Make It
Amazing": **executing** — 14 items in 4 modules (J juice · L presence · S
audio · M moments) across 5 batches of ~3; theme + order + acceptance in
`docs/ROADMAP.md` §v1.4. The release stays playable at every commit.
## Release readiness

Release: ready (DoD met, suite green). v1.1 + v1.2 + v1.3 + v1.4: **all
complete** (smoke 71/71; pacing 17.3/18.3/19.5 min — in the 15–20 min
target). v1.5 "The Living Swamp": **in progress** (K1–K10, bounded
batches); the release stays playable at every commit.
