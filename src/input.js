// input.js — keyboard + mouse, screen-anchored so the canvas can letterbox.
'use strict';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.kb = new Set();         // "just pressed this frame" (consumed on read)
    this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, lDown: false, rDown: false, lPressed: false, rPressed: false, wheel: 0 };
    this._bind(canvas);
  }

  _bind(cv) {
    this._kd = (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.kb.add(k);
      this.keys.add(k);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    };
    this._ku = (e) => { this.keys.delete(e.key.toLowerCase()); };
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.lDown = false; this.mouse.rDown = false; });

    this._mm = (e) => {
      const r = cv.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    };
    this._md = (e) => {
      this._mm(e);
      if (e.button === 0) { this.mouse.lDown = true; this.mouse.lPressed = true; }
      if (e.button === 2) { this.mouse.rDown = true; this.mouse.rPressed = true; }
    };
    this._mu = (e) => {
      if (e.button === 0) this.mouse.lDown = false;
      if (e.button === 2) this.mouse.rDown = false;
    };
    this._cm = (e) => e.preventDefault();
    this._wh = (e) => { this.mouse.wheel += Math.sign(e.deltaY); };

    cv.addEventListener('mousemove', this._mm);
    cv.addEventListener('mousedown', this._md);
    window.addEventListener('mouseup', this._mu);
    cv.addEventListener('contextmenu', this._cm);
    cv.addEventListener('wheel', this._wh, { passive: true });
  }

  // Camera transform: screen <-> world
  setView(view) { this._view = view; }
  update() {
    const v = this._view;
    if (v) {
      this.mouse.worldX = this.mouse.x / v.scale + v.ox - v.x;
      this.mouse.worldY = this.mouse.y / v.scale + v.oy - v.y;
    }
  }
  pressed(k) { return this.kb.has(k); }
  down(k) { return this.keys.has(k); }
  moveVec() {
    let x = 0, y = 0;
    if (this.down('a') || this.down('arrowleft')) x -= 1;
    if (this.down('d') || this.down('arrowright')) x += 1;
    if (this.down('w') || this.down('arrowup')) y -= 1;
    if (this.down('s') || this.down('arrowdown')) y += 1;
    if (x || y) { const l = Math.hypot(x, y); return [x / l, y / l]; }
    return [0, 0];
  }
  endFrame() {
    this.kb.clear();
    this.mouse.lPressed = false;
    this.mouse.rPressed = false;
    this.mouse.wheel = 0;
  }
}