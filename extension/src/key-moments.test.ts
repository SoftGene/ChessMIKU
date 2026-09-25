// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import archive from '../test/fixtures/archive-hikaru-2026-08.json';
import { readGame } from './game';
import { moveLabel, renderKeyMoments, type MomentsContext } from './key-moments';

const game = readGame(archive.games.find((g) => g.url.endsWith('/173765478164'))!.pgn);
let card: HTMLElement;
let context: MomentsContext;

beforeEach(() => {
  document.body.innerHTML = '<div class="card"></div>';
  card = document.querySelector('.card')!;
  context = { language: 'ru', game, classes: new Map([[1, 'inaccuracy'], [19, 'blunder']]), current: 0, onSelect: vi.fn() };
});

const ready = (...explanations: { ply: number; text: string }[]) => ({ kind: 'ready' as const, explanations });
const rows = () => [...card.querySelectorAll<HTMLButtonElement>('button.moment')];
// The move and the class of a row (the icon's own "?!" is drawn, not read).
const parts = (row: HTMLElement) => [...row.querySelectorAll('span')].map((span) => span.textContent);

describe('moveLabel', () => {
  it('numbers a move of White with a dot, of Black with an ellipsis', () => {
    expect(moveLabel(game.plies[0])).toBe('1. b3');
    expect(moveLabel(game.plies[11])).toBe('6… O-O');
  });
});

describe('the key moments', () => {
  it('lists the moments in the order of the game, with icon, move and class, and opens the first', () => {
    renderKeyMoments(card, ready({ ply: 19, text: 'Second.' }, { ply: 1, text: 'First.' }), context);

    expect(card.querySelector('.moments-title')?.textContent).toBe('Ключевые моменты');
    expect(rows().map((row) => row.dataset.ply)).toEqual(['1', '19']);
    expect(rows().map((row) => row.getAttribute('aria-expanded'))).toEqual(['true', 'false']);
    expect(parts(rows()[0])).toEqual(['1. b3', 'неточность']);
    expect(rows()[0].querySelector('svg')?.getAttribute('aria-label')).toBe('Inaccuracy');
    expect([...card.querySelectorAll('.moment-text')].map((p) => p.textContent)).toEqual(['First.']);
  });

  it('opens the moment of the move on the board', () => {
    renderKeyMoments(card, ready({ ply: 1, text: 'First.' }, { ply: 19, text: 'Second.' }), { ...context, current: 19 });

    expect(rows().map((row) => row.getAttribute('aria-expanded'))).toEqual(['false', 'true']);
    expect([...card.querySelectorAll('.moment-text')].map((p) => p.textContent)).toEqual(['Second.']);
  });

  it('goes to a moment on a click', () => {
    renderKeyMoments(card, ready({ ply: 1, text: 'First.' }, { ply: 19, text: 'Second.' }), context);

    expect(rows()).toHaveLength(2);
    rows()[1].click();

    expect(context.onSelect).toHaveBeenCalledWith(19);
  });

  it('shows the text of an explanation as text', () => {
    renderKeyMoments(card, ready({ ply: 1, text: '<b>bold</b>' }), context);

    expect(card.querySelector('.moment-text')?.textContent).toBe('<b>bold</b>');
    expect(card.querySelector('b')).toBeNull();
  });

  it("shows a class it does not know without an icon, by the contract's word", () => {
    renderKeyMoments(card, ready({ ply: 1, text: 'First.' }), { ...context, classes: new Map([[1, 'great']]) });

    expect(rows()).toHaveLength(1);
    expect(rows()[0].querySelector('svg')).toBeNull();
    expect(parts(rows()[0])).toEqual(['1. b3', 'great']);
  });

  it('says there are no mistakes to explain', () => {
    renderKeyMoments(card, ready(), context);

    expect(card.textContent).toBe('В партии нет ошибок — объяснять нечего.');
  });

  it('shows where the explanations are, in the language of the explanations', () => {
    renderKeyMoments(card, { kind: 'writing' }, { ...context, language: 'en' });

    expect(card.textContent).toBe('Writing explanations of the key moments…');
    expect(rows()).toEqual([]);
  });
});
