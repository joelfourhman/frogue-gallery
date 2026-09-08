# Frogue Gallery

A cozy action roguelite about a tiny frog painter with a magical paintbrush,
exploring a watercolor swamp. **Painting is the game** — the brush is weapon,
movement tool, and world-editing device at once. Colors change *how* you
approach a situation, not just the damage numbers: the world starts washed out
gray, and every stroke restores a little of its color.

A target expedition is a 15–20 minute run: Title → Atelier (build) → a
5400-pixel journey through 4 named zones with checkpoints → a final boss.

## Running it

No build step, no package manager, no dependencies — just a browser with
Canvas 2D and ES modules.

```
python -m http.server 8765 --bind 127.0.0.1
```

then open <http://127.0.0.1:8765>. (Or open `index.html` directly — any local
file server works; the game is loopback-only and uses `localStorage` as its
only persistence, keys prefixed `frogue_gallery_`.)

## Controls

**Keyboard + mouse** (the primary scheme):

- **WASD / arrow keys** — move
- **Mouse aim + hold left button** — paint with the selected pigment
- **Hold right mouse** — charge a Splash burst, release to fire
- **Space** — hop (brief i-frames)
- **1 / 2 / 3** — select pigment: **Crimson** (red: big damage + burn, ignores
  armor) / **Cobalt** (blue: slow, second coat within 1s freezes) / **Moss**
  (green: light damage, heals the frog, roots ground enemies, restores swamp
  color)
- **4** — **dry brush** (no pigment: light damage, no status — it cleans enemy
  status and restores color fastest; it never runs out, so you can never
  softlock)
- **H or ?** — Field Guide (in-run reference: controls, pigments, enemies,
  boss counterplay; pauses the run)
- **P** — pause · **M** — mute

**Title screen:** **Enter / Space** — begin expedition · **A** — Atelier ·
**G / N / B** — Gentle / Normal / Bold · **O** — Options · **C** — Curator
Challenge (appears after your first victory) · **R** — Beneath the Reeds
(appears after a victory).

**Gamepad** (optional, raw Gamepad API, no drivers): plug in a pad and it
engages automatically (Auto/Off toggle in Options). Left stick moves; **A**
confirm / **1** Crimson · **X** **2** Cobalt · **Y** **3** Moss · **RB** hop ·
**B** charge Splash (hold/release) · **LB** lantern (in the Reeds); in menus
**A** confirm, **B** back, D-pad navigates. A quiet idle pad disengages after
6s so it never fights your keyboard.

**Options panel** (O): music and SFX volume, screen shake, low-HP vignette,
paper grain, Wandering Expeditions, Gamepad Auto/Off, and a paste-based Save
export/import (loopback-only — no file downloads).

## What's in the game

**The expedition.** Cross the swamp (Reed Flats → Slick Hollow → Bramble
Thicket → Gray Shore and beyond) through waves of Mud Beetles, Mosquitos,
Grumpy Toads, armored Mud Turtles, and sound-hunting Blind Crag Frogs, with
checkpoints, pigment orbs, and zone set-pieces. Pigments interact: red fire
spreads through vegetation, blue on an already-slowed enemy freezes it solid,
green grows reeds that block enemies.

**Paintings = the build.** A 10-painting catalog bought with banked pigment,
**2 equip slots** (loadout tension), named synergy pairs, and per-painting
upgrades (pigment capacity / brush power / vitality). The Atelier is the
between-run economy, with characters who talk back.

**Six bosses.** The Great Gray Heron (first time), the Great Green Heron (NG+),
the Gilded Heron (NG+ cycle 3+, its plume absorbs your green healing), the
Silt Wyrm (Beneath the Reeds), The Hollow Warden (a Wander expedition's apex),
and the Umbral Wyrm (the NG+ Reeds' apex). Herons fight the signature
paint-to-awaken mechanic: accumulate three hues to turn them vulnerable.

**New Game+ / gold.** Victory unlocks deeper cycles: escalating difficulty, a
gold-pigment economy with gold-tier paintings, player-chosen expedition
modifiers, a "Master" tier at cycle 4+, and a seeded daily Curator Challenge
with a top-5 score file.

**Beneath the Reeds (R on the title).** A victory-gated descent into the
flooded lower swamp where darkness is a rule: your paper lantern (**L**
in-run) rewrites the encounters — Wisp, Serpent, and Leech instead of the
surface trio — with the Silt Wyrm below.

**The Wander (D4, off by default).** A bounded procedural expedition variant:
the terrain stays the same hand-tuned painting, but the encounter content is
sampled from a seeded stream inside a hand-tuned pacing envelope. A seed card
shows you what you're walking into.

**The Full Collection.** The meta pays off: the Gallery Wall tracks your
progress (X / 10 paintings, Y / 6 bosses). Collecting every painting and
defeating every boss mints a permanent "capstone" gallery bonus — the museum
keeps you better — and the title screen wears a gilded badge.

## Architecture

Vanilla JS ES modules + Canvas 2D + Web Audio. **Zero dependencies, no build
step, no assets** — all art is procedural (watercolor-style canvas drawing),
all audio is synthesized (no audio files). The rule logic (balance, save
schema + migrations, economy, pacing) lives in pure, browser-free
`src/logic.js`, imported by the headless test suite (`tests/smoke.mjs`, plus
pacing probes `tests/pace.mjs`, `tests/humance.mjs`, `tests/ngpace.mjs`,
`tests/reedspace.mjs`, `tests/wandpace.mjs`, `tests/bosspace.mjs`).

The game runs loopback-only: browser `localStorage` is the only persistence;
there are no network calls, no servers, and no cloud services.

## Layout

```
index.html          entry point (Canvas 2D, ES module boot)
src/game.js         frame loop, state machine, HUD/screens
src/player.js       the frog: movement, pigment paint, damage, death
src/enemies.js      the enemy archetypes + bosses
src/logic.js        PURE rule logic: save schema, migrations, balance, economy
src/save.js         thin localStorage adapter over the logic.js schema
src/world.js        the swamp: zones, checkpoints, pigments, decor
src/paint.js        wet-paint brush physics
src/particles.js    splash/ink particles
src/ui.js           paper-styled canvas UI primitives
src/audio.js        Web Audio synth: SFX + ambient
src/math.js         vector/geometry helpers
src/input.js        keyboard + mouse capture
tests/              headless smoke suite + pacing probes
docs/               design, roadmap, decisions, status
```
