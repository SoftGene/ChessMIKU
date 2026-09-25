// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showPromotion } from './promotion';

let board: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div class="board"></div>';
  board = document.querySelector('.board')!;
});

const buttons = () => [...board.querySelectorAll<HTMLButtonElement>('.promotion button')];
const places = () => buttons().map((button) => [button.style.left, button.style.top]);

describe('the choice of a promotion', () => {
  it('offers the four pieces of the colour, in the column of the square, from the edge toward the middle', () => {
    showPromotion(board, 'e8', 'white', 'white', vi.fn());

    expect(buttons().map((button) => button.getAttribute('aria-label'))).toEqual(['Queen', 'Rook', 'Bishop', 'Knight']);
    expect(buttons().map((button) => button.querySelector('piece')?.className)).toEqual(['queen white', 'rook white', 'bishop white', 'knight white']);
    expect(places()).toEqual([['50%', '0%'], ['50%', '12.5%'], ['50%', '25%'], ['50%', '37.5%']]);
  });

  it('grows up from the bottom edge for Black, and turns with the board', () => {
    showPromotion(board, 'e1', 'black', 'white', vi.fn());
    expect(places()).toEqual([['50%', '87.5%'], ['50%', '75%'], ['50%', '62.5%'], ['50%', '50%']]);

    board.replaceChildren();
    showPromotion(board, 'e8', 'white', 'black', vi.fn());
    expect(places()).toEqual([['37.5%', '87.5%'], ['37.5%', '75%'], ['37.5%', '62.5%'], ['37.5%', '50%']]);
  });

  it('hears the piece clicked, and closes', () => {
    const choose = vi.fn();
    showPromotion(board, 'e8', 'white', 'white', choose);

    expect(buttons()).toHaveLength(4);
    buttons()[3].click();

    expect(choose.mock.calls).toEqual([['n']]);
    expect(board.querySelector('.promotion')).toBeNull();
  });

  it('cancels on a click beside the pieces, and when asked, once', () => {
    const choose = vi.fn();
    const choice = showPromotion(board, 'e8', 'white', 'white', choose);

    board.querySelector<HTMLElement>('.promotion')?.click();
    choice.cancel();

    expect(choose.mock.calls).toEqual([[null]]);
    expect(board.querySelector('.promotion')).toBeNull();
  });
});
