import { fenAt, type Game, type Ply } from './game';

export type NavAction = 'first' | 'prev' | 'next' | 'last';

/** The half-move to show after a navigation action; 0 is the start, `last` the final position. */
export function navigate(ply: number, last: number, action: NavAction): number {
  switch (action) {
    case 'first':
      return 0;
    case 'prev':
      return Math.max(0, ply - 1);
    case 'next':
      return Math.min(last, ply + 1);
    case 'last':
      return last;
  }
}

const KEYS: Record<string, NavAction | 'close'> = {
  ArrowLeft: 'prev',
  ArrowRight: 'next',
  Home: 'first',
  End: 'last',
  Escape: 'close',
};

/** What a key does in the window. */
export function keyAction(key: string): NavAction | 'close' | null {
  return KEYS[key] ?? null;
}

/** Where the board is: a position of the game, or of the player's own line that leaves the game there. */
export interface Place {
  /** The half-move of the game shown, or the one the line starts from. */
  ply: number;
  /** The line's moves and the position shown in it: 0 is the game's position at `ply`. */
  line: { moves: Ply[]; at: number } | null;
}

/**
 * A move played on the board. The next move of the line goes along it; at the game's position (outside the line or
 * at its first position) the game's next move goes along the game, another one starts the line; elsewhere another
 * move cuts the rest of the line.
 */
export function playMove(place: Place, game: Game, move: Ply): Place {
  const { ply, line } = place;
  if (line && line.moves[line.at]?.uci === move.uci) {
    return { ply, line: { moves: line.moves, at: line.at + 1 } };
  }
  if (!line || line.at === 0) {
    return game.plies[ply]?.uci === move.uci ? { ply: ply + 1, line: null } : { ply, line: { moves: [move], at: 1 } };
  }
  return { ply, line: { moves: [...line.moves.slice(0, line.at), move], at: line.at + 1 } };
}

/** ← → Home End: along the game, or inside the line. */
export function movePlace(place: Place, game: Game, action: NavAction): Place {
  const { ply, line } = place;
  return line
    ? { ply, line: { moves: line.moves, at: navigate(line.at, line.moves.length, action) } }
    : { ply: navigate(ply, game.plies.length, action), line: null };
}

/** Back to the game, at the position the line left it. */
export function backToGame(place: Place): Place {
  return { ply: place.ply, line: null };
}

/** The position shown and the move that led to it. */
export function positionAt(place: Place, game: Game): { fen: string; move: Ply | undefined } {
  const { ply, line } = place;
  if (line && line.at > 0) {
    const move = line.moves[line.at - 1];
    return { fen: move.fenAfter, move };
  }
  return { fen: fenAt(game, ply), move: ply > 0 ? game.plies[ply - 1] : undefined };
}
