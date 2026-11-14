# Project state — Live on GitHub and Cloudflare (2026-11-14)

Live: https://frogue-gallery.pages.dev . Public source and full history:
https://github.com/joelfourhman/frogue-gallery . Runtime release is
6ecff4b33b5ae8eebccadebbe636158cd0b6cdf5; initial successful production deployment
2a41a360-1607-41b4-9678-0e67f77fc76e. Main auto-deploys through the Node smoke/build
command, publishing dist/frogue-gallery. Cloudflare's account UI confirms Free
($0); no Functions, paid services, domain or network changes were added.

All 26 served assets match the frozen manifest; _headers is verified as response
policy. Production Chrome 157.0.8103.52 and Edge 157.0.4341.46 pass hosted UI,
HTTPS/redirect, MIME/CSP/privacy/cache headers, restricted-path 404s, native
clipboard save transfer, audio, capture/fallback, PNG and persistence checks.
The owner responded "lgtm" to the requested external/cellular load check.
No third-party runtime requests or data uploads were observed. Frozen release:
.cache/releases/6ecff4b33b5ae8eebccadebbe636158cd0b6cdf5/; ZIP SHA-256
4cbbeeb2512b916748dd4e9e15acb9846cb955c00dc5f1d36c24deead7878848.
Scanned 1,149 historical Git blobs for common credential patterns: no matches.

Owner requests frogue.gallery and approved preparing one-year registration at
$22.20 plus checkout tax (renewal currently $22.20/year). Cloudflare reports it
available; checkout is prepared with auto-renew OFF. Owner must finish contact,
payment and agreement acceptance. Privacy comparison supplied: Cloudflare free
redaction hides name/email/street address but leaves state/country; GoDaddy's
eligible-domain proxy privacy can hide those too. No purchase confirmed yet.
Next: verify registration, associate frogue.gallery in Pages Custom domains,
activate its DNS, wait for certificate, test live headers/assets/UI at the domain.
The pages.dev game remains live. Documentation push 1599d74 auto-deployed as
85bce632-2bf8-42e6-beeb-4f20e36407ad with matching runtime asset hashes.

# Release preparation (2026-11-14)

Owner authorized execution, then selected public GitHub source and Cloudflare
hosting. Created joelfourhman/frogue-gallery; origin points to that repository.
Cloudflare Git integration replaces the earlier Direct Upload plan. The owner
completed sign-in and GitHub consent. No paid services, custom domain or network
settings were changed. Publication and hosted verification are the next actions.

Externalized bootstrap to src/boot.js with exact loopback-only debug access and
unchanged error fallback. Added CSP/cache/privacy headers and custom 404. Builder
uses an explicit 27-file allowlist, rejects symlinks/unexpected output, verifies
file/ZIP hashes, and normalizes text line endings for identical Windows/Linux
artifacts. Added reusable artifact verification, policy preview, Cloudflare smoke
build entrypoint and a public-safe browser probe. Game/save versions and all
combat tuning are unchanged. Procedural art and original synthesized score only.

Diagnosed the intermittent lantern browser fixture: its staged frog position
overlapped solid reeds, which moved the frog out of brush range before painting.
It now chooses a real lantern with clear brush positions for all three panels;
painting assertions are unchanged. No gameplay collision changes.

Verification: ALL REQUIRED CHECKS PASSED (20 gates), including smoke stage 136,
all pacing/balance bands, source (28.6s), policy-enforced dist (25.9s), public-mode
UI (7.3s), 36 frames and performance. Package tests include actual symlink and
tamper rejection. Installed Chrome 157.0.8103.52 and Edge 157.0.4341.46 also pass
the public-mode probe: native clipboard save transfer, audio gesture/mute/volume,
mouse capture/release and fallback, PNG export, and persistence after reload.
Firefox is not installed; touch/mobile is not tested. Logs: .cache/checks/ and
tests/.out/hosted/. See deployment.md for the active release/rollback procedure.

# Previous checkpoint — Internet deployment runbook (2026-11-12)

Owner requested an executable deployment plan, including costs and security.
Added root deployment.md recommending Cloudflare Pages Free Direct Upload with
a $0 hosting default, optional separately approved domain, and no home-network
exposure. Current provider documentation is linked alongside pricing and limits.

The runbook specifies future CSP/bootstrap/artifact hardening, reproducible
release commands, account authentication, public preview and production checks,
origin-specific save transfer, update and rollback procedures, and an execution
record. Those hardening changes are planned, not implemented. No hosting account,
DNS, credentials, paid service or public deployment was changed. Await the owner's
instruction to execute the plan before publishing.

Verification: all 15 standard required gates passed; deployment PowerShell
examples parse without execution. Documentation-only change, so browser journeys
were not repeated. Runtime, balance and local/LAN hosting behavior are unchanged.

# Previous checkpoint — Foreground launcher owns hosting (2026-11-12)

Owner clarified: closing Launch Game.cmd must end the server, with no hidden
server reuse. Removed all reuse paths; every successful launch owns the listener
in its foreground console. Existing ports are refused without opening Chrome or
stopping other processes. The wrapper invokes Node synchronously; only Chrome
is detached. Closing the CMD console or Ctrl+C stops hosting.

Stopped the verified background launcher PID 22404 that the previous pass left
running. No persistent server remains. Double-click Launch Game.cmd to host;
friend's current Ethernet URL is http://192.168.50.115:8767 while it is open.
Binding remains 0.0.0.0 and the local browser save origin remains unchanged.

Verification: all 15 standard required gates passed (smoke, retained pacing,
campaign, balance, UI/audio, package/launcher). Launcher tests verify no reuse
even for matching games, occupied-port refusal, LAN HTTP, ready-before-Chrome,
and a real child-process exit releasing its listener. A separate actual Windows
CMD console-close test served HTTP on port 18767, sent WM_CLOSE to that console,
and confirmed the port closed. No game runtime changes; browser journeys were
not repeated for this launcher-only correction.

# Previous checkpoint — Captured mouse aiming and LAN launcher (2026-11-12)

Owner reported the mouse leaving the game and explicitly requested all-interface
LAN hosting, superseding the old launcher loopback-only boundary.

Gameplay mouse clicks request native pointer lock. Captured movement uses relative
CSS-scaled deltas and a bounded virtual aim position; reversing at an edge works
immediately. Clicks cannot teleport captured aim. Escape/lost capture clears held
actions and pauses; menus, sketchbook, map, defeat and rest release the cursor.
Capture requires a gesture and gracefully falls back if unsupported/denied.
Late browser responses cannot recapture a menu. Help explains capture and Escape.

Launch Game.cmd now starts 0.0.0.0:8767, opens Chrome at the same local save origin,
and prints LAN IPv4 URLs. Matching LAN servers can be reused; local-only previews
and unrelated servers are refused. A localhost preflight handles Windows allowing
simultaneous wildcard/loopback binds. Runtime files only; no repo/docs/log exposure.
Dev CLI stays loopback by default, with explicit --host 0.0.0.0 support. LAN clients
have independent browser saves; this does not add multiplayer.

Verification: smoke stage 135 covers input capture, bounds, release and rejection
paths. A separate real-Chromium page verifies capture beyond window bounds,
relative aim, immediate reversal, Escape pause, recapture and sketchbook release.
Existing precise painting fixtures exercise the no-capture fallback. Launcher
tests bind wildcard and fetch through actual detected LAN interfaces.
Final `node scripts/check.mjs --browser`: all 19 gates passed, including source
(28.7s), dist (27.9s), frames, performance and unchanged pacing/balance gates.
The lantern fixture intermittently missed strokes during earlier runs; retained
diagnostic state in its assertion. Both final browser journeys passed unchanged
painting assertions, alongside native pointer capture and fallback checks.

Replaced the verified old scripts/play.mjs listener PID 20972 with LAN launcher
PID 22404 on 0.0.0.0:8767; no firewall changes. HTTP and Chrome pointer capture
verified at http://192.168.50.115:8767 from this host. Actual Launch Game.cmd
--no-browser successfully reused it. No second-device firewall test performed.

# Previous checkpoint — A home worth painting: soundtrack remake (2026-11-12)

Owner requested a complete music remake inspired by classic MapleStory.
Replaced all background themes with 13 original compositions: title, four
swamp regions, Lily Clearing, four guardians, waterside rest, victory and
defeat. Authored 16/32-bar pieces (53–101 seconds) develop melodies and chord
progressions; the original home motif returns in victory after Umbral's
minor-key transformation. No borrowed tunes, recordings or external assets.

src/score.js holds 7,064 immutable note events across all tracks. src/music.js
renders piano, harp, flute, clarinet, music box, strings, bass and soft drums
with shaped envelopes, panning, vibrato and one shared stereo room. Short old
patterns and fixed-pitch drones are removed. Nature ambience and gameplay SFX
remain. Music follows Game._frame scenes; Hollow Sanctuary and each guardian
now have distinct pieces. Zone boundaries do not restart a regional phrase.
Pause/help/map/sketchbook lower the mix 6dB; low HP adds a beat-aligned pulse.

Transport: 180ms audio-clock lookahead, 64-voice cap, three fading layers,
96-event scheduling cap per tick. Suspended tabs skip missed notes. Voice,
gain and vibrato connections are retired; full shutdown disposes the graph.
Music/SFX sliders and mute remain independent. No balance, save/schema,
version or dependency changes. See docs/SOUNDTRACK.md for track list.

Validation: updated smoke stages 66/67 verify full-loop score playback,
scene selection, phrase continuity, routing/mute, rapid transitions,
long stalls and resource cleanup. Final `node scripts/check.mjs --browser`:
ALL REQUIRED CHECKS PASSED (19 gates), including source/dist browser journeys
(25.8/26.8 seconds), frames, performance, unchanged balance and pacing bands.
Full-loop recording measured a peak of 19 voices against the 64-voice cap.
Rendered previews peak at 0.079–0.120 with RMS 0.011–0.028 (default volume),
with no invalid samples or clipping and at most 17 voices in those excerpts.
Both source/dist browser journeys now exercise every game music scene and
render 12 seconds of every piece through real Chromium OfflineAudioContext.
Local title/marsh/Umbral/victory WAV previews and PCM metrics are generated
under tests/.out/astra/. Render checks establish finite audible stereo sound
and headroom; musical enjoyment still requires listening/playtesting.

# Previous checkpoint — Our swamp, our colors (2026-11-11)

Owner correction: combat instruction captions were spam; the identity is our
swamp, whose color was stolen by the FINAL BOSS. This overrides the previous
generic dungeon framing and the twenty-delights attack-caption decisions.
The same anchor is now recorded in AGENTS.md and active design docs.

Removed attack/recovery/blue-stop/boss coaching captions. Clearing combat now
shows only compact round progress; first-hit and long boss instruction banners
are gone. Timed opening tips skip fights, and journey/objective cards yield
to nearby enemies, active clearing or bosses. Existing attack lanes, animations,
damage/status feedback and combat rules remain. Manual practice/guide stays.

Title: "Reclaim our swamp" and the Umbral Wyrm stealing our color. Routes/rests
use regions and Continue. The final color thief's defeat visibly restores full
world color and removes the darkness mask; the end screen celebrates bringing
the stolen color home. Presentation does not rewrite saved paintings.

Creative scenery: individual mushroom caps, petals, flower heads, reed tips,
stones and lantern panels keep different colors simultaneously. Swipes leave
directional stripes; splashes leave speckles; dry erases only touched parts.
Part-specific motion, ripples and fireflies react to the brush. Mushroom caps
play color/pitch-specific pentatonic notes through the existing bounded SFX bus.
Each region still has 64 props and at most 8 marks per prop (512 total); no new
currency, combat bonus, save field or dependency. Garden blooms are visual,
without completion captions. Props still reset on a fresh region/run.

Smoke stages 132–134 cover story/finale, bounded audio and creative painting.
Browser checks cover quiet combat plus actual multicolor painting, directional
marks, local erasure and charged splash. Final verification and limitations
are recorded in docs/VALIDATION-swamp-colors.md. Base combat tuning is unchanged.
Final `node scripts/check.mjs --browser`: all 19 required gates passed,
including source/dist browser journeys, frames and performance.

The requested double-click Chrome launcher was completed and committed as
92815e4 before this correction; use root Launch Game.cmd.

# Previous checkpoint — Double-click Chrome launcher (2026-11-11)

Added root `Launch Game.cmd`, backed by scripts/launch.ps1 and play.mjs.
Finds installed or Codex-bundled Node and Chrome; starts the loopback server
before opening Chrome at the existing save origin, 127.0.0.1:8767. Reuses a
matching preview, rejects unrelated occupied ports, and keeps a newly started
server in the launcher console with Ctrl+C shutdown. No game tuning changed.

Launcher regression assertions run with the package gate: ready-before-open,
loopback-only, matching-server reuse, unrelated-server refusal and missing
Chrome diagnostics. The actual CMD/PowerShell wrapper also passed with Node
removed from PATH, verifying the Explorer/Codex runtime fallback.

# Previous checkpoint — Twenty delights (2026-11-11)

Owner asked for 20 improvement ideas and their implementation. All 20 are
mapped to shipped behavior in docs/ROADMAP.md, Milestone 4. Three agents owned
painting, combat feedback and journey UI; parent integrated gifts and checks.

Painting: **64 props per floor** (256 across the full descent), now including
deep hanging lanterns and whisper reeds. Mushrooms play a chime; each of 16
four-prop clusters celebrates its first full coloring. All effects are bounded,
run/floor-local decoration with no currency, healing or combat reward.

Combat: at most two nearby warning/opening/blue-stop captions, plus a truthful
boss phase/lantern cue. Existing warning geometry and attack timings remain.
Clearing results record battle time, dodges and colors, with a replay tip.
Duplicate old attack captions and overlapping depth text are suppressed.

Journey: four floor arrival cards, a contextual objective that yields to
lessons/events, guardian approach arches, guardian/clearing atlas markers and
an end-screen brush-build recap. Boss arrival remains spatially gated.

Gifts: six possible gifts, still three choices total. First rest keeps the
original three; later rests retain heart/flow respectively and offer two
seeded specialties. Broad brush: range **74→88.8**, splash radius **58→66.7**
(×1.20/×1.15); Quick strokes: swipe cooldown **.200→.170s** (×.85); Kind moss:
green-ground healing **3→4.05 HP/s**, paint healing **.5→.675 HP/hit** (×1.35).
These are base Normal values; repeated gifts stack, exact rounded previews
use live tuning, and every bonus resets on a new run. Unoffered gifts cannot
be granted; repaint/redraw cannot reroll choices. No base tuning changed.

Smoke stages 128–131 cover the new behavior. Browser checks exercise all
specialty selections and actual DOM painting across all three deeper floors,
blue interrupt, clearing result, atlas and guardian cues. Final required-gate
results and balance comparison are in docs/VALIDATION-delights.md: **all 19
gates pass**, including source/dist journeys, 36 frames and performance.
Before/after balance telemetry is byte-identical; clearing times remain
45.0/44.4s and the original four-boss combat build remains 292.7s.
Human enjoyment and whole-run balance remain playtest questions, not bot claims.

# Previous checkpoint — One painted dungeon (2026-11-11)

Owner direction: remove New Game+ and its features; make one long roguelike
dungeon with bosses and one final boss. The roadmap now follows that request.
Three agents implemented rules/migration, rest UI and campaign regressions;
integration remained in Game. Previous movement, clearing and repainting work
is preserved.

Implemented one continuous four-floor run: Watercolor Marsh / Gray Heron →
Sunken Reeds / Silt Wyrm → Hollow Sanctuary / Hollow Warden → Black Reeds /
Umbral Wyrm. Intermediate clears open a rest, not a victory screen. Health,
time, score and collected drops carry onward. Each rest restores **35% max HP
(rounded up, capped)**, then offers one explicit run-only gift and Descend.
Brighter paint gives **×1.20 damage/burn**, Lily heart **+2 max/current HP**,
Flowing brush **×0.88 dodge/splash cooldowns**. Three choices total; duplicates
stack. Only Umbral ends the campaign in victory. Death/new run resets gifts.

Removed NG+ cycles/scaling/modifiers, Green/Gilded Heron variants, gold rewards,
gilded frames, retirement/prestige, Encore and the shop/challenge/Wander menu
routes. New runs ignore saved purchased stats and equipped paintings. Save
migration removes obsolete NG fields and gold art while retaining ordinary
artwork, sketchbook, pins, names and exhibition. Learned painting/study
abilities remain. SAVE_VERSION 12 and GAME_VERSION 1.0.0 are unchanged.
Internal Wander generator fixtures remain diagnostic compatibility only.

Title, floor progress, rest and final/death screens now describe the single
route. Rests display health and carried gifts; keyboard/mouse/controller all
work. Practice is replayable. Controller B cancels a gift choice without
abandoning the run. Bosses still wait for the final 900px of each floor.

Balance: unchanged base enemy TTK, base zone pressure 1.22/1.64/1.76/2.20,
swipe **32.4 DPS**, charged splash **27.1 single / 81.2 group DPS**. New reward
telemetry verifies free access, carry and reset: power 1→1.2, HP 10→12, dodge
cooldown .700→.616 seconds for one of each gift. Seven retained pacing bands
pass; obsolete NG/Wander gates are replaced by campaign rules and the actual
four-boss combat journey. The invincible perfect-position combat bot takes
**292.7s** (37.3 / 85.0 / 80.3 / 90.0), excluding traversal and human decisions.

All **19 required gates pass**, including source/dist browser journeys,
36 frame scenes, performance and deterministic packaging; smoke reaches
stage 127 and ends `ALL SMOKE TESTS PASSED`. Final validation is recorded in
docs/VALIDATION-dungeon.md. Full human-run
length and enjoyment remain unmeasured. Hollow Sanctuary reuses Reeds terrain;
this is four connected floors, not four new biomes. Active runs are not saved
across reload. Next: replay the connected route, tune gift choices and repeated
Reeds encounters from observed play, then add authored variety.

# Previous checkpoint — Lily Clearing and free painting (2026-11-11)

Owner request: build the short encounter, fix confusing brush/UI concepts,
make more swamp objects paintable, and delay the boss. Three agents implemented
encounter/enemy rules, free scenery and aiming; integration stayed in Game.

Shipped: optional bell at (1050,730), three rounds of 3/4/5 enemies, max two
alive. Ground attackers lock a red warning lane for 0.8s, dash for 0.28s and
recover safely for 1.15s. Blue interrupts; red after blue deals 1.5x direct
damage only on clearing targets. Green keeps its existing root/heal role.
Initial authored HP 80/60 was tuned to **120 beetle / 90 mosquito** to give
more room for the dodge/color loop; ordinary enemies/boss HP are unchanged.
No loot farming, one first-completion heal, replay, and walk-away cancellation.
Ambient enemies yield during the fight; the starter pond cannot grant battle
invulnerability. Attacking an enemy takes priority over accidentally ringing
the bell with the same stroke.

**64 freely repaintable props** (lilies, mushrooms, flowers, stones) keep any
chosen color for the run, with bounded bounce/ripple/firefly/leaf effects.
No new currency, recipes, save fields, RNG draws or runtime dependencies.
One brush marker replaces the competing native crosshair, arc and target rings.
Plain Red/Blue/Green labels, Dodge/Space, contextual paint instructions, readable
study cards and a visible menu/Skip pointer simplify the main interactions.

Final bosses now wait for the **last 900px**, instead of a 3.2–38s opening
countdown; the swamp's 3.2s announcement starts on arena entry. Warden/Umbral
also no longer expire their intro remotely. The optional mid-run heron remains.
This is spatial progression, not a mandatory waiting timer.

Validation: required 19-gate source/dist browser suite, smoke stages 124–126,
all nine unchanged pacing bands, before/after balance telemetry with no flags,
and 36 frame scenes. Actual browser input covers repainting, bell activation,
warning dodge, blue/red combo, pointer restoration and tutorial Skip. See
docs/VALIDATION-lily-clearing.md and tests/.out/astra/32–35 PNGs.
Full-Game balance samples changed (blue toad 0.9s → 0.7s; clean-win bank
3/5/6 → 5/6/3 red/blue/green); ordinary damage constants are unchanged and
affordability still passes. Detailed deltas/limitations are in the validation.

Diagnostic full-Game clearing bot (no god mode): red-only **45.0s / 21 hops**;
blue/red **44.4s / 7 hops**; both finish all rounds without damage. All 64 sampled
worlds have a reachable bell approach. Two minutes is a newcomer design target,
not measured human duration; the game calls it a short battle. Next: owner
replay from a fresh expedition to judge clarity and enjoyment before expansion.

# Previous checkpoint — Responsive controls and readable combat (2026-11-11)

Owner feedback: “it's not that fun right now”; specifically “Movement and
combat feel awkward.” This pass prioritizes that report over further content.

Implemented: faster acceleration/braking/reversal; immediate, bounded hop
launch; ordinary brush hits keep movement at full speed (kill/charged-impact
hit-stop remains); Q/E and wheel cycle red/blue/green, with 4 explicitly dry;
quick clicks between frames paint once; a brush-reach arc and nearest hittable
target ring share actual swipe geometry; local splash-radius/charge/readiness
and hop-recovery cues; larger HUD action text; one damage and one status label
per target; release-only splash with partial/lost-input charge cancellation.

Measured 60Hz before → after: release drift **14.57 → 4.32px**, reversal
**3 → 2 frames**, first-hop velocity **124.45 → 506px/s**, displacement after
13 frames **82.66 → 92.45px**. Ordinary sustained paint over 3 real seconds
advances **2.673 → 3.000s** of simulation in the isolated target fixture.
Walking top speed stays 230px/s, hop cooldown 0.7s and invulnerability unchanged.
Response rates in pure logic: 14/s for everything → acceleration 26/s,
braking 38/s, reversal 36/s; hop multiplier 2.6 → 2.2 with immediate launch.

Warden HP **50,000 → 48,000 (-4%)**: removing repeated slowdowns put the
existing cycling-bot fight at 3.81–4.11m; the retune returns all six samples to
**3.60–3.99m** without changing attack windows or relaxing any band. Two Reeds
probes now hold movement input while injecting ideal travel velocity; previously
they inadvertently measured braking every frame. The repaired probe also ran
against an archived pre-pass runtime to distinguish harness effects from tuning.

`node scripts/check.mjs --browser`: **all 19 gates PASS**, including smoke
stage 123, nine pacing gates, balance, source/dist actual-input journeys,
36 rendered scenes, package and performance. Balance before/after: no flags;
TTK/pressure/splash ratios unchanged. Seeded victory pigment sample changed
from 3/7/4 to 3/5/6 red/blue/green as movement changed its collection path;
the affordable-loadout target still passes. Current pacing: Normal 17.3m,
human model 18.4m, heron 37.0s, Reeds 22.2m, Black Reeds 25.7m, Umbral 3.79m,
NG+ 19.5m; Wander 16.9–17.8m / Reeds 21.6–22.7m.

Visuals reviewed: tests/.out/astra/29-close-combat.png, 30-splash-readiness.png,
31-combat-640.png. Evidence/limits: docs/VALIDATION-control-feel.md. Game 1.0.0 /
Save 12 unchanged; no dependencies or external services. Next: owner replay
of move → dodge → switch color → paint → splash, then refine from that feedback.
This establishes responsive input and regression coverage, not proven enjoyment.

# Previous checkpoint — The Living Sketchbook complete (2026-11-11)

Rewrote docs/ROADMAP.md against the implemented Q1–Q9 baseline and dispatched
three implementation agents with separate file ownership. Shipped milestones
A–C: a paused Field Atlas, clearer living-study paint feedback, and decorative
pond wildlife. Prepared docs/PLAYTEST.md for the next human-feedback milestone.

- **Field Atlas:** V or pause-menu button, mouse/Esc/V/controller return,
  current study coats/stages, saved memories, nearest unfinished study, real
  zone rest locations, Reeds lantern rests, crossing and moth nook. Content
  obeys biome/Wander/Challenge gates. No save writes, fast travel or new schema.
  Opening clears held input/charge; return preserves the previous pause state.
- **Painting:** nearby paper cards name pigment/number/action and coats; aimed
  wrong-color strokes get brief quiet feedback, successful coats pulse the
  target, completion points to the saved postcard. Reeds cards sit above dark
  masking. Existing study rules, rewards and art retention remain unchanged.
- **Pond life:** 24 seeded dragonflies/skaters per world, offscreen draw culling,
  gentle frog avoidance and pigment curiosity lasting 3.4 seconds. Separate
  RNG; tests preserve terrain and shared RNG signatures in all three biomes.
- **Input repair:** real browser regression exposed first-click aim using the
  previous frame's pointer after camera movement. Mouse move/down now resolve
  world coordinates immediately through the current input view. The live
  wrong-color → correct-color test failed before and passes after the fix.

Verification: `node scripts/check.mjs --browser` **all 19 gates PASS**; smoke
ends `ALL SMOKE TESTS PASSED`, including new stages 119–122. Source/dist real
DOM key/mouse and injected-controller journeys pass. All 36 frame scenes and
bounded performance gates pass. Atlas at 1280/640px, swamp/Reeds study cards
and pigment-responsive wildlife screenshots were visually reviewed. Evidence:
docs/VALIDATION-living-sketchbook.md; tests/.out/astra/23–28 PNGs.

Balance before/after: no flags; no combat tuning changed. Pacing unchanged:
Normal 17.2m / human model 18.3m; heron 37.0s; Reeds 22.2m; Warden 3.54–3.90m;
Black Reeds 25.6m; Umbral 3.73m; NG+ 19.5m; Wander 16.9–17.8m / Reeds 21.6–22.7m.
CPU draw-submission p95: quiet 0.80ms, peak/ceiling 1.20ms, sustained 1.40ms;
these are local probe measurements, not displayed FPS or human experience.

Game 1.0.0 / Save 12; no new dependencies or machine installations. Built ZIP
SHA-256: `2e7c716d7a81b8be4cc79a2a4c97dd08821d44194c1ffa2f7a8e427c0eeb17dc`.
No remote publication, participant outreach or analytics. Full results and
facilitator kit are ready; real participants, physical controllers and
Firefox/Safari remain unverified. Next: owner-arranged human sessions, then
evidence-driven Q11 fixes; Q12 hosting still needs host/account/visibility and
publication authorization. Historical next-action notes below are superseded.

# Previous checkpoint — Milestone 4 Q8/Q9 complete

Q8 committed at **40baf4c** (2026-10-31): bounded pure rules, Enemy/Paint
adapters, no live wave-table exposure; all 15 core gates PASS at closure,
including nine pacing bands and balance. Q9 now completes the optional authored
ordinary post-victory Reeds encounter at **(2650, 300)**, 450px north of the
main corridor. One introduction per expedition; no swamp/Black Reeds/Wander/
Challenge leak. Versions stay Game 1.0.0 / Save 12; no new runtime dependencies,
combat tuning, publication, outreach, analytics or profile changes.

Implemented: carried-lantern approach; >=600ms direction-locked amber tell;
dash-only contact; blue swipe interruption/freeze; persistent green flower;
safe glide/rest even after snuffing lantern; one +2 Cobalt reward with jar cap
and bankable accounting; max two live moths. Open/pinched/swept/folded poses,
22px green/blue instruction panel above darkness, bounded two-note SFX,
short replacing callouts and explicit completed/reward cue.

Verification: `node scripts/check.mjs --browser` **all 19 gates PASS**. Smoke
stages 117/118, 24 seeded nook/path checks, malformed stroke/mode/cap/reward
checks, source/dist actual-input guiding/600ms tell/dodge/green/blue/settlement,
pause, darkness, freeze/root expiry, enemy/player death and input restart.
Real frame signatures distinguish all four poses and both flower states;
frames 16–22 plus synthesized WAVs and report in `tests/.out/astra/`.
The journey remains at 10/10 HP without god mode. Ordinary wave timers and
already-cleared zone reinforcements are staged for isolated encounter evidence;
this is not a human playtest or proof of every mixed-wave encounter.

RED/GREEN fixes include offscreen AI culling retaining stale dash/status,
settled moth re-arming after owner death, green soil sprouting collision reeds,
dim instruction text under the light mask, and the distant Silt Wyrm engaging
on a 3.2s timer instead of arena entry. Silt now waits for its arena; actual-input
arena entry still engages it. Reeds-apex camera framing no longer hides the frog
while exploring away from the arena. No combat numbers or wave mixes changed.

Final bands: Normal 17.2m / human 18.3m; heron 37.0s; Reeds 22.2m;
Warden 3.54–3.90m; Black Reeds 25.6m; Umbral 3.73m; NG+ 19.5m;
Wander 16.9–17.8m / Reeds 21.6–22.7m. Balance: none flagged.
Details, evidence and limitations: `docs/VALIDATION-lantern-moth.md`.

Next: Q8/Q9 mission is complete. Q10 human-playtest preparation may be scoped
next; participant outreach and Q12 publication still require owner approval.
Physical controller, Firefox/Safari and human enjoyment remain unverified.
Discord commit pings could not be sent: exposed Discord tools have no send
operation and no Discord credential is available in this execution environment.

# Previous checkpoint — Q8 rules complete; Q9 encounter in progress

Q8 closed 2026-10-31: pure bounded approach/tell/dash/settle rules,
600ms direction-locked warning, dash-only contact, player-owned lantern lure,
blue interruption, green-flower settlement and a one-time +2 blue reward latch.
Enemy and actual landed Paint adapters implemented; moth is NOT in any live
spawn table. Maximum-two predicate; freeze/root/dizzy recovery, death/darkness,
wrong pigments/range, repeat settlement and enemy contact/glide covered by
stage 117 (`tests/moth.mjs`). Four vertical RED/GREEN slices observed for missing
rules, counter/reward/cap, Enemy adapter and landed blue paint routing.
`node scripts/check.mjs`: all 15 core gates PASS, all nine pacing bands IN,
balance none flagged. Existing combat values/mixes and versions unchanged.
Next: Q9 authored optional ordinary post-victory Reeds encounter, presentation,
actual browser inputs and cleanup matrix, then all 19 browser gates.

# Previous checkpoint — Q6/Q7 personal exhibition complete

Q6 closed 2026-10-31: stage 115 characterizes the real Game pin UI (controller
focus, X, mouse, cap banner, immediate localStorage persistence, input cleanup).
Real Chromium source/dist journeys exercise key/mouse pin toggles and suspension;
`node scripts/check.mjs --browser`: all 19 gates PASS.

Q7 implemented 2026-10-31: 48-code-point plain-text captions, native text editor
with explicit input ownership, mouse/controller save/cancel, explicit pinned-page
title-screen exhibit/remove, and shared postcard rendering for book/title/PNG.
Edited captions survive re-filing the same expedition; unpin clears the exhibit.
Old/malformed saves default safely. Duplicate imported pinned IDs no longer bypass
the ten-page cap; object-shaped IDs cannot throw during normalization. Versions
remain Game 1.0.0 / Save 12; no combat, dependency or publication changes.

Tests: stage 116 imports tests/exhibition.mjs; RED observed for missing rename,
missing browser editor, duplicate-ID overflow and malformed object-ID migration,
then GREEN. Final `node scripts/check.mjs --browser`: all 19 gates PASS;
nine pacing bands unchanged, no balance flags. Full-cap escaped-Unicode artwork
including pin/exhibit metadata: 57,333 UTF-8 bytes (< 81,920). Real Chromium
source/dist journeys pass key/mouse editing/cancel,
shortcut isolation, Gamepad API D-pad/A/B pin/name/exhibit/export at 640x480,
save reload and actual downloaded PNG pixel identity with the shared renderer.
Mouse/controller PNG downloads are byte-identical; title canvas keepsake pixels
match the shared postcard renderer. Screens 12–15 in tests/.out/astra show the
pinned/named book, 640px editor and title keepsake; reviewed for layout/readability.
Physical controller hardware and Firefox/Safari remain unverified; text entry
requires a keyboard or OS on-screen keyboard (no new controller alphabet picker).

Next active mission: Q8/Q9 lantern-moth encounter, authorized by Joel's
"Keep going" after Q6/Q7 completion. Plan: docs/PLAN-lantern-moth.md.
Implement bounded rules first, then one optional post-victory Reeds encounter;
full core/browser gates required. No publication or participant outreach.
Historical implementation records below are retained, not current next actions.

# Previous checkpoint — Astra Q1–Q5 complete (registry, studies, painted crossing loop)

Q1–Q5 completed 2026-10-12. Q6 core/UI shipped at 5b31f92/56db0dc;
verification closed at 6306452. Q7 is complete as recorded above.

## Q6 implementation record (2026-10-12; verified 2026-10-31)

- `src/logic.js` (pure, committed as the checkpoint): `STUDIO.pinCap: 2`;
  `normalizeSketchPins` (non-array/garbage → [], string-coerced ids, deduped,
  capped at 2 — first two win); `normalizeSketchbook(raw, pins)` — pinned
  pages keep their slot against the rolling window (pageCap 8 counts ONLY
  non-pinned pages, taken from the newest end; no pins = the old
  last-pageCap behavior, asserted unchanged); `pinSketchPage` /
  `unpinSketchPage` (idempotent, capped, no-op-safe, missing-id-safe);
  `freshSave().sketchPins: []` and the `migrateSave` per-field carry with
  stale-pin pruning (the book normalizes WITH the pins, then pins are pruned
  to ids that survived). NO SAVE_VERSION bump (optional validated field,
  mirroring the flags-object pattern).
- Tests: new smoke stage 114 — 35 assertions (pin-cap truth table, 20-filing
  retention with a pinned survivor + deterministic non-pinned eviction, cap
  refusal at 2, idempotent re-pin, unpin restores normal retention,
  re-filing never duplicates (pinned or not), migration round-trip keeps
  pins, legacy load → [], garbled/stale imports degrade safely, full-cap
  artwork 29,152 bytes < 80 KiB). Full smoke: ALL SMOKE TESTS PASSED.
- **Done this session (committed):** the UI — `bookLayout().pin` (154×34,
  top-right above the postcard); the button-row entry ('Pin page · X' /
  'Unpin page · X', only drawn when a page is open); the brass pin glyph +
  '· PINNED' caption on pinned pages; `_updateSketchbook` wiring (X key —
  verified free — + mouse rect + the dispatch with pin/unpin/cap banners and
  `SaveSys.save` on every toggle); and the sketchbook gamepad focus list now
  includes the pin rect when a page is open. Smoke: ALL SMOKE TESTS PASSED
  after the wiring.
- **Verified:** stage 115 covers the real Game pin UI; source/dist journeys
  exercise DOM keyboard/mouse input, suspension and saved pin reload. All
  19 gates passed at closure. SAVE_VERSION stays 12, GAME_VERSION 1.0.0.

## Q5 record (2026-10-12)

- `src/logic.js`: `CROSSING.zoneR` (90px effect zone; the main route sits
  240px from the mouth, so the effects never reach the corridor),
  `inCrossingZone` (closed disc), `strokeTouchesCrossing` (stroke segment vs
  mouth radius + 26px reach margin; dry/null/non-finite/pigment-less strokes
  are clean no-ops), and `normalizeCrossingPainted` +
  `freshSave().flags.crossingPainted` + the `migrateSave` per-field carry
  (false for legacy saves; NO SAVE_VERSION bump — the field lives on the
  existing flags object, mirroring reedsUnlocked/reedsVictory).
- `src/player.js`: the blue current slows the frog to 0.72× while inside the
  zone (a no-op unless the world's crossing is actually 'current').
- `src/game.js`: `_paintCrossingStroke` routes real swipes/splashes to
  `world.paintCrossing` (transition SFX + banner + the one-time stamp latch
  `save.flags.crossingPainted`, persisted immediately; "postcards now wear
  the crossing's stamp" banner on the first transition only). Bramble sting:
  a red-painted mouth stings ONCE when the frog enters the zone (3×
  dmgTakenMult), latched per entry so a standing frog is not bled; the way
  itself is never blocked. The frog's position feeds `drawProps` for the
  nearby hint.
- `src/audio.js`: the 'crossing-part' beat — a brush-through bandpass sweep
  down under a low leafy thud plus a small bright lift (reuses the existing
  _tone/_noise voices, no new assets).
- `src/studio.js`: the postcard STAMP — a perforated 'CROSSING' postage stamp
  (the leafy arch over a water line) in the card's top-right corner once the
  latch is set (sketchbook view + 1600×960 PNG export; cosmetic, bounded).
- `src/world.js`: `drawCrossing` — the four state silhouettes (unpainted:
  thorny wall with a breathing "paintable" pulse; crossing: a safe leafy
  arch with soft light rays; current: blue water with drifting flow marks
  and ripples; bramble: red thorns with a warning pulse) plus the nearby
  hint. Draw-only, P10-culled like every other prop, bounded elements, no
  allocations, seed-independent (the mouth is fixed by design).
- Tests: smoke stage 113 — 21 assertions (zone geometry incl. the main-route
  exclusion, the stroke-reach truth table incl. dry/null/non-finite/
  pigment-less no-ops, latch normalization + the migrateSave round-trip +
  legacy load). Fixed a WIP defect found in verification: the round-trip
  assertions were written against `validateSaveBlob`'s `{ok, save}` shape,
  but `migrateSave` returns the save itself — they now assert
  `_case === 'migrated'` (the stronger, correct check).
- Browser journey (tests/vertical-slice.mjs, real Chromium, fresh normal
  swamp expedition, real swipe path): a corner hop landing off-center in
  the wall's corner is pushed out every frame and never trapped (an
  exactly-centered landing is unreachable in play — the push-out keeps the
  frog ≥ r+46 from any blob center); the corridor anchor is never pushed in
  any state (main passage open); green (solids 4→0, stamp latch + banner);
  the detour entered and the return route left; blue (the frog measured
  44.8px vs 70.9px over 20 frames in-zone vs out — the current slows);
  red (3 HP sting on entry, no bleed while standing, stings again on
  re-entry — once per entry); repaint green (safe revisit, no damage).
  Effects stay capped after all the crossing beats (particles ≤ 240 pool,
  brush wakes ≤ 24).
- Frame evidence: four state screenshots (tests/.out/astra/
  11-crossing-{unpainted,crossing,current,bramble}.png) + six pairwise
  pixel diffs of the four states (each > 400 distinct samples — all partial
  states render) + a postcard stamp pixel diff on a real Q2 page (latch on
  vs off).
- Pacing gate: all nine probes IN band, unchanged from the Q4 baseline
  (Normal 17.2m analytic / 18.3m measured; Reeds 22.2m; Warden 3.5–3.9m;
  Black Reeds 25.8m; Umbral 3.73m; NG+ 19.5m; Wander 16.9–17.8m /
  Wander×Reeds 21.6–22.7m) — the crossing is optional content and the
  corridor stays open, so the pacing models do not change.
- SAVE_VERSION stays 12, GAME_VERSION 1.0.0. Q5 keeps the crossing
  OPTIONAL by design: no mandatory route lock, no new economy; the loop is
  discoverable through the wall's paintable pulse and the nearby hint.
- Note: this session has no vision tool, so the four crossing frames are
  verified by the pairwise pixel assertions above rather than by eye.

## Q4 record (2026-10-12)

- `src/logic.js`: pure crossing model — `CROSSING` (fixed mouth at x=2300
  y=460, north of the central corridor, above the Rain Choir; 4 bramble
  blobs, r=46, 70px pitch → continuous ~300px wall), `CROSSING_STATES`,
  `crossingPigmentState` (green→crossing, blue→current, red→bramble,
  anything else a no-op), `crossingTransition` (idempotent by construction),
  `crossingPassable` (only 'unpainted' blocks), `crossingSpeedFactor`
  (current = 0.72, the flood factor), `crossingDamageOnEntry` (bramble = 3),
  and `crossingSolids` (bounded: 4 circles ONLY while unpainted — every
  painted state is open, so no state can trap the frog and the main
  corridor is never touched).
- `src/world.js`: `build()` seeds `crossingState = 'unpainted'` +
  `crossingSolids` (fixed, seed-independent; present in every variant
  including the Reeds — the deeper painting keeps the same mouth).
  `collideCircle` pushes out of the wall (the enemy-spawn validation path —
  a spawn placed in the wall is cleared every frame). `paintCrossing(pigment)`
  returns the new state on a real transition, null on a no-op, and rebuilds
  the collision data ONLY on real transitions. `isValidSpawn(x, y, r)` is a
  pure predicate (obstacles + wall; corridor reeds excluded on purpose).
- Tests: new smoke stage 112 (37 assertions) — pure transition truth table
  (incl. idempotence + dry/null no-ops), passability/return-path, speed and
  damage values, the exact fixed wall geometry, both ends of the crossing
  (mouth blocked while unpainted, corridor and detour anchors never pushed),
  spawn validation (valid on the corridor, invalid in the wall, enemy
  pushed out), transition-only rebuild (green→null on repeat,
  green→current→bramble), restart cleanup (fresh world unpainted + wall
  rebuilt), and the Reeds variant keeping the fixed geometry.
- Acceptance: every state has a valid return path (painted states carry no
  solids), repeated painting is idempotent (no rebuild), enemy spawn
  validation respects the new solid (per-frame collideCircle + isValidSpawn),
  main passage open in every state (asserted at the corridor anchor; all nine
  pacing probes in band — the bot is never walled). SAVE_VERSION stays 12,
  GAME_VERSION 1.0.0. Full check --browser: all 19 gates pass.
- Q4 intentionally ships WITHOUT presentation or the stroke hook (those are
  Q5: the detour, the silhouettes, the postcard stamp, and the real paint
  actions in game.js).

## Q3 record (2026-10-12)

- `src/logic.js`: registered `echo-pool` in `FIELD_STUDIES`
  (`biome: 'reeds'`, `group: 'reeds'`, colors blue→red→green, fixed at
  x=1150 y=720 — banks above the flood floor, below gravity pocket 1,
  ~500 px from the nearest rest stones). `STUDY_GROUPS.reeds.required` now
  pins BOTH `lantern-garden` + `echo-pool` — the border needs the whole
  reeds group, in any completion order.
- `src/studio.js`: new 'echo' motif (faint pool ring at step 0, blue outward
  ripples, red reflected stars, green water birds; bounded 4+7+3 elements,
  no allocations). Reward-group banners now fire EXACTLY once — on the
  completion that first satisfies the group (a `before`-list comparison), so
  finishing a second-biome study can never re-announce an earned group.
  `drawPostcard` gained a `bordered` flag (woven double frame + corner
  knots, cosmetic only) driven by `studyRewardEarned(completed, 'reeds')`
  from both the sketchbook and the PNG export. Sketchbook study list rows
  tighten to fit five entries.
- Tests: Q1/Q2 group assertions updated to the both-IDs border semantics;
  new Q3 slice assertions (fixed spot + pigment order, selector order,
  pool-first completion via real `trySwipe` strokes through both studies,
  border banner exactly once with no golden-lily re-announcement, both
  memories on the late page, bordered postcard render, round-trip keeps the
  border earned). The border's real-pixel proof moved to the
  vertical-slice journey (the smoke canvas is a stub context): the journey
  now paints BOTH reeds studies in a fresh Reeds expedition, asserts the
  border banner, and pixel-diffs the bordered vs unbordered postcard frame
  in real Chromium.
- Acceptance: each motif reads differently (echo stages distinct from
  lantern stages by design; both verified), border needs exactly the reeds
  group and survives migration (asserted), swamp gold signature still works
  (group truth table + unchanged signed path), no swamp/challenge leak
  (selector tests), Reeds pacing untouched. SAVE_VERSION stays 12,
  GAME_VERSION 1.0.0. Full check --browser: all 19 gates pass (19/19 in
  .cache/checks); dist rebuilt; browser-dist journey PASSED.

## Q2 record (2026-10-12)

- `src/logic.js`: registered `lantern-garden` in `FIELD_STUDIES`
  (`biome: 'reeds'`, `group: 'reeds'`, colors green→blue→red, fixed at
  x=3300 y=780 — on the banks above the flood floor 900, ~460 px from the
  nearest rest stone, ~1800 px short of the Silt Wyrm arena x>=5100) and added
  the `reeds` reward group (required: exactly `lantern-garden`).
- `src/studio.js`: new 'lantern' motif in `drawLivingStudy` — inert stems,
  green leaves, blue dew-lights, red orbiting moths (bounded: 6+6+8 elements,
  no allocations). All other Q1 plumbing (selector, stroke hook, archive,
  postcard memory, sketchbook list) picked it up with no new code paths.
- Tests: 9 new slice assertions (fixed spot + pigment order, wrong-pigment
  rejection, 3-stage paint progression through real `trySwipe` strokes,
  completion persistence + reeds reward group, reeds postcard page memory,
  round-trip, Reeds selector truth table incl. challenge/wander exclusions)
  and a real-browser vertical-slice stage: a fresh Reeds expedition
  (`_beginExpedition(false, { reeds: true })`) with real strokes, no god mode.
- Visual evidence: the four motif stages are pairwise pixel-distinct in
  headless Chromium (sampled signatures differ; nonzero 9216/9247/9271/9271);
  the journey screenshot is tests/.out/astra/10-lantern-garden.png.
- Acceptance: painting changes all three stages (verified), completion
  persists (save + reload asserted), the exported postcard shows the garden
  memory (journey asserts page.studies includes lantern-garden), no swamp or
  challenge leak (selector tests), Reeds pacing untouched (probe in band).
  SAVE_VERSION stays 12, GAME_VERSION 1.0.0. Full check --browser: all 19
  gates pass; dist rebuilt (15 files, 927 KiB).

## Q1 record (2026-10-12)

- `src/logic.js`: each `FIELD_STUDIES` entry now names `biome: 'swamp'` and
  `group: 'swamp'` (IDs, names, positions, pigment orders, verbs unchanged).
  New pure exports: `STUDY_GROUPS` (swamp requires exactly
  first-light + rain-choir + borrowed-sky), `studiesForBiome(biome,
  {challenge, wander})` (challenge/wander always yield none), and
  `studyRewardEarned(completed, group)`.
- `src/studio.js`: the studio instance builds from the pure selector instead
  of a hardcoded `runBiome === 'swamp'`; the golden-lily banner and the gold
  postcard seal (drawPostcard's `signed` flag) now use `studyRewardEarned`
  instead of `completed.length === 3`, so later-registered study IDs (Q2/Q3)
  cannot break or dilute the swamp reward.
- `tests/slice.mjs`: 11 new Q1 assertions — definition stability, selector
  truth table (swamp/reeds/blackReeds/unknown × normal/challenge/wander),
  reward-group truth table, future-ID immunity, schema-12 partial-progress
  round-trip, Reeds zero-studies + brush-hop preserved, wander exclusion,
  default swamp restore.
- Behavior on the current swamp: unchanged (same three scenes, same reward
  trigger, same postcard seal). SAVE_VERSION stays 12, GAME_VERSION 1.0.0.

## What shipped

- Three living field studies: First Light, Rain Choir and Borrowed Sky.
- First-study shelter, earned colored brush-hop and a cosmetic signature.
- Eight-page sketchbook of actual sampled strokes, illustrated study memories
  and local 1600×960 PNG export.
- Fair fly tell/dart/recovery and blue interruption; aimed stationary hop,
  120ms input buffer, reliable splash release and physical-input cleanup.
- Responsive canvas/pointer mapping, controller aim/paint, readable HUD,
  safe guided practice/retraining and defeat/restart/victory transitions.
- Visible Silt/Umbral geometry, readable cached lantern lighting, an Umbral
  arena inside world bounds, corrected Atelier/end-screen layout.
- Local server, enforced test command, deterministic static ZIP, current
  design/state docs and a concrete Qwen continuation plan.

Code checkpoints: 46f5912 controls/fly repairs; 43b3b0a studio/sketchbook;
48eea42 final visual stabilization. Delivery tooling/docs are the subsequent
commit. Prior planning logs are preserved in docs/history and Git c1ea26b.

## Balance record

| Change | Before → after | Why |
|---|---|---|
| Fly movement multiplier | 40 → 1 | Remove extreme pursuit speed |
| Fly tell/dart/recover | New 0.60/0.30/0.85s cycle | Readable committed attacks and escape |
| Welcome red | 5 → 6 (blue 9, green 5 unchanged) | Preserve by-zone-3 buying power after corrected fly movement |
| Warden HP | 52,000 → 50,000 | All six estimates fit original 2–4m band (3.93–4.03 → 3.54–3.90m) |
| Umbral surfaceY | 1500 → 1240 | Leave 260px below the maw inside a 1500px world; estimate 3.90 → 3.73m |

Baseline and final balance telemetry: no flags. Pressure curve at level 0:
1.22/1.64/1.76/2.20. Charged single-target splash ratio 0.84×. Cheapest
two-painting loadout affordable by zone 3. SAVE_VERSION 12 / GAME_VERSION 1.0.0
remain unchanged; new save fields are optional and normalized.

## Verification

`node scripts/check.mjs --browser` — all 19 entries pass.
Smoke ends ALL SMOKE TESTS PASSED. Nine pacing probes in band:
Normal 17.2m analytical / 18.3m mixed measured+analytic; Reeds 22.2m; NG+ 19.5m;
Warden 3.54–3.90m; Black Reeds 25.8m; Umbral 3.73m;
Wander 16.9–17.8m / Reeds 21.6–22.7m.

Source/dist journeys verify real brush study progression and PNG export,
all seven lessons, save reload, 640/960/1920 layouts, full-HP boss victory
and defeat/restart. God mode is used only for the isolated boss journey.
36 render scenes pass; final changed frames were visually inspected.
Effects stress: 203 legacy juice elements within 220 plus 24 capped brush wakes;
peak/ceiling/sustained CPU submission p95: 1.10/1.30/1.60ms.
These are bot/model and CPU measurements, not human duration or displayed FPS.
Full detail and limitations: docs/VALIDATION.md.

## Run and distribute

```sh
node scripts/dev.mjs
node scripts/check.mjs --browser
node scripts/build.mjs
node scripts/dev.mjs --dist
```

Ready artifact: dist/frogue-gallery.zip (15 runtime files, approximately 924KiB).
Hash/source file list: dist/manifest.json.
Current local preview: http://127.0.0.1:8766.
No public deployment/account changes. docs/DEPLOYMENT.md recommends the
HTML5 itch.io path and records alternatives.

## Next session

The approved Q8/Q9 mission is complete as recorded at the top of this file.
Human playtests (Q10/Q11) and publication still require their own scope and
authorization. Do not revive historical next actions. See the current
`docs/VALIDATION-lantern-moth.md` evidence and limitations.

No known reproducible game-breaking issue remains in exercised paths.
Human friend feedback, physical controllers, Firefox/Safari and hosted iframe
behavior remain unverified. No touch UI, mid-run resume or cloud persistence.
