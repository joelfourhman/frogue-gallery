import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const boot = await fs.readFile(new URL('../src/boot.js', import.meta.url), 'utf8');
assert.match(html, /<script type="module" src="\.\/src\/boot\.js"><\/script>/);
assert.equal([...html.matchAll(/<script\b/g)].length, 1);
assert.match(boot, /await import\('\.\/game\.js'\)/);
// Execute the actual bootstrap control flow with an injected game module.
for (const host of ['localhost', '127.0.0.1', '[::1]', 'frogue-gallery.pages.dev', '192.168.50.115', 'localhost.evil.test']) {
  let started = 0;
  const context = { window: {}, location: { hostname: host }, document: { getElementById: () => ({}) }, console,
    TestGame: class { start() { started++; } } };
  await vm.runInNewContext(`(async () => { ${boot.replace("await import('./game.js')", '({ Game: TestGame })')} })()`, context);
  assert.equal(started, 1);
  assert.equal(!!context.window.__game, ['localhost', '127.0.0.1', '[::1]'].includes(host));
}
const elements = { game: { hidden: false }, fallback: { hidden: true } };
await vm.runInNewContext(`(async () => { ${boot.replace("await import('./game.js')", "Promise.reject(new Error('test failure'))").replace('const { Game } = Promise', 'const { Game } = await Promise')} })()`, {
  document: { getElementById: id => elements[id] }, console: { error() {} },
});
assert.equal(elements.game.hidden, true); assert.equal(elements.fallback.hidden, false);
console.log('DEPLOYMENT BOOT PASSED: external module, loopback-only debug access, visible error fallback.');
