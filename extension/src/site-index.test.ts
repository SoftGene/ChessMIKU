import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The site's home page: GitHub's "Visit site" and the store listing's homepage land here.
const html = readFileSync(join(import.meta.dirname, '../../site/index.html'), 'utf8');

describe('site home page', () => {
  it.each([
    ['the privacy policy', 'href="privacy.html"'],
    ['the source code', 'href="https://github.com/SoftGene/ChessMIKU"'],
    ['the releases', 'href="https://github.com/SoftGene/ChessMIKU/releases"'],
  ])('links to %s', (_, link) => {
    expect(html).toContain(link);
  });

  it('says it is not affiliated with Chess.com', () => {
    expect(html).toContain('not affiliated with Chess.com');
  });

  it('runs no scripts', () => {
    expect(html).not.toMatch(/<script/i);
  });
});
