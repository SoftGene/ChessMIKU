import { Chess } from 'chess.js';

export interface ParsedMove {
  san: string;
  fen: string;
  color: 'w' | 'b';
}

export function parsePgn(pgn: string): ParsedMove[] {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch (e) {
    console.error('Failed to parse PGN:', e);
    return [];
  }
  
  const history = chess.history({ verbose: true });
  return history.map(move => ({
    san: move.san,
    fen: move.after,
    color: move.color
  }));
}
