# Frogue Gallery — Project Status (PM)

Concise PM view. Durable status/next-action detail lives in root
`PROJECT_STATE.md` (read that first); milestones in `docs/ROADMAP.md`;
consequential decisions in `docs/DECISIONS.md`.

**Last PM audit: 2026-09-09 (v1.9 "The Living Swamp" — **A1 — the v1.9 quality
audit, the season's final gate** (FRESH session `v19-a1` — the implementer does
not sign its own work): every line item GREEN, so v1.9 is marked COMPLETE and
the season is signed off. Ran the full A1 spec: `node tests/smoke.mjs` **10/10
consecutive PASSED** (a 10-run flakecheck, 0 failures; exceeds the ×3 ask; the
`144fb1c` determinism pin green; 108 stages) / all **9 pacing probes IN band
UNCHANGED** (pace ~16.9–17.3 / humance ~18.4 / ngpace cycle-1 19.5 / bosspace
heron 37.0s god / reedspace ~22.1 / wandpace both legs 16.9–17.8 + 21.6–22.7
(8/8 in band) / wardpace 3.9–4.0 / blackpace ~25.9 / umbrapace ~3.71 — and
**"unchanged" proven, not assumed: the identical 9 probes re-run in a baseline
worktree at `6c9e09e` give the same distributions, and all 9 probe files +
`src/logic.js` are byte-identical to `6c9e09e`** — the probe variance is
inherent (it imports the real game's seeded world), not a v1.9 move) /
**the load-bearing invariant holds: `git diff 6c9e09e..HEAD -- src/logic.js` is
EMPTY** (blob `e742877` == `6c9e09e` — every v1.9 item is presentation-only) /
the dev checks green (`node tests/sfx.mjs` SFX TESTS PASSED · 44 bank names;
`node tests/music.mjs` MUSIC TESTS PASSED · 143 asserts; `node tests/ui.mjs`
UI TESTS PASSED · 78 asserts) / **P10 culling WITH the new layers active**
(the view-cull + AI-cull + ≤220 particle budget are green with hitstop +
droplets + kill-bursts + the L1 environmental layer all on — stages 59b/59c/
107/108/109/110/111 present + green) / the frame-evidence set is COMPLETE
(36/36 baseline frames re-captured non-trivial + 26 after-frames across
after-J1/2/3/4 + after-L1/2/3) + **the by-eye frame review** (a headless
font-discipline audit over 308 text draws across 8 scenes — the 6 UI-heavy
screens + gameplay — confirms the L4 identity pass is coherent: every draw is
Georgia serif or one of the three NAMED exceptions, zero typeface drift, zero
off-scale sizes) / **zero new runtime dependencies** (the `6c9e09e..HEAD` diff
touches only `.gitignore`/`docs/`/`src/`/`tests/`/`PROJECT_STATE.md`; no
package.json/lockfile; `node_modules` untracked) / SAVE_VERSION stays 12,
GAME_VERSION '1.0.0' / **no `http.server 8765` left running** (netstat before +
after). **One finding, recorded honestly (PRE-EXISTING, NOT a v1.9 regression,
routed to the post-1.0 backlog):** the title/options footer text + the
end-recap "return to the pond (Esc)" label render at/below the 800px canvas
bottom (lower ~3px clipped / partially off-canvas) — the A1 by-eye audit
surfaced it; v1.9 (L4) changed ONLY the font-string literal to the same-size
`uiFont()` call, so the footer y-geometry is byte-identical to `6c9e09e` (it is
pre-v1.9). Full measured table in the v1.9 block below + `docs/ROADMAP.md`
§v1.9 A1.**

**Last PM audit: 2026-09-08 (v1.8 "The Full Collection" Batches 1+2 — **G1 + G2 + G3 (Batch 1) AND H1 + H2 (Batch 2) LANDED** (session v18-h; 5 commits `4ec7d07` / `49f74a8` / `3b5949d` / `7be0d5f` / `c57b4d0`): the BLACK REEDS NG+ Reeds variant (`REEDS_DARK` layout — a deeper 7200px descent, a denser Wisp/Serpent/Leech bestiary, a 4th gravity pocket, a deeper/slower flood band, its own darker `REEDS_DARK_LANTERN` economy) + the UMBRAL WYRM 6th boss archetype (~60k HP, a dual-phase Silt-Wyrm twin with a telegraphed DUAL maw + a "deep dark" final phase where the lantern is mandatory, the Warden fuel-siphon + the Wyrm flood-pocket, 3-hue awaken) + the end-of-Reeds-boss selection wiring (Umbral [NG+ Reeds] vs Silt [cycle-0] vs Warden [Wander × Reeds]) + two new probes (`blackpace.mjs` ~25.8 min IN 22–26 / `umbrapace.mjs` ~3.9 min IN 2.5–4). **THEN Batch 2 (H1 + H2): the gallery FULL-COMPLETION capstone — the release headline.** H1 `7be0d5f`: a NEW `logic.js` `GALLERY_COMPLETE` tuning + a pure `galleryCompletion(save)` check (all 10 paintings owned — 8 base + 2 gold-tier — + every boss defeated at least once [gray/green/gilded/Silt Wyrm/Warden/Umbral Wyrm] + a first-time victory + a Reeds victory) + `galleryCompletionProgress(save)` + the one-time completion cinematic (reusing the M1 first-victory beat machinery, tagged `.collection`) + the "Rehung Frame" `galleryBonus` meta promoted to the CAPSTONE (a permanent saved `galleryBonus` level minted once at Full Collection — "the museum keeps you better", applied through the EXISTING `applyGalleryBonus` path so `makeTuning` is untouched). A NEW `save.galleryComplete` latch + `save.flags.bossDefeats` list (SAVE_VERSION **11 → 12**; the v11→v12 migration + per-field normalization defaults both OFF/empty for every legacy save). H2 `c57b4d0`: the existing Atelier Gallery tab gains a progress readout (X/10 paintings · Y/6 bosses) + a full-collection gold glow behind the 10-frame wall (procedural only), and the title screen gains a "collection complete" badge (gated on `galleryComplete`). **The H1/H2 invariant held: `makeTuning` output is byte-identical when `galleryComplete` is false (verified in smoke); every probe re-verified IN band UNCHANGED — pace ~17.2 / humance 19.2 / ngpace 19.4 (15–20), bosspace heron ~0.62 min, reedspace ~22.2 min + Silt Wyrm 3.9, wandpace 16.9–17.8 / 21.6–22.7, wardpace 3.9–4.1, blackpace ~25.8 (22–26), umbrapace ~3.9 (2.5–4) — H1/H2 are meta + presentation and add no timed-run time.** smoke **105 stages green (103 + the NEW H1/H2 stages 104/105), deterministic**; a v11 save migrates to v12 with the new fields DEFAULTED OFF and plays byte-identically (a synthetic all-complete save qualifies exactly once — the latch is idempotent); the `144fb1c` flake-pin stays green; zero new deps; no 8765 server left running. **Next: A1** (the 1.0.0 season audit — the final gate, in a FRESH session). Batch 3 (session v18-r, 2 commits): R1 `119a0f1` the release surface — `README.md` (the game's first: the one-liner + the "painting is the game" pillar, how to run, the controls re-verified against `input.js` + the `GAMEPAD_MAP`, what's in the game, the meta loop, the architecture note) + the `1.0.0` version string from a single display-only source of truth (`GAME_VERSION = '1.0.0'` in `logic.js` beside `SAVE_VERSION`), rendered on the title corner ("Frogue Gallery · v1.0.0") + the Options header line, with a smoke stage asserting the value is `'1.0.0'` and referenced; R2 `docs/CHANGELOG.md` (NEW, the full release history 1.0.0/v1.8 → v1.1 → the tutorial-era milestones with representative SHAs + the `SAVE_VERSION` history) + `docs/DECISIONS.md` rows 15–18 (the Black Reeds gating, the Umbral Wyrm band + deep-dark lantern mandate, the Full Collection criteria + capstone-over-bonus + 11→12 migration, the 1.0.0 versioning choice). R1/R2 are presentation + docs only — smoke 106 stages green (105 + stage 106), every pacing probe re-run IN band UNCHANGED, no 8765 server left running. Earlier: v1.7 "The Ever-Shifting Swamp" COMPLETE — all 9 items D1–D4 + F1 + O1 + O2 + I1 done and committed; the I1 season audit (final gate, clean fresh session) re-ran every probe on the committed tree and all are IN band — smoke 101 stages green ×3 + 10/10 flakecheck; pace 17.3 / humance 18.7 min (IN 15–20, hand-tuned Wander OFF); ngpace 19.5 (IN band); reedspace 22.2 (IN 20–25) + Silt Wyrm 3.9 min (IN 2–4); wandpace both legs (16.9–17.8 IN 15–20 / 21.6–22.7 IN 20–25, 8 seeds); wardpace the Hollow Warden 3.9–4.1 min human (IN the documented 2–4 min class, comparable to the Wyrm); byte-identity confirmed (`makeTuning` deep-equals v1.6-complete `f746938`); zero new deps; SAVE_VERSION 11; no 8765 server left running. **v1.7 COMPLETE — no open scope. Batch order + full I1 audit table in PROJECT_STATE.md → Next Action + ROADMAP §v1.7.** Earlier: v1.1 + v1.2 + v1.3 + v1.4 "Make It Amazing" COMPLETE; v1.5 "The Living Swamp" COMPLETE — all 10 items K1–K10 done and committed (smoke 80/80; first-time pace 17.4 / humance 18.0 IN the 15–20 band; NG+ cycle-1 19.5; SAVE_VERSION 9). **v1.6 "Beneath the Reeds" COMPLETE (2026-09-07; Joel: "Plan and execute 1.6" — execution pre-approved; all 13 items done and committed): 13 items, 4 modules (R1–R6 biome / W1–W3 gamepad / Q1–Q3 QoL / A1 audit) in `docs/ROADMAP.md` §v1.6 — victory-gated new biome + THE LANTERN mechanic, 3 light-keyed creatures, the 4th boss archetype (The Silt Wyrm), raw-Gamepad-API gamepad support, 3 QoL items, final regression audit. Deferred items folded in: gamepad + 4th boss archetype. **ALL FOUR BATCHES COMPLETE** — BATCH 1 (R1+R2+R5, smoke 85/85), BATCH 2 (R3+R4+R6, smoke stages 86/87/88), BATCH 3 (W1+W2+W3 gamepad, smoke stages 89–91), BATCH 4 (Q1+Q2+Q3 QoL + A1 audit, smoke stages 92–94). Final suite **94/94 green ×3**; first-time **pace 17.3 / humance 18.1 min (IN 15–20)**; NG+ cycle-1 **19.5 min (IN band)**; Reeds run **~22.2 min (IN 20–25)** + Silt Wyrm **~3.9 min human (IN 2–4)**; P1... [truncated]

## Current state

- Release DoD: **all 12 items satisfied** (final audit 2026-09-05).
- **v1.1 COMPLETE**: M7 (B1–B6), M7.5 (PT1–PT5), M8 (P10/P12/P7/P8/P6/P9/P11).
- **v1.2 "The Collection" COMPLETE** (2026-09-06): M9 Atelier/collection,
  M10 Expedition depth, M11 Presentation, M13 Tutorial (accessibility
  deferred). Batches 1–6 all done; suite 45/45; pacing 18.7/18.8 min.
- **v1.3 "The Second Expedition" COMPLETE** (2026-09-06): NG+ loop M14 (N1–N4), gold meta economy M15 (G1–G4), season wrap M16 (C1–C4).
- **v1.4 "Make It Amazing" COMPLETE** (2026-09-07): all 14 items (J1–J5 juice, L1–L3 presence, S1–S3 audio, M1–M3 moments) + the Joel color rework (`012ce0b`: red big-dmg+burn / blue freeze / green light-dmg+heal / dry cleanse+world-restorer / mosquito nerf). Smoke 71/71; pacing 17.3/18.3/19.5 min.
- **v1.5 "The Living Swamp" COMPLETE** (2026-09-07 — all 10 items K1–K10 done; Joel, 2026-09-06: "Don't even pitch me v1.5. Just make it") — K1–K10 in `docs/ROADMAP.md` (new enemy archetypes, zone-5 Storm Surge set-piece, 3rd NG+ boss The Gilded Heron, 3 new modifiers + Master tier, seeded daily Curator Challenge + Masterpiece reward, Field Guide updates, full audit). Batch order (one commit per item) in `PROJECT_STATE.md` → Immediate Next Action: 1) K1→K2→K3 ✅, 2) K4 ✅ (Gilded Heron) → K5 ✅ → K6 ✅, 3) K7 ✅ (Curator Challenge) → K8 ✅ (Masterpiece reward), 4) K9→K10. First-time Normal run stays 15–20 min — new creatures scale into zones 3+ and NG+ (re-verify on any in-run change).
- **v1.8 "The Full Collection" — COMPLETE (2026-09-08; the 1.0.0 release):** G1–G3 (Black Reeds + Umbral Wyrm: `4ec7d07`/`49f74a8`/`3b5949d`) + H1–H2 (Full-Collection capstone + Gallery Wall completion beat: `7be0d5f`/`c57b4d0`) + R1–R2 (README + `1.0.0` version string + changelog + DECISIONS close-out: `119a0f1` + the R2 docs commit) + **A1 — the 1.0.0 season audit (fresh session v18-a, on the committed tree `6e87cd8`)** — every gate green: smoke **106/106 ×3 + a 10-run flakecheck** (144fb1c pin) / every probe IN band UNCHANGED (pace ~17.4 / humance 16.7 / ngpace 19.5 / bosspace 37.1s god / reedspace ~22.2 + 97.7s / wandpace 16.9–17.8 + 21.6–22.7 / wardpace 3.9–4.1 / blackpace ~25.9 + 105.5s / umbrapace ~3.89) / **byte-identity proven across 216 arg combos** (`makeTuning` + `applyNGPlus(1)` deep-equal v1.7-complete `34eeda2`) / SAVE_VERSION 11→12 migration verified (v11 + v1-era → v12, play-identical) / zero new deps since `34eeda2` / P10 green / GAME_VERSION 1.0.0 in logic.js referenced by title + Options / README spot-checked / no 8765 left. **v1.8 = the 1.0.0 release — the game's Full Collection.** No open v1.8 scope; the post-v1.8 deferred list lives in `docs/ROADMAP.md`.
- **v1.9 "The Living Swamp — The Quality Pass" — COMPLETE (2026-09-09; all 13 items T0/S1–S3/J1–J4/L1–L4 + A1 LANDED — the season's quality pass, signed off by the A1 fresh-session quality audit `v19-a1`, every gate GREEN):** T0 (the frame-evidence harness `node tests/frames.mjs` + the v1.9-baseline 36/36 frame set, `6eb246d`) + **S1 (the SFX bank, `f765b61`) LANDED** — the core paint verb (surface-aware swipe/splat + the charged `charge-splash`), per-creature hit/death (6 archetypes; turtle/cragfrog fall back to the generic sting), status on/off (ignite/blip/thud + burn-out/freeze-release/root-crackle + the dry-scrub status-off + the heal chime), pickup/UI (`ui-hover`, `pause-open`/`pause-close`), the boss stings (`boss-phase` shared across all 4 archetypes + `boss-kill` + `collection-fanfare`) — **62 total sfx cases**, all sfxBus-routed through the existing `_tone`/`_noise` + the `_sfxCanStart` cap; evidence is `tests/sfx.mjs` (standalone, `SFX TESTS PASSED` — 44 bank names + routing + the voice cap; the full trigger manifest is in the commit message). Invariant held: `makeTuning` byte-identical (logic.js untouched), SAVE_VERSION 12, smoke ALL PASSED, all 9 probes in band UNCHANGED (pace ~18.7 / humance 18.5 / bosspace 37.0s). + **S2 (music dynamics, `9ad0618`) + S3 (ambient life audio, `7ec519c`) LANDED** — S2: distinct per-biome zone themes (a real Reeds set: low/watery/slow wet-minor drone; a Black Reeds set: darker/lower/sparser; the swamp set byte-identical to the v1.7 baseline) + a pure `themeSelector({ zone, bossEngaged, lowHp, collection }) -> { themeId, patternDensity, extraVoices }` (patternDensity = real active-step count, boss > zone = "denser = more intense") + the INTENSITY/DANGER layer (a low boss off-beat pulse, a sparse high uneasy low-HP ostinato below ~30% HP that fades out above it, a brief zone-entry swell, and the Full-Collection chord swell — all on `melodyMaster -> musicBus` so the music slider + mute inherit; `bossPhaseUp()` swaps the live boss loop to a denser/faster pre-built phase-2 variant). S3: a pure `nextAmbientEvent({ biome, rng, t }) -> { type, flavor, t } | null` sampler (seeded mulberry32; deterministic in node) driving sparse ambient-life events — insect chirps / water drips (WET-biome-only: reeds/blackReeds) / wind-in-the-reeds / a rare distant heron call — all on a new `_ambLifeMaster` bus -> musicBus (slider + mute inherit); the `stepAmbientLife(dt)` stepper runs the sampler from the rAF tick (NO setInterval, at most one voice/s — P10; headless no-op, never feeds runT). Evidence: `tests/music.mjs` (the S2 + S3 sections — the right theme/density per state, sparsity, biome-gating, determinism, kind/flavor validity + the melodyMaster/ambient-bus -> musicBus routing). Invariant held for both: `makeTuning` byte-identical (logic.js untouched), SAVE_VERSION 12, smoke ALL PASSED, all 9 probes in band UNCHANGED. + **J1 (hitstop, `bd02f38`) + J2 (the paint arc, `e4ffff0`) LANDED** — J1: a real-time timeScale dip on the PRESENTATION clock (reuses the v1.4 `hitStop`): a 40–70 ms swipe-connect hitstop, a ~110 ms charged-splat + enemy-KILL hitstop, a ~30 ms self-damage hitstop, a white-hot impact rim at the frozen instant + the struck enemy's body flash (set `e.hitFlash`, which was previously never set for regular enemies); **the v1.9 J1 smoke stage (stage 59b) proves it is PURE PRESENTATION** — an A/B run (hitstop on vs `hitStop→no-op`) over identical fixed dt + a pinned seeded target shows the connect's rule outcome is byte-identical (beetle hp 191 both runs) while the hitstop dilates the presentation clock (A's game-time 0.0434s < B's 0.0668s over 4 real frames) — the dilation stretches real wall-clock, never the game clock the 9 probes measure (frame evidence `tests/frames/after-J1/{beetle,toad}-hitstop.png`; the before/after cream-body flash rises 36→1033 / 40→1277 px, so the frame reads as IMPACT not a pause). J2: the core paint verb upgraded — the swipe ribbon now BOWS into a curved arc (bezier control point, not a flat start→end line), **pooled** in-flight ink droplets (velocity + gravity + settle, capped at 48, a separate pool so the P10 particle budget is untouched), the charged-slate feel (a charged splat throws 12 droplets vs a swipe's 5 + a wider/denser arc + a denser landing), and **ink that LANDS** (painted soil darkens — a short-lived wet blotch — and painted water ripples — a spreading ring — via the existing `paintSurfaceAt`). All J2 presentation is deterministic (seed/position-hash derived — ZERO new `Math.random` draws on the paint path, so the seeded RNG stream + the J1 A/B invariance stay untouched); the **v1.9 J2 smoke stage (stage 59c)** asserts the curve control point, pooled+capped droplets, the charged > swipe droplet count, the ink landing (soil blotch vs water ripple), and the **P10 budget ≤ 220** (120 after a full-power burst); frame evidence `tests/frames/after-J2/{arc-red,arc-blue,arc-green,arc-water,arc-charged}.png`. Invariant held for J1 + J2: `makeTuning` byte-identical (logic.js untouched — `git diff -- src/logic.js` empty), SAVE_VERSION 12, smoke **ALL PASSED** (96 top-level stages, incl. the new 59b + 59c), all 9 probes in band UNCHANGED (pace ~17.2 / bosspace 37.0s / humance ~18.5 / ngpace ~19.5 / reedspace ~22.2 / blackpace ~25.8 / wandpace 16.9–17.8 + 21.6–22.7). **J3 (kill quality, `a93cd2e`) + J4 (the frog's liveness, `8a22d46`) LANDED** — J3: every death is an ink burst (a separate draw-only pool in paint.js, position-seeded + capped at MAX_INKBURST=192); a paint-kill takes the killing pigment's tint (a neutral splat if never painted), the boss kill pops a LARGER two-burst (its last-painted pigment + a neutral ring) + a brief camera hold; a full wave + boss stays ≤220 (the P10 budget) and the burst decays to 0. Smoke stage 107 asserts the 22/64-blob bursts, the cap, the ≤220 budget, the decay-to-0, and determinism. Frame evidence `tests/frames/after-J3/{toad,beetle}-kill-burst.png` + `boss-kill-burst.png` (before = `enemy-toad.png` / `enemy-beetle.png` / `boss-gray-heron.png`). J4: the frog reads as LIVING (all draw-only) — an IDLE BREATHE (a subtle dt-accumulated squash when standing still), a HURT STAGGER (a wobble + flinch on damage, over the J1 hitstop, no i-frame change), a LOW-HP TREMBLE (faint jitter + desperate narrowed eyes + a worried brow below ~30% HP, fading above), and a VICTORY POSE (a small contented hop + squash-and-settle set by the real `_onHeronDefeated` at full 1.0). Smoke stage 108 (16 assertions) proves the breathe/stagger/tremble/victory are draw-only (i-frame window + damage are the rule values). Frame evidence `tests/frames/after-J4/{frog-idle-breathe,frog-hurt-stagger,frog-low-HP,frog-victory-pose}.png` (before = the baseline idle frog `title.png`). Invariant held for J3 + J4: `src/logic.js` byte-identical (`git diff -- src/logic.js` empty), SAVE_VERSION 12, smoke **ALL SMOKE TESTS PASSED**, all 9 probes in band UNCHANGED (pace ~17.2 / bosspace 37.0 s / humance simulated cross ~57 s + boss ~351 s — vs baseline 37.1 s, run-to-run variance only). + **L1 (environmental life, `ed8f2fa`) LANDED** — the living-world / parallax layer-0 (the first of L1–L4), all **PRESENTATION-ONLY** (the load-bearing invariant held: `src/logic.js` byte-identical to `6c9e09e`, SAVE_VERSION 12, GAME_VERSION 1.0.0): **breathing mist** (a slow ~9 s alpha/offset oscillation `mistBreath` on the existing v1.4 parallax bands — the MIST_BANDS constants untouched so the v1.4 L1 stage 63 still passes), a small twinkling **ambient firefly swarm** (Reeds / Black Reeds only, a SEPARATE pool from the lantern light-economy fireflies), **drifting pollen** (swamp only), and **surface ripples** on the open-water bands (every world). SEEDED (a dedicated `mulberry32(seed + 731)` stream built once in `World.build()`; motion a pure f(now) — no global `Math.random` in the hot path, no per-frame allocation) + POOLED + view-culled (pollen 14 / ambient fireflies 18 / ripples 13; the cull identical to `ambientCounts`) so the on-screen total stays capped into the existing P10 particle budget (combined paint-juice + ambient ≤ 220 asserted in smoke) and the v1.4 "one drawImage per zone" parallax-band draw budget is untouched. New smoke **stage 109** (14 assertions): determinism at a fixed seed + seed variance, the Reeds-ambient / swamp-pollen pool split, the pool caps + view-cull, the P10 combined-on-screen cap with the layer on, and the mist-breathing oscillation. Frame evidence: 4 after-L1 scenes — `tests/frames/after-L1/world-mist-a.png` + `world-mist-b.png` (SAME world + camera ~2.2 s apart, **md5-differing = the mist BREATHES**) / `world-fireflies.png` (the Reeds ambient swarm) / `world-pollen.png` (the swamp drifting pollen). Invariant held: all 9 probes in band UNCHANGED (pace ~17.2 / humance ~18.9 / ngpace cycle-1 19.5 / bosspace 37.0 s / reedspace ~22.1 / wandpace both legs / wardpace ~3.9 / blackpace ~25.7 / umbrapace ~3.66). + **L2 (the lighting pass, `35c3d78`) + L3 (enemy liveness, `7bcdcd1`) LANDED** — both PRESENTATION-ONLY (the load-bearing invariant held: `src/logic.js` byte-identical to `6c9e09e`, SAVE_VERSION 12, GAME_VERSION 1.0.0, no new deps). **L2:** three draw-time light sources — a CHARGED-PAINT GLOW (a soft radial on the brush tip that scales with `splashCharge`, brightest at full charge), an AWAKEN HALO (the boss's Awakened state carries a warm gold light halo, a pulsing radial behind it), and the BASE-SWAMP LIGHT POOLS (the parked "lantern in the swamp" done as PURE LIGHT — no fuel, no mechanics; a handful of soft warm light pools baked into the swamp ground that read as the path glowing faintly as the frog travels). The pools are SEEDED (a dedicated `mulberry32(seed + 1571)` stream built once in `World.build()`; the A/B invariance holds), POOLED (capped at `SWAMP_LIGHT_POOL_CAP` = 6), VIEW-CULLED (`swampLightCounts` + `drawSwampLightPools` cull to the view → the on-screen total stays capped into the existing P10 budget), a BAKED-ONCE glow sprite (one `drawImage` per pool, no per-frame gradient allocation), and BASE-SWAMP ONLY (a Reeds variant's pool is empty → the draw is a no-op, a Reeds run renders exactly as before). The frog carries a faint glow trail (the v1.4 warm frog glow already provides this under the always-on vignette; the new pools add the ambient world-light). New smoke **stage 110** (14 assertions): the light-pool layout is a pure function of the seed (two builds at a fixed seed identical; a different seed differs), the base-swamp / Reeds variant split, the pool cap + view-cull, the no-op on a Reeds variant (0 `drawImage` calls), one `drawImage` per on-screen pool, the cached-sprite reuse (a second draw does not re-bake), and the P10 paint-juice cap (≤ 220) with the pools active. Frame evidence: 4 after-L2 scenes — `tests/frames/after-L2/swamp-light-pools.png` + `swamp-light-pools-b.png` (SAME world + camera ~1.4 s apart, **md5-differing = the pools BREATHE**) / `charged-paint-glow.png` (the brush radial at full `splashCharge`) / `boss-gray-heron-awaken-halo.png` (the boss's Awakened-state light halo). **L3:** distinct SEEDED telegraphs + panic/lick/flee, all **PRESENTATION-ONLY** draw-state computed in `l3Draw` (a pure, allocation-free function of `e._seed` / `e.tintT` / `e._light` / `now` — writes scalar fields `_l3dx` / `_l3dy` / `_l3scale` / `_l3crouch` / `_l3lick` on the enemy; NEVER writes `e.x` / `e.y` / `e.r` / `hp` / `dmg` / `status` / the RNG stream). The behaviors: **beetle LOWERS** (a slow crouch down a few px once per ~2.6 s + a dirt "dig" tell at its base), **toad INFLATES** (a brief body puff once per ~3.2 s), **mosquito WIDENS its weave** (an extra horizontal sway that swells for a beat; the collision body `e.x`/`e.y` is untouched — only the rendered sprite sways), a **PANIC state** (a freshly-painted, NOT-frozen creature briefly DARTS away a few px, fading as `tintT` decays; direction is seeded per enemy), a toad **LICKS the paint off** its own back between attacks (a tongue flick + pigment bead, tint-driven), and a wisp **DRIFTS AWAY from the lit lantern** (a small sway whose amplitude grows with the light it receives; unlit = no-op). The A/B swipe in smoke **stage 111** proves the dart / lick never changes a hit or a kill: a painted panicking beetle with the L3 dart ACTIVE (`_l3dx ≠ 0`) is swiped and the outcome (hp / status / damage / death timing) is byte-identical to the same swipe with `l3Draw` bypassed. The P10 AI-cull is unaffected (the l3Draw layer feeds no movement — a near enemy still seeks, a far enemy is still AI-culled). New smoke **stage 111** (18 assertions): the seeded determinism (3 enemies × 3 seeds → identical `_l3*` fields at a fixed `now`), the seed variance (a different seed differs), the A/B invariance (l3Draw on vs off → identical swipe outcomes), `l3Pulse` bounded 0..1, `l3Draw` does NOT move the collision body (a near + a far enemy's `e.x` are unchanged by the liveness layer). Frame evidence: 4 after-L3 scenes — `tests/frames/after-L3/beetle-lowers.png` (the crouch + dig tell) / `toad-inflates.png` (the body puff) / `mosquito-weave.png` (the widened weave) / `wisp-flee-from-lantern.png` (the wisp fleeing the lit lantern). Invariant held for L2 + L3: all 9 probes in band UNCHANGED (pace ~17.2 / humance ~18.3 / ngpace cycle-1 19.5 / bosspace 37.1 s / reedspace ~22.1 / wandpace both legs / wardpace ~3.9 / blackpace ~25.7 / umbrapace ~3.6). + **L4 (the visual-identity pass, `4877487`) LANDED** — ONE shared UI grade across every screen, PRESENTATION-ONLY: a module-level `UI` object in `src/ui.js` is the single source of truth — the paper/ink **palette** (the `INK`/`PAPER`/`PAPER_DARK` consts now derive from it), **3 named typefaces** (ONE `Georgia, serif` voice + a NAMED `display` cursive exception for the title/banner buttons + a NAMED `mono` `Courier New` exception for the save-blob preview field), and a **25-step named type scale** (`UI.sizes.micro…megaLg`); a **memoized** `uiFont()` factory is the ONLY way the UI builds a font (P10: bounded memo cache ⇒ steady-state allocation-free, matching the pre-L4 interned-literal profile). Every **~195 static** UI font site across game.js (title/options/atelier/gallery/seed-card/recap/HUD/pause/banners) + enemies.js (serpent "!" telegraph, crag-frog "z") + paint.js (hit-notes) routes through `uiFont(UI.sizes.<step>, …)` — **zero raw font literals remain** (3 dynamic sizes = documented exceptions). **Rendering-identity proven:** `uiFont()` reproduces every pre-L4 font string byte-for-byte (196/196 literals map identical) + NO color value changed across the diff ⇒ a pure consistency/centralization pass, provably rendering-identical to pre-L4 (full T0 frame set re-captured 36/36; 6 UI-heavy screens spot-checked — the frame harness is pixel-NONDETERMINISTIC on this GPU, so the byte-identity proof is the authoritative evidence, not an md5 diff). Acceptance: new `tests/ui.mjs` (**78 assertions**, `UI TESTS PASSED`) enumerates the shared constants + asserts the 12 UI-heavy draws reference them (no per-panel ad-hoc fonts) + guards the P10 memoization. Invariant held for L4: `logic.js` byte-identical (EMPTY diff), SAVE_VERSION 12, GAME_VERSION 1.0.0, zero new runtime deps, all 9 probes in band UNCHANGED, smoke green. **A1 — the v1.9 quality audit LANDED (fresh session `v19-a1`, 2026-09-09) — every gate GREEN, the season is signed off** (full measured table in the Last-PM-audit entry above + `docs/ROADMAP.md` §v1.9 A1 + `PROJECT_STATE.md` §v1.9 A1). **v1.9 COMPLETE — no open v1.9 scope; awaiting direction for v1.10 / the post-1.0 backlog.**
- Git: v1.1–v1.4 fully committed (v1.4 complete at `dddbcaf`); v1.5 COMPLETE — **v1.5 Batch 1 COMPLETE (K1 Mud Turtle + K2 Blind Crag Frog + K3 Storm Surge; smoke 74/74) + Batch 2 COMPLETE (K4 The Gilded Heron + K5 3 new modifiers + K6 NG+ Master tier; smoke 77/77) + Batch 3 COMPLETE (K7 Curator Challenge + K8 Challenge Reward/Masterpiece; smoke 79/79) + Batch 4 COMPLETE (K9 Field Guide + first-sight callouts; smoke 80/80 + K10 full regression + season audit + docs-only commit).**

## Active work

**v1.5 "The Living Swamp" — COMPLETE (2026-09-07; all 10 items K1–K10 done and committed).** One
conventional commit per item; full per-item history lives in git log +
PROJECT_STATE.md. v1.1–v1.4 are all COMPLETE (see Current state). Batch 1 (the two new enemy archetypes + the zone-5 Storm Surge set-piece) is done and committed — suite 74/74, pacing unchanged. **Batch 2 K4 done: The Gilded Heron (NG+ cycle-3+ 3rd boss — gold palette, 42k HP, plume absorbs both green heal sources; pure `GILDED_HERON` + `gildedPlumeTick`/`gildedPlumeActive` in logic.js; NG+-gated so cycle-0 first-time is byte-identical; smoke stage 75, 24 asserts; suite 75/75; pacing 17.2/19.1/19.5 unchanged).** **Batch 2 K5 done: 3 new expedition modifiers (Night Expedition / Still Waters / Master's Palette) — data entries in the existing MODIFIERS table (3→6), each feeding the existing tuning/spawn/render paths (Night = render-only darkness + mosquito speed + orb value; Still Waters = no weather + enemy HP; Master's Palette = pre-locked synergy duo + contact dmg); NG+-gated so cycle-0 is byte-identical (smoke stage 76, 24 asserts; suite 76/76; pacing 17.2/16.7/19.5 unchanged).** **Batch 2 K6 done: NG+ "Master" tier (cycle 4+ capped escalation — `NG_STEPS` gains a Master row hp 2.85 / dmg 1.81 / spawn 1.30 = cycle-3 ×(1.50/1.25); `NG_CAP_CYCLE` 3→4; pure logic, no game.js change; cycles 0-3 byte-identical; cycle-4 strictly harder + bounded (cycle 4 == cycle 99); `ngpace.mjs` models cycle-4 = ~39 min, a deliberate bounded opt-in NG+ escalation beyond the first-time 15-20 band; smoke stage 77, 18 asserts; suite 77/77; pacing 17.2/16.7/19.5 unchanged).** BATCH 2 COMPLETE. **Batch 3 K7 done: Curator Challenge — a victory-gated title-screen "Challenge" button (same gate NG+ uses via `ngUnlocked`, so a first-time player never sees it) that runs a SEEDED daily expedition: seed = current UTC day (`challengeDaySeed` → `mulberry32`), a SEEDED 2-painting loadout draw from the player's OWNED paintings (`challengeDrawLoadout`, Fisher–Yates) + a SEEDED modifier pick from the MODIFIERS table (`challengeDrawModifier`) — all deterministic from the seed so the whole world shares one challenge per day; the run reuses the existing expedition sim + `makeTuning` + scoring fields (game.js override in `_beginExpedition`: seeded world seed, seeded `_loadout`, seeded modifier via `applyModifier`) and produces a SCORE = color restored + enemies defeated in time + orbs collected + a boss-time bonus (pure `challengeScore` in logic.js); the result is filed to a SAVED top-5 best-score list (`challengeFileScore`, each entry {seed, date, score}, ordered desc, max 5, older dropped) shown in a NEW 5th atelier "Challenge" panel (tab 4, key 5). New save field `challengeScores` (SAVE_VERSION 8→9 + v8→v9 migration — old saves load with an empty list). The challenge run is EXCLUDED from the normal first-time pacing (it is its own scored mode — first-time pace 17.3 / humance 19.1 unchanged). Smoke stage 78 (gate, determinism, score, top-5 file/order/cap, v8→v9 migration, end-to-end victory→file); suite 78/78.** **Batch 3 K8 done: Challenge Reward — the first-EVER challenge completion mints a unique MASTERPIECE painting ("The Heron, Waking", a gilded, unbuyable collection piece shown in the Gallery Wall + the Curator's Ledger) + 15 gold EXACTLY once (latched by the existing `save.goldEarned.masterpiece` map via `goldEarn` — no new save field, SAVE_VERSION stays 9); SUBSEQUENT completions pay a small REPEATABLE bonus by rank (top-1 5g > top-5 2g), keyed by (seed, rank) so each new day/retry pays again. Pure logic in logic.js: `MASTERPIECE`, `challengeRank`, `challengeRankBonus`, `challengeComplete`, `isMasterpieceMinted`. It is NOT a PAINTINGS id (PAINTINGS stays 10), so it never enters the shop/loadout/makeTuning/retirement threshold — pure collection + display. Smoke stage 79 (first mints once +15, repeat pays only rank gold, rank-1 > rank-5, legacy save loads as unminted, end-to-end victory→mint, gallery+ledger render); suite 79/79; first-time pacing unchanged (pace 17.4 / humance 18.0).** BATCH 3 COMPLETE. Next: K9→K10 (Field Guide / ledger updates for new creatures + full regression & season audit).

**v1.6 "Beneath the Reeds" — BATCH 1 COMPLETE (2026-09-07: R1 + R2 + R5 all done and committed).** **R1 done: THE REEDS BIOME shell + THE LANTERN** — a victory-gated "Beneath the Reeds" title entry (same `ngUnlocked`-style gate — a fresh no-victory save NEVER sees it, so the cycle-0 15–20 min run stays byte-identical) that starts a Reeds expedition VARIANT: a darker-palette, flooded, deeper-swamp world (SAME painting, deeper — the terrain is generated by the SAME deterministic seeded pass; R2 deepened the layout to 6000px and the light economy uses its own deterministic RNG stream; the Reeds variant populates the light economy: 46 drifting fireflies + 8 lantern-rest stones). Signature mechanic THE LANTERN: a paper lantern (new **L** toggle) with a light radius + a CANDLE FUEL bar that drains over time (lit-only, ~25 s full wick) and refills at fireflies / lantern-rest spots; unlit = a short ambient visibility radius. Pure rules in `logic.js` (`LANTERN` config, `lanternState`, `lanternTick`, `lanternRadius`, `lightFactor(state,x,y,cx,cy)` — the 0..1 distance-falloff the R3 bestiary will key to; `reedsUnlocked(save)` gate predicate). The light is RENDER-ONLY: a single cached radial-gradient SPRITE (baked once into an offscreen canvas, never per frame) drawn with one `drawImage` at the lantern — no per-pixel work, so P10 stays green. New HUD element: the CANDLE FUEL readout (top-right; flame glyph + fuel bar + the "L" hint) — Reeds-variant only. `game.js` stays thin (`this.lantern` state + `_updateLantern`/`_drawReedsLight`/`_lanternNear`). Smoke stage 83 (25 asserts: gate, world variant, lantern activation, fuel drain/refill/auto-extinguish, L toggle, lightFactor, HUD render, P10 culling, cached-sprite invariant); full suite green; cycle-0 pace 17.3 / humance 18.5 min — IN the 15–20 band, byte-identical.

**R2 done: FLOODED LOWER BANKS + INVERTED-GRAVITY POCKETS** — the Reeds traversal layer: a deeper `REEDS_WIDTH` (6000px vs base 5400px) layout; the **flooded lower banks** (y ≥ `REEDS_FLOOD_FLOOR` 900 = open dark water) slow ground movement by the pure `floodedWaterFactor(x,y)` (0.72× in the flood, 1.0 otherwise, applied only when `world.reedsVariant` — cycle-0 byte-identical); and 3 **inverted-gravity pockets** (`REEDS_POCKETS` AABBs) where the hop sign FLIPS — a new pure `hopLift(hopT, x, y)` in logic.js reuses the existing sin lift and negates it inside a pocket (a downward "clump" riding the root-ceiling) and reverts on exit (no stuck state). A view-culled `drawReedsTraversal` renders the flood band + pocket root-ceilings (no per-frame state; P10-safe). The light economy now uses a SEPARATE deterministic RNG stream (seeded from the world seed), so it no longer perturbs the terrain stream — the world build is deterministic per seed (two Reeds worlds at a seed lay out identical terrain). `game.js` stays thin (a `drawReedsTraversal` world-space call + no new state); all traversal rules in logic.js. Smoke stage 84 (23 asserts: inGravityPocket inside/outside, hop sign-flip + revert, 0.72 flood factor, deterministic 6000px build, P10 culling, stable cached layers); full suite green; cycle-0 pace 17.4 / humance ~18.4 min — IN band, byte-identical.

**R5 done: REEDS SAVE GATE + FIELD GUIDE entries** — the victory gate that opens the biome: `save.flags.reedsUnlocked` (a boolean, set on the FIRST swamp victory — the SAME place `ngUnlocked` is set; a defeat never sets it) + the title/atelier entry reading it. **SAVE_VERSION 9 → 10** with a `SAVE_MIGRATIONS` v9→v10 step + `normalizeReedsUnlocked` (every pre-v1.6 save loads `false` — nobody backfills access; a legacy victory-carrying save keeps access via a victory fallback). New **P6 Field Guide** entries for all four Reeds creatures as placeholder cards — Wisp (light-homing + blue-blind), Serpent (burrow/telegraph + paint-the-ring interrupt), Leech (cling/strangle + paint-or-hop off), The Silt Wyrm (surface-point counterplay) — pure `REEDS_CREATURES` display data in logic.js, rendered ONLY when `reedsUnlocked` (a first-time guide is byte-identical; the panel grows to fit). The M3-style first-sight callouts + the Reeds atelier one-liners ship with R3/R4 (the creatures themselves). `game.js` stays thin (the victory sets the flag; `_drawHelp` renders the section; `_helpGeom` grows the panel). Smoke stage 85 (28 asserts: the gate, the v9→v10 migration + normalizer loads `false`, the victory flip + intact bookkeeping, the defeat never-unlocks, the four fillText-rendered entries, the locked-guide byte-identity); full suite green; cycle-0 pace 17.4 / humance ~18.4 min — IN band, byte-identical. **BATCH 1 (R1 + R2 + R5) COMPLETE** — the Reeds biome shell is in.

**BATCH 2 (R3, R4, R6) — R3 done: THE LIGHT-REWRITTEN BESTIARY** (2026-09-07). THREE new Reeds-only archetypes in the existing `ENEMIES` table, all keyed to THE LANTERN's `lightFactor` / `lanternState`, Reeds-mode-only rare picks in the bounded spawn cap (a cycle-0 run's `_spawnWave` never enters the branch — byte-identical; no new enemy list, so the count stays bounded). **(a) Glow Wisp**: a slow drifting lure that WINDS toward the lantern's light while lit (the attractor is the frog, who carries it; random drift unlit); a BLUE SPLASH near it BLINDS it (~3 s useless spin — the new pure `wispBlinded(t)` tick in logic.js); nearly invisible unlit (draw alpha scales by the lightFactor it receives). **(b) Mud Serpent**: burrows under the water line (invisible + UNHITTABLE while burrowed/recovering — the paint.js swipe + splash hit-filters skip it in those phases), telegraphs a strike with a growing ripple ring at its surface point (~1.2 s, the heron-telegraph draw language), then surfaces + strikes the lane; a painted RING before it surfaces (ANY pigment) interrupts + knocks it back underground with a re-cooldown. **(c) Silt Leech**: clings on contact (drains a small HP/sec via the pure `leechDrain(dt)` fractional-HP accumulation + slows movement 25% — the `leechAttached` flag + `Player.leechFactor()` 0.75); comes off when PAINTED (any swipe touching the frog — the dry brush's one combat use) OR when the player HOPS off (one hop breaks the cling); a second leech cannot attach for ~6 s (the shared `leechCd` window). All rules in `logic.js` (`REEDS_BESTIARY` + `wispBlinded` + `leechDrain`); 4 new quiet SFX (wisp-blind / serpent-dive / leech-attach / leech-peel); M3-style one-shot first-sight callouts for each new creature. `game.js` stays thin (`_bestiaryTick` / `_bestiarySwipe` / `_bestiarySplash`). Smoke stage 86 (41 asserts: wisp chases-lit / drifts-unlit / blind window; serpent burrow→telegraph→surface→strike + painted-ring interrupt + re-cooldown + strike hits; leech attach→drain+slow→paint-off AND hop-off + re-attach cooldown); full suite green; cycle-0 first-time pace 17.3 / humance IN the 15–20 band, byte-identical (Reeds-gated); P10 culling stays green (the serpent's ripple ring is 1 arc + 3 concentric rings, capped; the wisp/leech are cheap ellipses; no per-frame allocation).

**BATCH 2 (R4) — THE SILT WYRM: the 4th boss ARCHETYPE (the deferred item)** (2026-09-07). The end-of-Reeds boss: a SUBTERRANEAN creature that moves THROUGH the terrain, surfacing only at 3 TELEGRAPHED fixed points on its arena line (a ~1.5 s ripple-ring tell before each breach; between surfaces it is underground + INVULNERABLE + untargetable and its body line slithers beneath — the capped 14-segment slither is the P10 allocation risk, kept to 14 segments + a single ripple ring). The 3-hue awaken STILL applies through the SAME `paintBoss`/`bossStep` path (a single hue repeated does NOT awaken — all three do, the identical awaken latch the herons emit; the full-damage shimmer phase speeds the surfacing rhythm, 0.62× transit + telegraph). HP in the 48k class (above the gilded 42k — the biome's apex); a distinct dark-mud palette + a low rumble SFX layer (S2: the `wyrm-rumble` engage loop + `wyrm-breach` stinger). Reeds-mode only — the wyrm occupies the same `this.heron` slot (so paint routing, the awaken handler, the camera, and `_endRun('victory')` all reuse the heron machinery); a cycle-0 swamp run still spawns the gray heron (byte-identical). A NEW pure `wyrmStep` underground-transit state machine (`logic.js`) is the movement pattern (transit → telegraph → surfaced → transit, cycling the 3 surface points); `game.js` is thin (`_updateWyrm` + `_drawWyrm` + the wyrm branch in `_beginExpedition`; defeat sinks it under the water line instead of a flight). The fight lands in the 2–4 min class: surfaced (paintable) is the dominant phase (7 s of a ~10 s cycle) so 48k HP is a real fight, not a grind — bosspace-style bot measurement ≈ 97 s (1.6 min) → ~2.3 min human (IN the 2–4 min class). Smoke stage 87 (19 asserts: spawns only at the end of a Reeds expedition — a cycle-0 swamp run still spawns the gray heron; underground = invulnerable + untargetable; each surface telegraphs before breach; the 3 hues + awaken work through the EXISTING `paintBoss` latch — the same event the herons emit, and one hue alone does NOT awaken; the awakened rhythm is faster; defeat ends the Reeds run in victory; the dark-mud draw path renders headless without throwing — P10-safe). Full suite green; cycle-0 first-time pace byte-identical (Reeds-gated); P10 culling stays green. Next: R6 (`tests/reedspace.mjs` probe + season audit + cycle-0 tuning byte-identity).

## Blockers

None. Loopback dev server, Node, and all tests are healthy.

## Known bugs / risks

- No open confirmed gameplay bugs; v1.1 hardening (B2–B6) is done.
- Risk: v1.4 juice creep — every art/feel item carries a HARD 60fps
  acceptance (P10 stage + per-frame budget assertions); deferred list in
  `docs/ROADMAP.md` §v1.4 is the boundary (gamepad / accessibility /
  gold-combat-color / co-op / procgen stay out).
- Risk: `src/game.js` is ~1935 lines and holds state-machine + HUD; new
  screens/features must stay thin there, logic in `src/logic.js` where possible.
- Risk: the PM runs on a local model with a hard context ceiling — long runs
  crash mid-edit. Mitigation: bounded batches (~3 items/session), each ending
  in a clean commit so a fresh session resumes losslessly.

## Technical debt

- `game.js` size (above) — manage by keeping new features out of it.
- No unit tests beyond smoke.mjs/pace probes — acceptable for project size;
  keep pure logic in logic.js so that stays true.

## Next priority

**v1.5 COMPLETE** (2026-09-07). All 10 items K1–K10 done and committed.
**v1.6 "Beneath the Reeds" COMPLETE** (2026-09-07; all 13 items R1–R6 /
W1–W3 / Q1–Q3 / A1 done and committed). The victory-gated Reeds biome
(THE LANTERN, 3 light-keyed creatures, The Silt Wyrm 4th boss archetype,
`reedspace.mjs` probe), raw-Gamepad-API gamepad support, 3 QoL items
(pause run summary / end-screen recap / paste-based save export-import),
and the final regression + season audit are all done. Final suite 94/94
green ×3; first-time pace 17.3 / humance 18.1 min (IN 15–20); NG+ cycle-1
19.5 min; Reeds run ~22.2 min (IN 20–25) + Silt Wyrm ~3.9 min (IN 2–4);
zero new deps; SAVE_VERSION 10 migration end-to-end; cycle-0 tuning
byte-identical. **v1.6 has no open scope.** **v1.7 "The Ever-Shifting Swamp"
is COMPLETE (2026-09-08; all 9 items D1–D4 + F1 + O1 + O2 + I1 done and
committed):** THE WANDER — a bounded, OPT-IN (default OFF) procedural
expedition variant (seeded encounter content within a hand-tuned pacing
envelope), the deferred **5th boss archetype** (the **Hollow Warden**,
Wander-apex), 2 QoL items (the pre-expedition seed card + the Wander
run-recap line), and the **I1 season audit** (final gate, clean fresh
session) — every probe re-run on the committed tree and IN band (pace
~17.3 / humance 18.7 / ngpace 19.5 / reedspace 22.2 / wandpace both legs /
wardpace 3.9–4.1 min), byte-identity confirmed (`makeTuning` deep-equals
v1.6-complete `f746938`), zero new deps, SAVE_VERSION 11, no 8765 server
left running. **v1.7 has no open scope.** **v1.8 "The Full Collection" is now
COMPLETE** (2026-09-08 — the 1.0.0 release; G1–G3 + H1–H2 + R1–R2 + **A1 the
1.0.0 season audit** all committed; every gate green — see the v1.8 current-
state line above + the §v1.8 audit table in `docs/ROADMAP.md`). See
`docs/ROADMAP.md` for the plan-of-record + the post-v1.8 deferred list.

**v1.8 "The Full Collection" — Batch 3 (R1 + R2) LANDED (session v18-r,
2026-09-08; 2 commits `119a0f1` + the R2 docs commit).** The **release
surface** lands. **R1** the `README.md` (the game's first — the one-liner +
the "painting is the game" pillar, how to run [loopback-only], the controls
re-verified against `input.js` + the `GAMEPAD_MAP`, what's in the game, the
meta loop, the architecture note) + the **`1.0.0` version string** from a
single display-only source of truth (`GAME_VERSION = '1.0.0'` in `logic.js`
beside `SAVE_VERSION`), rendered on the title corner ("Frogue Gallery ·
v1.0.0") + the Options header line, with a smoke stage asserting the value is
`'1.0.0'` and referenced. **R2** `docs/CHANGELOG.md` (NEW — the full release
history 1.0.0/v1.8 → v1.1 → the tutorial-era milestones, representative SHAs +
the `SAVE_VERSION` history) + `docs/DECISIONS.md` rows 15–18 (the Black Reeds
gating, the Umbral Wyrm band + deep-dark lantern mandate, the Full Collection
criteria + capstone-over-bonus + 11→12 migration, the 1.0.0 versioning
choice). R1/R2 are presentation + docs only — **smoke 106 stages green
(105 + stage 106), every pacing probe re-run IN band UNCHANGED**, zero new
deps, no 8765 server left running. **A1 then signed off (session v18-a, fresh
session, on the committed tree `6e87cd8` — the 1.0.0 season audit — v1.8
COMPLETE).**

**v1.8 "The Full Collection" — Batch 1 (G1 + G2 + G3) COMPLETE (session
v18-g, 2026-09-08; 3 commits `4ec7d07` / `49f74a8` / `3b5949d`).** The last
deferred depth item lands as a real place, not a procgen roll: **G1** the
**Black Reeds** NG+ Reeds variant (a NEW `REEDS_DARK` layout — a deeper 7200px
descent, a denser Wisp/Serpent/Leech bestiary, a 4th gravity pocket, a
deeper/slower flood band, its own darker `REEDS_DARK_LANTERN` economy), gated
behind `ngCycle >= 1` AND a Reeds victory (`flags.reedsVictory` latch; the v1.6
cycle-0 Reeds layout is untouched). **G2** the **Umbral Wyrm** 6th boss
archetype — a NEW `UMBRA_WYRM` tuning + `umbrStep` alongside `SILT_WYRM` /
`wyrmStep`: ~60k HP, a dual-phase Silt-Wyrm twin (a telegraphed DUAL maw + a
"deep dark" final phase where the lantern is **mandatory**, via the pure
`umbraPaintable`), the Warden fuel-siphon + the Wyrm flood-pocket, and the
existing `paintBoss` / `bossStep` 3-hue awaken. **G3** the selection wiring
(end-of-Reeds boss: Umbral [NG+ Reeds] vs Silt [cycle-0] vs Warden [Wander ×
Reeds]) + two new probes (`blackpace.mjs` ~25.8 min IN the new 22–26 band /
`umbrapace.mjs` ~3.9 min IN 2.5–4) + a comprehensive smoke stage (the
three-way selection, cycle-0 Reeds byte-identity, the Umbral-only-in-Black-
Reeds gate, and the dual-phase / siphon / maw / lantern-mandatory mechanics).
The load-bearing invariant held end-to-end: a cycle-0 Reeds run, a Wander ×
Reeds run, and a hand-tuned (Wander-OFF) Reeds run all deep-equal their v1.7
tuning / content — `reedspace.mjs` re-verified **unchanged** at ~22.2 min.
smoke 103 stages green (deterministic ×2); zero new deps; SAVE_VERSION stays
11 (the 11→12 bump comes in H1); no 8765 server left running. **Next: H1**
(the gallery Full-Collection completion capstone — `save.galleryComplete` +
boss-defeat flags + the v1.8 gallery UI + SAVE_VERSION 11→12 — the next
session's work, NOT started this session).

**v1.7 "The Ever-Shifting Swamp" — COMPLETE (session v17-f1, 2026-09-08;
D1 + D2 + D3 + D4 + a hygiene commit + **F1** + **O1** + **O2** + **I1**
landed — all 9 items done and committed; the I1 season audit signed the
v1.7 season off in a clean fresh session).**
v1.6 is COMPLETE and stays untouched;
v1.7 adds **THE WANDER** — a bounded, OPT-IN (default OFF) procedural
expedition variant. **D1 done: the PURE seeded wander content generator** —
`wanderContent(seed, zones, bias)` in `logic.js` builds a reproducible
layout from its own `mulberry32(seed + WANDER_SALT)` stream (R2 pattern,
separate from the terrain pass) inside a hand-tuned `WANDER_BUDGET`
envelope (4 zones, per-zone normal 3–9 / total 18–30, elite 1–2 / 4–7, 2
rest orbs/zone, boss-eligible — hand-tuned 23/6/8 sits mid-band);
`pickWanderSeed` (no Math.random) + `normalizeWanderSeed`; `options.wander`
default OFF (legacy options migrate to OFF); `save.wanderSeed` latch;
**SAVE_VERSION 10 → 11** (v10→v11 migration; all era-pinned stage asserts
updated to 11). When OFF (the default) the generated path NEVER runs →
hand-tuned ZONES + cycle-0 tuning byte-identical (the JSON-compare gate is
now asserted in the D1 smoke stage, not just implied). Smoke stage 95 (27
asserts) proves pure (no Math.random/Date.now), same-seed identical,
fresh-seed differs, 40-seed sweep in-budget, default-OFF byte-identical,
and a real ON run latches a reproducible non-zero seed. **Hygiene commit
done (the pre-existing stage-75 K4 flake):** the harness already stubs the
CLOCK, so the ONLY non-determinism source in a full `node tests/smoke.mjs`
run is `Math.random()` (enemy/heron wander in enemies.js, particle/trail
scatter) — the fix is a SEEDED mulberry32 `Math.random` in the harness + a
deterministic paint-target in the K4 stage, so the whole suite is
byte-reproducible (pins the K4/E1/T3 flake class at once; stages that
override/restore `Math.random` are unaffected). 15/15 flake-check green.
**D2 done: the WANDER "taste"** — `wanderTaste(seed) -> {id,name,tag,bias}`
from a hand-tuned set of 4 flavor archetypes (The Quiet Reeds / Feast
Season / The Long Dark / Ink Bloom), picked PURE + deterministically on the
seed's own salted lane (WANDER_TASTE_SALT, separate from the content
stream). The bias only re-weights WHICH KINDS fill each zone's slots — it
NEVER changes the per-zone or total counts — so a biased run stays in-band
exactly as the neutral one (repeat-avoidance is the D1 seed latch). The
taste name is one line of flavor in the Wandering badge. Smoke stage 96
(40 asserts). **D3 done: NG+ + Reeds parity for the Wander** (BOTH legs, per
the plan-of-record) — (a) Wander × NG+: `applyNGPlus` N2 scaling applies
exactly ONCE on top of the generated content (the gate generates content,
never tuning, so no compounding — asserted by deep-equality against the
double-applied variant); (b) Wander × Reeds: the gate no longer excludes
Reeds, so a Wander × Reeds run layers generated zone content + the Reeds
light economy (lantern fuel) + R3 bestiary + the Silt Wyrm boss on top (a
valid victory-gated variant); (c) the hand-tuned (Wander-OFF) expedition +
Reeds runs remain byte-identical. **`tests/wandpace.mjs` landed in D3 (early,
so I1 reuses it)** — a generated first-time Wander run in 15–20 min across
8 seeds (band 16.9–17.8) + a Wander × Reeds leg in 20–25 min (band
21.6–22.7), both in-band and deterministic; the WANDER changes only the
z.mix-driven zone-beat (background waves come from `_spawnWave`, not
`z.mix`), so the probe scales only that against the documented anchors.
Smoke stage 97 proves the parity + byte-identity. **D4 done: the Wander
options toggle + save export/import parity** — a FIFTH "Wandering
Expeditions" toggle (default OFF) in the Options panel (P9 machinery; the
panel grows 560→598, the gamepad + Save rows shift down), and the existing
save export/import round-trips the `wanderSeed` field (the exported blob
carries wanderSeed + saveVersion 11, validates through `validateSaveBlob`,
a v1-era blob imports to v11 with wanderSeed 0, a malformed wanderSeed is
refused). Smoke stage 98 proves the toggle (persists + re-reads +
legacy-migrates-to-OFF) + the export/import parity + seed reproducibility
across a save/load cycle. **All D-items (D1–D4) are DONE.** **F1 done: THE
HOLLOW WARDEN, the 5th boss archetype (the Wander-apex, `f21dcab`).** A pale,
lantern-eating creature that spawns ONLY as the end boss of a WANDER
expedition (a hand-tuned cycle-0 / NG+ / Reeds run never meets it — the Warden
branch is a pure additive, byte-identical when Wander OFF). New pure
`logic.js`: `WARDEN` (52k HP — the Wander apex, above the wyrm's 48k) +
`wardenStep` (the maw-window state machine: mawClosed -> telegraph -> mawOpen;
INVULNERABLE except while the maw is open — a telegraphed window reusing the
Silt-Wyrm ripple-ring language) + `wardenTasteFactor` (taste-seeded aggression:
a Feast Warden's gaps are shorter -> the maw opens more often + a faster
siphon) + `wardenFuelSiphon` (drains a full wick in ~60s base while the
lantern is LIT, taste-scaled 45s feast / 75s quiet; stops unlit/empty,
auto-extinguishes at 0). The 3-hue awaken works through the EXISTING
`paintBoss`/`bossStep` path. game.js: boss SELECTION (Wander ON -> Warden;
Wander OFF + Reeds -> Silt Wyrm; Wander OFF -> heron) + the `_updateWarden`
drive + the `_drawWarden` render (PALE palette, P10-capped) + the maw-window
paint gating + the defeat/sink beat + a Warden-aware recap line + a
`warden-rumble` SFX. Smoke **stage 99** (24 asserts) proves: Warden-only-in-
Wander (byte-identical when Wander OFF), the maw window, the fuel siphon, the
3-hue awaken, and the taste-seeded aggression. **NEW `tests/wardpace.mjs`**
measures the Warden at ~3.9–4.1 min human (god-mode ~98–104s) — in the 2–4 min
band, comparable to the Silt Wyrm's 3.9 min. NOTE: the spec's "~1.5 s maw
window" is preserved as the TELEGRAPH duration; the PAINTABLE maw-open window
was tuned to 10.5s (vs the wyrm's 7.0s surfaced) so the 52k HP lands in the
human band — a deliberate, documented deviation. **O1 done: the pre-expedition
WANDER seed card (`8033942`).** The title's "Begin Expedition" (Enter/Space +
the big button) now routes through `_startExpeditionOrCard`, which opens a small
paper card — the generated seed + the taste name + its one-line flavor — when
`options.wander` is ON; "Set out" starts the run with THAT exact seed (via
`opts.seed`, deterministic: the seed the player saw is the seed played), "Esc"
backs out; in-memory only (the seed latches to `save.wanderSeed` only when the
run actually begins); ABSENT for a hand-tuned (Wander-OFF) run — its start path
is byte-identical to v1.6. Smoke **stage 101** (17 asserts). **O2 done: the
Wander run-recap line (`237abfb`).** The v1.6 Q2 end-screen recap strip gains a
second line for a WANDER run ONLY — the taste name + one-line flavor + the
"Wandering expedition · seed N" tag (a run-local read, in-memory only; a
hand-tuned run's recap is unchanged; shows on both a victory AND a defeat).
Smoke **stage 100** (15 asserts). Suite **101 stages green** (deterministic);
hand-tuned pace 17.2 / humance 19.0 / reedspace 22.2 / wandpace both legs
UNCHANGED (Wander OFF by default); `wardpace.mjs` in-band. **I1 done: the v1.7
SEASON AUDIT (the final gate, clean fresh session, all on the committed tree)**
— smoke **×3** consecutive `ALL SMOKE TESTS PASSED` + a **10-run flakecheck**
10/10 green (the `144fb1c` flake-pin stays green; the suite is deterministic);
**pace ~17.3 / humance 18.7 min (IN the 15–20 band, hand-tuned, Wander OFF)**;
**ngpace 19.5 min (IN band)**; **bosspace** heron 37.0 s god-mode (the
documented lower-bound probe); **reedspace ~22.2 min (IN 20–25) + Silt Wyrm
97.7 s god (~3.9 min human, IN 2–4)**; **wandpace BOTH legs in band** (first-time
16.9–17.8 min over 8 seeds, IN 15–20; Wander × Reeds 21.6–22.7 min over 8 seeds,
IN 20–25); **wardpace** the Hollow Warden at god 98–104 s → **~3.9–4.1 min
human** (comparable to the Silt Wyrm's 3.9 min, in the documented 2–4 min class
via the `f21dcab` maw-open 10.5 s tuning); **byte-identity** — `makeTuning` +
`applyNGPlus(1)` (normal/gentle/hard) **deep-equal the v1.6-complete
(`f746938`) values** (JSON-compare across the whole v1.7 diff) and the `freshSave`
delta is EXACTLY `{saveVersion 10→11, wanderSeed: 0}`; **zero new dependencies**
(git-diff since `f746938` touches only `src/` + `tests/` + `docs/` +
`PROJECT_STATE.md` — no package.json/lockfile/asset/node_modules); **SAVE_VERSION
stays 11**; P10 culling green (stages 24 / 95 / 99); no `http.server` 8765 left
running. **v1.7 COMPLETE — every gate green; the load-bearing invariant
(hand-tuned runs byte-identical with Wander OFF) holds.** Full audit table in
`docs/ROADMAP.md` §v1.7. Next: v1.8 (awaiting direction).

## Release readiness

Release: ready (DoD met, suite green). v1.1: **complete** — M7 + M7.5 + M8
all done. v1.2: **complete** — M9 + M10 + M11 + M13 all done; smoke 45/45;
pacing 18.7/18.8 min (in the 15–20 min target). v1.3: **complete** — M14
(NG+) + M15 (gold meta) + M16 (season wrap) all done; smoke 56/56; pacing
pace ~18.5 / humance 18.4 / ngpace 19.5 (all in band). v1.4 "Make It
Amazing": **executing** — 14 items in 4 modules (J juice · L presence · S
audio · M moments) across 5 batches of ~3; theme + order + acceptance in
`docs/ROADMAP.md` §v1.4. The release stays playable at every commit.
## Release readiness

Release: ready (DoD met, suite green). v1.1 + v1.2 + v1.3 + v1.4 + v1.5 +
v1.6: **all complete**. v1.6 "Beneath the Reeds" **COMPLETE** (2026-09-07)
— all 13 items in 4 modules (R the Reeds biome + THE LANTERN · W gamepad ·
Q QoL · A audit); final suite 94/94 green ×3, all pacing probes in band,
zero new dependencies. The release stays playable at every commit.
