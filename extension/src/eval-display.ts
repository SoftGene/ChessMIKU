import type { Score } from './uci';

/** An evaluation from White's point of view: centipawns, or who mates in how many moves (0: mate on the board). */
export type WhiteEval = { cp: number } | { mateIn: number; winner: 'white' | 'black' };

/** The engine scores the side to move; the window shows White's point of view. */
export function toWhiteEval(score: Score, sideToMove: 'w' | 'b'): WhiteEval {
  const mover = sideToMove === 'w' ? 'white' : 'black';
  const other = sideToMove === 'w' ? 'black' : 'white';
  if ('cp' in score) {
    // 0 - x, not -x: a level score stays 0.
    return { cp: sideToMove === 'w' ? score.cp : 0 - score.cp };
  }
  // mate > 0: the side to move mates; < 0: it is mated; 0: it is mated on the board.
  return { mateIn: Math.abs(score.mate), winner: score.mate > 0 ? mover : other };
}

/** "+1.3", "-0.4", "0.0"; "#3" when White mates, "-#2" when Black does; "1-0" or "0-1" on a mated board. */
export function evalText(value: WhiteEval): string {
  if ('cp' in value) {
    const pawns = Math.round(value.cp / 10) / 10;
    return pawns === 0 ? '0.0' : `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`;
  }
  if (value.mateIn === 0) {
    return value.winner === 'white' ? '1-0' : '0-1';
  }
  return `${value.winner === 'white' ? '' : '-'}#${value.mateIn}`;
}

/**
 * White's share of the evaluation bar and graph, 0 to 1: the win-chance curve Lichess publishes. Only for
 * drawing; classes of moves are the backend's (spec, section 6).
 */
export function whiteShare(value: WhiteEval): number {
  if ('mateIn' in value) {
    return value.winner === 'white' ? 1 : 0;
  }
  return 1 / (1 + Math.exp(-0.00368208 * value.cp));
}

/** The side to move in a FEN. */
export function sideToMove(fen: string): 'w' | 'b' {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}
