# Local data and generated files

## Stop development servers

Press Ctrl+C in the terminal running `node scripts/dev.mjs` (or the older
Python server). Stop only the server process belonging to this project.
Do not kill every Node/Python process on the machine.

The Astra browser tests own free-port servers and close them at completion.
The earlier Astra pass recorded a preview at 127.0.0.1:8766. The Living
Sketchbook pass uses only harness-owned free-port servers; it does not leave
a new persistent server running.

The later responsive-controls pass leaves a hidden source preview on
127.0.0.1:8767, PID 44136 (also recorded in .cache/feel-preview.pid).
Verify that PID still belongs to this project's Node preview before stopping
it with `Stop-Process -Id 44136`; process IDs can be reused after exit.

## Generated directories

These are ignored by Git and may be regenerated:
- dist/: runtime folder, upload ZIP and manifest; `node scripts/build.mjs`.
- .cache/checks/: text logs and JSON check report.
- .cache/feel-*: control audit script, baseline archive/extraction, measurements,
  screenshots and preview PID/logs. Stop the preview before clearing its logs.
- .cache/atlas-review.png and .cache/studio-*.png: local visual review evidence.
- .cache/astra-logs/: this development pass's earlier diagnostic logs.
- tests/.out/astra/: browser screenshots, postcard and report.
- tests/.out/astra/32–35 PNGs: free repainting, warning lane, combo and 640px UI.
- tests/frames/astra/: staged render screenshots and manifest.
- node_modules/: optional browser test tooling; no game runtime dependency.

Older .venv/, .cache/uv/, .tools/ and test outputs may belong to previous work.
Consult SYSTEM_CHANGES.md and history before removing them. They were not
installed by the Astra pass.

To clean generated data, inspect the exact resolved directory inside this
repository and delete that directory only. Never build deletion paths from
unvalidated strings or use a broad process-kill command.

## Browser data

Options offers JSON save export/import, including study progress and the
sketchbook. Export before intentionally erasing data or moving origins.
The title's erase-save affordance requires a second confirmation click.
Browser storage keys use `frogue_gallery_`; each host/port/profile is separate.
Deleting localStorage is irreversible unless you retained an export.
PNG postcards are ordinary downloaded files and are unaffected by erasing a save.

No hosting resources, services, scheduled tasks or remote accounts were
created by this pass. There is no cloud cleanup required.
