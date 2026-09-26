# Frogue Gallery — Design Notes

Internal design document. The game itself is in `index.html` + `src/`.

## Pillar
**Painting is the game.** The brush is weapon, movement tool, and world-editing
device. Colors change *how you approach a situation*, not just damage numbers.

## Session shape
Title → Atelier (build) → Expedition (journey map, 4 encounter zones +
checkpoints) → The Great Gray Heron → victory. Target: 15–20 min run.

## Pigments
- **Crimson** (red): damage +1.25x, burn DoT, ignites vegetation/embers.
- **Cobalt** (blue): slow; second slow within 1s → freeze 1.2s; slick ground.
- **Moss** (green): root, small player heal per hit, grows reeds, restores
  swamp color.
- Dry brush (no pigment): 50% damage, no status — never a softlock.

Interactions (few, understandable):
- red + vegetation = fire (spreads to enemies standing in it)
- blue + already-slowed enemy = freeze
- green + soil = reeds (block enemies, burnable)
- painting the Heron accumulates color → Awakened (vulnerable) state

## Enemies
- **Mud Beetle**: armored (30% phys resist), charges with telegraph;
  burns ignore armor.
- **Mosquito**: fast weaver, telegraphed dive; fly (immune to root);
  slow/freeze work.
- **Grumpy Toad**: telegraphed hop + landing shockwave; 20% "dizzy" on paint
  (sits, +50% dmg taken).

## Boss — The Great Gray Heron
- Phases: Stalk (>66%), Frenzy (≤66%, summons + tail sweeps),
  Gray Storm (≤33%, dashing lunges + splash jump zones).
- Color mechanic: painting accumulates hue (needs red+blue+green ≥ 50 each →
  150 total) → Awakened 6s (2x damage taken, slowed, colorful). Hue resets
  to half after. Victory = a blooming heron flies off.

## Meta
- One resource system: banked pigment units (per color), earned in
  expeditions (50% banked on death, full on victory/retreat of what was
  collected pre-death).
- Paintings = the build: catalog of 8, cost in pigments, **2 equip slots**
  (loadout tension).
- Upgrades: pigment capacity / brush power / vitality, 3 levels each.
- Atelier characters: Sir Croaksworth (asks for a portrait), Mabel (pigment
  origin stories), Giuseppe (trades), Monet (rival one-liners).

## Feel targets
- Swish: arc trail, 3 splatter blobs, swish sound, 0.22s cooldown.
- Splat: radial ring + droplets, screen micro-shake on charged.
- Hop: squash→stretch, i-frames 0.18s, arc.
- Hit: enemy flashes, ink spatter, knockback, painted body tint.
- Caps: ≤ 220 particles, object pools, no per-frame allocations in hot paths.