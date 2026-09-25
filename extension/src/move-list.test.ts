// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readGame, type Game } from './game';
import { buildMoveList, markCurrentMove, setMoveClasses } from './move-list';

const FOOLS_MATE = readGame('1. f3 e5 2. g4 Qh4# 0-1');
let list: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div class="moves"></div>';
  list = document.querySelector('.moves')!;
});

const texts = () => [...list.children].map((c) => c.textContent);

describe('the move list', () => {
  it('writes the moves in pairs, with their numbers', () => {
    buildMoveList(list, FOOLS_MATE, () => {});

    expect(texts()).toEqual(['1.', 'f3', 'e5', '2.', 'g4', 'Qh4#']);
  });

  it('leaves White’s cell empty when the game starts with Black to move', () => {
    const game = readGame('[SetUp "1"]\n[FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"]\n\n1... e5 2. Nf3 *');

    buildMoveList(list, game, () => {});

    expect(texts()).toEqual(['1.', '…', 'e5', '2.', 'Nf3']);
  });

  it('marks the current move, and none at the start', () => {
    buildMoveList(list, FOOLS_MATE, () => {});

    markCurrentMove(list, 3);
    expect(list.querySelector('[aria-current="true"]')?.textContent).toBe('g4');
    markCurrentMove(list, 0);
    expect(list.querySelector('[aria-current="true"]')).toBeNull();
  });

  it('goes to a move that is clicked', () => {
    const onSelect = vi.fn();
    buildMoveList(list, FOOLS_MATE, onSelect);

    list.querySelectorAll<HTMLButtonElement>('button.move')[3].click();

    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it('puts the icon of each class before its move', () => {
    buildMoveList(list, FOOLS_MATE, () => {});

    setMoveClasses(list, new Map([[1, 'mistake'], [4, 'best'], [2, 'brilliant']]));

    const icons = [...list.querySelectorAll('button.move')].map((b) => b.querySelector('svg')?.getAttribute('aria-label') ?? null);
    expect(icons).toEqual(['Mistake', null, null, 'Best']);
  });

  it('shows moves from the PGN as text, never as markup', () => {
    const game: Game = { ...FOOLS_MATE, plies: [{ ...FOOLS_MATE.plies[0], san: '<img src=x onerror="alert(1)">' }] };

    buildMoveList(list, game, () => {});

    expect(list.querySelector('img')).toBeNull();
    expect(texts()).toContain('<img src=x onerror="alert(1)">');
  });
});
