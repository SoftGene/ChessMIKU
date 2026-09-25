import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LANGUAGES } from './backend-messages';
import type { CardState } from './backend-review';
import { cardMessage, cardTitle, className, noMistakesText } from './card-text';

const contract = readFileSync(join(import.meta.dirname, '../../contracts/api.yaml'), 'utf8');
const CLASSES = /Classification:\s*\n\s*type: string\s*\n\s*enum: \[([^\]]+)\]/.exec(contract)![1].split(',').map((c) => c.trim());

const STATES: Exclude<CardState, { kind: 'ready' }>[] = [
  { kind: 'waiting-engine' },
  { kind: 'no-engine' },
  { kind: 'asking' },
  { kind: 'writing', waitedSeconds: 0 },
  { kind: 'writing', waitedSeconds: 80 },
  { kind: 'unreachable' },
  { kind: 'quota', retryAfterSeconds: 18_000 },
  { kind: 'busy', retryAfterSeconds: 40 },
  { kind: 'rejected' },
  { kind: 'failed' },
  { kind: 'timeout' },
];

describe('the texts of the card', () => {
  it.each(LANGUAGES)('say every state in %s, each its own way', (language) => {
    const texts = STATES.map((state) => cardMessage(language, state));

    expect(texts.every((text) => text.length > 10)).toBe(true);
    expect(new Set(texts).size).toBe(STATES.length);
  });

  it('say the explanations failed in each language', () => {
    expect(LANGUAGES.map((language) => cardMessage(language, { kind: 'failed' }))).toEqual([
      'Объяснения в этот раз не получились. Откройте разбор позже — попробуем снова.',
      'Vysvětlení se tentokrát nepovedla. Otevřete rozbor později — zkusíme to znovu.',
      'The explanations could not be written this time. Open the review later to try again.',
    ]);
  });

  it('count the hours to the renewal of the quota up, and say when it is under an hour', () => {
    expect(cardMessage('ru', { kind: 'quota', retryAfterSeconds: 18_000 })).toContain('примерно через 5 ч');
    expect(cardMessage('ru', { kind: 'quota', retryAfterSeconds: 3601 })).toContain('примерно через 2 ч');
    expect(cardMessage('ru', { kind: 'quota', retryAfterSeconds: 1800 })).toContain('меньше чем через час');
    expect(cardMessage('cs', { kind: 'quota', retryAfterSeconds: 1800 })).toContain('za méně než hodinu');
    expect(cardMessage('en', { kind: 'quota', retryAfterSeconds: 7200 })).toContain('in about 2 h');
  });

  it('say how long the explanations have been written, and why it may take long, after half a minute', () => {
    expect(LANGUAGES.map((language) => cardMessage(language, { kind: 'writing', waitedSeconds: 29 }))).toEqual([
      'Пишем объяснения ключевых моментов…',
      'Píšeme vysvětlení klíčových momentů…',
      'Writing explanations of the key moments…',
    ]);
    expect(LANGUAGES.map((language) => cardMessage(language, { kind: 'writing', waitedSeconds: 80 }))).toEqual([
      'Пишем объяснения ключевых моментов… Уже 1:20. Модель бывает перегружена — это может занять несколько минут.',
      'Píšeme vysvětlení klíčových momentů… Už 1:20. Model bývá přetížený — může to trvat několik minut.',
      'Writing explanations of the key moments… 1:20 so far. The model is sometimes overloaded — this can take a few minutes.',
    ]);
    expect(cardMessage('en', { kind: 'writing', waitedSeconds: 305 })).toContain('5:05 so far');
  });

  it('say how long a busy server asks to wait', () => {
    expect(cardMessage('en', { kind: 'busy', retryAfterSeconds: 40 })).toBe('The server is busy. Try again in 40 s.');
  });

  it('name the classes in the language of the explanations', () => {
    expect(LANGUAGES.map((language) => className(language, 'blunder'))).toEqual(['зевок', 'hrubá chyba', 'blunder']);
    expect(className('ru', 'forced')).toBe('forced');
  });

  it('name great and brilliant moves ahead of the backend', () => {
    expect(LANGUAGES.map((language) => [className(language, 'great'), className(language, 'brilliant')])).toEqual([
      ['сильный', 'блестящий'],
      ['skvělý', 'brilantní'],
      ['great', 'brilliant'],
    ]);
  });

  it.each(['ru', 'cs'] as const)('name every class of the contract in %s', (language) => {
    expect(CLASSES.filter((cls) => className(language, cls) === cls)).toEqual([]);
  });

  it('have a title and a line for a game without mistakes', () => {
    expect(LANGUAGES.map(cardTitle)).toEqual(['Ключевые моменты', 'Klíčové momenty', 'Key moments']);
    expect(noMistakesText('ru')).toBe('В партии нет ошибок — объяснять нечего.');
  });
});
