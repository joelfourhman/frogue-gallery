# Qwen backlog

This is future implementation work after the completed Astra milestone.
Read ASTRA_HANDOFF.md and CURRENT_STATE.md first. No known P0 crash or
softlock remains from the tested paths. A newly reproduced game-breaking bug
becomes P0 and takes priority over this expansion backlog.

Every task finishes with a focused smoke assertion where practical, applicable
browser checks, all nine pacing bands, balance telemetry, PROJECT_STATE update
and one coherent commit. Use `node scripts/check.mjs`; use `--browser`
when changing gameplay rendering/input, saves or delivery.
Do not relax bands to hide a failure. No new runtime dependency.

## Q1 [P1] — Make study definitions aware of biomes and reward groups
- **Purpose:** A safe extension point for Milestone 1's Reeds art.
- **Files:** src/logic.js, src/studio.js, tests/slice.mjs.
- **Requirements:** Keep the current three definitions/IDs unchanged. Add a
  pure selector by biome/mode. Give swamp completion rewards an explicit set
  of required IDs; remove assumptions that every future study belongs to the
  same three-study reward. Preserve brush-hop in all non-challenge modes.
- **Acceptance:** Same three scenes and rewards on the swamp; zero on Reeds
  until Q2. Three swamp flags still grant gold even when new IDs are later
  registered. Old schema 12 saves round-trip unchanged.
- **Tests:** Selector/reward group/migration assertions; existing browser
  source/dist journeys.
- **Dependencies:** Milestone 0. **Recommended first task.**

## Q2 [P1] — Implement Lantern Garden end to end
- **Purpose:** First optional painting discovery in ordinary Reeds.
- **Files:** src/logic.js, src/studio.js, tests/slice.mjs,
  tests/vertical-slice.mjs.
- **Requirements:** Add one fixed location outside a boss/checkpoint footprint,
  green→blue→red coats, visible stems/dew/moths and one completion message.
  Use the existing stroke hook and caps. No fuel-consuming completion timer.
- **Acceptance:** Painting changes all three stages, completion persists, and
  an exported postcard shows the correct memory. No swamp or challenge leak.
- **Tests:** Real paint progression, invalid colors/range, reload/export,
  Reeds pacing and all core gates.
- **Dependencies:** Q1.

## Q3 [P2] — Add Echo Pool and its Reeds border reward
- **Purpose:** Finish Milestone 1 with a second distinct subject.
- **Files:** src/logic.js, src/studio.js, tests/slice.mjs.
- **Requirements:** Blue→red→green ripples/stars/birds at another safe fixed
  location. Both Reeds studies award a cosmetic border; no combat stat change.
- **Acceptance:** Each motif reads differently; border needs exactly the
  Reeds group and survives import/reload. Swamp gold signature still works.
- **Tests:** Group truth table, both completion orders, old saves, postcard
  screenshots, full check command.
- **Dependencies:** Q2.

## Q4 [P2] — Model the optional painted crossing
- **Purpose:** Collision-safe foundation for Milestone 2.
- **Files:** src/logic.js, src/world.js, tests/smoke.mjs.
- **Requirements:** Add pure state transitions for green crossing/blue current/
  red bramble. Keep the main corridor open in every state. Rebuild bounded
  collision data on transitions only.
- **Acceptance:** Every state has a valid return route; repeated paint is
  idempotent; enemy spawn validation respects the new solids.
- **Tests:** Reachability/circle-collision cases at both crossing ends, repeated
  transitions and restart cleanup.
- **Dependencies:** Q1.

## Q5 [P2] — Build and illustrate one complete side loop
- **Purpose:** Make Q4's rules discoverable in play.
- **Files:** src/world.js, src/studio.js, src/game.js, tests/vertical-slice.mjs.
- **Requirements:** One small detour near Rain Choir with visible interactable
  silhouettes and a postcard stamp. Wire real paint actions; no mandatory
  route lock or new economy.
- **Acceptance:** A player can enter, complete, leave and revisit using normal
  input; hopping at corners cannot trap the frog; all partial states render.
- **Tests:** Browser journey for all three actions and return, capped effects,
  frame evidence and full pacing gate.
- **Dependencies:** Q4.

## Q6 [P2] — Preserve two pinned sketchbook pages
- **Purpose:** Prevent a favorite artwork from aging out.
- **Files:** src/logic.js, src/studio.js, tests/slice.mjs.
- **Requirements:** Optional pinned-ID metadata, maximum two pinned plus eight
  rolling pages. Bounded normalization, deterministic eviction, clear UI.
  Unpinning returns a page to the normal retention policy.
- **Acceptance:** Repeated filing never duplicates a page; pins survive twenty
  new expeditions and save reload; total artwork remains below 80 KiB.
- **Tests:** Retention across pin/unpin/re-file orders, malformed/legacy imports,
  mouse/controller focus and state suspension.
- **Dependencies:** Milestone 0.

## Q7 [P2] — Name and exhibit a favorite page
- **Purpose:** Complete Milestone 3's personal exhibition.
- **Files:** src/studio.js, src/game.js, src/logic.js,
  tests/vertical-slice.mjs.
- **Requirements:** Short plain-text title editor; one pinned page displayed
  in a title-screen frame; shared postcard renderer for export. Avoid adding
  HTML parsing or copying arbitrary images into saves.
- **Acceptance:** Edit/cancel/reload/export agree; empty/long/unusual text stays
  bounded; title controls remain visible at640×480.
- **Tests:** Text-input ownership so shortcuts do not fire while typing;
  export screenshots, focus navigation and old-save defaults.
- **Dependencies:** Q6.

## Q8 [P2] — Implement bounded lantern-moth rules
- **Purpose:** A distinct and fair Reeds interaction for Milestone 4.
- **Files:** src/logic.js, src/enemies.js, tests/smoke.mjs.
- **Requirements:** Approach/tell/dash/settle states; ≥0.6s locked-direction
  tell; blue interruption; no non-dash contact damage; one settlement reward;
  maximum two active. Keep disabled in live spawn tables until Q9.
- **Acceptance:** Freeze/root/death/darkness transitions terminate correctly,
  cannot reward twice, and do not accelerate toward a moving target mid-tell.
- **Tests:** State transition matrix, caps, pigment interactions, reward latch.
- **Dependencies:** Q1; Q9 required before exposing this feature.

## Q9 [P2] — Place the moth encounter and teach the flower counter
- **Purpose:** Turn Q8's isolated rules into a complete encounter.
- **Files:** src/world.js, src/enemies.js, src/game.js, src/audio.js.
- **Requirements:** One optional authored introduction in Reeds, three readable
  poses, restrained audio, visible green flower settling cue. Preserve base
  swamp mixes and initial lantern teaching.
- **Acceptance:** Player can guide/interrupt/settle or avoid it; darkness and
  restart do not strand it; reward is understandable; no unfinished variant
  appears in Wander/Challenge.
- **Tests:** Browser encounter with actual input, frame/SFX audit, balance and
  Reeds/Black Reeds plus other pacing gates.
- **Dependencies:** Q8 and Q2.

## Q10 [P1] — Prepare a measured five-friend playtest
- **Purpose:** Validate understanding and enjoyment with people.
- **Files:** docs/PLAYTEST.md (new), docs/VALIDATION.md, scripts/build.mjs.
- **Requirements:** Produce a dated build/hash, five concise questions and a
  session sheet with timestamps for first move/paint/study/defeat/export.
  Include browser/controller checklist. No analytics or participant outreach
  without user instruction.
- **Acceptance:** Another person can run the session without explaining the
  game. Observations and opinions have separate fields; no predicted success.
- **Tests:** Full browser gates; one manual rehearsal; package hash.
- **Dependencies:** Milestone 0. Can run before expansion milestones.

## Q11 [P1] — Resolve observed playtest friction
- **Purpose:** Close Milestone 5 using evidence.
- **Files:** Only systems implicated by observations, plus tests and
  docs/PLAYTEST.md.
- **Requirements:** Wait for actual participant results. Reproduce each
  crash/softlock first; group repeated confusion; implement the smallest
  coherent correction and preserve before/after evidence.
- **Acceptance:** Reproduced game-breaking findings have regression coverage;
  common confusion is rechecked with participants; unresolved external testing
  is explicitly recorded.
- **Tests:** Focused regressions plus complete core/browser gates.
- **Dependencies:** Q10 and user-provided/authorized human sessions.

## Q12 [P1] — Prepare and publish the approved alpha artifact
- **Purpose:** A simple public URL, with a traceable build.
- **Files:** docs/DEPLOYMENT.md, docs/CHANGELOG.md, dist/manifest.json.
- **Requirements:** Assemble exact ZIP/commit/hash, page copy and real
  screenshots. The owner selects host/account/visibility and authorizes the
  upload. Verify the actual hosted origin/embed, save reload, audio and PNG.
- **Acceptance:** Approved URL launches the exact artifact, runs First Light,
  preserves progress, exports a postcard and has a recorded rollback ZIP.
- **Tests:** Full checks before upload, hosted browser smoke after upload.
- **Dependencies:** Q11, explicit publication authorization. Not authorized by
  the current local-only development pass.

## Deferred experiment [EXP] — Animated postcard export
A separate future spike may investigate a short recorded diorama loop.
Keep it disabled until memory limits, export cancellation and browser support
are established. PNG export remains the shipped baseline; do not block the
above milestones on animation.
