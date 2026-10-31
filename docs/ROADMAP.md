# Frogue Gallery — roadmap after Astra

Baseline: **Astra Vertical Slice, completed 2026-09-26**. This plan is written
after the implemented gameplay and stabilization pass. It supersedes the old
v1.10-only scope; that plan is preserved in history/ROADMAP-pre-astra.md.
Complete one milestone before expanding the next. Keep the smoke, balance and
nine pacing gates green. Future features below are not present yet.

## Milestone 0 — Astra Vertical Slice — COMPLETE

**Goal:** Make being a frog painter a playable identity with useful movement,
fair threats and a personal gallery souvenir.

**Delivered features:** First Light, Rain Choir and Borrowed Sky living studies;
first-study sanctuary; earned colored brush-hop; three-study signature;
bounded real-stroke sketchbook with PNG export.

**Stabilized:** Fly speed/telegraphs/counterplay, stationary hop, input buffering,
splash release, pointer scaling/letterboxing, controller aim/paint, title
layout, finite Silt/Umbral geometry, readable lantern masking, Umbral arena
bounds, pause/retraining, practice target softlocks, victory reveal, save
normalization and zero-volume options.

**Engineering and delivery:** Seeded/enforced pacing gates, real browser
journeys, 36-scene render evidence, effects stress including brush wakes,
one-command local server/check/build, deterministic static ZIP, current-design
and Qwen handoff documents. Versions remain game 1.0.0/save 12.

**Acceptance evidence:** docs/VALIDATION.md. Source and built-directory
journeys pass; all required probes are in band. The full-health boss journey
uses god mode; study and lesson journeys do not. No external friend test or
public upload is claimed.

**Intentional limits:** Studies are normal-swamp-only, eight recent pages,
no mid-run resume or touch interface. Cross-browser/hardware and human
enjoyment evidence remain limited. Existing campaign/biomes remain playable.

**Dependency:** Existing release c1ea26b.
**Delivered order:** diagnose/play → control/threat repairs → studies/reward/
sketchbook → browser refinement → stabilization → packaging/documentation.

## Milestone 1 — Paint the Reeds' memories

### Goal
Give the already-existing Reeds descent two authored painting discoveries.

### Features
- Lantern Garden: green stems → blue dew → red moth lights.
- Echo Pool: blue ripples → red reflected stars → green water birds.
- Record each as a distinct study and postcard memory.
- Completing them changes a Reeds postcard border cosmetically.

### Technical work
Add biome-aware study definitions and explicit reward groups. Preserve the
three swamp IDs, existing brush-hop unlock, golden swamp signature and save 12
defaults. Select fixed locations away from checkpoints/boss maws. Do not
add a third reward currency or combat stat bonus.

### Content
Two living dioramas, six short verbs, two completion messages. Reuse current
procedural drawing and audio; no runtime assets/dependencies.

### Acceptance criteria
- Both studies complete with actual paint strokes in ordinary Reeds.
- Swamp studies/rewards remain unchanged; Wander/Challenge gating still holds.
- Old saves load; progress and both postcard motifs survive reload.
- Lantern fuel cannot be required indefinitely to finish a study.
- Full core and browser checks pass; Reeds pacing remains20–25 minutes.

### Dependencies
Milestone 0. Q1 precedes Q2/Q3.

### Suggested implementation order
Registry/reward groups → Lantern Garden playable end to end → Echo Pool →
postcard memory/retention checks → browser and pacing audit.

## Milestone 2 — A painted side path

### Goal
Let environmental paint change a small optional route, with no chance of
blocking the main expedition.

### Features
One authored side loop near the second swamp study: green grows a short
crossing, blue settles a current, red clears a dry bramble. The reward is an
illustrated postcard stamp, not a mandatory combat upgrade.

### Technical work
Pure three-state interaction rules in logic.js; world collision reads explicit
state. All initial/partial/completed states must preserve the main corridor.
Bound collision rebuilds to transitions; use existing brush stroke routing.

### Content
One small area, three readable silhouettes, a stamp and concise hints.
No procedural route generator or new biome.

### Acceptance criteria
- All three interactions work through paint, in any tested revisit order.
- The player can always walk back to the main route.
- Hop/collision behavior is correct at crossing edges.
- Enemies cannot spawn inside new solid geometry.
- Frame costs, smoke and all pacing bands stay valid.

### Dependencies
Milestone 1's study registry; Q4 before Q5.

### Suggested implementation order
State/collision rules → one complete side loop → return-path/corner testing →
stamp integration → visual and pacing verification.

## Milestone 3 — Curate a small exhibition — COMPLETE (2026-10-31)

### Goal
Let players deliberately keep and present favorite expedition art.

### Features
Pin up to two pages; edit a short title; choose a pinned page as the title
screen's framed keepsake. Export the same artwork with its chosen caption.

### Technical work
Retain eight rolling pages plus at most two pinned pages; unpinned eviction
must never remove pinned work. Add bounded optional fields with defaults.
Keep total serialized artwork below 80 KiB; no screenshot blobs in localStorage.

### Content
A restrained pinned ribbon, title editor, a single title-screen frame.
Avoid a new menu maze or a gallery-currency system.

### Acceptance criteria
- Pin/unpin, rename, navigation and PNG export work with mouse and controller.
- Old saves load without changing existing art.
- Ten total pages maximum; retention remains clear in UI.
- Malformed titles/IDs cannot break drawing or exceed bounds.
- Title controls remain readable at640×480.

### Dependencies
Milestone 0; may follow Milestone 1 without waiting for the side loop.

### Suggested implementation order
Retention rules → pin/rename UI → title-screen frame → export/reload/limits audit.

## Milestone 4 — The lantern moth encounter — COMPLETE (2026-10-31)

Delivered Q8/Q9: optional ordinary post-victory Reeds nook, bounded fair attacks,
actual green/blue settlement, one pigment reward, readable poses and synth cues.
Acceptance evidence and limits: `docs/VALIDATION-lantern-moth.md`.

### Goal
Add a readable enemy interaction where guiding a creature is more useful than
immediately destroying it.

### Features
A post-victory Reeds moth follows lantern light, announces a dash, and settles
onto a painted flower when interrupted with blue. Settling creates a safe
opening and a small one-time pigment reward.

### Technical work
Pure approach/tell/dash/settle rules, explicit light ownership and interruption,
one reward latch, max two active moths. Reuse existing enemy/status/render
interfaces; do not alter base-swamp wave mixes.

### Content
One species, three clear poses, one sound motif, one authored introduction
away from the first lantern tutorial and boss arena.

### Acceptance criteria
- At least0.6s visible warning; no contact damage outside the committed dash.
- Blue reliably interrupts; green flower interaction is discoverable.
- Settled enemies cannot repeatedly award pigment.
- Darkness, death, freeze, pause and restart cannot strand the state machine.
- Reeds and Black Reeds pacing remain in band; no new balance flags.

### Dependencies
Milestone 1. Q8 rules before Q9 encounter integration.

### Suggested implementation order
Rules/telegraphs → one optional encounter → drawing/audio → status and restart
matrix → full pacing/balance audit.

## Milestone 5 — Five-friend playtest build

### Goal
Check whether first-time players understand and enjoy the actual slice, and
ship a bounded set of fixes based on observed behavior.

### Features
A release checklist, a versioned ZIP and an offline feedback form covering
first movement, first painting, first study, fly escape, first defeat and
postcard discovery. Do not add tracking or analytics services.

### Technical work
Run current automated checks; manually verify Chromium plus Firefox or Safari,
one physical standard controller, fullscreen/window resize, sound unlock,
save reload and hosted PNG download. Record device/browser details and
measured observations separately from bot estimates.

### Content
A short game-page description, controls image/screenshot chosen from real
gameplay, and a five-question feedback sheet.

### Acceptance criteria
- Owner supplies or approves the friend group and distribution destination.
- At least five actual first-session observations are recorded.
- Every crash/softlock is reproduced/fixed/tested before more expansion.
- Confusion affecting two or more participants gets one small measured fix.
- Build hash, known limits and a follow-up decision are recorded.

### Dependencies
Milestone 0 is enough for an early friend build; expansion milestones are
optional. Requires human participation and explicit authority to upload/share.

### Suggested implementation order
Q10 build/checklist → owner-approved hosted draft → Q11 observations →
targeted fixes → repeat affected journeys.

## Milestone 6 — Public alpha page

### Goal
Make the validated game playable from one public URL.

### Features
A clear itch.io or static-host game page with controls, actual screenshots,
accessibility limits, local-save explanation and a download/feedback link.

### Technical work
Publish only the tested static artifact; record its hash and source commit.
Verify in the final host iframe/origin. Keep the previous ZIP for rollback.
No backend, auth, remote saves or service framework.

### Content
Owner-approved page copy, representative screenshot, short patch notes.

### Acceptance criteria
- Explicit owner authorization selects host, account, page and visibility.
- Public URL boots without broken assets and completes a fresh study.
- Saving/reload, sound and postcard export work in that hosted context.
- Exact artifact/commit and rollback procedure are documented.
- No secrets, development tools or user save data are uploaded.

### Dependencies
Milestone 5's feedback/fix pass and Q12 release artifact. Publication is not
automatically authorized by completion of the Astra pass.

### Suggested implementation order
Assemble page/artifact → owner review → upload draft → hosted verification →
publish approved page → record release.
