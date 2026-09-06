// enemies.js — the swamp's denizens: beetles, mosquitoes, grumpy toads.
// Status effects (burn/slow/root/dizzy/freeze) come from logic.js; painting
// them is handled by paint.js. Enemies here own movement + contact attacks.
'use strict';
import { TAU, clamp, dist, lerp } from './math.js';
import { ENEMIES, stepStatus, physicalDamage } from './logic.js';

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
    this.speed = base.speed;
    this.dmg = base.dmg;
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
  }

  // speed factor from active status
  statusSpeed() {
    if (!this.status) return 1;
    if (this.status.type === 'dizzy' || this.status.type === 'freeze' || this.status.type === 'root') return 0;
    if (this.status.type === 'slow') return 0.45;
    return 1;
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

    const stunned = this.status && (this.status.type === 'dizzy' || this.status.type === 'freeze' || this.status.type === 'root');
    const spd = this.speed * this.statusSpeed();

    // --- AI: seek the player, with a little wandering
    let ax = 0, ay = 0;
    if (!stunned && player.alive) {
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
    if (stunned) { this.vx = 0; this.vy = 0; }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const [cx, cy] = world.collideCircle(this.x, this.y, this.r);
    this.x = cx; this.y = cy;

    // --- contact attack
    if (!stunned && this.attackCd <= 0 && player.alive && player.iframes <= 0) {
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

  if (e.kind === 'beetle') drawBeetle(ctx, e, frozen, flash, now);
  else if (e.kind === 'mosquito') drawMosquito(ctx, e, frozen, flash, now);
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
  if (e.hp < e.maxHp) {
    const w = e.r * 2, frac = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(20,28,22,0.55)';
    ctx.fillRect(e.x - w / 2, y - e.r - 10, w, 3.5);
    ctx.fillStyle = frac > 0.4 ? '#8fd06a' : '#e08a4e';
    ctx.fillRect(e.x - w / 2, y - e.r - 10, w * frac, 3.5);
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