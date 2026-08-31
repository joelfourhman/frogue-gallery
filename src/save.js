// save.js — thin localStorage persistence over the logic.js save schema.
// All keys are prefixed 'frogue_gallery_' (see SAVE_KEY / OPTIONS_KEY in logic.js).
'use strict';
import { SAVE_KEY, OPTIONS_KEY, freshSave, freshOptions, migrateSave, migrateOptions } from './logic.js';

export const SaveSys = {
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return migrateSave(JSON.parse(raw));
    } catch (e) {
      console.warn('Frogue Gallery: save load failed', e);
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