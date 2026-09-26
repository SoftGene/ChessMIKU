// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createBoard, type BoardView } from './board-view';

// chessground rounds the board down to whole 8-device-pixel squares, so the board comes out a few pixels smaller than
// --board. The evaluation bar beside it must take the board's own height, or it sticks out below the board.
let board: BoardView | undefined;

afterEach(() => {
  board?.destroy();
  document.body.replaceChildren();
});

describe('the evaluation bar beside the board', () => {
  it('learns the height chessground gives the board', () => {
    const left = document.createElement('div');
    const element = document.createElement('div');
    left.append(element);
    document.body.append(left);
    element.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, width: 501, height: 501, right: 501, bottom: 501, toJSON: () => ({}) });

    board = createBoard(element, 'white');

    expect(left.style.getPropertyValue('---cg-height')).toBe('496px');
  });

  it('takes its height from it', () => {
    const css = readFileSync(join(import.meta.dirname, 'panel.css'), 'utf8');
    const rule = css.slice(css.indexOf('.eval-bar {'), css.indexOf('}', css.indexOf('.eval-bar {')));
    expect(rule).toContain('height: var(---cg-height, var(--board));');
  });
});
