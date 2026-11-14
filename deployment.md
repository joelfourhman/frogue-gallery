# Frogue Gallery deployment

Owner authorized publication on **2026-11-14**, then selected a **public GitHub
repository with Cloudflare hosting**. This supersedes the earlier Direct Upload
plan (preserved in Git history). No paid services or custom domain.

## Architecture and cost

Source: https://github.com/joelfourhman/frogue-gallery (public, joelfourhman).
Cloudflare Pages builds the repository and serves only `dist/frogue-gallery`.
Hosting: Pages Free, assigned HTTPS pages.dev hostname, $0 recurring.
Static requests remain free and unlimited per documentation checked 2026-11-14.
No Functions, Workers, database, analytics or remote game API.
[Pricing](https://developers.cloudflare.com/pages/functions/pricing/).

The game works while the owner's PC is off. The Windows launcher remains a
local/LAN tool. No router, firewall, tunnel or home-network exposure is needed.
Saves remain browser-local and origin-specific; this is single-player.

## Build and deployment settings

| Setting | Value |
| --- | --- |
| Repository | joelfourhman/frogue-gallery |
| Production branch | main |
| Framework preset | None |
| Root directory | Repository root |
| Build command | `node scripts/cloudflare-build.mjs` |
| Output directory | `dist/frogue-gallery` |
| Node | 22 or newer; record actual provider version |
| Git deployments | main publishes production; other enabled branches produce public previews |
| Domain | Assigned pages.dev address; no purchase |

The build command runs the full smoke suite before building; failure blocks
deployment. Full pacing/browser gates run locally before pushing a release.
No npm installation is required. The builder normalizes text line endings so
Windows and Linux produce identical bytes.
[Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/),
[build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).

The owner handles sign-in, MFA and GitHub app consent. Limit Cloudflare's
repository grant to this project. Never store credentials in source, logs or
output. Review paid changes separately.

## Security and artifact boundary

- External src/boot.js permits a script policy without inline/eval exceptions.
  window.__game remains available only on exact loopback hostnames.
- deploy/_headers sets CSP, nosniff, no-referrer, DENY framing, restricted camera,
  microphone/geolocation, and Cache-Control: no-cache. Scripts use only self;
  network connections are disabled. Existing inline CSS and local blob/data
  images remain allowed for UI and PNG export.
- deploy/404.html prevents the host's default SPA fallback for unknown paths.
- scripts/artifact.mjs defines the exact 27-file allowlist, rejects unexpected
  files and symlinks, checks sizes/hashes and ZIP hash, and scans common credential
  formats. Docs, tests, logs, launchers and manifests are excluded from hosting.
  Pattern scanning is not proof that every possible secret is absent.
- Art is procedural and the music is original synthesized composition. No external
  recordings, fonts or images were added. This is not a legal audit.

[Header configuration](https://developers.cloudflare.com/pages/configuration/headers/),
[404 behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/).

## Release workflow

1. Read AGENTS.md and PROJECT_STATE.md; preserve unrelated work.
2. Run `node scripts/check.mjs --browser`. All **20 gates** must pass: smoke,
   campaign, seven retained pacing bands, balance, audio/UI, packaging,
   source/dist journeys, public-mode UI, 36 frames and performance.
3. Update project state, commit, and run postcommit smoke.
4. Build with `node scripts/build.mjs`; verify with
   `node scripts/artifact.mjs dist`. Stop on any nonzero exit.
5. With a clean working tree, copy the generated folder, ZIP and manifest into a
   new `.cache/releases/<full-git-sha>/` directory. Do not overwrite an existing
   frozen release. Verify with `node scripts/artifact.mjs <release-directory>`.
   Keep it unchanged. GitHub backs up source; a second artifact backup location
   requires owner selection.
6. For subsequent releases, push a codex/ branch and test its public Cloudflare
   preview before merging to main. The first Git deployment builds the selected
   production branch after local release gates pass.
7. Wait for Cloudflare and record its exact URL, deployment ID and Git SHA.
   Compare hosted assets with the frozen manifest. _headers is provider
   configuration, not a served asset: verify actual response headers.
8. Run `node tests/hosted.mjs https://ACTUAL-PROVIDER-URL` in Chrome and Edge.
   It uses isolated profiles, normal input and browser APIs, never the game-control
   handle. Checks cover HTTPS redirect, MIME/security/cache headers, 404 exposure,
   audio startup, mute/volume, native clipboard save export/import, mouse capture,
   unsupported-capture fallback, postcard PNG and saved artwork after reload.
   It rejects runtime third-party requests and unexpected uploads. Source/dist
   journeys additionally verify creative prop painting, edge reversal and combat.
9. Verify fresh and returning browsers. Obtain an independent external/cellular
   check if unavailable through tools. Record unavailable browser checks honestly.
10. Update this record and PROJECT_STATE.md, commit/push docs, and wait for that
    deployment too. Confirm identical runtime hashes for documentation-only changes.

Logs: .cache/checks/. Public-mode evidence: tests/.out/hosted/.
`node scripts/preview.mjs` serves the packaged policy on a free loopback port.
Normal dev/launcher caching is unchanged.

## Save transfer and recovery

Old local/LAN game → Options → Export. Keep the copied JSON as a backup.
New HTTPS game → Options → paste into save field → Import.
Import replaces that browser's saved artwork/progress; export its existing save
first if needed. Settings are separate. Active runs do not resume after reload.
A custom domain is another origin. Clearing browser site data removes local saves.

Local edits publish only after a push. Main pushes trigger production builds.
For an incident: Cloudflare → project → Deployments → previous successful
production → Rollback; then verify the canonical URL. Previews cannot be rollback
targets. First release has no previous production; retain its frozen artifact.
Rollback restores code, not localStorage. Keep save schema 12 unless a separately
tested migration is approved.
[Rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/).

## Execution record

| Item | Result |
| --- | --- |
| Authorization | 2026-11-14: execute plan; public GitHub + Cloudflare selected |
| Repository | https://github.com/joelfourhman/frogue-gallery |
| Cloudflare account | Owner's signed-in personal account |
| Plan / spending | Free intended; no paid purchase authorized |
| Canonical URL / deployment ID | Pending build and verification |
| Release commit / ZIP SHA-256 | Pending final gates |
| Local Node | 24.22.1; Wrangler not used (Git integration) |
| Browser checks | Local Chrome 157.0.8103.52 and Edge 157.0.4341.46 public-mode probes passed |
| Local gates | All 20 passed; .cache/checks/report.json |
| Backup | Frozen release pending; GitHub source after push |
| Rollback target | None before first production |
| Hosted headers / save / PNG / capture | Pending deployment |
| External-network check | Pending deployment |
| Limits | Firefox unavailable locally; mobile/touch not tested; no cloud saves |
