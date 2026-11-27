/**
 * Renders the Google Play phone screenshots from docs/play-store/screens/panorama.html with headless Chrome:
 * eight 1080×1920 panels (screens/out/1.png … 8.png) plus a preview of the whole strip (screens/out/strip.png).
 * Put the app screens in docs/play-store/screens/raw/1.png … 8.png first (1272×2800 phone captures).
 *
 *   node scripts/make-store-screens.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'docs/play-store/screens');
const out = path.join(dir, 'out');
mkdirSync(out, { recursive: true });
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const page = `file://${path.join(dir, 'panorama.html')}`;

function shot(query, file, w, h) {
  execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    '--force-device-scale-factor=1', '--virtual-time-budget=4000',
    `--window-size=${w},${h}`, `--screenshot=${file}`, `${page}?${query}`,
  ], { stdio: 'ignore' });
  console.log('wrote', path.relative(root, file));
}

for (let p = 1; p <= 8; p++) shot(`p=${p}`, path.join(out, `${p}.png`), 1080, 1920);
shot('p=0', path.join(out, 'strip.png'), 8640, 1920);
