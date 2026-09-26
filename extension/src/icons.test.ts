import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classColor, glyphBox, mateMark, moveIcon, squareMark } from './icons';

// The classes the backend sends, as the contract lists them.
const contract = readFileSync(join(import.meta.dirname, '../../contracts/api.yaml'), 'utf8');
const CLASSES = /Classification:\s*\n\s*type: string\s*\n\s*enum: \[([^\]]+)\]/.exec(contract)![1].split(',').map((c) => c.trim());

describe('icons', () => {
  it('reads the classes of the contract', () => {
    expect(CLASSES).toEqual(['best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder', 'great', 'brilliant']);
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

  it.each(['inaccuracy', 'mistake', 'blunder', 'great', 'brilliant'])('draws the marks of %s as tall as the others, centred in the circle', (cls) => {
    expect(glyphBox(cls)).not.toBeNull();
    const box = glyphBox(cls)!;
    const single = glyphBox('mistake')!;

    expect([box.top, box.bottom]).toEqual([single.top, single.bottom]);
    expect((box.left + box.right) / 2).toBeCloseTo(12, 1);
    expect(Math.abs((box.top + box.bottom) / 2 - 12)).toBeLessThan(0.1);
  });

  it('draws ?! as a question mark and an exclamation mark, ?? as two question marks, and types none', () => {
    const marks = (cls: string) => [...moveIcon(cls)!.matchAll(/data-mark="(\w+)"/g)].map((m) => m[1]);

    expect(marks('inaccuracy')).toEqual(['question', 'exclaim']);
    expect(marks('mistake')).toEqual(['question']);
    expect(marks('blunder')).toEqual(['question', 'question']);
    expect(moveIcon('blunder')).not.toContain('<text');
  });

  it('draws the marks where it measures them', () => {
    expect(moveIcon('mistake')).toContain('d="M9.5 9.3');
    expect(moveIcon('blunder')).toContain('d="M5.5 9.3');
    expect(moveIcon('blunder')).toContain('d="M13.5 9.3');
    expect(moveIcon('inaccuracy')).toContain('d="M16.2 6.8v7.2"');
  });

  it.each([['great', '#5b8bd6', ['exclaim']], ['brilliant', '#26b5a8', ['exclaim', 'exclaim']]] as const)(
    'draws %s ahead of the backend: its colour and its exclamation marks',
    (cls, color, marks) => {
      expect(classColor(cls)).toBe(color);
      expect([...(moveIcon(cls) ?? '').matchAll(/data-mark="(\w+)"/g)].map((m) => m[1])).toEqual(marks);
    },
  );

  it('gives the book its spine', () => {
    expect(moveIcon('book')).toContain('d="M12 8.3v8.4"');
  });

  it('measures no marks for a class drawn otherwise', () => {
    expect(glyphBox('best')).toBeNull();
    expect(glyphBox('<script>')).toBeNull();
  });

  it('lets every mark pop up, and rings the notable ones in their colour', () => {
    for (const cls of ['blunder', 'best', 'great', 'brilliant']) {
      expect(squareMark(cls)).toContain(`class="mark-ring" cx="12" cy="12" r="11" fill="none" stroke="${classColor(cls)}"`);
    }
    for (const cls of ['excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss']) {
      expect(squareMark(cls)).not.toContain('mark-ring');
    }
    expect(squareMark('mistake')).toContain('<g class="mark-pop"');
  });

  it('rings a brilliant move twice, in its colour and then lighter, and the other notable ones once', () => {
    const rings = (cls: string) => [...(squareMark(cls) ?? '').matchAll(/class="(mark-ring[^"]*)"[^>]*stroke="(#[0-9a-f]+)"/g)].map((m) => [m[1], m[2]]);

    expect(rings('brilliant')).toEqual([['mark-ring', '#26b5a8'], ['mark-ring mark-ring-late', '#7fe0d6']]);
    expect(rings('blunder')).toEqual([['mark-ring', '#d93b3b']]);
    expect(rings('great')).toEqual([['mark-ring', '#5b8bd6']]);
  });

  it('carries the position in the mark, so that the board draws it anew on each move', () => {
    expect(squareMark('best', 'fen-a')).toContain('data-at="fen-a"');
    expect(squareMark('best', 'fen-a')).not.toBe(squareMark('best', 'fen-b'));
  });

  it('marks a mate: # on the mated king, a crown on the winner, both ringed', () => {
    expect(mateMark('mated')).toMatch(/^<g transform="translate\(60 -4\) scale\(1\.75\)">/);
    expect(mateMark('mated')).toContain('fill="#2f2a24"');
    expect(mateMark('mated')).toContain('data-mark="hash"');
    expect(mateMark('winner')).toContain('fill="#d9a93b"');
    expect(mateMark('winner')).toContain('data-mark="crown"');
    expect([mateMark('mated'), mateMark('winner')].every((mark) => mark.includes('mark-ring'))).toBe(true);
    expect(mateMark('winner', 'fen-a')).toContain('data-at="fen-a"');
  });

  it('puts the mark in the top right corner of a square of 100 × 100', () => {
    expect(squareMark('best')).toMatch(/^<g transform="translate\(60 -4\) scale\(1\.75\)">/);
  });

  it.each(['forced', 'genius', '<script>'])('has no icon for a class it does not know: %s', (cls) => {
    expect(moveIcon(cls)).toBeNull();
    expect(squareMark(cls)).toBeNull();
    expect(classColor(cls)).toBeNull();
  });
});
