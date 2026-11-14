// One fail-fast command for the finite campaign, retained combat pacing and UI.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './dev.mjs';

const dir = path.join(ROOT, '.cache', 'checks'); fs.mkdirSync(dir, { recursive: true });
const tests = ['smoke', 'campaign', 'campaignpace', 'pace', 'humance', 'bosspace', 'reedspace', 'wardpace', 'blackpace', 'umbrapace', 'balance', 'ui', 'sfx', 'music', 'package'];
const browserArgs = {
  'browser-source': ['tests/vertical-slice.mjs'],
  'browser-dist': ['tests/vertical-slice.mjs', '--dist'],
  'browser-public': ['tests/hosted.mjs'],
  frames: ['tests/frames.mjs', '--out', 'tests/frames/astra', '--min', '36'],
  perf: ['tests/perf.mjs'],
};
if (process.argv.includes('--browser')) tests.push(...Object.keys(browserArgs));
const report = [];
for (const name of tests) {
  const start = Date.now();
  const run = spawnSync(process.execPath, browserArgs[name] || [path.join(ROOT, 'tests', name + '.mjs')], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 120000 });
  const output = (run.stdout || '') + (run.stderr || '');
  fs.writeFileSync(path.join(dir, name + '.log'), output);
  let failed = run.status !== 0 || !!run.error;
  const inBand = (pattern, low, high) => { const m = output.match(pattern); return !!m && +m[1] >= low && +m[1] <= high; };
  if (name === 'smoke') failed ||= !output.includes('ALL SMOKE TESTS PASSED');
  if (name === 'pace') failed ||= !inBand(/HUMAN ESTIMATE .*?: ~([\d.]+) min/, 15, 20);
  if (name === 'humance') failed ||= !output.includes('HERON DEFEATED') || !inBand(/FULL-RUN human estimate: .*? = ([\d.]+) min/, 15, 20);
  if (name === 'bosspace') failed ||= !inBand(/heron fight .*?: ([\d.]+)s/, 20, 90);
  if (name === 'reedspace') failed ||= !inBand(/REEDS RUN — HUMAN ESTIMATE .*?: ~([\d.]+) min/, 20, 25);
  if (name === 'blackpace') failed ||= !inBand(/BLACK REEDS RUN — HUMAN ESTIMATE .*?: ~([\d.]+) min/, 22, 26);
  if (name === 'umbrapace') failed ||= !inBand(/UMBRA WYRM — HUMAN ESTIMATE .*?: ~([\d.]+) min/, 2.5, 4);
  if (name === 'wardpace') {
    const samples = [...output.matchAll(/human \(dpsFrac 0.42\) ([\d.]+) min/g)].map(m => +m[1]);
    failed ||= samples.length < 1 || samples.some(n => n < 2 || n > 4);
  }
  if (name === 'campaignpace') failed ||= !output.includes('FULL CAMPAIGN COMBAT JOURNEY PASSED');
  if (name === 'balance') failed ||= !output.includes('(none flagged');
  report.push({ name, passed: !failed, seconds: (Date.now() - start) / 1000 });
  console.log(`${failed ? 'FAIL' : 'PASS'} ${name} (${report.at(-1).seconds.toFixed(1)}s)`);
  if (failed) {
    console.error(output.slice(-5500)); console.error(run.error?.message || `See .cache/checks/${name}.log`);
    fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2)); process.exit(1);
  }
}
fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
console.log('ALL REQUIRED CHECKS PASSED');
