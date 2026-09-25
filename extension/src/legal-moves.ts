import { Chess, type Square } from 'chess.js';
import { plyOf, type Ply } from './game';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

/** What a piece dropped on another square does. */
export type Drop =
  | { kind: 'move'; ply: Ply }
  // A pawn reaches the last rank: the piece it becomes is to be chosen.
  | { kind: 'promote' }
  // The square holds a piece of the same side: that piece is chosen instead.
  | { kind: 'reselect' }
  | { kind: 'illegal' };

/** A position with no moves: a mate or a stalemate; null while the game goes on. */
export type Ending = 'checkmate' | 'stalemate' | null;

/** The squares each piece of the side to move can go to, for chessground's dots. */
export function legalDests(fen: string): Map<string, string[]> {
  const dests = new Map<string, string[]>();
  for (const { from, to } of new Chess(fen).moves({ verbose: true })) {
    const squares = dests.get(from) ?? [];
    // A promotion is four moves to one square.
    if (!squares.includes(to)) {
      squares.push(to);
    }
    dests.set(from, squares);
  }
  return dests;
}

/** Reads a piece dropped from `from` on `to`; a promotion needs the piece chosen. */
export function readDrop(fen: string, from: string, to: string, promotion?: PromotionPiece): Drop {
  const chess = new Chess(fen);
  if (chess.get(to as Square)?.color === chess.turn()) {
    return { kind: 'reselect' };
  }
  const moves = chess.moves({ square: from as Square, verbose: true }).filter((move) => move.to === to);
  if (moves.length === 0) {
    return { kind: 'illegal' };
  }
  const promotes = moves[0].isPromotion();
  if (promotes && !promotion) {
    return { kind: 'promote' };
  }
  const move = chess.move({ from, to, promotion: promotes ? promotion : undefined });
  return { kind: 'move', ply: plyOf(move, plyNumber(fen)) };
}

export function endingOf(fen: string): Ending {
  const chess = new Chess(fen);
  return chess.isCheckmate() ? 'checkmate' : chess.isStalemate() ? 'stalemate' : null;
}

// The number of the half-move played from a position, counted from the start: White's first move is 1.
function plyNumber(fen: string): number {
  const [, turn, , , , fullmove] = fen.split(' ');
  return (Number(fullmove) - 1) * 2 + (turn === 'b' ? 2 : 1);
}

/** On a mate, the square of the king mated and of the winner's king; null otherwise. */
export function mateSquares(fen: string): { mated: string; winner: string } | null {
  const chess = new Chess(fen);
  if (!chess.isCheckmate()) {
    return null;
  }
  const mated = chess.turn();
  const [matedKing] = chess.findPiece({ type: 'k', color: mated });
  const [winnerKing] = chess.findPiece({ type: 'k', color: mated === 'w' ? 'b' : 'w' });
  return { mated: matedKing, winner: winnerKing };
}
