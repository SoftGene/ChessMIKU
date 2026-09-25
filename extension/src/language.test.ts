import { describe, expect, it } from 'vitest';
import { defaultLanguage, readLanguage, writeLanguage } from './language';

const storage = (value: string | null) => ({ getItem: () => value, setItem: () => undefined });
const broken = {
  getItem: (): string | null => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('the language of the explanations', () => {
  it.each([
    [['ru-RU', 'en'], 'ru'],
    [['cs'], 'cs'],
    [['en-US', 'ru'], 'en'],
    [['de-DE', 'cs-CZ', 'ru'], 'cs'],
    [['de', 'fr'], 'en'],
    [[], 'en'],
    [['RU'], 'ru'],
  ])('is the first of %j we have: %s', (preferred, language) => {
    expect(defaultLanguage(preferred)).toBe(language);
  });

  it("is the one chosen before, over the browser's", () => {
    expect(readLanguage(['ru'], storage('cs'))).toBe('cs');
  });

  it("is the browser's when nothing or something unknown was saved", () => {
    expect(readLanguage(['ru'], storage(null))).toBe('ru');
    expect(readLanguage(['ru'], storage('de'))).toBe('ru');
  });

  it("is the browser's when the storage is blocked, and saving does not break", () => {
    expect(readLanguage(['cs'], broken)).toBe('cs');
    expect(() => writeLanguage('en', broken)).not.toThrow();
  });

  it('is saved for next time', () => {
    const saved: Record<string, string> = {};
    writeLanguage('cs', { setItem: (key, value) => void (saved[key] = value) });

    expect(saved).toEqual({ 'chess-review.language': 'cs' });
  });
});
