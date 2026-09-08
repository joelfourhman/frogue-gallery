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
import { PIGMENTS, PIGMENT_ORDER, ENEMIES, makeTuning, applyDifficulty, DIFFICULTIES, bossStep, bankGain, freshSave, UPGRADES, PAINTINGS, canAfford, payCost, costArray, applyWelcomeGrant, WELCOME_GRANT, activeSynergy, canRetireCollection, retireCollection, galleryBonusLevel, MID_HERON, midHeronAllowed, WEATHER_PHASES, weatherFor, weatherFactor, BOLD_HAZARDS, boldHazardsAllowed, placeZoneHazards, orbStreakMult, orbStreakState, ORB_STREAK, revealProgress as revealProgressOf, tutorialEligible, tutorialDrillDone, tutorialDrillSatisfied, SKETCH_HERON, tutorialDone, retrainAllowed, ngUnlocked, applyNGPlus, ngPlusScaling, GREEN_HERON, greenHeronPinTick, GILDED_HERON, gildedPlumeTick, gildedPlumeActive, MODIFIERS, MODIFIER_ORDER, applyModifier, saveModifier, goldEarn, goldEventBoss, goldEventSynergy, goldEventOrbs, goldTotal, canAffordGold, GILDED_FRAME, canBuyGildedFrame, buyGildedFrame, isGilded, STORM_SURGE, stormSurgeFor, stormSurgeCleared, stormSurgeRainPhase, CHALLENGE_TOP_N, challengeUnlocked, challengeDaySeed, challengeDate, challengeDrawLoadout, challengeDrawModifier, challengeScore, challengeFileScore, MASTERPIECE, isMasterpieceMinted, challengeRank, challengeRankBonus, challengeRankEvent, challengeComplete, LANTERN, lanternState, lanternTick, lanternRadius, lightFactor, reedsUnlocked, REEDS_CREATURES, REEDS_BESTIARY, SILT_WYRM, wyrmStep, wyrmSurfacePoint, inGravityPocket, hopLift, floodedWaterFactor, GAMEPAD_MAP, gamepadActive, GAMEPAD_INACTIVITY_MS } from './logic.js';
import { INK, PAPER, centerText, outlineText, paperPanel, paperEnd, uiButton, drawPips, sat, mixColor, roundRectPath } from './ui.js';

// A1 (v1.2 M9): the atelier's resident characters speak in short one-liners.
// Five context pools per character (victory / defeat / purchase / general /
// ng — the NG+ pool is the C1 v1.3 batch-2 addition, drawn only when
// ngCycle >= 1), a typewriter reveal, and rotation so the same line never
// repeats twice in a row. Pure display data — nothing here is persisted.
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
      // C1 (v1.3 M16): the NG+ CONTEXT pool — a SECOND line pool drawn only
      // when ngCycle >= 1 (a returning expedition). Reuses the EXACT A1
      // machinery (context priority above the cycle-0 pools, rotating, no
      // repeat, typewriter); nothing persisted.
      ng: [
        'The gold is piling up in the safe — spend it well, you have earned it.',
        'A second expedition! The swamp noticed you. So did the heron.',
        'Hang the Gilded Frame and the whole wall will glow for you.'
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
      // C1: the NG+ context pool (Giuseppe reacting to a high ngCycle).
      ng: [
        'Third expedition? I am starting to keep a tally, and my prices are climbing.',
        'Every NG+ you take, the gold shelf gets fuller. My favorite shelf.',
        'You come back for more. That is either devotion or a very good business plan.'
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
      // C1: the NG+ context pool (Monet on the gilded frame / second-campaign
      // collection).
      ng: [
        'A gilded frame would suit your second collection. The light would like it.',
        'You are collecting twice now. The gallery is becoming a habit — a good one.',
        'Return, and the swamp returns. I approve of the symmetry.'
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
  'gilded-meridian': 'The Curator gilded a single horizon and it glows still — every drop that crosses it leaves a little more of itself behind. A gold-tier work; earned only in the second expedition.',
  'verdant-crown': 'A crown woven from the moss that mends, worn by no frog and gifted to all of them. It heals the hand that reaches for it. A gold-tier work; earned only in the second expedition.',
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
    chip: 'Paint the beetle with RED — watch it catch fire and burn away', done: 'The beetle burned away — red is your fire pigment.' },
  { phase: 'learn', pigment: 'blue',  enemy: 'mosquito', drill: 'freeze',
    chip: 'Paint the mosquito with BLUE — freeze it solid in mid-air', done: 'Frozen solid — blue freezes flies on the spot.' },
  { phase: 'learn', pigment: 'green', enemy: 'toad',     drill: 'root',
    chip: 'Paint the toad with GREEN — root it in place and mend yourself', done: 'Rooted to the spot — green holds a target still and mends your wounds.' },
  // T2 — the interactive pigment drills: the SAME three effects as an explicit
  // per-pigment "do it" check, a LATER phase of this same guided run. The
  // advancement predicate reads the enemy's REAL status/death (a beetle that
  // actually DIED from burn / a mosquito actually frozen / a toad actually
  // rooted) — not "a brush stroke happened" — and each completion is persisted
  // to save.tutorialDrills so T3/T4 "Watch me" retraining can reference which
  // drills were completed.
  { phase: 'drills', pigment: 'red',   enemy: 'beetle',   drill: 'burn',
    chip: 'Do it: burn a beetle with RED until it dies — prove the fire', done: 'Bolt drilled ✓ — the beetle died from your red burn.' },
  { phase: 'drills', pigment: 'blue',  enemy: 'mosquito', drill: 'freeze',
    chip: 'Do it: freeze a mosquito with BLUE until it stops — prove the ice', done: 'Frozen drilled ✓ — the mosquito is locked solid.' },
  { phase: 'drills', pigment: 'green', enemy: 'toad',     drill: 'root',
    chip: 'Do it: root a toad with GREEN until it stops — prove the grip', done: 'Rooted drilled ✓ — the toad is nailed to the spot.' },
  // T3 — the final teaching beat: a low-HP "sketch" heron. It reuses the real
  // heron's bossStep + 3-hue awaken machinery at a few-hundred-HP scale so the
  // 30k-HP fight is a "known pattern", not a surprise. One goal — paint all
  // three hues to AWAKEN it (the 3-hue awaken loop). Completing it records
  // save.tutorialDrills.awaken=true; skipping the tutorial leaves it undone.
  { phase: 'sketch', pigment: 'red', drill: 'awaken',
    chip: 'Face the sketch heron — paint RED, BLUE, and GREEN to wake it',
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
    this.tuning = makeTuning(this.save.upgrades, this.save.loadout, this.options.difficulty, this.save.galleryBonus || 0, this.save.owned, isGilded(this.save));
    // B5: persistent storage unavailable (privacy mode, quota, disabled)? We
    // still run on the in-memory save, but surface a one-time warning so the
    // player knows progress may not survive a reload. storageOK forces the
    // store to resolve here so the flag is accurate at construction.
    this._storageOK = SaveSys.storageOK;

    // ---------- systems ----------
    this.input = new Input(canvas);
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
    // R1 (v1.6 Module R): THE LANTERN — the Reeds biome's signature light
    // mechanic. The in-run state object lives here; all the RULES (drain /
    // refill / radius / light factor / the victory gate) are pure in logic.js.
    // `this.lantern` is the current {fuel, lit} state; `this.lanternReeds` is
    // whether THIS expedition is a Reeds variant (the lantern is only active /
    // only drawn / only drained there — a first-time swamp run never touches
    // it, so the 15–20 min cycle-0 run stays byte-identical). The cached light
    // gradient + its radius are lazily built per-radius (never per-frame).
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
    this.endKind = null;
    this.endT = 0;
    this.endGains = null;
    this._modPrompt = null;   // N4 (v1.3 M14): { sel } — the open expedition-modifier picker
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
    // J3 (v1.4): the camera's awaken-moment hold. A heron rising (the Great
    // Green Heron reveal) triggers a ~1.2 s zoom-out + hold on the heron, then
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
    this.runT = 0;
    this.ngCycle = 0;    // N1 (v1.3 M14): this run's New Game+ cycle (0 = base game)
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
    this._firstSight = { turtle: false, cragfrog: false, surge: false, gilded: false };

    // A1: atelier one-liners — reveal state for the typewriter line shown in
    // the atelier. Seeded from the last finished run's outcome on entry.
    this._atelierSay = null;    // { name, text, revealed } or null
    this._atelierSayIdx = {};   // per-character rotation index (not persisted)
    this.lastResult = null;     // 'victory' | 'defeat' | null — last finished run

    // M2 (v1.4): the "Encore" gallery-viewing screen. An overlay OPENED FROM the
    // atelier (it stacks on top of state 'atelier' so the between-run sanctuary
    // keeps breathing underneath). `encoreT` = time in the screen (drives a
    // gentle crossfade-in); `_encoreIdx` = the painting currently on display
    // (a pure in-memory pointer — NO new persistence).
    this._encoreOpen = false;
    this.encoreT = 0;
    this._encoreIdx = 0;

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
      // S1 (v1.4): advance the per-zone melodic theme (a ctx.currentTime
      // lookahead step-sequencer). No-op in headless / before the audio unlock.
      this.audio.tickMusic();
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
      const dxa = Math.abs(ax[GAMEPAD_MAP.axes.x] || 0), dya = Math.abs(ax[GAMEPAD_MAP.axes.y] || 0);
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
    // 1/2/3 would switch atelier tabs, a would open the Atelier from the title).
    const inRun = this.state === 'expedition' && !this.dying && !this.paused && !this.help;
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
  // state (so it tracks options/pause/help/end/atelier/title automatically).
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
  // the current state — options > pause > help > end > atelier > title order
  // of precedence (an open overlay owns the focus).
  _gpMenuList() {
    const g = this;
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
      if (tutorialEligible(g.save)) items.push({ rect: { x: t.tx, y: t.ty, w: t.tw, h: t.th } });
      if (t.ng) items.push({ rect: t.ng });                                     // NG+ / guided slot
      t.diff.forEach((d) => items.push({ rect: d }));                           // difficulty pills
      if (t.chall) items.push({ rect: t.chall });                                // Curator Challenge
      items.push({ rect: { x: t.abx, y: t.aby, w: t.abw, h: t.abh } });          // Atelier
      items.push({ rect: { x: t.ox, y: t.oy, w: t.ow, h: t.oh } });              // Options
      if (t.reeds) items.push({ rect: t.reeds });                                // Beneath the Reeds
      return { id: 'title', list: items.map((i) => i.rect) };
    }
    if (g.state === 'expedition') {
      if (g.help) {
        const h = g._helpGeom();
        const items = [ h.close ];
        if (h.retrain && h.retrain.enabled) h.retrain.buttons.forEach((b) => items.push(b));
        return { id: 'help', list: items };
      }
      if (g.paused) {
        const cx = g.cw / 2, cy = g.ch / 2, pw = 340, px = cx - pw / 2, py0 = cy - 130;
        return { id: 'pause', list: [
          { x: px, y: py0 + 108, w: pw, h: 44 },   // Resume
          { x: px, y: py0 + 160, w: pw, h: 44 },   // Quit to the Pond
        ] };
      }
      return null;   // active in-run: no menu focus (W1 feed is active)
    }
    if (g.state === 'end') {
      const b = g._endButtons();
      const items = [ b.primary ];
      if (b.ng) items.push(b.ng);
      items.push(b.ret);
      return { id: 'end', list: items };
    }
    if (g.state === 'atelier') {
      if (g._encoreOpen) return { id: 'atelier', list: [] };   // Encore owns input
      const rows = g._atelierRows();
      const focus = rows.filter((r) => r.enabled !== false && r.focus !== false);
      return { id: 'atelier', list: focus };
    }
    return null;
  }

  // W2: B backs out one level, per the current state.
  _gpMenuBack() {
    const g = this;
    if (g.state === 'title' && g.optionsOpen) { g._closeOptions(); g.sfx('ui-back'); return; }
    if (g.state === 'expedition' && g.help) { g.help = false; g.sfx('ui-back'); return; }
    if (g.state === 'expedition' && g.paused) { g.paused = false; g.sfx('ui'); return; }   // B resumes
    if (g.state === 'end') { g.sfx('ui-back'); g._quitToTitle(); return; }
    if (g.state === 'atelier') { g.sfx('ui-back'); g._quitToTitle(); return; }
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
    ctx.font = '600 13px Georgia, serif';
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
    // ---- splash charge: hold-to-charge / press-at-full-to-fire ----
    // The REAL mouse contract (verified against the RMB handlers): holding
    // RMB sets rDown and charges; releasing does NOT fire (rPressed is false on
    // the release frame — the game's fire check is `rPressed && charge >= 1`);
    // a PRESS edge while the charge is already full fires + resets it. The feed
    // mirrors that exactly: B held -> rDown (charge accumulates); B released ->
    // drop rDown (no fire); a B press edge -> rPressed (fires iff already full).
    // The feed owns rDown only while the mouse is not physically on RMB (mouse
    // always wins — input.mouse._physR, set on physical RMB down).
    const splashHeld = btn(M.splash);
    const physR = inp.mouse._physR;
    const feedHolds = splashHeld && !physR;
    if (feedHolds && !gp.was.splash) inp.mouse.rPressed = true; // press edge (mouse contract)
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
    const key = { pig1: '1', pig2: '2', pig3: '3', hop: ' ', lantern: 'l' }[tag];
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
    const phys = inp._phys;
    const drop = (k, owned) => { if (owned && !phys.has(k)) inp.keys.delete(k); };
    const m = was.move;
    drop('a', m.a); drop('d', m.d); drop('w', m.w); drop('s', m.s);
    was.move.a = was.move.d = was.move.w = was.move.s = false;
    const bk = { pig1: '1', pig2: '2', pig3: '3', hop: ' ', lantern: 'l' };
    for (const t of ['pig1', 'pig2', 'pig3', 'hop', 'lantern']) if (was[t]) { drop(bk[t], was[t]); was[t] = false; }
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
    const dt = clamp((t - this.last) / 1000, 0, 0.05);
    this.last = t;
    this.now = t / 1000;
    this._pollGamepad();   // W1: feed BEFORE any update reads input (kb/keys/mouse)
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
    this.world.update(simDt);
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
      // N4 (v1.3 M14): the expedition-modifier picker, when open, owns this
      // frame's input (it is an overlay on the end screen). Otherwise the
      // normal end-screen buttons route.
      // M1 (v1.4): the first-victory cinematic beat (a FRESH player's first
      // win) takes precedence — it plays for ~4s and ANY key/click skips it
      // immediately. While it runs the end-screen buttons do NOT route (a skip
      // tap must not immediately open the atelier) and endT keeps advancing so
      // the victory card reveals right after the beat closes. A returning
      // player (beat-seen flag) never has _cine, so they hit the buttons as
      // before.
      if (this._cine) {
        this._cine.t += dt;
        // "any key or click": kb.size > 0 is any just-pressed key; mouse.lPressed
        // is a just-clicked frame.
        const skip = this.input.mouse.lPressed
          || (this.input.kb && this.input.kb.size > 0);
        if (this._cine.t >= this._cine.dur || skip) {
          // M1 (v1.4): the beat just closed — the normal victory card reveals
          // NOW, so this is when the triumphant stinger (deferred from _endRun)
          // plays, marking the "card reveal" moment.
          if (this._cine.firstBeat) {
            if (this.audio.stingerVictory) this.audio.stingerVictory(); else this.sfx('victory');
          }
          this._cine = null;
        }
      } else if (this._modPrompt) {
        this._updateModPrompt();
      } else {
        // buttons: "Rest at the Atelier" (primary) + "Next Expedition" (NG+)
        // + "Return to the Pond" link. The card is taller on a victory (it
        // carries the V4 exhibition), so both the draw and the click rects
        // use _endCardH().
        if (this.endT > 0.6 && this.input.mouse.lPressed) {
          const b = this._endButtons();
          if (this._mouseIn(b.primary.x, b.primary.y, b.primary.w, b.primary.h)) { this.sfx('ui'); this._beginAtelier(); }
          else if (b.ng && this._mouseIn(b.ng.x, b.ng.y, b.ng.w, b.ng.h)) { this._beginNextExpedition(); }
          else if (this._mouseIn(b.ret.x, b.ret.y, b.ret.w, b.ret.h)) { this.sfx('ui-back'); this._quitToTitle(); }
        }
        if (this.endT > 0.6) {
          if (this.input.pressed('enter') || this.input.pressed(' ')) { this.sfx('ui'); this._beginAtelier(); }
          if (this.input.pressed('escape') || this.input.pressed('backspace')) { this.sfx('ui-back'); this._quitToTitle(); }
          if (this.input.pressed('m')) this._muteToggle();
        }
      }
    } else if (this.state === 'atelier') {
      this.atelierT += dt;
      // M2: while the Encore viewing screen is open it owns the atelier's input
      // + the melodic layer; the atelier's own update (tabs/rows/one-liner) is
      // skipped so nothing underneath reacts to the arrows/Esc.
      if (this._encoreOpen) this._updateEncore(dt);
      else this._updateAtelier(dt);
    }

    this._drawAll();
    this.input.endFrame();
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

    // (d) awaken moment — the strongest beat. A heron rising (the Great Green
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
    if (h && h.hp > 0 && !h.flying && h._intro <= 0) {
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

  // N1 (v1.3 M14) / N4 (v1.3 M14): the "Next Expedition" action. Only reachable
  // once a victory has been earned (ngUnlocked). It opens the expedition-MODIFIER
  // picker (N4) — the player chooses one MODIFIERS entry for the coming cycle —
  // and the picker's confirm advances the persisted New Game+ cycle and starts
  // the run. NG+ scaling (N2), the second boss (N3), and the modifier (N4) then
  // key off the run's ngCycle. A first-time save (ngCycle 0, no victory) never
  // sees this path because the button is hidden.
  _beginNextExpedition() {
    if (!ngUnlocked(this.save)) return; // defensive: nothing to escalate yet
    this._openModPrompt();
  }

  // K7 (v1.5 M2): the CURATOR CHALLENGE — a SEEDED daily expedition. Gated
  // behind a completed victory (challengeUnlocked — the same gate NG+ uses via
  // ngUnlocked), so a first-time player never sees the button. The whole world
  // shares ONE challenge per UTC day: the seed is the current UTC day (see
  // challengeDaySeed), and everything else is derived deterministically FROM
  // that seed (never from Math.random):
  //   · seed     = challengeDaySeed()            (Math.floor(Date.now()/86400000))
  //   · loadout  = a SEEDED 2-painting draw from the player's OWNED paintings
  //   · modifier = a SEEDED pick from the MODIFIERS table
  // The expedition runs the SAME world / makeTuning / scoring fields as a normal
  // run (see _beginExpedition's challenge override), but is EXCLUDED from the
  // first-time pacing band (it is its own scored mode). On a victory, _endRun
  // computes the challenge SCORE and files it to the saved top-5 best-score list
  // (challengeFileScore), shown in the atelier's Challenge panel.
  // Sets this.challenge BEFORE calling _beginExpedition, which reads it.
  _beginChallengeExpedition() {
    if (!challengeUnlocked(this.save)) return; // defensive: nothing unlocked yet
    const seed = challengeDaySeed();
    const owned = Array.isArray(this.save.owned) ? this.save.owned : [];
    this.challenge = {
      mode: 'challenge',
      seed,                                  // the shared UTC-day seed
      loadout: challengeDrawLoadout(seed, owned),   // the seeded 2-painting draw
      modifier: challengeDrawModifier(seed),        // the seeded modifier
    };
    this.sfx('ui');
    this._beginExpedition();
  }

  // K7 (v1.5 M2): the single entry point for the challenge's per-run scoring
  // hooks. Guarded to a no-op for a normal run (this.challenge null), so the
  // call sites below are cheap one-liners that never touch a normal run. The
  // `kind` dispatches the counter:
  //   'enemy'  — one regular/mid/surge enemy defeated in time
  //   'orb'    — one pigment orb collected
  //   'bossEngage' — the final heron left its intro (boss clock starts)
  //   'bossDefeat' — the final heron was defeated (boss clock stops; records
  //                  the fight duration as bossTime, clamped to >= 0)
  // 'restored' is derived in _endRun from the revealProgress delta (no per-frame
  // hook needed — it's a single end-of-run read).
  _challengeAdd(kind) {
    const c = this.challenge;
    if (!c || c.mode !== 'challenge') return;
    if (kind === 'enemy') c.enemies += 1;
    else if (kind === 'orb') c.orbs += 1;
    else if (kind === 'bossEngage') { if (c._bossEngage == null) c._bossEngage = this.runT; }
    else if (kind === 'bossDefeat') {
      if (c._bossEngage != null) c.bossTime = Math.max(0, this.runT - c._bossEngage);
    }
  }

  // N4 (v1.3 M14): open the expedition-modifier picker (an overlay on the end
  // screen). The current saved modifier (if any) is pre-selected so a returning
  // player can re-confirm it with a single Enter. The cycle is NOT advanced
  // here — that happens on the picker's confirm (_confirmNextExpedition), so
  // quitting from the prompt leaves the save untouched.
  _openModPrompt() {
    const saved = saveModifier(this.save);
    const i = saved ? (MODIFIER_ORDER.indexOf(saved) + 1) : 0;
    this._modPrompt = { sel: Math.min(Math.max(i, 0), MODIFIER_ORDER.length) };
    this.sfx('ui');
  }

  // N4 (v1.3 M14): advance the NG+ cycle and start the expedition (the picker's
  // confirm, and the direct path once a modifier is chosen). The modifier (if
  // any) was already persisted by _chooseModPrompt on selection.
  _confirmNextExpedition() {
    this._modPrompt = null;
    this.save.ngCycle = (Math.floor(this.save.ngCycle) || 0) + 1;
    SaveSys.save(this.save);
    this.sfx('ui');
    this._beginExpedition();
  }

  // N4 (v1.3 M14): the picker's selection index (0 = no modifier; 1..N = the
  // MODIFIER_ORDER entries).
  _modSelId() {
    const i = this._modPrompt ? this._modPrompt.sel : 0;
    return i <= 0 ? null : MODIFIER_ORDER[i - 1];
  }

  // N4 (v1.3 M14): persist the currently-selected modifier to the save
  // (null when the "no modifier" card is selected). Idempotent.
  _chooseModPrompt() {
    const id = this._modSelId();
    if ((this.save.ngModifier || null) === (id || null)) return;
    this.save.ngModifier = id || null;
    SaveSys.save(this.save);
  }

  // N4 (v1.3 M14): the picker's geometry — 4 cards (No modifier + the 3
  // modifiers) in a centered row, plus a Continue button.
  _modPromptGeom() {
    const cx = this.cw / 2, cy = this.ch / 2;
    const n = MODIFIER_ORDER.length + 1; // +1 for the "no modifier" card
    const cw = 232, gap = 18, ch = 150;
    const totalW = n * cw + (n - 1) * gap;
    const x0 = cx - totalW / 2, y0 = cy - ch / 2 - 14;
    const cards = [];
    for (let i = 0; i < n; i++) cards.push({ x: x0 + i * (cw + gap), y: y0, w: cw, h: ch, id: i <= 0 ? null : MODIFIER_ORDER[i - 1] });
    return { cx, y0, cards, cont: { x: cx - 130, y: y0 + ch + 26, w: 260, h: 50 } };
  }

  // N4 (v1.3 M14): the picker's input — arrow keys / number keys + clicks move
  // the selection (persisting it), Enter/Space/click-Continue advances the cycle
  // and begins the run, Esc reverts to the end screen (cycle untouched).
  _updateModPrompt() {
    if (!this._modPrompt) return;
    const n = MODIFIER_ORDER.length + 1;
    const sel = this._modPrompt.sel;
    if (this.input.pressed('arrowleft') || this.input.pressed('a')) this._modPrompt.sel = (sel + n - 1) % n;
    if (this.input.pressed('arrowright') || this.input.pressed('d')) this._modPrompt.sel = (sel + 1) % n;
    for (let i = 1; i <= n; i++) {
      const k = String(i);
      if (this.input.pressed(k)) this._modPrompt.sel = i - 1;
    }
    // clicks: a card selects it; the Continue button (or clicking the selected
    // card) confirms and begins.
    if (this.input.mouse.lPressed) {
      const g = this._modPromptGeom();
      for (const c of g.cards) {
        if (this._mouseIn(c.x, c.y, c.w, c.h)) {
          this._modPrompt.sel = g.cards.indexOf(c);
          this._chooseModPrompt();
          this.sfx('ui');
        }
      }
      if (this._mouseIn(g.cont.x, g.cont.y, g.cont.w, g.cont.h)) { this._chooseModPrompt(); this._confirmNextExpedition(); return; }
    }
    if (this.input.pressed('enter') || this.input.pressed(' ')) { this._chooseModPrompt(); this._confirmNextExpedition(); return; }
    if (this.input.pressed('escape') || this.input.pressed('backspace')) { this.sfx('ui-back'); this._modPrompt = null; }
    // always persist the current selection so a quit saves the last choice
    this._chooseModPrompt();
  }

  // N4 (v1.3 M14): draw the picker overlay (dim + 4 cards + Continue).
  _drawModPrompt(ctx) {
    if (!this._modPrompt) return;
    ctx.save();
    ctx.fillStyle = 'rgba(20,18,16,0.62)';
    ctx.fillRect(0, 0, this.cw, this.ch);
    const g = this._modPromptGeom();
    const pw = 1000, px = g.cx - pw / 2, py = g.y0 - 64, ph = g.cards[0].y + g.cards[0].h + 26 + 50 + 30;
    const c = paperPanel(ctx, px, py, pw, ph, { seed: 55 });
    outlineText(c, 'Choose your Expedition', g.cx, py + 40, '700 26px Georgia, serif', '#5a9e3d', INK, 4);
    centerText(c, 'each New Game+ cycle wears one condition — pick the season you will swim through (Esc to back out)', g.cx, py + 64, 'italic 13px Georgia, serif', INK, 0.72);
    const sel = this._modPrompt.sel;
    g.cards.forEach((card, i) => {
      const active = i === sel;
      const cc = paperPanel(ctx, card.x, card.y, card.w, card.h, { seed: 60 + i, fill: active ? '#f3ead2' : '#efe8d6' });
      cc.save();
      cc.lineWidth = active ? 4 : 2;
      cc.strokeStyle = active ? '#5a9e3d' : '#b7ab8c';
      cc.beginPath(); cc.roundRect(card.x + 8, card.y + 8, card.w - 16, card.h - 16, 6); cc.stroke();
      cc.restore();
      // number key hint
      centerText(cc, String(i + 1), card.x + 24, card.y + 28, '700 15px Georgia, serif', active ? '#5a9e3d' : INK, 0.8);
      const titleY = card.y + 54;
      centerText(cc, card.id ? MODIFIERS[card.id].name : 'No Modifier', card.x + card.w / 2, titleY, '700 16px Georgia, serif', active ? '#5a9e3d' : INK, 1);
      // description — centered word-wrap within the card (measureText-driven so
      // it never overflows the card regardless of how long the line is).
      const desc = card.id ? MODIFIERS[card.id].desc : 'the plain swamp — no condition this cycle';
      cc.save();
      cc.fillStyle = INK; cc.globalAlpha = 0.68; cc.font = 'italic 11px Georgia, serif';
      cc.textAlign = 'center'; cc.textBaseline = 'middle';
      const maxW = card.w - 30, words = desc.split(' ');
      let line = '', yy = card.y + 80;
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (cc.measureText(test).width > maxW && line) { cc.fillText(line, card.x + card.w / 2, yy); line = w; yy += 14; }
        else line = test;
      }
      if (line) cc.fillText(line, card.x + card.w / 2, yy);
      cc.restore();
      paperEnd(ctx);
    });
    // Continue button
    uiButton(ctx, g.cont.x, g.cont.y, g.cont.w, g.cont.h, 'Swim On', this._mouseIn(g.cont.x, g.cont.y, g.cont.w, g.cont.h), false, { seed: 5, size: 18 });
    // G4 (v1.3 M15): the gold BALANCE READOUT on the Next Expedition prompt —
    // shows the available gold + what it buys, so a returning player knows what
    // they can spend before they dive. PURE read of save.gold (no new mechanics).
    {
      const ro = this._goldReadout();
      centerText(c, `◆ ${ro.text}`, g.cx, g.cont.y + g.cont.h + 20, '700 12.5px Georgia, serif', '#c9922a', 0.95);
    }
    ctx.restore();
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
  // (1) a purchase just made this visit, (2) NG+ context (C1 — a returning
  // expedition, ngCycle >= 1), (3) the last finished run's result, (4) the
  // player's best run, (5) general banter. Each character rotates through
  // their pool without repeating the last line. Pure data read — nothing
  // persisted. (The NG+ pool is a SECOND pool; it falls back to general if a
  // character lacked one, though all three residents have one.)
  _pickAtelierSay() {
    const chars = ATELIER_CHARS;
    const who = chars[Math.floor(Math.random() * chars.length)];
    const best = this.save.bestRun;
    const ng = (Math.floor(this.save.ngCycle) || 0) >= 1;
    const ctx =
      this._lastPurchase ? 'purchase'
      : ng ? 'ng'
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
      // M8 P8 + A3 + K7: five tabs (Upgrades / Paintings / Gallery / Ledger /
      // Challenge); narrow + tight so all five sit on one symmetric row about cx.
      tabY: 148, tabW: 150, tabH: 44, tabGap: 8,
      rowY0: 204, rowH: 104, rowGap: 12,
      cardW: (listW - 24) / 2, cardH: 90, cardGap: 8, cols: 2,  // G2: 10 paintings (2x5) fit above the Depart button
      depart: { x: cx - 150, y: ch - 92, w: 300, h: 54 },
      leave: { x: cx - 370, y: ch - 82, w: 200, h: 34 },
      // M2: the "Encore" viewing-screen entry (right of the Depart button,
      // mirrored off the leave button). Opens the gallery-wall walk-through.
      encore: { x: cx + 170, y: ch - 82, w: 200, h: 34 },
    };
  }

  _atelierRows() {
    // [{x, y, w, h, enabled?, act()}] — the full click map for this frame.
    const g = this._atelierGeom();
    const rows = [];
    {
      // M8 P8 + A3 + K7: five tabs (Upgrades / Paintings / Gallery / Ledger /
      // Challenge), centered on cx. Total span = 5*tabW + 4*tabGap; each tab's
      // left edge steps by (tabW + tabGap). Symmetric about cx by construction.
      const N = 5, span = N * g.tabW + (N - 1) * g.tabGap, x0 = g.cx - span / 2;
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
        const bw = 160, bh = 38, bx = x + g.cardW - bw - 14, by = y + 26;
        const isGold = !!pt.goldTier;
        if (isGold) {
          // G2: gold-tier paintings are NG+-gated, bought with the meta gold
          // currency, and NEVER added to the 2-slot loadout (permanent meta).
          const ngOk = (Math.floor(this.save.ngCycle) || 0) >= 1;
          const enabled = !owned && ngOk && canAffordGold(this.save, pt);
          rows.push({ tag: 'paint:' + pt.id, x: bx, y: by, w: bw, h: bh, enabled, act: () => this._buyGoldPainting(pt.id) });
          return;
        }
        if (owned) rows.push({ tag: 'paint:' + pt.id, x: bx, y: by, w: bw, h: bh, enabled: inLoadout || this.save.loadout.length < 2, act: () => this._toggleLoadout(pt.id) });
                else rows.push({ tag: 'paint:' + pt.id, x: bx, y: by, w: bw, h: bh, enabled: canAfford(this.save.bank, Array.isArray(pt.cost) ? pt.cost : costArray(pt.cost)), act: () => this._buyPainting(pt.id) });
      });
    }
    // A4 (v1.2 M9): the Curator's Ledger (tab 3) offers a 'Rehung Frame'
    // retirement: once the collection is complete (all 8 + one hung), retiring
    // mints a permanent, saved gallery bonus. Repeatable — a counter, not a flag.
    // G3 (v1.3 M15): the ONE-TIME 'Gilded Frame' tier sits in its OWN bar just
    // above the Rehung Frame bar (50g permanent prestige bump, NG+ + gold-gated).
    // Both bars are 560 wide; each button is 150 wide on the RIGHT edge so the
    // click rects line up with the drawn buttons.
    if (this.atelierTab === 3) {
      const eligible = canRetireCollection(this.save);
      const barW = 560, barH = 84, btnW = 150, btnH = 56;
      // Gilded Frame bar: y = ch-248 (sits above the Rehung bar at ch-150).
      const gbx = g.cx - barW / 2, gby = g.ch - 248;
      const canGild = canBuyGildedFrame(this.save);
      rows.push({
        tag: 'gild', x: gbx + barW - btnW - 14, y: gby + (barH - btnH) / 2, w: btnW, h: btnH,
        enabled: canGild, act: () => this._buyGildedFrame(),
      });
      // Rehung Frame bar: y = ch-150 (unchanged from A4).
      const rbx = g.cx - barW / 2, rby = g.ch - 150;
      rows.push({
        tag: 'retire', x: rbx + barW - btnW - 14, y: rby + (barH - btnH) / 2, w: btnW, h: btnH,
        enabled: eligible, act: () => this._retireCollection(),
      });
    }
    rows.push({ tag: 'depart', x: g.depart.x, y: g.depart.y, w: g.depart.w, h: g.depart.h, act: () => { this.sfx('ui'); this._beginExpedition(); } });
        rows.push({ tag: 'leave', x: g.leave.x, y: g.leave.y, w: g.leave.w, h: g.leave.h, act: () => { this.sfx('ui-back'); this._quitToTitle(); } });
        rows.push({ tag: 'encore', x: g.encore.x, y: g.encore.y, w: g.encore.w, h: g.encore.h, act: () => this._openEncore() });
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
    if (this.input.pressed('5')) { if (this.atelierTab !== 4) this.sfx('ui'); this.atelierTab = 4; dismissIntro(); }  // K7 (v1.5 M2): the Challenge panel
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

  // G2 (v1.3 M15): purchase a gold-tier painting with the meta gold currency.
  // NG+-gated (ngCycle >= 1) and gold-denominated. The painting is OWNED but
  // NOT hung into the loadout — it is a permanent meta bonus (applied in
  // makeTuning via save.owned), so a first-time (cycle-0) player never sees it.
  _buyGoldPainting(id) {
    const pt = PAINTINGS.find(p => p.id === id);
    if (!pt || !pt.goldTier || this.save.owned.includes(id)) return;
    if ((Math.floor(this.save.ngCycle) || 0) < 1) { this.sfx('hurt'); return; } // NG+ gate
    if (!canAffordGold(this.save, pt)) { this.sfx('hurt'); return; }
    this.save.gold -= pt.goldCost;
    this.save.owned.push(id);
    // rebuild live tuning so the bonus is active right away + next run
    this.tuning = makeTuning(this.save.upgrades, this.save.loadout, this.options.difficulty, this.save.galleryBonus, this.save.owned, isGilded(this.save));
    this.sfx('awaken');
    this.addBanner(`${pt.name} is hung in gilded glass — its effect is yours forever.`, 4.2, this.ch * 0.34);
    SaveSys.save(this.save);
    this._noteAtelierPurchase();
  }

  // G3 (v1.3 M15): the ONE-TIME 'Gilded Frame' prestige tier — a permanent,
  // saved, 50g purchase (NG+ + gold-gated) that applies a tuning bump ON TOP
  // of the Rehung Frame gallery bonus. All the rules (eligibility, one-time,
  // gold deduction) live in logic.js buyGildedFrame(); this method is a thin
  // game-side wrapper: on success rebuild the live tuning, persist, banner.
  _buyGildedFrame() {
    if (!buyGildedFrame(this.save)) { this.sfx('hurt'); return; }
    this.tuning = makeTuning(this.save.upgrades, this.save.loadout, this.options.difficulty, this.save.galleryBonus, this.save.owned, isGilded(this.save));
    this.sfx('awaken');
    this.addBanner('The Gilded Frame is hung — the gallery blazes with light.', 4.4, this.ch * 0.34);
    this.addBanner(`+${GILDED_FRAME.ink} pigment of each color at every run start · +${Math.round(GILDED_FRAME.orbMult * 100 - 100)}% orb value. Permanent.`, 4.4, this.ch * 0.34 + 34);
    SaveSys.save(this.save);
    this._noteAtelierPurchase();
  }

  // G2 (v1.3 M15): a small gold chip + amount, left-anchored (mirrors _costChips
  // but for the meta gold currency).
  _goldChips(ctx, amount, x, y) {
    const cx0 = x;
    ctx.beginPath();
    ctx.arc(cx0, y, 9, 0, TAU);
    ctx.fillStyle = '#d9a520';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    centerText(ctx, String(amount) + 'g', cx0 + 20, y, '700 14px Georgia, serif', '#8a6d1f', 1);
    return cx0 + 56;
  }

  // G4 (v1.3 M15): the gold BALANCE READOUT — a short, reusable line that shows
  // the available gold + a hint of what it buys. Shown in the atelier header
  // (always) and on the Next Expedition prompt (NG+). PURE presentation (reads
  // save.gold + the GILDED_FRAME constant) — no new mechanics, no new state.
  _goldReadout() {
    const gold = Math.floor(this.save.gold) || 0;
    const ngOk = (Math.floor(this.save.ngCycle) || 0) >= 1;
    const gilded = isGilded(this.save);
    const canGild = ngOk && !gilded && gold >= GILDED_FRAME.cost;
    const hint = gilded
      ? 'the Gilded Frame is hung — it is forever yours'
      : canGild
        ? `spend ${GILDED_FRAME.cost}g in the Curator's Ledger to hang the Gilded Frame (+${GILDED_FRAME.ink} ink · +${Math.round(GILDED_FRAME.orbMult * 100 - 100)}% orb)`
        : ngOk
          ? `earned from boss defeats, first synergies & the 100-orb run — spend it in the Curator's Ledger (${GILDED_FRAME.cost}g = Gilded Frame)`
          : 'a meta pigment — earned from boss defeats, first synergies & the 100-orb run (spent in NG+ only)';
    return { gold, text: `gold ${gold} · ${hint}` };
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
    this.tuning = makeTuning(this.save.upgrades, this.save.loadout, this.options.difficulty, this.save.galleryBonus, this.save.owned, isGilded(this.save));
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
    // G4 (v1.3 M15): the gold BALANCE READOUT — a header line showing the
    // available gold + a hint of what it buys (a pure read of save.gold).
    // Sits between the subtitle and the bank strip; the bank strip moves down
    // a touch (96→104) to make room. No new mechanics.
    {
      const ro = this._goldReadout();
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx - ctx.measureText(ro.text).width / 2 - 46, 93, 6, 0, TAU);
      ctx.fillStyle = '#d9a520'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.restore();
      centerText(ctx, ro.text, cx, 93, '700 12px Georgia, serif', '#c9922a', 0.95);
    }

    // bank strip with loadout preview
    const stripW = 640, stripH = 40, sx = cx - stripW / 2, sy = 104;
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
    // G1 (v1.3 M15): the meta gold — displayed in the bank strip but visually
    // distinct (a gold dot) so players learn it is NOT a pigment. It is
    // META-ONLY: it never feeds combat and is not a 4th paint color.
    const gx = sx + 110 + 3 * 90;
    ctx.beginPath();
    ctx.arc(gx, sy + stripH / 2, 9, 0, TAU);
    ctx.fillStyle = '#d9a520';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    centerText(ctx, String(this.save.gold || 0), gx + 20, sy + stripH / 2, '700 16px Georgia, serif', INK, 1);
    centerText(ctx, 'GOLD', gx - 4, sy + stripH / 2, '600 9px Georgia, serif', INK, 0.6);
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

    // tabs (M8 P8 + A3 + K7: five) — same centered layout as the click map in
    // _atelierRows (span = 5*tabW + 4*tabGap, left edge stepping by tabW+tabGap).
    const tN = 5, tSpan = tN * g.tabW + (tN - 1) * g.tabGap, tX0 = cx - tSpan / 2;
    [['Studio Upgrades', 0], ['Paintings', 1], ['The Gallery', 2], ["Curator's Ledger", 3], ['Challenge', 4]].forEach(([label, idx]) => {
      const active = this.atelierTab === idx;
      const bx = tX0 + idx * (g.tabW + g.tabGap);
      uiButton(ctx, bx, g.tabY, g.tabW, g.tabH, label, this._mouseIn(bx, g.tabY, g.tabW, g.tabH) && !active, active, { seed: 30 + idx, size: 12.5 });
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
    } else if (this.atelierTab === 3) {
      // G4 (v1.3 M15): the gold LEGEND line — a short "what gold is + where it
      // comes from" note, so the meta currency is explained right where it is
      // spent (the Curator's Ledger holds the gold-tier works + the Gilded Frame).
      centerText(ctx, `◆ gold is a meta pigment — earned from boss defeats, first synergies & the 100-orb run, spent here on gold-tier works & the Gilded Frame (NG+ only)`, cx, g.tabY + g.tabH + 18, '700 12.5px Georgia, serif', '#c9922a', 0.95);
    } else if (this.atelierTab === 4) {
      // K7 (v1.5 M2): the Curator Challenge legend — one shared daily challenge,
      // a seeded loadout + modifier, scored and filed to the best-score list.
      centerText(ctx, 'the Curator’s daily challenge — one swamp, one brush, seeded for the whole world. paint it, clear the heron; your score is filed below', cx, g.tabY + g.tabH + 18, 'italic 13px Georgia, serif', '#fdf6e9', 0.78);
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
        const isGold = !!pt.goldTier;
        // NG+ gate: gold-tier paintings are purchasable only on NG+ cycles
        // (ngCycle >= 1). A first-time player (cycle 0) sees them but cannot
        // buy them — and the button reads "NG+ only".
        const ngOk = (Math.floor(this.save.ngCycle) || 0) >= 1;
        const costC = (isGold || Array.isArray(pt.cost)) ? null : costArray(pt.cost);
        const buyable = !owned && !isGold && canAfford(this.save.bank, costC);
        const c = paperPanel(ctx, x, y, g.cardW, g.cardH, { seed: 70 + i, fill: inLoadout ? '#f7f1e2' : (isGold ? '#f7efdc' : PAPER) });
        // art tile (G2: slightly smaller so a 2x5 grid fits the 90px cards)
        const artS = 60, artX = x + 14, artY = y + 15;
        c.fillStyle = pt.art.bg;
        c.beginPath(); c.roundRect(artX, artY, artS, artS, 8); c.fill();
        c.lineWidth = isGold ? 3 : 2.5;
        c.strokeStyle = isGold ? '#b8912e' : INK;
        c.stroke();
        this._drawPaintingMotif(c, pt, artX, artY, artS);
        // text
        const tx = artX + artS + 14;
        const sealed = this._ptLocked(pt);
        this._leftText(c, sealed ? '???' : pt.name, tx, y + 28, '700 15px Georgia, serif', INK, 1);
        c.save();
        c.globalAlpha = sealed ? 0.5 : 0.78;
        c.fillStyle = isGold ? '#8a6d1f' : INK;
        c.font = '12px Georgia, serif';
        c.textBaseline = 'middle';
        c.fillText(sealed ? 'a portrait someone must earn' : pt.desc, tx, y + 50, 300);
        c.restore();
        // cost: pigment chips, or a gold chip for a gold-tier painting
        if (!sealed) {
          if (isGold) this._goldChips(c, pt.goldCost, tx, y + 72);
          else this._costChips(c, pt.cost, tx, y + 72);
        }
        // action button (G2: gold paintings buy with gold + NG+ gate; no loadout slot)
        const bw = 160, bh = 38, bx = x + g.cardW - bw - 14, by = y + 26;
        let label = buyable ? 'Learn' : 'Cannot afford', enabled = buyable;
        if (isGold) {
          if (owned) { label = 'collected'; enabled = false; }
          else if (!ngOk) { label = 'NG+ only'; enabled = false; }
          else { label = `Buy · ${pt.goldCost}g`; enabled = canAffordGold(this.save, pt); }
        } else if (owned) { label = inLoadout ? 'Unhang' : 'Hang'; enabled = inLoadout || this.save.loadout.length < 2; }
        if (sealed) { label = 'Sealed'; enabled = false; }
        uiButton(c, bx, by, bw, bh, label, this._mouseIn(bx, by, bw, bh), false, { seed: 90 + i, size: 13 });
        if (inLoadout) centerText(c, '★', x + g.cardW - 24, y + 20, '700 16px Georgia, serif', '#c9922a', 1);
        paperEnd(ctx);
      });
    } else if (this.atelierTab === 2) {
      // M8 P8 — the Gallery wall: every painting hung in a frame. Owned works
      // are lit (full color + title + passive-bonus caption); works the frog
      // hasn't earned sit in a dimmed, unlabeled frame so the collection reads
      // as a wall of art, not a shop.
      const fw = 190, fh = 150, fgap = 28, cols = 5, rows = 2;  // G2: 10 paintings (5x2) fit the width
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
      // K8 (v1.5 M2): the MASTERPIECE — "The Heron, Waking" — a unique,
      // unbuyable collection piece minted by the first challenge clearing.
      // Shown as a compact GILDED PLAQUE in the band below the 10-painting grid
      // (fits between the collection counter and the Depart button), with the
      // heron motif on the left + a plaque on the right. Pure display (gated
      // by the goldEarned latch); it is NOT a PAINTINGS id, so it never enters
      // the shop/loadout/tuning.
      const mpMinted = isMasterpieceMinted(this.save);
      if (mpMinted) {
        const pw = 460, ph = 92, px = cx - pw / 2, py = gy0 + gridH + 20; // 550..642, fits above the depart button (708)
        const pc = paperPanel(ctx, px, py, pw, ph, { seed: 900, fill: '#fbf3dd' });
        // the gilded plaque frame (double border)
        const fpx = px + 10, fpy = py + 10, fpw = pw - 20, fph = ph - 20;
        pc.save();
        pc.lineWidth = 4; pc.strokeStyle = '#b8912e';
        pc.beginPath(); pc.roundRect(fpx - 3, fpy - 3, fpw + 6, fph + 6, 6); pc.stroke();
        pc.lineWidth = 1.5; pc.strokeStyle = '#8a6d1f';
        pc.beginPath(); pc.roundRect(fpx, fpy, fpw, fph, 4); pc.stroke();
        // the motif (a square on the left, sized to the plaque inner height) + text (right)
        const ms = fph; // square = plaque inner height
        const mtx = fpx + 6, mty = fpy + 6;
        pc.save();
        pc.beginPath(); pc.rect(mtx, mty, ms, ms); pc.clip();
        this._drawMasterpieceMotif(pc, mtx, mty, ms);
        pc.restore();
        pc.lineWidth = 2; pc.strokeStyle = '#8a6d1f';
        pc.strokeRect(mtx, mty, ms, ms);
        // the text
        const tx0 = mtx + ms + 16, txMid = tx0 + (fpw - 12 - ms - 16) / 2;
        pc.fillStyle = '#a3762a'; pc.textAlign = 'center'; pc.textBaseline = 'middle';
        pc.font = '700 15px Georgia, serif';
        pc.fillText(MASTERPIECE.name, txMid, py + ph * 0.32);
        pc.font = 'italic 10.5px Georgia, serif'; pc.globalAlpha = 0.9; pc.fillStyle = INK;
        pc.fillText('MASTERPIECE — framed by the Curator', txMid, py + ph * 0.58);
        pc.globalAlpha = 0.6; pc.font = '10px Georgia, serif';
        pc.fillText('first challenge clearing · unbuyable collection piece', txMid, py + ph * 0.82);
        pc.restore();
        paperEnd(ctx);
        centerText(ctx, `${ownedCount} of ${PAINTINGS.length} paintings + 1 masterpiece in your collection`, cx, py + ph + 14, '700 13px Georgia, serif', '#fdf6e9', 0.85);
      } else {
        centerText(ctx, `${ownedCount} of ${PAINTINGS.length} paintings in your collection`, cx, gy0 + gridH + 16, '700 14px Georgia, serif', '#fdf6e9', 0.85);
      }
    } else if (this.atelierTab === 3) {
      // A3 — the Curator's Ledger: a display-only collection book. Every
      // painting is listed with a short lore blurb and its collected /
      // not-yet state. Reuses the P8 Gallery wall's framed look (paperPanel +
      // the gilded frame + the generative motif) and the same painting data;
      // no buying here — the ledger only reads the collection.
      // G3: 2 cols x 5 rows with a slightly shorter row height so the whole
      // collection fits above the two prestige bars (Gilded Frame + Rehung
      // Frame) at the bottom. Gold-tier paintings get a gilded border + a
      // "GOLD" tag (the ledger lists all 10).
      const fw = 548, fh = 63, fgap = 3, cols = 2, rows = Math.ceil(PAINTINGS.length / cols);
      const gridW = cols * fw + (cols - 1) * fgap, gridH = rows * fh + (rows - 1) * fgap;
      const gx0 = cx - gridW / 2, gy0 = g.rowY0 + 2;
      PAINTINGS.forEach((pt, i) => {
        const col = i % cols, row = (i / cols) | 0;
        const x = gx0 + col * (fw + fgap), y = gy0 + row * (fh + fgap);
        const owned = this.save.owned.includes(pt.id);
        const entry = ledgerEntry(pt);
        const isGold = !!pt.goldTier;
        const c = paperPanel(ctx, x, y, fw, fh, { seed: 300 + i, fill: owned ? '#f9f3e2' : (isGold ? '#f6eed6' : '#efe8d6') });
        // left: a framed thumbnail, gilded when collected OR gold-tier
        // (G2: gold-tier paintings carry a gilded frame EVEN when not owned).
        const fs = fh - 18, fx = x + 12, fy = y + (fh - fs) / 2;
        c.save();
        c.lineWidth = 3.5;
        c.strokeStyle = (owned || isGold) ? '#b8912e' : '#b7ab8c';
        c.beginPath(); c.roundRect(fx - 2, fy - 2, fs + 4, fs + 4, 3); c.stroke();
        c.lineWidth = 1.5;
        c.strokeStyle = (owned || isGold) ? '#8a6d1f' : '#9a9078';
        c.beginPath(); c.roundRect(fx, fy, fs, fs, 2); c.stroke();
        if (owned) {
          c.fillStyle = pt.art.bg;
          c.fillRect(fx, fy, fs, fs);
          this._drawPaintingMotif(c, pt, fx, fy, fs);
        } else {
          c.fillStyle = isGold ? '#efe4c6' : '#e3dac4';
          c.fillRect(fx, fy, fs, fs);
          c.globalAlpha = 0.4;
          c.fillStyle = isGold ? '#8a6d1f' : INK;
          c.font = '700 22px Georgia, serif';
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText('✕', fx + fs / 2, fy + fs / 2);
        }
        c.restore();
        // right: title + GOLD tag (line 1), state tag + lore blurb (line 2)
        const tx = fx + fs + 12, tw = fw - (fs + 24) - 12;
        c.save();
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        // line 1: name + GOLD tag
        c.fillStyle = isGold ? '#8a6d1f' : INK;
        c.font = '700 14.5px Georgia, serif';
        c.globalAlpha = owned ? 1 : 0.78;
        c.fillText(pt.name, tx, y + 24);
        if (isGold) {
          const nameW = c.measureText(pt.name).width;
          c.globalAlpha = owned ? 1 : 0.7;
          c.font = '700 10.5px Georgia, serif';
          c.fillStyle = '#b8912e';
          c.fillText('◆ GOLD', tx + nameW + 8, y + 24);
        }
        // line 2: state tag + a short lore blurb
        const hung = this.save.loadout.includes(pt.id);
        // G4: gold-tier rows carry a distinct STATE — the gold price when not
        // yet owned (the "what it costs" + "you can't buy it yet"), or the
        // owned state when collected/hung.
        let state;
        if (owned) state = hung ? '★ hung in the loadout' : 'collected';
        else state = isGold ? `${pt.goldCost}g · NG+ only` : 'not yet collected';
        c.font = '700 11px Georgia, serif';
        c.fillStyle = owned ? (hung ? '#c9922a' : '#4e8a5a') : (isGold ? '#8a6d1f' : '#9a9078');
        c.globalAlpha = 1;
        c.fillText(state, tx, y + 44);
        const stateW = c.measureText(state).width;
        c.fillStyle = INK;
        c.globalAlpha = owned ? 0.78 : 0.5;
        c.font = 'italic 12px Georgia, serif';
        let loreOut = entry.lore;
        const loreMax = tw - stateW - 12;
        while (c.measureText(loreOut).width > loreMax && loreOut.length > 1) loreOut = loreOut.slice(0, loreOut.length - 1);
        if (loreOut !== entry.lore) loreOut = loreOut.replace(/\s+\S*$/, '') + '…';
        c.fillText(loreOut, tx + stateW + 12, y + 44);
        c.restore();
        paperEnd(ctx);
      });
      const ownCt = PAINTINGS.filter(pt => this.save.owned.includes(pt.id)).length;
      const goldCt = PAINTINGS.filter(pt => pt.goldTier).length;
      centerText(ctx, `the curator's ledger — ${ownCt} of ${PAINTINGS.length} collected · ${goldCt} gold-tier · a display only`, cx, gy0 + gridH + 15, 'italic 12.5px Georgia, serif', '#fdf6e9', 0.7);
      // A4 (v1.2 M9): the 'Rehung Frame' retirement — a permanent, saved
      // gallery bonus minted once the collection is complete. Sits above the
      // Depart button (same geometry as the retire row in _atelierRows).
      // G3 (v1.3 M15): the ONE-TIME 'Gilded Frame' tier — a 50g permanent
      // prestige bar sits just ABOVE the Rehung Frame bar (NG+ + gold-gated),
      // with a state-aware button (price / NG+ gate / owned).
      {
        const gilded = isGilded(this.save);
        const canGild = canBuyGildedFrame(this.save);
        const ngOk = (Math.floor(this.save.ngCycle) || 0) >= 1;
        const bw = 560, bh = 84, bx = cx - bw / 2, by = g.ch - 248;
        const c = paperPanel(ctx, bx, by, bw, bh, { seed: 520, fill: gilded ? '#f4ecd0' : (canGild ? '#f3ead2' : '#efe8d6') });
        c.save();
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        c.fillStyle = '#8a6d1f';
        c.font = '700 15px Georgia, serif';
        c.globalAlpha = 1;
        c.fillText('◆ Gilded Frame', bx + 20, by + 26);
        c.fillStyle = INK;
        c.font = '12.5px Georgia, serif';
        c.globalAlpha = 0.8;
        c.fillText('A one-time gilded tier on top of the Rehung Frame — a permanent, saved tuning bump.', bx + 20, by + 45);
        c.fillText(gilded
          ? `Hung and permanent: +${GILDED_FRAME.ink} start ink · +${Math.round(GILDED_FRAME.orbMult * 100 - 100)}% orb value, every run, forever.`
          : `One-time: +${GILDED_FRAME.ink} start ink of each color · +${Math.round(GILDED_FRAME.orbMult * 100 - 100)}% orb value, forever.`, bx + 20, by + 63);
        c.restore();
        // the gild button on the right (state-aware: owned / affordable / gated)
        const bbw = 150, bbh = 56, bbx = bx + bw - bbw - 14, bby = by + (bh - bbh) / 2;
        uiButton(c, bbx, bby, bbw, bbh, gilded ? 'Gilded' : (ngOk ? `Gild · ${GILDED_FRAME.cost}g` : 'NG+ needed'), canGild, false, { seed: 521 });
        paperEnd(ctx);
      }
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
      // K8 (v1.5 M2): the MASTERPIECE — a ledger entry for "The Heron, Waking",
      // the unique unbuyable collection piece minted by the first challenge
      // clearing. Shown in the bottom free band (below the Gilded/Rehung Frame
      // bars + the atelier buttons) as a thin gilded strip with a small framed
      // motif. Display-only; it is NOT a PAINTINGS id (so the 10-painting grid
      // + retirement threshold are untouched). Gated by the goldEarned latch.
      if (isMasterpieceMinted(this.save)) {
        const mpw = 560, mph = 30, mpX = cx - mpw / 2, mpY = g.ch - 34; // 766..796, below the Rehung bar (ends 750) + the buttons (618..652)
        const mc = paperPanel(ctx, mpX, mpY, mpw, mph, { seed: 940, fill: '#fbf3dd' });
        mc.save();
        // a small gilded motif square on the left
        const ms = mph - 10, mtx = mpX + 8, mty = mpY + 5;
        mc.lineWidth = 2; mc.strokeStyle = '#8a6d1f';
        mc.beginPath(); mc.rect(mtx, mty, ms, ms); mc.clip();
        this._drawMasterpieceMotif(mc, mtx, mty, ms);
        mc.restore();
        mc.lineWidth = 1.5; mc.strokeStyle = '#b8912e';
        mc.strokeRect(mtx, mty, ms, ms);
        mc.save();
        mc.textAlign = 'left'; mc.textBaseline = 'middle';
        mc.fillStyle = '#a3762a'; mc.font = '700 13px Georgia, serif'; mc.globalAlpha = 1;
        mc.fillText(MASTERPIECE.name, mtx + ms + 14, mpY + 11);
        mc.fillStyle = INK; mc.font = '10.5px Georgia, serif'; mc.globalAlpha = 0.72;
        mc.fillText('◆ MASTERPIECE — framed by the Curator (first challenge clearing; unbuyable collection piece)', mtx + ms + 14, mpY + 23);
        mc.restore();
        paperEnd(ctx);
      }
    } else if (this.atelierTab === 4) {
      // K7 (v1.5 M2): the Curator Challenge panel — the NEW atelier tab. It has
      // two parts: (1) a "today's challenge" card showing the SEEDED loadout +
      // modifier + date (what a run this day would draw), and (2) the SAVED
      // best-score file — the top-5 challenges filed by score (each entry is
      // {seed, date, score}), shown in descending order. It is a display-only
      // panel: the challenge itself is started from the title-screen button
      // (K7); this panel just shows today's draw and the filed best scores.
      const seed = challengeDaySeed();
      const owned = Array.isArray(this.save.owned) ? this.save.owned : [];
      const loadout = challengeDrawLoadout(seed, owned);
      const modId = challengeDrawModifier(seed);
      const mod = modId ? MODIFIERS[modId] : null;
      const bw = 760, bh = 150, bx = cx - bw / 2, by = g.rowY0 + 4;
      const c = paperPanel(ctx, bx, by, bw, bh, { seed: 640, fill: '#f7f0df' });
      c.save();
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.fillStyle = '#8a6d1f';
      c.font = '700 18px Georgia, serif';
      c.globalAlpha = 1;
      c.fillText(`The Curator's Challenge — ${challengeDate(seed)}`, bx + 22, by + 30);
      c.fillStyle = INK;
      c.font = '13px Georgia, serif';
      c.globalAlpha = 0.85;
      c.fillText('One shared challenge per day — the same loadout and modifier for the whole world.', bx + 22, by + 52);
      // the seeded loadout + modifier, drawn deterministically from the day seed
      const loTxt = loadout.length
        ? loadout.map(id => { const pt = PAINTINGS.find(p => p.id === id); return pt ? pt.name : id; }).join('  +  ')
        : 'no paintings owned yet — a bare-brush day';
      c.font = '700 14px Georgia, serif';
      c.globalAlpha = 1;
      c.fillStyle = '#4c8a34';
      c.fillText('Brush (loadout):', bx + 22, by + 80);
      c.fillStyle = INK;
      c.fillText(loTxt, bx + 170, by + 80);
      c.font = '700 14px Georgia, serif';
      c.fillStyle = '#4c8a34';
      c.fillText('Condition (modifier):', bx + 22, by + 104);
      c.fillStyle = INK;
      c.globalAlpha = 1;
      c.fillText(mod ? `${mod.name} — ${mod.desc}` : 'clear conditions', bx + 190, by + 104);
      c.font = 'italic 12px Georgia, serif';
      c.fillStyle = INK;
      c.globalAlpha = 0.6;
      c.fillText('score = color restored + enemies cleared in time + orbs gathered + a boss-time bonus. file it to the best list below.', bx + 22, by + 130);
      c.restore();
      paperEnd(ctx);
      // the SAVED best-score file (top 5, descending by score) — already
      // normalized by challengeFileScore at file time + the v9 migration.
      const scores = Array.isArray(this.save.challengeScores) ? this.save.challengeScores : [];
      const fw = 640, fh = 46, fgap = 8;
      const fy0 = by + bh + 18;
      c.save();
      centerText(ctx, `filed challenges — the ${CHALLENGE_TOP_N} best scores (best first)`, cx, fy0 - 12, '700 13px Georgia, serif', '#c9922a', 1);
      c.restore();
      if (scores.length === 0) {
        centerText(ctx, 'no challenges filed yet — clear one from the title screen.', cx, fy0 + 20, 'italic 13px Georgia, serif', '#fdf6e9', 0.6);
      } else {
        scores.forEach((s, i) => {
          const y = fy0 + i * (fh + fgap);
          const rank = i + 1;
          const cc = paperPanel(ctx, cx - fw / 2, y, fw, fh, { seed: 660 + i, fill: rank === 1 ? '#f4ecd0' : '#f6f1e2' });
          cc.save();
          cc.textAlign = 'left'; cc.textBaseline = 'middle';
          const my = y + fh / 2;
          cc.fillStyle = '#8a6d1f';
          cc.font = '700 17px Georgia, serif';
          cc.globalAlpha = 1;
          cc.fillText(rank === 1 ? '①' : rank === 2 ? '②' : rank === 3 ? '③' : String(rank), cx - fw / 2 + 20, my);
          cc.fillStyle = INK;
          cc.font = '700 13px Georgia, serif';
          cc.fillText(s.date, cx - fw / 2 + 60, my);
          cc.font = '12px Georgia, serif';
          cc.globalAlpha = 0.6;
          cc.fillText(`seed ${s.seed}`, cx - fw / 2 + 200, my);
          cc.textAlign = 'right';
          cc.fillStyle = rank === 1 ? '#c9922a' : INK;
          cc.globalAlpha = 1;
          cc.font = '700 19px Georgia, serif';
          cc.fillText(String(s.score), cx + fw / 2 - 22, my);
          cc.textAlign = 'left';
          cc.fillStyle = '#4c8a34';
          cc.font = '700 11px Georgia, serif';
          cc.fillText('pts', cx + fw / 2 - 96, my);
          cc.restore();
          paperEnd(ctx);
        });
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
    // M2: the "Encore" viewing-screen entry (a paper chip, right of Depart).
    const en = g.encore;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#fdf6e9';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(en.x, en.y, en.w, en.h, 17);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    centerText(ctx, 'Encore — the gallery wall', en.x + en.w / 2, en.y + en.h / 2 + 1, '14px Georgia, serif', '#fdf6e9', 0.9);
    centerText(ctx, 'Enter — depart the studio   ·   Esc — return to the pond', cx, d.y + d.h + 16, 'italic 11px Georgia, serif', '#fdf6e9', 0.55);
  }

  // ==================== M2 (v1.4): the "Encore" viewing screen ====================
  // A leisurely, presentation-only screen opened from the Atelier that walks the
  // frog through the GALLERY WALL one large painting at a time — owned works in
  // full color with their title + the Curator's Ledger lore (gold-tier ones in a
  // gold frame), unowned works as shadowed frames with a "not yet" placard. A
  // soft S1-style arpeggio plays at a low level (setEncoreArpeggio). Arrow keys /
  // click move between paintings; Esc returns to the atelier. NO new persistence
  // — `_encoreIdx` is an in-memory pointer. Pure draw-time + input checks.
  // (The screen overlays state 'atelier', so the swamp keeps breathing beneath.)

  _openEncore() {
    // start on the first owned painting (so a returning frog sees art, not a
    // shadow) — or painting 0 if the collection is still empty.
    let startIdx = 0;
    for (let i = 0; i < PAINTINGS.length; i++) {
      if (this.save.owned.includes(PAINTINGS[i].id)) { startIdx = i; break; }
    }
    this._encoreIdx = startIdx;
    this.encoreT = 0;
    this._encoreOpen = true;
    this.sfx('ui');
    if (this.audio && this.audio.setEncoreArpeggio) this.audio.setEncoreArpeggio();
  }

  _closeEncore() {
    if (!this._encoreOpen) return;
    this._encoreOpen = false;
    this.sfx('ui-back');
    // fade the encore arpeggio out (it lives on the melody layer; clearZoneTheme
    // is the "stop the melody layer" entry point and covers it). Idempotent.
    if (this.audio && this.audio.clearZoneTheme) this.audio.clearZoneTheme();
  }

  _encoreStep(d) {
    const n = PAINTINGS.length;
    this._encoreIdx = ((this._encoreIdx + d) % n + n) % n; // wrap
    this.encoreT = 0; // re-trigger the gentle crossfade on each change
    this.sfx('ui');
  }

  _updateEncore(dt) {
    this.encoreT += dt;
    if (this.input.pressed('escape') || this.input.pressed('backspace')) { this._closeEncore(); return; }
    if (this.input.pressed('arrowright') || this.input.pressed('arrowdown')) { this._encoreStep(1); return; }
    if (this.input.pressed('arrowleft') || this.input.pressed('arrowup')) { this._encoreStep(-1); return; }
    // click: right half of the screen = next, left half = previous (Esc is the
    // only click-less exit; there's no close button so a stray click never
    // accidentally leaves — it just browses).
    if (this.input.mouse.lPressed && this.input.mouse.x > 0) {
      if (this.input.mouse.x >= this.cw / 2) this._encoreStep(1);
      else this._encoreStep(-1);
    }
  }

  _drawEncore(ctx) {
    // a near-opaque gallery dim over the breathing atelier (a hair of the world
    // shows through so the screen feels hung IN the studio, not a separate page).
    ctx.save();
    ctx.fillStyle = 'rgba(24,19,16,0.86)';
    ctx.fillRect(0, 0, this.cw, this.ch);
    ctx.restore();

    const cx = this.cw / 2;
    const pt = PAINTINGS[this._encoreIdx];
    const owned = this.save.owned.includes(pt.id);
    const gold = owned && !!pt.goldTier;
    const sealed = this._ptLocked(pt);
    const entry = ledgerEntry(pt);

    // gentle crossfade-in on open + on each navigation (encoreT resets to 0).
    const fade = Math.min(1, this.encoreT / 0.28);
    ctx.save();
    ctx.globalAlpha = fade;

    // header
    outlineText(ctx, 'The Encore', cx, 46, '700 34px Georgia, serif', '#f4ead8', INK, 6);
    centerText(ctx, 'a quiet walk through the gallery wall', cx, 80, 'italic 15px Georgia, serif', '#fdf6e9', 0.8);
    // counter (which painting is on display)
    centerText(ctx, `${this._encoreIdx + 1} / ${PAINTINGS.length}`, cx, 108, '700 15px Georgia, serif', gold ? '#d9a520' : '#fdf6e9', 0.9);

    // the large frame (one at a time). Reuses the P8 gallery-wall frame look:
    // paperPanel + a double border (GILDED for owned gold-tier) + the generative
    // motif — or a dim silhouette for the unowned.
    const S = 380, fx = cx - S / 2, fy = 150;
    const c = paperPanel(ctx, fx - 18, fy - 18, S + 36, S + 36, { seed: 900 + this._encoreIdx, fill: owned ? '#f9f3e2' : '#e9e0cd' });
    c.save();
    c.lineWidth = 6;
    c.strokeStyle = gold ? '#c9922a' : (owned ? '#b8912e' : '#a99e83');
    c.beginPath(); c.roundRect(fx - 4, fy - 4, S + 8, S + 8, 4); c.stroke();
    c.lineWidth = 2;
    c.strokeStyle = gold ? '#8a6d1f' : (owned ? '#8a6d1f' : '#8f856d');
    c.beginPath(); c.roundRect(fx + 2, fy + 2, S - 4, S - 4, 2); c.stroke();
    if (owned) {
      c.fillStyle = pt.art.bg;
      c.fillRect(fx + 4, fy + 4, S - 8, S - 8);
      this._drawPaintingMotif(c, pt, fx + 4, fy + 4, S - 8);
    } else {
      // shadowed frame: a darkened silhouette of a future painting.
      c.fillStyle = sealed ? '#241f18' : '#2e271f';
      c.fillRect(fx + 4, fy + 4, S - 8, S - 8);
      c.globalAlpha = 0.5;
      c.fillStyle = '#c9bfa8';
      c.font = '700 96px Georgia, serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(sealed ? '?' : '✕', cx, fy + S / 2);
    }
    c.restore();

    // placard: title (owned) / "not yet" (unowned) + the Curator's Ledger lore.
    const py = fy + S + 34;
    c.save();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = INK;
    if (owned) {
      c.font = '700 20px Georgia, serif';
      c.globalAlpha = 1;
      c.fillText(pt.name, cx, py);
      if (gold) { c.fillStyle = '#c9922a'; c.font = '700 12px Georgia, serif'; c.fillText('★ gold tier', cx + 150, py); }
    } else {
      c.font = 'italic 18px Georgia, serif';
      c.globalAlpha = 0.7;
      c.fillText(sealed ? 'a sealed portrait — not yet' : 'not yet', cx, py);
    }
    // the lore blurb (Curator's Ledger data) — always shown; it's the story the
    // curator keeps for every painting, earned or not.
    c.fillStyle = INK;
    c.font = 'italic 14px Georgia, serif';
    c.globalAlpha = owned ? 0.9 : 0.6;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(entry.lore, cx, py + 30, S - 48);
    c.restore();

    // navigation arrows (left / right of the frame) — purely visual; the real
    // hit-test is "click left/right half" in _updateEncore.
    ctx.save();
    ctx.globalAlpha = fade * 0.9;
    ctx.fillStyle = '#fdf6e9';
    ctx.font = '700 40px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('‹', cx - S / 2 - 52, fy + S / 2);
    ctx.fillText('›', cx + S / 2 + 52, fy + S / 2);
    ctx.restore();

    // footer hint
    centerText(ctx, '← → / click to browse   ·   Esc — return to the atelier', cx, this.ch - 34, 'italic 12px Georgia, serif', '#fdf6e9', 0.6);
    ctx.restore();
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

  // K8 (v1.5 M2): the MASTERPIECE motif — "The Heron, Waking": a stylized heron
  // lifting off the gray shore into a pale gold dawn. Distinct from the 10
  // shop paintings (which have an `art.shape`) — this is a collection-only
  // piece the Curator frames after the first challenge clearing. Drawn into a
  // rect (x, y, s×s), clipped, and read at the gallery's 162px frame + the
  // ledger's entry. Procedural only (no assets).
  _drawMasterpieceMotif(c, x, y, s) {
    c.save();
    c.beginPath(); c.rect(x, y, s, s); c.clip();
    // the dawn sky (pale gold) over the gray shore
    const sky = c.createLinearGradient(x, y, x, y + s);
    sky.addColorStop(0, '#f7e7b8'); sky.addColorStop(0.62, '#ecd79c'); sky.addColorStop(1, '#8f9a90');
    c.fillStyle = sky; c.fillRect(x, y, s, s);
    // the low sun
    c.beginPath(); c.arc(x + s * 0.5, y + s * 0.42, s * 0.2, 0, TAU);
    c.fillStyle = 'rgba(255, 224, 150, 0.9)'; c.fill();
    // the gray shore / water
    c.fillStyle = '#6f7d74'; c.fillRect(x, y + s * 0.66, s, s * 0.34);
    // ripples
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = Math.max(1, s * 0.012);
    for (let i = 0; i < 3; i++) {
      const ry = y + s * (0.72 + i * 0.08);
      c.beginPath(); c.moveTo(x + s * 0.12, ry); c.lineTo(x + s * 0.88, ry); c.stroke();
    }
    // the heron (a dark silhouette) rising on long legs — the "waking" figure
    c.strokeStyle = '#2c3a33'; c.fillStyle = '#2c3a33';
    c.lineWidth = Math.max(2, s * 0.035); c.lineCap = 'round';
    const hx = x + s * 0.5, hy = y + s * 0.4;
    // neck + body
    c.beginPath();
    c.moveTo(hx - s * 0.12, hy + s * 0.02);
    c.bezierCurveTo(hx + s * 0.02, hy - s * 0.08, hx + s * 0.14, hy - s * 0.06, hx + s * 0.16, hy - s * 0.16);
    c.stroke();
    c.beginPath(); c.ellipse(hx - s * 0.04, hy + s * 0.06, s * 0.14, s * 0.07, -0.3, 0, TAU); c.fill();
    // head + beak
    c.beginPath(); c.arc(hx + s * 0.17, hy - s * 0.17, s * 0.045, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(hx + s * 0.21, hy - s * 0.17); c.lineTo(hx + s * 0.34, hy - s * 0.15); c.stroke();
    // the lifted wings (two arcs above the body)
    c.lineWidth = Math.max(2, s * 0.03);
    c.beginPath(); c.moveTo(hx - s * 0.16, hy + s * 0.04); c.quadraticCurveTo(hx - s * 0.06, hy - s * 0.16, hx + s * 0.10, hy - s * 0.02); c.stroke();
    c.beginPath(); c.moveTo(hx + s * 0.02, hy + s * 0.04); c.quadraticCurveTo(hx + s * 0.14, hy - s * 0.14, hx + s * 0.22, hy - s * 0.04); c.stroke();
    // the long legs trailing down to the water
    c.lineWidth = Math.max(1.5, s * 0.02);
    c.beginPath(); c.moveTo(hx - s * 0.02, hy + s * 0.12); c.lineTo(hx - s * 0.06, hy + s * 0.5); c.stroke();
    c.beginPath(); c.moveTo(hx + s * 0.02, hy + s * 0.12); c.lineTo(hx + s * 0.04, hy + s * 0.48); c.stroke();
    c.restore();
  }

  // ================= part 2: expedition update ===========================
  _updateTitle(dt) {
    // N4 (v1.3 M14): the expedition-modifier picker (opened from the title's
    // "Next Expedition" button) owns input while it is open — intercept BEFORE
    // the title's own Enter/Space/A/O/M/difficulty hotkeys so they don't leak.
    if (this._modPrompt) { this._updateModPrompt(); return; }
    if (this.input.pressed('enter') || this.input.pressed(' ')) {
      this.sfx('ui');
      this._beginExpedition();
      return;
    }
    if (this.input.pressed('a')) { this.sfx('ui'); this._beginAtelier(); return; }
    if (this.input.pressed('o')) { this._openOptions(); return; }  // M8 P9
    if (this.input.pressed('m')) { this._muteToggle(); return; }
    // K7 (v1.5 M2): the 'c' hotkey opens the Curator Challenge — but only when
    // the challenge is actually unlocked (a completed victory). A first-time
    // save (no victory) gets no challenge hotkey, matching the hidden button.
    if (this.input.pressed('c') && challengeUnlocked(this.save)) { this.sfx('ui'); this._beginChallengeExpedition(); return; }
    // R1 (v1.6): the 'r' hotkey opens BENEATH THE REEDS — but only when the Reeds
    // biome is actually unlocked (a completed victory, reedsUnlocked). A
    // first-time save (no victory) gets no Reeds hotkey, matching the hidden
    // button — a cycle-0 player never sees or can enter the biome.
    if (this.input.pressed('r') && reedsUnlocked(this.save)) { this.sfx('ui'); this._beginExpedition(false, { reeds: true }); return; }
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
      // T1 (v1.2 M13): the guided first expedition (fresh save only). A
      // dedicated button so the timed "Begin Expedition" path is untouched.
      if (tutorialEligible(this.save) && this._mouseIn(g.tx, g.ty, g.tw, g.th)) { this.sfx('ui'); this._beginExpedition(true); return; }
      // N1 (v1.3 M14): the "Next Expedition" (New Game+) button — shown only
      // after a victory (g.ng set only when ngUnlocked). It shares the guided
      // slot but that button is fresh-save-only, so the two never coexist.
      if (g.ng && this._mouseIn(g.ng.x, g.ng.y, g.ng.w, g.ng.h)) { this._beginNextExpedition(); return; }
      // K7 (v1.5 M2): the Curator Challenge button (shown only after a victory;
      // g.chall is null otherwise). Starts the seeded, scored daily challenge.
      if (g.chall && this._mouseIn(g.chall.x, g.chall.y, g.chall.w, g.chall.h)) { this.sfx('ui'); this._beginChallengeExpedition(); return; }
      // R1 (v1.6): the "Beneath the Reeds" entry (shown only after a victory;
      // g.reeds is null otherwise). Starts the victory-gated Reeds expedition
      // VARIANT (darker, deeper swamp + THE LANTERN). A first-time save never
      // sees or reaches this button.
      if (g.reeds && this._mouseIn(g.reeds.x, g.reeds.y, g.reeds.w, g.reeds.h)) { this.sfx('ui'); this._beginExpedition(false, { reeds: true }); return; }
      if (this._mouseIn(g.bx, g.by, g.bw, g.bh)) { this.sfx('ui'); this._beginExpedition(); }
      else if (this._mouseIn(g.abx, g.aby, g.abw, g.abh)) { this.sfx('ui'); this._beginAtelier(); }
      else if (this._mouseIn(g.ox, g.oy, g.ow, g.oh)) { this.sfx('ui'); this.optionsOpen = true; }
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
    // R1 (v1.6 Module R): `opts.reeds` marks a BENEATH-THE-REEDS expedition
    // (the victory-gated, darker, deeper-swamp variant). It changes ONLY the
    // world variant (the light economy is populated) and activates THE LANTERN
    // (see this.lanternReeds below) — it never touches the cycle-0 swamp world,
    // so a first-time 15–20 min run stays byte-identical. The title/atelier
    // entry that sets this is itself victory-gated (reedsUnlocked), so a
    // first-time player never reaches this path.
    const _isReeds = !!opts.reeds;
    // K7 (v1.5 M2): the CURATOR CHALLENGE override. A challenge run is started
    // by _beginChallengeExpedition(), which sets this.challenge with a
    // DETERMINISTIC (UTC-day) seed, a seeded random 2-painting loadout (drawn
    // from the player's OWNED paintings), and a seeded random modifier. Those
    // three override the normal fresh-world seed / saved-loadout / NG-modifier
    // below so the whole world shares the SAME daily challenge. A normal run
    // (this.challenge null) keeps its exact existing behavior byte-for-byte.
    const _chal = this.challenge && this.challenge.mode === 'challenge' ? this.challenge : null;
    // fresh world each run (title keeps drifting over whatever is left)
    const seed = _chal ? _chal.seed : ((Math.random() * 2 ** 31) | 0);
    this.runSeed = seed; // E2: weather phases derive deterministically from this
    // N1 (v1.3 M14): the run's New Game+ cycle (0 = the base, first-time game;
    // >= 1 = an NG+ cycle). Read from the save so a "Next Expedition" (which
    // advances save.ngCycle) drives NG+ scaling (N2) and boss selection (N3).
    this.ngCycle = Math.max(0, Math.floor(this.save.ngCycle) || 0);
    // K5 (v1.5 M2): Master's Palette — when this NG+ modifier is active the
    // player STARTS with a synergy duo pre-locked in the 2-slot loadout. This
    // must run BEFORE makeTuning (it changes which paintings the loadout
    // contains, which makeTuning consumes). Cycle-0 never carries a modifier
    // (save.ngModifier is null), so the first-time loadout is byte-identical.
    // K7: a challenge run carries its OWN seeded modifier (not save.ngModifier),
    // applied AFTER the NG+ scaling (see below) — never the masters-palette
    // pre-lock (that is a player-chosen NG+ modifier, not a challenge draw).
    let _modId = (this.ngCycle >= 1 && !_chal) ? saveModifier(this.save) : null;
    let _loadout = this.save.loadout;
    if (_modId === 'masters-palette') {
      const _pl = MODIFIERS[_modId].preLock;
      _loadout = Array.isArray(_pl) && _pl.length ? _pl.slice() : _loadout;
    }
    // K7: the challenge's seeded loadout + modifier OVERRIDE the run setup.
    // _chal.modifier is applied via applyModifier below (challenges always run
    // one, even on a cycle-0 save — the challenge is a scored mode, not NG+).
    if (_chal) { _loadout = _chal.loadout; _chal._modApplied = null; }
    const _chalModId = _chal ? _chal.modifier : null;
    this.world = new World(mulberry32(seed), seed % 99991, { reeds: _isReeds });
    this.lanternReeds = _isReeds;               // R1: activate THE LANTERN (only in the Reeds variant)
    this.tuning = makeTuning(this.save.upgrades, _loadout, this.options.difficulty, this.save.galleryBonus || 0, this.save.owned, isGilded(this.save));
    // N2 (v1.3 M14): NG+ per-cycle scaling — applied ONLY when ngCycle >= 1 so
    // a first-time (cycle 0) run's tuning stays byte-identical to pre-NG+.
    if (this.ngCycle >= 1 && !_chal) applyNGPlus(this.tuning, this.ngCycle);
    // N4 (v1.3 M14): the player-chosen expedition modifier (chosen at the
    // "Next Expedition" prompt) — applied ONLY on NG+ cycles, AFTER the NG+
    // scaling, through the standard tuning path. A cycle-0 run never reaches
    // this (ngCycle < 1), so a first-time run's tuning is byte-identical.
    if (this.ngCycle >= 1 && !_chal) applyModifier(this.tuning, _modId);
    // K7: apply the challenge's seeded modifier (always, regardless of cycle).
    // This is the challenge's fixed daily modifier — distinct from the NG+
    // player-chosen modifier above (a challenge run never carries both).
    if (_chal && _chalModId) applyModifier(this.tuning, _chalModId);
    // N4: High Tide widens the water — hand the render-side multiplier to the
    // fresh per-run world (defaults to 1; a cycle-0 run never carries it).
    this.world.waterWidthMult = this.tuning.waterWidthMult || 1;
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
    this.runGold = Math.max(0, Math.floor(this.save.gold) || 0); // C2 (v1.3 M16): the gold total at run start (delta at the end = "gold earned this expedition"; in-run only, not persisted)
    // N3 (v1.3 M14): on NG+ cycles (ngCycle >= 1) the final boss is the Great
    // GREEN Heron instead of the Great Gray Heron (the gray heron stays the
    // first-time boss). The green heron reuses the same bossStep AI / 3-hue
    // awaken / phase machine end-to-end; it differs only by (a) a distinct green
    // palette and (b) ONE swapped mechanic — painting it with Moss pins it in
    // place briefly (the E1/MidHeron reed-pin idea, at boss scale). It carries
    // slightly MORE fixed HP than the gray heron (30k -> 36k), keeping the fight
    // in the same ~2-3 min time band (the pin is a small extra damage window).
    // K4 (v1.5 M2): NG+ cycle 3+ fights the GILDED HERON INSTEAD of the green
    // heron (cycle 0 = gray, cycles 1-2 = green, cycle 3+ = gilded). Same
    // bossStep/3-hue machinery; distinct gold palette + a heal-absorbing plume.
    const isGildedHeron = this.ngCycle >= GILDED_HERON.minCycle;
    const isGreen = this.ngCycle >= 1 && !isGildedHeron;
    // R4 (v1.6 Module R): in a BENEATH-THE-REEDS expedition the end-of-run boss
    // is THE SILT WYRM (the 4th boss archetype) — a subterranean creature that
    // reuses the EXISTING paintBoss/bossStep awaken latch + the heron defeat/victory
    // path, but with a NEW underground-transit movement pattern (wyrmStep). It
    // occupies the same `this.heron` slot (so the paint routing, the awaken
    // handler, the camera, and _endRun('victory') all reuse the heron machinery).
    // A cycle-0 (swamp) run never enters this branch — its heron is byte-identical.
    if (_isReeds) {
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
    } else {
      this.heron = {
        x: this.world.w - 350, y: HERON_Y,
        hp: isGildedHeron ? GILDED_HERON.hp : (isGreen ? GREEN_HERON.hp : this.tuning.bossMaxHp),
        maxHp: isGildedHeron ? GILDED_HERON.hp : (isGreen ? GREEN_HERON.hp : this.tuning.bossMaxHp),
        kind: isGildedHeron ? GILDED_HERON.kind : (isGreen ? GREEN_HERON.kind : 'gray'), // boss selection (smoke asserts this)
        phase: 1, state: 'idle', stateT: 2.2, hue: { red: 0, blue: 0, green: 0 },
        awakened: false, awakenedT: 0, summonT: 9, lungeDir: -1,
        targetX: this.world.w - 650, diveH: 0, facing: -1,
        flying: 0, _intro: 3.2,
        // N3 green-heron-only fields (the gray heron carries undefined for these,
        // so a first-time run's heron behaves byte-identical to pre-N3):
        green: isGreen ? true : undefined,              // distinct green palette in _drawHeron
        awakenNeed: (isGreen || isGildedHeron) ? { ...GILDED_HERON.awakenNeed } : undefined, // same 3-hue rhythm
        pinned: isGreen ? 0 : undefined,                // the Moss reed-pin timer (green only)
        // K4 gilded-heron-only fields (the gray + green herons carry undefined):
        gilded: isGildedHeron ? true : undefined,       // distinct gold palette in _drawHeron
        plumeT: isGildedHeron ? 0 : undefined,          // the heal-absorbing plume timer (active while >0)
        plumeCd: isGildedHeron ? 0 : undefined,        // the plume cooldown (the heal gap)
      };
    }
    // E1 (v1.2 M10): the Painted Heron — a mid-run "half-heron" set-piece on a
    // zone boundary (end of zone 3) for Normal+. A small re-use of the real
    // heron's bossStep machinery at reduced scale (much lower HP, ~1 hue to
    // awaken, phase escalation capped at 2). NON-blocking: the frog can walk
    // past it (optional), so the 15–20 min pacing target is preserved.
    this.midHeron = midHeronAllowed(this.options.difficulty) ? {
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
    this.runT = 0;
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
    // K7 (v1.5 M2): the CURATOR CHALLENGE per-run score tracking. `this.challenge`
    // is set by _beginChallengeExpedition() (a {mode:'challenge', seed, loadout,
    // modifier, restored0} object) and cleared at the end of the run (in
    // _endRun). A NORMAL run (this.challenge null) keeps every one of these
    // counters inert (the guarded hooks below no-op), so a first-time run is
    // byte-identical in behavior. The counters accumulate ONLY in a challenge:
    //   · enemies  — regular + mid + surge enemies defeated this run
    //   · orbs     — pigment orbs collected this run
    //   · bossTime — the heron fight duration (engage -> defeated), or null
    //   · restored — the color-reveal fraction gained this run (0..1)
    // `this.challenge._modApplied` latches so the modifier is applied once.
    if (_chal) {
      _chal.enemies = 0;
      _chal.orbs = 0;
      _chal.bossTime = null;
      _chal._bossEngage = null;   // set when the heron leaves its intro (engaged)
      // the color-restoration baseline is the REVEAL FRACTION (0..1) at the
      // run's start, so the score's "restored" term is the fraction GAINED this
      // run (end-of-run revealProgress minus this). Stored as a single number
      // (no per-frame allocation) — read once at run start.
      _chal.restored0 = revealProgressOf(this.world.worldColorSat());
    } else {
      this.challenge = null;   // a normal run — ensure no stale challenge state
    }
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
    // K7 (v1.5 M2): a CURATOR CHALLENGE run gets a distinct banner (it is a
    // scored daily mode — same world, seeded loadout + modifier — that files a
    // score to the atelier's challenge panel). A normal run shows nothing here.
    if (_chal) {
      const _mn = MODIFIERS[_chal.modifier] ? MODIFIERS[_chal.modifier].name : _chal.modifier;
      this.addBanner('The Curator\u2019s Challenge — today\u2019s swamp, today\u2019s brush.', 4.6, this.ch * 0.3);
      this.addBanner(`Today: ${_mn}. Paint the swamp, clear the heron — your score is filed at the Atelier.`, 5.2, this.ch * 0.3 + 40);
    }
    // T1 (v1.2 M13): a fresh save may start the guided first expedition. It is
    // a SEPARATE pre-run layer — the timed clock is frozen and the boss deferred
    // for its duration, so it never inflates the 15-20 min expedition timing.
    // Returning players (a finished run OR a skip) never enter it: the title
    // button only appears when tutorialEligible(save) is true, and this guard
    // keeps the guided path out of play even if it is ever called otherwise.
    if (guided && tutorialEligible(this.save)) this._startTutorial();
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
    e.vx = 0; e.vy = 0;
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
    this.tutorial = null;
    this.sketchHeron = null;
    this._sketchDefeated = false;
    // restore the real heron's intro to exactly where it was before the replay.
    // If the boss was already active (intro <= 0) before the replay, keep it
    // deferred — a retrain must never snap the boss awake the moment it ends.
    if (this.heron) {
      const ri = (typeof this._retrainIntro === 'number') ? this._retrainIntro : 999;
      this.heron._intro = ri > 0 ? ri : 999;
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
      return;
    }
    // keep the target in reach (low-stakes: pinned near the starting point)
    const e = t.target;
    if (e && !e.dead && t.targetPos && e.kind) {
      e.x = t.targetPos.x; e.y = t.targetPos.y; e.vx = 0; e.vy = 0; e._now = this.now;
    }
    if (e && tutorialDrillSatisfied(ph.drill, e)) this._tutorialAdvance();
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
    const textMaxW = w - (skip.x - x) - (textX - x) - 12;
    centerText(ctx, ph.chip, textX + textMaxW / 2, y + h / 2, '12px Georgia, serif', INK, 0.88);

    // step counter (e.g. "1/3")
    const total = TUTORIAL_PHASES.length;
    const stepLabel = `step ${t.idx + 1} / ${total}`;
    ctx.globalAlpha = 0.5;
    centerText(ctx, stepLabel, textX + textMaxW / 2, y + 12, '10px Georgia, serif', INK, 0.5);
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
    centerText(ctx, 'SKIP', skip.x + skip.w / 2, skip.y + skip.h / 2 + 4, '700 11px Georgia, serif', hov ? '#fdf6e9' : INK, 1);
    ctx.restore();

    ctx.restore();
  }

  _updateExpedition(dt) {
    this.runT += dt;

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
      this.addBanner(step.text, step.dur, this.ch * 0.42);
    }

    // ----- pause toggle (open only; menu input lives in the frame router) -----
    // While the tutorial runs these are suppressed (Escape skips instead of
    // pausing; the run stays focused on the on-screen goal chip).
    if (!tut) {
      if (this.input.pressed('p')) {
        this.paused = !this.paused;
        this.sfx(this.paused ? 'ui-back' : 'ui');
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
    if (this.input.mouse.rDown && p.splashCharge < 1) {
      p.splashCharge = Math.min(1, p.splashCharge + dt / this.tuning.splashCharge);
      if (p.splashCharge >= 1) { this.sfx('charge-ready'); this._noiseEvent(p.x, p.y); } // K2: a full charge is a noise
    }

    // ----- named expedition zones (P5): banner + staged spawn + rest checkpoint -----
    if (p.alive) {
      while (this._zoneI < ZONES.length && p.x >= this.world.w * ZONES[this._zoneI].x) {
        const z = ZONES[this._zoneI++];
        this._zoneBeat(z);
      }
      // K3 (v1.5 M3): once past the last NAMED zone (into the final stretch —
      // "zone 5"), arm the Storm Surge set-piece. It is a one-shot, seeded beat;
      // _updateSurge drives it (banner + stinger + bounded mosquito burst + rain
      // buff + bonus orb burst on clear). Non-blocking: the frog pushes through.
      if (this._zoneI >= ZONES.length && !this.surge && this.heron && this.heron.x) {
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
    const PIGMENT_KEYS = ['1', '2', '3', '4'];
    for (let i = 0; i < PIGMENT_KEYS.length; i++) {
      if (this.input.pressed(PIGMENT_KEYS[i])) {
        p.pigment = ['red', 'blue', 'green', 'dry'][i];
        this.sfx('ui');
      }
    }

    // K4 (v1.5 M2): derive whether the GILDED Heron's plume is absorbing the
    // frog's heal sources THIS frame, and publish it on the player so BOTH heal
    // sources read the same value — the standing-in-green heal (player.update,
    // next line) and the paint-on-green heal (paint._applyHits, below). It is
    // derived from heron.plumeT (the plume timer advanced in _updateBoss last
    // frame — a 1-frame staleness is negligible on a ~30s cycle). No-op for the
    // gray + green herons (they carry no `plumeT`), so a first-time / cycle-1-2
    // run heals byte-identically.
    p._plumeSuppress = !!(this.heron && this.heron.gilded && !this.heron.flying
      && this.heron._intro <= 0 && this.heron.plumeT > 0);
    p.update(dt, this.input, this.tuning, this.world, this._view());
    // R3 (v1.6): detect the frame a hop STARTS (hopT goes from <=0 to >0) so the
    // bestiary can peel a clinging leech (one hop breaks the cling). Reeds-only
    // effect — a cycle-0 run has no leech to peel.
    this._hopStart = p.hopT > 0 && !this._hopWas;
    this._hopWas = p.hopT > 0;
    // R1 (v1.6): THE LANTERN (Reeds variant only). The L key toggles the paper
    // lantern; the pure lanternTick drains the candle fuel (and auto-snuffs an
    // empty lantern) and refills it at nearby fireflies / lantern-rest spots.
    // Inactive outside the Reeds run (lanternReeds false) so the cycle-0 swamp
    // path is byte-identical. lightFactor (0..1, the R3 bestiary key) is
    // refreshed by _updateLantern for a Reeds run.
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
    this._updateHazards(dt);
    // E2 (v1.2 M10): advance the zone's weather/tide phase (banner, live tuning
    // multiplier, fade-out). Informational — it never blocks or punishes.
    this._updateWeather(dt);
    // K3 (v1.5 M3): drive the Storm Surge set-piece (final stretch). Non-blocking
    // and never feeds runT — a pure side-channel off its own clock.
    this._updateSurge(dt);
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
    if (this.input.mouse.lDown) {
      this.paint.trySwipe(targetList);
      this._noiseEvent(p.x, p.y); // K2: a paint swipe is a noise
      this._bestiarySwipe(p); // R3 (v1.6): leech paint-off + serpent ring-interrupt
      // paint the heron too (only while boss is "live" and player not dying)
      // R4 (v1.6): the Wyrm is PAINTABLE only while surfaced (the breach-strike
      // window) — between surfaces it is underground + INVULNERABLE + untargetable.
      const hPaintable = this.heron && this.heron.hp > 0 && !this.heron.flying && this.heron._intro <= 0
        && !(this.heron.wyrm && this.heron.phase !== 'surfaced');
      if (hPaintable) {
        const res = this.paint.paintBossHit(this.heron, p.pigment, this.tuning.bossPaintHit);
        if (res === 'awaken') {
          this.sfx('awaken');
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
        // N3 (v1.3 M14): the Great Green Heron's swapped mechanic — painting it
        // with MOSS (green) accumulates a reed pin. Once enough Moss is painted,
        // it is HELD IN PLACE (pinned) for ~3s: no attacks, and 2x paint damage
        // (the vulnerable window that rewards green play). Green heron only.
        if (this.heron.green && res && res !== 0 && p.pigment === 'green' && !(this.heron.pinned > 0)) {
          this.heron.pinCharge = (this.heron.pinCharge || 0) + this.tuning.bossPaintHit;
          if (this.heron.pinCharge >= GREEN_HERON.pinNeed) {
            this.heron.pinned = GREEN_HERON.pinDuration;
            this.heron.pinCharge = 0;
            this.sfx('awaken');
            this.addShake(9);
            this.particles.splatter(this.heron.x, this.heron.y - 120, GREEN_HERON.greenHue, 14, 220);
            this.addBanner('Reeds catch the Great Green Heron — it is pinned! Paint while it holds!', 3.0);
          }
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
    if (this.input.mouse.rPressed && p.splashCharge >= 1) {
      this.paint.trySplash(targetList);
      this.addShake(8);
      this._noiseEvent(p.x, p.y); // K2: a splash is a loud noise
      this._bestiarySplash(p); // R3 (v1.6): a BLUE splash BLINDS a nearby wisp
      // splash the heron if it's in the burst
      // R4 (v1.6): the wyrm is splashed only while surfaced (untargetable
      // underground — same rule as the swipe path).
      if (this.heron && this.heron.hp > 0 && !this.heron.flying
        && !(this.heron.wyrm && this.heron.phase !== 'surfaced')) {
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
    // R3 (v1.6): the Reeds bestiary's per-frame touch-up (wisp light refresh +
    // leech cling-on-contact / hop-off). Reeds-only — a cycle-0 run's enemy list
    // has no wisp/serpent/leech, so this is a no-op there (byte-identical).
    if (this.world.reedsVariant) this._bestiaryTick(dt, p);
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
      if (e.dead) { this._onEnemyDead(e); this._challengeAdd('enemy'); this.enemies.splice(i, 1); }
    }

    // ----- T1/T2 (v1.2 M13): advance the tutorial once the REAL effect lands.
    // The target is held by reference (survives the splice above), so its
    // death/status is read live — a brush stroke alone never advances it.
    if (tut && !tut.done && p.alive) this._tutorialTick();

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
    if (this.heron.wyrm) {
      const wyrmArena = p.x > this.world.w - 900;
      if (this.heron._intro > 0) this.heron._intro -= dt;
      if (wyrmArena && this.heron._intro > 0) this.heron._intro = 0;   // lapse on arena entry
      if (this.heron._intro <= 0 && !this._wyrmEngaged) {
        this._wyrmEngaged = true;
        this.sfx('wyrm-rumble');
        if (this.audio.setBossTheme) this.audio.setBossTheme(true);   // the darker boss loop
        this.addBanner('THE SILT WYRM', 3.2, 150);
        this.addBanner('It moves through the mud — strike it at its SURFACE POINTS. Paint red / blue / green to wake it!', 4.6, 195);
        this.zoomTarget = 0.92;
      }
    } else if (this.heron._intro > 0) {
      this.heron._intro -= dt;
      if (this.heron._intro <= 0) {
        this.sfx('boss-growl');
        // S2 (v1.4): crossfade the zone theme into the boss battle loop the
        // moment the FINAL heron engages. The Great Green Heron (NG+) gets its
        // own darker variant (this.heron.green). Presentation/audio only.
        if (this.audio.setBossTheme) this.audio.setBossTheme(!!this.heron.green);
        this.addBanner('THE GREAT GRAY HERON', 3.2, 150);
        this.addBanner('Paint red, blue, and green to wake it — then paint fast while it shimmers!', 4.4, 195);
        // K9 (v1.5 M4): one-shot first-sight callout for the GILDED HERON
        // (NG+ cycle-3+ final boss) — the gray/green herons never fire it.
        if (this.heron.gilded) {
          this._firstSightNote('gilded', 'The GILDED HERON — its gilded plume EATS your green healing. Heal in the 30s gaps between plumes.');
        }
        this.zoomTarget = 0.92;
        // K7 (v1.5 M2): the final heron has engaged — start the challenge's
        // boss clock (the boss-time bonus is the fight duration).
        this._challengeAdd('bossEngage');
      }
    }
    if (this.heron._intro <= 0) (this.heron.wyrm ? this._updateWyrm(dt) : this._updateBoss(dt));

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
      if (!this.save.flags.firstHurt) {
        this.save.flags.firstHurt = true;
        SaveSys.save(this.save);
        this.addBanner('Ouch! Touch hurts — paint enemies first, or space-hop through them', 4.8, this.ch * 0.58);
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
    const nearRest = this._lanternNear(p.x, p.y, this.world.restSpots, LANTERN.restSpotRadius);
    const nearFirefly = this._lanternNear(p.x, p.y, this.world.fireflies, LANTERN.fireflyRadius);
    this.lantern = lanternTick(this.lantern, dt, this.lantern.lit, nearRest, nearFirefly);
    // A successful refill (fuel strictly up while at a source) gives a soft,
    // quiet "wick catching" blip — at most ONCE per source-entry (latched) so it
    // doesn't spam while the frog stands on a spot. The latch clears when the
    // frog leaves the source (fuel stops rising) or the wick tops up.
    const refilling = nearRest || nearFirefly;
    if (refilling && !this._wickLatch) { this._wickLatch = true; this.sfx('wickCatch'); }
    if (!refilling || this.lantern.fuel >= 1) this._wickLatch = false;
    // Refresh the eased render radius (the cached gradient is keyed to it) +
    // the frog's own lightFactor for R3.
    this._lanternEasedR = lanternRadius(this.lantern);
    this.lantern.lightFactor = lightFactor(this.lantern, p.x, p.y, p.x, p.y);
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
    // S1 (v1.4): also (cross)fade the melodic theme to the zone just entered.
    // It lives on melodyMaster (a separate gain) above the ambient bed.
    if (this.audio.setZoneTheme) this.audio.setZoneTheme(this._zoneI);
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

  _spawnWave(dt) {
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    const t = this.runT;
    // N2 (v1.3 M14): divide the spawn interval by the NG+ spawn-rate multiplier
    // (1.0 on cycle 0, so the first-time run is byte-identical). The floor is
    // scaled too, so the bump is felt in the late run (where the base interval
    // is normally pinned at the floor), not just the first ~75s.
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
    // K1 (v1.5 M1): the MUD TURTLE is a zones-3+ creature — a first-time
    // (cycle-0) Normal run must NEVER meet it before zone 3 (Bramble Thicket is
    // _zoneI 2, so the turtle only enters the pool from zone 3 / _zoneI>=3
    // onward). NG+ cycles (ngCycle>=1) may run turtles from the first named
    // zone (a returning player is expected to handle the Living Swamp's new
    // residents). Bounded: it shares the existing spawn cap (no extra list), so
    // the enemy count can never grow unbounded. Turtle is the rarest pick so it
    // doesn't crowd the pool.
    const turtleAllowed = this._zoneI >= 3 || this.ngCycle >= 1;
    if (turtleAllowed && t > 25 && roll > 0.9) kind = 'turtle';
    // K2 (v1.5 M2): the BLIND CRAG FROG is also a zones-3+ creature (same cycle-0
    // rule as the turtle — never before zone 3 on a first-time run; NG+ may run
    // it from the first named zone). Bounded: it shares the same spawn cap. It
    // is the rarest pick, just below the turtle, so it never crowds the pool.
    const cragAllowed = this._zoneI >= 3 || this.ngCycle >= 1;
    if (cragAllowed && t > 30 && roll > 0.86 && roll <= 0.9) kind = 'cragfrog';
    // R3 (v1.6 Module R): the LIGHT-REWRITTEN BESTIARY — three Reeds-only
    // archetypes (wisp / serpent / leech). Reeds-mode ONLY (the victory-gated
    // Reeds variant): a cycle-0 swamp run's _spawnWave never enters this branch,
    // so the first-time run is byte-identical. Each is a RARE pick (the top of a
    // separate roll, so they never crowd the swamp pool) and shares the EXISTING
    // spawn cap (`cap` check above) — no extra list, so the enemy count can never
    // grow unbounded.
    if (this.world.reedsVariant && t > 15) {
      const rr = Math.random();
      if (rr > 0.965) kind = 'wisp';
      else if (rr > 0.935) kind = 'serpent';
      else if (rr > 0.905) kind = 'leech';
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
  _bestiaryTick(dt, p) {
    const L = this.lantern;
    const cx = p.x, cy = p.y;   // the lantern is carried by the frog
    for (const e of this.enemies) {
      if (e.wisp) {
        // R3 (a): the wisp's lightFactor at ITS position (how much light it
        // actually gets) — drives its draw alpha + its lit-homing vs unlit-drift.
        e._light = lightFactor(L, e.x, e.y, cx, cy);
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
        // G1 (v1.3 M15): count this expedition's orbs; the FIRST time a single
        // run reaches 100 collected orbs, pay the orb-milestone gold. The
        // goldEarn latch makes it fire exactly once across a career, so we can
        // call the check every pickup — it is a silent no-op after the first.
        this.runOrbs += 1;
        this._challengeAdd('orb'); // K7 (v1.5 M2): count a challenge orb collected
        if (this.runOrbs === 100) this._awardGold(goldEventOrbs(this.runOrbs), 'A hundred orbs in one expedition — GOLD for the Curator.');
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
            this.addBanner('Pigment collected! Bank it at the Atelier to buy upgrades and paintings', 5.2, this.ch * 0.58);
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
    this.score += e.score;
    this.sfx('enemy-die');
    // J2 (v1.4): a small hit-stop pop on a kill (60–90 ms @ ~0.3×). Gated by
    // options.shake (hitStop is a no-op when shake is OFF).
    this.hitStop(0.08, 0.3);
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
    // S2 (v1.4): the moment of death is a short, soft "faint" blip; the
    // full descending-minor DEFEAT STINGER fires later, from _endRun('defeat'),
    // as the end screen opens — so the two moments stay distinct.
    this.sfx('faint');
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
    // G1 (v1.3 M15): meta gold for a VICTORY's first-time moments — the first
    // kill of the boss type (the gray heron the first time, the green heron on
    // NG+) and the first completion of the active synergy duo. Both are
    // idempotent (goldEarn latches each key once), and both fire BEFORE
    // stats.victories is bumped so the victory bookkeeping stays intact.
    if (victory) {
      // G1 (v1.3 M15): the first kill of this boss type pays meta gold. The
      // heron on a cycle-0 run is gray; an NG+ cycle's heron is green. The
      // goldEarn latch makes each boss type fire exactly once across a career.
      const bossKind = (this.heron && this.heron.green) ? 'green' : 'gray';
      const bossEv = goldEventBoss(bossKind);
      const heronLabel = bossKind === 'green'
        ? 'The Great Green Heron is painted — GOLD settles in your palm.'
        : 'The Great Gray Heron is painted — a sliver of GOLD settles in your palm.';
      if (bossEv) this._awardGold(bossEv, heronLabel);
      // the first completion of the active synergy duo (if any in the loadout)
      const syn = activeSynergy(this.save.loadout);
      const synEv = syn ? goldEventSynergy(syn) : null;
      if (synEv) this._awardGold(synEv, 'A new pairing — the Curator adds GOLD to your ledger.');
    }
    if (victory) {
      this.save.stats.victories += 1;
      this.save.flags.heronDefeated = true;
      // R5 (v1.6 Module R): the BENEATH-THE-REEDS gate. Set on the FIRST swamp
      // victory — the SAME place ngUnlocked's victory is recorded (a victory is
      // a victory). A victory-carrying save (victories >= 1) always has this set
      // after the run that earned it; a first-time save that never won stays
      // false (the entry is hidden, so the first-time run is byte-identical).
      this.save.flags.reedsUnlocked = true;
    }
    else this.save.stats.deaths += 1;
    // K7 (v1.5 M2): file the CURATOR CHALLENGE score. Only a victory files a
    // score (a defeat clears it silently), and only when this run WAS a
    // challenge (this.challenge set by _beginChallengeExpedition). The score is
    // the pure challengeScore (logic.js) of four signals, all gathered from the
    // per-run counters _endRun's challenge hooks maintained:
    //   · restored — the color-restoration fraction GAINED this run (the
    //     revealProgress at end-of-run minus the run's starting baseline)
    //   · enemies  — regular/mid/surge enemies defeated in time
    //   · orbs     — pigment orbs collected
    //   · bossTime — the heron fight duration (the boss-time bonus; faster is
    //                better). `restored` is a single end-of-run read (no
    //                per-frame allocation). The result is persisted to the
    //                saved top-5 best-score list (challengeFileScore) and is
    //                EXCLUDED from the first-time pacing band (this is a
    //                scored mode, not a first-time run).
    if (victory && this.challenge && this.challenge.mode === 'challenge') {
      const _ch = this.challenge;
      const _restoredEnd = this.world ? revealProgressOf(this.world.worldColorSat()) : 0;
      const _restoredGained = Math.max(0, _restoredEnd - (_ch.restored0 != null ? _ch.restored0 : 0));
      const _score = challengeScore({
        restored: _restoredGained,
        enemies: _ch.enemies || 0,
        orbs: _ch.orbs || 0,
        bossTimeSec: _ch.bossTime || 0,
      });
      challengeFileScore(this.save, _ch.seed, _score);
      // K8: the challenge REWARD — first-ever completion mints the Masterpiece
      // ("The Heron, Waking") + 15 gold (latched ONCE via the goldEarn map);
      // subsequent completions pay a small repeatable bonus by rank (top-1 pays
      // more). challengeComplete is the pure source (logic.js): it reads the
      // filed list for the rank, latches the masterpiece, and banks the gold.
      const _reward = challengeComplete(this.save, _ch.seed, _score);
      SaveSys.save(this.save);
      // rank = 1 + how many FILED scores are strictly better (deterministic;
      // ties for the score count as the same rank). Shown on the end card so
      // the player sees where today's run landed in the daily best list.
      const _cs = this.save.challengeScores || [];
      const _rank = 1 + _cs.reduce((n, s) => (s.score > _score ? n + 1 : n), 0);
      this._challengeResult = {
        score: _score, seed: _ch.seed, rank: _rank,
        minted: _reward.minted, gold: _reward.gold,   // K8: the completion reward
      };
      // K8: the completion banner(s) — the masterpiece mint (once) + the rank
      // gold. Shown as banners so the reward is felt the moment the run ends.
      if (_reward.minted) {
        this.addBanner(`The Curator frames a new Masterpiece — "${MASTERPIECE.name}".`, 5.4, this.ch * 0.30);
        this.addBanner('A golden gift for the first clearing: +15 gold.', 4.6, this.ch * 0.30 + 34);
        this.sfx('awaken');
      } else if (_reward.gold > 0) {
        this.addBanner(`A fine day's work — rank ${_rank} gold: +${_reward.gold}.`, 4.2, this.ch * 0.30);
      }
      this.challenge = null; // consumed — the run is over
    }
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
        // M1 (v1.4): a FRESH player's very first victory opens a ~4s SKIPPABLE
        // cinematic beat (letterbox bars, world blooms to full color, a soft
        // arpeggio swell). The seen-flag is latched HERE, BEFORE the save below,
        // so it persists the instant the beat is first shown and every returning
        // player (flag already true) skips straight to the stinger + card. The
        // stinger is deferred to beat-close (the card reveal) via firstBeat.
        // Defeat (and every non-first victory) uses the immediate stinger path.
        let playStingerNow = !victory;
        if (victory) {
          if (!this.save.firstVictoryCinematic) {
            this.save.firstVictoryCinematic = true;
            this._cine = { t: 0, dur: 4, arpeggiated: false };
            this._cine.firstBeat = true;
            if (this.audio && this.audio.cinematicArp) this.audio.cinematicArp();
          } else {
            playStingerNow = true;
          }
        }
        SaveSys.save(this.save);
        this.endGains = gains;
        // S2 (v1.4) + M1 (v1.4): the end-screen stinger (rising major arpeggio
        // on a victory, slow descending minor phrase on a defeat) rides the
        // melody layer (music slider + mute). It plays now on a defeat or a
        // returning player's victory, and is deferred to beat-close on a first
        // victory (the cinematicArp already opened the beat).
        if (playStingerNow) {
          if (victory) { if (this.audio.stingerVictory) this.audio.stingerVictory(); else this.sfx('victory'); }
          else { if (this.audio.stingerDefeat) this.audio.stingerDefeat(); else this.sfx('defeat'); }
        }
        // V3: fade out the per-zone ambient bed — the run's place has ended;
        // the atelier keeps the base music bed (startMusic) but not a zone.
        if (this.audio && this.audio.clearZoneAmbient) this.audio.clearZoneAmbient();
        // S1 (v1.4): the melodic theme ends with the run's place too.
        if (this.audio && this.audio.clearZoneTheme) this.audio.clearZoneTheme();
  }

  // ================= part 3: boss ========================================
  _updateBoss(dt) {
    const h = this.heron;
    const p = this.player;
    // NOTE: let bossStep run even at hp<=0 — it emits the 'defeated' event
    if (!h || h.flying > 0 || this.dying) return;
    const v = this._view();
    // K4 (v1.5 M2): the GILDED Heron's heal-absorbing plume — a boss-side phase
    // timer (NOT a hold, unlike the green heron's pin). gildedPlumeTick (pure,
    // logic.js) drives the ~30s active/cooldown cycle; on the frame the plume
    // IGNITES it announces (the plumage glows) and the frog's green heal
    // sources are suppressed until it fades. The gray + green herons never
    // carry `plumeT` (undefined) so this is a no-op for them.
    if (h.gilded) {
      const plumeRes = gildedPlumeTick(h, dt);
      if (plumeRes === 'plume-on') {
        this.addBanner('The gilded plumage BLAZES — your healing is devoured!', 3.0, 232);
        this.sfx('boss-growl');
      } else if (plumeRes === 'plume-off') {
        this.addBanner('The plumage dims — the swamp heals again.', 2.4, 232);
      }
    }
    // N3 (v1.3 M14): the Great Green Heron's reed pin. While pinned (h.pinned>0)
    // the heron is HELD IN PLACE — no bossStep attacks / no movement — and the
    // player gets a 2x paint-damage window (rewarding green play). greenHeronPinTick
    // (pure, logic.js) decays the hold; on the frame it releases we show a beat.
    // The gray heron never carries `pinned`, so this is a no-op for it.
    const pinnedNow = h.green && h.pinned > 0;
    if (h.green && h.pinned > 0) {
      const pinRes = greenHeronPinTick(h, dt);
      if (pinRes === 'pin-off') this.addBanner('The reeds release the Great Green Heron…', 2.4, 240);
    }
    if (pinnedNow) {
      // held: no attacks / movement this frame, but the 'defeated' event must
      // still fire if it was painted to death during the vulnerable window.
      if (h.hp <= 0) this._onHeronDefeated();
      return;
    }
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

    // R4 (v1.6 Module R): drive THE SILT WYRM — the 4th boss archetype, the
    // end-of-Reeds boss. It reuses the EXISTING 3-hue awaken machinery (paintBoss
    // fires the identical 'awaken' latch via the shared paint path; h.awakened
    // doubles paint damage in paintBossHit) but runs a NEW movement pattern
    // (underground transit between surface points, via the pure wyrmStep) instead
    // of the heron's flight/lunge. Between surfaces the wyrm is underground +
    // INVULNERABLE + untargetable (paint is gated to the surfaced phase in the
    // attack path) and its body line slithers beneath. Defeat hands off to the
    // SAME _onHeronDefeated -> victory-flight -> _endRun('victory') path, so a
    // Reeds victory is byte-for-byte the heron-defeat bookkeeping (it sets
    // stats.victories + reedsUnlocked, as it should — a victory is a victory).
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
    // K7 (v1.5 M2): stop the challenge's boss clock (records the fight
    // duration as bossTime; a no-op for a normal run).
    this._challengeAdd('bossDefeat');
    this.sfx('awaken');
        this.addShake(16);
        // J2 (v1.4): the big moment — ~0.8 s of slow-mo (~0.35×) + a white
        // flash frame + a shake spike. All gated by options.shake (hitStop /
        // whiteFlash are no-ops when shake is OFF), so this is pure presentation
        // and never changes the measured pacing.
        this.hitStop(0.8, 0.35);
        this.whiteFlash();
        this.addShake(22);
        // N3 (v1.3 M14): the defeat line names whichever heron was painted — the
        // Great Gray Heron on a first-time run, the Great Green Heron on NG+.
        // R4 (v1.6): the Silt Wyrm has its own defeat beat (it is painted into
        // the mud and sinks back under the water line — not a flight).
        if (h.wyrm) {
          this.addBanner('The Silt Wyrm is painted — it sinks back beneath the reeds!', 4, 200);
        } else {
          this.addBanner(h.green ? 'The Great Green Heron blooms and takes flight!' : 'The Great Gray Heron blooms and takes flight!', 4, 200);
        }
        for (const c of ORB_COLORS) this.particles.sparkles(h.x, h.y - 160, PIGMENTS[c].light, 10);
        if (h.wyrm) { h.sinking = 0.001; } else { h.flying = 0.001; }   // hand off to the victory beat
        // story beat: the first heron ever painted summons the swamp's critic
        if (!this.save.flags.croaksworthAsked) {
          this.save.flags.croaksworthAsked = true;
          this.addBanner('Somewhere in the reeds, Sir Croaksworth takes notice…', 3.6, 230);
          SaveSys.save(this.save);
        }
      }

  // G1 (v1.3 M15): award meta gold for a single first-time event. The pure
  // goldEarn (logic.js) is the single source of the amount + the idempotency
  // latch (each event fires exactly once ever). A 0 award is a no-op (no
  // re-save, no banner) so repeat calls / unmet milestones are silent.
  _awardGold(event, label) {
    const amt = goldEarn(this.save, { key: event.key, amount: event.amount });
    if (amt <= 0) return 0;
    this.sfx('pickup');
    this.addBanner(label, 3.4, this.ch * 0.30);
    SaveSys.save(this.save);
    return amt;
  }

  // ---------------- heron rendering (world space) ------------------------
  _drawHeron(ctx, h, now) {
    if (!h) return;
    const dy = h.diveH || 0;               // lift off the ground
    const fy = h.y - dy;                    // feet level
    const flying = h.flying > 0;
    const gray = h.awakened || flying;      // painted body when awake / flying
    // N3 (v1.3 M14): the Great Green Heron's distinct palette — moss green instead
    // of the gray heron's gray-green. The gray heron keeps the original colors
    // byte-identically (h.green is undefined for it).
    // K4 (v1.5 M2): the GILDED Heron's gold palette (h.gilded) — a third, gold
    // tint distinct from both the gray and the green herons (h.gilded/h.green
    // are undefined for the gray heron, so its colors stay byte-identical).
    const bodyCol = h.gilded
      ? (gray ? GILDED_HERON.gildedHue : '#b69a55')  // gold (awake/flying) / muted gilded (asleep)
      : h.green
        ? (gray ? GREEN_HERON.greenHue : '#7a9a6a')  // moss green (awake/flying) / muted moss (asleep)
        : (gray ? '#7d8f96' : '#98a19b');
    // K4: the plume phase — while the GILDED Heron's plume is live (h.plumeT>0)
    // the plumage GLOWS GOLD (the visible tell that the frog's heal is being
    // devoured). Pure presentation (never affects logic); the plume timer is
    // advanced in _updateBoss.
    const plumeGlow = !!(h.gilded && h.plumeT > 0);
    const ink = INK;

    // ground shadow
    ctx.save();
    ctx.globalAlpha = 0.16 * (1 - dy / 320);
    ctx.fillStyle = '#1c2b22';
    ctx.beginPath();
    ctx.ellipse(h.x, h.y + 6, 58 * (1 - dy / 500), 16 * (1 - dy / 500), 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // N3 (v1.3 M14): the Great Green Heron's reed-pin visual — when pinned, moss
    // reeds wrap its feet and a faint pulsing ring shows the vulnerable window.
    // Pure presentation; the gray heron never enters this branch (no `pinned`).
    if (h.green && h.pinned > 0) {
      const pulse = 0.5 + Math.sin(now * 6) * 0.25;
      ctx.save();
      ctx.globalAlpha = 0.55 * pulse + 0.25;
      ctx.strokeStyle = GREEN_HERON.greenHue;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y + 4, 60, 18, 0, 0, TAU);
      ctx.stroke();
      // a few reed strokes around the feet
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        const rx = h.x + i * 20;
        ctx.beginPath();
        ctx.moveTo(rx, h.y + 8);
        ctx.quadraticCurveTo(rx + 6, h.y - 30, rx + 2 + Math.sin(now * 3 + i) * 3, h.y - 58);
        ctx.stroke();
      }
      ctx.restore();
    }

    // K4 (v1.5 M2): the GILDED Heron's plume glow — while the plume is live the
    // plumage BLAZES gold (a soft radial halo + pulsing rim) so the player can
    // see the heal-absorbing phase is active and time healing in the cooldown
    // gap. Pure presentation (reads h.plumeT, set in _updateBoss); the gray +
    // green herons never enter this branch (no `gilded`).
    if (plumeGlow) {
      const pulse = 0.5 + Math.sin(now * 7) * 0.3;
      ctx.save();
      ctx.globalAlpha = 0.28 + 0.22 * pulse;
      const g = ctx.createRadialGradient(h.x, fy - 150, 10, h.x, fy - 150, 150);
      g.addColorStop(0, GILDED_HERON.gildedHueLight);
      g.addColorStop(1, 'rgba(212,175,55,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(h.x, fy - 150, 150, 190, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.6 * pulse + 0.3;
      ctx.strokeStyle = GILDED_HERON.gildedHueLight;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(h.x, fy - 150, 70, 95, 0, 0, TAU);
      ctx.stroke();
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
    ctx.font = '700 26px Georgia, serif';
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
      headX = prev.x + (cur.x - prev.x) * frac;
    } else {
      headX = cur.x;
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
      ctx.font = '600 15px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('THE SILT WYRM', headX, by - 10);
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
    const p = this.player;
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const scale = v.scale;
    // world -> screen (the camera transform maps (world - view.xy) * scale).
    const sx = (p.x - v.x) * scale;
    const sy = (p.y - v.y) * scale;
    // (a) the darkness wash — the deeper-swamp near-black. A flat fill (one
    // rect, no gradient) so it is cheap; the light below carves the visible
    // area out of it.
    ctx.save();
    ctx.fillStyle = 'rgba(6,8,14,0.86)';
    ctx.fillRect(0, 0, cw, ch);
    // (b) the lantern light: the cached sprite scaled to the eased radius.
    // Lit: the eased radius (a full wick reaches the full sprite; a dying wick
    // shrinks toward the floor). Unlit: a SHORT ambient radius (LANTERN.min
    // floor) drawn dimmer — the "short visibility" of an unlit lantern.
    const lit = this.lantern && this.lantern.lit && (this._lanternEasedR || 0) > 0;
    const worldR = lit ? this._lanternEasedR : (LANTERN.minRadius * 0.6);
    const cutR = worldR * scale;
    if (cutR > 1) {
      if (!this._lanternSprite) {
        const d = Math.ceil(LANTERN.lightRadius * 2);
        const sp = document.createElement('canvas');
        sp.width = d; sp.height = d;
        const sc = sp.getContext('2d');
        const R = LANTERN.lightRadius;
        const g = sc.createRadialGradient(R, R, 0, R, R, R);
        // warm paper-lantern core (the lantern's glow) easing to transparent.
        g.addColorStop(0.0, 'rgba(255,216,150,0.95)');
        g.addColorStop(0.3, 'rgba(246,200,126,0.72)');
        g.addColorStop(0.65, 'rgba(150,120,80,0.26)');
        g.addColorStop(1.0, 'rgba(20,20,30,0)');
        sc.fillStyle = g;
        sc.fillRect(0, 0, d, d);
        this._lanternSprite = sp;
      }
      const size = cutR * 2;
      // A low-fuel or unlit light is dimmer (globalAlpha), a full wick bright.
      const bright = lit ? 0.75 + 0.25 * (this.lantern.fuel || 0) : 0.45;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = bright;
      ctx.drawImage(this._lanternSprite, sx - cutR, sy - cutR, size, size);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  _drawAll() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cw, this.ch);
    const v = this._view();
    const sat01 = this.world.worldColorSat();
    // V2 (v1.2 M11): the awaken saturation surge is a RENDER-ONLY boost. The
    // world's paint/bar keep reading worldColorSat() (the single source of
    // truth); this just nudges how saturated the world is drawn for ~1s.
    const drawSatRaw = Math.min(1, sat01 + (this._bloomSurge || 0));
    // N4 (v1.3 M14): Grey Morning desaturates the world — a render-only
    // saturation CAP (tuning.satFloor), active only during the run it was
    // chosen for (expedition). No modifier / not in-run -> no cap -> the
    // first-time (cycle-0) render and every other screen are byte-identical.
    const drawSat = (this.state === 'expedition' && this.tuning && this.tuning.satFloor != null)
      ? Math.min(drawSatRaw, this.tuning.satFloor)
      : drawSatRaw;
    // L3: on the title the living backdrop "breathes" — the world is drawn at a
    // saturation that swells 0.35 <-> 0.55 on an 8 s sine (titleColorSat).
    // DRAW-ONLY modulation of the worldColorSat read (never writes world state),
    // so the color-reveal single-source-of-truth invariant is preserved and the
    // swell only affects the title backdrop (every other screen is untouched).
    const drawSatFinal = (this.state === 'title')
      ? clamp(titleColorSat(this.titleT), 0, 1)
      : drawSat;
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
    this.world.drawProps(ctx, v, drawSatFinal, this.now);
    this.world.drawObstacles(ctx, v, drawSatFinal);
    // R1 (v1.6): the Reeds biome's LIGHT ECONOMY — the drifting fireflies + the
    // static lantern-rest stones (world space, VIEW-CULLED so they never add to
    // the P10 draw budget). No-op for a base (non-Reeds) world, so a first-time
    // run renders exactly as before.
    this.world.drawReedsLights(ctx, v, this.now);
    // R2 (v1.6): the Reeds TRAVERSAL layer — the flooded lower banks (open dark
    // water, slower ground movement) + the inverted-gravity pocket root-ceilings
    // (world space, VIEW-CULLED; no per-frame state). No-op for a base world.
    this.world.drawReedsTraversal(ctx, v, this.now);
    // J1 (v1.4): short-lived wet residue marks sit on the surface, under the
    // active stroke and all entities (draw-only; never affects logic).
    this.paint && this.paint.drawWet(ctx);
    this.paint && this.paint.drawTrails(ctx);
    if (this.state === 'expedition' || this.state === 'end') {
      if (this.heron) (this.heron.wyrm ? this._drawWyrm(ctx, this.heron, this.now) : this._drawHeron(ctx, this.heron, this.now)); // R4: the Silt Wyrm
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
    // K5 (v1.5 M2): Night Expedition — a RENDER-ONLY darkening over the world,
    // drawn in SCREEN space (after the camera transform is restored) so it
    // covers the whole visible frame; the HUD is drawn AFTER it, so the UI
    // stays fully lit/legible. A semi-transparent near-black wash makes the
    // swamp read as "night" without touching any logic/tuning. Active only
    // when the modifier set tuning.nightDarkness (NG+ cycles); a cycle-0 run
    // never carries it (byte-identical render).
    if ((this.state === 'expedition' || this.state === 'end') && this.tuning && this.tuning.nightDarkness) {
      ctx.save();
      ctx.fillStyle = 'rgba(10,14,30,0.34)';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
    // R1 (v1.6): THE REEDS — the biome's dark-water darkness + THE LANTERN's
    // light. A RENDER-ONLY pass in SCREEN space (after the camera transform is
    // restored, before the HUD) so it covers the whole frame and the HUD stays
    // fully lit/legible. It draws:
    //   (a) a deep near-black wash (the flooded, deeper-swamp darkness),
    //   (b) a single CACHED radial-gradient SPRITE (baked ONCE into an offscreen
    //       canvas, keyed to the eased radius) drawn scaled via one drawImage at
    //       the lantern's screen position (additive 'lighter'), plus a short
    //       ambient radius when unlit.
    // The sprite is cached: it is (re)built ONLY when the eased radius moves
    // by >= 4px (this._lanternGradR), never per frame, so a full ~25s wick burn
    // yields a handful of rebuilds, not thousands. No per-pixel work. Active
    // ONLY when lanternReeds (the Reeds variant) — a cycle-0 swamp run never
    // sets it, so its render is byte-identical.
    if ((this.state === 'expedition' || this.state === 'end') && this.lanternReeds && this.player) {
      this._drawReedsLight(ctx, v);
    }
    if (this.state === 'expedition' || this.state === 'end') {
      this._drawOffscreenHeronArrow(ctx, v);
      this._drawOffscreenEnemyArrows(ctx, v);
      this._drawHud(ctx);
    }
    // T1 (v1.2 M13): the on-screen goal chip + SKIP button for the guided first
    // expedition (rendered above the HUD so it reads as the active instruction).
    if (this.state === 'expedition' && this.tutorial && !this.tutorial.done) this._drawTutorialChip(ctx);
    if (this.state === 'title') this._drawTitle(ctx);
    if (this.state === 'title' && this.optionsOpen) this._drawOptions(ctx);
    if (this.state === 'title' && this._modPrompt) this._drawModPrompt(ctx);  // N4
    if (this.state === 'atelier') this._drawAtelier(ctx);
    // M2: the Encore viewing screen overlays the atelier (drawn on top).
    if (this.state === 'atelier' && this._encoreOpen) this._drawEncore(ctx);
    if (this.paused && this.state === 'expedition') this._drawPause(ctx);
    if (this.help && this.state === 'expedition') this._drawHelp(ctx);   // M8 P6
    if (this.state === 'end') this._drawEnd(ctx);
    // banners render last so they sit above every screen (incl. the title,
    // where the erase-save confirm banner appears)
    this._drawZoneTint(ctx);
    this._drawBanners(ctx);
    // W2 (v1.6): the gamepad UI overlays — the title "pad connected" chip + the
    // focus-cursor highlight over the focused menu button. Drawn above the
    // screens so the cursor is visible on the highlighted button.
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

    // J2 (v1.4): the boss-defeat white flash — a brief screen-wide white wash
    // that peaks on the defeat frame and fades over ~0.3s. Pure presentation
    // (gated by options.shake via whiteFlash); drawn last so it washes over
    // the heron's bloom at the moment of the big moment.
    if (this._whiteFlash > 0 && this.state === 'expedition') {
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
      'italic 10px Georgia, serif', INK, 0.75);
    ctx.restore();

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
      const chipW = 78, chipH = 22, cx = this.cw - chipW - 14, cy = 14;
      ctx.save();
      ctx.globalAlpha = ss.active ? 0.95 : 0.7;
      this._paperChip(ctx, cx, cy, chipW, chipH, 6);
      ctx.globalAlpha = 1;
      const label = ss.active ? `streak ×${ss.mult.toFixed(2)}` : `streak ${ss.streak}/${ORB_STREAK.min}`;
      centerText(ctx, label, cx + chipW / 2, cy + chipH / 2 + 1,
        '700 12px Georgia, serif', ss.active ? '#b8741f' : INK, ss.active ? 1 : 0.7);
      ctx.restore();
    }

    // ---- R1 (v1.6): THE LANTERN — the CANDLE FUEL bar (top-right, under the
    // orb streak) + the L-key lit/unlit state. REEDS-VARIANT ONLY (guarded by
    // this.lanternReeds) so a cycle-0 swamp run's HUD is byte-identical. The bar
    // fills with a warm amber (the candle) whose width = the lantern's fuel; the
    // lit state is a tiny lit flame / a grayed-out "out" when unlit. A dim,
    // quiet "L" key hint sits at the right so the player learns the toggle. ----
    if (this.lanternReeds && this.lantern) {
      const chipW = 150, chipH = 24, cx2 = this.cw - chipW - 14, cy2 = 44;
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
        '700 11px Georgia, serif', lit ? '#b8741f' : INK, lit ? 1 : 0.6);
      ctx.restore();
    }

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
      ctx.font = `700 ${Math.round(15 * pop)}px Georgia, serif`;
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
    // T1 (v1.2 M13): the guided first expedition button (shown only to a fresh
    // save — see tutorialEligible). Sits just under the start button and pushes
    // the difficulty + secondary rows down one row ONLY for a fresh save, so a
    // returning player's title keeps its original layout (no dead button).
    const eligible = tutorialEligible(this.save);
    const tw = 260, th = 40, tx = cx - tw / 2, ty = by + bh + 14;
    // N1 (v1.3 M14): the "Next Expedition" (New Game+) button. Shown ONLY when
    // a victory has been earned (ngUnlocked) so a first-time save (ngCycle 0)
    // sees ZERO new UI. It occupies the same slot as the guided button (which
    // only shows to a fresh save) — they never both appear, so the slot is
    // unambiguous. It pushes the difficulty + secondary rows down one row only
    // while visible, mirroring how the guided button already behaves.
    const ngShow = ngUnlocked(this.save);
    const ng = ngShow ? { x: cx - tw / 2, y: ty, w: tw, h: th } : null;
    const slotPush = (eligible || ngShow) ? (ty + th + 12) : (by + bh + 12);
    const dy = slotPush, dH = 30, dW = 88, dGap = 10;
    const dTotal = dW * 3 + dGap * 2, dStartX = cx - dTotal / 2;
    const diff = ['gentle', 'normal', 'bold'].map((id, i) => ({ id, x: dStartX + i * (dW + dGap), y: dy, w: dW, h: dH, label: (DIFFICULTIES[id] || {}).label }));
    // K7 (v1.5 M2): the CURATOR CHALLENGE button. Gated behind a completed
    // victory (challengeUnlocked = same gate as ngUnlocked) so a first-time
    // player never sees it. It shares the difficulty row's Y with the
    // Atelier/Options secondary pair (aby = dy + dH + 12) but sits in a WIDER
    // centered 3-button row (Challenge | Atelier | Options) so it is a
    // distinct, prominent entry — never stacked onto the difficulty pills.
    // When absent (no victory) the Atelier/Options pair keeps its exact
    // original centered geometry (challengeUnlocked false -> rowW 424).
    const challShow = challengeUnlocked(this.save);
    const chw = 150, chh = 44, cgap = 24;
    const rowW = (challShow ? chw + cgap : 0) + 200 + cgap + 200;
    const rowX = cx - rowW / 2;
    const aby2 = dy + dH + 12, abw2 = 200, abh2 = 44;
    const abx2 = rowX, ox2 = rowX + (challShow ? chw + cgap : 0) + 200 + cgap;
    const ow2 = 200, oh2 = abh2;
    const abx = abx2, aby = aby2, abw = abw2, abh = abh2, ox = ox2, ow = ow2, oh = oh2;
    const chall = challShow ? { x: rowX, y: aby2, w: chw, h: chh } : null;
    // R1 (v1.6): the "Beneath the Reeds" entry — the victory-gated new expedition
    // VARIANT. It shares the SAME ngUnlocked-style gate as Next Expedition / the
    // Curator Challenge (reedsUnlocked = at least one victory), so a first-time
    // (cycle-0) save NEVER sees it and the first-time 15–20 min run stays
    // byte-identical. It is a distinct, dimmer entry: a wide button on its own
    // row just under the NG+ button (the NG/guided slot is above; the difficulty
    // row is below it), carrying the "deeper" subtitle. When absent (no victory)
    // the layout is exactly the pre-Reeds geometry (reeds null).
    const reedsShow = reedsUnlocked(this.save);
    const rw2 = 260, rh2 = 36, rx2 = cx - rw2 / 2, ry2 = aby2 + abh2 + 16;
    const reeds = reedsShow ? { x: rx2, y: ry2, w: rw2, h: rh2 } : null;
    // the footer stats sit below the atelier/options row; when the Reeds entry is
    // shown they are pushed down one row so nothing overlaps.
    const fpush = reedsShow ? (rh2 + 16) : 0;
    return { cx, pw, ph, px, py, bx, by, bw, bh, tw, th, tx, ty, diff, abx, aby, abw, abh, ox, oy: aby2, ow, oh, ng, chall, reeds, fpush };
  }
  _setDifficulty(id) {
    if (!DIFFICULTIES[id] || this.options.difficulty === id) return;
    this.options.difficulty = id;
    SaveSys.saveOptions(this.options);
    this.tuning = makeTuning(this.save.upgrades, this.save.loadout, this.options.difficulty, this.save.galleryBonus || 0, this.save.owned, isGilded(this.save));
    this._prevHp = this.tuning.maxHp;
    this.sfx('ui');
  }

  // ---------------- M8 P9: options overlay (volume + accessibility) --------
  // Single source of truth for the options panel geometry so draw and input
  // never drift. Sliders are horizontal bars: value = (handleX - x) / w.
  _optionsLayout() {
    const cx = this.cw / 2, cy = this.ch / 2;
    // C3 (v1.3 M16): the panel grew 380→424 to fit a FOURTH toggle (paper
    // grain) below the vignette; the back button stays anchored to the panel
    // bottom (py + ph - 66), so its rect moves down with the taller panel.
    const pw = 460, ph = 462, px = cx - pw / 2, py = cy - ph / 2;
    const padX = 46;
    const trackX = px + padX, trackW = pw - padX * 2;
    const row = (baseY) => ({ x: trackX, y: baseY, w: trackW, h: 22 });
    const yMusic = py + 112, ySfx = py + 178, yShake = py + 240, yVign = py + 278, yGrain = py + 316;
    // W1 (v1.6 Module W): the "Gamepad: Auto / Off" row sits below the paper
    // grain toggle; the panel grows 424->462 to fit it and the back button
    // (anchored to py + ph - 66) moves down with the taller panel.
    const yGpad = py + 354;
    const back = { x: cx - 90, y: py + ph - 66, w: 180, h: 46 };
    return { cx, cy, pw, ph, px, py, padX, trackX, trackW,
      music: row(yMusic), sfx: row(ySfx),
      shake: { x: trackX, y: yShake, w: trackW, h: 26 },
      vignette: { x: trackX, y: yVign, w: trackW, h: 26 },
      grain: { x: trackX, y: yGrain, w: trackW, h: 26 },
      gpad: { x: trackX, y: yGpad, w: trackW, h: 26 },
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
  // W1: draw the "Gamepad: Auto / Off" row (label + a two-state pill).
  _drawGpad(c, rect, mode) {
    c.save();
    centerText(c, 'Gamepad', rect.x + 12, rect.y + rect.h / 2, '600 15px Georgia, serif', INK, 0.92);
    const pw = 84, ph = 28, pxx = rect.x + rect.w - pw, pyy = rect.y + (rect.h - ph) / 2;
    roundRectPath(c, pxx, pyy, pw, ph, ph / 2);
    c.fillStyle = (mode === 'auto') ? '#7fae6a' : 'rgba(43,35,32,0.28)'; c.fill();
    c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    const on = (mode === 'auto');
    c.beginPath(); c.arc(on ? pxx + pw - ph / 2 : pxx + ph / 2, pyy + ph / 2, ph / 2 - 4, 0, TAU);
    c.fillStyle = PAPER; c.fill(); c.lineWidth = 1.5; c.strokeStyle = INK; c.stroke();
    centerText(c, on ? 'Auto' : 'Off', pxx + pw / 2, pyy + ph / 2 + 1, '700 12px Georgia, serif', INK, 0.85);
    c.restore();
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
      if (this._mouseIn(g.grain.x, g.grain.y, g.grain.w, g.grain.h)) { this._toggleOpt('grain'); return; }
      // W1: the gamepad Auto/Off row toggles the feed mode.
      if (this._mouseIn(g.gpad.x, g.gpad.y, g.gpad.w, g.gpad.h)) { this._setGamepadMode(); return; }
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
    // C3 (v1.3 M16): the paper-grain presentation toggle (default OFF).
    this._drawToggle(c, g.grain, 'Paper grain', this.options.grain);
    // W1 (v1.6 Module W): the "Gamepad: Auto / Off" row. A two-state pill:
    // Auto (engages while a pad is connected + active) vs Off (feed skipped).
    this._drawGpad(c, g.gpad, this.options.gamepad);
    // back
    uiButton(ctx, g.back.x, g.back.y, g.back.w, g.back.h, 'Back', this._mouseIn(g.back.x, g.back.y, g.back.w, g.back.h), false, { seed: 62, size: 16, mouseX: m.x, mouseY: m.y, mouseClicked: false });
    paperEnd(ctx);
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
    ctx.save();
    ctx.fillStyle = 'rgba(30,25,22,0.45)';
    ctx.fillRect(0, 0, this.cw, this.ch);
    ctx.restore();

    // L3: a frog sits idle on a lily pad in the corner — the swamp "breathes"
    // even at rest. Reuses J4's watercolor blob pose (wobbly body + squash) and
    // a slow breathing bob (draw-only; no world/player state). Sits in the
    // lower-left, clear of the centered title panel.
    this._drawIdleFrog(ctx);

    const cx = this.cw / 2;
    const bob = Math.sin(this.now * 1.4) * 4;
    // L3: the title + tagline breathe in first (stagger step 0/1), AND gently
    // "breathe" while shown — a small scale/opacity oscillation (titleBreatheSwell,
    // ~4% over a slow sine) folded into a transform around the title point.
    // Draw-only; the menu rects (hit-testing) are untouched, so input is stable.
    ctx.save();
    ctx.globalAlpha = titleItemAlpha(this._titleShowT, 0);
    const swell = titleBreatheSwell(this.now); // a few % scale oscillation
    ctx.translate(cx, 200);                    // pivot near the title text
    ctx.scale(1 + swell, 1 + swell);
    ctx.translate(-cx, -200);
    outlineText(ctx, 'Frogue Gallery', cx, 190 + bob, '700 72px Georgia, serif', '#f4ead8', INK, 10);
    centerText(ctx, 'a cozy action roguelite about a tiny frog painter', cx, 248 + bob, 'italic 20px Georgia, serif', '#fdf6e9', 0.92);
    ctx.restore();

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
        // L3: the primary actions breathe in as a staggered step (step 1) after the title.
        ctx.save();
        ctx.globalAlpha = titleItemAlpha(this._titleShowT, 1);
        uiButton(ctx, g.bx, g.by, g.bw, g.bh, hasProgress ? 'Continue Expedition' : 'Begin Expedition', this._mouseIn(g.bx, g.by, g.bw, g.bh), false, { seed: 5, size: 20, mouseX: this.input.mouse.x, mouseY: this.input.mouse.y, mouseClicked: false });
        // T1 (v1.2 M13): the guided first expedition — shown only to a fresh
        // save (no finished run, never skipped). Clicking it begins a low-stakes
        // teaching run on the opening zone instead of the timed expedition.
        if (tutorialEligible(this.save)) {
          uiButton(ctx, g.tx, g.ty, g.tw, g.th, 'Guided First Expedition', this._mouseIn(g.tx, g.ty, g.tw, g.th), false, { seed: 55, size: 14, mouseX: this.input.mouse.x, mouseY: this.input.mouse.y, mouseClicked: false });
        }
        // N1 (v1.3 M14): the "Next Expedition" (New Game+) button — shown only
        // after a victory (g.ng set only when ngUnlocked). It shares the guided
        // slot (which is fresh-save-only), so the two never coexist.
        if (g.ng) {
          uiButton(ctx, g.ng.x, g.ng.y, g.ng.w, g.ng.h, 'Next Expedition  (New Game+)', this._mouseIn(g.ng.x, g.ng.y, g.ng.w, g.ng.h), false, { seed: 56, size: 14, mouseX: this.input.mouse.x, mouseY: this.input.mouse.y, mouseClicked: false });
        }
        ctx.restore();
        // M8 P7: difficulty pills (Gentle / Normal / Bold) between the two buttons.
        // L3: staggered step 2.
        ctx.save();
        ctx.globalAlpha = titleItemAlpha(this._titleShowT, 2);
        centerText(ctx, 'difficulty', cx - g.diff[0].x + 34, g.diff[0].y + 20, '11px Georgia, serif', INK, 0.55);
        for (const p of g.diff) {
          const sel = this.options.difficulty === p.id;
          const hov = this._mouseIn(p.x, p.y, p.w, p.h);
          ctx.save();
          // multiply the per-pill emphasis by the group fade-in (step 2).
          ctx.globalAlpha = ctx.globalAlpha * (sel ? 1 : (hov ? 0.92 : 0.78));
          roundRectPath(ctx, p.x, p.y, p.w, p.h, 8);
          ctx.fillStyle = sel ? '#3a5a3f' : (hov ? '#e8dcc4' : '#f2e8d4');
          ctx.fill();
          ctx.lineWidth = sel ? 2.4 : 1.4;
          ctx.strokeStyle = sel ? '#2b4a34' : INK;
          ctx.stroke();
          centerText(ctx, p.label, p.x + p.w / 2, p.y + p.h / 2 + 4, sel ? '700 13px Georgia, serif' : '12px Georgia, serif', sel ? '#fdf6e9' : INK, sel ? 1 : 0.85);
          ctx.restore();
        }
        ctx.restore();
        // atelier button (visual; A / click handled in _updateTitle) + options
        // (O / click handled in _updateTitle). L3: staggered step 3.
        ctx.save();
        ctx.globalAlpha = titleItemAlpha(this._titleShowT, 3);
        // K7 (v1.5 M2): the Curator Challenge button (victory-gated). It is a
        // distinct, prominent entry (a gilded-ink "Curator's pick" frame) shown
        // only when challengeUnlocked — a first-time save never sees it. It
        // carries the day's seed hint so the shared-daily nature reads clearly.
        if (g.chall) {
          const chov = this._mouseIn(g.chall.x, g.chall.y, g.chall.w, g.chall.h);
          uiButton(ctx, g.chall.x, g.chall.y, g.chall.w, g.chall.h, 'Challenge  [C]', chov, false, { seed: 58, size: 15, mouseX: this.input.mouse.x, mouseY: this.input.mouse.y, mouseClicked: false });
          const day = challengeDate(challengeDaySeed(Date.now()));
          centerText(ctx, `today's pick · ${day}`, g.chall.x + g.chall.w / 2, g.chall.y - 8, 'italic 10px Georgia, serif', '#e8c86a', 0.9);
        }
        uiButton(ctx, g.abx, g.aby, g.abw, g.abh, 'Visit the Atelier', this._mouseIn(g.abx, g.aby, g.abw, g.abh), false, { seed: 6, size: 15 });
        uiButton(ctx, g.ox, g.oy, g.ow, g.oh, 'Options', this._mouseIn(g.ox, g.oy, g.ow, g.oh), false, { seed: 7, size: 15 });
        // R1 (v1.6): the "Beneath the Reeds" entry — the victory-gated new
        // expedition VARIANT. Drawn only when g.reeds (a victory has been earned);
        // a first-time save never sees it (byte-identical title). A distinct,
        // dimmer "deeper" entry — the same painting, deeper — carrying the
        // lantern hint. Clicking it (or pressing R) starts the Reeds run.
        if (g.reeds) {
          ctx.save();
          ctx.globalAlpha = 0.92;
          uiButton(ctx, g.reeds.x, g.reeds.y, g.reeds.w, g.reeds.h, 'Beneath the Reeds  [R]', this._mouseIn(g.reeds.x, g.reeds.y, g.reeds.w, g.reeds.h), false, { seed: 59, size: 14, mouseX: this.input.mouse.x, mouseY: this.input.mouse.y, mouseClicked: false });
          centerText(ctx, 'the deeper swamp · carry a lantern', g.reeds.x + g.reeds.w / 2, g.reeds.y + g.reeds.h + 9, 'italic 10px Georgia, serif', 'rgba(253,246,233,0.6)', 0.9);
          ctx.restore();
        }
        ctx.restore();

        // little footer stats (pushed down one row when the Reeds entry shows so
        // nothing overlaps — see _titleLayout's fpush)
        const s = this.save.stats;
        const fpush = g.fpush || 0;
        centerText(ctx, `expeditions ${s.expeditions}   ·   victories ${s.victories}   ·   herons painted ${s.heronsPainted}`, cx, g.aby + g.abh + 18 + fpush, 'italic 13px Georgia, serif', '#fdf6e9', 0.7);
        const br = this.save.bestRun;
        if (br) {
          const what = br.cleared ? `cleared with ${br.pigments} pigment` : `lasted ${br.time}s`;
          centerText(ctx, `best run — ${what}`, cx, g.aby + g.abh + 38 + fpush, '700 14px Georgia, serif', '#e8c86a', 0.95);
        }
        centerText(ctx, 'G/N/B to set difficulty · M to mute · A for the atelier · R for the Reeds · "New Game" = erase save (bottom left)', cx, g.aby + g.abh + (br ? 58 : 38) + fpush, '12px Georgia, serif', '#fdf6e9', 0.5);
        // erase-save link (bottom-left; two-click confirm, see _updateTitle)
        const ex = 16, ey = this.ch - 40;
        const armed = (this.now - (this._eraseArm || -99)) < 3;
        centerText(ctx, armed ? 'click again to erase save data…' : 'erase save data', ex + 120, ey + 14, armed ? '700 12px Georgia, serif' : '11px Georgia, serif', armed ? '#d8543c' : 'rgba(253,246,233,0.45)', armed ? 1 : 0.8);
      }

  // M8 P6: the "?" field guide. A single source of truth for its layout so the
  // click handling (in the frame router) and the draw never drift apart.
  _helpGeom() {
    const cx = this.cw / 2, cw = this.cw;
    const pw = 720, px = cx - pw / 2, py = 150;
    // T4 (v1.2 M13): the "Watch me" retraining band — replay a single pigment
    // drill or the sketch-heron phase ON DEMAND. Shown only when retraining is
    // available for this save (a returning player) AND no guided run is already
    // active. The panel grows a little to make room; a single source of truth
    // for both the draw (_drawHelp) and the click handling (frame router).
    const retrainOn = retrainAllowed(this.save) && !this._tutorialActive();
    // K9 (v1.5 M4): the "Know your quarry" column grew by the four v1.5
    // residents (turtle / crag frog / storm surge / gilded heron) — the panel
    // grows to fit them (single source of truth shared by draw + click).
    // R5 (v1.6 Module R): a Reeds-unlocked save grows the panel further to fit
    // the four BENEATH-THE-REEDS placeholder Field Guide entries (a base save
    // keeps its exact height — no overlap, no growth when locked).
    const reedsGuide = reedsUnlocked(this.save);
    const ph = (retrainOn ? 604 : 560) + (reedsGuide ? 200 : 0);
    const bw = 150, bh = 34, gap = 16, totalW = 4 * bw + 3 * gap;
    const bx0 = cx - totalW / 2, by = py + ph - 92;
    const phases = [3, 4, 5, 6]; // burn / freeze / root drills, then the sketch heron
    const labels = ['Burn drill', 'Freeze drill', 'Root drill', 'Sketch heron'];
    const buttons = phases.map((phase, i) => ({
      phase, label: labels[i], x: bx0 + i * (bw + gap), y: by, w: bw, h: bh,
    }));
    return { cx, pw, ph, px, py,
      close: { x: px + pw - 120, y: py + 18, w: 100, h: 40 },
      retrain: { enabled: retrainOn, titleY: by - 18, buttons } };
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
      ['1', PIGMENTS.red.color, 'Crimson', 'BIG damage + burn (damage over time, ignores armor); your main weapon'],
      ['2', PIGMENTS.blue.color, 'Cobalt', 'medium damage + FREEZE: flies freeze solid on the spot, ground enemies slow then freeze'],
      ['3', PIGMENTS.green.color, 'Moss', 'light damage but HEALS the frog + restores color; roots ground enemies (flies are immune)'],
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
    this._wrapHelp(c, 'Hold left mouse to paint, aim with the cursor. Hold right mouse to charge a Splash burst, release to fire. A dry brush (no pigment) deals light damage, but it CLEANS enemy status and restores the swamp\u2019s color the fastest — it never runs out.', colL, y0 + 34 + 3 * 58 + 6, colW, 14);

    // ---- right column: counterplay + the heron ----
    c.save(); c.font = '700 16px Georgia, serif'; c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('Know your quarry', colR, y0); c.restore();
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
      c.font = '700 14px Georgia, serif'; c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(r[0], colR, y);
      c.font = '13px Georgia, serif'; c.fillStyle = 'rgba(43,35,32,0.8)';
      this._wrapHelp(c, r[1], colR, y + 15, colW, 13);
    });
    const hy = y0 + 34 + foes.length * 48 + 12;
    // K9 (v1.5 M4): the boss line adapts to the NG+ heron the player now faces.
    const bossName = this.heron && this.heron.gilded ? 'The Gilded Heron (NG+)' : 'The Great Gray Heron';
    c.font = '700 15px Georgia, serif'; c.fillStyle = this.heron && this.heron.gilded ? GILDED_HERON.gildedHue : '#8d7bb0'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(bossName, colR, hy);
    c.font = '13px Georgia, serif'; c.fillStyle = 'rgba(43,35,32,0.85)';
    this._wrapHelp(c, 'Watch the telegraph (a glow before it strikes). Move off the marked line when it swoops, sweeps, or dives. It gathers reinforcements and grows fiercer the lower its health falls — keep painting to keep it stunned.', colR, hy + 16, colW, 14);
    if (this.heron && this.heron.gilded) {
      this._wrapHelp(c, 'NEW: its gilded plume EATS your green healing — heal in the 30s gaps between plumes.', colR, hy + 44, colW, 14);
    }

    // R5 (v1.6 Module R): the BENEATH-THE-REEDS placeholder Field Guide cards.
    // Shown only when the biome is unlocked (reedsUnlocked — a first-time save
    // never sees them, so the cycle-0 guide is byte-identical). The creatures
    // land in R3/R4; these placeholder entries may reference them by name and
    // MUST render even before the creatures exist (pure display data from
    // REEDS_CREATURES in logic.js). A new column heading + one card per
    // creature, drawn with the same wrap helpers as the v1.5 entries.
    const reedsGuide = reedsUnlocked(this.save);
    if (reedsGuide) {
      const rgY = y0 + 34 + foes.length * 48 + 12 + 60 + 40;
      c.save(); c.font = '700 16px Georgia, serif'; c.fillStyle = '#b08a4a'; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText('Beneath the Reeds', colR, rgY);
      c.font = 'italic 11px Georgia, serif'; c.fillStyle = 'rgba(43,35,32,0.7)';
      this._wrapHelp(c, 'the deeper swamp — carry your lantern (L). Its light draws these creatures.', colR, rgY + 15, colW, 12);
      c.restore();
      REEDS_CREATURES.forEach((r, i) => {
        const y = rgY + 40 + i * 30;
        c.font = '700 13px Georgia, serif'; c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText(r.name, colR, y);
        c.font = '12px Georgia, serif'; c.fillStyle = 'rgba(43,35,32,0.8)';
        this._wrapHelp(c, r.note, colR, y + 13, colW, 12);
      });
    }

    // footer
    centerText(c, 'WASD / arrows to move  ·  Space to hop (brief invulnerability)  ·  P to pause  ·  M to mute', g.cx, g.py + g.ph - 22, 'italic 13px Georgia, serif', INK, 0.6);
    // T4 (v1.2 M13): the "Watch me" retraining band — replay a single pigment
    // drill or the sketch-heron phase on demand (opt-in; never auto-enters, and
    // the replay is a frozen aside that never counts toward the timed run).
    if (g.retrain && g.retrain.enabled) {
      const rt = g.retrain;
      centerText(c, 'Watch me — replay a lesson (frozen; the run keeps its clock)', g.cx, rt.titleY, '700 14px Georgia, serif', INK, 0.9);
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
        centerText(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, '700 12px Georgia, serif', '#fdf6e9', 1);
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
    const pw = 340, ph = 260, px = cx - pw / 2, py = cy - 130 + slide;
    const c = paperPanel(ctx, px, py, pw, ph, { seed: 21 });
    centerText(c, 'Paused', cx, py + 44, '700 30px Georgia, serif');
    centerText(c, 'P to resume - Esc quits to the pond', cx, py + 76, '13px Georgia, serif', INK, 0.7);
    ctx.save();
    ctx.globalAlpha = op;
    uiButton(ctx, px, py + 108, pw, 44, 'Resume', this._mouseIn(px, cy - 130 + 108, pw, 44), false, { seed: 41, size: 16, mouseX: this.input.mouse.x, mouseY: this.input.mouse.y, mouseClicked: false });
    uiButton(ctx, px, py + 160, pw, 44, 'Quit to the Pond', this._mouseIn(px, cy - 130 + 160, pw, 44), false, { seed: 42, size: 16, mouseX: this.input.mouse.x, mouseY: this.input.mouse.y, mouseClicked: false });
    ctx.restore();
    centerText(c, 'M to mute', cx, py + 226, 'italic 12px Georgia, serif', INK, 0.6);
    paperEnd(ctx);
  }

  // V4 (v1.2 M11): the end-card height — taller on a victory (it carries the
  // exhibition), same compact height on a defeat. Both the draw (_drawEnd) and
  // the end-state click rects (input routing above) use this so the buttons
  // stay in the same place on screen in both.
  _endCardH() { return this.endKind === 'victory' ? 540 : 430; }

  // N1 (v1.3 M14): the end-screen button geometry — single source of truth shared
  // by the end-state click routing (input) and _drawEnd, so the buttons never
  // drift. "Rest at the Atelier" (primary) and "Return to the Pond" (link) keep
  // their exact original positions; a "Next Expedition (New Game+)" button is
  // slotted between them ONLY when NG+ is unlocked (a victory has been earned),
  // so a first-time save sees the identical two-button end screen as before.
  _endButtons() {
    const H = this._endCardH();
    const cx = this.cw / 2, py = this.ch / 2 - H / 2, ph = H;
    const bw = 300, bh = 54, bx = cx - bw / 2, by = py + ph + 16;
    const primary = { x: bx, y: by, w: bw, h: bh };
    const ngShow = ngUnlocked(this.save);
    let ng = null;
    let retY = by + bh + 16;
    if (ngShow) {
      const nbh = 44;
      ng = { x: cx - bw / 2, y: by + bh + 14, w: bw, h: nbh };
      retY = ng.y + ng.h + 14;
    }
    const ret = { x: cx - 105, y: retY, w: 210, h: 34 };
    return { primary, ng, ret };
  }

  // C2 (v1.3 M16): the victory end-screen "Season" summary — a compact read of
  // the NG+ season a victory belongs to. Pure display (no new persistence):
  // every value is read from the run (ngCycle) and the save (ngModifier, gold,
  // gildedFrame, loadout) exactly once at draw time. `goldThisRun` is the delta
  // since run start (runGold captured in _beginExpedition; falls back to the
  // full total if a run never started, as in headless end screens).
  _seasonSummary() {
    const gold = Math.max(0, Math.floor(this.save.gold) || 0);
    const modId = saveModifier(this.save);
    const names = (this.save.loadout || [])
      .map((id) => PAINTINGS.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => p.name);
    return {
      cycle: Math.max(0, Math.floor(this.ngCycle) || 0),
      mod: modId ? MODIFIERS[modId].name : 'none',
      goldThisRun: Math.max(0, gold - (Number.isFinite(this.runGold) ? this.runGold : 0)),
      goldTotal: gold,
      gilded: isGilded(this.save) ? 'hung' : 'not yet',
      paintings: names,
    };
  }

  // M1 (v1.4): the first-victory cinematic beat's screen — letterbox bars
  // slide in from top/bottom, a soft vignette, the caption "The Swamp Blooms…"
  // fades up, and a "press any key / click to skip" hint pulses. The world
  // behind (already blooming to full color in _drawAll) shows through the open
  // center, so it reads as a cinematic "reveal" rather than a card. Pure draw.
  _drawCineBeat(ctx) {
    const { t, dur } = this._cine;
    const in01 = clamp(t / 0.5, 0, 1);            // bars slide in over 0.5s
    const ease = 0.5 - 0.5 * Math.cos(Math.PI * in01);
    const barH = (0.16 * this.ch) * ease;
    // letterbox bars
    ctx.fillStyle = '#0a0d08';
    ctx.fillRect(0, 0, this.cw, barH);
    ctx.fillRect(0, this.ch - barH, this.cw, barH);
    // soft vignette over the whole frame (deeper at the edges)
    const vg = ctx.createRadialGradient(this.cw / 2, this.ch / 2, this.ch * 0.28,
      this.cw / 2, this.ch / 2, this.ch * 0.72);
    vg.addColorStop(0, 'rgba(10,13,8,0)');
    vg.addColorStop(1, `rgba(10,13,8,${0.45 * in01})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.cw, this.ch);
    // caption + sub, fading up just after the bars settle
    const capA = clamp((t - 0.35) / 0.7, 0, 1);
    if (capA > 0) {
      outlineText(ctx, 'The Swamp Blooms!', this.cw / 2, this.ch * 0.42,
        '700 46px Georgia, serif', '#eaf3e0', 'rgba(10,13,8,0.9)', 6);
      centerText(ctx, 'The Great Gray Heron takes flight, dripping in your colors. The swamp remembers.',
        this.cw / 2, this.ch * 0.42 + 44, 'italic 17px Georgia, serif', '#eaf3e0', 0.85 * capA);
    }
    // "press any key to skip" hint — pulses, fades in late, never before 1.2s
    const hintA = clamp((t - 1.2) / 0.6, 0, 1);
    if (hintA > 0) {
      const pulse = 0.55 + 0.45 * Math.sin((t - 1.2) * 4);
      centerText(ctx, 'press any key or click to continue', this.cw / 2,
        this.ch - barH - 26, '13px Georgia, serif', '#cfe6c4', hintA * pulse);
    }
    // a thin gold rule between the caption and the skip hint on full reveal
    if (in01 > 0.6) {
      const rw = 220 * ease;
      ctx.fillStyle = `rgba(201,146,42,${0.5 * in01})`;
      ctx.fillRect(this.cw / 2 - rw / 2, this.ch * 0.42 + 70, rw, 1.5);
    }
  }

  _drawEnd(ctx) {
    // M1 (v1.4): the first-victory cinematic beat owns the whole screen —
    // letterbox bars slide in, the world (already blooming to full color in
    // _drawAll) shows through, a caption + "press any key" hint read, and the
    // normal card is HELD (no dim, no card) until the beat closes / is skipped.
    // _drawAll routes the beat's own input (skip), so we only draw here.
    if (this._cine) { this._drawCineBeat(ctx); return; }
    const victory = this.endKind === 'victory';
    const a = Math.min(1, this.endT / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = victory ? 'rgba(40,50,30,0.55)' : 'rgba(30,25,22,0.6)';
    ctx.fillRect(0, 0, this.cw, this.ch);
    ctx.restore();
    if (this.endT < 0.25) return; // let the heron fly a beat before the card

    const cx = this.cw / 2;
    const ph = this._endCardH();   // V4: taller on a victory (carries the exhibition)
    const pw = 560, px = cx - pw / 2, py = this.ch / 2 - ph / 2;
    const c = paperPanel(ctx, px, py, pw, ph, { seed: victory ? 31 : 37 });

    outlineText(c, victory ? 'The Swamp Blooms!' : 'The Brush Rests…', cx, py + 52, '700 40px Georgia, serif', victory ? '#5a9e3d' : '#8d9aa0', INK, 6);
    centerText(c, victory
      ? 'The Heron takes flight, dripping in your colors. The swamp remembers.'
      : 'The frog slips beneath the reeds… but the pigments you kept are yours.',
      cx, py + 88, 'italic 15px Georgia, serif', INK, 0.8);

    // gains
    const g = this.endGains || {};
    const gainsY = victory ? 122 : 150;
    centerText(c, victory ? 'Pigments added to the bank' : 'Pigments kept (half, the swamp is unforgiving)', cx, py + gainsY, '700 14px Georgia, serif', INK, 0.85);
    for (let i = 0; i < 3; i++) {
      const col = ORB_COLORS[i];
      const pig = PIGMENTS[col];
      const ox = cx - 140 + i * 140, oy = py + gainsY + 38;
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

    // V4 (v1.2 M11): on a victory, the paintings hung for this expedition
    // (the 2-slot loadout) are shown as a small framed "curator's wall" — a
    // row of gilded frames, each with its title and a soft reveal (staggered
    // fade + rise). Pure presentation: no new art, reuses the P8 frame look
    // (paperPanel + gilded double border + _drawPaintingMotif) + the painting
    // data. The reveal animates on endT, so early frames show nothing.
    const exh = victory ? (this.save.loadout || []).map(id => PAINTINGS.find(p => p.id === id)).filter(Boolean) : [];
    let bankY = 250;
    if (exh.length > 0) {
      const reveal = clamp((this.endT - 0.4) / 0.9, 0, 1);
      if (reveal > 0.02) {
        centerText(c, `Curator's Wall — ${exh.length} painting${exh.length === 1 ? '' : 's'} from this expedition`, cx, py + 244, '700 14px Georgia, serif', '#5a9e3d', 0.9 * reveal);
        const n = exh.length;
        const fs = 66;
        const gap = 96;
        const total = n * fs + (n - 1) * (gap - fs);
        const x0 = cx - total / 2;
        for (let i = 0; i < n; i++) {
          const pt = exh[i];
          const ri = clamp(reveal - i * 0.12, 0, 1);
          if (ri <= 0.02) continue;
          const fx = x0 + i * gap;
          const fy = py + 274 - (1 - ri) * 16;      // soft rise
          c.save();
          c.globalAlpha = ri;
          // gilded double frame (P8 look) + a paper ground
          c.fillStyle = '#f7f0e0';
          c.beginPath(); c.rect(fx, fy, fs, fs); c.fill();
          c.strokeStyle = '#d9b45a'; c.lineWidth = 3;
          c.strokeRect(fx + 1.5, fy + 1.5, fs - 3, fs - 3);
          c.strokeStyle = '#b08a3e'; c.lineWidth = 1.5;
          c.strokeRect(fx + 6, fy + 6, fs - 12, fs - 12);
          this._drawPaintingMotif(c, pt, fx + 8, fy + 8, fs - 16);
          c.restore();
          centerText(c, pt.name, fx + fs / 2, fy + fs + 15, 'italic 12px Georgia, serif', INK, 0.9 * ri);
        }
        bankY = 350;   // victory card: bank moves below the exhibition
      }
    }

    // bank totals
    const b = this.save.bank;
    centerText(c, `Bank — red ${b.red} · blue ${b.blue} · green ${b.green}`, cx, py + bankY, '700 15px Georgia, serif', INK, 0.9);
    const s = this.save.stats;
    const statsY = victory ? 374 : 274;
    centerText(c, `expeditions ${s.expeditions} · victories ${s.victories} · herons painted ${s.heronsPainted}`, cx, py + statsY, '13px Georgia, serif', INK, 0.65);

    // best run
    const br = this.save.bestRun;
    if (br) {
      const what = br.cleared ? `cleared with ${br.pigments} pigment` : `lasted ${br.time}s`;
      centerText(c, `best run — ${what}`, cx, py + (victory ? 396 : 296), '700 13px Georgia, serif', INK, 0.8);
    }

    // spend hint / challenge reward block. On a challenge victory the spend
    // hint is replaced by the filed score + rank + the K8 reward (the more
    // meaningful lines for that run), and the NG+ "Season" summary below is
    // skipped (a challenge is its own scored mode, not an NG+ season).
    if (victory && this._challengeResult) {
      // K7 (v1.5 M2): the filed challenge score + where it ranked in the daily
      // best list; K8: the completion reward (the minted Masterpiece / rank gold).
      const cr = this._challengeResult;
      const rankTxt = cr.rank <= 5 ? `#${cr.rank} of 5` : 'below the top 5';
      centerText(c, `The Curator's Challenge — score ${cr.score} · filed ${rankTxt} on today's best list`, cx, py + 418, '700 13px Georgia, serif', '#a3762a', 0.95);
      centerText(c, `the whole world shares today's swamp (${challengeDate(cr.seed)})`, cx, py + 436, 'italic 12px Georgia, serif', INK, 0.6);
      if (cr.minted) {
        centerText(c, `masterpiece minted: "${MASTERPIECE.name}"  ·  +${cr.gold} gold`, cx, py + 456, '700 13px Georgia, serif', '#c9922a', 0.95);
      } else if (cr.gold > 0) {
        centerText(c, `rank ${cr.rank} reward: +${cr.gold} gold`, cx, py + 456, '700 13px Georgia, serif', '#c9922a', 0.9);
      } else {
        centerText(c, 'the best list is already at its top-5 — beat your best to file again', cx, py + 456, 'italic 12px Georgia, serif', INK, 0.6);
      }
    } else {
        centerText(c, 'Rest at the Atelier and spend what you gathered.', cx, py + (victory ? 420 : 320), 'italic 12px Georgia, serif', INK, 0.55);
    }

    // C2 (v1.3 M16): the "Season" summary (VICTORY ONLY, NOT a challenge) — a
    // compact read of the NG+ season this victory belongs to: the cycle, the
    // modifier chosen for it, the gold earned this expedition + the career
    // total, the Gilded Frame state, and the paintings carried. Reuses the V4
    // card's existing empty bottom band (the card is 540 tall and the spend
    // hint ends at py+420), so NOTHING below it moves — the end-screen buttons
    // (driven by _endButtons) keep their exact rects on a first-time save.
    // Pure display: no new persistence, every value read live from the
    // run/save at draw time.
    if (victory && !this._challengeResult) {
      const ss = this._seasonSummary();
      const sy = py + 450;
      c.save();
      c.strokeStyle = 'rgba(43,35,32,0.30)';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(cx - 175, sy - 16); c.lineTo(cx + 175, sy - 16); c.stroke();
      centerText(c, 'Season', cx, sy, '700 13px Georgia, serif', '#a3762a', 0.9);
      centerText(c, `cycle ${ss.cycle} · modifier ${ss.mod} · Gilded Frame ${ss.gilded}`, cx, sy + 22, '13px Georgia, serif', INK, 0.75);
      centerText(c, `gold earned this expedition +${ss.goldThisRun} · gold total ${ss.goldTotal}`, cx, sy + 40, '13px Georgia, serif', INK, 0.75);
      centerText(c, `paintings from this expedition: ${ss.paintings.length ? ss.paintings.join(', ') : 'none'}`, cx, sy + 58, '12.5px Georgia, serif', INK, 0.65);
      c.restore();
    }
    paperEnd(ctx);

        // primary: to the atelier (+ the N1 "Next Expedition" NG+ button, see
        // end-state input routing and _endButtons for the shared rects)
        const eb = this._endButtons();
        uiButton(ctx, eb.primary.x, eb.primary.y, eb.primary.w, eb.primary.h, 'Rest at the Atelier', this._mouseIn(eb.primary.x, eb.primary.y, eb.primary.w, eb.primary.h), false, { seed: 9, size: 18, mouseX: this.input.mouse.x, mouseY: this.input.mouse.y, mouseClicked: false });
        if (eb.ng) {
          uiButton(ctx, eb.ng.x, eb.ng.y, eb.ng.w, eb.ng.h, 'Next Expedition  (New Game+)', this._mouseIn(eb.ng.x, eb.ng.y, eb.ng.w, eb.ng.h), false, { seed: 90, size: 15, mouseX: this.input.mouse.x, mouseY: this.input.mouse.y, mouseClicked: false });
        }
        const lw = eb.ret.w, lh = eb.ret.h, lx = eb.ret.x, ly = eb.ret.y;
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
        // N4 (v1.3 M14): the expedition-modifier picker overlays the end screen.
        if (this._modPrompt) this._drawModPrompt(ctx);
      }
}