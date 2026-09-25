import { describe, expect, it } from 'vitest';
import { readLines, readSearch } from './uci';

// Lines in the form of the UCI protocol as Stockfish prints them.
describe('readSearch', () => {
  it('takes the best move and the score of the deepest line', () => {
    const lines = [
      'info depth 1 seldepth 2 multipv 1 score cp 17 nodes 20 nps 20000 hashfull 0 tbhits 0 time 1 pv e2e4',
      'info depth 2 seldepth 3 multipv 1 score cp 30 nodes 60 nps 30000 hashfull 0 tbhits 0 time 2 pv d2d4 d7d5',
      'bestmove d2d4 ponder d7d5',
    ];

    expect(readSearch(lines)).toEqual({ bestMoveUci: 'd2d4', score: { cp: 30 } });
  });

  it('skips a line that reports only a bound of the score', () => {
    const lines = [
      'info depth 9 seldepth 12 multipv 1 score cp 25 nodes 4000 nps 200000 hashfull 1 tbhits 0 time 20 pv e2e4 e7e5',
      'info depth 10 seldepth 14 multipv 1 score cp 41 lowerbound nodes 5000 nps 200000 hashfull 1 tbhits 0 time 25 pv e2e4',
      'info depth 10 seldepth 14 multipv 1 score cp 12 upperbound nodes 5100 nps 200000 hashfull 1 tbhits 0 time 26 pv e2e4',
      'bestmove e2e4 ponder e7e5',
    ];

    expect(readSearch(lines)).toEqual({ bestMoveUci: 'e2e4', score: { cp: 25 } });
  });

  it('reads a mate for the side to move', () => {
    const lines = ['info depth 5 seldepth 4 multipv 1 score mate 2 nodes 900 nps 90000 hashfull 0 tbhits 0 time 10 pv h5f7 e8e7 f7e6', 'bestmove h5f7'];

    expect(readSearch(lines)).toEqual({ bestMoveUci: 'h5f7', score: { mate: 2 } });
  });

  it('reads a mate against the side to move', () => {
    const lines = ['info depth 7 seldepth 6 multipv 1 score mate -3 nodes 900 nps 90000 hashfull 0 tbhits 0 time 10 pv g8f8 h5f7', 'bestmove g8f8 ponder h5f7'];

    expect(readSearch(lines)).toEqual({ bestMoveUci: 'g8f8', score: { mate: -3 } });
  });

  it('ignores info strings and other lines of a multi-line search', () => {
    const lines = [
      'info string NNUE evaluation using nn-61e7af4bb97d.nnue enabled',
      'info depth 4 seldepth 5 multipv 1 score cp -20 nodes 300 nps 30000 hashfull 0 tbhits 0 time 10 pv g1f3',
      'info depth 4 seldepth 5 multipv 2 score cp -95 nodes 300 nps 30000 hashfull 0 tbhits 0 time 10 pv b1a3',
      'bestmove g1f3',
    ];

    expect(readSearch(lines)).toEqual({ bestMoveUci: 'g1f3', score: { cp: -20 } });
  });

  it('reads the score when win, draw and loss chances follow it', () => {
    const lines = ['info depth 8 seldepth 10 multipv 1 score cp 28 wdl 60 910 30 nodes 900 nps 90000 hashfull 0 tbhits 0 time 10 pv e2e4', 'bestmove e2e4'];

    expect(readSearch(lines)).toEqual({ bestMoveUci: 'e2e4', score: { cp: 28 } });
  });

  it('keeps the promotion piece of the best move', () => {
    const lines = ['info depth 6 seldepth 7 multipv 1 score cp 850 nodes 900 nps 90000 hashfull 0 tbhits 0 time 10 pv e7e8q', 'bestmove e7e8q'];

    expect(readSearch(lines)).toEqual({ bestMoveUci: 'e7e8q', score: { cp: 850 } });
  });

  it('fails when the engine found no move', () => {
    expect(() => readSearch(['info depth 0 score mate 0', 'bestmove (none)'])).toThrow(/no move/);
  });

  it('fails when the engine gave no score', () => {
    expect(() => readSearch(['info string ready', 'bestmove e2e4'])).toThrow(/no score/);
  });

  it('fails when the search has not ended', () => {
    expect(() => readSearch(['info depth 1 seldepth 2 multipv 1 score cp 17 nodes 20 time 1 pv e2e4'])).toThrow(/no move/);
  });
});

// Stockfish 19 with MultiPV 2: each depth reports both lines; the last complete report of each counts.
const TWO_LINES = [
  'info string NNUE evaluation using nn-37f18f62d772.nnue enabled',
  'info depth 10 seldepth 13 multipv 1 score cp 35 nodes 12000 nps 400000 hashfull 3 tbhits 0 time 30 pv e2e4 e7e5 g1f3',
  'info depth 10 seldepth 12 multipv 2 score cp 28 nodes 12000 nps 400000 hashfull 3 tbhits 0 time 30 pv d2d4 d7d5',
  'info depth 11 seldepth 15 multipv 1 score cp 31 nodes 25000 nps 410000 hashfull 6 tbhits 0 time 61 pv e2e4 c7c5',
  'info depth 11 seldepth 14 multipv 2 score cp 29 upperbound nodes 25500 nps 410000 hashfull 6 tbhits 0 time 62 pv d2d4',
  'info depth 11 seldepth 14 multipv 2 score cp 24 nodes 26000 nps 410000 hashfull 6 tbhits 0 time 63 pv g1f3 d7d5',
  'info depth 12 currmove e2e4 currmovenumber 1',
  'bestmove e2e4 ponder c7c5',
];

describe('readLines', () => {
  it('takes the last complete report of each line, best first', () => {
    expect(readLines(TWO_LINES)).toEqual([
      { moveUci: 'e2e4', score: { cp: 31 } },
      { moveUci: 'g1f3', score: { cp: 24 } },
    ]);
  });

  it('reads a mate in a line', () => {
    const lines = [
      'info depth 8 seldepth 6 multipv 2 score cp 150 nodes 900 nps 90000 tbhits 0 time 10 pv d1d8 e8d8',
      'info depth 8 seldepth 4 multipv 1 score mate 2 nodes 900 nps 90000 tbhits 0 time 10 pv h5f7 e8e7 f7e6',
      'bestmove h5f7',
    ];

    expect(readLines(lines)).toEqual([
      { moveUci: 'h5f7', score: { mate: 2 } },
      { moveUci: 'd1d8', score: { cp: 150 } },
    ]);
  });

  it('gives one line when the position has one move', () => {
    const lines = ['info depth 20 seldepth 2 multipv 1 score cp -410 nodes 40 nps 20000 tbhits 0 time 2 pv e8f7', 'bestmove e8f7'];

    expect(readLines(lines)).toEqual([{ moveUci: 'e8f7', score: { cp: -410 } }]);
  });

  it('gives no line for a position without moves', () => {
    expect(readLines(['info depth 0 score mate 0', 'bestmove (none)'])).toEqual([]);
  });
});
