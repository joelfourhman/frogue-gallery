# Frogue Gallery

A tiny frog paints our stolen-color swamp back to life. The Umbral Wyrm took
the color from our home; every brushstroke brings some of it back. Repaint
the place in your own colors, face the guardians along the way, and reach
the color thief at the far shore.

**One journey through our swamp — four regions, one final boss, 2026-11-11.**
The current direction is creative painting and quiet, visually readable combat.
The compatibility identifiers remain game 1.0.0 / save schema 12.

## Play locally

On Windows, double-click **Launch Game.cmd** in this folder. It starts the
local server and opens Google Chrome at http://127.0.0.1:8767, reusing the
existing preview if available. Keep the launcher window open when it starts
a new server; Ctrl+C stops that server. It finds installed Node or Codex's
bundled Node automatically. Chrome must be installed.

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

Press Enter. Repaint pale lilies, flowers, mushrooms and stones your own way.
Aim at individual petals, flower heads, caps or stones to give each its own
color. Brush strokes leave stripes in your painting direction; splashes add
speckles. Dry brush erases the part you touch. Your design stays for this region.
Mushroom caps bounce and answer with notes; flowers lean toward your brush,
lilies turn and ripple, reeds bend and lanterns release colored fireflies.
Color all four objects in a garden for a quiet bloom, without a completion popup.
Deeper regions add hanging lanterns and swaying whisper reeds. Walk right to the
**Lily Clearing** bell and paint it to start a short, optional three-round fight.
Red lanes warn of an attack: dodge sideways with Space, then paint during
recovery. Blue interrupts; following blue with red makes that red hit 50%
stronger in the clearing. Paint the bell between rounds; walk away to cancel.
First completion restores health; replay freely without currency rewards.
A result card remembers battle time, rounds, dodge uses and colors tried.
The first guardian waits at the far end of the swamp. Defeating it opens the
next region of the same journey.

Travel through **Watercolor Marsh → Sunken Reeds → Hollow Sanctuary → Black
Reeds**, facing the Great Gray Heron, Silt Wyrm, Hollow Warden and finally the
Umbral Wyrm, the final boss who stole the color. Between regions, rest to heal 35% of maximum health and select one
of three offered gifts. The first rest offers stronger paint, two more health
points, or faster dodge/splash recharge. Later rests mix familiar choices with
broader reach, quicker strokes and stronger green healing. Cards show the
before-and-after values; offers stay fixed for that run.
Choose Continue when ready. Gifts stack for this run; a new attempt starts in
the marsh with a fresh brush. Defeating the Umbral Wyrm brings our stolen color home.

You can also visit **First Light**, the small gray pond near the start.
Select the numbered colors and hold paint on each circle. Water, lilies and
fireflies appear as you work. Completing it heals you, saves a sketchbook page,
and teaches **brush-hop**: hold paint while hopping to leave a defensive wake.
Two more living studies await along the swamp.

The optional guided practice on the title teaches each pigment and the
three-color boss awakening. V opens the Field Atlas, H the Field Guide, and J
your sketchbook. All pause the action. The atlas shows your next unfinished
study, guardian arena, clearing and optional detours; nearby study cards
explain each coat of paint. Brief regional arrivals tell the story, and quiet
route hints yield completely during fights. Open carved-reed landmarks mark
guardians; the final marker names the color thief.
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

Paint is unlimited; colored orbs are not brush ammunition. Red burns, blue slows/freezes,
green roots and heals, and dry clears status and restores color.
The small brush tip beside the frog shows actual close-range reach; move closer
to distant objects. Holding splash shows its radius and charge beside the frog.
The dodge meter appears briefly while the hop recovers. Menus retain a normal
mouse pointer; the game no longer shows a distant crosshair.

## What's included

- Five living field studies across swamp/Reeds, an earned brush-hop and cosmetic postcard rewards.
- 64 freely repaintable objects per region with individually colored parts,
  directional stripes, splash speckles, musical caps and distinct local reactions.
  Each region has 16 bounded garden celebrations without completion text.
- A replayable three-round clearing with a useful completion card. Attack
  lanes, animation and paint effects carry combat feedback without coaching popups.
- An eight-page sketchbook containing sampled real strokes; save a 1600×960
  PNG postcard from any page.
- One journey across four swamp regions, four main guardians, named encounter zones,
  checkpoints, pigment counters and lantern play. Hollow Sanctuary reuses
  the Reeds environment with its own guardian.
- Six possible run-only gifts, three offered at each of three rests, numeric
  previews and an end-of-run build summary; no New Game+, prestige or shop.
- Paper panels, procedural watercolor scenery, synthesized music and sound.
- Gentle / Normal / Bold difficulty; music/SFX and presentation settings;
  browser-local saves and JSON export/import.

Designed for a desktop browser with mouse/keyboard or a standard controller.
No touch controls. Saves belong to the browser and site origin; export them
before moving to a different URL. There is no mid-run resume. Existing
sketchbooks, pins, names, title exhibitions and ordinary artwork collections
are retained; legacy purchased stats do not affect a new journey.

## Develop, verify, distribute

```sh
node scripts/check.mjs             # smoke, campaign, combat pacing, balance, UI/audio, package
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

Read [PROJECT_STATE.md](PROJECT_STATE.md), then the [current roadmap](docs/ROADMAP.md).

- [Current implementation and architecture](docs/CURRENT_STATE.md)
- [Current game design](docs/GAME_DESIGN.md)
- [Milestones and next playtest priorities](docs/ROADMAP.md)
- [Validation and its limits](docs/VALIDATION.md)
- [Durable agent rules](AGENTS.md)
