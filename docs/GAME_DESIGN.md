# Frogue Gallery — current game design

## Fantasy and pillars

You are a small frog with a brush large enough to change your world. The swamp
is dangerous, but it is also a subject worth painting. Every expedition should
leave both useful progress and something beautiful.

1. **Color is a decision.** Fire, interruption, healing and restoration have
   different uses; swapping paint should change a situation.
2. **Small frog, readable danger.** Threats announce themselves. A hop, a blue
   interruption, or green breathing room should let a player recover.
3. **The swamp remembers.** Painting restores scenery, animates authored
   places, and leaves a personal sketchbook instead of only a score.
4. **Warm paper, restrained motion.** Watercolor silhouettes, expressive
   enemies, synthesized sound and short blooms reinforce a coherent world.
5. **A finite expedition.** Encounters, rests, optional studies and a boss
   give each trip a beginning and an ending. Returning to the Atelier matters.

## Core loop

Choose a difficulty/build → travel east and paint → collect pigment currency
and discover studies → reach checkpoints → awaken/defeat the boss → bank
earnings, inspect the page, improve the build, set out again.

A first run can be an exploration or a short defeat. Currency, lessons and
study unlocks create useful progress even before the first victory.
The Great Gray Heron closes the base swamp; later biomes/NG+ already exist
for players who want greater difficulty.

## Paint

The opening offers 64 freely recolorable lilies, mushrooms, wildflowers and
stones. These are artistic subjects, not recipes: red/blue/green always work,
dry erases, and colors remain for the run. Numbered pond studies retain their
three-color transformations and are explained separately when approached.

| Paint | Tactical purpose | Environmental / artistic role |
|---|---|---|
| Crimson | Highest direct damage and burn; punishes armored pursuers | Warm light, fireflies, suns |
| Cobalt | Slow, then freeze; cancels committed fly strikes | Water, rainfall, reflection |
| Moss | Root ground enemies and heal the frog | Lilies, reeds, living growth |
| Dry | Weak fallback, clears status, restores color quickly | A quiet restorative brush |

Painting is unlimited. The three collected currencies buy permanent options;
the bank is not an ammo meter. Holding paint gives a regular swipe.
A full charged splash rewards grouping targets; it fires when released.
Enemy weaknesses and the boss's three-hue awakening give color switching value.

The world's pigment cells and growth already influence combat space.
The new studies add intentional environmental subjects, with three visible
transformations rather than requiring a hidden interaction recipe.

## Movement and defense

Movement remains direct and forgiving. Space hops toward movement, or toward
aim when stationary. An input pressed up to 120ms before the cooldown ends is
buffered. The HUD makes the hop's recovery visible.

Brush-hop is learned by creating the first living study. Holding paint while
hopping leaves a brief colored wake. Its purpose is to escape and manage
pursuers, not raise boss DPS. Red punishes pursuit, blue breaks a fly's strike,
and green briefly holds a grounded enemy. A hop cannot indefinitely refresh
the same enemy, and all marks expire.

## Threats and fair reaction

Lily Clearing at (1050,730) is an optional bell-triggered activity. Three
rounds release 3/4/5 bugs, at most two alive. Authored beetles warn for 0.8s,
dash along that locked direction for 0.28s, and recover safely for 1.15s.
Blue interrupts; red on a blue-slowed/frozen clearing target gains 50% direct
damage. Green supplies the existing root/healing option. Targets have
120 beetle / 90 mosquito HP, scaled by difficulty. No loot is awarded;
first completion heals once, replay is cosmetic. Walking away cancels safely.
The intended newcomer experience is roughly two minutes, with no forced wait
or exact-time promise; the precise scripted dodge bot clears in ~45 seconds.

Final bosses remain dormant until the last 900px of their biome. A swamp
heron then gets its 3.2s announcement; Reeds apexes engage on arena entry.

The existing bestiary offers armor, pursuit, ranged pressure, ambush, sound
hunting and lantern interactions. Mosquitoes now commit to a marked direction
after 0.60 seconds, dart for 0.30 seconds, then recover for 0.85 seconds.
Sideways movement, a hop or blue paint are clear counters; approach contact
does not deal damage.

Bosses have attack tells and vulnerability windows. The heron teaches the
three-hue awakening, while Reeds bosses add surfaced maws and lantern rules.
The optional practice heron cannot die before teaching that rhythm.
Practice is quiet: ordinary encounters and boss attacks are held while a
lesson is active, including retraining from the Field Guide.

## Opening experience

The intended sequence is:
- Read movement/paint controls on the title; start immediately or choose the
  optional seven-step guided practice.
- Follow the short eastward hint to First Light. Its unfinished pond is a
  protected teaching area for a player who has not earned brush-hop.
- Paint water, lilies and fireflies. See each stage change the scene.
- Earn a useful movement interaction and receive the first saved postcard.
- Meet readable enemies, use the new wake, and find the next checkpoint.
- Discover the Rain Choir and Borrowed Sky as optional variations before
  reaching the final threat.

This sequence is implemented and exercised with browser input. Exact human
timing and enjoyment remain playtest questions, not assertions from bot speed.

## Progression and gallery

The Atelier retains the existing painting catalog, two-slot builds, upgrades,
synergy pairs, collections, NG+ and challenge progression. The new reward
track is deliberately short: one study teaches brush-hop; three grant a
cosmetic signature. No extra talent tree or currency was added.

The sketchbook gives "Gallery" a personal meaning. Each expedition leaves
a bounded sample of its actual marks, illustrated with completed study
memories. Players can browse eight recent pages and save a postcard as PNG.
A failed expedition still has a place in the book. Pages describe their
outcome and retention limit; they are not claimed to be complete replays.

## Art direction and sound

The existing procedural art avoids runtime assets and network dependencies.
Warm cream paper, ink outlines, muted swamp greens and localized pigment
saturation support the painter fantasy. Each completed study becomes a small
animated diorama: drifting fireflies, rainfall, or birds over reflected light.

Short sound cues mark coats, transformations, completion and learning.
Existing biome ambience, combat stingers, directional effects, particles and
hit feedback remain. Effects pools and wake marks have explicit limits;
the world should stay readable during crowded fights.

## Deliberate boundaries of this slice

Five authored studies across swamp/Reeds, one earned ability, three difficulty
choices, the established campaign and an exportable curated sketchbook form the
current experience. The painted crossing and lantern moth provide optional
detours. A paused Field Atlas helps find them; progress cards make brush feedback
explicit and bounded decorative wildlife responds to pigment. No account,
online leaderboard, cloud save, touch UI or public deployment was added.
