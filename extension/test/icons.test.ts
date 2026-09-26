import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../public/manifest.json';
import { decodePng, opaqueBox } from './png';

const icon = (size: number) =>
  decodePng(readFileSync(resolve(import.meta.dirname, '../public', (manifest.icons as Record<string, string>)[size])));

describe('icons', () => {
  it.each([16, 32, 48, 128])('the %i icon is a PNG of that size', (size) => {
    const png = icon(size);
    expect([png.width, png.height]).toEqual([size, size]);
  });

  // The store asks for a 96×96 picture with 16 transparent pixels around it.
  it('keeps the margins the store asks for at 128', () => {
    const box = opaqueBox(icon(128), 1);
    expect(box.left).toBeGreaterThanOrEqual(16);
    expect(box.top).toBeGreaterThanOrEqual(16);
    expect(box.right).toBeLessThanOrEqual(112);
    expect(box.bottom).toBeLessThanOrEqual(112);
    expect(box.right - box.left).toBeGreaterThanOrEqual(80);
  });

  // Small icons have no margins: at 16 pixels a pawn with margins is a speck.
  it.each([16, 32, 48])('fills the %i icon edge to edge', (size) => {
    const box = opaqueBox(icon(size), 128);
    expect(box.right - box.left).toBeGreaterThanOrEqual(size * 0.8);
    expect(box.bottom - box.top).toBeGreaterThanOrEqual(size * 0.8);
  });
});
