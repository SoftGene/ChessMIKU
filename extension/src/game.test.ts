import { describe, expect, it } from 'vitest';
import archive from '../test/fixtures/archive-hikaru-2026-08.json';
import { fenAt, readGame } from './game';

// Hikaru - poohineedyou, 89 half-moves, ended in checkmate (a real archive answer).
const HIKARU = archive.games.find((g) => g.url.endsWith('/173765478164'))!.pgn;
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('readGame', () => {
  it('reads the players, their ratings, the result and the date', () => {
    expect(readGame(HIKARU).headers).toEqual({ white: 'Hikaru', black: 'poohineedyou', whiteElo: '3370', blackElo: '2997', result: '1-0', date: '2026.08.30' });
  });

  it('gives each half-move its number, SAN, UCI and squares', () => {
    const { plies } = readGame(HIKARU);

    expect(plies).toHaveLength(89);
    expect(plies[0]).toMatchObject({ ply: 1, san: 'b3', uci: 'b2b3', from: 'b2', to: 'b3', color: 'w' });
    expect(plies[88]).toMatchObject({ ply: 89, san: 'Rh8#', uci: 'h7h8', from: 'h7', to: 'h8', color: 'w' });
  });

  it('marks captures, castling, checks and mate', () => {
    const { plies } = readGame(HIKARU);
    const kinds = (n: number) => ({ capture: plies[n - 1].capture, castle: plies[n - 1].castle, check: plies[n - 1].check, mate: plies[n - 1].mate });

    expect(kinds(1)).toEqual({ capture: false, castle: false, check: false, mate: false });
    expect(kinds(12)).toEqual({ capture: false, castle: true, check: false, mate: false });
    expect(kinds(19)).toEqual({ capture: true, castle: false, check: false, mate: false });
    expect(kinds(71)).toEqual({ capture: true, castle: false, check: true, mate: false });
    expect(kinds(89)).toEqual({ capture: false, castle: false, check: false, mate: true });
  });

  it('counts an en passant capture as a capture', () => {
    const { plies } = readGame('1. e4 a6 2. e5 d5 3. exd6');

    expect([plies[4].san, plies[4].capture]).toEqual(['exd6', true]);
  });

  it('knows every position: the start, and after each half-move', () => {
    const game = readGame(HIKARU);

    expect(fenAt(game, 0)).toBe(START);
    expect(fenAt(game, 1)).toBe(game.plies[1].fenBefore);
    expect(fenAt(game, 89)).toBe('3rrk1R/R7/8/8/1P5P/P2p2P1/5P2/6K1 b - - 1 45');
  });

  it('starts from the position a PGN sets up', () => {
    const game = readGame('[SetUp "1"]\n[FEN "k7/8/1Q6/8/8/8/8/7K w - - 0 1"]\n\n1. Qc7 1/2-1/2');

    expect(game.startFen).toBe('k7/8/1Q6/8/8/8/8/7K w - - 0 1');
    expect(game.plies[0]).toMatchObject({ san: 'Qc7', uci: 'b6c7' });
  });

  it('has the start and no half-moves for a game without moves', () => {
    const game = readGame('[Event "Aborted"]\n\n*');

    expect(game.plies).toEqual([]);
    expect(game.startFen).toBe(START);
  });

  it('leaves out the headers a PGN does not give', () => {
    expect(readGame('1. e4 *').headers).toMatchObject({ whiteElo: null, blackElo: null, date: null });
  });

  it('fails on a PGN with an impossible move', () => {
    expect(() => readGame('1. e4 e5 2. Ke3 *')).toThrow(/could not be read/);
  });
});
