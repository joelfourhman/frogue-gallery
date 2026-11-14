// player.js — the tiny frog painter: movement, hop, brush aim, damage, charm.
'use strict';
import { TAU, clamp, lerp, dist, traceBlob, wobble } from './math.js';
import { INK, sat } from './ui.js';
import { PIGMENTS, MOVEMENT, movementVelocity, hopLift, inGravityPocket, floodedWaterFactor, REEDS_POCKETS, REEDS_FLOOD_FLOOR, crossingSpeedFactor, inCrossingZone, restoreHealth } from './logic.js';

export class Player {
  constructor(x, y, tuning) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = 15;
    this.hp = tuning.maxHp;
    this.maxHp = tuning.maxHp;
    this.aimA = 0;
    this.facing = 1;
    this.pigment = 'red';
    this.hopT = 0;          // 0..1 while hopping
    this.hopBuffer = 0;
    this.hopCd = 0;         // PT3: stamina gap before the next hop (fly-fairness)
    this.hopDir = [1, 0];
    this.iframes = 0;
    this.hurtT = 0;         // red flash timer
    this.squash = 1;        // squash-and-stretch scale (x; y = 2 - squash)
    this._hopLanded = false; // J4: one-shot flag — true the frame a hop lands (consumed by game.js to fire dust puff + ripple + boing)
    this.swipeT = 0;         // brush swing animation timer
    this.slowT = 0;          // E3: slowed (mud pool)
    this.rootT = 0;          // E3: rooted (thorn reed) — cannot move
    this.splashCharge = 0;
    this.alive = true;
    this._blinkT = 1.5 + Math.random() * 3;
    // R3 (v1.6): the SILT LEECH cling. `leechAttached` is true while a leech is
    // clung (movement slowed 25% — see speedFactor); the game flips it on
    // contact / on paint-off / on hop-off. `leechCd` is the shared re-attach
    // window (seconds, ~6) — while > 0 no leech can latch again.
    this.leechAttached = false;
    this.leechCd = 0;
    // J4 (v1.9): the frog's OWN liveness — all draw-state (presentation-only;
    // no physics / i-frame / HP number moves).
    //  - _staggerT: a hurt STAGGER (a wobble + a flinch) set on taking damage,
    //    layered ON TOP of the J1 hitstop (the hitstop freezes the WORLD; this
    //    is the frog's own reaction). Decays in update; never touches iframes.
    //  - _victoryHopT: the VICTORY pose — a small contented hop + a
    //    squash-and-settle, set by game.js at the moment of victory (the boss
    //    is defeated / the victory screen opens) and read by draw().
    this._staggerT = 0;
    this._victoryHopT = 0;
  }

  get speed() { return 230; }

  // E3: movement speed factor from environmental hazard states (1 = free).
  // Root (thorn reed) is hard: it zeros speed in update; slow (mud pool) eases
  // back. Pure enough to read headless.
  speedFactor() {
    let f = 1;
    if (this.rootT > 0) f = 0;
    else if (this.slowT > 0) f = 0.55;
    return f;
  }

  // R3 (v1.6): the leech's STRANGLE — while a leech is clung, ground movement is
  // reduced 25% (a pure 0.75 factor). Read by update() only when a leech is
  // attached (Reeds), so a cycle-0 swamp run is byte-identical.
  leechFactor() { return this.leechAttached ? 0.75 : 1; }

  update(dt, input, tuning, world, view) {
    const mv = input.moveVec();
    const moving = !!(mv[0] || mv[1]);
    this.aimA = Math.atan2(input.mouse.worldY - this.y, input.mouse.worldX - this.x);
    this.facing = Math.cos(this.aimA) >= 0 ? 1 : -1;

    // hop / dodge (Space). PT3 (M7.5 fly-fairness): gated on a stamina cooldown
    // (hopCd) so mashing Space no longer chains into near-continuous i-frames.
    this.hopBuffer = input.pressed(' ') ? 0.12 : Math.max(0, this.hopBuffer - dt);
    let launched = false;
    if (this.hopBuffer > 0 && this.hopT <= 0 && this.hopCd <= 0 && this.alive) {
      this.hopBuffer = 0;
      launched = true;
      let [hx, hy] = mv;
      if (!hx && !hy) { hx = Math.cos(this.aimA); hy = Math.sin(this.aimA); }
      this.hopDir = [hx, hy];
      this.hopT = 0.22;
      this.hopCd = tuning.hopCooldown || 0.7;
      this.iframes = Math.max(this.iframes, tuning.hopIframes + 0.12);
      // J4: stretch on hop START (x0.85 / y1.15) — the body elongates as it
      // lifts off. Draw-only (the draw pass reads this.squash as the x scale,
      // y = 2 - squash); physics is untouched.
      this.squash = 0.85;
    }
    // J4: landing detection — a hop "lands" the frame hopT crosses from >0 to
    // <= 0 (checked AFTER the decrement). Set the one-shot flag (game.js fires
    // the dust puff + ripple + boing) and SQUASH the body (x1.2 / y0.8).
    // Draw-only.
    if (this.hopT > 0) {
      this.hopT -= dt;
      if (this.hopT <= 0) { this._hopLanded = true; this.squash = 1.2; }
    }
    if (this.hopCd > 0) this.hopCd -= dt;
    // R3 (v1.6): tick the shared leech re-attach window (a second leech cannot
    // latch while > 0). Reeds-only (a cycle-0 player never has a leech attached).
    if (this.leechCd > 0) this.leechCd -= dt;

    // movement: base speed, boosted mid-hop; E3 slow/root modifiers
    let spd = this.speed;
    if (this.hopT > 0.04) spd *= MOVEMENT.hopSpeed;
    spd *= this.speedFactor();
    // R3 (v1.6): a clinging leech STRANGLES the frog — movement reduced 25%
    // (the pure leechFactor, 0.75 while clung). Reeds-only; byte-identical
    // otherwise (a cycle-0 player never has a leech attached).
    if (this.leechAttached) spd *= this.leechFactor();
    // R2 (v1.6): the Reeds FLOODED LOWER BANKS — moving through the open dark
    // water (low elevation) slows ground movement. A pure factor from
    // logic.js (1.0 outside a flood band, 0.72 inside). Gated by the world
    // variant so a cycle-0 swamp run's movement is byte-identical.
    // G1 (v1.8): a BLACK REEDS run threads the world's OWN deeper/faster flood
    // band (world.reedsWater — REEDS_DARK_FLOOD_FLOOR / _FACTOR); a cycle-0
    // Reeds run (world.reedsWater.floor === REEDS_FLOOD_FLOOR) reads the SAME
    // band as before (byte-identical). A base swamp (reedsVariant false) never
    // enters here.
    if (world && world.reedsVariant) {
      const rw = world.reedsWater || { floor: REEDS_FLOOD_FLOOR };
      spd *= floodedWaterFactor(this.x, this.y, rw.floor, rw.factor);
      // G1: cache the variant pocket list for the cosmetic hop sign-flip in
      // draw() (which has no world param). Reeds run = its pockets; otherwise
      // null (a base swamp's hop uses the default REEDS_POCKETS = no-op).
      this._reedsPockets = world.reedsPockets || null;
    }
    if (this.rootT > 0) spd = 0;
    // Q5 (Astra): the painted crossing's CURRENT — a blue-painted mouth slows
    // movement while the frog is inside the crossing's effect zone (the pure
    // crossingSpeedFactor: 0.72 in the current, 1.0 otherwise — and this
    // line is a no-op unless the world's crossing is actually 'current').
    if (world && world.crossingState === 'current' && inCrossingZone(this.x, this.y)) {
      spd *= crossingSpeedFactor(world.crossingState);
    }
    const direction = this.hopT > 0.04 ? this.hopDir : mv;
    [this.vx, this.vy] = movementVelocity(this.vx, this.vy, direction[0] * spd, direction[1] * spd, dt, launched);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const [cx, cy] = world.collideCircle(this.x, this.y, this.r);
    this.x = cx; this.y = cy;

    // timers
    if (this.iframes > 0) this.iframes -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.swipeT > 0) this.swipeT -= dt;
    if (this.slowT > 0) this.slowT -= dt;
    if (this.rootT > 0) this.rootT -= dt;
    // J4 (v1.9): the hurt STAGGER (a wobble + flinch) decays — the frog's own
    // reaction to a hit, layered on top of the J1 hitstop (which freezes the
    // WORLD). Draw-only: it never feeds iframes / HP / movement.
    if (this._staggerT > 0) this._staggerT -= dt;
    // J4 (v1.9): the VICTORY pose — a contented hop that settles. Set by
    // game.js at the moment of victory; it counts down here so draw() can read
    // its phase (the hop then the squash-and-settle). Draw-only.
    if (this._victoryHopT > 0) this._victoryHopT -= dt;
    // squash relaxes toward 1
    this.squash = lerp(this.squash, 1, 1 - Math.exp(-10 * dt));
    this._blinkT -= dt;
    if (this._blinkT < -0.12) this._blinkT = 1.5 + Math.random() * 3;
    // J4 (v1.9): IDLE BREATHE — when the frog is standing still (not moving,
    // not hopping, not staggering, not posing), a slow, SUBTLE squash
    // oscillation so it reads as a LIVING frog rather than a static sprite.
    // The oscillation is tiny (±~0.02) and layered on top of the relaxed
    // squash (which is ~1 at rest); it is a draw-only visual and never moves a
    // physics number. A moving frog (|vx|/|vy| above a hair-threshold) or a
    // hopping / staggering / victory-posing frog gets no idle breathe, so the
    // other states read cleanly.
    if (this.alive && !moving && this.hopT <= 0 && this._staggerT <= 0 &&
        this._victoryHopT <= 0 && Math.abs(this.vx) < 6 && Math.abs(this.vy) < 6) {
      // a dt-accumulated phase (NOT wall-clock) so the breathe is smooth +
      // deterministic under the seeded test harness; the ±0.02 offset is draw-
      // only and never moves a physics / HP / i-frame number.
      this._breathePhase = ((this._breathePhase || 0) + dt * 2.4) % (TAU);
      this.squash += (1 - Math.cos(this._breathePhase)) * 0.012;   // a gentle rise + fall
    }

    // fresh-paint residual: standing in green paint heals slowly.
    const cell = world.pigmentAt(this.x, this.y);
    this._healAcc = Math.max(0, this._healAcc || 0);
    if (this.alive && this.hp < this.maxHp && cell.green > 0.4) {
      this._healAcc += dt * tuning.greenHeal;
      const whole = Math.floor(this._healAcc);
      if (whole > 0) { restoreHealth(this, whole); this._healAcc -= whole; }
    } else this._healAcc = Math.max(0, this._healAcc - dt * 2);
    if (!this.alive || this.hp >= this.maxHp) this._healAcc = 0;
    return this;
  }

  hurt(dmg, tuning, drain = false) {
    // R3 (v1.6): a leech DRAIN tick (drain=true) bypasses i-frames and does no
    // hit-flash/iframes — it is a continuous small HP loss while the leech
    // clings (like burn ticking), not a discrete contact hit. Default (drain
    // false) is the normal contact/strike path — byte-identical.
    if (!this.alive || (!drain && this.iframes > 0)) return false;
    this.hp -= Math.max(1, Math.round(dmg));
    if (drain) {
      if (this.hp <= 0) { this.hp = 0; this.alive = false; }
      return true;
    }
    this.iframes = tuning.iframes;
    this.hurtT = 0.35;
    this.squash = 0.7;
    // J4 (v1.9): the HURT STAGGER — a brief wobble + flinch, the frog's OWN
    // reaction to the hit. Layered ON TOP of the J1 hitstop (which freezes the
    // WORLD); it is a draw-state (set here, decayed in update, read in draw)
    // and NEVER changes the i-frame window / HP / movement above.
    this._staggerT = 0.4;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return true;
  }

  // ---------------------------- rendering
  draw(ctx, view, now) {
    // R2 (v1.6): the hop lift is now a PURE function of (hopT, x, y) — inside an
    // inverted-gravity pocket the sign flips (the hop becomes a downward "clump"
    // that rides the ceiling); the pure hopLift reverts to the normal upward
    // lift outside a pocket, so there is no stuck state on exit. Outside the
    // Reeds biome (no pockets at a given x,y) this is byte-identical to the
    // pre-R2 expression.
    // G1 (v1.8): a BLACK REEDS run flips the hop sign in its OWN (extra) pocket
    // list (cached on the player by update() as _reedsPockets = the world's
    // reedsPockets). A base swamp / cycle-0 Reeds run uses the DEFAULT
    // REEDS_POCKETS (byte-identical — the first 3 of REEDS_DARK_POCKETS are
    // identical, and a base swamp is never inside any pocket).
    const lift = hopLift(this.hopT, this.x, this.y, this._reedsPockets || REEDS_POCKETS);
    const blink = this._blinkT < 0 ? 0.15 : 1;
    const hurt = this.hurtT > 0 ? Math.sin(this.hurtT * 40) * 0.5 + 0.5 : 0;
    const bodyCol = hurt > 0.5 ? '#e08a76' : '#69a24e';

    // J4 (v1.9): the frog's OWN liveness — draw-only pose modifiers layered on
    // top of the base transform. NONE of these feed the physics (x/y/vx/vy/HP/
    // iframes); they are read straight from the (already-set) state timers +
    // the wall-clock `now`, so they are pure presentation and safe in the
    // seeded test harness (no Math.random here).
    let drawLift = lift;             // the hop lift to actually draw
    let drawSquash = this.squash;    // the squash to actually draw (x; y = 2 - x)
    let tremX = 0, tremY = 0, stagRot = 0, desperate = 0;

    //  — LOW-HP TREMBLE: below ~30% HP, a faint high-freq position jitter +
    //    more desperate eyes. Fades out above 30% (the desperation ramps up as
    //    HP approaches the 30% line). Deterministic (sin of `now`, no RNG).
    const hpFrac = this.maxHp > 0 ? this.hp / this.maxHp : 1;
    const low = clamp(1 - hpFrac / 0.30, 0, 1);      // 0 above 30%, 1 at 0 HP
    if (this.alive && low > 0) {
      const amp = low * 1.4;                          // faint (<= ~1.4px)
      tremX = Math.sin(now * 46 + 0.3) * amp;
      tremY = Math.cos(now * 51) * amp * 0.6;
      desperate = low;                                 // the eyes narrow
    }
    //  — HURT STAGGER: a brief wobble + flinch (the frog's own reaction,
    //    layered on top of the J1 hitstop). A fast, decaying rotation wobble
    //    + a flinch squash. `_staggerT` was set in hurt(), decayed in update.
    if (this.alive && this._staggerT > 0) {
      const k = this._staggerT / 0.4;                 // 1 at hit -> 0 as it fades
      stagRot = Math.sin((0.4 - this._staggerT) * 55) * 0.16 * k;   // the wobble
      drawSquash = drawSquash * (1 - k * 0.1) - k * 0.06;           // the flinch
    }
    //  — VICTORY POSE: a small contented hop + a squash-and-settle, set by
    //    game.js at the moment of victory (`_victoryHopT`). Read as a pure
    //    function of the remaining timer + `now`: the hop lifts first (the
    //    contented little hop, reusing the existing hopLift shape), then the
    //    body does a contented squash-and-settle as it lands.
    if (this.alive && this._victoryHopT > 0) {
      const t = this._victoryHopT;                    // 1.0 -> 0
      // the hop (the first ~40%): a small lift, reuse the existing hopLift shape
      drawLift = Math.max(drawLift, Math.max(0, t - 0.4) / 0.6 * 26);
      // the settle (the whole window, eased in): a contented squash (x>1) then
      // it relaxes back to the idle breathe — draw-only, no physics.
      const settle = 1 - Math.abs(t - 0.5) * 2;       // a 0..1 pulse, peaks at mid
      drawSquash = drawSquash + Math.max(0, settle) * 0.16;
    }

    ctx.save();
    ctx.translate(this.x + tremX, this.y - drawLift + tremY);

    // shadow (grows smaller when hopping)
    ctx.fillStyle = 'rgba(30,50,40,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, this.r * 0.75, this.r * (1 - drawLift * 0.015), this.r * 0.4 * (1 - drawLift * 0.02), 0, 0, TAU);
    ctx.fill();

    ctx.rotate((this.vx - this.vy) * 0.0006 + stagRot);
    ctx.scale(drawSquash, 2 - drawSquash);
    if (this.iframes > 0 && this.hopT <= 0 && Math.floor(now * 24) % 2 === 0) ctx.globalAlpha = 0.55;

    // legs
    ctx.fillStyle = bodyCol;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-this.r * 0.85, this.r * 0.45, 7, 5, -0.5, 0, TAU);
    ctx.ellipse(this.r * 0.85, this.r * 0.45, 7, 5, 0.5, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // body — wobbly watercolor blob
    const wob = wobble(7, Math.floor(now * 3), 1.5);
    ctx.fillStyle = bodyCol;
    traceBlob(ctx, 0, 0, this.r + wob, 7, 0.09, 12);
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = INK;
    traceBlob(ctx, 0, 0, this.r + wob, 7, 0.09, 12);
    ctx.stroke();
    // belly
    ctx.fillStyle = 'rgba(244,234,216,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, this.r * 0.35, this.r * 0.62, this.r * 0.4, 0, 0, TAU);
    ctx.fill();

    // eyes — expressive, look toward aim. J4 (v1.9): when the frog is at LOW
    // HP (the `desperate` draw-state, 0 above 30% HP), the eyes NARROW + a
    // worried brow rises — the same face, more anxious. Draw-only.
    const ex = Math.cos(this.aimA) * 2.5, ey = Math.sin(this.aimA) * 1.8;
    const eyeH = 6 * (1 - desperate * 0.45);   // the whites narrow as HP drops
    const pupilR = 2.6 * (1 - desperate * 0.25);  // the pupils shrink (worried)
    for (const side of [-1, 1]) {
      const bx = side * this.r * 0.45, by = -this.r * 0.55;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(bx, by, 6, eyeH * blink, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (blink > 0.5) {
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(bx + ex, by + ey, pupilR, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(bx + ex - 0.8, by + ey - 0.9, 0.9, 0, TAU);
        ctx.fill();
      }
      // the worried brow — a short raised ink line above the eye, drawn only
      // when desperate (it fades with `desperate`, so it's absent above 30% HP).
      if (desperate > 0.02) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6 * desperate;
        ctx.beginPath();
        ctx.moveTo(bx - side * 4, by - eyeH - 2 - desperate * 2);
        ctx.quadraticCurveTo(bx, by - eyeH - 5 - desperate * 3, bx + side * 4, by - eyeH - 1 - desperate * 1.5);
        ctx.stroke();
      }
    }
    // cheeks
    ctx.fillStyle = 'rgba(232,131,107,0.4)';
    ctx.beginPath();
    ctx.ellipse(-this.r * 0.62, -this.r * 0.12, 3.4, 2.2, 0, 0, TAU);
    ctx.ellipse(this.r * 0.62, -this.r * 0.12, 3.4, 2.2, 0, 0, TAU);
    ctx.fill();

    // beret — tilted, sits on head
    ctx.save();
    ctx.rotate(-0.18 + Math.sin(now * 2) * 0.02);
    ctx.fillStyle = '#8a3a4a';
    traceBlob(ctx, 2, -this.r * 0.95, 11, 31, 0.14, 10);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    traceBlob(ctx, 2, -this.r * 0.95, 11, 31, 0.14, 10);
    ctx.stroke();
    ctx.fillStyle = '#6e2c3a';
    ctx.beginPath();
    ctx.ellipse(2, -this.r * 0.8, 9, 3.4, -0.15, 0, TAU);
    ctx.fill();
    ctx.restore();

    // brush arm — oversized paintbrush toward aim, with swing animation
    const swing = this.swipeT > 0 ? Math.sin((1 - this.swipeT / 0.14) * Math.PI) * 0.9 : 0;
    ctx.save();
    ctx.rotate(this.aimA + swing * 0.4);
    const bx = this.r * 0.6;
    // arm
    ctx.strokeStyle = bodyCol;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx - 4, 2);
    ctx.lineTo(bx + 10, 4);
    ctx.stroke();
    // brush handle
    ctx.strokeStyle = '#8a5a33';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(bx + 8, 4);
    ctx.lineTo(bx + 34, 0);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(bx + 8, 2.6);
    ctx.lineTo(bx + 34, -1.4);
    ctx.stroke();
    // ferrule + bristles in current pigment color
    const pcol = PIGMENTS[this.pigment];
    ctx.fillStyle = '#c9c0b2';
    ctx.fillRect(bx + 32, -3.4, 6, 7);
    ctx.fillStyle = pcol.color;
    traceBlob(ctx, bx + 42, 0, 6.5, 91, 0.25, 8);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    traceBlob(ctx, bx + 42, 0, 6.5, 91, 0.25, 8);
    ctx.stroke();
    // bristle tip highlight
    ctx.fillStyle = pcol.light;
    ctx.beginPath();
    ctx.ellipse(bx + 45, -1.4, 3.4, 2, 0.4, 0, TAU);
    ctx.fill();
    ctx.restore();

    // ---- L2 (v1.9): the CHARGED-PAINT GLOW — a soft radial bloom on the brush
    // while the splash is charging (splashCharge > 0) and brighter as it nears
    // full charge. Pure DRAW: reads this.splashCharge (a rule field that already
    // exists for the splash mechanic) but writes NOTHING back — no new save
    // state, no tuning change, no physics / i-frame / HP number moves. The
    // radial is a single cached-free gradient drawn once per frame only while
    // charging (zero draws when splashCharge === 0), so it adds nothing to the
    // idle hot path.
    if (this.splashCharge > 0.02 && this.alive) {
      const chg = Math.min(1, this.splashCharge);          // 0..1
      const gx = bx + 45;                                  // the bristle tip
      const R = 26 + 34 * chg;                             // grows with charge
      const pulse = 0.85 + 0.15 * Math.sin(now * 7);       // a gentle breathing
      const g = ctx.createRadialGradient(gx, 0, 2, gx, 0, R);
      g.addColorStop(0, 'rgba(255,240,200,' + (0.34 * chg * pulse).toFixed(3) + ')');
      g.addColorStop(0.5, 'rgba(255,214,150,' + (0.16 * chg * pulse).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(gx, 0, R, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}
