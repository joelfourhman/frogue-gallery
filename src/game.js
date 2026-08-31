// game.js — Frogue Gallery orchestrator: main loop, camera, state machine,
// combat wiring, HUD, title / pause / end screens.
'use strict';
import { clamp, lerp, dist, approach, TAU, mulberry32, traceBlob } from './math.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Paint } from './paint.js';
import { spawnEnemy, drawEnemy } from './enemies.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { ParticleSystem } from './particles.js';
import { SaveSys } from './save.js';
import { PIGMENTS, PIGMENT_ORDER, makeTuning, bossStep, bankGain, freshSave, UPGRADES, PAINTINGS, canAfford, payCost, costArray } from './logic.js';
import { INK, PAPER, centerText, outlineText, paperPanel, paperEnd, uiButton, drawPips, sat, mixColor } from './ui.js';

const HERON_X = 2050, HERON_Y = 800;
const PLAYER_START_X = 260, PLAYER_START_Y = 750;
const ORB_COLORS = ['red', 'blue', 'green'];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cw = canvas.width;
    this.ch = canvas.height;

    // ---------- persistence + tuning ----------
    this.save = SaveSys.load() || freshSave();
    this.options = SaveSys.loadOptions();
    this.tuning = makeTuning(this.save.upgrades, this.save.loadout);

    // ---------- systems ----------
    this.input = new Input(canvas);
    this.audio = new AudioSys();
    this.audio.setVolume(this.options.volume);
    this.audio.setMuted(this.options.muted);
    this.sfx = (n, o) => { if (this.audio.ctx) this.audio.sfx(n, o); };
    this.particles = new ParticleSystem();

    // ---------- world (persists as the title backdrop, re-seeded per run) ----------
    this.world = new World(mulberry32((Date.now() % 100000) | 0), (Date.now() % 99991) | 0);

    // ---------- camera (world coords of screen center) ----------
    this.cam = { x: PLAYER_START_X, y: PLAYER_START_Y };
    this.zoom = 1;
    this.zoomTarget = 1;
    this.shake = 0;

    // ---------- state machine ----------
    this.state = 'title';       // 'title' | 'expedition' | 'end'
    this.paused = false;
    this.endKind = null;
    this.endT = 0;
    this.endGains = null;
    this.now = 0;
    this.last = 0;
    this.titleT = 0;

    // ---------- expedition ----------
    this.player = null;
    this.paint = null;
    this.enemies = [];
    this.orbs = [];
    this.heron = null;
    this.runT = 0;
    this.spawnT = 3;
    this.score = 0;
    this.stock = { red: 0, blue: 0, green: 0 };
    this.collected = { red: 0, blue: 0, green: 0 };
    this.dying = false;
    this.dieT = 0;
    this.banners = [];

    // one-time audio unlock on first gesture (browser autoplay rules)
    this._unlock = () => { this.audio.ensure(); };
    window.addEventListener('pointerdown', this._unlock);
    window.addEventListener('keydown', this._unlock);
    window.addEventListener('blur', () => {
      if (this.state === 'expedition' && !this.dying) this.paused = true;
    });
  }

  start() {
    this.last = performance.now();
    const frame = (t) => {
      this._raf = requestAnimationFrame(frame);
      this._frame(t);
    };
    this._raf = requestAnimationFrame(frame);
  }

  addBanner(text, dur = 2.8, y = 170) {
    this.banners.push({ text, t: dur, max: dur, y });
  }
  addShake(n) { this.shake = Math.max(this.shake, n); }

  // Camera -> view. view.x/y = world coords of the screen's top-left corner
  // (world.js draw methods self-transform around it).
  _view() {
    const scale = this.zoom;
    const vw = this.cw / scale, vh = this.ch / scale;
    let x = this.cam.x - vw / 2;
    let y = this.cam.y - vh / 2;
    if (vw >= this.world.w) x = (this.world.w - vw) / 2;
    if (vh >= this.world.h) y = (this.world.h - vh) / 2;
    x = clamp(x, 0, this.world.w - vw);
    y = clamp(y, 0, this.world.h - vh);
    if (this.shake > 0.15) {
      const s = this.shake * 0.16;
      x += (Math.random() - 0.5) * s;
      y += (Math.random() - 0.5) * s;
    }
    return { x, y, scale, w: this.cw, h: this.ch };
  }

  _frame(t) {
    const dt = clamp((t - this.last) / 1000, 0, 0.05);
    this.last = t;
    this.now = t / 1000;
    this.shake *= Math.exp(-5.5 * dt);
    this.zoom = approach(this.zoom, this.zoomTarget, 10, dt);

    // ambient systems always tick (title backdrop stays alive)
    this.world.update(dt);
    this.particles.update(dt);
    for (let i = this.banners.length - 1; i >= 0; i--) {
      const b = this.banners[i];
      b.t -= dt;
      if (b.t <= 0) this.banners.splice(i, 1);
    }

    if (this.state === 'title') {
      this.titleT += dt;
      this.cam.x = 1200 + Math.sin(this.titleT * 0.12) * 500;
      this.cam.y = 750 + Math.cos(this.titleT * 0.09) * 260;
      this._updateTitle(dt);
    } else if (this.state === 'expedition') {
      if (this.dying) {
        this.dieT += dt;
        this._stepHeronFlight(dt);
        if (this.dieT > 1.6) this._endRun('defeat');
      } else if (this.heron && this.heron.flying > 0) {
        // post-victory: the run is over — let the flight play out
        // (world/particles already ticked by the ambient block above)
        this._stepHeronFlight(dt);
      } else if (!this.paused) {
        this._updateExpedition(dt);
      } else if (!this.dying) {
        // M5: the pause menu owns input while paused — _updateExpedition is
        // skipped in that state, so its own pause block never ran.
        if (this.input.pressed('p')) {
          this.paused = false;
          this.sfx('ui');
        } else if (this.input.pressed('escape')) {
          this.sfx('ui-back');
          this._quitToTitle();
        } else {
          if (this.input.pressed('m')) this._muteToggle();
          if (this.input.mouse.lPressed) {
            // geometry must match _drawPause (M5)
            const cx = this.cw / 2, cy = this.ch / 2;
            const pw = 340, px = cx - pw / 2, py = cy - 130;
            if (this._mouseIn(px, py + 108, pw, 44)) { this.paused = false; this.sfx('ui'); }
            else if (this._mouseIn(px, py + 160, pw, 44)) { this.sfx('ui-back'); this._quitToTitle(); }
          }
        }
      }
    } else if (this.state === 'end') {
      this.endT += dt;
      this._stepHeronFlight(dt);
      // buttons: "Rest at the Atelier" (primary) + "Return to the Pond" link
      // (see _drawEnd layout)
      if (this.endT > 0.6 && this.input.mouse.lPressed) {
        const cx = this.cw / 2, py = this.ch / 2 - 430 / 2, ph = 430;
        const bw = 300, bh = 54, bx = cx - bw / 2, by = py + ph + 16;
        if (this._mouseIn(bx, by, bw, bh)) { this.sfx('ui'); this._beginAtelier(); }
        else if (this._mouseIn(cx - 105, by + bh + 16, 210, 34)) { this.sfx('ui-back'); this._quitToTitle(); }
      }
      if (this.endT > 0.6) {
        if (this.input.pressed('enter') || this.input.pressed(' ')) { this.sfx('ui'); this._beginAtelier(); }
        if (this.input.pressed('escape') || this.input.pressed('backspace')) { this.sfx('ui-back'); this._quitToTitle(); }
        if (this.input.pressed('m')) this._muteToggle();
      }
    } else if (this.state === 'atelier') {
      this.atelierT += dt;
      this._updateAtelier(dt);
    }

    this._drawAll();
    this.input.endFrame();
  }

  _stepHeronFlight(dt) {
    const h = this.heron;
    if (!h || !h.flying) return;
    h.flying += dt;
    h.x += 70 * dt;
    h.y -= 230 * dt;
    this.world.restoreColor(dt * 0.22);
    if (Math.random() < 0.6) {
      const c = ORB_COLORS[(Math.random() * 3) | 0];
      this.particles.sparkles(h.x - 30, h.y - 60, PIGMENTS[c].color, 3);
    }
    if (h.flying > 3) this._endRun('victory');
  }

  _updateCamera(dt) {
    const p = this.player;
    if (!p) return;
    let tx = p.x, ty = p.y;
    if (this.heron && this.heron.flying > 0) { tx = this.heron.x; ty = this.heron.y; }
    this.cam.x = approach(this.cam.x, tx, 6, dt);
    this.cam.y = approach(this.cam.y, ty, 6, dt);
  }

  _quitToTitle() {
    this.state = 'title';
    this.paused = false;
    this.player = null;
    this.heron = null;
    this.enemies = [];
    this.orbs = [];
    this.sfx('ui-back');
  }

// ================= part 3: the atelier ===============================
  // Between-run sanctuary: spend bank pigments on upgrades + paintings,
  // choose the 2-painting loadout, and watch the swamp breathe below.
  _beginAtelier() {
    this.state = 'atelier';
    this.atelierT = 0;
    this.atelierTab = 0;            // 0 upgrades, 1 paintings
    this.paused = false;
  }

  // ---- layout: single source of truth for BOTH draw and click handling ----
  _atelierGeom() {
    const cx = this.cw / 2, ch = this.ch;
    const listX = cx - 560, listW = 1120;
    return {
      cx, ch, listX, listW,
      tabY: 148, tabW: 220, tabH: 44,
      rowY0: 204, rowH: 104, rowGap: 12,
      cardW: (listW - 24) / 2, cardH: 112, cardGap: 12, cols: 2,
      depart: { x: cx - 150, y: ch - 92, w: 300, h: 54 },
      leave: { x: cx - 370, y: ch - 82, w: 200, h: 34 },
    };
  }

  _atelierRows() {
    // [{x, y, w, h, enabled?, act()}] — the full click map for this frame.
    const g = this._atelierGeom();
    const rows = [
          { tag: 'tab0', x: g.cx - g.tabW - 10, y: g.tabY, w: g.tabW, h: g.tabH, act: () => { if (this.atelierTab !== 0) this.sfx('ui'); this.atelierTab = 0; } },
          { tag: 'tab1', x: g.cx + 10, y: g.tabY, w: g.tabW, h: g.tabH, act: () => { if (this.atelierTab !== 1) this.sfx('ui'); this.atelierTab = 1; } },
        ];
    if (this.atelierTab === 0) {
      Object.keys(UPGRADES).forEach((id, i) => {
        const u = UPGRADES[id];
        const lv = this.save.upgrades[id] || 0;
        const maxed = lv >= u.levels.length;
        const y = g.rowY0 + i * (g.rowH + g.rowGap);
        rows.push({ tag: 'buy:' + id, x: g.listX + g.listW - 250, y: y + 21, w: 220, h: 62, enabled: !maxed && canAfford(this.save.bank, Array.isArray(u.levels[lv].cost) ? u.levels[lv].cost : costArray(u.levels[lv].cost)), act: () => this._buyUpgrade(id) });
      });
    } else {
      PAINTINGS.forEach((pt, i) => {
        if (this._ptLocked(pt)) return; // sealed: nothing to click
        const col = i % g.cols, row = (i / g.cols) | 0;
        const x = g.listX + col * (g.cardW + 24);
        const y = g.rowY0 + row * (g.cardH + g.cardGap);
        const owned = this.save.owned.includes(pt.id);
        const inLoadout = this.save.loadout.includes(pt.id);
        const bw = 160, bh = 44, bx = x + g.cardW - bw - 16, by = y + 34;
        if (owned) rows.push({ tag: 'paint:' + pt.id, x: bx, y: by, w: bw, h: bh, enabled: inLoadout || this.save.loadout.length < 2, act: () => this._toggleLoadout(pt.id) });
                else rows.push({ tag: 'paint:' + pt.id, x: bx, y: by, w: bw, h: bh, enabled: canAfford(this.save.bank, Array.isArray(pt.cost) ? pt.cost : costArray(pt.cost)), act: () => this._buyPainting(pt.id) });
      });
    }
    rows.push({ tag: 'depart', x: g.depart.x, y: g.depart.y, w: g.depart.w, h: g.depart.h, act: () => { this.sfx('ui'); this._beginExpedition(); } });
        rows.push({ tag: 'leave', x: g.leave.x, y: g.leave.y, w: g.leave.w, h: g.leave.h, act: () => { this.sfx('ui-back'); this._quitToTitle(); } });
    return rows;
  }

  _updateAtelier(dt) {
    if (this.input.pressed('escape') || this.input.pressed('backspace')) { this.sfx('ui-back'); this._quitToTitle(); return; }
    if (this.input.pressed('enter') || this.input.pressed(' ')) { this.sfx('ui'); this._beginExpedition(); return; }
    if (this.input.pressed('1')) { if (this.atelierTab !== 0) this.sfx('ui'); this.atelierTab = 0; }
    if (this.input.pressed('2')) { if (this.atelierTab !== 1) this.sfx('ui'); this.atelierTab = 1; }
    if (this.atelierTab === 0) {
      if (this.input.pressed('a')) this._buyUpgrade('capacity');
      if (this.input.pressed('s')) this._buyUpgrade('power');
      if (this.input.pressed('d')) this._buyUpgrade('vitality');
    }
    if (this.input.mouse.lPressed) {
      const m = this.input.mouse;
      for (const r of this._atelierRows()) {
        if (m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) {
          if (r.enabled === false) { this.sfx('hurt'); continue; }
          r.act();
          break;
        }
      }
    }
  }

  _buyUpgrade(id) {
    const u = UPGRADES[id];
    const lv = this.save.upgrades[id] || 0;
    if (lv >= u.levels.length) return;
    const cost = u.levels[lv].cost;
    const cc = Array.isArray(cost) ? cost : costArray(cost);
    if (!canAfford(this.save.bank, cc)) { this.sfx('hurt'); return; }
    this.save.bank = payCost(this.save.bank, cc);
    this.save.upgrades[id] = lv + 1;
    this.sfx('paint-create');
    SaveSys.save(this.save);
  }

  _ptLocked(pt) {
    // Sir Croaksworth's portrait stays sealed until the first heron is painted
    return !!(pt.locked && !this.save.flags.heronDefeated && !this.save.owned.includes(pt.id));
  }

  _buyPainting(id) {
    const pt = PAINTINGS.find(p => p.id === id);
    if (!pt || this._ptLocked(pt) || this.save.owned.includes(id)) return;
    const cc = Array.isArray(pt.cost) ? pt.cost : costArray(pt.cost);
    if (!canAfford(this.save.bank, cc)) { this.sfx('hurt'); return; }
    this.save.bank = payCost(this.save.bank, cc);
    this.save.owned.push(id);
    if (this.save.loadout.length < 2) this.save.loadout.push(id); // new art hangs right away
    this.sfx('paint-create');
    if (id === 'croaksworth' && !this.save.flags.croaksworthGiven) {
      this.save.flags.croaksworthGiven = true;
      this.sfx('awaken');
      this.addBanner('Sir Croaksworth smiles. "Well done, little one. The world thanks you."', 5.2, this.ch * 0.34);
      this.addBanner('He tucks a silver coin into your pocket. (+5 of every pigment)', 5.2, this.ch * 0.34 + 34);
      for (const k of ['red', 'blue', 'green']) this.save.bank[k] += 5;
    }
    SaveSys.save(this.save);
  }

  _toggleLoadout(id) {
    const i = this.save.loadout.indexOf(id);
    if (i >= 0) { this.save.loadout.splice(i, 1); this.sfx('ui-back'); }
    else {
      if (this.save.loadout.length >= 2) return;
      this.save.loadout.push(id);
      this.sfx('ui');
    }
    SaveSys.save(this.save);
  }

  _leftText(ctx, text, x, y, font, color = INK, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  _costChips(ctx, costObj, x, y) {
    // little pigment chips + amounts, left-anchored at (x, y)
        let cx0 = x;
        for (const piece of costArray(costObj)) {
          const pig = PIGMENTS[piece.color];
          ctx.beginPath();
          ctx.arc(cx0, y, 9, 0, TAU);
          ctx.fillStyle = pig.color;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = INK;
          ctx.stroke();
          centerText(ctx, String(piece.amount), cx0 + 19, y, '700 15px Georgia, serif', INK, 1);
          cx0 += 44;
        }
        return cx0;
  }

_drawAtelier(ctx) {
    const g = this._atelierGeom();
    // backdrop: dim drift over the living swamp (world keeps ticking below)
    ctx.save();
    ctx.fillStyle = 'rgba(30,25,22,0.52)';
    ctx.fillRect(0, 0, this.cw, this.ch);
    ctx.restore();

    const cx = g.cx;
    outlineText(ctx, 'The Atelier', cx, 40, '700 40px Georgia, serif', '#f4ead8', INK, 6);
    centerText(ctx, 'a quiet studio above the water — spend your pigments well', cx, 78, 'italic 15px Georgia, serif', '#fdf6e9', 0.85);

    // bank strip with loadout preview
    const stripW = 640, stripH = 40, sx = cx - stripW / 2, sy = 96;
    ctx.save();
    ctx.fillStyle = 'rgba(244,234,216,0.92)';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(sx, sy, stripW, stripH, 20);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    const b = this.save.bank;
    centerText(ctx, 'Bank', sx + 44, sy + stripH / 2, '700 15px Georgia, serif', INK, 0.9);
    PIGMENT_ORDER.filter(c => c !== 'dry').forEach((color, i) => {
      const pig = PIGMENTS[color];
      const px = sx + 110 + i * 90;
      ctx.beginPath();
      ctx.arc(px, sy + stripH / 2, 9, 0, TAU);
      ctx.fillStyle = pig.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      centerText(ctx, String(b[color]), px + 20, sy + stripH / 2, '700 16px Georgia, serif', INK, 1);
    });
    centerText(ctx, `loadout ${this.save.loadout.length}/2`, sx + stripW - 210, sy + stripH / 2, '700 13px Georgia, serif', INK, 0.7);
    for (let s = 0; s < 2; s++) {
      const id = this.save.loadout[s];
      const fx = sx + stripW - 96 + s * 32, fy = sy + 7, fs = 26;
      ctx.save();
      ctx.fillStyle = '#e9dcc3';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(fx, fy, fs, fs, 4);
      ctx.fill(); ctx.stroke();
      ctx.restore();
      const pt = id ? PAINTINGS.find(p => p.id === id) : null;
      if (pt) this._drawPaintingMotif(ctx, pt, fx + 3, fy + 3, fs - 6);
      else centerText(ctx, '·', fx + fs / 2, fy + fs / 2 + 1, '700 14px Georgia, serif', INK, 0.35);
    }

    // tabs
    [['Studio Upgrades', 0], ['Paintings', 1]].forEach(([label, idx]) => {
      const active = this.atelierTab === idx;
      const bx = idx === 0 ? cx - g.tabW - 10 : cx + 10;
      uiButton(ctx, bx, g.tabY, g.tabW, g.tabH, label, this._mouseIn(bx, g.tabY, g.tabW, g.tabH) && !active, active, { seed: 30 + idx, size: 17 });
    });

    // list
    if (this.atelierTab === 0) {
      Object.keys(UPGRADES).forEach((id, i) => {
        const u = UPGRADES[id];
        const lv = this.save.upgrades[id] || 0;
        const maxed = lv >= u.levels.length;
        const buyable = !maxed && canAfford(this.save.bank, Array.isArray(u.levels[lv].cost) ? u.levels[lv].cost : costArray(u.levels[lv].cost));
        const y = g.rowY0 + i * (g.rowH + g.rowGap);
        const c = paperPanel(ctx, g.listX, y, g.listW, g.rowH, { seed: 40 + i });
        this._leftText(c, u.name, g.listX + 36, y + 30, '700 20px Georgia, serif', INK, 1);
        this._leftText(c, u.desc, g.listX + 36, y + 58, '14px Georgia, serif', INK, 0.75);
        drawPips(c, g.listX + 44, y + 84, 6, u.levels.length, lv, PIGMENTS.green.color);
        this._leftText(c, `level ${lv}/${u.levels.length}`, g.listX + 130, y + 84, '13px Georgia, serif', INK, 0.6);
        if (maxed) {
          this._leftText(c, 'fully learned — the frog hums with it', g.listX + 400, y + 30, 'italic 13px Georgia, serif', INK, 0.5);
        } else {
          const tNow = makeTuning(this.save.upgrades, this.save.loadout);
          const tNext = makeTuning({ ...this.save.upgrades, [id]: lv + 1 }, this.save.loadout);
          const diffs = [];
          if (tNext.maxHp !== tNow.maxHp) diffs.push(`health ${tNow.maxHp} → ${tNext.maxHp}`);
          if (Math.abs(tNext.power - tNow.power) > 1e-9) diffs.push(`power ${tNow.power.toFixed(2)} → ${tNext.power.toFixed(2)}`);
          if (tNext.capacity !== tNow.capacity) diffs.push(`capacity ${tNow.capacity} → ${tNext.capacity}`);
          if (diffs.length) this._leftText(c, diffs.join('   ·   '), g.listX + 400, y + 30, '700 14px Georgia, serif', '#4c8a34', 0.95);
          this._costChips(c, u.levels[lv].cost, g.listX + 400, y + 84);
        }
        const bw = 220, bh = 62, bx = g.listX + g.listW - 250, by = y + 21;
        uiButton(c, bx, by, bw, bh, maxed ? 'MAX' : buyable ? 'Learn' : 'Cannot afford', this._mouseIn(bx, by, bw, bh), false, { seed: 60 + i, size: 16 });
        paperEnd(ctx);
      });
    } else {
      PAINTINGS.forEach((pt, i) => {
        const col = i % g.cols, row = (i / g.cols) | 0;
        const x = g.listX + col * (g.cardW + 24);
        const y = g.rowY0 + row * (g.cardH + g.cardGap);
        const owned = this.save.owned.includes(pt.id);
        const inLoadout = this.save.loadout.includes(pt.id);
        const costC = Array.isArray(pt.cost) ? pt.cost : costArray(pt.cost);
        const buyable = !owned && canAfford(this.save.bank, costC);
        const c = paperPanel(ctx, x, y, g.cardW, g.cardH, { seed: 70 + i, fill: inLoadout ? '#f7f1e2' : PAPER });
        // art tile
        const artS = 72, artX = x + 16, artY = y + 20;
        c.fillStyle = pt.art.bg;
        c.beginPath(); c.roundRect(artX, artY, artS, artS, 8); c.fill();
        c.lineWidth = 2.5;
        c.strokeStyle = INK;
        c.stroke();
        this._drawPaintingMotif(c, pt, artX, artY, artS);
        // text
        const tx = artX + artS + 16;
        const sealed = this._ptLocked(pt);
        this._leftText(c, sealed ? '???' : pt.name, tx, y + 32, '700 16px Georgia, serif', INK, 1);
        c.save();
        c.globalAlpha = sealed ? 0.5 : 0.78;
        c.fillStyle = INK;
        c.font = '12px Georgia, serif';
        c.textBaseline = 'middle';
        c.fillText(sealed ? 'a portrait someone must earn' : pt.desc, tx, y + 58, 256);
        c.restore();
        if (!sealed) this._costChips(c, pt.cost, tx, y + 88);
        // action button
        const bw = 160, bh = 44, bx = x + g.cardW - bw - 16, by = y + 34;
        let label = buyable ? 'Learn' : 'Cannot afford', enabled = buyable;
        if (owned) { label = inLoadout ? 'Unhang' : 'Hang'; enabled = inLoadout || this.save.loadout.length < 2; }
        if (sealed) { label = 'Sealed'; enabled = false; }
        uiButton(c, bx, by, bw, bh, label, this._mouseIn(bx, by, bw, bh), false, { seed: 90 + i, size: 14 });
        if (inLoadout) centerText(c, '★', x + g.cardW - 26, y + 22, '700 16px Georgia, serif', '#c9922a', 1);
        paperEnd(ctx);
      });
    }

    // footer
    const d = g.depart;
    uiButton(ctx, d.x, d.y, d.w, d.h, 'Begin Expedition', this._mouseIn(d.x, d.y, d.w, d.h), false, { seed: 80, size: 18 });
    const l = g.leave;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#fdf6e9';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(l.x, l.y, l.w, l.h, 17);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    centerText(ctx, '← back to the pond', l.x + l.w / 2, l.y + l.h / 2 + 1, '14px Georgia, serif', '#fdf6e9', 0.9);
    centerText(ctx, 'Enter — depart the studio   ·   Esc — return to the pond', cx, d.y + d.h + 16, 'italic 11px Georgia, serif', '#fdf6e9', 0.55);
  }

  // tiny generative art per painting (keeps it light, no assets)
  _drawPaintingMotif(c, pt, x, y, s) {
    c.save();
    c.beginPath();
    c.rect(x, y, s, s);
    c.clip();
    const a = pt.art.accent;
    c.strokeStyle = a;
    c.fillStyle = a;
    c.lineWidth = Math.max(2, s * 0.05);
    const kind = pt.art.shape;
    if (kind === 'pond') {
      c.beginPath(); c.arc(x + s * 0.5, y + s * 0.45, s * 0.22, 0, TAU); c.fill();
      c.beginPath(); c.arc(x + s * 0.3, y + s * 0.7, s * 0.1, 0, TAU); c.stroke();
      c.beginPath(); c.arc(x + s * 0.72, y + s * 0.66, s * 0.14, 0, TAU); c.stroke();
    } else if (kind === 'salamander') {
      c.beginPath(); c.moveTo(x + s * 0.2, y + s * 0.6);
      c.bezierCurveTo(x + s * 0.4, y + s * 0.2, x + s * 0.6, y + s * 0.8, x + s * 0.8, y + s * 0.4);
      c.stroke();
      c.beginPath(); c.arc(x + s * 0.8, y + s * 0.35, s * 0.09, 0, TAU); c.fill();
    } else if (kind === 'garden') {
      for (let i = 0; i < 3; i++) {
        const fx = x + s * (0.25 + i * 0.25);
        c.beginPath(); c.moveTo(fx, y + s * 0.75); c.lineTo(fx, y + s * 0.4); c.stroke();
        c.beginPath(); c.arc(fx, y + s * 0.34, s * 0.11, 0, TAU); c.fill();
      }
    } else if (kind === 'portrait') {
      c.beginPath(); c.arc(x + s * 0.5, y + s * 0.38, s * 0.2, 0, TAU); c.stroke();
      c.beginPath(); c.arc(x + s * 0.5, y + s * 0.72, s * 0.28, Math.PI, TAU); c.stroke();
    } else if (kind === 'king') {
      c.beginPath();
      c.moveTo(x + s * 0.25, y + s * 0.45); c.lineTo(x + s * 0.38, y + s * 0.28);
      c.lineTo(x + s * 0.5, y + s * 0.45); c.lineTo(x + s * 0.62, y + s * 0.28);
      c.lineTo(x + s * 0.75, y + s * 0.45); c.closePath(); c.fill();
      c.beginPath(); c.arc(x + s * 0.5, y + s * 0.66, s * 0.2, 0, TAU); c.stroke();
    } else if (kind === 'storm') {
      c.beginPath(); c.arc(x + s * 0.4, y + s * 0.4, s * 0.22, 0, TAU); c.stroke();
      c.beginPath(); c.arc(x + s * 0.62, y + s * 0.5, s * 0.18, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(x + s * 0.55, y + s * 0.55); c.lineTo(x + s * 0.45, y + s * 0.78); c.lineTo(x + s * 0.6, y + s * 0.72); c.lineTo(x + s * 0.52, y + s * 0.95); c.stroke();
    } else if (kind === 'armor') {
      c.beginPath();
      c.moveTo(x + s * 0.5, y + s * 0.15);
      c.lineTo(x + s * 0.78, y + s * 0.3); c.lineTo(x + s * 0.7, y + s * 0.8);
      c.lineTo(x + s * 0.3, y + s * 0.8); c.lineTo(x + s * 0.22, y + s * 0.3);
      c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(x + s * 0.5, y + s * 0.15); c.lineTo(x + s * 0.5, y + s * 0.8); c.stroke();
    } else if (kind === 'knight') {
      c.beginPath(); c.arc(x + s * 0.5, y + s * 0.4, s * 0.18, 0, TAU); c.stroke();
      c.fillRect(x + s * 0.3, y + s * 0.62, s * 0.4, s * 0.14);
      c.beginPath(); c.moveTo(x + s * 0.5, y + s * 0.18); c.lineTo(x + s * 0.5, y + s * 0.05); c.lineTo(x + s * 0.6, y + s * 0.1); c.closePath(); c.fill();
    } else {
      c.beginPath(); c.arc(x + s * 0.5, y + s * 0.5, s * 0.3, 0, TAU); c.stroke();
    }
    c.restore();
  }

  // ================= part 2: expedition update ===========================
  _updateTitle(dt) {
    if (this.input.pressed('enter') || this.input.pressed(' ')) {
      this.sfx('ui');
      this._beginExpedition();
      return;
    }
    if (this.input.pressed('a')) { this.sfx('ui'); this._beginAtelier(); return; }
    if (this.input.pressed('m')) { this._muteToggle(); return; }
    // mouse buttons (see _drawTitle layout)
    if (this.input.mouse.lPressed) {
      const cx = this.cw / 2, py = 300, ph = 300;
      const bw = 260, bh = 54, bx = cx - bw / 2, by = py + ph + 18;
      const abw = 200, abh = 44, abx = cx - abw / 2, aby = by + bh + 16;
      if (this._mouseIn(bx, by, bw, bh)) { this.sfx('ui'); this._beginExpedition(); }
      else if (this._mouseIn(abx, aby, abw, abh)) { this.sfx('ui'); this._beginAtelier(); }
    }
  }

  _beginExpedition() {
    // fresh world each run (title keeps drifting over whatever is left)
    const seed = (Math.random() * 2 ** 31) | 0;
    this.world = new World(mulberry32(seed), seed % 99991);
    this.tuning = makeTuning(this.save.upgrades, this.save.loadout);
    this.player = new Player(PLAYER_START_X, PLAYER_START_Y, this.tuning);
    this.paint = new Paint(this.player, this.world, this.tuning, (n, o) => this.sfx(n, o), this.particles);
    this.enemies = [];
    this.orbs = [];
    this.heron = {
      x: HERON_X, y: HERON_Y, hp: this.tuning.bossMaxHp, maxHp: this.tuning.bossMaxHp,
      phase: 1, state: 'idle', stateT: 2.2, hue: { red: 0, blue: 0, green: 0 },
      awakened: false, awakenedT: 0, summonT: 9, lungeDir: -1,
      targetX: HERON_X - 300, diveH: 0, facing: -1,
      flying: 0, _intro: 3.2,
    };
    this.cam.x = PLAYER_START_X; this.cam.y = PLAYER_START_Y;
    this.zoomTarget = 1;
    this.shake = 0;
    this.runT = 0;
    this.spawnT = 3.5;
    this.score = 0;
    this.stock = { red: 0, blue: 0, green: 0 };
    this.collected = { red: 0, blue: 0, green: 0 };
    this.dying = false;
    this.dieT = 0;
    this.paused = false;
    this.banners = [];
    this.state = 'expedition';
    this.audio.ensure();
    this.sfx('ui');
    if (!this.save.flags.intro) {
      this.save.flags.intro = true;
      SaveSys.save(this.save);
      this.addBanner('WASD to hop - aim the brush with the mouse', 4.6, this.ch * 0.3);
      this.addBanner('Left-click swipes paint - hold right-click for a splash', 4.6, this.ch * 0.3 + 36);
      this.addBanner('Paint the swamp back to color… then face the Great Gray Heron.', 5.4, this.ch * 0.42);
    } else {
      this.addBanner('Paint the swamp back to color… then face the Great Gray Heron.', 4.2);
    }
  }

  _updateExpedition(dt) {
    this.runT += dt;

    // ----- pause toggle (open only; menu input lives in the frame router) -----
    if (this.input.pressed('p')) {
      this.paused = !this.paused;
      this.sfx(this.paused ? 'ui-back' : 'ui');
      return;
    }
    if (this.input.pressed('escape')) {
      this.paused = true;
      this.sfx('ui-back');
      return;
    }

    // ----- brush charge (hold RMB) -----
    const p = this.player;
    if (this.input.mouse.rDown && p.splashCharge < 1) {
      p.splashCharge = Math.min(1, p.splashCharge + dt / this.tuning.splashCharge);
      if (p.splashCharge >= 1) this.sfx('charge-ready');
    }

    // ----- pigment switching (1-4) -----
    const PIGMENT_KEYS = ['1', '2', '3', '4'];
    for (let i = 0; i < PIGMENT_KEYS.length; i++) {
      if (this.input.pressed(PIGMENT_KEYS[i])) {
        p.pigment = ['red', 'blue', 'green', 'dry'][i];
        this.sfx('ui');
      }
    }

    p.update(dt, this.input, this.tuning, this.world, this._view());
    this.paint.update(dt);
    // every stroke you paint gives the swamp a little color back (core fantasy)
    const restore = this.paint.restoreAcc;
    if (restore > 0) {
      this.world.restoreColor(restore);
      if (Math.random() < 0.35) {
        this.particles.leafPuff(p.x + (Math.random() - 0.5) * 60, p.y - 30 - Math.random() * 40, '#9ed483', 1);
      }
    }
    this.input.setView(this._view());
    this.input.update();

    // ----- attacks -----
    const targetList = this.enemies;
    if (this.input.mouse.lDown) {
      this.paint.trySwipe(targetList);
      // paint the heron too (only while boss is "live" and player not dying)
      if (this.heron && this.heron.hp > 0 && !this.heron.flying && this.heron._intro <= 0) {
        const res = this.paint.paintBossHit(this.heron, p.pigment, this.tuning.bossPaintHit);
        if (res === 'awaken') {
          this.sfx('awaken');
          this.addShake(14);
          this.addBanner('The Heron AWAKENS — paint it while it shimmers!', 3.4);
        }
      }
    }
    if (this.input.mouse.rPressed && p.splashCharge >= 1) {
      this.paint.trySplash(targetList);
      this.addShake(8);
      // splash the heron if it's in the burst
      if (this.heron && this.heron.hp > 0 && !this.heron.flying) {
        const d = dist(p.x, p.y, this.heron.x, this.heron.y - 140);
        if (d <= this.tuning.splashRadius + 60) {
          this.paint.paintBossHit(this.heron, p.pigment, this.tuning.bossPaintHit);
        }
      }
    }

    // ----- enemies -----
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, p, this.tuning, this.world, this.now);
      if (e._burnTick) {
        e._burnTick = 0;
        this.particles.embers(e.x, e.y - 10, 2);
      }
      if (e.dead) { this._onEnemyDead(e); this.enemies.splice(i, 1); }
    }

    if (this.dying) {
      this.world.update(dt);
      return;
    }

    // ----- death check -----
    if (!p.alive) { this._onPlayerDead(); return; }

    // ----- orbs -----
    this._updateOrbs(dt);

    // ----- spawning (halts near the heron) -----
    const inBossArena = p.x > this.world.w - 460;
    if (!inBossArena) this._spawnWave(dt);

    // ----- boss trigger -----
    if (this.heron._intro > 0) {
      this.heron._intro -= dt;
      if (this.heron._intro <= 0) {
        this.sfx('boss-growl');
        this.addBanner('THE GREAT GRAY HERON', 3.2, 150);
        this.addBanner('Paint all three colors onto it to wake it from grayness.', 4.0, 195);
        this.zoomTarget = 0.92;
      }
    }
    if (this.heron._intro <= 0) this._updateBoss(dt);

    // ----- camera follows the frog (or the fleeing heron) -----
    this._updateCamera(dt);
  }

  _spawnWave(dt) {
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    const t = this.runT;
    const interval = Math.max(1.15, 2.7 - t / 60);
    this.spawnT = interval;
    const cap = 4 + Math.min(5, Math.floor(t / 25));
    if (this.enemies.length >= cap) return;
    const v = this._view();
    const left = v.x - 90, right = v.x + v.w / v.scale + 90;
    const top = v.y - 90, bot = v.y + v.h / v.scale + 90;
    const side = (Math.random() * 4) | 0;
    let x = side === 0 ? left : side === 1 ? right : v.x + Math.random() * (v.w / v.scale);
    let y = side === 2 ? top : side === 3 ? bot : v.y + Math.random() * (v.h / v.scale);
    x = clamp(x, 60, this.world.w - 60);
    y = clamp(y, 60, this.world.h - 60);
    let kind = 'beetle';
    const roll = Math.random();
    if (t > 12 && roll < 0.4) kind = 'mosquito';
    if (t > 25 && roll > 0.82) kind = 'toad';
    this.enemies.push(spawnEnemy(kind, x, y, this.tuning));
  }

  _updateOrbs(dt) {
    const p = this.player;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.t += dt;
      const d = dist(o.x, o.y, p.x, p.y);
      if (d < this.tuning.pickupMagnet) {
        const k = 1 - d / this.tuning.pickupMagnet;
        o.x += (p.x - o.x) * k * 6 * dt * 2;
        o.y += (p.y - o.y) * k * 6 * dt * 2;
      }
      if (d < 30) {
        this.orbs.splice(i, 1);
        const v = this.tuning.pickupValue;
        this.collected[o.color] += v;
        if (this.stock[o.color] < this.tuning.capacity) {
          this.stock[o.color] += v;
          this.sfx('pickup');
          this.particles.sparkles(o.x, o.y, PIGMENTS[o.color].light, 4);
        }
      }
    }
  }

  _onEnemyDead(e) {
    this.score += e.score;
    this.sfx('enemy-die');
    this.particles.splatter(e.x, e.y, INK, 10, 160);
    this.particles.splatter(e.x, e.y, PIGMENTS[ORB_COLORS[(Math.random() * 3) | 0]].color, 4, 120);
    // pigment orbs
    const n = 1 + ((Math.random() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const c = ORB_COLORS[(Math.random() * 3) | 0];
      const a = Math.random() * TAU, d = 8 + Math.random() * 14;
      this.orbs.push({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, color: c, t: 0 });
    }
  }

  _onPlayerDead() {
    this.dying = true;
    this.dieT = 0;
    this.sfx('defeat');
    this.particles.splatter(this.player.x, this.player.y, '#69a24e', 18, 220);
    this.addShake(10);
    // the heron takes flight and the world starts to heal — even in defeat
    if (this.heron && !this.heron.flying) { this.heron.flying = 0.001; }
  }

  _endRun(kind) {
    if (this.state === 'end') return;
    this.state = 'end';
    this.endKind = kind;
    this.endT = 0;
    this.paused = false;
    const victory = kind === 'victory';
    const gains = bankGain(this.collected, { died: !victory, victory, tuning: this.tuning });
    for (const k of ['red', 'blue', 'green']) this.save.bank[k] += gains[k];
    this.save.stats.expeditions += 1;
    if (victory) { this.save.stats.victories += 1; this.save.flags.heronDefeated = true; }
    else this.save.stats.deaths += 1;
    this.save.stats.treasures += 0; // reserved for future content
        // best run: a cleared victory with more pigments beats everything;
        // otherwise the longer un-cleared run is the "furthest you got" record
        const total = gains.red + gains.blue + gains.green;
        const cand = { pigments: total, time: Math.round(this.runT), cleared: victory };
        const prev = this.save.bestRun;
        if (!prev
          || (cand.cleared && !prev.cleared)
          || (cand.cleared === prev.cleared &&
             (victory ? total > prev.pigments : cand.time > prev.time))) {
          this.save.bestRun = cand;
        }
        SaveSys.save(this.save);
        this.endGains = gains;
        this.sfx(victory ? 'victory' : 'defeat');
  }

  // ================= part 3: boss ========================================
  _updateBoss(dt) {
    const h = this.heron;
    const p = this.player;
    // NOTE: let bossStep run even at hp<=0 — it emits the 'defeated' event
    if (!h || h.flying > 0 || this.dying) return;
    const v = this._view();
    const ev = bossStep(h, dt, { left: v.x, right: v.x + v.w / v.scale, playerX: p.x }, this.tuning, this.now);
    for (const name of ev) {
      if (name === 'slam') {
        this.addShake(13);
        this.sfx('boss-slam');
        this.particles.splatter(h.targetX, h.y - 20, '#98a19b', 14, 220);
        this.particles.droplets(h.targetX, h.y - 30, 8);
        this._hitPlayerFromHeron(130, 11, h.targetX, h.y - 40);
              } else if (name === 'landing') {
                this.addShake(11);
                this.sfx('boss-slam');
                this.particles.splatter(h.x, h.y - 20, '#7fa8c9', 16, 240);
                this.particles.droplets(h.x, h.y - 30, 10);
                this._hitPlayerFromHeron(110, 9, h.x, h.y - 40);
      } else if (name === 'summon') {
        const n = 2 + (h.phase >= 3 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU, d = 160 + Math.random() * 140;
          const x = clamp(h.x + Math.cos(a) * d, 80, this.world.w - 80);
          const y = clamp(h.y + Math.sin(a) * d, 80, this.world.h - 80);
          const kind = Math.random() < 0.5 ? 'mosquito' : 'beetle';
          this.enemies.push(spawnEnemy(kind, x, y, this.tuning));
        }
        this.sfx('boss-growl');
        this.addBanner('The Heron calls reinforcements!', 2.4, 240);
      } else if (name === 'phase2') {
        this.sfx('boss-growl');
        this.addShake(8);
        this.addBanner('The Heron\u2019s frenzy deepens\u2026', 3, 240);
      } else if (name === 'phase3') {
        this.sfx('boss-growl');
        this.addShake(12);
        this.addBanner('The Gray Storm! The Heron rages!', 3, 240);
      } else if (name === 'lunge-start') {
        this.sfx('boss-growl');
      } else if (name === 'defeated') {
        this._onHeronDefeated();
      }
    }

    // ongoing contact hazards (none while airborne, awakened, or dead)
    const airborne = (h.diveH || 0) > 50;
    if (h.hp > 0 && !airborne && !h.awakened && p.alive) {
      if (h.state === 'scoop') this._hitPlayerFromHeron(78, 9, h.scoopX, h.y - 30);
            if (h.state === 'sweep') this._hitPlayerFromHeron(150, 8, h.x + (h.sweepSide || -1) * 85, h.y - 110);
            if (h.state === 'storm-lunge') this._hitPlayerFromHeron(95, 9, h.x, h.y - 100);
            if (h.state === 'idle' || h.state === 'flap' || h.state === 'recover') {
              this._hitPlayerFromHeron(80, 6, h.x, h.y - 120);
            }
    }
  }

  _hitPlayerFromHeron(r, dmg, hx, hy) {
    const p = this.player;
    if (!p || !p.alive || p.iframes > 0) return;
    if (dist(p.x, p.y, hx, hy) < r + p.r) {
      if (p.hurt(dmg, this.tuning)) {
        this.sfx('hurt');
        this.addShake(6);
        const a = Math.atan2(p.y - hy, p.x - hx);
        p.vx += Math.cos(a) * 430;
        p.vy += Math.sin(a) * 430;
      }
    }
  }

  // M4: mute toggle (M key) — works from any screen, saved to options
  _muteToggle() {
    const m = !this.audio.muted;
    this.audio.setMuted(m);
    this.options.muted = m;
    SaveSys.saveOptions(this.options);
    if (!m) this.sfx('ui'); // unmuting plays a confirm blip; muting stays silent
    this.addBanner(m ? 'Sound muted - M to restore' : 'Sound on', 1.6, this.ch - 90);
  }

  _onHeronDefeated() {
    const h = this.heron;
    this.save.stats.heronsPainted += 1;
    SaveSys.save(this.save);
    this.sfx('awaken');
        this.addShake(16);
        this.addBanner('The Great Gray Heron blooms and takes flight!', 4, 200);
        for (const c of ORB_COLORS) this.particles.sparkles(h.x, h.y - 160, PIGMENTS[c].light, 10);
        h.flying = 0.001; // hand off to the victory flight
        // story beat: the first heron ever painted summons the swamp's critic
        if (!this.save.flags.croaksworthAsked) {
          this.save.flags.croaksworthAsked = true;
          this.addBanner('Somewhere in the reeds, Sir Croaksworth takes notice…', 3.6, 230);
          SaveSys.save(this.save);
        }
      }

  // ---------------- heron rendering (world space) ------------------------
  _drawHeron(ctx, h, now) {
    if (!h) return;
    const dy = h.diveH || 0;               // lift off the ground
    const fy = h.y - dy;                    // feet level
    const flying = h.flying > 0;
    const gray = h.awakened || flying;      // painted body when awake / flying
    const bodyCol = gray ? '#7d8f96' : '#98a19b';
    const ink = INK;

    // ground shadow
    ctx.save();
    ctx.globalAlpha = 0.16 * (1 - dy / 320);
    ctx.fillStyle = '#1c2b22';
    ctx.beginPath();
    ctx.ellipse(h.x, h.y + 6, 58 * (1 - dy / 500), 16 * (1 - dy / 500), 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(h.x, fy);
    if (flying) ctx.rotate(-0.12 + Math.sin(now * 3) * 0.04);

    // legs (hidden in the air)
    if (dy < 24) {
      ctx.strokeStyle = bodyCol;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-14, 0); ctx.lineTo(-8, -72);
      ctx.moveTo(14, 0); ctx.lineTo(8, -72);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-14, 0); ctx.lineTo(-26, 0);
      ctx.moveTo(14, 0); ctx.lineTo(2, 0);
      ctx.stroke();
    }

    // body — big watercolor blob
    ctx.fillStyle = bodyCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.6;
    traceBlob(ctx, 0, -140, 55, 17, 0.05, 14);
    ctx.fill(); ctx.stroke();

    // wing: folded lump, or a sweeping arc during 'sweep'
    if (h.state === 'sweep') {
      const s = h.sweepSide || -1;
      const k = 1 - h.stateT / 0.45;
      ctx.strokeStyle = bodyCol;
      ctx.lineWidth = 26;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, -130, 150, s < 0 ? Math.PI * 0.5 - k * 1.9 : -Math.PI * 0.5 + k * 1.9 - (s < 0 ? 0 : 0), s < 0 ? Math.PI * 0.5 - (1 - k) * 1.9 : Math.PI * 0.5 - (1 - k) * 1.9, s < 0);
      ctx.stroke();
    } else {
      ctx.fillStyle = mixColor(bodyCol, INK, 0.18);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.2;
      traceBlob(ctx, 12, -150, 34, 23, 0.08, 10);
      ctx.fill(); ctx.stroke();
    }

    // neck — S curve up to the head
    const neckSway = h.awakened ? 0 : Math.sin(now * 1.6) * 4;
    ctx.strokeStyle = bodyCol;
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(28, -175);
    ctx.quadraticCurveTo(-6 + neckSway, -235, -38 - neckSway, -258);
    ctx.stroke();
    // head
    ctx.fillStyle = bodyCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(-44 - neckSway, -262, 17, 14, -0.25, 0, TAU);
    ctx.fill(); ctx.stroke();
    // beak — long, aimed down toward the frog
    ctx.fillStyle = '#c9a24a';
    ctx.beginPath();
    ctx.moveTo(-56 - neckSway, -262);
    ctx.lineTo(-104 - neckSway, -244);
    ctx.lineTo(-54 - neckSway, -252);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // eye — a flat, unimpressed line (angry when phased)
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    if (h.phase >= 2) {
      ctx.moveTo(-50 - neckSway, -268); ctx.lineTo(-40 - neckSway, -264);
    } else {
      ctx.moveTo(-50 - neckSway, -266); ctx.lineTo(-40 - neckSway, -266);
    }
    ctx.stroke();

    // painted hues — accumulate visible color as you paint it
    for (const c of ORB_COLORS) {
      const hv = h.hue[c] || 0;
      if (hv <= 0) continue;
      ctx.globalAlpha = Math.min(0.5, hv / 100 * 0.6);
      ctx.fillStyle = PIGMENTS[c].light;
      traceBlob(ctx, (c === 'red' ? -18 : c === 'blue' ? 6 : 20), -140 - (c === 'green' ? 14 : 0), 26, 41 + c.length, 0.12, 10);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // awakened shimmer
    if (h.awakened) {
      for (let i = 0; i < 3; i++) {
        const a = now * 2.4 + i * TAU / 3;
        ctx.fillStyle = PIGMENTS[ORB_COLORS[i]].light;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 62, -150 + Math.sin(a * 1.3) * 46, 4.5, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // -------- telegraphs (ground markers, drawn in world space) --------
    if (!flying) {
      if (h.state === 'telegraph-scoop' && h.scoopX !== undefined) {
        this._drawBossMarker(ctx, h.scoopX, h.y - 8, 78, 0.75, now);
      } else if (h.state === 'telegraph-dive' || h.state === 'dive') {
        this._drawBossMarker(ctx, h.targetX, h.y - 8, 100, 0.85, now);
      } else if (h.state === 'leap' && h.spots) {
        for (let i = 0; i < h.spots.length; i++) {
          this._drawBossMarker(ctx, h.spots[i], h.y - 8, 90, 0.7, now + i * 0.3);
        }
      }
    }
  }

  _drawBossMarker(ctx, x, y, r, alpha, now) {
    const pulse = 0.75 + Math.sin(now * 9) * 0.25;
    ctx.save();
    ctx.globalAlpha = alpha * pulse;
    ctx.strokeStyle = '#e8d44a';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(232,212,74,0.16)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    // exclamation
    ctx.fillStyle = '#e8d44a';
    ctx.font = '700 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', x, y - 4);
    ctx.restore();
  }

  // ================= part 4: rendering =====================================
  _screenSpace() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  _drawAll() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cw, this.ch);
    const v = this._view();
    const sat01 = this.world.worldColorSat();

    // ---- world space ----
    ctx.save();
    ctx.translate(-v.x * v.scale, -v.y * v.scale);
    ctx.scale(v.scale, v.scale);
    this.world.drawBackground(ctx, v, sat01);
    this.world.drawProps(ctx, v, sat01, this.now);
    this.world.drawObstacles(ctx, v, sat01);
    this.paint && this.paint.drawTrails(ctx);
    if (this.state === 'expedition' || this.state === 'end') {
      if (this.heron) this._drawHeron(ctx, this.heron, this.now);
      for (const e of this.enemies) drawEnemy(ctx, e, this.now);
      if (this.player && this.player.alive) this.player.draw(ctx, v, this.now);
      this._drawOrbs(ctx);
    }
    this.particles.draw(ctx);
    this.paint && this.paint.drawNotes(ctx);
    ctx.restore();

    // ---- screen space ----
    this._screenSpace();
    if (this.state === 'expedition' || this.state === 'end') {
      this._drawOffscreenHeronArrow(ctx, v);
      this._drawHud(ctx);
      this._drawBanners(ctx);
    }
    if (this.state === 'title') this._drawTitle(ctx);
    if (this.state === 'atelier') this._drawAtelier(ctx);
    if (this.paused && this.state === 'expedition') this._drawPause(ctx);
    if (this.state === 'end') this._drawEnd(ctx);

    // ---- M5: low-HP vignette (soft red pulse when at <= 2 hp) ----
    if (this.state === 'expedition' && !this.paused && this.player && this.player.alive
        && this.player.hp <= 2 && this.player.iframes <= 0) {
      const pulse = 0.26 + 0.12 * Math.sin(this.now * 5);
      const g = ctx.createRadialGradient(this.cw / 2, this.ch / 2, this.ch * 0.42, this.cw / 2, this.ch / 2, this.ch * 0.78);
      g.addColorStop(0, 'rgba(122,32,22,0)');
      g.addColorStop(1, 'rgba(122,32,22,' + pulse.toFixed(3) + ')');
      ctx.save();
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.cw, this.ch);
      ctx.restore();
    }
  }

  _drawOrbs(ctx) {
    for (const o of this.orbs) {
      const pig = PIGMENTS[o.color];
      const bob = Math.sin(this.now * 3 + o.x * 0.05) * 3;
      const y = o.y - 8 + bob;
      const pulse = 0.85 + Math.sin(this.now * 5 + o.y) * 0.15;
      ctx.save();
      ctx.globalAlpha = 0.35 * pulse;
      ctx.fillStyle = pig.light;
      ctx.beginPath();
      ctx.arc(o.x, y, 11, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = pig.color;
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.arc(o.x, y, 6.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(o.x - 2, y - 2, 1.8, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawOffscreenHeronArrow(ctx, v) {
    const h = this.heron;
    if (!h || h.flying > 0 || h._intro > 0 || h.hp <= 0) return;
    const sx = (h.x - v.x) * v.scale;
    const sy = (h.y - 150 - v.y) * v.scale;
    if (sx > 40 && sx < this.cw - 40 && sy > 40 && sy < this.ch - 40) return;
    const cx = clamp(sx, 48, this.cw - 48), cy = clamp(sy, 64, this.ch - 48);
    const a = Math.atan2(sy - cy, sx - cx);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.globalAlpha = 0.8 + Math.sin(this.now * 6) * 0.2;
    ctx.fillStyle = '#e8d44a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-3, 0); ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  _drawHud(ctx) {
    const p = this.player;
    const t = this.tuning;
    if (!p) return;

    // ---- heart pips (top-left) ----
    ctx.save();
    ctx.globalAlpha = 0.92;
    const maxP = p.maxHp;
    const r = 5.5;
    const w = maxP * r * 2.6;
    this._paperChip(ctx, 14, 14, w + 20, 26);
    drawPips(ctx, 24, 27, r, maxP, Math.max(0, Math.ceil(p.hp)), '#d8543c');
    ctx.restore();

    // ---- pigment slots (under hearts) ----
    const order = ['red', 'blue', 'green', 'dry'];
    for (let i = 0; i < 4; i++) {
      const c = order[i];
      const pig = PIGMENTS[c];
      const x = 14 + i * 66, y = 52;
      const selected = p.pigment === c;
      ctx.save();
      if (selected) {
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = '#fdf6e9';
        ctx.lineWidth = 3;
        ctx.strokeStyle = pig.color;
        this._blobRect(ctx, x, y, 60, 44, 11 + i * 3);
        ctx.fill(); ctx.stroke();
      } else {
        this._paperChip(ctx, x, y, 60, 44, 10 + i * 2);
      }
      ctx.globalAlpha = 1;
      // key hint
      centerText(ctx, `${i + 1}`, x + 9, y + 10, '700 11px Georgia, serif', INK, 0.55);
      // swatch
      ctx.fillStyle = pig.color;
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.arc(x + 30, y + 16, 10, 0, TAU);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(x + 27, y + 13, 2.6, 0, TAU);
      ctx.fill();
      // stock pips
      const n = Math.min(t.capacity, this.stock[c]);
      const pr = 2.6;
      drawPips(ctx, x + 12, y + 36, pr, Math.min(8, t.capacity), n, pig.color);
      ctx.restore();
    }

    // ---- splash charge bar (right of pigments) ----
    const bx = 14 + 4 * 66 + 10, by = 52, bw = 120, bh = 44;
    ctx.save();
    this._paperChip(ctx, bx, by, bw, bh, 8);
    ctx.restore();
    const chg = p.splashCharge;
    ctx.save();
    ctx.globalAlpha = 0.92;
    centerText(ctx, 'SPLASH', bx + bw / 2, by + 10, '700 10px Georgia, serif', INK, 0.6);
    ctx.fillStyle = 'rgba(43,35,32,0.15)';
    this._blobRect(ctx, bx + 10, by + 22, bw - 20, 12, 1);
    ctx.fill();
    if (chg > 0.01) {
      const full = chg >= 1;
      ctx.globalAlpha = full ? 0.85 + Math.sin(this.now * 8) * 0.15 : 0.8;
      ctx.fillStyle = PIGMENTS[p.pigment === 'dry' ? 'red' : p.pigment].color;
      this._blobRect(ctx, bx + 10, by + 22, (bw - 20) * chg, 12, 1);
      ctx.fill();
      if (full) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    centerText(ctx, 'hold right-click', bx + bw / 2, by + 39, 'italic 9px Georgia, serif', INK, 0.5);
    ctx.restore();

    // ---- score + collected (top-right) ----
    ctx.save();
    ctx.globalAlpha = 0.92;
    const sx = this.cw - 14;
    centerText(ctx, `Score  ${this.score}`, sx - 70, 28, '700 16px Georgia, serif', INK);
    for (let i = 0; i < 3; i++) {
      const c = ORB_COLORS[i];
      const pig = PIGMENTS[c];
      const ox = sx - 160 + i * 52, oy = 54;
      ctx.fillStyle = pig.color;
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.arc(ox, oy, 9, 0, TAU);
      ctx.fill(); ctx.stroke();
      centerText(ctx, `${this.collected[c]}`, ox, oy + 20, '700 13px Georgia, serif', INK);
    }
    ctx.restore();

    // ---- boss bar (top-center, once the heron is live) ----
    const h = this.heron;
    if (h && h._intro <= 0 && h.hp > 0 && h.flying <= 0) {
      const bw = 420, bx = (this.cw - bw) / 2, by = 16;
      ctx.save();
      ctx.globalAlpha = 0.92;
      this._paperChip(ctx, bx - 8, by - 6, bw + 16, 40, 4);
      ctx.restore();
      const frac = Math.max(0, h.hp / h.maxHp);
      ctx.save();
      centerText(ctx, 'THE GREAT GRAY HERON', this.cw / 2, by + 4, '700 12px Georgia, serif', INK, 0.85);
      ctx.fillStyle = 'rgba(43,35,32,0.18)';
      this._blobRect(ctx, bx, by + 12, bw, 12, 1);
      ctx.fill();
      ctx.globalAlpha = h.awakened ? 0.9 + Math.sin(this.now * 10) * 0.1 : 0.85;
      ctx.fillStyle = h.awakened ? '#e8836b' : '#8d9aa0';
      this._blobRect(ctx, bx, by + 12, bw * frac, 12, 1);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.restore();
    }

    // ---- swamp color meter (bottom-left) ----
    ctx.save();
    ctx.globalAlpha = 0.9;
    const mx2 = 30, my2 = this.ch - 30, rr = 14;
    ctx.fillStyle = PAPER;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(mx2, my2, rr, 0, TAU);
    ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx2, my2, rr - 4, 0, TAU);
    ctx.clip();
    ctx.fillStyle = sat('#6f9e8e', this.world.worldColorSat());
    ctx.fillRect(mx2 - rr, my2 - rr, rr * 2, rr * 2);
    ctx.restore();
    centerText(ctx, 'swamp color', mx2 + 16 + ctx.measureText('x').width, my2, 'italic 11px Georgia, serif', INK, 0.75);
    ctx.restore();
  }

  _drawBanners(ctx) {
    for (const b of this.banners) {
      const a = Math.min(1, b.t / 0.4, (b.max - b.t) / 0.4);
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      outlineText(ctx, b.text, this.cw / 2, b.y, '600 26px "Comic Sans MS", "Segoe Print", cursive', '#fdf6e9', INK, 5);
      ctx.restore();
    }
  }

  _paperChip(ctx, x, y, w, h, seed) {
    ctx.fillStyle = 'rgba(244,234,216,0.88)';
    this._blobRect(ctx, x, y, w, h, seed);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  _blobRect(ctx, x, y, w, h, seed) {
    ctx.beginPath();
    const r = Math.min(8, w / 3, h / 3);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  _mouseIn(x, y, w, h) {
    const m = this.input.mouse;
    return m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
  }

  _drawTitle(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(30,25,22,0.45)';
    ctx.fillRect(0, 0, this.cw, this.ch);
    ctx.restore();

    const cx = this.cw / 2;
    const bob = Math.sin(this.now * 1.4) * 4;
    outlineText(ctx, 'Frogue Gallery', cx, 190 + bob, '700 72px Georgia, serif', '#f4ead8', INK, 10);
    centerText(ctx, 'a cozy action roguelite about a tiny frog painter', cx, 248 + bob, 'italic 20px Georgia, serif', '#fdf6e9', 0.92);

    // controls card
    const pw = 520, ph = 300, px = cx - pw / 2, py = 300;
    const c = paperPanel(ctx, px, py, pw, ph, { seed: 11 });
    centerText(c, 'The swamp is fading to gray.', cx, py + 34, '600 17px Georgia, serif');
    centerText(c, 'Paint it back to color — then face the Great Gray Heron.', cx, py + 58, '600 17px Georgia, serif');
    const rows = [
      ['Move', 'WASD / arrows'],
      ['Paint swipe', 'hold left mouse (aim with the cursor)'],
      ['Splash burst', 'hold right mouse, release'],
      ['Hop / dodge', 'space (brief invulnerability)'],
      ['Switch pigment', '1–4 (red / blue / green / dry)'],
      ['Pause', 'P or Esc'],
    ];
    rows.forEach((r, i) => {
      const ry = py + 96 + i * 28;
      centerText(c, r[0], px + 110, ry, '700 14px Georgia, serif', INK, 0.9);
      centerText(c, r[1], px + 330, ry, '14px Georgia, serif', INK, 0.8);
    });
    paperEnd(ctx);

    // start button (visual; Enter/Space handled in _updateTitle)
        const bw = 260, bh = 54, bx = cx - bw / 2, by = py + ph + 18;
        uiButton(ctx, bx, by, bw, bh, 'Begin Expedition', this._mouseIn(bx, by, bw, bh), false, { seed: 5, size: 20, mouseX: this.input.mouse.x, mouseY: this.input.mouse.y, mouseClicked: false });
        // atelier button (visual; A / click handled in _updateTitle)
        const abw = 200, abh = 44, abx = cx - abw / 2, aby = by + bh + 16;
        uiButton(ctx, abx, aby, abw, abh, 'Visit the Atelier', this._mouseIn(abx, aby, abw, abh), false, { seed: 6, size: 15 });

        // little footer stats
        const s = this.save.stats;
        centerText(ctx, `expeditions ${s.expeditions}   ·   victories ${s.victories}   ·   herons painted ${s.heronsPainted}`, cx, aby + abh + 18, 'italic 13px Georgia, serif', '#fdf6e9', 0.7);
        const br = this.save.bestRun;
        if (br) {
          const what = br.cleared ? `cleared with ${br.pigments} pigment` : `lasted ${br.time}s`;
          centerText(ctx, `best run — ${what}`, cx, aby + abh + 38, '700 14px Georgia, serif', '#e8c86a', 0.95);
        }
        centerText(ctx, 'M to mute · A for the atelier', cx, aby + abh + (br ? 58 : 38), '12px Georgia, serif', '#fdf6e9', 0.5);
      }

  _drawPause(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(30,25,22,0.55)';
    ctx.fillRect(0, 0, this.cw, this.ch);
    ctx.restore();
    const cx = this.cw / 2, cy = this.ch / 2;
    const pw = 340, ph = 260, px = cx - pw / 2, py = cy - 130;
    const c = paperPanel(ctx, px, py, pw, ph, { seed: 21 });
    centerText(c, 'Paused', cx, py + 44, '700 30px Georgia, serif');
    centerText(c, 'P to resume - Esc quits to the pond', cx, py + 76, '13px Georgia, serif', INK, 0.7);
    uiButton(ctx, px, py + 108, pw, 44, 'Resume', this._mouseIn(px, py + 108, pw, 44), false, { seed: 41, size: 16, mouseX: this.input.mouse.x, mouseY: this.input.mouse.y, mouseClicked: false });
    uiButton(ctx, px, py + 160, pw, 44, 'Quit to the Pond', this._mouseIn(px, py + 160, pw, 44), false, { seed: 42, size: 16, mouseX: this.input.mouse.x, mouseY: this.input.mouse.y, mouseClicked: false });
    centerText(c, 'M to mute', cx, py + 226, 'italic 12px Georgia, serif', INK, 0.6);
    paperEnd(ctx);
  }

  _drawEnd(ctx) {
    const victory = this.endKind === 'victory';
    const a = Math.min(1, this.endT / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = victory ? 'rgba(40,50,30,0.55)' : 'rgba(30,25,22,0.6)';
    ctx.fillRect(0, 0, this.cw, this.ch);
    ctx.restore();
    if (this.endT < 0.25) return; // let the heron fly a beat before the card

    const cx = this.cw / 2;
    const pw = 560, ph = 430, px = cx - pw / 2, py = this.ch / 2 - ph / 2;
    const c = paperPanel(ctx, px, py, pw, ph, { seed: victory ? 31 : 37 });

    outlineText(c, victory ? 'The Swamp Blooms!' : 'The Brush Rests…', cx, py + 52, '700 40px Georgia, serif', victory ? '#5a9e3d' : '#8d9aa0', INK, 6);
    centerText(c, victory
      ? 'The Heron takes flight, dripping in your colors. The swamp remembers.'
      : 'The frog slips beneath the reeds… but the pigments you kept are yours.',
      cx, py + 88, 'italic 15px Georgia, serif', INK, 0.8);

    // gains
    const g = this.endGains || {};
    centerText(c, victory ? 'Pigments added to the bank' : 'Pigments kept (half, the swamp is unforgiving)', cx, py + 122, '700 14px Georgia, serif', INK, 0.85);
    for (let i = 0; i < 3; i++) {
      const col = ORB_COLORS[i];
      const pig = PIGMENTS[col];
      const ox = cx - 140 + i * 140, oy = py + 160;
      c.fillStyle = pig.color;
      c.lineWidth = 2;
      c.strokeStyle = INK;
      c.beginPath();
      c.arc(ox, oy, 14, 0, TAU);
      c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.beginPath();
      c.arc(ox - 4, oy - 5, 3.4, 0, TAU);
      c.fill();
      centerText(c, `+${g[col] || 0}`, ox, oy + 34, '700 18px Georgia, serif', INK);
      centerText(c, pig.name, ox, oy + 54, '12px Georgia, serif', INK, 0.7);
    }

    // bank totals
    const b = this.save.bank;
    centerText(c, `Bank — red ${b.red} · blue ${b.blue} · green ${b.green}`, cx, py + 250, '700 15px Georgia, serif', INK, 0.9);
    const s = this.save.stats;
    centerText(c, `expeditions ${s.expeditions} · victories ${s.victories} · herons painted ${s.heronsPainted}`, cx, py + 274, '13px Georgia, serif', INK, 0.65);

    // best run
    const br = this.save.bestRun;
    if (br) {
      const what = br.cleared ? `cleared with ${br.pigments} pigment` : `lasted ${br.time}s`;
      centerText(c, `best run — ${what}`, cx, py + 296, '700 13px Georgia, serif', INK, 0.8);
    }

    // spend hint
        centerText(c, 'Rest at the Atelier and spend what you gathered.', cx, py + 320, 'italic 12px Georgia, serif', INK, 0.55);
        paperEnd(ctx);

        // primary: to the atelier (see end-state input routing for the same rects)
        const bw = 300, bh = 54, bx = cx - bw / 2, by = py + ph + 16;
        uiButton(ctx, bx, by, bw, bh, 'Rest at the Atelier', this._mouseIn(bx, by, bw, bh), false, { seed: 9, size: 18, mouseX: this.input.mouse.x, mouseY: this.input.mouse.y, mouseClicked: false });
        const lw = 210, lh = 34, lx = cx - lw / 2, ly = by + bh + 16;
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#fdf6e9';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(lx, ly, lw, lh, 17);
        ctx.fill(); ctx.stroke();
        ctx.restore();
        centerText(ctx, 'return to the pond (Esc)', cx, ly + lh / 2 + 1, '13px Georgia, serif', '#fdf6e9', 0.9);
      }
}