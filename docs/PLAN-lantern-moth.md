# Lantern moth encounter — execution plan

Authorized by Joel's "Keep going" after Q6/Q7 completion. Baseline: 3865f5a.

## Goal and order
Complete roadmap Milestone 4 (Q8 then Q9): one optional authored post-victory Reeds encounter, not a new mandatory combat gate.

### Q8 — bounded rules
Implement pure approach/tell/dash/settle transitions and integrate with existing enemy/status interfaces. Tell must last at least 0.6 seconds and lock direction; contact damage only during committed dash. Blue interrupts; a green painted flower provides a discoverable settling interaction. Settlement grants pigment at most once. Maximum two active moths. Keep out of live spawn tables until Q9. Test freeze/root/death/darkness/pause/restart, reward latch, caps and pigment transitions.

### Q9 — playable encounter
Place an optional authored introduction in ordinary post-victory Reeds, away from lantern teaching, studies, checkpoints and boss geometry. Preserve swamp waves and exclude unfinished variants from Wander/Challenge. Three readable poses, clear flower/light cue, restrained existing synth audio. Player can guide, interrupt, settle or avoid. No new runtime dependency or currency.

## Delivery gates
Use vertical RED/GREEN slices for new behavior and bugs. Every coherent commit gets focused tests, full smoke and PROJECT_STATE update. Q8 closing evidence includes all nine pacing bands and balance. Final Q9: node scripts/check.mjs --browser (all 19 checks), real-browser actual-input encounter journey, render and sound evidence, effects caps, restart/darkness/death cleanup, existing source/dist journeys and Reeds/Black Reeds bands. Do not relax tests/bands or fabricate human playtest results. Record remaining hardware/browser limits.

## Boundaries
GAME_VERSION remains 1.0.0, SAVE_VERSION remains 12. Local-only development; no accounts, outreach, analytics, upload/publication, combat retune or unrelated expansion. Q10 playtest preparation may be proposed afterward; Q11 needs actual participant evidence and Q12 explicit publication approval.
