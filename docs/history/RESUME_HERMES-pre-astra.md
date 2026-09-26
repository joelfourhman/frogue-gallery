# Continue Existing Frogue Gallery Project

This is an existing project. Do not restart completed work or discard untracked files. The repository is authoritative.

Before modifying anything:

1. Read `PROJECT_STATE.md`.
2. Run `git status`.
3. Inspect the most recent 3–5 commits.
4. Read `MISSION.md`.
5. Read only source files needed for the current milestone.
6. Run the smallest useful verification.

Continue from `PROJECT_STATE.md`'s **Immediate Next Action**.

**A checkpoint is not a stopping point.** During active autonomous work:

```text
WORK → TEST → UPDATE STATE → COMMIT → CONTINUE
```

Keep active context small. Do not reread the entire repository or print large source, logs, or diffs into chat. The repository is the deliverable, not the conversational response.

## Then run this as a separate Hermes command

```text
/goal Continue autonomously developing the existing Frogue Gallery project until the full v1.1 plan in MISSION.md ("Post-release v1.1 — Improvements & bug fixes") is satisfied: all Track B bug fixes (B1–B6) and all Track A improvements (P6–P12) implemented, tested, and committed per the v1.1 acceptance criteria. Treat PROJECT_STATE.md and Git as persistent memory. Work in bounded chunks. At each milestone: test, update PROJECT_STATE.md, commit, and immediately continue. Never stop merely at a checkpoint. Keep context small by reading only files required for the active milestone. Only stop when the complete v1.1 plan is genuinely finished or a safety-critical blocker requires user input.
```
