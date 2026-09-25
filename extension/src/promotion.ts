import type { PromotionPiece } from './legal-moves';
import type { Orientation } from './page';

const PIECES: [PromotionPiece, string, string][] = [
  ['q', 'queen', 'Queen'],
  ['r', 'rook', 'Rook'],
  ['b', 'bishop', 'Bishop'],
  ['n', 'knight', 'Knight'],
];

export interface PromotionChoice {
  /** Closes the choice as a click beside the pieces does: `choose` hears null. */
  cancel(): void;
}

/**
 * The four pieces a pawn can become, over the board in a column from the square it goes to toward the middle, as
 * on chess.com. `choose` hears the piece clicked, or null for a click beside them; the column is gone either way.
 * The pieces are chessground's own pictures: the board element is its `.cg-wrap`.
 */
export function showPromotion(board: HTMLElement, square: string, color: 'white' | 'black', orientation: Orientation, choose: (piece: PromotionPiece | null) => void): PromotionChoice {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number(square[1]);
  const column = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 8 - rank : rank - 1;
  const layer = document.createElement('div');
  layer.className = 'promotion';
  let open = true;
  const close = (piece: PromotionPiece | null) => {
    if (open) {
      open = false;
      layer.remove();
      choose(piece);
    }
  };

  PIECES.forEach(([piece, role, label], i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.style.left = `${column * 12.5}%`;
    button.style.top = `${(row === 0 ? i : 7 - i) * 12.5}%`;
    const image = document.createElement('piece');
    image.className = `${role} ${color}`;
    button.append(image);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      close(piece);
    });
    layer.append(button);
  });
  layer.addEventListener('click', () => close(null));
  board.append(layer);
  return { cancel: () => close(null) };
}
