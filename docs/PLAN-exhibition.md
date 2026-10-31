# Personal exhibition — approved execution plan

Scope approved in Discord: close Q6 and implement Q7. Baseline commit: 56db0dc.

## 1. Close Q6
Add real-Game regression coverage for the existing pin UI: keyboard and mouse toggles, controller focus, two-pin refusal/banner, localStorage persistence and suspension. Preserve the existing retention contract (eight rolling pages plus at most two pinned). Run all core/browser gates, update PROJECT_STATE, and commit the closing chunk.

## 2. Q7: name and exhibit artwork
Implement in vertical tested slices:
- Bounded plain-text page captions and safe legacy/malformed-save defaults.
- Edit/confirm/cancel UI with explicit text-input ownership (no gameplay shortcuts while typing), mouse and controller access.
- Explicit selection of a pinned page as the title-screen keepsake, with safe fallback on unpin/eviction/import.
- Shared postcard caption rendering for sketchbook, title display and PNG export.
- Readable controls at 640x480 and no regression to existing title/menu input.

Use test-first RED/GREEN for new behavior and bugs. Existing shipped Q6 behavior receives characterization/regression tests, not deletion/reimplementation.

## Verification and delivery
Each coherent chunk: focused tests, full smoke, update PROJECT_STATE, conventional commit. Final: node scripts/check.mjs --browser (all 19 gates), all nine pacing bands, no balance flags, source and dist real-browser journeys, save/reload/export/retention/controller checks and actual render evidence. Do not relax gates. Record exact evidence and remaining limits honestly.

## Boundaries
Local development only. No new runtime dependencies, combat retuning, moth encounter, publication or external accounts. GAME_VERSION remains 1.0.0 and SAVE_VERSION remains 12. Preserve user work; do not edit other profiles' configuration or memories.
