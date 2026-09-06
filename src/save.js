// save.js — thin localStorage persistence over the logic.js save schema.
// All keys are prefixed 'frogue_gallery_' (see SAVE_KEY / OPTIONS_KEY in logic.js).
//
// B2 contract: load() never throws and never returns a partial/garbled save,
// for ANY localStorage content.
//   key missing        → null (caller falls back to freshSave())
//   unparseable JSON   → null (logged), caller starts fresh
//   parseable JSON     → migrateSave(parsed): merges recognizable fields
//                        into a fresh schema, or a pure fresh save; the
//                        non-enumerable `_case` property ('migrated'|'fresh')
//                        documents which outcome applied.
//
// B5 contract: if localStorage is unavailable or throws (privacy mode, quota
// full, disabled), the module transparently falls back to an in-memory store
// so the game keeps running and no data loss crashes. `storageOK` reflects
// the degraded state so the caller can surface a one-time "progress may not
// persist" banner. Data errors (e.g. JSON.parse of a corrupt blob) are NOT
// storage errors — they propagate to the caller, never to the fallback.
'use strict';
import { SAVE_KEY, OPTIONS_KEY, freshSave, freshOptions, migrateSave, migrateOptions } from './logic.js';

// In-memory fallback store. Same surface as the localStorage API subset we use.
const mem = new Map();
const memStore = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  get length() { return mem.size; },
  key: (i) => [...mem.keys()][i] ?? null,
};

// Resolved store (real localStorage or the in-memory fallback), resolved lazily
// once. `_degraded` is sticky: once we have fallen back, we stay on memory for
// the life of the module (the game is a single long-lived page).
let _store = null;
let _degraded = false;

function resolve() {
  if (_store) return _store;
  let ls = null;
  try { ls = (typeof localStorage !== 'undefined') ? localStorage : null; } catch { ls = null; }
  if (ls) {
    try {
      // probe: write / read-back / remove to confirm storage actually works
      const probe = SAVE_KEY + '__probe__';
      ls.setItem(probe, '1');
      if (ls.getItem(probe) !== '1') throw new Error('probe read-back mismatch');
      ls.removeItem(probe);
      _store = ls;
      return _store;
    } catch (e) {
      console.warn('Frogue Gallery: localStorage unavailable — in-memory save only (progress may not persist)', e);
    }
  } else {
    console.warn('Frogue Gallery: no localStorage — in-memory save only (progress may not persist)');
  }
  _degraded = true;
  _store = memStore;
  return _store;
}

// Active store for a data read. Returns the store, or null if we cannot get a
// working store at all (defensive — the fallback itself never throws, so this
// path is unreachable in practice).
function storeForRead() {
  const s = resolve();
  if (s === memStore) return memStore;
  try { return s; } catch { return null; }
}

// Run `fn(store)` against the active store. A storage failure (the store
// itself threw) downgrades to the in-memory store and retries once; data
// errors raised INSIDE `fn` (e.g. JSON.parse) propagate to the caller — they
// are not storage errors. Returns true when the value is from a successful
// `fn` call, false when `fn` threw on the real store (degraded retry).
function tryOp(fn) {
  const s = resolve();
  try {
    fn(s);
    return true;
  } catch (e) {
    if (s !== memStore) {
      _degraded = true;
      _store = memStore;
      console.warn('Frogue Gallery: storage access failed — in-memory save only (progress may not persist)', e);
      try { fn(memStore); return true; } catch (e2) { return false; }
    }
    // on the fallback the error is a data error — propagate it
    throw e;
  }
}

export const SaveSys = {
  // Whether persistent (real) storage is working. Forces a resolve so a boot
  // check in the constructor gets an accurate answer.
  get storageOK() { resolve(); return !_degraded; },

  load() {
    // Phase 1: the storage READ (getItem). A failure here is a storage error
    // → downgrade to the in-memory fallback and retry once.
    let raw;
    const s = storeForRead();
    if (!s) return null;
    try {
      raw = s.getItem(SAVE_KEY);
    } catch (e) {
      if (s !== memStore) {
        _degraded = true;
        _store = memStore;
        console.warn('Frogue Gallery: storage read failed — in-memory save only (progress may not persist)', e);
      }
      try { raw = memStore.getItem(SAVE_KEY); } catch { raw = null; }
    }
    if (!raw) return null;
    // Phase 2: the data PARSE (JSON.parse + migrate). A failure here is a DATA
    // error (corrupt blob) — B2: never crash, start fresh. Never downgrades.
    try {
      return migrateSave(JSON.parse(raw));
    } catch (e) {
      console.warn('Frogue Gallery: corrupt save (' + SAVE_KEY + ') — starting fresh', e);
      return null;
    }
  },
  save(data) {
    // JSON.stringify of our own save is pure data prep (never throws on a
    // well-formed save); the storage write is the only fallback-sensitive op.
    const blob = JSON.stringify(data);
    return tryOp((s) => s.setItem(SAVE_KEY, blob));
  },
  erase() {
    return tryOp((s) => {
      s.removeItem(SAVE_KEY);
      // belt & braces: sweep any straggler keys
      for (let i = s.length - 1; i >= 0; i--) {
        const k = s.key(i);
        if (k && k.startsWith('frogue_gallery_') && k !== OPTIONS_KEY) {
          s.removeItem(k);
        }
      }
    });
  },
  hasSave() {
    const s = storeForRead();
    if (!s) return false;
    try { return !!s.getItem(SAVE_KEY); } catch { return false; }
  },
  loadOptions() {
    const s = storeForRead();
    if (!s) return freshOptions();
    try {
      const raw = s.getItem(OPTIONS_KEY);
      if (!raw) return freshOptions();
      return migrateOptions(JSON.parse(raw));
    } catch {
      return freshOptions();
    }
  },
  saveOptions(opts) {
    try {
      const blob = JSON.stringify(opts);
      tryOp((s) => s.setItem(OPTIONS_KEY, blob));
    } catch { /* non-critical */ }
  },
  // Test hook: clear the resolved store so storage detection re-runs. The B5
  // smoke stage uses this to simulate localStorage becoming unavailable after
  // an earlier stage already resolved the (working) stub store.
  _resetStorage() { _store = null; _degraded = false; },
};
