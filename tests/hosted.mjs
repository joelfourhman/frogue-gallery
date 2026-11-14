// Public-safe UI probe: never reads or changes a Game instance. Uses an isolated
// browser profile, ordinary input, canvas text observation and browser APIs.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { browserPath } from '../scripts/browser.mjs';
import { createPreview, deploymentPolicy } from '../scripts/preview.mjs';
import { ROOT } from '../scripts/dev.mjs';
import { RUNTIME_FILES } from '../scripts/artifact.mjs';

const remote = process.argv.find(a => /^https:\/\//.test(a));
const server = remote ? null : await createPreview();
// A loopback address outside boot.js's debug allowlist is still a secure
// context for clipboard and pointer lock, with the public bootstrap behavior.
if (server) await new Promise(resolve => server.listen(0, '127.0.0.2', resolve));
const base = remote || `http://127.0.0.2:${server.address().port}`;
const output = path.join(ROOT, 'tests', '.out', 'hosted', process.env.PROBE_LABEL || (remote ? new URL(base).hostname : 'local'));
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: browserPath(), headless: true });
const evidence = { url: base, browser: browser.version(), checks: [] };
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const policy = await deploymentPolicy(path.join(ROOT, 'dist', 'frogue-gallery'));
  for (const name of RUNTIME_FILES.filter(n => !['_headers', '404.html', 'index.html'].includes(n)).concat('')) {
    const response = await context.request.get(base + '/' + name);
    assert.equal(response.status(), 200, name);
    for (const [key, value] of Object.entries(policy.headers)) assert.equal(response.headers()[key.toLowerCase()], value, `${name}: ${key}`);
    if (name.endsWith('.js')) assert.match(response.headers()['content-type'], /javascript/);
    if (!name) assert.match(response.headers()['content-type'], /text\/html/);
  }
  for (const name of ['nonexistent', '.git/config', '.env', 'scripts/launch.ps1', 'deployment.md', 'PROJECT_STATE.md', '_headers']) {
    const response = await context.request.get(base + '/' + name);
    assert.equal(response.status(), 404, name);
    assert.match(await response.text(), /This trail fades into the reeds/);
  }
  if (remote) {
    const response = await context.request.get(base.replace('https:', 'http:'), { maxRedirects: 0 });
    assert([301, 302, 307, 308].includes(response.status()));
    assert.match(response.headers().location, /^https:/);
  }
  evidence.checks.push('HTTPS (when remote), MIME, all policy headers, runtime paths, private paths return custom 404');
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (!r.url().startsWith('blob:') && !r.url().startsWith('data:')) requests.push({ url: r.url(), method: r.method() }); });
  await page.addInitScript(() => {
    window.__releaseProbe = { text: [], audio: [], violations: [] };
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
      window.__releaseProbe.text.push(String(text));
      if (window.__releaseProbe.text.length > 5000) window.__releaseProbe.text.splice(0, 2500);
      return original.call(this, text, ...args);
    };
    const AC = window.AudioContext;
    window.AudioContext = class extends AC { constructor(...args) { super(...args); window.__releaseProbe.audio.push(this); } };
    addEventListener('securitypolicyviolation', e => window.__releaseProbe.violations.push(e.violatedDirective));
  });
  const textSeen = text => page.waitForFunction(text => window.__releaseProbe.text.some(s => s.includes(text)), text, { timeout: 10000 });
  const key = async k => { await page.keyboard.press(k); await page.waitForTimeout(100); };
  const click = async (x, y) => {
    const rect = await page.locator('#game').boundingBox();
    await page.mouse.click(rect.x + x / 1280 * rect.width, rect.y + y / 800 * rect.height);
    await page.waitForTimeout(150);
  };
  await page.goto(base);
  await textSeen('Reclaim our swamp');
  assert.equal(await page.evaluate(() => typeof window.__game), 'undefined');
  await page.screenshot({ path: path.join(output, 'title.png') });
  await key('m');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('frogue_gallery_options')).muted), true);
  await key('m'); await key('o'); await textSeen('Export');
  await click(560, 223);
  const options = await page.evaluate(() => JSON.parse(localStorage.getItem('frogue_gallery_options')));
  assert(options.musicVol > 0 && options.musicVol < 1);
  await page.waitForFunction(() => window.__releaseProbe.audio.some(a => a.state === 'running'));
  await click(510, 566);
  const backup = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(JSON.parse(backup).saveVersion, 12);
  await click(700, 580); // Native clipboard paste field.
  await page.waitForTimeout(200);
  await Promise.all([page.waitForNavigation(), click(510, 606)]);
  await textSeen('Reclaim our swamp');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('frogue_gallery_options')).musicVol), options.musicVol);
  evidence.checks.push('gesture audio starts, mute/volume, native clipboard save export/import, options survive reload');
  await key('Enter');
  await page.waitForTimeout(800);
  await key('Enter'); // Dismiss the first-journey story card if present.
  await page.waitForTimeout(400);
  await page.keyboard.down('d'); await page.waitForTimeout(350); await page.keyboard.up('d');
  await key('2');
  await click(720, 420);
  await page.waitForFunction(() => document.pointerLockElement?.id === 'game');
  await page.mouse.move(900, 420); await page.mouse.move(880, 420);
  await page.mouse.down(); await page.waitForTimeout(450); await page.mouse.up();
  await key('Escape'); await textSeen('Paused');
  assert.equal(await page.evaluate(() => document.pointerLockElement), null);
  await key('p'); await key('j'); await textSeen('Save postcard');
  const downloadPromise = page.waitForEvent('download');
  await click(802, 689);
  const download = await downloadPromise;
  const pngPath = path.join(output, 'postcard.png'); await download.saveAs(pngPath);
  const png = await fs.readFile(pngPath);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1600); assert.equal(png.readUInt32BE(20), 960);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('frogue_gallery_save')));
  assert(saved.sketchbook.length > 0);
  await page.screenshot({ path: path.join(output, 'sketchbook.png') });
  await page.reload(); await textSeen('Reclaim our swamp');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('frogue_gallery_save')).sketchbook.length), saved.sketchbook.length);
  assert.equal(await page.evaluate(() => typeof window.__game), 'undefined');
  assert.deepEqual(await page.evaluate(() => window.__releaseProbe.violations), []);
  assert.deepEqual(errors, []);
  assert(requests.every(r => new URL(r.url).origin === new URL(base).origin && r.method === 'GET'));
  evidence.checks.push('ordinary movement/painting/color input, native mouse capture/release, sketchbook PNG, saved artwork after reload, no debug object/errors/third-party requests/uploads');
  const fallback = await context.newPage();
  await fallback.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = undefined; });
  await fallback.goto(base);
  await fallback.waitForTimeout(500);
  await fallback.keyboard.press('Enter'); await fallback.waitForTimeout(800);
  await fallback.keyboard.press('Enter'); await fallback.waitForTimeout(200);
  const rect = await fallback.locator('#game').boundingBox();
  await fallback.mouse.click(rect.x + rect.width * .6, rect.y + rect.height * .55);
  assert.equal(await fallback.evaluate(() => document.pointerLockElement), null);
  assert.equal(await fallback.locator('#game').isVisible(), true);
  await fallback.keyboard.press('j'); await fallback.waitForTimeout(200);
  await fallback.screenshot({ path: path.join(output, 'capture-fallback.png') });
  evidence.checks.push('unsupported mouse-capture path accepts ordinary canvas input without boot failure');
  await context.close();
  console.log(`HOSTED UI PASSED: ${base} (${browser.version()})`);
} finally {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(evidence, null, 2) + '\n');
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
