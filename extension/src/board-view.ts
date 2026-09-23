import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { boardShapes, type BoardPosition } from './board-shapes';
import type { Orientation } from './page';

export interface BoardView {
  show(position: BoardPosition, options: { animate: boolean; hints: boolean }): void;
  flip(): Orientation;
  destroy(): void;
}

/** chessground in the element: our board, read-only in the review (free play, T7.2, lets pieces move). */
export function createBoard(element: HTMLElement, orientation: Orientation): BoardView {
  const api: Api = Chessground(element, {
    orientation,
    viewOnly: true,
    coordinates: true,
    animation: { enabled: true, duration: 80 },
    highlight: { lastMove: true, check: true },
    drawable: { enabled: false, visible: true },
  });
  // The best-move arrow: green, a little thinner than chessground's own.
  api.state.drawable.brushes.hint = { key: 'hint', color: '#629924', opacity: 0.85, lineWidth: 11 };

  return {
    show(position, { animate, hints }) {
      api.set({
        fen: position.fen,
        lastMove: position.lastMove as Key[] | undefined,
        turnColor: position.fen.split(' ')[1] === 'b' ? 'black' : 'white',
        check: position.check,
        animation: { enabled: animate, duration: 80 },
      });
      api.setAutoShapes(boardShapes(position, hints));
    },
    flip() {
      api.toggleOrientation();
      return api.state.orientation;
    },
    destroy: () => api.destroy(),
  };
}
