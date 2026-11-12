// A small, replayable combat clearing. No save fields or persistent timers.
import { CLEARING, clearingAllowed, strokeTouches, PIGMENTS } from './logic.js';
import { spawnEnemy } from './enemies.js';
import { TAU } from './math.js';
import { centerText, uiFont, paperPanel, paperEnd, INK } from './ui.js';

export class OpeningEncounter {
  constructor(game) {
    this.game = game; this.allowed = clearingAllowed(game);
    this.phase = 'ready'; this.round = -1; this.queued = 0; this.members = [];
    this.elapsed = 0; this.completed = false; this.bellColor = 'blue'; this.bellCd = 0;
    this.result = null; this.colorsUsed = new Set(); this.dodges = 0; this._wasHopping = false;
    this._paintReleased = true;
  }
  get nearby() {
    const p = this.game.player;
    return this.allowed && p && Math.hypot(p.x - CLEARING.x, p.y - CLEARING.y) < CLEARING.range;
  }
  get active() { return this.phase === 'fight' || this.phase === 'between'; }
  get suppressesWaves() { return this.allowed && this.active; }
  onStroke(stroke) {
    // Paint statistics belong only to the active battle; bell strokes and
    // scenery painted before/after it cannot inflate the result.
    if (this.phase === 'fight' && this.game.player.alive && !this.game.dying &&
      ['red', 'blue', 'green'].includes(stroke?.pigment) &&
      this.members.some(e => ((!e.dead && e.hp > 0) || e.hitFlash > 0) &&
        strokeTouches(stroke, e.x, e.y, e.r))) this.colorsUsed.add(stroke.pigment);
    if (!this.allowed || this.game._tutorialActive() || !this.game.player.alive || this.game.dying ||
        this.phase === 'fight' || this.bellCd > 0 || !this._paintReleased ||
        !['swipe', 'splash'].includes(stroke.kind) || !strokeTouches(stroke, CLEARING.x, CLEARING.y, CLEARING.r)) return false;
    // A combat stroke must never activate a different activity underneath it.
    if (this.game.enemies.some(e => !e.dead && e.hp > 0 && !e._clearing && strokeTouches(stroke, e.x, e.y, e.r))) return false;
    this._paintReleased = false; this.bellCd = 0.8;
    this.bellColor = stroke.pigment === 'dry' ? 'blue' : stroke.pigment;
    if (this.phase === 'ready' || this.phase === 'complete') {
      this.round = -1; this.elapsed = 0;
      this.result = null; this.colorsUsed.clear(); this.dodges = 0;
      this._wasHopping = this.game.player.hopT > 0;
      // Give the authored fight room. Preserve existing actors and rewards;
      // move nearby ambient creatures outside the clearing rather than kill.
      for (const e of this.game.enemies) {
        if (e.dead || e._clearing || Math.hypot(e.x - CLEARING.x, e.y - CLEARING.y) >= CLEARING.leaveRange) continue;
        const angle = Math.atan2(e.y - CLEARING.y, e.x - CLEARING.x);
        [e.x, e.y] = this.game.world.collideCircle(CLEARING.x + Math.cos(angle) * (CLEARING.leaveRange + 80), CLEARING.y + Math.sin(angle) * (CLEARING.leaveRange + 80), e.r);
        e.vx = 0; e.vy = 0;
      }
    }
    this.round++; this.phase = 'fight'; this.queued = 0; this.members = [];
    this.game.sfx('pickup-streak'); this._fill();
    return true;
  }
  _fill() {
    const g = this.game, round = CLEARING.rounds[this.round];
    let live = this.members.filter(e => !e.dead && e.hp > 0).length;
    while (live < CLEARING.cap && this.queued < round.length) {
      const index = this.queued++, side = index % 2 ? -1 : 1;
      const x = CLEARING.x + side * 170, y = CLEARING.y + (index % 3 - 1) * 65;
      const kind = round[index], e = spawnEnemy(kind, x, y, g.tuning);
      [e.x, e.y] = g.world.collideCircle(e.x, e.y, e.r);
      e._clearing = true; e._noLoot = true;
      e.hp = e.maxHp = (kind === 'mosquito' ? CLEARING.mosquitoHp : CLEARING.beetleHp) * (g.tuning.enemyHp || 1);
      e.clearingPhase = 'recover'; e.clearingT = CLEARING.recover;
      if (kind === 'mosquito') { e.flight = 'recover'; e.flightT = CLEARING.recover; }
      this.members.push(e); g.enemies.push(e); live++;
    }
  }
  cancel() {
    const g = this.game;
    g.enemies = g.enemies.filter(e => !this.members.includes(e));
    this.members = []; this.phase = this.completed ? 'complete' : 'ready'; this.round = -1; this.queued = 0;
    this._wasHopping = false;
    this._paintReleased = false; this.bellCd = 0.8;
  }
  update(dt) {
    if (!this.allowed || this.game._tutorialActive()) return;
    const g = this.game, p = g.player;
    this.bellCd = Math.max(0, this.bellCd - dt);
    if (!g.input.mouse.lDown && !g.input.mouse.rDown) this._paintReleased = true;
    if (!p.alive || g.dying || (this.active && Math.hypot(p.x - CLEARING.x, p.y - CLEARING.y) > CLEARING.leaveRange)) {
      this.cancel(); return;
    }
    if (this.phase !== 'fight') return;
    const hopping = p.hopT > 0;
    if (hopping && !this._wasHopping) this.dodges++;
    this._wasHopping = hopping;
    this.elapsed += dt; this._fill();
    if (this.queued < CLEARING.rounds[this.round].length || this.members.some(e => !e.dead && e.hp > 0)) return;
    this._paintReleased = false; this.bellCd = 0.8;
    if (this.round === CLEARING.rounds.length - 1) {
      this.phase = 'complete';
      this.result = Object.freeze({ seconds: Math.round(this.elapsed), rounds: CLEARING.rounds.length,
        dodges: this.dodges, colors: this.colorsUsed.size });
      if (!this.completed) {
        this.completed = true; p.hp = p.maxHp;
        g._triggerBloom(CLEARING.x, CLEARING.y);
      }
      g.sfx('awaken-bloom');
    } else { this.phase = 'between'; g.sfx('pickup-streak'); }
  }
  drawWorld(ctx, view) {
    if (!this.allowed || this.game._tutorialActive()) return;
    if (CLEARING.x < view.x - 320 || CLEARING.x > view.x + view.w / view.scale + 320) return;
    ctx.save(); ctx.translate(CLEARING.x, CLEARING.y);
    // A bell on a wooden arch, a physical object rather than another reticle.
    ctx.strokeStyle = '#6e604b'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-34, 10); ctx.lineTo(-34, -78); ctx.lineTo(34, -78); ctx.lineTo(34, 10); ctx.stroke();
    ctx.strokeStyle = '#3b4a3d'; ctx.lineWidth = 2; ctx.fillStyle = PIGMENTS[this.bellColor].color;
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.quadraticCurveTo(-17, -35, 0, -36); ctx.quadraticCurveTo(17, -35, 20, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f8dd95'; ctx.beginPath(); ctx.arc(0, 3, 5, 0, TAU); ctx.fill();
    centerText(ctx, this.completed ? 'Clearing restored' : 'Lily Clearing', 0, -96, uiFont(18, { weight: 700 }), INK);
    if (this.phase !== 'fight') {
      centerText(ctx, this.phase === 'between' ? 'Paint the bell for the next round' : this.completed ? 'Paint the bell to play again' : 'Paint the bell · Short bug battle', 0, 37, uiFont(14), INK);
    }
    // Round petals make progress visible without introducing a currency.
    for (let i = 0; i < CLEARING.rounds.length; i++) {
      ctx.fillStyle = i < this.round || this.phase === 'complete' || (i === this.round && this.phase === 'between') ? '#75a15a' : '#e8dfc8';
      ctx.beginPath(); ctx.ellipse((i - 1) * 20, 62, 7, 5, -0.3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  drawHint(ctx) {
    const g = this.game;
    if (!this.nearby || g._tutorialActive() || g.help || g.paused || g._bookOpen || g._atlasOpen || !g.player.alive) return;
    if (this.phase === 'fight') {
      const left = CLEARING.rounds[this.round].length - this.members.filter(e => e.dead || e.hp <= 0).length;
      const width = Math.min(360, g.cw - 28), x = (g.cw - width) / 2, y = g.ch - 68;
      const c = paperPanel(ctx, x, y, width, 36, { seed: 94 });
      centerText(c, `Lily Clearing · ${this.round + 1}/3 · ${left} bugs left`, g.cw / 2, y + 23, uiFont(15), INK);
      paperEnd(c); return;
    }
    const w = Math.min(550, g.cw - 28), x = (g.cw - w) / 2, y = g.ch - 126;
    const c = paperPanel(ctx, x, y, w, 98, { seed: 94 });
    if (this.phase === 'complete' && this.result) {
      const r = this.result, time = `${Math.floor(r.seconds / 60)}:${String(r.seconds % 60).padStart(2, '0')}`;
      centerText(c, 'Lily Clearing restored · Nicely painted!', g.cw / 2, y + 24, uiFont(17, { weight: 700 }), '#345f40');
      centerText(c, `${r.rounds} rounds · ${time} battle time · ${r.dodges} dodges · ${r.colors}/3 colors`, g.cw / 2, y + 49, uiFont(14), INK);
      centerText(c, r.colors < 2 ? 'Try blue to stop a charge, then red. Paint the bell to replay.' :
        'Your color changes made room to paint. Follow the path or replay.', g.cw / 2, y + 76, uiFont(13), '#46604c');
      paperEnd(c); return;
    }
    centerText(c, this.phase === 'complete' ? 'Clearing restored · Paint the bell to play again' : this.phase === 'between' ? 'Round clear · Paint the bell to continue' : 'Paint the bell to try a short fight', g.cw / 2, y + 26, uiFont(17, { weight: 700 }), INK);
    centerText(c, 'Three rounds. Walk away anytime. No boss.', g.cw / 2, y + 52, uiFont(14), INK);
    centerText(c, 'Aim at the bell and left-click when you are ready.', g.cw / 2, y + 77, uiFont(13), '#46604c');
    paperEnd(c);
  }
}
