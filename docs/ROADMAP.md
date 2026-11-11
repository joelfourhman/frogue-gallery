# Frogue Gallery — Paint, dodge, explore

## Current milestone — Lily Clearing and free painting — IMPLEMENTED

The owner's next request supersedes the wait-for-feedback priority below:
build the short encounter, simplify confusing aiming/UI, add repaintable
swamp objects, and delay the boss. Three agents handled encounter/enemy rules,
free scenery and brush presentation; the coordinating agent integrated the
HUD, boss gates, browser checks and validation.

- A bell starts three rounds (3/4/5 bugs), with at most two active attackers.
  Warning lanes lock before dashes; recovery is safe. Blue interrupts and
  blue-to-red increases that red hit by 50% on clearing targets. No color locks.
- Free repainting: 64 lilies, mushrooms, flowers and stones; any color works,
  persists for the run and animates locally. No currencies or puzzle recipes.
- One brush marker at real reach; plain color/action names and contextual
  instructions. Remove competing crosshair/range/target/foot rings.
- Final bosses wait for their end arena (last 900px). No opening announcement,
  fight music or remote summon. The optional mid-run heron remains mid-run.

The two-minute experience is a design target, not a stopwatch requirement.
The precise scripted movement/dodge probe takes ~45 seconds; human duration
and enjoyment remain unmeasured. Next: replay from a fresh expedition and
judge whether instructions, dodge timing and repainting are now self-evident.
See VALIDATION-lily-clearing.md. Do not expand content before that feedback.

## Previous roadmap — The Living Sketchbook

Rewritten 2026-11-11 against source and Git history. The game already has three
biomes, six bosses, five living studies, a painted crossing, pinned/named
postcards, a title-screen exhibition and the optional lantern moth. Q1–Q9 are
implemented; they are not future work. Earlier implementation records remain
in PROJECT_STATE.md and the Qwen backlog.

The direction: make every short expedition feel like a visit to a place worth
painting. Help players find the authored discoveries, make each brushstroke
legible, and give the spaces between encounters a little life. Preserve the
finite campaign, watercolor identity and a souvenir even from a failed run.

## Milestone A — Find your next little wonder — COMPLETE

Implementation scope for this pass:

- A paused **Field Atlas**, opened with V or from the pause menu, with the
  frog's position, checkpoints, available studies and optional authored detours.
- A clear distinction between a study finished this expedition and a memory
  already held in the sketchbook; an invitation toward the next unfinished
  study instead of another currency or mandatory quest chain.
- Keyboard, mouse and controller-menu access; closing the atlas restores the
  prior pause state and clears held paint/movement.

Acceptance: correct map dimensions and landmark positions for each biome;
mode-specific content never leaks into Wander/Challenge/Black Reeds; opening
freezes combat, timers and paint. Actual browser input verifies open, close and
resume in source and packaged builds. No fast travel or save change.

## Milestone B — Make painting feel understood — COMPLETE

Implementation scope for this pass:

- Nearby study cards explain the current stage, pigment name/number, action
  and coats completed. Correct strokes get restrained local acknowledgement.
- An aimed wrong-color stroke offers brief, relevant guidance. Distant paint
  and unrelated combat do not create nag messages.
- Completed studies make the saved page and next opportunity clear while
  preserving the existing illustrations and rewards.

Acceptance: all five studies keep their exact progression, healing and reward
rules; feedback is bounded and expires; target circles remain unobscured;
Reeds instructions remain readable. Regression tests cover correct, wrong,
out-of-range and repeated strokes. Browser screenshots cover partial/complete
studies and the atlas at normal and small viewports. The browser journey also
exposed and now covers a fixed first-click pointer lag through a moving camera.

## Milestone C — Let the swamp notice you — COMPLETE

Implementation scope for this pass:

- A small deterministic population of decorative pond wildlife, with distinct
  swamp/Reeds character, quiet movement and brief responses to nearby pigment.
- Local ripples or color curiosity make the brush feel connected to the world.
  Wildlife never deals damage, blocks movement, supplies loot or changes saves.

Acceptance: fixed population/effect caps, finite coordinates, offscreen culling,
no gameplay RNG consumption, no persistent paint growth or particle cascade.
The ordinary rendering/performance gates and every pacing band must still pass.

## Milestone D — Learn from five players — KIT PREPARED; SESSIONS PENDING

**2026-11-11 owner-feedback priority:** movement/combat were reported awkward.
The responsive-control pass now ships faster stops/reversal, immediate hops,
uninterrupted ordinary attacks, Q/E/wheel selection, accurate local range/charge
cues and cleaner hit text. See VALIDATION-control-feel.md for the measured
before/after and tests. Next is an owner replay of this core loop before more
content. The five-session milestone below remains pending.

Prepare the local build and facilitator sheet in docs/PLAYTEST.md now. The
next evidence must come from actual people: can they find a study, understand
paint response, use the atlas and want to keep their postcard?

After owner-arranged sessions, reproduce reported crashes/softlocks first,
then fix repeated navigation or paint confusion. Keep observation separate
from opinion. Do not invent participant results or equate bot pacing with
human enjoyment. This pass does not contact participants.

Exit: five recorded sessions, prioritized findings, regression coverage for
reproduced defects, and participant rechecks of the most common confusion.
Q10 preparation supports this milestone; Q11 depends on actual observations.

## Milestone E — Share the tested game

Use the deterministic runtime ZIP, an actual screenshot, concise controls and
an honest local-save/accessibility description. Q12 still requires a selected
host/account/visibility and explicit authorization to publish. Verify save,
audio and postcard export on the actual hosted origin and keep the previous
artifact for rollback. No backend, account system or telemetry is needed.

## Priorities after feedback

1. Fix reproduced loss of progress, crashes or traps before new content.
2. Improve the first ten minutes where observations show confusion.
3. Verify physical controllers and additional browsers; then address findings.
4. Consider one additional authored paint interaction only if players can
   already discover and enjoy the existing five studies and side encounters.

Animated postcard export, new biomes, new currencies and large progression
trees remain deferred. Adding volume is not an acceptance criterion.

## Integration contract

Three implementation agents own disjoint runtime areas: atlas/Game/pure map
rules; study presentation; world/wildlife presentation. The coordinating agent
owns integration, browser journeys, documentation, artifact verification and
the final coherent commit. No new runtime dependencies or remote services.

For this milestone run `node scripts/check.mjs --browser`: full smoke, all nine
pacing bands, balance without flags, UI/audio, deterministic package, source
and dist browser journeys, 36 rendered scenes and bounded effects performance.
Save version 12 and game version 1.0.0 remain unchanged. Update PROJECT_STATE.md
with verified outcomes and limitations before committing. Future human and
hosting work remains pending until it can actually be performed.
