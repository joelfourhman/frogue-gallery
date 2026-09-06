# Frogue Gallery — Project Status (PM)

Concise PM view. Durable status/next-action detail lives in root
`PROJECT_STATE.md` (read that first); milestones in `docs/ROADMAP.md`;
consequential decisions in `docs/DECISIONS.md`.

**Last PM audit: 2026-09-06 (v1.1 COMPLETE; v1.2 "The Collection" — M9 (A1–A4), M10 (E1–E4), M11 (V1–V4), M13 (T1–T4) — **v1.2 COMPLETE**; v1.3 "The Second Expedition" roadmap APPROVED by Joel — executing in bounded batches; **v1.3 Batch 7 (N1→N2→N3) + Batch 8 item 1 (N4) COMPLETE** — NG+ loop M14 N1 unlock + N2 scaling + N3 second boss (The Great Green Heron) + N4 player-chosen expedition modifiers; next: M15 G1 gold pigment)**

## Current state

- Release DoD: **all 12 items satisfied** (final audit 2026-09-05).
- **v1.1 COMPLETE**: M7 (B1–B6), M7.5 (PT1–PT5), M8 (P10/P12/P7/P8/P6/P9/P11).
- **v1.2 "The Collection" COMPLETE** (2026-09-06): M9 Atelier/collection,
  M10 Expedition depth, M11 Presentation, M13 Tutorial (accessibility
  deferred). Batches 1–6 all done; suite 45/45; pacing 18.7/18.8 min.
- **Active phase: v1.3 "The Second Expedition" — APPROVED by Joel (2026-09-06), executing** (NG+ loop M14 N1–N4, gold meta economy M15 G1–G4, season wrap M16 C1–C4). **Batch 7 (N1→N2→N3) COMPLETE:** N1 NG+ unlock + Next Expedition flow (SAVE_VERSION 3→4, `save.ngCycle`, gated "Next Expedition (New Game+)" button on title + end screen) ✅ + N2 NG+ scaling (pure `ngPlusScaling`/`applyNGPlus`: cycle-0 byte-identical, cycle-1 +30%HP/+15%dmg/+10%spawn applied only when ngCycle≥1, capped at cycle 3; `tests/ngpace.mjs` probe) ✅ + N3 second boss (The Great Green Heron: 36k HP, distinct moss palette, the Moss reed-pin mechanic pins it briefly + 2x damage) ✅. **Batch 8 item 1 (N4) COMPLETE:** player-chosen expedition modifiers — a `MODIFIERS` table (High Tide / Grey Morning / Dry Brush Season) feeding existing tuning/spawn/render paths, chosen at the Next Expedition prompt, persisted via `save.ngModifier` (SAVE_VERSION 4→5); cycle-0 untouched ✅ — suite 49/49, first-time pacing unchanged, NG+ cycle-1 ~19.5 min (in band). Next: M15 G1 (gold pigment meta economy). Full plan + acceptance criteria in `docs/ROADMAP.md` §v1.3; batch order in `PROJECT_STATE.md` → Immediate Next Action. First-time Normal run stays ~15–20 min; NG+ cycles measured by the new `tests/ngpace.mjs` probe.
- Git: v1.1 + v1.2 fully committed (v1.2 complete at `08b954a`); v1.3
  approved and executing (batch order in PROJECT_STATE.md).

## Active work

**v1.2 "The Collection" — COMPLETE.**
Batch order (one conventional commit per item, docs + suite green per commit):
M9 A1→A2→A3 → A4 / M10 E1→E2 → E3→E4 / M11 V1 → V2→V3→V4 → M13 T1→T2→T3→T4.
**Batch 1 (A1–A3) COMPLETE. Batch 2 (A4 Rehung Frame ✅ + E1 Painted Heron ✅ + E2 weather/tide phases ✅) COMPLETE — suite 35/35, pacing in band on Normal. Batch 3 (E3 Bold-only zone hazards ✅ → E4 orb-streak bonus ✅ → V1 color-reveal bar ✅) COMPLETE — suite 38/38, pacing 18.7/19.2 min in band. Batch 4 (M11 Presentation, presentation-only — pacing untouched): V2 ✅ (heron awaken bloom) + V3 ✅ (per-zone ambient audio) + V4 ✅ (end-screen exhibition) COMPLETE — suite 41/41. Batch 5 (M13 Tutorial): T1 ✅ (guided first expedition) + T2 ✅ (interactive pigment drills) COMPLETE — suite 43/43, pacing 18.7/18.9 min (the tutorial is a frozen pre-run layer that adds no timed-run time). Batch 6 (M13 Tutorial): T3 ✅ (mini sketch heron) + T4 ✅ (tutorial progress + "Watch me" re-entry) COMPLETE — suite 45/45, pacing 18.7/18.8 min. All four v1.2 milestones (M9/M10/M11/M13) are done.**

**v1.3 "The Second Expedition" — Batch 7 (M14 NG+ loop) COMPLETE: N1 ✅ (NG+ unlock + Next Expedition flow, SAVE_VERSION 3→4, `save.ngCycle`, gated "Next Expedition (New Game+)" button on title + end screen; smoke stage 46) + N2 ✅ (NG+ scaling — pure `ngPlusScaling(cycle)`/`applyNGPlus`: cycle-0 byte-identical, cycle-1 +30%HP/+15%dmg/+10%spawn applied only when ngCycle≥1, capped at cycle 3; `tests/ngpace.mjs` probe; smoke stage 47) + N3 ✅ (second boss — The Great Green Heron: 36k HP, distinct moss palette, the Moss reed-pin mechanic pins it briefly + 2x damage; smoke stage 48) + N4 ✅ (Batch 8 item 1: player-chosen expedition modifiers — `MODIFIERS` table / High Tide + Grey Morning + Dry Brush Season, chosen at the Next Expedition prompt, persisted via `save.ngModifier` (SAVE_VERSION 4→5), cycle-0 byte-identical; smoke stage 49) — suite 49/49, first-time pacing unchanged, NG+ cycle-1 ~19.5 min in band.** Next batch: M15 G1 (gold pigment meta economy). See
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

**v1.3 "The Second Expedition" — Batch 7 (N1 → N2 → N3) COMPLETE ✅:** N1 NG+ unlock + "Next Expedition" flow (SAVE_VERSION 3→4, `save.ngCycle`) ✅ (smoke stage 46); N2 `ngPlusScaling(cycle)`/`applyNGPlus` + `tests/ngpace.mjs` probe ✅ (smoke stage 47); N3 second boss (The Great Green Heron — 36k HP, distinct moss palette, the Moss reed-pin mechanic pins it briefly + 2× damage; reuses the heron AI + 3-hue awaken) ✅ (smoke stage 48); **N4 (Batch 8 item 1) COMPLETE ✅:** player-chosen expedition modifiers — a `MODIFIERS` table (High Tide / Grey Morning / Dry Brush Season) feeding the existing tuning/spawn/render paths, chosen at the Next Expedition prompt, persisted via `save.ngModifier` (SAVE_VERSION 4→5), cycle-0 byte-identical (smoke stage 49). Suite 49/49, first-time pacing unchanged (pace ~18.6 / humance ~19.1), NG+ cycle-1 ~19.5 min (in band). Next: **M15 G1** (gold pigment meta economy), then the M15 gold meta + M16 season wrap. Full plan + acceptance criteria in `docs/ROADMAP.md` §v1.3; batch order in `PROJECT_STATE.md` → Immediate Next Action.

## Release readiness

Release: ready (DoD met, suite green). v1.1: **complete** — M7 + M7.5 + M8
all done. v1.2: **complete** — M9 + M10 + M11 + M13 all done; smoke 45/45;
pacing 18.7/18.8 min (in the 15–20 min target). v1.3: **in progress**
(M14 NG+ → M15 gold meta → M16 season wrap, bounded batches); the release
stays playable at every commit.
