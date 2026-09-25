import { describe, expect, it } from 'vitest';
import { boardShapes, type BoardPosition } from './board-shapes';
import { squareMark } from './icons';

const AFTER_E4: BoardPosition = {
  fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  lastMove: ['e2', 'e4'],
  check: false,
  mark: 'best',
  hint: ['c7', 'c5'],
};

describe('boardShapes', () => {
  it('draws the best move as an arrow and the class on the square the piece went to', () => {
    expect(boardShapes(AFTER_E4, true)).toEqual([
      { orig: 'c7', dest: 'c5', brush: 'hint' },
      { orig: 'e4', customSvg: { html: squareMark('best') } },
    ]);
  });

  it("draws the line's second-best move as a thinner arrow after the best", () => {
    expect(boardShapes({ ...AFTER_E4, second: ['e7', 'e5'] }, true)).toEqual([
      { orig: 'c7', dest: 'c5', brush: 'hint' },
      { orig: 'e7', dest: 'e5', brush: 'second' },
      { orig: 'e4', customSvg: { html: squareMark('best') } },
    ]);
    expect(boardShapes({ ...AFTER_E4, second: ['e7', 'e5'] }, false)).toEqual([{ orig: 'e4', customSvg: { html: squareMark('best') } }]);
  });

  it('leaves the arrow out when hints are off', () => {
    expect(boardShapes(AFTER_E4, false)).toEqual([{ orig: 'e4', customSvg: { html: squareMark('best') } }]);
  });

  it('draws no class the extension does not know', () => {
    expect(boardShapes({ ...AFTER_E4, mark: 'brilliant' }, true)).toEqual([{ orig: 'c7', dest: 'c5', brush: 'hint' }]);
  });

  it('draws no class at the start, where no move was played', () => {
    expect(boardShapes({ fen: AFTER_E4.fen, check: false, mark: 'best', hint: ['e2', 'e4'] }, true)).toEqual([{ orig: 'e2', dest: 'e4', brush: 'hint' }]);
  });
});
