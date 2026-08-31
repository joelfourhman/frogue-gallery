# CLEANUP.md — Frogue Gallery

How to remove everything this project created and restore the machine to its
prior state.

## 1. Stop any running local server

If a dev server is running (only ever `python -m http.server 8765 --bind
127.0.0.1`, loopback-only):

- Close its terminal window / press `Ctrl+C`, or
- `taskkill /F /IM python.exe` — **only if** you are sure the only Python
  process is the Frogue dev server (check Task Manager first).

## 2. Erase game saves (browser)

All persistent browser data uses the `frogue_gallery_` prefix.

- **In-game (recommended):** Title screen → bottom-left **"erase save data"** link →
  click it a second time within 3 seconds to confirm. This wipes the
  progress save (`frogue_gallery_save`); your audio/mute options
  (`frogue_gallery_options`) are kept.
- **Manual:** DevTools → Application → Local Storage → `http://127.0.0.1:8765`
  → delete keys:
  - `frogue_gallery_save` — main progress (bank, paintings, loadout, upgrades, flags)
  - `frogue_gallery_options` — volume / mute / display settings

  (If the game was opened from `file://`, the same keys live under that origin.)

## 3. Delete the project

```powershell
# from C:\Users\joelf\projects\hermes_ninfer_stack\workspace
rmdir /s /q frogue-gallery
```

This removes in one motion:

- all source code and docs
- `.venv/` (the project-local Python environment)
- `.cache/uv/` (the project-local uv cache; the shell env var that pointed at
  it is already gone)
- `.tools/` (unused — uv turned out to be pre-installed, so no project-local
  uv was needed)
- `.git/` (the local-only repository)

## 4. Optional: restore the pre-hardening Hermes configuration

This recovery task adjusted only supported user-level context/output limits
and selected a lean local-coding toolset.
To undo those settings, close Hermes Desktop and run with the existing Python:

```text
python -c "import shutil; shutil.copy2(r'C:\Users\joelf\AppData\Local\hermes\config.yaml.backup-20260830-185157', r'C:\Users\joelf\AppData\Local\hermes\config.yaml')"
```

Then reopen Hermes Desktop. This restores the complete pre-hardening config;
do not hand-edit or print the configuration because it may reference secrets.

## What this does NOT remove (and why nothing else exists)

- **No** uv was installed by this mission — it was pre-existing at
  `C:\Users\joelf\AppData\Local\hermes\bin\uv` and is *not* part of the
  project. Do not delete it.
- **No** global Python packages were installed.
- **No** Node/npm packages were installed.
- **No** environment variables, services, tasks, or startup entries were
  created.

After steps 1–3 the machine is back to its prior state.
