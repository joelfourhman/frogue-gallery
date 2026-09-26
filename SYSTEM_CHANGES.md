# Environment and tool changes

## Astra pass — 2026-09-26

No software, browser, package, service, system configuration or global
environment setting was installed/changed in this development pass.

Existing tools used:
- Node.js 22.23.2 to run the game server, tests and dependency-free ZIP builder.
- Python 3.14.7 for the initial local preview; no Python environment changes.
- Existing playwright-core 1.63.0 in the ignored node_modules directory.
- Existing Chrome 152 under the user's .agent-browser browser cache.
- Existing Git for repository-local milestone commits; no remote push.

Temporary/created project outputs:
- dist/ contains generated runtime files, ZIP and SHA-256 manifest.
- .cache/checks/ contains regression logs and report.json.
- .cache/astra-logs/ retains earlier diagnostic output.
- tests/.out/astra/ and tests/frames/astra/ contain regenerated browser evidence.
- An in-app browser preview uses the task's127.0.0.1:8766 Node server.
  The initial Python 8765 preview was stopped during cleanup.
- Browser tests use isolated profiles and free loopback ports, and close
  their browser/server in their cleanup path.

Source additions (scripts/, studio.js, favicon and docs) are normal repository
changes, not machine configuration. No public deployment, upload, account,
scheduled task or remote service was created.

## Earlier environment history

The project already had .venv/, node_modules and caches. The previous detailed
ledger is preserved in docs/history/SYSTEM_CHANGES-pre-astra.md. Those entries
describe earlier work; do not attribute them to this pass.

See CLEANUP.md for precise project-local cleanup boundaries.
