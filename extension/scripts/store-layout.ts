// Layout of the Chrome Web Store images: pure functions from a shot or the pawn to an SVG, which
// scripts/store-images.mjs renders with resvg. Erasable TypeScript only, so Node runs it as it is.

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const BACKGROUND = '#17140f';
const INK = '#e4dccd';
const FONT = "'Segoe UI', Arial, sans-serif";

/** A part of the shot to paint over, such as the opponent's name, in the shot's own pixels. */
export interface Cover extends Box {
  fill: string;
}

export const SHOT = { width: 1280, height: 800 };
export const PROMO = { width: 440, height: 280 };

/** Where a shot goes on a store screenshot: under the caption, with a margin on the other three sides. */
export const SHOT_BOX: Box = { x: 48, y: 150, width: 1184, height: 608 };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** The size from the PNG's IHDR chunk, which always comes first. */
export function pngSize(png: Uint8Array): { width: number; height: number } {
  if (png.length < 24 || PNG_SIGNATURE.some((byte, i) => png[i] !== byte)) {
    throw new Error('not a PNG');
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Scales a picture down to fit the box, keeping its proportions, and centres it. Never scales up. */
export function fit(width: number, height: number, box: Box): Box {
  const scale = Math.min(1, box.width / width, box.height / height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  return { x: box.x + (box.width - w) / 2, y: box.y + (box.height - h) / 2, width: w, height: h };
}

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

/**
 * A 1280×800 store screenshot: the caption on top, the shot under it in a thin frame. The crop, in the shot's own
 * pixels, keeps only the review window and leaves the site around it out.
 */
export function screenshotSvg(png: Uint8Array, caption: string, crop?: Box, covers: readonly Cover[] = []): string {
  const size = pngSize(png);
  const part = crop ?? { x: 0, y: 0, ...size };
  const { x, y, width, height } = fit(part.width, part.height, SHOT_BOX);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${SHOT.width}" height="${SHOT.height}">
  <rect width="100%" height="100%" fill="${BACKGROUND}"/>
  <text x="${SHOT.width / 2}" y="98" fill="${INK}" font-family="${FONT}" font-size="46" font-weight="600" text-anchor="middle">${escapeXml(caption)}</text>
  <svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${part.x} ${part.y} ${part.width} ${part.height}">
    <image width="${size.width}" height="${size.height}" xlink:href="data:image/png;base64,${base64(png)}"/>${covers
      .map((c) => `\n    <rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}" fill="${c.fill}"/>`)
      .join('')}
  </svg>
  <rect x="${x - 1}" y="${y - 1}" width="${width + 2}" height="${height + 2}" fill="none" stroke="${INK}" stroke-width="2" rx="3"/>
</svg>`;
}

/** The 440×280 small promo tile: the pawn on the left, the name and what it does on the right. */
export function promoSvg(pawnSvg: string): string {
  const pawn = pawnSvg.replace('<svg ', '<svg x="30" y="60" width="160" height="160" ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PROMO.width}" height="${PROMO.height}">
  <rect width="100%" height="100%" fill="${BACKGROUND}"/>
  ${pawn}
  <text x="212" y="128" fill="${INK}" font-family="${FONT}" font-size="38" font-weight="700">ChessMIKU</text>
  <text x="212" y="168" fill="${INK}" font-family="${FONT}" font-size="22">Free review of</text>
  <text x="212" y="196" fill="${INK}" font-family="${FONT}" font-size="22">finished games</text>
</svg>`;
}
