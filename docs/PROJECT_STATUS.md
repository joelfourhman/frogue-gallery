# Frogue Gallery — Project Status (PM)

Concise PM view. Durable status/next-action detail lives in root
`PROJECT_STATE.md` (read that first); milestones in `docs/ROADMAP.md`;
consequential decisions in `docs/DECISIONS.md`.

**Last PM audit: 2026-09-06 (v1.1 COMPLETE; v1.2 "The Collection" in progress — M9 A1 done, Batch 1 in flight)**

## Current state

- Release DoD: **all 12 items satisfied** (final audit 2026-09-05).
- **v1.1 COMPLETE**: M7 (B1–B6), M7.5 (PT1–PT5), M8 (P10/P12/P7/P8/P6/P9/P11).
- **Active phase: v1.2 "The Collection"** (M9 Atelier/collection, M10
  Expedition depth, M11 Presentation, M13 Tutorial; accessibility deferred).
  Driven in bounded batches of ~3 items — see `PROJECT_STATE.md` →
  Immediate Next Action for the batch order. **Batch 1 in progress: A1 ✅
  (atelier one-liners), A2 + A3 next.**
- Smoke suite: **30 stages, ALL PASSED** (stage 30 = v1.2 M9 A1). Pacing
  probes green: `pace.mjs` (analytic ~18.7 min) + `humance.mjs` (simulated
  human, 18.3–19.4 min) + `bosspace.mjs`. Real-browser: 60 fps title / full world.
- Git: v1.1 fully committed; v1.2 A1 committed; v1.2 roadmap + M13 tutorial
  swap committed (`5258d13`, `543d1cd`).

## Active work

**v1.2 "The Collection" — in progress, driven in bounded batches of ~3 items.**
Batch order (one conventional commit per item, docs + suite green per commit):
M9 A1→A2→A3 → A4 / M10 E1→E2 → E3→E4 / M11 V1 → V2→V3→V4 → M13 T1→T2→T3→T4.
**Now on A2 (painting synergy pairs).** See `PROJECT_STATE.md` → Immediate Next Action.

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

**v1.2 Batch 1 (M9 Atelier/collection): A1 atelier character one-liners → A2
painting synergy pairs → A3 Curator's Ledger.** Each reuses an existing
system (banner/string system, 2-slot loadout + makeTuning, P8 frame renderer);
each ships with a smoke stage or documented check, the suite green, and
PROJECT_STATE.md / docs/ROADMAP.md updated before committing.

## Release readiness

Release: ready (DoD met, suite green). v1.1: **complete** — M7 + M7.5 + M8
all done; smoke 29/29; pacing probes green (human est. 18.3–19.4 min, in the
15–20 min target). v1.2: **in progress** (M9–M13, bounded batches); the
release stays playable at every commit.
