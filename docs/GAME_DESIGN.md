# Frogue Gallery — current game design

## Fantasy and pillars

A small frog carries a magical brush into a long, dangerous watercolor dungeon.
Painting changes both the fight and the place. Each descent can leave a personal
sketchbook keepsake, including a failed run.

1. **Color is a decision.** Red punishes, blue interrupts and green creates
   breathing room. Switching paint should change the situation.
2. **Readable danger, responsive escape.** Visible tells, committed attacks and
   safe recovery make a well-timed dodge useful and understandable.
3. **A world worth painting.** Recolorable scenery, living studies and quiet
   wildlife make the brush useful between fights.
4. **One finite descent.** Four floors, three rests and a final boss create a
   complete run. The player's build develops during that run.
5. **Warm paper, restrained motion.** Watercolor silhouettes, ink outlines,
   synthesized sound and bounded effects keep the world coherent and readable.

## The dungeon loop

Start at base stats for the selected difficulty → paint and explore a floor →
reach its far-end guardian → defeat it → rest and select a gift → descend.
The fourth guardian ends the dungeon. Death ends the current run; starting
again begins at the first floor with a fresh build.

| Depth | Floor | Guardian |
|---|---|---|
| 1 | Watercolor Marsh | The Great Gray Heron |
| 2 | Sunken Reeds | Silt Wyrm |
| 3 | Hollow Sanctuary | Hollow Warden |
| 4 | Black Reeds | Umbral Wyrm — final boss |

Hollow Sanctuary uses the Reeds environment with the Warden encounter. Health,
elapsed time, score and collected pigment carry between floors. There is no
intervening shop or separate biome selection.

The first three victories heal 35% of maximum health, rounded up and capped,
and offer one of three gifts. The player chooses, then explicitly descends.

| Gift | Effect for this run |
|---|---|
| Brighter paint | +20% brush, splash and burn damage |
| Lily heart | +2 maximum health; the added capacity is filled on descent |
| Flowing brush | Dodge and splash cooldowns multiplied by 0.88 |

Choices may repeat and stack. A complete run contains only three gift choices;
all gift power disappears at the end of the run. Legacy permanent upgrades
and equipped paintings do not affect starting stats. New Game+, its variants,
prestige, gold-tier progression, standalone challenges and Wander are removed
from the playable loop. Warden and Umbral mechanics now belong to the normal
campaign.

## Paint and the world

Painting is unlimited. Collected pigment is not ammunition, and there is no
shop purchase required to keep painting. Hold paint for regular swipes; hold
and release a fully charged splash for a broader hit.

| Paint | Combat purpose | Artistic role |
|---|---|---|
| Red | Direct damage and burn | Warm light, flowers and fireflies |
| Blue | Slow/freeze and interrupt committed attacks | Water, rain and reflection |
| Green | Root ground enemies and heal | Lilies, reeds and growth |
| Dry | Weak damage, clear status and restore color | Erase free-painted props |

The opening contains 64 freely repaintable lilies, mushrooms, flowers and
stones. Any color works; dry erases. Changes remain on the current floor and
react locally. These objects have no hidden recipe or currency requirement.
The five authored studies are separate subjects with visible numbered stages,
nearby instructions, immediate scene transformations and saved postcards.

The small brush beside the frog marks actual close-range reach. A distant
mouse position is an aim direction, not a promise that paint reaches it.
Splash charge/radius and dodge recovery appear locally when relevant.

## Movement and fair combat

Movement stops and reverses promptly; ordinary painting retains full movement
speed. Space launches a short dodge hop toward movement, or toward aim when
stationary. An input up to 120ms before cooldown completion is buffered.

Completing a living study teaches brush-hop: hold paint while hopping to leave
a brief defensive wake. Red burns pursuers, blue interrupts flies and green
holds grounded enemies. Marks expire, have a fixed cap and cannot repeatedly
refresh one enemy during the same hop. This learned painting interaction
remains available in later runs.

Lily Clearing is an optional first-floor bell encounter with three rounds of
3/4/5 bugs and at most two active enemies. Beetles show a locked warning lane
for 0.8s, dash for 0.28s and recover for 1.15s. Blue interrupts; a red hit after
blue slows/freezes a clearing target deals 50% more direct damage. The bell
starts each round; walking away cancels. First completion heals once, and
replaying does not farm loot or healing.

The intended newcomer encounter is roughly two minutes; actual human duration
and enjoyment are unmeasured. Scripted timing is not a human playtest result.
Ordinary mosquitoes also commit to a visible attack direction, then expose a
recovery window. The bestiary adds armor, ambushes and lantern interactions.

Floor guardians wait for the final 900 pixels of the floor. They cannot be
summoned remotely by early painting. The heron teaches the three-color
awakening; deeper guardians add surfaced maws, lantern pressure and darkness.
The optional guided practice holds ordinary combat while teaching these rules.

## Opening, exploration and keepsakes

The title offers a fresh dungeon run or optional guided practice. First Light
near the start gives new players a sheltered painting lesson. The optional
clearing provides room to practice dodging and color switching. Rain Choir and
Borrowed Sky add further swamp subjects; the Reeds contains Lantern Garden and
Echo Pool, plus a lantern-moth detour. The painted crossing is another optional
swamp discovery.

V opens the paused Field Atlas, H the Field Guide and J the sketchbook. The
atlas shows the frog, checkpoints, available studies and authored detours.
Nearby study cards identify the required action and color without a hidden
recipe. Decorative wildlife responds quietly without affecting combat.

The sketchbook retains eight recent pages plus two pins, sampled from actual
brush actions. Players can name a page, exhibit a pinned page on the title and
save a local 1600×960 PNG postcard. Study completion records and postcard
signatures/borders remain. Existing saves retain their pages, pins, names,
exhibition and ordinary artwork collection; obsolete New Game+ fields are
discarded. No mid-run resume is provided.

## Boundaries

The game uses Canvas 2D, procedural art and Web Audio with no runtime network
or package dependencies. Difficulty is Gentle, Normal or Bold. Saves stay in
the current browser/origin. There is no account, cloud save, online leaderboard,
touch interface or new public deployment. Canvas screen-reader support remains
limited. Runtime effects, strokes and decorative populations are bounded.

The current roadmap prioritizes clarity, the connected dungeon's balance and
human feedback. Older repeat-cycle and shop designs are historical.
