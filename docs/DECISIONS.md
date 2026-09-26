# Current design and engineering decisions

As of the Astra milestone, 2026-09-26. Older decisions and their original
context are in history/DECISIONS-pre-astra.md. Source/tests take precedence.

| Decision | Reason / constraint |
|---|---|
| Keep Canvas2D/Web Audio and zero runtime dependencies | Existing architecture supports a static URL and the procedural painter identity. |
| Keep pure rules and save normalization in logic.js | Fast headless regression coverage without browser APIs. |
| Put the new studio in its own module | Avoid further spreading art/progression/book logic across game.js. |
| Give three finite authored subjects real brush interactions | Creates a visible reason to paint beyond combat, with a finishable scope. |
| Teach brush-hop through the first painting | Connects artistic progress with useful defensive movement. |
| Telegraph fly direction, limit strike contact and allow blue interrupt | Corrects the 40× movement defect and gives meaningful counterplay. |
| Record bounded actual strokes and illustrate completed memories | A personal keepsake without storing screenshots or unbounded replay data. |
| Keep challenges independent of earned brush-hop | Fixed-loadout competition should not depend on global study completion. |
| Keep SAVE_VERSION 12 and GAME_VERSION 1.0.0 | Optional validated fields need no destructive migration or compatibility bump. |
| Seed pacing and fail on out-of-band output | Previously informational probes could silently report failed/capped fights. |
| Retune Warden52,000→50,000HP without widening its band | All six sampled estimates now fit2–4 minutes. |
| Keep bot estimates distinct from human playtest evidence | Analytical wave allowances do not measure enjoyment or real player duration. |
| Provide a deterministic static ZIP; defer publication | Friend sharing needs simple hosting, not infrastructure or accounts added now. |

The milestone name **Astra Vertical Slice** identifies this development pass;
it does not silently change the serialized/runtime version identifiers.
