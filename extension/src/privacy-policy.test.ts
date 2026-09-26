import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The page the Chrome Web Store listing links to. Its disclosures must survive every edit.
const html = readFileSync(join(import.meta.dirname, '../../site/privacy.html'), 'utf8');
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('privacy policy', () => {
  it.each([
    ['only finished games are sent', 'finished games'],
    ['the anonymous installation ID', 'anonymous installation ID'],
    ['Google Gemini writes the explanations', 'Google Gemini'],
    ['Google may use free-tier data', 'Google may use'],
    ['traffic passes through Cloudflare', 'Cloudflare'],
    ['the IP address is not stored', 'never written to the database'],
    ['no selling of data', 'We do not sell'],
    ['the contact address', 'bagmala80@gmail.com'],
  ])('discloses %s', (_, phrase) => {
    expect(text).toContain(phrase);
  });

  it('runs no scripts', () => {
    expect(html).not.toMatch(/<script/i);
  });

  it('loads nothing from other sites', () => {
    expect(html).not.toMatch(/<(link|img|iframe)\b[^>]*(href|src)="https?:/i);
  });
});
