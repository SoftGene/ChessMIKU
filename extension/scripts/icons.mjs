// Draws the extension's icons from icons/pawn.svg into public/icons/. The PNGs are committed; run this
// only after changing the drawing. Usage, from extension/: npm run icons
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = resolve(import.meta.dirname, '..');
const svg = readFileSync(resolve(root, 'icons/pawn.svg'), 'utf8');
const FULL = 'viewBox="0 0 128 128"';
if (!svg.includes(FULL)) throw new Error(`icons/pawn.svg must have ${FULL}`);

// The store wants 128×128 with a 96×96 picture and 16 transparent pixels around it: the same drawing
// in a view a third wider. Small icons keep the full square, or the pawn is lost at 16 pixels.
const PADDED = 'viewBox="-21.333 -21.333 170.667 170.667"';

mkdirSync(resolve(root, 'public/icons'), { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const source = size === 128 ? svg.replace(FULL, PADDED) : svg;
  const png = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(resolve(root, `public/icons/icon-${size}.png`), png);
  console.log(`public/icons/icon-${size}.png`);
}
