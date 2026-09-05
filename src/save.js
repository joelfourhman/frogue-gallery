// save.js — thin localStorage persistence over the logic.js save schema.
// All keys are prefixed 'frogue_gallery_' (see SAVE_KEY / OPTIONS_KEY in logic.js).
'use strict';
import { SAVE_KEY, OPTIONS_KEY, freshSave, freshOptions, migrateSave, migrateOptions } from './logic.js';

export const SaveSys = {
  // B2 contract: load() never throws and never returns a partial/garbled save,
  // for ANY localStorage content.
  //   key missing        → null (caller falls back to freshSave())
  //   unparseable JSON   → null (logged), caller starts fresh
  //   parseable JSON     → migrateSave(parsed): merges recognizable fields
  //                        into a fresh schema, or a pure fresh save; the
  //                        non-enumerable `_case` property ('migrated'|'fresh')
  //                        documents which outcome applied.
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return migrateSave(JSON.parse(raw));
    } catch (e) {
      console.warn('Frogue Gallery: corrupt save (' + SAVE_KEY + ') — starting fresh', e);
      return null;
    }
  },
  save(data) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Frogue Gallery: save persist failed', e);
      return false;
    }
  },
  erase() {
    try {
      localStorage.removeItem(SAVE_KEY);
      // belt & braces: sweep any straggler keys
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('frogue_gallery_') && k !== OPTIONS_KEY) {
          localStorage.removeItem(k);
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  },
  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  },
  loadOptions() {
    try {
      const raw = localStorage.getItem(OPTIONS_KEY);
      if (!raw) return freshOptions();
      return migrateOptions(JSON.parse(raw));
    } catch (e) {
      return freshOptions();
    }
  },
  saveOptions(opts) {
    try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(opts)); } catch (e) { /* non-critical */ }
  },
};