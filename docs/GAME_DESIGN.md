# Frogue Gallery — current game design

## Fantasy and pillars

This is our swamp. The Umbral Wyrm, the final boss, stole its color. A small
frog carries a magical brush across the marsh to paint our home back to life
and reclaim what was taken. Painting changes both the fight and the place;
the player should feel like a creative resident, not a visitor clearing rooms.
Each journey can leave a personal sketchbook keepsake, including a failed run.

1. **Color is a decision.** Red punishes, blue interrupts and green creates
   breathing room. Switching paint should change the situation.
2. **Readable danger, responsive escape.** Visible tells, committed attacks and
   safe recovery make a well-timed dodge useful and understandable.
3. **A world worth painting.** Recolorable scenery, living studies and quiet
   wildlife make the brush useful between fights.
4. **Bring our color home.** Four regions, three rests and a final boss create a
   complete run. The player's build develops during that run.
5. **Warm paper, restrained motion.** Watercolor silhouettes, ink outlines,
   synthesized sound and bounded effects keep the world coherent and readable.

## The swamp journey

Start at base stats for the selected difficulty → paint and explore a region →
reach its far-end guardian → defeat it → rest and select a gift → continue.
The fourth guardian is the color thief. Defeating it returns the stolen color
to our swamp. Death ends the current run; starting again begins in the marsh
with a fresh brush.

| Order | Region | Guardian |
|---|---|---|
| 1 | Watercolor Marsh | The Great Gray Heron |
| 2 | Sunken Reeds | Silt Wyrm |
| 3 | Hollow Sanctuary | Hollow Warden |
| 4 | Black Reeds | Umbral Wyrm — the color thief and final boss |

Hollow Sanctuary uses the Reeds environment with the Warden encounter. Health,
elapsed time, score and collected pigment carry between regions. There is no
intervening shop or separate biome selection.

The first three victories heal 35% of maximum health, rounded up and capped,
and offer three cards from six possible gifts. The player chooses one, then
explicitly continues. Cards show the actual rounded before-and-after values.

| Gift | Effect for this run |
|---|---|
| Brighter paint | +20% brush, splash and burn damage |
| Lily heart | +2 maximum health; the added capacity is filled on descent |
| Flowing brush | Dodge and splash cooldowns multiplied by 0.88 |
| Broad brush | Swipe reach multiplied by 1.20; splash radius by 1.15 |
| Quick strokes | Swipe cooldown multiplied by 0.85 |
| Kind moss | Green ground-healing and healing on paint multiplied by 1.35 |

The first rest teaches the original three choices. The second keeps Lily heart
and offers two seeded specialties; the third keeps Flowing brush and offers
two seeded specialties. Broad brush, Quick strokes and Kind moss form that
specialty pool. The run seed fixes offers; viewing cards never rerolls them or
consumes combat randomness. Choices may repeat and stack when offered again.
A complete run contains only three gift choices;
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

Each region contains 64 freely repaintable objects. The marsh keeps lilies,
mushrooms, flowers and stones; deeper gardens add hanging lanterns and whisper
reeds. Each cap, flower head, petal, reed head, lantern panel and stone keeps
its own color. A swipe aims at one part and leaves stripes in the stroke's
direction; a splash adds speckles to the parts it reaches. Dry clears only
touched parts and their marks. At most eight decorative marks remain per prop.
Changes stay in the current region. Lilies turn and ripple, flowers lean
toward the brush, reeds bend, lanterns send out colored fireflies, and mushroom
caps bounce and play a note. Painting all four objects in one of 16 clusters
triggers a finite bloom once per region, without a completion caption.
Erasing does not rearm that celebration. These objects have no hidden
recipe, gameplay reward or currency requirement, and do not change collision.
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

Lily Clearing is an optional marsh bell encounter with three rounds of
3/4/5 bugs and at most two active enemies. Beetles show a locked warning lane
for 0.8s, dash for 0.28s and recover for 1.15s. Blue interrupts; a red hit after
blue slows/freezes a clearing target deals 50% more direct damage. The bell
starts each round; walking away cancels. First completion heals once, and
replaying does not farm loot or healing.

The completion card shows active battle time, cleared rounds, dodge uses and
colors tried, then offers encouragement and a practical replay suggestion.
It does not grade the player or award power for performance. During fights,
attack lanes, enemy poses and paint effects communicate the danger. Repeated
"Dodge sideways", opening, blue-stop and boss-coaching popups are removed.
Even arrival and route cards yield to live enemies and boss fights. Learning
belongs in optional practice and the paused guide, not text over each attack.

The intended newcomer encounter is roughly two minutes; actual human duration
and enjoyment are unmeasured. Scripted timing is not a human playtest result.
Ordinary mosquitoes also commit to a visible attack direction, then expose a
recovery window. The bestiary adds armor, ambushes and lantern interactions.

Region guardians wait for the final 900 pixels of the region. They cannot be
summoned remotely by early painting. The heron teaches the three-color
awakening; deeper guardians add surfaced maws, lantern pressure and darkness.
The optional guided practice holds ordinary combat while teaching these rules.

## Opening, exploration and keepsakes

The title offers a fresh journey through our swamp or optional guided practice. First Light
near the start gives new players a sheltered painting lesson. The optional
clearing provides room to practice dodging and color switching. Rain Choir and
Borrowed Sky add further swamp subjects; the Reeds contains Lantern Garden and
Echo Pool, plus a lantern-moth detour. The painted crossing is another optional
swamp discovery.

V opens the paused Field Atlas, H the Field Guide and J the sketchbook. The
atlas shows the frog, checkpoints, available studies, authored detours, the
guardian arena and the marsh clearing. Each region has a brief introduction
and its own guardian landmark emblem. One quiet route objective yields to
teaching cards, event banners and nearby fights. The open arena landmark is
decoration, not another locked gate or progression requirement.
Nearby study cards identify the required action and color without a hidden
recipe. Decorative wildlife responds quietly without affecting combat.

The run-end screen pairs the latest postcard with the brush gifts earned on
that journey, including repeated-gift counts. An early defeat shows a fresh
brush message rather than an empty summary.

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

The current roadmap prioritizes creative ownership of our swamp, quiet combat,
the connected journey's balance and human feedback. Older room-clearing,
repeat-cycle and shop framing must not replace the stolen-color story.
