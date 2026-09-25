import { describe, expect, it } from 'vitest';
import { readGame } from './game';
import { statusText } from './status';

const game = readGame('1. e4 *');

describe('statusText', () => {
  it('says what it looks for, and that an older game takes longer', () => {
    expect(statusText({ stage: 'looking-up' })).toBe('Looking up the game in the chess.com archive… An older game takes a few seconds.');
  });

  it('says the game is not in the archive', () => {
    expect(statusText({ stage: 'not-found' })).toBe('This game is not in the chess.com archive. A game that has just ended appears there within a few minutes.');
  });

  it('says the engine could not start, and why, while the game stays on the board', () => {
    expect(statusText({ stage: 'engine-failed', game, reason: 'no answer in 10 s' }))
      .toBe('The engine could not start, so there are no evaluations. The chess.com page is not affected. Reason: no answer in 10 s.');
  });

  it('counts the positions while it analyses', () => {
    expect(statusText({ stage: 'analysing', game, index: 0, evaluation: { score: { cp: 0 } }, done: 3, total: 90 })).toBe('Analysing position 3 of 90…');
  });

  it('says how many moves it analysed, and when they were saved earlier', () => {
    expect(statusText({ stage: 'done', game, pgn: '', moves: [], positions: [], cached: false })).toBe('Analysed 0 moves.');
    expect(statusText({ stage: 'done', game, pgn: '', moves: [], positions: [], cached: true })).toBe('Analysed 0 moves (saved in this browser).');
  });

  it('says why the review failed', () => {
    expect(statusText({ stage: 'failed', reason: 'The engine stopped: RuntimeError: unreachable' })).toBe('The review failed. The engine stopped: RuntimeError: unreachable');
  });
});
