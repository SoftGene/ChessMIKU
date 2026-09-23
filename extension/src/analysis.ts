import { Chess } from 'chess.js';
import type { Evaluation, Score } from './uci';

/** One half-move with the engine's evaluations, in the shape of `MoveEvaluation` in contracts/api.yaml. */
export interface MoveEvaluation {
  ply: number;
  san: string;
  uci: string;
  bestMoveUci: string;
  evalBeforeCp: number | null;
  mateBefore: number | null;
  evalAfterCp: number | null;
  mateAfter: number | null;
}

/** Evaluates one position given in FEN. */
export type Evaluate = (fen: string) => Promise<Evaluation>;

/**
 * Evaluates every move of a game. Each position is searched once: its score is the score before
 * the move played from it, and, with the sign flipped, the score after the move that led to it.
 */
export async function analyseGame(pgn: string, evaluate: Evaluate, onProgress?: (done: number, total: number) => void): Promise<MoveEvaluation[]> {
  const moves = readMoves(pgn);
  if (moves.length === 0) {
    return [];
  }

  // Every position is asked at once, so that several engines can search in parallel; the answers
  // stay with their positions whatever order they come back in.
  const positions = [moves[0].before, ...moves.map((move) => move.after)];
  let done = 0;
  const evaluations = await Promise.all(
    positions.map(async (fen): Promise<{ score: Score; bestMoveUci?: string }> => {
      const final = finalScore(fen);
      const evaluation = final ? { score: final } : await evaluate(fen);
      onProgress?.(++done, positions.length);
      return evaluation;
    }),
  );

  return moves.map((move, i) => {
    const before = evaluations[i].score;
    const after = flip(evaluations[i + 1].score);
    return {
      ply: i + 1,
      san: move.san,
      uci: move.lan,
      // A move was played from this position, so it had moves and the engine searched it.
      bestMoveUci: evaluations[i].bestMoveUci!,
      evalBeforeCp: 'cp' in before ? before.cp : null,
      mateBefore: 'mate' in before ? before.mate : null,
      evalAfterCp: 'cp' in after ? after.cp : null,
      mateAfter: 'mate' in after ? after.mate : null,
    };
  });
}

function readMoves(pgn: string) {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch (error) {
    throw new Error(`The game could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }
  return chess.history({ verbose: true });
}

// A position without a move has nothing to search: the side to move is mated (the move that led
// here delivered mate, contract: mateAfter 0), or it is stalemate, a draw.
function finalScore(fen: string): Score | null {
  const chess = new Chess(fen);
  if (chess.moves().length > 0) {
    return null;
  }
  return chess.isCheckmate() ? { mate: 0 } : { cp: 0 };
}

// The engine scores a position for the side to move; after a move that is the opponent.
// `0 - x` rather than `-x`: a level score stays 0, not -0.
function flip(score: Score): Score {
  return 'cp' in score ? { cp: 0 - score.cp } : { mate: 0 - score.mate };
}
