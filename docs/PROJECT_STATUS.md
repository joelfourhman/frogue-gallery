# Frogue Gallery — Project Status (PM)

Concise PM view. Durable status/next-action detail lives in root
`PROJECT_STATE.md` (read that first); milestones in `docs/ROADMAP.md`;
consequential decisions in `docs/DECISIONS.md`.

**Last PM audit: 2026-09-05 (v1.1 pass: B6 + PT5 + B5 + M7.5 PT1–PT4 + M8 P10 + M8 P12 + M8 P7 + M8 P8 + M8 P6 + M8 P9 landed)**

## Current state

- Release DoD: **all 12 items satisfied** (final audit 2026-09-05).
- Active phase: **v1.1 — M8 player-facing improvements** (P6–P12); P10 + P12 + P7 + P8 + P6 + P9 done. Only P11 remains.
- Smoke suite: **29 stages, ALL PASSED** (stage 20 = B5; 21–23 = M7.5;
  24 = M8 P10 perf culling; 25 = M8 P12 zone character; 26 = M8 P7
  difficulty select; 27 = M8 P8 Gallery Wall; 28 = M8 P6 "?"/Field Guide
  overlay; 29 = M8 P9 Options/audio). Pacing probes green (human est.
  ~18.7 min). Real-browser: 60 fps title / full world; P9 options + audio
  buses verified live, zero JS errors.
- Git: P10 (`5e95fbf`), P12 (`0ab27e8`), P7 (`7457229`), P8 (`4118146`),
  P6 (`27bdd22`) committed; **P9 in this pass, committed next.**
- Milestones: B1–B6 ✅, **M7.5: PT1–PT5 all ✅. M8: P10 ✅, P12 ✅, P7 ✅, P8 ✅, P6 ✅, P9 ✅ (this pass). P11 pending.**

## Active work (next, in order)

1. **M8 remaining: P11** (P10 perf + P12 zone character + P7 difficulty
   select + P8 gallery wall + P6 "?" overlay + P9 audio/options done).
   P11 = human-pace pacing probe (simulated, imperfect human input estimating
   a real 15–20 min run on Normal; informational, like `pace.mjs`).

Full plan: `docs/PLAN-v1.1-next.md`.

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

**M8 remaining: P11** (human-pace pacing probe). B1–B6, M7.5 PT1–PT5, and M8
P10 (perf culling), P12 (zone character), P7 (difficulty select), P8
(gallery wall), P6 ("?"/Field Guide overlay), and P9 (audio/options polish)
are complete.

## Release readiness

Release: ready (DoD met, suite green). v1.1: M8 in progress (P10 + P12 + P7
+ P8 + P6 + P9 done; only P11 remains).
