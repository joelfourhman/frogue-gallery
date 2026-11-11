// paint.js — the magical paintbrush: swipes, charged splashes, pigment trails.
// Painting is combat AND environmental interaction: every swipe writes to the
// world paint layer and applies pigment damage + statuses to anything it touches.
'use strict';
import { TAU, clamp, dist, dist2 } from './math.js';
import { PIGMENTS, brushHitsCircle, paintDamage, paintStatusFor, stepStatus, paintBoss, frontDeflectFactor, cragSleepBonus, REEDS_FLOOD_FLOOR, mothPaint, clearingCombo } from './logic.js';
import { UI, uiFont } from './ui.js';

// S1 (v1.9): the creatures with a DEDICATED per-creature hit sting (the 6
// archetypes built in audio.js). Turtle/cragfrog have no dedicated sting, so a
// hit on them falls back to the generic 'enemy-hit'. Kept as a Set (no per-hit
// allocation) so the once-per-action gate stays cheap.
const _HIT_KINDS = new Set(['beetle', 'mosquito', 'toad', 'wisp', 'serpent', 'leech']);

// S1 (v1.9): the STATUS-OFF sting per status type — the wet "pop" as a state
// drops (burn burns out / freeze thaws / root cracks). `slow` folds into the
// freeze release. Used by the dry-scrub (paint) and the natural-expiry
// (game) paths. Kept as a module const (no per-frame allocation).
const _STATUS_OFF = { burn: 'burn-out', freeze: 'freeze-release', slow: 'freeze-release', root: 'root-crackle' };

export class Paint {
  constructor(player, world, tuning, sfx, particles) {
    this.player = player;
    this.world = world;
    this.tuning = tuning;
    this.sfx = sfx;
    this.particles = particles;
    this.swipeCd = 0;
    this.splashCd = 0;
    this.trails = [];   // transient stroke ribbons (visual only)
    this.hitNotes = []; // floating status notes ("burning", "frozen", ...)
    // J1 (v1.4): short-lived "wet" residue marks left on surfaces. Draw-only
    // (never read by logic/save), capped so the pool can't grow unbounded.
    this.wet = [];
    this.MAX_WET = 120;
    // J2 (v1.9): the brush's in-flight INK DROPLETS — small pooled droplets that
    // separate off the swipe/splash with velocity + gravity + settle. A capped
    // array (oldest dropped first) so the pool can't grow unbounded — the "the
    // new droplets are pooled" acceptance. Kept in paint.js (separate from the
    // world ParticleSystem) so it adds no per-frame pool pressure to the P10
    // budget; the total on-screen juice is still asserted <= 220 in the smoke.
    this.droplets = [];
    this.MAX_DROPLETS = 48;
    // J2 (v1.9): the INK-THAT-LANDS marks (a short-lived darker wet blotch on
    // painted soil, a spreading ripple ring over painted water). Capped draw-only
    // array, never read by logic/save. Deterministic (seed-derived, no Math.random)
    // so the seeded RNG stream + the J1 A/B invariance are untouched.
    this.ink = [];
    this.MAX_INK = 40;
    // J3 (v1.9): the KILL INK-BURST — when a creature dies it dissolves into a
    // burst of the pigment it was painted with (or a neutral ink splat if never
    // painted). Reuses the J2 droplet PATTERN: a capped array (oldest dropped
    // first), seeded from an explicit position hash (NO global Math.random, so
    // the seeded RNG stream + the J1 A/B invariance are untouched), draw-only
    // (never read by logic/save). Kept in paint.js as a SEPARATE pool from the
    // world ParticleSystem, so the P10 budget is the sum of the paint pools
    // (asserted <= 220 in the smoke); a mass kill (a full wave + boss) stays
    // within the cap because the pool is hard-capped at MAX_INKBURST.
    this.inkBurst = [];
    this.MAX_INKBURST = 192;
  }

  // J1: drop a capped set of wet marks. Oldest are pushed out past the cap so
  // the array length is always <= MAX_WET (no unbounded allocation).
  _addWet(x, y, r, pig, life) {
    this.wet.push({ x, y, r, t: life, max: life, pig, seed: Math.random() * 100 });
    if (this.wet.length > this.MAX_WET) this.wet.shift();
  }

  // J2 (v1.9): the brush-ARC geometry for a stroke. The trail no longer reads
  // as a straight start->end line; it is a gentle curved bow (a quadratic
  // bezier: start, control, end) that follows the swipe's sweep. The bow is a
  // pure function of (x0,y0, x1,y1, seed) so it is deterministic and the same
  // seed always gives the same curve. `bow` scales the control-point offset
  // (a charged stroke bows harder + wider = the charged-slate feel).
  _arcCurve(t, bow = 1) {
    const mx = (t.x0 + t.x1) / 2, my = (t.y0 + t.y1) / 2;
    const dx = t.x1 - t.x0, dy = t.y1 - t.y0;
    const len = Math.hypot(dx, dy) || 1;
    // perpendicular offset, signed by the seed so the bow is consistent per stroke
    const px = -dy / len, py = dx / len;
    const off = len * 0.14 * (t.seed > 50 ? 1 : -1) * bow;
    return { cx: mx + px * off, cy: my + py * off };
  }
  // J2: a single point on the arc bezier at u in [0,1] (pure).
  _arcPoint(t, u, bow = 1) {
    const c = this._arcCurve(t, bow);
    const iu = 1 - u;
    return { x: iu * iu * t.x0 + 2 * iu * u * c.cx + u * u * t.x1,
             y: iu * iu * t.y0 + 2 * iu * u * c.cy + u * u * t.y1 };
  }

  // J2 (v1.9): spawn the in-flight ink DROPLETS off a stroke. Deterministic —
  // seeded from an EXPLICIT `seed` (a fresh seeded xorshift PRNG, NOT the global
  // Math.random), so this method adds ZERO draws to the global seeded RNG
  // stream. The caller passes the stroke's own seed (a swipe's trail seed; a
  // splash's position hash), so the same stroke always throws the same droplets
  // in every run — the smoke's determinism and the J1 A/B invariance hold.
  // Pooled + capped (oldest dropped). `n` + `size` scale with the stroke: a
  // charged splash throws MORE + LARGER droplets (the charged-slate feel).
  // `x0,y0,x1,y1` are the stroke's start/end (the arc the droplets ride off).
  _spawnDroplets(seed, x0, y0, x1, y1, pig, n, size, bow = 1) {
    let s = (Math.floor(seed) * 2654435761) >>> 0 || 1;
    const rng = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const col = PIGMENTS[pig];
    // the arc control point (a gentle bow) — droplets ride off the tip half
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;
    const off = len * 0.14 * (Math.floor(seed) % 2 ? 1 : -1) * bow;
    const cx = mx + px * off, cy = my + py * off;
    for (let i = 0; i < n; i++) {
      const u = 0.55 + rng() * 0.45;                 // drop off the tip half of the arc
      const iu = 1 - u;
      const qx = iu * iu * x0 + 2 * iu * u * cx + u * u * x1;
      const qy = iu * iu * y0 + 2 * iu * u * cy + u * u * y1;
      const sp = 60 + rng() * 120;                   // outward along the swipe
      const spread = (rng() - 0.5) * 2.4;            // radians off the aim
      const a = Math.atan2(dy, dx) + spread;
      this.droplets.push({
        x: qx, y: qy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        t: 0.5 + rng() * 0.35, max: 0.85, r: size * (0.5 + rng() * 0.8),
        pig, light: col.light, color: col.color,
      });
    }
    if (this.droplets.length > this.MAX_DROPLETS) this.droplets.splice(0, this.droplets.length - this.MAX_DROPLETS);
  }
  // a deterministic 1..1 "seed" from a world position (NOT Math.random) — used
  // to seed a splash's droplets/ink so J2 adds no global RNG draws.
  _posSeed(x, y) { return ((Math.abs(Math.floor(x) * 37 + Math.floor(y) * 53) % 997) + 1); }

  // J3 (v1.9): spawn a KILL INK-BURST at a death. The creature dissolves into a
  // radial burst of the pigment it was painted with (the world remembers what
  // you painted); a never-painted creature breaks into a neutral ink splat.
  // DETERMINISTIC — seeded from the death position hash (a fresh seeded
  // xorshift PRNG, NOT the global Math.random), so this adds ZERO draws to the
  // global seeded RNG stream and the J1 A/B invariance holds. Pooled + capped
  // (oldest dropped past MAX_INKBURST). Draw-only physics (gravity + settle),
  // exactly like the J2 droplets. `pig` is a PIGMENTS key ('red'/'blue'/'green')
  // or null/'dry' (neutral). `n` + `size` scale the burst: a boss kill passes a
  // larger n/size for the full bloom.
  spawnInkBurst(x, y, pig, n, size, spread) {
    const col = PIGMENTS[pig];
    const neutral = !col;                       // unpainted -> neutral ink splat
    const color = neutral ? '#3f352a' : col.color;
    const light = neutral ? '#8c7f6c' : col.light;
    let s = (this._posSeed(x, y) * 2654435761) >>> 0 || 1;
    const rng = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU;                    // full radial ring
      const sp = (40 + rng() * 150) * (spread || 1);
      const life = 0.5 + rng() * 0.5;           // 0.5–1.0 s settle
      this.inkBurst.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,   // slight up-bias, then gravity
        t: life, max: life,
        r: size * (0.4 + rng() * 0.9),
        color, light,
        seed: rng() * TAU,
      });
    }
    if (this.inkBurst.length > this.MAX_INKBURST) this.inkBurst.splice(0, this.inkBurst.length - this.MAX_INKBURST);
  }

  // J2 (v1.9): the INK-THAT-LANDS — a visible mark where the stroke touches the
  // ground, so painting reads as LEAVING ink, not just swinging. On SOIL it
  // lays a short-lived darker wet landing (the soil darkens where painted);
  // over WATER it rings a spreading ripple. Pure presentation: a capped
  // draw-only mark array, never read by logic/save. `surf` comes from the
  // existing paintSurfaceAt (water / veg / soil).
  _inkLanding(x, y, pig, surf, charged = false) {
    const life = charged ? 1.3 : 0.9;
    // deterministic blotch rotation from the position (a hash, NOT Math.random —
    // so J2 adds zero new RNG draws to the paint path and the seeded stream +
    // the J1 A/B invariance stay untouched).
    const rot = (((Math.floor(x) * 37 + Math.floor(y) * 53) % 628) / 100);
    if (surf === 'water') {
      // the painted water Ripples — a spreading ring mark (distinct from the
      // combat splash ring: it stays at the landing point and fades).
      this.ink.push({ x, y, r: charged ? 12 : 7, ring: true, t: 1.1, max: 1.1, pig });
    } else {
      // painted SOIL darkens: a small dark wet blotch under the pigment.
      this.ink.push({ x, y, r: (charged ? 16 : 9) + (rot % 4), t: life, max: life, pig, seed: rot });
    }
    if (this.ink.length > this.MAX_INK) this.ink.shift();
  }

  // S1 (v1.9): the SURFACE the brush is laying onto, from the target point.
  // Presentation-only — feeds a distinct paint voice (water blip / vegetation
  // rustle / soil baseline). Order: open water (Reeds flood band, a pure
  // elevation test), then vegetation (a live reed cluster within the stroke's
  // reach), else the soil/dry baseline. Bounded O(veg) scan per stroke — a
  // world's veg array is small (~24) and this runs at swipe rate only.
  paintSurfaceAt(x, y, reach) {
    const w = this.world;
    if (!w) return 'soil';
    // open dark water (Reeds variant only; a base swamp has no flood floor, so
    // it is always the dry baseline — a byte-identical no-op there).
    const rw = w.reedsWater || (w.reedsVariant ? { floor: REEDS_FLOOD_FLOOR } : null);
    if (rw && y >= rw.floor) return 'water';
    // A real World always has a veg array; the headless smoke stub may not —
    // treat a missing array as "no vegetation here" (the dry baseline).
    const veg = w.veg || [];
    const r2 = reach * reach;
    for (const v of veg) {
      if (v.alive && dist2(v.x, v.y, x, y) < r2) return 'veg';
    }
    return 'soil';
  }

  get swipeRange() { return this.tuning.swipeRange; }
  // strokes since last read (game.js drains this to restore swamp color)
  get restoreAcc() { const a = this._restoreAcc; this._restoreAcc = 0; return a; }

  update(dt) {
    if (this.swipeCd > 0) this.swipeCd -= dt;
    if (this.splashCd > 0) this.splashCd -= dt;
    // decay trails
    for (let i = this.trails.length - 1; i >= 0; i--) {
      this.trails[i].t -= dt;
      if (this.trails[i].t <= 0) this.trails.splice(i, 1);
    }
    // J1: decay the short-lived wet marks (they linger a moment then vanish)
    for (let i = this.wet.length - 1; i >= 0; i--) {
      this.wet[i].t -= dt;
      if (this.wet[i].t <= 0) this.wet.splice(i, 1);
    }
    // J2: the in-flight droplets — gravity + settle (a droplet slows, "lands",
    // then fades). Draw-only physics: they never feed combat/runRNG.
    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const d = this.droplets[i];
      d.vy += 320 * dt;                // gravity
      d.vx *= Math.exp(-2.5 * dt);     // air drag
      d.vy *= Math.exp(-1.2 * dt);     // vertical drag (slower)
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.t -= dt;
      if (d.t <= 0) this.droplets.splice(i, 1);
    }
    // J2: the ink-landing marks decay
    for (let i = this.ink.length - 1; i >= 0; i--) {
      const m = this.ink[i];
      m.t -= dt;
      if (m.ring) m.r += dt * 24;      // a water ripple spreads outward
      if (m.t <= 0) this.ink.splice(i, 1);
    }
    // J3 (v1.9): the KILL ink-burst — gravity + settle, exactly like the J2
    // droplets (a burst flees outward, slows, "lands," and fades). Draw-only
    // physics; it never feeds combat/runRNG. Decays to 0 on its own (the
    // smoke asserts the pool empties past its lifetime).
    for (let i = this.inkBurst.length - 1; i >= 0; i--) {
      const b = this.inkBurst[i];
      b.vy += 300 * dt;                // gravity (a touch heavier than the brush droplets)
      b.vx *= Math.exp(-2.2 * dt);     // air drag
      b.vy *= Math.exp(-1.4 * dt);     // vertical drag
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.t -= dt;
      if (b.t <= 0) this.inkBurst.splice(i, 1);
    }
    for (let i = this.hitNotes.length - 1; i >= 0; i--) {
      const n = this.hitNotes[i];
      n.t -= dt; n.y -= 14 * dt;
      if (n.t <= 0) this.hitNotes.splice(i, 1);
    }
  }

  // Called each frame while LMB is held: fire swipes at the cooldown rate.
  // enemies: array of {x,y,r,hp,maxHp,status,...} (boss handled separately).
  trySwipe(enemies) {
    const p = this.player;
    if (p.swipeT > 0 || this.swipeCd > 0) return null;
    const pig = p.pigment;
    this.swipeCd = this.tuning.swipeCooldown;
    p.swipeT = 0.14;
    const a = p.aimA;
    const R = this.swipeRange;
    // v1.4 color rework (Joel): the dry brush is the WORLD-RESTORER — it
    // recovers swamp color the most of any stroke (it is "cleaning," not
    // staining), so a dry swipe restores more than a pigment swipe.
    this._restoreAcc = (this._restoreAcc || 0) + (pig === 'dry' ? 0.010 : 0.009);

    // write the stroke into the world paint layer (environmental residue)
    this.world.paintSwipe(p.x, p.y, a, R, pig);
    this.onStroke?.({ kind: 'swipe', x: p.x, y: p.y, a, range: R, pigment: pig });
    // visual ribbon — J2 (v1.9): a tapered wet-stroke swipe that bows into a
    // curve and lingers ~0.4s (up from 0.28s) so the brush reads as wet. The
    // trail object now carries the curve control point (`cx`/`cy`); the push is
    // done in the J2 arc block below (drawTrails renders curve=true as a bezier).
    const TR = 0.4;
    // J1: a couple of short-lived wet marks left on the surface the stroke
    // passed over (draw-only residue). Capped by _addWet.
    const mx = p.x + Math.cos(a) * R * 0.6, my = p.y + Math.sin(a) * R * 0.6;
    this._addWet(mx, my, 9 + Math.random() * 6, pig, 0.9 + Math.random() * 0.5);
    this._addWet(p.x + Math.cos(a) * R * 0.9, p.y + Math.sin(a) * R * 0.9, 6 + Math.random() * 4, pig, 0.7 + Math.random() * 0.4);
    // S3 (v1.4): a pigment-colored swipe voice (wet "shh" + a per-pigment
    // signature) replaces the plain generic swish.
    // S1 (v1.9): + the surface the stroke lands on (water blip / vegetation
    // rustle / soil baseline). Presentation-only — a no-surface stroke is the
    // byte-identical S3 signature.
    const surf = this.paintSurfaceAt(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, R * 0.7);
    this.sfx('paint-swipe', { pig, surface: surf });
    // J2 (v1.9): the arc upgrade. (1) The trail bows into a CURVE (arc fidelity
    // — the brush follows a swipe curve, not a straight start->end line) with a
    // fresher wet ribbon; (2) a few POOLED ink droplets separate off the swipe
    // with velocity + gravity + settle; (3) the ink LANDS — a darker wet blotch
    // on soil / a ripple over water at the stroke's end. (1)+(3) are
    // deterministic (curve from the seed; landing from a position hash). (2)
    // uses the same seed as the trail (a fresh seeded PRNG, no extra global
    // Math.random), so the droplets are reproducible per stroke.
    // All draw-only — never touches damage/hits/runT/the seeded RNG stream.
    const x1 = p.x + Math.cos(a) * R, y1 = p.y + Math.sin(a) * R;
    const s0 = p.x + Math.cos(a) * p.r, s0y = p.y + Math.sin(a) * p.r;
    const seed = (Math.floor(Math.random() * 100) + 1) * 2;  // even, so _arcCurve's bow sign is stable
    // (1) curve the ribbon: a perpendicular bow + a slight tip overshoot
    this.trails.push({
      x0: s0, y0: s0y,
      cx: (s0 + x1) / 2 - Math.sin(a) * R * 0.16,
      cy: (s0y + y1) / 2 + Math.cos(a) * R * 0.16,
      x1: x1 + Math.cos(a) * R * 0.10, y1: y1 + Math.sin(a) * R * 0.10,
      w: 18, t: TR, max: TR, pig, seed, curve: true,
    });
    // (2) the in-flight droplets along the swipe curve (seeded, pooled)
    this._spawnDroplets(seed, s0, s0y, x1, y1, pig, 5, 2.6, 1);
    // (3) the ink landing at the stroke's end
    this._inkLanding(x1, y1, pig, surf, false);

    // fan-shaped hit test
    const arc = this.tuning.swipeArc;
    const hits = [];
    for (const e of enemies) {
      if (e.dead) continue;
      // R3 (v1.6 Module R): the MUD SERPENT is invisible + UNHITTABLE while
      // burrowed / recovering (under the water line). It is paintable while
      // telegraphing or surfaced (the counterplay is a painted-ring interrupt
      // before it surfaces; see the game's _bestiarySwipe).
      if (e.burrower && (e.phase === 'burrowed' || e.phase === 'recover')) continue;
      if (brushHitsCircle(p.x, p.y, a, R, arc, e)) hits.push(e);
    }
    this._applyHits(hits, pig, 'swipe');
    return hits.length ? hits : null;
  }

  // Charged splash (RMB): AoE burst around the frog. Returns hits.
  trySplash(enemies) {
    const p = this.player;
    if (this.splashCd > 0 || p.splashCharge < 1) return null;
    this.splashCd = this.tuning.splashCooldown;
    p.splashCharge = 0;
    const R = this.tuning.splashRadius;
    const pig = p.pigment;
    // v1.4: dry splash is the strongest single world-restore action.
    this._restoreAcc = (this._restoreAcc || 0) + (pig === 'dry' ? 0.04 : 0.025);
    this.world.paintSplash(p.x, p.y, R, pig);
    this.onStroke?.({ kind: 'splash', x: p.x, y: p.y, a: p.aimA, range: R, pigment: pig });
    // S3 (v1.4): a pigment-colored splash voice (wet "splat" + a per-pigment
    // signature) replaces the plain generic splat.
    // S1 (v1.9): the CHARGED big burst gets its own voice — `charge-splash`
    // (heavier impact + a per-pigment signature) with the surface it lands on.
    // The full-charge splash is the "charged big" of the core paint verb; a
    // no-surface call still lands the pigment + big signature.
    const surf = this.paintSurfaceAt(p.x, p.y, this.tuning.splashRadius);
    this.sfx('charge-splash', { pig, surface: surf });
    // R3 (v1.6 Module R): the serpent is unhittable while burrowed/recovering
    // (see trySwipe) — a blue splash that blinds a wisp still counts, but the
    // serpent stays planted under the water line.
    const hits = enemies.filter(e => !e.dead
      && !(e.burrower && (e.phase === 'burrowed' || e.phase === 'recover'))
      && dist(p.x, p.y, e.x, e.y) <= R + e.r);
    this._applyHits(hits, pig, 'splash');
    // cosmetic ring
    this.trails.push({ ring: true, x: p.x, y: p.y, r: R, t: 0.35, max: 0.35, pig });
    // J1: a wet splash leaves a ring of short-lived marks around the frog
    for (let s = 0; s < 5; s++) {
      const aa = Math.random() * TAU;
      const rr = R * (0.4 + Math.random() * 0.55);
      this._addWet(p.x + Math.cos(aa) * rr, p.y + Math.sin(aa) * rr, 7 + Math.random() * 7, pig, 0.9 + Math.random() * 0.5);
    }
    // J2 (v1.9): the CHARGED-SLATE feel — the full-charge burst is the heavy
    // impact of the core paint verb: a WIDER, DENSER splash arc (a second,
    // bolder ring ribbon), MORE pooled droplets flung out, and a DENSER ink
    // landing (a central blotch/ripple + a ring of landings around the burst).
    // All draw-only + deterministic: the dense ring is seedless, the 12 droplets
    // use a position-hash seed (a fresh PRNG, NOT the global Math.random), and
    // the ink landing uses a position hash — so this block adds ZERO draws to
    // the global seeded stream (the splash keeps its original 15 _addWet draws).
    this.trails.push({ ring: true, x: p.x, y: p.y, r: R * 0.72, t: 0.5, max: 0.5, pig, dense: true });
    // the splash is RADIAL (no aim): the droplets ride off a circle of radius R,
    // seeded from the player's position (a fresh PRNG — ZERO draws to the
    // global stream). `_spawnDroplets` treats (x0,y0)->(x1,y1) as an arc; a
    // radial burst is approximated by a semicircular sweep to the right.
    const sSeed = this._posSeed(p.x, p.y);
    const sEndX = p.x + Math.cos(0.6) * R, sEndY = p.y + Math.sin(0.6) * R;
    this._spawnDroplets(sSeed, p.x, p.y, sEndX, sEndY, pig, 12, 3.2, 0.6);
    this._inkLanding(p.x, p.y, pig, surf, true);
    return hits;
  }

  // J2 (v1.9): a small deterministic SEED from a world position (a hash, NOT
  // Math.random) so the splash's droplets/ink are reproducible without adding
  // any draw to the global seeded RNG stream.
  _posSeed(x, y) {
    return (Math.floor(x) * 37 + Math.floor(y) * 53 + 7) & 0x7fffffff;
  }

  _applyHits(hits, pig, kind) {
    const base = kind === 'swipe' ? this.tuning.swipeDamage : this.tuning.splashDamage;
    const p = this.player;
    // S3 (v1.4): fire each status blip at most ONCE per action (a big splash
    // hitting many enemies should not be a blip machine-gun). Maps a status
    // type to its tiny sting.
    const fired = {};
    const blip = { burn: 'burn-ignite', freeze: 'freeze-tick', root: 'root-thud' };
    for (const e of hits) {
      if (e.kind === 'moth') mothPaint(e, pig, this.world.mothFlower);
      // K1 (v1.5 M1) front-arc SHELL deflection (the Mud Turtle). The factor is
      // computed from the player position; side/back paint deals full damage
      // and RED BURN bypasses it entirely (it never routes through a paint
      // hit — it is applied per status-tick).
      const deflect = frontDeflectFactor(e, p);
      // K2 (v1.5 M2): an ASLEEP cragfrog is vulnerable — ×1.5 paint damage.
      const sleepBonus = cragSleepBonus(e);
      const combo = clearingCombo(pig, e);
      const dmg = paintDamage(base, pig, this.tuning, {
        enemy: e, deflectFactor: deflect, sleepBonus, statusBonus: combo,
      });
      e.hp -= dmg;
      // J1 (v1.9): the paint-CONNECT impact flash. Set `e.hitFlash` so the
      // struck creature renders white-hot on the exact frame the brush lands
      // (drawEnemy flips the body to '#f2e9dc'/'#fff' while hitFlash > 0; the
      // ~0.14s decay keeps it hot through the hitstop's frozen instant so the
      // frame reads as IMPACT, not as a pause). Pure presentation — `hitFlash`
      // is read only by the draw pass; it never feeds hit detection, damage,
      // the seeded RNG, or runT.
      e.hitFlash = 0.14;
      // S1 (v1.9): the per-creature HIT sting — the 6 archetypes have a
      // dedicated voice (armor clang / mosquito zap / toad thud / wisp hiss /
      // serpent slither / leech slurp); turtle/cragfrog fall back to the
      // generic 'enemy-hit'. Fired at most ONCE per action (a big splash
      // hitting many enemies should not be a sting machine-gun), using the
      // first hit creature's kind.
      if (!fired.hit) {
        fired.hit = true;
        const hk = e.kind;
        this.sfx(_HIT_KINDS.has(hk) ? 'hit-' + hk : 'enemy-hit');
      }
      // floating damage number (pigment-colored); a deflected hit says "shell!"
      if (deflect < 1) {
        this.note(e.x, e.y - e.r - 28, 'shell', pig, e, 'damage');
      } else {
        this.note(e.x, e.y - e.r - 28, combo > 1 ? `Blue + red! -${Math.round(dmg)}` : '-' + Math.round(dmg), pig, e, 'damage');
      }
      // v1.4 color rework (Joel): the dry brush CLEANS — scrubbing off the
      // enemy's active status (burn/slow/freeze/root). Dizzy is a toad quirk,
      // not a stain, so it's left alone.
      if (pig === 'dry') {
        if (e.status && e.status.type !== 'dizzy') {
          const clearedType = e.status.type;
          e.status = null; e.burnAccum = 0;
          this.note(e.x, e.y - e.r - 6, 'cleanse', 'dry', e);
          // S3: the scrub-whoosh, once per action.
          if (!fired.cleanse) {
            fired.cleanse = true; this.sfx('cleanse');
            // S1 (v1.9): the STATUS-OFF sting for whatever was scrubbed off
            // (the dry brush scrubs burn/freeze/slow/root). Fires with the
            // cleanse (once per action) — a wet "pop" as the state drops.
            this.sfx(_STATUS_OFF[clearedType] || 'burn-out');
          }
        }
      // toad special: any non-dry paint can dizzy instead of the normal status
      } else if (e.dizzyPaintChance && Math.random() < e.dizzyPaintChance) {
        e.status = { type: 'dizzy', t: e.dizzyDuration || 1.2, appliedAt: e._now || 0 };
        this.note(e.x, e.y - e.r - 6, 'dizzy!', 'green', e);
      } else {
        const res = paintStatusFor(pig, e, e._now || 0);
        if (res.status) {
          e.status = res.status;
          if (res.note && res.note !== 'immune-root') this.note(e.x, e.y - e.r - 6, res.note, pig, e);
          // S3: a tiny "it just happened" blip for the status that landed,
          // once per action (slow is folded into the freeze blip; only
          // burn/freeze/root get their own sting).
          const st = res.status.type;
          const stKey = st === 'slow' ? 'freeze' : st;
          if (blip[stKey] && !fired[stKey]) { fired[stKey] = true; this.sfx(blip[stKey]); }
        }
      }
      // enemy gets coated with the pigment color (visual reaction)
      e.tint = pig; e.tintT = 0.6;
      // droplet splatter off the enemy
      this.particles.splatter(e.x, e.y, PIGMENTS[pig].color, 6, 160);
      if (e.hp <= 0 && !e.dead) e.onDeath && e.onDeath();
    }
    // v1.4 color rework (Joel): painting enemies with GREEN heals the frog a
    // little — the heal is per ACTION (not per enemy) so a big green splash
    // is not a free medkit. The float is drained by player.update.
    // K4 (v1.5 M2): the GILDED Heron's plume (p._plumeSuppress) ABSORBS this
    // heal while it is live — both green heal sources (paint-on-green AND
    // standing-in-green) drop to 0 during the plume. No-op otherwise.
    if (pig === 'green' && hits.length && p.hp < p.maxHp && !p._plumeSuppress) {
      p._healAcc = (p._healAcc || 0) + (this.tuning.greenHealOnPaint || 0.5);
      this.note(p.x, p.y - p.r - 14, 'heal', 'green', p);
      // S1 (v1.9): the heal chime — fires the instant a green stroke actually
      // lands a heal (suppressed by the gilded plume, like the heal itself).
      // Presentation-only (sfx-bus; no-op in headless smoke).
      this.sfx('heal');
    }
  }

  // Boss paint: swipes add hue toward awakening. Returns 'awaken' | hits.
  paintBossHit(heron, pig, amount) {
    const p = this.player;
    const d = dist(p.x, p.y, heron.x, heron.y - (heron.diveH || 0));
    if (d > this.swipeRange + 30) return null;
    this._bossNote = true;
    const res = (pig === 'dry') ? null : this._bossPaint(heron, pig, amount);
    if (res) this._restoreAcc = (this._restoreAcc || 0) + 0.012;
    this.particles.splatter(heron.x, heron.y - (heron.diveH || 0), PIGMENTS[pig].color, 5, 140);
    if (res && pig !== 'dry') {
      // J3 (v1.9): remember the last pigment that painted the boss so its KILL
      // ink-burst dissolves into the palette it was painted with (the world
      // remembers). Draw-only field; never read by logic/save/pacing.
      heron._lastPig = pig;
      let d = paintDamage(this.tuning.swipeDamage, pig, this.tuning, { enemy: heron });
      if (heron.awakened) d *= 2;
      this.note(heron.x, heron.y - 150, '-' + Math.round(d), pig, heron, 'damage');
    }
    return res;
  }

  _bossPaint(h, pig, amount) {
    // direct paint damage while painting the boss
    let dmg = paintDamage(this.tuning.swipeDamage, pig, this.tuning, { enemy: h });
    if (h.awakened) dmg *= 2; // the shimmer window: double paint damage (see bossStep)
    // N3 (v1.3 M14): the Great Green Heron's reed-pin vulnerable window — while
    // pinned (held in place by the player's Moss paint) it takes 2x paint damage,
    // mirroring the awaken window. The gray heron never carries `pinned`, so this
    // is a no-op for the first-time run.
    if (h.pinned > 0) dmg *= 2;
    h.hp -= dmg;
    const res = paintBoss(h, pig, amount, this.tuning);
    if (res === 'awaken') return 'awaken';
    return 1;
  }

  // (logic.js paintBoss imported at module level to keep this stateless)
  note(x, y, text, pig, owner = null, channel = 'status') {
    // One latest-hit number and one status per creature. Rapid strokes should
    // not bury the target under overlapping copies of "frozen" and damage.
    const existing = owner && this.hitNotes.find(n => n.owner === owner && n.channel === channel);
    if (existing) { Object.assign(existing, { x, y, text, pig, t: 0.9 }); return; }
    if (this.hitNotes.length >= 24) return;
    this.hitNotes.push({ x, y, text, t: 0.9, max: 0.9, pig, owner, channel });
  }

  // ------------------------------ rendering (world space)
  drawTrails(ctx) {
    for (const t of this.trails) {
      const k = t.t / t.max;
      const col = PIGMENTS[t.pig];
      if (t.ring) {
        // J2: the charged-splash DENSE ring (a bolder inner ribbon) sits under
        // the existing splash ring for a heavier, wetter burst.
        if (t.dense) {
          ctx.strokeStyle = col.color;
          ctx.globalAlpha = k * 0.55;
          ctx.lineWidth = 7 * k + 2;
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.r * (0.9 + k * 0.2), 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else {
          ctx.strokeStyle = col.color;
          ctx.globalAlpha = k * 0.8;
          ctx.lineWidth = 10 * k + 3;
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.r * (1 - k * 0.5), 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        continue;
      }
      // J2 (v1.9): the brush arc. A curved bow (bezier) that follows the swipe's
      // sweep, not a straight start->end line — the "painting is the game" core
      // verb reads as a real brush stroke. The wobble is sampled along the
      // bezier (arc fidelity), the ribbon tapers + fades as it dries.
      const segs = 9;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // precompute the control point (curve=true) or a straight midpoint
      const useCurve = !!t.curve;
      const c = useCurve ? this._arcCurve(t) : { cx: (t.x0 + t.x1) / 2, cy: (t.y0 + t.y1) / 2 };
      for (let s = 0; s < segs; s++) {
        const u0 = s / segs, u1 = (s + 1) / segs;
        const wob = Math.sin(t.seed + s * 1.7) * 3;
        const p0 = useCurve ? this._arcPoint(t, u0) : { x: t.x0 + (t.x1 - t.x0) * u0, y: t.y0 + (t.y1 - t.y0) * u0 };
        const p1 = useCurve ? this._arcPoint(t, u1) : { x: t.x0 + (t.x1 - t.x0) * u1, y: t.y0 + (t.y1 - t.y0) * u1 };
        ctx.strokeStyle = col.color;
        ctx.globalAlpha = k * (0.5 + 0.4 * u1);
        ctx.lineWidth = (t.w * 0.35 + t.w * 0.65 * u1) * k + 1.5;
        ctx.beginPath();
        ctx.moveTo(p0.x + wob, p0.y + wob * 0.5);
        ctx.lineTo(p1.x + wob, p1.y + wob * 0.5);
        ctx.stroke();
      }
      // bright tip (at the overshoot end of the curve)
      ctx.globalAlpha = k;
      ctx.fillStyle = col.light;
      ctx.beginPath();
      ctx.arc(t.x1, t.y1, 4 * k + 1, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // J2 (v1.9): the INK-THAT-LANDS marks. A short-lived darker wet blotch on
  // painted soil (a dark ellipse under the pigment — the "painted soil
  // darkens") or a spreading ripple ring over painted water. Draw-only, under
  // the trails so the wet stroke sits on top. Deterministic + capped.
  drawInk(ctx) {
    if (!this.ink.length) return;
    for (const m of this.ink) {
      const k = Math.max(0, m.t / m.max);
      if (m.ring) {
        // water ripple: a thin expanding ring that fades as it spreads
        ctx.globalAlpha = k * 0.5;
        ctx.strokeStyle = 'rgba(180,215,245,0.9)';
        ctx.lineWidth = 1.5 + 2 * k;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        // soil darkens: a soft dark wet blotch
        ctx.globalAlpha = k * 0.32;
        ctx.fillStyle = 'rgba(30,24,18,0.9)';
        ctx.beginPath();
        ctx.ellipse(m.x, m.y, m.r, m.r * 0.7, m.seed, 0, TAU);
        ctx.fill();
        // a faint pigment sheen at the center (the wet paint catching light)
        const col = PIGMENTS[m.pig];
        if (col) {
          ctx.globalAlpha = k * 0.22;
          ctx.fillStyle = col.color;
          ctx.beginPath();
          ctx.ellipse(m.x, m.y, m.r * 0.55, m.r * 0.4, m.seed, 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // J2 (v1.9): the in-flight ink DROPLETS — small pigment dots with gravity +
  // settle (they arc out of the swipe, slow, and fade as they "land"). Drawn
  // ON TOP of the wet marks so the spray reads as fresh ink in the air. Draw-only.
  drawDroplets(ctx) {
    if (!this.droplets.length) return;
    for (const d of this.droplets) {
      const k = Math.max(0, Math.min(1, d.t / d.max));
      const col = PIGMENTS[d.pig];
      if (!col) continue;
      ctx.globalAlpha = k * 0.85;
      ctx.fillStyle = col.color;
      ctx.beginPath();
      // the spawn stores the droplet radius as `r` (see _spawnDroplets); read it
      // back as `r` here — `d.size` is undefined (NaN radius → invisible droplet).
      ctx.arc(d.x, d.y, d.r * (0.5 + 0.5 * k), 0, TAU);
      ctx.fill();
      // a tiny highlight (the wet sheen)
      ctx.globalAlpha = k * 0.5;
      ctx.fillStyle = col.light;
      ctx.beginPath();
      ctx.arc(d.x - d.r * 0.2, d.y - d.r * 0.2, d.r * 0.3 * k + 0.3, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // J3 (v1.9): draw the KILL INK-BURST — the soft watercolor blobs a creature
  // dissolves into on death. Each blob fades + shrinks as it settles (a little
  // watercolor "bleed" at the peak), with a lighter sheen at the core. Drawn
  // just after the wet marks so the burst reads as fresh ink breaking out of
  // the creature. Draw-only — reads only the (already-decayed) pool; it never
  // feeds combat, save data, or pacing.
  drawInkBurst(ctx) {
    if (!this.inkBurst.length) return;
    for (const b of this.inkBurst) {
      const k = Math.max(0, Math.min(1, b.t / b.max));
      // a soft "wet" blob that bleeds a touch wider at the peak, then dries down
      const r = b.r * (0.6 + 0.7 * k);
      ctx.globalAlpha = k * 0.5;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, r, r * 0.78, b.seed, 0, TAU);
      ctx.fill();
      // a lighter pigment sheen at the core (the fresh ink catching light)
      ctx.globalAlpha = k * 0.4;
      ctx.fillStyle = b.light;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, r * 0.5, r * 0.38, b.seed, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // J1 (v1.4): draw the short-lived wet residue marks. Soft, low-alpha blobs
  // (watercolor "wet" look) that fade as they dry. Draw-only — these never
  // influence combat, save data, or pacing; they only linger a moment.
  drawWet(ctx) {
    if (!this.wet.length) return;
    for (const m of this.wet) {
      const k = Math.max(0, m.t / m.max);
      const col = PIGMENTS[m.pig];
      const r = m.r * (0.8 + 0.4 * k); // dries down slightly as it fades
      ctx.globalAlpha = k * 0.42;
      ctx.fillStyle = col.color;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, r, r * 0.72, m.seed, 0, TAU);
      ctx.fill();
      // a lighter wet sheen at the center
      ctx.globalAlpha = k * 0.28;
      ctx.fillStyle = col.light;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, r * 0.55, r * 0.4, m.seed, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawNotes(ctx) {
    for (const n of this.hitNotes) {
      const k = n.t / n.max;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = uiFont(UI.sizes.label, { weight: 600 });
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(43,35,32,0.8)';
      ctx.strokeText(n.text, n.x, n.y);
      ctx.fillStyle = PIGMENTS[n.pig] ? PIGMENTS[n.pig].light : '#fff';
      ctx.fillText(n.text, n.x, n.y);
      ctx.globalAlpha = 1;
    }
  }
}
