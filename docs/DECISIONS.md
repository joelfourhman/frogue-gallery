# Frogue Gallery — Decision Log

Only consequential technical/product decisions that a future agent must
understand. One entry per decision; newest last. Status: active / superseded.

| # | Date | Decision | Rationale | Status |
|---|---|---|---|---|
| 1 | 2026-09 | **Zero dependencies, no build step.** Vanilla JS ES modules, Canvas 2D, Web Audio; served by `python -m http.server 8765`. | A compact, inspectable, single-repo game; no supply chain; trivially portable. | active |
| 2 | 2026-09 | **Pure rule logic isolated in `src/logic.js`.** Save schema, migrations, balance, and economy are browser-free and unit-tested via `tests/smoke.mjs`. | The only CI is the smoke suite; pure logic keeps it fast, deterministic, and browser-free. | active |
| 3 | 2026-09 | **Painting is the combat system.** Red/blue/green pigments = damage+burn / slow→freeze / root+heal; dry brush is a 50%-damage fallback, never a softlock. | Core design pillar; status fields live on the paint surface (`paint.js`) and are read by enemies. | active |
| 4 | 2026-09 | **Boss fight = 30,000 HP heron, ~2.3 min human / ~37 s bot ceiling.** World widened 2400→5400 px with 4 named zones + rest checkpoints (P5). | DoD #9 requires a satisfying 15–20 min run; the boss had to be a real fight, not a bar to chip. | active |
| 5 | 2026-09 | **Balance for a taught first-time player:** maxHp 7→10, beetle/toad contact 8/9→6, greenHeal 1→3 (P4). | The tutorial (P1) means players arrive competent; early game must not one-shot them. | active |
| 6 | 2026-09 | **localStorage with migration + safe fallback.** All keys prefixed `frogue_gallery_`; `migrateSave` defaults/merges missing fields; load failure → fresh save, never a boot crash. | DoD #11: corrupted/old saves must fail safely or migrate. | active |
| 7 | 2026-09 | **Loopback-only server, browser-local data.** No cloud LLM APIs, no remote services, no external accounts; `uv` for any Python env, never `pip`. | Mission safety/environment boundary. | active |
| 8 | 2026-09 | **Post-release v1.1 = bug fixes (M7) then improvements (M8); deferred extras (gold pigment, gamepad, NG+, CRT) explicitly out of scope.** | Release DoD is satisfied; keep v1.1 tight and shippable. | active |
