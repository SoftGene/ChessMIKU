import { describe, it, expect } from 'vitest';
import { parsePgn } from './pgn-parser';

describe('PGN Parser', () => {
  it('should parse valid PGN into moves array', () => {
    const pgn = '[Event "Test"]\n1. e4 e5 2. Nf3 Nc6';
    const moves = parsePgn(pgn);
    
    expect(moves.length).toBe(4);
    expect(moves[0].san).toBe('e4');
    expect(moves[0].color).toBe('w');
    expect(moves[1].san).toBe('e5');
    expect(moves[1].color).toBe('b');
    expect(moves[2].san).toBe('Nf3');
    expect(moves[3].san).toBe('Nc6');
    expect(moves[3].fen).toContain('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R');
  });

  it('should return empty array for invalid PGN', () => {
    const moves = parsePgn('invalid pgn data');
    expect(moves).toEqual([]);
  });
});
