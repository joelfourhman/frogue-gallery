// Cloudflare Git builds require only Node. Fail before publishing on smoke
// regressions; the complete browser/pacing release gates run locally.
import { spawnSync } from 'node:child_process';
for (const script of ['tests/smoke.mjs', 'scripts/build.mjs']) {
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
