# Frogue Gallery Mission

## Product vision

**Frogue Gallery: A painterly froguelite.**

Build a small, polished browser game about a tiny frog painter wearing an artist's beret and carrying an oversized magical paintbrush. The presentation should feel like a living watercolor storybook: soft paper textures, expressive ink lines, organic shapes, splashes, swishes, squash and stretch, readable silhouettes, and warm, playful audio.

The complete loop is:

```text
Lily Pad Atelier
→ choose paintings and prepare a build
→ expedition
→ paint, fight, and explore
→ collect pigments
→ defeat the boss or return
→ create paintings and improve the build
→ repeat
```

Target a satisfying complete run of roughly 15–20 minutes. Prefer a compact game that is playable, balanced, and polished over a large unfinished design.

## Core play

Movement must be responsive and immediately pleasant. The frog should hop, turn, accelerate, recover from hits, and wield the brush with clear anticipation and impact. Painting is not decoration placed on top of combat: the brush is the primary weapon and a way to alter enemies and the environment. Strokes should leave visible paint and produce strong but controlled feedback through trails, splatters, sound, animation, hit flashes, knockback, and modest screen shake.

The three pigments must change decisions rather than merely recolor projectiles:

- **Red — aggression:** stronger direct damage, burning, and interactions with vegetation or other flammable features.
- **Blue — control:** slowing, freezing through repeated application, and slick or controlling terrain effects.
- **Green — growth:** rooting grounded enemies, recovery or sustain, and growing or restoring useful vegetation.

A dry brush may remain as a weak fallback so pigment depletion cannot create a softlock. Color interactions should be readable, limited in number, and useful during actual play.

Include at least three distinct enemy archetypes with different movement, telegraphs, and color counterplay. The current design establishes the Mud Beetle, Mosquito, and Grumpy Toad. Preserve or improve their gameplay identities rather than multiplying enemy count before the existing set is fun.

The expedition culminates in the **Great Gray Heron**. The boss must have readable phases, recognizable attacks, and a central painting mechanic. Applying all three colors should transform or awaken the gray Heron into a vulnerable, colorful state. Victory must be a real completed state with suitable feedback and a route back into the progression loop.

## Atelier and progression

The **Lily Pad Atelier** is the home, preparation, and progression space. It should let the player understand their resources, create or unlock paintings, equip a limited loadout, and begin another expedition without unnecessary friction.

Paintings are the build system. They should provide meaningful mechanical changes and compete for a small number of loadout slots; they are not a checklist of permanent passive bonuses. Pigments collected during runs fund paintings or a restrained set of upgrades. Death should preserve some progress while still mattering.

The game must support:

- New Game
- Continue when a valid save exists
- Erase Save Data with confirmation
- localStorage persistence
- death and restart/recovery
- victory and post-victory continuation
- understandable controls and polished UI
- practical sound and visual feedback using browser capabilities

Use browser-local storage only. A corrupted or older save should fail safely or migrate to a valid default rather than preventing the game from loading.

## Technical direction

Prefer HTML, CSS, vanilla JavaScript, Canvas 2D, SVG where useful, Web Audio, and standard browser APIs. Avoid unnecessary frameworks, build systems, packages, and network dependencies. Keep source files modular along natural subsystems so a future session can inspect only the active area. Preserve pure rule logic where practical so important gameplay calculations can be tested without a browser.

Run locally on loopback only. Keep dependencies minimal. Use `uv` for any Python environment or dependency management; never use `pip` directly. Do not use cloud LLM APIs or remote game services.

Develop playable vertical slices early. Test constantly, then playtest and balance existing content before expanding scope. Performance should remain appropriate for an ordinary modern browser: avoid uncontrolled allocations, particles, entities, or persistent paint data.

## Definition of Done

Frogue Gallery is complete only when all of the following are true:

1. The game boots from its documented localhost workflow with no missing modules or fatal console errors.
2. New Game, Continue, and Erase Save Data work with localStorage.
3. The Atelier-to-expedition-to-return loop is functional and understandable.
4. Frog movement and primary brush actions feel responsive.
5. Red, blue, and green have distinct, useful gameplay effects.
6. At least three enemy archetypes are playable and clearly telegraphed.
7. Paintings form a limited, meaningful loadout/build system.
8. The Great Gray Heron encounter, death, victory, and restart flows work.
9. A complete run is paced toward approximately 15–20 minutes.
10. UI, audio, animation, feedback, and balance receive a deliberate polish pass.
11. Save migration/failure behavior and core pure logic have focused tests.
12. `PROJECT_STATE.md`, `SYSTEM_CHANGES.md`, and `CLEANUP.md` accurately describe the delivered repository and environment.

## Safety and environment boundaries

All development is project-local. Do not request Administrator privileges, trigger UAC, install global packages, modify permanent PATH values, change user/system environment variables, or alter Windows services, scheduled tasks, Registry, Defender, Firewall, certificates, CUDA, NVIDIA drivers, Hermes, NInfer, or Qwen. Do not change the local model provider, context/KV configuration, or inference server. Do not access or modify unrelated repositories or personal files.

Maintain `SYSTEM_CHANGES.md` whenever anything outside ordinary source files changes. Maintain `CLEANUP.md` so every project-created environment, cache, process, or artifact has a safe reversal procedure.

## Autonomous development discipline

> **The repository is the deliverable. The conversational response is not the deliverable.**

The repository is authoritative memory. `MISSION.md` holds permanent requirements, `PROJECT_STATE.md` holds current working state, and Git holds history. Do not preserve an enormous original prompt in every request.

Future local Qwen sessions have a 65,536-token context. Conserve it actively:

- Read `PROJECT_STATE.md` first.
- Inspect only files required for the active milestone.
- Read large files in sections.
- Prefer targeted searches, focused diffs, `git diff --stat`, and short test summaries.
- Avoid whole-repository rereads, recursive dumps, giant diffs, and complete logs.
- Write changes directly to files instead of printing source code into chat.
- Keep conversational summaries concise.
- Use Git as historical memory and `PROJECT_STATE.md` as current-state memory.

The previous run encountered `Error: Response truncated due to output length limit`. Never attempt an entire milestone in one model response. Use multiple smaller tool-driven iterations, do not emit enormous code blocks or JSON, do not reproduce complete logs, and do not narrate every implementation detail. Prefer:

```text
brief reasoning
→ focused tool call
→ inspect result
→ focused tool call
→ continue
```

If a response is truncated, inspect repository state and `git status`, determine what actually completed, resume from the smallest incomplete unit, and make the next turn substantially smaller. Never repeat the same giant response.

If conversational context is missing, compressed, truncated, or unreliable:

1. Read `PROJECT_STATE.md`.
2. Run `git status`.
3. Inspect the most recent relevant Git commits.
4. Read `MISSION.md`.
5. Read only files related to the active milestone.
6. Run the smallest useful test.
7. Continue.

Do not reconstruct old conversation history. Do not guess. The repository outranks conversation memory.

## Checkpoints continue the work

> **A checkpoint is not a stopping point.**

During an active `/goal`, work in bounded milestones:

```text
WORK → TEST → UPDATE PROJECT_STATE.md → COMMIT → IMMEDIATELY CONTINUE
```

At each milestone, stop adding scope, test the current unit, remove obvious debug debris, update the state and environment documentation, and make a local Git commit when coherent. Then immediately begin the next documented action. Do not stop merely because a milestone completed, the state file was updated, a commit was made, a clean handoff exists, or a next action was identified. Stop only when the full Definition of Done is genuinely satisfied or a safety-critical blocker requires user input.
