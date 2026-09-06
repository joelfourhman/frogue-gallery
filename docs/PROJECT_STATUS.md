# Frogue Gallery — Project Status (PM)

Concise PM view. Durable status/next-action detail lives in root
`PROJECT_STATE.md` (read that first); milestones in `docs/ROADMAP.md`;
consequential decisions in `docs/DECISIONS.md`.

**Last PM audit: 2026-09-05 (v1.1 pass: B6 + PT5 + B5 landed)**

## Current state

- Release DoD: **all 12 items satisfied** (final audit 2026-09-05).
- Active phase: **v1.1 — M7 bug fixes & robustness**, then M8 improvements.
- Smoke suite: **20 stages, ALL PASSED** (stage 20 = B5 storage fallback).
- Git: **tree clean** — PT5 (`ed287a4`), B6 (`599a599`), B5 (this pass),
  and the status-docs pass (`3c590be`) are all committed.
- Milestones: B1 ✅, B2 ✅ (`14b50a3`), B3 ✅ (`a32a721`), B4 ✅ (`2ed1c9a`),
  B5 ✅ (this pass), B6 ✅ (`599a599`). **M7.5: PT5 ✅, PT1–PT4 ⬜ (next).**

## Active work (next, in order)

1. **M7.5 PT1–PT4** — playtest fixes via `tests/headless.mjs`
   (explore/paint/spawn/death/onb; server on `127.0.0.1:8901`):
   PT1 painting consumption → PT2 onboarding → PT3 fly fairness →
   PT4 early-economy safety net. Log before/after balance numbers.
2. **M8 P6–P12** — suggested value order: P10 → P12 → P7 → P8 → P6 → P9 → P11.

Full plan: `docs/PLAN-v1.1-next.md`.

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

**M7.5 PT1–PT4** via `tests/headless.mjs` (dev server on `127.0.0.1:8901`):
PT1 painting consumption → PT2 onboarding → PT3 fly fairness (audit +
rebalance) → PT4 early-economy safety net. Log before/after balance numbers.
B5 (storage fallback) and B6 (save versioning) are complete. Then M8.

## Release readiness

Release: ready (DoD met, suite green). v1.1: M7 in progress.
