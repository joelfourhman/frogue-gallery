// world.js — the swamp: terrain, paint layer, vegetation, soil, reeds.
'use strict';
import { traceBlob, wobble, clamp, dist2, TAU, mulberry32 } from './math.js';
import { INK, sat, mixColor, centerText, uiFont } from './ui.js';
import { PondLife } from './wildlife.js';
import { REEDS_WIDTH, REEDS_DARK_WIDTH, REEDS_POCKETS, REEDS_FLOOD_FLOOR, REEDS_FLOOD_FACTOR, REEDS_DARK_POCKETS, REEDS_DARK_FLOOD_FLOOR, REEDS_DARK_FLOOD_FACTOR, REEDS_DARK_BESTIARY_DENSITY, CROSSING, crossingTransition, crossingSolids, MOTH_NOOK, strokeTouches } from './logic.js';

const WSCALE = 0.5; // paint layer resolution factor

// L1 (v1.4 "Make It Amazing"): the living-world pass. All of this is PURE
// draw-time modulation (functions of `now` + existing world data / constants)
// drawn inside drawProps's existing view culling — no new per-world state, so
// P10 (off-screen culling) and the pacing probes (runT) are untouched.

// Per-reed sway offset (world px). A low-frequency sine phased by the reed's
// own `seed`, small amplitude (painted-world, not bouncy). Deterministic.
export function reedSway(seed, now) {
  return Math.sin(now * 1.3 + (seed % 97) * 0.618) * 5;   // ±5 px
}

// Shimmer glint alpha (0..1) for the i-th open-water glint. A staggered slow
// pulse so a handful of glints twinkle out of sync. Deterministic, bounded.
export function shimmerGlint(i, now) {
  const s = (0.5 + 0.5 * Math.sin(now * 0.9 + i * 1.9));  // 0..1, staggered
  return s * s;                                            // ease (dimmer mid)
}

// Drifting mist bands: 2-3 very-low-alpha procedural ellipses. A module
// constant (not per-world data). `parallax` < 1 → the band lags the camera,
// reading as farther away; `speed` = slow world-px/s drift.
export const MIST_BANDS = [
  { y: 380, h: 210, r: 520, alpha: 0.05, speed: 7,  parallax: 0.78, seed: 11 },
  { y: 760, h: 250, r: 640, alpha: 0.045, speed: 5, parallax: 0.72, seed: 57 },
  { y: 1120, h: 200, r: 460, alpha: 0.05, speed: 9, parallax: 0.82, seed: 83 },
];

// Cap on open-water shimmer glints (bounded so the draw cost never grows).
export const SHIMMER_CAP = 12;

// L1 (v1.9 "The Living Swamp"): the ENVIRONMENTAL LIFE layer — a parallax
// layer-0 of LIVING elements (breathing mist, ambient fireflies, drifting
// pollen, surface ripples). PRESENTATION-ONLY: every element below is a pure
// function of (a) the world SEED (positions — built once in build() from a
// dedicated seeded stream, so a fixed seed always gives the same layout) and
// (b) the wall-clock `now` (motion — drawn in drawAmbient). No new per-frame
// state, no global Math.random in the hot path, NO tuning / runT / logic.js
// change (logic.js stays byte-identical), so all 9 pacing probes are
// unchanged. The pools are small + view-culled so the on-screen element total
// stays capped into the existing P10 particle budget (the drawAmbient +
// paint-juice combined on-screen total is asserted ≤ 220 in smoke).

// L1: the BREATHING mist — a slow alpha/offset oscillation on the existing
// parallax mist bands (the v1.4 MIST_BANDS). Returns the breathing factor
// (≈0..1, centered ~0.5) for the `seed`-th band, so the band's alpha swells
// and the whole band drifts a few px — the mist "breathes." Period ~9 s (a
// deep, slow inhale/exhale), phased per band so the bands breathe out of
// sync. Pure + deterministic.
export function mistBreath(seed, now) {
  return 0.5 + 0.5 * Math.sin(now * 0.7 + (seed % 61) * 0.53);   // 0..1
}

// L1: the AMBIENT firefly twinkle — a slow, low-frequency brightness pulse for
// the i-th ambient firefly. Staggered (each firefly in/out of phase) so the
// swarm flickers rather than blinks in unison. Returns 0..1. Pure +
// deterministic.
export function fireflyTwinkle(i, now) {
  const s = 0.5 + 0.5 * Math.sin(now * 0.85 + i * 1.33);   // 0..1, staggered
  return s * s;                                            // ease (dim mid)
}

// L1: the SURFACE-ripple phase — a repeating 0..1 expansion cycle for the i-th
// water ripple. A staggered sawtooth so a few ripples pulse out of sync. Pure
// + deterministic.
export function ripplePhase(i, now) {
  const t = (now * 0.22 + i * 0.31) % 1;                   // 0..1, looping
  return t;
}

// L1: pool size caps (presentation elements, view-culled in drawAmbient). Kept
// SMALL so the on-screen element total stays capped into the existing P10
// particle budget: pollen 14 + ambient fireflies 18 (Reeds only) + ripples 13.
export const AMBIENT_POLLEN_CAP = 14;
export const AMBIENT_FIREFLY_CAP = 18;
export const AMBIENT_RIPPLE_CAP = 13;

// L2 (v1.9): the BASE-SWAMP LIGHT POOL cap — the parked "lantern in the swamp"
// done as PURE LIGHT. Kept small (a handful of pools across the 5400px world)
// and view-culled, so it adds at most a few on-screen draws to the P10 budget.
// Base-swamp ONLY (a Reeds variant has its own light economy; its pool is empty).
export const SWAMP_LIGHT_POOL_CAP = 6;

// L1: count the ambient (living-world) elements that fall inside the visible
// view rect (world px). This is the P10 "on-screen particle" measure for the
// new layer — the SAME cull the draw pass uses, so the smoke assertion and the
// render agree. The counts (not the positions) are returned so the caller can
// assert the cap without re-deriving the layout.
export function ambientCounts(w, view) {
  const l = view.x, r = view.x + view.w / view.scale;
  const t = view.y, b = view.y + view.h / view.scale;
  const inside = (x, y, m) => x + m > l && x - m < r && y + m > t && y - m < b;
  let pollen = 0;
  for (const p of w.ambientPollen) if (inside(p.x, p.y, 16)) pollen++;
  let fireflies = 0;
  for (const f of w.ambientFireflies) if (inside(f.x, f.y, 16)) fireflies++;
  let ripples = 0;
  for (const rp of w.ambientRipples) if (inside(rp.x, rp.y, rp.rMax)) ripples++;
  return { pollen, fireflies, ripples, total: pollen + fireflies + ripples };
}

// L2 (v1.9): count the BASE-SWAMP LIGHT POOLS that fall inside the visible view
// rect (world px) — the SAME cull drawSwampLightPools uses, so the smoke P10
// assertion and the render agree. The count (not the positions) is returned so
// the caller can assert the cap + the base-swamp-only / P10 view-cull without
// re-deriving the layout. Presentation-only (reads w.swampLightPools, a
// draw-only pool). Returns the on-screen pool count.
export function swampLightCounts(w, view) {
  const l = view.x, r = view.x + view.w / view.scale;
  const t = view.y, b = view.y + view.h / view.scale;
  const inside = (x, y, m) => x + m > l && x - m < r && y + m > t && y - m < b;
  let pools = 0;
  for (const p of w.swampLightPools) if (inside(p.x, p.y, p.r)) pools++;
  return { pools, total: pools };
}

// L2 (v1.4 "Make It Amazing"): the layered watercolor render pass. Pure
// draw-time + a bake-once cache — no new per-frame state, so P10 (off-screen
// culling) and the pacing probes (runT) are untouched.
//   (a) wet rim  — freshly painted pigment cells grow a darker "wet edge"
//                  (the watercolor bloom) that lightens and dries over ~5s,
//                  derived from the EXISTING pigment-cell `age`/amount (no new
//                  persistence).
//   (b) stroke texture — short directional brush strokes baked ONCE into a
//                  per-zone offscreen canvas at world.build() (seeded via
//                  math.js mulberry32/wobble), drawn as ONE cached image per
//                  zone per frame (the budget trick: one drawImage, not
//                  thousands of strokes).
//   (c) prop outlines — rocks & bushes get a second low-alpha offset "watercolor
//                  double-stroke" (a soft ink echo) on top of the existing edge.
// The zone accents mirror game.js ZONES (kept here so world.js has no
// dependency on game.js — no circular import).
export const ZONE_TEXTURES = [
  { x: 0,   accent: '#c9a94e' },  // Reed Flats
  { x: 0.24, accent: '#5a93c9' },  // Slick Hollow
  { x: 0.44, accent: '#7fb069' },  // Bramble Thicket
  { x: 0.64, accent: '#9a9a8f' },  // The Gray Shore
];
// Reduced-res offscreen scale for the stroke texture (keeps the cached layers
// light; they are drawn scaled up over the floor, so the soft wash is
// resolution-independent).
const TEXTURE_SCALE = 0.25;

// Wet-rim alpha (0..~0.4): a fresh cell (amount ~3) carries the strongest rim,
// which lightens as the pigment decays (amount -> 0 over ~5s). Pure +
// deterministic (the smoke stage asserts the decay).
export function wetRimAlpha(amount) {
  const m = clamp(amount || 0, 0, 3);
  return (m / 3) * 0.4;
}
// Wet-rim stroke radius (world px) — a touch larger than the cell so it reads as
// a soft edge halo, not a hard line.
export function wetRimRadius(cell) {
  return cell * 0.66;
}
// Cap on the wet rims drawn per frame (the grid can hold many fresh cells after
// a long painting run; bounding the draw keeps the per-frame cost flat).
export const WET_RIM_CAP = 96;

export class World {
  constructor(rng, seed, opts = {}) {
    // R2 (v1.6): the Reeds VARIANT is a DEEPER ~6000px layout (REEDS_WIDTH) —
    // "the same painting, deeper." A base (non-Reeds) world stays the 5400px
    // first-time swamp (byte-identical; a victory-gated biome never changes the
    // first-time run's world or pacing).
    // G1 (v1.8): the BLACK REEDS variant is DEEPER STILL (REEDS_DARK_WIDTH
    // 7200) — a darker, longer descent. A cycle-0 Reeds world (no blackReeds)
    // keeps REEDS_WIDTH (6000), so a cycle-0 Reeds run's world is byte-identical.
    this.w = (opts && opts.reeds) ? ((opts && opts.blackReeds) ? REEDS_DARK_WIDTH : REEDS_WIDTH) : 5400;
    this.h = 1500;   // P5: widened for 15–20 min run pacing (was 2400)
    this.seed = seed;
    this.rng = rng;
    // R1 (v1.6): the Reeds VARIANT flag (opts.reeds). Set BEFORE build() so the
    // build pass can populate the light economy. A base world (opts.reeds
    // falsy) stays exactly as before.
    this.reedsVariant = !!opts.reeds;
    // G1 (v1.8): the BLACK REEDS variant flag (opts.blackReeds). Set on top of
    // the Reeds flag (a Black Reeds run is ALWAYS a Reeds run — the world is
    // Reeds-shape) — it selects the DARKER layout data: the extra gravity
    // pocket, the deeper+faster flood band, and the denser light-economy. A
    // cycle-0 Reeds world (opts.blackReeds falsy) keeps EXACTLY the v1.6 data
    // (reedsPockets = REEDS_POCKETS, reedsWater floor = REEDS_FLOOD_FLOOR,
    // 46 fireflies / 8 rest spots), so a cycle-0 Reeds run is byte-identical.
    this.blackReeds = !!(opts && opts.blackReeds);
    this.grass = [];
    this.ripples = [];
    this.obstacles = [];      // rocks/bushes: {x,y,r,seed,kind}
    this.pads = [];           // lily pads: {x,y,r} — safe, regen
    // R1 (v1.6): the Reeds biome's light economy — the frog's PAPER LANTERN
    // refills its candle fuel here. `fireflies` drift slowly and top up the
    // wick while the frog rests near one (a living, moving refill source);
    // `restSpots` are static lantern-rest stones (a fixed, reliable refill).
    // Only the Reeds variant (opts.reeds) populates them; a normal swamp
    // world carries empty arrays, so a first-time run is byte-identical.
    this.fireflies = [];       // {x,y,r,seed,ph} — drifting light, refills the lantern
    this.restSpots = [];       // {x,y,r,seed} — lantern-rest stones
    // L1 (v1.9): the ENVIRONMENTAL LIFE pools (presentation-only living
    // elements). Built in build() from a dedicated seeded stream (seed + 731)
    // so a fixed seed always yields the same layout — deterministic + capped.
    // `ambientPollen` (swamp drifting leaves/pollen), `ambientFireflies`
    // (Reeds/Black-Reeds only — a SEPARATE small pool from the lantern-light
    // economy `fireflies` above), `ambientRipples` (surface ripples on the
    // open-water bands). Empty arrays on a base world where a pool doesn't
    // apply, so a first-time run's on-screen element count is unchanged.
    this.ambientPollen = [];      // {x,y,drift,seed,sz,ph} — swamp drifting leaves/pollen
    this.ambientFireflies = [];   // {x,y,seed,ph,sz} — Reeds/Black-Reeds ambient fireflies
    this.ambientRipples = [];     // {x,y,rMax,seed,ph} — surface ripples on the water bands
    // L2 (v1.9): the BASE-SWAMP LIGHT POOLS — the parked "lantern in the swamp"
    // item done as PURE LIGHT (no fuel, no mechanics; the balance version stays
    // deferred). A handful of soft warm light pools baked into the swamp ground
    // so the first-time (cycle-0) world has a faint sense of light even though
    // it has no lantern economy. PRESENTATION-ONLY: read only by
    // drawSwampLightPools + swampLightCounts (draw + the smoke P10 cull) — never
    // by the tuning / runT / logic.js path. Built from a dedicated seeded stream
    // (seed + 1571) so a fixed seed gives the same layout. Base-swamp only
    // (empty on a Reeds variant, which has its own light economy).
    this.swampLightPools = [];    // {x,y,r,seed,ph} — base-swamp soft warm light pools
    this._swampGlowSprite = null; // baked-once soft radial glow sprite (L2)
    // R1 (v1.6): `this.reedsVariant` (set from opts.reeds above) marks the
    // Reeds VARIANT world. `this.reeds` (below) is the GROWN-REEDS array
    // (vegetation) — a different thing — hence the distinct flag.
    this.veg = [];            // vegetation: {x,y,h,seed,burn,alive}
    this.soil = [];           // soil patches: {x,y,r}
    this.reeds = [];          // grown reeds: {x,y,h,burn}
    this.slick = [];          // fresh blue slick: {x,y,r,t}
    this.build();
    // Dedicated cosmetic RNG: no terrain or spawn rolls consumed.
    this.pondLife = new PondLife(seed, this.w, this.h, this.reedsVariant, this.blackReeds);

    // paint layer
    const pw = Math.ceil(this.w * WSCALE), ph = Math.ceil(this.h * WSCALE);
    this.paintCanvas = document.createElement('canvas');
    this.paintCanvas.width = pw; this.paintCanvas.height = ph;
    this.pctx = this.paintCanvas.getContext('2d');
    this.pigmentGrid = new Map(); // key -> {red,blue,green,age}
    this.cell = 60;
  }

  // A small authored dead-end nook, enabled only by Game's mode gate. Clear
  // its landing circle and narrow return path AFTER generation: other worlds
  // and the shared seeded terrain stream remain untouched.
  enableMothEncounter() {
    this.mothFlower = { x: MOTH_NOOK.x, y: MOTH_NOOK.y, green: false, started: false };
    const outside = o => {
      const r = o.r || 12;
      const inNook = Math.hypot(o.x - MOTH_NOOK.x, o.y - MOTH_NOOK.y) < MOTH_NOOK.homeRadius + r + 25;
      const inPath = Math.abs(o.x - MOTH_NOOK.x) < 65 + r && o.y > MOTH_NOOK.y && o.y < 770;
      return !inNook && !inPath;
    };
    this.obstacles = this.obstacles.filter(outside);
    // Green must bloom the authored flower, not grow a collision reed across
    // the settlement/return path on an unlucky procedural soil patch.
    this.soil = this.soil.filter(outside);
    this.reeds = this.reeds.filter(outside);
  }

  paintMothFlower(stroke) {
    const f = this.mothFlower;
    if (!f || f.green || !stroke || stroke.pigment !== 'green' || !['swipe', 'splash'].includes(stroke.kind)
        || ![stroke.x, stroke.y, stroke.a, stroke.range].every(Number.isFinite) || stroke.range < 0
        || !strokeTouches(stroke, f.x, f.y, 25)) return false;
    f.green = true;
    return true;
  }

  build() {
    const rng = this.rng;
    const k = this.w / 2400; // P5: decoration density follows world width
    // R1/R2 (v1.6): the Reeds VARIANT — a darker-palette, flooded, DEEPER-swamp
    // world (the SAME painting, deeper — not a genre shift). It is built a touch
    // longer (REEDS_WIDTH, 6000px, vs the base 5400px) so the traversal has a
    // distinct, longer layer. The zone/obstacle/pad/veg terrain is generated by
    // the SAME seeded pass as the base world (deterministic per seed — the
    // "same painting"), and what the Reeds adds is (a) the light economy
    // (fireflies + lantern-rest stones) and (b) the R2 traversal features
    // (flooded lower banks + inverted-gravity pockets). CRITICAL: the light
    // economy + water features use a SEPARATE deterministic RNG stream (seeded
    // from this.seed, NOT the shared `rng`) so they never perturb the terrain
    // stream — a base (non-Reeds) world leaves these arrays empty and a
    // first-time run stays byte-identical.
    if (this.reedsVariant) {
      // G1 (v1.8): the BLACK REEDS variant is DENSER. It uses its OWN
      // deterministic RNG stream (seed + 2977, distinct from the cycle-0
      // Reeds' +977) so the two layouts are INDEPENDENT per seed but each is
      // reproducible. CRITICAL: a cycle-0 Reeds world (this.blackReeds falsy)
      // keeps the EXACT v1.6 stream (+977), 46 fireflies, 8 rest stones, and
      // the REEDS_POCKETS / REEDS_FLOOD_FLOOR constants — so a cycle-0 Reeds
      // run stays byte-identical (the new variant activates only at NG+).
      const dark = this.blackReeds;
      const lrng = mulberry32((this.seed + (dark ? 2977 : 977)) | 0);
      const flyCount = dark ? 56 : 46;
      for (let i = 0; i < flyCount; i++) {
        this.fireflies.push({ x: 150 + lrng() * (this.w - 300), y: 120 + lrng() * (this.h - 240), r: 9 + lrng() * 10, seed: (i * 37) % 991, ph: lrng() * TAU });
      }
      // lantern-rest stones: ~8 (cycle-0 Reeds) / ~10 (Black Reeds — the
      // descent is longer and darker, so the fuel loop carries one more rest
      // beat). A rest roughly every 600–650 px keeps it winnable.
      const restXs = dark
        ? [650, 1300, 1950, 2600, 3250, 3900, 4550, 5150, 5550, 5750]
        : [700, 1400, 2100, 2850, 3600, 4350, 5050, 5650];
      restXs.forEach((x, i) => this.restSpots.push({ x: x + wobble(this.seed + (dark ? 2977 : 977), i * 3, 60), y: (i % 2 ? 1150 : 430) + wobble(this.seed + (dark ? 2977 : 977), i * 7 + 2, 90), r: 34, seed: (i * 53) % 997 }));
      // R2 (v1.6) / G1 (v1.8): the flooded lower banks + the inverted-gravity
      // pocket root-ceilings are DETERMINISTIC layout data — stored here for
      // the render + the player's speed/hop sign-flip. No RNG, no per-frame
      // state (P10-safe). G1: the Black Reeds variant uses the DARK layout
      // (REEDS_DARK_POCKETS = 4 pockets, a deeper + faster flood band); the
      // cycle-0 Reeds keeps REEDS_POCKETS (3) + REEDS_FLOOD_FLOOR exactly.
      this.reedsWater = { floor: dark ? REEDS_DARK_FLOOD_FLOOR : REEDS_FLOOD_FLOOR, factor: dark ? REEDS_DARK_FLOOD_FACTOR : REEDS_FLOOD_FACTOR, w: this.w, h: this.h };
      this.reedsPockets = dark ? REEDS_DARK_POCKETS : REEDS_POCKETS;
      // G1 (v1.8): the Black Reeds bestiary is DENSER — a higher Wisp/Serpent/
      // Leech pick ratio (the world is darker → the light-bestiary matters
      // more). `this.reedsBestiary` is read by _spawnWave; a cycle-0 Reeds run
      // gets the DEFAULT v1.6 thresholds (REEDS_BESTIARY_DENSITY) and a base
      // run never enters the branch at all (byte-identical).
      this.reedsBestiary = dark ? REEDS_DARK_BESTIARY_DENSITY : null;
    }
    // L1 (v1.9): the ENVIRONMENTAL LIFE pools — a dedicated DETERMINISTIC RNG
    // stream (seed + 731, distinct from the terrain `rng` AND the light-economy
    // +977/+2977 streams) so the living-world layout is reproducible per seed
    // without perturbing any existing stream. PRESENTATION-ONLY: these arrays
    // are read only by drawAmbient / ambientCounts (draw + the smoke cull) —
    // never by the tuning / runT / logic.js path, so a fixed seed gives the
    // same layout and the pacing probes are unchanged. Capped small:
    //   pollen  (swamp)        AMBIENT_POLLEN_CAP   — drifting leaves/pollen
    //   fireflies (Reeds only) AMBIENT_FIREFLY_CAP  — the ambient swarm
    //   ripples (water bands)  AMBIENT_RIPPLE_CAP   — surface ripples
    const arng = mulberry32((this.seed + 731) | 0);
    // (a) drifting leaves / pollen — swamp world (a base world is the swamp;
    //     the Reeds descent has no pollen, only its own firefly swarm).
    if (!this.reedsVariant) {
      for (let i = 0; i < AMBIENT_POLLEN_CAP; i++) {
        this.ambientPollen.push({ x: 60 + arng() * (this.w - 120), y: 80 + arng() * (this.h - 160), drift: 6 + arng() * 10, seed: (i * 29) % 971, sz: 1.6 + arng() * 2.0, ph: arng() * TAU });
      }
    }
    // (b) ambient fireflies — Reeds + Black Reeds ONLY (a SEPARATE small pool
    //     from the lantern-light-economy `fireflies`). The base swamp has no
    //     ambient fireflies.
    if (this.reedsVariant) {
      for (let i = 0; i < AMBIENT_FIREFLY_CAP; i++) {
        this.ambientFireflies.push({ x: 120 + arng() * (this.w - 240), y: 140 + arng() * (this.h - 280), seed: (i * 41) % 991, ph: arng() * TAU, sz: 1.4 + arng() * 1.8 });
      }
    }
    // (c) surface ripples — on the water bands (every world carries a few; the
    //     open-water / flooded bands are where they read as surface ripples).
    //     y is biased toward the lower open-water half of the swamp.
    for (let i = 0; i < AMBIENT_RIPPLE_CAP; i++) {
      const y = 0.55 * this.h + arng() * (0.45 * this.h);
      this.ambientRipples.push({ x: 100 + arng() * (this.w - 200), y, rMax: 10 + arng() * 16, seed: (i * 37) % 891, ph: arng() * TAU });
    }
    // L2 (v1.9): the BASE-SWAMP LIGHT POOLS — the parked "lantern in the swamp"
    // done as PURE LIGHT (no fuel, no mechanics). A dedicated DETERMINISTIC RNG
    // stream (seed + 1571, distinct from the terrain `rng` AND the L1 +731 AND
    // the light-economy +977/+2977 streams) so the layout is reproducible per
    // seed without perturbing any existing stream. PRESENTATION-ONLY: read only
    // by drawSwampLightPools + swampLightCounts (draw + the smoke P10 cull) —
    // never by the tuning / runT / logic.js path. Base-swamp ONLY: a Reeds
    // variant has its own light economy, so its pool stays empty (a first-time
    // base-swamp run gains the pools; a Reeds run is unchanged).
    if (!this.reedsVariant) {
      const lprng = mulberry32((this.seed + 1571) | 0);
      for (let i = 0; i < SWAMP_LIGHT_POOL_CAP; i++) {
        // biased toward the central corridor (the path the frog walks) so the
        // light pools read as "the path glows faintly" as you travel.
        const x = 200 + lprng() * (this.w - 400);
        const y = 560 + lprng() * (0.6 * this.h);
        this.swampLightPools.push({ x, y, r: 70 + lprng() * 70, seed: (i * 53) % 991, ph: lprng() * TAU });
      }
    }
    // grass tufts
    for (let i = 0; i < Math.round(260 * k); i++) {
      this.grass.push({ x: rng() * this.w, y: rng() * this.h, s: 2 + rng() * 4, seed: (i * 31) % 97 });
    }
    // ripples
    for (let i = 0; i < Math.round(40 * k); i++) {
      this.ripples.push({ x: rng() * this.w, y: rng() * this.h, r: 8 + rng() * 26, seed: (i * 17) % 89 });
    }
    // obstacles — clustered away from the central corridor
    const corridor = (x, y) => (y > 480 && y < 980 && x > 200 && x < this.w - 200);
    let tries = 0;
    while (this.obstacles.length < Math.round(26 * k) && tries++ < 600) {
      const x = 80 + rng() * (this.w - 160);
      const y = 80 + rng() * (this.h - 160);
      if (corridor(x, y) && rng() < 0.75) continue;
      if (this.obstacles.some(o => dist2(o.x, o.y, x, y) < 140 * 140)) continue;
      this.obstacles.push({ x, y, r: 22 + rng() * 26, seed: (this.obstacles.length * 53) % 997, kind: rng() < 0.5 ? 0 : 1 });
    }
    // Q4 (Astra): the painted crossing — a FIXED (seed-independent) bramble
    // wall at the mouth of the Rain Choir detour (logic.js CROSSING). The pure
    // state machine owns the semantics; only 'unpainted' carries solids, and
    // the collision data is rebuilt ONLY when the state actually changes
    // (paintCrossing). Present in every variant — the deeper paintings keep
    // the same mouth.
    this.crossingState = 'unpainted';
    this.crossingSolids = crossingSolids(this.crossingState);
    // lily pads along the corridor + pockets
    const padSpots = [
      [300, 720], [1000, 760], [1700, 700], [2400, 760], [3100, 700], [3800, 760],
      [4500, 700], [5100, 760],
      [600, 480], [1800, 1100], [3000, 480], [4200, 1100], [5000, 480], [1200, 1120],
    ];
    padSpots.forEach(([x, y], i) => this.pads.push({ x: x + wobble(this.seed, i, 30), y: y + wobble(this.seed, i + 50, 30), r: 46 + rng() * 14 }));
    // vegetation clusters (burnable, paintable)
    for (let i = 0; i < Math.round(24 * k); i++) {
      const x = 100 + rng() * (this.w - 200);
      const y = 100 + rng() * (this.h - 200);
      if (this.obstacles.some(o => dist2(o.x, o.y, x, y) < (o.r + 30) * (o.r + 30))) continue;
      this.veg.push({ x, y, h: 40 + rng() * 30, seed: (i * 71) % 991, burn: 0, alive: true });
    }
    // soil patches (green-grow spots)
    for (let i = 0; i < Math.round(12 * k); i++) {
      const x = 120 + rng() * (this.w - 240);
      const y = 120 + rng() * (this.h - 240);
      this.soil.push({ x, y, r: 34 + rng() * 22 });
    }
    this._bakeTextures();
  }

  // L2 (b): bake the stroke-texture offscreen layers — ONCE, at build, so the
  // per-frame cost is a single drawImage per zone (not thousands of strokes).
  // Seeded independently from `this.seed` (mulberry32) so the same world seed
  // always produces the same texture, and it rides the existing seed system
  // without disturbing the main decoration RNG stream.
  _bakeTextures() {
    const trng = mulberry32((this.seed * 2654435761) >>> 0);
    const tw = Math.ceil(this.w * TEXTURE_SCALE);
    const th = Math.ceil(this.h * TEXTURE_SCALE);
    this._texCanvases = [];
    for (const z of ZONE_TEXTURES) {
      const z0 = z.x * this.w;
      // each zone's band spans from its start to the next zone's start; the last
      // (x:1) runs to the end of the world (the Gray Shore fills the rest).
      const zi = ZONE_TEXTURES.indexOf(z);
      const z1 = (zi < ZONE_TEXTURES.length - 1)
        ? ZONE_TEXTURES[zi + 1].x * this.w
        : this.w;
      const cv = document.createElement('canvas');
      cv.width = Math.max(2, Math.round(tw));
      cv.height = Math.max(2, Math.round(th));
      const g = cv.getContext('2d');
      const acc = z.accent;
      const base = sat(acc, 1);
      // Base wash: a handful of very-low-alpha accent blobs across the zone band.
      g.globalAlpha = 0.05;
      g.fillStyle = base;
      const washes = 6 + Math.round(trng() * 4);
      for (let i = 0; i < washes; i++) {
        const bx = (z0 + trng() * (z1 - z0)) * TEXTURE_SCALE;
        const by = trng() * th;
        const br = (90 + trng() * 130) * TEXTURE_SCALE;
        g.beginPath();
        g.ellipse(bx, by, br, br * 0.7, trng() * TAU, 0, TAU);
        g.fill();
      }
      // Stroke texture: short directional brush strokes (dark edge + light
      // highlight), oriented along a zone-consistent angle so each zone's
      // "hand" reads differently. Capped count so the bake is bounded.
      const angle = z.x * TAU; // per-zone base angle
      const N = 70 + Math.round(trng() * 30);
      g.lineCap = 'round';
      for (let i = 0; i < N; i++) {
        const sx = (z0 + trng() * (z1 - z0)) * TEXTURE_SCALE;
        const sy = trng() * th;
        const len = (10 + trng() * 26) * TEXTURE_SCALE;
        const a = angle + (trng() - 0.5) * 0.9;
        const dx = Math.cos(a) * len, dy = Math.sin(a) * len * 0.5;
        g.globalAlpha = 0.05 + trng() * 0.06;
        g.strokeStyle = INK;
        g.lineWidth = 1.2 * TEXTURE_SCALE + 0.4;
        g.beginPath();
        g.moveTo(sx - dx * 0.5, sy - dy * 0.5);
        g.lineTo(sx + dx * 0.5, sy + dy * 0.5);
        g.stroke();
        // light highlight echo offset a hair
        g.globalAlpha = 0.04 + trng() * 0.04;
        g.strokeStyle = mixColor(acc, '#ffffff', 0.5);
        g.lineWidth = 0.9 * TEXTURE_SCALE + 0.3;
        g.beginPath();
        g.moveTo(sx - dx * 0.5 + 0.8, sy - dy * 0.5 - 0.8);
        g.lineTo(sx + dx * 0.5 + 0.8, sy + dy * 0.5 - 0.8);
        g.stroke();
      }
      g.globalAlpha = 1;
      this._texCanvases.push(cv);
    }
  }

  cellAt(x, y) {
    const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
    const key = cx + ',' + cy;
    let c = this.pigmentGrid.get(key);
    if (!c) { c = { red: 0, blue: 0, green: 0, age: 0 }; this.pigmentGrid.set(key, c); }
    return c;
  }

  // Player paints a swipe: arc of splat points from origin toward aim.
  paintSwipe(x0, y0, aimA, range, pigment) {
    for (let d = 14; d <= range; d += 16) {
      const x = x0 + Math.cos(aimA) * d + (Math.random() - 0.5) * 14;
      const y = y0 + Math.sin(aimA) * d + (Math.random() - 0.5) * 14;
      this.splat(x, y, pigment, 5 + Math.random() * 5, true);
    }
  }

  paintSplash(x, y, radius, pigment) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * TAU, d = Math.random() * radius;
      this.splat(x + Math.cos(a) * d, y + Math.sin(a) * d, pigment, 5 + Math.random() * 6, false);
    }
    this.splat(x, y, pigment, 14, true);
  }

  splat(x, y, pigment, r, strong) {
    if (x < 0 || y < 0 || x > this.w || y > this.h) return;
    this.pondLife.paint(x, y, pigment);
    const cell = this.cellAt(x, y);
    cell.age = 3.2;
    if (pigment !== 'dry') cell[pigment] = Math.min(3, cell[pigment] + (strong ? 1 : 0.6));
    // draw into paint layer
    const c = this.pctx;
    const col = pigment === 'red' ? 'rgba(200,69,44,0.28)' : pigment === 'blue' ? 'rgba(58,111,216,0.26)' : pigment === 'green' ? 'rgba(90,158,61,0.24)' : 'rgba(154,143,128,0.12)';
    c.globalAlpha = strong ? 1 : 0.6;
    c.fillStyle = col;
    c.beginPath();
    c.ellipse(x * WSCALE, y * WSCALE, r * WSCALE, r * 0.8 * WSCALE, Math.random() * TAU, 0, TAU);
    c.fill();
    // drips
    c.globalAlpha = 0.5;
    const drips = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < drips; i++) {
      const a = Math.random() * TAU, dl = r * (1.2 + Math.random());
      c.beginPath();
      c.ellipse((x + Math.cos(a) * dl) * WSCALE, (y + Math.sin(a) * dl) * WSCALE,
        (r * 0.18) * WSCALE, (r * 0.35) * WSCALE, a, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;

    // interactions -------------------------------------------------
    if (pigment === 'red') {
      // ignite vegetation
      for (const v of this.veg) {
        if (v.alive && v.burn <= 0 && dist2(v.x, v.y, x, y) < 42 * 42) {
          v.burn = 6;
          return 'ignite';
        }
      }
      // burn reeds
      for (const r of this.reeds) {
        if (!r.burn && dist2(r.x, r.y, x, y) < 40 * 40) { r.burn = 1.2; return 'ignite'; }
      }
    }
    if (pigment === 'blue') {
      this.slick.push({ x, y, r: 30 + r * 2, t: 5 });
    }
    if (pigment === 'green') {
      for (const s of this.soil) {
        if (dist2(s.x, s.y, x, y) < s.r * s.r && !this.reeds.some(rd => dist2(rd.x, rd.y, s.x, s.y) < 50 * 50)) {
          this.reeds.push({ x: s.x + wobble(this.seed, s.x | 0, 10), y: s.y + wobble(this.seed, s.y | 0, 10), h: 0, burn: 0, seed: (s.x * 7 + s.y) % 997 });
          return 'sprout';
        }
      }
      // restore burned vegetation
      for (const v of this.veg) {
        if (v.alive && v.burn > 0 && dist2(v.x, v.y, x, y) < 42 * 42) { v.burn = 0; }
      }
    }
    return null;
  }

  pigmentAt(x, y) { return this.cellAt(x, y); }

  update(dt) {
    this.pondLife.update(dt);
    // age & decay pigment grid
    for (const [key, c] of this.pigmentGrid) {
      if (c.age > 0) {
        c.age -= dt;
        const decay = dt / 3.2;
        c.red = Math.max(0, c.red - decay);
        c.blue = Math.max(0, c.blue - decay);
        c.green = Math.max(0, c.green - decay);
        if (c.age <= 0) this.pigmentGrid.delete(key);
      }
    }
    // slicks
    for (let i = this.slick.length - 1; i >= 0; i--) {
      this.slick[i].t -= dt;
      if (this.slick[i].t <= 0) this.slick.splice(i, 1);
    }
    // vegetation burn + spread
    for (const v of this.veg) {
      if (v.burn > 0) {
        v.burn -= dt;
        if (Math.random() < dt * 0.4) {
          // spread to a neighbor sometimes
          for (const o of this.veg) {
            if (o !== v && o.alive && o.burn <= 0 && dist2(o.x, o.y, v.x, v.y) < 110 * 110 && Math.random() < 0.5) {
              o.burn = 5;
              break;
            }
          }
        }
        if (v.burn <= 0) v.alive = false;
      }
    }
    // reeds grow / burn
    for (let i = this.reeds.length - 1; i >= 0; i--) {
      const r = this.reeds[i];
      if (r.burn > 0) {
        r.burn -= dt;
        if (r.burn <= 0) this.reeds.splice(i, 1);
      } else if (r.h < 1) {
        r.h = Math.min(1, r.h + dt * 1.6);
      }
    }
    // occasionally fade the paint layer (keeps it translucent, avoids buildup)
    this._fadeT = (this._fadeT || 0) + dt;
    if (this._fadeT > 0.4) {
      this._fadeT = 0;
      this.pctx.globalCompositeOperation = 'destination-out';
      this.pctx.fillStyle = 'rgba(0,0,0,0.06)';
      this.pctx.fillRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
      this.pctx.globalCompositeOperation = 'source-over';
    }
  }

  // R1 (v1.6): draw the Reeds biome's LIGHT ECONOMY — the drifting fireflies
  // and the static lantern-rest stones. Called ONLY for the Reeds variant (from
  // _drawAll's world-space pass) in world space (the camera transform is already
  // applied by the caller). Both are cheap and VIEW-CULLED so they never add to
  // the P10 draw budget on a full-world view. Fireflies drift on a slow bounded
  // sine (a function of now + their seed — no per-frame world state, so pacing
  // probes are untouched) and pulse; rest stones carry a soft amber aura marking
  // where the paper lantern refills its candle fuel.
  drawReedsLights(ctx, view, now) {
    if (!this.reedsVariant) return;
    const vx = view.x - 60, vy = view.y - 60, vw = view.w + 120, vh = view.h + 120;
    // lantern-rest stones: a mossy rock with a soft warm aura + a tiny flame.
    for (const s of this.restSpots) {
      if (s.x < vx || s.x > vx + vw || s.y < vy || s.y > vy + vh) continue;
      const a = 0.5 + 0.2 * Math.sin(now * 1.2 + s.seed);
      ctx.save();
      ctx.globalAlpha = 0.35 * a;
      ctx.fillStyle = '#e8b24a';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 1.7, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#5a5142';
      traceBlob(ctx, s.x, s.y, s.r, s.seed, 0.14);
      ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(244,234,216,0.5)';
      ctx.beginPath(); ctx.arc(s.x, s.y - s.r * 0.35, 4.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffcf6b';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - s.r * 0.35 - 9);
      ctx.quadraticCurveTo(s.x + 4, s.y - s.r * 0.35 - 3, s.x, s.y - s.r * 0.35 + 2);
      ctx.quadraticCurveTo(s.x - 4, s.y - s.r * 0.35 - 3, s.x, s.y - s.r * 0.35 - 9);
      ctx.fill();
      ctx.restore();
    }
    // fireflies: drifting, pulsing points of light (a moving refill source).
    for (const f of this.fireflies) {
      const dx = f.x + Math.sin(now * 0.5 + f.ph) * 26;
      const dy = f.y + Math.cos(now * 0.4 + f.ph * 1.7) * 18;
      if (dx < vx || dx > vx + vw || dy < vy || dy > vy + vh) continue;
      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 1.8 + f.seed));
      ctx.save();
      ctx.globalAlpha = 0.5 * pulse;
      ctx.fillStyle = '#d6f36b';
      ctx.beginPath(); ctx.arc(dx, dy, f.r * 1.9, 0, TAU); ctx.fill();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#f2ffd0';
      ctx.beginPath(); ctx.arc(dx, dy, f.r * 0.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  // R2 (v1.6): the Reeds TRAVERSAL layer — the flooded lower banks + the
  // inverted-gravity pocket root-ceilings. Called ONLY for the Reeds variant
  // (from _drawAll's world-space pass, after drawProps / before the light
  // overlay) in world space (the camera transform is already applied). Both
  // layers are VIEW-CULLED so they never add to the P10 budget on a full-world
  // view. Pure draw-time (the flood floor + the pocket AABBs are fixed layout
  // data) — no new per-frame world state, so the pacing probes are untouched.
  drawReedsTraversal(ctx, view, now) {
    if (!this.reedsVariant) return;
    const vx = view.x - 40, vy = view.y - 40, vw = view.w + 80, vh = view.h + 80;
    const floor = this.reedsWater ? this.reedsWater.floor : REEDS_FLOOD_FLOOR;
    // (a) the FLOODED LOWER BANKS — a darker open-water wash over the lower
    // band (y >= floor). A flat fill (one rect, no per-pixel work) tinted with
    // the water accent so it reads as "open dark water" (slower ground
    // movement, open swim lanes). Cull if the band is off-screen.
    if (floor < vy + vh) {
      const top = Math.max(floor, vy);
      const hgt = Math.min(this.h, vy + vh) - top;
      if (hgt > 1) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#0e2233'; // open dark water
        ctx.fillRect(vx, top, vw, hgt);
        // a couple of slow, low-alpha drift bands across the water (a function
        // of now — no state), to sell the "flooded" depth cheaply.
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#2b4a5e';
        for (let i = 0; i < 3; i++) {
          const by = floor + ((i + 1) / 4) * (this.h - floor);
          const off = (now * (6 + i * 3)) % (vw + 300);
          ctx.beginPath(); ctx.ellipse(vx + (off - 150), by, 240, 14, 0, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
    }
    // (b) the INVERTED-GRAVITY POCKET root-ceilings — each pocket AABB gets a
    // hanging-root ceiling along its top edge (the frog rides it when it
    // clumps up into the inverted gravity). Cull pockets off-screen.
    const pockets = this.reedsPockets || REEDS_POCKETS;
    for (const pk of pockets) {
      if (pk.x + pk.w < vx || pk.x > vx + vw || pk.y + pk.h < vy || pk.y > vy + vh) continue;
      ctx.save();
      // a soft ceiling "dome" wash over the pocket (marks the inverted region).
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#3a2f1e';
      ctx.fillRect(pk.x, pk.y, pk.w, 46);
      // hanging roots along the top edge: short drooping strokes (deterministic
      // from the pocket bounds — no state).
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#5a4a2e';
      ctx.lineWidth = 3;
      const n = Math.max(4, Math.round(pk.w / 34));
      for (let i = 0; i < n; i++) {
        const rx = pk.x + (i + 0.5) * (pk.w / n);
        const len = 16 + 14 * (0.5 + 0.5 * Math.sin(i * 2.3 + pk.x * 0.01)); // varied droop
        const sway = Math.sin(now * 1.1 + i) * 3; // gentle sway (draw-only)
        ctx.beginPath();
        ctx.moveTo(rx, pk.y);
        ctx.quadraticCurveTo(rx + sway, pk.y + len * 0.6, rx + sway, pk.y + len);
        ctx.stroke();
      }
      // a subtle amber "upside-down" glow at the ceiling edge (the ceiling the
      // frog rides reads as a distinct surface).
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#c9a24a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pk.x, pk.y + 2); ctx.lineTo(pk.x + pk.w, pk.y + 2); ctx.stroke();
      ctx.restore();
    }
  }

  // L1 (v1.9 "The Living Swamp"): the ENVIRONMENTAL LIFE layer — the parallax
  // layer-0 of LIVING elements that make the swamp feel inhabited:
  //   (a) SURFACE RIPPLES — a few soft expanding rings on the open-water bands
  //       (every world; y biased to the lower open-water half).
  //   (b) DRIFTING POLLEN — small drifting leaves/pollen motes (swamp only).
  //   (c) AMBIENT FIREFLIES — a small twinkling swarm (Reeds / Black Reeds only
  //       — a SEPARATE pool from the lantern light-economy fireflies).
  // The BREATHING MIST is the v1.4 parallax bands, now modulated in drawProps.
  //
  // PRESENTATION-ONLY + POOLED + SEEDED:
  //   - positions come from the seeded pools built in build() (seed + 731);
  //   - motion is a pure function of `now` (no per-frame world state, no
  //     Math.random in the hot path — so the byte-identity / A/B invariance
  //     holds and the pacing probes are unchanged);
  //   - every element is VIEW-CULLED to the visible rect (the same cull
  //     ambientCounts uses), so the on-screen count stays capped into the
  //     existing P10 particle budget;
  //   - zero new tuning / runT / logic.js (logic.js stays byte-identical).
  //
  // Called from _drawAll's world-space pass (camera transform already applied).
  // No-op on a base world for the pools that don't apply (swamp has no
  // ambient fireflies; Reeds has no pollen) so a first-time run's ambient
  // element set is exactly what the seed says.
  drawAmbient(ctx, view, colorSat, now) {
    const vx = view.x - 40, vy = view.y - 40, vw = view.w + 80, vh = view.h + 80;
    const inView = (x, y, m) => x + m > vx && x - m < vx + vw && y + m > vy && y - m < vy + vh;

    // (a) SURFACE RIPPLES — soft expanding concentric rings on the water bands.
    //     Each ripple cycles on ripplePhase(i, now): radius grows, alpha fades.
    //     Drawn as 2 thin ellipses (a painted-water look, not a hard ring).
    let ri = 0;
    for (const rp of this.ambientRipples) {
      ri++;
      if (!inView(rp.x, rp.y, rp.rMax)) continue;
      const t = ripplePhase(ri - 1, now);           // 0..1 looping cycle
      const rad = rp.rMax * (0.25 + 0.75 * t);      // expand outward
      const a = 0.35 * (1 - t) * (0.4 + 0.6 * colorSat);  // fade as it expands
      if (a < 0.02) continue;
      ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(224,232,230,1)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rad, rad * 0.42, 0, 0, TAU);
      ctx.stroke();
      // a fainter inner echo (a hand-painted ripple has 2 rings).
      ctx.globalAlpha = a * 0.5;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rad * 0.55, rad * 0.55 * 0.42, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // (b) DRIFTING POLLEN — small drifting motes (swamp only). Each drifts on
    //     a slow bounded Lissajous-ish path (a pure function of now + seed) +
    //     sways; a soft warm dot with a faint halo. Cheap (one fill + one arc).
    if (this.ambientPollen.length) {
      let pi = 0;
      for (const p of this.ambientPollen) {
        pi++;
        const dx = Math.sin(now * 0.35 + p.ph) * p.drift;
        const dy = Math.cos(now * 0.28 + p.ph * 1.7) * p.drift * 0.6;
        const x = p.x + dx, y = p.y + dy;
        if (!inView(x, y, 16)) continue;
        const tw = 0.4 + 0.6 * fireflyTwinkle(pi, now);   // gentle flicker
        ctx.globalAlpha = 0.30 * tw * (0.4 + 0.6 * colorSat);
        ctx.fillStyle = 'rgba(236,224,178,1)';
        ctx.beginPath();
        ctx.arc(x, y, p.sz, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.12 * tw;
        ctx.beginPath();
        ctx.arc(x, y, p.sz * 2.4, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // (c) AMBIENT FIREFLIES — a small twinkling swarm (Reeds / Black Reeds).
    //     A SEPARATE small pool from the lantern light-economy fireflies: these
    //     are the AMBIENT living layer (dimmer, more numerous, purely
    //     decorative); the light-economy ones are the bright lantern refills.
    if (this.ambientFireflies.length) {
      let fi = 0;
      for (const f of this.ambientFireflies) {
        fi++;
        const dx = Math.sin(now * 0.5 + f.ph) * 9;
        const dy = Math.cos(now * 0.4 + f.ph * 1.4) * 7;
        const x = f.x + dx, y = f.y + dy;
        if (!inView(x, y, 16)) continue;
        const tw = fireflyTwinkle(fi, now);              // 0..1 twinkle
        const a = 0.15 + 0.85 * tw;                       // dim -> bright
        // a warm green-amber point with a soft glow halo.
        ctx.globalAlpha = 0.55 * tw;
        ctx.fillStyle = 'rgba(214,244,150,1)';
        ctx.beginPath();
        ctx.arc(x, y, f.sz * 2.2, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(244,255,196,1)';
        ctx.beginPath();
        ctx.arc(x, y, f.sz, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // L2 (v1.9 "The Living Swamp"): the BASE-SWAMP LIGHT POOLS — the parked
  // "lantern in the swamp" done as PURE LIGHT (no fuel, no mechanics; the
  // balance version stays deferred). A handful of soft warm light pools baked
  // into the swamp ground (the seeded `swampLightPools` pool) that read as the
  // path glowing faintly as the frog travels. PRESENTATION-ONLY + POOLED +
  // SEEDED + VIEW-CULLED:
  //   - positions come from the seeded pool built in build() (seed + 1571);
  //   - each pool "breathes" on a slow bounded pulse (a pure function of
  //     `now` + the pool's seed) — no per-frame state, no Math.random in the
  //     hot path;
  //   - a single soft radial glow is BAKED ONCE into an offscreen sprite
  //     (this._swampGlowSprite) and drawImage'd scaled per pool — so the hot
  //     path does a bounded number of drawImage calls and NO per-frame
  //     gradient allocation (the v1.4 P10 budget discipline);
  //   - every pool is VIEW-CULLED to the visible rect (the same cull
  //     swampLightCounts uses), so the on-screen count stays capped;
  //   - base-swamp ONLY: the pool is empty on a Reeds variant, so a Reeds run
  //     renders exactly as before and logic.js stays byte-identical.
  //
  // Called from _drawAll's world-space pass (camera transform already applied),
  // drawn UNDER the props so the light sits on the ground.
  drawSwampLightPools(ctx, view, now) {
    if (!this.swampLightPools.length) return;   // no-op on a Reeds variant
    const vx = view.x - 80, vy = view.y - 80, vw = view.w + 160, vh = view.h + 160;
    const inView = (x, y, m) => x + m > vx && x - m < vx + vw && y + m > vy && y - m < vy + vh;
    // Bake the soft radial glow sprite ONCE (a 128x128 warm gradient); reuse it
    // for every pool (scaled). The sprite is a presentation asset, never read
    // by logic/tuning.
    if (!this._swampGlowSprite) {
      const sc = document.createElement('canvas');
      sc.width = 128; sc.height = 128;
      const sctx = sc.getContext('2d');
      const g = sctx.createRadialGradient(64, 64, 2, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,232,170,0.55)');
      g.addColorStop(0.5, 'rgba(255,214,140,0.22)');
      g.addColorStop(1, 'rgba(255,214,140,0)');
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, 128, 128);
      this._swampGlowSprite = sc;
    }
    const sprite = this._swampGlowSprite;
    for (const p of this.swampLightPools) {
      if (!inView(p.x, p.y, p.r)) continue;
      // a slow bounded breath (a pure function of now + the pool's seed): the
      // pool's alpha + radius swell gently, so the light feels alive.
      const br = 0.5 + 0.5 * Math.sin(now * 0.7 + p.seed * 0.618 + p.ph);   // 0..1
      const a = 0.35 + 0.45 * br;
      const R = p.r * (0.9 + 0.2 * br);
      ctx.globalAlpha = a;
      // an elliptical squash (ground-lying light) reads as a pool on the swamp.
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1, 0.62);
      ctx.drawImage(sprite, -R, -R, R * 2, R * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // Collision: push circle out of obstacles/reeds (blocks enemies too).
  collideCircle(x, y, r, passReeds = false) {
    let px = x, py = y;
    for (const o of this.obstacles) {
      const dx = px - o.x, dy = py - o.y;
      const d2 = dx * dx + dy * dy;
      const min = o.r + r;
      if (d2 < min * min && d2 > 0.001) {
        const d = Math.sqrt(d2);
        px = o.x + (dx / d) * min;
        py = o.y + (dy / d) * min;
      }
    }
    // Q4: the painted crossing's wall (only present while unpainted). Same
    // push-out as obstacles — this is the enemy-spawn validation path too, so
    // a spawn placed inside the wall is pushed clear of it every frame.
    for (const o of this.crossingSolids) {
      const dx = px - o.x, dy = py - o.y;
      const d2 = dx * dx + dy * dy;
      const min = o.r + r;
      if (d2 < min * min && d2 > 0.001) {
        const d = Math.sqrt(d2);
        px = o.x + (dx / d) * min;
        py = o.y + (dy / d) * min;
      }
    }
    if (!passReeds) {
      for (const rd of this.reeds) {
        if (rd.h < 0.5) continue;
        const dx = px - rd.x, dy = py - rd.y;
        const d2 = dx * dx + dy * dy;
        const min = 12 + r;
        if (d2 < min * min && d2 > 0.001) {
          const d = Math.sqrt(d2);
          px = rd.x + (dx / d) * min;
          py = rd.y + (dy / d) * min;
        }
      }
    }
    px = clamp(px, r, this.w - r);
    py = clamp(py, r, this.h - r);
    return [px, py];
  }

  // Q4 (Astra): paint the crossing with a pigment (the stroke hook wires this
  // in Q5; headless-testable now). Returns the NEW state on a real transition,
  // null when the pigment is a no-op — the bounded collision data is rebuilt
  // ONLY on real transitions (idempotent by construction).
  paintCrossing(pigment) {
    const next = crossingTransition(this.crossingState, pigment);
    if (next === this.crossingState) return null;
    this.crossingState = next;
    this.crossingSolids = crossingSolids(next);
    return next;
  }

  // Q4 (Astra): pure spawn validation — a point is valid when no solid
  // (obstacle or crossing wall) overlaps an enemy-sized circle there. Grown
  // reeds are excluded on purpose: enemies already walk through corridor
  // reeds, and the crossing wall is the only new solid this adds.
  isValidSpawn(x, y, r = 12) {
    for (const o of this.obstacles) if (dist2(o.x, o.y, x, y) < (o.r + r) * (o.r + r)) return false;
    for (const s of this.crossingSolids) if (dist2(s.x, s.y, x, y) < (s.r + r) * (s.r + r)) return false;
    return true;
  }

  // ------------------------------------------------------------- rendering
  drawBackground(ctx, view, colorSat) {
    // Swamp floor: layered warm water. Fills the whole world in world-space.
    // The caller (_drawAll) already applied the single camera transform, so no
    // inner camera transform is applied here — the old double-transform pushed
    // all terrain off-screen and left the cream page background showing.
    ctx.fillStyle = sat('#6f9e8e', colorSat);
    ctx.fillRect(0, 0, this.w, this.h);

    // L2 (b) — layered watercolor stroke texture: ONE cached image per zone
    // (the budget trick; ~4 drawImages/frame regardless of world size). The
    // base wash + directional brush strokes were baked once at build().
    if (this._texCanvases) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.imageSmoothingEnabled = true;
      for (let zi = 0; zi < this._texCanvases.length; zi++) {
        ctx.drawImage(this._texCanvases[zi], 0, 0, this.w, this.h);
      }
      ctx.restore();
    }

    // P10: cull per-item decoration to the visible world rect (off-screen items
    // are invisible anyway; skipping them is a zero-visible-change perf win that
    // holds 60fps across the full 5400px world). The floor fillRect above is a
    // single canvas-clipped call, so it stays.
    const m = 100;
    const cx0 = view.x - m, cy0 = view.y - m;
    const cx1 = view.x + view.w / view.scale + m, cy1 = view.y + view.h / view.scale + m;
    const inView = (x, y) => x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1;

    // deep patches (N4: High Tide widens water via this.waterWidthMult —
    // render-only, defaults to 1 so the first-time render is byte-identical)
    const wm = this.waterWidthMult || 1;
    for (const rp of this.ripples) {
      if (!inView(rp.x, rp.y)) continue;
      ctx.strokeStyle = `rgba(30,60,55,${0.14 * colorSat + 0.04})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rp.r * wm, rp.r * 0.5 * wm, 0, 0, TAU);
      ctx.stroke();
    }
    // grass tufts
    for (const g of this.grass) {
      if (!inView(g.x, g.y)) continue;
      const hgt = g.s * 3;
      ctx.strokeStyle = sat('#4d7a4a', colorSat);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.quadraticCurveTo(g.x + 3, g.y - hgt * 0.6, g.x + wobble(g.seed, 1, 3), g.y - hgt);
      ctx.moveTo(g.x, g.y);
      ctx.quadraticCurveTo(g.x - 3, g.y - hgt * 0.6, g.x + wobble(g.seed, 2, 3) - 4, g.y - hgt * 0.9);
      ctx.stroke();
    }
    // soil patches
    for (const s of this.soil) {
      if (!inView(s.x, s.y)) continue;
      ctx.fillStyle = sat('#8a6f4d', colorSat);
      ctx.globalAlpha = 0.55;
      traceBlob(ctx, s.x, s.y, s.r, s.x | 0, 0.15, 10);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // paint layer
    ctx.globalAlpha = 0.9;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.paintCanvas, 0, 0, this.w, this.h);
    ctx.globalAlpha = 1;
    // slicks (blue wet shine) — N4: High Tide widens these too
    for (const s of this.slick) {
      if (!inView(s.x, s.y)) continue;
      ctx.fillStyle = `rgba(120,170,240,${0.14 * Math.min(1, s.t)})`;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r * wm, s.r * 0.6 * wm, 0, 0, TAU);
      ctx.fill();
    }
    // L2 (a) — wet rim: freshly painted pigment cells carry a darker edge that
    // dries out (derived from the existing grid `age`/amount; no new state).
    this.drawWetRims(ctx, inView);
  }

  // L2 (a): draw the wet-edge rims over the paint layer. Pure draw-time; reuses
  // the pigment grid's `amount` (which decays with `age` over ~5s) so a fresh
  // cell reads wet (strong rim) and dries to nothing. View-culled + capped for P10.
  drawWetRims(ctx, inView) {
    if (!this.pigmentGrid || this.pigmentGrid.size === 0) return;
    const rimR = wetRimRadius(this.cell);
    let drawn = 0;
    ctx.save();
    ctx.lineCap = 'round';
    for (const [key, c] of this.pigmentGrid) {
      if (drawn >= WET_RIM_CAP) break;
      const [cx, cy] = key.split(',');
      const x = (+cx + 0.5) * this.cell, y = (+cy + 0.5) * this.cell;
      if (!inView(x, y)) continue;
      const amount = Math.max(c.red, c.blue, c.green);
      const a = wetRimAlpha(amount);
      if (a < 0.02) continue; // fully dried
      // the freshest pigment color dictates the rim hue
      const hex = c.red >= c.blue && c.red >= c.green ? '#8a3420' : c.blue >= c.green ? '#2c5a9a' : '#3f6d28';
      ctx.globalAlpha = a;
      ctx.strokeStyle = hex;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(x, y, rimR, rimR * 0.9, 0, 0, TAU);
      ctx.stroke();
      drawn++;
    }
    ctx.restore();
  }

  drawProps(ctx, view, colorSat, now, px, py) {
    // vegetation, reeds, lily pads — in world space (caller applies the single
    // camera transform). No inner camera transform.
    // P10: cull to the visible world rect (off-screen = invisible; zero visual change).
    const m = 120;
    const cx0 = view.x - m, cy0 = view.y - m;
    const cx1 = view.x + view.w / view.scale + m, cy1 = view.y + view.h / view.scale + m;
    const inView = (x, y) => x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1;

    // vegetation (behind actors)
    for (const v of this.veg) {
      if (!inView(v.x, v.y)) continue;
      const hgt = v.h;
      if (v.burn > 0) {
        // charred
        ctx.strokeStyle = '#4a3b30';
        ctx.lineWidth = 3;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(v.x + i * 5, v.y);
          ctx.lineTo(v.x + i * 7 + wobble(v.seed, i + 5, 4), v.y - hgt * 0.4);
          ctx.stroke();
        }
        if (Math.random() < 0.25) { // ember flicker
          ctx.fillStyle = 'rgba(255,150,60,0.5)';
          ctx.beginPath();
          ctx.arc(v.x + wobble(v.seed, Math.floor(now * 8), 8), v.y - hgt * 0.3, 2.5, 0, TAU);
          ctx.fill();
        }
      } else if (v.alive) {
        ctx.strokeStyle = sat('#3f6d3a', colorSat);
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(v.x + i * 4, v.y);
          ctx.quadraticCurveTo(v.x + i * 9 + wobble(v.seed, i + 3, 5), v.y - hgt * 0.5, v.x + i * 12 + wobble(v.seed, i + 7, 6), v.y - hgt);
          ctx.stroke();
        }
        ctx.fillStyle = sat('#5a9e3d', colorSat);
        ctx.beginPath();
        ctx.ellipse(v.x - 8, v.y - hgt * 0.8, 6, 3.5, -0.5, 0, TAU);
        ctx.ellipse(v.x + 9, v.y - hgt * 0.65, 6, 3.5, 0.5, 0, TAU);
        ctx.fill();
      }
    }
    // reeds
    for (const rd of this.reeds) {
      if (!inView(rd.x, rd.y)) continue;
      const k = rd.h;                    // 0..1 growth factor
      const hgt = 46 * k;                // pixel height
      // L1: the reed sways in a gentle breeze — the planted base holds while
      // the tip drifts on a per-reed sine (reedSway, small ±5px, scaled by the
      // growth factor so a sprout barely moves). Pure draw-time (a function of
      // `now` + rd.seed); the original bend/wobble is preserved.
      const sw = reedSway(rd.seed, now) * k;
      const tipx = rd.x + wobble(rd.seed, 1, 5) * k + sw;
      ctx.strokeStyle = rd.burn > 0 ? '#5a3b2a' : sat('#3a6d55', colorSat);
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(rd.x, rd.y);
      ctx.quadraticCurveTo(rd.x + 6 + sw * 0.5, rd.y - hgt * 0.6, tipx, rd.y - hgt);
      ctx.stroke();
      // cattail head (rides the swaying tip)
      if (k > 0.6) {
        ctx.fillStyle = rd.burn > 0 ? '#3b2a20' : sat('#7a5a3a', colorSat);
        ctx.beginPath();
        ctx.ellipse(tipx, rd.y - hgt - 4, 4, 9, 0, 0, TAU);
        ctx.fill();
      }
    }
    // lily pads
    for (const p of this.pads) {
      if (!inView(p.x, p.y)) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = sat('#4f8a55', colorSat);
      traceBlob(ctx, 0, 0, p.r, p.x | 0, 0.08, 16);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = `rgba(43,35,32,${0.4 + 0.3 * colorSat})`;
      traceBlob(ctx, 0, 0, p.r, p.x | 0, 0.08, 16);
      ctx.stroke();
      // notch
      ctx.fillStyle = sat('#3f7048', colorSat);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(p.r * 0.9, -p.r * 0.18);
      ctx.lineTo(p.r * 0.85, p.r * 0.2);
      ctx.closePath();
      ctx.fill();
      // vein arcs
      ctx.strokeStyle = `rgba(255,255,255,${0.1 + 0.1 * colorSat})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const a = 0.6 + i * 0.9;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * p.r * 0.8, Math.sin(a) * p.r * 0.8);
        ctx.stroke();
      }
      // a flower on some pads
      if ((p.x | 0) % 3 === 0) {
        ctx.fillStyle = sat('#e8b6cc', colorSat);
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * TAU + now * 0.05;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * 7, Math.sin(a) * 7, 6, 3.5, a, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = sat('#ffd75e', colorSat);
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    // L1 (v1.9): BREATHING mist — a slow alpha/offset oscillation on the
    // existing parallax bands. `mistBreath(seed, now)` gives each band a ~0.7 s
    // period (≈9 s) 0..1 factor that SWELLS the band's alpha (a*b.alpha *
    // (0.45 + 0.9*a)) and DRIFTS the whole band ±8 px — the mist breathes in
    // and out. Pure draw-time (no state); the MIST_BANDS constants (alpha,
    // parallax) are unchanged so the v1.4 L1 test (stage 63) still passes.
    const visL = view.x, visR = view.x + view.w / view.scale;
    for (const b of MIST_BANDS) {
      const span = 1200;
      const S = (1 + b.parallax) * view.x + now * b.speed + b.seed * 173;
      const breath = mistBreath(b.seed, now);                  // L1: 0..1, ~9 s
      const breathOff = (breath - 0.5) * 2 * 8;                // ±8 px drift
      let k = Math.floor((visL - span - S) / span);
      for (let x = S + k * span; x < visR + span; x += span) {
        if (x + b.r < visL || x - b.r > visR) continue;
        const bob = Math.sin(now * 0.25 + b.seed) * 14 + breathOff;   // + L1 drift
        ctx.globalAlpha = b.alpha * (0.45 + 0.9 * breath);    // L1: breathing alpha
        ctx.fillStyle = 'rgba(232,238,234,1)';
        ctx.beginPath();
        ctx.ellipse(x, b.y + bob, b.r, b.h * 0.5, 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // L1: a handful of staggered shimmer glints on the open water. Positions
    // come from the existing ripple spots (the open-water markers), capped at
    // SHIMMER_CAP so the draw cost never grows; each glint pulses on a
    // staggered sine (shimmerGlint) so they twinkle out of sync. Cull to view.
    let gl = 0;
    for (const rp of this.ripples) {
      if (gl >= SHIMMER_CAP) break;
      if (rp.x < visL || rp.x > visR || rp.y < view.y - 40 || rp.y > view.y + view.h / view.scale + 40) { gl++; continue; }
      const a = shimmerGlint(gl, now);
      if (a <= 0.02) { gl++; continue; }
      const gw = rp.r * (0.5 + 0.5 * a);
      ctx.globalAlpha = a * 0.5 * (0.4 + 0.6 * colorSat);
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, gw, gw * 0.4, 0, 0, TAU);
      ctx.fill();
      gl++;
    }
    ctx.globalAlpha = 1;

    this.pondLife.draw(ctx, view, colorSat, px, py);

    // Q5 (Astra): the painted crossing — the bramble wall at the detour
    // mouth (a fixed world prop; pure draw-time, so P10 culls it like every
    // other prop). `px`/`py` (optional) are the frog's position for the
    // nearby hint; a headless caller omits them and the hint is skipped.
    if (this.mothFlower && (inView(this.mothFlower.x, this.mothFlower.y) || inView(this.mothFlower.x, this.mothFlower.y + 310))) {
      this.drawMothFlower(ctx, now, px, py);
    }
    if (this.crossingState && inView(CROSSING.x, CROSSING.y)) {
      this.drawCrossing(ctx, now, colorSat, px, py);
    }
  }

  drawMothFlower(ctx, now, px, py) {
    const f = this.mothFlower;
    if (!f) return;
    ctx.save(); ctx.translate(f.x, f.y);
    ctx.fillStyle = 'rgba(122,161,117,0.14)'; ctx.beginPath();ctx.ellipse(0, 0, 138, 72, 0, 0, TAU);ctx.fill();
    // A quiet path and sign point off the main corridor, never block it.
    ctx.fillStyle = '#92ae91';
    for (let i=0;i<5;i++) { ctx.beginPath();ctx.ellipse((i%2 ? -8 : 8),90+i*42,3,6,0,0,TAU);ctx.fill(); }
    ctx.fillStyle = '#e8e3cb';ctx.fillRect(-92,288,184,31);
    ctx.strokeStyle = '#596451';ctx.lineWidth=1.5;ctx.strokeRect(-92,288,184,31);
    ctx.font=uiFont(14);ctx.textAlign='center';ctx.fillStyle='#354f43';ctx.fillText('↑ Lantern moth nook',0,309);
    ctx.strokeStyle='#9ac87b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,30);ctx.lineTo(0,-5);ctx.stroke();
    ctx.fillStyle='#6b9b61';ctx.beginPath();ctx.ellipse(-12,16,15,5,-.4,0,TAU);ctx.ellipse(12,12,15,5,.4,0,TAU);ctx.fill();
    ctx.lineWidth=2;ctx.strokeStyle=f.green ? '#c5ecc0' : '#8faf83';
    ctx.beginPath();ctx.arc(0,-7,35+Math.sin(now*3)*2,0,TAU);ctx.stroke();
    for(let i=0;i<5;i++) {
      const a=i/5*TAU, r=f.green ? 20 : 7;
      ctx.fillStyle=f.green ? '#abdb8d' : '#aca995';ctx.beginPath();ctx.ellipse(Math.cos(a)*r, -7+Math.sin(a)*r, f.green ? 16 : 7, f.green ? 10 : 12, a,0,TAU);ctx.fill();ctx.stroke();
    }
    ctx.fillStyle=f.green ? '#f6df9d' : '#6d7d60';ctx.beginPath();ctx.arc(0,-7,f.green ? 8 : 5,0,TAU);ctx.fill();
    ctx.restore();
  }

  // Instructional text is drawn after the darkness pass by Game, so the
  // counter remains discoverable at low fuel without lighting extra terrain.
  drawMothHint(ctx, px, py) {
    const f = this.mothFlower;
    if (!f || !Number.isFinite(px) || Math.hypot(px-f.x,py-f.y)>=280) return;
    ctx.save(); ctx.translate(f.x, f.y);
    ctx.fillStyle='rgba(18,35,29,0.98)';ctx.fillRect(-300,-116,600,72);
    ctx.font=uiFont(22);ctx.fillStyle='#f5f8e9';ctx.textAlign='center';
    ctx.fillText(f.resting ? 'Moth resting safely · +2 Cobalt' : f.green ? 'Flower ready · guide moth with lantern' : 'Paint flower GREEN · lure with lantern',0,-90);
    ctx.fillStyle='#e1efff';ctx.fillText(f.resting ? 'A quiet thank-you · once per expedition' : 'BLUE moth near flower → safe rest +2 Cobalt',0,-62);
    ctx.restore();
  }

  // Q5 (Astra): render the painted crossing in its current state. Draw-time
  // only (no per-frame state change): fixed geometry, bounded elements
  // (≤ 4 blobs + ≤ 10 accents per state, no allocations), seeded-free (the
  // mouth is seed-independent by design). States: 'unpainted' (the thorny
  // bramble wall, still solid), 'crossing' (the bramble parts — a safe leafy
  // arch), 'current' (blue water filling the gap, with slow flow), 'bramble'
  // (red thorns waking across the mouth). The frog's position (optional)
  // gates the nearby hint, mirroring the field studies' hint.
  drawCrossing(ctx, now, colorSat, px, py) {
    ctx.save();
    ctx.translate(CROSSING.x, CROSSING.y);
    // the detour's ground wash — a slightly deeper water pocket behind the
    // mouth, so the loop reads as a place you go TO, not a random wall.
    ctx.fillStyle = 'rgba(58,92,80,0.30)';
    ctx.beginPath(); ctx.ellipse(0, -46, 200, 104, 0, 0, TAU); ctx.fill();
    const st = this.crossingState;
    if (st === 'unpainted') {
      // the thorny bramble wall (matches the solid's geometry: 4 blobs,
      // 70px pitch) — dark, dense, and faintly shimmering to read as
      // "paintable".
      ctx.fillStyle = sat('#3d4f35', colorSat);
      for (let i = 0; i < 4; i++) {
        const bx = CROSSING.blobOffsets[i];
        ctx.beginPath(); ctx.ellipse(bx, 0, 40, 30, 0, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = sat('#2c3a26', colorSat); ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const tx = -112 + i * 28, tw = wobble(i + 5, 7, 6);
        ctx.beginPath(); ctx.moveTo(tx, 14); ctx.lineTo(tx + tw, -16 + wobble(i, 3, 8)); ctx.stroke();
      }
      // the "paintable" pulse — a faint cream ring that breathes (draw-only).
      ctx.strokeStyle = '#f4e9c8'; ctx.lineWidth = 2;
      ctx.globalAlpha = 0.14 + 0.10 * (0.5 + 0.5 * Math.sin(now * 2));
      ctx.beginPath(); ctx.ellipse(0, 0, 132, 44, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (st === 'crossing') {
      // the bramble PARTS — a safe leafy arch over an open gap.
      ctx.strokeStyle = sat('#4a5d3d', colorSat); ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-150, 20); ctx.quadraticCurveTo(-96, -58, -30, -66); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(150, 20); ctx.quadraticCurveTo(96, -58, 30, -66); ctx.stroke();
      ctx.fillStyle = sat('#5b8952', colorSat);
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.30, sway = Math.sin(now * 1.2 + i) * 3;
        const lx = Math.cos(a) * 78 + sway, ly = -14 + Math.sin(a) * 52;
        ctx.beginPath(); ctx.ellipse(lx, ly, 13, 5.5, a + 0.5, 0, TAU); ctx.fill();
      }
      // soft light through the open gap (draw-only, bounded 3 rays).
      ctx.strokeStyle = '#f6ecc9'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.16 + 0.10 * (0.5 + 0.5 * Math.sin(now * 1.5 + i * 1.4));
        ctx.beginPath(); ctx.moveTo(-52 + i * 52, -48); ctx.lineTo(-38 + i * 52, 30); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (st === 'current') {
      // water fills the gap — a slow blue current with drifting flow marks.
      ctx.fillStyle = sat('#5f93b5', colorSat);
      ctx.beginPath(); ctx.ellipse(0, 2, 132, 40, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#bcd9e6'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 5; i++) {
        const fx = ((now * 34 + i * 57) % 264) - 132;
        const fy = Math.sin(i * 2.1) * 24;
        ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.moveTo(fx - 14, fy); ctx.quadraticCurveTo(fx, fy - 5, fx + 14, fy); ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const rr = 16 + ((now * 22 + i * 33) % 78);
        ctx.globalAlpha = Math.max(0.04, 0.4 - rr / 190);
        ctx.beginPath(); ctx.ellipse(0, 2, rr, rr * 0.36, 0, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      // 'bramble' — red thorns wake across the mouth (passable, but they
      // sting). A warning pulse keeps the hazard readable.
      ctx.strokeStyle = sat('#7c3a2c', colorSat); ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const tx = -105 + i * 30, th = 30 + wobble(i, 9, 12);
        ctx.beginPath(); ctx.moveTo(tx, 26); ctx.lineTo(tx + wobble(i, 4, 10), 26 - th); ctx.stroke();
      }
      ctx.strokeStyle = '#e07856'; ctx.lineWidth = 2;
      ctx.globalAlpha = 0.18 + 0.14 * (0.5 + 0.5 * Math.sin(now * 3));
      ctx.beginPath(); ctx.ellipse(0, 0, 128, 42, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // the nearby hint (the frog's position is optional — a headless caller
    // omits it and the hint is skipped, mirroring the field studies).
    if (px !== undefined && py !== undefined) {
      const dx = px - CROSSING.x, dy = py - CROSSING.y;
      if (dx * dx + dy * dy < 300 * 300) {
        ctx.globalAlpha = 0.92;
        centerText(ctx, st === 'unpainted' ? 'Paint the bramble wall' : 'The painted crossing', 0, -118, uiFont(15, { weight: 700 }), INK);
        const sub = st === 'unpainted' ? '1 green parts it · 2 blue current · 3 red thorns'
          : st === 'crossing' ? 'a safe crossing — your postcards wear its stamp'
          : st === 'current' ? 'a slow current — moving through here is slower'
          : 'thorns wake — the crossing stings · repaint to change it';
        centerText(ctx, sub, 0, -99, uiFont(12), '#2f4640');
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  drawObstacles(ctx, view, colorSat) {
    // rocks/bushes in world space (caller applies the single camera transform).
    // P10: cull to the visible world rect (off-screen = invisible; zero visual change).
    const m = 120;
    const cx0 = view.x - m, cy0 = view.y - m;
    const cx1 = view.x + view.w / view.scale + m, cy1 = view.y + view.h / view.scale + m;
    for (const o of this.obstacles) {
      if (o.x < cx0 || o.x > cx1 || o.y < cy0 || o.y > cy1) continue;
      ctx.save();
      ctx.translate(o.x, o.y);
      if (o.kind === 0) {
        // rock
        ctx.fillStyle = sat('#8a8578', colorSat);
        traceBlob(ctx, 0, 2, o.r, o.seed, 0.18, 9);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = INK;
        ctx.globalAlpha = 0.7;
        traceBlob(ctx, 0, 2, o.r, o.seed, 0.18, 9);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // L2 (c): watercolor double-stroke — a second, low-alpha offset echo of
        // the edge so the outline reads as a hand-painted wash, not a hard line.
        this._doubleStroke(ctx, 0, 2, o.r, o.seed, 0.18, 9);
        ctx.fillStyle = sat('#a5a093', colorSat);
        traceBlob(ctx, -o.r * 0.25, -o.r * 0.3, o.r * 0.4, o.seed + 1, 0.2, 7);
        ctx.fill();
      } else {
        // bush
        ctx.fillStyle = sat('#557a45', colorSat);
        traceBlob(ctx, 0, 0, o.r, o.seed, 0.22, 11);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = INK;
        ctx.globalAlpha = 0.6;
        traceBlob(ctx, 0, 0, o.r, o.seed, 0.22, 11);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // L2 (c): watercolor double-stroke (soft ink echo) for bushes too.
        this._doubleStroke(ctx, 0, 0, o.r, o.seed, 0.22, 11);
        ctx.fillStyle = sat('#6d9459', colorSat);
        for (let i = 0; i < 4; i++) {
          const a = i / 4 * TAU + o.seed;
          traceBlob(ctx, Math.cos(a) * o.r * 0.4, Math.sin(a) * o.r * 0.4, o.r * 0.4, o.seed + i, 0.2, 7);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // L2 (c): a second, low-alpha offset "watercolor double-stroke" — a soft ink
  // echo offset a hair from the main edge, at a slightly larger radius. Reads as
  // a hand-painted wash edge. Pure draw-time (one extra stroke per visible prop).
  _doubleStroke(ctx, cx, cy, r, seed, amp, points) {
    const off = 1.8;
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.18;
    traceBlob(ctx, cx + off, cy + off, r * 1.03, seed + 40, amp + 0.02, points);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // color "health" of the world: 0 gray -> 1 full
  worldColorSat() {
    return this._colorSat ?? 0.25;
  }
  restoreColor(amount) {
    this._colorSat = clamp((this._colorSat ?? 0.25) + amount, 0, 1);
  }
}
