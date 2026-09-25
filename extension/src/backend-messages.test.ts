import { describe, expect, it } from 'vitest';
import { ANALYSE, EXPLANATIONS, isAnalyseMessage, isExplanationsMessage, isLanguage } from './backend-messages';

const move = { ply: 1, san: 'e4', uci: 'e2e4', bestMoveUci: 'e2e4', evalBeforeCp: 30, mateBefore: null, evalAfterCp: 30, mateAfter: null };
const analyse = { type: ANALYSE, externalGameId: 'live/173765478164', pgn: '1. e4 1-0', language: 'ru', moves: [move] };

describe('isAnalyseMessage', () => {
  it('takes a game with its evaluations in the agreed form', () => {
    expect(isAnalyseMessage(analyse)).toBe(true);
    expect(isAnalyseMessage({ ...analyse, externalGameId: 'daily/987654321', language: 'cs' })).toBe(true);
  });

  it.each([
    ['another type', { type: 'chess-review/find-finished-game' }],
    ['a game number with letters', { externalGameId: 'live/12a' }],
    ['a game of an unknown kind', { externalGameId: 'correspondence/1' }],
    ['an empty PGN', { pgn: '' }],
    ['a PGN over 64 KB', { pgn: 'x'.repeat(65537) }],
    ['an unknown language', { language: 'de' }],
    ['no moves', { moves: [] }],
    ['over 1000 moves', { moves: Array(1001).fill(move) }],
    ['a move without its number', { moves: [{ san: 'e4' }] }],
  ])('turns away %s', (_what, change) => {
    expect(isAnalyseMessage({ ...analyse, ...change })).toBe(false);
  });

  it('turns away no message at all', () => {
    expect(isAnalyseMessage(undefined)).toBe(false);
    expect(isAnalyseMessage(null)).toBe(false);
  });
});

describe('isExplanationsMessage', () => {
  it('takes an analysis id', () => {
    expect(isExplanationsMessage({ type: EXPLANATIONS, analysisId: '3f2b8c1e-5d4a-4e7b-9c61-0a8d2f4b7e19' })).toBe(true);
  });

  it.each(['3f2b8c1e', 'not-a-uuid-not-a-uuid-not-a-uuid-xx', '../installs'])('turns away the id %s', (analysisId) => {
    expect(isExplanationsMessage({ type: EXPLANATIONS, analysisId })).toBe(false);
  });

  it('turns away another type', () => {
    expect(isExplanationsMessage({ type: ANALYSE, analysisId: '3f2b8c1e-5d4a-4e7b-9c61-0a8d2f4b7e19' })).toBe(false);
  });
});

describe('isLanguage', () => {
  it('knows the three languages of the contract', () => {
    expect(['ru', 'cs', 'en', 'de', 'RU', '', undefined].map(isLanguage)).toEqual([true, true, true, false, false, false, false]);
  });
});
