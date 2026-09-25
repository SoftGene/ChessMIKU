import { describe, expect, it } from 'vitest';
import { gameAccuracy, moveAccuracy, winPercent } from './accuracy';

// The expected numbers were worked out from the published formulas (design T7.1b, section 4), not by this code.

describe('winPercent', () => {
  it("turns an evaluation into White's chances, as Lichess does", () => {
    expect(winPercent({ cp: 0 })).toBe(50);
    expect(winPercent({ cp: -300 })).toBeCloseTo(24.8874, 3);
    expect(winPercent({ cp: 1000 })).toBeCloseTo(97.5447, 3);
  });

  it('takes no evaluation beyond ±10 pawns, and a mate for 10 pawns', () => {
    expect(winPercent({ cp: 5000 })).toBe(winPercent({ cp: 1000 }));
    expect(winPercent({ mateIn: 3, winner: 'white' })).toBe(winPercent({ cp: 1000 }));
    expect(winPercent({ mateIn: 0, winner: 'black' })).toBe(winPercent({ cp: -1000 }));
  });
});

describe('moveAccuracy', () => {
  it('gives 100 to a move that keeps or raises the chances', () => {
    expect(moveAccuracy(50, 50)).toBe(100);
    expect(moveAccuracy(40, 60)).toBe(100);
  });

  it('takes off by how much of the chances the move gave away', () => {
    expect(moveAccuracy(50, 24.887433)).toBeCloseTo(32.3981, 3);
    expect(moveAccuracy(100, 0)).toBe(0);
  });
});

describe('gameAccuracy', () => {
  it('gives 100 to both players when no move gives anything away', () => {
    expect(gameAccuracy([{ cp: 0 }, { cp: 0 }, { cp: 0 }, { cp: 0 }, { cp: 0 }], 'w')).toEqual({ white: 100, black: 100 });
  });

  it('takes the moves of each player by who moves first', () => {
    const evals = [{ cp: 0 }, { cp: -300 }, { cp: -300 }];

    expect(gameAccuracy(evals, 'w').white).toBeCloseTo(32.3981, 3);
    expect(gameAccuracy(evals, 'w').black).toBe(100);
    expect(gameAccuracy(evals, 'b')).toEqual({ white: 100, black: 100 });
  });

  it('weighs the moves by how sharp their moment is, and averages that with the harmonic mean', () => {
    expect(gameAccuracy([{ cp: 0 }, { cp: -300 }, { cp: -300 }, { cp: -600 }], 'w').white).toBeCloseTo(39.77, 2);
  });

  it('gives a move in a calm moment a small weight, not none', () => {
    // White's first move gives away a lot where the game turns (weight 12); the second is exact where nothing moves (0.5).
    expect(gameAccuracy([{ cp: 0 }, { cp: -300 }, { cp: -300 }, { cp: -300 }], 'w').white).toBeCloseTo(42.0213, 3);
  });

  it('has no accuracy for a player without moves', () => {
    expect(gameAccuracy([{ cp: 0 }, { cp: 0 }], 'w')).toEqual({ white: 100, black: null });
    expect(gameAccuracy([{ cp: 0 }], 'w')).toEqual({ white: null, black: null });
  });
});
