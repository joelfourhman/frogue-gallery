# Project State

_Last verified: 2026-08-30, end of M2 checkpoint. `node tests/smoke.mjs` = ALL 7 STAGES PASSED. `node --check` clean on every module._

## Current Status

Frogue Gallery is a **playable vertical slice with a full between-run loop**:

1. **Title screen** — "Begin Expedition" (Enter/Space/click) or "Visit the Atelier" (A/click); drifting swamp backdrop; lifetime stats footer.
2. **Expedition** — move, paint swipes (directional fan), charged splash (hold RMB), hop (space), 4 pigments (1–4), environmental hazards, pigment orbs, wave banners, camera + zoom + shake, boss fight (3-phase Great Gray Heron), painting restores swamp saturation (core fantasy, verified).
3. **End screen** — victory/defeat gains, bank totals; primary button **"Rest at the Atelier"** (Enter/Space/click), link "return to the pond" (Esc/click).
4. **Atelier (NEW in M2)** — between-run sanctuary over the living swamp:
   - Bank strip (red/blue/green counts + 2-slot loadout preview with generative painting motifs).
   - Tab 1 "Studio Upgrades": 3 upgrades (Pigment Satchel / Brush Craft / Swamp Vitality), 3 levels each, cost chips, level pips, **predicted stat delta** per purchase, Learn button.
   - Tab 2 "Paintings": 7 unlocked + 1 sealed (Sir Croaksworth), 2-column cards with generative art, costs, Learn/Hang/Unhang logic, max 2 hung (loadout).
   - Input: mouse hitboxes (single `_atelierGeom()` + `_atelierRows()` source of truth shared by draw AND click handling), keys 1/2 tabs, A/S/D quick-buy, Enter depart, Esc leave.
   - All purchases/hang actions persist via `SaveSys.save`.
5. **Defeat path** — half bank kept, back through end screen.

### Key architecture notes

- **`game.js` is the single load-bearing orchestrator.** ~1460 lines: state machine (`title` / `expedition` / `end` / `atelier`), `_frame` loop, boss logic, full render pass, HUD, input routing.
- **Atelier geometry contract:** `_atelierGeom()` returns all rects (tabs, rows, cards, depart/leave buttons); `_atelierRows()` returns the clickable map **including `tag` fields** (e.g. `buy:power`, `paint:spring-garden`, `depart`) — smoke test drives real hitboxes through them.
- **Cost shapes:** `UPGRADES[id].levels[n].cost` and `PAINTINGS[i].cost` are **objects** `{red,blue,green}`; `canAfford`/`payCost` want **arrays** via `costArray()`. The atelier normalizes with `Array.isArray(x) ? x : costArray(x)` at every call site.
- **`makeTuning(upgrades, loadout)`** is the stat pipeline: upgrades add maxHp/power/capacity; loadout paintings modify tuning (freeze duration, burn dps, heal, splash radius, etc.). The atelier shows the delta by diffing `makeTuning` before/after.
- **View contract:** `_view()` = `{x, y (world top-left), scale, w, h}`; screen→world is `mouse.x / v.scale + v.x`.
- **`costArray`** yields `{color, amount}` objects (NOT tuples).
- **`paperPanel`** saves/returns a clipped ctx; **`paperEnd`** restores. Draw text inside via `_leftText` (left-anchored helper) or `centerText`.
- Node v22 for syntax checks + headless runtime test; `python -m http.server 8765 --bind 127.0.0.1` for browser checks; `browser_exec` is dead (Chrome popup never surfaced) — verification channels: `node tests/smoke.mjs` + `desktop_preview` visual.

## Test Status

`tests/smoke.mjs` — 7 stages, all passing:
1. boot + title
2. begin expedition (world build: ripples + pads)
3. combat (swipe damage, directional fan, color restore)
4. charged splash (charge, fire, consume)
5. heron boss → victory (flight, stats, end screen)
6. **end screen → atelier** (30 clean frames, upgrade purchase via real hitbox + bank debit + localStorage persist, tab switch, painting buy/hang/unhang, Esc to title)
7. defeat run + save persistence

## Immediate next work (M3, in priority order)

1. **Balance pass**: full simulated playthrough timing — is the first boss reachable in ~4–6 min? Enemy spawn rate, orb values, boss awaken pacing. Adjust `logic.js` tuning.
2. **Croaksworth story beat**: `flags.croaksworthAsked/Given` exist — the sealed painting unlocks after first victory (ask → give). Wire into atelier/title.
3. **Options**: `freshOptions`/`migrateOptions` + `SaveSys.loadOptions/saveOptions` exist; add mute/volume + key hints to title or pause.
4. **Best-run tracking** (`save.bestRun` reserved): record {pigments, time, cleared} on victory; show on title.
5. **Polish**: pause menu with options; audio unlock on first gesture; banner polish; low-HP vignette.
6. Optional content only after the above: more enemy types, world variance, more paintings.

## Recovery Notes (for a fresh session)

```bash
cd /c/Users/joelf/projects/hermes_ninfer_stack/workspace/frogue-gallery
node tests/smoke.mjs          # full loop test (should print ALL SMOKE TESTS PASSED)
for f in src/*.js; do node --check "$f"; done
python -m http.server 8765 --bind 127.0.0.1   # then open http://127.0.0.1:8765/index.html
```

- All game code under `frogue-gallery/` — self-contained, no installs, no build step (ES modules, straight to browser).
- Git: last commit = `feat: M2 — the Atelier` (verify with `git log --oneline -3`).
- Do NOT touch anything outside `frogue-gallery/`. No admin/elevation, ever.
- The mission's Definition of Done includes: playable loop, painting feel, complete gameplay loop, tested, balanced, polished, optional content last. M1 (playable slice) and M2 (atelier) are done; M3+ as above.