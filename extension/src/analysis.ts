import { Chess } from 'chess.js';
import { fenAt, type Game } from './game';
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

/** The evaluation of one position of the game: its score for the side to move, and its best move if it has one. */
export interface PositionEvaluation {
  score: Score;
  bestMoveUci?: string;
}

/** Told as each position is evaluated, in whatever order: its index (0 is the start), its evaluation, how many are done. */
export type OnPosition = (index: number, evaluation: PositionEvaluation, done: number, total: number) => void;

/**
 * Evaluates every move of a game. Each position is searched once: its score is the score before
 * the move played from it, and, with the sign flipped, the score after the move that led to it.
 */
export async function analyseGame(game: Game, evaluate: Evaluate, onPosition?: OnPosition): Promise<MoveEvaluation[]> {
  if (game.plies.length === 0) {
    return [];
  }

  // Every position is asked at once, so that several engines can search in parallel; the answers
  // stay with their positions whatever order they come back in.
  const positions = Array.from({ length: game.plies.length + 1 }, (_, i) => fenAt(game, i));
  let done = 0;
  const evaluations = await Promise.all(
    positions.map(async (fen, index): Promise<PositionEvaluation> => {
      const final = finalScore(fen);
      const evaluation = final ? { score: final } : await evaluate(fen);
      onPosition?.(index, evaluation, ++done, positions.length);
      return evaluation;
    }),
  );

  return movesFrom(game, evaluations);
}

/** The moves of a game with their evaluations, from the evaluation of each of its positions (0 is the start). */
export function movesFrom(game: Game, positions: readonly PositionEvaluation[]): MoveEvaluation[] {
  return game.plies.map((ply, i) => {
    const before = positions[i].score;
    const after = flip(positions[i + 1].score);
    return {
      ply: ply.ply,
      san: ply.san,
      uci: ply.uci,
      // A move was played from this position, so it had moves and the engine searched it.
      bestMoveUci: positions[i].bestMoveUci!,
      evalBeforeCp: 'cp' in before ? before.cp : null,
      mateBefore: 'mate' in before ? before.mate : null,
      evalAfterCp: 'cp' in after ? after.cp : null,
      mateAfter: 'mate' in after ? after.mate : null,
    };
  });
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
