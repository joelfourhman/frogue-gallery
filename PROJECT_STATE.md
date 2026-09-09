# Project State

_Pm note (2026-09-05):_ this file is the live next-action tracker (kept per
project convention). The concise PM overview is `docs/PROJECT_STATUS.md`;
milestones in `docs/ROADMAP.md`; decisions in `docs/DECISIONS.md`; durable
agent instructions in `AGENTS.md`.

### v1.9 "The Living Swamp" — NEXT ACTION (orchestrator handoff, 2026-09-08)

**v1.8 is COMPLETE** (all 8 items G1–G3 / H1–H2 / R1–R2 / A1 committed,
106/106 smoke green, all 9 probes in band, 1.0.0 release signed off at
`6c9e09e`). v1.9 is **the quality pass** — the plan-of-record is in
`docs/ROADMAP.md` §v1.9: T0 (frame-evidence harness), S1–S3 (sound design),
J1–J4 (juice on the core action), L1–L4 (a living world + visual identity),
A1 (the quality audit). ~13 items, ~5 sessions.

**Why v1.9:** content is deep but the feel layers are the thinnest part —
the whole game runs on ~6 synthesized SFX functions, and every visual
judgment so far has been text-eyeballing; nobody has actually SEEN the game
frames. T0 fixes the process (real frames as evidence); S/J/L raise the
perceived quality of sound, the paint verb, and the world.

**The load-bearing invariant (pin this):** every S/J/L item is
**presentation-only** — zero tuning changes. All 9 pacing probes stay in band
UNCHANGED, makeTuning byte-identical to v1.8-complete (`6c9e09e`), smoke green
after every commit, SAVE_VERSION stays 12. Feel work must never move a number.
**New process rule:** no polish item ships without its before/after frames
(dev-only screenshot harness, playwright-core gitignored, runs on a free port
NOT 8765).

**T0 LANDED** (session v19-t0; `6eb246d`) — the frame-evidence harness
(`node tests/frames.mjs`, dev-only playwright-core) + the v1.9-BASELINE frame
set (36/36 non-trivial frames in `tests/frames/`). The before/after-frame
process is live.

**S1 LANDED** (session v19-s1; `f765b61`) — **the SFX bank**: the core paint
verb (surface-aware `paint-swipe`/`paint-splat` + the `charge-splash`),
per-creature hit/death stings (6 archetypes; turtle/cragfrog fall back to the
generic `enemy-hit`/`enemy-die`), status on/off (`burn-ignite`/`freeze-tick`/
`root-thud` + `burn-out`/`freeze-release`/`root-crackle` + the dry-scrub
status-off + the `heal` chime), pickup + UI (`ui-hover`, `pause-open`/
`pause-close`; `pickup`/`ui`/`ui-back` reused), and the boss stings
(`boss-phase` shared across all 4 archetypes + `boss-kill` + `collection-
fanfare`). **62 total sfx cases** (40 pre-existing + 14 the dead v19-t0 session
had written-but-never-wired + 8 new), all on the sfxBus through the existing
`_tone`/`_noise` helpers + the `_sfxCanStart` voice cap; music bus + music
layer untouched. Evidence (audio can't be screenshotted): `tests/sfx.mjs`
(standalone, `node tests/sfx.mjs` → `SFX TESTS PASSED`, 44 bank names + sfxBus
routing + the voice cap) — the full per-sfx trigger manifest is in the commit
message. Invariant held: `makeTuning` byte-identical (logic.js untouched),
SAVE_VERSION 12, smoke `ALL SMOKE TESTS PASSED`, all 9 probes in band unchanged
**(pace ~18.7 / humance 18.5 min; bosspace 37.0s).**

**S2 LANDED** (session v19-s1; `9ad0618`) — **Music dynamics**: the ambient
bed + step-sequencer melody gain INTENSITY LAYERS. Distinct per-biome zone
themes (a REAL Reeds set — low/watery/slow wet-minor drone; a Black Reeds set
— darker/lower/sparser; the swamp set stays byte-identical to the hand-tuned
v1.7 baseline) + a PURE `themeSelector({ zone, bossEngaged, lowHp, collection })
-> { themeId, patternDensity, extraVoices }` (patternDensity = the real
active-step count, so "denser pattern = higher intensity" holds: boss > zone).
The danger layer (a low boss off-beat pulse, a sparse high uneasy low-HP
ostinato below ~30% HP that fades out above it, a brief zone-entry swell, and
the Full-Collection chord swell) all rides `melodyMaster -> musicBus` so the
music slider + mute inherit; `bossPhaseUp()` swaps the live boss loop to a
denser/faster pre-built phase-2 variant. Evidence: `tests/music.mjs` (the S2
section, ~40 assertions — the right theme + density for swamp/Reeds/Black
Reeds/boss/lowHp/collection + the melodyMaster -> musicBus routing).
Invariant held: `makeTuning` byte-identical (logic.js untouched), SAVE_VERSION
12, smoke `ALL SMOKE TESTS PASSED`, all 9 probes in band unchanged (pace
~17.2 min / bosspace 37.0s), P10 (nothing allocates per-frame in the tick —
all danger voices pre-built lazily).

**S3 LANDED** (session v19-s1; `7ec519c`) — **Ambient life audio**: the seeded
sparse wet/swamp bed. A PURE `nextAmbientEvent({ biome, rng, t }) ->
{ type, flavor, t } | null` sampler (no Math.random/browser/global state; the
caller's seeded mulberry32 stream is the only source, advanced in a fixed
per-slot draw order, so the same (biome, seed, t-cadence) yields the same
event times — deterministic in node) + `AMBIENT_KINDS`/`AMBIENT_P` (insect /
water / wind / heron + per-biome per-slot probabilities). SPARSE — most slots
return null, a few events/min; WATER is a WET-BIOME-ONLY kind (reeds / black
reeds), the heron RARE (~once per zone). The VOICES ride a new `_ambLifeMaster`
bus -> musicBus (the music slider + mute inherit): `_ambChirp`/`_ambDrip`/
`_ambWind`/`_ambHeronCall`, all a few-percent peak (a bed, never a wall of
sound). The STEPPER `stepAmbientLife(dt)` is driven by the rAF expedition tick
(NO setInterval), runs the pure sampler once per whole second; P10 (per-frame:
a clock add + at most one voice/second). `startAmbientLife(biome, seed)` /
`stopAmbientLife()` at run start/end, seeded by the run's world seed.
Evidence: `tests/music.mjs` (the S3 section, ~20 assertions — sparsity,
biome-gating, determinism, kind/flavor validity + the `_ambLifeMaster ->
musicBus` routing). Invariant held: `makeTuning` byte-identical (logic.js
untouched), SAVE_VERSION 12, smoke `ALL SMOKE TESTS PASSED`, all 9 probes in
band unchanged (headless no-op — the sampler never feeds runT).

**J1 LANDED** (session v19-juice; `bd02f38`) — **Hitstop** (the T2 juice pass):
a 40–70 ms real-time freeze (+ impact flash) on paint CONNECT, longer (~110 ms)
on a charged splat and on an enemy KILL, + a shorter ~30 ms self-damage freeze.
Reuses the v1.4 `hitStop(secs, scale)` mechanism (a real-time `timeScale` dip —
the world sim + `runT` run on `simDt = dt*timeScale`, so a hitstop stretches
WALL-CLOCK, never the measured `runT`: the documented invariant). Three new
connect hooks — the swipe connect (50 ms) + the charged-splash connect (110 ms)
+ the self-damage (30 ms @ 0.4×) — all gated by `options.shake` AND
`_tutorialActive()` (the frozen-clock guided teaching run is exempt — combat
time-dilation belongs to the timed expedition, not the practice layer). The
impact flash: `_applyHits` now sets `e.hitFlash = 0.14` on connect (it was
never set positive before, so the flash was dead for regular enemies) + a new
white-hot IMPACT RIM in `drawEnemy` (a rim ring + core wash that peaks at the
connect and fades with hitFlash) so the frozen frame reads as IMPACT, not a
pause. **The A/B invariant is proven in smoke** (new stage 59b): Run A (hitstop
ON) vs Run B (hitStop→no-op), identical + seeded — the connect's RULE OUTCOME
(enemy hp) is identical in both (the hitstop fired in A but changed no damage),
while over equal real frames A's game-time advanced LESS (0.0434s vs 0.0668s)
— the dilation stretched the presentation clock, provably pure. Evidence:
`tests/smoke.mjs` stage 59b (7 assertions) + frames before→after
(`tests/frames/enemy-beetle.png` → `tests/frames/after-J1/beetle-hitstop.png`;
`enemy-toad.png` → `toad-hitstop.png`, the white-hot impact frame). Invariant
held: `makeTuning` byte-identical (logic.js untouched — `git diff` empty),
SAVE_VERSION 12, smoke `ALL SMOKE TESTS PASSED`, all 9 probes in band unchanged
(bosspace 36.9s).

**J2 LANDED** (session v19-juice; `e4ffff0`) — **the paint arc** (the core
verb — "painting is the game"): the brush trail is upgraded from a flat
start→end ribbon into a real wet in-flight arc. (1) **Arc fidelity** — the
swipe ribbon bows into a curved bezier (a control point offset perpendicular to
the swipe; drawn as a fresh 10-segment bezier, replaces the 8-segment straight
line). (2) **Droplet physics** — a few POOLED ink droplets (capped 48, oldest
dropped) separate off the swipe/splash with velocity + gravity + air-drag
settle, then fade. A separate pool in `paint.js` (the world `ParticleSystem`
stays a fixed 240), so the P10 budget is untouched. (3) **Charged-slate feel**
— the full-charge splat is the heavy impact of the verb: a wider, denser arc (a
bolder inner ring ribbon), MORE droplets (12 vs 5), a denser landing. (4) **Ink
that LANDS** — painted soil darkens (a short-lived darker wet blotch under the
pigment) + painted water shows a RIPPLE RING (uses the existing
`paintSurfaceAt`), so the LANDING is visible, not just the arc. Deterministic /
invariance: the new presentation is seed-derived (a seeded xorshift PRNG per
stroke + position hashes), NOT the global Math.random, so the smoke's seeded RNG
stream and the J1 A/B invariance hold; draw-only — never touches damage/hits/
runT/tuning. Evidence: `tests/smoke.mjs` new stage 59c (20 assertions — the
curve bows off the straight line, pooled + capped droplets, charged > swipe
droplet count, the charged dense ring, the ink landing soil-blotch-vs-water-
ripple, and that a full-power burst's total on-screen juice stays ≤ 220 P10
green) + frames before→after (`paint-{red,blue,green,water}.png` →
`tests/frames/after-J2/arc-{red,blue,green,water}.png` + `arc-charged.png`).
Invariant held: `makeTuning` byte-identical (logic.js untouched), SAVE_VERSION
12, smoke `ALL SMOKE TESTS PASSED`, all 9 probes in band unchanged.

**J3 LANDED** (session v19-kill) — **Kill quality**: every death is now an
**ink burst** — the creature dissolves into the blobs of the pigment that
painted it (a NEUTRAL ink splat if never painted). Implemented as a separate
**draw-only pool** in `paint.js` (`this.inkBurst`, capped at `MAX_INKBURST=192`),
position-seeded (a `_posSeed` of x,y — NO global RNG draws, so it is
deterministic + never shifts the A/B invariance), pooled + capped. The burst is
spawned AFTER the rules decide the death — in `_onEnemyDead` (regular
creatures, 22 blobs in the enemy's painted tint; a paint-kill takes the killing
stroke's pigment, a burn-out / never-painted death takes neutral ink) and in
`_onHeronDefeated` (the BOSS kill: a LARGER two-burst — its last-painted pigment
`h._lastPig` + a wider neutral-ink ring — + the camera hold, reusing the v1.4
awaken-moment `_awakenHoldT` pattern). `paint.spawnInkBurst` / `paint.update`
(decay) / `paint.drawInkBurst` (draw) + the game.js world-space draw call. The
boss's `_lastPig` is tracked in `paintBossHit` (paint.js). Death timing / damage
/ drops / tuning / runT are untouched — the burst is pure presentation.
New smoke stage **107 (J3)**: a real kill pops a 22-blob burst in the painted
tint; a never-painted kill pops neutral ink; a wave + boss stays within the cap
+ the P10 juice budget (≤220); the burst decays to 0; and it is deterministic
+ draw-only (A/B: seeded runs → equal `inkBurst` length + colors + decay-to-0).
Frame evidence (harness): `tests/frames/enemy-toad.png` →
`tests/frames/after-J3/toad-kill-burst.png` (red dissolve); `enemy-beetle.png` →
`after-J3/beetle-kill-burst.png` (blue); `boss-gray-heron.png` →
`after-J3/boss-kill-burst.png` (the larger two-burst, white-impact flash faded).
Invariant held: `makeTuning` byte-identical (logic.js untouched), SAVE_VERSION
12, smoke `ALL SMOKE TESTS PASSED`, all 9 probes in band unchanged.

**J4 LANDED** (session v19-kill; `8a22d46`) — **the frog's liveness** (draw-state
only): the frog now reads as a *living* character, not a static sprite.
- **Idle breathe** — a subtle dt-accumulated squash cycle (±~0.012, layered on
  the relaxed ~1.0) when standing still; OFF while moving / hopping /
  staggering / posing so the other states read cleanly.
- **Hurt stagger** — `hurt()` arms `_staggerT = 0.4`; draw() renders a fast
  decaying wobble rotation + a flinch squash, the frog's OWN reaction layered
  ON TOP of the J1 hitstop (which freezes the WORLD). NO i-frame / HP / damage
  change (verified: iframes + the damage number are exactly the rule values).
- **Low-HP tremble** — below ~30% HP a faint high-freq position jitter (draw-
  only) + the eyes NARROW + a worried brow (a `quadraticCurveTo` per eye); it
  fades out above the 30% line (the `desperate` draw-state ramps 0→1 as HP
  approaches 30%).
- **Victory pose** — `_onHeronDefeated` sets `_victoryHopT = 1.0` at the moment
  the boss is defeated (BEFORE the victory screen transition); draw() reads a
  contented hop lift (reusing the `hopLift` shape) + a squash-and-settle that
  relaxes back to the idle breathe.
All **draw-only** (the `squash` / blink fields are the pattern) — no physics /
HP / i-frame number moves. Frame evidence (baseline idle frog `title.png` → the
`after-J4/` states): `tests/frames/after-J4/frog-idle-breathe.png` (the puffed
breathe peak) / `frog-hurt-stagger.png` (a mid-stagger wobble + flinch) /
`frog-low-HP.png` (15% HP — the tremble + desperate eyes) /
`frog-victory-pose.png` (a mid-hop contented pose). A new smoke stage (108, 16
assertions) locks the presentation-only guarantee: the stagger / tremble /
victory timers + the real `hurt()` / `_onHeronDefeated` handoff, and that the
i-frame window + damage are the rule values. Invariant held: `src/logic.js`
byte-identical (EMPTY diff), SAVE_VERSION 12, smoke `ALL SMOKE TESTS PASSED`
(stage 108, 16 assertions), all 9 probes in band unchanged (pace ~17.2, bosspace 37.0 s,
humance simulated cross ~57 s / boss ~351 s — vs baseline 37.1 s; run-to-run
variance only).

**NEXT ACTION: L1** (the next session) — **the living world** (the first of
L1–L4: ambient environmental life — swaying reeds / drifting mist / water
shimmer, the v1.4 L1 pattern re-applied). A1 (the v1.9 quality audit) is the
season's final item; read `docs/ROADMAP.md` §v1.9 for the L1 spec.
**Housekeeping note (orchestrator, post-J3/J4):** the J2 latent droplet bug
flagged by the J3/J4 session (drawDroplets read `d.size`, the spawn stores `r`
→ NaN radius → in-flight droplets invisible) is **ALREADY FIXED + committed**
(`e713c1a`, a 2-line draw fix; after-J2 frames recaptured under the fixed code
and verified md5-changed; smoke green; logic.js untouched). It is NOT an open
item — A1 verifies the fix, it does not re-address it.
Batch plan: T0 → S1 + S2 + S3 (LANDED) → **J1 + J2 + J3 + J4 (ALL LANDED this
season)** → L1 → L2 + L3 → L4 + A1 (fresh sessions).

### v1.8 "The Full Collection" — **COMPLETE** (the 1.0.0 release — session v18-a, 2026-09-08; all 8 items G1–G3 + H1–H2 + R1–R2 + **A1** landed — the A1 1.0.0 season audit (fresh session) signed the season off)

**v1.7 is COMPLETE** (all 9 items D1–D4 / F1 / O1 / O2 / I1 committed, 101/101
smoke green, all 7 probes in band, hand-tuned runs byte-identical with Wander
OFF, 13 commits, season signed off at `34eeda2`). The full **v1.8
plan-of-record is in `docs/ROADMAP.md` §v1.8** — read it first. v1.8 is
**the 1.0 release version** ("The Full Collection"): the last deferred depth
item (a dedicated NG+ Reeds variant + its 6th boss, the Umbral Wyrm) lands,
the gallery gets a real **completion state** (the namesake payoff the game
never had), and the game gets a real **release surface** (README + 1.0.0
version string + changelog).

**Batch 1 (session v18-g): G1 → G2 → G3 LANDED** (3 commits, each smoke-green)
— the Black Reeds NG+ Reeds variant + the Umbral Wyrm 6th boss + the selection
wiring + the two new probes (`blackpace.mjs` + `umbrapace.mjs`). The
load-bearing invariant held end-to-end: **every existing run stays
byte-identical** (the Black Reeds variant + Umbral Wyrm are gated behind
`ngCycle >= 1` AND a Reeds victory; a cycle-0 Reeds run, a Wander × Reeds run,
and a hand-tuned run all deep-equal their v1.7 tuning / content;
`reedspace.mjs` re-verified in band **unchanged** at ~22.2 min).

**Landed this session (3 commits, all green, 103/103 smoke):**
- **G1** `4ec7d07` `feat(v1.8 G1)` — the BLACK REEDS NG+ Reeds variant. A NEW
  `REEDS_DARK` layout (a deeper **7200px** descent vs the cycle-0 Reeds'
  6000px; a **denser** Wisp/Serpent/Leech bestiary pick-ratio
  `REEDS_DARK_BESTIARY_DENSITY` {wisp 0.94 / serpent 0.905 / leech 0.87} vs
  {0.965 / 0.935 / 0.905}; an **extra gravity pocket** — 4 vs 3
  (`REEDS_DARK_POCKETS`); a **deeper/slower flood band** (floor 780 / factor
  0.62 vs 900 / 0.72); its **own darker lantern-economy tuning**
  `REEDS_DARK_LANTERN` {radius 213 vs 260, drain 0.054 vs 0.04, minRadius 74 vs
  88, restSpot 81 vs 90} via pure `lanternTickFor` / `lanternRadiusFor` /
  `lanternLightFactor` wrappers (default `LANTERN` → cycle-0 byte-identical).
  Gated behind a pure `blackReedsUnlocked(save)` (`ngCycle >= 1` AND a Reeds
  victory) + a `flags.reedsVictory` latch set on a Reeds-biome victory (a
  `save.flags` field → **SAVE_VERSION stays 11**; `migrateSave` carries it).
  The `World` builds the variant off `{ reeds, blackReeds }`; the three pure
  Reeds traversal functions (`inGravityPocket` / `hopLift` /
  `floodedWaterFactor`) are parametrized with backward-compatible defaults so a
  base / cycle-0 run is byte-identical. Smoke **stage 102** proves the gate +
  the byte-identity.
- **G2** `49f74a8` `feat(v1.8 G2)` — the UMBRAL WYRM 6th boss. A NEW
  `logic.js` `UMBRA_WYRM` tuning (**60k HP**, 4 maw points, ~2.4s cycle,
  dual-telegraph 0.6, surfaced 6.7 / deep 5.4, strike 14 dmg @ 170 reach × 1.2
  deep, awaken 90/90/90, siphon 0.05 × 1.6 deep) + `umbrStep` (the Silt Wyrm's
  `wyrmStep` made DUAL-PHASE + a "deep dark" final phase at 40% HP) alongside
  `SILT_WYRM` / `wyrmStep`. The 3-hue awaken reuses the EXISTING
  `paintBoss` / `bossStep` path (the same latch — proven in the smoke stage).
  A telegraphed DUAL maw (both points marked via `_partnerIdx`), a Warden-
  inherited `umbraFuelSiphon` (the lantern-eater), and a flood-pocket
  (Wyrm-inherited) mechanics. The "deep dark" final phase makes the lantern
  MANDATORY to paint (pure `umbraPaintable`, wired into the paint gate). The
  Black Reeds run spawns it in place of the Silt Wyrm (`this.blackReeds`); a
  cycle-0 Reeds run still spawns the Silt Wyrm (byte-identical). game.js wires
  `_updateUmbra` + `_drawUmbra` (the dual-maw tell + the deep-dark vignette +
  the siphon stream) + the engage/dispatch/defeat beats. NEW **tests/
  umbrapace.mjs** probe: the Umbral fight is a **~3.86 min** human estimate
  (god-mode ~100s × 0.42; one tier above the Silt Wyrm's ~3.9) — **in the
  2.5–4 min band**.
- **G3** `3b5949d` `feat(v1.8 G3)` — the SELECTION WIRING verification + a NEW
  **tests/blackpace.mjs** probe (the full Black Reeds run: a ~25.8 min human
  estimate — god descent + analytic waves × 7200/5400 + the Umbral at 0.42;
  **in the 22–26 min band**, one tier above the cycle-0 Reeds' ~20–25) + a
  comprehensive **smoke stage 103** proving: the end-of-Reeds boss is the
  Umbral Wyrm (hand-tuned NG+ Reeds with a Reeds victory) vs the Silt Wyrm
  (cycle-0 Reeds / NG+ without a Reeds victory) vs the Warden (Wander × Reeds);
  cycle-0 Reeds is byte-identical (the v1.6 6000px / 3-pocket / Silt-Wyrm
  content, deterministic per seed); the Umbral Wyrm is only-in-Black-Reeds; the
  dual-phase + siphon + maw mechanics; and the pure `blackReedsUnlocked` gate.

**G1–G3 invariant evidence (measured this session, session v18-g):**
- `node tests/smoke.mjs` → **103/103 ALL SMOKE TESTS PASSED** (deterministic;
  two consecutive runs md5-identical; the `144fb1c` flake-pin stays green).
- `node tests/reedspace.mjs` (cycle-0 Reeds) → **~22.2 min** — IN THE 20–25
  band and **UNCHANGED** (the load-bearing invariant: a cycle-0 Reeds run is
  byte-identical to v1.7).
- `node tests/umbrapace.mjs` (NEW) → **~3.86 min** — in the 2.5–4 min band.
- `node tests/blackpace.mjs` (NEW) → **~25.8 min** — in the 22–26 min band.
- `SAVE_VERSION` stays **11** (the `reedsVictory` flag is a `save.flags`
  field; the 11→12 bump with `galleryCompletion` comes in H1, NOT here).
- Zero new dependencies; no new assets; the `144fb1c` flake-pin stays green.

**Batch 2 (session v18-h): H1 → H2 LANDED** (2 commits, each smoke-green) — the
gallery **Full-Collection capstone** (the release headline) + the Gallery Wall
completion beat. The load-bearing invariant held end-to-end: **H1/H2 are meta +
presentation, they add no timed-run time** — a v11 save migrates to v12 and
plays byte-identically (`makeTuning` output unchanged when `galleryComplete` is
false); every existing run stays byte-identical; **all 8 pacing probes
re-verified IN band UNCHANGED.**

**Landed this session (H1 + H2, all green, 105/105 smoke):**
- **H1** `7be0d5f` `feat(v1.8 H1)` — the "Full Collection" ledger (the
  namesake payoff). A NEW `logic.js` `GALLERY_COMPLETE` tuning (capstoneLevel 1,
  inkPerLevel +4, orbPerLevel +0.20) + a pure `galleryCompletion(save)` check:
  all **10 PAINTINGS owned** (8 base + 2 gold-tier) + **every boss defeated at
  least once** (gray / green / gilded / Silt Wyrm / Warden / Umbral Wyrm — the
  `save.flags.bossDefeats` list, populated on each victory via `this.heron.kind`)
  + a **first-time victory** (`flags.heronDefeated`) + a **Reeds victory**
  (`flags.reedsVictory`). The existing `galleryBonus` "Rehung Frame" meta (A4)
  becomes the CAPSTONE: at Full Collection a **permanent saved `galleryBonus`
  level** is minted once ("the museum keeps you better"), riding the existing
  `applyGalleryBonus` path via a NEW `galleryBonusTotal(save)` = saved level +
  one-time `capstoneLevel(save)` (0 while incomplete → `makeTuning` byte-
  identical). A **one-time completion cinematic** reuses the v1.5 first-victory
  beat machinery (`this._cine = { …, collection: true }`, a distinct "The Full
  Collection!" caption). A NEW `save.galleryComplete` boolean latch +
  `save.flags.bossDefeats` array — **SAVE_VERSION 11 → 12** (a v11→v12
  migration + `normalizeGalleryComplete` / `normalizeBossDefeats` default the
  new fields `false` / `[]` for every legacy save; `migrateSave` carries both
  per-field so a completed save keeps its latch on reload). Pure + deterministic;
  the latch is **idempotent** (flips once — a second victory after completion does
  not re-mint). Smoke **stage 104** proves: the pure check (fresh incomplete,
  synthetic all-complete qualifies), the capstone strict-better tuning, the
  byte-identity invariant, the idempotent one-time latch, and the v11→v12
  migration (fields defaulted OFF, byte-identical play).
- **H2** `c57b4d0` `feat(v1.8 H2)` — the Gallery Wall screen + the completion
  beat. The existing Atelier **Gallery tab (tab 2)** gains a **progress readout**
  ("Paintings X / 10 · Bosses Y / 6" — the pure `galleryCompletionProgress(save)`)
  so a player can SEE what they are missing, + a **full-collection gold glow**
  behind the 10-frame wall (a soft radial bloom, procedural art only, gated on
  `galleryCompletion`) + a **title-screen "collection complete" badge** (a gilded
  plaque, gated on `save.galleryComplete`). Pure presentation over the H1 state;
  no timed-run time; no new assets; both a non-complete and a complete save draw
  cleanly (no JS errors). Smoke **stage 105** proves the wall data + the glow
  gating + the title badge + the no-mutation presentation.

**H1–H2 invariant evidence (measured this session, session v18-h):**
- `node tests/smoke.mjs` → **105/105 ALL SMOKE TESTS PASSED** (deterministic; the
  `144fb1c` flake-pin stays green; 103 pre-existing stages + stages 104 (H1) +
  105 (H2)).
- `SAVE_VERSION` **11 → 12** (the ONLY schema change this session). A v11 save
  migrates to v12 with `galleryComplete` false + `bossDefeats` [] and plays
  byte-identically (`makeTuning` output unchanged when `galleryComplete` false —
  asserted in stage 104).
- **All 8 pacing probes IN band UNCHANGED** (H1/H2 are meta + presentation, no
  timed-run time): `pace.mjs` ~17.2 / `humance.mjs` 19.2 (IN 15–20, hand-tuned
  Wander OFF) / `ngpace.mjs` 19.4 (IN band) / `bosspace.mjs` ~0.62 min /
  `reedspace.mjs` ~21 min (IN 20–25) + Silt Wyrm 3.9 min / `wandpace.mjs` both
  legs in band / `wardpace.mjs` 3.9–4.1 min / `blackpace.mjs` ~25.8 min (IN
  22–26) / `umbrapace.mjs` ~3.9 min (IN 2.5–4).
- Zero new dependencies; no new assets; loopback-only; pure rules in `logic.js`;
  the `144fb1c` flake-pin stays green; no `http.server` 8765 left running.

**Batch 3 (session v18-r): R1 → R2 LANDED** (2 commits, each smoke-green) —
the **release surface** (README + the 1.0.0 version string) + the **changelog +
DECISIONS close-out**. The load-bearing invariant held end-to-end: **R1 is
presentation + docs only** — no tuning, no run-time change; every pacing probe
stays in band UNCHANGED and hand-tuned runs are byte-identical.

**Landed this session (R1 + R2, all green, 106/106 smoke):**
- **R1** `119a0f1` `feat(v1.8 R1)` — the release surface. A **README.md** (the
  game's first): the one-liner + the "painting is the game" pillar, how to run
  (loopback-only `python -m http.server 8765` or open `index.html`), the full
  control set (keyboard + the v1.6 gamepad map — every claim re-verified
  against `input.js` + the `GAMEPAD_MAP` in logic.js, including the title
  hotkeys Enter/Space/A/G/N/B/O/C/R and the 2-slot loadout / 10 paintings /
  6 bosses), the expedition loop, the meta loop (gallery bonus → Full
  Collection capstone), and the architecture note (vanilla JS + Canvas 2D +
  WebAudio, zero deps, no build step, loopback-only). The **1.0.0 version
  string**: a single display-only source of truth (`GAME_VERSION = '1.0.0'`
  in `logic.js`, beside `SAVE_VERSION`) rendered by the title corner stamp
  ("Frogue Gallery · v1.0.0") + the Options header line. Not in the save
  schema; never feeds a run. Smoke **stage 106** asserts `GAME_VERSION ===
  '1.0.0'` and is REFERENCED (a fillText spy over real `_drawTitle` /
  `_drawOptions` draws proves both renders fire and mutate no state).
- **R2** `docs(v1.8 R2)` — the changelog + DECISIONS close-out.
  **docs/CHANGELOG.md** (NEW): the full release history, newest first
  (1.0.0/v1.8 → v1.1 → the tutorial-era milestone line), one block per
  version with accurate representative SHAs + the per-version
  `SAVE_VERSION` history (1 → 12). **docs/DECISIONS.md**: four v1.8 rows
  (15–18) in the existing table format — the Black Reeds gating (a
  victory-gated NG+ variant, not a bypass; the end-of-Reeds boss selection),
  the Umbral Wyrm's 2.5–4 min band + the deep-dark lantern mandate, the Full
  Collection criteria + the capstone-over-bonus choice + the 11→12 migration
  defaulting the new fields OFF, and the 1.0.0 versioning choice (a
  display-only const, never in the save schema).

**R1–R2 invariant evidence (measured this session, session v18-r):**
- `node tests/smoke.mjs` → **106/106 ALL SMOKE TESTS PASSED** (deterministic;
  3 consecutive runs; the `144fb1c` flake-pin stays green; 105 pre-existing
  stages + stage 106 (R1 version string)).
- **All 9 pacing probes IN band UNCHANGED** (R1/R2 are presentation + docs,
  no run-time change): `pace.mjs` ~17.2 / `humance.mjs` ~18.9 (IN 15–20,
  hand-tuned Wander OFF) / `ngpace.mjs` 19.5 (IN band) / `bosspace.mjs` ~0.62
  min / `reedspace.mjs` 17.5 min waves + Silt Wyrm 3.9 min (IN 20–25) /
  `wandpace.mjs` both legs in band (16.9–17.8 + 21.6–22.7) / `wardpace.mjs`
  3.9–4.1 min / `blackpace.mjs` 21.0 min waves + Umbral 4.0 min (IN 22–26) /
  `umbrapace.mjs` ~3.9 min (IN 2.5–4).
- Zero new dependencies; no new assets; loopback-only; pure rules in
  `logic.js`; the `144fb1c` flake-pin stays green; no `http.server` 8765 left
  running.

**A1 — the v1.8 / 1.0.0 season audit (K10/C4/A1-style, the final gate) — ✅ DONE
(2026-09-08, session v18-a, FRESH session; every gate GREEN).** A1 ran in a
fresh session (the independent audit of the whole v1.8 diff since
v1.7-complete `34eeda2`, on the committed tree `6e87cd8`). Every line item in
the §v1.8 A1 spec was run and recorded — all in band, none forced:

| Gate | Result | Band / expectation | Verdict |
|---|---|---|---|
| `smoke.mjs` ×3 (consecutive) | 3/3 `ALL SMOKE TESTS PASSED` (106 stages) | green, deterministic | ✅ |
| `smoke.mjs` 10-run flakecheck (144fb1c pin) | 10/10 green | the `144fb1c` determinism pin stays green | ✅ |
| `pace.mjs` (hand-tuned, Wander OFF, first-time) | ~17.4 min | 15–20 min | ✅ IN (UNCHANGED) |
| `humance.mjs` (full-run sim, first-time) | 16.7 min | 15–20 min | ✅ IN (UNCHANGED) |
| `ngpace.mjs` (NG+ cycle-1) | 19.5 min | 15–20 min | ✅ IN (prints IN BAND) |
| `bosspace.mjs` (heron 30k, 3-hue) | 37.1 s god-mode (~1.0 min human) | the heron lower-bound probe | ✅ (UNCHANGED) |
| `reedspace.mjs` (cycle-0 Reeds + Silt Wyrm) | ~22.2 min / 97.7 s Wyrm god (~3.9 min human) | 20–25 min / 2–4 min | ✅ IN (byte-identical to v1.7) |
| `wandpace.mjs` — LEG 1 (first-time Wander, 8 seeds) | [16.9, 17.8] min (8/8) | 15–20 min | ✅ IN |
| `wandpace.mjs` — LEG 2 (Wander × Reeds, 8 seeds) | [21.6, 22.7] min (8/8) | 20–25 min | ✅ IN |
| `wardpace.mjs` (the Hollow Warden, 52k) | god 98–104 s (mean 103 s) → ~3.9–4.1 min human | ~2–4 min class | ✅ IN |
| `blackpace.mjs` (Black Reeds + Umbral Wyrm) | ~25.9 min / 105.5 s Umbral god (~4.2 min human) | 22–26 min | ✅ IN |
| `umbrapace.mjs` (the Umbral Wyrm, 60k) | ~3.89 min human (98.1 s god) | 2.5–4 min | ✅ IN |
| **Byte-identity (v1.7 `34eeda2` baseline)** | `makeTuning` + `applyNGPlus(1)` **deep-equal v1.7-complete across all 216 arg combos** (headless import of both versions; JSON-compare across the whole v1.8 diff); cycle-0 NG+ step a no-op; a cycle-0 (Wander-OFF, no-NG+) first-time swamp tuning byte-identical to v1.7 | hand-tuned / cycle-0 runs byte-identical to v1.7 | ✅ IDENTICAL |
| Save-schema delta vs v1.7 | `freshSave` differs ONLY in `saveVersion` (11→12), added top-level `galleryComplete: false`, and `flags` gaining `bossDefeats: []` | the intended v1.8 migration, nothing else | ✅ |
| `SAVE_VERSION` 11→12 migration | v11-era save → `saveVersion 12` with `galleryComplete false` + `bossDefeats []` (defaulted OFF) and **plays byte-identically** (makeTuning-feeding fields unchanged); v1-era save migrates end-to-end to v12 (`_case: 'migrated'`, all 19 top-level fields present) | the v1.8 migration chain + legacy walk | ✅ |
| `GAME_VERSION` | `'1.0.0'` in `logic.js` (single source of truth), referenced in the title corner ("Frogue Gallery · v1.0.0") + the Options header line (`v${GAME_VERSION}`) | the 1.0.0 release string rendered, not dead | ✅ |
| Zero new dependencies (git-diff since `34eeda2`) | only `src/` (game/logic/player/world) + `tests/` (smoke + new blackpace/umbrapace) + `docs/` + `PROJECT_STATE.md` + the new `README.md`; **no** package.json / lockfile / asset / node_modules | no new deps | ✅ |
| P10 culling (smoke stage 24) + green across Reeds / Black Reeds worlds | green (view-cull 0.15 localized/full + enemy AI-cull) | no per-frame hot-path alloc | ✅ |
| `README.md` accuracy spot-check | run command (`python -m http.server 8765 --bind 127.0.0.1`), the 6 named bosses, 5400px/4 zones/10 paintings/2 slots, the controls (title enter/space+a/o/g/n/b/c/r; run 1/2/3/4→pigment, space hop, WASD/arrows, H/?/P/M) — all re-verified against the actual `input.js`/`game.js` code | README matches the code | ✅ |
| No `http.server` 8765 left running | none found (checked via `netstat` BEFORE + AFTER the audit) | loopback-only, nothing left running | ✅ |

**v1.8 COMPLETE** — all 7 items (G1–G3, H1–H2, R1–R2, A1) committed; every gate
green on the committed tree; the load-bearing invariant (a cycle-0 / Wander-OFF
/ no-NG+ hand-tuned run is byte-identical to v1.7-complete `34eeda2`) holds;
the 1.0.0 release is signed off. **v1.8 = the 1.0.0 release — the game's Full
Collection.** Active scope now lives in `docs/ROADMAP.md` (the post-v1.8
deferred list); no open v1.8 work. Housekeeping: the untracked `.before-logic.mjs`
left as-is; no `http.server` left running.

**Full item list (per the plan-of-record):**
- **G1** `feat(v1.8 G1)` — the "Black Reeds" NG+ Reeds variant: a NEW
  `REEDS_DARK` layout (deeper descent, denser Wisp/Serpent/Leech bestiary, an
  extra flood / gravity pocket, its own lantern-economy tuning), gated behind
  `ngCycle >= 1` AND a Reeds victory. The v1.6 Reeds layout (cycle-0) is
  untouched.
- **G2** `feat(v1.8 G2)` — the "Umbral Wyrm" 6th boss archetype: a NEW
  `logic.js` `UMBRA_WYRM` tuning + `umbrStep` alongside `SILT_WYRM`/
  `wyrmStep`; ~60k HP, 3-hue awaken via the existing `paintBoss`/`bossStep`
  path, a telegraphed dual maw + a "deep dark" final phase where the lantern is
  mandatory; the fuel-siphon (Warden-inherited) + flood-pocket (Wyrm-
  inherited) mechanics; default-OFF (only appears in the Black Reeds variant);
  a NEW `tests/umbrapace.mjs` probe targeting a **2.5–4 min** human band.
- **G3** `feat(v1.8 G3)` — the selection wiring (end-of-Reeds-descent boss:
  Umbral Wyrm [NG+ Reeds] vs Silt Wyrm [cycle-0 Reeds] vs Warden [Wander ×
  Reeds]) + a NEW `tests/blackpace.mjs` probe (the Black Reeds run, a new
  hand-tuned 22–26 min band, one tier above Reeds) + a smoke stage proving:
  cycle-0 Reeds is byte-identical, the Umbral Wyrm is only-in-Black-Reeds, the
  dual-phase + siphon + maw mechanics, and the gate logic.
- **H1** `feat(v1.8 H1)` — the "Full Collection" ledger: a NEW `logic.js`
  `GALLERY_COMPLETE` tuning + `galleryCompletion(save)` pure check (all 10
  paintings owned + every boss defeated at least once [gray / green / gilded /
  Silt Wyrm / Warden / Umbral Wyrm] + a first-time victory + a Reeds victory);
  the existing `galleryBonus` "Rehung Frame" meta becomes the *capstone* (a
  permanent saved `galleryBonus` level at Full Collection — the "the museum
  keeps you better" payoff) + a one-time cinematic (reusing the v1.5 first-
  victory cinematic machinery). A NEW `save.galleryComplete` boolean latch +
  boss-defeat tracking flags (SAVE_VERSION 11 → 12, migration defaults
  `false` / `[]` for legacy saves).
- **H2** `feat(v1.8 H2)` — the ledger UI + the completion beat: the existing
  gallery / ledger frame gains a **progress readout** (X / 10 paintings, Y / 6
  bosses) so a player can *see* what they are missing; at Full Collection a
  title-screen "collection complete" badge + the capstone cinematic. Pure
  presentation over `galleryCompletion(save)`.
- **R1** ✅ **DONE `119a0f1` (2026-09-08, session v18-r)** — the README +
  version string: a `README.md` (what it
  is, how to play [open `index.html` in a browser, loopback-only], the controls
  [keyboard + gamepad, from the v1.6 W1 map], the meta [build → expedition →
  gallery], the NG+ / Reeds / Wander modes, a short changelog); `index.html` +
  the title screen carry a **`1.0.0`** version string; `docs/PROJECT_STATUS.md`
  gets the "v1.8 = 1.0.0 release" marker.
- **R2** ✅ **DONE (2026-09-08, session v18-r)** — the changelog + DECISIONS.md
  close-out: `docs/DECISIONS.md` records the 1.0 call + the v1.8 scope
  decisions;
  `docs/ROADMAP.md` gets the post-v1.8 deferred list.
- **A1** `docs(v1.8)` — the v1.8 / 1.0.0 season audit (K10/C4/A1-style, the
  final gate): smoke ×3 green; `pace.mjs` + `humance.mjs` first-time IN the
  15–20 band (hand-tuned, Wander OFF); `ngpace.mjs` cycle-1 in band;
  `bosspace.mjs` + `reedspace.mjs` in their documented ranges **UNCHANGED**; the
  NEW `blackpace.mjs` (Black Reeds 22–26 min + Umbral Wyrm) and
  `umbrapace.mjs` (2.5–4 min) in their bands; the NEW Full Collection gate (a
  save with every painting + every boss + both victories → `galleryCompletion`
  true + the capstone `galleryBonus` applied); the byte-identity re-check (a
  cycle-0 Reeds run, a Wander × Reeds run, and a hand-tuned run all deep-equal
  their v1.7 tuning / content — JSON-compare `makeTuning` / `applyNGPlus`
  across the whole v1.8 diff); P10 culling green; **zero new dependencies**
  (git-diff since v1.7-complete `34eeda2`: only `src/` + `tests/` + `docs/` +
  `PROJECT_STATE.md` + the new `README.md`); **SAVE_VERSION 12** migration chain
  loads a v1-era save end-to-end; tree clean; PROJECT_STATE.md +
  docs/PROJECT_STATUS.md marked v1.8 / **1.0.0 COMPLETE** with the audit table.
  Acceptance: the commit itself.

**Operating loop (unchanged):** read `AGENTS.md` + `PROJECT_STATE.md` + the
§v1.8 plan-of-record first; work in bounded chunks (one item = one commit);
test (smoke green) after each commit; keep PROJECT_STATE.md + docs/
PROJECT_STATUS.md updated; ping the orchestrator (committed git + state docs)
when a chunk lands; never leave a `http.server` running; never discard
uncommitted user work. The full invariants are in the plan-of-record.

### v1.7 "The Ever-Shifting Swamp" — COMPLETE (session v17-f1, 2026-09-08; all 9 items landed — D1 + D2 + D3 + D4 + **F1** + **O1** + **O2** + **I1** — the I1 season audit signed the season off)

**v1.6 is COMPLETE** (all 13 items R1–R6 / W1–W3 / Q1–Q3 / A1 committed, 94/94
green, all pacing in band, 114 commits since v1.5). The full **v1.7
plan-of-record is written in `docs/ROADMAP.md` §v1.7** — read it first. Theme:
the swamp that is never the same twice.

**Landed this session (8 commits, all green):**
- **D1** `22c5d85` — the PURE seeded Wander content generator (`wanderContent` /
  `pickWanderSeed` / `WANDER_BUDGET` envelope / `normalizeWanderSeed` /
  `options.wander` default-OFF / `SAVE_VERSION 10→11` + v10→v11 migration).
  game.js wires the gate + the "Wandering · seed N" HUD badge; a default-OFF run
  is byte-identical to v1.6 (hand-tuned `ZONES` same reference + cycle-0 tuning
  deep-equals a plain `makeTuning`). Smoke **stage 95** proves it.
- **HYGIENE** `144fb1c` — made the whole smoke suite **deterministic**: the
  harness already stubs the clock, so the only non-determinism left was
  `Math.random()` leaking into the REAL Game update path (enemy/heron wander at
  enemies.js, particle/trail scatter in paint.js). A full `new Game(...)` +
  several frames of AI made real-Game positions frame-nondeterministic, which is
  exactly the pre-existing v1.7 **stage-75 K4 flake** (`healAcc 0.00 -> -0.28`,
  ~1-in-12) AND the same flake class latent in E1 + T3. Fix = a SEEDED
  mulberry32 `Math.random` in the harness (the v1.6 R2 hardening) + a
  K4-specific deterministic-target pin (the brush fan aims at `p.aimA`
  (mouse), so the frog now aims at the tanky foe + the foe is pinned to a fixed
  coordinate each frame). 30-run flakecheck **0 failures** (was ~2-3/30).
- **D2** `b093ebf` — THE WANDER "taste": a pure `wanderTaste(seed) -> {id,name,
  tag, bias}` over a 4-archetype hand-tuned set (The Quiet Reeds / Feast
  Season / The Long Dark / Ink Bloom), each a different weight profile that only
  re-weights WHICH KINDS fill the zones (never the counts) so a biased run is
  inside `WANDER_BUDGET` exactly as the neutral one is. The Wandering HUD badge
  gains a second line — the taste name (one line of flavor). Smoke **stage 96**
  proves it.
- **D3** `5f5e8af` — **NG+ + Reeds parity** for the Wander (BOTH legs, per the
  ROADMAP plan-of-record): (a) **Wander × NG+** — `applyNGPlus` N2 scaling
  applies exactly ONCE on top of the generated content (the gate only generates
  *content*, never tuning, so no compounding; asserted by deep-equality: the
  live NG+ tuning deep-equals `makeTuning + applyNGPlus(cycle)` applied once and
  differs from the double-applied one; the generated enemy CONTENT is not scaled
  by NG+ and stays in-envelope). (b) **Wander × Reeds** — the gate no longer
  excludes Reeds, so a Wander × Reeds run has generated zone content + the Reeds
  light economy (lantern fuel loop) + the R3 bestiary + the Silt Wyrm boss on
  top (a valid victory-gated variant). (c) The hand-tuned (Wander-OFF)
  expedition + Reeds runs remain byte-identical. **Also landed the load-bearing
  `tests/wandpace.mjs` probe here (early, so I1 reuses it)** — a generated
  first-time Wander run in 15–20 min across 8 seeds (band 16.9–17.8) + a Wander
  × Reeds leg in 20–25 min (band 21.6–22.7), both in-band; the WANDER changes
  only the z.mix-driven zone-beat (background waves come from `_spawnWave`, not
  `z.mix`, so travel/background/boss are seed-invariant — the probe scales only
  the zone-beat against the documented anchors, consistent with pace.mjs /
  reedspace.mjs). Smoke **stage 97** proves the parity + byte-identity.
- **D4** `6612442` — the **Wander options toggle** + **save export/import
  parity**. The Options panel gains a FIFTH toggle, "Wandering Expeditions"
  (default OFF), wired through the existing P9 machinery (`_optionsLayout` row
  + `_drawToggle` + click handler + gamepad-nav entry; the panel grows 560→598,
  the gamepad + Save rows shift down with it). Clicking it flips `options.wander`
  + persists to the options blob. The existing save export/import round-trips the
  `wanderSeed` field (the exported blob carries wanderSeed + saveVersion 11,
  validates through `validateSaveBlob`, a v1-era blob imports to v11 with
  wanderSeed 0, a malformed wanderSeed is refused). Smoke **stage 98** proves the
  toggle (persists + re-reads + legacy-migrates-to-OFF) + the export/import
  parity + seed reproducibility across a save/load cycle.
- **F1** `086c05f` — **THE HOLLOW WARDEN, the 5th boss archetype** (the
  Wander-apex, the deferred "5th boss / more Reeds depth" item). A pale,
  lantern-eating creature that spawns ONLY as the end boss of a WANDER
  expedition (a hand-tuned cycle-0 / NG+ / Reeds run never meets it — the Warden
  branch is a pure additive, byte-identical when Wander OFF). New pure
  `logic.js`: `WARDEN` tuning (52k HP — the Wander apex, above the wyrm's 48k)
  + `wardenStep` (the maw-window state machine: mawClosed -> telegraph ->
  mawOpen; the Warden is INVULNERABLE except while its maw is open — a
  telegraphed window reusing the Silt-Wyrm ripple-ring language) + `wardenTasteFactor`
  (the taste-seeded aggression: a Feast Warden's invulnerable gaps are shorter ->
  the maw opens more often + a faster siphon) + `wardenFuelSiphon` (drains a full
  wick in ~60s base while the lantern is LIT, taste-scaled to 45s feast / 75s
  quiet; stops when unlit/empty, auto-extinguishes at 0). The 3-hue awaken works
  through the EXISTING `paintBoss`/`bossStep` path (the same awaken latch).
  game.js: boss SELECTION wiring (Wander ON -> Warden; Wander OFF + Reeds ->
  Silt Wyrm; Wander OFF -> heron) + the `_updateWarden` drive (wardenStep + the
  fuel siphon + the maw-strike) + the `_drawWarden` render (a PALE palette + the
  maw-head + the slithering body-line, P10-capped) + the maw-window paint gating
  + the defeat/sink beat + a Warden-aware end-screen recap line. A low
  `warden-rumble` SFX reuses the audio synth (no new asset). Smoke **stage 99**
  proves: Warden-only-in-Wander (byte-identical when Wander OFF — a hand-tuned
  cycle-0 / NG+ / Reeds run keeps its heron / wyrm), the maw window, the fuel
  siphon, the 3-hue awaken, and the taste-seeded aggression (Feast opens its maw
  before Quiet). NEW `tests/wardpace.mjs` (modeled on reedspace.mjs) measures the
  Warden at **~3.9–4.1 min human** (god-mode ~98–104s) — in the 2–4 min band,
  comparable to the Silt Wyrm's 3.9 min (the Warden is the 52k-HP apex, the
  longest of the Reeds bosses). NOTE: the spec's "~1.5 s maw window" is preserved
  as the TELEGRAPH duration; the PAINTABLE maw-open window was tuned to 10.5s
  (vs the wyrm's 7.0s surfaced) so the 52k HP lands in the human band — a
  deliberate deviation from a literal 1.5s paint window, documented here.
  (Committed as `f21dcab` — the entry was first authored as `086c05f`, then the
  F1 doc updates were folded in via an amend, so the landed SHA is `f21dcab`.)
- **O2** `237abfb` — **the WANDER run-recap line.** The v1.6 Q2 end-screen run
  recap (the "the last expedition" strip: a 6-zone minimap of the route + run
  time + boss outcome) gains a SECOND line for a WANDER run ONLY — the taste's
  name + its one-line flavor + the "Wandering expedition · seed N" tag — so the
  end screen tells the story of a UNIQUE run (e.g. "Feast Season — a swarm of
  mosquitos rides the warm current · Wandering expedition · seed 987654321").
  A run-local read (`wanderActive` / `wanderSeedRun` / `wanderTaste` from
  `_beginExpedition`, IN-MEMORY ONLY) — nothing is persisted. A hand-tuned
  (Wander-OFF) run's recap is UNCHANGED (the line is absent — `_recapWanderLine`
  returns null for them); the save is BYTE-IDENTICAL before/after the end
  screen; it shows on BOTH a Wander victory AND a defeat. Reuses the Q2
  `routeTrail` / recap machinery (no new layout — the line sits in the empty
  band above the end card, so the card height + button rects are unchanged).
  Smoke **stage 100** proves it (15 asserts: a Wander run's line = taste +
  flavor + tag, rendered via headless fillText-recording on BOTH a victory AND
  a defeat with the run's OWN seed; a hand-tuned run's line is absent; the save
  is byte-identical; the run-local fields are not on the save object).
- **O1** `8033942` — **the pre-expedition WANDER seed card.** Before a Wander
  expedition begins (from the title's "Begin Expedition"), a small paper card
  shows the generated seed + the taste's name + its one-line flavor (e.g.
  "Feast Season — a swarm of mosquitos rides the warm current"), so the player
  knows what they are walking into (and can note / share the seed). "Set out"
  begins the run with THAT EXACT seed (deterministic: the seed the player saw
  is the seed the run plays — `_beginExpedition` accepts `opts.seed`); "Esc /
  Back" returns to the title. It is ABSENT for a hand-tuned (Wander-OFF) run —
  the title's "Begin Expedition" routes through `_startExpeditionOrCard`, which
  opens the card ONLY when `options.wander` is ON, so a default-OFF run's start
  path is byte-identical to v1.6. IN-MEMORY ONLY: the card itself persists
  nothing (`_openSeedCard` only sets the in-memory `this._seedCard = { seed }`;
  the seed latches to `save.wanderSeed` only when "Set out" actually begins the
  run); `SAVE_VERSION` stays 11. Smoke **stage 101** proves it (17 asserts: a
  hand-tuned run shows NO card + goes straight to the expedition + the save is
  byte-identical; a Wander-ON "Begin Expedition" OPENS the card and stays on the
  title; the card RENDERS the seed + taste name + flavor + "Set Out" via
  headless fillText-recording; opening it persists NOTHING; "Set out" begins the
  run with the EXACT seed shown; the taste matches the card's taste (same seed
  -> same taste)).

**Invariants held after D1–D4 + F1 + O1 + O2:** smoke x3 ALL PASSED
(**101 stages**; deterministic — the same run produces the same result every
time, and the orchestrator's 10-run flakecheck stays green). Hand-tuned pacing
**UNCHANGED** (Wander is OFF by default so those probes measure the hand-tuned
runs): `pace.mjs` ~17.2 min, `humance.mjs` ~19.0 min (15–20 band),
`reedspace.mjs` ~22.2 min (20–25 band), `bosspace.mjs` ~1.8 min (heron). NEW
`wandpace.mjs` both legs in-band (first-time 16.9–17.8; Wander × Reeds
21.6–22.7) + deterministic. NEW `tests/wardpace.mjs` (F1) measures the Warden at
~3.9–4.1 min human (in the 2–4 min band, comparable to the Silt Wyrm's 3.9
min). O1/O2 add NO timed-run time (O1 is a pre-run title sub-state; O2 is a
post-run end-screen line — neither changes any run's pacing), so all six probes
are re-measured and in-band on the committed tree. `SAVE_VERSION = 11` (F1, O1
and O2 each add NO save field — the Warden is a pure boss-variant additive and
O1/O2 are in-memory-only presentation, so the save schema is unchanged).

**NEXT ACTION: v1.7 is COMPLETE — awaiting direction for v1.8.** The I1
season audit (the final gate, run in a clean FRESH session on the committed
tree) is GREEN. All 9 items — D1–D4 + F1 + O1 + O2 + I1 — are landed and
committed. The `docs/ROADMAP.md` §v1.7 plan-of-record is fully checked off
with the audit table. **v1.7 has no open scope.**

**I1 — the v1.7 SEASON AUDIT (fresh session, 2026-09-08, all on the committed
tree):**

| # | Gate | Result | Band / expectation | Status |
|---|---|---|---|---|
| 1 | smoke ×3 | `ALL SMOKE TESTS PASSED` ×3 (101 stages, 1817 asserts) | green, deterministic | ✅ |
| 1b | smoke flakecheck ×10 | 10/10 green (the `144fb1c` flake-pin stays green) | deterministic | ✅ |
| 2 | pace.mjs + humance.mjs (first-time, hand-tuned, Wander OFF) | pace ~17.3 min / humance 18.7 min | IN 15–20 | ✅ |
| 3 | ngpace.mjs (cycle-1) | 19.5 min | IN 15–20 | ✅ |
| 4 | bosspace.mjs + reedspace.mjs | heron 37.0 s god-mode (lower-bound probe); Reeds run ~22.2 min + Silt Wyrm 97.7 s god (~3.9 min human) | bosspace = documented lower-bound probe; Reeds IN 20–25 + Wyrm IN 2–4 | ✅ |
| 5 | wandpace.mjs (≥ 5 seeds) | first-time 16.9–17.8 min over 8 seeds; Wander × Reeds 21.6–22.7 min over 8 seeds | first-time IN 15–20; W×R IN 20–25 | ✅ |
| 6 | wardpace.mjs | Warden god 98–104 s → ~3.9–4.1 min human (comparable to the Wyrm's 3.9 min) | the documented 2–4 min class (52k-HP Wander apex, via the `f21dcab` maw-open 10.5 s tuning) | ✅ |
| 7 | byte-identity invariants | `makeTuning` (+ `applyNGPlus(1)`, normal/gentle/hard) **deep-equal the v1.6-complete (`f746938`) values** (JSON-compare across the whole v1.7 diff); the `freshSave` delta is EXACTLY `{saveVersion 10→11, wanderSeed: 0}` (the intended migration — no other field, no hand-tuning drift) | hand-tuned + cycle-0 swamp byte-identical with Wander OFF | ✅ |
| 8 | zero new dependencies | git-diff `f746938..HEAD` touches only `src/audio.js`, `src/game.js`, `src/logic.js`, `tests/smoke.mjs`, `tests/wandpace.mjs`, `tests/wardpace.mjs`, `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `PROJECT_STATE.md` — NO package.json/lockfile/asset/node_modules; `SAVE_VERSION` stays 11 | zero deps, SAVE_VERSION 11 | ✅ |
| 9 | no `http.server` 8765 left running | `netstat -ano | grep 8765` → no listener | none running | ✅ |
| — | P10 culling | green (stages 24 / 95 / 99 — view-cull + enemy AI-cull hold across the generated world) | in-band / no regression | ✅ |

**Load-bearing invariant CONFIRMED:** every hand-tuned run (cycle-0 swamp,
cycle-0 Reeds, NG+ cycle-1) stays byte-identical with Wander OFF (the
default) — `makeTuning` + `applyNGPlus` deep-equal their v1.6 values, and the
only save delta is the intended `SAVE_VERSION 10→11` + `wanderSeed: 0`
migration. Every probe is IN band. **v1.7 COMPLETE — the season is signed
off.** NEXT ACTION for v1.8: **awaiting direction** (no open v1.7 scope).

**Batch 4 (DONE this session):** landed O1 (the pre-expedition seed card) as
`feat(v1.7 O1)` (`8033942`) + O2 (the Wander run-recap line) as `feat(v1.7 O2)`
(`237abfb`), on top of F1 (`f21dcab`), and I1 (the season audit) as the final
`docs(v1.7)` gate. Never discard uncommitted user work (there is none now —
only the orchestrator's `.before-logic.mjs` snapshot is untracked; leave it).

**Headline (D1–D4): "The Wander"** — a **bounded, pacing-safe procedural
expedition** (the deferred procgen item revisited with the two-biome data).
Generate the *encounter content* (zone composition, enemy mix, orb/jar/checkpoint
placement) from a **seeded RNG stream** (`mulberry32(seed + WANDER_SALT)`, a
SEPARATE stream from the terrain pass — the v1.6 R2 pattern) sampled within a
**hand-tuned pacing envelope**. The terrain/layout pass is UNCHANGED (same
painted world, 60fps, P10 safe). **Default OFF (opt-in)** so the hand-tuned
first-time / NG+ / Reeds runs are byte-identical to v1.6; a NEW
`tests/wandpace.mjs` (modeled on `humance.mjs`) proves the generated envelope
is tight (≥ 5 seeds in the 15–20 band; a Reeds leg in 20–25).

**Second (F1): the 5th boss — the Hollow Warden**, a pale lantern-eating
Wander-apex predator (spawns only at the end of a Wander expedition; siphons
candle fuel while the lantern is lit; vulnerable only in a telegraphed maw
window reusing the Silt-Wyrm telegraph; 3-hue awaken via the EXISTING
`paintBoss`/`bossStep` path; taste-seeded aggression; ~52k HP; Wander-mode only).

**QoL (O1–O2):** pre-expedition seed card + Wander run-recap line. **Audit
(I1):** the K10/C4/A1-style season gate.

**The load-bearing invariant (pin this):** every hand-tuned run stays
byte-identical. Wander is default-OFF; cycle-0 swamp + cycle-0 Reeds + NG+
cycle-1 with Wander OFF must deep-equal v1.6 tuning/content. The four existing
probes re-run IN BAND UNCHANGED; only `wandpace.mjs` exercises generated
content. `SAVE_VERSION 10→11` (`wanderSeed`) — DONE. Zero new dependencies. One
conventional commit per item.

---

Last verified: 2026-09-07 (v17-2 session). **v1.7 Batch 1 (D1 + D2 + smoke-suite determinism hygiene) COMPLETE.** `node tests/smoke.mjs` = **ALL STAGES PASSED** (now **deterministic** — the harness seeds `Math.random` with a fixed mulberry32, so the I1 "smoke x3" audit gate is fully reproducible). The new stages 95 (D1) + 96 (D2) verify the Wander pure-path + the taste system; the older version-pin stages (M1/G3/K9/R5/Q3/W1) were updated to the current `SAVE_VERSION = 11`. Hand-tuned pacing unchanged: `pace.mjs` ~17.3 min, `humance.mjs` ~18.2 min (15–20 band). `SAVE_VERSION = 11`. **D3 is next (Wander × Reeds cross-run + `tests/wandpace.mjs`).**

Last verified: 2026-09-07. **v1.7 IN PROGRESS — D1 (pure seeded wander
content) + D2 (the Wander "taste") + a hygiene commit landed (sessions v17 /
v17-2). `node tests/smoke.mjs` = ALL SMOKE TESTS PASSED ×3 (now 96 stages:
95 = D1 the pure seeded wander content generator, 96 = D2 the Wander
taste). SAVE_VERSION is now 11 (D1 bumped 10 → 11 for `save.wanderSeed`);
the era-pinned stage asserts (G3 / M1 / K9 / R5 / W1 / Q3) all updated to
11. The pre-existing stage-75 K4 flake is PINNED (harness Math.random is now
a seeded mulberry32 stream, so the whole suite is byte-reproducible; 15/15
flake-check green). Hand-tuned pace 17.3 / humance 18.2 min UNCHANGED
(Wander is OFF by default). Below, the v1.6 COMPLETE note. ---... [truncated]

**v1.3 M14 N1 (NG+ unlock + Next Expedition flow) — implemented + tested (2026-09-06, Batch 7, item 1).** `SAVE_VERSION` 3→4 with a `SAVE_MIGRATIONS` v3→v4 step + `normalizeNGCycle` (a v3 save with no `ngCycle` loads as `ngCycle: 0`, unchanged, no NG+ UI visible). A flat `save.ngCycle` field (0 = first-time player) persists the New Game+ cycle. `ngUnlocked(save)` (pure, `stats.victories > 0`) gates all NG+ UI. A "Next Expedition (New Game+)" button appears on the **title** (shared slot with the fresh-save-only guided button — they never coexist) and the **end screen** (slotted between "Rest at the Atelier" and "Return to the Pond") **only when a victory is recorded**; a returning first-time player (ngCycle 0) sees ZERO new UI. Choosing it (`_beginNextExpedition()`) advances `save.ngCycle` by 1, persists it, and starts a run that carries `ngCycle` (drives NG+ scaling N2 + boss selection N3). Smoke stage 46 (fresh save shows no NG+ UI; a completed-victory save shows the button; choosing it starts a run with `ngCycle 1`, persisted on disk at saveVersion 4 + round-trips through the loader; a first-time save cannot accidentally advance). **Suite now 48/48 (with N2+N3). First-time pacing unchanged (N1 adds no timed-run time — NG+ is gated behind a victory).**

**v1.3 M14 N2 (NG+ scaling) — implemented + tested (2026-09-06, Batch 7, item 2).** Pure `ngPlusScaling(cycle)` + `applyNGPlus(t, cycle)` in `logic.js`. Levers are the batch spec's three: **enemy HP / enemy damage / spawn rate** (the heron is deliberately NOT scaled here — N3 swaps in a different NG+ boss instead of bumping the gray heron's fixed 30k). Cycle 0 = all-ones: `applyNGPlus` is a no-op and is only called from `_beginExpedition` when `ngCycle >= 1`, so a first-time run's tuning is byte-identical to pre-NG+ (smoke asserts a cycle-0 run's tuning deep-equals a plain `makeTuning`). Modest cycle-1: **+30% enemy HP / +15% enemy dmg / +10% spawn rate** (beetle 36→47 HP, 6→6.9 dmg). Growth is **capped at cycle 3** (NG_CAP_CYCLE; cycle 4 and beyond hold the cycle-3 row) so escalation is a deliberate step-up, not an unbounded spiral. Wiring: `enemies.js` `spawnEnemy` now applies `tuning.enemyDmg` to `e.dmg` (alongside the existing `enemyHp`); `_spawnWave` divides the spawn interval + floor by `tuning.spawnRate` (== 1.0 on cycle 0 → byte-identical). **`tests/ngpace.mjs`** (new, modeled on humance.mjs) measures a competent-returning-human NG+ cycle-1 run on the real NG+ sim (measured cross-walk + heron fight, analytic wave leg scaled by the NG+ HP × returner-efficiency) and lands **18.4–19.2 min across seeds** (15–20 band ✅). Balance entry: no tuning overshoot — cycle-1 landed in-band on the first pass, so no multiplier re-tuning was needed. **Suite now 48/48. First-time pacing unchanged (pace.mjs ~18.8 / humance.mjs ~19.0, both 15–20).**

**v1.3 M14 N3 (Second boss — The Great Green Heron) — implemented + tested (2026-09-06, Batch 7, item 3).** A NEW final boss that appears on NG+ cycles (`ngCycle >= 1`) **instead of** the Great Gray Heron (the gray heron stays the first-time boss). `_beginExpedition` spawns it from `GREEN_HERON` (logic.js): **36k HP** (+20% over the gray's fixed 30k — the heron is deliberately NOT N2-scaled, so the fight stays in the same time band), the SAME 3-hue awaken rhythm (`awakenNeed {45,45,45}`), and a `kind:'green'`/`green` flag for the distinct palette. It reuses the existing heron AI end-to-end (`bossStep` / `paintBossHit` / `paintBoss` — no new AI); the ONLY new mechanic is a pure `greenHeronPinTick(h, dt)`: painting it with **Moss** accumulates `h.pinCharge`, and at `GREEN_HERON.pinNeed` (30 = ~5 swipes) it sets `h.pinned = pinDuration` (3s) — **painted reeds pin it in place** (the E1 reed-pin idea at boss scale). While pinned, `_updateBoss` skips its attacks (held in place) and it takes **2× paint damage** (the vulnerable window, mirroring the awaken window — a small buff that offsets the +20% HP and keeps the fight close to the gray heron's). The green heron carries a distinct **moss-green palette** in `_drawHeron` + a reed-pin visual; the gray heron keeps the original colors byte-identically (its `green`/`pinned` are `undefined`). **Fight time (bosspace-style reasoning):** gray heron ≈ 37s bot / ~2.2 min human (30k ÷ 201 HP/s); the green heron ≈ 36.8s×1.2 = 44s bot / **~2.7 min human** (36k ÷ 201 HP/s) — a similar time band. `ngpace.mjs`'s boss leg is now **analytic** (bosspace-style: HP ÷ human DPS), not a real-sim bot fight (which is bimodal/flaky on the 36k heron), so the NG+ cycle-1 estimate is stable at **~19.5 min** (15–20 band ✅). Smoke stage 48: gray-vs-green selection, the pin engages/holds-in-place/2×/decays, and the green heron is damaged/awakened/defeated → victory → atelier with NG+ progression intact (ngCycle preserved, victories recorded). **Suite now 48/48. First-time pacing unchanged (pace.mjs ~18.6 / humance.mjs ~19.1, both 15–20).**

**v1.3 M14 N4 (Player-chosen expedition modifiers) — implemented + tested (2026-09-06, Batch 8, item 1).** Three hand-tuned, **data-driven** modifiers the player picks ONE of at the "Next Expedition" prompt on NG+ runs; a first-time (cycle 0) player never sees the prompt. `MODIFIERS` table in `logic.js` (`id -> {name, desc, apply(t)}`), exported alongside `MODIFIER_ORDER` + a pure `applyModifier(t, id)`. The three, feeding EXISTING tuning/spawn/render paths only (no new systems): **High Tide** (`waterWidthMult 1.25` widens the world's water + `enemySpeedMult 1.1` makes enemies 10% faster), **Grey Morning** (`satFloor 0.35` desaturates the world render + `contactDmgMult 1.2` raises enemy contact dmg 20%), **Dry Brush Season** (`splashCharge ×1.35` = 35% slower charge + `pickupValue ×1.25` = 25% more orb value). The four new fields are consumed by the existing paths: `enemies.js` `spawnEnemy` multiplies `base.speed`/`base.dmg` by `tuning.enemySpeedMult`/`contactDmgMult` (both default 1), `game.js` `_drawAll` caps `drawSat` at `tuning.satFloor` (expedition-only), and `world.js` `drawBackground` scales ripple/slick radii by `this.waterWidthMult` (handed to the fresh per-run world in `_beginExpedition`). `applyModifier` runs in `_beginExpedition` ONLY when `ngCycle >= 1` (AFTER `applyNGPlus`), so a cycle-0 run's tuning is byte-identical (smoke asserts a cycle-0 tuning deep-equals a plain `makeTuning` + adds no modifier fields). The "Next Expedition" button now OPENS the picker (`_openModPrompt`); the cycle advances only on the picker's **confirm** (`_confirmNextExpedition`), so quitting the prompt leaves the save untouched. Choice persists per cycle via `save.ngModifier` (`SAVE_VERSION` 4→5 + a v4→v5 migration step + `normalizeNGModifier`; a v4 save loads as no-modifier, an unknown id normalizes to null). Smoke stage 49: each modifier is selectable (keys/mouse), mutates tuning exactly as specified (×1.25 water, ×1.1 speed, ×1.2 contact, satFloor 0.35, splash 0.55→0.74, orb ×1.25), the effects reach the spawned enemies (High Tide beetle 40→44 speed, Grey Morning 6.9→8.28 dmg vs a no-modifier NG+ cycle-1 baseline), the picker persists the choice, confirm advances ngCycle 0→1 keeping the modifier, and a v4 save migrates to no-modifier. **Suite now 49/49. First-time pacing unchanged (NG+-gated; cycle 0 untouched).**

**v1.3 M15 G1 (Gold pigment meta economy — core) — implemented + tested (2026-09-06, Batch 8, item 2).** A **new `gold` currency that is META-ONLY**: it is NOT a 4th combat brush color and does NOT feed `makeTuning`/combat (the 3-hue pillar + combat tuning stay byte-identical). Gold is earned **only** from first-time meta achievements, via pure `goldEarn(save, {key, amount}) -> amount` in `logic.js` (with event builders `goldEventBoss(kind)` / `goldEventSynergy(synergy)` / `goldEventOrbs(runOrbs)`), **idempotent per event** via a `save.goldEarned = {[key]:true}` latch so each fires exactly once a career. Events + amounts: first kill of the Great **Gray** Heron (15), first kill of the Great **Green** NG+ Heron (20), first completion of **each** synergy duo (8 × 3 duos = 24), first **100 orbs in a single run** (8) → **67 gold lifetime** (covers both G2 gold paintings at 25 + 40 = 65). `save.gold` (counter) + `save.goldEarned` (map) added by a `SAVE_VERSION` 5→6 migration (a v5 save → gold 0 / `{}`); no death-loss rule (a meta currency isn't dropped on a wipe). Game wiring (`game.js`, thin): `_endRun('victory')` fires the first-kill-of-boss-type + first-synergy-duo events; `_updateOrbs` counts `this.runOrbs` and fires the 100-orb milestone; `_awardGold` centralizes the award (SFX + banner + persist) and is a silent no-op when `goldEarn` returns 0 (repeat call / unmet milestone). The atelier bank strip shows gold as a distinct **gold dot** (a display, not a pigment). **Suite now 50/50. First-time pacing unchanged (gold is META-ONLY — it adds no timed-run time; `pace.mjs` ~18.5 / `humance.mjs` 16.7 / `ngpace.mjs` cycle-1 ~19.5, all in the 15–20 band).**

**v1.3 M15 G3 (Gilded Frame — one-time NG+ prestige tier) — implemented + tested (2026-09-06, Batch 9, item 1).** A **ONE-TIME, permanent, saved** option to spend **50 gold** on a *Gilded Frame* — a prestige tier ON TOP OF the existing Rehung-Frame `galleryBonus`, stored in a **SEPARATE field `save.gildedFrame`** (NOT a `galleryBonus` level, so it stacks distinctively). `makeTuning` gains a `gilded` param (defaults `false`, applied **AFTER** `applyGalleryBonus`): **`+3 start ink of each color` + `+15% orb value`** (via `GILDED_FRAME = {cost:50, ink:3, orbMult:1.15}`), so it STACKS with Rehung Frame (Rehung level 2 + Gilded = `+7` ink / `1.38×` orb). **NG+/gold-gated** (`canBuyGildedFrame`: `ngCycle >= 1 AND save.gold >= 50`): a cycle-0 player can never buy it, so **cycle-0 tuning stays byte-identical** (a fresh save owns no gilded frame → `gilded` defaults false, the `gildedInkBonus`/`gildedOrbMult` keys are absent; cycle-0 tuning fingerprint verified unchanged). One-time + pure: `isGilded(save)` / `canBuyGildedFrame(save)` / `buyGildedFrame(save)` in `logic.js` (the buy sets the flag, deducts gold, and is refused on repeat). `SAVE_VERSION 6→7` with a `SAVE_MIGRATIONS` step + `normalizeGildedFrame` (legacy v6 saves → `gildedFrame: false`, no error; a v6 save that WAS gilded keeps the flag). Presented in the **Curator's Ledger** (tab 3) as a gilded bar above the Rehung-Frame bar with a state-aware gild button (`Gild · 50g` / `NG+ needed` / `Gilded`). Smoke stage 52 (fresh=no effect; post-buy=bump; save/load persists; STACKS with galleryBonus; gold deducted + not repeatable; old-format migration; Ledger bar + state-aware button drawn). **Suite now 52/52. First-time pacing + cycle-0 tuning byte-identical (verified).**

**v1.3 M15 G4 (Gold UI + ledger completion — presentation polish) — implemented + tested (2026-09-06, Batch 9, item 2).** Pure **UI/data reuse** of the gold economy's presentation — **NO new mechanics, NO new persistent state, NO `makeTuning` change** (so cycle-0 tuning stays byte-identical). (a) A **gold BALANCE READOUT** — a new `_goldReadout()` helper returning `{gold, text}` (a pure read of `save.gold` + `ngCycle` + `isGilded`) with a state-aware hint of what the gold buys: a fresh save → "a meta pigment — earned from boss defeats, first synergies & the 100-orb run (spent in NG+ only)"; an NG+ save with ≥ 50g → "spend 50g in the Curator's Ledger to hang the Gilded Frame (+3 ink · +15% orb)"; a gilded save → "the Gilded Frame is hung — it is forever yours". It renders on the **atelier header** (a line between the subtitle and the bank strip, with a gold dot; the bank strip moves 96→104) AND on the **Next Expedition prompt** (below the "Swim On" button). (b) The **gold-tier Curator's Ledger rows** now show their **gold price + owned state distinctly** (unowned → `"<cost>g · NG+ only"` in gold ink, replacing the old "not yet gold" tag; owned → the existing `collected` / `★ hung in the loadout` state) alongside the G2 gilded thumbnail frame + "◆ GOLD" tag. (c) A short **gold LEGEND line** on the Curator's Ledger tab explains what gold is + where it comes from. Also removed a G3 leftover bug: a DUPLICATE Gilded-Frame bar (two `paperPanel`s at the same `ch-248` rect, seeds 502 + 521) that overlapped the real one. Smoke stage 53 (headless `fillText`-recording: the gold balance renders in the header (NG+ + fresh-save variants) and the Next Expedition prompt (with the 50g / Gilded-Frame hint); the gold-tier ledger rows show price + owned state; the gold legend line is drawn). **Suite now 53/53. First-time pacing + cycle-0 tuning byte-identical (G4 is presentation-only — verified).**

**v1.3 M16 C1 (Atelier one-liner batch 2 — NG+ reactions) — implemented + tested (2026-09-06, Batch 9, item 3).** A **SECOND, NG+-context line pool** (`ng`) per A1 resident (Mabel / Giuseppe / Monet, 3 lines each = 9 new one-liners) drawn **ONLY when `ngCycle >= 1`** (a returning expedition). Mabel reacts to the gold piling up / the Gilded Frame; Giuseppe reacts to a high `ngCycle` (a tally, climbing prices, the gold shelf); Monet comments on the gilded frame / a second-campaign collection. Reuses the **EXACT A1 machinery**: a new `ng` context slot added to the `_pickAtelierSay` priority chain (just-made-purchase > **ng** > last-finished-run result > best-run > general), with the same rotating pools, no-repeat-last, typewriter reveal — and **NO new persistent state** (a plain `save.ngCycle` read; the pool data lives in `game.js`). Smoke stage 54 (an NG+ save gets NG+-pool lines distinct from the cycle-0 pools; rotation/no-repeat-last holds in the NG+ pool; a purchase during NG+ still wins over the ng context; the typewriter starts fresh; an NG+ atelier visit persists nothing new). **Suite now 54/54. First-time pacing + cycle-0 tuning byte-identical (C1 is pure display — no `makeTuning` / save change).**

**v1.3 M16 C2 (Victory "Season" summary block) — implemented + tested (2026-09-06, FINAL Batch 4, item 1).** The **victory end screen** gains a compact **"Season" summary** for the NG+ season a victory belongs to, placed in the V4 card's **existing empty bottom band** (the 540px victory card's spend hint ends at py+420; the block draws at py+450…py+508, so **nothing below it moves** — the end-screen buttons, driven by `_endButtons`, keep their exact rects, verified by smoke). It shows: the current **NG+ cycle**, the **modifier** chosen for the cycle (name via `saveModifier(save)` / `MODIFIERS`, or "none"), **gold earned this expedition** (the delta since run start — `runGold` captured in `_beginExpedition`, in-run only, **never persisted** — with a fallback of the full total if no run started) + the **career gold total** (`save.gold`), the **Gilded Frame** state ("hung" / "not yet" via `isGilded(save)`), and the **paintings carried this expedition** (the 2-slot loadout, named). A thin pure `_seasonSummary()` read of the run + save; drawn **ONLY on a victory** (victory-only, like the V4 exhibition) and reusing the V4 card layout (`centerText` on the panel context). **No new persistence, no `makeTuning` change** → cycle-0 tuning + first-time pacing byte-identical; a first-time (cycle 0) victory sees the block with its own values (cycle 0 · modifier none · Gilded Frame not yet · gold +0/0 · its carried painting). Smoke stage 55 (headless `fillText`-recording: representative NG+ save renders cycle 2 / High Tide / +17 earned / 70 total / Frame hung / both carried paintings; first-time save renders cycle 0 / none / not yet / 0/0 / 1 painting; absent on a defeat; card height 540 + primary button rect unchanged; the end screen persists nothing new). **Suite now 55/55. First-time pacing + cycle-0 tuning byte-identical (C2 is pure display).**

**v1.3 M16 C3 (Paper-grain presentation toggle) — implemented + tested (2026-09-06, FINAL Batch 4, item 2).** An **options toggle (default OFF)** overlays a subtle **PROCEDURAL paper-grain** texture on the canvas — **NO image assets, NO scanlines/CRT** (explicitly excluded: they fight the watercolor identity). It is synthesized as a **CACHED offscreen tile** of low-opacity noise speckles at **two grain scales** (a fine 128px tile of ~220 faint speckles + a coarse 64px tile of ~46, for variation), turned into `createPattern` 'repeat' patterns and drawn **LAST in the render loop** (after the vignette) at low alpha (0.6 / 0.4) so it sits over every screen. **Wired into the existing P9 options machinery**: a FOURTH toggle row ("Paper grain") added to `_optionsLayout` (the panel grew 380→424; the back button stays anchored to the panel bottom, so its rect moves down with the taller panel — no hard panel-height assertions exist, only positive-width checks), `_toggleOpt('grain')` mouse routing (before the back button, after the vignette row), and a `_drawToggle` row in `_drawOptions`. The toggle **persists** through the existing options save (`_toggleOpt` → `SaveSys.saveOptions`). **Old options migrate without error**: `logic.freshOptions()` defaults `grain: false` and `migrateOptions` sets `o.grain = !!raw.grain` — a legacy blob (no `grain` field) migrates to OFF (presentation unchanged for returning players); only an explicit `true` turns it on. **Headless-safe**: `_drawGrain` is a no-op while the option is off; `_buildGrain` builds the two tiles once per Game and caches them on `this._grain` (the per-frame cost is two pattern fills, no per-frame allocation); a falsy `createPattern` (stubs / unsupported contexts) is skipped cleanly. Smoke stage 56 (grain defaults OFF; a legacy options blob (no `grain` field) migrates to OFF without error; an explicit `grain:true` is honored; a fresh Game loads OFF; the overlay is NOT built/drawn while OFF; it IS built (fine+coarse tiles, both patterns created) + drawn when ON; the tiles are CACHED (built once, not rebuilt per frame); the toggle row is clickable, persists to the options blob, and the grain re-skips when toggled back off). **Suite now 56/56. No tuning / save-schema change → cycle-0 tuning + first-time pacing byte-identical (C3 is pure presentation; the grain defaults OFF, so a first-time player's render is unchanged).**

---

### v1.3 SEASON AUDIT (2026-09-06 — C4 final regression + audit)

v1.3 "The Second Expedition" is **COMPLETE**. Full-suite regression, all probes in band, cycle-0 byte-identity re-verified, zero new dependencies, tree clean.

**Full suite (C4):** `smoke.mjs` **56/56 stages, green 3× consecutive** · `pace.mjs` first-time **~18.5 min** (15–20 band ✅) · `humance.mjs` **18.4 min** (15–20 band ✅) · `ngpace.mjs` NG+ cycle-1 **19.5 min** (15–20 band ✅) · `bosspace.mjs` gray-heron analytic 36.8s (~1.0 min human).

**Cycle-0 byte-identity (re-verified):** `makeTuning` output for 27 input combos is **byte-identical** across v1.2 (`08b954a`) → HEAD (JSON compare of the full tuning object per input; `makeTuning(upgrades, loadout, difficulty, gallery[, owned, gilded])` — v1.2 used the 4-arg form).

**Zero new dependencies (since v1.2-complete `08b954a`):** `git diff 08b954a..HEAD` shows no `package.json` / lockfile changes; `grep` for new `require(`/`import ... from '` external-module lines across all `src/` + `tests/` changes since `08b954a` is **clean** (only relative `./` imports). **Tree clean.**

**Milestones (all ✅):**

| Milestone | Items | Status |
|---|---|---|
| M14 — NG+ as a designed loop | N1 unlock+flow · N2 `ngPlusScaling` · N3 Great Green Heron · N4 expedition modifiers | ✅ |
| M15 — Gold pigment meta economy | G1 gold units (`goldEarn`, `save.gold`) · G2 2 gold-tier paintings · G3 Gilded Frame · G4 gold UI+ledger | ✅ |
| M16 — Season wrap | C1 atelier one-liner batch 2 · C2 victory "Season" summary · C3 paper-grain toggle · C4 regression+audit | ✅ |

**Invariants held (unchanged through v1.3):** zero dependencies · loopback-only · pure rules in `logic.js` · 15–20 min per applicable run (first-time + NG+ cycle-1 verified) · ≤ 220 particles · no per-frame hot-path allocations (grain tiles cached) · smoke suite green after every commit · one conventional commit per item · save schema migrated (v3 → v7, no data loss).

**Save schema:** v7 (`save.ngCycle` v4 · `save.ngModifier` v5 · `save.gold`+`goldEarned` v6 · `save.gildedFrame` v7). Options gain a `grain` field (default OFF) via `migrateOptions` (legacy blobs → OFF, no error).

**v1.3 commit list (since v1.2-complete `08b954a`):**

| Commit | Item |
|---|---|
| `58d5524` | M14 N1 — NG+ unlock + Next Expedition flow |
| `e201284` | M14 N2 — NG+ scaling + `tests/ngpace.mjs` probe |
| `077d2d2` | M14 N3 — second boss: The Great Green Heron |
| `fc53e47` | M14 N4 — player-chosen expedition modifiers |
| `b8a9095` | M15 G1 — gold pigment meta economy (core) |
| `bb41fd1` | M15 G2 — two gold-tier paintings (catalog 8→10) |
| `cd63947` | M15 G3 — Gilded Frame (one-time NG+ prestige tier) |
| `d173588` | M15 G4 — gold UI + ledger completion |
| `4c9d7f6` | M16 C1 — atelier one-liner batch 2 (NG+ reactions) |
| `1a0eecd` | M16 C2 — victory "Season" summary block |
| `1fa85a6` | M16 C3 — paper-grain presentation toggle |

(Plus the two docs-only v1.3 setup commits `431285e` roadmap draft + `99d8513` approval, and this `docs: v1.3 complete` audit commit.)

**Next season (v1.4 "Make It Amazing") — APPROVED and executing (2026-09-06):** theme + 14 items (J1–J5 juice, L1–L3 presence, S1–S3 audio, M1–M3 moments) + fixed batch order + deferred list in `docs/ROADMAP.md` §v1.4; see Immediate Next Action above.

---

**v1.3 M15 G2 (Two gold-tier paintings — catalog 8→10) — implemented + tested (2026-09-06, Batch 8, item 3).** Two **gold-tier** paintings join the `PAINTINGS` catalog (8 → 10), flagged `goldTier: true` + `goldCost` (priced in **GOLD**, not pigment — no pigment `cost`): **Gilded Meridian** (+10% all orb value, permanently; `pickupValue ×1.1`) at **25 gold** and **Verdant Crown** (+1 green heal, `greenHeal +1`) at **40 gold**. `makeTuning` gains an `owned` param: when a gold painting is owned it applies via the EXISTING `pickupValue`/`greenHeal` fields (a permanent meta bonus, NOT a 2-slot loadout entry — the two slots stay pigment-only). Purchased from the atelier's existing flow via a new `_buyGoldPainting` (gold-denominated, **NG+-gated** — refused at `ngCycle < 1`), with `canAffordGold(save, pt)` in `logic.js`. A first-time (cycle-0) player never sees a buy affordance: the Paintings tab shows an **NG+-only / locked** state (button disabled, "NG+ only" label), and `_buyGoldPainting` refuses at cycle 0. The Paintings tab grid is compacted (2×5, `cardH` 112→90) to fit 10; the Gallery wall is 5×2 and the **Curator's Ledger** is 2×5, listing **all 10** with a gilded "◆ GOLD" tag on the gold-tier entries (unowned gold read "not yet gold"). `canRetireCollection` still keys to the 8 PIGMENT paintings (`filter(!goldTier)`), so the M9 Rehung-Frame bar is unchanged. **Suite now 51/51. First-time pacing + tuning byte-identical (a cycle-0 save owns no gold paintings; verified `pace.mjs` ~18.8 / `humance.mjs` 18.7 / `ngpace.mjs` cycle-1 ~19.5, all in band).**

## Current Status

Frogue Gallery is a **balanced, feature-complete cozy action roguelite** — the full Definition of Done is satisfied (M1–M6, final sweep done):

- **Core fantasy**: paint with 3 pigments (red damages, blue slows/freezes, green heals/restores world color). Every stroke literally restores color to the swamp.
- **Run loop** (verified by smoke test): title → expedition (waves, swipe + charged-splash combat, orb collection) → boss (Great Gray Heron: 3-hue awaken cycle, 2× paint damage while shimmering) → victory/defeat end screen → **Atelier** (shop) → next run.
- **Between-run economy** (M2): bank pigments, 9 upgrades, 8 paintings (2-slot loadout), persisted via localStorage.
- **Balance** (M3 + P4 + P5): 10 HP frog, ~2-hits-to-kill enemies, heron 30000 HP (~2.3 min human fight, ~37s ceiling bot), green heal 3 HP/paint-tick on thick moss (P4: maxHp 7→10, beetle/toad contact dmg 8/9→6 — before P4 a single beetle hit *one-shot* a first-time player at 7 HP before they learned green heals).
- **Run structure** (P5, DoD #9): world 5400px (was 2400), heron at the world edge, **4 named expedition zones** (Reed Flats → Slick Hollow → Bramble Thicket → The Gray Shore) each with an entry banner, a staged combat beat, and a rest checkpoint (green heal pool + orbs). Pacing: lower-bound (god-mode) 1.3 min; competent player ≈ 17 min — inside the 15–20 min target. Probes: `tests/pace.mjs` (lower-bound + human model) and `tests/bosspace.mjs` (real pigment-cycling bot fight).
- **Meta/charm** (M4): best-run record (title + end screens), M-mute (persisted), **Croaksworth story beat** (portrait unseals after first victory; buying it triggers his thanks + silver coin +5/each pigment).
- **Pause** (P/Esc) works; audio unlock on first gesture; banners for story beats.
- **New-player guidance** (P1): staged 5-step first-run tutorial (one banner at a time, timed), one-time contextual tips (first hit / first orb / first atelier / first defeat), pigment roles stated on the title card, banners render on all screens.

## File Map (all under `frogue-gallery/`)

| File | Role |
|---|---|
| `index.html` | Canvas 1280×800, boot: `new Game(canvas).start()` |
| `src/game.js` (~1500 lines) | **The orchestrator.** State machine (title/expedition/atelier/end/pause), rAF loop, camera, HUD, boss dir, atelier UI, end/title screens, M4 meta features |
| `src/logic.js` | Pure game logic: tuning, UPGRADES, PAINTINGS, bossStep, bankGain, paintDamage (2× awakened), canAfford/payCost/costArray |
| `src/world.js` | Procedural swamp (5400px, density scales with width), splats, fire/reed growth, `restoreColor()`, lily-pad corridor + rest spots |
| `src/paint.js` | Brush: swipe fan, charged splash, `_bossPaint` (2× while awakened), restoreAcc |
| `src/player.js` | Frog: hop, iframes, green-heal tick (3× greenHeal), satchel stock (cosmetic) |
| `src/enemies.js` | beetle / mosquito / toad spawners + AI |
| `src/input.js` | Keys (kb/pressed), mouse→world via `setView` |
| `src/audio.js` | WebAudio synth SFX, `setMuted`/`setVolume` |
| `src/particles.js`, `src/ui.js`, `src/math.js` | FX, paper-UI helpers, math |
| `src/save.js` | SaveSys: save/options (localStorage, try/catch) |
| `tests/smoke.mjs` | **Headless runtime test — 48 stages, all passing.** Real `Game` class, stubbed canvas/localStorage/AudioContext, synthetic keys/mouse |
| `tests/pace.mjs`, `tests/bosspace.mjs`, `tests/humance.mjs`, `tests/ngpace.mjs` | **Pacing probes (informational, not assertions).** pace.mjs = analytic lower-bound + human model; bosspace.mjs = real pigment-cycling bot heron fight; humance.mjs (P11) = simulated imperfect human on the real sim (measured cross + boss); ngpace.mjs (v1.3 N2/N3) = simulated NG+ cycle-1 run: measured real-sim cross-walk + analytic bosspace-style boss leg (the Great Green Heron on cycle ≥1) + analytic wave leg scaled by the NG+ enemy-HP multiplier (its own 15–20 min target) |
| `PROJECT_STATE.md` | This file (recovery memory) |
| `SYSTEM_CHANGES.md`, `CLEANUP.md` | System-change + cleanup records for the final report |

## Architecture Notes (for a fresh session)

- **Camera contract**: `view = {x, y, scale, w, h}`; `x,y` = world coords of screen TOP-LEFT. `input.update()` converts mouse screen px → world via `mouse.x / v.scale + v.x`.
- **`game.js` orchestrates everything**; 12 subsystem modules are stable. Don't restructure.
- **Atelier layout = single source of truth**: `_atelierGeom()` feeds both `_drawAtelier` and `_atelierRows()` (click map with `tag` fields: `tab0/1`, `buy:<id>`, `paint:<id>`, `hang:<id>`, `depart`, `leave`). If you change layout, change `_atelierGeom` only.
- **`_ptLocked(pt)`**: Croaksworth portrait sealed until `flags.heronDefeated`. All atelier lock checks route through it.
- **Best run** (`save.bestRun = {pigments, time, cleared}`): cleared victory with more pigments beats everything; else longer un-cleared run.
- **Mute**: `game._muteToggle()` — M key on title + end; persisted via `SaveSys.saveOptions`.
- **`bossStep`** (logic.js) is a pure state machine; game.js consumes its events (`sweep`, `slam`, `landing`, `lunge-start`, `summon`, `phase2/3`, `defeated`). It MUST run even at `hp <= 0` so `defeated` can fire.
- **Test harness**: `tests/smoke.mjs` — `fireKey` is a proper tap (keydown+keyup); `fireMouse` dispatches mousedown/mouseup on the canvas stub. Enemies get pinned/cleared between stages to isolate assertions.
- **Verification channels**: `node tests/smoke.mjs` (authoritative) + `node --check`. `browser_exec` is dead (Chrome popup never surfaced); `desktop_preview` exists but the canvas has no accessible elements for visual driving.
- **Environment**: Node v22, Python 3.11.16, Windows 11, git-bash. Personal PC — no elevation, nothing outside `frogue-gallery/`.
- **Patching gotcha**: the `patch` tool's fuzzy matcher has mangled indentation in `game.js` several times — always `node --check` after, and for multi-line structural edits prefer the Python-splice pattern (write a .py that asserts `s.count(old) == 1` then `s.replace(old, new, 1)`).

## Milestones

- **M1** ✅ Playable vertical slice (orchestrator, HUD, boss, smoke test) — commit `4fa45d9`+
- **M2** ✅ Atelier between-run economy — committed
- **M3** ✅ Balance pass (2× awakened, HP/dmg rebalance, 1600 HP boss) — committed
- **M4** ✅ Croaksworth story beat + best-run tracking + M-mute — committed
- **M5** ✅ Polish: low-HP vignette (pulsing red at ≤2 HP), real pause menu (Resume / Quit buttons + M-mute; pause input now lives in the frame router since `_updateExpedition` is skipped while paused), first-run intro banners (`flags.intro`), dead HUD code removed
- **M6** ✅ Final Definition-of-Done sweep + erase-save UI (two-click confirm, title bottom-left) + final report
- **Post-M6** ✅ Shape fix: paper panels/buttons were drawn as giant wobbly *circles* (`traceBlob` radius `max(w,h)·0.62`) — now `traceWobblyRect` (math.js); button labels centered. Fixed the title-screen overlap.
- **Post-M6 (P1)** ✅ New-player guidance: staged first-run tutorial (5 timed single-step banners), one-time contextual teaching banners (first hit, first orb, first atelier visit, first defeat, heron-reveal wording), improved title-card rows (pigment roles explicit), banners now render on every screen (was expedition/end only — title "save erased" banner was invisible), first-run heron reveal delayed to 6.5s. New save flags: `firstOrb/firstHurt/firstAtelier/firstDefeat` (merged via `migrateSave`).
- **Post-M6 (P2)** ✅ Juice: floating pigment-colored damage numbers on every paint hit (enemies + heron, showing true 2× awakened values), orb-pickup "+N" text, off-screen enemy edge arrows (tinted when the enemy is currently painted; heron keeps its own arrow), note cap 14→24.
- **Post-M6 (P3)** ✅ Atelier onboarding: first-visit "Welcome to the Atelier" paper panel (gated by `firstAtelier`, any tab/buy/action dismisses it, drawn above the shelves), persistent one-line legends under each tab (upgrades = permanent training paid in pigments; paintings = buy once, hang up to 2, real passives).
- **Post-M6 (P4)** ✅ Balance re-pass for the now-taught first-time player: maxHp 7→10, beetle/toad contact dmg 8/9→6 (no more one-shot by the first beetle), greenHeal 1→3 per paint tick (meaningful early, still slow vs a full pool).
- **Post-M6 (P5)** ✅ Run pacing (DoD #9): world widened 2400→5400px (decoration density scales with width, pads cover the full corridor, heron relocated to `world.w - 350`); 4 named expedition zones with entry banners, staged combat beats (escalating beetle→mosquito→toad compositions), and rest checkpoints (thick green heal paint + pigment orbs); bossMaxHp 2200→30000 so the heron is a real fight (~2.3 min human, ~37s ceiling bot). Two headless pacing probes added (`pace.mjs`, `bosspace.mjs`); smoke stage 14 (14 stages total).
- **Next / status**: **Definition of Done (all 12 items) satisfied** as of the final audit sweep — boot (#1, HTTP 200 documented launch), Continue/New Game/Erase (#2, title affordance + two-click erase + auto-load), loop (#3), responsiveness (#4), pigment roles (#5), 3 enemy archetypes (#6), paintings loadout (#7), heron flows (#8), 15–20 min pacing (#9, pace.mjs), polish pass (#10, M5+P2), migration/logic tests (#11, stage 15), docs (#12). Original goal complete; project now runs on the **v1.1 plan** below.

## v1.1 Plan — Improvements & bug fixes (active, 2026-09-05)

Full spec lives in `MISSION.md` ("Post-release v1.1"). Working order:

**Track B first (cheap, de-risks everything), then Track A in order.**

| ID | Item | Status |
|---|---|---|
| B1 | Commit the uncommitted release-sweep work (game.js start-button fix, smoke stages 15–16, doc corrections) | ✅ 2026-09-05 — two commits (`fix: DoD #2 title affordance...`, `docs: v1.1 plan...`), tree clean |
| B2 | Corrupt-save handling: detect on load, "keep what we can" vs "start fresh", never crash boot | ✅ 2026-09-05 — commit `14b50a3`: `migrateSave` merges recognizable fields (bank/owned/loadout/upgrades/flags/stats/bestRun) into a fresh schema, coerces/clips numbers, filters unknown painting ids; non-object or unrecognizable → pure fresh; unparseable → null (fresh boot). `_case` tag (migrated\|fresh) non-enumerable, never persisted. Smoke stage 17 (17 stages total). PM-verified: diff + full suite green. |
| B3 | Dry-brush softlock audit: prove a pigment-starved frog can still beat the heron | ✅ 2026-09-05 — commit `a32a721`: audit proves no softlock (dry never damages the heron by design; in-run wet pigment is unlimited; 30k-HP heron falls in bounded ~84 awaken cycles; heron damage-locked states are transient). Regression guard in smoke stage 17 (fails if a wet pigment goes to 0 dmg or awaken becomes unreachable). PM-verified: code claims confirmed + suite green. |
| B4 | Tab-hidden time spike: verify dt cap / pause behavior on long hidden-tab gaps | ✅ 2026-09-05 — commit `2ed1c9a`: dt cap (0.05s) holds; `last = t` uses the real timestamp so no catch-up spiral; all physics integrates on clamped dt (absolute `now` only for animation/status/UI timing). Smoke stage 18 injects a 300,000ms delta: wall clock jumps 30s, player/enemy motion bounded to one frame, no NaN, clean recovery. PM-verified. |
| B5 | Storage-failure fallback: localStorage unavailable → in-memory + one-time notice | ✅ 2026-09-05 — `src/save.js` in-memory fallback + `SaveSys.storageOK`; one-time banner in `game.js _beginExpedition`; smoke stage 20 (throwing localStorage). PM-verified. |
| B6 | Save schema versioning: `saveVersion` field on every write + migration chain + smoke stage | ✅ 2026-09-05 — commit `599a599`: `logic.js` `SAVE_VERSION = 1`, saves stamped `saveVersion` (legacy `v` field read + re-stamped on load), `SAVE_MIGRATIONS` ordered chain for future schema bumps. Smoke stage 19. PM-verified: diff + full suite green. |
| PT1 | Painting consumption: verify paint effects consume cost/rate (fix if free) | ✅ 2026-09-05 — audit: swipe/splash already rate-gated (swipeCd 0.2s, splash needs charge + 0.9s cd); in-run wet pigment unlimited by design (B3). No code change; regression guard added as smoke stage 21. |
| PT2 | Onboarding: tighten/clarify first-run flow | ✅ 2026-09-05 — first-run heron reveal deferred 6.5s → 38s so it lands after the 5-step tutorial (was mid-lesson); returning players unchanged (3.2s). Verified via headless `onb` scenario. |
| PT3 | Fly/dodge fairness: audit cost/range/stamina + rebalance | ✅ 2026-09-05 — Space-hop now has a `hopCooldown = 0.7s` stamina gate (was unlimited; i-frames 0.30s > 0.22s hop = near-continuous invuln when mashing). Hop i-frames/range unchanged. Smoke stage 22. |
| PT4 | Early-economy safety net: fresh save can afford ≥1 upgrade/painting | ✅ 2026-09-05 — one-time `WELCOME_GRANT = {red:3, blue:6, green:4}` (+13) on first expedition (pure `applyWelcomeGrant`, gated on `flags.welcomeGranted`). Fresh save now buys capacity/vitality lvl1 + moonlit-pond/self-portrait. Smoke stage 23. |
| P6 | In-game "?" reference overlay (pigment roles, counterplay, heron hint, controls) | ✅ 2026-09-05 — "Field Guide" overlay, H/? to toggle; pauses the run (frozen sim, verified: held W does not move the frog). Controls + keyed pigment swatches + Splash + heron telegraph counterplay; shared `_helpGeom()` for draw + click; fresh runs start closed. Smoke stage 28. |
| P7 | Difficulty select (Gentle/Normal/Bold, persisted; Normal = current balance) | ✅ 2026-09-05 — `logic.js` `applyDifficulty()` + `DIFFICULTIES` (Gentle 0.75× boss/dmg, Bold 1.35× boss/enemy/dmg, Normal identity); `options.difficulty` persisted; three pills on the title (G/N/B keys + click). |
| P8 | The Gallery Wall — framed, titled owned paintings in the Atelier with passive tooltips | ✅ 2026-09-05 — third Atelier tab "The Gallery" (key 3 / click): every painting hung in a gold frame; owned = lit full-color motif + title placard + passive bonus + "★ hung" when in loadout, unowned = dimmed silhouette, sealed = "???". Display-only (buying/hanging stays on the Paintings tab). Smoke stage 27. |
| P9 | Audio/options polish: separate music/SFX sliders, screen-shake + vignette toggles | ✅ 2026-09-05 — `logic.js` `freshOptions`/`migrateOptions` now carry `musicVol`/`sfxVol` (0..1, clamped; legacy `volume` seeds them) + `shake`/`vignette` toggles. `audio.js` splits the graph into `musicBus` (a new synthesized ambient bed: detuned-pair drone + slow LFO + filtered swish pad) and `sfxBus` (all SFX); `setMusicVolume`/`setSfxVolume` drive the buses independently. `game.js` adds an **Options overlay** (title, `O` or the "Options" button): master/music/SFX sliders (drag or click) + shake & vignette toggles + a live "Music/SFX off" note, all persisted via `SaveSys.saveOptions`. `input.js` gains a `dragging` slot for the sliders. Smoke stage 29 (layout, setters→bus gains, toggle round-trip, save→fresh-Game reload). |
| P10 | Performance pass: cull off-screen enemy AI/decoration updates; 60fps with full 5400px world | ✅ 2026-09-05 — `world.js` view-culls grass/ripples/soil/slicks/veg/reeds/pads/obstacles to the visible rect (draw calls 9527 full-world → ~1464 localized, 0.15×); `game.js` skips full enemy AI beyond 500px (burn still ticks). Smoke stage 24 + real-browser probe (60.2 fps across x=5%→95%). |
| P11 | Human-pace pacing probe (`tests/humance.mjs`, simulated human input) | ✅ 2026-09-05 — full-run 18.3–19.4 min across 4 seeds (15–20 min target) |
| P12 | Zone character: distinct visual accent + signature encounter motif per zone | ✅ 2026-09-05 — `game.js` `ZONES` now carry a per-zone `accent` + a `sig` signature encounter; `_zoneBeat` spawns an elite "signature guardian" (`_spawnZoneElite`, `ELITE = {hp:1.9, dmg:1.3, radius:1.35, score:3}`) of the zone's emblematic enemy, ringed in the zone accent (`enemies.js` drawEnemy scales the body to the elite hitbox + draws a pulsing accent halo) and sets a 2.6s fading zone-accent wash (`_drawZoneTint`) so crossing a boundary reads as a place-shift. Accents: Reed `#c9a94e`, Slick `#5a93c9`, Bramble `#7fb069`, Gray `#9a9a8f` (guards: Reed beetle×1, Slick mosquito×2, Bramble toad×1, Gray beetle×2 = 6 total). `pace.mjs` folds the 6 guardians into the human model (~18.7 min, inside target). Smoke stage 25. 60.5 fps real-browser (no JS errors). |

Optional (after all of the above is green): gold pigment, gamepad support, New Game+.

### Balance Log (M7.5 — before → after, 2026-09-05)

Normal-difficulty balance is the baseline; every number that moved is logged.

| Item | Knob | Before | After | Why |
|---|---|---|---|---|
| PT3 | `tuning.hopCooldown` (Space-hop stamina) | *none* (unlimited hops; effective i-frames 0.30s > 0.22s hop) | `0.7s` (≈1.4 hops/s) | Mashing Space chained into near-continuous invulnerability — the reported "unfair fly." A real dodge is preserved; spam is not. |
| PT3 | `tuning.hopIframes` | `0.18` (+0.12 = 0.30 effective) | unchanged | A single hop keeps its dodge value; only the repeat rate changed. |
| PT2 | `heron._intro` (first-run boss reveal) | `6.5s` (mid-tutorial) | `38s` (after 5-step tutorial, ~36s) | Newcomers met the boss before finishing the lesson. Returning players: `3.2s` unchanged. |
| PT4 | Fresh-save bank | `{red:0, blue:0, green:0}` | `{red:3, blue:6, green:4}` (one-time `WELCOME_GRANT`, +13) | Early death kept ~0 (`deathKeepFraction 0.5` floor) → soft-lock at the shop. Grant buys ≥1 upgrade and ≥1 painting. |
| PT1 | swipe/splash rate | `swipeCd 0.2s`, splash charge→`0.9s cd` | unchanged (verified, not free) | "Infinite wet" is the attack *rate* gate, already correct; no change. |

### Balance Log (M8 — before → after, 2026-09-05)

| Item | Knob | Before | After | Why |
|---|---|---|---|---|
| P12 | zone combat beat | named zone beat only (beetle/mosquito/toad `mix`) | + an elite **signature guardian** of the zone's emblematic enemy, `ELITE = {hp:1.9, dmg:1.3, radius:1.35, score:3}` (6 across the run) | v1.1 wanted each zone to have "character." An elite + a per-zone accent wash gives a memorable set-piece without a wall: 1.9× HP is a couple of swipes, and the pace probe still lands inside the 15–20 min target (~18.7 min). |
| P12 | zone entry cue | banner text only | + 2.6s fading full-screen zone-accent wash (`_drawZoneTint`), peak alpha 0.16 | A color shift on crossing a boundary reads as a place-shift, not just a new banner; kept subtle so it never obscures the world. |
| P7 | difficulty select | none (single Normal tuning) | 3 tiers via `applyDifficulty()`: **Gentle** bossHp 0.75 / dmgTaken 0.75, **Normal** identity, **Bold** bossHp 1.35 / enemyHp 1.35 / dmgTaken 1.3. Normal is byte-for-byte the released tuning (boss 30000). | v1.1 asked for an Easy/Normal/Hard select with Normal unchanged. Scaling boss HP + enemy HP + damage-taken (the three levers that change difficulty most, without touching paint/economy) keeps Normal the reference and gives a real range. |

**v1.1 acceptance criteria** (see MISSION.md): every P/B item has a passing smoke stage or regression test; full suite green in one command; 15–20 min run target still holds on Normal; docs accurate; git clean with one conventional commit per chunk.

## Immediate Next Action

**v1.6 "Beneath the Reeds" — COMPLETE (Joel 2026-09-07: "Plan
and execute 1.6" — execution pre-approved; finished 2026-09-07).**
**ALL 13 ITEMS DONE + COMMITTED — R1–R6 (Module R, the Reeds biome) +
W1–W3 (Module W, gamepad) + Q1–Q3 (Module Q, QoL) + A1 (Module A, the
full regression + season audit).** Final smoke **94 stages, green ×3
consecutive**. First-time **pace 17.3 / humance 18.1 min (IN 15–20)**;
NG+ cycle-1 **19.5 min (IN band)**; Reeds run **~22.2 min (IN 20–25)** +
Silt Wyrm **~3.9 min human (IN 2–4)**; P10 culling green; zero new
dependencies (only src/tests/docs/PROJECT_STATE changed since v1.5-complete
`681911c`); SAVE_VERSION 10 migration loads a v1-era save end-to-end;
cycle-0 swamp tuning byte-identical (630-byte `makeTuning` blob, clean diff
vs `681911c`). Tree clean. Full audit table in the A1 row of ROADMAP §v1.6.
13 items in 4 modules (R1–R6 / W1–W3 / Q1–Q3 / A1) in
`docs/ROADMAP.md` §v1.6. Theme: **a new place + a new way to play** — a
**victory-gated** descent into the flooded lower swamp (the same painting,
deeper), whose signature mechanic is **THE LANTERN** (L toggle: light
radius + candle fuel, drains + refills at fireflies/rest spots; darkness
hides enemies AND the player — a real light-state gameplay layer, not a
skin), 3 new light-keyed creatures (Glow Wisp / Mud Serpent / Silt Leech),
flooded lower banks + inverted-gravity pockets, the deferred **4th boss
archetype** (The Silt Wyrm — subterranean, telegraphed surface points,
3-hue awaken through the existing `paintBoss`/`bossStep` path), the
deferred **gamepad** milestone (raw Gamepad API feed into `input.js`,
Auto/Off option, on-screen connection state, mocked-pad smoke stages), 3
small QoL items, and the final full regression + season audit. SAVE_VERSION
9→10 only for R5's `reedsUnlocked` gate flag (+migration +normalizer).

**Fixed batch order** (~3 items each; one conventional commit per item;
smoke stage + P10 re-verify per item; re-run `pace.mjs`/`humance.mjs`
after every in-run item — the biome is victory-gated so first-time MUST
stay 15–20 min; the deferred items folded in are **gamepad** (→ Module W)
and **4th boss archetype** (→ R4)):

1. **BATCH 1 — R1, R2, R5** (the biome shell: THE LANTERN + fuel loop +
   lantern dial HUD; flooded lower banks + inverted-gravity pockets; the
   `reedsUnlocked` victory gate + SAVE_VERSION 9→10 + Field Guide entries
   + first-sight callouts + Reeds one-liners).
   **Progress (2026-09-07): R1 ✅ DONE + committed** (THE LANTERN + Reeds
   biome shell + victory-gated title entry + HUD fuel bar; new smoke
   stage 83, 25 assertions; full suite green; P10
   culling + cached-sprite light invariant green; cycle-0 pace 17.3 /
   humance 18.5 min — IN the 15–20 band, byte-identical). **R2 ✅ DONE +
   committed** (flooded lower banks + 3 inverted-gravity pockets —
   deeper 6000px Reeds layout, pure `inGravityPocket`/`hopLift`/
   `floodedWaterFactor` in logic.js, hop sign-flips to a downward "clump"
   inside a pocket and reverts on exit; the light economy now uses a
   SEPARATE deterministic RNG stream so it no longer perturbs the terrain
   stream; world build is deterministic per seed; new smoke stage 84,
   23 assertions; P10 + stable cached layers green; cycle-0 pace 17.4 /
   humance ~18.4 min — IN band, byte-identical). **R5 ✅ DONE + committed**
   (the Reeds save gate + Field Guide entries: `save.flags.reedsUnlocked` set
   on the FIRST swamp victory — the same place ngUnlocked is set, a defeat
   never sets it — and the title/atelier entry reads it; SAVE_VERSION 9 → 10
   with a `SAVE_MIGRATIONS` v9→v10 step + `normalizeReedsUnlocked` (every
   pre-v1.6 save loads `false` — nobody backfills access; a legacy
   victory-carrying save keeps access via the victory fallback); the P6 Field
   Guide renders the four BENEATH-THE-REEDS placeholder cards — Wisp / Serpent
   / Leech / The Silt Wyrm, with their counterplay notes — ONLY when unlocked
   (a first-time guide is byte-identical; pure `REEDS_CREATURES` display data
   in logic.js; new smoke stage 85, 28 assertions). **BATCH 1 (R1 + R2 + R5)
   COMPLETE** — the Reeds biome shell is in. Next: BATCH 2 (R3, R4, R6 — the
   bestiary + the Silt Wyrm boss + reedspace probe + full-season pacing
   re-verification). First-sight callouts + the Reeds atelier one-liners ship
   with R3/R4. See commit log.
2. **BATCH 2 — R3, R4, R6** (the bestiary: Wisp/Serpent/Leech light-keyed
   behaviors; The Silt Wyrm boss; `tests/reedspace.mjs` probe +
   full-season pacing re-verification + cycle-0 tuning byte-identity).
   **Progress (2026-09-07): R3 ✅ DONE + committed** (the LIGHT-REWRITTEN
   BESTIARY — three Reeds-only archetypes in the `ENEMIES` table, all keyed to
   THE LANTERN's `lightFactor`/`lanternState`, Reeds-mode-only rare picks in the
   bounded spawn cap (a cycle-0 run's `_spawnWave` never enters the branch —
   byte-identical; no new list, count stays bounded). (a) **Glow Wisp**: a slow
   drifting lure that WINDS toward the lantern's light while lit (the attractor
   is the frog, who carries it; random drift unlit); a BLUE SPLASH near it
   BLINDS it (~3s useless spin — pure `wispBlinded()`); nearly invisible unlit
   (draw alpha scales by `lightFactor`). (b) **Mud Serpent**: burrows under the
   water line (invisible + UNHITTABLE while burrowed/recovering — the paint.js
   swipe + splash hit filters skip it in those phases), telegraphs a strike with
   a growing ripple ring at its surface point (~1.2s, the heron-telegraph draw
   language), then surfaces + strikes the lane; a painted RING before it surfaces
   (ANY pigment — `_bestiarySwipe`) interrupts + knocks it back underground with
   a re-cooldown. (c) **Silt Leech**: clings on contact (drains a small HP/sec via
   pure `leechDrain(dt)` fractional accumulation + slows movement 25% — the
   `leechAttached` flag + `Player.leechFactor()` 0.75); comes off when PAINTED
   (any swipe touching the frog — the dry brush's one combat use) OR when the
   player HOPS off (one hop breaks the cling — the `_hopStart` frame); a second
   leech cannot attach for ~6s (the shared `leechCd` window). All rules in
   `logic.js` (`REEDS_BESTIARY` + `wispBlinded` + `leechDrain`); 4 new quiet
   sfx (wisp-blind / serpent-dive / leech-attach / leech-peel); M3-style
   one-shot first-sight callouts for each new creature; new smoke **stage 86,
   41 assertions** (wisp chases-lit / drifts-unlit / blind window; serpent
   burrow→telegraph→surface + painted-ring interrupt + re-cooldown; leech
   attach→drain+slow→paint-off AND hop-off + re-attach cooldown; the draw path
   renders headless without throwing — P10 allocation-safe). First-time
   pace/humance re-verified IN band (Reeds-gated — cycle-0 structurally
   untouched); P10 culling stays green (the serpent's ripple ring is 1 arc + 3
   concentric rings, capped; the wisp/leech are cheap ellipses; no per-frame
   allocation). **R4 ✅ (2026-09-07, v1.6 BATCH 2)** — see the R4 entry below
   (the Silt Wyrm 4th boss archetype). Next: R6 (reedspace probe + season
   audit).
   **Progress (2026-09-07): R4 ✅ DONE + committed** (THE SILT WYRM — the 4th
   boss ARCHETYPE, the deferred item). The end-of-Reeds boss: a SUBTERRANEAN
   creature that moves THROUGH the terrain, surfacing only at 3 TELEGRAPHED
   fixed points on its arena line (a ~1.5s ripple-ring tell before each breach;
   between surfaces it is underground + INVULNERABLE + untargetable and its
   body line slithers beneath — the capped-body-segment slither is the P10
   allocation risk, kept to 14 segments + a single ripple ring). The 3-hue
   awaken STILL applies through the SAME paintBoss/bossStep path (red burns /
   blue freezes / green roots the next strike; a single hue repeated does NOT
   awaken — all three do, the identical awaken latch the herons emit; the
   full-damage shimmer phase speeds the surfacing rhythm, 0.62× transit +
   telegraph). HP in the 48k class (above the gilded 42k — the biome's apex);
   a distinct dark-mud palette + a low rumble SFX layer (S2: the wyrm-rumble
   engage loop + wyrm-breach stinger). Reeds-mode only — the wyrm occupies the
   same `this.heron` slot (so paint routing, the awaken handler, the camera,
   and _endRun('victory') all reuse the heron machinery); a cycle-0 swamp run
   still spawns the gray heron (byte-identical). A NEW pure `wyrmStep`
   underground-transit state machine (logic.js) is the movement pattern
   (transit → telegraph → surfaced → transit, cycling the 3 surface points);
   game.js is thin (`_updateWyrm` driver + `_drawWyrm` + the wyrm branch in
   _beginExpedition; defeat sinks it under the water line instead of a
   flight). The fight lands in the 2–4 min class: surfaced (paintable) is the
   dominant phase (7s of a ~10s cycle) so 48k HP is a real fight, not a grind —
   bosspace-style bot measurement ≈ 97s (1.6 min) → ~2.3 min human (IN the
   2–4 min class). New smoke **stage 87, 19 assertions** (spawns only at the
   end of a Reeds expedition — a cycle-0 swamp run still spawns the gray
   heron; underground = invulnerable + untargetable; each surface telegraphs
   before breach; the 3 hues + awaken work through the EXISTING paintBoss
   latch — the same event the herons emit, and one hue alone does NOT awaken;
   the awakened rhythm is faster; defeat ends the Reeds run in victory; the
   the dark-mud draw path renders headless without throwing — P10-safe).
   **R6 ✅ (2026-09-07, v1.6 BATCH 2, finished by Hermes after the PM session
   died mid-item)** — `tests/reedspace.mjs` (new probe) + season audit. The PM
   session crashed before committing R6 (the probe was on disk but crashed on a
   hand-rolled save missing `bank` + used a per-frame keydown/keyup the headless
   stub can't hold, so its god-mode descent stalled at the guard timeout and the
   wave-fighting estimate was inflated to ~26.8 min). Hermes recovered it: (1)
   the probe now uses the Game's REAL fresh save + flips the victory flags
   (ngpace pattern — `_beginExpedition`'s `applyWelcomeGrant` reads
   `save.bank`); (2) the descent drives the real sim via `p.vx = 230` per frame
   (a true base-speed traversal through the flooded low band); (3) the
   wave-fighting estimate now scales the SWAMP probe's measured wave count
   (pace.mjs 755+160+30 ≈ 945s) by the Reeds length ratio (6000/5400) instead
   of a 2.2s/enemy over-density — the Reeds is longer but not denser. Result:
   Reeds HUMAN ESTIMATE ~22.2 min (IN the documented 20–25 min designed-descent
   band), Silt Wyrm fight ~3.9 min (IN the 2–4 min class), god-mode descent
   29–30s (real traversal, not a stall). New smoke **stage 88** (runs the probe
   as a child process; asserts wyrm identity, descent < 90s not a timeout stall,
   wyrm fight 2–4 min, Reeds total 20–25 min). Season re-verification: first-time
   pace 17.3 / humance 18.3 min (IN 15–20 — the victory gate held), NG+ cycle-1
   19.5 min (unchanged), bosspace 37s (unchanged); cycle-0 `makeTuning` output
   byte-identical (the Reeds biome is save-gated, not tuning-gated — no swamp
   balance changed). **BATCH 2 (R3 + R4 + R6) COMPLETE — Module R (the Reeds
   biome) is done: R1+R2+R5+R3+R4+R6 all committed, smoke 88 stages green.**
   Next: BATCH 3 (W1, W2, W3 — gamepad).
3. **BATCH 3 — W1, W2, W3** (gamepad: raw-API input feed into `input.js`;
   connection chip + full-screen UI focus; Reeds-mode parity +
   byte-identity regression for kb-only play; mocked `navigator.getGamepad`
   smoke stage + documented real-pad manual note).
   **W1 ✅ (2026-09-07, v1.6 BATCH 3, item 1)** — the GAMEPAD
   INPUT-ABSTRACTION LAYER: a raw `navigator.getGamepads` feed (ZERO deps —
   no library) polled once per frame at the TOP of `_frame` (`_pollGamepad`)
   that WRITES into the existing `input.js` `kb`/`keys`/`mouse` APIs, so the
   rest of the game is UNTOUCHED: left stick → the move keys (deadzone 0.25,
   `GAMEPAD_MAP` in `logic.js`), face buttons A/B/Y → pigments 1/2/3, a
   shoulder (X or RT) → hop, B (right face) → splash charge (hold-to-charge /
   **press-edge-at-full-to-fire** — the EXACT RMB contract; release alone does
   NOT fire, and the 0.05-s splash cooldown resets the charge, both verified
   by probing the real mouse handlers before mirroring them), L or a 2nd
   shoulder → lantern toggle (no-op outside the Reeds). **KEYBOARD ALWAYS
   WINS**: the feed refuses to set any `keys`/`mouse` field the physical
   keyboard/mouse owns, and `input._phys`/`mouse._physR` track the
   physically-held keys so the pad never clears a key the player holds. The
   P9 options panel gains a **`Gamepad: Auto / Off`** row (default `auto`;
   `_setGamepadMode` flips it, `_drawGpad` draws it) persisted via the options
   blob — `freshOptions`/`migrateOptions` gain `gamepad` (a legacy blob
   migrates to `auto`), **SAVE_VERSION stays 10** (options migration only).
   Auto engages on a fresh connect + stays engaged while the pad reports
   activity within `GAMEPAD_INACTIVITY_MS` (6 s; a fresh connect is always
   active) and disengages when it goes stale; `Off` skips the poll entirely
   (`_gpClearOwned` releases everything the feed ever wrote). Pure
   `GAMEPAD_MAP` + `gamepadActive(options, pad, nowMs, lastActiveMs,
   inactiveMs)` in `logic.js`; the poll is a thin `game.js` method with NO
   per-frame allocation. New smoke **stage 89** (46 asserts): mocked
   `navigator.getGamepads` fake Gamepad driven via direct `_pollGamepad()`
   calls so the transient `kb`/`rPressed` edges (cleared by `endFrame()` each
   frame) are inspectable — stick→move keys (deadzone honored), buttons→
   pigment/hop/lantern, keyboard overrides the pad on the same axis + on
   release (the pad never clears a held key), a hold-to-charge / press-at-full
   splash fires a real `trySplash` in a live expedition (charge reaches 1.0,
   the splash cooldown starts; release-then-press = NO fire, exactly like
   RMB), Auto engages on connect + disengages after the 6 s inactivity
   timeout, `Off` disables the feed (no writes; `connected` stays false), the
   option persists + a legacy options blob (no `gamepad` field) migrates to
   `auto`, and with NO pad the in-run key state is byte-identical to the
   no-gamepad baseline (a physical `a` held → `keys==={'a'}`, `moveVec
   [-1,0]`; `_phys`/`_physR` present). **Pacing re-verified unchanged — the
   feed is input-only and touches no run tuning or spawn: `pace.mjs` ~17.2 /
   `humance.mjs` full-run 18.1 min (IN 15–20) / `reedspace.mjs` wyrm 3.9 min
   (IN 2–4).** Also this batch: `reedspace.mjs` now actually SEEDS its PRNG
   (the documented `REEDS_SEED` flag was never wired — the sim's internal
   `Math.random` made the wyrm-fight figure wobble 97–101 s run-to-run and
   occasionally trip the 4.0-min boundary on clean main; it's deterministic
   now, 3.9 min). **W2 ✅ (2026-09-07, v1.6 BATCH 3, item 2)** — CONNECTION
   STATE + FULL-SCREEN GAMEPAD FOCUS: (a) a small paper-chip **"✦ pad
   connected"** pill top-right on the title (`_gpChipVisible`/`_drawGpChip`,
   drawn above the screens in `_drawAll`, visible only with a pad + Auto) plus
   the ONE-TIME **"a gamepad was found"** banner on the connect edge (the
   existing `addBanner` pattern, latched by `_gp.bannerShown` so it fires at
   most once) so Auto is legible; (b) the full-screen UI focus pass — every
   title/atelier/end-screen button list (options, pause menu, Field Guide)
   gets a gamepad-selectable focus cursor: **D-pad up/down** moves the
   highlight (wraps; keyboard ↑/↓ does the same), **A** confirms, **B/Esc**
   backs out one level. **A-confirm is routed through the SAME click machinery
   as a mouse click** — `_gpMenuWrite` (the single gamepad-confirm call site)
   parks `input.mouse.x/y` on the focused rect's center and sets the SAME
   `mouse.lPressed` edge a physical click sets, so the existing `_mouseIn`
   mouse-handler (which already gates every title/atelier/end/options/pause/
   help button) fires the exact same action — gamepad and mouse CANNOT
   diverge (there is no second action path). The focus list per state is
   computed by `_gpMenuList()` from the exact rects the mouse handlers test
   (title: Start, guided-expedition, 3 difficulty pills, Curator Challenge,
   Atelier, Options, Reeds; options: gamepad/toggles + back; pause: Resume +
   Quit; Field Guide: close + retrain buttons; end: primary/ng/ret; atelier:
   the enabled `_atelierRows()`). **The W1 in-run feed is now scoped to the
   expedition only** (`_pollGamepad` routes: expedition → the recency-gated
   `_gpWrite`; every other state → the connected-gated `_gpMenuWrite`), which
   is what keeps W1's in-run keys (space=Start, 1/2/3=atelier tabs, a=Atelier)
   from leaking into the menus; the menu focus stays responsive for as long as
   the pad is CONNECTED (no recency timeout — navigating a menu shouldn't drop
   you), and a pad-disconnect drops the focus cursor + clears owned keys.
   `GAMEPAD_MAP.menu` (A=confirm, B=back, D-pad 12/13 up/down) in `logic.js`
   (pure). New smoke **stage 90** (24 asserts, mocked pad): connecting shows
   the chip + the one-time banner (latched, at most once); in a menu the in-run
   feed is OFF (stick does NOT drive "d", B is BACK not splash); the title
   focus list is active on the first button + carries the full button set;
   D-pad down moves in order, up moves back, a HELD D-pad does not re-move
   (edge-latched), up from the top WRAPS to the last; **A fires the focused
   action exactly once** (verified against a real `_setDifficulty` through the
   shared click machinery) and a held A does not re-fire (edge-latched); a
   fresh A after release fires again; opening options switches the focus list
   to the options; **B backs out of the options (one level)** and B at the
   top level is a no-op; with NO pad the feed is disconnected + the chip is
   absent + the feed is dormant (no focus cursor). **REAL-CONTROLLER MANUAL
   TEST NOTE (hardware — the headless stage covers the mock, this covers the
   pad): a full menu walkthrough — connect a controller on the title → the
   "✦ pad connected" chip + "a gamepad was found" banner appear; D-pad
   up/down sweeps the title buttons with the gold dashed cursor and wraps
   end-to-end; A on "Begin Expedition" starts the run exactly as clicking it
   (the frog moves by stick, A/X/Y switch pigments, the shoulder hops, B
   charges+fires the splash, L toggles the lantern in the Reeds); B/Esc in the
   pause menu resumes, in the options closes it, on the end screen returns to
   the title; unplugging the pad drops the chip + feed (keyboard/mouse take
   over mid-run with no input loss). One full menu walkthrough performed with
   a physical controller before release sign-off.** Pacing re-verified
   unchanged (the feed is input-only; no-pad play is byte-identical):
   `pace.mjs` ~17.3 / `humance.mjs` full-run 18.3 min (IN 15–20). **W3 ✅
   (2026-09-07, v1.6 BATCH 3, item 3)** — REEDS-MODE GAMEPAD PARITY +
   REGRESSION (new smoke **stage 91**, 14 assertions): the pad drives the
   Reeds-mode behavior EXACTLY as the keyboard does, because the W1 feed
   writes the same keys the expedition reads — (a) the lantern button (LB)
   round-trips THE LANTERN lit/unlit (the `L` toggle path, Reeds-only; the
   fuel auto-snuff is respected); (b) the leech HOP-OFF fires from the pad's
   hop (RB → space) — a real clinging leech (spawned on the frog) is peeled
   on the hop-start frame by `_bestiaryTick`, and the re-attach window
   arms; (c) the Silt Wyrm fight is fully playable from the pad — all three
   pigments (A→red / X→blue / Y→green) + hop (RB) in the fight. Regression:
   with the pad ABSENT (Reeds mode) the feed owns NO key (byte-identical to
   the no-gamepad baseline), and with `gamepad:'off'` a connected pad writes
   nothing (poll skipped). P10 culling stage + full suite green (3×); the
   feed never alters run tuning/spawn — `pace.mjs` ~17.5 / `humance.mjs`
   full-run 18.2 min (IN 15–20, re-run after W3). **Manual test note (real
   controller, Reeds-mode parity):** enter Beneath the Reeds with a pad
   connected (Auto) — in-run the D-pad is released (W1 feed only), so: hold
   LB to flick THE LANTERN off and on (the paper "flick" SFX + the light
   radius round-trips); let a Silt Leech cling (it latches on contact +
   drains a little color) and then HOP (RB / space) to break the cling (the
   "leech-peel" SFX + the re-attach window); in the Silt Wyrm fight, cycle
   all three pigments with A / X / Y (the brush hue swaps + the painted
   splats land in that hue) and hop with RB — the fight is fully playable
   from the pad exactly as from the keyboard. Unplug the pad mid-Reeds: the
   feed clears its keys and keyboard/mouse take over with no input loss (the
   in-run state is byte-identical to a no-pad run). Headless stage 91 covers
   the mock; this note covers hardware. **BATCH 3 (W1 + W2 + W3)
   COMPLETE — Module W (gamepad) done: W1 + W2 + W3 all committed, smoke 91
   stages green.** Next: BATCH 4 (Q1, Q2, Q3, A1 — QoL).
4. **BATCH 4 — Q1, Q2, Q3, A1** (QoL: pause-menu run summary; end-screen
   recap strip; paste-based save export/import; then the K10-style final
   full regression + season audit + docs-only close).
   **BATCH 4 ✅ COMPLETE (2026-09-07) — v1.6 COMPLETE.**
   **Q1 ✅** — pause-menu run summary (smoke stage 92): the J5 slide+fade
   pause card grows 260→320 with a compact "this expedition" block (run time
   via the existing `runT` read, current zone name, enemies painted so far —
   a run-local `runEnemies` counter incremented in `_onEnemyDead`, in-memory
   ONLY — plus orbs collected). Zero tuning change, SAVE_VERSION stays 10.
   **Q2 ✅** — end-screen run recap (smoke stage 93): a "the last
   expedition" strip ABOVE the end card on BOTH the victory AND defeat
   screens — a 6-zone minimap with the run's route as a wobbly ink line (a
   run-local `runWaypoints` list sampled ~500 ms, cap 40 oldest-dropped, via
   pure `routeTrail`/`ROUTE_WAYPOINT_CAP` in logic.js) + the run time + the
   boss result line. Pure presentation, NO new persistence (save
   byte-identical before/after the end screen).
   **Q3 ✅** — save export/import (smoke stage 94): the Options panel gains a
   paste-based "Save" section — Export copies the save JSON to the clipboard
   (`navigator.clipboard.writeText`, loopback-safe, no file APIs; stashed on
   `_lastExportBlob` for the headless path); Import reads a pasted blob via a
   paper-styled field → pure `validateSaveBlob(json)` in logic.js (schema
   version + the EXISTING migration chain + hard refuse) → replaces the save
   and mirrors the live instance. A corrupt paste is REFUSED with a one-line
   "that save didn't look right — nothing was changed" banner and the current
   save untouched; a valid-but-old v1-era blob imports through the migration
   chain to v10. The sanctioned escape hatch for the loopback-only
   localStorage architecture. SAVE_VERSION stays 10.
   **A1 ✅** — full regression + season audit (the final gate): smoke ×3 green
   (94 stages, including new stages 92–94); first-time pace 17.3 / humance
   18.1 (IN 15–20); ngpace cycle-1 19.5 (IN band); bosspace heron 37.1 s
   god-mode; reedspace ~22.2 min (IN 20–25) + Silt Wyrm ~3.9 min human (IN
   2–4); P10 culling green; zero new deps (only src/tests/docs/PROJECT_STATE
   since `681911c`); SAVE_VERSION 10 migration end-to-end; cycle-0 tuning
   byte-identical (630-byte blob, clean diff). Tree clean.
   **v1.6 COMPLETE — all 13 items (R1–R6 / W1–W3 / Q1–Q3 / A1) done and
   committed; the suite is 94 stages green; no open scope for v1.6.**

**v1.5 "The Living Swamp" is APPROVED (Joel 2026-09-06: "Don't even pitch
me v1.5. Just make it") — **COMPLETE 2026-09-07: all 10 items K1–K10 done and committed.** 10 items in
`docs/ROADMAP.md` §v1.5 (final K10 gate verified 2026-09-07: smoke 80/80; first-time pace 17.4 / humance 18.0 min IN the 15–20 band; NG+ cycle-1 19.5 min IN BAND; cycle-3 27.3 / cycle-4 38.9 min the documented deliberate bounded escalation; zero new deps — only src/tests/docs/PROJECT_STATE changed since v1.4-complete `dddbcaf`; tree clean; SAVE_VERSION 9 migration loads a v1-era save). **Batch 1 COMPLETE: K1 ✅ (Mud Turtle, smoke 72) → K2 ✅ (Blind Crag Frog, smoke 73) → K3 ✅ (zone-5 Storm Surge, smoke 74) — suite 74/74, pacing unchanged (first-time 17.3/18.3, NG+ 19.5).** **Batch 2 COMPLETE: K4 ✅ (The Gilded Heron, smoke 75) + K5 ✅ (3 new modifiers, smoke 76) + K6 ✅ (NG+ Master tier c4+, smoke 77) — suite 77/77, first-time byte-identical (pace 17.2/16.7, NG+ cycle-1 19.5), cycle-4 Master tier ~39 min (bounded, deliberate). BATCH 2 COMPLETE.** **Batch 3: K7 ✅ (Curator Challenge, smoke 78 — seeded daily expedition, top-5 scores, SAVE_VERSION 9, suite 78/78, first-time pacing unchanged: own scored mode).** **Batch 4 COMPLETE: K9 ✅ (Field Guide + first-sight callouts, smoke 80) → K10 ✅ (full regression + season audit + docs-only commit ). v1.5 COMPLETE — no open scope; the next phase is whatever Joel approves after v1.5 review (the deferred list in ROADMAP §v1.5 is the boundary).**

**Theme: the swamp gets new residents + a designed second act + a daily
challenge.** v1.5 adds real content — 2 new enemy archetypes with signature
mechanics, a zone-5 set-piece, a 3rd NG+ boss, new modifiers + Master tier,
and a seeded daily Curator Challenge. New creatures scale into zones 3+ and
NG+ so the first-time 15–20 min run is untouched (verify every time).

**Fixed batch order** (each fresh session resumes losslessly from here;
one conventional commit per item):
1. K1 → K2 → K3 (Mud Turtle front-shell deflection · Blind Crag Frog hunts-sound / sleeps-when-quiet · zone-5 Storm Surge set-piece)
2. K4 → K5 → K6 (The Gilded Heron 3rd boss · 3 new modifiers · NG+ Master tier c4+)
3. K7 → K8 (seeded daily Curator Challenge + top-5 scores · Masterpiece reward)
4. K9 → K10 (Field Guide / ledger updates for new creatures · full regression + season audit) — DONE

**Per-item discipline:** one conventional commit per item; add a passing
smoke stage (or documented headless check for pure presentation); update
docs/ROADMAP.md (mark ✅) + PROJECT_STATE.md + docs/PROJECT_STATUS.md;
suite green after every commit; zero new dependencies; loopback-only; keep
game.js thin (rules in logic.js). **60fps acceptance (HARD, every
juice/art item):** the P10 culling stage must still pass AND the item's own
smoke stage must assert its per-frame budget (capped lists, cached
offscreen canvases, draw-time-only pose flags); run the real-browser 60fps
probe where practical (see Known risks — headless driver). **Pacing
invariants:** every item is presentation/feel — first-time Normal stays
15–20 min; re-run `pace.mjs`/`humance.mjs` after any item that touches the
in-run path, and J4/M1 must prove medians unchanged. SAVE_VERSION bumps
only where a save field is added (M1: 7→8 `firstVictoryShown`). **Style
boundary:** everything must read as painted watercolor — no sci-fi/gamey
HUD, no scanlines/CRT (rejected twice), no image/audio/font assets.

**v1.4 recap:** Module J (juice): J1 wet paint lingers · J2 hit-stop/shake/
slow-mo · J3 camera polish · J4 frog hop feel · J5 micro-animations. Module
L (presence): L1 living world · L2 layered watercolor render (pre-baked
stroke texture per zone) · L3 breathing title + lighting. Module S (audio):
S1 melodic zone themes (sequencer over the ambient drone) · S2 boss music
+ stingers · S3 painting sound-design (pigment timbres). Module M
(moments): M1 first-victory cinematic (skippable, once) · M2 Encore gallery
viewing · M3 easter eggs (the other frog, the signed canvas). Deferred past
v1.4 (reasons in ROADMAP §v1.4): gamepad, accessibility, gold combat color,
co-op, procgen, persistent paint data, image/audio/font assets, CRT/retro.

**v1.2 "The Collection" is COMPLETE** (2026-09-06) — all four milestones done:
M9 (A1–A4) ✅, M10 (E1–E4) ✅, M11 (V1–V4) ✅, M13 (T1–T4) ✅. Full suite
45/45; pacing `pace.mjs` ~18.7 min + `humance.mjs` ~18.8 min (in the 15–20 min
band on Normal). Full scope + per-item status in `docs/ROADMAP.md` §v1.2.

**Batch history (one commit per item, docs + suite green per commit):**
1. M9: A1 ✅ (atelier one-liners) → A2 ✅ (painting synergy pairs) → A3 ✅ (Curator's Ledger). **Batch 1 (A1–A3) COMPLETE.**
2. M9: **A4 ✅ (Rehung Frame)** → M10: **E1 ✅ (Painted Heron)** → **E2 ✅ (weather/tide phases)**. **Batch 2 (A4/E1/E2) COMPLETE — suite 35/35, pacing in band on Normal.**
3. M10: **E3 ✅ (Bold-only zone hazards)** → **E4 ✅ (orb-streak bonus)** → M11: **V1 ✅ (color-reveal bar)** — **Batch 3 COMPLETE**
4. M11: **V2 ✅ (heron bloom beat)** → **V3 ✅ (zone ambient audio)** → **V4 ✅ (exhibition end-screen)** — **Batch 4 (M11) COMPLETE — suite 41/41**
5. M13: **T1 ✅ (guided first expedition)** → **T2 ✅ (interactive pigment drills)** — **Batch 5 (M13 T1+T2) COMPLETE — suite 43/43, pacing 18.7/18.9 min (the frozen tutorial pre-run layer adds no timed-run time)**
6. M13: **T3 ✅ (mini sketch heron)** → **T4 ✅ (tutorial progress + "Watch me" re-entry)** — **Batch 6 (M13 T3+T4) COMPLETE**
7. M14: **N1 ✅ (NG+ unlock + Next Expedition flow)** → **N2 ✅ (NG+ scaling + `tests/ngpace.mjs` probe)** → **N3 ✅ (second boss — The Great Green Heron)** — **v1.3 Batch 7 (N1→N2→N3) COMPLETE** (suite 48/48, first-time pacing unchanged, NG+ cycle-1 ~19.5 min in band)
8. v1.4 Module J: **J1 ✅ (wet paint that lingers)** + **J2 ✅ (hit-stop / shake escalation / boss-defeat slow-mo)** + **J3 ✅ (camera polish: look-ahead / lag / boss midpoint / awaken hold)** — **v1.4 Batch 1 (items 1–3) COMPLETE** (suite 60/60, P10 stage 24 still green; all presentation/time-feel only — first-time pacing unaffected, probes re-verified in band)
9. v1.4 Batch 2 (J4→J5→L1) COMPLETE: **J4 ✅ (frog hop feel — squash / stretch / dust / ripple + boing SFX)** + **J5 ✅ (micro-animations — HUD "+n" floats / orb-streak fading trail / pause panel 0.15 s slide+fade)** + **L1 ✅ (living world — swaying reeds / drifting mist / water shimmer)** (suite 63/63, P10 stage 24 still green; all presentation/draw-only — `player.js` physics + world-sim `runT` untouched, pace ~18.5 min unchanged).

10. v1.4 Batch 3 (L2→L3→S1): **L2 ✅ (layered watercolor render pass — bake-once per-zone offscreen stroke texture + wet-edge rims + watercolor double-stroke; pure draw-time, capped draw count, stage 64)** + **L3 ✅ (breathing title + vignette/lighting — scale/opacity title breath + 8 s sat swell + idle lily-pad frog + staggered menu + warm frog glow + always-on warm vignette under the low-HP pass, gated by `options.vignette`; pure draw-time, stage 65)** + **S1 ✅ (melodic per-zone themes — a ctx.currentTime lookahead step-sequencer schedules a distinct pentatonic loop per zone on a new per-zone melody gain ABOVE the V3 ambient bed; crossfades on zone change, rides musicBus so the slider + mute scale it; no setInterval / audio files / new deps, stage 66)** — **v1.4 BATCH 3 (L2 → L3 → S1) COMPLETE** (suite 66/66, P10 stage 24 still green; all presentation/audio — world-sim `runT` + `player.js` physics + logic untouched, pace re-verified in band). **Remaining v1.4: S2 → S3, M1–M3.**
11. v1.4 Batch 4 (S2→S3→M1), item 1: **S2 ✅ (boss music + victory/defeat stingers — on engage the zone theme crossfades INTO a distinct, faster, darker minor BOSS loop with a low off-beat pulse layer (the Great Green Heron gets its own lower/darker variant); all on melodyMaster→musicBus via the S1 step-sequencer — `tickMusic` now drives zone+boss through a shared `_tickThemes`, `clearZoneTheme` fades both so run end/quit is unchanged. End-screen stingers are one-shot melody-layer phrases: victory = rising major arpeggio C4 E4 G4 C5 E5 G5 C6, defeat = slow descending minor A4 G4 F4 E4; the moment-of-death now plays a short soft `'faint'` blip distinct from the defeat stinger; stage 67)** — suite 67/67, P10 stage 24 still green. **Pure audio — no gameplay logic touched, so P10 + pacing are unaffected. Remaining v1.4 BATCH 4: S3 → M1. (Both S3 and M1 now done — see items 12–13.)**
12. v1.4 Batch 4 (S2→S3→M1), item 2: **S3 ✅ (satisfying painting SFX + concurrent-voice cap — the swipe becomes a pigment-colored wet-brush voice `paint-swipe` `{ pig }`: a soft "shh" bandpass-noise sweep under a DISTINCT per-pigment signature — red a warm low "pew" (low sawtooth), green a deep "glorp" (low triangle + sub), blue a crystalline "ping" (bright high sine + shimmer), dry a clean high "whoosh" (high airy bandpass, no low body); the splash gets the same per-pigment treatment `paint-splat` (wet "blub" + signature). Status moments get tiny blips — `burn-ignite` (crackling highpass tick), `freeze-tick` (bright crystalline ping), `root-thud` (low body + lowpass), + a `cleanse` scrub — fired from `_applyHits` at most ONCE per action. A concurrent-voice cap `_sfxMaxVoices = 24` on the sfx bus drops new sfx voices once N are live (a flurry can't spawn hundreds of oscillators); melodic S1/S2 layers pass an explicit target and are exempt. All on the sfx bus (slider + mute), all `_tone`/`_noise` — no assets, no new deps; `paint.js` routes `paint-swipe`/`paint-splat` + the status blips; stage 68)** — suite 68/68, P10 stage 24 still green. **Pure audio + a tiny per-action SFX dispatch (no world-sim / balance change), so pace is unaffected. Remaining v1.4 BATCH 4: M1. (M1 now done — see item 13.)**
13. v1.4 Batch 4 (S2→S3→M1), item 3: **M1 ✅ (first-victory cinematic beat — SAVE_VERSION 7→8 with a v7→v8 `SAVE_MIGRATIONS` step + `normalizeFirstVictoryCinematic`; a fresh save AND every migrating old save load `firstVictoryCinematic: false` so a player who never saw the beat gets it exactly once. On a fresh player's first victory the end screen opens a ~4 s SKIPPABLE beat: letterbox bars slide in, the world blooms to full color (a RENDER-ONLY `worldColorSat` ramp to 1.0 — never writes world state, so the color-reveal single-source-of-truth invariant holds), a soft S1-style pentatonic arpeggio swells on the melody layer (`AudioSys.cinematicArp()`, 8 rising triangle notes + a warm pad, all routed osc→note-gain→stinger-gain→`_melodyMaster`→musicBus so the slider + mute scale it), then the normal victory card (V4 exhibition + C2 season) reveals and the S2 triumphant stinger fires at that reveal. Any key/click skips immediately and the end-screen buttons are GATED while the beat runs so a skip never opens the atelier; a returning player (flag set) goes straight to the card. The beat lives entirely in `state === 'end'` (after `runT` freezes) so it NEVER runs inside a timed expedition. Headless AudioContext smoke stage 69 + main-flow stage 5)** — suite 69/69, P10 stage 24 still green. **Pure presentation + one boolean save flag — no world-sim / balance change; pacing re-verified in the 15–20 band and unchanged (pace ~17.3 / humance 18.3 / ngpace 19.5 min; the beat adds no timed-run time). v1.4 BATCH 4 (S2 + S3 + M1) COMPLETE.**
14. v1.5 "The Living Swamp" Batch 1 (K1→K2→K3), item 1: **K1 ✅ (MUD TURTLE — the armored plodder). A new `turtle` archetype in the `ENEMIES` table (`logic.js`: hp 95, speed 24, dmg 12, radius 24, armor 0.45, fly false, score 45) — high-HP, slow, heavy contact hit. Its SHELL deflects paint from the FRONT arc: a new pure predicate `frontDeflectFactor(enemy, player)` in `logic.js` returns `deflectKeep` (0.15) when the angle between the turtle's `facing` and the frog is within `deflectArc` (1.5 rad) and 1 otherwise; `Enemy` tracks `facing` from its travel direction (`enemies.js` `update()`, draw-time-only read by paint) and `paint.js` `_applyHits` folds the factor into `paintDamage` (`opts.deflectFactor`). RED BURN is the counter — burn damage is applied per status-tick (`stepStatus`), never through a paint hit, so it bypasses deflection entirely. A `drawTurtle` renderer (`enemies.js`) rotates the body to `facing` and draws a lighter FRONT WEDGE marking the deflecting arc. Spawn: `_spawnWave` gates the turtle to `_zoneI >= 3` on cycle 0 (a first-time Normal run NEVER meets it before zone 3) and to any named zone on NG+ (`ngCycle >= 1`); it is the rarest pick (`roll > 0.9`) and shares the existing spawn cap (bounded — no extra enemy list). A `shell` floating note marks a deflected hit. Smoke stage 72 asserts: the table, that it SPAWNS, front paint is deflected (cut to ~15%), side/back paint is full, a red swipe from the front still APPLIES burn, and a red burn KILLS the turtle from the front; plus the zone-3+ / NG+ spawn gating.** — suite 72/72, P10 stage 24 still green. **New-resident scaling: the turtle is gated OUT of cycle-0 zones 0–2 so the first-time 15–20 min run is untouched — re-verified after this commit: `pace.mjs` lower-bound 1.1 min / HUMAN ~17.3 min, `humance.mjs` ~18.4 min (in band, unchanged). Remaining v1.5 Batch 1: K2 → K3.**
15. v1.5 "The Living Swamp" Batch 1 (K1→K2→K3), item 2: **K2 ✅ (BLIND CRAG FROG — hunts by sound). A new `cragfrog` archetype in the `ENEMIES` table (`logic.js`: hp 34, speed 150, dmg 9, radius 17, armor 0.05, fly false, score 40, `noiseRadius` 280, `alertDuration` 5) — fast + high contact damage when awake. It cannot see: a nearby NOISE (a paint swipe/splash, a hop landing, or a full charge inside `noiseRadius`, all funnelled through a new thin `_noiseEvent(x,y)` in `game.js`) sets a per-enemy `alertT` and wakes it; `alertT` decays each frame in `Enemy.update()` and when it lapses the frog SLEEPS again. While asleep it cannot move or attack and is VULNERABLE — `cragSleepBonus(e)` (pure, `logic.js`) returns ×1.5 and `paint.js` `_applyHits` folds it into `paintDamage` (`opts.sleepBonus`); asleep a `drawCragFrog` renderer shows a closed eye + a drifting "z" + a faint vulnerability glow, awake an open wide eye + restless tremor. Spawn: `_spawnWave` gates the cragfrog to `_zoneI >= 3` on cycle 0 (never before zone 3 on a first-time run) and to any named zone on NG+; it is the rarest pick (`roll > 0.86 && roll <= 0.9`, just below the turtle) and shares the existing spawn cap (bounded — no extra enemy list). Smoke stage 73 asserts: it spawns, it SLEEPS at spawn (quiet → still asleep → does not move or attack), a NEARBY noise WAKES it and arms the alert timer, awake it CHARGES toward the player, a FAR noise does not wake it, when the player is still (alert decays) it SLEEPS again, `cragSleepBonus` is 1.5 asleep / 1.0 awake, and asleep it takes +50% paint damage (ratio ≈1.5); plus the zone-3+ / NG+ spawn gating.** — suite 73/73, P10 stage 24 still green. **New-resident scaling: the cragfrog is gated OUT of cycle-0 zones 0–2 so the first-time 15–20 min run is untouched — re-verified after this commit: `pace.mjs` lower-bound 1.1 min / HUMAN ~17.4 min, `humance.mjs` ~18.3 min (in band, unchanged). Remaining v1.5 Batch 1: K3.**
16. v1.5 "The Living Swamp" Batch 1 (K1→K2→K3), item 3: **K3 ✅ (STORM SURGE — the zone-5 final-stretch set-piece). A new ~15 s scripted beat, NON-blocking, driven by a pure side-channel (`this.surge` + `_updateSurge` in `game.js`) off its OWN clock — it NEVER feeds `runT` or the pacing probes. Pure rules in `logic.js`: `STORM_SURGE` (duration 15, burstCount 9, burstWindow 4.5, rain = splashRadius ×1.3, orbCount 4), `stormSurgeFor(seed)` (seeded lead-in 1.0–3.0 s so the banner + stinger land just before the first mosquito — deterministic per run), `stormSurgeRainPhase()` (a synthetic rain phase sized to the beat, reused through the E2 `weatherFactor` transient-multiplier machinery: ramps 1.0→1.3→1.0, restored to base at expiry = no residue), and `stormSurgeCleared(surge, left)` (all burst spawned + all its mosquitoes gone + not yet awarded). Arming: `game.js` arms the surge once when `_zoneI >= ZONES.length` (past the last NAMED zone = the final stretch / "zone 5") with the heron present — a one-shot (guarded by `!this.surge`). On entry: banner "STORM SURGE!" + the new S1-style `stormSurgeStinger()` SFX (audio.js: a low rumbling bass swell + a dark minor-chord tremolo + a rain-shimmer noise bed, on the melody layer) + the transient rain buff (captured base, eased via `weatherFactor`, restored at expiry). The burst is BOUNDED (9 fast mosquitoes — `speed ×1.25`, `_surge: true`, riding the shared spawn cap with a hard 14-enemy bound, tracked in `_surgeEnemies` for the live clear check). On a clear: a bonus orb burst (`orbCount` 4 orbs scatter around the frog) + a banner. Clean expiry: after `duration` the rain buff returns EXACTLY to base and the surge drops. Smoke stage 74 asserts: the beat is bounded (~15 s, burstCount 9 ≤ 14, orbCount 4), the rain buff is transient (factor 1.0 at start, 1.3 mid-beat, 1.0 at expiry — no residue), the opening is seeded, the surge is NOT armed on a fresh run, it TRIGGERS ONCE on entering zone 5 (one-shot, not re-armed per frame) and does NOT feed runT, it spawns a BOUNDED all-mosquito burst (exactly 9 live, tagged), the rain buff is ACTIVE (splashRadius 58→75), a clear scatters a BONUS ORB BURST (orbs 0→4) and the pure `stormSurgeCleared` predicate fires (and does not double-award), and the surge EXPIRES cleanly (drops, rain buff returns EXACTLY to base, enemy tracking cleared). ** — suite 74/74. **Non-blocking + gated to the final stretch, so the first-time 15–20 min run is untouched — re-verified after this commit: `pace.mjs` lower-bound 1.1 min / HUMAN ~17.3 min, `humance.mjs` ~18.3 min (in band, unchanged), `ngpace.mjs` NG+ cycle-1 ~19.5 min (in band). Batch 1 (K1→K2→K3) COMPLETE.**

Each item's Notes column in the roadmap says which existing system to reuse.
Acceptance (per batch): suite green, pace/humance probes still in the
15–20 min band (any in-run change), zero new dependencies, loopback-only.

**v1.4 J1 (wet paint that lingers) — implemented + tested (Batch 1, item 1).**
A capped (~120, `Paint.MAX_WET`) pool of short-lived low-alpha "wet" marks
lives on `Paint` (`paint.js`). `trySwipe()` drops 2 marks along the stroke and
`trySplash()` drops 5 around the ring; `_addWet()` pushes oldest past the cap
so the array is always `<= MAX_WET` (P10 discipline — no unbounded growth);
`update()` decays them and `drawWet()` renders them as soft fading watercolor
blobs (a render hook was added in `game.js` `_drawAll`, drawn on the surface
under the active stroke). The swipe ribbon lifetime went 0.28s → 0.4s so the
brush stroke reads as wet before it dries. **Draw/particles-time only** — no
persistent paint data (the world's per-cell `pigmentGrid` layer is untouched),
no gameplay change, no new dependencies. Smoke stage 58 asserts: marks spawn
on swipes, the pool never exceeds the cap, all decay to empty on their own,
the ribbon lingers ~0.4s, and `drawWet()` draws only while marks exist. P10
(stage 24) still passes; first-time pacing unaffected (presentation-only).

**v1.4 J2 (hit-stop + shake escalation + boss-defeat slow-mo) — implemented + tested (Batch 1, item 2).**
A single `this.timeScale` (default 1) drives the whole WORLD sim. In the
ambient block of `_frame`, `simDt = dt * timeScale` feeds `world.update`,
`particles.update`, and (in the expedition branch) `_updateExpedition` — so
the player, enemies, heron, and the `runT` clock all tick with `simDt`, while
banners/UI/shake/zoom/input keep raw `dt`. **Because `runT` advances with the
sim, a full run's measured `runT` is invariant to hit-stops** — a dip only
stretches real wall-clock, so the probes (which measure `game.runT`) stay in
band. Re-verified 2026-09-06: pace ~18.5 min, humance in band, NG+ cycle-1
19.5 min (matches baseline). `hitStop(secs, scale)` (gated by
`options.shake`) sets `timeScale` for `secs` of **real** time (the frame loop
decrements `_hitstopT` by raw `dt` and restores `timeScale` to 1 when it
expires — it can never get stuck below 1). Triggers: `_onEnemyDead` →
`hitStop(0.075, 0.3)` (small-hit pop), pigment pickup → `hitStop(0.06, 0.35)`,
`_onHeronDefeated` → `hitStop(0.8, 0.35)` + `whiteFlash()` + `addShake(22)`
(shake spike). `whiteFlash()` sets `_whiteFlash=1`, drawn last in `_drawAll`
as a full-screen white overlay at alpha ≈ `_whiteFlash*0.5` and decayed on
real time in `_frame` (presentation only). `freezePreHit()` arms a 1-frame
`_freezeFrames` latch consumed at the top of `_frame` (zeros `simDt` for that
one frame while the UI keeps ticking); it is armed the frame the heron enters
the lunge (`'lunge-start'` event sets `h._lungeArmed`) and consumed by the
ongoing lunge-contact check. The post-victory heron flight is routed through
`simDt` so the ~0.8 s defeat slow-mo visibly stretches the heron's bloom
(runT is frozen during flight — no pacing effect). **All three effects are
no-ops when `options.shake` is OFF.** No pure-logic change, no new
dependencies. Smoke stage 59 asserts: timeScale defaults to 1, a kill pops a
hit-stop (dip <0.5) that recovers to 1 within 1 s, defeat triggers the
slow-mo window @ ~0.35× + white flash + shake spike, the slow-mo recovers,
and with shake OFF every helper is a no-op. P10 (stage 24) still passes.

**v1.4 J3 (camera polish: lead / lag / boss midpoint / awaken moment) — implemented + tested (Batch 1, item 3).**
`_updateCamera` (game.js) replaces the plain `approach` follow with four
PRESENTATION branches on the existing `cam` object (shake still rides on top
in `_view`). Everything is presentation: the camera follows the frog's
already-simmed position and runs on **real `dt`** (never `simDt`), so it stays
smooth during J2's slow-mo and **never feeds the measured runT**. (a)
input-direction look-ahead up to ~40 px toward the held movement dir (eases in
on input, eases back onto the frog when idle); (b) mild lag at speed — the
follow ease rate drops (4 vs 7) while a movement key is held (weighted feel),
snapping back when at rest; (c) boss framing — while the heron is live (hp>0,
not fleeing, intro done) the camera centers on the **frog–heron midpoint** and
widens (`zoomTarget = 0.92`), and while it is fleeing (victory flight) it chases
the heron (the pre-existing beat, preserved); (d) the awaken moment — the final
heron's `res === 'awaken'` handler sets `_awakenHoldT = 1.2`, during which the
camera **holds on the rising heron with a zoom-out** (`zoomTarget = 0.88`) then
eases back to follow; `paintBoss` (logic.js) returns `'awaken'` exactly once per
rise (gated by `h.awakened`), so the hold fires once per rise. No new camera
system, no new dependencies. Smoke stage 60 drives `_updateCamera` directly:
look-ahead leads ~40 px then eases back, boss framing centers on the midpoint +
widens, the awaken hold is active ~1.2 s / zooms out / fires once per rise. P10
(stage 24) still passes.

**v1.4 J4 (frog hop feel: squash / stretch / dust / ripple + boing SFX) — implemented + tested (Batch 2, item 1).**
Draw-time only — `player.js` physics (vx/vy/hopLift/hopCd/iframes) is
**untouched**, so pace/humance medians are unchanged (re-verified: pace ~18.6
min, in the 15–20 band). The existing `player.squash` field — already mapped
to `ctx.scale(squash, 2 - squash)` in `Player.draw` (so x=squash, y=2-squash)
— now stretches to **0.85 on hop START** (x0.85/y1.15) and squashes to **1.2
on landing** (x1.2/y0.8); it relaxes to 1 in `update` via the existing lerp.
Landing is detected in `Player.update` the frame `hopT` crosses from >0 to ≤0
(checked after the decrement) → sets the one-shot `_hopLanded` flag. game.js,
immediately after `p.update`, consumes the flag and fires `particles.dustPuff`
(new: a 5-mote low-alpha soft puff, kind 0) + `particles.ripple` (new: a single
expanding+fading ring, kind 6, drawn in `particles.draw` via `grow = 1 - fade`)
+ the new synth `'boing'` SFX (low pitch-down sine + soft overtone, no asset) —
all presentation, once per landing. Smoke stage 61: a hop STRETCHES (x<1/y>1),
a landing SQUASHES (x>1/y<1) + sets the one-shot flag (fires at most once),
`dustPuff` spawns exactly 5 motes, `ripple` spawns exactly one kind-6 ring, and
a real hop landing fires exactly one dust puff + one ripple + one 'boing' (via
spies). P10 (stage 24) still passes.

**v1.4 J5 (pickup / HUD / UI micro-animations) — implemented + tested (Batch 2, item 2).**
Presentation-only in `game.js` — the world-sim `runT` (and `player.js` physics)
is untouched, so pace/humance medians are unchanged (re-verified: pace ~18.5
min, in the 15–20 band). (a) a screen-space `_floats` array pops a "+n" number
near the collected pigment's HUD jar on each orb pickup (rises + fades on real
time, decays in the frame loop, capped ~24, drawn at the end of `_drawHud` with
a quick scale-in pop); the existing world-space `paint.note()` (+streak) and the
`sparkles` burst already fire on the same pickup, so the "pickup pop + sparkles"
acceptance is met. (b) a short `_streakTrail` (capped ~19) is captured behind
the frog every frame the orb streak is ACTIVE (`orbStreakState().active`),
decays in the frame loop + draws as a fading streak in `_drawHud` (world→screen
via `_view`). (c) the pause panel opens with a 0.15 s slide+fade (`_pauseOpenT`,
advanced in the paused frame branch, eased via `clamp(t/0.15,0,1)`): backdrop +
card rise+fade in, button hit-rects stay at their final positions (unchanged —
`_drawPause` and the click routing agree on the final rect). No animation
library, no new dependencies. Smoke stage 62: a pickup pops a HUD "+n" float
(count 0→1) that decays away, the orb streak leaves a fading trail while moving
(capped, decays to empty), the pause open state INTERPOLATES 0→0.53→1 (not a
hard cut) + the frame loop advances the clock, and the pickup pop fires a
sparkles burst. P10 (stage 24) still passes.

**v1.4 L1 (living world pass: swaying reeds / drifting mist / water shimmer) — implemented + tested (Batch 2, item 3).**
Pure draw-time in `world.js drawProps` (which already receives `now`), all
inside the existing view culling — **no new per-world state, no world-sim
change**, so P10 (stage 24) and the pacing probes (runT) are untouched
(re-verified: pace ~18.5 min, in band). Three additions, each a small pure
function of `now` + existing data: (a) **reed sway** — `reedSway(seed, now)`
(a small ±5px per-reed sine, phase from the reed's `seed`, scaled by the
growth factor) rides the reed's tip + cattail head while the planted base
holds (the original bend/wobble + burn color are preserved); (b) **drifting
mist bands** — a module constant `MIST_BANDS` (3 very-low-alpha procedural
ellipses, alpha ≤ 0.05) tiled across the view with a slow-parallax tile scroll
`S = (1+parallax)*view.x + now*speed` (parallax < 1 → each band lags the
camera = reads farther), plus a slow vertical bob; culled to the visible
rect; (c) **water shimmer** — a handful of staggered glints on the existing
`ripples` (open-water markers), capped at `SHIMMER_CAP = 12`, each pulsing on
`shimmerGlint(i, now)` (a staggered sine so they twinkle out of sync). No new
dependencies. Smoke stage 63: `reedSway` is time-animated + small (≤~5px),
`shimmerGlint` is bounded [0,1] + staggered, there are 2-3 very-low-alpha
slow-parallax mist bands, the world draw is still culled (localized < full),
and the shimmer count is bounded. P10 (stage 24) still passes (its near-enemy
"seeks the player" guard was also hardened to a ~0.66s window to remove a
pre-existing flake). **v1.4 Batch 2 (J4→J5→L1) COMPLETE.**

**v1.4 L2 (layered watercolor render pass: wet edges + stroke texture) — implemented + tested (Batch 3, item 1).**
Pure draw-time + a **bake-once offscreen cache** in `world.js` — **no new
per-frame state, no world-sim change**, so P10 (stage 24) and the pacing
probes (runT) are untouched (re-verified: pace ~17.3 min, in band). Three
layered passes: (a) **wet edges** — freshly painted pigment cells carry a
darker wet rim (a `wetRimAlpha(amount)` ellipse, the watercolor bloom) that
lightens as the cell's pigment decays with `age` over ~5s (reuses the
EXISTING `pigmentGrid` `amount`/`age` — **no new persistence**); view-culled +
capped at `WET_RIM_CAP = 96` for a flat per-frame cost; (b) **stroke
texture** — short directional brush strokes baked **ONCE** at `world.build()`
into a per-zone **offscreen canvas** (seeded via a fresh `mulberry32` stream
off `this.seed` so the same world seed → the same texture, and it rides the
existing seed system without disturbing the main decoration RNG; a low-alpha
accent **base wash** + directional dark-edge/light-highlight **brush strokes**
per zone), drawn as **ONE `drawImage` per zone per frame** (the budget trick:
~4 cached `drawImage`s/frame regardless of world size, not thousands of raw
strokes); (c) **watercolor double-stroke** — rocks & bushes get a second
low-alpha offset `_doubleStroke` echo of the outline (a soft ink wash edge).
`ZONE_TEXTURES` mirrors `game.js` ZONES locally so `world.js` stays
dependency-free (no circular import). No new dependencies. Smoke stage 64:
the world bakes an offscreen cache at build with **one canvas per zone
(4 = 4 zones)**, the count is **STABLE across frames** (before == after 5
frames, same canvas objects — baked once, not re-baked), `drawBackground`
issues a **bounded** `drawImage` pass (cached textures + paint layer, <= 8 —
the cached path, not raw stroke counts), the **wet-rim alpha decays**
(fresh 0.400 > mid 0.200 > dry, 0 at fully dry), and the wet-rim draw count
is bounded. P10 (stage 24) still passes. **v1.4 Batch 3 item 1 (L2) done;
next L3.**

**v1.4 L3 (breathing title screen + vignette/lighting) — implemented + tested (Batch 3, item 2).**
Pure **draw-time** + **pure testable helpers** at the top of `game.js`
(`titleColorSat`, `titleBreatheSwell`, `titleItemAlpha`,
`warmVignetteAlpha`) — **no new world/player state, no logic change**, so P10
(stage 24) and the pacing probes are untouched. On the **title**: (a) the
living backdrop "breathes" via a draw-only `worldColorSat` swell (0.35↔0.55,
8 s sine — `titleColorSat`); (b) the **title text gently breathes** — a small
scale/opacity oscillation (`titleBreatheSwell`, ~4% over a slow 0.4 rad/s
sine) folded into a transform around the title point (the menu hit-rects are
untouched, so input stays stable); (c) a **frog sits idle on a lily pad** in
the lower-left (reuses J4's watercolor blob pose via `traceBlob` + squash, a
slow breathing bob + occasional blink — `_drawIdleFrog`); (d) **menu items
fade in staggered** (a `_titleShowT` entry clock, reset on each return to the
title via `_quitToTitle`/`_beginExpedition`, driving `titleItemAlpha`).
**Lighting** (in-expedition, screen space): a soft **warm radial glow** around
the frog + a subtle **always-on warm vignette** (quadratic corner falloff,
`warmVignetteAlpha`, edge ~0.16) drawn **under** the existing low-HP red pulse
so the two coexist; the vignette is gated by the existing `options.vignette`
toggle (the color-reveal single-source-of-truth invariant is preserved — the
swell/vignette only modulate the draw, never world state). No new
dependencies. Smoke stage 65: `titleBreatheSwell` is a small bounded
oscillation (starts at rest, peak in (0,0.04], periodic, gentle ~15.7 s/breath
rate), `titleColorSat` oscillates between its bounds, `titleItemAlpha` hides
everything at t=0 / shows all by t=3 and **staggers** (strictly decreasing in
item index at t=0.6, all in [0,1]), `warmVignetteAlpha` is near-clear at the
center (<0.03) and a subtle bounded edge darkening (<=0.22), monotonic toward
the corners. P10 (stage 24) still passes. **v1.4 Batch 3 item 2 (L3) done;
next S1 (final item).**

**v1.4 S1 (melodic per-zone themes — real themes, not just drone) — implemented + tested (Batch 3, item 3).**
A **lookahead step-sequencer** in `audio.js` schedules a short **pentatonic
loop per zone** on a new per-zone melody gain, **layered ABOVE the existing
V3 ambient bed** (the drone stays as the low bed; the melody is a quiet layer
on top). Scheduling is via `ctx.currentTime` lookahead in `tickMusic()`,
driven from `game.js`'s rAF frame loop (a single line after `_frame(t)`) —
**no `setInterval`, no audio files, no new deps**. The melody rides
`melodyMaster -> musicBus` (a new gain, level ~0.32), so it **inherits the
music slider + mute for free**, exactly like the ambient bed. Theme data is a
plain per-zone note array (`_zoneThemeData`): a distinct **root / 5-note scale
/ 16-step pattern / tempo / detune** for each of the 4 zones (+ a safe
fallback), so each zone has its own character (calm / uneasy / folksy / tense).
`setZoneTheme(zoneI)` is called alongside `setZoneAmbient` on zone entry: it
**crossfades** the melody — the current theme's notes stop (muted) and its
zone gain ramps to ~0 over the ~1.6 s crossfade while the new theme ramps up
from ~0 (a list of live themes supports the ~1 s overlap); `clearZoneTheme()`
fades + empties the active loops on run end / quit. `_tone` gained an optional
`target` node (defaults to the sfx bus) so melody notes route through the zone
gain instead of the sfx bus. **No logic / balance / world-sim change** — pure
audio presentation, so P10 (stage 24) and the pacing probes are untouched.
No new dependencies. Smoke stage 66 (headless `AudioContext` stub): the melody
master gain is created + connected **under musicBus** (slider + mute inherited)
at a modest level, a zone-0 loop is created for zone 0, `tickMusic` **schedules
notes** (the step advances), a zone switch starts a LIVE new-zone theme while
**crossfading** the old (muted + fading, both coexist during the fade), the
music slider still scales the melody, the zone themes are **distinct** (a
5-note ascending scale), and `clearZoneTheme` empties the live loops. P10
(stage 24) still passes. **v1.4 BATCH 3 (L2 → L3 → S1) COMPLETE.**

**M13 T1 (guided first expedition) — implemented + tested (v1.2 Batch 5, item 1).**
A **fresh save only** (no finished run, never skipped — `tutorialEligible(save)`
in `logic.js`) sees a "Guided First Expedition" button under "Begin
Expedition" on the title. Clicking it starts `_beginExpedition(true)` — a
**low-stakes teaching run** on the opening zone, NOT the timed expedition:
while the tutorial is active the timed clock is frozen (`runT` held steady so
the 15–20 min measure is untouched), the heron boss is deferred (`_intro`
held), and normal wave spawning halts (all runT-gated). Three coaxed goals are
shown as a **bottom-left on-screen chip** (paper card + pigment swatch +
step counter + SKIP), not a text wall: (a) paint a beetle with RED until it
burns to death, (b) paint a mosquito with BLUE until it freezes, (c) paint a
toad with GREEN until it roots. Each target is spawned just within brush reach
and pinned; the goal **advances only when the real effect lands** — the
advance predicate `tutorialDrillSatisfied(drill, enemy)` in `logic.js` reads
the enemy's real status/death (`status.type`, `_burnedOut`/`deathCause`),
never "a brush stroke happened". **SKIP** (button or Escape/Backspace)
dismisses the whole run at any time and persists `save.flags.tutorialSkipped`.
When all three complete, the heron resumes and the timed expedition begins.
Save schema bumped **`SAVE_VERSION 2→3`**: `freshSave()` gains
`flags.tutorialSkipped` + `tutorialDrills {burn,freeze,root}`, a `SAVE_MIGRATIONS`
`from:2,to:3` step + `normalizeDrills`/carry-forward in `migrateSave` (old v2
saves load unchanged). `game.js` stays thin (wiring + chip draw); the
eligibility/advance predicates + completion state are pure in `logic.js`
(`tutorialEligible`, `tutorialDrillDone`, `tutorialDrillsAllDone`,
`tutorialDrillSatisfied`). Smoke stage 42 asserts: fresh save is eligible +
title shows the button; a returning save (finished run OR skip) is not
eligible + the button is hidden; entering on a fresh save starts the teaching
run with the clock frozen + heron deferred; **each goal advances only on the
real effect** (burn 73f / freeze 24f / root 12f real swipes, predicate false→
true, no spurious advance); a wrong-pigment (blue) stroke never advances the
burn goal; SKIP dismisses + persists to disk + blocks re-entry; and the
eligibility guard refuses the guided path on a skipped OR finished-run save.
T2 (the 'drills' later-phase + `tutorialDrills` persistence) appends to the
same `TUTORIAL_PHASES` run and reuses this chip/advance machinery.

**M13 T2 (interactive pigment drills) — implemented + tested (v1.2 Batch 5, item 2).**
T2 extends the SAME guided run with three **explicit per-pigment "do it"
drills** as a later phase (`TUTORIAL_PHASES` idx 3-5, `phase: 'drills'`),
reusing T1's goal-chip + advance machinery exactly. Each drill requires the
player to CAUSE the effect: (a) a beetle that actually **dies from burn**
(red), (b) a mosquito that actually **freezes** (blue-on-slow chain), (c) a
toad that actually **roots** (green). Advancement reads the enemy's **real
status/death state** via `logic.tutorialDrillSatisfied` (burn = down + burn
status, freeze = `status.type==='freeze'`, root = `status.type==='root'`) —
never "a brush stroke happened." On each drill's completion the run persists
`save.tutorialDrills.{burn|freeze|root} = true` (the schema field was forward-
established by T1's v3 migration; T2 is the first writer) so the "Watch me"
retraining in T3/T4 can reference exactly which drills were completed.
`_tutorialAdvance` now writes `save.tutorialDrills[ph.drill]=true` (guarded,
`SaveSys.save`) only for `phase==='drills'` completions, and shows a
"You know the tools. Now prove each one — do it for real." beat at the
learn→drills juncture. `game.js` stays thin: the advancement predicate +
completion read are pure in `logic.js` (`tutorialDrillSatisfied`,
`tutorialDrillDone`, `tutorialDrillsAllDone`). Smoke stage 43 (T2): the drills
begin after the three learn goals; each drill's predicate is **false before the
real effect** and recorded on the save only once the real status/death lands
(burn 60f real swipe, freeze, root); **partial completion is preserved** —
skipping mid-drills (after burn+freeze) leaves `tutorialDrills = {burn:true,
freeze:true, root:false}` persisted to disk, so retraining can reference
exactly which drills were done. Stage 42 (T1) was extended to drive all six
phases and assert per-drill persistence + `tutorialDrillsAllDone`.

**M13 T3 (mini "sketch" heron) — implemented + tested (v1.2 Batch 6, item 1).**
T3 appends a **final `'sketch'` phase** (idx 6) to `TUTORIAL_PHASES`: after the
three drills the guided run spawns a **low-HP "sketch" heron** (a re-use of the
real heron's `bossStep` + 3-hue awaken machinery at a `SKETCH_HERON` config —
240 HP vs 30000, `awakenNeed {12,12,12}` ≈ 1 hue, `maxPhase 2`, `contactDmg 0`
so it never hurts the frog). It spawns just ahead of the frog and is **pinned in
brush reach** by `_tutorialTick` (so a first-timer can paint it without chasing).
The beat teaches the **3-hue awaken loop**: the player must paint all of red,
blue, and green to **AWAKEN** it — completion is gated on the heron's real
`awakened` flag (the same loop the 30k-HP fight uses), so the real boss is a
"known pattern." On awaken, `_tutorialAdvance` records
`save.tutorialDrills.awaken = true` (the "awaken" progress reference) and the
practice completes → the heron resumes → the timed expedition begins. **SKIP**
during the sketch beat does NOT record `awaken` (finishing is optional) and ends
the run normally. The sketch lives only in the frozen teaching layer
(`runT` frozen, real heron `_intro` held at 999), so it adds **zero** timed-run
time. `game.js` stays thin: the new config + the completion/eligibility
predicates are pure in `logic.js` (`SKETCH_HERON`, `tutorialDone` — all four
drills + awaken, and `tutorialDrillSatisfied`/`tutorialDrillDone` unchanged).
`save.tutorialDrills` **gains an `awaken` field** (schema stays v3 — the field
is carried through the existing v3 `normalizeDrills`/`migrateSave` path, which
now defaults `awaken:false` for legacy saves; no `SAVE_VERSION` bump was needed).
Smoke stage 44 (T3): after the drills the run reaches idx 6 with the low-HP
sketch heron spawned (240 HP, `maxPhase 2`) as the tutorial target; it takes
paint damage; **red alone and red+blue do NOT awaken it** (the loop needs all
three); **all three hues awaken it** → the practice completes the moment it
awakens → `tutorialDrills.awaken=true` persists + `tutorialDone(save)` reads
true; a returning save re-enters the sketch phase; and **skipping the sketch
leaves `awaken=false`** (finishing is not required), clears the heron, and
begins the timed expedition. Stage 42 (T1) was updated: the guided run now has
7 phases, so after the drills it asserts the sketch phase is live (idx 6, heron
target, `maxHp<1000`) and the practice is NOT yet complete. Pacing unchanged:
the sketch is tutorial-only, so `pace.mjs` ~18.7 min and `humance.mjs` 18.7 min
stay in the 15–20 min band.

**M13 T4 (tutorial progress + "Watch me" re-entry) — implemented + tested (v1.2 Batch 6, item 2).**
T4 makes the **Field Guide (H/?)** the reference+retraining tool and gives a
RETURNING player on-demand re-entry into any single lesson. The Field Guide gains
a **"Watch me" retraining band** (drawn in `_drawHelp`; geometry shared via
`_helpGeom()`, so the click target and the visual never drift): four one-click
lessons (burn/freeze/root drills + the sketch heron). **`_startRetrain(phaseIdx)`**
re-enters the guided teaching layer at the requested phase (`retrain:true`,
`runT` frozen at its current value) — **reusing the T1–T3 phases** (the same
`TUTORIAL_PHASES` chips + advance machinery). Completing OR skipping the replay
resumes the timed run at its **exact frozen clock** (a retrain is a paused aside,
never counted), and the real heron's intro is stashed + held at 999 during the
replay, restored exactly on end (a retrain never snaps the boss awake). A retrain
skip does **NOT** set `tutorialSkipped` (the retrain check runs BEFORE the
skip-persistence in `_skipTutorial`, so the flag is never touched on a replay).
**Opt-in + never auto-enters:** a guarded `_startRetrain` refuses to run while a
guided run is already active (no nesting / no hijack), and the guided button only
appears on a fresh save. **Never enters the timed expedition:** the replay only
ever runs inside an in-progress run's frozen layer. Progress is **readable +
persisted** via the existing `save.tutorialDrills` (+ `tutorialSkipped`) — **no
new save field, no v4 migration**. Pure references in `logic.js`:
`tutorialDone(save)` (all four drills + awaken) and `retrainAllowed(save)` (a
returning player with ≥1 completed lesson — a fresh save with no progress has
nothing to replay yet; the guided run itself is the first-time path). Smoke
stage 45: progress is readable per-drill + complete; the band is offered to a
returning save (hidden for a fresh one); clicking a lesson **re-enters that phase
on demand** (the freeze drill, and the sketch heron) with its target spawned; the
frozen clock is unchanged before/after (the replay is not counted); the replayed
drill is recorded; skipping a replay does NOT mark the tutorial skipped; and
`_startRetrain` is a no-op while a guided run is active. Pacing unchanged
(tutorial-only): `pace.mjs` ~18.7 min + `humance.mjs` 18.8 min stay in the
15–20 min band.

**M9 A4 (Rehung Frame) — implemented + tested (v1.2 Batch 2, item 1).**
A permanent, saved **Gallery Bonus** (`save.galleryBonus`, a counter) minted
from the Curator's Ledger (atelier tab 3) when the player **retires a
fully-completed collection** (all 8 paintings owned + ≥1 ★-hung). Prestige-lite,
NOT a save-wipe: the bank + collection stay, and it is **repeatable** (a
counter, not a flag). Each level is a small permanent tuning bump applied via
`makeTuning` → `applyGalleryBonus`: **+2 pigment of each color at run start**
(start ink, granted in `_beginExpedition`, capped at `capacity`) and **+10%
orb/pickup value** (`pickupValue × 1.1` per level). Save schema bumped
`SAVE_VERSION 1→2` with a `SAVE_MIGRATIONS` entry (`from:1,to:2` defaulting
`galleryBonus:0`) plus a normalizer in `migrateSave`, so old saves load
unchanged. Pure logic in `src/logic.js` (`GALLERY_BONUS`, `galleryBonusLevel`,
`canRetireCollection`, `retireCollection`, `applyGalleryBonus`); a compact
"Rehung Frame" bar + Retire button on the Ledger tab (click-map row `retire`,
`_retireCollection()` rebuilds the live tuning). `makeTuning` gains a 4th
`gallery` arg (defaults 0) so the existing callers pass the saved level.
Smoke stage 33 asserts: OFF on a fresh save, ON after a simulated retire
(repeatable), persists across a save/load round-trip, and an old-format save
(no field) migrates without error + legacy fields survive. Stage 19 now uses
`SAVE_VERSION` dynamically. No in-run pacing impact (economy/start only).
Suite green: 33/33.

**M10 E1 (Painted Heron) — implemented + tested (v1.2 Batch 2, item 2).**
A mid-expedition "half-heron" set-piece at the **end of zone 3** (x=0.75 =
4050/5400, Bramble Thicket → Gray Shore) on **Normal+** (Gentle skips it). A
small re-use of the real heron's `bossStep`/`paintBossHit` machinery at
reduced scale: **HP 3000** (~1/10 of the 30000 final), **~1 hue to awaken**
(per-heron `awakenNeed` {24,24,24} vs the final 45 — `paintBoss` now honors
`h.awakenNeed`), **phase escalation capped at 2** (`bossStep` now respects
`h.maxPhase`; the final heron keeps its default 3), and its own `contactDmg`
4. It is **NON-BLOCKING/optional**: dormant until the frog comes within 430px,
then it announces itself (banner) and runs on the shared `bossStep`; the frog
can walk past it, so it never gates the run. On defeat it scatters 3 pigment
orbs and **the run CONTINUES** (no victory/end state). Pure config + gate
(`MID_HERON`, `midHeronAllowed`) in `logic.js`; spawn/update/draw/paint wiring
in `game.js` (`_updateMidHeron`, `_onMidHeronDefeated`, painted identically to
the final heron; drawn via the existing `_drawHeron`). Pacing re-verified on
Normal: pace.mjs ~18.7 min, humance.mjs 16.7 min (cross-swamp 58s unchanged)
→ in the 15–20 min band, so it stays optional on Normal (not gated to
Bold/Hard). Smoke stage 34: spawns on Normal (absent on Gentle), dormant-
until-approach, awaken-need < final, phase cap, **damaged by wet paint**,
**defeat clears it + scatters reward orbs + run continues (no victory)**.
Suite green: 34/34.

**M10 E2 (weather/tide phases) — implemented + tested (v1.2 Batch 2, item 3).**
2 short ambient "phase" events per zone, chosen **deterministically from the
run seed + zone index** (`weatherFor(seed, zoneIndex)` via `mulberry32`, ~60% of
zones get one, the rest stay calm). Each is a transient, eased multiplier
(0.8s ramp-in / 1.2s ramp-out) on the live `makeTuning` fields it targets:
**Rain** (blue `splashRadius` +30% for 20s) and **Drought** (red `burnDps`
+40% for 15s). Pure logic in `logic.js` (`WEATHER_PHASES` table + `weatherFactor`
eased factor + `weatherFor`); `logic.js` now imports `mulberry32` from
`math.js` (no cycle — math.js imports nothing). `game.js` arms the phase on
zone entry (`_zoneI` advance stores `weatherTriggerAt`), and `_updateWeather`
fires it mid-zone (banner via the existing system), applies `base*factor` to
the affected tuning fields each frame, and restores them **exactly** to the
captured base on clean expiry. Non-punishing/informational — it never blocks
or gates the run. Pacing re-verified on Normal: pace.mjs ~18.6 min,
humance.mjs 18.8 min (in the 15–20 min band). Smoke stage 35: pool shape +
durations, factor =1.0 at start/expiry and full mid, deterministic per
(seed,zone), most-but-not-all zones fire, **a phase triggers mid-zone, mutates
the active tuning (splashRadius 58→75.4 x1.3), and expires cleanly back to
base (58===58)**. Suite green: 35/35.

**M10 E3 (Bold-only zone hazards) — implemented + tested (v1.2 Batch 3, item 1).**
Two **environmental hazards** that spawn **ONLY on Bold** and give Bold a
reason to exist beyond harder numbers: a **Thorn Reed** that **roots** the frog
(~1.1s, speed 0) on touch, and a **Mud Pool** that **slows** the frog to ~0.55×
for 2.0s. **Difficulty-gated via `boldHazardsAllowed(difficulty)`** (pure gate
in `logic.js` next to `midHeronAllowed`): Gentle/Normal never spawn them, so the
**15–20 min Normal pacing target is untouched** — because it is difficulty-gated
the pacing probes were **intentionally NOT re-run** for this item (documented
here + in ROADMAP, per the batch plan). Placement is **pure + deterministic per
(runSeed, zone)** in `placeZoneHazards()` (`logic.js`, `mulberry32`-seeded): 2–3
hazards per zone, spread along the zone, in the walkable corridor (y 480–980).
Player slow/root state (`slowT`/`rootT` + a `speedFactor()` accessor) lives on
`player.js` (timed, self-decaying). `game.js` keeps it thin: `_spawnZoneHazards`
(spawn on `_zoneBeat` when Bold), `_updateHazards` (per-frame contact check,
cooled per-hazard so a pool doesn't re-trigger every frame), and `_drawHazards`
(watercolor draw). No new dependencies, no new status system for enemies (the
frog's own slow/root is the only new state). Smoke stage 36 (E3): gate is
Bold-only, placement is deterministic + in-corridor + varies by zone, **hazards
SPAWN on Bold when crossing a zone and NOT on Normal**, thorn reed roots
(speedFactor 0), mud pool slows (speedFactor 0.55) and wears off. Suite green:
36/36.

**M10 E4 (orb-streak bonus) — implemented + tested (v1.2 Batch 3, item 2).**
A **clean-orb streak** — collect pigment orbs without taking a hit — builds a
small multiplier on orb/pickup value. It rewards the dodge/hop skill the PT3
fly-fairness rebalance introduced. The rules are **pure + unit-testable in
`logic.js`**: `ORB_STREAK` (threshold **4 clean orbs**, **+10% per tier, capped
at 4 tiers = ×1.40**) with `orbStreakMult(streak)`, `orbValueAt(streak,
base)`, and `orbStreakState(streak)`. Deliberately modest — a **scoring bonus
adds no run time**, so the Normal 15–20 min pacing is untouched. Because E4 is
an **in-run** change, the pacing probes were **re-run after the change** and
confirm no regression: `pace.mjs` ~18.7 min (analytic), `humance.mjs` **19.2
min full-run / 54s cross-swamp** (real sim) — both in the 15–20 band. `game.js`
stays thin: it owns the in-run counter `orbStreak` (not persisted), applies
`orbStreakMult` to the bankable `collected` total in `_updateOrbs` (floating
`+v ×N.NN` note + a distinct `pickup-streak` chime), and **resets the streak to
0 on any hit** at the central `_prevHp` damage hook. A top-right HUD chip shows
`streak N/4` then `streak ×N.NN` when the bonus is live — it reads the same
pure `orbStreakState`, so the HUD always matches the scoring. A distinct
3-note `pickup-streak` chime (`audio.js`) marks boosted orbs. Smoke stage 37
(E4): no bonus below 4, +10% at 4, plateau at the cap, and in the real loop the
streak **builds on collect, boosts orb value (1.21 vs base 1.10), and resets on
a hit** (then pays base again). Suite green: 37/37.

**M11 V4 (end-screen exhibition) — implemented + tested (v1.2 Batch 4, item 3).**
The **victory** end-screen now shows the paintings the frog carried this
expedition (its **2-slot loadout** — the run's collection) as a small **framed
exhibition**: a "Curator's Wall" of framed pieces, **each titled**, laid out in a
row, with a **soft staggered fade + rise reveal** that animates on `endT` (early
frames show the pieces fading in one by one, so the win lands as a reveal, not a
static card). It reuses the **P8 Gallery Wall frame renderer** (gilded double
border + `_drawPaintingMotif` generative art) + the existing **painting data**
(`PAINTINGS`) — **no new art, no new rendering engine**. Because the exhibition
needs room, the victory card grows to **540px** (defeat stays compact at 430) via
a single `_endCardH()` used by **both** the draw (`_drawEnd`) and the end-state
click rects (input routing), so the "Rest at the Atelier" / "return to the pond"
buttons stay in the same on-screen place in both states. It is **pure
presentation** — no new art, no gameplay change, so **pacing is untouched**.
`game.js` stays thin: `_drawEnd` just reads `save.loadout`, maps it to
`PAINTINGS`, and lays out the frames (the reveal is a pure `endT` function).

Smoke stage 41 (V4) is a **documented headless check** via a `fillText`-recording
canvas (the same technique as stage 32/A3): it drives a real `Game` to the
victory end state with a 2-painting loadout and asserts the victory card is the
taller exhibition height; the two carried paintings' **titles render on the
victory screen**; the exhibition is **mid-reveal early** (alpha ramps in — 0.20
early); at full reveal **both titles render**; **only the carried loadout is
shown** (an owned-but-not-carried painting does not appear); the exhibition is
**victory-only** (absent on a defeat); and the defeat card keeps its compact
height. (The stage clears lingering input state so the end-screen buttons don't
transition to the atelier mid-check.) Suite green: 41/41.

**M11 V3 (per-zone ambient audio bed) — implemented + tested (v1.2 Batch 4, item 2).**
A **soft, looping ambient bed that shifts by zone**, layered under the existing
`musicBus` so it inherits the music-volume slider and mute for free. It is a
**presentation-only audio layer** — it only *adds* sound, changes no gameplay
timing, so **pacing is untouched** (no pace/humance re-run needed).

`audio.js` gains `AudioSys.setZoneAmbient(zoneI)` + `_ZONE_PRESETS()` +
`clearZoneAmbient()`. A persistent `_ambMaster` gain (fixed at **0.6 — a modest
fraction of the music level**) is created once and connected under `musicBus`;
each zone's voices route `osc/noise → (filter) → voiceGain → zoneGroup(zg) →
_ambMaster → musicBus`. Five regions ship: index 0 = the calm pre-first-zone
opening (a quiet water hush), then the four named zones — **Reed Flats** (low
water-drone + soft shimmer), **Slick Hollow** (wind-ish filtered-noise pad + a
fifth), **Bramble Thicket** (a low hum + a beating LFO), and **The Gray Shore**
(sparse chime oscillators + a soft drone, the "everything gathers" zone). Every
voice is **synthesized from the existing WebAudio nodes/oscillators + the pre-
rendered noise buffer** — zero new assets. `game.js` stays thin: `_updateZoneAmbient()`
calls `audio.setZoneAmbient(this._zoneI)` (no-op headless / unchanged), is wired
at **run start** (seed the opening region), on **zone entry** (`_zoneBeat` — the
crossfade point), and **fades out at run end** (`_endRun` → `clearZoneAmbient`,
so the atelier keeps the base music bed but not a zone). Crossfading is
handled by easing the incoming zone group in over ~1.6s while the outgoing zone
fades out and is torn down once quiet; `setZoneAmbient` is idempotent per zone.

Smoke stage 40 (V3) is a **documented headless node-graph check** (no real audio
device available — the stub has no `AudioContext`, so the graph can't *play*; we
verify it *builds*). A mock WebAudio context records every created node, and the
stage asserts: a fresh `AudioSys` has no bed until a zone is entered; **each of
the 5 regions builds a distinct, correctly-sized graph** (2/3/2/2/5 voices incl.
LFOs); the `_ambMaster` is a modest fraction (≤0.6) **wired under `musicBus`**;
the current zone's group gain **feeds `_ambMaster`** (the full chain is really
routed in); entering a new zone **builds a fresh bed (crossfade hand-off)**;
re-entering the same zone is a **no-op (no rebuild)**; the **music slider tracks
the musicBus** (0.5 → 0.8) while the ambient fraction stays its own modest value;
and `clearZoneAmbient()` **tears the bed down** on run end. Suite green: 40/40.

**M11 V2 (heron awaken bloom) — implemented + tested (v1.2 Batch 4, item 1).**
The moment the final heron **turns colorful** (its `awakened` flag flips) the
game plays a short **celebratory bloom**: (1) a **world-space radial color
wash** — `_drawBloom`, three concentric pigment rings (red/green/blue light)
that expand and fade over ~1.1s centered on the heron; (2) a **brief world
saturation surge** — a `_bloomSurge` (peak 0.14, exponential decay ~1.2s) that
is applied **render-only** in `_drawAll` (`drawSat = min(1, worldColorSat() +
_bloomSurge)`), so the world visibly blooms for a moment **without mutating
`world.worldColorSat()`** — the single source of truth the V1 bar and the
terrain paint both read; and (3) a **distinctive `awaken-bloom` SFX** in
`audio.js` (a rising C5-E5-G5-C6 arpeggio + a shimmer octave + a warm low
swell + an airy noise bed) built from the existing `_tone`/`_noise` voices —
no new assets. It is wired to the **real** `paintBossHit → 'awaken'` path in
`_updateExpedition` (the same moment the existing `awaken` SFX + shake + banner
fire), fires **exactly when the flag flips**, and is **pure presentation** — no
gameplay change, so **pacing is untouched** (no pace/humance re-run needed).
The bloom timer + surge tick in the ambient block of `_frame` so the wash
plays even during the post-defeat flight, and both reset at the start of each
run. Smoke stage 39 (V2): no bloom on a fresh run, the heron starts
un-awakened, the bloom fires **during the real paint loop the instant the
`awakened` flag flips** (held left-click over the heron, cycling pigments —
the exact trigger path), it is centered on the heron, the saturation surge is
live (0.140) while `worldColorSat()` is untouched, the bloom **clears once its
duration elapses**, and the surge decays to ~0. Suite green: 39/39.

**M11 V1 (color-reveal progress bar) — implemented + tested (v1.2 Batch 3, item 3).**
A **thin HUD bar along the very top edge** that fills **gray → full color as the
swamp's saturation recovers** this run — the "paint the swamp back to life"
fantasy made legible at a glance. It is a **pure HUD read**: the single source
of truth is `world.worldColorSat()` (the same value the terrain draw uses), fed
through a **pure `revealProgress()` mapping in `logic.js`** that normalizes the
world's real saturation span (gray baseline **0.25 = 0% restored** → **1.0 =
100% restored**), so the bar always matches what the world actually shows and
cannot drift from it. Because it is **pure HUD (zero gameplay change)** it adds
no run time — pacing untouched. `game.js` stays thin: `revealProgress()` just
calls the pure mapping on the world's live saturation, and `_drawHud` draws the
bar (gray track + a green fill whose width + saturation scale with progress,
plus a small "color restored N%" label). Smoke stage 38 (V1): the baseline maps
to 0%, a fully-saturated world maps to 100%, below-baseline clamps to 0%,
mid-saturation maps to mid-progress, progress is monotonic in saturation, a
fresh run reads 0%, the bar value **exactly matches the pure mapping of
`worldColorSat()` at every sample**, and after painting the bar tracks the
restored color to 100%. Suite green: 38/38.

**M9 A3 (Curator's Ledger) — implemented + tested (v1.2 Batch 1, item 3).**
A 4th atelier tab, "Curator's Ledger" (key `4`), lists all 8 paintings in a
2×4 grid. Each entry shows a short lore/collectible blurb and the painting's
state — "collected", "★ hung in the loadout", or "not yet collected" — and
reuses the P8 Gallery wall frame look (paperPanel + gilded frame + the
generative motif) plus the same painting data. It is display-only (no buy
rows). The lore is data-only strings in `src/game.js` (`LEDGER_LORE`,
`ledgerEntry`) — no new art, nothing persisted. Smoke stage 32 uses a
fillText-recording canvas to assert every painting renders with its
collected-state correct (5 "not yet", 2 exact "collected", 1 "★ hung") and
that the tab exposes no buy/hang rows. Suite green: 32/32.

**M9 A2 (painting synergy pairs) — implemented + tested (v1.2 Batch 1, item 2).**
When two specific paintings are both in the 2-slot loadout, a named "duo"
effect activates. `logic.js` gains a pure, unit-testable `SYNERGIES` table
(keyed by the sorted pair key `a|b`, each entry `{ pair, name, desc, apply(t) }`)
and `activeSynergy(loadout)`; `makeTuning` calls it after the per-painting
loadout modifiers so the duo stacks on top of its two parts. Three pairs ship
(only real, consumed tuning fields are modified — no new status system):
**Flooded Night** (moonlit-pond + storm-cloud → `splashCharge ×0.7`,
`splashRadius ×1.15`), **Stormfire** (dancing-salamander + storm-cloud →
`burnDps ×1.4`, `splashDamage ×1.2`), **Royal Meadow** (king-frog +
spring-garden → `greenHeal +2`). The active duo is named in the Atelier's
Paintings-tab legend. Smoke stage 31 (table shape, order-independent
resolution, paired vs unpaired tuning differs, holds across gentle/normal/bold).
Normal pacing intact (default loadout unchanged): `pace.mjs` ~18.7 min,
`humance.mjs` 19.4 min. Suite green: 32/32.

The two most recent passes, for the record:

**M9 A1 (atelier one-liners) — implemented + tested (v1.2 Batch 1, item 1).**
Mabel / Giuseppe / Monet now speak a short, rotating one-liner in the Atelier,
on a pinned paper chip with a typewriter reveal (~28 chars/s). Context
priority: a purchase just made this visit → the last finished run
(victory/defeat) → the player's best run → general banter. Each character has
victory/defeat/purchase/general pools and rotates without repeating the last
line. Pure display data in `src/game.js` (`ATELIER_CHARS`, `_pickAtelierSay`,
`_noteAtelierPurchase`); no new art, no save changes (persisted fields
untouched). Smoke stage 30 (rotation, typewriter clamp, context resolution,
purchase re-roll, nothing persisted). Suite green: 30/30.

**M8 P9 (audio/options polish) — implemented + tested.** The single
master volume is split into **independent music / SFX buses** and the title
gains an **Options** overlay (key `O` or the new "Options" button, right of
the Atelier button) with three sliders (Master / Music / SFX — click or drag)
and two accessibility toggles (Screen shake / Low-HP vignette). Concretely:

- `src/logic.js` — `freshOptions()` now returns `musicVol`/`sfxVol` (0–1) plus
  `shake`/`vignette` (both default `true`); `migrateOptions()` seeds the split
  volumes from the legacy `volume` when absent and clamps/normalizes all four.
- `src/audio.js` — the graph is split under `master` into `musicBus` and
  `sfxBus` (each a `GainNode`). A new **synthesized ambient bed** (`startMusic`
  / `stopMusic`) runs a detuned-pair drone + a slow LFO swell + a filtered
  swish pad through `musicBus`. All SFX now connect to `sfxBus`.
  `setMusicVolume` / `setSfxVolume` drive the two buses independently (the
  `muted` master still wins when on).
- `src/game.js` — the overlay (`_optionsLayout` / `_updateOptions` /
  `_drawOptions`, a shared `_drawSliderTrack`), the `O` key + title "Options"
  button, `shake` gating in `_view()`, `vignette` gating on the low-HP wash,
  and the options state resets on `_quitToTitle`.
- `src/input.js` — a `dragging` slot so a slider can be held and dragged.
- Smoke **stage 29** (layout present, setters drive the bus gains, toggle
  round-trips, save → fresh-Game reload) + real-browser verification (6
  ambient nodes, bus gains track the sliders, no JS errors).

**Next: v1.1 COMPLETE** — all of M7 (B1–B6), M7.5 (PT1–PT5), and M8 (P10, P12, P7, P8, P6, P9, P11) are done and committed. The final item, **P11 (human-pace pacing probe)**, is `tests/humance.mjs`: a god-mode simulation of an imperfect human on the real sim (burst/hesitate walk, Field-Guide zone reads, noisy aim, back-off on heron telegraphs) that *measures* the two tractable components — cross-swamp (~52s) and the heron fight (~134–166s) — and composes them with `pace.mjs`'s analytic wave-fighting. Full-run estimate **18.3–19.4 min across seeds 1337/7/42/2026**, in the 15–20 min target, and both measured components are more conservative than pace.mjs's flat multipliers (sim cross 52s vs analytic 38s; sim boss 134–166s vs analytic 136s), so the target holds. Smoke: 29 stages green; pace/humance/bosspace probes all run.

- (recorded) **PT1 — painting consumption (verified, no code change).** The plan flagged
  "painting might be free / infinite wet." Audit result: swipes and splashes
  are already rate-gated — `swipeCd = tuning.swipeCooldown (0.2s)` arms on every
  fire and blocks re-fire until it expires; the charged splash requires
  `splashCharge → 1.0` (a ~1.2s build) then a `splashCooldown (0.9s)` and fires
  only once. In-run wet pigment is intentionally unlimited (B3 design), so
  "consumption" = the attack *rate* gate, which holds. Smoke stage 21 asserts
  the swipe cooldown arms, re-fires are refused, and the swipe rate is bounded
  to ~floor(budget/cd) (10 in 2s @ 0.2s cd), and splash is refused at 0 charge.
- **PT2 — onboarding (first-run flow clarified).** The 5-step first-run
  tutorial runs to ~36s, but the Great Gray Heron boss reveal fired at 6.5s —
  mid-tutorial — so a newcomer met the boss before finishing the lesson.
  **Before:** `heron._intro = 6.5s` on first run. **After:** `heron._intro =
  38s` (just after the last tutorial step) on first run; returning players
  unchanged at 3.2s. Verified with the `onb` scenario: first-run banners now
  read the welcome-kit + movement lesson (no premature "THE GREAT GRAY HERON").
- **PT3 — fly/dodge fairness (rebalanced).** The Space-hop is the frog's only
  air-dodge. **Before:** no cooldown and effective i-frames
  (`hopIframes 0.18 + 0.12 = 0.30s`) exceeded the 0.22s hop duration, so
  mashing Space chained into near-continuous invulnerability. **After:** added a
  stamina cooldown `hopCooldown = 0.7s` that must expire before the next hop;
  hop i-frames and range are unchanged (a single hop is still a real dodge).
  The frog now dodges ~1.4×/s instead of unlimited. Smoke stage 22 asserts the
  cooldown arms, an immediate re-hop is refused, the timer counts down, and the
  hop re-arms once it expires.
- **PT4 — early-economy safety net (welcome grant).** A brand-new player who
  died early banked ~0 pigment (`deathKeepFraction 0.5`, `floor`) and could not
  afford anything — a soft-lock. **Before:** fresh bank {0,0,0}. **After:** a
  one-time `WELCOME_GRANT = {red:3, blue:6, green:4}` (+13 pigment) is granted
  on the first expedition (pure `applyWelcomeGrant` in logic.js, gated on
  `flags.welcomeGranted`). A fresh save can now afford ≥1 upgrade and ≥1
  painting (verified: capacity lvl1, vitality lvl1, moonlit-pond, self-portrait
  all affordable). Smoke stage 23 asserts the grant is one-time/idempotent and
  leaves the bank strictly positive.

Full plan: `docs/PLAN-v1.1-next.md`.

## Known risks / open questions

- Smoke stage 16 asserts the title start-button label — P7 (difficulty select on title) will touch the same UI; update the stage when implementing.
- P10 culling (this pass): guarded by smoke stage 24 (draw-cull ratio + enemy
  AI-cull behavior) and a real-browser 60fps probe. Keep future world-decor
  loops culled to the view rect so 60fps holds as density grows.
- `browser_exec` is still dead; visual verification (P8, P12, zone art) relies on `desktop_preview` or screenshots via the dev server / the headless driver (`tests/headless.mjs`).