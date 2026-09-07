# Frogue Gallery — Project Status (PM)

Concise PM view. Durable status/next-action detail lives in root
`PROJECT_STATE.md` (read that first); milestones in `docs/ROADMAP.md`;
consequential decisions in `docs/DECISIONS.md`.

**Last PM audit: 2026-09-07 (v1.1 + v1.2 + v1.3 + v1.4 "Make It Amazing" COMPLETE; **v1.5 "The Living Swamp" COMPLETE — all 10 items K1–K10 done and committed (smoke 80/80; first-time pace 17.4 / humance 18.0 IN the 15–20 band; NG+ cycle-1 19.5; SAVE_VERSION 9). **v1.6 "Beneath the Reeds" APPROVED + EXECUTING (2026-09-07; Joel: "Plan and execute 1.6" — execution pre-approved): 13 items, 4 modules (R1–R6 biome / W1–W3 gamepad / Q1–Q3 QoL / A1 audit) in `docs/ROADMAP.md` §v1.6 — victory-gated new biome + THE LANTERN mechanic, 3 light-keyed creatures, the 4th boss archetype (The Silt Wyrm), raw-Gamepad-API gamepad support, 3 QoL items, final regression audit. Deferred items folded in: gamepad + 4th boss archetype. Batch order in PROJECT_STATE.md → Immediate Next Action.

## Current state

- Release DoD: **all 12 items satisfied** (final audit 2026-09-05).
- **v1.1 COMPLETE**: M7 (B1–B6), M7.5 (PT1–PT5), M8 (P10/P12/P7/P8/P6/P9/P11).
- **v1.2 "The Collection" COMPLETE** (2026-09-06): M9 Atelier/collection,
  M10 Expedition depth, M11 Presentation, M13 Tutorial (accessibility
  deferred). Batches 1–6 all done; suite 45/45; pacing 18.7/18.8 min.
- **v1.3 "The Second Expedition" COMPLETE** (2026-09-06): NG+ loop M14 (N1–N4), gold meta economy M15 (G1–G4), season wrap M16 (C1–C4).
- **v1.4 "Make It Amazing" COMPLETE** (2026-09-07): all 14 items (J1–J5 juice, L1–L3 presence, S1–S3 audio, M1–M3 moments) + the Joel color rework (`012ce0b`: red big-dmg+burn / blue freeze / green light-dmg+heal / dry cleanse+world-restorer / mosquito nerf). Smoke 71/71; pacing 17.3/18.3/19.5 min.
- **v1.5 "The Living Swamp" COMPLETE** (2026-09-07 — all 10 items K1–K10 done; Joel, 2026-09-06: "Don't even pitch me v1.5. Just make it") — K1–K10 in `docs/ROADMAP.md` (new enemy archetypes, zone-5 Storm Surge set-piece, 3rd NG+ boss The Gilded Heron, 3 new modifiers + Master tier, seeded daily Curator Challenge + Masterpiece reward, Field Guide updates, full audit). Batch order (one commit per item) in `PROJECT_STATE.md` → Immediate Next Action: 1) K1→K2→K3 ✅, 2) K4 ✅ (Gilded Heron) → K5 ✅ → K6 ✅, 3) K7 ✅ (Curator Challenge) → K8 ✅ (Masterpiece reward), 4) K9→K10. First-time Normal run stays 15–20 min — new creatures scale into zones 3+ and NG+ (re-verify on any in-run change).
- Git: v1.1–v1.4 fully committed (v1.4 complete at `dddbcaf`); v1.5 COMPLETE — **v1.5 Batch 1 COMPLETE (K1 Mud Turtle + K2 Blind Crag Frog + K3 Storm Surge; smoke 74/74) + Batch 2 COMPLETE (K4 The Gilded Heron + K5 3 new modifiers + K6 NG+ Master tier; smoke 77/77) + Batch 3 COMPLETE (K7 Curator Challenge + K8 Challenge Reward/Masterpiece; smoke 79/79) + Batch 4 COMPLETE (K9 Field Guide + first-sight callouts; smoke 80/80 + K10 full regression + season audit + docs-only commit).**

## Active work

**v1.5 "The Living Swamp" — COMPLETE (2026-09-07; all 10 items K1–K10 done and committed).** One
conventional commit per item; full per-item history lives in git log +
PROJECT_STATE.md. v1.1–v1.4 are all COMPLETE (see Current state). Batch 1 (the two new enemy archetypes + the zone-5 Storm Surge set-piece) is done and committed — suite 74/74, pacing unchanged. **Batch 2 K4 done: The Gilded Heron (NG+ cycle-3+ 3rd boss — gold palette, 42k HP, plume absorbs both green heal sources; pure `GILDED_HERON` + `gildedPlumeTick`/`gildedPlumeActive` in logic.js; NG+-gated so cycle-0 first-time is byte-identical; smoke stage 75, 24 asserts; suite 75/75; pacing 17.2/19.1/19.5 unchanged).** **Batch 2 K5 done: 3 new expedition modifiers (Night Expedition / Still Waters / Master's Palette) — data entries in the existing MODIFIERS table (3→6), each feeding the existing tuning/spawn/render paths (Night = render-only darkness + mosquito speed + orb value; Still Waters = no weather + enemy HP; Master's Palette = pre-locked synergy duo + contact dmg); NG+-gated so cycle-0 is byte-identical (smoke stage 76, 24 asserts; suite 76/76; pacing 17.2/16.7/19.5 unchanged).** **Batch 2 K6 done: NG+ "Master" tier (cycle 4+ capped escalation — `NG_STEPS` gains a Master row hp 2.85 / dmg 1.81 / spawn 1.30 = cycle-3 ×(1.50/1.25); `NG_CAP_CYCLE` 3→4; pure logic, no game.js change; cycles 0-3 byte-identical; cycle-4 strictly harder + bounded (cycle 4 == cycle 99); `ngpace.mjs` models cycle-4 = ~39 min, a deliberate bounded opt-in NG+ escalation beyond the first-time 15-20 band; smoke stage 77, 18 asserts; suite 77/77; pacing 17.2/16.7/19.5 unchanged).** BATCH 2 COMPLETE. **Batch 3 K7 done: Curator Challenge — a victory-gated title-screen "Challenge" button (same gate NG+ uses via `ngUnlocked`, so a first-time player never sees it) that runs a SEEDED daily expedition: seed = current UTC day (`challengeDaySeed` → `mulberry32`), a SEEDED 2-painting loadout draw from the player's OWNED paintings (`challengeDrawLoadout`, Fisher–Yates) + a SEEDED modifier pick from the MODIFIERS table (`challengeDrawModifier`) — all deterministic from the seed so the whole world shares one challenge per day; the run reuses the existing expedition sim + `makeTuning` + scoring fields (game.js override in `_beginExpedition`: seeded world seed, seeded `_loadout`, seeded modifier via `applyModifier`) and produces a SCORE = color restored + enemies defeated in time + orbs collected + a boss-time bonus (pure `challengeScore` in logic.js); the result is filed to a SAVED top-5 best-score list (`challengeFileScore`, each entry {seed, date, score}, ordered desc, max 5, older dropped) shown in a NEW 5th atelier "Challenge" panel (tab 4, key 5). New save field `challengeScores` (SAVE_VERSION 8→9 + v8→v9 migration — old saves load with an empty list). The challenge run is EXCLUDED from the normal first-time pacing (it is its own scored mode — first-time pace 17.3 / humance 19.1 unchanged). Smoke stage 78 (gate, determinism, score, top-5 file/order/cap, v8→v9 migration, end-to-end victory→file); suite 78/78.** **Batch 3 K8 done: Challenge Reward — the first-EVER challenge completion mints a unique MASTERPIECE painting ("The Heron, Waking", a gilded, unbuyable collection piece shown in the Gallery Wall + the Curator's Ledger) + 15 gold EXACTLY once (latched by the existing `save.goldEarned.masterpiece` map via `goldEarn` — no new save field, SAVE_VERSION stays 9); SUBSEQUENT completions pay a small REPEATABLE bonus by rank (top-1 5g > top-5 2g), keyed by (seed, rank) so each new day/retry pays again. Pure logic in logic.js: `MASTERPIECE`, `challengeRank`, `challengeRankBonus`, `challengeComplete`, `isMasterpieceMinted`. It is NOT a PAINTINGS id (PAINTINGS stays 10), so it never enters the shop/loadout/makeTuning/retirement threshold — pure collection + display. Smoke stage 79 (first mints once +15, repeat pays only rank gold, rank-1 > rank-5, legacy save loads as unminted, end-to-end victory→mint, gallery+ledger render); suite 79/79; first-time pacing unchanged (pace 17.4 / humance 18.0).** BATCH 3 COMPLETE. Next: K9→K10 (Field Guide / ledger updates for new creatures + full regression & season audit).

**v1.6 "Beneath the Reeds" — BATCH 1 COMPLETE (2026-09-07: R1 + R2 + R5 all done and committed).** **R1 done: THE REEDS BIOME shell + THE LANTERN** — a victory-gated "Beneath the Reeds" title entry (same `ngUnlocked`-style gate — a fresh no-victory save NEVER sees it, so the cycle-0 15–20 min run stays byte-identical) that starts a Reeds expedition VARIANT: a darker-palette, flooded, deeper-swamp world (SAME painting, deeper — the terrain is generated by the SAME deterministic seeded pass; R2 deepened the layout to 6000px and the light economy uses its own deterministic RNG stream; the Reeds variant populates the light economy: 46 drifting fireflies + 8 lantern-rest stones). Signature mechanic THE LANTERN: a paper lantern (new **L** toggle) with a light radius + a CANDLE FUEL bar that drains over time (lit-only, ~25 s full wick) and refills at fireflies / lantern-rest spots; unlit = a short ambient visibility radius. Pure rules in `logic.js` (`LANTERN` config, `lanternState`, `lanternTick`, `lanternRadius`, `lightFactor(state,x,y,cx,cy)` — the 0..1 distance-falloff the R3 bestiary will key to; `reedsUnlocked(save)` gate predicate). The light is RENDER-ONLY: a single cached radial-gradient SPRITE (baked once into an offscreen canvas, never per frame) drawn with one `drawImage` at the lantern — no per-pixel work, so P10 stays green. New HUD element: the CANDLE FUEL readout (top-right; flame glyph + fuel bar + the "L" hint) — Reeds-variant only. `game.js` stays thin (`this.lantern` state + `_updateLantern`/`_drawReedsLight`/`_lanternNear`). Smoke stage 83 (25 asserts: gate, world variant, lantern activation, fuel drain/refill/auto-extinguish, L toggle, lightFactor, HUD render, P10 culling, cached-sprite invariant); full suite green; cycle-0 pace 17.3 / humance 18.5 min — IN the 15–20 band, byte-identical.

**R2 done: FLOODED LOWER BANKS + INVERTED-GRAVITY POCKETS** — the Reeds traversal layer: a deeper `REEDS_WIDTH` (6000px vs base 5400px) layout; the **flooded lower banks** (y ≥ `REEDS_FLOOD_FLOOR` 900 = open dark water) slow ground movement by the pure `floodedWaterFactor(x,y)` (0.72× in the flood, 1.0 otherwise, applied only when `world.reedsVariant` — cycle-0 byte-identical); and 3 **inverted-gravity pockets** (`REEDS_POCKETS` AABBs) where the hop sign FLIPS — a new pure `hopLift(hopT, x, y)` in logic.js reuses the existing sin lift and negates it inside a pocket (a downward "clump" riding the root-ceiling) and reverts on exit (no stuck state). A view-culled `drawReedsTraversal` renders the flood band + pocket root-ceilings (no per-frame state; P10-safe). The light economy now uses a SEPARATE deterministic RNG stream (seeded from the world seed), so it no longer perturbs the terrain stream — the world build is deterministic per seed (two Reeds worlds at a seed lay out identical terrain). `game.js` stays thin (a `drawReedsTraversal` world-space call + no new state); all traversal rules in logic.js. Smoke stage 84 (23 asserts: inGravityPocket inside/outside, hop sign-flip + revert, 0.72 flood factor, deterministic 6000px build, P10 culling, stable cached layers); full suite green; cycle-0 pace 17.4 / humance ~18.4 min — IN band, byte-identical.

**R5 done: REEDS SAVE GATE + FIELD GUIDE entries** — the victory gate that opens the biome: `save.flags.reedsUnlocked` (a boolean, set on the FIRST swamp victory — the SAME place `ngUnlocked` is set; a defeat never sets it) + the title/atelier entry reading it. **SAVE_VERSION 9 → 10** with a `SAVE_MIGRATIONS` v9→v10 step + `normalizeReedsUnlocked` (every pre-v1.6 save loads `false` — nobody backfills access; a legacy victory-carrying save keeps access via a victory fallback). New **P6 Field Guide** entries for all four Reeds creatures as placeholder cards — Wisp (light-homing + blue-blind), Serpent (burrow/telegraph + paint-the-ring interrupt), Leech (cling/strangle + paint-or-hop off), The Silt Wyrm (surface-point counterplay) — pure `REEDS_CREATURES` display data in logic.js, rendered ONLY when `reedsUnlocked` (a first-time guide is byte-identical; the panel grows to fit). The M3-style first-sight callouts + the Reeds atelier one-liners ship with R3/R4 (the creatures themselves). `game.js` stays thin (the victory sets the flag; `_drawHelp` renders the section; `_helpGeom` grows the panel). Smoke stage 85 (28 asserts: the gate, the v9→v10 migration + normalizer loads `false`, the victory flip + intact bookkeeping, the defeat never-unlocks, the four fillText-rendered entries, the locked-guide byte-identity); full suite green; cycle-0 pace 17.4 / humance ~18.4 min — IN band, byte-identical. **BATCH 1 (R1 + R2 + R5) COMPLETE** — the Reeds biome shell is in. Next: BATCH 2 (R3, R4, R6 — the bestiary + the Silt Wyrm boss + `tests/reedspace.mjs` probe + full-season pacing re-verification + cycle-0 tuning byte-identity).

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
**v1.6 "Beneath the Reeds" APPROVED + EXECUTING** (2026-09-07; execution
pre-approved by Joel): 13 items, 4 modules (R1–R6 the Reeds biome —
victory-gated, THE LANTERN, 3 light-keyed creatures, The Silt Wyrm 4th
boss archetype, `reedspace.mjs` probe — / W1–W3 gamepad (raw Gamepad API) /
Q1–Q3 QoL / A1 final regression + season audit). Fixed batch order +
per-item acceptance in `docs/ROADMAP.md` §v1.6 + PROJECT_STATE.md →
Immediate Next Action. First-time run stays 15–20 min (victory-gated
biome; re-verify after every in-run item); SAVE_VERSION 9→10 only for the
`reedsUnlocked` gate flag.

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

Release: ready (DoD met, suite green). v1.1 + v1.2 + v1.3 + v1.4 + v1.5:
**all complete**. v1.6 "Beneath the Reeds": **APPROVED + EXECUTING**
(2026-09-07) — 13 items in 4 modules (R the Reeds biome + THE LANTERN · W
gamepad · Q QoL · A audit); theme + fixed batch order + per-item
acceptance in `docs/ROADMAP.md` §v1.6. The release stays playable at
every commit.
