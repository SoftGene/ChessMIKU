import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { fit, pngSize, promoSvg, screenshotSvg, SHOT_BOX } from '../scripts/store-layout';

const png = (width: number, height: number) =>
  new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#7fa650"/></svg>`)
    .render()
    .asPng();

const rendered = (svg: string) => {
  const image = new Resvg(svg).render();
  return { width: image.width, height: image.height };
};

const PAWN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128"/></svg>';

describe('pngSize', () => {
  it('reads the width and height of a PNG', () => {
    expect(pngSize(png(300, 200))).toEqual({ width: 300, height: 200 });
  });

  it('refuses a file that is not a PNG', () => {
    expect(() => pngSize(new TextEncoder().encode('GIF89a, not a png at all'))).toThrow('not a PNG');
  });
});

describe('fit', () => {
  it('shrinks a wide shot to the width of the box and centres it vertically', () => {
    expect(fit(2000, 1000, { x: 48, y: 150, width: 1184, height: 602 })).toEqual({ x: 48, y: 155, width: 1184, height: 592 });
  });

  it('shrinks a tall shot to the height of the box and centres it horizontally', () => {
    expect(fit(1000, 2000, { x: 48, y: 150, width: 1184, height: 602 })).toEqual({ x: 489.5, y: 150, width: 301, height: 602 });
  });

  it('never enlarges a shot smaller than the box', () => {
    expect(fit(592, 301, { x: 48, y: 150, width: 1184, height: 602 })).toEqual({ x: 344, y: 300.5, width: 592, height: 301 });
  });
});

describe('screenshotSvg', () => {
  it('draws a 1280×800 store screenshot', () => {
    expect(rendered(screenshotSvg(png(1920, 960), 'Every move classified'))).toEqual({ width: 1280, height: 800 });
  });

  it('places the shot where fit puts it inside the screenshot box', () => {
    expect(screenshotSvg(png(1920, 960), 'x')).toContain('x="48" y="158" width="1184" height="592"');
    expect(SHOT_BOX).toEqual({ x: 48, y: 150, width: 1184, height: 608 });
  });

  it('escapes the caption', () => {
    const svg = screenshotSvg(png(10, 10), 'Brilliant & best <moves>');
    expect(svg).toContain('Brilliant &amp; best &lt;moves&gt;');
    expect(svg).not.toContain('<moves>');
  });
});

describe('promoSvg', () => {
  it('draws a 440×280 promo tile', () => {
    expect(rendered(promoSvg(PAWN))).toEqual({ width: 440, height: 280 });
  });

  it('names the extension without the chess.com brand', () => {
    const svg = promoSvg(PAWN);
    expect(svg).toContain('ChessMIKU');
    expect(svg).not.toMatch(/chess\.com/i);
  });
});
