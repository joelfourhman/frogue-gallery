// game.js — Frogue Gallery orchestrator: main loop, camera, state machine,
// combat wiring, HUD, title / pause / end screens.
'use strict';
import { clamp, lerp, dist, approach, TAU, mulberry32, traceBlob } from './math.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Paint } from './paint.js';
import { spawnEnemy, drawEnemy } from './enemies.js';
import { MOTH_NOOK, mothEncounterAllowed, mothCanSpawn, mothReward } from './logic.js';
import { Input } from './input.js';
import { FieldStudio, sketchbookButton, bookLayout, drawSketchbook, exportPostcard, editPostcardTitle, finishPostcardTitle, drawPostcard } from './studio.js';
import { atlasButton, atlasLayout, drawFieldAtlas } from './atlas.js';
import { exhibitSketchPage, studyRewardEarned, cycleCombatPigment, splashChargeStep, bossArenaReached } from './logic.js';
import { drawCombatReadout } from './combat-ui.js';
import { CAMPAIGN, createCampaignRun, campaignFloor, finishCampaignFloor, chooseCampaignReward, applyCampaignRewards } from './logic.js';
import { drawDungeonCamp, dungeonCampLayout, drawDungeonProgress, drawDungeonRoute } from './dungeon.js';
import { drawJourneyWorld, drawJourneyHud, drawRunBuild } from './journey-ui.js';
import { OpeningEncounter } from './encounter.js';
import { AudioSys } from './audio.js';
import { ParticleSystem } from './particles.js';
import { SaveSys } from './save.js';
import { PIGMENTS, ENEMIES, makeTuning, DIFFICULTIES, bossStep, freshSave, costArray, MID_HERON, midHeronAllowed, weatherFor, weatherFactor, BOLD_HAZARDS, boldHazardsAllowed, placeZoneHazards, orbStreakMult, orbStreakState, ORB_STREAK, revealProgress as revealProgressOf, tutorialDrillSatisfied, SKETCH_HERON, retrainAllowed, STORM_SURGE, stormSurgeFor, stormSurgeRainPhase, LANTERN, lightFactor, reedsUnlocked, REEDS_CREATURES, REEDS_BESTIARY, SILT_WYRM, wyrmStep, wyrmSurfacePoint, WARDEN, wardenStep, wardenSurfacePoint, wardenTasteFactor, wardenFuelSiphon, REEDS_DARK_LANTERN, lanternTickFor, lanternRadiusFor, lanternLightFactor, UMBRA_WYRM, umbrStep, umbrSurfacePoint, umbraFuelSiphon, umbrDeepDark, umbraPaintable, GAMEPAD_MAP, gamepadActive, GAMEPAD_INACTIVITY_MS, ROUTE_WAYPOINT_CAP, validateSaveBlob, pickWanderSeed, wanderContent, wanderTaste, GAME_VERSION, CROSSING, strokeTouchesCrossing, inCrossingZone, pinSketchPage, unpinSketchPage } from './logic.js';
import { UI, uiFont, INK, PAPER, centerText, outlineText, paperPanel, paperEnd, uiButton, drawPips, sat, mixColor, roundRectPath } from './ui.js';

// P5: 4 named expedition zones + a rest checkpoint between each — structure
// the run so a full expedition reads as a journey, not one long hallway.
// M8 P12: each zone carries a distinct accent color and a `sig` signature
// encounter — one larger, bolder "guardian" of the zone's signature enemy that
// wears the zone's accent ring. The zone reads as a place, not a repeat.
export const ZONES = [
  { x: 0.24, name: 'Reed Flats',   accent: '#c9a94e', tip: 'Reed Flats — the swamp breathes. Beetles chew through the reeds.',   mix: { beetle: 2, mosquito: 2 },
    sig: { kind: 'beetle',   count: 1 } },
  { x: 0.44, name: 'Slick Hollow', accent: '#5a93c9', tip: 'Slick Hollow — mosquitos swarm the still water. Blue paint chills them.', mix: { mosquito: 4, beetle: 3 },
    sig: { kind: 'mosquito', count: 2 } },
  { x: 0.64, name: 'Bramble Thicket', accent: '#7fb069', tip: 'Bramble Thicket — toads lurk in the bramble. Paint them dizzy (green) for open shots.', mix: { toad: 2, mosquito: 3, beetle: 1 },
    sig: { kind: 'toad',     count: 1 } },
  { x: 0.82, name: 'The Gray Shore', accent: '#9a9a8f', tip: 'The Gray Shore — everything the swamp kept gathers here. Rest, then finish.', mix: { toad: 2, beetle: 3, mosquito: 2 },
    sig: { kind: 'beetle',   count: 1 } },
];
// Elite scaling for signature encounters (P12): bolder than a normal spawn of
// the same kind, but a single well-timed splash or a couple of swipes still
// handles it — they add character, not a wall.
export const ELITE = { hp: 1.9, dmg: 1.3, radius: 1.35, score: 3 };

// L3 (v1.4 "Make It Amazing"): breathing title + vignette/lighting. Pure,
// testable helpers (a headless smoke stage asserts their bounds/shape). All of
// L3's draw work uses only these + the existing living backdrop — the title
// camera drift (`titleT`) stays untouched, and the saturation swell is a
// DRAW-ONLY modulation of the worldColorSat read (it never writes world state,
// so the color-reveal single-source-of-truth invariant is preserved: the swell
// only affects the title backdrop).
// The title's saturation "breath": a slow 8 s sine swells 0.35 <-> 0.55.
export const TITLE_SAT_MIN = 0.35, TITLE_SAT_MAX = 0.55, TITLE_BREATH_PERIOD = 8;
export function titleColorSat(t) {
  const s = 0.5 - 0.5 * Math.cos((t / TITLE_BREATH_PERIOD) * TAU); // 0..1 eased
  return TITLE_SAT_MIN + (TITLE_SAT_MAX - TITLE_SAT_MIN) * s;
}
// The title TEXT "breath": a small scale/opacity oscillation (a few percent,
// a couple breaths per minute) so the title gently swells in and out — the
// spec's "scale/opacity oscillation". Pure: returns a delta in [0, TITLE_SWELL_MAX]
// (the caller folds it into a scale factor + a tiny alpha dip). 0.4 rad/s
// => ~15.7 s per breath (gentle). A sine that starts at rest (t=0 -> 0).
export const TITLE_SWELL_MAX = 0.04, TITLE_BREATH_FREQ = 0.4;
export function titleBreatheSwell(t) {
  return TITLE_SWELL_MAX * Math.sin(TITLE_BREATH_FREQ * t);
}
// Menu-item stagger: the i-th item fades in 0->1, starting at i*DELAY (a FADE s
// ease-in). Returns an alpha in [0,1] — items appear STAGGERED, not
// simultaneous. A slow 0.8 s fade with a 0.15 s stagger reads as a gentle,
// breathing menu reveal (all four items settle by ~1.25 s).
export const TITLE_ITEM_DELAY = 0.15, TITLE_ITEM_FADE = 0.8;
export function titleItemAlpha(t, i) {
  const a = (t - i * TITLE_ITEM_DELAY) / TITLE_ITEM_FADE;
  return clamp(a, 0, 1);
}
// Subtle always-on warm vignette (lighting polish): a soft edge darkening that
// is stronger at the corners (d01 in [0,1] = normalized distance from center)
// and faint near the middle. `damp` lets the low-HP red pulse coexist (it is
// composited on top). Pure; gated at the call site by options.vignette.
export function warmVignetteAlpha(d01, damp = 1) {
  const edge = clamp(d01, 0, 1);
  // ease toward the corners: quadratic so the middle stays nearly clear.
  const k = edge * edge;
  return clamp(0.16 * k * damp, 0, 1);
}

const HERON_Y = 800; // heron x is set per-run at world.w - 350 (P5)
const PLAYER_START_X = 260, PLAYER_START_Y = 750;
const ORB_COLORS = ['red', 'blue', 'green'];

// T1/T2 (v1.2 M13): the guided first expedition — a low-stakes teaching run on
// the opening zone, ONLY for a fresh save (no finished run, never skipped). It
// is a SEPARATE pre-run layer: it freezes the timed expedition clock (runT) and
// never touches the timed run's pacing. Coaxed goals are shown as on-screen
// chips (not text walls); each advances only when the player actually causes
// the real status/death. A SKIP button dismisses the whole run and persists
// save.flags.tutorialSkipped so it never reappears.
//   phase 'learn'  — T1: teach the three pigment effects, one at a time.
//   phase 'drills' — T2: explicit per-pigment "do it" drills; each advancement
//                    predicate reads the enemy's REAL status/death (see
//                    logic.tutorialDrillSatisfied) and persists
//                    save.tutorialDrills so "Watch me" (T4) can reference it.
//   phase 'sketch' — T3: a low-HP "sketch" heron (a re-use of the real heron's
//                    bossStep + 3-hue awaken machinery) as the final beat, so the
//                    30k-HP fight is a known pattern. Completing/skipping it
//                    records save.tutorialDrills.awaken.
// `pigment` is the brush color the player is asked to use; `enemy` the target
// kind; `drill` maps to save.tutorialDrills (persisted by the drills/sketch
// phases). T1 ships the three 'learn' goals; T2 the three 'drills' goals; T3
// appends the single 'sketch' goal.
const TUTORIAL_PHASES = [
  // T1 — learn the tools (coaxed goals; the enemy is placed close and pinned so
  // a first-timer can land the stroke without chasing it across the swamp).
  // Each goal advances only when the player actually causes the real effect.
  { phase: 'learn', pigment: 'red',   enemy: 'beetle',   drill: 'burn',
    chip: '1 · Hold paint on the beetle. Crimson burns.', done: 'The beetle burned away — red is your fire pigment.' },
  { phase: 'learn', pigment: 'blue',  enemy: 'mosquito', drill: 'freeze',
    chip: '2 · Paint the fly twice. Cobalt slows, then freezes.', done: 'Frozen solid — blue freezes flies on the spot.' },
  { phase: 'learn', pigment: 'green', enemy: 'toad',     drill: 'root',
    chip: '3 · Paint the toad. Moss roots it and heals you.', done: 'Rooted to the spot — green holds a target still and mends your wounds.' },
  // T2 — the interactive pigment drills: the SAME three effects as an explicit
  // per-pigment "do it" check, a LATER phase of this same guided run. The
  // advancement predicate reads the enemy's REAL status/death (a beetle that
  // actually DIED from burn / a mosquito actually frozen / a toad actually
  // rooted) — not "a brush stroke happened" — and each completion is persisted
  // to save.tutorialDrills so T3/T4 "Watch me" retraining can reference which
  // drills were completed.
  { phase: 'drills', pigment: 'red',   enemy: 'beetle',   drill: 'burn',
    chip: '1 · Burn this beetle. Hold left-click and aim at it.', done: 'Bolt drilled ✓ — the beetle died from your red burn.' },
  { phase: 'drills', pigment: 'blue',  enemy: 'mosquito', drill: 'freeze',
    chip: '2 · Freeze this fly. Keep painting until it stops.', done: 'Frozen drilled ✓ — the mosquito is locked solid.' },
  { phase: 'drills', pigment: 'green', enemy: 'toad',     drill: 'root',
    chip: '3 · Root this toad. Moss gives you breathing room.', done: 'Rooted drilled ✓ — the toad is nailed to the spot.' },
  // T3 — the final teaching beat: a low-HP "sketch" heron. It reuses the real
  // heron's bossStep + 3-hue awaken machinery at a few-hundred-HP scale so the
  // 30k-HP fight is a "known pattern", not a surprise. One goal — paint all
  // three hues to AWAKEN it (the 3-hue awaken loop). Completing it records
  // save.tutorialDrills.awaken=true; skipping the tutorial leaves it undone.
  { phase: 'sketch', pigment: 'red', drill: 'awaken',
    chip: 'Paint the heron with 1, then 2, then 3 to wake it.',
    done: 'The sketch heron wakes and blooms — you know its 3-hue rhythm now.' },
];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cw = canvas.width;
    this.ch = canvas.height;

    // ---------- persistence + tuning ----------
    this.save = SaveSys.load() || freshSave();
    this.options = SaveSys.loadOptions();
    this.tuning = makeTuning({}, [], this.options.difficulty);
    // B5: persistent storage unavailable (privacy mode, quota, disabled)? We
    // still run on the in-memory save, but surface a one-time warning so the
    // player knows progress may not survive a reload. storageOK forces the
    // store to resolve here so the flag is accurate at construction.
    this._storageOK = SaveSys.storageOK;

    // ---------- systems ----------
    this.input = new Input(canvas);
    this.input.onCaptureLost = () => {
      if (this.state === 'expedition' && !this.dying && !this._bookOpen && !this._atlasOpen && !this.help) {
        this.paused = true;
        this._pauseOpenT = 0;
      }
    };
    // W1 (v1.6 Module W): the GAMEPAD feed state. The poll runs every frame in
    // _frame and writes INTO this.input (kb/pressed/mouse) — it never invents
    // a new input path, so a controller drives the exact same move keys,
    // pigments, hop, splash and lantern the keyboard/mouse use. `connected`
    // + `lastActiveMs` feed the pure gamepadActive() engagement rule; the
    // `_gpWas*` mirrors are the per-button edge detectors (just-pressed).
    // `_gpBannerShown` gates the one-time "a gamepad was found" banner. All of
    // this is UI/input only — it never feeds runT, tuning, or spawn, so a
    // no-pad run is byte-identical to the pre-gamepad baseline.
    this._gp = { connected: false, id: null, lastActiveMs: -1,
      was: { move: { a: false, d: false, w: false, s: false }, pig1: false, pig2: false, pig3: false, hop: false, lantern: false, splash: false },
      bannerShown: false,
      // W2 (v1.6 Module W): menu focus state. `menu` is the active focus list
      // id (null outside the menu focus lists); `idx` the focused row; `mi`
      // remembers the last index per menu id so returning keeps the cursor.
      // `_gpMenuEdges` is the per-frame edge latch for the confirm/back keys
      // (a just-pressed A/B must fire exactly once).
      menu: null, idx: 0, mi: {}, _gpMenuEdges: null };
    this.audio = new AudioSys();
    this.audio.setVolume(this.options.volume);
    this.audio.setMusicVolume(this.options.musicVol);
    this.audio.setSfxVolume(this.options.sfxVol);
    this.audio.setMuted(this.options.muted);
    this.sfx = (n, o) => { if (this.audio.ctx) this.audio.sfx(n, o); };
    this.particles = new ParticleSystem();

    // ---------- world (persists as the title backdrop, re-seeded per run) ----------
    this.world = new World(mulberry32((Date.now() % 100000) | 0), (Date.now() % 99991) | 0);
    this.lantern = { fuel: 1, lit: true };
    this.lanternReeds = false;
    this._lanternGrad = null;      // cached radial gradient for the lit radius
    this._lanternGradR = -1;       // the radius the cache was built for

    // ---------- camera (world coords of screen center) ----------
    this.cam = { x: PLAYER_START_X, y: PLAYER_START_Y };
    this.zoom = 1;
    this.zoomTarget = 1;
    this.shake = 0;
    // J2 (v1.4): game-feel time control. `timeScale` scales the WORLD sim
    // (world/particles/enemies/player/runT) only — never UI, banners, shake,
    // or input. A hit-stop dips it briefly; it always recovers to 1. All of
    // J2's juice (slow-mo, white flash) is gated by options.shake.
    this.timeScale = 1;
    this._hitstopT = 0;       // remaining real seconds of the current dip
    this._hitstopScale = 1;   // the scale held during the dip
    this._whiteFlash = 0;     // boss-defeat white flash (0..1, fast decay)
    this._freezeFrames = 0;   // 1-frame pre-hit freeze (lunge connect)

    // ---------- state machine ----------
    this.state = 'title';       // 'title' | 'expedition' | 'end'
    this.paused = false;
    this.help = false;          // M8 P6: "?" reference overlay (pauses the run)
    this.optionsOpen = false;   // M8 P9: options overlay (volume sliders + toggles)
    // Q3 (v1.6): the Save export/import state. `_saveFieldText` holds the pasted
    // (or typed) blob the player is about to import; `_saveFieldFocus` is the
    // paste field's focus flag (mirrored onto input._fieldFocus so typed chars
    // are captured); `_saveBanner`/`_saveBannerT` are the one-line outcome banner
    // ("imported" / "that save did not look right — nothing was changed") + its
    // linger timer. All in-memory, never persisted.
    this._saveFieldText = '';
    this._saveFieldFocus = false;
    this._saveBanner = null;
    this._saveBannerT = 0;
    this.endKind = null;
    this.endT = 0;
    this.endGains = null;
    this._bloom = null;      // V2 (v1.2 M11): { x, y, t, dur } — heron awaken bloom
    this._bloomSurge = 0;    // V2: timed saturation surge (0..~0.14), decays to 0
    // M1 (v1.4): the first-victory cinematic beat — { t, dur, arpeggiated }.
    // Present only on a FRESH player's very first victory (a returning player
    // with the seen flag goes straight to the card); skippable by any input.
    this._cine = null;
    // M3 (v1.4): two subtle easter eggs — PURE presentation, in-memory only
    // (zero persisted state). (a) the title frog appreciates the attention:
    // hold 'F' ~0.5 s OR click the title frog 3x and it does a little
    // spin-and-blink + a unique chime + a one-time "didYouKnow" banner.
    // (b) painting the title frog (or the sleeping heron) with the DRY brush
    // leaves a tiny temporary smile/cheek-blush that fades in a few seconds.
    // Neither affects gameplay or pacing.
    this._eggFrog = { holdT: 0, clicks: 0, clickT: 0, stroke: 0, spin: -1, shown: false };
    this._eggBlush = { frog: -1, heron: -1 };   // remaining real-seconds per target
    // J5 (v1.4): screen-space floating "+n" HUD numbers (pop up + fade near the
    // pigment jars) + a short fading trail behind the frog on an orb streak.
    // Both are presentation only — never touch the measured runT.
    this._floats = [];       // [{ x, y, text, t, max, color }]
    this._streakTrail = [];  // [{ x, y, t, max }] — recent positions on a streak
    this._pauseOpenT = 0;    // J5: pause panel slide+fade clock (real time)
    // S1 (v1.9): the UI hover tick state. `_hoverIdx` is the index of the
    // focused-menu button the cursor is currently over (or -1 when none); the
    // frame-end hook fires 'ui-hover' only when the hover TARGET changes, so a
    // cursor resting on a button never re-ticks. (Pause open/close is handled
    // by direct swaps at the pause-transition sites, not here.)
    this._hoverIdx = -1;
    // J3 (v1.4): the camera's awaken-moment hold. The gray heron rising
    // triggers a ~1.2 s zoom-out + hold on the heron, then
    // the camera eases back to normal follow. Real-time presentation — it never
    // affects the measured runT.
    this._awakenHoldT = 0;
    // T1 (v1.2 M13): guided first expedition (tutorial) runtime state. A fresh
    // save (tutorialEligible) may enter it; it is fully skippable and is NOT
    // part of the timed expedition (the clock freezes while it runs).
    this.tutorial = null;    // null = not active; else { idx, target, frozen, done }
    // T3 (v1.2 M13): the low-HP "sketch" heron — a re-use of the real heron's
    // bossStep machinery that only ever appears in the guided teaching layer
    // (the 'sketch' phase) so the 30k-HP fight is a known pattern.
    this.sketchHeron = null; // null = absent; else a heron-like object
    // T4 (v1.2 M13): the Field Guide's "Watch me" retraining menu (in-run only).
    this.helpRetrain = false;
    this.now = 0;
    this.last = 0;
    this.titleT = 0;
    // L3: title-entry clock for the staggered menu fade-in (resets on each
    // return to the title so the menu breathes in again). Presentation only.
    this._titleShowT = 0;

    // ---------- expedition ----------
    this.player = null;
    this.paint = null;
    this.enemies = [];
    this.orbs = [];
    this.hazards = [];
    this.orbStreak = 0;
    this.heron = null;
    this.runT = 0; this._floorStartT = 0;
    this.spawnT = 3;
    this.score = 0;
    // E2 (v1.2 M10): weather/tide phases — a pending phase for the current zone
    // and the active phase (with live base tuning cached for clean expiry).
    this.weatherPending = null;   // { phase, atSec } for the zone we're in
    this.weatherActive = null;    // { phase, t, dur, base: {field:val,...} }
    this.weatherZoneI = -1;       // the zone index the pending phase belongs to
    this.weatherTriggerAt = 0;    // absolute runT at which the pending phase fires
    this.stock = { red: 0, blue: 0, green: 0 };
    this.collected = { red: 0, blue: 0, green: 0 };
    this.dying = false;
    this.dieT = 0;
    this.banners = [];

    // K9 (v1.5 M4): ONE-SHOT FIRST-SIGHT callouts for the v1.5 creatures.
    // PURE presentation, in-memory only (A1/M3-style one-time flags — the
    // M3 EGG A one-time flag is the model; deliberately NOT persisted, per
    // the K9 note "PREFER no new persist"). One boolean per creature; each
    // fires a single small banner the first time the creature is seen this
    // session and never repeats (session-lifetime, like the M3 EGG A flag —
    // NOT cleared per expedition).
    this._firstSight = { turtle: false, cragfrog: false, surge: false };

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

  _openSketchbook() {
    if (this.state === 'expedition') this.studio?.archive('unfinished');
    this._bookOpen = true;
    this._bookIndex = Math.max(0, (this.save.sketchbook || []).length - 1);
    this.input.reset(); this.sfx('ui');
  }

  _openAtlas() {
    if (this.state !== 'expedition' || this.dying || this.help || this._bookOpen || this._cine || this.heron?.flying > 0 || this.heron?.sinking > 0) return;
    this._atlasOpen = true;
    if (this.player) this.player.splashCharge = 0;
    this.input.reset(); this.sfx('ui');
  }

  _closeAtlas() { this._atlasOpen = false; this.input.reset(); this.sfx('ui-back'); }

  _updateAtlas() {
    const b = atlasLayout(this).close;
    if (this.input.pressed('v') || this.input.pressed('escape') ||
        (this.input.mouse.lPressed && this._mouseIn(b.x, b.y, b.w, b.h))) this._closeAtlas();
    else if (this.input.pressed('m')) this._muteToggle();
  }

  _closeSketchbook() { finishPostcardTitle(this); this._bookOpen = false; this.input.reset(); this.sfx('ui-back'); }

  _updateSketchbook() {
    const input = this.input, b = bookLayout(this), n = (this.save.sketchbook || []).length;
    if (this._bookEditor) {
      if (input.mouse.lPressed) for (const key of ['confirm', 'cancel']) {
        const r = b[key]; if (this._mouseIn(r.x, r.y, r.w, r.h)) finishPostcardTitle(this, key === 'confirm');
      }
      return;
    }
    if (input.pressed('j') || input.pressed('escape')) { this._closeSketchbook(); return; }
    let action = input.pressed('arrowleft') ? 'prev' : input.pressed('arrowright') ? 'next' : null;
    if (input.mouse.lPressed) for (const key of ['prev', 'next', 'export', 'close', 'pin', 'rename', 'exhibit']) {
      const r = b[key]; if (this._mouseIn(r.x, r.y, r.w, r.h)) action = key;
    }
    if (input.pressed('x')) action = 'pin';   // Q6: the pin toggle (a free key while the book is open)
    if (action === 'prev') this._bookIndex = Math.max(0, this._bookIndex - 1);
    if (action === 'next') this._bookIndex = Math.max(0, Math.min(n - 1, this._bookIndex + 1));
    if (action === 'export') exportPostcard(this);
    if (action === 'close') this._closeSketchbook();
    if (action === 'rename') editPostcardTitle(this);
    if (action === 'exhibit') {
      const pg = this.save.sketchbook?.[this._bookIndex];
      if (pg && this.save.sketchExhibit === pg.id) { this.save.sketchExhibit = null; SaveSys.save(this.save); }
      else if (pg && exhibitSketchPage(this.save, pg.id)) SaveSys.save(this.save);
    }
    if (action === 'pin') {
      // Q6: pin/unpin the open page. The pure rules (cap of 2, idempotence,
      // retention) live in logic.js; this is the interaction layer — the
      // toggle persists immediately so a pinned page survives any reload.
      const pg = (this.save.sketchbook || [])[this._bookIndex];
      if (!pg) return;
      if ((this.save.sketchPins || []).includes(pg.id)) {
        unpinSketchPage(this.save, pg.id);
        SaveSys.save(this.save); this.sfx('ui');
        this.addBanner('Unpinned — this page joins the rolling eight again.', 3.6, 150);
      } else if (pinSketchPage(this.save, pg.id)) {
        SaveSys.save(this.save); this.sfx('ui');
        this.addBanner('Pinned — this page will never age out of the sketchbook.', 3.6, 150);
      } else {
        this.sfx('ui');
        this.addBanner('Two pages are pinned — unpin one first.', 3.6, 150);
      }
    }
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
  // K9 (v1.5 M4): a one-shot first-sight callout. Fires a single banner the
  // first time a v1.5 creature is seen this session; a repeat call is a
  // no-op. Pure presentation — in-memory flag, never persisted, never feeds
  // runT or the pacing probes (it is a UI banner, like the M3 EGG A
  // one-time "didYouKnow" banner).
  _firstSightNote(key, text) {
    const f = this._firstSight;
    if (!f || f[key]) return false;
    f[key] = true;
    this.addBanner(text, 4.6, this.ch * 0.62);
    return true;
  }
  addShake(n) { this.shake = Math.max(this.shake, n); }

  // W1 (v1.6 Module W): the GAMEPAD feed — polled once per frame (called at the
  // TOP of _frame, before any state update reads input). It reads the raw
  // navigator.getGamepads() stream and WRITES into the existing input.js
  // kb/pressed/mouse APIs, so a controller drives the exact same move keys,
  // pigments, hop, splash and lantern the keyboard/mouse already use.
  //
  // Invariants (see the W1 roadmap row):
  //   - Off skips the poll entirely (options.gamepad === 'off').
  //   - Auto engages only while a pad is connected + recently active
  //     (gamepadActive). A fresh connection counts as active.
  //   - KEYBOARD ALWAYS WINS: the feed never adds a key the player is holding,
  //     and clears only a key it OWNS (still driving it, and the physical
  //     keyboard — input._phys — is not holding it). The pad can never fight
  //     the keyboard/mouse.
  //   - No pad connected (or disengaged) -> the feed writes nothing, so the
  //     in-run key state is byte-identical to the no-gamepad baseline.
  //   - 60fps: no per-frame allocation; a few array reads + writes into
  //     pre-existing Sets. The `was` edge-mirrors are reused, not rebuilt.
  _pollGamepad() {
    const gp = this._gp, inp = this.input;
    // Off disables the feed entirely — skip the poll (and clear the
    // connected flag so the W2 title chip goes away).
    if (this.options.gamepad === 'off') {
      gp.connected = false; gp.id = null; gp.lastActiveMs = -1;
      this._gpClearOwned();
      if (gp.menu) { gp.menu = null; gp._gpMenuEdges = null; }
      return;
    }
    // Raw Gamepad API (zero deps). navigator/getGamepads may be absent
    // (headless, privacy); treat as no pad.
    const pads = (typeof navigator !== 'undefined' && navigator.getGamepads)
      ? navigator.getGamepads() : null;
    let pad = null;
    if (pads) {
      for (let i = 0; i < pads.length; i++) if (pads[i]) { pad = pads[i]; break; }
    }
    const now = typeof performance !== 'undefined' ? performance.now() : (this.last || 0) * 1000;
    if (pad) {
      const id = pad.id || 'pad';
      const wasConnected = gp.connected;
      gp.connected = true; gp.id = id;
      // Any axis/button activity this frame keeps the feed engaged.
      const ax = (pad.axes || [0, 0]);
      const dxa = Math.max(Math.abs(ax[0] || 0), Math.abs(ax[2] || 0)), dya = Math.max(Math.abs(ax[1] || 0), Math.abs(ax[3] || 0));
      let active = dxa > GAMEPAD_MAP.deadzone || dya > GAMEPAD_MAP.deadzone;
      if (!active) { const bs = pad.buttons || []; for (let i = 0; i < bs.length; i++) if (bs[i] && bs[i].pressed) { active = true; break; } }
      if (active || !wasConnected) gp.lastActiveMs = now; // fresh connect counts
      // W2: the one-time "a gamepad was found" banner on the connect edge (Auto
      // legibility). Latched by gp.bannerShown so it fires at most once.
      if (!wasConnected && !gp.bannerShown && this.state === 'title') {
        gp.bannerShown = true;
        this.addBanner('A gamepad was found', 3.2);
      }
    } else {
      gp.connected = false; gp.id = null;
      // Lost the pad: disengage + clear any keys we own (keyboard unaffected),
      // and drop the menu focus (a focus cursor with no pad is meaningless).
      this._gpClearOwned();
      if (gp.menu) { gp.menu = null; gp._gpMenuEdges = null; }
      return;
    }
    // W2: context routing. The in-RUN feed (movement/pigment/splash/lantern)
    // only makes sense mid-expedition and is gated by the RECENCY rule
    // (gamepadActive) — a stale idle pad can't fight the keyboard/mouse. In
    // every OTHER state the same physical buttons become the full-screen MENU
    // focus (D-pad nav, A confirm, B back); the menu stays responsive for as
    // long as the pad is CONNECTED (no recency timeout — a player navigating
    // a menu shouldn't be dropped mid-choice). This split is what keeps W1's
    // in-run keys from leaking into the menus (space would Start the game,
    // 1/2/3 would select paint while another menu owns input).
    const inRun = this.state === 'expedition' && !this.dying && !this.paused && !this.help && !this._bookOpen && !this._atlasOpen;
    if (inRun) {
      // Recency gate: a stale in-run pad disengages + releases its keys.
      if (!gamepadActive(this.options, pad, now, gp.lastActiveMs, GAMEPAD_INACTIVITY_MS)) {
        this._gpClearOwned();
        return;
      }
      this._gpWrite(pad, now);
    } else {
      // Menu focus: responsive for as long as the pad is connected (above).
      this._gpMenuWrite(pad, now);
    }
  }

  // W2: the MENU focus write. Runs in every non-expedition state. D-pad up/down
  // move a focus cursor over the current screen's button list (wraps); A
  // synthesizes a mouse click AT the focused rect (the SAME _mouseIn + lPressed
  // machinery a mouse uses — so gamepad and mouse can't diverge); B backs out
  // one level. The focused list is computed fresh each frame from the current
  // state (so it tracks options/pause/help/end/title automatically).
  _gpMenuWrite(pad, now) {
    const gp = this._gp, inp = this.input;
    const focus = this._gpMenuList();
    const list = focus ? focus.list : null;
    if (!list || list.length === 0) { gp.menu = null; return; }
    const id = focus.id;
    // (Re)enter the menu: restore the remembered index (clamped) or start at 0.
    if (gp.menu !== id) {
      gp.menu = id;
      const saved = (id in gp.mi) ? gp.mi[id] : 0;
      gp.idx = Math.max(0, Math.min(saved, list.length - 1));
    } else {
      gp.idx = Math.max(0, Math.min(gp.idx, list.length - 1));
    }
    const bs = pad.buttons || [];
    const bdown = (i) => !!(bs[i] && bs[i].pressed);
    const M = GAMEPAD_MAP.menu;
    // per-frame edge latch (a just-pressed A/B fires exactly once).
    if (!gp._gpMenuEdges) gp._gpMenuEdges = { up: false, down: false, confirm: false, back: false };
    const e = gp._gpMenuEdges;
    const upNow = bdown(M.up), downNow = bdown(M.down), confirmNow = bdown(M.confirm), backNow = bdown(M.back);
    const upEdge = upNow && !e.up, downEdge = downNow && !e.down, confirmEdge = confirmNow && !e.confirm, backEdge = backNow && !e.back;
    // D-pad up/down move the highlight (wraps); keyboard up/down do the same
    // (so the cursor is also reachable with the arrows).
    const kbUp = inp.pressed('arrowup'), kbDown = inp.pressed('arrowdown');
    if (upEdge || kbUp) { gp.idx = (gp.idx - 1 + list.length) % list.length; gp.mi[id] = gp.idx; this.sfx('ui'); }
    if (downEdge || kbDown) { gp.idx = (gp.idx + 1) % list.length; gp.mi[id] = gp.idx; this.sfx('ui'); }
    // A confirms: synthesize a click at the focused rect's CENTER. The frame's
    // state update (which runs AFTER _pollGamepad) reads input.mouse + _mouseIn
    // and fires the same action a mouse click would — the SAME click machinery
    // (one call site, the existing mouse handler), so gamepad + mouse can't diverge.
    if (confirmEdge && !inp.mouse.lPressed) {
      const r = list[gp.idx];
      if (r && r.w > 0) {
        inp.mouse.x = r.x + r.w / 2;
        inp.mouse.y = r.y + r.h / 2;
        inp.mouse.lPressed = true;      // the same "just clicked" edge the mouse sets
        this.sfx('ui');
      }
    }
    // B backs out one level (per state).
    if (backEdge) { this._gpMenuBack(); }
    // advance the edge latch.
    e.up = upNow; e.down = downNow; e.confirm = confirmNow; e.back = backNow;
  }

  // W2: the current menu focus list. Returns { id, [rects] } where each rect is
  // { x, y, w, h } and matches the EXACT rect the mouse-click handler tests
  // (_mouseIn), so a synthesized A-click hits the same button. Computed from
  // the current state — options > pause > help > end > title order
  // of precedence (an open overlay owns the focus).
  _gpMenuList() {
    const g = this;
    if (g._atlasOpen) return { id: 'atlas', list: [atlasLayout(g).close] };
    if (g._bookOpen) { const b = bookLayout(g); const pg = (g.save.sketchbook || [])[g._bookIndex]; return g._bookEditor ? { id: 'postcard-title', list: [b.confirm, b.cancel] } : { id: 'sketchbook', list: [b.prev, b.next, b.export, b.close, ...(pg ? [b.pin, b.rename, ...((g.save.sketchPins || []).includes(pg.id) ? [b.exhibit] : [])] : [])] }; }
    if (g.state === 'title') {
      if (g.optionsOpen) {
        const o = g._optionsLayout();
        // the options focus list: the gamepad-mode toggle + the visual toggles
        // + back (the sliders are drag-only, not focus-steppable — a gamepad
        // can't scrub a slider without a horizontal cursor).
        return { id: 'options', list: [o.gpad, o.shake, o.vignette, o.grain, o.back] };
      }
      const t = g._titleLayout();
      const items = [ { rect: { x: t.bx, y: t.by, w: t.bw, h: t.bh } } ];        // Start
      // T1: the guided first expedition (fresh-save only) — it has its own
      // mouse-click handler, so it's a focusable item when visible.
      items.push({ rect: { x: t.tx, y: t.ty, w: t.tw, h: t.th } });
      t.diff.forEach((d) => items.push({ rect: d }));                           // difficulty pills
      items.push({ rect: { x: t.abx, y: t.aby, w: t.abw, h: t.abh } });          // Sketchbook
      items.push({ rect: { x: t.ox, y: t.oy, w: t.ow, h: t.oh } });              // Options
      return { id: 'title', list: [...items.map((i) => i.rect), sketchbookButton(g)] };
    }
    if (g.state === 'expedition') {
      if (g.help) {
        const h = g._helpGeom();
        const items = [ h.close ];
        if (h.retrain && h.retrain.enabled) h.retrain.buttons.forEach((b) => items.push(b));
        return { id: 'help', list: items };
      }
      if (g.paused) {
        const cx = g.cw / 2, cy = g.ch / 2, pw = 340, px = cx - pw / 2, py0 = cy - 160;
        return { id: 'pause', list: [
          { x: px, y: py0 + 164, w: pw, h: 44 },   // Resume
          { x: px, y: py0 + 216, w: pw, h: 44 },   // Quit to the Pond
          sketchbookButton(g),
          atlasButton(),
        ] };
      }
      return null;   // active in-run: no menu focus (W1 feed is active)
    }
    if(g.state==='camp'){const c=dungeonCampLayout(g);return{id:'camp',list:[...c.cards,...(g._campChoice?[c.descend]:[])]};}
    if (g.state === 'end') {
      const b = g._endButtons();
      const items = [ b.primary ];
      items.push(b.ret);
      return { id: 'end', list: [...items, sketchbookButton(g)] };
    }
    return null;
  }

  // W2: B backs out one level, per the current state.
  _gpMenuBack() {
    if (this._bookEditor) { finishPostcardTitle(this); return; }
    const g = this;
    if (g._atlasOpen) { g._closeAtlas(); return; }
    if (g._bookOpen) { g._closeSketchbook(); return; }
    if (g.state === 'camp') { g._campChoice=null; g._gp.idx=0; g.sfx('ui-back'); return; }
    if (g.state === 'title' && g.optionsOpen) { g._closeOptions(); g.sfx('ui-back'); return; }
    if (g.state === 'expedition' && g.help) { g.help = false; g.sfx('ui-back'); return; }
    if (g.state === 'expedition' && g.paused) { g.paused = false; g.sfx('ui'); return; }   // B resumes
    if (g.state === 'end') { g.sfx('ui-back'); g._quitToTitle(); return; }
    if (g.state === 'title') { g.sfx('ui-back'); }   // top level: nothing to back out of
  }

  // W2: the title "pad connected / pad gone" paper chip. A small pill in the
  // top-right that appears ONLY when a pad is connected (Auto) — the legibility
  // cue for the one-time "a gamepad was found" banner. Drawn on the title only
  // (the menu focus lists are what a pad drives on other screens).
  _gpChipVisible() {
    return this.state === 'title' && this._gp.connected && this.options.gamepad !== 'off';
  }
  _drawGpChip(ctx) {
    if (!this._gpChipVisible()) return;
    const x = this.cw - 152, y = 18, w = 134, h = 26, r = 13;
    ctx.save();
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = 'rgba(253,246,233,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,52,42,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    // a small pad glyph + label
    ctx.fillStyle = 'rgba(60,52,42,0.85)';
    ctx.font = uiFont(UI.sizes.label, { weight: 600 });
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('\u2726  pad connected', x + 12, y + h / 2 + 1);
    ctx.restore();
  }
  // W2: the full-screen gamepad focus highlight — a wobbly paper outline around
  // the focused button (the same rect the mouse-click handler tests). Drawn over
  // the focused rect in every menu state that has a focus list (a menu is open).
  _drawGpFocus(ctx) {
    if (this.options.gamepad === 'off') return;
    const gp = this._gp;
    if (!gp.menu) return;
    const focus = this._gpMenuList();
    const list = focus ? focus.list : null;
    if (!list || list.length === 0) return;
    const idx = Math.max(0, Math.min(gp.idx, list.length - 1));
    const r = list[idx];
    if (!r || r.w <= 0) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(212,168,60,0.95)';
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 5]);
    roundRectPath(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  // deadzone-thresholded move, and drives kb (just-pressed) + keys (held) for
  // the move/pigment/hop/lantern, and mouse.rDown for the splash charge.
  // KEYBOARD WINS: a key the player physically holds (input._phys) is never
  // cleared by the feed.
  _gpWrite(pad, now) {
    const gp = this._gp, inp = this.input, M = GAMEPAD_MAP;
    const axes = pad.axes || [0, 0];
    const ax = axes[M.axes.x] || 0, ay = axes[M.axes.y] || 0;
    // ---- movement: left stick -> a/d/w/s (deadzone 0.25) ----
    // (no per-frame allocation: the four booleans go straight to _gpDriveMove)
    const dz = M.deadzone;
    const sx = Math.abs(ax) > dz ? ax : 0;
    const sy = Math.abs(ay) > dz ? ay : 0;
    const wa = sx < 0, wd = sx > 0, ww = sy < 0, ws = sy > 0;
    if (wa || wd || ww || ws) gp.lastActiveMs = now; // stick alive
    this._gpDriveMove(wa, wd, ww, ws);
    // ---- discrete just-pressed buttons (pigments / hop / lantern) ----
    const btns = pad.buttons || [];
    const btn = (i) => !!(btns[i] && btns[i].pressed);
    this._gpDriveBtn(btn(0), 'pig1');   // A -> red ('1')
    this._gpDriveBtn(btn(2), 'pig2');   // X -> blue ('2')
    this._gpDriveBtn(btn(3), 'pig3');   // Y -> green ('3')
    this._gpDriveBtn(btn(5), 'hop');    // RB -> hop (' ')
    this._gpDriveBtn(btn(4), 'lantern'); // LB -> lantern ('l'; no-op off-Reeds)
    // Hold to charge, release to fire. Physical mouse ownership wins.
    this._gpDriveBtn(btn(9), 'pause');
    this._gpDriveBtn(btn(8), 'book');
    this._gpDriveBtn(btn(6), 'dry');
    const aimX = axes[2] || 0, aimY = axes[3] || 0;
    if (this.player && !inp.mouse._physL && Math.hypot(aimX, aimY) > dz) {
      const v = this._view(), mag = Math.hypot(aimX, aimY);
      inp.mouse.x = (this.player.x + aimX / mag * 120 - v.x) * v.scale;
      inp.mouse.y = (this.player.y + aimY / mag * 120 - v.y) * v.scale;
      inp.setView(v); inp.update(); gp.lastActiveMs = now;
    }
    if (btn(7) && !inp.mouse._physL) { inp.mouse.lDown = true; gp.paintOwned = true; }
    else if (gp.paintOwned) { if (!inp.mouse._physL) inp.mouse.lDown = false; gp.paintOwned = false; }
    const splashHeld = btn(M.splash);
    const physR = inp.mouse._physR;
    const feedHolds = splashHeld && !physR;
    if (feedHolds && !gp.was.splash) inp.mouse.rPressed = true;
    if (!feedHolds && gp.was.splash && !physR) inp.mouse.rReleased = true;
    if (feedHolds) {
      gp.lastActiveMs = now;
      inp.mouse.rDown = true;
    } else if (gp.was.splash) {
      if (!physR) inp.mouse.rDown = false; // pad released; the mouse may own it
    }
    gp.was.splash = feedHolds;
  }

  // W1: drive one MOVE key (a/d/w/s). The feed writes `keys` (+ a `kb` edge)
  // only when the pad wants the key AND the physical keyboard isn't holding it
  // (keyboard always wins). `was` mirrors which keys the feed OWNS (actually
  // wrote), so on release it clears only its own key — it never deletes a key
  // the keyboard is independently holding.
  _gpDriveMove(wa, wd, ww, ws) {
    const inp = this.input, was = this._gp.was.move, phys = inp._phys;
    // KEYBOARD ALWAYS WINS on the axis: while the physical keyboard holds any
    // movement key, the feed YIELDS movement entirely (releases the keys it
    // owns) so the two inputs can never fight on the same axis. The feed
    // re-acquires on the next frame the keyboard releases.
    const kbMove = phys.has('a') || phys.has('d') || phys.has('w') || phys.has('s')
      || phys.has('arrowleft') || phys.has('arrowright');
    if (kbMove) {
      const drop = (k) => { if (was[k]) { was[k] = false; if (!phys.has(k)) inp.keys.delete(k); } };
      drop('a'); drop('d'); drop('w'); drop('s');
      return;
    }
    const drive = (k, held) => {
      if (held && !phys.has(k)) {
        if (!inp.down(k)) inp.kb.add(k); // edge: just engaged this frame
        inp.keys.add(k);
        was[k] = true;
      } else if (!held && was[k] && !phys.has(k)) {
        inp.keys.delete(k); // pad released a key it owns -> drop ours
        was[k] = false;
      } else if (held && phys.has(k)) {
        was[k] = false; // keyboard owns it; the feed must not clear it
      }
    };
    drive('a', wa); drive('d', wd); drive('w', ww); drive('s', ws);
  }

  // W1: drive one DISCRETE button (pigment/hop/lantern) as a `kb` tap with the
  // same just-pressed semantics the keyboard path uses. A held pad button is
  // an edge ONCE (the kb set is cleared each frame), exactly like a keyboard
  // tap — and the physical key press, when it happens, simply shares the same
  // kb entry (keyboard wins trivially: it IS the same key event).
  _gpDriveBtn(pressed, tag) {
    const inp = this.input, was = this._gp.was;
    const key = { pig1: '1', pig2: '2', pig3: '3', hop: ' ', lantern: 'l', pause: 'p', book: 'j', dry: '4' }[tag];
    if (pressed && !was[tag]) {
      // Keyboard always wins on the same action: if the player is physically
      // holding this key, the feed writes nothing (the keyboard's own kb edge
      // already carries the tap).
      if (!inp._phys.has(key) && !inp.pressed(key)) {
        inp.kb.add(key);
        this._gp.lastActiveMs = typeof performance !== 'undefined' ? performance.now() : (this.last || 0) * 1000;
      }
    }
    was[tag] = pressed;
  }

  // W1: release every key/button the pad owns (used on disconnect /
  // disengage / Off) so the pad can't leave a stuck move or a held splash.
  // Keys the physical keyboard holds (input._phys) are never touched.
  _gpClearOwned() {
    const inp = this.input, was = this._gp.was;
    if (this._gp.paintOwned) { if (!inp.mouse._physL) inp.mouse.lDown = false; this._gp.paintOwned = false; }
    const phys = inp._phys;
    const drop = (k, owned) => { if (owned && !phys.has(k)) inp.keys.delete(k); };
    const m = was.move;
    drop('a', m.a); drop('d', m.d); drop('w', m.w); drop('s', m.s);
    was.move.a = was.move.d = was.move.w = was.move.s = false;
    const bk = { pig1: '1', pig2: '2', pig3: '3', hop: ' ', lantern: 'l', pause: 'p', book: 'j', dry: '4' };
    for (const t of ['pig1', 'pig2', 'pig3', 'hop', 'lantern', 'pause', 'book', 'dry']) if (was[t]) { drop(bk[t], was[t]); was[t] = false; }
    if (was.splash) { if (!inp.mouse._physR) inp.mouse.rDown = false; was.splash = false; }
  }

  // J2 (v1.4): a brief hit-stop. Holds timeScale at `scale` for `secs` of REAL
  // time (the frame loop restores it to 1 when the timer expires). Gated by
  // options.shake — with shake OFF, timeScale is never touched (the game runs
  // at normal speed). `scale` < 1 (a dip, never >1): a small hit dips to ~0.3
  // for 60–90 ms; the heron defeat dips to ~0.35 for ~0.8 s.
  hitStop(secs, scale) {
    if (!this.options.shake) return;
    if (scale >= 1) return;
    this._hitstopT = Math.max(this._hitstopT, secs);
    this._hitstopScale = Math.min(this._hitstopScale, scale);
    if (this._hitstopT > 0) this.timeScale = this._hitstopScale;
  }

  // J2 (v1.4): the boss-defeat white flash (render-only, decays in _frame).
  whiteFlash() { if (this.options.shake) this._whiteFlash = 1; }

  // J2 (v1.4): a 1-frame pre-hit freeze — the world sim holds for one frame
  // when the boss lunge connects (a tiny impact hitch). No-op when shake OFF.
  freezePreHit() { if (this.options.shake) this._freezeFrames = 1; }

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
    // Audio clock runs independently of simulation pauses and frame hit-stop.
    this.audio.setMusicScene(this);
    this.audio.tickMusic();
    const dt = clamp((t - this.last) / 1000, 0, 0.05);
    this.last = t;
    this.now = t / 1000;
    const atlasWasOpen = this._atlasOpen;
    this._pollGamepad();
    if (this._atlasOpen || atlasWasOpen) {
      if (this._atlasOpen) this._updateAtlas();
      this._drawAll(); this.input.endFrame(); return;
    }
    if (this._bookOpen) {
      this._updateSketchbook(); this._drawAll(); this.input.endFrame(); return;
    }
    if (this.state === 'expedition' && !this.dying && !this.help && !this._cine) {
      const a = atlasButton();
      if (this.input.pressed('v') || (this.paused && this.input.mouse.lPressed && this._mouseIn(a.x, a.y, a.w, a.h))) {
        this._openAtlas();
        if (this._atlasOpen) { this._drawAll(); this.input.endFrame(); return; }
      }
    }
    const bookButton = sketchbookButton(this);
    const bookMenu = (this.state !== 'expedition' || this.paused) && !this.optionsOpen && !this._cine;
    if (!this.input._fieldFocus && !this.optionsOpen && !this._cine &&
        (this.input.pressed('j') || (bookMenu && this.input.mouse.lPressed && this._mouseIn(bookButton.x, bookButton.y, bookButton.w, bookButton.h)))) {
      this._openSketchbook(); this._drawAll(); this.input.endFrame(); return;
    }
    this.shake *= Math.exp(-5.5 * dt);
    this.zoom = approach(this.zoom, this.zoomTarget, 10, dt);
    // J2 (v1.4): advance/expire the hit-stop on REAL time (never sim time).
    // While a dip is active, timeScale holds at the dip scale; otherwise it is
    // always back to 1. This is the single timeScale knob — it can never get
    // stuck below 1 because _hitstopT is finite and decremented every frame.
    if (this._hitstopT > 0) {
      this._hitstopT -= dt;
      this.timeScale = this._hitstopT > 0 ? this._hitstopScale : 1;
    } else if (this.timeScale !== 1) {
      this.timeScale = 1;
    }
    // J2: the boss-defeat white flash decays fast (real-time presentation).
    if (this._whiteFlash > 0) this._whiteFlash = Math.max(0, this._whiteFlash - dt * 3.2);
    // J5 (v1.4): HUD floating numbers + the orb-streak trail decay on real time
    // (they are UI/presentation, not world sim).
    for (let fi = this._floats.length - 1; fi >= 0; fi--) {
      const f = this._floats[fi]; f.t += dt; if (f.t >= f.max) this._floats.splice(fi, 1);
    }
    for (let si = this._streakTrail.length - 1; si >= 0; si--) {
      const s = this._streakTrail[si]; s.t += dt; if (s.t >= s.max) this._streakTrail.splice(si, 1);
    }

    // J2 (v1.4): the WORLD simulation (world, particles, enemies, player, and
    // the runT clock) advances at dt * timeScale. UI (banners, shake, zoom,
    // menus) and input keep raw dt. Because runT advances with the sim, a full
    // run's measured runT is invariant to hit-stops — a dip only stretches
    // real wall-clock, never the pacing the probes measure.
    // J2 (v1.4): a 1-frame pre-hit freeze (boss lunge connect) holds the whole
    // WORLD sim (world + particles + expedition) for one frame while the UI
    // keeps ticking — a tiny impact hitch. It only stretches real time, never
    // the measured runT.
    let simDt = this.state === 'expedition' ? dt * this.timeScale : dt;
    if (this._freezeFrames > 0) { this._freezeFrames = 0; simDt = 0; }

    // ambient systems always tick (title backdrop stays alive)
    this.world.update(this.state === 'expedition' && (this.paused || this.help) ? 0 : simDt);
    this.particles.update(simDt);
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
    // V2 (v1.2 M11): the heron awaken bloom is a timed presentation effect;
    // tick it (and clear it) here so it plays even during the end-state flight.
    if (this._bloom) {
      this._bloom.t += dt;
      if (this._bloom.t >= this._bloom.dur) this._bloom = null;
    }
    // V2: the saturation surge decays toward 0 (exponential, ~1.2s feel) so the
    // world's long-run color curve is only nudged for the bloom's lifetime.
    if (this._bloomSurge > 0) this._bloomSurge *= Math.exp(-3.2 * dt);
    // M3 (v1.4): the two title easter eggs decay in REAL time (presentation
    // only — they never feed the pacing the probes measure). The spin-and-blink
    // lasts ~0.8 s; the smile/cheek-blush fades over ~3 s; the click counter
    // resets after 1 s of no clicks (so a fast triple-click works, stray single
    // clicks don't accumulate forever).
    if (this._eggFrog) {
      const ef = this._eggFrog;
      if (ef.spin >= 0) { ef.spin += dt; if (ef.spin >= 0.8) ef.spin = -1; }
      if (ef.clickT > 0) { ef.clickT -= dt; if (ef.clickT <= 0) ef.clicks = 0; }
    }
    if (this._eggBlush) {
      const eb = this._eggBlush;
      if (eb.frog > 0) { eb.frog -= dt; if (eb.frog < 0) eb.frog = 0; }
      if (eb.heron > 0) { eb.heron -= dt; if (eb.heron < 0) eb.heron = 0; }
    }

    if (this.state === 'title') {
      this.titleT += dt;
      // L3: advance the staggered menu fade-in clock (titleT keeps running for
      // the existing camera drift — _titleShowT is a separate presentation clock).
      this._titleShowT += dt;
      this.cam.x = 1200 + Math.sin(this.titleT * 0.12) * 500;
      this.cam.y = 750 + Math.cos(this.titleT * 0.09) * 260;
      if (this.optionsOpen) this._updateOptions(dt);
      else this._updateTitle(dt);
      this._updateTitleEgg(dt);   // M3 (v1.4): the two title easter eggs (presentation only)
    } else if (this.state === 'expedition') {
      if (this.dying) {
        this.dieT += dt;
        this._stepHeronFlight(dt);
        if (this.dieT > 1.6) this._endRun('defeat');
      } else if (this.heron && (this.heron.flying > 0 || this.heron.sinking > 0)) {
        // post-victory: the run is over — let the flight play out
        // (world/particles already ticked by the ambient block above).
        // J2: routed through simDt so the ~0.8s defeat slow-mo visibly stretches
        // the heron's bloom. runT is frozen here (no _updateExpedition), so this
        // never affects the measured run length.
        this._stepHeronFlight(simDt);
      } else if (!this.paused && !this.help) {
        this._updateExpedition(simDt);
      } else if (this.help) {
        // M8 P6: the "?" field guide owns input while open (the run is frozen).
        if (this.input.pressed('h') || this.input.pressed('escape') || this.input.pressed('?')) {
          this.help = false;
          this.sfx('ui');
        } else if (this.input.mouse.lPressed) {
          const h = this._helpGeom();
          // T4 (v1.2 M13): a "Watch me" lesson button starts a retrain replay of
          // that phase on demand — close the guide and enter the frozen teaching
          // layer at the requested phase (opt-in; it never counts toward the run).
          let started = false;
          if (h.retrain && h.retrain.enabled) {
            for (const b of h.retrain.buttons) {
              if (this._mouseIn(b.x, b.y, b.w, b.h)) { this.help = false; this.helpRetrain = true; this._startRetrain(b.phase); started = true; break; }
            }
          }
          if (!started && this._mouseIn(h.close.x, h.close.y, h.close.w, h.close.h)) { this.help = false; this.sfx('ui'); }
        }
      } else if (!this.dying) {
        // M5: the pause menu owns input while paused — _updateExpedition is
        // skipped in that state, so its own pause block never ran.
        // J5 (v1.4): advance the pause panel's slide+fade clock (real time).
        this._pauseOpenT += dt;
        if (this.input.pressed('p')) {
          this.paused = false;
          this.sfx('pause-close');   // S1 (v1.9): dedicated pause close
        } else if (this.input.pressed('escape')) {
          this.sfx('ui-back');
          this._quitToTitle();
        } else {
          if (this.input.pressed('m')) this._muteToggle();
          if (this.input.mouse.lPressed) {
            // geometry must match _drawPause (M5; Q1 kept the card + buttons in lock-step)
            const cx = this.cw / 2, cy = this.ch / 2;
            const pw = 340, ph = 320, px = cx - pw / 2, py = cy - ph / 2;
            if (this._mouseIn(px, py + 164, pw, 44)) { this.paused = false; this.sfx('pause-close'); }   // S1 (v1.9): dedicated pause close
            else if (this._mouseIn(px, py + 216, pw, 44)) { this.sfx('ui-back'); this._quitToTitle(); }
          }
        }
      }
    } else if (this.state === 'camp') {
      if(this.input.pressed('m'))this._muteToggle();
      this._updateCampaignCamp();
    } else if (this.state === 'end') {
      this.endT+=dt;
      if(this.input.pressed('m'))this._muteToggle();
      if(this.endT>0.6){const b=this._endButtons();
        if(this.input.pressed('enter')||this.input.pressed(' ')||(this.input.mouse.lPressed&&this._mouseIn(b.primary.x,b.primary.y,b.primary.w,b.primary.h)))this._startExpeditionOrCard();
        else if(this.input.pressed('escape')||(this.input.mouse.lPressed&&this._mouseIn(b.ret.x,b.ret.y,b.ret.w,b.ret.h)))this._quitToTitle();
      }
    }

    this._sfxMenuHover();   // S1 (v1.9): a UI hover tick when the cursor enters a button
    this._drawAll();
    this.input.endFrame();
  }

  // S1 (v1.9): the UI HOVER tick. Fires 'ui-hover' when the mouse cursor ENTERS
  // a focused-menu button (the target changes). Presentation-only — reads the
  // current menu button list (the same _gpMenuList the gamepad/keyboard nav use)
  // and the cursor, fires at most once per hover-target change, and no-ops in
  // headless smoke (the sfx wrapper is a no-op there). `_hoverIdx` tracks the
  // last hovered button index so a resting cursor never re-ticks.
  _sfxMenuHover() {
    const focus = this._gpMenuList();
    const list = focus && focus.list ? focus.list : null;
    let idx = -1;
    if (list && this.state !== 'expedition') {
      const m = this.input.mouse;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (b && b.w > 0 && m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) { idx = i; break; }
      }
    }
    if (idx !== this._hoverIdx) {
      this._hoverIdx = idx;
      if (idx >= 0) this.sfx('ui-hover');
    }
  }

  _stepHeronFlight(dt) {
    const h = this.heron;
    if (!h) return;
    // R4 (v1.6): the Wyrm's victory beat — it SINKS back under the water line
    // (y increases, like the heron flies up) instead of taking flight. Both
    // hand off to _endRun('victory') after ~3s (the Reeds run ends in victory
    // like a heron defeat).
    if (h.sinking) {
      h.sinking += dt;
      h.y += 130 * dt;             // sink DOWN into the mud
      this.world.restoreColor(dt * 0.22);
      if (Math.random() < 0.5) this.particles.ripple(h.x, h.y);
      if (h.sinking > 3) this._endRun('victory');
      return;
    }
    if (!h.flying) return;
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
    // J3 (v1.4) replaces the plain `approach` follow. Everything here is
    // PRESENTATION: the camera follows the frog's (already-simmed) position,
    // so it runs on real `dt` — never `simDt`. During J2's hit-stop / boss
    // slow-mo the world sim is slowed, but the camera stays smooth and
    // responsive rather than stalling with it (it naturally eases onto the
    // slowed frog because the follow target moves less).

    // (d) awaken moment — the strongest beat. The gray heron rising Green
    // Heron reveal) holds the camera on the heron with a brief zoom-out for
    // _awakenHoldT seconds, then eases back to normal follow. Set in the
    // 'awaken' handler on the final heron only.
    if (this._awakenHoldT > 0) {
      this._awakenHoldT -= dt;
      const h = this.heron;
      if (h) {
        const hy = h.y - (h.diveH || 0) * 0.4;
        this.cam.x = approach(this.cam.x, h.x, 5, dt);
        this.cam.y = approach(this.cam.y, hy, 5, dt);
        this.zoomTarget = 0.88;   // zoom OUT so the whole rising heron reads
        return;
      }
      this._awakenHoldT = 0;
    }

    // (c) boss framing — while the heron is fleeing (post-defeat victory
    // flight) chase the heron across the swamp (the existing beat). While it
    // is live and on screen (not fleeing, intro done), center on the
    // frog–heron midpoint and widen slightly so the whole fight reads.
    const h = this.heron;
    if (h && h.flying > 0) {
      this.zoomTarget = 1;
      this.cam.x = approach(this.cam.x, h.x, 6, dt);
      this.cam.y = approach(this.cam.y, h.y, 6, dt);
      return;
    }
    // Reeds apexes live in the final arena. Their intro clock can expire
    // during exploration; that must not frame a distant boss and hide the
    // frog/optional nook. Presentation only: no boss clock or combat changes.
    const arenaFraming = !h || !(h.wyrm || h.warden || h.umbra) || p.x > this.world.w - 900;
    if (h && h.hp > 0 && !h.flying && h._intro <= 0 && arenaFraming) {
      const hy = h.y - (h.diveH || 0) * 0.5;
      const mx = (p.x + h.x) / 2;
      const my = (p.y + hy) / 2;
      this.zoomTarget = 0.92;
      this.cam.x = approach(this.cam.x, mx, 4, dt);
      this.cam.y = approach(this.cam.y, my, 4, dt);
      return;
    }
    this.zoomTarget = 1;

    // (a) input-direction look-ahead (up to ~40 px, eases in/out): the camera
    // leads the frog toward wherever it is heading so the frog reads in front
    // of center. (b) mild lag when moving fast: a slightly lower ease rate so
    // the world feels weighted at speed, snapping back to a snappier follow at
    // rest. Both ride on the frog's own (simmed) velocity, so they never feed
    // back into the measured runT.
    const mv = this.input.moveVec();
    const LA = 40;
    const ease = (mv[0] || mv[1]) ? 4 : 7;   // lag when moving, snappy at rest
    let tx = p.x + mv[0] * LA;
    let ty = p.y + mv[1] * LA;
    // gentle weight: when sprinting, ease a touch slower (already via `ease`).
    this.cam.x = approach(this.cam.x, tx, ease, dt);
    this.cam.y = approach(this.cam.y, ty, ease, dt);
  }

  _quitToTitle() {
    if (this.state === 'expedition') this.studio?.archive('unfinished');
    this._bookOpen = false;
    this._atlasOpen = false;
    this.input.reset();
    this.state = 'title';
    this.paused = false;
    this.optionsOpen = false;
    this.player = null;
    this.heron = null;
    this.enemies = [];
    this.orbs = [];
    this.hazards = [];
    this.orbStreak = 0;
    // L3: arm the staggered menu fade-in (starts just before 0 so the menu
    // breathes in again on each return to the title, rather than popping in).
    this._titleShowT = -0.5;
    // S1 (v1.4): stop the melodic theme if a run is abandoned from the pause
    // menu (idempotent — also cleared in _endRun; the ambient bed is handled
    // there, the theme here too so a mid-run quit doesn't leave it looping).
    if (this.audio && this.audio.clearZoneTheme) this.audio.clearZoneTheme();
    this.sfx('ui-back');
  }

  _challengeAdd() {}

  // Start a fresh dungeon directly from the title.
  _startExpeditionOrCard() { this.options.wander = false; this._beginExpedition(); }

  // Legacy callers enter the kept sketchbook instead of the removed shop.
  _beginAtelier() { this._quitToTitle(); this._openSketchbook(); }

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
          centerText(ctx, String(piece.amount), cx0 + 19, y, uiFont(UI.sizes.bodyLg, { weight: 700 }), INK, 1);
          cx0 += 44;
        }
        return cx0;
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
    this._eraseTimer = Math.max(0,(this._eraseTimer||0)-dt);
    if(this.input.pressed('enter') || this.input.pressed(' ')){this._startExpeditionOrCard();return;}
    if(this.input.pressed('o')){this._openOptions();return;}
    if(this.input.pressed('g')){this._setDifficulty('gentle');return;}
    if(this.input.pressed('n')){this._setDifficulty('normal');return;}
    if(this.input.pressed('b')){this._setDifficulty('bold');return;}
    if(this.input.pressed('m')) this._muteToggle();
    if(!this.input.mouse.lPressed)return;
    const g=this._titleLayout();
    if(this._mouseIn(g.bx,g.by,g.bw,g.bh)){this._startExpeditionOrCard();return;}
    if(this._mouseIn(g.tx,g.ty,g.tw,g.th)){this.options.wander=false;this._beginExpedition(true);return;}
    for(const d of g.diff)if(this._mouseIn(d.x,d.y,d.w,d.h))this._setDifficulty(d.id);
    if(this._mouseIn(g.abx,g.aby,g.abw,g.abh))this._openSketchbook();
    if(this._mouseIn(g.ox,g.oy,g.ow,g.oh))this._openOptions();
    if(this._mouseIn(35,this.ch-42,225,30)){
      if(this._eraseTimer>0){SaveSys.erase();this.save=freshSave();this._eraseTimer=0;}
      else{this._eraseTimer=3;this.addBanner('Click erase again to remove saved artwork and records.',3);}
    }
  }

  // M3 (v1.4): the two title easter eggs — PURE presentation, in-memory only.
  // (a) EGG A: hold 'F' (~0.45 s) or click the title frog 3x → a little
  //     spin-and-blink + a unique chime + a ONE-TIME "didYouKnow" banner.
  // (b) EGG B: a dry-brush gesture near the title frog (a held sweep) or the
  //     SLEEPING heron (dry brush held + a stroke near its head, pre-engage)
  //     leaves a tiny smile/cheek-blush that fades over ~3 s. Neither touches
  //     gameplay, runT, or persisted state.
  _updateTitleEgg(dt) {
    const ef = this._eggFrog;
    // (a) hold-F trigger.
    if (this.input.down('f')) {
      ef.holdT += dt;
      if (ef.holdT >= 0.45) { this.triggerFrogEgg(); ef.holdT = -1; }
    } else if (ef.holdT > 0) { ef.holdT = 0; }
    // (a) triple-click trigger (left click near the title frog).
    if (this.input.mouse.lPressed) {
      const m = this.input.mouse;
      if (Math.hypot(m.x - 150, m.y - (this.ch - 162)) < 52) {
        ef.clicks++; ef.clickT = 1.0;
        if (ef.clicks >= 3) { this.triggerFrogEgg(); ef.clicks = 0; ef.clickT = 0; }
      }
    }
    // (b) the title frog: a dry-brush gesture = a held left-stroke over it.
    const eb = this._eggBlush;
    const m2 = this.input.mouse;
    if (m2.lDown && Math.hypot(m2.x - 150, m2.y - (this.ch - 162)) < 52) {
      ef.stroke += dt;
      if (ef.stroke >= 0.2 && eb.frog <= 0) this.triggerBlush('frog');
    } else if (ef.stroke > 0) { ef.stroke -= dt * 3; if (ef.stroke < 0) ef.stroke = 0; }
  }

  // M3 EGG A: the frog appreciates the attention — spin-and-blink + chime + a
  // ONE-TIME "didYouKnow" banner. In-memory only (the one-time flag is a plain
  // field, never saved).
  triggerFrogEgg() {
    const ef = this._eggFrog;
    ef.spin = 0;                                  // ~0.8 s spin-and-blink (real time)
    if (this.sfx) this.sfx('frog-chime');
    if (!ef.shown) {
      ef.shown = true;
      this.addBanner('the frog appreciates the attention.', 3.4, this.ch - 138);
    }
  }

  // M3 EGG B: a tiny smile/cheek-blush that fades over ~3 s (presentation only).
  triggerBlush(which) {
    const eb = this._eggBlush;
    eb[which] = 3.0;                              // remaining real-seconds
    if (this.sfx) this.sfx('paint-swipe', { pig: 'dry' });
  }

  _beginExpedition(guided = false, opts = {}) {
    this._atlasOpen = false;
    this._atlasCheckpoints = [];
    // Normal entry starts at depth one; explicit floor options serve probes.
    if(!opts.campaignContinue){
      this.campaign=createCampaignRun((Math.random()*2**31)|0);
      if(Number.isInteger(opts.campaignFloor))this.campaign.floor=clamp(opts.campaignFloor,0,3);
      else if(opts.reeds)this.campaign.floor=this.options.wander?2:1;
      this.campaign.cleared=CAMPAIGN.slice(0,this.campaign.floor).map(f=>f.boss);
      this.campaign.rewards=Array(this.campaign.floor).fill('heart');
    }
    const floor=campaignFloor(this.campaign),_isReeds=floor.biome==='reeds';
    const _chal=null;this.challenge=null;
    const seed=(this.campaign.seed+this.campaign.floor*104729)>>>0;
    this.runSeed=seed;this.blackReeds=floor.boss==='umbra';
    this.world = new World(mulberry32(seed), seed % 99991, { reeds: _isReeds, blackReeds: this.blackReeds });
    if (mothEncounterAllowed({ reeds: _isReeds, victory: this.save.flags?.heronDefeated, blackReeds: this.blackReeds, wander: this.options.wander, challenge: !!_chal })) this.world.enableMothEncounter();
    // S2 (v1.9): the run's MUSIC biome — which per-biome zone-theme set the
    // melody layer plays. 'blackReeds' > 'reeds' > 'swamp' (the base run,
    // byte-identical). Presentation/audio only (never feeds runT).
    this.runBiome = this.blackReeds ? 'blackReeds' : (_isReeds ? 'reeds' : 'swamp');
    this.lanternReeds = _isReeds;               // R1: activate THE LANTERN (only in the Reeds variant)
    this._lanternTuning = (this.blackReeds) ? REEDS_DARK_LANTERN : LANTERN;
    this._reedsBestiary = (this.world && this.world.reedsBestiary) || null;
    this.tuning=applyCampaignRewards(makeTuning({},[],this.options.difficulty),this.campaign);
    this.player = new Player(PLAYER_START_X, PLAYER_START_Y, this.tuning);
    // R1 (v1.6): reset THE LANTERN for this run. In the Reeds variant it starts
    // full + lit (the frog carries a fresh paper lantern); otherwise it is
    // simply inactive (fuel 0 / unlit, never drawn or drained). The cached light
    // gradient is discarded so it is rebuilt (at most once per radius) for this
    // run's player. No save data — the lantern is purely in-run (R5's gate flag
    // is the only Reeds save field).
    this.lantern = _isReeds ? { fuel: 1, lit: true } : { fuel: 0, lit: false };
    this._lanternGrad = null;
    this._lanternGradR = -1;
    this._wickLatch = false;   // R1: the "wick catching" SFX latch (once per source-entry)
    this.paint = new Paint(this.player, this.world, this.tuning, (n, o) => this.sfx(n, o), this.particles);
    this.tutorial = null;   // T1 (v1.2 M13): fresh state each run; set below if guided
    this.sketchHeron = null;   // T3 (v1.2 M13): the teaching sketch heron (absent by default)
    this._sketchDefeated = false; // T3: latch reset each run
    this.helpRetrain = false;  // T4: the Field Guide retraining menu is closed
    this.enemies = [];
    this.orbs = [];
    this.hazards = []; // E3: Bold-only environmental hazards (thorn reeds / mud pools)
    this.orbStreak = 0; // E4: clean-orb streak (resets on a hit) — in-run only, not persisted
    this.runOrbs = 0;   // G1 (v1.3 M15): this expedition's collected orbs (milestone is per-run)
    this.runEnemies = 0; // Q1 (v1.6): enemies painted this expedition — IN-MEMORY ONLY (the pause "this expedition" block reads it; NEVER persisted)
    // Q2 (v1.6): the run's ROUTE — a capped, run-local list of sampled waypoints
    // (world x,y every ~500 ms, cap ~40 oldest-dropped) that the end-screen
    // recap draws as a wobbly ink line on a 6-zone strip. IN-MEMORY ONLY; the
    // end screen is pure presentation over this + runT + the boss outcome.
    this.runWaypoints = []; this._lastWpT = 0;
    this.zones = ZONES;
    this.wanderActive = false;
    this.wanderSeedRun = null;
    this.wanderTaste = null;                 // D2: the run's flavor archetype (null unless wandering)
    if (this.options.wander === true && !guided) {
      const prev = Math.max(0, Math.floor(this.save.wanderSeed) || 0);
      // O1 (v1.7): if the pre-expedition seed card already picked this run's seed
      // (opts.seed — the value it displayed to the player), USE it (deterministic:
      // the player sees the same seed the run then plays). Otherwise pick a fresh
      // one from the impure Date.now layer (the direct-Start path, no card).
      const freshSeed = (opts && typeof opts.seed === 'number' && opts.seed > 0)
        ? opts.seed
        : pickWanderSeed(prev, Date.now() | 0);
      this.wanderSeedRun = freshSeed;
      this.save.wanderSeed = freshSeed;       // latch the seed so the next run differs
      // D2 (v1.7): pick this run's TASTE (a flavor archetype) from the seed —
      // deterministic on the seed's own salted lane, separate from the content
      // stream. Its bias only re-weights which KINDS fill the zones (never the
      // counts), so a biased run is always in-band AND the run's taste is
      // reproducible from save.wanderSeed (wanderTaste(wanderSeed)).
      this.wanderTaste = wanderTaste(freshSeed);
      const lay = wanderContent(freshSeed, ZONES, this.wanderTaste.bias);
      this.zones = lay.zones.map(z => ({ ...z, mix: { ...z.mix }, sig: { kind: z.sig.kind, count: z.sig.count } }));
      this.wanderActive = true;
    }
    if (floor.boss === 'warden' || this.wanderActive) {
      const s0 = wardenSurfacePoint({ surfIdx: 0 }, 0, this.world.w);
      this.heron = {
        kind: WARDEN.kind, warden: true,
        x: s0[0], y: s0[1],
        hp: WARDEN.hp, maxHp: WARDEN.hp,
        phase: 'mawClosed', state: 'idle', stateT: 2.2, hue: { red: 0, blue: 0, green: 0 },
        awakened: false, awakenedT: 0, summonT: 9, lungeDir: -1,
        targetX: this.world.w - 650, diveH: 0, facing: -1,
        flying: 0, _intro: 3.4,
        // the Warden's state machine fields (wardenStep): it begins maw-CLOSED
        // (invulnerable) with its timer + the surface-point index set.
        phaseT: WARDEN.mawClosed, surfIdx: 0,
        // the taste-seeded aggression factor (pure; deterministic on the run
        // taste). 1.15 feast / 1.0 calm+grump / 0.85 quiet (see wardenTasteFactor).
        tasteFactor: wardenTasteFactor(this.wanderTaste),
        // the pure 3-hue awaken (the SAME latch as the herons — paintBoss reads this):
        awakenNeed: { ...WARDEN.awakenNeed },
      };
    } else if (_isReeds) {
    if (this.blackReeds) {
      const u0 = umbrSurfacePoint({ surfIdx: 0 }, 0, this.world.w);
      this.heron = {
        kind: UMBRA_WYRM.kind, umbra: true,
        x: u0[0], y: u0[1],
        hp: UMBRA_WYRM.hp, maxHp: UMBRA_WYRM.hp,
        phase: 'transit', state: 'idle', stateT: 2.2, hue: { red: 0, blue: 0, green: 0 },
        awakened: false, awakenedT: 0, summonT: 9, lungeDir: -1,
        targetX: this.world.w - 650, diveH: 0, facing: -1,
        flying: 0, _intro: 3.4,
        // the Umbral's state machine fields (umbrStep): it begins UNDERGROUND in
        // transit toward maw point 0 (the DUAL partner is its adjacent point).
        phaseT: UMBRA_WYRM.transit, surfIdx: 0, _partnerIdx: 1, strikeArmed: false,
        // the pure 3-hue awaken (the SAME latch as every boss — paintBoss reads this):
        awakenNeed: { ...UMBRA_WYRM.awakenNeed },
      };
    } else {
      const s0 = wyrmSurfacePoint({ surfIdx: 0 }, 0, this.world.w);
      this.heron = {
        kind: SILT_WYRM.kind, wyrm: true,
        x: s0[0], y: s0[1],
        hp: SILT_WYRM.hp, maxHp: SILT_WYRM.hp,
        phase: 'transit', state: 'idle', stateT: 2.2, hue: { red: 0, blue: 0, green: 0 },
        awakened: false, awakenedT: 0, summonT: 9, lungeDir: -1,
        targetX: this.world.w - 650, diveH: 0, facing: -1,
        flying: 0, _intro: 3.4,
        // the wyrm's state machine fields (wyrmStep): it begins UNDERGROUND in
        // transit toward surface point 0, with its transit timer + index set.
        phaseT: SILT_WYRM.transit, surfIdx: 0, strikeArmed: false,
        // the pure 3-hue awaken (the SAME latch as the herons — paintBoss reads this):
        awakenNeed: { ...SILT_WYRM.awakenNeed },
      };
    }
    } else {
      this.heron = {
        x: this.world.w - 350, y: HERON_Y,
        hp: this.tuning.bossMaxHp,
        maxHp: this.tuning.bossMaxHp,
        kind: 'gray',
        phase: 1, state: 'idle', stateT: 2.2, hue: { red: 0, blue: 0, green: 0 },
        awakened: false, awakenedT: 0, summonT: 9, lungeDir: -1,
        targetX: this.world.w - 650, diveH: 0, facing: -1,
        flying: 0, _intro: 3.2,
      };
    }
    // E1 (v1.2 M10): the Painted Heron — a mid-run "half-heron" set-piece on a
    // zone boundary (end of zone 3) for Normal+. A small re-use of the real
    // heron's bossStep machinery at reduced scale (much lower HP, ~1 hue to
    // awaken, phase escalation capped at 2). NON-blocking: the frog can walk
    // past it (optional), so the 15–20 min pacing target is preserved.
    this.midHeron = floor.id === 'swamp' && midHeronAllowed(this.options.difficulty) ? {
      x: this.world.w * MID_HERON.x, y: MID_HERON.y,
      hp: MID_HERON.hp, maxHp: MID_HERON.hp,
      phase: 1, state: 'idle', stateT: 2.0, hue: { red: 0, blue: 0, green: 0 },
      awakened: false, awakenedT: 0, summonT: 9, lungeDir: -1,
      targetX: this.world.w * MID_HERON.x - 200, diveH: 0, facing: -1,
      flying: 0, _intro: 9999, _active: false, // dormant until the frog is near
      awakenNeed: { ...MID_HERON.awakenNeed },   // ~1 hue to awaken (smaller than the final heron)
      maxPhase: MID_HERON.maxPhase,             // cap escalation at 1–2 phases
      contactDmg: MID_HERON.contactDmg,
      mid: true,                                 // flag: this is the mid-heron (defeat rewards, not the final boss)
    } : null;
    this.cam.x = PLAYER_START_X; this.cam.y = PLAYER_START_Y;
    this.zoomTarget = 1;
    this.shake = 0;
    this.runT = 0; this._floorStartT = 0;
    this.spawnT = 3.5;
    this._zoneI = 0;
    this._zoneTint = null; // M8 P12: { color, t, max } — fading zone-accent wash on entry
    this._bloom = null;     // V2 (v1.2 M11): fresh run — no active awaken bloom
    this._bloomSurge = 0;   // V2: fresh run — no lingering saturation surge
    this._cine = null;      // M1 (v1.4): fresh run — no lingering cinematic beat
    // J5 (v1.4): fresh run — clear any leftover HUD floats / streak trail.
    this._floats = []; this._streakTrail = []; this._pauseOpenT = 0;
    // E2 (v1.2 M10): fresh weather per run; the first zone's phase is armed below
    this.weatherPending = null;
    this.weatherActive = null;
    this.weatherZoneI = -1;
    this.weatherTriggerAt = 0;
    // K3 (v1.5 M3): fresh Storm Surge per run (armed when the frog enters the
    // final stretch — the "zone 5" set-piece). Non-blocking; never feeds runT.
    this.surge = null;
    this._surgeEnemies = [];
    this._surgeRainBase = null;
    this.score = 0;
    this.stock = { red: 0, blue: 0, green: 0 };
    this.collected = { red: 0, blue: 0, green: 0 };
    this.dying = false;
    this.dieT = 0;
    this.paused = false;
    this.help = false;   // M8 P6: start a run with the field guide closed
    this.banners = [];
    this.state = 'expedition';
    this._challengeResult = null; // a fresh run starts with no filed score (K7)
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
    this._updateZoneAmbient(); // V3: seed the ambient bed for the starting region
    // S3 (v1.9): start the sparse AMBIENT-LIFE events for this run, seeded by the
    // run's biome + seed (deterministic in node). They ride the music slider +
    // mute (the _ambLifeMaster -> musicBus) and are driven by the rAF tick in
    // _updateExpedition (no setInterval). Presentation-only: never feeds runT.
    if (this.audio.startAmbientLife) this.audio.startAmbientLife(this.runBiome, seed);
    this.sfx('ui');
    this._prevHp = this.tuning.maxHp;
    const firstRun = !this.save.flags.intro;
    if (firstRun) {
      this.save.flags.intro = true;
      SaveSys.save(this.save);
      // Staged first-run tutorial: one step at a time on a runT schedule, so
      // a newcomer reads a single instruction per beat instead of a wall of
      // text (the M1 version fired three banners simultaneously).
      this._tut = [
        { at: 0.3, dur: 5.5, text: 'Move with WASD. Hold left mouse to paint nearby.' },
        { at: 8, dur: 5.5, text: 'Paint the pale flowers and mushrooms any color you like.' },
        { at: 17, dur: 5.5, text: 'Space dodges. Blue stops a charging bug; red burns it.' },
        { at: 27, dur: 5.5, text: 'Follow the path right. Paint the bell for a short bug battle.' },
      ];
      this._tutI = 0;
    } else {
      this._tut = null;
      this.addBanner(this.campaign.floor === 0
        ? 'Make the swamp yours. Paint plants, explore, or try the clearing bell.'
        : `${floor.name} · Follow the path right. L toggles your lantern.`, 4.2);
    }
    // The countdown begins only in the final arena, not when the run starts.
    this.heron._intro = 3.2;
    // Practice is optional on every visit; its clock and boss stay paused.
    if (guided) this._startTutorial();
    this.studio = new FieldStudio(this);
    this.encounter = new OpeningEncounter(this);
    this.paint.onStroke = stroke => {
      this.studio.onStroke(stroke); this._paintCrossingStroke(stroke);
      this.encounter.onStroke(stroke);
      if (this.world.paintMothFlower(stroke)) {
        this.sfx('moth-settle');
        this._mothBanner('Flower ready · brush moth BLUE');
      }
    };
    this._bookOpen = false;
    this._hopWas = false;
    this.input.reset();
  }

  // ================= T1/T2 (v1.2 M13): the guided first expedition ==========
  // Coaxed goals shown as on-screen chips (not text walls). Each goal advances
  // ONLY when the player actually causes the real effect (reads the enemy's real
  // status/death via logic.tutorialDrillSatisfied). A SKIP button (or Escape)
  // dismisses the whole run and persists save.flags.tutorialSkipped so it never
  // reappears. While active: the timed clock (runT) is frozen, the boss is
  // deferred, and normal wave spawning is suppressed — so this is a low-stakes
  // teaching layer, not part of the timed expedition.
  _tutorialActive() { return !!(this.tutorial && !this.tutorial.done && this.tutorial.idx < TUTORIAL_PHASES.length); }
  _tutorialPhase() { const t = this.tutorial; return (t && t.idx < TUTORIAL_PHASES.length) ? TUTORIAL_PHASES[t.idx] : null; }

  // Start the guided run: freeze the clock, defer the boss, place goal #1.
  _startTutorial() {
    this.tutorial = { idx: 0, target: null, targetPos: null, done: false, frozen: 0 };
    this.runT = 0;                 // the teaching run is NOT timed
    this.heron._intro = 999;       // the heron waits until the practice ends
    this.addBanner('A quiet little practice — give each bug its lesson. Skip anytime.', 4.5, this.ch * 0.26);
    this._tutorialSpawnTarget();
  }

  // Place the current goal's target just within brush reach (a first-timer
  // lands the stroke without chasing a bug across the swamp).
  _tutorialSpawnTarget() {
    const ph = this._tutorialPhase();
    if (!ph || !this.player) return;
    // T3 (v1.2 M13): the 'sketch' phase faces the low-HP sketch heron instead
    // of a small bug — a re-use of the real heron's bossStep machinery.
    if (ph.phase === 'sketch') { this._setupSketchHeron(); return; }
    const p = this.player;
    const pos = { x: p.x + 52, y: p.y - 10 };
    const e = spawnEnemy(ph.enemy, pos.x, pos.y, this.tuning);
    e.vx = 0; e.vy = 0; e._practice = true;
    this.enemies.push(e);
    this.tutorial.target = e;
    this.tutorial.targetPos = pos;
  }

  // T3 (v1.2 M13): spawn the low-HP "sketch" heron for the final teaching beat.
  // It reuses the real heron's bossStep + 3-hue awaken machinery at a few-hundred-
  // HP scale (see SKETCH_HERON): much lower HP, awakens on ~1 hue, phase
  // escalation capped at 2 (no phase-3 "Gray Storm"), and it never hurts the
  // frog (contactDmg 0) so the beat is low-stakes. It spawns just ahead of the
  // frog (so a first-timer reaches it), is driven by _updateSketchHeron (which
  // pins it in reach), and becomes the tutorial's `target` so the advancement
  // check + skip both read it uniformly.
  _setupSketchHeron() {
    const p = this.player;
    const x = p.x + SKETCH_HERON.x, y = p.y + SKETCH_HERON.y;
    this.sketchHeron = {
      x, y,
      hp: SKETCH_HERON.hp, maxHp: SKETCH_HERON.hp,
      phase: 1, state: 'idle', stateT: 2.0, hue: { red: 0, blue: 0, green: 0 },
      awakened: false, awakenedT: 0, summonT: 99, lungeDir: -1,
      targetX: x - 300, diveH: 0, facing: -1,
      flying: 0, _intro: 0, maxPhase: SKETCH_HERON.maxPhase,
      awakenNeed: SKETCH_HERON.awakenNeed, contactDmg: SKETCH_HERON.contactDmg,
    };
    this._sketchDefeated = false;
    // make the sketch the tutorial's current target (advancement + skip read it)
    this.tutorial.target = this.sketchHeron;
    this.tutorial.targetPos = { x, y };
  }

  // T3 (v1.2 M13): clear the sketch heron (used on advance, skip, and retrain
  // end). The completion is persisted by _tutorialAdvance (save.tutorialDrills.
  // awaken) before this runs, so a skipped/ended beat simply leaves it undone.
  _clearSketchHeron() {
    this.sketchHeron = null;
  }

  // Advance once the current goal's real-state predicate is satisfied.
  _tutorialAdvance() {
    const t = this.tutorial;
    const ph = TUTORIAL_PHASES[t.idx];   // the phase just completed
    // the target is a small bug OR (T3) the sketch heron — only remove it from
    // the enemies list if it is actually one of them (the sketch heron is not).
    this.enemies = this.enemies.filter(e => e !== t.target);
    t.target = null; t.targetPos = null;
    t.idx += 1;
    // T2: a completed drill is persisted to save.tutorialDrills so T4
    // "Watch me" retraining can reference which drills were completed. The
    // predicate already guaranteed the REAL effect landed before we got here.
    if (ph.phase === 'drills') {
      if (!this.save.tutorialDrills) this.save.tutorialDrills = { burn: false, freeze: false, root: false, awaken: false };
      if (!this.save.tutorialDrills[ph.drill]) {
        this.save.tutorialDrills[ph.drill] = true;
        SaveSys.save(this.save);
      }
    }
    // T3: completing the sketch-heron beat (the 3-hue awaken loop) records
    // save.tutorialDrills.awaken — the "awaken" progress reference.
    if (ph.phase === 'sketch') {
      if (!this.save.tutorialDrills) this.save.tutorialDrills = { burn: false, freeze: false, root: false, awaken: false };
      if (!this.save.tutorialDrills.awaken) {
        this.save.tutorialDrills.awaken = true;
        SaveSys.save(this.save);
      }
    }
    // T4: a "Watch me" retrain replay ends the moment its REQUESTED phase
    // completes — resume the timed run (runT stays at its frozen value, so the
    // replay is never counted toward the timed expedition).
    if (t.retrain) { this._endRetrain(); return; }
    if (t.idx >= TUTORIAL_PHASES.length) {
      t.done = true;
      this._clearSketchHeron();   // the sketch beat is the last phase
      this.heron._intro = 3.2;     // practice over — the timed expedition resumes
      this.addBanner('Well painted. Off into the swamp — the Great Gray Heron waits in the gray east.', 4.6, this.ch * 0.3);
      this.sfx('victory');
      return;
    }
    // T3: crossing into the sketch-heron beat — a "now face the heron" moment.
    if (TUTORIAL_PHASES[t.idx].phase === 'sketch') {
      this.addBanner('Now a small heron — a sketch of the big one. Wake it with three hues.', 3.8, this.ch * 0.3);
    } else if (TUTORIAL_PHASES[t.idx].phase === 'drills' && ph.phase !== 'drills') {
      // T2: crossing from the 'learn' goals into the 'drills' — "now prove it".
      this.addBanner('You know the tools. Now prove each one — do it for real.', 3.8, this.ch * 0.3);
    } else {
      this.addBanner(ph.done, 3.4, this.ch * 0.3);
    }
    this.sfx('ui');
    this._tutorialSpawnTarget();
  }

  // Skip the whole tutorial at any time. Persists the skip so it never returns.
  // T4: a "Watch me" retrain replay can be skipped too — but that does NOT mark
  // the tutorial skipped (the player already dismissed it once); it just ends
  // the replay and resumes the timed run at its frozen clock. (Checked FIRST,
  // before the skip-persistence, so a retrain skip never sets tutorialSkipped.)
  _skipTutorial() {
    if (!this.tutorial || this.tutorial.done) return;
    if (this.tutorial.retrain) { this._endRetrain(); return; }
    this.tutorial.done = true;
    if (!this.save.flags.tutorialSkipped) {
      this.save.flags.tutorialSkipped = true;
      SaveSys.save(this.save);
    }
    this.enemies = this.enemies.filter(e => e && e !== this.tutorial.target);
    this.tutorial.target = null; this.tutorial.targetPos = null;
    this._clearSketchHeron();     // T3: a skipped sketch beat is not completed
    this.runT = 0;
    this.heron._intro = 3.2;       // the timed expedition begins
    this.addBanner('Practice skipped — the expedition begins.', 3.2, this.ch * 0.3);
    this.sfx('ui-back');
  }

  // T4 (v1.2 M13): start a "Watch me" retrain replay of a SINGLE tutorial phase
  // (the three pigment drills, or the sketch-heron beat) ON DEMAND, from a
  // RETURNING player. It re-enters the guided teaching layer at the requested
  // phase, reusing the T1–T3 phases. It is OPT-IN and NEVER auto-enters:
  //   - the timed clock (runT) is frozen at its current value and resumes at the
  //     SAME value when the replay ends (the replay is never counted);
  //   - the real heron's intro is held at 999 so it cannot wake mid-replay;
  //   - it is dismissed (completed OR skipped) by the same chip controls.
  // `phaseIdx` is the index into TUTORIAL_PHASES (0-2 = drills, 3 = sketch).
  _startRetrain(phaseIdx) {
    if (this.state !== 'expedition' || this.dying) return; // in-run only
    // never nest a replay inside an active guided run (fresh save's teaching run)
    if (this.tutorial && !this.tutorial.done) return;
    const idx = Math.max(0, Math.min(TUTORIAL_PHASES.length - 1, phaseIdx | 0));
    this.tutorial = {
      idx, target: null, targetPos: null, done: false,
      frozen: this.runT,            // remember where the timed run was
      retrain: true,                 // T4: this is a replay, not the first run
    };
    this._sketchDefeated = false;
    // stash the real heron's intro exactly, so a retrain is a paused aside, not
    // a run event; the boss is held at 999 while the replay is live.
    this._retrainIntro = (this.heron && typeof this.heron._intro === 'number') ? this.heron._intro : 999;
    if (this.heron) this.heron._intro = 999;
    this.addBanner('Watch me — replaying a lesson. Finish or skip to resume the run.', 3.4, this.ch * 0.3);
    this._tutorialSpawnTarget();    // spawns the drill bug or the sketch heron
    this.sfx('ui');
  }

  // T4 (v1.2 M13): end a "Watch me" retrain replay — resume the timed run at the
  // exact value it was frozen at (so the replay never inflates the run length).
  _endRetrain() {
    const target = this.tutorial && this.tutorial.target;
    this.enemies = this.enemies.filter(e => e !== target);
    this.tutorial = null;
    this.sketchHeron = null;
    this._sketchDefeated = false;
    // restore the real heron's intro to exactly where it was before the replay.
    // If the boss was already active (intro <= 0) before the replay, keep it
    // deferred — a retrain must never snap the boss awake the moment it ends.
    if (this.heron) {
      const ri = (typeof this._retrainIntro === 'number') ? this._retrainIntro : 999;
      this.heron._intro = ri;
    }
    this.addBanner('Lesson replayed. Back to the swamp.', 2.6, this.ch * 0.3);
    this.sfx('ui-back');
  }

  // Per-frame driver (called from _updateExpedition while active): check skip
  // input, keep the target within reach, and advance only when the real effect
  // has happened. The advancement predicate reads the enemy's real status/death
  // (logic.tutorialDrillSatisfied), never "a brush stroke happened".
  _tutorialTick() {
    const t = this.tutorial;
    if (!t || t.done) return;
    const ph = this._tutorialPhase();
    if (!ph) return;
    // skip: click the SKIP button or press Escape — dismisses + persists.
    const lay = this._tutorialLayout();
    const m = this.input.mouse;
    if (m.lPressed && this._mouseIn(lay.skip.x, lay.skip.y, lay.skip.w, lay.skip.h)) { this._skipTutorial(); return; }
    if (this.input.pressed('escape')) { this._skipTutorial(); return; }
    // hold the real heron's intro so it can never wake mid-practice.
    if (this.heron) this.heron._intro = Math.max(this.heron._intro, 999);
    // T3: the sketch-heron beat — completes when the player has painted all three
    // hues to AWAKEN it (the 3-hue loop the real heron uses). It is NOT pinned
    // here (it drifts, driven by _updateSketchHeron); the heron target has no
    // `kind`, so the enemy-pin block below skips it.
    if (ph.phase === 'sketch') {
      const h = this.sketchHeron;
      // keep the sketch within brush reach (low-stakes teaching beat)
      if (h && this.player && this.tutorial.targetPos) {
        h.x = this.tutorial.targetPos.x; h.y = this.tutorial.targetPos.y; h._now = this.now;
      }
      if (h && h.awakened) this._tutorialAdvance();
      // A held single color must never kill this three-hue practice partner.
      else if (h) h.hp = Math.max(1, h.hp);
      return;
    }
    // keep the target in reach (low-stakes: pinned near the starting point)
    const e = t.target;
    if (e && !e.dead && t.targetPos && e.kind) {
      e.x = t.targetPos.x; e.y = t.targetPos.y; e.vx = 0; e.vy = 0; e._now = this.now;
    }
    if (e && tutorialDrillSatisfied(ph.drill, e)) this._tutorialAdvance();
    else if (e && (e.dead || e.hp <= 0)) {
      this.enemies = this.enemies.filter(enemy => enemy !== e);
      this._tutorialSpawnTarget();
      this.addBanner('Try this color: ' + ph.pigment + '. Your practice partner is ready again.', 2.5);
    }
  }

  // Geometry shared by the chip drawing and the skip-button hit test (so the
  // visual and the click target can't drift apart).
  _tutorialLayout() {
    const w = 560, h = 64, x = 16, y = this.ch - h - 18;
    return { x, y, w, h, skip: { x: x + w - 96, y: y + 14, w: 80, h: 36 } };
  }

  // T1/T2 (v1.2 M13): the on-screen goal chip for the guided first expedition.
  // Renders at the bottom-left (above the HUD's pigment slots) as a paper card
  // with a pigment swatch, the current goal text, and a SKIP button.
  _drawTutorialChip(ctx) {
    const ph = this._tutorialPhase();
    if (!ph) return;
    const t = this.tutorial;
    const lay = this._tutorialLayout();
    const { x, y, w, h, skip } = lay;

    ctx.save();

    // paper card
    ctx.globalAlpha = 0.94;
    this._paperChip(ctx, x, y, w, h, 12);
    ctx.globalAlpha = 1;

    // pigment swatch (a small rounded circle in the top-left of the card)
    const pig = PIGMENTS[ph.pigment];
    const swX = x + 20, swY = y + h / 2, swR = 9;
    ctx.fillStyle = pig.color;
    ctx.beginPath();
    ctx.arc(swX, swY, swR, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // goal text
    const textX = swX + swR + 10;
    const textMaxW = skip.x - textX - 12;
    ctx.font = uiFont(UI.sizes.small);
    ctx.fillStyle = INK; ctx.textAlign = 'left';
    this._wrapHelp(ctx, ph.chip, textX, y + 32, textMaxW, 16);

    // step counter (e.g. "1/3")
    const total = TUTORIAL_PHASES.length;
    const stepLabel = `step ${t.idx + 1} / ${total}`;
    ctx.globalAlpha = 0.5;
    centerText(ctx, stepLabel, textX + textMaxW / 2, y + 12, uiFont(UI.sizes.tiny), INK, 0.5);
    ctx.globalAlpha = 1;

    // SKIP button
    const hov = this._mouseIn(skip.x, skip.y, skip.w, skip.h);
    ctx.save();
    ctx.globalAlpha = hov ? 0.95 : 0.8;
    roundRectPath(ctx, skip.x, skip.y, skip.w, skip.h, 6);
    ctx.fillStyle = hov ? '#d8543c' : '#e8dcc4';
    ctx.fill();
    ctx.lineWidth = hov ? 2 : 1.2;
    ctx.strokeStyle = hov ? '#a03020' : INK;
    ctx.stroke();
    centerText(ctx, 'SKIP', skip.x + skip.w / 2, skip.y + skip.h / 2 + 4, uiFont(UI.sizes.xsmall, { weight: 700 }), hov ? '#fdf6e9' : INK, 1);
    ctx.restore();

    ctx.restore();
  }

  _updateExpedition(dt) {
    this.runT += dt;
    // S3 (v1.9): drive the sparse ambient-life events from this rAF tick (NO
    // setInterval). stepAmbientLife accumulates a run clock and, once per whole
    // second, runs the PURE nextAmbientEvent sampler + schedules one quiet
    // voice (insect/drip/wind/heron). Presentation-only: it never touches runT
    // or any game state — a no-op if the audio isn't running.
    if (this.audio && this.audio.stepAmbientLife) this.audio.stepAmbientLife(dt);

    // ----- T1 (v1.2 M13): the guided first expedition --------------------------
    // While the tutorial runs the timed expedition clock is FROZEN (runT holds
    // steady) and the staged first-run banners are suppressed, so the tutorial
    // is a separate pre-run layer that never inflates the measured run length.
    // The player still moves and paints (below); only pacing/progress stops.
    const tut = this.tutorial;
    if (tut && !tut.done) {
      this.runT = tut.frozen;
      if (this.input.pressed('escape') || this.input.pressed('backspace')) { this._skipTutorial(); return; }
      if (this.input.mouse.lPressed) {
        const g = this._tutorialLayout();
        if (g.skip && this._mouseIn(g.skip.x, g.skip.y, g.skip.w, g.skip.h)) { this._skipTutorial(); return; }
      }
    }

    // ----- staged first-run tutorial (one step at a time) -----
    if (!tut && this._tut && this._tutI < this._tut.length && this.runT >= this._tut[this._tutI].at) {
      const step = this._tut[this._tutI++];
      const busy = this.encounter?.active || this.heron?._intro <= 0 ||
        this.enemies.some(e => !e.dead && Math.hypot(e.x - this.player.x, e.y - this.player.y) < 260);
      if (!busy) this.addBanner(step.text, step.dur, this.ch * 0.42);
    }

    // ----- pause toggle (open only; menu input lives in the frame router) -----
    // While the tutorial runs these are suppressed (Escape skips instead of
    // pausing; the run stays focused on the on-screen goal chip).
    if (!tut || tut.done) {
      if (this.input.pressed('p')) {
        this.paused = !this.paused;
        // S1 (v1.9): dedicated pause open/close (the panel slides+fade either
        // way) replaces the generic ui/ui-back.
        this.sfx(this.paused ? 'pause-open' : 'pause-close');
        if (this.paused) this._pauseOpenT = 0;   // J5: restart the panel slide+fade
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
    }

    // ----- brush charge (hold RMB) -----
    const p = this.player;
    // Q2 (v1.6): sample the run's ROUTE — a run-local waypoint (world x,y) every
    // ~500 ms of run time, capped at ROUTE_WAYPOINT_CAP (oldest dropped). The
    // end-screen recap draws this as a wobbly ink line on a 6-zone strip. Pure
    // in-memory data (the list is bounded, so no uncontrolled growth); nothing
    // here touches tuning/spawn/persistence. Skipped for a dying/absent player.
    if (p && p.alive && this.runWaypoints) {
      if (this.runT - this._lastWpT >= 0.5) {
        this._lastWpT = this.runT;
        this.runWaypoints.push({ x: p.x, y: p.y });
        if (this.runWaypoints.length > ROUTE_WAYPOINT_CAP) this.runWaypoints.shift();
      }
    }
    const previousCharge = p.splashCharge;
    p.splashCharge = splashChargeStep(previousCharge, dt, this.input.mouse.rDown, this.input.mouse.rReleased, this.tuning.splashCharge);
    if (previousCharge < 1 && p.splashCharge >= 1) { this.sfx('charge-ready'); this._noiseEvent(p.x, p.y); }

    // ----- named expedition zones (P5): banner + staged spawn + rest checkpoint -----
    if (p.alive) {
      const _zones = this.zones || ZONES;   // D1 (v1.7): the run's zone CONTENT (hand-tuned ZONES by default; the Wander layout when options.wander)
      while (!this._tutorialActive() && this._zoneI < _zones.length && p.x >= this.world.w * _zones[this._zoneI].x) {
        const z = _zones[this._zoneI++];
        this._zoneBeat(z);
      }
      // K3 (v1.5 M3): once past the last NAMED zone (into the final stretch —
      // "zone 5"), arm the Storm Surge set-piece. It is a one-shot, seeded beat;
      // _updateSurge drives it (banner + stinger + bounded mosquito burst + rain
      // buff + bonus orb burst on clear). Non-blocking: the frog pushes through.
      if (this._zoneI >= _zones.length && !this.surge && this.heron && this.heron.x) {
        this.surge = stormSurgeFor(this.runSeed || 0);
      }
    }
    // E2 (v1.2 M10): arm this zone's weather/tide phase once we've entered it.
    // `_zoneI` now indexes the zone we're standing in; the phase is derived
    // deterministically from the run seed + zone index and fires mid-zone (an
    // absolute run-time, atSec seconds after entry).
    if (p.alive && this.weatherZoneI !== this._zoneI) {
      this.weatherZoneI = this._zoneI;
      if (this.tuning.stillWaters) {
        // K5 (v1.5 M2): Still Waters — no weather phases this cycle. Skip the
        // weatherFor call entirely (no rain/drought); the weather stays clear.
        this.weatherPending = null;
        this.weatherTriggerAt = 0;
      } else {
        const wf = weatherFor(this.runSeed || 0, this._zoneI);
        this.weatherPending = wf ? { phase: wf.phase, atSec: wf.atSec } : null;
        if (wf) this.weatherTriggerAt = this.runT + wf.atSec;
      }
    }

    // ----- pigment switching (1-4) -----
    const cycle = this.input.pressed('e') ? 1 : this.input.pressed('q') ? -1 : Math.sign(this.input.mouse.wheel);
    if (cycle) { p.pigment = cycleCombatPigment(p.pigment, cycle); this.sfx('ui'); }
    const PIGMENT_KEYS = ['1', '2', '3', '4'];
    for (let i = 0; i < PIGMENT_KEYS.length; i++) {
      if (this.input.pressed(PIGMENT_KEYS[i])) {
        p.pigment = ['red', 'blue', 'green', 'dry'][i];
        this.sfx('ui');
      }
    }


    p.update(dt, this.input, this.tuning, this.world, this._view());
    // Q5 (Astra): the painted crossing's BRAMBLE — a red-painted mouth stings
    // ONCE when the frog enters the crossing's effect zone (a small hit; latched
    // per entry so a standing frog is not bled, and the way itself is never
    // blocked). A no-op unless the world's crossing is actually 'bramble'.
    if (this.world.crossingState === 'bramble' && inCrossingZone(p.x, p.y)) {
      if (!p._crossingSting) {
        p._crossingSting = true;
        p.hurt(CROSSING.brambleDamage * (this.tuning.dmgTakenMult || 1), this.tuning);
        this.sfx('hurt');
      }
    } else if (p._crossingSting) p._crossingSting = false;
    if (this._tutorialActive()) p.iframes = Math.max(p.iframes, 0.08);
    // S2 (v1.9): the LOW-HP uneasy ostinato — a sparse, high, uneasy layer that
    // SWELLS IN when the frog drops below ~30% HP and fades out above it. A
    // single per-frame boolean comparison (presentation/audio only; never
    // feeds runT). setLowHp is idempotent (only crossfades on a true->false or
    // false->true flip), so the steady-state call is a cheap no-op.
    if (this.audio.setLowHp) {
      const _lowHp = p.alive && p.maxHp > 0 && (p.hp / p.maxHp) < 0.30;
      this.audio.setLowHp(_lowHp);
    }
    this._hopStart = p.hopT > 0 && !this._hopWas;
    this._hopWas = p.hopT > 0;
    this.studio?.update(dt);
    this.lantern.lightFactor = 0;
    if (this.lanternReeds) {
      if (this.input.pressed('l')) {
        // Toggling back on an empty lantern is a no-op (no fuel); toggling off
        // is always allowed. A soft paper "flick" SFX for a real state change.
        const _wasLit = this.lantern.lit;
        this.lantern.lit = !this.lantern.lit;
        if (this.lantern.lit && this.lantern.fuel <= 0) this.lantern.lit = false; // can't relight with no fuel
        if (this.lantern.lit !== _wasLit) this.sfx('paperFlick', { on: this.lantern.lit });
      }
      this._updateLantern(dt, p);
    }
    // J5 (v1.4): capture the orb-streak trail behind the frog every frame the
    // streak is ACTIVE (presentation only — reads from the already-simmed
    // position; never feeds runT). Capped so it can't grow unbounded.
    if (this.orbStreak > 0) {
      const _ss = orbStreakState(this.orbStreak);
      if (_ss.active && (Math.abs(p.vx) > 1 || Math.abs(p.vy) > 1)) {
        if (this._streakTrail.length > 18) this._streakTrail.shift();
        this._streakTrail.push({ x: p.x, y: p.y, t: 0.35, max: 0.35 });
      }
    }
    // J4 (v1.4): a hop landing — a soft dust/water puff + a single ripple ring
    // on the water + a low "boing" SFX. All presentation (draw/sfx-time only;
    // the physics already ran in p.update). Consumed here so it fires once.
    if (p._hopLanded) {
      p._hopLanded = false;
      this.particles.dustPuff(p.x, p.y, 5);
      this.particles.ripple(p.x, p.y);
      this.sfx('boing');
      this._noiseEvent(p.x, p.y); // K2: a hop is a noise (wakes nearby cragfrogs)
    }
    this.paint.update(dt);
    // E3 (v1.2 M10): Bold-only zone hazards (root/slow) apply after movement so
    // they gate the *next* frame's speed. No-op on Gentle/Normal (no hazards).
    if (!this._tutorialActive()) this._updateHazards(dt);
    // E2 (v1.2 M10): advance the zone's weather/tide phase (banner, live tuning
    // multiplier, fade-out). Informational — it never blocks or punishes.
    if (!this._tutorialActive()) this._updateWeather(dt);
    // K3 (v1.5 M3): drive the Storm Surge set-piece (final stretch). Non-blocking
    // and never feeds runT — a pure side-channel off its own clock.
    if (!this._tutorialActive()) this._updateSurge(dt);
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

    // M3 (v1.4 easter egg B): a dry-brush stroke on the SLEEPING heron
    // (pre-engage: _intro > 0) leaves a tiny temporary cheek-blush. Pure
    // presentation — it never affects the heron's state, damage, or pacing.
    if (this.heron && this.heron.hp > 0 && !this.heron.flying && this.heron._intro > 0
        && p.pigment === 'dry' && this.input.mouse.lDown) {
      const hx = this.heron.x - 44, hy = this.heron.y - 262;   // head (world)
      if (this._eggBlush.heron <= 0 &&
          Math.hypot(this.input.mouse.worldX - hx, this.input.mouse.worldY - hy) < 70) {
        this.triggerBlush('heron');
      }
    }

    // ----- attacks -----
    const targetList = this.enemies;
    if (this.input.mouse.lDown || this.input.mouse.lPressed) {
      const swHits = this.paint.trySwipe(targetList);
      // Regular brush rhythm keeps movement at full speed. Existing enemy
      // flashes/ink/audio acknowledge hits; kills and charged bursts retain
      // their stronger stop. Repeated 50ms dips made close combat feel sticky.
      if (swHits && swHits.length && !this._tutorialActive()) this.addShake(1);
      this._noiseEvent(p.x, p.y); // K2: a paint swipe is a noise
      this._bestiarySwipe(p); // R3 (v1.6): leech paint-off + serpent ring-interrupt
      // paint the heron too (only while boss is "live" and player not dying)
      // R4 (v1.6): the Wyrm is PAINTABLE only while surfaced (the breach-strike
      // window) — between surfaces it is underground + INVULNERABLE + untargetable.
      // G2 (v1.8): the Umbral Wyrm is paintable per the pure umbraPaintable —
      // surfaced AND (in the "deep dark" final phase) the player's lantern must
      // be LIT (the lantern is MANDATORY: the wyrm is only paintable in light).
      const hPaintable = this.heron && this.heron.hp > 0 && !this.heron.flying && this.heron._intro <= 0
        && !(this.heron.wyrm && this.heron.phase !== 'surfaced')
        && !(this.heron.umbra && !umbraPaintable(this.heron, this.lantern && this.lantern.lit))   // G2: surfaced + (deep dark ⇒ lantern lit)
        && !(this.heron.warden && this.heron.phase !== 'mawOpen');
      if (hPaintable) {
        const res = this.paint.paintBossHit(this.heron, p.pigment, this.tuning.bossPaintHit);
        if (res === 'awaken') {
          this.sfx('awaken');
          // S1 (v1.9): the shared BOSS PHASE-SHIFT sting — the 3-hue awaken is
          // the boss's phase-shift moment (it turns vulnerable + the pattern
          // changes). One sting covers all 4 boss archetypes (heron/wyrm/
          // warden/umbra all flow through this path). The distinct awaken
          // BLOOM is the separate 'awaken-bloom' from _triggerBloom below.
          this.sfx('boss-phase');
          // V2 (v1.2 M11): the heron turns colorful — a short celebratory
          // bloom: radial color wash + a brief world-saturation surge + a
          // distinctive 'awaken-bloom' SFX. Pure presentation (see _triggerBloom).
          this._triggerBloom(this.heron.x, this.heron.y - 150);
          this.addShake(14);
          // J3 (v1.4): the awaken moment — the camera holds on the rising heron
          // with a brief zoom-out for ~1.2 s (presentation; real-time, never
          // feeds runT). Fires once per rise (paintBoss returns 'awaken' once
          // per awaken, gated by h.awakened in logic.js).
          this._awakenHoldT = 1.2;
          this.addBanner('The Heron AWAKENS — paint it while it shimmers!', 3.4);
        }
      }
      // E1: paint the Painted Heron (mid-run set-piece) the same way
      if (this.midHeron && this.midHeron.hp > 0 && !this.midHeron.flying && this.midHeron._intro <= 0) {
        const res = this.paint.paintBossHit(this.midHeron, p.pigment, this.tuning.bossPaintHit);
        if (res === 'awaken') {
          this.sfx('awaken');
          this.addShake(10);
          this.addBanner('The Painted Heron shimmers — paint it while it glows!', 3.0);
        }
      }
      // T3 (v1.2 M13): paint the sketch heron (the teaching beat) the same way —
      // the 3-hue awaken loop, at a low-HP scale.
      if (this.sketchHeron && this.sketchHeron.hp > 0 && !this.sketchHeron.flying) {
        const res = this.paint.paintBossHit(this.sketchHeron, p.pigment, this.tuning.bossPaintHit);
        if (res === 'awaken') {
          this.sfx('awaken');
          this.addShake(8);
          this.addBanner('The sketch heron shimmers — that is the 3-hue rhythm!', 2.8);
        }
      }
    }
    if (this.input.mouse.rReleased && p.splashCharge >= 1 && this.paint.splashCd <= 0) {
      const spHits = this.paint.trySplash(targetList);
      this.addShake(8);
      // J1 (v1.9): the CHARGED-splat hit-stop — a longer ~110 ms dip when the
      // charged burst actually CONNECTS (hits >= 1 enemy). Longer than the
      // swipe connect (the full-charge splat is the heavier impact of the core
      // paint verb). Reuses the v1.4 hitStop (real-time, gated by options.shake,
      // never touches tuning/runT/RNG). A whiffed charge (no hits) still fires
      // the shake + SFX but takes no hit-stop — only a real connect freezes.
      // Gated off during the guided teaching run (see the swipe connect above):
      // combat time-dilation belongs to the timed expedition, not the frozen-clock
      // practice layer.
      if (spHits && spHits.length && !this._tutorialActive()) this.hitStop(0.11, 0.3);
      this._noiseEvent(p.x, p.y); // K2: a splash is a loud noise
      this._bestiarySplash(p); // R3 (v1.6): a BLUE splash BLINDS a nearby wisp
      // splash the heron if it's in the burst
      // R4 (v1.6): the wyrm is splashed only while surfaced (untargetable
      // underground — same rule as the swipe path).
      if (this.heron && this.heron.hp > 0 && !this.heron.flying && this.heron._intro <= 0
        && !(this.heron.wyrm && this.heron.phase !== 'surfaced')
        && !(this.heron.umbra && this.heron.phase !== 'surfaced')   // G2: the Umbral Wyrm is splashed only while surfaced
        && !(this.heron.warden && this.heron.phase !== 'mawOpen')) {
        const d = dist(p.x, p.y, this.heron.x, this.heron.y - 140);
        if (d <= this.tuning.splashRadius + 60) {
          this.paint.paintBossHit(this.heron, p.pigment, this.tuning.bossPaintHit);
        }
      }
    }

    // Releasing early or during recovery cancels; a later click cannot fire
    // an old stored charge. Lost input ownership (blur/menu) also clears it.
    if (this.input.mouse.rReleased) p.splashCharge = 0;

    this.encounter?.update(dt);
    // ----- enemies -----
    // P10: skip full AI for enemies far off-screen (they can't attack or be
    // painted at that range). Burn damage ALWAYS still ticks (the status check
    // below) so an off-screen burn kill is identical to before; only the
    // seek/move/contact work is skipped. A 500px buffer keeps enemies from
    // visibly freezing at the edge. `p` is the player (declared above).
    const CULL2 = 500 * 500;
    if (this.world.reedsVariant && !this._tutorialActive()) { this._mothEncounterTick(); this._bestiaryTick(dt, p); }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (this._tutorialActive() && e !== this.tutorial.target) continue;
      if (this.encounter?.active && !e._clearing) continue;
      if (!e.dead && p.alive) {
        const dx = e.x - p.x, dy = e.y - p.y;
        const far = dx * dx + dy * dy > CULL2;
        // At most two moths: keep their light/status clock alive offscreen so
        // returning to the nook cannot resume an unseen, stale committed dash.
        if (far && e.kind !== 'moth' && !(e.status && e.status.type === 'burn')) continue;
      }
      e.update(dt, p, this.tuning, this.world, this.now);
      // S1 (v1.9): the STATUS-OFF sting (the state drops on its own timer —
      // burn burns out / freeze thaws / root cracks). `stepStatus` only sets
      // the expiry when the timer hits 0 (a burn KILL is a separate hp path,
      // so a just-died enemy skips this and plays its death sound instead).
      // Presentation-only: consumed (nulled) so it fires exactly once.
      if (e._statusExpired) {
        const st = e._statusExpired; e._statusExpired = null;
        if (!e.dead) {
          if (st === 'burn') this.sfx('burn-out');
          else if (st === 'freeze' || st === 'slow') this.sfx('freeze-release');
          else if (st === 'root') this.sfx('root-crackle');
        }
      }
      if (e._burnTick) {
        e._burnTick = 0;
        this.particles.embers(e.x, e.y - 10, 2);
      }
      if (e.dead) { this._onEnemyDead(e); this._challengeAdd('enemy'); this.enemies.splice(i, 1); }
    }

    // ----- T1/T2 (v1.2 M13): advance the tutorial once the REAL effect lands.
    // The target is held by reference (survives the splice above), so its
    // death/status is read live — a brush stroke alone never advances it.
    if (tut && !tut.done && p.alive) this._tutorialTick();

    // Retraining is a quiet lesson even when entered during a boss fight.
    if (this._tutorialActive()) { this._updateSketchHeron(dt); return; }

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
    // R4 (v1.6): in the Reeds the end boss is THE SILT WYRM — it engages (its
    // intro lapses) only when the frog REACHES THE ARENA at the end of the run
    // (a proper end-of-Reeds boss, not a far-away attacker). The swamp heron
    // engages on its short 3.2 s reveal as before (byte-identical).
    if (this.heron.warden) {
      // F1 (v1.7): the Warden engages on ARENA entry (like the Silt Wyrm — it
      // is an end-of-run arena apex, not a far-away attacker). Wander is
      // Reeds-compatible (D3), so the arena gate is identical to the wyrm's.
      const wardenArena = p.x > this.world.w - 900;
      if (wardenArena && this.heron._intro > 0) this.heron._intro = 0;   // lapse on arena entry
      if (this.heron._intro <= 0 && !this._wardenEngaged) {
        this._wardenEngaged = true;
        this.sfx('warden-rumble');
        if (this.audio.setBossTheme) this.audio.setBossTheme(this.heron.kind);
        const tNote = this.wanderTaste ? this.wanderTaste.name : '';
        this.addBanner('THE HOLLOW WARDEN', 3.2, 150);
        if (tNote) this.addBanner('The ' + tNote + ' taste rides this Warden.', 3.2, 185);
        this.zoomTarget = 0.92;
      }
    } else if (this.heron.umbra) {
      // G2 (v1.8): the UMBRAL WYRM engages on ARENA entry (like the Silt Wyrm —
      // it is the Black Reeds' end-of-run apex). It reuses the wyrm's arena
      // gate (Reeds-compatible) + its own dual-maw / deep-dark tell.
      const umbraArena = p.x > this.world.w - 900;
      if (umbraArena && this.heron._intro > 0) this.heron._intro = 0;   // lapse on arena entry
      if (this.heron._intro <= 0 && !this._umbraEngaged) {
        this._umbraEngaged = true;
        this.sfx('wyrm-rumble');
        if (this.audio.setBossTheme) this.audio.setBossTheme(this.heron.kind);
        this.addBanner('THE UMBRAL WYRM', 3.2, 150);
        this.addBanner('The keeper of our stolen color.', 3.2, 195);
        this.zoomTarget = 0.92;
      }
    } else if (this.heron.wyrm) {
      const wyrmArena = p.x > this.world.w - 900;
      // The reveal delay cannot substitute for entering the actual arena.
      // Otherwise a 3.2s expiry starts distant boss cues during exploration.
      if (wyrmArena && this.heron._intro > 0) this.heron._intro = 0;
      if (this.heron._intro <= 0 && !this._wyrmEngaged) {
        this._wyrmEngaged = true;
        this.sfx('wyrm-rumble');
        if (this.audio.setBossTheme) this.audio.setBossTheme(this.heron.kind);
        this.addBanner('THE SILT WYRM', 3.2, 150);
        this.zoomTarget = 0.92;
      }
    } else if (this.heron._intro > 0 && bossArenaReached(p.x, this.world.w)) {
      this.heron._intro -= dt;
      if (this.heron._intro <= 0) {
        this.sfx('boss-growl');
        if (this.audio.setBossTheme) this.audio.setBossTheme(false);
        this.addBanner('THE GREAT GRAY HERON', 3.2, 150);
        this.zoomTarget = 0.92;
        this._challengeAdd('bossEngage');
      }
    }
    if (this.heron._intro <= 0) (this.heron.warden ? this._updateWarden(dt) : (this.heron.umbra ? this._updateUmbra(dt) : (this.heron.wyrm ? this._updateWyrm(dt) : this._updateBoss(dt))));

    // ----- E1: the Painted Heron (mid-run set-piece) -----
    // Non-blocking: dormant until the frog draws near, then it announces
    // itself and runs on the shared bossStep machinery. The frog can walk past
    // it (optional) — it never gates the run — so defeating it is a reward.
    // NOTE: the update runs even at hp<=0 (like the final heron) so bossStep
    // can emit the 'defeated' event; the update block no-ops once cleared.
    if (this.midHeron) {
      const mh = this.midHeron;
      if (mh.hp <= 0) {
        this._updateMidHeron(dt);            // fires 'defeated' -> cleared
      } else if (!mh._active) {
        if (dist(p.x, p.y, mh.x, mh.y) <= MID_HERON.trigger) {
          mh._active = true;
          this.sfx('boss-growl');
          this.addBanner('The Painted Heron', 2.6, 150);
          this.addBanner('Paint it to awaken — or walk past. The road on.', 3.4, 190);
          mh._intro = 1.6;
        }
      } else if (mh._intro > 0) {
        mh._intro -= dt;
      } else {
        this._updateMidHeron(dt);
      }
    }

    // ----- T3 (v1.2 M13): the sketch heron (teaching beat) -----
    // Driven only while the tutorial 'sketch' phase is live (it is spawned by
    // that phase and cleared when it ends), so it can never appear in the timed
    // run.
    if (this.sketchHeron && !this.dying) this._updateSketchHeron(dt);

    // ----- first-hit teaching (once per lifetime) -----
    if (p.alive && p.hp < this._prevHp) {
      // J1 (v1.9): the SELF-DAMAGE hit-stop — a SHORT ~30 ms dip when the frog
      // takes a hit this frame (contact / boss strike / hazard). The `p.hp <
      // _prevHp` gate is true only on the frame HP actually dropped (prevHp is
      // reset to the new HP below), so it fires once per hurt event, never
      // machine-gun. Deliberately SHORTER + less aggressive (0.4×) than the
      // enemy-hit connect so taking damage still reads as "ouch" without the
      // sluggish feel of the big freezes — it layers on the existing hurt
      // feedback (red flash, squash, shake), it doesn't replace it. Reuses the
      // v1.4 hitStop (real-time, gated by options.shake, never touches
      // tuning/runT/RNG).
      this.hitStop(0.03, 0.4);
      if (!this.save.flags.firstHurt) {
        this.save.flags.firstHurt = true;
        SaveSys.save(this.save);
      }
      // E4: any damage taken breaks the clean-orb streak.
      if (this.orbStreak > 0) this.orbStreak = 0;
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
    // V3 (v1.2 M11): crossfade the per-zone ambient bed to the zone just entered.
    this._updateZoneAmbient();
    // M8 P12: a brief zone-accent wash so entering a zone reads as a change of
    // place, not just a new banner.
    if (z.accent) this._zoneTint = { color: z.accent, t: 2.6, max: 2.6 };
    // M8 P12: a signature guardian of the zone's emblematic enemy — scaled up
    // and ringed in the zone's accent. It leads the zone's combat beat.
    if (z.sig) this._spawnZoneElite(p, z);
    // E3 (v1.2 M10): Bold-only environmental hazards for this zone (thorn reeds
    // that root, mud pools that slow). Gentle/Normal skip this entirely, so the
    // 15-20 min Normal pacing is untouched (difficulty-gated).
    if (boldHazardsAllowed(this.options.difficulty)) this._spawnZoneHazards(z);
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
    if (this._atlasCheckpoints.length < 4) this._atlasCheckpoints.push({ x: rx, y: ry });
    this.world.paintSplash(rx, ry, 110, 'green');
    this.particles.leafPuff(rx, ry - 40, '#9ed483', 3);
    for (let i = 0; i < 2; i++) {
      this.orbs.push({ x: rx + (Math.random() - 0.5) * 160, y: ry + (Math.random() - 0.5) * 120, color: ORB_COLORS[(Math.random() * 3) | 0], t: 0 });
    }
  }

  // R1 (v1.6): THE LANTERN update (Reeds variant only). Advances the pure
  // lanternTick (drain while lit / auto-extinguish / refill at a nearby
  // firefly or lantern-rest spot) and refreshes the two render-only fields the
  // dark overlay + HUD read: `lanternRadius` (the eased light radius) and
  // `lightFactor` (the 0..1 value the R3 bestiary keys to, at the frog). The
  // refill proximity is a world-space distance check (the lantern is carried by
  // the frog, so the source is the frog). No save data. Presentation-only
  // radius easing — the fuel rules are the pure lanternTick.
  _updateLantern(dt, p) {
    // G1 (v1.8): read the run's lantern TUNING (this._lanternTuning, defaulting
    // to LANTERN when unset — e.g. the pre-Black-Reeds title). A Black Reeds run
    // passes REEDS_DARK_LANTERN (faster drain, shorter reach); every other run
    // passes LANTERN (byte-identical — the *For wrappers fall back to LANTERN on
    // missing fields, so even a partial table behaves exactly like R1).
    const lt = this._lanternTuning || LANTERN;
    const nearRest = this._lanternNear(p.x, p.y, this.world.restSpots, lt.restSpotRadius);
    const nearFirefly = this._lanternNear(p.x, p.y, this.world.fireflies, lt.fireflyRadius);
    this.lantern = lanternTickFor(this.lantern, dt, this.lantern.lit, nearRest, nearFirefly, lt);
    // A successful refill (fuel strictly up while at a source) gives a soft,
    // quiet "wick catching" blip — at most ONCE per source-entry (latched) so it
    // doesn't spam while the frog stands on a spot. The latch clears when the
    // frog leaves the source (fuel stops rising) or the wick tops up.
    const refilling = nearRest || nearFirefly;
    if (refilling && !this._wickLatch) { this._wickLatch = true; this.sfx('wickCatch'); }
    if (!refilling || this.lantern.fuel >= 1) this._wickLatch = false;
    // Refresh the eased render radius (the cached gradient is keyed to it) +
    // the frog's own lightFactor for R3.
    this._lanternEasedR = lanternRadiusFor(this.lantern, lt);
    this.lantern.lightFactor = lanternLightFactor(this.lantern, p.x, p.y, p.x, p.y, lt);
  }
  // R1 (v1.6): does any source in `list` lie within `radius` of (x, y)? A
  // small pure-ish proximity helper (world-space, no browser APIs). Returns the
  // first hit's index (-1 none). Kept tiny so the drain loop stays cheap.
  _lanternNear(x, y, list, radius) {
    if (!list || !list.length) return false;
    const r2 = radius * radius;
    for (let i = 0; i < list.length; i++) {
      const dx = list[i].x - x, dy = list[i].y - y;
      if (dx * dx + dy * dy <= r2) return true;
    }
    return false;
  }

  // E2 (v1.2 M10): drive the current zone's weather/tide phase. It fires the
  // pending phase mid-zone (announced via the banner system), applies a live
  // multiplier to the tuning fields it affects (eased in/out so the effect
  // never jumps), and restores them EXACTLY to their captured base on expiry.
  // Informational — it never blocks the run or punishes the player.
  _updateWeather(dt) {
    const t = this.tuning;
    if (!t) return;
    // fire a pending phase once its mid-zone trigger time passes
    if (!this.weatherActive && this.weatherPending && this.runT >= this.weatherTriggerAt) {
      const ph = this.weatherPending.phase;
      const base = {};
      for (const f of ph.fields) base[f] = t[f];
      this.weatherActive = { phase: ph, t: 0, dur: ph.duration, base };
      this.sfx('ui');
      this.addBanner(ph.desc, ph.duration * 0.45, 205);
    }
    // advance an active phase, applying the eased multiplier each frame
    if (this.weatherActive) {
      const w = this.weatherActive;
      w.t += dt;
      const k = weatherFactor(w.phase, w.t);
      for (const f of w.phase.fields) t[f] = w.base[f] * k;
      if (w.t >= w.dur) {
        // clean expiry: restore every affected field to its captured base
        for (const f of w.phase.fields) t[f] = w.base[f];
        this.weatherActive = null;
      }
    }
  }
  // K3 (v1.5 M3): drive the Storm Surge — the zone-5 (final-stretch) set-piece.
  // A short (~15 s) scripted beat, NON-blocking: the frog can push straight
  // through it, and it NEVER feeds runT or the pacing probes (it is a pure
  // side-channel driven off `this.surge.t`, not the run clock). On entry it
  // announces with a banner + the S1-style stormSurgeStinger, throws a BOUNDED
  // burst of fast mosquitoes (rides the shared spawn cap), applies a transient
  // rain buff (the E2 weatherFactor machinery on splashRadius, ramping back to
  // base at expiry), and on a clear scatters a bonus orb burst. Clean expiry:
  // the rain buff is restored to its captured base and the surge drops.
  _updateSurge(dt) {
    const s = this.surge;
    if (!s || s.done) return;
    const t = this.tuning;
    // ---- the beat has started once we're past the seeded lead-in ----
    if (!s.active) {
      s.t += dt;
      if (s.t < s.leadIn) return;
      s.active = true;
      s.t = 0;
      // announce (banner + S1-style stinger) + the transient rain buff.
      this.addBanner('STORM SURGE!', 2.6, this.ch * 0.22);
      this.addBanner('The swamp storms — fast bugs, wider rain! Clear them for orbs.', 3.6, this.ch * 0.22 + 32);
      if (this.audio.stormSurgeStinger) this.audio.stormSurgeStinger(); else this.sfx('boss-growl');
      // K9 (v1.5 M4): one-shot first-sight callout for the set-piece.
      this._firstSightNote('surge', 'The STORM SURGE — clear the swarm before the rain wears off for bonus orbs.');
      const base = {};
      for (const f of STORM_SURGE.rain.fields) base[f] = t[f];
      this._surgeRainBase = base;
      this.sfx('ui');
    }
    // ---- advance the live beat ----
    s.t += dt;
    // rain buff (transient, rides the E2 eased multiplier; restored at expiry)
    if (this._surgeRainBase) {
      const k = weatherFactor(stormSurgeRainPhase(), s.t);
      for (const f of STORM_SURGE.rain.fields) t[f] = this._surgeRainBase[f] * k;
    }
    // the bounded mosquito burst, spread over `burstWindow`
    if (s.burst < STORM_SURGE.burstCount) {
      s.burstT += dt;
      const every = STORM_SURGE.burstWindow / STORM_SURGE.burstCount;
      s.spawnT -= dt;
      if (s.spawnT <= 0) {
        s.spawnT = every;
        s.burst++;
        this._spawnSurgeMosquito();
      }
    }
    // a clear: every burst mosquito spawned AND all of them gone (they are
    // spliced from this.enemies on death, so this reference is a live count)
    this._surgeEnemies = this._surgeEnemies.filter(e => !e.dead);
    if (!s.awarded && s.burst >= STORM_SURGE.burstCount && this._surgeEnemies.length === 0) {
      s.awarded = true;
      this._awardSurgeOrbs();
    }
    // clean expiry: restore the rain buff to base and drop the surge
    if (s.t >= STORM_SURGE.duration) {
      if (this._surgeRainBase) {
        for (const f of STORM_SURGE.rain.fields) t[f] = this._surgeRainBase[f];
        this._surgeRainBase = null;
      }
      s.done = true;
      this.surge = null;
      this._surgeEnemies = [];
    }
  }
  // K3: spawn one surge mosquito near the frog (bounded by the shared cap).
  // It is a normal enemy so the frog can paint it, and it is tracked in
  // this._surgeEnemies for the clear check.
  _spawnSurgeMosquito() {
    if (this.enemies.length >= 14) return; // hard bound on the surge's share
    const p = this.player;
    const a = Math.random() * TAU;
    const rr = 180 + Math.random() * 220;
    const x = clamp(p.x + Math.cos(a) * rr, 60, this.world.w - 60);
    const y = clamp(p.y + Math.sin(a) * rr, 60, this.world.h - 60);
    const e = spawnEnemy('mosquito', x, y, this.tuning);
    // the surge's mosquitoes are a touch faster (the "fast swarm")
    e.speed *= 1.25;
    e._surge = true;
    this.enemies.push(e);
    this._surgeEnemies.push(e);
  }
  // K3: on a clear, scatter a bonus orb burst around the frog.
  _awardSurgeOrbs() {
    const p = this.player;
    for (let i = 0; i < STORM_SURGE.orbCount; i++) {
      const a = (i / STORM_SURGE.orbCount) * TAU + Math.random() * 0.5;
      const rr = 120 + Math.random() * 120;
      this.orbs.push({
        x: clamp(p.x + Math.cos(a) * rr, 60, this.world.w - 60),
        y: clamp(p.y + Math.sin(a) * rr, 60, this.world.h - 60),
        color: ORB_COLORS[(Math.random() * ORB_COLORS.length) | 0], t: 0,
      });
    }
    this.addBanner('The storm breaks — a scatter of orbs!', 2.6, this.ch * 0.3);
    this.sfx('pickup-streak');
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

  // E3 (v1.2 M10): place this zone's Bold-only hazards deterministically from
  // the run seed + zone index (so a Bold run replays the same layout) and push
  // them into `this.hazards`. Called only from _zoneBeat on Bold.
  _spawnZoneHazards(z) {
    const placed = placeZoneHazards(this.runSeed || 0, this._zoneI, z, this.world.w, this.world.h);
    for (const hz of placed) {
      const t = BOLD_HAZARDS.types[hz.kind];
      this.hazards.push({
        kind: hz.kind, x: hz.x, y: hz.y, r: t.r, seed: Math.floor((hz.x * 3 + hz.y) % 997),
        _cd: 0, // per-hazard re-trigger cooldown (prevents re-rooting every frame)
      });
    }
  }

  // V3 (v1.2 M11): set the per-zone ambient bed to the zone the frog is in.
  // `this._zoneI` is the index of the zone just entered (0 = the calm pre-zone
  // opening, 1..4 = the four named zones). No-op if the context isn't ready
  // (headless) or the zone is unchanged — audio.js keeps it idempotent too.
  _updateZoneAmbient() {
    if (!this.audio || !this.audio.ctx) return;
    this.audio.setZoneAmbient(this._zoneI);
    // Regions have complete pieces; small zone boundaries preserve the phrase.
    // The campaign index distinguishes Hollow Sanctuary from Sunken Reeds.
    if (this.audio.setZoneTheme) this.audio.setZoneTheme(this._zoneI, this.runBiome, this.campaign?.floor);
    if (this.audio.zoneSwell) this.audio.zoneSwell();
  }

  // E3: apply the active hazards' effects (thorn reed = brief root, mud pool =
  // slow) when the frog is inside them. Gentle/Normal never populate hazards,
  // so this is a no-op there. Non-damaging: it costs time/space, not HP.
  _updateHazards(dt) {
    const p = this.player;
    if (!p || !p.alive || this.hazards.length === 0) return;
    for (const hz of this.hazards) {
      if (hz._cd > 0) { hz._cd -= dt; continue; }
      if (dist(p.x, p.y, hz.x, hz.y) >= hz.r + p.r * 0.5) continue;
      const t = BOLD_HAZARDS.types[hz.kind];
      if (hz.kind === 'thornReed') {
        p.rootT = Math.max(p.rootT, t.rootDur);
        hz._cd = t.rootDur + 0.5;
        this.sfx('paint-create');
        this.particles.sparkles(p.x, p.y - 8, t.color, 5);
        this.paint.note(p.x, p.y - 14, 'rooted!', 'green');
      } else if (hz.kind === 'mudPool') {
        p.slowT = Math.max(p.slowT, t.slowDur);
        hz._cd = t.slowDur * 0.5;
        this.particles.splatter(p.x, p.y, t.color, 3, 60);
      }
    }
  }

  // E3: draw the zone hazards in world space (thorn reeds = spiky green, mud
  // pools = flat brown). Pure presentation; no gameplay.
  _drawHazards(ctx, sat01) {
    if (!this.hazards || this.hazards.length === 0) return;
    for (const hz of this.hazards) {
      const t = BOLD_HAZARDS.types[hz.kind];
      ctx.save();
      ctx.translate(hz.x, hz.y);
      if (hz.kind === 'mudPool') {
        ctx.fillStyle = sat(t.color, sat01);
        ctx.beginPath();
        ctx.ellipse(0, 0, hz.r, hz.r * 0.55, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else { // thornReed
        ctx.fillStyle = sat(t.color, sat01);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * TAU + hz.seed;
          const len = hz.r * (0.7 + 0.3 * ((hz.seed + i) % 5) / 5);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
          ctx.lineTo(Math.cos(a + 0.3) * len * 0.5, Math.sin(a + 0.3) * len * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    }
  }

  // K2 (v1.5 M2): a noise event (a paint swipe/splash, a hop landing, a charge
  // completing) at (x, y) wakes any nearby Blind Crag Frog. Only cragfrogs have
  // a wakeNoise (others are no-ops), so this is safe to call unconditionally on
  // any sound the frog makes. Pure per-enemy state (enemies.js) — the sound
  // source is the player, so no world noise accumulator is needed.
  _noiseEvent(x, y) {
    if (!this.enemies) return;
    for (const e of this.enemies) { if (e.wakeNoise) e.wakeNoise(x, y); }
  }

  // Q5 (Astra): the real paint action — a swipe/splash whose reach touches
  // the crossing's mouth repaints it with the stroke's pigment. The pure
  // transition + the transition-only collision rebuild live in world
  // (paintCrossing); this routes the stroke, plays the beat, and latches the
  // one-time postcard stamp (save.flags.crossingPainted — no SAVE_VERSION
  // bump; the field lives on the existing flags object). A dry brush or a
  // no-op pigment changes nothing.
  _paintCrossingStroke(stroke) {
    const w = this.world;
    if (!w || !strokeTouchesCrossing(stroke)) return;
    const next = w.paintCrossing(stroke.pigment);
    if (!next) return;
    const first = !this.save.flags.crossingPainted;
    this.save.flags.crossingPainted = true;
    SaveSys.save(this.save);
    this.sfx('crossing-part');
    const note = next === 'crossing' ? 'the bramble parts — a safe crossing'
      : next === 'current' ? 'water fills the gap — a slow current'
      : 'thorns wake — the crossing stings';
    this.addBanner('The crossing takes your paint: ' + note + '.', 4.4, 150);
    if (first) this.addBanner('Your postcards now wear the crossing\'s stamp.', 4.4, 185);
  }

  _spawnWave(dt) {
    if (this._tutorialActive() || this.studio?.sheltered() || this.encounter?.suppressesWaves) return;
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    const t = this.runT - (this._floorStartT || 0);
    const sr = this.tuning.spawnRate || 1;
    const interval = Math.max(1.15 / sr, (2.7 - t / 60) / sr);
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
    const turtleAllowed = this._zoneI >= 3;
    if (turtleAllowed && t > 25 && roll > 0.9) kind = 'turtle';
    const cragAllowed = this._zoneI >= 3;
    if (cragAllowed && t > 30 && roll > 0.86 && roll <= 0.9) kind = 'cragfrog';
    if (this.world.reedsVariant && t > 15) {
      const rr = Math.random();
      const b = this._reedsBestiary;
      const wT = b ? b.wisp : 0.965;
      const sT = b ? b.serpent : 0.935;
      const lT = b ? b.leech : 0.905;
      if (rr > wT) kind = 'wisp';
      else if (rr > sT) kind = 'serpent';
      else if (rr > lT) kind = 'leech';
    }
    this.enemies.push(spawnEnemy(kind, x, y, this.tuning));
    // K9 (v1.5 M4): one-shot first-sight callout for the new creatures (UI
    // banner only — see _firstSightNote).
    if (kind === 'turtle') {
      this._firstSightNote('turtle', 'New in the swamp — the Mud Turtle. Its shell bounces paint from the FRONT; circle behind, or burn it with red.');
    } else if (kind === 'cragfrog') {
      this._firstSightNote('cragfrog', 'New in the swamp — the Blind Crag Frog. It hunts by SOUND; stay quiet and it sleeps (and takes +50% damage).');
    } else if (kind === 'wisp') {
      this._firstSightNote('wisp', 'New beneath the Reeds — the Glow Wisp. It homes to your LANTERN\u2019s glow; a BLUE splash BLINDS it.');
    } else if (kind === 'serpent') {
      this._firstSightNote('serpent', 'New beneath the Reeds — the Mud Serpent. It burrows and telegraphs a lunge; PAINT THE RING before it surfaces.');
    } else if (kind === 'leech') {
      this._firstSightNote('leech', 'New beneath the Reeds — the Silt Leech. It clings and STRANGLES your color; PAINT it off or HOP clear.');
    }
  }

  // R3 (v1.6 Module R): the Reeds bestiary's per-frame touch-up. Called from the
  // enemy-update loop so the three archetypes get the light / cling hooks they
  // can't compute on their own (they need the lantern light + the player's hop):
  //   · wisp._light  — the lightFactor it receives (drives draw alpha + homing)
  //   · leech cling  — arm on contact (respecting the re-attach window), peel on
  //     HOP (one hop breaks the cling; a second leech can't latch for ~6s)
  // One optional in-run introduction, never a wave-table entry. The nook is
  // 450px above the corridor; leaving it removes the carried-light lure.
  _mothBanner(text) {
    this.banners = this.banners.filter(b => !b.moth);
    this.banners.push({ text, t: 4, max: 4, y: this.ch - 110, moth: true });
  }

  _mothEncounterTick() {
    const f = this.world.mothFlower, p = this.player;
    if (!f || !p.alive || this._tutorialActive()) return;
    if (!f.started && dist(p.x, p.y, f.x, f.y) <= MOTH_NOOK.wakeRadius && mothCanSpawn(this.enemies)) {
      const e = spawnEnemy('moth', f.x + 90, f.y, this.tuning);
      this.enemies.push(e); f.started = true;
      this._mothBanner('Lantern moth nook · follow the light');
    }
    for (const e of this.enemies) {
      if (e.kind !== 'moth' || e.dead) continue;
      if (e.mothPhase !== e._mothSoundPhase) {
        if (e.mothPhase === 'tell') this.sfx('moth-tell');
        e._mothSoundPhase = e.mothPhase;
      }
      const reward = mothReward(e);
      if (reward) {
        f.resting = true;
        this.stock.blue = Math.min(this.tuning.capacity, this.stock.blue + reward);
        this.collected.blue += reward;
        this.sfx('moth-settle');
        this.paint.note(e.x, e.y - 32, '+2 blue · a quiet thank-you', 'blue');
        this._mothBanner('+2 Cobalt · the moth rests safely');
      }
    }
  }

  _bestiaryTick(dt, p) {
    const L = this.lantern;
    const cx = p.x, cy = p.y;   // the lantern is carried by the frog
    const ltBest = this._lanternTuning || LANTERN;
    for (const e of this.enemies) {
      if (e.kind === 'moth') {
        const visible = lanternLightFactor(L, e.x, e.y, cx, cy, ltBest) > 0.01;
        const inNook = dist(p.x, p.y, MOTH_NOOK.x, MOTH_NOOK.y) <= MOTH_NOOK.homeRadius;
        // Reuse one light record; never let ambient sources own the lure.
        const light = e.mothLight ||= { owner: 'player' };
        light.x = cx; light.y = cy; light.alive = p.alive;
        light.lit = visible && inNook;
      }
      if (e.wisp) {
        // R3 (a): the wisp's lightFactor at ITS position (how much light it
        // actually gets) — drives its draw alpha + its lit-homing vs unlit-drift.
        e._light = lanternLightFactor(L, e.x, e.y, cx, cy, ltBest);
      }
      if (e.leech && !e.clinging) {
        // R3 (c): a detached leech that touches the frog CLINGS — but only if
        // the re-attach window is closed (a second leech can't latch for ~6s
        // after the last cling ended) and the frog isn't in i-frames.
        const d = dist(e.x, e.y, p.x, p.y);
        if (p.alive && p.iframes <= 0 && p.leechCd <= 0 && d < e.r + p.r + 2) {
          e.clinging = true; e._drainAcc = 0;
          p.leechAttached = true;
          p.leechCd = REEDS_BESTIARY.leechReattach;
          this.sfx('leech-attach');
        }
      }
    }
    // R3 (c): HOP-OFF — one hop breaks a clinging leech (the frog's hop start is
    // the frame hopT goes from <=0 to >0). Peel it, arm the re-attach window.
    if (p.leechAttached && this._hopStart) {
      this._hopStart = false;
      for (const e of this.enemies) {
        if (e.leech && e.clinging) { e.clinging = false; e._drainAcc = 0; }
      }
      p.leechAttached = false;
      p.leechCd = REEDS_BESTIARY.leechReattach;
      this.sfx('leech-peel');
    } else if (!this._hopStart) {
      this._hopStart = false;
    }
  }

  // R3 (v1.6 Module R): a paint SWIPE's bestiary hooks (any pigment counts —
  // the leech's "one combat use" for the dry brush is here):
  //   · a swipe touching a CLINGING leech peels it OFF (same as a hop).
  //   · a swipe that paints a RIPPLE RING at a telegraphing serpent's surface
  //     point INTERRUPTS its strike (knocks it back underground + re-cooldowns).
  // The swipe fan is the brush's aim at the mouse (same geometry as trySwipe).
  _bestiarySwipe(p) {
    const aimA = p.aimA;
    const range = this.tuning.swipeRange;
    const arc = this.tuning.swipeArc;
    const inFan = (ex, ey) => {
      const dx = ex - p.x, dy = ey - p.y;
      const d = Math.hypot(dx, dy);
      if (d > range) return false;
      let a = Math.atan2(dy, dx) - aimA;
      while (a > Math.PI) a -= TAU;
      while (a < -Math.PI) a += TAU;
      return Math.abs(a) <= arc;
    };
    for (const e of this.enemies) {
      if (e.leech && e.clinging) {
        // R3 (c): PAINT-OFF — any swipe TOUCHING THE FROG peels the leech (the
        // dry brush's one combat use). A clinging leech rides the frog, so this
        // is a simple range-of-the-frog test (not an aim-direction fan): the
        // frog can peel it off without precisely aiming at a tiny leech.
        if (dist(e.x, e.y, p.x, p.y) <= range + e.r) {
          e.clinging = false; e._drainAcc = 0;
          p.leechAttached = false;
          p.leechCd = REEDS_BESTIARY.leechReattach;
          this.sfx('leech-peel');
          this.paint.note(e.x, e.y - 14, 'painted off', p.pigment);
        }
      }
      if (e.burrower && e.phase === 'telegraph' && inFan(e.burrowX, e.burrowY)) {
        // R3 (b): a painted RING on the water before the serpent surfaces
        // INTERRUPTS the strike — knock it back underground + re-cooldown.
        if (!e.interrupted) {
          e.interrupted = true;
          this.sfx('serpent-dive');
          this.particles.ripple(e.burrowX, e.burrowY);
          this.paint.note(e.burrowX, e.burrowY - 16, 'interrupted!', p.pigment);
        }
      }
    }
  }

  // R3 (v1.6 Module R): a charged SPLASH's bestiary hook — a BLUE splash within
  // the burst BLINDS a nearby wisp (the documented ~3s useless spin).
  _bestiarySplash(p) {
    if (p.pigment !== 'blue') return;
    const R = this.tuning.splashRadius + 40;
    for (const e of this.enemies) {
      if (e.wisp && dist(e.x, e.y, p.x, p.y) <= R) {
        e.wispBlindT = REEDS_BESTIARY.wispBlindDuration;
        this.sfx('wisp-blind');
        this.particles.ripple(e.x, e.y);
        this.paint.note(e.x, e.y - 14, 'blinded!', 'blue');
      }
    }
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
        // E4: streak bonus — a clean-orb streak (no hit taken) multiplies orb
        // value. The bonus applies to the bankable `collected` total (and to
        // `stock` when it fits the paint jar), then the streak builds.
        const base = this.tuning.pickupValue;
        const mult = orbStreakMult(this.orbStreak);
        const v = base * mult;
        const boosted = mult > 1;
        this.collected[o.color] += v;
        this.runOrbs += 1;
        this._challengeAdd('orb'); // K7 (v1.5 M2): count a challenge orb collected
        if (this.stock[o.color] < this.tuning.capacity) {
          this.stock[o.color] += v;
          this.sfx(boosted ? 'pickup-streak' : 'pickup');
          // J2 (v1.4): a short hit-stop pop on a pigment pickup (the streak
          // bonus gets a slightly longer one). Gated by options.shake.
          this.hitStop(boosted ? 0.07 : 0.05, 0.35);
          this.particles.sparkles(o.x, o.y, PIGMENTS[o.color].light, 4);
          this.paint.note(o.x, o.y - 10, '+' + v.toFixed(boosted ? 1 : 0) + (boosted ? ' ×' + mult.toFixed(2) : ''), o.color);
          if (!this.save.flags.firstOrb) {
            this.save.flags.firstOrb = true;
            SaveSys.save(this.save);
            this.addBanner('Paint is unlimited. Drops count toward this run’s score.', 4.2, this.ch * 0.58);
          }
          if (boosted) this.paint.note(o.x, o.y - 30, `streak ×${mult.toFixed(2)}`, 'red');
          // J5 (v1.4): a screen-space "+n" number pops up + fades near the
          // pigment jar for the collected color (HUD feedback, not a hard
          // swap). Capped so a burst can't unbounded-grow the array.
          const _jarIdx = ['red', 'blue', 'green'].indexOf(o.color);
          if (_jarIdx >= 0) {
            const jx = 14 + _jarIdx * 66 + 30, jy = 52 + 44 + 6;
            if (this._floats.length > 24) this._floats.shift();
            this._floats.push({ x: jx, y: jy, text: '+' + v.toFixed(boosted ? 1 : 0), t: 0, max: 0.8, color: PIGMENTS[o.color].color });
          }
          // J5: the orb-streak trail is captured per-frame while the streak is
          // active (see _updateExpedition), so it reads as a fading streak
          // behind the moving frog — not a cluster of identical pickup points.
        }
        this.orbStreak += 1; // E4: every collected orb extends the clean streak
      }
    }
  }

  _onEnemyDead(e) {
    if (e._noLoot) {
      this.sfx('enemy-die');
      this.particles.splatter(e.x, e.y, e.tint || '#8fb0f0', 8, 70);
      this.hitStop(0.08, 0.4);
      return;
    }
    this.score += e.score;
    this.runEnemies += 1;  // Q1 (v1.6): this expedition's enemies painted (pause summary; in-memory only)
    // S1 (v1.9): the per-creature DEATH sting — the 6 archetypes have a
    // dedicated voice (armor crack / buzz cut-out / wet flop / shimmer /
    // slither-fade / slurp-plop); turtle/cragfrog fall back to the generic
    // 'enemy-die'. Presentation-only (no-op in headless smoke).
    {
      const dk = e.kind;
      const dieName = (dk === 'beetle' || dk === 'mosquito' || dk === 'toad' || dk === 'wisp' || dk === 'serpent' || dk === 'leech')
        ? 'die-' + dk : 'enemy-die';
      this.sfx(dieName);
    }
    // J1 (v1.9): the KILL hit-stop — a ~110 ms dip @ ~0.3× when a regular
    // enemy is painted to death (longer than a non-killing swipe connect so the
    // death reads as a beat). Reuses the v1.4 hitStop (real-time timeScale dip,
    // gated by options.shake — a no-op when shake is OFF; never touches
    // tuning/runT/the seeded RNG). If the killing swipe's connect hit-stop is
    // still draining, Math.max keeps the longer of the two.
    this.hitStop(0.11, 0.3);
    this.particles.splatter(e.x, e.y, INK, 10, 160);
    this.particles.splatter(e.x, e.y, PIGMENTS[ORB_COLORS[(Math.random() * 3) | 0]].color, 4, 120);
    // J3 (v1.9): the KILL INK-BURST — the creature dissolves into a burst of
    // the pigment it was painted with (the world remembers what you painted); a
    // never-painted creature breaks into a neutral ink splat. The burst reads
    // as the enemy breaking into the palette that killed it, layered on the
    // J1 kill hit-stop (the world freezes; the burst settles + fades on real
    // time). PRESENTATION-ONLY — it is a draw-only pool in paint.js, seeded
    // from the death position (no global RNG), and never touches damage/drops/
    // runT. Pooled + capped (MAX_INKBURST) so a mass kill stays within P10.
    this.paint.spawnInkBurst(e.x, e.y, (e.tint && e.tintT > 0) ? e.tint : null, 22, 4.5, 1);
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
    // S2 (v1.4): the moment of death is a short, soft "faint" blip; the
    // full descending-minor DEFEAT STINGER fires later, from _endRun('defeat'),
    // as the end screen opens — so the two moments stay distinct.
    this.sfx('faint');
    this.particles.splatter(this.player.x, this.player.y, '#69a24e', 18, 220);
    this.addShake(10);
    if (!this.save.flags.firstDefeat) {
      this.save.flags.firstDefeat = true;
      SaveSys.save(this.save);
      this.addBanner('Our swamp still needs its color. Your paintings are safe.', 4, this.ch * 0.5);
    }
    // the heron takes flight and the world starts to heal — even in defeat
    if (this.heron && !this.heron.flying) { this.heron.flying = 0.001; }
  }

  _endRun(kind) {
    if(this.state==='end'||this.state==='camp')return;
    if(kind==='victory' && this.campaign && !this.campaign.complete){
      if(!finishCampaignFloor(this.campaign,this.heron.kind))return;
      if(!(this.save.flags.bossDefeats||[]).includes(this.heron.kind))this.save.flags.bossDefeats.push(this.heron.kind);
      this.save.flags.heronDefeated ||= this.heron.kind==='gray';
      this.studio?.archive('study',campaignFloor(this.campaign).name+' restored');
      if(this.campaign.pendingReward){
        this.state='camp';this._campChoice=null;this.paused=false;this.help=false;this.input.reset();
        this.player.hp=Math.min(this.player.maxHp,this.player.hp+Math.ceil(this.player.maxHp*0.35));
        this.audio.clearZoneTheme?.();this.audio.stopAmbientLife?.();SaveSys.save(this.save);return;
      }
    }
    this.studio?.archive(kind);this.state='end';this.endKind=kind;this.endT=0;this.paused=false;this.help=false;
    this.save.stats.expeditions++;this.save.stats[kind==='victory'?'victories':'deaths']++;
    this.save.stats.bestScore=Math.max(this.save.stats.bestScore||0,this.score||0);
    const candidate={pigments:Object.values(this.collected||{}).reduce((a,b)=>a+b,0),time:Math.round(this.runT),cleared:kind==='victory'};
    const best=this.save.bestRun;
    if(!best||(candidate.cleared&&!best.cleared)||(candidate.cleared===best.cleared&&(candidate.cleared?candidate.pigments>best.pigments:candidate.time>best.time)))this.save.bestRun=candidate;
    this.endGains={red:0,blue:0,green:0};this._cine=null;this.input.reset();SaveSys.save(this.save);
    this.audio.clearZoneAmbient?.();this.audio.stopAmbientLife?.();this.audio.clearZoneTheme?.();
    if(kind==='victory')this.audio.stingerVictory?.();else this.audio.stingerDefeat?.();
  }

  _updateCampaignCamp() {
    const layout=dungeonCampLayout(this);
    for(let i=0;i<3;i++)if(this.input.pressed(String(i+1)))this._campChoice=layout.cards[i].id;
    if(this.input.mouse.lPressed){for(const card of layout.cards)if(this._mouseIn(card.x,card.y,card.w,card.h))this._campChoice=card.id;
      const b=layout.descend;if(this._mouseIn(b.x,b.y,b.w,b.h))this._descendCampaign();}
    if(this.input.pressed('enter')||this.input.pressed(' '))this._descendCampaign();
    if(this.input.pressed('escape'))this._quitToTitle();
  }

  _descendCampaign() {
    if(this.state!=='camp'||!chooseCampaignReward(this.campaign,this._campChoice))return false;
    const carry={hp:this.player.hp,maxHp:this.player.maxHp,time:this.runT,score:this.score,enemies:this.runEnemies,orbs:this.collected};
    this._beginExpedition(false,{campaignContinue:true});
    this.player.hp=Math.min(this.player.maxHp,carry.hp+Math.max(0,this.player.maxHp-carry.maxHp));
    this._prevHp=this.player.hp;
    this.runT=carry.time;this.score=carry.score;this.runEnemies=carry.enemies;this.collected=carry.orbs;
    this._floorStartT=this.runT;this._campChoice=null;return true;
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
        // S2 (v1.9): the boss DROPS TO A NEW PHASE — the melody layer swaps to
        // the pre-built DENSER pattern (faster stepDur + more active steps =
        // higher intensity). A reference swap on the live theme (no allocation
        // at the phase moment; idempotent, so phase3 re-fires are no-ops).
        if (this.audio.bossPhaseUp) this.audio.bossPhaseUp();
      } else if (name === 'phase3') {
        this.sfx('boss-growl');
        this.addShake(12);
        this.addBanner('The Gray Storm! The Heron rages!', 3, 240);
      } else if (name === 'lunge-start') {
        this.sfx('boss-growl');
        h._lungeArmed = true;   // J2: telegraph is now live — arm the pre-hit freeze
      } else if (name === 'defeated') {
        this._onHeronDefeated();
      }
    }

    // ongoing contact hazards (none while airborne, awakened, or dead)
    const airborne = (h.diveH || 0) > 50;
    if (h.hp > 0 && !airborne && !h.awakened && p.alive) {
      // J2 (v1.4): 1-frame pre-hit freeze at the lunge connect. The 'lunge-start'
      // telegraph arms the latch the frame the heron ENTERS the striking lunge;
      // this consumes it once, holding the world sim for one frame (a tiny impact
      // hitch so the lunge lands deliberately). Gated by options.shake
      // (freezePreHit is a no-op when shake is OFF).
      if (h.state === 'storm-lunge' && h._lungeArmed) {
        this.freezePreHit();
        h._lungeArmed = false;
      } else if (h.state !== 'storm-lunge') {
        h._lungeArmed = false;
      }
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

  // E1 (v1.2 M10): drive the Painted Heron with the shared bossStep machinery.
  // A scaled-down heron: ~1/10 HP, awakens on ~1 hue, phase escalation capped
  // at 2, and its own contact damage. Its attacks are gentler and its summons
  // fewer — it's a guardian at the zone boundary, not a wall.
  _updateMidHeron(dt) {
    const h = this.midHeron;
    const p = this.player;
    // NOTE: let bossStep run even at hp<=0 — it emits the 'defeated' event
    // (same as the final heron's _updateBoss).
    if (!h || h.flying > 0 || this.dying) return;
    const v = this._view();
    const ev = bossStep(h, dt, { left: v.x, right: v.x + v.w / v.scale, playerX: p.x }, this.tuning, this.now);
    for (const name of ev) {
      if (name === 'slam') {
        this.addShake(8);
        this.sfx('boss-slam');
        this.particles.splatter(h.targetX, h.y - 20, '#98a19b', 10, 160);
        this._hitPlayerFromHeron(110, Math.round(h.contactDmg * 1.6), h.targetX, h.y - 40);
      } else if (name === 'landing') {
        this.addShake(7);
        this.sfx('boss-slam');
        this.particles.splatter(h.x, h.y - 20, '#7fa8c9', 10, 180);
        this._hitPlayerFromHeron(95, Math.round(h.contactDmg * 1.4), h.x, h.y - 40);
      } else if (name === 'summon') {
        // the mid-heron summons fewer, gentler reinforcements
        const n = 1 + (h.phase >= 2 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU, d = 130 + Math.random() * 100;
          const x = clamp(h.x + Math.cos(a) * d, 80, this.world.w - 80);
          const y = clamp(h.y + Math.sin(a) * d, 80, this.world.h - 80);
          const kind = Math.random() < 0.5 ? 'mosquito' : 'beetle';
          this.enemies.push(spawnEnemy(kind, x, y, this.tuning));
        }
        this.sfx('boss-growl');
        this.addBanner('The Painted Heron ruffles — a few insects stir!', 2.2, 240);
      } else if (name === 'phase2') {
        this.sfx('boss-growl');
        this.addShake(6);
        this.addBanner('The Painted Heron darkens…', 2.4, 240);
      } else if (name === 'defeated') {
        this._onMidHeronDefeated();
      }
    }
    // contact hazard: its body hurts on touch (scaled), none while airborne/awakened
    const airborne = (h.diveH || 0) > 50;
    if (h.hp > 0 && !airborne && !h.awakened && p.alive) {
      if (h.state === 'scoop') this._hitPlayerFromHeron(70, Math.round(h.contactDmg * 1.3), h.scoopX, h.y - 30);
      else if (h.state === 'sweep') this._hitPlayerFromHeron(130, h.contactDmg, h.x + (h.sweepSide || -1) * 75, h.y - 100);
      else if (h.state === 'idle' || h.state === 'flap' || h.state === 'recover') this._hitPlayerFromHeron(70, h.contactDmg, h.x, h.y - 110);
    }
  }

  _onMidHeronDefeated() {
    const h = this.midHeron;
    this.sfx('awaken');
    this.addShake(10);
    this.addBanner('The Painted Heron blooms and takes wing!', 3.2, 200);
    for (const c of ORB_COLORS) this.particles.sparkles(h.x, h.y - 140, PIGMENTS[c].light, 8);
    this.particles.splatter(h.x, h.y - 110, '#e0c15a', 14, 200);
    // reward: pigment orbs scatter where it stood (collectible, bankable)
    for (let i = 0; i < MID_HERON.rewardOrbs; i++) {
      const c = ORB_COLORS[i % ORB_COLORS.length];
      this.orbs.push({ x: h.x + (Math.random() - 0.5) * 120, y: h.y - 60 + (Math.random() - 0.5) * 60, color: c, t: 0 });
    }
    // the mid-heron is gone for the rest of the run (no victory state — it's a
    // set-piece, not the final boss)
    this.midHeron = null;
    }

    _updateWyrm(dt) {
      const h = this.heron; const p = this.player;
      if (!h || h.flying > 0 || this.dying) return;
      // Advance the pure movement state machine (it reads h.awakened to speed the
      // surfacing cadence — the 3-hue awaken's "faster rhythm" from the paint path).
      const v = this._view();
      const ev = wyrmStep(h, dt, { left: v.x, right: v.x + v.w / v.scale, playerX: p.x }, this.tuning, this.now);
      // Position the wyrm's head along its transit (it slithers from the point it
      // just left toward the next surface point; it sits at the point while the
      // tell + surfaced window play). No per-frame allocation — one lerp.
      const [spX, spY] = wyrmSurfacePoint(h, h.surfIdx, this.world.w);
      h.y = spY;
      if (h.phase === 'transit') {
        // interpolate from the point it left (_transitFromX) toward the next point
        const fromX = (h._transitFromX != null) ? h._transitFromX : spX;
        const prog = 1 - Math.max(0, h.phaseT) / (SILT_WYRM.transit * (h.awakened ? 0.62 : 1.0));
        h.x = fromX + (spX - fromX) * Math.min(1, prog);
      } else {
        h.x = spX;
      }
      if (ev === 'breach') {
        // it surfaced — the lantern/ripple marks the target (the paint window opens).
        h._transitFromX = spX;   // remember where it surfaced (the transit's start)
        this.sfx('wyrm-breach');
        this.addShake(8);
        this.particles.splatter(spX, spY, SILT_WYRM.mudHueLight, 10, 180);
        this.particles.ripple(spX, spY, 'rgba(120,110,95,0.6)');
        // the breach-strike hits the lane at the surface point (the frog dodges by
        // standing clear of the marked point — the tell told it where to be).
        if (p.alive && p.iframes <= 0) {
          const d = dist(p.x, p.y, spX, spY);
          if (d <= SILT_WYRM.strikeReach) {
            p.hurt(SILT_WYRM.strikeDmg * (this.tuning.dmgTakenMult || 1), this.tuning);
            this.addShake(10);
          }
        }
      } else if (ev === 'defeated') {
        this._onHeronDefeated();
      }
      // the underground body-line slither + the ripple-ring tell are drawn by
      // _drawWyrm (P10: capped segment count, no per-frame allocation).
    }

  // G2 (v1.8): drive THE UMBRAL WYRM (the 6th boss archetype, the Black Reeds
  // apex) with the pure umbrStep state machine — the Silt Wyrm's wyrmStep made
  // DUAL-PHASE + faster + deeper. It reuses the existing 3-hue awaken via the
  // SAME paint path (umbrPaintable → paintBossHit → paintBoss) and the
  // _onHeronDefeated → victory-sink path. Two inherited mechanics: the
  // FUEL-SIPHON (Warden-inherited; the deep-dark phase siphons faster) and the
  // FLOOD-POCKET (Wyrm-inherited: it surfaces in the Reeds flood band). The
  // DUAL maw: umbrStep cycles the primary point; the partner is the adjacent
  // point (both telegraphed + both paintable at breach). The "deep dark" final
  // phase (hp <= deepDarkPhase) makes the lantern MANDATORY: the world overlay
  // darkens and the maw strikes harder + the siphon runs faster (the pure
  // umbrDeepDark flag drives the cadence; the overlay + siphon are the
  // presentation layer). No per-frame allocation — one surface-point read + one
  // lerp (P10). Pure logic lives in logic.js (umbrStep / umbrSurfacePoint /
  // umbraFuelSiphon).
  _updateUmbra(dt) {
    const h = this.heron; const p = this.player;
    if (!h || h.flying > 0 || h.sinking > 0 || this.dying) return;
    const v = this._view();
    const ev = umbrStep(h, dt, { worldW: this.world.w }, this.tuning, this.now);
    // Position the head at the primary maw point (it slithers from the point it
    // left toward it; it sits at the point while the telegraph + surfaced window
    // play). No per-frame allocation — one lerp.
    const [spX, spY] = umbrSurfacePoint(h, h.surfIdx, this.world.w);
    h.y = spY;
    if (h.phase === 'transit') {
      const fromX = (h._transitFromX != null) ? h._transitFromX : spX;
      const transitMult = (h.awakened ? 0.6 : 1.0) * (umbrDeepDark(h) ? UMBRA_WYRM.transitDeep : 1.0);
      const prog = 1 - Math.max(0, h.phaseT) / (UMBRA_WYRM.transit * transitMult);
      h.x = fromX + (spX - fromX) * Math.min(1, prog);
    } else {
      h.x = spX;
    }
    // G2: the FUEL SIPHON (Warden-inherited) — while engaged + the lantern is LIT,
    // it drains candle fuel (faster in the deep dark). The returned state
    // reassigns this.lantern; _updateLantern (next frame) refreshes the eased
    // radius + lightFactor from it, so the siphon ALSO shrinks the light radius
    // (the Black Reeds bestiary's input) — a genuine synergy, not a bolt-on.
    if (this.lantern) {
      this.lantern = umbraFuelSiphon(h, this.lantern, dt);
      const ltSiphon = this._lanternTuning || LANTERN;
      this._lanternEasedR = lanternRadiusFor(this.lantern, ltSiphon);
      this.lantern.lightFactor = lanternLightFactor(this.lantern, p.x, p.y, p.x, p.y, ltSiphon);
    }
    if (ev === 'dual-breach') {
      // both maws surfaced — the paint window opens + the maw-strikes hit BOTH
      // points. The deep dark makes the strikes HARDER (the lantern-mandatory
      // phase: a lit lantern's light is the counter, the player stands in the
      // glow / paints both). The player dodges by standing clear of BOTH marked
      // points during the telegraph.
      h._transitFromX = spX;
      this.sfx('wyrm-breach');   // reuse the wyrm's heavy breach thwomp (no new asset)
      this.addShake(10);
      const deep = umbrDeepDark(h);
      this.particles.splatter(spX, spY, UMBRA_WYRM.hueLight, 12, 200);
      this.particles.ripple(spX, spY, 'rgba(90,80,150,0.7)');
      if (p.alive && p.iframes <= 0) {
        const [sp2X, sp2Y] = umbrSurfacePoint(h, h._partnerIdx != null ? h._partnerIdx : ((h.surfIdx + 1) % UMBRA_WYRM.surfacePoints), this.world.w);
        const dmg = UMBRA_WYRM.strikeDmg * (deep ? UMBRA_WYRM.deepStrikeMult : 1.0) * (this.tuning.dmgTakenMult || 1);
        const d1 = dist(p.x, p.y, spX, spY);
        const d2 = dist(p.x, p.y, sp2X, sp2Y);
        if (d1 <= UMBRA_WYRM.strikeReach || d2 <= UMBRA_WYRM.strikeReach) {
          p.hurt(dmg, this.tuning);
          this.addShake(12);
        }
      }
    } else if (ev === 'defeated') {
      this._onHeronDefeated();
    }
    // the underground body-line slither + the dual ripple-ring tell + the deep-
    // dark overlay are drawn by _drawUmbra (P10: capped segment count, no
    // per-frame allocation).
  }

  _updateWarden(dt) {
    const h = this.heron; const p = this.player;
    if (!h || h.flying > 0 || h.sinking > 0 || this.dying) return;
    // Advance the pure movement state machine (it reads h.awakened + h.tasteFactor
    // to speed the maw cadence — the 3-hue awaken's "faster rhythm" + the D2
    // taste bias, both pure).
    const v = this._view();
    const ev = wardenStep(h, dt, { left: v.x, right: v.x + v.w / v.scale, playerX: p.x }, this.tuning, this.now);
    // Position the Warden's head at its maw point (it slithers toward it while
    // the maw is closed; it sits at the point while the tell + maw window play).
    // No per-frame allocation — one surface-point read.
    const [spX, spY] = wardenSurfacePoint(h, h.surfIdx, this.world.w);
    h.y = spY;
    h.x = spX;
    // F1: the FUEL SIPHON — while the Warden is active + the lantern is LIT, it
    // drains candle fuel (the pure wardenFuelSiphon tick; taste-scaled). The
    // returned state reassigns this.lantern; the caller (_updateLantern, the
    // next frame) refreshes the eased radius + lightFactor from it, so in a
    // Wander x Reeds run the siphon also shrinks the light radius (the Reeds
    // bestiary's input) — a genuine synergy, not a bolt-on.
    if (this.lantern) {
      this.lantern = wardenFuelSiphon(h, this.lantern, dt);
      // Refresh the eased render radius + the frog's lightFactor from the
      // post-siphon state (the light dims as the Warden feeds — the player
      // SEES the lantern being eaten, the same render path as the Reeds drain).
      // G1 (v1.8): thread the run's lantern TUNING (this._lanternTuning || LANTERN)
      // so a siphon-driven dim reads the run's radius (LANTERN for the Wander x
      // Reeds Warden; the *For wrappers fall back to LANTERN on missing fields).
      const ltSiphon = this._lanternTuning || LANTERN;
      this._lanternEasedR = lanternRadiusFor(this.lantern, ltSiphon);
      this.lantern.lightFactor = lanternLightFactor(this.lantern, p.x, p.y, p.x, p.y, ltSiphon);
    }
    if (ev === 'maw-open') {
      // the maw just SNAPPED open — the paint window opens (the tell is done).
      // The maw-strike hits the lane at the point (the frog dodges by standing
      // clear of the marked point during the tell).
      this.sfx('wyrm-breach');   // reuse the wyrm's heavy breach thwomp (no new asset)
      this.addShake(8);
      this.particles.splatter(spX, spY, WARDEN.paleHueLight, 10, 180);
      this.particles.ripple(spX, spY, 'rgba(200,207,196,0.6)');
      if (p.alive && p.iframes <= 0) {
        const d = dist(p.x, p.y, spX, spY);
        if (d <= WARDEN.strikeReach) {
          p.hurt(WARDEN.strikeDmg * (this.tuning.dmgTakenMult || 1), this.tuning);
          this.addShake(10);
        }
      }
    } else if (ev === 'defeated') {
      this._onHeronDefeated();
    }
    // the pale body-line slither + the ripple-ring maw tell are drawn by
    // _drawWarden (P10: capped segment count, no per-frame allocation).
  }

  // T3 (v1.2 M13): drive the low-HP "sketch" heron with the shared bossStep
  // machinery — the SAME 3-hue awaken cadence as the real heron, at a low-HP
  // scale. It is ONLY live during the guided teaching layer (the 'sketch'
  // phase), so it never appears in the timed expedition. It never hurts the
  // frog (contactDmg 0) and never summons; the beat completes when all three
  // hues awaken it (the 3-hue loop the real heron uses — see _tutorialTick).
  _updateSketchHeron(dt) {
    const h = this.sketchHeron;
    const p = this.player;
    if (!h || !p || h.flying > 0 || this.dying) return;
    // bossStep runs the awaken/awakenedT state machine; the sketch is pinned in
    // reach by _tutorialTick, so its drift is harmless.
    const v = this._view();
    bossStep(h, dt, { left: v.x, right: v.x + v.w / v.scale, playerX: p.x }, this.tuning, this.now);
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
    this._challengeAdd('bossDefeat');
    this.sfx('awaken');
    // S1 (v1.9): the BOSS KILL (big) sting — the final blow that drops any
    // heron/wyrm/warden/umbra. Fires alongside the existing awaken + the
    // hitStop/whiteFlash beat (presentation-only; no-op in headless smoke).
    this.sfx('boss-kill');
    this.addShake(16);
    // J4 (v1.9): the frog's OWN VICTORY pose — a small contented hop + a
    // squash-and-settle, set at the moment the boss is defeated (BEFORE the
    // victory screen transition), so the frog celebrates the win on the field.
    // It's a draw-state on the player (`_victoryHopT`, decayed in player.update,
    // read in player.draw) — reuses the existing hopLift shape for the lift. No
    // physics / runT / pacing change (the defeat timing + drops above are
    // untouched).
    if (this.player && this.player.alive) this.player._victoryHopT = 1.0;
    // J2 (v1.4): the big moment — ~0.8 s of slow-mo (~0.35×) + a white
    // flash frame + a shake spike. All gated by options.shake (hitStop /
    // whiteFlash are no-ops when shake is OFF), so this is pure presentation
    // and never changes the measured pacing.
    this.hitStop(0.8, 0.35);
    this.whiteFlash();
    this.addShake(22);
        if (h.wyrm) {
          this.addBanner('The Silt Wyrm is painted — it sinks back beneath the reeds!', 4, 200);
        } else if (h.umbra) {
          this.addBanner('The color thief lets go. Our swamp blooms again!', 4.4, 200);
        } else if (h.warden) {
          this.addBanner('The Hollow Warden is painted — it drains the last of the light and sinks beneath the reeds!', 4.4, 200);
        } else {
          this.addBanner('The Great Gray Heron blooms and takes flight!', 4, 200);
        }
        for (const c of ORB_COLORS) this.particles.sparkles(h.x, h.y - 160, PIGMENTS[c].light, 10);
        // J3 (v1.9): the BOSS KILL ink-burst — a LARGER burst + a brief camera
        // hold (reuses the J3 v1.4 awaken-moment `_awakenHoldT` pattern). The
        // boss is painted through its full 3-hue awaken loop, so its last
        // painted pigment (h._lastPig) tints the burst; a never-painted fall-
        // back is the neutral ink. PRESENTATION-ONLY — the defeat timing,
        // damage, and drops are untouched; this only adds a draw-only pool
        // (capped at MAX_INKBURST) + the camera's hold timer.
        {
          const bpig = (h._lastPig && h._lastPig !== 'dry') ? h._lastPig : null;
          this.paint.spawnInkBurst(h.x, h.y - 60, bpig, 44, 6.5, 1.4);
          // a second, wider neutral-ink ring so the boss reads as dissolving
          // into the whole palette it was painted, not just one hue.
          this.paint.spawnInkBurst(h.x, h.y - 90, null, 20, 4.0, 1.8);
          this._awakenHoldT = 1.1;            // the camera holds on the bloom
          this.zoomTarget = 0.9;
        }
        if (h.wyrm || h.umbra || h.warden) { h.sinking = 0.001; } else { h.flying = 0.001; }   // hand off to the victory beat
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

    // L2 (v1.9): the AWAKEN BLOOM — while the heron is in its AWAKENED state
    // (painted awake, taking 2x paint) it radiates a soft LIGHT HALO behind its
    // body, so the "it is awake to the paint" window reads as a burst of light,
    // not just a shimmer. Pure DRAW: reads h.awakened (a rule field set by the
    // bossStep logic state machine in logic.js) but writes NOTHING back — no new
    // save state, no tuning change, no HP / damage / death timing move. A single
    // radial gradient drawn only while awakened (zero draws otherwise), so the
    // idle + pre-awaken boss path is byte-identical to before.
    if (h.awakened) {
      const pulse = 0.85 + 0.15 * Math.sin(now * 4);
      const R = 150;
      const g = ctx.createRadialGradient(h.x, fy - 140, 20, h.x, fy - 140, R);
      g.addColorStop(0, 'rgba(255,236,180,' + (0.22 * pulse).toFixed(3) + ')');
      g.addColorStop(0.5, 'rgba(255,210,140,' + (0.10 * pulse).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.save();
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(h.x, fy - 140, R, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

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
    // M3 (v1.4 easter egg B): a tiny cheek-blush on the heron's face — drawn in
    // the heron's local space, fading over ~3 s (real time, presentation only).
    // Triggered by a dry-brush stroke on the SLEEPING heron (pre-engage).
    const hblush = (this._eggBlush && this._eggBlush.heron > 0)
      ? Math.max(0, Math.min(1, this._eggBlush.heron / 1.2)) : 0;
    if (hblush > 0) {
      ctx.globalAlpha = 0.4 * hblush;
      ctx.fillStyle = '#f08a8a';
      ctx.beginPath(); ctx.ellipse(-38 - neckSway, -256, 5, 3.2, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
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
    ctx.font = uiFont(UI.sizes.h1, { weight: 700 });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', x, y - 4);
    ctx.restore();
  }

  // R4 (v1.6 Module R): draw THE SILT WYRM. The signature is the SUBTERRANEAN
  // body line — a capped, traveling-sine serpent that slithers BENEATH the mud
  // (visible + dim while underground, bright when it breaches). The 3 surface
  // points are the telegraphed breach spots; the ripple-ring tell (dark-mud
  // variant of the heron-telegraph language) grows at the next point before it
  // breaches. P10: a FIXED segment count (no per-frame allocation) + a couple
  // of arcs — 60fps-safe.
  _drawWyrm(ctx, h, now) {
    const W = this.world.w;
    const surfY = SILT_WYRM.surfaceY;
    const N = SILT_WYRM.surfacePoints;
    // the 3 telegraphed surface points on the arena line.
    const pts = [];
    for (let i = 0; i < N; i++) pts.push(wyrmSurfacePoint(h, i, W));
    const idx = ((h.surfIdx || 0) % N + N) % N;
    const cur = pts[idx], prev = pts[((idx - 1) + N) % N];
    // the HEAD x: at the active point while telegraph/surfaced; while in transit
    // it slithers from the previous point toward the next (phaseT fraction).
    let headX;
    if (h.phase === 'transit') {
      const frac = 1 - Math.max(0, Math.min(1, (h.phaseT || 0) / (SILT_WYRM.transit * (h.awakened ? 0.62 : 1.0))));
      headX = prev[0] + (cur[0] - prev[0]) * frac;
    } else {
      headX = cur[0];
    }
    const surfacing = h.phase === 'surfaced';
    const sinking = !!h.sinking;
    // -------- the slithering body line (beneath the mud, capped segments) ----
    const bodyY = surfY + 46;                       // a little under the water line
    const SEG = SILT_WYRM.bodySegments;             // fixed count (P10)
    const span = Math.max(240, headX - (W - 900));  // the body trails back from the head
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = h.awakened ? SILT_WYRM.mudHueLight : SILT_WYRM.mudHue;
    ctx.globalAlpha = surfacing ? 0.95 : 0.55;      // dim underground, solid surfaced
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(headX, surfY + (surfacing ? -8 : 10));
    for (let i = 1; i <= SEG; i++) {
      const t = i / SEG;
      const bx = headX - t * span;
      const by = bodyY + Math.sin(now * 4 - t * 6) * 10;   // the traveling slither
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
    ctx.restore();
    // -------- the surfaced HEAD (a mud serpent's head breaking the water) ----
    if (surfacing || sinking) {
      ctx.save();
      ctx.translate(headX, surfY);
      const c = h.hitFlash > 0 ? '#f2e9dc' : SILT_WYRM.mudHue;
      const c2 = h.hitFlash > 0 ? '#fff' : SILT_WYRM.mudHueLight;
      ctx.globalAlpha = sinking ? Math.max(0, 1 - (h.sinking || 0) / 3) : 1;
      // the head (a broad mud wedge) + fangs
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -52);
      ctx.quadraticCurveTo(34, -20, 20, 26);
      ctx.quadraticCurveTo(0, 40, -20, 26);
      ctx.quadraticCurveTo(-34, -20, 0, -52);
      ctx.fill();
      // eyes (glowing while awakened — it is awake to the paint)
      ctx.fillStyle = h.awakened ? '#ffd75e' : c2;
      ctx.beginPath();
      ctx.arc(-9, -22, 5, 0, TAU);
      ctx.arc(9, -22, 5, 0, TAU);
      ctx.fill();
      // a 3-hue coat wash while it carries paint (the awaken progress reads)
      if (h.hue && (h.hue.red > 0 || h.hue.blue > 0 || h.hue.green > 0)) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = h.hue.red > 0 ? PIGMENTS.red.color : (h.hue.blue > 0 ? PIGMENTS.blue.color : PIGMENTS.green.color);
        ctx.beginPath();
        ctx.arc(0, -8, 18, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    // -------- the ripple-ring TELEGRAPH at the next surface point ----------
    if (h.phase === 'telegraph' && !sinking) {
      const prog = 1 - Math.max(0, Math.min(1, (h.phaseT || 0) / (SILT_WYRM.telegraph * (h.awakened ? 0.62 : 1.0))));
      const r = 24 + prog * 150;                     // grows toward the breach
      const pulse = 0.7 + Math.sin(now * 10) * 0.3;
      ctx.save();
      ctx.translate(headX, surfY);
      ctx.globalAlpha = (0.4 + prog * 0.5) * pulse;
      ctx.strokeStyle = h.awakened ? '#e0632e' : '#7a9a8a';  // dark-mud teal tell
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      // a soft fill ring reads as a ripple on the water
      ctx.globalAlpha = 0.16 * pulse;
      ctx.fillStyle = h.awakened ? '#e0632e' : '#7a9a8a';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // -------- the boss HP bar (world space, above the arena) --------------
    if (h.hp < h.maxHp && !sinking) {
      const bw = 260, bx = headX - bw / 2, by = surfY - 96;
      const frac = Math.max(0, h.hp / h.maxHp);
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = 'rgba(16,20,16,0.6)';
      ctx.fillRect(bx, by, bw, 7);
      ctx.fillStyle = frac > 0.4 ? SILT_WYRM.mudHueLight : '#c8452c';
      ctx.fillRect(bx, by, bw * frac, 7);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#f4efe6';
      ctx.font = uiFont(UI.sizes.bodyLg, { weight: 600 });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('THE SILT WYRM', headX, by - 10);
      ctx.restore();
    }
  }

  _drawUmbra(ctx, h, now) {
    const W = this.world.w;
    const surfY = UMBRA_WYRM.surfaceY;
    const N = UMBRA_WYRM.surfacePoints;
    // the 4 telegraphed maw points on the arena line.
    const pts = [];
    for (let i = 0; i < N; i++) pts.push(umbrSurfacePoint(h, i, W));
    const idx = (((h.surfIdx || 0) % N) + N) % N;
    const cur = pts[idx], prev = pts[((idx - 1) + N) % N];
    const phase2 = umbrDeepDark(h);
    const phase = h.phase;
    // the HEAD x: at the active point while dual-telegraph/surfaced; while in
    // transit it slithers from where it left (_transitFromX) toward the next.
    let headX;
    if (phase === 'transit') {
      const fromX = (h._transitFromX != null) ? h._transitFromX : prev[0];
      const transitDur = UMBRA_WYRM.transit * (h.awakened ? 0.6 : 1.0) * (phase2 ? UMBRA_WYRM.transitDeep : 1.0);
      const prog = 1 - Math.max(0, Math.min(1, (h.phaseT || 0) / (transitDur || 1)));
      headX = fromX + (cur[0] - fromX) * prog;
    } else {
      headX = cur[0];
    }
    const surfacing = phase === 'surfaced';
    const sinking = !!h.sinking;
    // the "deep dark" dims + deepens the palette (the final phase is darker).
    const bodyCol = h.awakened ? (phase2 ? '#9a6bff' : UMBRA_WYRM.abyssHueLight) : (phase2 ? '#4a3570' : UMBRA_WYRM.abyssHue);
    // -------- the slithering body line (beneath the water, capped segments) --
    const bodyY = surfY + 46;
    const SEG = UMBRA_WYRM.bodySegments;             // fixed count (P10)
    const span = Math.max(300, headX - (W - 1050));  // the body trails back from the head
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = bodyCol;
    ctx.globalAlpha = surfacing ? 0.96 : 0.5;        // dim underground, solid surfaced
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.moveTo(headX, surfY + (surfacing ? -10 : 12));
    for (let i = 1; i <= SEG; i++) {
      const t = i / SEG;
      const bx = headX - t * span;
      const by = bodyY + Math.sin(now * 4.5 - t * 7) * 11;   // the traveling slither
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
    ctx.restore();
    // -------- the surfaced HEAD (a violet wyrm's head breaking the water) ----
    if (surfacing || sinking) {
      ctx.save();
      ctx.translate(headX, surfY);
      const c = h.hitFlash > 0 ? '#f2e9dc' : bodyCol;
      const c2 = h.hitFlash > 0 ? '#fff' : (phase2 ? '#c79bff' : UMBRA_WYRM.abyssHueLight);
      ctx.globalAlpha = sinking ? Math.max(0, 1 - (h.sinking || 0) / 3) : 1;
      // the head (a broad violet wedge) + fangs
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -58);
      ctx.quadraticCurveTo(40, -22, 24, 30);
      ctx.quadraticCurveTo(0, 46, -24, 30);
      ctx.quadraticCurveTo(-40, -22, 0, -58);
      ctx.fill();
      // the fangs
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.moveTo(-16, 20); ctx.lineTo(-10, 34); ctx.lineTo(-6, 18); ctx.closePath();
      ctx.moveTo(16, 20); ctx.lineTo(10, 34); ctx.lineTo(6, 18); ctx.closePath();
      ctx.fill();
      // eyes (glowing violet while awakened — it is awake to the paint)
      ctx.fillStyle = h.awakened ? (phase2 ? '#e0b0ff' : '#b478ff') : c2;
      ctx.beginPath();
      ctx.arc(-11, -26, 6, 0, TAU);
      ctx.arc(11, -26, 6, 0, TAU);
      ctx.fill();
      // a 3-hue coat wash while it carries paint (the awaken progress reads)
      if (h.hue && (h.hue.red > 0 || h.hue.blue > 0 || h.hue.green > 0)) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = h.hue.red > 0 ? PIGMENTS.red.color : (h.hue.blue > 0 ? PIGMENTS.blue.color : PIGMENTS.green.color);
        ctx.beginPath();
        ctx.arc(0, -6, 20, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    // -------- the DUAL ripple-ring TELEGRAPH (BOTH maw points marked) --------
    // The signature of the Umbral Wyrm: during 'dual-telegraph' TWO ripple rings
    // grow at once — the primary (cur) AND its adjacent partner. The player sees
    // both maws opening and must stand clear of the lanes.
    if (phase === 'dual-telegraph' && !sinking) {
      const teleDur = UMBRA_WYRM.dualTelegraph * (h.awakened ? 0.6 : 1.0);
      const prog = 1 - Math.max(0, Math.min(1, (h.phaseT || 0) / (teleDur || 1)));
      const partnerIdx = ((h.surfIdx || 0) + 1) % N;
      const p0 = cur, p1 = pts[partnerIdx];
      for (const P of [p0, p1]) {
        const r = 24 + prog * 150;                     // grows toward the breach
        const pulse = 0.7 + Math.sin(now * 11) * 0.3;
        ctx.save();
        ctx.translate(P[0], surfY);
        ctx.globalAlpha = (0.4 + prog * 0.5) * pulse;
        ctx.strokeStyle = h.awakened ? (phase2 ? '#e063ff' : '#c04ae0') : '#5a4a9a';  // dark-violet tell
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.16 * pulse;
        ctx.fillStyle = h.awakened ? (phase2 ? '#e063ff' : '#c04ae0') : '#5a4a9a';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
    // -------- the FUEL SIPHON stream (the Warden-inherited lantern-eater) ----
    // A faint violet stream runs from the frog's lit lantern to the head while
    // the wyrm is actively draining fuel (a lit lantern + the wyrm engaged +
    // not defeated). The player sees its light being eaten.
    if (!sinking && this.lantern && this.lantern.lit && (this.lantern.fuel || 0) > 0) {
      const p = this.player;
      // draw in world space (the camera transform is active when _drawUmbra
      // runs) — a single dashed quadratic from the frog to the wyrm's head.
      ctx.save();
      ctx.globalAlpha = 0.28 + Math.sin(now * 8) * 0.08;
      ctx.strokeStyle = phase2 ? '#b478ff' : '#7a5aa8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 20);
      ctx.quadraticCurveTo((p.x + headX) / 2, (p.y + surfY) / 2 - 40, headX, surfY - 40);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    // -------- the boss HP bar (world space, above the arena) --------------
    if (h.hp < h.maxHp && !sinking) {
      const bw = 280, bx = headX - bw / 2, by = surfY - 104;
      const frac = Math.max(0, h.hp / h.maxHp);
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = 'rgba(16,14,24,0.6)';
      ctx.fillRect(bx, by, bw, 7);
      ctx.fillStyle = frac > (UMBRA_WYRM.deepDarkPhase || 0.4) ? UMBRA_WYRM.abyssHueLight : '#c8452c';
      ctx.fillRect(bx, by, bw * frac, 7);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#f4efe6';
      ctx.font = uiFont(UI.sizes.bodyLg, { weight: 600 });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(phase2 ? 'THE UMBRAL WYRM — THE DEEP DARK' : 'THE UMBRAL WYRM', headX, by - 10);
      ctx.restore();
    }
  }

  // F1 (v1.7): draw THE HOLLOW WARDEN. The signature is the MAW: the Warden
  // dwells at its surface point with its mouth CLAMPED SHUT (invulnerable) —
  // only while the maw is OPEN (phase 'mawOpen') can it be painted, and that
  // open window is the vulnerable one. The ripple-ring tell (a PALE variant of
  // the Silt-Wyrm language) grows at the point before the maw opens. A faint
  // pale SIPHON stream runs from the frog's lit lantern to the maw while it is
  // draining fuel (the lantern-eating mechanic, so the player can see their
  // fuel being eaten). P10: a fixed body-segment count + a few arcs — 60fps-safe.
  _drawWarden(ctx, h, now) {
    const W = this.world.w;
    const surfY = WARDEN.surfaceY;
    const N = WARDEN.surfacePoints;
    const idx = ((h.surfIdx || 0) % N + N) % N;
    const cur = wardenSurfacePoint(h, idx, W);
    const headX = cur[0];
    const mawOpen = h.phase === 'mawOpen';
    const telegraphing = h.phase === 'telegraph';
    const sinking = !!h.sinking;
    // -------- the pale body line (a gaunt, ash-thin serpent at the point) ----
    const bodyY = surfY + 44;
    const SEG = WARDEN.bodySegments;              // fixed count (P10)
    const span = 300;                            // the body coils behind the head
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = h.awakened ? WARDEN.paleHueLight : WARDEN.paleHue;
    ctx.globalAlpha = mawOpen ? 0.95 : 0.6;
    ctx.lineWidth = mawOpen ? 30 : 22;
    ctx.beginPath();
    ctx.moveTo(headX, surfY + (mawOpen ? -10 : 6));
    for (let i = 1; i <= SEG; i++) {
      const t = i / SEG;
      const bx = headX - t * span;
      const by = bodyY + Math.sin(now * (mawOpen ? 6 : 3) - t * 5) * 12;
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
    ctx.restore();
    // -------- the head (a pale, hollow maw) --------------------------------
    if (!sinking) {
      ctx.save();
      ctx.translate(headX, surfY);
      const c = h.hitFlash > 0 ? '#f7f2e6' : WARDEN.paleHue;
      const c2 = h.hitFlash > 0 ? '#fff' : WARDEN.paleHueLight;
      // the skull (a pale, elongated wedge with a hollower look than the wyrm)
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -58);
      ctx.quadraticCurveTo(30, -30, 22, 18);
      ctx.quadraticCurveTo(0, 42, -22, 18);
      ctx.quadraticCurveTo(-30, -30, 0, -58);
      ctx.fill();
      ctx.strokeStyle = c2;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // the MAW — closed (a thin slit) or OPEN (a dark, glowing gape). The
      // open maw is the ONLY paintable state; the glow telegraphs it.
      if (mawOpen) {
        const gape = 20 + Math.sin(now * 12) * 3;
        ctx.fillStyle = WARDEN.mawGlow;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(-14, 6);
        ctx.quadraticCurveTo(0, 10 + gape, 14, 6);
        ctx.quadraticCurveTo(0, 2, -14, 6);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        // teeth: a row of pale fangs ringing the open gape
        ctx.fillStyle = '#f4efe6';
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 6 - 2, 6);
          ctx.lineTo(i * 6, 15);
          ctx.lineTo(i * 6 + 2, 6);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // the clamped slit (invulnerable)
        ctx.strokeStyle = c2;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-16, 8);
        ctx.quadraticCurveTo(0, 13, 16, 8);
        ctx.stroke();
      }
      // eyes (a hollow, faint glow — brighter while awakened)
      ctx.fillStyle = h.awakened ? '#d7ff9a' : '#b9c4b4';
      ctx.beginPath();
      ctx.arc(-9, -24, 5, 0, TAU);
      ctx.arc(9, -24, 5, 0, TAU);
      ctx.fill();
      // a 3-hue coat wash while it carries paint (the awaken progress reads)
      if (h.hue && (h.hue.red > 0 || h.hue.blue > 0 || h.hue.green > 0)) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = h.hue.red > 0 ? PIGMENTS.red.color : (h.hue.blue > 0 ? PIGMENTS.blue.color : PIGMENTS.green.color);
        ctx.beginPath();
        ctx.arc(0, -10, 18, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    // -------- the ripple-ring TELEGRAPH before the maw opens --------------
    if (telegraphing && !sinking) {
      const prog = 1 - Math.max(0, Math.min(1, (h.phaseT || 0) / WARDEN.telegraph));
      const r = 24 + prog * 150;
      const pulse = 0.7 + Math.sin(now * 10) * 0.3;
      ctx.save();
      ctx.translate(headX, surfY);
      ctx.globalAlpha = (0.4 + prog * 0.5) * pulse;
      ctx.strokeStyle = h.awakened ? '#c7e06a' : '#b9c4b4';   // pale-ash tell
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.16 * pulse;
      ctx.fillStyle = h.awakened ? '#c7e06a' : '#b9c4b4';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // -------- the SIPHON stream (lantern fuel being eaten) ---------------
    // The Warden drains the lit lantern's fuel. Draw a faint pale stream from
    // the frog's lantern up to the maw so the player sees the theft in action.
    // Reeds-gated (a non-Reeds Wander run has no lantern economy — lantern.fuel
    // is 0/unlit there, so this never draws), and only while the Warden is
    // engaged and the lantern is actually lit + has fuel.
    const L = this.lantern;
    const p = this.player;
    if (this.lanternReeds && L && L.lit && L.fuel > 0 && p && h._intro <= 0 && !sinking) {
      const sx = p.x, sy = p.y - 8, ex = headX, ey = surfY + 6;
      const g = ctx.createLinearGradient(sx, sy, ex, ey);
      g.addColorStop(0, 'rgba(255,216,150,0.55)');
      g.addColorStop(1, 'rgba(215,255,154,0.5)');
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(now * 14) * 0.15;
      ctx.strokeStyle = g;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      const mx = (sx + ex) / 2, my = (sy + ey) / 2 - 40;   // an arcing sip
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
      ctx.restore();
    }
    // -------- the boss HP bar (world space, above the point) --------------
    if (h.hp < h.maxHp && !sinking) {
      const bw = 260, bx = headX - bw / 2, by = surfY - 96;
      const frac = Math.max(0, h.hp / h.maxHp);
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = 'rgba(16,16,20,0.6)';
      ctx.fillRect(bx, by, bw, 7);
      ctx.fillStyle = frac > 0.4 ? WARDEN.paleHueLight : '#c8452c';
      ctx.fillRect(bx, by, bw * frac, 7);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#f4efe6';
      ctx.font = uiFont(UI.sizes.bodyLg, { weight: 600 });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('THE HOLLOW WARDEN', headX, by - 10);
      ctx.restore();
    }
  }

  // ================= part 4: rendering =====================================
  _screenSpace() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // R1 (v1.6): THE REEDS light render (Reeds variant only). SCREEN-space, so it
  // covers the whole frame and the HUD (drawn after it) stays fully lit. Two
  // cheap layers: (a) a deep near-black wash for the flooded darkness, then (b)
  // a CACHED offscreen radial-gradient "light sprite" drawn at the lantern's
  // screen position with a single drawImage (additive 'lighter') so the area
  // around the frog brightens back out of the dark. The sprite (a warm
  // paper-lantern glow, radius LANTERN.lightRadius) is baked ONCE per session
  // into this._lanternSprite — never per frame — and is merely SCALED per frame
  // to the lantern's eased radius (a full wick ~lightRadius, low fuel ~minRadius,
  // unlit ~ the short ambient radius). No per-pixel work (no
  // getImageData/putImageData), so P10 stays green.
  _drawReedsLight(ctx, v) {
    const p = this.player, cw = ctx.canvas.width, ch = ctx.canvas.height;
    const sx = (p.x - v.x) * v.scale, sy = (p.y - v.y) * v.scale;
    const lit = this.lantern && this.lantern.lit && (this._lanternEasedR || 0) > 0;
    const radius = (lit ? this._lanternEasedR : LANTERN.minRadius * 0.6) * v.scale;
    if (!this._lanternSprite) {
      const d = Math.ceil(LANTERN.lightRadius * 2), sp = document.createElement('canvas');
      sp.width = d; sp.height = d;
      const sc = sp.getContext('2d'), R = LANTERN.lightRadius;
      const light = sc.createRadialGradient(R, R, 0, R, R, R);
      light.addColorStop(0, 'rgba(255,216,150,0.98)');
      light.addColorStop(0.3, 'rgba(246,200,126,0.85)');
      light.addColorStop(0.65, 'rgba(150,120,80,0.4)');
      light.addColorStop(1, 'rgba(20,20,30,0)');
      sc.fillStyle = light; sc.fillRect(0, 0, d, d);
      this._lanternSprite = sp;
    }
    // Cut light out of a reused darkness layer. Drawing additive yellow over
    // an opaque dark wash hid the creatures instead of revealing their color.
    if (!this._lanternMask) this._lanternMask = document.createElement('canvas');
    const mask = this._lanternMask;
    if (mask.width !== cw || mask.height !== ch) { mask.width = cw; mask.height = ch; }
    const mc = mask.getContext('2d');
    mc.clearRect(0, 0, cw, ch); mc.globalCompositeOperation = 'source-over';
    mc.fillStyle = 'rgba(6,8,14,0.86)'; mc.fillRect(0, 0, cw, ch);
    mc.globalCompositeOperation = 'destination-out'; mc.globalAlpha = lit ? 1 : 0.4;
    mc.drawImage(this._lanternSprite, sx - radius, sy - radius, radius * 2, radius * 2);
    mc.globalAlpha = 1; mc.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = lit ? 0.06 : 0.02;
    ctx.drawImage(this._lanternSprite, sx - radius, sy - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  _drawAll() {
    const ctx = this.ctx;
    const painting = this.state === 'expedition' && this.player?.alive && !this.dying &&
      !this.paused && !this.help && !this._bookOpen && !this._atlasOpen && !this._cine;
    const skip = this._tutorialActive() ? this._tutorialLayout().skip : null;
    const overSkip = skip && this._mouseIn(skip.x, skip.y, skip.w, skip.h);
    this.canvas.style.cursor = painting && !overSkip ? 'none' : 'default';
    this.input.setCaptureMode(painting && !overSkip);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cw, this.ch);
    const v = this._view();
    const sat01 = this.world.worldColorSat();
    // V2 (v1.2 M11): the awaken saturation surge is a RENDER-ONLY boost. The
    // world's paint/bar keep reading worldColorSat() (the single source of
    // truth); this just nudges how saturated the world is drawn for ~1s.
    const drawSatRaw = Math.min(1, sat01 + (this._bloomSurge || 0));
    const drawSat = (this.state === 'expedition' && this.tuning && this.tuning.satFloor != null)
      ? Math.min(drawSatRaw, this.tuning.satFloor)
      : drawSatRaw;
    // L3: on the title the living backdrop "breathes" — the world is drawn at a
    // saturation that swells 0.35 <-> 0.55 on an 8 s sine (titleColorSat).
    // DRAW-ONLY modulation of the worldColorSat read (never writes world state),
    // so the color-reveal single-source-of-truth invariant is preserved and the
    // swell only affects the title backdrop (every other screen is untouched).
    let drawSatFinal = (this.state === 'title')
      ? clamp(titleColorSat(this.titleT), 0, 1)
      : drawSat;
    const colorHome = this.state === 'end' && this.endKind === 'victory' && this.campaign?.complete;
    if (colorHome) drawSatFinal += (1 - drawSatFinal) * clamp(this.endT / 2.2, 0, 1);
    // M1 (v1.4): the first-victory cinematic beat BLOOMS the world to full
    // color — a render-only saturation ramp up to 1.0 across ~2.2 s (the beat
    // is 4 s, so the last ~1.8 s hold at full color under the skip hint).
    // DRAW-ONLY: it never writes world state, so the color-reveal single-source
    // of truth is preserved and the effect only shows on the end screen during
    // the beat (no other screen reads _cine).
    if (this._cine) {
      const c = clamp(this._cine.t / 2.2, 0, 1);
      const ease = 0.5 - 0.5 * Math.cos(Math.PI * c);   // ease-in-out 0 -> 1
      const cineSat = 0.18 + 0.82 * ease;
      if (cineSat > drawSatFinal) {
        const f = clamp((this._cine.t / 0.5), 0, 1);    // fade the boost in
        drawSatFinal = Math.max(drawSatFinal, drawSatFinal + (cineSat - drawSatFinal) * f);
      }
    }

    // ---- world space ----
    ctx.save();
    ctx.translate(-v.x * v.scale, -v.y * v.scale);
    ctx.scale(v.scale, v.scale);
    this.world.drawBackground(ctx, v, drawSatFinal);
    // L2 (v1.9): the BASE-SWAMP LIGHT POOLS — the parked "lantern in the swamp"
    // done as PURE LIGHT (no fuel, no mechanics). Drawn right after the
    // background so the light pools sit ON the ground, UNDER the props / the
    // frog / the paint. PRESENTATION-ONLY + POOLED + SEEDED + VIEW-CULLED (a
    // baked-once glow sprite, no per-frame gradient allocation — P10-safe).
    // Base-swamp ONLY (a Reeds variant's pool is empty → no-op), so a first-time
    // base-swamp run gains the faint glow and a Reeds run renders exactly as
    // before; no tuning / runT / logic.js number moves.
    this.world.drawSwampLightPools(ctx, v, this.now);
    this.world.drawProps(ctx, v, drawSatFinal, this.now, this.player ? this.player.x : undefined, this.player ? this.player.y : undefined);
    this.world.drawObstacles(ctx, v, drawSatFinal);
    // L1 (v1.9): the ENVIRONMENTAL LIFE layer — the living-world ambient
    // elements (surface ripples on the water bands, drifting pollen (swamp),
    // the ambient firefly swarm (Reeds/Black Reeds)). The BREATHING MIST is
    // the v1.4 parallax bands, already modulated inside drawProps (so it stays
    // the topmost ambient wash). Presentation-only + pooled + seeded +
    // view-culled (P10-safe): no new per-frame state, no tuning / runT /
    // logic.js change. Drawn on top of the terrain so ripples read on the
    // water and pollen / fireflies drift across the scene.
    this.world.drawAmbient(ctx, v, drawSatFinal, this.now);
    // R1 (v1.6): the Reeds biome's LIGHT ECONOMY — the drifting fireflies + the
    // static lantern-rest stones (world space, VIEW-CULLED so they never add to
    // the P10 draw budget). No-op for a base (non-Reeds) world, so a first-time
    // run renders exactly as before.
    this.world.drawReedsLights(ctx, v, this.now);
    // R2 (v1.6): the Reeds TRAVERSAL layer — the flooded lower banks (open dark
    // water, slower ground movement) + the inverted-gravity pocket root-ceilings
    // (world space, VIEW-CULLED; no per-frame state). No-op for a base world.
    this.world.drawReedsTraversal(ctx, v, this.now);
    // J2 (v1.9): the INK-THAT-LANDS — a darker wet blotch on painted soil + a
    // ripple over painted water. Drawn UNDER the wet marks so the stroke sits
    // on top of its landing (draw-only; the "painted soil darkens / water
    // ripples" that makes the paint LANDING visible, not just the arc).
    if (this.state === 'expedition' || this.state === 'end') this.studio?.draw(ctx, v, this.now);
    if (this.state === 'expedition') this.encounter?.drawWorld(ctx, v);
    if (this.state === 'expedition') drawJourneyWorld(this, ctx, v);
    this.paint && this.paint.drawInk(ctx);
    // J1 (v1.4): short-lived wet residue marks sit on the surface, under the
    // active stroke and all entities (draw-only; never affects logic).
    this.paint && this.paint.drawWet(ctx);
    this.paint && this.paint.drawTrails(ctx);
    // J3 (v1.9): the KILL INK-BURST — the soft watercolor blobs a creature
    // dissolves into on death, drawn just after the wet marks so the burst
    // reads as fresh ink breaking out of the enemy (draw-only; pooled + capped
    // in paint.js, decayed in paint.update).
    this.paint && this.paint.drawInkBurst(ctx);
    // J2 (v1.9): the in-flight ink DROPLETS — small pigment dots with gravity +
    // settle, drawn ON TOP of the wet marks so the spray reads as fresh ink in
    // the air (draw-only; pooled + capped in paint.js).
    this.paint && this.paint.drawDroplets(ctx);
    if (this.state === 'expedition' || this.state === 'end') {
      if (this.heron) (this.heron.warden ? this._drawWarden(ctx, this.heron, this.now) : (this.heron.umbra ? this._drawUmbra(ctx, this.heron, this.now) : (this.heron.wyrm ? this._drawWyrm(ctx, this.heron, this.now) : this._drawHeron(ctx, this.heron, this.now)))); // F1: Warden / G2: Umbral Wyrm / R4: Silt Wyrm / heron
      if (this.sketchHeron) this._drawHeron(ctx, this.sketchHeron, this.now);
      if (this.midHeron) this._drawHeron(ctx, this.midHeron, this.now); // E1: Painted Heron
      for (const e of this.enemies) drawEnemy(ctx, e, this.now);
      this._drawHazards(ctx, drawSatFinal); // E3: Bold-only zone hazards
      if (this.player && this.player.alive) this.player.draw(ctx, v, this.now);
      this._drawOrbs(ctx);
      this._drawBloom(ctx); // V2: radial awaken-bloom wash (world space)
    }
    this.particles.draw(ctx);
    this.paint && this.paint.drawNotes(ctx);
    ctx.restore();

    // ---- screen space ----
    this._screenSpace();
    if ((this.state === 'expedition' || this.state === 'end') && this.tuning && this.tuning.nightDarkness) {
      ctx.save();
      ctx.fillStyle = 'rgba(10,14,30,0.34)';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
    if ((this.state === 'expedition' || this.state === 'end') && this.lanternReeds && this.player) {
      if (!colorHome) this._drawReedsLight(ctx, v);
    }
    if (this.state === 'expedition' && this.world.mothFlower && this.player) {
      ctx.save(); ctx.translate(-v.x * v.scale, -v.y * v.scale); ctx.scale(v.scale, v.scale);
      this.world.drawMothHint(ctx, this.player.x, this.player.y); ctx.restore();
    }
    if (this.state === 'expedition') {
      this._drawOffscreenHeronArrow(ctx, v);
      this._drawOffscreenEnemyArrows(ctx, v);
      if (this.state === 'expedition') drawCombatReadout(this, ctx, v);
      this._drawHud(ctx);
      if(this.state==='expedition'){drawDungeonProgress(this,ctx);drawJourneyHud(this,ctx);}
    }
    // T1 (v1.2 M13): the on-screen goal chip + SKIP button for the guided first
    // expedition (rendered above the HUD so it reads as the active instruction).
    if (this.state === 'expedition') {
      if (!this.encounter?.nearby && !this.encounter?.active) this.studio?.drawHint(ctx);
      this.encounter?.drawHint(ctx);
    }
    if (this.state === 'expedition' && this.tutorial && !this.tutorial.done) this._drawTutorialChip(ctx);
    if (this.state === 'camp') drawDungeonCamp(this,ctx);
    if (this.state === 'title') this._drawTitle(ctx);
    if (this.state === 'title' && this.optionsOpen) this._drawOptions(ctx);
    if (this.paused && this.state === 'expedition') this._drawPause(ctx);
    if (this.help && this.state === 'expedition') this._drawHelp(ctx);   // M8 P6
    if (this.state === 'end') this._drawEnd(ctx);
    // banners render last so they sit above every screen (incl. the title,
    // where the erase-save confirm banner appears)
    this._drawZoneTint(ctx);
    if (this.state !== 'end') this._drawBanners(ctx);
    // W2 (v1.6): the gamepad UI overlays — the title "pad connected" chip + the
    // focus-cursor highlight over the focused menu button. Drawn above the
    // screens so the cursor is visible on the highlighted button.
    if (!this.optionsOpen && !this._cine && (this.state !== 'expedition' || this.paused)) {
      const b = sketchbookButton(this);
      uiButton(ctx, b.x, b.y, b.w, b.h, 'Sketchbook  [J]', this._mouseIn(b.x, b.y, b.w, b.h), false, { seed: 93, size: 14 });
      if (this.state === 'expedition' && this.paused && !this.help) {
        const a = atlasButton();
        uiButton(ctx, a.x, a.y, a.w, a.h, 'Field Atlas  [V]', this._mouseIn(a.x, a.y, a.w, a.h), false, { seed: 719, size: 14 });
      }
    }
    this._drawGpFocus(ctx);
    this._drawGpChip(ctx);

    // ---- L3 (v1.4): lighting polish — a soft warm radial glow around the frog
    // (in-expedition) + a subtle always-on warm vignette. The warm vignette is
    // drawn UNDER the existing low-HP red pulse (which composites on top). Both
    // are gated by the SAME options.vignette toggle as the low-HP pass. ----
    if (this.options.vignette) {
      // (a) soft warm glow around the frog — screen space (world→screen via v).
      if ((this.state === 'expedition' || this.state === 'end') && this.player && this.player.alive) {
        const sx = (this.player.x - v.x) * v.scale;
        const sy = (this.player.y - v.y) * v.scale;
        const R = 150 * v.scale;
        const g = ctx.createRadialGradient(sx, sy, 6, sx, sy, R);
        g.addColorStop(0, 'rgba(255,222,150,0.16)');
        g.addColorStop(0.5, 'rgba(255,205,130,0.06)');
        g.addColorStop(1, 'rgba(255,205,130,0)');
        ctx.save();
        ctx.fillStyle = g;
        ctx.fillRect(sx - R, sy - R, R * 2, R * 2);
        ctx.restore();
      }
      // (b) subtle always-on warm vignette — a soft edge darkening (corners
      // stronger, middle near-clear) that reads as gentle lighting. warmVignetteAlpha
      // is pure; the radial gradient approximates its distance falloff (the
      // corner sits at normalized distance 1, so its alpha is warmVignetteAlpha(1)).
      const half = Math.hypot(this.cw, this.ch) / 2;
      const cR = Math.max(1, this.ch * 0.42);
      const edgeA = warmVignetteAlpha(1, 1);
      const vg = ctx.createRadialGradient(this.cw / 2, this.ch / 2, cR, this.cw / 2, this.ch / 2, half);
      vg.addColorStop(0, 'rgba(40,28,18,0)');
      vg.addColorStop(1, 'rgba(40,28,18,' + edgeA.toFixed(3) + ')');
      ctx.save();
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, this.cw, this.ch);
      ctx.restore();
    }

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

    // ---- C3 (v1.3 M16): paper-grain overlay (options.grain, default OFF) ----
    // Drawn LAST (after the vignette) so the subtle procedural paper grain sits
    // on top of every screen. Pure presentation — no gameplay, no persistence
    // beyond the options toggle; skipped entirely when the option is off.
    this._drawGrain(ctx);
    if (this._bookOpen) { drawSketchbook(this, ctx); this._drawGpFocus(ctx); }
    if (this._atlasOpen) { drawFieldAtlas(this, ctx); this._drawGpFocus(ctx); }

    // J2 (v1.4): the boss-defeat white flash — a brief screen-wide white wash
    // that peaks on the defeat frame and fades over ~0.3s. Pure presentation
    // (gated by options.shake via whiteFlash); drawn last so it washes over
    // the heron's bloom at the moment of the big moment.
    if (this._whiteFlash > 0 && this.state === 'expedition' && !this._atlasOpen) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.9, this._whiteFlash);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, this.cw, this.ch);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // C3 (v1.3 M16): build (once) + draw the procedural paper-grain overlay.
  // NO image assets, NO scanlines/CRT (explicitly excluded — they fight the
  // watercolor identity): two CACHED offscreen tiles of low-opacity noise
  // speckles (a fine scale + a coarse scale for variation) are tiled across
  // the canvas at low alpha. The tiles are cached on `this._grain` so the
  // per-frame cost is two pattern fills. `createPattern` returning a falsy
  // value (headless stubs, or a context without pattern support) is a clean
  // no-op. `this._grainDraws` counts drawn frames (a test-observable signal).
  _buildGrain() {
    if (this._grain) return this._grain;
    const mk = (size, n, a) => {
      const cv = document.createElement('canvas');
      cv.width = size; cv.height = size;
      const g = cv.getContext('2d');
      for (let i = 0; i < n; i++) {
        g.globalAlpha = a * (0.4 + Math.random() * 0.6);
        g.fillStyle = Math.random() < 0.62 ? '#3a2c22' : '#fdf6e9';
        const r = 0.4 + Math.random() * 1.1;
        g.beginPath();
        g.arc(Math.random() * size, Math.random() * size, r, 0, TAU);
        g.fill();
      }
      return cv;
    };
    // Two scales: a fine 128px tile (dense, faint) + a coarse 64px tile (sparse,
    // slightly stronger) so the grain reads as paper texture, not flat noise.
    this._grain = {
      fine: { cv: mk(128, 220, 0.05) },
      coarse: { cv: mk(64, 46, 0.07) },
    };
    // Cache the patterns on this context (built once per Game; the tiles are
    // reused for the life of the Game, so the per-frame cost is two fills).
    this._grain.fine.pat = this.ctx.createPattern(this._grain.fine.cv, 'repeat');
    this._grain.coarse.pat = this.ctx.createPattern(this._grain.coarse.cv, 'repeat');
    return this._grain;
  }
  _drawGrain(ctx) {
    if (!this.options || !this.options.grain) return;   // default OFF: skipped
    const gr = this._buildGrain();
    ctx.save();
    ctx.globalAlpha = 0.6;
    if (gr.fine.pat) { ctx.fillStyle = gr.fine.pat; ctx.fillRect(0, 0, this.cw, this.ch); }
    ctx.globalAlpha = 0.4;
    if (gr.coarse.pat) { ctx.fillStyle = gr.coarse.pat; ctx.fillRect(0, 0, this.cw, this.ch); }
    ctx.restore();
    this._grainDraws = (this._grainDraws || 0) + 1;
  }

  // V2 (v1.2 M11): trigger the heron "awaken bloom" at world position (x, y).
  // Pure presentation, tied to the existing awaken state change — no gameplay.
  // Three things happen, all short and cosmetic:
  //   1. a radial color wash spreads from the heron (drawn in _drawBloom);
  //   2. the world saturation briefly surges (a timed +kick on worldColorSat);
  //   3. a distinctive 'awaken-bloom' SFX (see audio.js).
  _triggerBloom(x, y) {
    this._bloom = { x, y, t: 0, dur: 1.1 };
    // a brief, decaying saturation surge (the swamp "blooms" for a moment).
    // It eases back out so the long-run color curve is untouched — the bar and
    // the world both keep reading worldColorSat(), which this bumps for ~1s.
    this._bloomSurge = 0.14;
    this.particles.sparkles(x, y, PIGMENTS.red.light, 8);
    this.particles.sparkles(x, y, PIGMENTS.blue.light, 8);
    this.particles.sparkles(x, y, PIGMENTS.green.light, 8);
    this.sfx('awaken-bloom');
  }

  // V2: draw the awaken bloom (world space — caller has applied the view
  // transform). A radial multi-color wash that expands and fades over `dur`.
  _drawBloom(ctx) {
    if (!this._bloom) return;
    const b = this._bloom;
    const k = b.t / b.dur;                 // 0..1
    if (k >= 1) return;
    const r = 40 + 420 * (1 - Math.pow(1 - k, 2));  // fast-out expansion
    const a = 0.5 * (1 - k);               // fade out
    if (a < 0.01) return;
    ctx.save();
    ctx.translate(b.x, b.y);
    // three concentric pigment rings, each a touch larger, for a watercolor wash
    const cols = [PIGMENTS.red.light, PIGMENTS.green.light, PIGMENTS.blue.light];
    for (let i = cols.length - 1; i >= 0; i--) {
      const rr = r * (0.55 + i * 0.28);
      const g = ctx.createRadialGradient(0, 0, rr * 0.2, 0, 0, rr);
      g.addColorStop(0, cols[i]);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a * (0.5 - i * 0.08);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
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

  // V1 (v1.2 M11): painted-world "color-reveal" progress — the swamp's
  // saturation recovering (gray -> full color) as the frog paints. The single
  // source of truth is `world.worldColorSat()` (the same value the terrain
  // draw uses); we feed it through the pure `revealProgress()` mapping in
  // logic.js so the HUD bar always matches what the world actually shows.
  // Pure read — no gameplay change.
  revealProgress() {
    return revealProgressOf(this.world ? this.world.worldColorSat() : 0);
  }

  _drawHud(ctx) {
    const p = this.player;
    const t = this.tuning;
    if (!p) return;

    // ---- V1: color-reveal progress bar (top edge, full-width, thin) ----
    // A thin bar along the very top whose fill = the world's actual color
    // saturation (gray -> full color). It is a HUD read of `worldColorSat()`,
    // so it always matches the terrain the frog is literally painting.
    const rev = this.revealProgress();
    this._paperChip(ctx, this.cw - 218, 8, 204, 84, 4);
    const barH = 5, barW = this.cw;
    ctx.save();
    // track: desaturated gray (the "un-restored" swamp)
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = sat('#8d9aa0', 0.18);
    ctx.fillRect(0, 0, barW, barH);
    // fill: the recovered color, growing left -> right
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = sat('#5c9a76', 0.35 + 0.65 * rev);
    ctx.fillRect(0, 0, barW * rev, barH);
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.strokeStyle = INK;
    ctx.strokeRect(0.5, 0.5, barW - 1, barH - 1);
    // small label at the right end so the fantasy reads as "color restored"
    ctx.globalAlpha = 0.72;
    centerText(ctx, `color restored ${Math.round(rev * 100)}%`, this.cw - 66, barH + 10,
      uiFont(UI.sizes.tiny, { italic: true }), INK, 0.75);
    ctx.restore();

    // ---- D1 (v1.7): THE WANDER badge (top-left, under the reveal bar) ----
    // A small "Wandering · seed N" chip that appears ONLY when a Wander run is
    // active (options.wander ON + a generated layout). It tells the player the
    // expedition was generated and lets them note the seed (the reproducibility
    // key). Guarded by this.wanderActive so a default-OFF / hand-tuned run's
    // HUD is byte-identical (never drawn).
    if (this.wanderActive) {
      const bw = 150, bh = 40, bx = 14, by = barH + 16;
      ctx.save();
      ctx.globalAlpha = 0.9;
      this._paperChip(ctx, bx, by, bw, bh, 8);
      ctx.globalAlpha = 1;
      // a tiny wobbly ink compass-glyph (procedural, no asset) marks "generated"
      ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      const gx = bx + 13, gy = by + 14;
      ctx.moveTo(gx - 5, gy + 4); ctx.lineTo(gx + 5, gy - 4);
      ctx.moveTo(gx + 5, gy - 4); ctx.lineTo(gx + 2, gy - 4);
      ctx.moveTo(gx + 5, gy - 4); ctx.lineTo(gx + 5, gy - 1);
      ctx.stroke();
      // line 1: the reproducibility seed (a player can note it to replay the run)
      centerText(ctx, `Wandering · ${this.wanderSeedRun}`, bx + 18 + (bw - 22) / 2, by + 13,
        uiFont(UI.sizes.xsmall, { weight: 700 }), '#7a5a2a', 0.95);
      // line 2 (D2): the run's TASTE — one line of flavor that tells the player
      // which archetype this generated run leans (mosquito-heavy / toad-heavy /
      // ...). Pure presentation over wanderTaste (reproducible from the seed);
      // a default-OFF run never reaches here (wanderActive false).
      if (this.wanderTaste) {
        centerText(ctx, this.wanderTaste.name, bx + 18 + (bw - 22) / 2, by + 29,
          uiFont(UI.sizes.tiny, { italic: true }), '#8a6a3a', 0.9);
      }
      ctx.restore();
    }

    // ---- heart pips (top-left) ----
    ctx.save();
    ctx.globalAlpha = 0.92;
    const maxP = p.maxHp;
    const r = 5.5;
    const w = maxP * r * 2.6;
    this._paperChip(ctx, 14, 14, w + 20, 26);
    drawPips(ctx, 24, 27, r, maxP, Math.max(0, Math.ceil(p.hp)), '#d8543c');
    ctx.restore();

    // ---- E4: orb streak indicator (top-right) ----
    // A thin "×N.NN" chip that appears once a clean-orb streak earns a bonus.
    // Reads the pure orbStreakState() so it always matches the scoring.
    const ss = orbStreakState(this.orbStreak);
    if (ss.streak > 0) {
      const chipW = 78, chipH = 22, cx = this.cw - chipW - 14, cy = 142;
      ctx.save();
      ctx.globalAlpha = ss.active ? 0.95 : 0.7;
      this._paperChip(ctx, cx, cy, chipW, chipH, 6);
      ctx.globalAlpha = 1;
      const label = ss.active ? `streak ×${ss.mult.toFixed(2)}` : `streak ${ss.streak}/${ORB_STREAK.min}`;
      centerText(ctx, label, cx + chipW / 2, cy + chipH / 2 + 1,
        uiFont(UI.sizes.small, { weight: 700 }), ss.active ? '#b8741f' : INK, ss.active ? 1 : 0.7);
      ctx.restore();
    }

    if (this.lanternReeds && this.lantern) {
      const chipW = 150, chipH = 24, cx2 = this.cw - chipW - 14, cy2 = 108;
      const lit = !!this.lantern.lit;
      const fuel = Math.max(0, Math.min(1, this.lantern.fuel));
      const low = lit && fuel < 0.25;   // a dying wick reads red
      ctx.save();
      this._paperChip(ctx, cx2, cy2, chipW, chipH, 6);
      ctx.globalAlpha = 1;
      // the fuel track + fill (a horizontal candle, left -> right).
      const tx = cx2 + 12, ty = cy2 + chipH / 2 - 4, tw = chipW - 40, th = 8;
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = sat('#8d9aa0', 0.2);
      this._blobRect(ctx, tx, ty, tw, th, 4);
      ctx.fill();
      if (fuel > 0.001) {
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = low ? '#d8543c' : (lit ? '#e8a54a' : '#c9b48a');
        this._blobRect(ctx, tx, ty, Math.max(6, tw * fuel), th, 4);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // a tiny flame glyph on the far left: lit = amber, unlit = a grayed-out dot.
      ctx.fillStyle = lit ? (low ? '#d8543c' : '#e8a54a') : 'rgba(90,85,70,0.5)';
      ctx.beginPath();
      if (lit) {
        ctx.moveTo(cx2 + 8, cy2 + chipH / 2 - 6);
        ctx.quadraticCurveTo(cx2 + 12, cy2 + chipH / 2 - 1, cx2 + 8, cy2 + chipH / 2 + 4);
        ctx.quadraticCurveTo(cx2 + 4, cy2 + chipH / 2 - 1, cx2 + 8, cy2 + chipH / 2 - 6);
        ctx.fill();
      } else {
        ctx.arc(cx2 + 8, cy2 + chipH / 2, 3, 0, TAU);
        ctx.fill();
      }
      // the "L" key hint at the right end.
      centerText(ctx, 'L', cx2 + chipW - 14, cy2 + chipH / 2 + 1,
        uiFont(UI.sizes.xsmall, { weight: 700 }), lit ? '#b8741f' : INK, lit ? 1 : 0.6);
      ctx.restore();
    }

    // ---- pigment slots (under hearts) ----
    const order = ['red', 'blue', 'green', 'dry'];
    for (let i = 0; i < 4; i++) {
      const c = order[i];
      const pig = PIGMENTS[c];
      const x = 14 + i * 86, y = 52;
      const selected = p.pigment === c;
      ctx.save();
      if (selected) {
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = '#fdf6e9';
        ctx.lineWidth = 3;
        ctx.strokeStyle = pig.color;
        this._blobRect(ctx, x, y, 80, 44, 11 + i * 3);
        ctx.fill(); ctx.stroke();
      } else {
        this._paperChip(ctx, x, y, 80, 44, 10 + i * 2);
      }
      ctx.globalAlpha = 1;
      // key hint
      centerText(ctx, `${i + 1}`, x + 9, y + 10, uiFont(UI.sizes.xsmall, { weight: 700 }), INK, 0.55);
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
      centerText(ctx, ['Red · burn', 'Blue · stop', 'Green · heal', 'Dry · erase'][i], x + 40, y + 38, uiFont(12, { weight: 700 }), INK, 0.9);
      ctx.restore();
    }

    centerText(ctx, 'Left mouse: paint nearby   ·   Q / E or wheel: color', 250, 115, uiFont(14), this.lanternReeds ? '#f3ead7' : INK, 0.95);
    // ---- splash charge bar (right of pigments) ----
    const bx = 14 + 4 * 86 + 10, by = 52, bw = 136, bh = 44;
    ctx.save();
    this._paperChip(ctx, bx, by, bw, bh, 8);
    ctx.restore();
    const chg = p.splashCharge;
    ctx.save();
    ctx.globalAlpha = 0.92;
    centerText(ctx, 'Splash · right mouse', bx + bw / 2, by + 11, uiFont(12, { weight: 700 }), INK, 0.9);
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
    centerText(ctx, this.paint.splashCd > 0 ? `ready in ${this.paint.splashCd.toFixed(1)}s` : chg >= 1 ? 'release to splash!' : 'hold right-click', bx + bw / 2, by + 39, uiFont(11, { italic: true }), INK, 0.85);
    ctx.restore();

    // ---- score + collected (top-right) ----
    ctx.save();
    ctx.globalAlpha = 0.92;
    const sx = this.cw - 14;
    centerText(ctx, `Paint drops · ${this.score}`, sx - 94, 31, uiFont(15, { weight: 700 }), INK);
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
      centerText(ctx, `${this.collected[c]}`, ox, oy + 20, uiFont(UI.sizes.label, { weight: 700 }), INK);
    }
    ctx.restore();

    // ---- boss bar (top-center, once the heron is live) ----
    const hopX = 514, hopY = 52;
    this._paperChip(ctx, hopX, hopY, 146, 44, 13);
    centerText(ctx, 'Dodge · Space', hopX + 73, hopY + 14, uiFont(14, { weight: 700 }), INK);
    ctx.fillStyle = '#d8d3bb'; ctx.fillRect(hopX + 12, hopY + 23, 122, 6);
    ctx.fillStyle = '#62845b'; ctx.fillRect(hopX + 12, hopY + 23, 122 * clamp(1 - p.hopCd / (t.hopCooldown || 0.7), 0, 1), 6);
    centerText(ctx, p.hopCd > 0 ? 'Recharging' : 'Ready', hopX + 73, hopY + 39, uiFont(12), INK, 0.85);
    centerText(ctx, 'V Map   ·   H Help   ·   J Sketchbook', this.cw - 162, this.ch - 20, uiFont(14), this.lanternReeds ? '#f3ead7' : INK, 0.9);

    const h = this.heron;
    if (h && h._intro <= 0 && h.hp > 0 && h.flying <= 0) {
      const bw = 420, bx = (this.cw - bw) / 2, by = 16;
      ctx.save();
      ctx.globalAlpha = 0.92;
      this._paperChip(ctx, bx - 8, by - 6, bw + 16, 40, 4);
      ctx.restore();
      const frac = Math.max(0, h.hp / h.maxHp);
      ctx.save();
      const bossName = h.warden ? 'THE HOLLOW WARDEN' : h.umbra ? 'THE UMBRAL WYRM' : h.wyrm ? 'THE SILT WYRM' : 'THE GREAT GRAY HERON';
      centerText(ctx, bossName, this.cw / 2, by + 4, uiFont(UI.sizes.small, { weight: 700 }), INK, 0.85);
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
    centerText(ctx, 'swamp color', mx2 + 16 + ctx.measureText('x').width, my2, uiFont(UI.sizes.xsmall, { italic: true }), INK, 0.75);
    ctx.restore();

    // ---- J5 (v1.4): HUD floating "+n" numbers (pop up + fade near the jars) ----
    // Screen-space, so no world→screen conversion. They rise + fade on real
    // time (decayed in the frame loop).
    for (const f of this._floats) {
      const k = f.t / f.max;            // 0 → 1 over the float's life
      const rise = k * 26;             // drift upward
      const pop = 1 + Math.sin(Math.min(1, k * 3) * Math.PI * 0.5) * 0.3; // quick scale-in
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.fillStyle = f.color;
      ctx.font = uiFont(Math.round(15 * pop), { weight: 700 });
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,250,240,0.85)';
      ctx.strokeText(f.text, f.x, f.y - rise);
      ctx.fillText(f.text, f.x, f.y - rise);
      ctx.restore();
    }
    // ---- J5: the orb-streak fading trail (behind the frog, world space) ----
    if (this._streakTrail.length > 1) {
      const v = this._view();
      const toScreen = (wx, wy) => [ (wx - v.x) * v.scale, (wy - v.y) * v.scale ];
      for (const s of this._streakTrail) {
        const k = s.t / s.max;
        const [sx, sy] = toScreen(s.x, s.y);
        ctx.save();
        ctx.globalAlpha = Math.max(0, (1 - k) * 0.5);
        ctx.fillStyle = '#f2d16b';
        ctx.beginPath();
        ctx.arc(sx, sy, 4 * (1 - k) + 2, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  _drawBanners(ctx) {
    for (const b of this.banners) {
      const a = Math.min(1, b.t / 0.4, (b.max - b.t) / 0.4);
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      outlineText(ctx, b.text, this.cw / 2, b.y, uiFont(UI.sizes.h1, { weight: 600, display: true }), UI.palette.paperLight, INK, 5);
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
    const cx=this.cw/2, pw=600, ph=220, px=cx-pw/2, py=250;
    const bw=300,bh=52,bx=cx-bw/2,by=490,tw=300,th=38,tx=bx,ty=552;
    const diff=['gentle','normal','bold'].map((id,i)=>({id,label:DIFFICULTIES[id].label,x:cx-152+i*104,y:608,w:96,h:30}));
    return {cx,pw,ph,px,py,bx,by,bw,bh,tx,ty,tw,th,diff,abx:cx-210,aby:654,abw:200,abh:42,ox:cx+10,oy:654,ow:200,oh:42,fpush:0};
  }
  _setDifficulty(id) {
    if (!DIFFICULTIES[id] || this.options.difficulty === id) return;
    this.options.difficulty = id;
    SaveSys.saveOptions(this.options);
    this.tuning = makeTuning({}, [], this.options.difficulty);
    this._prevHp = this.tuning.maxHp;
    this.sfx('ui');
  }

  // ---------------- M8 P9: options overlay (volume + accessibility) --------
  // Single source of truth for the options panel geometry so draw and input
  // never drift. Sliders are horizontal bars: value = (handleX - x) / w.
  _optionsLayout() {
    const cx = this.cw / 2, cy = this.ch / 2;
    const pw = 460, ph = 598, px = cx - pw / 2, py = cy - ph / 2;
    const padX = 46;
    const trackX = px + padX, trackW = pw - padX * 2;
    const row = (baseY) => ({ x: trackX, y: baseY, w: trackW, h: 22 });
    const yMusic = py + 112, ySfx = py + 178, yShake = py + 240, yVign = py + 278, yGrain = py + 316;
    const yWander = py + 354;
    // W1 (v1.6 Module W): the "Gamepad: Auto / Off" row sits below the paper
    // grain toggle; the panel grows 424->462 to fit it and the back button
    // (anchored to py + ph - 66) moves down with the taller panel.
    const yGpad = py + 392;
    // Q3 (v1.6): SAVE EXPORT/IMPORT — the sanctioned loopback-only escape hatch
    // is a PASTE-based round trip (no file APIs, no server). The "Save" section
    // below the gamepad row has an EXPORT button (copies the save JSON to the
    // clipboard), an IMPORT button, and a paper-styled PASTE field (a text
    // input) on the right. The panel grows 462->558 to fit the section; the
    // back button stays anchored to py + ph - 66 and moves down with it.
    const ySaveHead = py + 430;
    const yExport = py + 448, yImport = py + 488, yField = py + 448;
    const back = { x: cx - 90, y: py + ph - 66, w: 180, h: 46 };
    return { cx, cy, pw, ph, px, py, padX, trackX, trackW,
      music: row(yMusic), sfx: row(ySfx),
      shake: { x: trackX, y: yShake, w: trackW, h: 26 },
      vignette: { x: trackX, y: yVign, w: trackW, h: 26 },
      grain: { x: trackX, y: yGrain, w: trackW, h: 26 },
      wander: { x: trackX, y: yWander, w: trackW, h: 26 },
      gpad: { x: trackX, y: yGpad, w: trackW, h: 26 },
      saveHead: ySaveHead,
      export: { x: trackX, y: yExport, w: 132, h: 34 },
      import: { x: trackX, y: yImport, w: 132, h: 34 },
      field: { x: trackX + 144, y: yField, w: trackW - 144, h: 74 },
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
  // W1 (v1.6 Module W): flip the gamepad mode Auto<->Off. Persisted via the
  // options blob (SAVE_VERSION stays 10 — options migration, not a save bump).
  _setGamepadMode() {
    this.options.gamepad = (this.options.gamepad === 'auto' ? 'off' : 'auto');
    SaveSys.saveOptions(this.options);
    this.sfx('ui');
    // Turning Auto back on should re-engage a connected pad immediately.
    if (this.options.gamepad === 'auto') this._gp.lastActiveMs =
      (typeof performance !== 'undefined' ? performance.now() : (this.last || 0) * 1000);
  }
  // W1 (v1.6 Module W): draw the "Gamepad: Auto / Off" row (label + a two-state pill).
  _drawGpad(c, rect, mode) {
    c.save();
    centerText(c, 'Gamepad', rect.x + 12, rect.y + rect.h / 2, uiFont(UI.sizes.bodyLg, { weight: 600 }), INK, 0.92);
    const pw = 84, ph = 28, pxx = rect.x + rect.w - pw, pyy = rect.y + (rect.h - ph) / 2;
    roundRectPath(c, pxx, pyy, pw, ph, ph / 2);
    c.fillStyle = (mode === 'auto') ? '#7fae6a' : 'rgba(43,35,32,0.28)'; c.fill();
    c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    const on = (mode === 'auto');
    c.beginPath(); c.arc(on ? pxx + pw - ph / 2 : pxx + ph / 2, pyy + ph / 2, ph / 2 - 4, 0, TAU);
    c.fillStyle = PAPER; c.fill(); c.lineWidth = 1.5; c.strokeStyle = INK; c.stroke();
    centerText(c, on ? 'Auto' : 'Off', pxx + pw / 2, pyy + ph / 2 + 1, uiFont(UI.sizes.small, { weight: 700 }), INK, 0.85);
    c.restore();
  }
  // Q3 (v1.6 Module Q): SAVE EXPORT/IMPORT — the sanctioned escape hatch for the
  // loopback-only localStorage architecture. The whole round trip is PASTE-based
  // (no file downloads, no server): Export writes a JSON blob of the save to the
  // clipboard (navigator.clipboard.writeText — loopback-safe, guarded for the
  // non-secure headless context), and Import reads a pasted blob from a paper-
  // styled field, validates it through the pure logic.validateSaveBlob (schema
  // check + the EXISTING migration chain + hard refuse on anything that does not
  // parse/normalise), then either replaces the save + reloads or leaves the
  // current save untouched with a one-line refuse banner. All the validation is
  // in logic.js; this method only orchestrates the UI + clipboard + reload.
  _exportSave() {
    // A fresh snapshot (not the live this.save, which may be mid-mutation) so
    // the exported blob is a clean serializable picture of the persisted save.
    const snapshot = SaveSys.load() || this.save;
    const blob = JSON.stringify(snapshot);
    const nav = (typeof navigator !== 'undefined') ? navigator : null;
    // The clipboard API needs a secure context (https/localhost) + a user
    // gesture. In the headless smoke context (and loopback http) it is absent
    // or rejects — so we ALWAYS also stash the blob on the instance
    // (`this._lastExportBlob`) for a non-secure/loopback path the player can
    // still read, and so the smoke test can assert it carries a parseable
    // saveVersion without a real clipboard.
    const cb = (nav && nav.clipboard) ? nav.clipboard : null;
    const finish = (wrote) => {
      this._saveBanner = wrote ? 'saved to the clipboard — paste it where you keep your backups' : 'could not reach the clipboard in this context';
      this._saveBannerT = 3.0; // seconds the banner lingers
      if (wrote) this.sfx('ui'); else this.sfx('ui-back');
    };
    if (cb && typeof cb.writeText === 'function') {
      Promise.resolve(cb.writeText(blob)).then(() => finish(true)).catch(() => finish(false));
      // also stash for the headless/test path (no clipboard)
      this._lastExportBlob = blob;
    } else {
      this._lastExportBlob = blob;
      finish(true); // expose the blob even without a real clipboard (loopback/http)
    }
    return this._lastExportBlob;
  }
  _importSave(pasted) {
    const res = validateSaveBlob(pasted);
    if (!res.ok) {
      this._saveBanner = 'that save did not look right — nothing was changed';
      this._saveBannerT = 3.0;
      this.sfx('ui-back');
      return false;
    }
    // res.save is the normalized current-schema save. Replace + persist + reload
    // so the whole game re-boots from the imported save.
    SaveSys.save(res.save);
    this.sfx('ui');
    this._saveBanner = 'save imported — reloading the gallery';
    this._saveBannerT = 3.0;
    // Reload in the browser. Guard for the headless context (no location.reload)
    // so the smoke test can assert the replace landed without navigating.
    try {
      if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
        window.location.reload();
      }
    } catch { /* headless — skip reload */ }
    // Mirror the imported save into the live instance so a no-reload (test) path
    // sees it immediately.
    this.save = res.save;
    this.tuning = makeTuning({}, [], this.options.difficulty);
    return true;
  }
  // Q3 (v1.6): focus the paste field and, in a real browser, pull the current
  // clipboard text into it (a click = "paste what I copied"). The clipboard READ
  // needs a secure context + a gesture; where it is unavailable the field simply
  // focuses and the player types/pastes by hand. The test drives the field text
  // directly (via `_setSaveField`) so it never needs a real clipboard.
  _pasteIntoField() {
    this._saveFieldFocus = true;
    if (this.input) this.input._fieldFocus = true;
    const nav = (typeof navigator !== 'undefined') ? navigator : null;
    const cb = (nav && nav.clipboard) ? nav.clipboard : null;
    if (cb && typeof cb.readText === 'function') {
      Promise.resolve(cb.readText()).then((txt) => {
        if (this._saveFieldFocus && typeof txt === 'string' && txt.length) {
          this._saveFieldText = txt;
        }
      }).catch(() => { /* no read permission — the player types instead */ });
    }
  }
  // Q3 (v1.6): set the paste field's text directly (test / programmatic path).
  _setSaveField(text) { this._saveFieldText = (text == null) ? '' : String(text); }
  // Q3 (v1.6): drop field focus (and stop capturing typed chars).
  _blurSaveField() { this._saveFieldFocus = false; if (this.input) this.input._fieldFocus = false; }
  // Q3 (v1.6): fold this frame's typed chars into the paste field (append +
  // backspace). Only active while the field is focused, so it is inert otherwise.
  _applySaveFieldChars() {
    if (!this._saveFieldFocus) return;
    const chars = this.input ? this.input.chars : [];
    for (const ch of chars) {
      if (ch === '\b') this._saveFieldText = this._saveFieldText.slice(0, -1);
      else this._saveFieldText += ch;
    }
  }
  _updateOptions(dt = 0) {
    const g = this._optionsLayout();
    const m = this.input.mouse;
    // Q3 (v1.6): fold this frame's typed chars into the paste field (only while
    // the field is focused) and decay the outcome banner's linger timer.
    this._applySaveFieldChars();
    if (this._saveBannerT > 0) { this._saveBannerT -= dt; if (this._saveBannerT <= 0) this._saveBanner = null; }
    // Back / Escape / O / Enter closes.
    if (this.input.pressed('escape') || this.input.pressed('o') || this.input.pressed('enter')) { this._closeOptions(); return; }
    if (this.input.pressed('m')) { this._muteToggle(); }
    if (m.lPressed) {
      // toggles (shake / vignette) take precedence on their rows
      if (this._mouseIn(g.shake.x, g.shake.y, g.shake.w, g.shake.h)) { this._toggleOpt('shake'); return; }
      if (this._mouseIn(g.vignette.x, g.vignette.y, g.vignette.w, g.vignette.h)) { this._toggleOpt('vignette'); return; }
      if (this._mouseIn(g.grain.x, g.grain.y, g.grain.w, g.grain.h)) { this._toggleOpt('grain'); return; }
      // W1: the gamepad Auto/Off row toggles the feed mode.
      if (this._mouseIn(g.gpad.x, g.gpad.y, g.gpad.w, g.gpad.h)) { this._setGamepadMode(); return; }
      // Q3: the Save section. Export writes the save blob to the clipboard.
      if (this._mouseIn(g.export.x, g.export.y, g.export.w, g.export.h)) { this._exportSave(); return; }
      // The paste field: click = pull the clipboard in (a paste shortcut). In a
      // context with no clipboard read the field keeps whatever text the player
      // has; Import commits it.
      if (this._mouseIn(g.field.x, g.field.y, g.field.w, g.field.h)) { this._pasteIntoField(); return; }
      // Import: validate + replace (or refuse, leaving the save untouched).
      if (this._mouseIn(g.import.x, g.import.y, g.import.w, g.import.h)) { this._importSave(this._saveFieldText || ''); return; }
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
    centerText(c, label, rect.x + 12, rect.y + rect.h / 2, uiFont(UI.sizes.bodyLg, { weight: 600 }), INK, 0.92);
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
    centerText(c, 'Options', g.cx, g.py + 44, uiFont(UI.sizes.heroSm, { weight: 700 }));
    // R1 (v1.8): the release version sits in the options header — the natural
    // "about" spot, beside the existing controls hint. Display-only (renders
    // the single GAME_VERSION string from logic.js; no state touched).
    centerText(c, `M to mute · Esc / O to close  ·  v${GAME_VERSION}`, g.cx, g.py + 74, uiFont(UI.sizes.small, { italic: true }), INK, 0.65);
    const m = this.input.mouse;
    const hot = (r) => m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y - 8 && m.y <= r.y + r.h + 8;
    // music slider
    centerText(c, 'Music', g.trackX, g.music.y - 18, uiFont(UI.sizes.body, { weight: 700 }), INK, 0.9);
    centerText(c, Math.round(this.options.musicVol * 100) + '%', g.trackX + g.trackW, g.music.y - 18, uiFont(UI.sizes.label, { weight: 700 }), INK, 0.8);
    this._drawSliderTrack(c, g.music, this.options.musicVol, hot(g.music), m.x, m.y);
    // sfx slider
    centerText(c, 'Sound effects', g.trackX, g.sfx.y - 18, uiFont(UI.sizes.body, { weight: 700 }), INK, 0.9);
    centerText(c, Math.round(this.options.sfxVol * 100) + '%', g.trackX + g.trackW, g.sfx.y - 18, uiFont(UI.sizes.label, { weight: 700 }), INK, 0.8);
    this._drawSliderTrack(c, g.sfx, this.options.sfxVol, hot(g.sfx), m.x, m.y);
    // toggles
    this._drawToggle(c, g.shake, 'Screen shake', this.options.shake);
    this._drawToggle(c, g.vignette, 'Low-HP vignette', this.options.vignette);
    // C3 (v1.3 M16): the paper-grain presentation toggle (default OFF).
    this._drawToggle(c, g.grain, 'Paper grain', this.options.grain);
    this._drawGpad(c, g.gpad, this.options.gamepad);
    // Q3 (v1.6): the Save export/import section (Export / Import buttons + the
    // paper-styled paste field + the one-line outcome banner).
    this._drawSaveSection(c, g, m);
    // back
    uiButton(ctx, g.back.x, g.back.y, g.back.w, g.back.h, 'Back', this._mouseIn(g.back.x, g.back.y, g.back.w, g.back.h), false, { seed: 62, size: 16, mouseX: m.x, mouseY: m.y, mouseClicked: false });
    paperEnd(ctx);
  }
  // Q3 (v1.6): render the Save section. Two paper buttons (Export / Import) in a
  // left column and a paper-styled paste field on the right. A one-line outcome
  // banner (success OR the refuse line) lingers below the section when present.
  _drawSaveSection(c, g, m) {
    c.save();
    // the section header
    centerText(c, 'Save backup · copy or paste below', g.trackX, g.saveHead, uiFont(UI.sizes.body, { weight: 700 }), INK, 0.9);
    centerText(c, 'copy · paste · carry your gallery', g.trackX + g.trackW, g.saveHead, uiFont(UI.sizes.xsmall, { italic: true }), INK, 0.55);
    const hotE = this._mouseIn(g.export.x, g.export.y, g.export.w, g.export.h);
    const hotI = this._mouseIn(g.import.x, g.import.y, g.import.w, g.import.h);
    // EXPORT button (top of the left column)
    uiButton(c, g.export.x, g.export.y, g.export.w, g.export.h, 'Export', hotE, false, { seed: 63, size: 13, mouseX: m.x, mouseY: m.y, mouseClicked: false });
    // IMPORT button (below export)
    uiButton(c, g.import.x, g.import.y, g.import.w, g.import.h, 'Import', hotI, false, { seed: 64, size: 13, mouseX: m.x, mouseY: m.y, mouseClicked: false });
    // the PASTE FIELD (right of the two buttons). A paper-styled rounded box that
    // shows the tail of the pasted/typed blob so the player can confirm what is
    // about to be imported. Focused (click) => a subtle ink underline.
    roundRectPath(c, g.field.x, g.field.y, g.field.w, g.field.h, 8);
    c.fillStyle = this._saveFieldFocus ? 'rgba(244,234,216,0.9)' : 'rgba(244,234,216,0.55)';
    c.fill();
    c.lineWidth = this._saveFieldFocus ? 2.2 : 1.4;
    c.strokeStyle = this._saveFieldFocus ? INK : 'rgba(43,35,32,0.45)';
    c.stroke();
    // the field's content: a truncated, right-aligned preview of the blob (it is
    // a long JSON line — show the tail so the closing brace is visible).
    const txt = this._saveFieldText || '';
    const shown = txt.length > 46 ? '…' + txt.slice(-44) : (txt.length ? txt : 'paste the exported save here…');
    const preview = shown.length > 52 ? shown.slice(0, 52) : shown;
    centerText(c, preview, g.field.x + g.field.w / 2, g.field.y + g.field.h / 2, uiFont(UI.sizes.tiny, { mono: true }), INK, this._saveFieldFocus ? 0.9 : (txt.length ? 0.75 : 0.4));
    c.restore();
    // the one-line outcome banner (a thin pill in the band just above the Save
    // section — transient, it lingers ~3s then the banner timer clears it).
    if (this._saveBanner) {
      c.save();
      const bw = Math.min(g.pw - 80, 560), bx = g.cx - bw / 2, by = g.py + 386;
      roundRectPath(c, bx, by, bw, 22, 8);
      c.fillStyle = 'rgba(43,35,32,0.08)'; c.fill();
      c.lineWidth = 1; c.strokeStyle = 'rgba(43,35,32,0.35)'; c.stroke();
      centerText(c, this._saveBanner, g.cx, by + 12, uiFont(UI.sizes.small, { weight: 600 }), INK, 0.9);
      c.restore();
    }
  }

  // L3: a frog idling on a lily pad in the lower-left corner of the title —
  // the swamp "breathes" at rest. Reuses J4's watercolor blob pose (a wobbly
  // body via traceBlob + squash scale) with a slow breathing bob. Pure
  // draw-time (a function of this.now); no world/player state.
  _drawIdleFrog(ctx) {
    const t = this.now;
    const px = 150, py = this.ch - 150;           // lower-left, clear of the panel
    const bob = Math.sin(t * 1.1) * 3;             // breathing bob
    const breathe = 1 + 0.03 * Math.sin(t * 1.1); // gentle squash-and-stretch
    // lily pad
    ctx.save();
    ctx.translate(px, py + 14);
    ctx.fillStyle = '#4f8a55';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    traceBlob(ctx, 0, 0, 42, 21, 0.06, 16);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(244,234,216,0.4)';
    ctx.beginPath(); ctx.ellipse(6, 4, 20, 12, 0.3, 0, TAU); ctx.fill();
    ctx.restore();
    // frog (J4 pose: wobbly blob + squash)
    ctx.save();
    ctx.translate(px, py - 6 + bob);
    // M3 (v1.4 easter egg A): the "appreciates the attention" spin-and-blink —
    // a quick 360° spin (real-time, ~0.8 s) around the frog's own center.
    // Draw-only: it never touches world/player state or pacing.
    const eggSpin = this._eggFrog ? this._eggFrog.spin : -1;
    if (eggSpin >= 0) {
      const sp = Math.min(1, eggSpin / 0.8);
      ctx.rotate(sp * TAU);                    // one full spin, ease by progress
      ctx.scale(1 + 0.08 * Math.sin(sp * Math.PI), 1 - 0.06 * Math.sin(sp * Math.PI)); // a tiny hop
    }
    ctx.scale(breathe, 2 - breathe);
    const r = 20;
    // legs
    ctx.fillStyle = '#69a24e'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-r * 0.85, r * 0.45, 6, 4.5, -0.5, 0, TAU);
    ctx.ellipse(r * 0.85, r * 0.45, 6, 4.5, 0.5, 0, TAU);
    ctx.fill(); ctx.stroke();
    // body — the traceBlob seed varies slowly with time for a living wobble
    const seed = Math.floor(t * 3);
    ctx.fillStyle = '#69a24e';
    traceBlob(ctx, 0, 0, r, seed, 0.09, 12);
    ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = INK;
    traceBlob(ctx, 0, 0, r, seed, 0.09, 12);
    ctx.stroke();
    // belly
    ctx.fillStyle = 'rgba(244,234,216,0.55)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.35, r * 0.6, r * 0.4, 0, 0, TAU); ctx.fill();
    // eyes (looking up at the title)
    const blink = (Math.sin(t * 0.8) > 0.96) ? 0.2 : 1; // occasional slow blink
    // M3 egg A: a happy CLOSED-eye blink during the spin-and-blink.
    const happy = eggSpin >= 0 ? 0.25 : 1;
    const eyeBlink = Math.min(blink, happy);
    for (const side of [-1, 1]) {
      const bx = side * r * 0.45, by = -r * 0.55;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(bx, by, 5, 5 * eyeBlink, 0, 0, TAU); ctx.fill(); ctx.stroke();
      if (eyeBlink > 0.5) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(bx, by - 1.5, 2.2, 0, TAU); ctx.fill(); }
    }
    // M3 egg B: a tiny cheek-blush (a pair of soft rosy ovals) that fades in a
    // few seconds — drawn after the eyes so it sits on the face. Real-time fade
    // (_eggBlush.frog), presentation only.
    const blushA = this._eggBlush ? Math.max(0, Math.min(1, this._eggBlush.frog / 1.2)) : 0;
    if (blushA > 0) {
      ctx.globalAlpha = 0.45 * blushA;
      ctx.fillStyle = '#f08a8a';
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * r * 0.5, r * 0.05, 5, 3.4, 0, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  _drawTitle(ctx) {
    const g=this._titleLayout(),cx=g.cx;
    ctx.fillStyle='rgba(26,43,37,0.3)';ctx.fillRect(0,0,this.cw,this.ch);
    this._drawIdleFrog(ctx);
    outlineText(ctx,'Frogue Gallery',cx,132,uiFont(64,{weight:700}),'#f4ead8',INK,8);
    centerText(ctx,'The Umbral Wyrm stole our color. Let’s paint our swamp back.',cx,184,uiFont(21),PAPER);
    drawDungeonRoute(this,ctx,cx-470,205,940);
    const c=paperPanel(ctx,g.px,g.py,g.pw,g.ph,{seed:11});
    const lines=['WASD to move · Mouse + left click to paint nearby','Space to dodge · Q / E or wheel to change color','Red burns · Blue stops · Green heals','Hold right mouse, then release for a splash','Make it yours. Follow the stolen colors to the Wyrm.'];
    lines.forEach((line,i)=>centerText(c,line,cx,g.py+36+i*36,uiFont(17,{weight:i===4?700:400}),INK));paperEnd(ctx);
    uiButton(ctx,g.bx,g.by,g.bw,g.bh,'Reclaim our swamp',this._mouseIn(g.bx,g.by,g.bw,g.bh),false,{size:21});
    uiButton(ctx,g.tx,g.ty,g.tw,g.th,'Practice the controls',this._mouseIn(g.tx,g.ty,g.tw,g.th),false,{size:16});
    for(const d of g.diff)uiButton(ctx,d.x,d.y,d.w,d.h,d.label,this._mouseIn(d.x,d.y,d.w,d.h),this.options.difficulty===d.id,{size:14});
    uiButton(ctx,g.abx,g.aby,g.abw,g.abh,'Your sketchbook',this._mouseIn(g.abx,g.aby,g.abw,g.abh),false,{size:17});
    uiButton(ctx,g.ox,g.oy,g.ow,g.oh,'Options',this._mouseIn(g.ox,g.oy,g.ow,g.oh),false,{size:17});
    centerText(ctx,'Each new run starts fresh. Saved paintings and postcards stay.',cx,725,uiFont(15),PAPER);
    centerText(ctx,'Erase saved artwork',140,this.ch-26,uiFont(13),PAPER,0.7);
    centerText(ctx,'Frogue Gallery · v'+GAME_VERSION,cx,this.ch-26,uiFont(12),PAPER,0.65);
    const keepsake=this.save.sketchbook?.find(p=>p.id===this.save.sketchExhibit);
    if(keepsake)drawPostcard(ctx,keepsake,26,274,312,187.2,studyRewardEarned(this.save.studio?.completed||[],'swamp'),studyRewardEarned(this.save.studio?.completed||[],'reeds'),!!this.save.flags.crossingPainted);
  }

  _helpGeom() {
    const cx=this.cw/2, pw=720, px=cx-pw/2, py=150;
    const retrainOn=retrainAllowed(this.save)&&!this._tutorialActive();
    const ph=(retrainOn?604:560)+(reedsUnlocked(this.save)?200:0);
    const bw=150,bh=34,gap=16,bx0=cx-(4*bw+3*gap)/2,by=py+ph-92;
    const labels=['Burn drill','Freeze drill','Root drill','Sketch heron'];
    const buttons=[3,4,5,6].map((phase,i)=>({phase,label:labels[i],x:bx0+i*(bw+gap),y:by,w:bw,h:bh}));
    return {cx,pw,ph,px,py,close:{x:px+pw-120,y:py+18,w:100,h:40},retrain:{enabled:retrainOn,titleY:by-18,buttons}};
  }

  _drawHelp(ctx) {
    const g = this._helpGeom();
    ctx.save();
    ctx.fillStyle = 'rgba(30,25,22,0.62)';
    ctx.fillRect(0, 0, this.cw, this.ch);
    ctx.restore();
    const c = paperPanel(ctx, g.px, g.py, g.pw, g.ph, { seed: 71 });
    this._leftText(c, 'Field Guide', g.px + 40, g.py + 38, uiFont(UI.sizes.h1, { weight: 700 }), INK, 1);
    this._leftText(c, 'the run is paused — take your time', g.px + 40, g.py + 62, uiFont(UI.sizes.label, { italic: true }), INK, 0.6);
    // close button
    uiButton(ctx, g.close.x, g.close.y, g.close.w, g.close.h, 'Close (H)', this._mouseIn(g.close.x, g.close.y, g.close.w, g.close.h), false, { seed: 75, size: 14 });

    const colL = g.px + 34, colR = g.px + g.pw / 2 + 14, colW = g.pw / 2 - 58;
    const y0 = g.py + 96;
    // ---- left column: painting (the pigments) ----
    c.save(); c.font = uiFont(UI.sizes.sub, { weight: 700 }); c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('Painting — your brush', colL, y0); c.restore();
    const pig = [
      ['1', PIGMENTS.red.color, 'Red — burn', 'Burn bugs. In the clearing, blue then red makes the red hit stronger.'],
      ['2', PIGMENTS.blue.color, 'Blue — stop', 'Stop flying bugs and slow ground bugs. Use it to interrupt a charge.'],
      ['3', PIGMENTS.green.color, 'Green — heal', 'Hit to heal and deal 1 damage. Moss roots ground bugs.'],
    ];
    pig.forEach((r, i) => {
      const y = y0 + 34 + i * 58;
      c.fillStyle = r[1]; c.beginPath(); c.arc(colL + 12, y, 11, 0, TAU); c.fill();
      c.lineWidth = 1.6; c.strokeStyle = INK; c.stroke();
      c.fillStyle = INK; c.font = uiFont(UI.sizes.bodyLg, { weight: 700 }); c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(`${r[2]} (key ${r[0]})`, colL + 32, y);
      c.font = uiFont(UI.sizes.label); c.fillStyle = 'rgba(43,35,32,0.8)';
      this._wrapHelp(c, r[3], colL + 32, y + 16, colW - 32, 14);
    });
    c.font = uiFont(UI.sizes.label); c.fillStyle = 'rgba(43,35,32,0.7)'; c.textAlign = 'left'; c.textBaseline = 'middle';
    this._wrapHelp(c, 'Hold left mouse to paint toward the aim mark. Move closer to reach things. Q/E or wheel: change color. Space: dodge. Hold right mouse until the ring fills, then release for a splash. Pale plants accept any color; 4 erases their paint.', colL, y0 + 34 + 3 * 58 + 6, colW, 14);

    // ---- right column: counterplay + the heron ----
    c.save(); c.font = uiFont(UI.sizes.sub, { weight: 700 }); c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('Know your quarry', colR, y0); c.restore();
    const foes = [
      ['Mud Beetle', 'armored — burn (red) ignores its shell. Don\u2019t just chip it.'],
      ['Mosquito', 'fast and airborne — blue FREEZES it solid; it ignores root.'],
      ['Grumpy Toad', 'tanky — paint it dizzy (green) for a 1.5\u00d7 open shot.'],
      ['Mud Turtle', 'armored shell — paint from the FRONT bounces off; circle behind, or burn it with red.'],
      ['Blind Crag Frog', 'hunts by sound — stay quiet and it sleeps (and takes +50% damage).'],
      ['Storm Surge', 'the 5th zone\u2019s storm — clear the swarm before the rain wears off for bonus orbs.'],
    ];
    foes.forEach((r, i) => {
      const y = y0 + 34 + i * 48;
      c.font = uiFont(UI.sizes.body, { weight: 700 }); c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(r[0], colR, y);
      c.font = uiFont(UI.sizes.label); c.fillStyle = 'rgba(43,35,32,0.8)';
      this._wrapHelp(c, r[1], colR, y + 15, colW, 13);
    });
    const hy = y0 + 34 + foes.length * 48 + 12;
    const bossName = campaignFloor(this.campaign)?.bossName || 'The guardian';
    c.font = uiFont(UI.sizes.bodyLg, { weight: 700 }); c.fillStyle = '#8d7bb0'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(bossName, colR, hy);
    c.font = uiFont(UI.sizes.label); c.fillStyle = 'rgba(43,35,32,0.85)';
    this._wrapHelp(c, 'Watch the telegraph (a glow before it strikes). Move off the marked line when it swoops, sweeps, or dives. It gathers reinforcements and grows fiercer the lower its health falls — keep painting to keep it stunned.', colR, hy + 16, colW, 14);

    const reedsGuide = reedsUnlocked(this.save);
    if (reedsGuide) {
      const rgY = y0 + 34 + foes.length * 48 + 12 + 60 + 40;
      c.save(); c.font = uiFont(UI.sizes.sub, { weight: 700 }); c.fillStyle = '#b08a4a'; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText('Beneath the Reeds', colR, rgY);
      c.font = uiFont(UI.sizes.xsmall, { italic: true }); c.fillStyle = 'rgba(43,35,32,0.7)';
      this._wrapHelp(c, 'the deeper swamp — carry your lantern (L). Its light draws these creatures.', colR, rgY + 15, colW, 12);
      c.restore();
      REEDS_CREATURES.forEach((r, i) => {
        const y = rgY + 40 + i * 30;
        c.font = uiFont(UI.sizes.label, { weight: 700 }); c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText(r.name, colR, y);
        c.font = uiFont(UI.sizes.small); c.fillStyle = 'rgba(43,35,32,0.8)';
        this._wrapHelp(c, r.note, colR, y + 13, colW, 12);
      });
    }

    // footer
    centerText(c, this._gp.connected ? 'Left stick move · Right stick aim · RT paint · RB hop · B splash · Start pause / atlas · Back sketchbook' : 'WASD move · Click to capture mouse · Esc release / pause · Space hop · V map · J sketchbook', g.cx, g.py + g.ph - 22, uiFont(UI.sizes.label, { italic: true }), INK, 0.6);
    // T4 (v1.2 M13): the "Watch me" retraining band — replay a single pigment
    // drill or the sketch-heron phase on demand (opt-in; never auto-enters, and
    // the replay is a frozen aside that never counts toward the timed run).
    if (g.retrain && g.retrain.enabled) {
      const rt = g.retrain;
      centerText(c, 'Watch me — replay a lesson (frozen; the run keeps its clock)', g.cx, rt.titleY, uiFont(UI.sizes.body, { weight: 700 }), INK, 0.9);
      for (const b of rt.buttons) {
        const hov = this._mouseIn(b.x, b.y, b.w, b.h);
        ctx.save();
        ctx.globalAlpha = hov ? 1 : 0.86;
        roundRectPath(ctx, b.x, b.y, b.w, b.h, 7);
        ctx.fillStyle = hov ? '#7a5fb0' : '#8d7bb0';
        ctx.fill();
        ctx.lineWidth = hov ? 2 : 1.2;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.restore();
        centerText(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, uiFont(UI.sizes.small, { weight: 700 }), '#fdf6e9', 1);
      }
    }
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
    // J5 (v1.4): the pause panel opens with a 0.15 s slide+fade (eased) instead
    // of a hard cut — a tiny per-widget clock (real time), no library. The
    // backdrop + card rise + fade in; button hit-rects stay at their final
    // positions (unchanged).
    const op = clamp(this._pauseOpenT / 0.15, 0, 1);
    const slide = (1 - op) * 24;
    ctx.save();
    ctx.globalAlpha = op;
    ctx.fillStyle = 'rgba(30,25,22,0.55)';
    ctx.fillRect(0, 0, this.cw, this.ch);
    ctx.restore();
    const cx = this.cw / 2, cy = this.ch / 2;
    // Q1 (v1.6): the card grows 260 -> 320 to carry a compact "this expedition"
    // block (run time + zone + enemies painted + orbs). Pure display — every
    // value read live at draw time, ZERO tuning/save change. The Resume / Quit
    // buttons shift down with the card; the pause input routing (below) keeps
    // the SAME offsets so the hit-rects stay in lock-step.
    const pw = 340, ph = 320, px = cx - pw / 2, py = cy - ph / 2 + slide;
    const c = paperPanel(ctx, px, py, pw, ph, { seed: 21 });
    centerText(c, 'Paused', cx, py + 38, uiFont(UI.sizes.heroSm, { weight: 700 }));
    centerText(c, 'P to resume - Esc quits to the pond', cx, py + 66, uiFont(UI.sizes.label), INK, 0.7);
    // Q1: the "this expedition" block — a live read of the current run (time,
    // zone, enemies painted, orbs). In-memory only; never touches the save.
    if (this.state === 'expedition') {
      const zi = this._zoneI || 0;
      const _zref = this.zones || ZONES; // D1 (v1.7): the run's zones (wander-aware)
      const zname = zi < _zref.length ? _zref[zi].name : 'the open water';
      const by = py + 104;
      ctx.save();
      ctx.globalAlpha = op;
      c.strokeStyle = 'rgba(43,35,32,0.28)';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(px + 44, by - 18); c.lineTo(px + pw - 44, by - 18); c.stroke();
      centerText(c, 'this expedition', cx, by, uiFont(UI.sizes.small, { weight: 700 }), '#a3762a', 0.9);
      centerText(c, `time ${this._fmtClock(this.runT || 0)}  ·  ${zname}`, cx, by + 20, uiFont(UI.sizes.label), INK, 0.85);
      centerText(c, `enemies painted ${this.runEnemies || 0}  ·  orbs ${this.runOrbs || 0}`, cx, by + 40, uiFont(UI.sizes.label), INK, 0.85);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = op;
    uiButton(ctx, px, py + 164, pw, 44, 'Resume', this._mouseIn(px, cy - ph / 2 + 164, pw, 44), false, { seed: 41, size: 16, mouseX: this.input.mouse.x, mouseY: this.input.mouse.y, mouseClicked: false });
    uiButton(ctx, px, py + 216, pw, 44, 'Quit to the Pond', this._mouseIn(px, cy - ph / 2 + 216, pw, 44), false, { seed: 42, size: 16, mouseX: this.input.mouse.x, mouseY: this.input.mouse.y, mouseClicked: false });
    ctx.restore();
    centerText(c, 'V · field atlas    M · mute', cx, py + 286, uiFont(UI.sizes.small, { italic: true }), INK, 0.6);
    paperEnd(ctx);
  }

  // Q1 (v1.6): format a seconds count as M:SS for the pause/end summaries.
  _fmtClock(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  _endButtons() { const cx=this.cw/2; return {primary:{x:cx-150,y:590,w:300,h:50},ret:{x:cx-150,y:654,w:300,h:40}}; }

  _drawEnd(ctx) {
    const cx=this.cw/2,win=this.endKind==='victory',b=this._endButtons();
    ctx.fillStyle=win?'rgba(22,35,30,0.24)':'rgba(22,35,30,0.66)';ctx.fillRect(0,0,this.cw,this.ch);
    const c=paperPanel(ctx,cx-370,130,740,590,{seed:9});
    centerText(c,win?'Our swamp has its color back.':'Our swamp still needs us.',cx,195,uiFont(34,{weight:700}),INK);
    centerText(c,win?'The Umbral Wyrm releases the stolen color. You brought it home.':'Rest your brush. Your paintings stay in the sketchbook.',cx,238,uiFont(17),INK);
    drawDungeonRoute(this,c,cx-320,278,640);
    centerText(c,(this.campaign?.cleared.length||0)+' / 4 guardians · '+this._fmtClock(this.runT||0)+' · '+(this.runEnemies||0)+' bugs painted',cx,333,uiFont(20),INK);
    const page=this.save.sketchbook?.[this.save.sketchbook.length-1];
    if(page)drawPostcard(c,page,cx-310,370,240,144,studyRewardEarned(this.save.studio?.completed||[],'swamp'),studyRewardEarned(this.save.studio?.completed||[],'reeds'),!!this.save.flags.crossingPainted);
    drawRunBuild(this,c,page?cx-40:cx-280,380,page?340:560);
    centerText(c,'Start again with a fresh brush. Your saved artwork stays.',cx,565,uiFont(15),INK);
    paperEnd(ctx);
    uiButton(ctx,b.primary.x,b.primary.y,b.primary.w,b.primary.h,'Paint the swamp again',this._mouseIn(b.primary.x,b.primary.y,b.primary.w,b.primary.h),false,{size:20});
    uiButton(ctx,b.ret.x,b.ret.y,b.ret.w,b.ret.h,'Return to the pond',this._mouseIn(b.ret.x,b.ret.y,b.ret.w,b.ret.h),false,{size:17});
  }
}
