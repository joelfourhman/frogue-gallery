# Environment and tool changes

## Captured aim and LAN launcher — 2026-11-12

Owner explicitly authorized all-interface hosting. No packages or firewall
settings changed. Verified the previous listener PID 20972 was this project's
scripts/play.mjs, stopped it, and restarted that launcher with --no-browser,
hidden, bound to 0.0.0.0:8767. Current PID 22404 is recorded in
.cache/lan-preview.pid; logs are .cache/lan-preview.log and .err.log.
Verified HTTP and native Chrome pointer capture at http://192.168.50.115:8767.
The launcher also lists the host's virtual-network address 172.20.192.1.
These are host-side checks; no second physical computer was used.

## Original soundtrack — 2026-11-12

No packages, remote services, machine settings or persistent processes added.
Existing Node/Chromium tools render local Web Audio through tests/render-music.mjs
and both browser journeys. WAV previews and PCM reports live under tests/.out/astra/.
The test harness owns and closes its loopback server and isolated browser.

## Our swamp, our colors — 2026-11-11

No new packages, machine settings or persistent processes. Reused existing
Node/Chromium and loopback harnesses. Creative-paint/story evidence is in
tests/.out/astra/48–50 PNGs; new baseline log is
.cache/checks/balance-before-swamp.log. Existing preview/launcher stays on port 8767.

## Double-click launcher — 2026-11-11

Added project-local CMD, PowerShell and Node launcher scripts; no installation
or machine setting change. PowerShell's execution-policy bypass applies only
to the launched process. Tested the wrapper with a minimal PATH and reused the
existing preview; no additional persistent server was left running. Launcher
tests own and close temporary loopback servers. Chrome and the Codex-bundled
Node already exist on this machine.

## Twenty delights — 2026-11-11

No environment, dependency or service changes. Existing Node/Chromium tooling
verified new interactions on loopback; harnesses close their own servers and
browsers. Preview remains the existing 127.0.0.1:8767 process. New generated
evidence is in tests/.out/astra/40–47 and combat-*.png, .cache/paint-delights-review/
and .cache/journey-review/. Baseline balance is archived in
.cache/checks/balance-before-delights.log; packaged output remains ignored dist/.

## Single dungeon — 2026-11-11

No new dependencies, services or machine settings. Existing Node, Chromium and
Git run the campaign checks. Loopback/browser processes use isolated harnesses
and close at exit; the existing source preview remains at 127.0.0.1:8767.
Ignored dist/ is rebuilt by package validation. Evidence is in .cache/checks/,
tests/.out/astra/36–39 and tests/frames/astra/. Old balance telemetry is retained
at .cache/checks/balance-before-campaign.log for comparison.

## Lily Clearing — 2026-11-11

No packages or machine settings changed. Reused existing Node, Git and Chromium.
Browser checks use isolated profiles and loopback servers, closed by harnesses.
The existing source preview at 127.0.0.1:8767 serves these changes after reload;
no additional persistent process was created. Local evidence uses .cache/checks/
and tests/.out/astra/32–35; the build refreshes ignored dist/ output.

## Responsive controls — 2026-11-11

No dependencies or machine settings changed. Used the existing Node/Git and
Chromium tools; all 19 gates passed. Harness servers and browsers close at exit.
A hidden source preview is running on http://127.0.0.1:8767, process 44136;
its PID and output logs are in .cache/feel-preview.*. This is loopback only.
The before/after archive and audit outputs are project-local ignored files.

## Living Sketchbook — 2026-11-11

No software, dependency, service or machine setting installed or changed.
Used the existing Node.js 24.22.1, Git, playwright-core and local Chromium.
Chromium required execution outside the sandbox's process restrictions;
all game/browser traffic remained on loopback with isolated test profiles.
Test servers and browser processes close in their harness cleanup paths.
Generated evidence uses the existing ignored dist/, .cache/ and tests/.out/
directories. No public upload, remote push or participant outreach.

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
