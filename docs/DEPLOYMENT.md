# Distribution and deployment

The game is a static website: HTML, SVG favicon and JavaScript modules.
There is no backend, remote API, login, database or runtime package install.

## Ready now

```sh
node scripts/build.mjs
node scripts/dev.mjs --dist
```

Open http://127.0.0.1:8765 and test the exact distribution.

Outputs:
- `dist/frogue-gallery/`: runtime files only.
- `dist/frogue-gallery.zip`: index.html at ZIP root, suitable for HTML5 upload.
- `dist/manifest.json`: per-file SHA-256 and ZIP hash, for local verification.

Builds use Node's standard library and deterministic ZIP metadata. Same source
produces identical bytes. No source map, logs, docs, tests, development tools
or saved player data is included. Module references are relative.
The game itself exposes its development inspection handle only on loopback.

`node tests/package.mjs` checks repeatability, all ZIP entries/hashes, and
the local server's runtime-only allowlist.
`node tests/vertical-slice.mjs --dist` runs the browser journey against
the packaged directory. These also run in the full check command.

## Recommended first distribution: itch.io HTML5

This fits the friend-testing goal: a game page with an embedded browser game
and one uploaded ZIP. itch requires index.html at the ZIP root and relative
file references, which the builder supplies.
[Official itch.io HTML5 documentation](https://itch.io/docs/creators/html5).

When public upload is requested:
1. Build and run `node scripts/check.mjs --browser`.
2. Create a game project of type HTML.
3. Upload `dist/frogue-gallery.zip` and mark it playable in the browser.
4. Set a 1280×800 embedded viewport, enable fullscreen, describe desktop
   keyboard/mouse or standard gamepad controls, and keep it draft initially.
5. Test startup, sound after interaction, saving, reload and PNG download in
   the hosted embed. Also test a fresh browser profile.
6. Share a restricted/draft friend link first; publish publicly only after
   the owner chooses the final page and release settings.

The local test cannot validate the host iframe's download/storage policy.
Treat the actual hosted smoke test as part of uploading, not as completed work.

## Alternatives

| Option | Fit and tradeoff |
|---|---|
| GitHub Pages | Good static URL when a repository/publishing workflow is already wanted. Serve only the built folder through an artifact workflow or publishing branch; no game server is required. |
| Cloudflare Pages Direct Upload | Good drag-and-drop ZIP/folder route without a Git integration. A Direct Upload project cannot later switch to Git integration without creating a new project. |
| Netlify manual deploy | Good folder-drop route for the built directory. No build service is needed for this prebuilt game. |
| Vercel | Another static-host candidate; no provider-specific setup is prepared or verified in this pass. Offers no architectural need that justifies adding its tooling here. |
| Desktop wrapper | Deferred. A browser already runs the game; a wrapper adds binaries, platform packaging and update work. |
| Container | Unnecessary for a static friend link. Consider only if the owner later specifically wants to operate a web server. |

Provider behavior was checked against official documentation on 2026-09-26:
[GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site),
[Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/),
[Netlify manual deploy](https://docs.netlify.com/manage/projects/add-new-project/).
The recommendations and wrapper/container tradeoffs are architectural judgments.

## Save and hosting expectations

Saves stay in localStorage under `frogue_gallery_`. A different hostname,
port, browser or iframe storage partition may have a different save. Players
can export/import JSON in Options before moving. The sketchbook is included
in that save; PNG postcards are independent downloadable keepsakes.
There is no cross-device synchronization or mid-run resume.

Use HTTPS for a public host and correct JavaScript MIME types. Keep paths
case-correct. No secrets or environment variables belong in the distribution.
No hosting account, remote repository, domain or deployment was created or
changed during this pass.
