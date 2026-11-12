# Frogue Gallery: internet deployment plan

Status: **planned, not deployed**. Researched 2026-11-12 against repository
checkpoint `8f54672`. This document is an execution runbook for a future agent.
Writing this plan does not authorize publishing, buying a domain, or changing DNS.

## Recommended launch

Publish the built static game to **Cloudflare Pages Free using Direct Upload**,
initially at its assigned HTTPS `pages.dev` address. Keep the account in the
owner's name. Upload only the runtime artifact, never the repository root.
No backend, database, Pages Functions, Workers, paid analytics, or Git integration
is needed. The player's browser runs the game and synthesizes its audio.

The public site will work while the owner's PC is off. `Launch Game.cmd` remains
the local/LAN testing tool; it is not the internet server. Do not expose port
8767, forward router ports, open inbound firewall rules, or install a tunnel.
This release remains a single-player game with browser-local saves.

Cloudflare documents free, unlimited static asset requests, provided they do not
invoke Functions. That makes this small game a good fit, though free hosting is
not a contractual uptime guarantee and provider terms can change.
[Static pricing](https://developers.cloudflare.com/pages/functions/pricing/).

### Cost and alternatives

| Option | Expected cost | Assessment |
| --- | --- | --- |
| Cloudflare Pages Free + assigned address | $0/month hosting; no domain purchase | Recommended launch. Static-only deployment avoids compute billing. |
| Same host + optional custom domain | Hosting $0; budget roughly $10–25/year for an ordinary domain | Planning estimate, not a registrar quote; premium names and renewal rates vary. Verify both registration and renewal, plus tax, before approval. |
| Netlify Free | $0, with 300 monthly credits and a hard limit | Viable alternative, but a usage budget complicates a public game launch. [Current credit limits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/). |
| GitHub Pages | Free for public repositories on GitHub Free | Viable if publishing source is desired; less convenient for this plan's response-header configuration. [Availability](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages). |

Current generated ZIP is approximately 0.82 MB across 24 runtime files. As a
rough transfer illustration, 10,000 complete first downloads are about 8.2 GB;
100,000 about 82 GB before compression/caching savings. These are not forecasts
or bill estimates; one play session fetches several files. The release fits far
below Pages' 20,000-file Free limit and 25 MiB individual-file limit.
[Platform limits](https://developers.cloudflare.com/pages/platform/limits/).

**Spending policy for execution:** $0 recurring hosting; no paid upgrades,
auto-recharge, domain purchases, or paid add-ons without specific authorization.
Recheck pricing before execution. If the free service no longer fits, report the
actual constraint and options instead of silently upgrading. Do not add server
features just because the provider offers them.

Direct Upload accepts a prebuilt folder through Wrangler, or a folder/ZIP through
the dashboard. A Direct Upload project cannot later be converted to native Git
integration; that requires a new project. A future CI job can still use Wrangler
to upload to this project. Manual, tested releases are sufficient initially.
[Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).

## Execution authority and inputs

The owner can initiate this runbook with: **“Execute deployment.md using the
$0 defaults and publish the game.”** That authorizes preparing the release,
creating the free project, uploading public previews, and publishing the tested
production artifact. Do not ask for the same publishing permission again.

Defaults: project name `frogue-gallery` if available; assigned `pages.dev` URL;
no custom domain; no paid services; no telemetry added. Record the actual URL
returned by the provider rather than guessing it. If a name is unavailable,
use an available descriptive variant and record it.

The owner must complete account creation, sign-in, MFA and any account consent
that requires them. Discover available authenticated tools before requesting
credentials or installing tooling. If multiple accounts could be affected,
confirm the intended account. Never request passwords, recovery codes, or API
tokens in chat. Domain purchase/DNS migration requires a separate concrete
domain choice and authorization; it does not block the default free launch.

## 1. Prepare a secure release locally

These are **future implementation tasks**, not features implemented by this
document. Complete them before uploading anything.

1. Read `AGENTS.md`, `PROJECT_STATE.md`, this file and current Git status. Preserve
   unrelated work. Recheck architecture and hosting docs if the code or provider
   has changed. Use a `codex/` branch if a new branch is appropriate.
2. Move the inline module bootstrap in `index.html` to `src/boot.js`, referenced
   with `<script type="module" src="./src/boot.js"></script>`. Adjust its import
   to `./game.js`. Preserve error fallback and the localhost-only `window.__game`
   guard. Do not expose a game-control debug object on public hostnames.
3. Add `deploy/_headers` and a small, self-contained `deploy/404.html`. Extend
   `scripts/build.mjs` to copy these explicitly to the output root, include them
   in ZIP generation and the hash manifest, and retain deterministic output.
   Do not hand-edit generated output after building.
4. Extend package/smoke assertions to cover the new boot path and deployment
   artifact allowlist. Output may contain `index.html`, `favicon.svg`, runtime
   `src/*.js`, `_headers`, and `404.html`. Fail on unexpected files, symlinks,
   `.env`, `.git`, credentials, docs, tests, local logs, `node_modules`, launch
   scripts, `functions/`, or `_worker.js`. Inspect the artifact for accidental
   secrets; JavaScript delivered to players is public source, not a secret store.
5. Review ownership of shipped artwork/music and any notices. The soundtrack is
   original synthesized music; do not add MapleStory recordings, melodies or
   branding as part of deployment. This is a content review, not a completed
   legal audit.

Use this initial `_headers` policy, then verify actual behavior:

```text
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Cache-Control: no-cache
```

Externalizing the bootstrap permits scripts without `unsafe-inline` or
`unsafe-eval`. Inline CSS remains allowed because the existing page and runtime
use inline styles. `connect-src 'none'` matches the current no-network gameplay;
revisit it explicitly if that architecture changes. Do not add rules that block
gamepad, user-triggered audio, fullscreen, or mouse capture. Test PNG downloads
and native save import/export, including object URLs. The framing policy makes
this a standalone site; iframe distribution would need a separate policy review.
[CSP script policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src).

Cloudflare processes the `_headers` file as configuration. Check the delivered
headers, since local `scripts/dev.mjs` does not currently interpret this file.
Use a production-equivalent local test harness during implementation, then
verify the actual provider response. Never assume file presence proves the
policy is active. [Header configuration](https://developers.cloudflare.com/pages/configuration/headers/).

A top-level `404.html` prevents Pages' default single-page-app fallback from
serving the game for every unknown path. Keep it free of inline scripts and
external assets. [Serving behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/).

Keep browser caching at revalidation (`no-cache`), since current module filenames
are not content-hashed. Do not mark them immutable or add a “Cache Everything”
override. Verify an update reaches both a returning browser and a fresh one;
already-open games retain their loaded code until reload. Long-term immutable
caching can follow a separate content-hashed asset implementation.

## 2. Verify and freeze the artifact

Run from the repository in PowerShell. Treat any nonzero exit as a stop; investigate
failures rather than repeatedly rerunning until green.

```powershell
node scripts/check.mjs --browser
if ($LASTEXITCODE -ne 0) { throw 'Release checks failed' }
```

This runs the current 19 gates, including smoke, campaign, retained pacing,
balance, audio/UI, packaging, source/dist browser journeys, frame evidence and
performance. Preserve test logs. The known intermittent lantern browser fixture
must be diagnosed if it fails; it is not permission to skip browser validation.

Update `PROJECT_STATE.md`, commit only release-related work, and run postcommit
smoke as required by the repository. Record the release commit. Then build:

```powershell
$releaseSha = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot identify release commit' }
if (git status --porcelain) { throw 'Resolve or isolate uncommitted work before release' }
node scripts/build.mjs
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
$releaseDir = Join-Path (Get-Location) ".cache/releases/$releaseSha"
if (Test-Path -LiteralPath $releaseDir) { throw 'Existing release: verify it; do not overwrite' }
New-Item -ItemType Directory -Path $releaseDir | Out-Null
Copy-Item -LiteralPath 'dist/frogue-gallery' -Destination $releaseDir -Recurse
Copy-Item -LiteralPath 'dist/frogue-gallery.zip' -Destination $releaseDir
Copy-Item -LiteralPath 'dist/manifest.json' -Destination $releaseDir
$artifactDir = Join-Path $releaseDir 'frogue-gallery'
Get-FileHash -LiteralPath (Join-Path $releaseDir 'frogue-gallery.zip') -Algorithm SHA256
```

Verify the frozen folder's paths, sizes and SHA-256 values against its manifest;
verify the ZIP hash against `zipSha256`. Add a reusable verification script during
preparation if needed. Retain this folder unchanged for preview, production and
recovery. The manifest/ZIP remain outside the uploaded folder. Store a second
copy of the approved ZIP and manifest in an owner-approved backup location.

## 3. Authenticate and create the free project

Enable account MFA/passkey and let the owner retain recovery information. Prefer
interactive Wrangler login; an existing suitable connector can perform equivalent
operations. Use only the intended account. For later automation, use an expiring
API token with Cloudflare Pages Edit scoped to that account, not a global API key.
This permission may cover other Pages projects in the account; do not claim it
is project-only. Store credentials in an OS/CI secret facility, never source,
build output, logs or this document.
[Token setup](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/).

Wrangler is optional deployment tooling, not a game runtime dependency. At
execution, inspect the current official release and supported Node version,
select an exact Wrangler version, record it below, and set `$wranglerVersion`
to that value. Do not leave a floating `latest` in a repeatable release command.
The following assumes Node/npm are available and the version has been selected:

```powershell
# Set these to the reviewed version and actual selected project name first.
# $wranglerVersion = '<exact reviewed version>'
if (-not $wranglerVersion -or $wranglerVersion -notmatch '^\d+\.\d+\.\d+$') {
  throw 'Set an exact reviewed stable Wrangler version before continuing'
}
$projectName = 'frogue-gallery'
npx --yes "wrangler@$wranglerVersion" login
if ($LASTEXITCODE -ne 0) { throw 'Authentication failed' }
npx --yes "wrangler@$wranglerVersion" whoami
if ($LASTEXITCODE -ne 0) { throw 'Cannot verify account' }
npx --yes "wrangler@$wranglerVersion" pages project create $projectName --production-branch main
if ($LASTEXITCODE -ne 0) { throw 'Project creation failed; inspect before retrying' }
```

Select/record the intended account if prompted. If the project already exists,
inspect ownership, current production and branch settings and reuse it only if
it is this game's intended project; do not recreate or overwrite an unrelated
project. Here `main` is the Pages production label, not an instruction to merge
the current Git branch. Check CLI flags against the pinned version's help.
[Pages commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/).

## 4. Upload and test a public preview

**Preview URLs are public unless access protection is deliberately configured.**
An obscure URL or no-index header is not authentication. This runbook's publishing
authorization includes public previews. If a private test is requested instead,
configure and verify access protection before uploading, or remain local.

```powershell
$previewBranch = 'review-' + $releaseSha.Substring(0, 12)
npx --yes "wrangler@$wranglerVersion" pages deploy $artifactDir --project-name $projectName --branch $previewBranch --commit-hash $releaseSha
if ($LASTEXITCODE -ne 0) { throw 'Preview deployment failed' }
```

Record the returned deployment ID and exact HTTPS URL. Test the uploaded build
with normal UI input; local journey fixtures depend on `window.__game`, which
must remain unavailable on public hosts. Add a public-safe release browser probe
during preparation, or record equivalent manual browser evidence:

- HTTPS loads with a valid certificate. HTTP redirects to HTTPS. HTML/JS MIME
  types and all policy headers match expectations, with no conflicting CSP.
- Game starts; no failed module loads, CSP violations or uncaught errors. No
  third-party runtime requests or unexpected data uploads occur.
- Movement, painting and color switching work. Mouse capture works after a
  gesture, edge reversal responds, Escape pauses/releases, and menus release
  capture. Test the denied/unsupported capture fallback too.
- Music/SFX begin after interaction and mute/volume controls work. Repaint a
  creative prop, open the sketchbook, export PNG, export/import a save, and verify
  persistent progress/settings after reload. Do not claim active-run resume.
- Exercise current Chrome and Edge; check Firefox for functional fallback.
  Record browser versions. Do not advertise mobile support without touch testing.
- `/nonexistent`, `/.git/config`, `/.env`, `/scripts/launch.ps1`, `/deployment.md`
  and `/PROJECT_STATE.md` return 404 and contain no private content. Public
  `window.__game` is absent. Verify output paths against the allowlist again.

If any check fails, repair locally, test, commit and create a new frozen release.
Do not patch a live deployment or weaken security rules without finding the cause.

## 5. Publish and hand off

Deploy **the same verified frozen folder** to the production label:

```powershell
npx --yes "wrangler@$wranglerVersion" pages deploy $artifactDir --project-name $projectName --branch main --commit-hash $releaseSha
if ($LASTEXITCODE -ne 0) { throw 'Production deployment failed' }
npx --yes "wrangler@$wranglerVersion" pages deployment list --project-name $projectName
```

Record production ID, canonical HTTPS URL and prior successful production ID.
Repeat the hosted smoke checks at the canonical URL, including a fresh browser
profile and a returning one. Ask the owner to open it from a phone on cellular
or a friend's external network if an independent off-LAN check is unavailable;
do not mark that check passed without evidence. No home server is involved.

Browser saves are **origin-specific**. Existing localhost/LAN saves do not appear
at `pages.dev`, and a later custom domain is another origin. Before moving,
export through the old site's Options and import on the new site. Verify this
flow using a backup, never by clearing the owner's save. Private browsing or
clearing site data can remove progress; there is no cloud account or cross-device
sync. Hosting providers still receive ordinary connection/request metadata even
though the game adds no analytics and stores progress locally.

Choose the long-term URL before inviting many players. If an optional domain is
approved, prefer an unused subdomain such as `play.example.com` to avoid moving
unrelated DNS. Associate it in Pages first, then add its CNAME at the existing
DNS provider. Apex domains require Cloudflare zone/nameserver setup: inventory
existing web/email records and obtain that broader authorization before changing
them. Verify certificate issuance and redirects before announcing the domain.
Do not enable HSTS preload or include-subdomains without reviewing every affected
host. [Custom domain procedure](https://developers.cloudflare.com/pages/configuration/custom-domains/).

Hand off the playable link, release SHA, verified cost/settings, save-transfer
instructions, known limitations and rollback target. Update this execution record
and `PROJECT_STATE.md`, then commit the documentation. Do not publish tokens.

## Updates, recovery and upkeep

Local source edits do **not** update the public game. For each requested release,
repeat local checks, freeze a new artifact, preview it, then deploy that same
artifact to production. No home server restart is required. Preserve the previous
release; do not enable automatic Git deployments as an incidental change.

If a release breaks boot, input, saving or security, use Cloudflare dashboard →
project → Deployments → previous successful **production** deployment → Rollback.
Verify the canonical URL afterward and record the incident. Preview deployments
cannot be rollback targets. First release has no previous production: deploy a
reviewed maintenance artifact if necessary, preserving project/domain ownership.
[Rollback procedure](https://developers.cloudflare.com/pages/configuration/rollbacks/).

Rollback restores code, not players' localStorage. Before any future save-schema
change, test compatibility with the rollback version and provide export guidance.
Keep current SAVE_VERSION 12 unless a separately approved migration requires it.
For account compromise, revoke affected credentials, secure the account and
inspect account changes before redeploying a known-good artifact.

At subsequent releases, review provider limits/billing, credentials, security
headers, browser compatibility and artifact backups. Review domain renewal if
one is purchased. Do not create scheduled monitoring, alerts or paid services
without a separate request. A future backend, leaderboard or multiplayer system
needs a new cost/privacy/security design; it is outside this static launch.

## Execution record and completion criteria

Fill this table during execution; keep secrets out. Initial engineering estimate:
roughly 1–2 hours for hardening and validation, plus owner authentication and any
DNS propagation. This is an estimate, not a promised duration.

| Item | Recorded result |
| --- | --- |
| Publishing authorization and date | Pending |
| Account identifier / project name | Pending |
| Hosting plan / verified spend | Free intended; not provisioned |
| Canonical URL / optional domain decision | Assigned URL intended; no domain purchase |
| Exact Wrangler and Node versions | Pending |
| Release commit / ZIP SHA-256 / backup location | Pending |
| Local gate results / logs | Pending release implementation |
| Preview deployment ID / URL / browser evidence | Pending |
| Production deployment ID / date | Pending |
| Previous production rollback ID | None before first release |
| HTTPS / headers / exposure checks | Pending |
| Save transfer / PNG / audio / pointer capture | Pending |
| External-network check | Pending |
| Known limitations / follow-ups | Pending |

Done means the canonical HTTPS game is playable, required checks pass, exposure
and spending settings are verified, the owner has the URL and save guidance,
and an immutable release plus recovery instructions are retained. A successful
upload alone is not completion.
