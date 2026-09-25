// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readGame } from './game';
import { describeLine, lineEval, linesState, renderLine, type LinesState } from './line-view';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const TWO = [{ moveUci: 'g1f3', score: { cp: 80 } }, { moveUci: 'e2e4', score: { cp: 50 } }];
// A line from Black's second move: 2… Nf6 3. Nxe5 d6.
const MOVES = readGame('1. e4 e5 2. Nf3 Nf6 3. Nxe5 d6').plies.slice(3);

let element: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div class="line"></div>';
  element = document.querySelector('.line')!;
});

describe('describeLine', () => {
  it("names the line's first move and White's evaluation", () => {
    expect(describeLine(START, TWO[0])).toEqual({ san: 'Nf3', value: '+0.8' });
    expect(describeLine(AFTER_E4, { moveUci: 'c7c5', score: { cp: 30 } })).toEqual({ san: 'c5', value: '-0.3' });
    expect(describeLine('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', { moveUci: 'a1a8', score: { mate: 1 } })).toEqual({ san: 'Ra8#', value: '#1' });
    expect(describeLine('8/4P3/8/8/8/8/k7/4K3 w - - 0 1', { moveUci: 'e7e8q', score: { cp: 900 } })).toEqual({ san: 'e8=Q', value: '+9.0' });
  });
});

describe('lineEval', () => {
  it('takes the best line, and tells a mate or a stalemate on the board without the engine', () => {
    expect(lineEval(AFTER_E4, null, [{ moveUci: 'c7c5', score: { cp: 30 } }])).toEqual({ cp: -30 });
    expect(lineEval('R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1', 'checkmate', undefined)).toEqual({ mateIn: 0, winner: 'white' });
    expect(lineEval('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 'stalemate', undefined)).toEqual({ cp: 0 });
    expect(lineEval(START, null, undefined)).toBeUndefined();
    expect(lineEval(START, null, null)).toBeUndefined();
  });
});

describe('linesState', () => {
  it('says what the row tells about the engine', () => {
    expect(linesState(null, TWO, true)).toEqual({ kind: 'lines', lines: TWO });
    expect(linesState(null, undefined, true)).toEqual({ kind: 'thinking' });
    expect(linesState(null, null, true)).toEqual({ kind: 'unavailable' });
    expect(linesState(null, TWO, false)).toEqual({ kind: 'hidden' });
    expect(linesState('checkmate', undefined, false)).toEqual({ kind: 'ending', ending: 'checkmate' });
  });
});

describe('renderLine', () => {
  const engineText = (engine: LinesState, fen = START) => {
    renderLine(element, { fen, moves: MOVES, at: 1, engine }, vi.fn());
    return element.querySelector<HTMLElement>('.line-engine');
  };

  it('shows the moves of the line with their numbers, the current one marked', () => {
    renderLine(element, { fen: MOVES[0].fenAfter, moves: MOVES, at: 1, engine: { kind: 'thinking' } }, vi.fn());

    const parts = [...(element.querySelector('.line-moves')?.children ?? [])].map((part) => part.textContent);
    expect(parts).toEqual(['2…', 'Nf6', '3.', 'Nxe5', 'd6']);
    expect(element.querySelector('[aria-current="true"]')?.textContent).toBe('Nf6');
  });

  it('goes to a move of the line clicked', () => {
    const onSelect = vi.fn();
    renderLine(element, { fen: MOVES[0].fenAfter, moves: MOVES, at: 1, engine: { kind: 'thinking' } }, onSelect);

    expect(element.querySelectorAll('.line-move')).toHaveLength(3);
    element.querySelectorAll<HTMLElement>('.line-move')[1].click();

    expect(onSelect.mock.calls).toEqual([[2]]);
  });

  it("tells the engine's lines, or why there are none", () => {
    expect(engineText({ kind: 'lines', lines: TWO })?.textContent).toBe('Nf3 +0.8 · e4 +0.5');
    expect(engineText({ kind: 'thinking' })?.textContent).toBe('…');
    expect(engineText({ kind: 'unavailable' })?.textContent).toBe('Engine unavailable');
    expect(engineText({ kind: 'ending', ending: 'checkmate' })?.textContent).toBe('Checkmate');
    expect(engineText({ kind: 'ending', ending: 'stalemate' })?.textContent).toBe('Stalemate');
    expect(engineText({ kind: 'hidden' })?.hidden).toBe(true);
    expect(engineText({ kind: 'thinking' })?.hidden).toBe(false);
  });
});
