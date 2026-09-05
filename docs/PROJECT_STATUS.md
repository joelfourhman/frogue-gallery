# Frogue Gallery — Project Status (PM)

Concise PM view. Durable status/next-action detail lives in root
`PROJECT_STATE.md` (read that first); milestones in `docs/ROADMAP.md`;
consequential decisions in `docs/DECISIONS.md`.

**Last PM audit: 2026-09-05 (v1.1 kickoff)**

## Current state

- Release DoD: **all 12 items satisfied** (final audit 2026-09-05).
- Active phase: **v1.1 — M7 bug fixes & robustness**, then M8 improvements.
- Smoke suite: **16 stages, ALL PASSED** (verified by PM on 2026-09-05).
- Git: tree **clean** (B1 done 2026-09-05: release-sweep code committed as
  `fix: DoD #2 title affordance...`, v1.1 plan + PM docs as `docs: v1.1 plan...`).
- Active: **B2** (corrupt-save handling) — delegated to `@hermes` 2026-09-05.

## Active work (M7, in order)

B1 commit sweep → B2 corrupt-save hardening (src/save.js + logic.js) →
B3 dry-brush softlock audit → B4 dt-cap verification → B6 save versioning →
B5 localStorage fallback (in-memory mode; depends on B6's versioned schema).

## Blockers

None. Loopback dev server, Node, and all tests are healthy.

## Known bugs / risks

- No open confirmed gameplay bugs; B2–B6 are hardening items from the v1.1
  plan (see docs/ROADMAP.md).
- Risk: v1.1 feature creep — deferred list in docs/ROADMAP.md is the
  boundary; New Game+ / gold pigment / gamepad stay out.
- Risk: `src/game.js` is 1719 lines and holds state-machine + HUD; new
  screens should stay thin there, logic in `src/logic.js` where possible.

## Technical debt

- `game.js` size (above) — manage by keeping new features out of it.
- No unit tests beyond smoke.mjs/pace probes — acceptable for project size;
  keep pure logic in logic.js so that stays true.

## Next priority

**B1:** verify smoke green, commit the uncommitted sweep + v1.1 plan docs as
one coherent commit; then start B2 (corrupt-save handling).

## Release readiness

Release: ready (DoD met, suite green). v1.1: M7 in progress.
