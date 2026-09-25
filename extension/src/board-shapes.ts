import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { mateMark, squareMark } from './icons';

/** What the board shows at one moment of the game. */
export interface BoardPosition {
  fen: string;
  lastMove?: [string, string];
  check: boolean;
  /** The class of the move that led here, drawn on the square it went to. */
  mark?: string;
  /** The engine's best move from here. */
  hint?: [string, string];
  /** The second-best move, in the player's line. */
  second?: [string, string];
  /** On a mate, the squares of the mated king and of the winner's king. */
  mate?: { mated: string; winner: string };
}

/**
 * The arrows (when hints are on), the class of the last move and the marks of a mate, as chessground shapes. The
 * marks carry the position, so that each move's marks are new to chessground and pop up (icons.ts).
 */
export function boardShapes(position: BoardPosition, hints: boolean): DrawShape[] {
  const shapes: DrawShape[] = [];
  if (hints && position.hint) {
    shapes.push({ orig: position.hint[0] as Key, dest: position.hint[1] as Key, brush: 'hint' });
  }
  if (hints && position.second) {
    shapes.push({ orig: position.second[0] as Key, dest: position.second[1] as Key, brush: 'second' });
  }
  const mark = position.mark && position.lastMove ? squareMark(position.mark, position.fen) : null;
  if (mark && position.lastMove) {
    shapes.push({ orig: position.lastMove[1] as Key, customSvg: { html: mark } });
  }
  if (position.mate) {
    shapes.push({ orig: position.mate.mated as Key, customSvg: { html: mateMark('mated', position.fen) } });
    // A king that mates by its own move has the class of the move on its square: the crown gives way to it.
    if (!(mark && position.lastMove?.[1] === position.mate.winner)) {
      shapes.push({ orig: position.mate.winner as Key, customSvg: { html: mateMark('winner', position.fen) } });
    }
  }
  return shapes;
}
