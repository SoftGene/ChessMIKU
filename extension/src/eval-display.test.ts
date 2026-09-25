import { describe, expect, it } from 'vitest';
import { evalText, sideToMove, toWhiteEval, whiteShare } from './eval-display';

describe('toWhiteEval', () => {
  it('keeps a score of White to move', () => {
    expect(toWhiteEval({ cp: 30 }, 'w')).toEqual({ cp: 30 });
  });

  it('turns a score of Black to move to White', () => {
    expect(toWhiteEval({ cp: 30 }, 'b')).toEqual({ cp: -30 });
  });

  it('keeps a level score 0, not -0', () => {
    expect((toWhiteEval({ cp: 0 }, 'b') as { cp: number }).cp).toBe(0);
  });

  it('names who mates: the side to move with a positive mate', () => {
    expect(toWhiteEval({ mate: 2 }, 'w')).toEqual({ mateIn: 2, winner: 'white' });
    expect(toWhiteEval({ mate: 2 }, 'b')).toEqual({ mateIn: 2, winner: 'black' });
  });

  it('names who mates: the other side with a negative mate', () => {
    expect(toWhiteEval({ mate: -3 }, 'w')).toEqual({ mateIn: 3, winner: 'black' });
  });

  it('gives a mated board to the side that mated', () => {
    // mate 0: the side to move is mated.
    expect(toWhiteEval({ mate: 0 }, 'b')).toEqual({ mateIn: 0, winner: 'white' });
    expect(toWhiteEval({ mate: 0 }, 'w')).toEqual({ mateIn: 0, winner: 'black' });
  });
});

describe('evalText', () => {
  it.each([
    [{ cp: 130 }, '+1.3'],
    [{ cp: -45 }, '-0.4'],
    [{ cp: -4 }, '0.0'],
    [{ cp: 0 }, '0.0'],
    [{ mateIn: 3, winner: 'white' as const }, '#3'],
    [{ mateIn: 2, winner: 'black' as const }, '-#2'],
    [{ mateIn: 0, winner: 'white' as const }, '1-0'],
    [{ mateIn: 0, winner: 'black' as const }, '0-1'],
  ])('writes %j as %s', (value, text) => {
    expect(evalText(value)).toBe(text);
  });
});

describe('whiteShare', () => {
  it('is half for a level position', () => {
    expect(whiteShare({ cp: 0 })).toBe(0.5);
  });

  it('follows the win-chance curve: +3 pawns is three quarters', () => {
    expect(whiteShare({ cp: 300 })).toBeCloseTo(0.751, 3);
    expect(whiteShare({ cp: -300 })).toBeCloseTo(0.249, 3);
  });

  it('is all of the bar for the side that mates', () => {
    expect(whiteShare({ mateIn: 4, winner: 'white' })).toBe(1);
    expect(whiteShare({ mateIn: 4, winner: 'black' })).toBe(0);
  });
});

describe('sideToMove', () => {
  it('reads the side to move from a FEN', () => {
    expect(sideToMove('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')).toBe('b');
    expect(sideToMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe('w');
  });
});
