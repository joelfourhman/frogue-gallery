// Optional development tooling only. The game and package need no browser driver.
import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';

export function browserPath() {
  const cache = path.join(homedir(), '.agent-browser', 'browsers');
  const cached = fs.existsSync(cache) ? fs.readdirSync(cache).filter(n => n.startsWith('chrome-')).sort().reverse().map(n => path.join(cache, n, 'chrome.exe')) : [];
  const candidates = [process.env.CHROME_PATH, ...cached,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'];
  const found = candidates.find(p => p && fs.existsSync(p));
  if (!found) throw new Error('Browser not found. Set CHROME_PATH to an installed Chromium, Chrome or Edge executable.');
  return found;
}
