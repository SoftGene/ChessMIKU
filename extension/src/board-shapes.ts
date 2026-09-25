import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { squareMark } from './icons';

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
}

/** The best-move arrow (when hints are on) and the class of the last move, as chessground shapes. */
export function boardShapes(position: BoardPosition, hints: boolean): DrawShape[] {
  const shapes: DrawShape[] = [];
  if (hints && position.hint) {
    shapes.push({ orig: position.hint[0] as Key, dest: position.hint[1] as Key, brush: 'hint' });
  }
  if (hints && position.second) {
    shapes.push({ orig: position.second[0] as Key, dest: position.second[1] as Key, brush: 'second' });
  }
  const mark = position.mark && position.lastMove ? squareMark(position.mark) : null;
  if (mark && position.lastMove) {
    shapes.push({ orig: position.lastMove[1] as Key, customSvg: { html: mark } });
  }
  return shapes;
}
