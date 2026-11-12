// input.js — keyboard + mouse, screen-anchored so the canvas can letterbox.
'use strict';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.kb = new Set();         // "just pressed this frame" (consumed on read)
    // W1 (v1.6 Module W): the PHYSICAL keyboard's held keys, tracked separately
    // from `keys` (which the gamepad feed also writes into). The feed uses
    // `_phys` to honor "keyboard always wins": it never overwrites/clears a key
    // the player is physically holding. Zero behavioral change for the
    // keyboard/mouse paths — `keys`/`kb` are driven exactly as before.
    this._phys = new Set();
    this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, lDown: false, rDown: false, lPressed: false, rPressed: false, rReleased: false, wheel: 0, _physR: false, _physL: false };
    this.dragging = null;        // P9: name of the UI element being dragged (or null)
    this.chars = [];             // Q3 (v1.6): printable chars typed THIS frame — the
    // paste field reads them while `_fieldFocus` is true. Consumed by
    // `endFrame()`. Guarded: empty when the game never sets `_fieldFocus`, so the
    // keyboard/mouse paths are byte-identical to the pre-Q3 baseline.
    this._fieldFocus = false;
    this.captureEnabled = false;
    this.pointerLocked = false;
    this._capturePending = false;
    this._bind(canvas);
  }

  _bind(cv) {
    this._kd = (e) => {
      if (this._textOwner) return; // Native postcard editor owns text, including shortcuts.
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.kb.add(k);
      this.keys.add(k);
      this._phys.add(k);       // W1: the physical keyboard holds this (the pad feed checks _phys)
      // Q3 (v1.6): when the paste field is focused, capture printable chars (and
      // Backspace) so the player can paste/type the save blob into it. Only runs
      // when `_fieldFocus` is set, so it is inert everywhere else.
      if (this._fieldFocus) {
        if (e.key === 'Backspace') this.chars.push('\b');
        else if (e.key.length === 1) this.chars.push(e.key);
      }
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    };
    this._ku = (e) => { const k = e.key.toLowerCase(); this.keys.delete(k); this._phys.delete(k); };
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    this._blur = () => { this.reset(); if (this.pointerLocked) this.onCaptureLost?.(); };
    window.addEventListener('blur', this._blur);

    this._mm = (e) => {
      const r = cv.getBoundingClientRect();
      if (this.pointerLocked) {
        this.mouse.x += (e.movementX || 0) * cv.width / (r.width || cv.width);
        this.mouse.y += (e.movementY || 0) * cv.height / (r.height || cv.height);
        this.mouse.x = Math.max(0, Math.min(cv.width, this.mouse.x));
        this.mouse.y = Math.max(0, Math.min(cv.height, this.mouse.y));
      } else {
        this.mouse.x = (e.clientX - r.left) * cv.width / (r.width || cv.width);
        this.mouse.y = (e.clientY - r.top) * cv.height / (r.height || cv.height);
      }
      // Movement samples aim before the next simulation-side input refresh.
      // Resolve a new move/click now so its first stroke uses this pointer,
      // rather than the previous frame's direction through a moving camera.
      this.update();
    };
    this._md = (e) => {
      if (!this.pointerLocked) this._mm(e);
      if ((e.button === 0 || e.button === 2) && this.captureEnabled) this.capturePointer();
      if (e.button === 0) { this.mouse.lDown = true; this.mouse.lPressed = true; this.mouse._physL = true; }
      if (e.button === 2) { this.mouse.rDown = true; this.mouse.rPressed = true; this.mouse._physR = true; } // W1: physical RMB (the pad feed checks this)
    };
    this._mu = (e) => {
      if (e.button === 0) { this.mouse.lDown = false; this.mouse._physL = false; }
      if (e.button === 2) { this.mouse.rReleased = this.mouse.rDown; this.mouse.rDown = false; this.mouse._physR = false; }
    };
    this._cm = (e) => e.preventDefault();
    this._wh = (e) => { this.mouse.wheel += Math.sign(e.deltaY); };

    cv.addEventListener('mousemove', e => { if (!this.pointerLocked) this._mm(e); });
    this._lockedMove = e => { if (this.pointerLocked) this._mm(e); };
    document.addEventListener?.('mousemove', this._lockedMove);
    this._lockChange = () => {
      const wasLocked = this.pointerLocked;
      this.pointerLocked = document.pointerLockElement === cv;
      this._capturePending = false;
      if (this.pointerLocked && !this.captureEnabled) { document.exitPointerLock?.(); return; }
      if (wasLocked && !this.pointerLocked) {
        this.reset();
        if (this.captureEnabled) this.onCaptureLost?.();
      }
    };
    document.addEventListener?.('pointerlockchange', this._lockChange);
    document.addEventListener?.('pointerlockerror', () => { this._capturePending = false; });
    cv.addEventListener('mousedown', this._md);
    window.addEventListener('mouseup', this._mu);
    cv.addEventListener('contextmenu', this._cm);
    cv.addEventListener('wheel', this._wh, { passive: true });
  }

  // Called only from a canvas mouse gesture: Chrome requires user activation.
  // Keep absolute-position input as a fallback when capture is unavailable.
  capturePointer() {
    if (!this.captureEnabled || this.pointerLocked || this._capturePending || !this.canvas.requestPointerLock) return;
    this._capturePending = true;
    try {
      const request = this.canvas.requestPointerLock();
      request?.catch?.(() => { this._capturePending = false; });
    } catch { this._capturePending = false; }
  }
  setCaptureMode(enabled) {
    this.captureEnabled = !!enabled;
    if (!enabled && document.pointerLockElement === this.canvas) {
      this.reset();
      document.exitPointerLock?.();
    }
  }

  // Camera transform: screen <-> world.
  // view = { x, y (world coords of screen top-left), scale, w, h }
  reset() {
    this.keys.clear(); this.kb.clear(); this._phys.clear();
    Object.assign(this.mouse, { lDown: false, rDown: false, lPressed: false, rPressed: false, rReleased: false, _physR: false, _physL: false, wheel: 0 });
    this.dragging = null; this.chars.length = 0;
  }
  setView(view) { this._view = view; }
  update() {
    const v = this._view;
    if (v) {
      this.mouse.worldX = this.mouse.x / v.scale + v.x;
      this.mouse.worldY = this.mouse.y / v.scale + v.y;
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
    this.mouse.rReleased = false;
    this.mouse.wheel = 0;
    this.chars.length = 0;      // Q3 (v1.6): consumed the frame's typed chars
  }
}
