# Lily Clearing validation — 2026-11-11

Implemented from owner feedback: confusing aiming/UI, awkward combat, too few
paintable subjects and an early boss. Three agents supplied encounter/enemy
behavior, repaintable scenery and brush presentation; root integrated and
reviewed them. Game 1.0.0 / Save 12 remain unchanged.

## Shipped behavior

- Optional bell at (1050,730): three rounds of 3/4/5 actors, at most two alive.
  Ground attackers lock their warning direction for 0.8s, dash for 0.28s at
  290px/s and recover for 1.15s. Only the dash hurts. Mosquitoes use their
  existing 0.6s tell / 0.3s dash / 0.85s recovery, now with clear warning lanes.
- Blue interrupts. Red following slow/freeze deals 1.5x direct damage on
  authored clearing targets; other enemies and bosses keep their old damage.
  Green retains the existing root and healing behavior. No forced color order.
- First completion heals once. Replay grants no loot or repeated full heal.
  Walking beyond 580px cancels only authored actors. Ambient actors are moved
  outside the fight and paused until exit. The opening pond cannot lend its
  teaching invulnerability to the fight. An enemy hit wins over incidental bell
  activation by the same stroke.
- 64 free-color props across the swamp, fixed-size arrays, no gameplay RNG,
  no extra particle allocations, no save/economy changes. Red/blue/green and
  dry work; repeated same-color paint does not repeatedly trigger feedback.
- One brush tip at actual reach replaces the distant crosshair/fan/target ring.
  Plain action/color names, contextual study/repaint/clearing instructions,
  and pointer restoration for menus and the tutorial Skip button.
- Final boss reveal starts only in the last 900px. The heron counts its 3.2s
  announcement there; Reeds bosses engage on entry. Warden/Umbral intro expiry
  can no longer cause a remote summon. Dormant bosses reject splashes too.

## Evidence

`node scripts/check.mjs --browser` ends **ALL REQUIRED CHECKS PASSED**:
all 19 gates, including smoke stages 124–126, all nine existing pacing bands,
balance, audio/UI, deterministic package, source and packaged browser journeys,
36 frame scenes and performance. No pacing band was widened.

`tests/clearing-browser.mjs` exercises real DOM keys and mouse for red-to-blue
repainting, bell activation, a directional Space dodge and blue-to-red combo.
Positions and one enemy windup are explicitly staged, without player god mode.
It checks hidden gameplay pointer versus visible menu/Skip pointer, actual Skip
click, and no opening boss activation even after a 600s clock jump.

Visual review at 1280 and 640 CSS pixels:

- `tests/.out/astra/32-free-repainting.png`
- `tests/.out/astra/33-readable-attack.png`
- `tests/.out/astra/34-color-combo.png`
- `tests/.out/astra/35-clearing-640.png`

Review removed overlapping recovery/damage captions and strengthened the red
warning lane. The game retains its fixed canvas: 640px scales text down; this
is layout coverage, not proof that every player can read it comfortably.

## Combat timing and balance

`node tests/clearingpace.mjs` runs actual Game/Player/Enemy/Paint movement and
damage through all rounds, with no invulnerability or in-fight health resets.
One entrance placement is staged. The bot uses precise aim, bounded painting
duty, directional dodges and real bell returns. It is not a human playtest.

| Scripted strategy | Full activity | Dodges | Damage taken |
|---|---:|---:|---:|
| Red only | 45.0s | 21 | 0 |
| Blue/red; green if hurt | 44.4s | 7 | 0 |

The two-minute newcomer experience remains a design target. Skilled/scripted
play can finish faster; no timer forces the player to wait. The bell therefore
says “Short bug battle.” Initial authored HP80/60 became **120/90** after the
earlier precise bot cleared in ~34s. Ordinary enemy/boss HP was not retuned.
All 64 sampled worlds have at least one reachable bell approach; four of 320
sampled actor spawn positions needed the existing collision correction.

Before/after balance logs: `.cache/checks/clearing-balance-before.log` and
`.cache/checks/balance.log`. Neither flags an imbalance. Zone pressure and
charged-splash rules are unchanged. Full-Game TTK samples shift slightly
(blue toad 0.9s → 0.7s; blue wisp 0.6s → 0.5s); the underlying ordinary damage
constants did not change. The sampled clean-win bank changed 3/5/6 → 5/6/3
red/blue/green; the cheapest-loadout affordability test still passes. These
are seeded simulation outcomes, not player economy measurements.

Final performance probe CPU submission p95: quiet 1.10ms, peak 1.00ms,
ceiling 1.10ms, sustained 1.40ms. Real peak paint effects 203/220 budget.
These are local headless CPU timings, not GPU timings or displayed FPS.

Artifact: `dist/frogue-gallery.zip`, SHA-256
`2da14eacd9dfdc7a10495321ec4e8564f87c4a71c4a5a3606bcbfb17bd49e1ad`.
Reports/logs are in `.cache/checks/`; browser report in `tests/.out/astra/`.

## Remaining human check

Reload the local source preview, begin a new ordinary expedition, repaint a
nearby plant, and try the bell to the right. Judge whether the brush reach,
attack lane, dodge and color effects are understandable without explanation.
No human timing/enjoyment, physical-controller or Firefox/Safari claim is made.
Repaint colors last this run; they are not new persistent world-save data.
