# Frogue Gallery

A tiny frog paints a gray swamp back to life. Burn pursuers with crimson,
freeze a diving fly with cobalt, grow a little pond into a living painting,
and bring home a postcard made from your own brush strokes.

**The Living Sketchbook — exploration and painting update, 2026-11-11.**
The compatibility identifiers remain game 1.0.0 / save schema 12.

## Play locally

With Node.js 22 or newer installed, run from this directory:

```sh
node scripts/dev.mjs
```

Open [Frogue Gallery](http://127.0.0.1:8765). Ctrl+C stops the server.
If that port is occupied, use `node scripts/dev.mjs --port 8766`.
The server binds only to your computer and disables stale development caches.
There is no install step or runtime dependency. Use HTTP, not a double-click
on `index.html`: the game loads JavaScript modules.

Alternative: `python -m http.server 8765 --bind 127.0.0.1`.
The Node server additionally restricts served files to the game itself.

## First expedition

Press Enter. Walk east to **First Light**, the small gray pond near the start.
Select the numbered colors and hold paint on each circle. Water, lilies and
fireflies appear as you work. Completing it heals you, saves a sketchbook page,
and teaches **brush-hop**: hold paint while hopping to leave a defensive wake.
Two more living studies await along the swamp.

The optional guided practice on the title teaches each pigment and the
three-color boss awakening. V opens the Field Atlas, H the Field Guide, and J
your sketchbook. All pause the action. The atlas shows your next unfinished
study and optional detours; nearby study cards explain each coat of paint.
Dragonflies and pond skaters quietly respond to your brush. Every expedition
can leave a keepsake, even a defeat.

## Controls

| Action | Keyboard / mouse | Standard gamepad |
|---|---|---|
| Move | WASD / arrows | Left stick |
| Aim / paint | Mouse / hold left button | Right stick / hold RT |
| Charged splash | Hold right button; release when full | Hold B; release |
| Hop / earned brush-hop | Space / hold paint + Space | RB / RT + RB |
| Red / blue / green | 1 / 2 / 3 | A / X / Y |
| Cycle combat colors | Q / E or mouse wheel | A / X / Y directly select |
| Dry brush | 4 | LT |
| Lantern, in the Reeds | L | LB |
| Pause / sketchbook | P or Esc / J | Start / Back |
| Field Atlas (pauses expedition) | V; V or Esc to close | Pause → Field Atlas; B to close |
| Guide / mute | H or ? / M | Guide available from pause |
| Menu navigation | Mouse / displayed shortcuts | D-pad, A confirm, B back |

Paint is unlimited. Colored orbs are banked currency for Atelier paintings
and upgrades; they are not brush ammunition. Red burns, blue slows/freezes,
green roots and heals, and dry clears status and restores color.
The colored arc beside the frog shows the brush's actual close-range reach.
A ring highlights the nearest creature inside it. Holding splash shows its
radius and charge beside the frog; the small arc at your feet tracks hop recovery.

## What's included

- Three living field studies, an earned brush-hop and a cosmetic signature.
- An eight-page sketchbook containing sampled real strokes; save a 1600×960
  PNG postcard from any page.
- Three biomes, six boss archetypes, named encounter zones, checkpoints,
  enemies with pigment counters, lantern play, NG+, and optional Wander runs.
- Atelier paintings and two-slot builds, upgrades, collections and local
  Curator Challenges.
- Paper panels, procedural watercolor scenery, synthesized music and sound.
- Gentle / Normal / Bold difficulty; music/SFX and presentation settings;
  browser-local saves and JSON export/import.

Designed for a desktop browser with mouse/keyboard or a standard controller.
No touch controls. Saves belong to the browser and site origin; export them
before moving to a different URL.

## Develop, verify, distribute

```sh
node scripts/check.mjs             # smoke, nine pacing gates, balance, UI/audio, package
node scripts/build.mjs             # dist/frogue-gallery/ + dist/frogue-gallery.zip
node scripts/dev.mjs --dist        # play the exact distribution
node scripts/check.mjs --browser   # adds browser journeys, 36 frames and effects stress
```

The first three commands use only Node's standard library. Optional browser
checks use **playwright-core 1.63.0** and installed Chromium/Chrome/Edge.
For a fresh test machine only:
`npm install --no-save --package-lock=false playwright-core@1.63.0`.
Set `CHROME_PATH` if browser discovery cannot find your executable.
This tooling is never included in the game or ZIP.

The ZIP is ready for an HTML5 itch.io upload. **No public deployment was
performed.** See [deployment choices and upload steps](docs/DEPLOYMENT.md).

## Continue development

Read [PROJECT_STATE.md](PROJECT_STATE.md), then
[the Astra handoff](docs/ASTRA_HANDOFF.md).

- [Current implementation and architecture](docs/CURRENT_STATE.md)
- [Current game design](docs/GAME_DESIGN.md)
- [Milestones](docs/ROADMAP.md) and [executable Qwen backlog](docs/QWEN_BACKLOG.md)
- [Validation and its limits](docs/VALIDATION.md)
- [Durable agent rules](AGENTS.md)
