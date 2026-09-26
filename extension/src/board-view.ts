import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { boardShapes, squareFills, type BoardPosition } from './board-shapes';
import type { Orientation } from './page';

/** Which pieces the player can move, and where: from chess.js (legal-moves.ts). */
export interface Movable {
  color: 'white' | 'black';
  dests: Map<string, string[]>;
}

export interface BoardView {
  show(position: BoardPosition, options: { animate: boolean; hints: boolean; movable?: Movable | null }): void;
  /** Hears each piece dropped on another square. The board does not judge it: `show` then sets what stands. */
  onDrop(handler: (from: string, to: string) => void): void;
  /** Chooses a piece, as a click on it would. */
  select(square: string): void;
  flip(): Orientation;
  destroy(): void;
}

/** A piece on the board, or the one chosen. */
export interface PieceAt {
  key: string;
  color: 'white' | 'black';
}

/**
 * A press on another piece of the chosen piece's side chooses that piece. In the free mode chessground would take
 * it for a move onto that square, and the piece pressed would not start to drag.
 */
export function pressChoosesAnother(chosen: PieceAt | undefined, pressed: PieceAt | undefined): boolean {
  return Boolean(chosen && pressed && pressed.key !== chosen.key && pressed.color === chosen.color);
}

/** chessground in the element: our board; in the free play (T7.2) the player's pieces move. */
export function createBoard(element: HTMLElement, orientation: Orientation): BoardView {
  let dropped: ((from: string, to: string) => void) | null = null;
  const api: Api = Chessground(element, {
    orientation,
    coordinates: true,
    animation: { enabled: true, duration: 80 },
    highlight: { lastMove: true, check: true },
    // Free: every drop reaches `onDrop` and chess.js judges it, so that a refused move has its sound. The dots come
    // from chess.js. No piece moves until `show` says which side may.
    movable: { free: true, color: undefined, showDests: true, events: { after: (orig, dest) => dropped?.(orig, dest) } },
    premovable: { enabled: false },
    drawable: { enabled: false, visible: true },
    // chessground rounds the board down to whole 8-device-pixel squares; the evaluation bar beside it takes that
    // height from ---cg-height, or it sticks out below the board (Pavel, 26.09).
    addDimensionsCssVarsTo: element.parentElement ?? undefined,
  });
  // The best-move arrow: green, a little thinner than chessground's own; the second best thinner and paler.
  api.state.drawable.brushes.hint = { key: 'hint', color: '#629924', opacity: 0.85, lineWidth: 11 };
  api.state.drawable.brushes.second = { key: 'second', color: '#629924', opacity: 0.45, lineWidth: 7 };

  // Before chessground hears the press (capture): a press on another piece of the same side first lets the chosen
  // piece go, so that chessground chooses the one pressed and drags it.
  const pieceAt = (key: Key | undefined): PieceAt | undefined => {
    const piece = key ? api.state.pieces.get(key) : undefined;
    return key && piece ? { key, color: piece.color } : undefined;
  };
  const onPress = (event: MouseEvent | TouchEvent) => {
    const point = 'touches' in event ? event.touches[0] : event;
    if (point && pressChoosesAnother(pieceAt(api.state.selected), pieceAt(api.getKeyAtDomPos([point.clientX, point.clientY])))) {
      api.selectSquare(null);
    }
  };
  element.addEventListener('mousedown', onPress, { capture: true });
  element.addEventListener('touchstart', onPress, { capture: true, passive: true });

  return {
    show(position, { animate, hints, movable = null }) {
      api.set({
        fen: position.fen,
        lastMove: position.lastMove as Key[] | undefined,
        turnColor: position.fen.split(' ')[1] === 'b' ? 'black' : 'white',
        check: position.check,
        highlight: { lastMove: true, check: true, custom: squareFills(position) as Map<Key, string> },
        animation: { enabled: animate, duration: 80 },
        movable: { color: movable?.color, dests: (movable?.dests ?? new Map()) as Map<Key, Key[]> },
      });
      api.setAutoShapes(boardShapes(position, hints));
    },
    onDrop(handler) {
      dropped = handler;
    },
    select(square) {
      api.selectSquare(square as Key);
    },
    flip() {
      api.toggleOrientation();
      return api.state.orientation;
    },
    destroy: () => api.destroy(),
  };
}
