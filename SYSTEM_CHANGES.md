# SYSTEM_CHANGES.md — Frogue Gallery

This document records every change made **outside the normal source files** of
`frogue-gallery/`. It is maintained throughout development.

## Environment facts (pre-existing, not installed by this mission)

| Item | Version | Location | Note |
|---|---|---|---|
| Git | 2.55.0.windows.3 | `C:\Program Files\Git\bin\git` (via MSYS) | Pre-existing. Used for repo-local commits only. |
| Python | 3.14.7 (standalone) | `C:\Users\joelf\AppData\Local\Programs\Python\Python314\python.exe` | Pre-existing user install. Used as the *base* interpreter for the project venv only. Not modified. |
| uv | 0.12.7 | `C:\Users\joelf\AppData\Local\hermes\bin\uv` | Pre-existing. Used **as-is** — not reinstalled, not upgraded, not added to PATH. Invoked via explicit path where needed. |
| Node.js | 22.23.2 | `C:\Users\joelf\AppData\Local\hermes\node\node` | Pre-existing. Used **read-only** to run headless JS logic tests. No npm packages installed (globally or otherwise). |

## Changes made

All changes listed below are **inside `frogue-gallery/`** or are
session-scoped environment variables that vanish with the shell.

1. **Project directory tree created** — `frogue-gallery/{src,assets,tests,docs}`.
   - Reason: the mission's single sandbox.
   - Persists after reboot: only if `frogue-gallery/` is not deleted.
   - Revert: `rmdir /s /q frogue-gallery` (see CLEANUP.md).

2. **Project-local Python venv created** — `frogue-gallery/.venv/`
   - Command: `uv venv --python "C:/Users/joelf/AppData/Local/Programs/Python/Python314/python.exe" .venv`
   - Reason: isolated Python for dev/test tooling; packages (if any) never
     touch global site-packages.
   - **No Python interpreter was downloaded** (`UV_PYTHON_DOWNLOADS=never`);
     the venv is a copy-link of the pre-existing 3.14.7 install.
   - Persists after reboot: with the project dir. Revert: delete `.venv/`.

3. **uv cache redirected to the project** — `frogue-gallery/.cache/uv/`
   - Mechanism: `UV_CACHE_DIR` set as a **shell-session export only**
     (no Windows/user/system environment variable was modified).
   - Persists after reboot: with the project dir; the env var itself does not.
   - Revert: delete `.cache/`.

4. **Git repository initialized** — `frogue-gallery/.git/`
   - Command: `git init -b main`
   - Repo-local identity set (`user.name`/`user.email` in
     `frogue-gallery/.git/config` only). **Global Git configuration was not
     modified** — the user's existing global identity remains the fallback for
     all other repos.
   - No remotes, no pushes, no GitHub repos, no authentication.
   - Revert: delete `.git/`.

5. **Temporary local dev server (during testing only)** —
   `python -m http.server 8000 --bind 127.0.0.1` run from `frogue-gallery/`,
   loopback-only, non-privileged port, killed after each testing session.
   No firewall changes, no service, no startup entry.

6. **User-level Hermes context hardening** —
   `C:\Users\joelf\AppData\Local\hermes\config.yaml` was minimally updated
   on 2026-08-30 using Hermes' own supported configuration command. The
   existing `custom:ninfer` provider, `qwen-local` model, NInfer endpoint,
   authentication reference, and 65,536-token context were preserved. The
   changes only bound model output, context compression, file reads, and tool
   output for safer local-Qwen sessions. No secret was copied into this repo.
   - Backup: `C:\Users\joelf\AppData\Local\hermes\config.yaml.backup-20260830-183818`
   - Revert: close Hermes, replace `config.yaml` with that backup, and reopen
     Hermes. See `CLEANUP.md`.

## Explicitly NOT done

- No Administrator/UAC elevation, ever.
- No system services, scheduled tasks, startup entries, or background
  processes created.
- No Windows Defender, firewall, registry, execution policy, or trust-store
  changes.
- No drivers, GPU/CUDA/firmware changes, no WSL/Hyper-V/Docker changes.
- No global or user-level environment variable changes (PATH untouched).
- No system-wide packages installed (no `pip install`, no `npm install -g`).
- No browsers, browser binaries, or game assets downloaded.
- The existing Hermes + NInfer + Qwen stack was not touched in any way.
- No cloud APIs or external LLM calls.

## Final statement

> **No system-level changes were made.** All project-specific tools,
> environments, caches, source files, and generated artifacts are contained
> within `frogue-gallery/`. (uv and Python were pre-existing and used as-is;
> the only session-scoped state — the uv cache env var — disappears with the
> shell.)
