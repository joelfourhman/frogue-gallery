// enemies.js — the swamp's denizens: beetles, mosquitoes, grumpy toads.
// Status effects (burn/slow/root/dizzy/freeze) come from logic.js; painting
// them is handled by paint.js. Enemies here own movement + contact attacks.
'use strict';
import { TAU, clamp, dist, lerp } from './math.js';
import { ENEMIES, stepStatus, physicalDamage, lightFactor, REEDS_BESTIARY, wispBlinded, leechDrain } from './logic.js';

// ------------------------------------------------------------------ Enemy
export class Enemy {
  constructor(kind, x, y, tuning) {
    const base = ENEMIES[kind];
    this.kind = kind;
    this.name = base.name;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.hp = Math.round(base.hp * (tuning.enemyHp || 1));
    this.maxHp = this.hp;
    // N4 (v1.3 M14): expedition modifiers feed the EXISTING spawn path. An
    // NG+ cycle's chosen modifier may widen the enemy speed / contact-damage
    // multipliers (High Tide: +10% speed, Grey Morning: +20% contact). Both
    // default to 1 for any save without a modifier, so a first-time (cycle-0)
    // run — which never carries these fields — is byte-identical.
    this.speed = base.speed * (tuning.enemySpeedMult || 1);
    // K5 (v1.5 M2): Night Expedition — a mosquito-specific speed multiplier
    // (feeds the existing enemy-speed path). Defaults to 1 (or undefined), so
    // a first-time run (no modifier) is byte-identical.
    if (kind === 'mosquito' && tuning.mosquitoSpeedMult) this.speed *= tuning.mosquitoSpeedMult;
    this.dmg = base.dmg * (tuning.enemyDmg || 1) * (tuning.contactDmgMult || 1); // N2: NG+ contact-damage multiplier (1 on cycle 0); N4: modifier contact-damage on top
    this.r = base.radius;
    this.armor = base.armor;
    this.fly = !!base.fly;
    this.score = base.score;
    this.status = null;
    this.burnAccum = 0;
    this.tint = null; this.tintT = 0;
    this.attackCd = 0;      // contact-attack cooldown
    this.hitFlash = 0;
    this.dead = false;
    this._seed = Math.random() * TAU;
    this._wanderA = Math.random() * TAU;
    this._wanderT = 1 + Math.random() * 2;
    this._bob = Math.random() * TAU;
    this.dizzyPaintChance = base.dizzyPaintChance || 0;
    this.dizzyDuration = base.dizzyDuration || 0;
    this.paintTintDecay = base.paintTintDecay || 0.25;
    // K1 (v1.5 M1): Mud Turtle — the shell turns paint away from the FRONT.
    // `facing` (radians) tracks its travel direction; paint.js deflects hits
    // that land within `deflectArc` of `facing` to `deflectKeep` of normal.
    this.frontDeflect = !!base.frontDeflect;
    this.deflectArc = base.deflectArc || 1.5;
    this.deflectKeep = base.deflectKeep != null ? base.deflectKeep : 0.15;
    this.facing = 0;
    // K2 (v1.5 M2): Blind Crag Frog — hunts by sound. `asleep` starts true (it
    // lies in wait); a nearby noise event (paint/hop/charge) sets alertT and
    // wakes it; alertT decays each frame and it sleeps again when it lapses.
    // While asleep it cannot move or attack and takes +50% paint damage
    // (cragSleepBonus in paint.js). While awake it is fast (high base speed)
    // with high contact damage.
    this.noiseRadius = base.noiseRadius || 0;
    this.alertDuration = base.alertDuration || 0;
    this.alertT = 0;
    this.asleep = this.noiseRadius > 0;   // only cragfrogs sleep
    this.wakeNoise = function (x, y) {
      if (!this.noiseRadius) return;
      const d = Math.hypot(x - this.x, y - this.y);
      if (d <= this.noiseRadius) {
        this.alertT = this.alertDuration;
        if (this.asleep) this.asleep = false;
      }
    };
    // R3 (v1.6 Module R): the LIGHT-REWRITTEN BESTIARY. Only a Reeds-mode spawn
    // sets these; the cycle-0 swamp pool never does (each defaults to a no-op),
    // so a first-time run's enemies are byte-identical.
    //
    // (a) GLOW WISP: `wispBlindT` (seconds of useless spin left, >0 while
    // blind). A blue splash near the wisp (game.js) sets it to the documented
    // duration; the pure wispBlinded() gates its "useless" state. While LIT,
    // the wisp winds toward the lantern's light (the attractor is the frog,
    // who carries it); unlit it takes random drift. `_light` is the lightFactor
    // it receives (game.js refreshes it; draw alpha scales by it too).
    this.wisp = !!base.lightHoming;
    this.wispBlindT = 0;
    this._light = 0;
    // (b) MUD SERPENT: a fixed SURFACE POINT + the burrow/telegraph/surface
    // cycle. `phase` = 'burrowed' | 'telegraph' | 'surface' | 'recover'; `phaseT`
    // is the time left in the phase. While `burrowed`/`recover` it is
    // invisible + unhittable (paint.js + the game skip hits); while `telegraph`
    // a growing ripple ring marks the strike (the heron-telegraph draw
    // language); while `surface` it strikes the lane. `interrupted` latches a
    // painted-ring interrupt (the game clears it to set the re-cooldown).
    this.burrower = !!base.burrower;
    this.burrowX = x; this.burrowY = y;   // the fixed surface point (strikes the lane)
    this.phase = 'burrowed';
    this.phaseT = REEDS_BESTIARY.serpentBurrow * (0.5 + Math.random() * 0.5);
    this.striking = false;                // armed this telegraph? (one strike per cycle)
    this.interrupted = false;
    // (c) SILT LEECH: `clinging` (true while attached to the player), and the
    // shared re-attach cooldown is held by the GAME (one global ~6s window so a
    // second leech cannot latch while the first is peeling off).
    this.leech = !!base.leech;
    this.clinging = false;
  }

  // speed factor from active status
  statusSpeed() {
    if (!this.status) return 1;
    if (this.status.type === 'dizzy' || this.status.type === 'freeze' || this.status.type === 'root') return 0;
    if (this.status.type === 'slow') return 0.45;
    return 1;
  }

  // R3 (v1.6 Module R): the three Reeds archetypes' per-frame behavior. `stunned`
  // is the generic (freeze/root/dizzy) stun — it still pins the creature.
  //   wisp: blind spin > frozen/blank > lit homing (toward the lantern's light,
  //         attractor = the frog) > unlit random drift.
  //   serpent: the burrowed -> telegraph -> surface -> recover cycle, striking
  //         the lane only when surfaced; a painted-ring interrupt (the game sets
  //         interrupted) skips the surface + re-cooldowns.
  //   leech: cling + drain + slow while attached (the game peels it off on paint
  //         / hop); no contact attack of its own (it drains, not chomps).
  _updateBestiary(dt, player, tuning, world, now, stunned) {
    const R = REEDS_BESTIARY;
    // --- (a) GLOW WISP ---
    if (this.wisp) {
      if (this.wispBlindT > 0) this.wispBlindT = Math.max(0, this.wispBlindT - dt);
      const blind = wispBlinded(this.wispBlindT);
      // frozen (blue) pins it; otherwise it moves.
      let vx = 0, vy = 0;
      if (!blind && !stunned && player.alive) {
        if (this._light > 0.01) {
          // LIT: wind toward the lantern's light. The lantern is carried by the
          // frog, so the attractor is the frog's position (the light source).
          const d = dist(this.x, this.y, player.x, player.y);
          if (d > 1) {
            // a gentle WINDING approach (a slow spiral-in, not a straight lunge):
            // seek toward the frog + a perpendicular drift so it curls in.
            const [ux, uy] = [(player.x - this.x) / d, (player.y - this.y) / d];
            const seek = R.wispHoming;
            const wob = Math.sin(this._bob) * 0.55;
            vx = (ux * seek - uy * wob) * this.speed;
            vy = (uy * seek + ux * wob) * this.speed;
          }
        } else {
          // UNLIT: random drift (the lure is inert in the dark).
          this._wanderT -= dt;
          if (this._wanderT <= 0) { this._wanderA += (Math.random() - 0.5) * 2.6; this._wanderT = 1.2 + Math.random() * 2; }
          vx = Math.cos(this._wanderA) * R.wispDrift * this.speed;
          vy = Math.sin(this._wanderA) * R.wispDrift * this.speed;
        }
      }
      this._bob += dt * (blind ? 22 : 5);   // a fast dizzy spin while blind
      const k = 5;
      this.vx = lerp(this.vx, vx, 1 - Math.exp(-k * dt));
      this.vy = lerp(this.vy, vy, 1 - Math.exp(-k * dt));
      if (blind || stunned) { this.vx = 0; this.vy = 0; }
      this.x += this.vx * dt; this.y += this.vy * dt;
      const [cx, cy] = world.collideCircle(this.x, this.y, this.r);
      this.x = cx; this.y = cy;
      // contact (a gentle touch — a trap, not a brawler); never while blind/stunned
      if (!blind && !stunned && this.attackCd <= 0 && player.alive && player.iframes <= 0) {
        const d = dist(this.x, this.y, player.x, player.y);
        if (d < this.r + player.r + 2) {
          this.attackCd = 1.1;
          const dmg = physicalDamage(this.dmg, this, tuning, tuning.playerDmgReduce || 0) * (tuning.dmgTakenMult || 1);
          if (player.hurt(dmg, tuning)) this._lastHit = now;
        }
      }
      return;
    }
    // --- (b) MUD SERPENT ---
    if (this.burrower) {
      // The serpent lives at its fixed SURFACE POINT. It is invisible + unhittable
      // while burrowed/recovering (paint.js + the game skip hits in those phases).
      // A blue FROZE (stunned) pins it wherever it is (it cannot cycle).
      if (stunned) { this.vx = 0; this.vy = 0; return; }
      this.phaseT -= dt;
      if (this.phase === 'burrowed') {
        // underground (invisible). When the timer lapses, arm the telegraph.
        if (this.phaseT <= 0) { this.phase = 'telegraph'; this.phaseT = R.serpentTelegraph; this.striking = false; }
      } else if (this.phase === 'telegraph') {
        // a growing ripple ring at the surface point (~1.2s). If a painted ring
        // interrupts BEFORE the surface (the game sets `interrupted`), skip the
        // strike and re-cooldown.
        if (this.interrupted) { this.phase = 'recover'; this.phaseT = R.serpentReCooldown; this.striking = false; }
        else if (this.phaseT <= 0) { this.phase = 'surface'; this.phaseT = R.serpentSurface; this.striking = true; }
      } else if (this.phase === 'surface') {
        // surfaced: strike the lane. One strike per cycle (the frog's in the
        // strike radius on the surface frame).
        if (this.striking && player.alive && player.iframes <= 0) {
          const d = dist(this.burrowX, this.burrowY, player.x, player.y);
          if (d < R.serpentStrikeReach) {
            this.striking = false;
            const dmg = physicalDamage(this.dmg, this, tuning, tuning.playerDmgReduce || 0) * (tuning.dmgTakenMult || 1);
            if (player.hurt(dmg, tuning)) this._lastHit = now;
          }
        }
        if (this.phaseT <= 0) { this.phase = 'recover'; this.phaseT = R.serpentBurrow * 0.6; this.striking = false; }
      } else if (this.phase === 'recover') {
        // the knock-back / post-strike cooldown, then the next cycle.
        if (this.phaseT <= 0) { this.phase = 'burrowed'; this.phaseT = R.serpentBurrow * (0.5 + Math.random() * 0.5); }
      }
      // It stays planted at its surface point (no movement); keep a zero velocity.
      this.vx = 0; this.vy = 0;
      return;
    }
    // --- (c) SILT LEECH ---
    if (this.leech) {
      if (this.clinging) {
        // Attached: it rides the player, drains HP, and slows the player 25%
        // (the player reads leechAttached — game.js exposes `player.leechAttached`).
        this.x = player.x; this.y = player.y;
        if (player.alive && player.leechAttached) {
          const lost = leechDrain(dt, R.leechDrainDps);
          if (lost > 0) {
            // accumulate fractional HP into whole damage (mirrors burn's accum).
            this._drainAcc = (this._drainAcc || 0) + lost;
            if (this._drainAcc >= 1) {
              const whole = Math.floor(this._drainAcc);
              this._drainAcc -= whole;
              player.hurt(whole, tuning, true);   // `true` = the drain tick (no i-frame blink)
            }
          }
        }
        this.vx = 0; this.vy = 0;
        return;
      }
      // Detached: it LUNGES for the player (a fast creep that tries to attach).
      // While the game's re-attach window is open it creeps in but cannot latch
      // (game.js checks player.leechCd before arming the cling).
      if (stunned) { this.vx = 0; this.vy = 0; }
      else if (player.alive) {
        const d = dist(this.x, this.y, player.x, player.y);
        if (d > 1) {
          const want = d < 200 ? 1 : 0.5;
          this.vx = lerp(this.vx, (player.x - this.x) / d * want * this.speed, 1 - Math.exp(-8 * dt));
          this.vy = lerp(this.vy, (player.y - this.y) / d * want * this.speed, 1 - Math.exp(-8 * dt));
        } else { this.vx = 0; this.vy = 0; }
      }
      this.x += this.vx * dt; this.y += this.vy * dt;
      const [cx, cy] = world.collideCircle(this.x, this.y, this.r);
      this.x = cx; this.y = cy;
      // Contact: the game arms the cling (it checks the re-attach window + i-frames).
      // No direct damage here (the leech drains once attached, not on contact).
      return;
    }
  }


  update(dt, player, tuning, world, now) {
    if (this.dead) return;
    // status ticking (burn does damage)
    const ev = stepStatus(this, dt, tuning, now);
    this._burnTick = ev.tick; // consumed by game for fx
    if (ev.expired === 'burn' && !this.dead) this._burnedOut = true;
    if (this.hp <= 0) { this.dead = true; return; }
    if (this.tintT > 0) { this.tintT -= dt * this.paintTintDecay; if (this.tintT <= 0) this.tint = null; }
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.attackCd > 0) this.attackCd -= dt;

    // K2 (v1.5 M2): Blind Crag Frog sleep/awake. The alert timer decays; when
    // it lapses the frog loses interest and SLEEPS again (still => no home, no
    // attack). wakeNoise (called by game.js on a nearby paint/hop/charge)
    // wakes it and re-arms the timer.
    if (this.noiseRadius && this.asleep === false) {
      this.alertT -= dt;
      if (this.alertT <= 0) { this.asleep = true; this.alertT = 0; }
    }
    const asleep = this.asleep;

    const stunned = this.status && (this.status.type === 'dizzy' || this.status.type === 'freeze' || this.status.type === 'root');
    const spd = this.speed * this.statusSpeed();

    // R3 (v1.6 Module R): the light-rewritten bestiary (Reeds archetypes). Each
    // carries custom movement/behavior (wisp homing + blind spin, the serpent's
    // burrow/telegraph/surface cycle, the leech's cling + drain) — the generic
    // seek/move/contact path below is skipped for them. Only a Reeds-mode spawn
    // ever sets wisp/burrower/leech true, so a cycle-0 swamp enemy never reaches
    // this branch (its behavior is byte-identical).
    if (this.wisp || this.burrower || this.leech) {
      this._updateBestiary(dt, player, tuning, world, now, stunned);
      return;
    }

    // --- AI: seek the player, with a little wandering
    let ax = 0, ay = 0;
    if (!stunned && !asleep && player.alive) {
      const d = dist(this.x, this.y, player.x, player.y);
      const want = this.fly ? 40 : (d < 260 ? 1 : 0.55);
      if (d > 1) { ax = (player.x - this.x) / d * want; ay = (player.y - this.y) / d * want; }
    }
    // wander drift
    this._wanderT -= dt;
    if (this._wanderT <= 0) { this._wanderA += (Math.random() - 0.5) * 2.4; this._wanderT = 1.2 + Math.random() * 2; }
    ax += Math.cos(this._wanderA) * 0.35;
    ay += Math.sin(this._wanderA) * 0.35;

    // mosquitoes add a sine wobble perpendicular to travel
    if (this.fly && !stunned) {
      this._bob += dt * 9;
      const px = -ay, py = ax;
      const m = Math.hypot(px, py) || 1;
      const w = Math.sin(this._bob) * 0.6;
      ax += (px / m) * w; ay += (py / m) * w;
    }

    const k = this.fly ? 5 : 8;
    this.vx = lerp(this.vx, ax * spd, 1 - Math.exp(-k * dt));
    this.vy = lerp(this.vy, ay * spd, 1 - Math.exp(-k * dt));
    if (stunned || asleep) { this.vx = 0; this.vy = 0; }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const [cx, cy] = world.collideCircle(this.x, this.y, this.r);
    this.x = cx; this.y = cy;

    // K1 (v1.5 M1): the Mud Turtle's shell faces where it is MOVING. Track the
    // travel direction (draw-time-only — paint.js reads it for deflection). A
    // still shell keeps its last facing so the front arc is stable.
    if (this.frontDeflect && (this.vx !== 0 || this.vy !== 0)) {
      this.facing = Math.atan2(this.vy, this.vx);
    }

    // --- contact attack
    if (!stunned && !asleep && this.attackCd <= 0 && player.alive && player.iframes <= 0) {
      const d = dist(this.x, this.y, player.x, player.y);
      if (d < this.r + player.r + 2) {
        this.attackCd = 0.9;
        const dmg = physicalDamage(this.dmg, this, tuning, tuning.playerDmgReduce || 0) * (tuning.dmgTakenMult || 1);
        if (player.hurt(dmg, tuning)) this._lastHit = now;
      }
    }
  }
}

// ----------------------------------------------------------------- factory
export function spawnEnemy(kind, x, y, tuning) {
  return new Enemy(kind, x, y, tuning);
}

// ------------------------------------------------------------------- draw
export function drawEnemy(ctx, e, now) {
  const bobY = e.fly ? Math.sin(now * 3 + e._seed) * 5 : 0;
  const y = e.y - (e.fly ? 18 : 0) + bobY;
  const flash = e.hitFlash > 0 ? 1 : 0;
  const frozen = e.status && e.status.type === 'freeze';
  const dizzy = e.status && e.status.type === 'dizzy';

  ctx.save();
  ctx.translate(e.x, y);
  // shadow
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#1c2b22';
  ctx.beginPath();
  ctx.ellipse(0, e.y - y + e.r * 0.7, e.r * 0.85, e.r * 0.4, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;

  // M8 P12: elite signature guardians are drawn scaled up to match their
  // larger hitbox (the body sprites are a fixed pixel size, so scale them).
  const base = ENEMIES[e.kind] ? ENEMIES[e.kind].radius : e.r;
  const escale = e.elite ? e.r / base : 1;
  if (escale !== 1) ctx.scale(escale, escale);

  if (e.wisp || e.burrower || e.leech) drawBestiary(ctx, e, now); // R3 (v1.6): the Reeds light-bestiary
  else if (e.kind === 'beetle') drawBeetle(ctx, e, frozen, flash, now);
  else if (e.kind === 'mosquito') drawMosquito(ctx, e, frozen, flash, now);
  else if (e.kind === 'turtle') drawTurtle(ctx, e, frozen, flash, now);
  else if (e.kind === 'cragfrog') drawCragFrog(ctx, e, frozen, flash, now);
  else drawToad(ctx, e, frozen, dizzy, flash, now);
  ctx.scale(1 / escale, 1 / escale); // undo body scale for the auras below

  // M8 P12: zone-accent ring — a slow pulsing halo in the zone's color that
  // marks the signature guardian. Pulses with `now`; sits under the status
  // aura so a burning/frozen elite still shows its status ring on top.
  if (e.elite && e.accent) {
    const pulse = 0.55 + 0.45 * Math.sin(now * 3 + e._seed);
    ctx.save();
    ctx.globalAlpha = 0.28 + 0.22 * pulse;
    ctx.fillStyle = e.accent;
    ctx.beginPath();
    ctx.arc(0, 0, e.r + 9 + 2.5 * pulse, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = e.accent;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, e.r + 7, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  // status aura
  if (e.status) {
    const t = now * 6;
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = e.status.type === 'burn' ? '#ff7a3c'
      : e.status.type === 'slow' ? '#5fb7d4'
      : e.status.type === 'freeze' ? '#bfeaff'
      : e.status.type === 'root' ? '#79c46b'
      : '#ffd75e';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.lineDashOffset = -t;
    ctx.beginPath();
    ctx.arc(0, 0, e.r + 4, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  // dizzy stars
  if (dizzy) {
    for (let i = 0; i < 3; i++) {
      const a = now * 3 + i * TAU / 3;
      const sx = Math.cos(a) * 14, sy = -e.r - 10 + Math.sin(a * 1.3) * 3;
      ctx.fillStyle = '#ffd75e';
      ctx.beginPath();
      ctx.arc(sx, sy, 2.2, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();

  // hp bar (only when hurt)
  if (e.hp < e.maxHp && !e.burrower) {
    const w = e.r * 2, frac = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(20,28,22,0.55)';
    ctx.fillRect(e.x - w / 2, y - e.r - 10, w, 3.5);
    ctx.fillStyle = frac > 0.4 ? '#8fd06a' : '#e08a4e';
    ctx.fillRect(e.x - w / 2, y - e.r - 10, w * frac, 3.5);
  }
}

// R3 (v1.6 Module R): the light-rewritten bestiary's three archetypes. Drawn
// at the creature's own world position (the wisp hovers; the serpent is drawn
// AT its fixed surface point — it never physically leaves it). The wisp's body
// alpha scales by the lightFactor it receives (nearly invisible unlit). The
// serpent is INVISIBLE while burrowed/recovering; while telegraphing it draws
// the heron-telegraph language (a growing ripple ring); while surfaced it
// strikes the lane. The leech is a small clumped slug that rides the player
// while clinging. All draw-time-only — no allocations (a single shared
// radial-gradient-free body, capped arc counts for the ripples).
function drawBestiary(ctx, e, now) {
  if (e.wisp) drawWisp(ctx, e, now);
  else if (e.burrower) drawSerpent(ctx, e, now);
  else if (e.leech) drawLeech(ctx, e, now);
}

// (a) GLOW WISP — a soft drifting wisp of lantern-blue light. Body alpha
// scales by e._light (the lightFactor it receives): 0.06 unlit (nearly
// invisible), up to ~0.95 lit. While blinded it spins (rotating body) and dims.
function drawWisp(ctx, e, now) {
  const alpha = Math.max(0.06, Math.min(1, 0.15 + e._light * 0.8));
  const flash = e.hitFlash > 0;
  const blind = wispBlinded(e.wispBlindT);
  const spin = blind ? now * 14 : now * 1.5 + e._seed;
  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, e.r + 10);
  glow.addColorStop(0, flash ? 'rgba(255,255,255,0.95)' : 'rgba(190,225,255,0.9)');
  glow.addColorStop(0.5, flash ? 'rgba(255,255,255,0.5)' : 'rgba(120,190,240,0.45)');
  glow.addColorStop(1, 'rgba(90,150,220,0)');
  ctx.globalAlpha = alpha * (blind ? 0.6 : 1);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, e.r + 10, 0, TAU);
  ctx.fill();
  // the core
  ctx.globalAlpha = alpha;
  ctx.fillStyle = flash ? '#fff' : (blind ? '#9fb8d0' : '#dff0ff');
  ctx.save();
  ctx.rotate(spin);
  ctx.beginPath();
  ctx.ellipse(0, 0, e.r * 0.7, e.r * 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  // blind sparks (three orbiting motes while useless-spinning)
  if (blind) {
    ctx.fillStyle = '#bfe0ff';
    for (let i = 0; i < 3; i++) {
      const a = spin + i * TAU / 3;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (e.r + 4), Math.sin(a) * (e.r + 4), 1.8, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// (b) MUD SERPENT — drawn at its fixed surface point. Burrowed/recovering =
// invisible (a faint submerged swell while recovering). Telegraph = the
// heron-telegraph language: a growing ripple ring + a "!" mark. Surfaced = a
// dark-mud segmented head + neck rising to strike the lane.
function drawSerpent(ctx, e, now) {
  const phase = e.phase;
  if (phase === 'burrowed') return; // fully invisible + unhittable
  // recovering: a faint submerged swell at the surface point
  if (phase === 'recover') {
    const k = 1 - e.phaseT / REEDS_BESTIARY.serpentRecover;   // 0 -> 1 over the recover
    const rr = 20 - 12 * k;
    ctx.globalAlpha = 0.22 * k;
    ctx.strokeStyle = '#5a4a34';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(4, rr), 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  // telegraph: a GROWING ripple ring (the heron-telegraph draw language).
  // Reuse the pulse + exclamation, but a blue water ripple instead of yellow.
  if (phase === 'telegraph') {
    const prog = 1 - e.phaseT / REEDS_BESTIARY.serpentTelegraph;  // 0 -> 1
    const pulse = 0.75 + Math.sin(now * 9) * 0.25;
    ctx.globalAlpha = 0.5 + 0.4 * prog;
    ctx.strokeStyle = '#8fb0f0';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = -now * 40;
    ctx.beginPath();
    ctx.arc(0, 0, 18 + 34 * prog, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    // the swell (the serpent gathering under the surface)
    ctx.globalAlpha = 0.3 * (0.5 + 0.5 * prog);
    ctx.fillStyle = '#3a2e1e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 20 * (0.5 + 0.5 * prog), 12 * (0.5 + 0.5 * prog), 0, 0, TAU);
    ctx.fill();
    // exclamation (the "watch the lane" tell)
    ctx.globalAlpha = (0.6 + 0.4 * pulse) * (0.5 + 0.5 * prog);
    ctx.fillStyle = '#8fb0f0';
    ctx.font = '700 24px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, -18);
    ctx.globalAlpha = 1;
    return;
  }
  // surfaced: a dark-mud segmented head + neck rising to strike the lane
  if (phase === 'surface') {
    const flash = e.hitFlash > 0;
    const prog = 1 - e.phaseT / REEDS_BESTIARY.serpentSurface;    // 0 -> 1
    const rise = Math.sin(Math.min(1, prog * 1.4) * Math.PI) * 34;  // rise up, then ease back
    const neck = 40 + rise;
    const body = flash ? '#f2e9dc' : '#3a2e1e';
    const seg = flash ? '#fff' : '#4d3d28';
    // segmented neck (capped count)
    ctx.strokeStyle = body;
    ctx.lineCap = 'round';
    const segs = 5;
    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1);
      const yy = -t * neck;
      const rr = e.r * (0.55 + 0.45 * (1 - t));
      ctx.fillStyle = i % 2 ? seg : body;
      ctx.beginPath();
      ctx.arc(0, yy, rr, 0, TAU);
      ctx.fill();
    }
    // head (mouth open on strike)
    const hy = -neck - 6;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, hy, e.r * 0.72, 0, TAU);
    ctx.fill();
    // mouth (open on the strike, the last 40% of the surface window)
    const open = prog > 0.6;
    ctx.strokeStyle = open ? '#1a120b' : '#5a4a34';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (open) { ctx.arc(0, hy + 2, 6, 0.15 * Math.PI, 0.85 * Math.PI, false); }
    else { ctx.moveTo(-6, hy + 3); ctx.quadraticCurveTo(0, hy + 5, 6, hy + 3); }
    ctx.stroke();
    // eyes (glint)
    ctx.fillStyle = '#c9a24a';
    ctx.beginPath();
    ctx.arc(-3, hy - 2, 1.6, 0, TAU);
    ctx.arc(3, hy - 2, 1.6, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// (c) SILT LEECH — a small clumped slug. Clinging: it rides the player (the
// game moves it there), drawn dark with a faint wet sheen. Not clinging: it
// drifts toward the frog (drawn as a small crawling slug).
function drawLeech(ctx, e, now) {
  const flash = e.hitFlash > 0;
  const c = flash ? '#f2e9dc' : '#3c2f3f';
  const c2 = flash ? '#fff' : '#5a4860';
  const cling = e.clinging;
  const wob = cling ? 0 : Math.sin(now * 7 + e._seed) * 2;
  // body (a clumped slug, a few tapering segments — capped count)
  ctx.fillStyle = c;
  const segs = 4;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const rr = e.r * (0.6 + 0.4 * (1 - t));
    const yy = (cling ? 0 : i * 5 - 8) + wob;
    ctx.beginPath();
    ctx.ellipse(0, yy, rr, rr * 0.7, 0, 0, TAU);
    ctx.fill();
  }
  // a wet sheen
  ctx.globalAlpha = cling ? 0.5 : 0.3;
  ctx.fillStyle = c2;
  ctx.beginPath();
  ctx.ellipse(-e.r * 0.2, cling ? -3 : -10, e.r * 0.35, e.r * 0.2, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  // a little drain wisp while clinging (it is straining the frog)
  if (cling) {
    ctx.strokeStyle = 'rgba(150,110,200,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const a = now * 5;
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.cos(a) * 10, -14, Math.cos(a) * 6, -24);
    ctx.stroke();
  }
}

function drawBeetle(ctx, e, frozen, flash, now) {
  const c = flash ? '#f2e9dc' : frozen ? '#bfe3ef' : '#5a4636';
  const c2 = flash ? '#fff' : frozen ? '#dff2f8' : '#3c2e23';
  // legs
  ctx.strokeStyle = c2;
  ctx.lineWidth = 2.5;
  for (let i = -1; i <= 1; i++) {
    const wig = Math.sin(now * 8 + i) * 2;
    ctx.beginPath();
    ctx.moveTo(-8, i * 7);
    ctx.lineTo(-15, i * 10 + wig);
    ctx.moveTo(8, i * 7);
    ctx.lineTo(15, i * 10 - wig);
    ctx.stroke();
  }
  // body
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 11, 0, 0, TAU);
  ctx.fill();
  // shell seam
  ctx.strokeStyle = c2;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(0, 10);
  ctx.stroke();
  // head
  ctx.fillStyle = c2;
  ctx.beginPath();
  ctx.arc(12, 0, 5.5, 0, TAU);
  ctx.fill();
  // eyes
  ctx.fillStyle = '#f4efe6';
  ctx.beginPath();
  ctx.arc(14, -2.5, 1.6, 0, TAU);
  ctx.arc(14, 2.5, 1.6, 0, TAU);
  ctx.fill();
}

function drawMosquito(ctx, e, frozen, flash, now) {
  const wing = Math.sin(now * 40 + e._seed) * 0.9;
  const c = flash ? '#f2e9dc' : frozen ? '#bfe3ef' : '#4b5560';
  // wings
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#dfeef2';
  ctx.save();
  ctx.translate(-3, -6);
  ctx.rotate(-0.5 + wing * 0.5);
  ctx.beginPath();
  ctx.ellipse(-6, 0, 8, 3.2, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(-3, 6);
  ctx.rotate(0.5 - wing * 0.5);
  ctx.beginPath();
  ctx.ellipse(-6, 0, 8, 3.2, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
  // body
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 4, 0.3, 0, TAU);
  ctx.fill();
  // proboscis
  ctx.strokeStyle = c;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(7, -2);
  ctx.lineTo(14, -5);
  ctx.stroke();
  // eye
  ctx.fillStyle = '#ff8f6b';
  ctx.beginPath();
  ctx.arc(5.5, -2, 2, 0, TAU);
  ctx.fill();
}

// K1 (v1.5 M1): the Mud Turtle. It faces `e.facing` (its travel direction), so
// the whole body is rotated to it and its FRONT (the +x side after rotation)
// is the shell that deflects paint. A lighter FRONT WEDGE marks the deflecting
// arc the player must circle around (or burn through). Draw-time-only: it reads
// e.facing, never writes it.
function drawTurtle(ctx, e, frozen, flash, now) {
  const c = flash ? '#f2e9dc' : frozen ? '#bfe3ef' : '#6b5334';   // shell
  const c2 = flash ? '#fff' : frozen ? '#dff2f8' : '#4a3826';      // shell rim
  const c3 = flash ? '#fff' : frozen ? '#cdeef5' : '#8a6f45';      // plastron
  ctx.save();
  ctx.rotate(e.facing || 0);
  // legs (four little plods)
  ctx.strokeStyle = c2;
  ctx.lineWidth = 4;
  const plod = Math.sin((now * 6 + e._seed) ) * 1.5;
  for (const [lx, ly] of [[-9, -13], [10, -13], [-9, 13], [10, 13]]) {
    ctx.beginPath();
    ctx.moveTo(lx * 0.7, ly * 0.7);
    ctx.lineTo(lx, ly + (lx < 0 ? plod : -plod));
    ctx.stroke();
  }
  // shell (a big round dome)
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(-1, 0, 19, 16, 0, 0, TAU);
  ctx.fill();
  // FRONT wedge: the deflecting arc. A lighter fan sweeping the front sector
  // from -deflectArc to +deflectArc about the facing direction (after the
  // rotate above, the front is +x, i.e. angle 0). This is the visual cue that
  // "this side turns paint away".
  const arc = e.deflectArc || 1.5;
  ctx.fillStyle = c3;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 19, -arc, arc);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  // shell rim + front seam
  ctx.strokeStyle = c2;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-1, 0, 19, 16, 0, 0, TAU);
  ctx.stroke();
  // a subtle "hard" highlight line along the front rim
  ctx.strokeStyle = flash ? '#fff' : '#d9c49a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 17, -arc, arc);
  ctx.stroke();
  // head poking out the front
  ctx.fillStyle = c3;
  ctx.beginPath();
  ctx.arc(16, 0, 5.5, 0, TAU);
  ctx.fill();
  // eye (the one eye it has — blind-ish, unblinking)
  ctx.fillStyle = '#f4efe6';
  ctx.beginPath();
  ctx.arc(18, -2.5, 2.2, 0, TAU);
  ctx.arc(18, 2.5, 2.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2c241e';
  ctx.beginPath();
  ctx.arc(19, -2.5, 1, 0, TAU);
  ctx.arc(19, 2.5, 1, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// K2 (v1.5 M2): the Blind Crag Frog. It hunts by sound — it has a big ear/side
// of the head and a closed eye when ASLEEP (hunched, with a drifting "z" puff
// + a faint vulnerability glow), and an open wide eye + raised head when AWAKE
// (alert). Draw-time-only pose from e.asleep; no allocations.
function drawCragFrog(ctx, e, frozen, flash, now) {
  const asleep = e.asleep;
  const body = flash ? '#f2e9dc' : frozen ? '#bfe3ef' : (asleep ? '#4f6b43' : '#6f9a52');
  const belly = flash ? '#fff' : frozen ? '#dff2f8' : (asleep ? '#6f8a5c' : '#a9c98a');
  const bob = asleep ? Math.sin(now * 1.4 + e._seed) * 1.2   // slow breathing while asleep
    : Math.sin(now * 7 + e._seed) * 1.8;                    // restless tremor when awake
  ctx.save();
  // vulnerability glow while asleep (the +50% tell)
  if (asleep) {
    ctx.globalAlpha = 0.28 + 0.12 * Math.sin(now * 3);
    ctx.fillStyle = '#cfe8ff';
    ctx.beginPath();
    ctx.arc(0, 0, e.r + 7, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.translate(0, bob);
  // back legs (crouched)
  ctx.strokeStyle = body;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-11, 8); ctx.lineTo(-15, 14); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(11, 8); ctx.lineTo(15, 14); ctx.stroke();
  // body
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 13, 0, 0, TAU);
  ctx.fill();
  // belly
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(0, 3, 11, 8, 0, 0, TAU);
  ctx.fill();
  // big side ear (it "listens" for the player)
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(-6, -9, 7, 5, -0.5, 0, TAU);
  ctx.fill();
  // head
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(9, -5, 8, 0, TAU);
  ctx.fill();
  // eye: closed line when asleep, open wide when awake
  if (asleep) {
    ctx.strokeStyle = flash ? '#fff' : '#24301f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(9, -6); ctx.lineTo(15, -6);
    ctx.stroke();
  } else {
    ctx.fillStyle = flash ? '#fff' : '#f4efe6';
    ctx.beginPath();
    ctx.arc(12, -6, 3.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#241b16';
    ctx.beginPath();
    ctx.arc(13, -6, 1.5, 0, TAU);
    ctx.fill();
  }
  // a drifting "z" while asleep
  if (asleep) {
    ctx.fillStyle = '#dfeaf5';
    ctx.globalAlpha = 0.75;
    ctx.font = 'bold 9px serif';
    const zy = -16 - (Math.sin(now * 1.4 + e._seed) * 2);
    ctx.fillText('z', 2, zy);
    ctx.fillText('z', 8, zy - 6);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawToad(ctx, e, frozen, dizzy, flash, now) {
  const c = flash ? '#f2e9dc' : frozen ? '#bfe3ef' : (dizzy ? '#8fae74' : '#6f8f4a');
  const c2 = flash ? '#fff' : frozen ? '#dff2f8' : '#55703a';
  const sit = dizzy ? 0.85 : 1; // sits down when dizzy
  // body
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(0, 2 * (1 - sit), 17, 13 * sit, 0, 0, TAU);
  ctx.fill();
  // back bumps
  ctx.fillStyle = c2;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(-7, -2, 3, 0, TAU);
  ctx.arc(2, -5, 2.4, 0, TAU);
  ctx.arc(8, 0, 2.8, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  // grumpy eyes on top
  const ey = -9 * sit;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(-7, ey, 5, 0, TAU);
  ctx.arc(7, ey, 5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f4efe6';
  ctx.beginPath();
  ctx.arc(-6, ey - 1, 2.4, 0, TAU);
  ctx.arc(8, ey - 1, 2.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2c241e';
  ctx.beginPath();
  ctx.arc(-5.5, ey, 1.2, 0, TAU);
  ctx.arc(8.5, ey, 1.2, 0, TAU);
  ctx.fill();
  // grumpy brows
  ctx.strokeStyle = c2;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-11, ey - 5);
  ctx.lineTo(-3, ey - 2);
  ctx.moveTo(11, ey - 5);
  ctx.lineTo(3, ey - 2);
  ctx.stroke();
  // mouth
  ctx.beginPath();
  ctx.moveTo(-6, 4);
  ctx.quadraticCurveTo(0, dizzy ? 7 : 2, 6, 4);
  ctx.stroke();
}