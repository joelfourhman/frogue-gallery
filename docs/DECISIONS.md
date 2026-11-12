# Current design and engineering decisions

Updated for our swamp journey and soundtrack, 2026-11-12. Older decisions and their original
context are in history/DECISIONS-pre-astra.md. Source/tests take precedence.

| Decision | Reason / constraint |
|---|---|
| Launcher console owns the server process | Owner explicitly rejected hidden/background reuse. Every launch binds its own foreground server, refuses occupied ports, and stops hosting when its console closes. |
| Mouse capture during painting, free cursor in menus | Owner's mouse escaped the window and broke aiming. Gesture-triggered native pointer lock confines it; relative movement preserves aim, Escape releases/pauses, unsupported browsers retain absolute input. |
| LAN-enabled double-click launcher | Owner explicitly superseded loopback-only hosting. Bind 0.0.0.0:8767, show LAN URLs, retain the runtime-file allowlist and local saves; no automatic firewall changes or multiplayer. |
| Original melodic soundtrack inspired by classic adventure-game warmth | Owner requested a complete music remake with classic MapleStory inspiration. Compose original melodies and longer arrangements, synthesize locally, and give every region/guardian its own identity. |
| Audio-clock transport with bounded voices and shared acoustics | Prevent frame-rate timing drift, stale-note bursts and retained audio graphs; preserve independent music/SFX controls and no runtime assets/dependencies. |
| Our swamp, with color stolen by the final boss | Latest owner correction supersedes generic dungeon framing. Umbral is the color thief; region/rest/finale language reinforces reclaiming our home. |
| Visual combat tells without unsolicited instruction captions | Owner found the attack coaching spammy. Keep lanes, animation and status feedback; remove coaching and suppress route overlays during fights. |
| Individual colored parts and gesture-dependent paint patterns | Painting should express choices: multicolor caps/petals/panels, swipe stripes, splash speckles, local erasure and musical reactions. |
| One finite four-floor campaign; Umbral Wyrm is the final boss | Owner explicitly removed New Game+ and requested one long roguelike dungeon. |
| Three rests, 35% maximum-HP healing and one run-only brush gift each | Gives the connected run recovery and meaningful growth without permanent stat farming. |
| Preserve artwork; discard obsolete NG/prestige save fields | Keep personal creative progress while removing cycles, modifiers, gold rewards and legacy stat advantages. |
| Replace NG/Wander mode gates with campaign progression and actual combat checks | Removed features must not be reintroduced to satisfy their obsolete tests; seven unaffected pacing bands remain enforced. |
| Keep Canvas2D/Web Audio and zero runtime dependencies | Existing architecture supports a static URL and the procedural painter identity. |
| Keep pure rules and save normalization in logic.js | Fast headless regression coverage without browser APIs. |
| Put the new studio in its own module | Avoid further spreading art/progression/book logic across game.js. |
| Give three finite authored subjects real brush interactions | Creates a visible reason to paint beyond combat, with a finishable scope. |
| Teach brush-hop through the first painting | Connects artistic progress with useful defensive movement. |
| Telegraph fly direction, limit strike contact and allow blue interrupt | Corrects the 40× movement defect and gives meaningful counterplay. |
| Record bounded actual strokes and illustrate completed memories | A personal keepsake without storing screenshots or unbounded replay data. |
| Keep SAVE_VERSION 12 and GAME_VERSION 1.0.0 | Optional validated fields need no destructive migration or compatibility bump. |
| Seed pacing and fail on out-of-band output | Previously informational probes could silently report failed/capped fights. |
| Retune Warden52,000→50,000HP without widening its band | All six sampled estimates now fit2–4 minutes. |
| Keep bot estimates distinct from human playtest evidence | Analytical wave allowances do not measure enjoyment or real player duration. |
| Provide a deterministic static ZIP; defer publication | Friend sharing needs simple hosting, not infrastructure or accounts added now. |

The milestone name **Astra Vertical Slice** identifies this development pass;
it does not silently change the serialized/runtime version identifiers.
