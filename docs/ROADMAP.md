# Frogue Gallery — Roadmap

Milestones only — see `docs/PROJECT_STATUS.md` for live status, bugs, and
debt. Release DoD (all 12 items) is satisfied; this roadmap covers post-
release v1.1.

## Release (✅ shipped — 2026-09-05)

| M | Scope |
|---|---|
| M1 | Playable vertical slice: loop, HUD, boss, smoke test |
| M2 | The Atelier: between-run economy (shop, loadout, persistence) |
| M3 | Balance pass: awakened-boss 2× damage, HP/damage re-tune |
| M4 | Croaksworth story beat, best-run tracking, M-mute |
| M5 | Polish: low-HP vignette, real pause menu, intro banners |
| M6 | Final sweep: erase-save UI, docs accuracy, 11-stage smoke suite |
| P1–P5 | Post-release polish: first-run tutorial, combat juice, atelier onboarding, first-time balance, run pacing (5400px world, 4 zones, real 30k-HP heron) |

## v1.1 — Improvements & bug fixes (ACTIVE)

### M7 — Bug fixes & robustness (current)

| ID | Item | Status |
|---|---|---|
| B1 | Commit the uncommitted release-sweep work (git lags the verified state) | ⬜ |
| B2 | Corrupt-save handling: detect, "keep what we can" vs fresh start, never crash boot | ⬜ |
| B3 | Dry-brush softlock audit: prove a pigment-starved frog can still beat the heron | ⬜ |
| B4 | Tab-hidden time-spike verification (dt cap exists: 0.05s; confirm no physics blowups) | ⬜ |
| B5 | localStorage unavailable → in-memory fallback + one-time notice | ⬜ |
| B6 | Save schema versioning: `saveVersion` in the save, migration test (foundations in logic.js) | ⬜ |

Acceptance: each item has a passing test; smoke suite green; no behavior
change to Normal difficulty.

### M8 — Player-facing improvements (after M7)

| ID | Item | Status |
|---|---|---|
| P6 | In-game "?" reference overlay (controls, pigments, enemies) | ⬜ |
| P7 | Difficulty select on title (Easy/Normal/Hard; Normal = current balance) | ⬜ |
| P8 | The Gallery Wall: framed, titled owned paintings in the Atelier | ⬜ |
| P9 | Audio/options polish: separate music/SFX sliders, shake & vignette toggles | ⬜ |
| P10 | Performance pass: cull off-screen enemy AI; hold 60fps across the full world | ⬜ |
| P11 | Human-pace pacing probe (simulated human input, not bot-optimal) | ⬜ |
| P12 | Zone character: distinct accent + signature encounter per zone | ⬜ |

Acceptance: each item shipped with a smoke stage or regression test;
full suite green; 15–20 min run target still holds on Normal; docs accurate.

### Deferred (explicitly out of v1.1 scope)

- Gold pigment / fourth brush color
- Gamepad support
- New Game+ (post-victory loop)
- CRT/paper-texture visual filters beyond current style
