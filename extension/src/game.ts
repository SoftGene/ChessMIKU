import { Chess, type Move } from 'chess.js';

/** The players, result and date from the PGN headers; a missing header is null. */
export interface GameHeaders {
  white: string;
  black: string;
  whiteElo: string | null;
  blackElo: string | null;
  result: string;
  date: string | null;
}

/** One half-move of the game, with the positions before and after it. */
export interface Ply {
  ply: number;
  san: string;
  uci: string;
  from: string;
  to: string;
  color: 'w' | 'b';
  fenBefore: string;
  fenAfter: string;
  capture: boolean;
  castle: boolean;
  check: boolean;
  mate: boolean;
}

export interface Game {
  headers: GameHeaders;
  startFen: string;
  plies: Ply[];
}

/** Reads a PGN; throws when it is not a game chess.js can play through. */
export function readGame(pgn: string): Game {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch (error) {
    throw new Error(`The game could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }

  const tags = chess.getHeaders();
  const history = chess.history({ verbose: true });
  return {
    headers: {
      white: tags.White ?? '?',
      black: tags.Black ?? '?',
      whiteElo: tags.WhiteElo ?? null,
      blackElo: tags.BlackElo ?? null,
      result: tags.Result ?? '*',
      // chess.js fills an unknown date with question marks.
      date: tags.Date && !tags.Date.includes('?') ? tags.Date : null,
    },
    startFen: history[0]?.before ?? chess.fen(),
    plies: history.map((move, i) => plyOf(move, i + 1)),
  };
}

/** A half-move as the window uses it; `ply` is its number from the start of the game. */
export function plyOf(move: Move, ply: number): Ply {
  return {
    ply,
    san: move.san,
    uci: move.lan,
    from: move.from,
    to: move.to,
    color: move.color,
    fenBefore: move.before,
    fenAfter: move.after,
    // chess.js flags en passant apart from other captures.
    capture: move.isCapture() || move.isEnPassant(),
    castle: move.isKingsideCastle() || move.isQueensideCastle(),
    check: move.san.endsWith('+'),
    mate: move.san.endsWith('#'),
  };
}

/** The position after `ply` half-moves; 0 is the start. */
export function fenAt(game: Game, ply: number): string {
  return ply === 0 ? game.startFen : game.plies[ply - 1].fenAfter;
}
