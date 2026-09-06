# Frogue Gallery — Project Status (PM)

Concise PM view. Durable status/next-action detail lives in root
`PROJECT_STATE.md` (read that first); milestones in `docs/ROADMAP.md`;
consequential decisions in `docs/DECISIONS.md`.

**Last PM audit: 2026-09-05 (v1.1 pass: B6 + PT5 + B5 + M7.5 PT1–PT4 landed)**

## Current state

- Release DoD: **all 12 items satisfied** (final audit 2026-09-05).
- Active phase: **v1.1 — M8 player-facing improvements** (P6–P12).
- Smoke suite: **23 stages, ALL PASSED** (stage 20 = B5 fallback; stages
  21–23 = M7.5 PT1/PT3/PT4). Pacing probes (pace, bosspace) green.
- Git: **tree clean** — PT5 (`ed287a4`), B6 (`599a599`), B5 (`7f4fc3e`),
  and the status-docs pass (`3c590be`) are all committed.
- Milestones: B1–B6 ✅, **M7.5: PT1–PT5 all ✅ (PT1–PT4 this pass).**

## Active work (next, in order)

1. **M8 P6–P12** — suggested value order: P10 (perf/cull) → P12 (zone
   character) → P7 (difficulty) → P8 (gallery wall) → P6 (?) overlay →
   P9 (audio polish) → P11 (human-pace probe).

Full plan: `docs/PLAN-v1.1-next.md`.

## Blockers

None. Loopback dev server, Node, and all tests are healthy.

## Known bugs / risks

- No open confirmed gameplay bugs; B2–B6 are hardening items from the v1.1
  plan (see docs/ROADMAP.md).
- Risk: v1.1 feature creep — deferred list in docs/ROADMAP.md is the
  boundary; New Game+ / gold pigment / gamepad stay out.
- Risk: `src/game.js` is 1745 lines and holds state-machine + HUD; new
  screens should stay thin there, logic in `src/logic.js` where possible.

## Technical debt

- `game.js` size (above) — manage by keeping new features out of it.
- No unit tests beyond smoke.mjs/pace probes — acceptable for project size;
  keep pure logic in logic.js so that stays true.

## Next priority

**M8 P6–P12** in value order P10 (perf/cull) → P12 (zone character) → P7
(difficulty) → P8 (gallery wall) → P6 (?) overlay → P9 (audio polish) → P11
(human-pace probe). B1–B6 and M7.5 PT1–PT5 are complete.

## Release readiness

Release: ready (DoD met, suite green). v1.1: M7 in progress.
