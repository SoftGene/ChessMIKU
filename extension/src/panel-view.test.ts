// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { MoveEvaluation } from './analysis';
import { renderState } from './panel-view';

const FOOLS_MATE: MoveEvaluation[] = [
  { ply: 1, san: 'f3', uci: 'f2f3', bestMoveUci: 'e2e4', evalBeforeCp: 30, mateBefore: null, evalAfterCp: -90, mateAfter: null },
  { ply: 2, san: 'e5', uci: 'e7e5', bestMoveUci: 'e7e5', evalBeforeCp: 90, mateBefore: null, evalAfterCp: 0, mateAfter: null },
  { ply: 3, san: 'g4', uci: 'g2g4', bestMoveUci: 'g1f3', evalBeforeCp: -100, mateBefore: null, evalAfterCp: null, mateAfter: -1 },
  { ply: 4, san: 'Qh4#', uci: 'd8h4', bestMoveUci: 'd8h4', evalBeforeCp: null, mateBefore: 1, evalAfterCp: null, mateAfter: 0 },
];

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<main></main>';
  root = document.querySelector('main')!;
});

const rows = () => [...root.querySelectorAll('tbody tr')].map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent));

describe('renderState', () => {
  it('says the engine could not start, and why', () => {
    renderState(root, { stage: 'engine-failed', reason: 'The engine could not start: no answer in 20 s' });

    expect(root.textContent).toBe('The engine could not start, so there is no review. The chess.com page is not affected. The engine could not start: no answer in 20 s');
  });

  it('counts the positions while it analyses', () => {
    renderState(root, { stage: 'analysing', done: 3, total: 90 });

    expect(root.textContent).toBe('Analysing position 3 of 90…');
  });

  it('says the game is not in the archive', () => {
    renderState(root, { stage: 'not-found' });

    expect(root.textContent).toBe('This game is not in the chess.com archive. A game that has just ended appears there within a few minutes.');
  });

  it('says why the review failed', () => {
    renderState(root, { stage: 'failed', reason: 'The engine stopped: RuntimeError: unreachable' });

    expect(root.textContent).toBe('The review failed. The engine stopped: RuntimeError: unreachable');
  });

  it('lists the moves with the best move and both evaluations, in pawns for the side that moved', () => {
    renderState(root, { stage: 'done', moves: FOOLS_MATE });

    expect(root.querySelector('p')?.textContent).toBe('Analysed 4 moves.');
    expect(rows()).toEqual([
      ['1', 'f3', 'e2e4', '+0.30', '-0.90'],
      ['2', 'e5', 'e7e5', '+0.90', '0.00'],
      ['3', 'g4', 'g1f3', '-1.00', '#-1'],
      ['4', 'Qh4#', 'd8h4', '#1', '#'],
    ]);
  });

  it('shows data as text, never as markup', () => {
    renderState(root, { stage: 'failed', reason: '<img src=x onerror="alert(1)">' });

    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toBe('The review failed. <img src=x onerror="alert(1)">');
  });

  it('replaces what it showed before', () => {
    renderState(root, { stage: 'done', moves: FOOLS_MATE });
    renderState(root, { stage: 'looking-up' });

    expect(root.textContent).toBe('Looking up the game in the chess.com archive…');
  });
});
