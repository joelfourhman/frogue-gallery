# Frogue Gallery — Project Status (PM)

Concise PM view. Durable status/next-action detail lives in root
`PROJECT_STATE.md` (read that first); milestones in `docs/ROADMAP.md`;
consequential decisions in `docs/DECISIONS.md`.

**Last PM audit: 2026-09-05 (v1.1 COMPLETE: B6 + PT5 + B5 + M7.5 PT1–PT5 + M8 P10 + P12 + P7 + P8 + P6 + P9 + P11 all landed)**

## Current state

- Release DoD: **all 12 items satisfied** (final audit 2026-09-05).
- **v1.1 is COMPLETE.** All of M7 (B1–B6), M7.5 (PT1–PT5), and M8 (P10, P12,
  P7, P8, P6, P9, P11) are done, committed, and verified.
- Smoke suite: **29 stages, ALL PASSED** (stage 20 = B5; 21–23 = M7.5;
  24 = M8 P10 perf culling; 25 = M8 P12 zone character; 26 = M8 P7
  difficulty select; 27 = M8 P8 Gallery Wall; 28 = M8 P6 "?"/Field Guide
  overlay; 29 = M8 P9 Options/audio). Pacing probes green: `pace.mjs`
  (analytic, ~18.7 min) + **`humance.mjs` (P11, simulated imperfect human on
  the real sim: full-run 18.3–19.4 min across 4 seeds, in the 15–20 min
  target)** + `bosspace.mjs`. Real-browser: 60 fps title / full world.
- Git: B1–B6, M7.5 PT1–PT5, and M8 P10/P12/P7/P8/P6/P9/P11 all committed.
  Tree clean.
- Milestones: B1–B6 ✅, M7.5 PT1–PT5 ✅, M8 P10 ✅ P12 ✅ P7 ✅ P8 ✅ P6 ✅
  P9 ✅ P11 ✅. **Nothing left on the v1.1 roadmap.**

## Active work

None — v1.1 is complete. The optional deferred items (gold pigment, gamepad,
New Game+) are explicitly out of v1.1 scope (see docs/ROADMAP.md).

## Blockers

None. Loopback dev server, Node, and all tests are healthy.

## Known bugs / risks

- No open confirmed gameplay bugs; B2–B6 are hardening items from the v1.1
  plan (see docs/ROADMAP.md).
- Risk: v1.1 feature creep — deferred list in docs/ROADMAP.md is the
  boundary; New Game+ / gold pigment / gamepad stay out.
- Risk: `src/game.js` is ~1935 lines and holds state-machine + HUD; new
  screens should stay thin there, logic in `src/logic.js` where possible.

## Technical debt

- `game.js` size (above) — manage by keeping new features out of it.
- No unit tests beyond smoke.mjs/pace probes — acceptable for project size;
  keep pure logic in logic.js so that stays true.

## Next priority

**None — v1.1 is complete.** All of M7 (B1–B6), M7.5 (PT1–PT5), and M8
(P10, P12, P7, P8, P6, P9, P11) are done, committed, and verified. P11
(human-pace pacing probe, `tests/humance.mjs`) was the last item.

## Release readiness

Release: ready (DoD met, suite green). v1.1: **complete** — M8 P10 + P12 +
P7 + P8 + P6 + P9 + P11 all done; smoke 29/29; pacing probes green (human
est. 18.3–19.4 min across 4 seeds, in the 15–20 min target).
