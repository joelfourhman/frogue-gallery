# Validation — lantern moth (Milestone 4 Q8/Q9)

Date: 2026-10-31. Rules checkpoint: `40baf4c`. Local-only implementation;
Game 1.0.0 / Save 12, zero runtime dependencies. This is automated evidence,
not participant feedback, a physical controller test, or a public release.

## Delivered encounter

- Ordinary Reeds only, after the swamp victory flag (`heronDefeated`), excluding
  Black Reeds, Wander and Challenge. One authored introduction at (2650,300),
  450px north of the main corridor. A signed, non-blocking path leads to it.
  It does not modify any wave mix or consume a mandatory study/checkpoint slot.
- Only the frog's carried lantern owns the lure. Ambient rest stones/fireflies
  cannot aim the moth. Leaving its 210px nook or snuffing the lantern cancels
  an attack. The main corridor never wakes the introduction.
- Approach → 0.60s stationary, locked-direction amber tell → 0.35s committed
  dash → 1.40s safe recovery. Only the dash can do contact damage. Freeze/root/
  dizzy cancel an attack, and status expiry returns to a new warning.
- Actual green brush paint opens a persistent flower. Actual blue paint on a
  moth within 130px interrupts it, freezes it through the existing status path,
  then guides it onto the flower. Settlement can finish in darkness; it does
  not require spending lantern fuel indefinitely. A settled moth stays safe.
- One +2 Cobalt reward per moth, latched before accounting; current stock is
  clamped to jar capacity, while all two units remain bankable. No repeated
  painting, idle time, death or removal can duplicate the reward. The authored
  introduction never respawns that expedition, even if destroyed. Live cap two.
- Four bounded draw silhouettes, fixed flower petals/path/sign, a 22px hint
  above the darkness mask, completed/reward text, and a quiet two-note rising/
  falling synth motif. No new particle pool, timer service, asset or currency.

## Acceptance evidence

`node scripts/check.mjs --browser`: **19/19 PASS**. Full logs and machine report
are under `.cache/checks/`. The package gate rebuilds and validates the static
artifact; both source and built-directory browser journeys pass.

| Gate / estimate | Result |
| --- | --- |
| Smoke | ALL SMOKE TESTS PASSED; new stages 117/118 |
| Normal analytical / mixed-human estimate | 17.2m / 18.3m |
| Heron | 37.0s |
| Reeds | 22.2m |
| Warden six samples | 3.54–3.90m |
| Black Reeds | 25.6m |
| Umbral | 3.73m |
| NG+ | 19.5m |
| Wander / Wander × Reeds | 16.9–17.8m / 21.6–22.7m |
| Balance | None flagged |
| UI / SFX / music / package | PASS; SFX 46 bank names plus cap/routing |
| Browser source / dist | Both PASS, zero reported page errors |
| Existing frame scenes / performance | Both PASS |

All nine original pacing bands remain enforced, not widened. These are bot/
model estimates, not measured human session durations. No existing combat
numbers, wave mix, save schema/version or game version was retuned.

### Pure and live Game tests

`tests/moth.mjs` is imported by smoke stage 117. Vertical RED/GREEN slices
observed missing state rules, counter/reward/cap, Enemy behavior, and actual
landed Paint routing before adding those paths. Stage 118 runs the real Game,
World, Paint and Enemy integration, including 24 seeded landing/return-path
checks, invalid strokes, wrong pigments/range, mode gating, live cap, stock cap,
restart, offscreen status expiry, and one-time bankable reward accounting.

Regression RED/GREENs also reproduced and fixed:

1. Offscreen AI culling could retain a stale moth dash/status. The bounded moth
   count now keeps its light/status clock alive outside the ordinary AI cull.
2. Owner death/reacquisition could re-arm an already settled moth.
3. Procedural soil could sprout a collision reed into the green flower. The
   authored nook/path reserve clears obstacles, reeds and soil only in this mode.
4. Flower instructions were dimmed by the lantern overlay. They now render
   after that mask, with bright-pixel and layout assertions.
5. The Silt Wyrm's 3.2s intro timer engaged it before actual arena entry, and
   Reeds-apex camera framing could hide the frog during exploration. The Silt
   reveal now waits for its existing arena boundary; a real D-key entry still
   engages it. Camera arena framing is presentation-only; boss combat values
   and the existing pace probes are unchanged.

### Actual-browser input and frame evidence

`tests/moth-browser.mjs` is called by BOTH source/dist `vertical-slice.mjs`
journeys and can also be run independently. It stages a late-game location and
already-cleared zone beats/wave timer for isolation; no god mode or direct
phase/paint/reward setters are used for encounter verbs. Freeze/root and lethal
HP changes are explicitly separate cleanup fixtures.

Actual DOM movement traverses the ordinary corridor without waking a moth,
walks into the nook, guides the approach, moves during a direction-locked tell,
pauses/resumes, dodges a committed dash and returns to the route. The warning
was observed over 37 simulation frames (at least 600ms), with unchanged aim
and 10/10 HP. Real keys 3/2 and real mouse strokes bloom/interrupt/settle the
moth. L snuffs the lantern during settlement; settlement/reward still finish.
The frog remains alive at 10/10 HP, and an additional 300 idle frames cannot
repeat the +2 reward. Separate L snuff/relight, freeze/root expiry, moth death,
player defeat and Escape/Enter restart paths pass.

Evidence in `tests/.out/astra/` (generated, ignored):

- `16-moth-nook.png`, `17-moth-approach.png`, `18-moth-tell.png`,
  `19-moth-dash.png`, `20-moth-blue-counter.png`, `21-moth-resting.png`,
  `22-moth-resting-640.png` and `report.json`.
- Pixel signatures distinguish all four moth poses at fixed time and both
  flower states. Actual frame assertions require the frog/flower to remain in
  view, gameplay rather than a defeat modal, and bright readable hint pixels.
- `moth-tell.wav`, `moth-settle.wav`: actual Chromium OfflineAudioContext output
  from the production synth dispatcher, mono 44.1kHz. Tell peak 0.068704, RMS
  0.006717, audible tail 0.360s; settlement peak 0.063543, RMS 0.007352, tail
  0.4665s. The headless SFX test checks dispatch, bus routing and voice cap;
  offline waveform evidence is not a human listening/mix test.

## Remaining limits

- Physical controller hardware, Firefox/Safari, touch and hosted iframe behavior
  remain unverified. Actual key/mouse tests do not establish human understanding.
- The isolated journey deliberately excludes unrelated zone reinforcements;
  existing mixtures still run normally in play. No claim that a player can idle
  forever safely while other swamp creatures are present.
- Fixed authored content only; no Black Reeds/Wander/Challenge variant, no new
  save flag, no mid-run resume. Restart intentionally creates a fresh encounter.
- Q10 participant testing and Q12 publication remain separately authorized work.
- Discord tools exposed to this writer provide reading/admin operations, not
  message sending; no Discord token is present in process environment. No ping
  or readback is claimed.
