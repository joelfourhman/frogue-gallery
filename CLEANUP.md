# Local data and generated files

## Stop development servers

Press Ctrl+C in the terminal running `node scripts/dev.mjs` (or the older
Python server). Stop only the server process belonging to this project.
Do not kill every Node/Python process on the machine.

The Astra browser tests own free-port servers and close them at completion.
The local preview left for this task uses127.0.0.1:8766.

## Generated directories

These are ignored by Git and may be regenerated:
- dist/: runtime folder, upload ZIP and manifest; `node scripts/build.mjs`.
- .cache/checks/: text logs and JSON check report.
- .cache/astra-logs/: this development pass's earlier diagnostic logs.
- tests/.out/astra/: browser screenshots, postcard and report.
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
