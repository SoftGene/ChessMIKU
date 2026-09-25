import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classColor, moveIcon, squareMark } from './icons';

// The classes the backend sends, as the contract lists them.
const contract = readFileSync(join(import.meta.dirname, '../../contracts/api.yaml'), 'utf8');
const CLASSES = /Classification:\s*\n\s*type: string\s*\n\s*enum: \[([^\]]+)\]/.exec(contract)![1].split(',').map((c) => c.trim());

describe('icons', () => {
  it('reads the classes of the contract', () => {
    expect(CLASSES).toEqual(['best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder']);
  });

  it.each(CLASSES)('has an icon for %s in its own colour', (cls) => {
    const color = classColor(cls);

    expect(color).toMatch(/^#[0-9a-f]{6}$/);
    expect(moveIcon(cls)).toContain(`fill="${color}"`);
    expect(squareMark(cls)).toContain(`fill="${color}"`);
  });

  it('names the class for screen readers', () => {
    expect(moveIcon('blunder')).toContain('aria-label="Blunder"');
  });

  it('draws the chess.com symbols players know', () => {
    expect(moveIcon('blunder')).toContain('>??</text>');
    expect(moveIcon('mistake')).toContain('>?</text>');
    expect(moveIcon('inaccuracy')).toContain('>?!</text>');
  });

  it('puts the mark in the top right corner of a square of 100 × 100', () => {
    expect(squareMark('best')).toMatch(/^<g transform="translate\(60 -4\) scale\(1\.75\)">/);
  });

  it.each(['brilliant', 'great', '<script>'])('has no icon for a class it does not know: %s', (cls) => {
    expect(moveIcon(cls)).toBeNull();
    expect(squareMark(cls)).toBeNull();
    expect(classColor(cls)).toBeNull();
  });
});
