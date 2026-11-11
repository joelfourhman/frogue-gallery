# Five-player playtest — The Living Sketchbook

Prepared 2026-11-11. This is a facilitator kit, not a record of completed human
sessions. No participants have been contacted. Artifact identity and automated
rehearsal evidence are recorded in VALIDATION-living-sketchbook.md.

Owner feedback later that day: “Movement and combat feel awkward.” This is a
qualitative report, not a completed facilitated session. The responsive-control
pass and automated evidence are recorded in VALIDATION-control-feel.md. Start
the next owner replay with stopping/turning, dodging, switching pigment and
charging/releasing a splash. Ask which action still feels delayed or unclear;
record their words before deciding whether more tuning or content is needed.

## Setup

Use `node scripts/dev.mjs --dist` and open http://127.0.0.1:8765 on the testing
machine. The runtime requires no package installation. Use a separate browser
profile for testing; do not erase the owner's local save. The game stores its
progress only in that browser/origin. The session ends on closing/reloading;
filed postcards and progression survive. Do not collect personal data.

Allow 20–25 minutes plus five minutes for questions. Record browser/version,
viewport, keyboard/mouse or physical controller, and whether sound is enabled.
Begin with a fresh profile. Offer the game's guided practice without explaining
its controls yourself. The participant can stop whenever they like.

Read aloud: “Explore this swamp and make something you would like to keep.
Say what you are trying to do and what you expect to happen. This is a test of
the game, not of you.” If stuck, ask “What would you try next?” Record any help
you provide and its timestamp rather than treating assisted success as unaided.

## Session sheet — copy once per participant

Participant alias: ____   Date: ____   Build SHA-256: ____
Browser/OS: ____   Viewport: ____   Input: ____   Sound: ____

| Event | Elapsed time | Observed action / exact words | Help given |
|---|---|---|---|
| First movement | | | |
| First intentional paint | | | |
| First pigment switch | | | |
| First study found | | | |
| First study completed | | | |
| Atlas opened and understood | | | |
| First defeat or victory | | | |
| Sketchbook opened | | | |
| Postcard named/pinned/exported | | | |
| Session ended | | | |

If an event does not occur, write “not observed”; never infer a completion.

Observation (what happened, with timestamp): ____
Participant opinion (quote or clearly marked paraphrase): ____
Facilitator interpretation (hypothesis, not fact): ____
Bug reproduction, expected/actual result and screenshot path if available: ____

## Five questions after play

1. What did you think your goal was, and what made that clear or unclear?
2. What did each paint color do? Describe one time the result surprised you.
3. How did you choose where to go next? Did the atlas help?
4. Which moment would you want to show someone? Which moment frustrated you?
5. Would you keep your postcard or start another expedition? Why?

## Follow-up checklist

- Reload the same origin and inspect the filed postcard and study memory.
- Export a PNG and open it locally; check the chosen caption and artwork.
- For controller sessions, test pause → atlas → close/resume and sketchbook
  focus with actual hardware. Label injected-controller automation separately.
- Record audio behavior before/after mute; M remains mute, V opens the atlas.
- Record the browser used. Chromium automation is not Firefox/Safari evidence.

## Triage

Aggregate anonymous observations across five sessions. First fix reproduced
crashes, trapped players and save loss. Then rank repeated confusion by frequency
and impact, retaining links to the original observations. Implement a focused
regression, rerun all affected gates and ask participants to recheck the fix.
No completion-rate target or enjoyment claim is justified before sessions exist.
