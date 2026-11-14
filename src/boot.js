// External bootstrap permits a script policy without inline/eval exceptions.
try {
  const { Game } = await import('./game.js');
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  game.start();
  if (['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) window.__game = game;
} catch (e) {
  console.error('Frogue Gallery failed to boot', e);
  document.getElementById('game').hidden = true;
  document.getElementById('fallback').hidden = false;
}
