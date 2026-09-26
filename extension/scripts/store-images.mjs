// Draws the Chrome Web Store images into store/out/: a 1280×800 screenshot for every shot listed in
// store/shots.json, and the 440×280 promo tile. The PNGs are committed; run this after changing the
// shots or the captions. Usage, from extension/: npm run store-images
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { promoSvg, screenshotSvg } from './store-layout.ts';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'store/out');
const shots = JSON.parse(readFileSync(resolve(root, 'store/shots.json'), 'utf8'));

const render = (svg, file) => {
  const png = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Arial' } }).render().asPng();
  writeFileSync(resolve(out, file), png);
  console.log(`store/out/${file}`);
};

const missing = shots.map((shot) => `store/shots/${shot.file}`).filter((path) => !existsSync(resolve(root, path)));
if (missing.length > 0) {
  throw new Error(`missing shots: ${missing.join(', ')}`);
}

mkdirSync(out, { recursive: true });
shots.forEach((shot, i) => {
  render(screenshotSvg(readFileSync(resolve(root, 'store/shots', shot.file)), shot.caption), `screenshot-${i + 1}.png`);
});
render(promoSvg(readFileSync(resolve(root, 'icons/pawn.svg'), 'utf8')), 'promo-440x280.png');
