# v1.9 Frame Evidence — Baseline Set (T0)

This directory holds the **before/after frame evidence** for the v1.9 quality
pass. Every S/J/L polish item ships its real before/after screenshots here,
captured by the harness at `tests/frames.mjs`. The A1 audit is a before/after
review of this set.

**The PNGs in this directory are gitignored** (they are large, regenerated
artifacts). Only this `README.md` is committed — it is the index of what each
frame is, so the audit trail survives even though the pixels are local.

## How to (re)capture the baseline

```
node tests/frames.mjs
```

- Boots the real game over loopback on a **free port (never 8765)**, headless
  Chrome (playwright-core — the project's sanctioned dev tooling).
- Freezes the rAF loop + seeds `Math.random` (mulberry32(12345)) so every world
  build is **reproducible**, then drives 36 scenes to fixed positions/states and
  forces one real `_drawAll()` render per frame.
- Writes `tests/frames/<scene>.png` and verifies each frame is **non-trivial**
  (pixel std-dev ≥ 2 AND ≥ 30 KB — a real render, not a blank fill). Exits
  non-zero if the set is incomplete (< 20 frames).
- Kills its own server + browser at the end (leaves nothing running).

To capture **after** a polish change: `node tests/frames.mjs` again into the same
dir (or copy a frame aside first), and reference the before/after pair in the
commit message.

## The 36 baseline frames

| Frame | Scene |
|---|---|
| `title` | Title screen (idle frog, controls card, version) |
| `options` | Options panel (volume sliders, toggles) |
| `wander-seed-card` | The Wander seed card (pre-expedition) |
| `full-collection-badge` | Title + the Full Collection gilded badge (H2) |
| `atelier-upgrades` | Atelier — Studio Upgrades tab |
| `atelier-loadout` | Atelier — Paintings tab (2-painting loadout) |
| `gallery-wall-empty` | The Gallery Wall (empty collection) |
| `gallery-wall-full` | The Gallery Wall (full-collection glow, H2) |
| `paint-red` / `paint-blue` / `paint-green` / `paint-dry` | Paint in flight — each pigment on soil |
| `paint-water` | Paint on a water surface (blue) |
| `paint-vegetation` | Paint on vegetation (green) |
| `enemy-beetle` / `enemy-mosquito` / `enemy-toad` | The three classic enemies |
| `enemy-wisp` / `enemy-serpent` / `enemy-leech` | The Reeds light-bestiary |
| `status-burn` / `status-freeze` / `status-root` | An enemy under each status (red/blue/green) |
| `boss-gray-heron` (+ `-awaken`) | The Great Gray Heron, asleep + awakened |
| `boss-green-heron` | The Great Green Heron (NG+) |
| `boss-gilded-heron` | The Gilded Heron (NG+ cycle 3+, gold plume) |
| `boss-silt-wyrm` | The Silt Wyrm (Reeds, surfaced) |
| `boss-hollow-warden` (+ `-awaken`) | The Hollow Warden (Wander apex, maw) |
| `boss-umbral-wyrm` (+ `-deep-dark`) | The Umbral Wyrm (Black Reeds; phase-2 deep dark) |
| `reeds-descent` | Beneath the Reeds — the lit paper lantern |
| `black-reeds-descent` | Black Reeds (NG+, darker descent) |
| `warden-maw-open` | The Warden's maw open (paintable window) |
| `end-recap` | End screen (victory + the route-strip recap) |

## Notes on the darker frames

The Reeds / Black Reeds / Silt Wyrm / Umbral Wyrm / wisp / serpent / leech
frames are **intentionally dark** (mean luminance ≈ 26–29): those are the
subterranean / deep-swamp scenes — a near-black wash with a lit lantern + HUD +
the creature. They still carry real structure (pixel std-dev ≈ 22–23), which is
what distinguishes them from a blank fill (std ≈ 0). If a frame's std ever
drops to ~0, the scene failed to render — treat that as a harness regression.
