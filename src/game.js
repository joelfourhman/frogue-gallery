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
import { PIGMENTS, PIGMENT_ORDER, ENEMIES, makeTuning, applyDifficulty, DIFFICULTIES, bossStep, bankGain, freshSave, UPGRADES, PAINTINGS, canAfford, payCost, costArray, applyWelcomeGrant, WELCOME_GRANT, activeSynergy, canRetireCollection, retireCollection, galleryBonusLevel } from './logic.js';
import { INK, PAPER, centerText, outlineText, paperPanel, paperEnd, uiButton, drawPips, sat, mixColor, roundRectPath } from './ui.js';

// A1 (v1.2 M9): the atelier's resident characters speak in short one-liners.
// Four context pools per character (victory / defeat / purchase / general),
// a typewriter reveal, and rotation so the same line never repeats twice in
// a row. Pure display data — nothing here is persisted.
const ATELIER_CHARS = [
  { name: 'Mabel', pools: {
      victory: [
        'The swamp was green again by morning. You hear that?',
        'I told Giuseppe you were steady. I never lie about strokes.',
        'Hang that one on the wall. You have earned a wall.',
      ],
      defeat: [
        'The water takes and the water gives. Bank what you can.',
        'Wipe your snout and sit. The kettle is always on.',
        'Every great canvas starts with a wet patch. Try again soon.',
      ],
      purchase: [
        'Ah, new colors! My eyes, Giuseppe — look at them!',
        'You spoil me. Sit, you will want the good light next.',
        'Paid in pigment, and paid in good company. Worth it.',
      ],
      general: [
        'I still cannot tell the moon from a pale lily. You can.',
        'Paint slow, dry fast — that is the whole secret, really.',
        'The reeds were quieter today. Good signs, for a painter.',
      ],
  } },
  { name: 'Giuseppe', pools: {
      victory: [
        'A clear run! Buy me a pigment while you are at it.',
        'I was watching from the window. Magnificent technique.',
        'Victory, victory — and did you count the drops, or not?',
      ],
      defeat: [
        'The swamp keeps its own ledger. Ours is smaller, and kinder.',
        'You came back! That is already half the sale.',
        'A bruised frog paints the bluest. Rest first, obviously.',
      ],
      purchase: [
        'Sold! No refunds, but excellent taste. As always.',
        'A fine investment. The frame alone pays for itself.',
        'My stock is thinning and my smile is not. Keep buying.',
      ],
      general: [
        'Everything for sale, nothing truly gone. House rules.',
        'Best painters in my experience: the ones who keep showing up.',
        'Red for passion, blue for patience, green for a long lunch.',
      ],
  } },
  { name: 'Monet', pools: {
      victory: [
        'Not bad. The light was on my side, though. Probably.',
        'You cleared it. I am allowed to be a little pleased.',
        'Impressive. I will stop practicing in the same swamp now.',
      ],
      defeat: [
        'Lost, and yet you painted something. That is the whole point.',
        'The heron is a critic. So am I. We do not mix, you know.',
        'Failure dries faster than you think. Sit, then go.',
      ],
      purchase: [
        'You buy the pigments and I buy the silence. Fair trade.',
        'More color for you to get wrong beautifully. Lovely.',
        'A rival who invests in their tools. Respect, at least.',
      ],
      general: [
        'I paint the swamp at dawn. You paint it at its worst. We tie.',
        'Color is just light that got in trouble. So are we, all.',
        'Your frog has manners. It paints over its mistakes. Good.',
      ],
  } },
];

// A3 (v1.2 M9): the Curator's Ledger — a short lore/collectible blurb per
// painting, shown in its own atelier tab (a display-only collection book).
// Data-only (strings), keyed by painting id; the collected/not-yet state is
// read live from the save, so nothing extra is persisted.
const LEDGER_LORE = {
  'moonlit-pond': 'The only pond that ever held the whole sky at once. Mabel paints it by memory; the moon forgives.',
  'dancing-salamander': 'It never sat still long enough to paint — so Giuseppe painted it mid-leap and dared it to finish the sentence.',
  'spring-garden': 'A garden that bloomed through a single, impossibly green afternoon. You can almost smell the rain in it.',
  'self-portrait': 'Frogue, unposed and unflattering, exactly as the swamp sees you. It is the bravest thing you have owned.',
  'king-frog': 'Painted for a frog who never sat on a throne but somehow ruled the lily pads anyway. Royalty is a matter of drops.',
  'storm-cloud': 'A single cloud caught at the exact second it decided to rain. Monet insists it was raining on him, not the canvas.',
  "beetle-armor": 'Chitin borrowed, not stolen — the beetle grew a second shell and kept its dignity. So did you.',
  'croaksworth': 'The one portrait he finally let himself be. Even the old heron looks a little proud, and a little green.',
};
export function ledgerEntry(pt) {
  return { id: pt.id, name: pt.name, lore: LEDGER_LORE[pt.id] || 'A blank page, still waiting for its story.' };
}

// P5: 4 named expedition zones + a rest checkpoint between each — structure
// the run so a full expedition reads as a journey, not one long hallway.
// M8 P12: each zone carries a distinct accent color and a `sig` signature
// encounter — one larger, bolder "guardian" of the zone's signature enemy that
// wears the zone's accent ring. The zone reads as a place, not a repeat.
export const ZONES = [
  { x: 0.24, name: 'Reed Flats',   accent: '#c9a94e', tip: 'Reed Flats — the swamp breathes. Beetles chew through the reeds.',   mix: { beetle: 3, mosquito: 1 },
    sig: { kind: 'beetle',   count: 1 } },
  { x: 0.44, name: 'Slick Hollow', accent: '#5a93c9', tip: 'Slick Hollow — mosquitos swarm the still water. Blue paint chills them.', mix: { mosquito: 4, beetle: 2 },
    sig: { kind: 'mosquito', count: 2 } },
  { x: 0.64, name: 'Bramble Thicket', accent: '#7fb069', tip: 'Bramble Thicket — toads lurk in the bramble. Paint them dizzy (green) for open shots.', mix: { toad: 2, mosquito: 3 },
    sig: { kind: 'toad',     count: 1 } },
  { x: 0.82, name: 'The Gray Shore', accent: '#9a9a8f', tip: 'The Gray Shore — everything the swamp kept gathers here. Rest, then finish.', mix: { toad: 2, beetle: 3, mosquito: 3 },
    sig: { kind: 'beetle',   count: 2 } },
];
// Elite scaling for signature encounters (P12): bolder than a normal spawn of
// the same kind, but a single well-timed splash or a couple of swipes still
// handles it — they add character, not a wall.
export const ELITE = { hp: 1.9, dmg: 1.3, radius: 1.35, score: 3 };

const HERON_Y = 800; // heron x is set per-run at world.w - 350 (P5)
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
    this.tuning = makeTuning(this.save.upgrades, this.save.loadout, this.options.difficulty, this.save.galleryBonus || 0);
    // B5: persistent storage unavailable (privacy mode, quota, disabled)? We
    // still run on the in-memory save, but surface a one-time warning so the
    // player knows progress may not survive a reload. storageOK forces the
    // store to resolve here so the flag is accurate at construction.
    this._storageOK = SaveSys.storageOK;

    // ---------- systems ----------
    this.input = new Input(canvas);
    this.audio = new AudioSys();
    this.audio.setVolume(this.options.volume);
    this.audio.setMusicVolume(this.options.musicVol);
    this.audio.setSfxVolume(this.options.sfxVol);
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
    this.help = false;          // M8 P6: "?" reference overlay (pauses the run)
    this.optionsOpen = false;   // M8 P9: options overlay (volume sliders + toggles)
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

    // A1: atelier one-liners — reveal state for the typewriter line shown in
    // the atelier. Seeded from the last finished run's outcome on entry.
    this._atelierSay = null;    // { name, text, revealed } or null
    this._atelierSayIdx = {};   // per-character rotation index (not persisted)
    this.lastResult = null;     // 'victory' | 'defeat' | null — last finished run

    // one-time audio unlock on first gesture (browser autoplay rules).
    // P9: also start the ambient bed so the music/SFX sliders have a live
    // preview. startMusic is a no-op until ensure() has created the context.
    this._unlock = () => { this.audio.ensure(); this.audio.startMusic(); };
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
    if (this.shake > 0.15 && this.options.shake) {
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
    // M8 P12: zone-accent wash fades out after entry
    if (this._zoneTint) {
      this._zoneTint.t -= dt;
      if (this._zoneTint.t <= 0) this._zoneTint = null;
    }

    if (this.state === 'title') {
      this.titleT += dt;
      this.cam.x = 1200 + Math.sin(this.titleT * 0.12) * 500;
      this.cam.y = 750 + Math.cos(this.titleT * 0.09) * 260;
      if (this.optionsOpen) this._updateOptions(dt);
      else this._updateTitle(dt);
    } else if (this.state === 'expedition') {
      if (this.dying) {
        this.dieT += dt;
        this._stepHeronFlight(dt);
        if (this.dieT > 1.6) this._endRun('defeat');
      } else if (this.heron && this.heron.flying > 0) {
        // post-victory: the run is over — let the flight play out
        // (world/particles already ticked by the ambient block above)
        this._stepHeronFlight(dt);
      } else if (!this.paused && !this.help) {
        this._updateExpedition(dt);
      } else if (this.help) {
        // M8 P6: the "?" field guide owns input while open (the run is frozen).
        if (this.input.pressed('h') || this.input.pressed('escape') || this.input.pressed('?')) {
          this.help = false;
          this.sfx('ui');
        } else if (this.input.mouse.lPressed) {
          const h = this._helpGeom();
          if (this._mouseIn(h.close.x, h.close.y, h.close.w, h.close.h)) { this.help = false; this.sfx('ui'); }
        }
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
    this.optionsOpen = false;
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
    this._lastPurchase = null;      // A1: a fresh visit has no "just bought" hook
    this._pickAtelierSay();
    if (!this.save.flags.firstAtelier) {
      this.save.flags.firstAtelier = true;
      SaveSys.save(this.save);
      this._atelierIntro = true;   // one-time how-it-works panel (drawn on the first visit only)
    }
  }

  // A1: pick the atelier one-liner for this visit. Context priority:
  // (1) a purchase just made this visit, (2) the last finished run's result,
  // (3) the player's best run, (4) general banter. Each character rotates
  // through their pool without repeating the last line. Pure data read —
  // nothing persisted.
  _pickAtelierSay() {
    const chars = ATELIER_CHARS;
    const who = chars[Math.floor(Math.random() * chars.length)];
    const best = this.save.bestRun;
    const ctx =
      this._lastPurchase ? 'purchase'
      : this.lastResult === 'victory' ? 'victory'
      : this.lastResult === 'defeat' ? 'defeat'
      : best && best.cleared ? 'victory'
      : best ? 'general'
      : 'general';
    const pool = who.pools[ctx] || who.pools.general;
    const i = (this._atelierSayIdx[who.name] || 0) % pool.length;
    this._atelierSayIdx[who.name] = (i + 1) % pool.length;
    this._atelierSay = { name: who.name, text: pool[i], revealed: 0 };
  }

  // A1: a purchase just made — re-roll the one-liner from the purchase pool
  // so the resident reacts to the fresh acquisition (a banner-free echo).
  _noteAtelierPurchase() {
    this._lastPurchase = true;
    const who = ATELIER_CHARS[Math.floor(Math.random() * ATELIER_CHARS.length)];
    const pool = who.pools.purchase;
    const i = (this._atelierSayIdx[who.name] || 0) % pool.length;
    this._atelierSayIdx[who.name] = (i + 1) % pool.length;
    this._atelierSay = { name: who.name, text: pool[i], revealed: 0 };
  }

  // ---- layout: single source of truth for BOTH draw and click handling ----
  _atelierGeom() {
    const cx = this.cw / 2, ch = this.ch;
    const listX = cx - 560, listW = 1120;
    return {
      cx, ch, listX, listW,
      // M8 P8 + A3: four tabs (Upgrades / Paintings / Gallery / Ledger);
      // narrow + tight so all four sit on one symmetric row about cx.
      tabY: 148, tabW: 180, tabH: 44, tabGap: 8,
      rowY0: 204, rowH: 104, rowGap: 12,
      cardW: (listW - 24) / 2, cardH: 112, cardGap: 12, cols: 2,
      depart: { x: cx - 150, y: ch - 92, w: 300, h: 54 },
      leave: { x: cx - 370, y: ch - 82, w: 200, h: 34 },
    };
  }

  _atelierRows() {
    // [{x, y, w, h, enabled?, act()}] — the full click map for this frame.
    const g = this._atelierGeom();
    const rows = [];
    {
      // M8 P8 + A3: four tabs (Upgrades / Paintings / Gallery / Ledger),
      // centered on cx. Total span = 4*tabW + 3*tabGap; each tab's left edge
      // steps by (tabW + tabGap). Symmetric about cx by construction.
      const N = 4, span = N * g.tabW + (N - 1) * g.tabGap, x0 = g.cx - span / 2;
      for (let i = 0; i < N; i++) {
        rows.push({ tag: `tab${i}`, x: x0 + i * (g.tabW + g.tabGap), y: g.tabY, w: g.tabW, h: g.tabH, act: () => { if (this.atelierTab !== i) this.sfx('ui'); this.atelierTab = i; } });
      }
    }
    if (this.atelierTab === 0) {
      Object.keys(UPGRADES).forEach((id, i) => {
        const u = UPGRADES[id];
        const lv = this.save.upgrades[id] || 0;
        const maxed = lv >= u.levels.length;
        const y = g.rowY0 + i * (g.rowH + g.rowGap);
        rows.push({ tag: 'buy:' + id, x: g.listX + g.listW - 250, y: y + 21, w: 220, h: 62, enabled: !maxed && canAfford(this.save.bank, Array.isArray(u.levels[lv].cost) ? u.levels[lv].cost : costArray(u.levels[lv].cost)), act: () => this._buyUpgrade(id) });
      });
    } else if (this.atelierTab === 1) {
      // the Gallery tab (2) is display-only — no buy/hang rows
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
    // A4 (v1.2 M9): the Curator's Ledger (tab 3) offers a 'Rehung Frame'
    // retirement: once the collection is complete (all 8 + one hung), retiring
    // mints a permanent, saved gallery bonus. Repeatable — a counter, not a flag.
    if (this.atelierTab === 3) {
      const eligible = canRetireCollection(this.save);
      const barX = g.cx - 280, barY = g.ch - 146;
      const bbw = 150, bbh = 40, bbx = barX + 560 - bbw - 12, bby = barY + 2;
      rows.push({
        tag: 'retire', x: bbx, y: bby, w: bbw, h: bbh, enabled: eligible,
        act: () => this._retireCollection(),
      });
    }
    rows.push({ tag: 'depart', x: g.depart.x, y: g.depart.y, w: g.depart.w, h: g.depart.h, act: () => { this.sfx('ui'); this._beginExpedition(); } });
        rows.push({ tag: 'leave', x: g.leave.x, y: g.leave.y, w: g.leave.w, h: g.leave.h, act: () => { this.sfx('ui-back'); this._quitToTitle(); } });
    return rows;
  }

  _updateAtelier(dt) {
    const dismissIntro = () => { this._atelierIntro = false; };
    // A1: advance the typewriter reveal of the current one-liner
    if (this._atelierSay && this._atelierSay.revealed < this._atelierSay.text.length) {
      this._atelierSay.revealed = Math.min(this._atelierSay.text.length, this._atelierSay.revealed + dt * 28);
    }
    if (this.input.pressed('escape') || this.input.pressed('backspace')) { this.sfx('ui-back'); this._quitToTitle(); return; }
    if (this.input.pressed('enter') || this.input.pressed(' ')) { this.sfx('ui'); this._beginExpedition(); return; }
    if (this.input.pressed('1')) { if (this.atelierTab !== 0) this.sfx('ui'); this.atelierTab = 0; dismissIntro(); }
    if (this.input.pressed('2')) { if (this.atelierTab !== 1) this.sfx('ui'); this.atelierTab = 1; dismissIntro(); }
    if (this.input.pressed('3')) { if (this.atelierTab !== 2) this.sfx('ui'); this.atelierTab = 2; dismissIntro(); }
    if (this.input.pressed('4')) { if (this.atelierTab !== 3) this.sfx('ui'); this.atelierTab = 3; dismissIntro(); }
    if (this.atelierTab === 0) {
      if (this.input.pressed('a')) { this._buyUpgrade('capacity'); dismissIntro(); }
      if (this.input.pressed('s')) { this._buyUpgrade('power'); dismissIntro(); }
      if (this.input.pressed('d')) { this._buyUpgrade('vitality'); dismissIntro(); }
    }
    if (this.input.mouse.lPressed) {
      const m = this.input.mouse;
      for (const r of this._atelierRows()) {
        if (m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) {
          if (r.enabled === false) { this.sfx('hurt'); continue; }
          dismissIntro();
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
    this._noteAtelierPurchase();
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
    this._noteAtelierPurchase();
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

  // A4 (v1.2 M9): retire a completed collection for a permanent, saved gallery
  // bonus. Prestige-lite — NOT a save-wipe: the collection and bank remain, and
  // the run tuning is rebuilt so the bonus is live immediately. Repeatable.
  _retireCollection() {
    if (!canRetireCollection(this.save)) { this.sfx('hurt'); return; }
    const before = galleryBonusLevel(this.save);
    const after = retireCollection(this.save);
    if (after === before) return;
    SaveSys.save(this.save);
    // rebuild the live tuning so the bonus is active right away (also for the
    // next run) without needing a fresh expedition start.
    this.tuning = makeTuning(this.save.upgrades, this.save.loadout, this.options.difficulty, this.save.galleryBonus);
    this.sfx('awaken');
    this.addBanner(`The frame is rehung — Gallery Bonus ${after} minted.`, 4.2, this.ch * 0.34);
    this.addBanner(`+${after * 2} pigment of each color at every run start · +${Math.round(after * 10)}% orb value.`, 4.2, this.ch * 0.34 + 34);
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

    // tabs (M8 P8 + A3: four) — same centered layout as the click map in
    // _atelierRows (span = 4*tabW + 3*tabGap, left edge stepping by tabW+tabGap).
    const tN = 4, tSpan = tN * g.tabW + (tN - 1) * g.tabGap, tX0 = cx - tSpan / 2;
    [['Studio Upgrades', 0], ['Paintings', 1], ['The Gallery', 2], ["Curator's Ledger", 3]].forEach(([label, idx]) => {
      const active = this.atelierTab === idx;
      const bx = tX0 + idx * (g.tabW + g.tabGap);
      uiButton(ctx, bx, g.tabY, g.tabW, g.tabH, label, this._mouseIn(bx, g.tabY, g.tabW, g.tabH) && !active, active, { seed: 30 + idx, size: 14 });
    });
    // persistent one-line legends, so returning players never have to guess
    if (this.atelierTab === 0) {
      centerText(ctx, 'training is paid in banked pigments — it is permanent, even after a defeat', cx, g.tabY + g.tabH + 18, 'italic 13px Georgia, serif', '#fdf6e9', 0.75);
    } else if (this.atelierTab === 1) {
      // A2: when the current 2-slot loadout forms a named "duo", the legend
      // surfaces it (the creative slot choice is visible, not just applied).
      const duo = activeSynergy(this.save.loadout);
      if (duo) centerText(ctx, `✦ duo active: ${duo.name} — ${duo.desc}`, cx, g.tabY + g.tabH + 18, '700 14px Georgia, serif', '#c9922a', 1);
      else centerText(ctx, 'buy once, then hang up to 2 — hung paintings are real passive bonuses on your runs', cx, g.tabY + g.tabH + 18, 'italic 13px Georgia, serif', '#fdf6e9', 0.75);
    } else {
      centerText(ctx, 'your collection — every painting you own, hung on the wall (owned frames are lit)', cx, g.tabY + g.tabH + 18, 'italic 13px Georgia, serif', '#fdf6e9', 0.75);
    }

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
    } else if (this.atelierTab === 1) {
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
    } else if (this.atelierTab === 2) {
      // M8 P8 — the Gallery wall: every painting hung in a frame. Owned works
      // are lit (full color + title + passive-bonus caption); works the frog
      // hasn't earned sit in a dimmed, unlabeled frame so the collection reads
      // as a wall of art, not a shop.
      const fw = 200, fh = 168, fgap = 34, cols = 3, rows = 2;
      const gridW = cols * fw + (cols - 1) * fgap, gridH = rows * fh + (rows - 1) * fgap;
      const gx0 = cx - gridW / 2, gy0 = g.rowY0 + 8;
      PAINTINGS.forEach((pt, i) => {
        const col = i % cols, row = (i / cols) | 0;
        const x = gx0 + col * (fw + fgap), y = gy0 + row * (fh + fgap);
        const owned = this.save.owned.includes(pt.id);
        const sealed = this._ptLocked(pt);
        const c = paperPanel(ctx, x, y, fw, fh, { seed: 130 + i, fill: owned ? '#f9f3e2' : '#efe8d6' });
        // the frame: a double border, gilded when owned
        const fx = x + 14, fy = y + 14, fs = fw - 28;
        c.save();
        c.lineWidth = 5;
        c.strokeStyle = owned ? '#b8912e' : '#b7ab8c';
        c.beginPath(); c.roundRect(fx - 3, fy - 3, fs + 6, fs + 6, 4); c.stroke();
        c.lineWidth = 2;
        c.strokeStyle = owned ? '#8a6d1f' : '#9a9078';
        c.beginPath(); c.roundRect(fx, fy, fs, fs, 2); c.stroke();
        if (owned) {
          c.fillStyle = pt.art.bg;
          c.fillRect(fx, fy, fs, fs);
          this._drawPaintingMotif(c, pt, fx, fy, fs);
        } else {
          // dimmed, unlabeled — a silhouette of a future painting
          c.fillStyle = sealed ? '#d8cfb8' : '#e3dac4';
          c.fillRect(fx, fy, fs, fs);
          c.globalAlpha = 0.4;
          c.fillStyle = INK;
          c.font = '700 26px Georgia, serif';
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(sealed ? '?' : '✕', fx + fs / 2, fy + fs / 2);
        }
        c.restore();
        // placard
        c.save();
        c.fillStyle = INK;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        if (owned) {
          c.font = '700 14px Georgia, serif';
          c.globalAlpha = 1;
          c.fillText(pt.name, x + fw / 2, y + fh - 34);
          c.font = 'italic 11px Georgia, serif';
          c.globalAlpha = 0.7;
          c.fillText(pt.desc, x + fw / 2, y + fh - 18, fw - 24);
          if (this.save.loadout.includes(pt.id)) { c.globalAlpha = 1; c.font = '700 12px Georgia, serif'; c.fillStyle = '#c9922a'; c.fillText('★ hung', x + fw - 20, y + 22); }
        } else {
          c.font = 'italic 11px Georgia, serif';
          c.globalAlpha = 0.6;
          c.fillText(sealed ? 'a sealed portrait' : 'not yet collected', x + fw / 2, y + fh - 24);
        }
        c.restore();
        paperEnd(ctx);
      });
      const ownedCount = PAINTINGS.filter(pt => this.save.owned.includes(pt.id)).length;
      centerText(ctx, `${ownedCount} of ${PAINTINGS.length} paintings in your collection`, cx, gy0 + gridH + 16, '700 14px Georgia, serif', '#fdf6e9', 0.85);
    } else if (this.atelierTab === 3) {
      // A3 — the Curator's Ledger: a display-only collection book. Every
      // painting is listed with a short lore blurb and its collected /
      // not-yet state. Reuses the P8 Gallery wall's framed look (paperPanel +
      // the gilded frame + the generative motif) and the same painting data;
      // no buying here — the ledger only reads the collection.
      // 2 cols x 4 rows; sized so the grid ends well above the Depart button.
      const fw = 548, fh = 104, fgap = 10, cols = 2, rows = 4;
      const gridW = cols * fw + (cols - 1) * fgap, gridH = rows * fh + (rows - 1) * fgap;
      const gx0 = cx - gridW / 2, gy0 = g.rowY0 + 2;
      PAINTINGS.forEach((pt, i) => {
        const col = i % cols, row = (i / cols) | 0;
        const x = gx0 + col * (fw + fgap), y = gy0 + row * (fh + fgap);
        const owned = this.save.owned.includes(pt.id);
        const entry = ledgerEntry(pt);
        const c = paperPanel(ctx, x, y, fw, fh, { seed: 300 + i, fill: owned ? '#f9f3e2' : '#efe8d6' });
        // left: a framed thumbnail, gilded when collected (P8 frame look)
        const fs = fh - 24, fx = x + 14, fy = y + 12;
        c.save();
        c.lineWidth = 4;
        c.strokeStyle = owned ? '#b8912e' : '#b7ab8c';
        c.beginPath(); c.roundRect(fx - 2, fy - 2, fs + 4, fs + 4, 3); c.stroke();
        c.lineWidth = 1.5;
        c.strokeStyle = owned ? '#8a6d1f' : '#9a9078';
        c.beginPath(); c.roundRect(fx, fy, fs, fs, 2); c.stroke();
        if (owned) {
          c.fillStyle = pt.art.bg;
          c.fillRect(fx, fy, fs, fs);
          this._drawPaintingMotif(c, pt, fx, fy, fs);
        } else {
          c.fillStyle = '#e3dac4';
          c.fillRect(fx, fy, fs, fs);
          c.globalAlpha = 0.4;
          c.fillStyle = INK;
          c.font = '700 30px Georgia, serif';
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText('✕', fx + fs / 2, fy + fs / 2);
        }
        c.restore();
        // right: title, state tag, and the lore blurb (wrapped)
        const tx = fx + fs + 14, tw = fw - (fs + 28) - 14;
        c.save();
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        c.fillStyle = INK;
        c.font = '700 16px Georgia, serif';
        c.globalAlpha = owned ? 1 : 0.7;
        c.fillText(pt.name, tx, y + 30);
        // state tag: collected / not yet (hung noted for loadout members)
        const hung = this.save.loadout.includes(pt.id);
        c.font = '700 11px Georgia, serif';
        if (owned) {
          c.fillStyle = hung ? '#c9922a' : '#4e8a5a';
          c.fillText(hung ? '★ hung in the loadout' : 'collected', tx, y + 47);
        } else {
          c.fillStyle = '#9a9078';
          c.fillText('not yet collected', tx, y + 47);
        }
        // lore blurb — simple word wrap in the remaining height
        c.fillStyle = INK;
        c.globalAlpha = owned ? 0.85 : 0.55;
        c.font = 'italic 12.5px Georgia, serif';
        const words = entry.lore.split(' ');
        let line = '', ly = y + 66, lh = 15, maxLines = 3;
        for (let w = 0; w < words.length; w++) {
          const test = line ? line + ' ' + words[w] : words[w];
          if (c.measureText(test).width > tw && line) {
            c.fillText(line, tx, ly); line = words[w]; ly += lh;
            if (ly > y + fh - 12) { c.fillText(line + '…', tx, ly); line = ''; w = words.length; break; }
          } else { line = test; }
        }
        if (line) c.fillText(line, tx, ly);
        c.restore();
        paperEnd(ctx);
      });
      const ownCt = PAINTINGS.filter(pt => this.save.owned.includes(pt.id)).length;
      centerText(ctx, `the curator's ledger — ${ownCt} of ${PAINTINGS.length} collected · a display only, nothing is sold here`, cx, gy0 + gridH + 18, 'italic 13px Georgia, serif', '#fdf6e9', 0.7);
      // A4 (v1.2 M9): the 'Rehung Frame' retirement — a permanent, saved
      // gallery bonus minted once the collection is complete. Sits above the
      // Depart button (same geometry as the retire row in _atelierRows).
      {
        const lvl = galleryBonusLevel(this.save);
        const eligible = canRetireCollection(this.save);
        const bw = 560, bh = 84, bx = cx - bw / 2, by = g.ch - 150;
        const c = paperPanel(ctx, bx, by, bw, bh, { seed: 500, fill: eligible ? '#f3ead2' : '#efe8d6' });
        c.save();
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        c.fillStyle = INK;
        c.font = '700 15px Georgia, serif';
        c.globalAlpha = 1;
        c.fillText('Rehung Frame', bx + 20, by + 26);
        c.font = '12.5px Georgia, serif';
        c.globalAlpha = 0.8;
        c.fillText('Retire the complete collection for a permanent Gallery Bonus (the bank and collection remain).', bx + 20, by + 45);
        c.fillText(`Currently: +${lvl * 2} start ink · +${Math.round(lvl * 10)}% orb value per run. Repeatable.`, bx + 20, by + 63);
        c.restore();
        // the retire button on the right
        const bbw = 150, bbh = 56, bbx = bx + bw - bbw - 14, bby = by + (bh - bbh) / 2;
        uiButton(c, bbx, bby, bbw, bbh, eligible ? 'Retire' : 'Incomplete', false, false, { seed: 501 });
        paperEnd(ctx);
      }
    }

    // first-visit how-it-works panel (one-time; any tab/buy/action dismisses it)
    if (this._atelierIntro) {
      const pw = 660, ph = 300, px = cx - pw / 2, py = 250;
      const c = paperPanel(ctx, px, py, pw, ph, { seed: 120 });
      centerText(c, 'Welcome to the Atelier', cx, py + 40, '700 24px Georgia, serif', INK, 1);
      const lines = [
        'Between your runs, spent and gathered pigments settle into the bank above.',
        'Studio upgrades are training for the frog — permanent, kept even after a defeat.',
        'Paintings are bought once, then hung: up to 2 at a time, and a hung painting is a real bonus on future runs.',
        'Ready when you are — Depart sends you back out to the swamp.',
      ];
      lines.forEach((ln, i) => centerText(c, ln, cx, py + 84 + i * 32, '15px Georgia, serif', INK, 0.85));
      centerText(c, 'press 1 / 2 / 3 to browse the shelves, paintings, and gallery — any action closes this note', cx, py + ph - 24, 'italic 12px Georgia, serif', INK, 0.55);
      paperEnd(ctx);
    }

    // A1: the resident's one-liner — a small paper chip with a speaker tag
    // and a typewriter reveal. Sits in the clear band under the title (the
    // bank strip is centered, the tabs start at y148) so it never covers a
    // card grid and reads like a note pinned to the studio wall.
    if (this._atelierSay) {
      const chipW = 452, chipH = 32, cxp = 16, cyp = 82;
      this._paperChip(ctx, cxp, cyp, chipW, chipH, 140);
      const say = this._atelierSay;
      const shown = say.text.slice(0, Math.floor(say.revealed));
      ctx.save();
      ctx.fillStyle = '#8a5a2b';
      ctx.font = '700 13px Georgia, serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(say.name, cxp + 16, cyp + chipH / 2);
      const nameW = ctx.measureText(say.name).width;
      ctx.fillStyle = INK;
      ctx.font = 'italic 14px Georgia, serif';
      ctx.fillText('“' + shown, cxp + 24 + nameW, cyp + chipH / 2, chipW - 34 - nameW);
      ctx.restore();
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
    if (this.input.pressed('o')) { this._openOptions(); return; }  // M8 P9
    if (this.input.pressed('m')) { this._muteToggle(); return; }
    // M8 P7: difficulty select (G/N/B = Gentle/Normal/Bold; 1/2/3 are pigment
    // hotkeys in-game, so avoid them). Persists in options; applied at run start.
    if (this.input.pressed('g')) { this._setDifficulty('gentle'); return; }
    if (this.input.pressed('n')) { this._setDifficulty('normal'); return; }
    if (this.input.pressed('b')) { this._setDifficulty('bold'); return; }
    // mouse buttons (see _drawTitle layout, shared via _titleLayout)
    if (this.input.mouse.lPressed) {
      const g = this._titleLayout();
      // erase-save link: two clicks within 3 s (see _drawTitle for same rect)
      if (this._mouseIn(16, this.ch - 40, 240, 28)) {
        if ((this.now - (this._eraseArm || -99)) < 3) {
          this._eraseArm = 0;
          SaveSys.erase();
          this.save = freshSave(); // fresh save back into memory (load() returns null after erase)
          this.save.flags.intro = false;
          this.sfx('ui-back');
          this.addBanner('Save data erased — a fresh start.', 3, this.ch - 110);
          return;
        }
        this._eraseArm = this.now;
        this.sfx('ui');
        return;
      }
      for (const p of g.diff) if (this._mouseIn(p.x, p.y, p.w, p.h)) { this._setDifficulty(p.id); return; }
      if (this._mouseIn(g.bx, g.by, g.bw, g.bh)) { this.sfx('ui'); this._beginExpedition(); }
      else if (this._mouseIn(g.abx, g.aby, g.abw, g.abh)) { this.sfx('ui'); this._beginAtelier(); }
      else if (this._mouseIn(g.ox, g.oy, g.ow, g.oh)) { this.sfx('ui'); this.optionsOpen = true; }
    }
  }

  _beginExpedition() {
    // fresh world each run (title keeps drifting over whatever is left)
    const seed = (Math.random() * 2 ** 31) | 0;
    this.world = new World(mulberry32(seed), seed % 99991);
    this.tuning = makeTuning(this.save.upgrades, this.save.loadout, this.options.difficulty, this.save.galleryBonus || 0);
    this.player = new Player(PLAYER_START_X, PLAYER_START_Y, this.tuning);
    this.paint = new Paint(this.player, this.world, this.tuning, (n, o) => this.sfx(n, o), this.particles);
    this.enemies = [];
    this.orbs = [];
    this.heron = {
      x: this.world.w - 350, y: HERON_Y, hp: this.tuning.bossMaxHp, maxHp: this.tuning.bossMaxHp,
      phase: 1, state: 'idle', stateT: 2.2, hue: { red: 0, blue: 0, green: 0 },
      awakened: false, awakenedT: 0, summonT: 9, lungeDir: -1,
      targetX: this.world.w - 650, diveH: 0, facing: -1,
      flying: 0, _intro: 3.2,
    };
    this.cam.x = PLAYER_START_X; this.cam.y = PLAYER_START_Y;
    this.zoomTarget = 1;
    this.shake = 0;
    this.runT = 0;
    this.spawnT = 3.5;
    this._zoneI = 0;
    this._zoneTint = null; // M8 P12: { color, t, max } — fading zone-accent wash on entry
    this.score = 0;
    this.stock = { red: 0, blue: 0, green: 0 };
    // A4 (v1.2 M9): the permanent 'Rehung Frame' gallery bonus grants +N pigment
    // of each color at the start of every run (start ink). Capped at capacity.
    if (this.tuning.galleryInkBonus > 0) {
      for (const c of ['red', 'blue', 'green']) {
        this.stock[c] = Math.min(this.tuning.capacity, this.tuning.galleryInkBonus);
      }
    }
    this.collected = { red: 0, blue: 0, green: 0 };
    this.dying = false;
    this.dieT = 0;
    this.paused = false;
    this.help = false;   // M8 P6: start a run with the field guide closed
    this.banners = [];
    this.state = 'expedition';
    // B5: one-time "progress may not persist" notice when persistent storage is
    // unavailable (we are running on the in-memory fallback). Emitted once per
    // page load — the flag lives on the Game instance, not the save, so it
    // re-warns on every reload (which is exactly the degraded case).
    if (!this._storageOK && !this._warnedStorage) {
      this._warnedStorage = true;
      this.addBanner('No persistent storage — progress may not survive a reload.', 5.5, this.ch * 0.3);
    }
    this.audio.ensure();
    this.audio.startMusic();
    this.sfx('ui');
    this._prevHp = this.tuning.maxHp;
    const firstRun = !this.save.flags.intro;
    if (firstRun) {
      this.save.flags.intro = true;
      // PT4 (M7.5): one-time early-economy safety net — a brand-new player
      // gets enough pigment to afford the cheapest upgrade (Swamp Vitality)
      // plus a cushion, so a short first run can never soft-lock the bank.
      // Guarded by flags.welcomeGranted so it fires exactly once, ever.
      if (!this.save.flags.welcomeGranted) {
        applyWelcomeGrant(this.save);
        const total = WELCOME_GRANT.red + WELCOME_GRANT.blue + WELCOME_GRANT.green;
        this.addBanner(`Sir Croaksworth sets out a starter's kit — +${total} pigment to begin your collection.`, 5.5, this.ch * 0.62);
      }
      SaveSys.save(this.save);
      // Staged first-run tutorial: one step at a time on a runT schedule, so
      // a newcomer reads a single instruction per beat instead of a wall of
      // text (the M1 version fired three banners simultaneously).
      this._tut = [
        { at: 0.3, dur: 5.5, text: 'WASD to move — aim the brush with your mouse' },
        { at: 7, dur: 5.5, text: 'Hold left-click to paint — it hurts bugs and colors the swamp' },
        { at: 14, dur: 6.5, text: 'Pigments: 1 red burns · 2 blue chills · 3 green heals (stand in fresh moss)' },
        { at: 22, dur: 6.5, text: 'Hold right-click to charge a splash — space-hop to dodge' },
        { at: 30, dur: 6.0, text: 'Paint the swamp back to color… the gray arrow marks the Great Gray Heron' },
      ];
      this._tutI = 0;
    } else {
      this._tut = null;
      this.addBanner('Paint the swamp back to color… then face the Great Gray Heron.', 4.2);
    }
    // give first-timers a longer head start before the heron's reveal + banners.
    // PT2 (M7.5): the 5-step first-run tutorial runs to ~36s, so the boss reveal
    // (6.5s) used to interrupt it and confused newcomers. Defer the first-run
    // reveal to 38s — just after the last tutorial step — so the boss lands as
    // a clean "now you know the tools" moment. Returning players: 3.2s (unchanged).
    this.heron._intro = firstRun ? 38 : 3.2;
  }

  _updateExpedition(dt) {
    this.runT += dt;

    // ----- staged first-run tutorial (one step at a time) -----
    if (this._tut && this._tutI < this._tut.length && this.runT >= this._tut[this._tutI].at) {
      const step = this._tut[this._tutI++];
      this.addBanner(step.text, step.dur, this.ch * 0.42);
    }

    // ----- pause toggle (open only; menu input lives in the frame router) -----
    if (this.input.pressed('p')) {
      this.paused = !this.paused;
      this.sfx(this.paused ? 'ui-back' : 'ui');
      return;
    }
    // M8 P6: "?" field guide — pauses the run so you can read it safely.
    if (this.input.pressed('h') || this.input.pressed('?')) {
      this.help = !this.help;
      this.sfx(this.help ? 'ui-back' : 'ui');
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

    // ----- named expedition zones (P5): banner + staged spawn + rest checkpoint -----
    if (p.alive) {
      while (this._zoneI < ZONES.length && p.x >= this.world.w * ZONES[this._zoneI].x) {
        const z = ZONES[this._zoneI++];
        this._zoneBeat(z);
      }
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
    // P10: skip full AI for enemies far off-screen (they can't attack or be
    // painted at that range). Burn damage ALWAYS still ticks (the status check
    // below) so an off-screen burn kill is identical to before; only the
    // seek/move/contact work is skipped. A 500px buffer keeps enemies from
    // visibly freezing at the edge. `p` is the player (declared above).
    const CULL2 = 500 * 500;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.dead && p.alive) {
        const dx = e.x - p.x, dy = e.y - p.y;
        const far = dx * dx + dy * dy > CULL2;
        if (far && !(e.status && e.status.type === 'burn')) continue;
      }
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
        this.addBanner('Paint red, blue, and green to wake it — then paint fast while it shimmers!', 4.4, 195);
        this.zoomTarget = 0.92;
      }
    }
    if (this.heron._intro <= 0) this._updateBoss(dt);

    // ----- first-hit teaching (once per lifetime) -----
    if (p.alive && p.hp < this._prevHp) {
      if (!this.save.flags.firstHurt) {
        this.save.flags.firstHurt = true;
        SaveSys.save(this.save);
        this.addBanner('Ouch! Touch hurts — paint enemies first, or space-hop through them', 4.8, this.ch * 0.58);
      }
    }
    this._prevHp = p.hp;

    // ----- camera follows the frog (or the fleeing heron) -----
    this._updateCamera(dt);
  }

  // P5: named zone entry — banner, a staged combat beat ahead of the frog,
  // and a rest checkpoint: a pool of healing green paint + a couple of orbs.
  _zoneBeat(z) {
    const p = this.player;
    const W = this.world.w;
    this.sfx('ui');
    this.addBanner(z.tip, 5.2, this.ch * 0.3);
    // M8 P12: a brief zone-accent wash so entering a zone reads as a change of
    // place, not just a new banner.
    if (z.accent) this._zoneTint = { color: z.accent, t: 2.6, max: 2.6 };
    // M8 P12: a signature guardian of the zone's emblematic enemy — scaled up
    // and ringed in the zone's accent. It leads the zone's combat beat.
    if (z.sig) this._spawnZoneElite(p, z);
    // combat beat, staged ahead of the frog so it plays out gradually
    for (const [kind, n] of Object.entries(z.mix)) {
      for (let i = 0; i < n; i++) {
        const x = clamp(p.x + 240 + Math.random() * 520, 60, W - 60);
        const y = clamp(p.y + (Math.random() - 0.5) * 500, 100, this.world.h - 100);
        this.enemies.push(spawnEnemy(kind, x, y, this.tuning));
      }
    }
    // rest checkpoint: thick green paint mends 3 HP per tick when you rest in it
    const rx = clamp(p.x + 560, 0, W - 60);
    const ry = clamp(p.y, 120, this.world.h - 120);
    this.world.paintSplash(rx, ry, 110, 'green');
    this.particles.leafPuff(rx, ry - 40, '#9ed483', 3);
    for (let i = 0; i < 2; i++) {
      this.orbs.push({ x: rx + (Math.random() - 0.5) * 160, y: ry + (Math.random() - 0.5) * 120, color: ORB_COLORS[(Math.random() * 3) | 0], t: 0 });
    }
  }

  // M8 P12: spawn the zone's signature guardian(s). Each is a scaled-up elite
  // of the zone's emblematic enemy that wears the zone's accent ring. They are
  // spawned a little further ahead than the regular beat so the zone's "boss"
  // reveals itself as the frog pushes in.
  _spawnZoneElite(p, z) {
    const sig = z.sig;
    if (!sig || !sig.kind) return;
    const base = ENEMIES[sig.kind];
    if (!base) return;
    const n = sig.count || 1;
    for (let i = 0; i < n; i++) {
      const x = clamp(p.x + 340 + i * 90 + Math.random() * 200, 60, this.world.w - 60);
      const y = clamp(p.y + (Math.random() - 0.5) * 420, 100, this.world.h - 100);
      const e = spawnEnemy(sig.kind, x, y, this.tuning);
      e.elite = true;
      e.hp = e.maxHp = Math.round(base.hp * ELITE.hp);
      e.r = base.radius * ELITE.radius;
      e.dmg = base.dmg * ELITE.dmg;
      e.score = base.score * ELITE.score;
      e.accent = z.accent;
      this.enemies.push(e);
    }
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
          this.paint.note(o.x, o.y - 10, '+' + v, o.color);
          if (!this.save.flags.firstOrb) {
            this.save.flags.firstOrb = true;
            SaveSys.save(this.save);
            this.addBanner('Pigment collected! Bank it at the Atelier to buy upgrades and paintings', 5.2, this.ch * 0.58);
          }
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
    if (!this.save.flags.firstDefeat) {
      this.save.flags.firstDefeat = true;
      SaveSys.save(this.save);
      this.addBanner('Keep half your pigments — rest at the Atelier and come back stronger', 5.0, this.ch * 0.5);
    }
    // the heron takes flight and the world starts to heal — even in defeat
    if (this.heron && !this.heron.flying) { this.heron.flying = 0.001; }
  }

  _endRun(kind) {
    if (this.state === 'end') return;
    this.state = 'end';
    this.endKind = kind;
    // A1: remember the outcome so the atelier's one-liner can react to it
    // (endKind itself resets when a new expedition begins).
    this.lastResult = kind === 'victory' ? 'victory' : 'defeat';
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
      if (p.hurt(dmg * (this.tuning.dmgTakenMult || 1), this.tuning)) {
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
      this._drawOffscreenEnemyArrows(ctx, v);
      this._drawHud(ctx);
    }
    if (this.state === 'title') this._drawTitle(ctx);
    if (this.state === 'title' && this.optionsOpen) this._drawOptions(ctx);
    if (this.state === 'atelier') this._drawAtelier(ctx);
    if (this.paused && this.state === 'expedition') this._drawPause(ctx);
    if (this.help && this.state === 'expedition') this._drawHelp(ctx);   // M8 P6
    if (this.state === 'end') this._drawEnd(ctx);
    // banners render last so they sit above every screen (incl. the title,
    // where the erase-save confirm banner appears)
    this._drawZoneTint(ctx);
    this._drawBanners(ctx);

    // ---- M5: low-HP vignette (soft red pulse when at <= 2 hp) — P9: user-toggleable ----
    if (this.state === 'expedition' && !this.paused && this.options.vignette && this.player && this.player.alive
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

  // M8 P12: zone-accent wash — a soft full-screen tint in the zone's color
  // that fades out over ~2.6s after the player crosses into the zone. Reads
  // as a gentle "place shift" without hiding the world.
  _drawZoneTint(ctx) {
    if (!this._zoneTint || this.state !== 'expedition') return;
    const zt = this._zoneTint;
    // ease out: strong at the moment of entry, fading to nothing.
    const k = zt.t / zt.max;
    const alpha = 0.16 * k;
    if (alpha < 0.005) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = zt.color;
    ctx.fillRect(0, 0, this.cw, this.ch);
    ctx.restore();
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

  // P2: little ink arrows at the screen edge point at off-screen enemies,
  // so newcomers stop wondering where the mosquito went.
  _drawOffscreenEnemyArrows(ctx, v) {
    if (this.state !== 'expedition' || this.dying) return;
    const p = this.player;
    let shown = 0;
    for (const e of this.enemies) {
      if (e.dead || shown >= 6) continue;
      const sx = (e.x - v.x) * v.scale;
      const sy = (e.y - v.y) * v.scale;
      if (sx > 40 && sx < this.cw - 40 && sy > 40 && sy < this.ch - 40) continue;
      const cx = clamp(sx, 40, this.cw - 40), cy = clamp(sy, 56, this.ch - 40);
      const a = Math.atan2(sy - cy, sx - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.globalAlpha = 0.55 + Math.sin(this.now * 5 + e.x) * 0.15;
      ctx.fillStyle = e.tint && e.tintT > 0 ? PIGMENTS[e.tint].color : INK;
      ctx.beginPath();
      ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-2, 0); ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      shown++;
    }
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

  // M8 P7: difficulty selector on the title + a single source of truth for
  // every title-screen rect, shared by _drawTitle and _updateTitle so the
  // visuals and the click targets can never drift apart.
  _titleLayout() {
    const cx = this.cw / 2;
    const pw = 520, ph = 254, px = cx - pw / 2, py = 300;
    const bw = 260, bh = 54, bx = cx - bw / 2, by = py + ph + 18;
    const dy = by + bh + 12, dH = 30, dW = 88, dGap = 10;
    const dTotal = dW * 3 + dGap * 2, dStartX = cx - dTotal / 2;
    const diff = ['gentle', 'normal', 'bold'].map((id, i) => ({ id, x: dStartX + i * (dW + dGap), y: dy, w: dW, h: dH, label: (DIFFICULTIES[id] || {}).label }));
    const abw = 200, abh = 44, aby = dy + dH + 12;
    // P9: two secondary buttons (Atelier + Options) as a symmetric pair centered
    // on the title. No test clicks them by coordinate (smoke calls _beginAtelier
    // directly), so this pair layout is free to tune.
    const gap = 24;
    const abx = cx - (abw + gap / 2), ox = cx + gap / 2, ow = abw, oh = abh, oy = aby;
    return { cx, pw, ph, px, py, bx, by, bw, bh, diff, abx, aby, abw, abh, ox, oy, ow, oh };
  }
  _setDifficulty(id) {
    if (!DIFFICULTIES[id] || this.options.difficulty === id) return;
    this.options.difficulty = id;
    SaveSys.saveOptions(this.options);
    this.tuning = makeTuning(this.save.upgrades, this.save.loadout, this.options.difficulty, this.save.galleryBonus || 0);
    this._prevHp = this.tuning.maxHp;
    this.sfx('ui');
  }

  // ---------------- M8 P9: options overlay (volume + accessibility) --------
  // Single source of truth for the options panel geometry so draw and input
  // never drift. Sliders are horizontal bars: value = (handleX - x) / w.
  _optionsLayout() {
    const cx = this.cw / 2, cy = this.ch / 2;
    const pw = 460, ph = 380, px = cx - pw / 2, py = cy - ph / 2;
    const padX = 46;
    const trackX = px + padX, trackW = pw - padX * 2;
    const row = (baseY) => ({ x: trackX, y: baseY, w: trackW, h: 22 });
    const yMusic = py + 112, ySfx = py + 178, yShake = py + 240, yVign = py + 278;
    const back = { x: cx - 90, y: py + ph - 66, w: 180, h: 46 };
    return { cx, cy, pw, ph, px, py, padX, trackX, trackW,
      music: row(yMusic), sfx: row(ySfx),
      shake: { x: trackX, y: yShake, w: trackW, h: 26 },
      vignette: { x: trackX, y: yVign, w: trackW, h: 26 },
      back };
  }
  _sliderValue(rect, val) {
    // handle center X for a value in [0,1]
    return rect.x + 10 + val * (rect.w - 20);
  }
  _openOptions() {
    if (this.optionsOpen) return;
    this.optionsOpen = true;
    this.audio.ensure();
    this.audio.startMusic();
    this.sfx('ui');
  }
  _closeOptions() {
    this.optionsOpen = false;
    this.sfx('ui-back');
  }
  _setVolume(key, v) {
    v = clamp(v, 0, 1);
    this.options[key] = v;
    if (key === 'musicVol') this.audio.setMusicVolume(v);
    else if (key === 'sfxVol') this.audio.setSfxVolume(v);
    else this.audio.setVolume(v);
    SaveSys.saveOptions(this.options);
  }
  _toggleOpt(key) {
    this.options[key] = !this.options[key];
    SaveSys.saveOptions(this.options);
    this.sfx('ui');
  }
  _updateOptions() {
    const g = this._optionsLayout();
    const m = this.input.mouse;
    // Back / Escape / O / Enter closes.
    if (this.input.pressed('escape') || this.input.pressed('o') || this.input.pressed('enter')) { this._closeOptions(); return; }
    if (this.input.pressed('m')) { this._muteToggle(); }
    if (m.lPressed) {
      // toggles (shake / vignette) take precedence on their rows
      if (this._mouseIn(g.shake.x, g.shake.y, g.shake.w, g.shake.h)) { this._toggleOpt('shake'); return; }
      if (this._mouseIn(g.vignette.x, g.vignette.y, g.vignette.w, g.vignette.h)) { this._toggleOpt('vignette'); return; }
      if (this._mouseIn(g.back.x, g.back.y, g.back.w, g.back.h)) { this._closeOptions(); return; }
      // sliders: a fresh press on the track jumps the handle AND starts a drag
      const hit = (r) => m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y - 8 && m.y <= r.y + r.h + 8;
      if (hit(g.music)) { this._setVolume('musicVol', clamp((m.x - g.music.x - 10) / (g.music.w - 20), 0, 1)); this.input.dragging = 'musicVol'; return; }
      if (hit(g.sfx)) { this._setVolume('sfxVol', clamp((m.x - g.sfx.x - 10) / (g.sfx.w - 20), 0, 1)); this.input.dragging = 'sfxVol'; return; }
    }
    // dragging: update while the button is held
    if (this.input.dragging && m.lDown) {
      if (this.input.dragging === 'musicVol') this._setVolume('musicVol', clamp((m.x - g.music.x - 10) / (g.music.w - 20), 0, 1));
      else if (this.input.dragging === 'sfxVol') this._setVolume('sfxVol', clamp((m.x - g.sfx.x - 10) / (g.sfx.w - 20), 0, 1));
    }
    // release: clear the drag flag once the button is up
    if (this.input.dragging && !m.lDown) this.input.dragging = null;
  }
  _drawSliderTrack(c, rect, val, hover, mouseX, mouseY) {
    const y = rect.y + rect.h / 2;
    c.save();
    c.lineWidth = 6; c.lineCap = 'round';
    c.strokeStyle = 'rgba(43,35,32,0.25)';
    c.beginPath(); c.moveTo(rect.x, y); c.lineTo(rect.x + rect.w, y); c.stroke();
    const hx = this._sliderValue(rect, val);
    c.strokeStyle = INK;
    c.beginPath(); c.moveTo(rect.x, y); c.lineTo(hx, y); c.stroke();
    // handle
    c.beginPath(); c.arc(hx, y, 9, 0, TAU);
    c.fillStyle = hover ? '#f4ead8' : PAPER; c.fill();
    c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
    c.restore();
  }
  _drawToggle(c, rect, label, on) {
    c.save();
    centerText(c, label, rect.x + 12, rect.y + rect.h / 2, '600 15px Georgia, serif', INK, 0.92);
    // pill
    const pw = 56, ph = 28, pxx = rect.x + rect.w - pw, pyy = rect.y + (rect.h - ph) / 2;
    roundRectPath(c, pxx, pyy, pw, ph, ph / 2);
    c.fillStyle = on ? '#7fae6a' : 'rgba(43,35,32,0.28)'; c.fill();
    c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    // knob
    c.beginPath(); c.arc(on ? pxx + pw - ph / 2 : pxx + ph / 2, pyy + ph / 2, ph / 2 - 4, 0, TAU);
    c.fillStyle = PAPER; c.fill(); c.lineWidth = 1.5; c.strokeStyle = INK; c.stroke();
    c.restore();
  }
  _drawOptions(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(30,25,22,0.6)';
    ctx.fillRect(0, 0, this.cw, this.ch);
    ctx.restore();
    const g = this._optionsLayout();
    const c = paperPanel(ctx, g.px, g.py, g.pw, g.ph, { seed: 61 });
    centerText(c, 'Options', g.cx, g.py + 44, '700 30px Georgia, serif');
    centerText(c, 'M to mute · Esc / O to close', g.cx, g.py + 74, 'italic 12px Georgia, serif', INK, 0.65);
    const m = this.input.mouse;
    const hot = (r) => m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y - 8 && m.y <= r.y + r.h + 8;
    // music slider
    centerText(c, 'Music', g.trackX, g.music.y - 18, '700 14px Georgia, serif', INK, 0.9);
    centerText(c, Math.round(this.options.musicVol * 100) + '%', g.trackX + g.trackW, g.music.y - 18, '700 13px Georgia, serif', INK, 0.8);
    this._drawSliderTrack(c, g.music, this.options.musicVol, hot(g.music), m.x, m.y);
    // sfx slider
    centerText(c, 'Sound effects', g.trackX, g.sfx.y - 18, '700 14px Georgia, serif', INK, 0.9);
    centerText(c, Math.round(this.options.sfxVol * 100) + '%', g.trackX + g.trackW, g.sfx.y - 18, '700 13px Georgia, serif', INK, 0.8);
    this._drawSliderTrack(c, g.sfx, this.options.sfxVol, hot(g.sfx), m.x, m.y);
    // toggles
    this._drawToggle(c, g.shake, 'Screen shake', this.options.shake);
    this._drawToggle(c, g.vignette, 'Low-HP vignette', this.options.vignette);
    // back
    uiButton(ctx, g.back.x, g.back.y, g.back.w, g.back.h, 'Back', this._mouseIn(g.back.x, g.back.y, g.back.w, g.back.h), false, { seed: 62, size: 16, mouseX: m.x, mouseY: m.y, mouseClicked: false });
    paperEnd(ctx);
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

    // M8 P7: single source of truth for every title-screen rect (shared with the
    // click handling in _updateTitle).
    const g = this._titleLayout();
    const { pw, ph, px, py } = g;

    // controls card
    const c = paperPanel(ctx, px, py, pw, ph, { seed: 11 });
    centerText(c, 'The swamp is fading to gray.', cx, py + 34, '600 17px Georgia, serif');
    centerText(c, 'Paint it back to color — then face the Great Gray Heron.', cx, py + 58, '600 17px Georgia, serif');
    const rows = [
      ['Move', 'WASD / arrow keys'],
      ['Paint', 'hold left mouse, aim with the cursor'],
      ['Splash burst', 'hold right mouse, release'],
      ['Dodge hop', 'space — brief invulnerability'],
      ['Pigments', '1 red burns · 2 blue chills · 3 green heals'],
      ['Pause', 'P or Esc'],
    ];
    rows.forEach((r, i) => {
      const ry = py + 96 + i * 28;
      centerText(c, r[0], px + 110, ry, '700 14px Georgia, serif', INK, 0.9);
      centerText(c, r[1], px + 330, ry, '14px Georgia, serif', INK, 0.8);
    });
    paperEnd(ctx);

    // start button (visual; Enter/Space handled in _updateTitle).
    // DoD #2: "Continue" when a valid save exists, "New Game" otherwise —
    // a returning player should see the difference without reading the footer.
    const b = this.save.bank;
    const hasProgress = this.save.stats.expeditions > 0 || this.save.owned.length > 0 ||
      b.red > 0 || b.blue > 0 || b.green > 0 || this.save.loadout.length > 0 ||
      (this.save.upgrades && (this.save.upgrades.power > 0 || this.save.upgrades.vitality > 0 || this.save.upgrades.capacity > 0));
        uiButton(ctx, g.bx, g.by, g.bw, g.bh, hasProgress ? 'Continue Expedition' : 'Begin Expedition', this._mouseIn(g.bx, g.by, g.bw, g.bh), false, { seed: 5, size: 20, mouseX: this.input.mouse.x, mouseY: this.input.mouse.y, mouseClicked: false });
        // M8 P7: difficulty pills (Gentle / Normal / Bold) between the two buttons.
        centerText(ctx, 'difficulty', cx - g.diff[0].x + 34, g.diff[0].y + 20, '11px Georgia, serif', INK, 0.55);
        for (const p of g.diff) {
          const sel = this.options.difficulty === p.id;
          const hov = this._mouseIn(p.x, p.y, p.w, p.h);
          ctx.save();
          ctx.globalAlpha = sel ? 1 : (hov ? 0.92 : 0.78);
          roundRectPath(ctx, p.x, p.y, p.w, p.h, 8);
          ctx.fillStyle = sel ? '#3a5a3f' : (hov ? '#e8dcc4' : '#f2e8d4');
          ctx.fill();
          ctx.lineWidth = sel ? 2.4 : 1.4;
          ctx.strokeStyle = sel ? '#2b4a34' : INK;
          ctx.stroke();
          centerText(ctx, p.label, p.x + p.w / 2, p.y + p.h / 2 + 4, sel ? '700 13px Georgia, serif' : '12px Georgia, serif', sel ? '#fdf6e9' : INK, sel ? 1 : 0.85);
          ctx.restore();
        }
        // atelier button (visual; A / click handled in _updateTitle)
        uiButton(ctx, g.abx, g.aby, g.abw, g.abh, 'Visit the Atelier', this._mouseIn(g.abx, g.aby, g.abw, g.abh), false, { seed: 6, size: 15 });
        // P9: options button (visual; O / click handled in _updateTitle)
        uiButton(ctx, g.ox, g.oy, g.ow, g.oh, 'Options', this._mouseIn(g.ox, g.oy, g.ow, g.oh), false, { seed: 7, size: 15 });

        // little footer stats
        const s = this.save.stats;
        centerText(ctx, `expeditions ${s.expeditions}   ·   victories ${s.victories}   ·   herons painted ${s.heronsPainted}`, cx, g.aby + g.abh + 18, 'italic 13px Georgia, serif', '#fdf6e9', 0.7);
        const br = this.save.bestRun;
        if (br) {
          const what = br.cleared ? `cleared with ${br.pigments} pigment` : `lasted ${br.time}s`;
          centerText(ctx, `best run — ${what}`, cx, g.aby + g.abh + 38, '700 14px Georgia, serif', '#e8c86a', 0.95);
        }
        centerText(ctx, 'G/N/B to set difficulty · M to mute · A for the atelier · "New Game" = erase save (bottom left)', cx, g.aby + g.abh + (br ? 58 : 38), '12px Georgia, serif', '#fdf6e9', 0.5);
        // erase-save link (bottom-left; two-click confirm, see _updateTitle)
        const ex = 16, ey = this.ch - 40;
        const armed = (this.now - (this._eraseArm || -99)) < 3;
        centerText(ctx, armed ? 'click again to erase save data…' : 'erase save data', ex + 120, ey + 14, armed ? '700 12px Georgia, serif' : '11px Georgia, serif', armed ? '#d8543c' : 'rgba(253,246,233,0.45)', armed ? 1 : 0.8);
      }

  // M8 P6: the "?" field guide. A single source of truth for its layout so the
  // click handling (in the frame router) and the draw never drift apart.
  _helpGeom() {
    const cx = this.cw / 2, cw = this.cw;
    const pw = 720, ph = 470, px = cx - pw / 2, py = 150;
    return { cx, pw, ph, px, py,
      close: { x: px + pw - 120, y: py + 18, w: 100, h: 40 } };
  }

  _drawHelp(ctx) {
    const g = this._helpGeom();
    ctx.save();
    ctx.fillStyle = 'rgba(30,25,22,0.62)';
    ctx.fillRect(0, 0, this.cw, this.ch);
    ctx.restore();
    const c = paperPanel(ctx, g.px, g.py, g.pw, g.ph, { seed: 71 });
    this._leftText(c, 'Field Guide', g.px + 40, g.py + 38, '700 26px Georgia, serif', INK, 1);
    this._leftText(c, 'the run is paused — take your time', g.px + 40, g.py + 62, 'italic 13px Georgia, serif', INK, 0.6);
    // close button
    uiButton(ctx, g.close.x, g.close.y, g.close.w, g.close.h, 'Close (H)', this._mouseIn(g.close.x, g.close.y, g.close.w, g.close.h), false, { seed: 75, size: 14 });

    const colL = g.px + 34, colR = g.px + g.pw / 2 + 14, colW = g.pw / 2 - 58;
    const y0 = g.py + 96;
    // ---- left column: painting (the pigments) ----
    c.save(); c.font = '700 16px Georgia, serif'; c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('Painting — your brush', colL, y0); c.restore();
    const pig = [
      ['1', PIGMENTS.red.color, 'Crimson', 'burn — damage over time, ignores armor; your main weapon'],
      ['2', PIGMENTS.blue.color, 'Cobalt', 'slow, then a second coat within 1s freezes solid'],
      ['3', PIGMENTS.green.color, 'Moss', 'root ground enemies (flies are immune); heals the frog'],
    ];
    pig.forEach((r, i) => {
      const y = y0 + 34 + i * 58;
      c.fillStyle = r[1]; c.beginPath(); c.arc(colL + 12, y, 11, 0, TAU); c.fill();
      c.lineWidth = 1.6; c.strokeStyle = INK; c.stroke();
      c.fillStyle = INK; c.font = '700 15px Georgia, serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(`${r[2]} (key ${r[0]})`, colL + 32, y);
      c.font = '13px Georgia, serif'; c.fillStyle = 'rgba(43,35,32,0.8)';
      this._wrapHelp(c, r[3], colL + 32, y + 16, colW - 32, 14);
    });
    c.font = '13px Georgia, serif'; c.fillStyle = 'rgba(43,35,32,0.7)'; c.textAlign = 'left'; c.textBaseline = 'middle';
    this._wrapHelp(c, 'Hold left mouse to paint, aim with the cursor. Hold right mouse to charge a Splash burst, release to fire. A dry brush (no pigment) still deals half damage and never runs out.', colL, y0 + 34 + 3 * 58 + 6, colW, 14);

    // ---- right column: counterplay + the heron ----
    c.save(); c.font = '700 16px Georgia, serif'; c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('Know your quarry', colR, y0); c.restore();
    const foes = [
      ['Mud Beetle', 'armored — burn (red) ignores its shell. Don\u2019t just chip it.'],
      ['Mosquito', 'fast and airborne — blue slows it; it ignores root.'],
      ['Grumpy Toad', 'tanky — paint it dizzy (green) for a 1.5× open shot.'],
    ];
    foes.forEach((r, i) => {
      const y = y0 + 34 + i * 48;
      c.font = '700 14px Georgia, serif'; c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(r[0], colR, y);
      c.font = '13px Georgia, serif'; c.fillStyle = 'rgba(43,35,32,0.8)';
      this._wrapHelp(c, r[1], colR, y + 15, colW, 13);
    });
    const hy = y0 + 34 + 3 * 48 + 12;
    c.font = '700 15px Georgia, serif'; c.fillStyle = '#8d7bb0'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('The Great Gray Heron', colR, hy);
    c.font = '13px Georgia, serif'; c.fillStyle = 'rgba(43,35,32,0.85)';
    this._wrapHelp(c, 'Watch the telegraph (a glow before it strikes). Move off the marked line when it swoops, sweeps, or dives. It gathers reinforcements and grows fiercer the lower its health falls — keep painting to keep it stunned.', colR, hy + 16, colW, 14);

    // footer
    centerText(c, 'WASD / arrows to move  ·  Space to hop (brief invulnerability)  ·  P to pause  ·  M to mute', g.cx, g.py + g.ph - 22, 'italic 13px Georgia, serif', INK, 0.6);
    paperEnd(ctx);
  }

  // tiny word-wrap helper for the field guide (keeps long lines tidy)
  _wrapHelp(c, text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '', yy = y;
    c.textAlign = 'left'; c.textBaseline = 'middle';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (c.measureText(test).width > maxW && line) {
        c.fillText(line, x, yy); line = w; yy += lh;
      } else line = test;
    }
    if (line) c.fillText(line, x, yy);
    return yy;
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