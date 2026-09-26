import { describe, expect, it } from 'vitest';
import archive from '../test/fixtures/archive-hikaru-2026-08.json';
import { analyseGame, movesFrom, type Evaluate, type PositionEvaluation } from './analysis';
import { readGame } from './game';
import type { Evaluation } from './uci';

const cp = (bestMoveUci: string, value: number): Evaluation => ({ bestMoveUci, score: { cp: value } });
const mate = (bestMoveUci: string, value: number): Evaluation => ({ bestMoveUci, score: { mate: value } });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// A stand-in for the engine: answers positions in the order they are asked, and remembers them.
function engine(answers: Evaluation[]) {
  const asked: string[] = [];
  const evaluate: Evaluate = async (fen) => {
    asked.push(fen);
    const answer = answers[asked.length - 1];
    if (!answer) {
      throw new Error(`No answer for position ${asked.length}: ${fen}`);
    }
    return answer;
  };
  return { asked, evaluate };
}

// An engine the test answers by hand, in any order.
function manualEngine() {
  const asked: string[] = [];
  const answers: ((evaluation: Evaluation) => void)[] = [];
  const evaluate: Evaluate = (fen) => {
    asked.push(fen);
    return new Promise((answer) => answers.push(answer));
  };
  return { asked, answers, evaluate };
}

const FOOLS_MATE = readGame('1. f3 e5 2. g4 Qh4# 0-1');
const FOOLS_MATE_ANSWERS = [cp('e2e4', 30), cp('e7e5', 90), cp('g1f3', -100), mate('d8h4', 1)];

describe('analyseGame', () => {
  it('asks the engine about every position that has a move, in the order of the game', async () => {
    const { asked, evaluate } = engine(FOOLS_MATE_ANSWERS);

    await analyseGame(FOOLS_MATE, evaluate);

    // The final position is checkmate: there is nothing to search, so it is not asked.
    expect(asked).toEqual([
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1',
      'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2',
      'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
    ]);
  });

  it('evaluates each move from the side that made it', async () => {
    const { evaluate } = engine(FOOLS_MATE_ANSWERS);

    // Before a move: the position before it, as the engine sees it for the side to move.
    // After a move: the next position, where the opponent is to move, so the sign is flipped.
    expect(await analyseGame(FOOLS_MATE, evaluate)).toEqual([
      { ply: 1, san: 'f3', uci: 'f2f3', bestMoveUci: 'e2e4', evalBeforeCp: 30, mateBefore: null, evalAfterCp: -90, mateAfter: null, secondBestEvalCp: null, secondBestMate: null },
      { ply: 2, san: 'e5', uci: 'e7e5', bestMoveUci: 'e7e5', evalBeforeCp: 90, mateBefore: null, evalAfterCp: 100, mateAfter: null, secondBestEvalCp: null, secondBestMate: null },
      { ply: 3, san: 'g4', uci: 'g2g4', bestMoveUci: 'g1f3', evalBeforeCp: -100, mateBefore: null, evalAfterCp: null, mateAfter: -1, secondBestEvalCp: null, secondBestMate: null },
      { ply: 4, san: 'Qh4#', uci: 'd8h4', bestMoveUci: 'd8h4', evalBeforeCp: null, mateBefore: 1, evalAfterCp: null, mateAfter: 0, secondBestEvalCp: null, secondBestMate: null },
    ]);
  });

  it('asks about every position at once and keeps each answer with its position, whatever their order', async () => {
    const { asked, answers, evaluate } = manualEngine();

    const analysing = analyseGame(FOOLS_MATE, evaluate);
    await settle();

    // Several engines can search in parallel only if no search waits for the one before it.
    expect(asked).toHaveLength(4);
    for (const i of [3, 1, 0, 2]) {
      answers[i](FOOLS_MATE_ANSWERS[i]);
    }
    expect((await analysing).map((m) => [m.ply, m.bestMoveUci, m.evalBeforeCp ?? `#${m.mateBefore}`])).toEqual([
      [1, 'e2e4', 30],
      [2, 'e7e5', 90],
      [3, 'g1f3', -100],
      [4, 'd8h4', '#1'],
    ]);
  });

  it('tells each position as it is evaluated: its index, its evaluation, how many are done', async () => {
    const { answers, evaluate } = manualEngine();
    const told: [number, string, number, number][] = [];
    const score = (e: { score: { cp: number } | { mate: number } }) => ('cp' in e.score ? String(e.score.cp) : `#${e.score.mate}`);

    const analysing = analyseGame(FOOLS_MATE, evaluate, (index, evaluation, done, total) => told.push([index, score(evaluation), done, total]));
    await settle();

    // The final position is checkmate: known at once, without the engine.
    expect(told).toEqual([[4, '#0', 1, 5]]);
    for (const i of [2, 0, 3, 1]) {
      answers[i](FOOLS_MATE_ANSWERS[i]);
    }
    await analysing;
    expect(told).toEqual([
      [4, '#0', 1, 5],
      [2, '-100', 2, 5],
      [0, '30', 3, 5],
      [3, '#1', 4, 5],
      [1, '90', 5, 5],
    ]);
  });

  it('writes the second best move of the position before each move, from the side that makes it', async () => {
    const { evaluate } = engine([
      { bestMoveUci: 'e2e4', score: { cp: 30 }, second: { cp: 22 } },
      { bestMoveUci: 'e7e5', score: { cp: 90 }, second: { mate: -3 } },
      { bestMoveUci: 'g1f3', score: { cp: -100 }, second: null },
      mate('d8h4', 1),
    ]);

    const moves = await analyseGame(FOOLS_MATE, evaluate);

    expect(moves.map((move) => [move.secondBestEvalCp, move.secondBestMate])).toEqual([
      [22, null],
      [null, -3],
      [null, null],
      [null, null],
    ]);
  });

  it('marks a move that delivers checkmate with mateAfter 0', async () => {
    const { evaluate } = engine(FOOLS_MATE_ANSWERS);

    const moves = await analyseGame(FOOLS_MATE, evaluate);

    expect(moves[3]).toMatchObject({ san: 'Qh4#', evalAfterCp: null, mateAfter: 0 });
  });

  it('scores stalemate after a move as a draw', async () => {
    const game = readGame('[SetUp "1"]\n[FEN "k7/8/1Q6/8/8/8/8/7K w - - 0 1"]\n\n1. Qc7 1/2-1/2');
    const { asked, evaluate } = engine([cp('b6b7', 1500)]);

    expect(await analyseGame(game, evaluate)).toEqual([
      { ply: 1, san: 'Qc7', uci: 'b6c7', bestMoveUci: 'b6b7', evalBeforeCp: 1500, mateBefore: null, evalAfterCp: 0, mateAfter: null, secondBestEvalCp: null, secondBestMate: null },
    ]);
    expect(asked).toEqual(['k7/8/1Q6/8/8/8/8/7K w - - 0 1']);
  });

  it('turns a level score after a move into 0, not -0', async () => {
    const { evaluate } = engine([cp('e2e4', 20), cp('e7e5', 0)]);

    const [move] = await analyseGame(readGame('1. e4 *'), evaluate);

    expect(move.evalAfterCp).toBe(0);
  });

  it('writes castling and promotion in UCI, as the engine does', async () => {
    const castling = engine(Array.from({ length: 8 }, () => cp('a2a3', 0)));
    const promotion = engine([cp('a7a8q', 900), cp('a1b2', -900)]);

    const castled = await analyseGame(readGame('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O *'), castling.evaluate);
    const promoted = await analyseGame(readGame('[SetUp "1"]\n[FEN "8/P7/8/8/8/8/8/k6K w - - 0 1"]\n\n1. a8=Q+ *'), promotion.evaluate);

    expect(castled[6]).toMatchObject({ san: 'O-O', uci: 'e1g1' });
    expect(promoted[0]).toMatchObject({ san: 'a8=Q+', uci: 'a7a8q' });
  });

  it('reads a game as the chess.com archive gives it, clocks and all', async () => {
    // Hikaru - poohineedyou, 45 moves, ended in checkmate: the same game as on the page in the page tests.
    const game = readGame(archive.games.find((g) => g.url.endsWith('/173765478164'))!.pgn);
    const { asked, evaluate } = engine(Array.from({ length: 89 }, (_, i) => cp('a2a3', i * 10)));

    const moves = await analyseGame(game, evaluate);

    expect(asked).toHaveLength(89);
    expect(moves).toHaveLength(89);
    expect(moves[0]).toMatchObject({ ply: 1, san: 'b3', uci: 'b2b3', evalBeforeCp: 0, evalAfterCp: -10 });
    expect(moves[9]).toMatchObject({ ply: 10, evalBeforeCp: 90, evalAfterCp: -100 });
    expect(moves[88]).toMatchObject({ ply: 89, evalBeforeCp: 880, evalAfterCp: null, mateAfter: 0 });
  });

  it('gives no evaluations for a game without moves and asks nothing', async () => {
    const { asked, evaluate } = engine([]);

    expect(await analyseGame(readGame('[Event "Aborted"]\n\n*'), evaluate)).toEqual([]);
    expect(asked).toEqual([]);
  });

  it('fails when the engine fails', async () => {
    const evaluate: Evaluate = () => Promise.reject(new Error('The engine stopped.'));

    await expect(analyseGame(FOOLS_MATE, evaluate)).rejects.toThrow('The engine stopped.');
  });
});

describe('movesFrom', () => {
  it('rebuilds the moves from the evaluations of the positions, as the analysis gives them', async () => {
    const game = readGame('1. f3 e5 2. g4 Qh4# 0-1');
    const positions: PositionEvaluation[] = [];
    const moves = await analyseGame(game, async (fen) => ({ bestMoveUci: 'e2e4', score: { cp: fen.length % 50 } }), (index, evaluation) => {
      positions[index] = evaluation;
    });

    expect(movesFrom(game, positions)).toEqual(moves);
  });
});
