// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { GRAPH_MARKS, graphPoints, graphTip, graphX, positionAtX, renderGraph } from './eval-graph';
import { readGame } from './game';

const SIZE = { width: 600, height: 80 };
const svg = () => document.createElementNS('http://www.w3.org/2000/svg', 'svg');

describe('graph geometry', () => {
  it('puts the start at the left edge and the last position at the right, in pixels', () => {
    expect(graphX(0, 88, 600)).toBe(0);
    expect(graphX(88, 88, 600)).toBe(600);
    expect(graphX(44, 88, 320)).toBe(160);
    expect(graphX(0, 0, 600)).toBe(0);
  });

  it("draws White's advantage up, and skips positions not evaluated yet", () => {
    expect(graphPoints([{ cp: 0 }, undefined, { mateIn: 2, winner: 'white' }], SIZE)).toBe('0,40 600,0');
  });

  it.each([
    [0, 0],
    [300, 44],
    [600, 88],
    [-20, 0],
    [900, 88],
  ])('finds the position under x = %i', (x, position) => {
    expect(positionAtX(x, 600, 88)).toBe(position);
  });

  it('finds the start on a graph not laid out yet', () => {
    expect(positionAtX(10, 0, 88)).toBe(0);
  });
});

describe('renderGraph', () => {
  it('draws in the pixels of the graph, so that its dots stay round', () => {
    const graph = svg();

    renderGraph(graph, [{ cp: 0 }, { cp: 30 }], 0, new Map(), { width: 320, height: 80 });

    expect(graph.getAttribute('viewBox')).toBe('0 0 320 80');
    expect(graph.getAttribute('preserveAspectRatio')).toBeNull();
  });

  it('marks only the mistakes, each with a dot of its colour', () => {
    const graph = svg();
    const evals = [{ cp: 0 }, { cp: 10 }, { cp: -300 }, { cp: -100 }, { cp: 200 }, { cp: 0 }];

    renderGraph(graph, evals, 0, new Map([[1, 'best'], [2, 'blunder'], [3, 'mistake'], [4, 'miss'], [5, 'inaccuracy']]), SIZE);

    expect([...graph.querySelectorAll('.graph-mark')].map((c) => [c.getAttribute('cx'), c.getAttribute('fill')])).toEqual([
      ['240', '#d93b3b'],
      ['360', '#e8883a'],
      ['480', '#e05a6b'],
    ]);
    expect([...GRAPH_MARKS]).toEqual(['blunder', 'mistake', 'miss', 'great', 'brilliant']);
  });

  it('draws the middle over the area, where the game is level', () => {
    const graph = svg();

    renderGraph(graph, [{ cp: 0 }, { cp: 300 }], 0, new Map(), SIZE);

    const names = [...graph.children].map((child) => child.getAttribute('class'));
    expect(names.indexOf('graph-mid')).toBeGreaterThan(names.indexOf('graph-area'));
    expect(graph.querySelector('.graph-mid')?.getAttribute('y1')).toBe('40');
  });

  it('draws the line and the current position', () => {
    const graph = svg();
    const evals = [{ cp: 0 }, { cp: 300 }, { cp: -300 }];

    renderGraph(graph, evals, 1, new Map(), SIZE);

    expect(graph.querySelector('.graph-line')?.getAttribute('points')).toBe(graphPoints(evals, SIZE));
    expect(graph.querySelector('.graph-cursor')?.getAttribute('x1')).toBe('300');
  });

  it('draws where the pointer is, and nothing without it', () => {
    const graph = svg();

    renderGraph(graph, [{ cp: 0 }, { cp: 300 }, { cp: -300 }], 0, new Map(), SIZE, 2);
    expect(graph.querySelector('.graph-hover')?.getAttribute('x1')).toBe('600');

    renderGraph(graph, [{ cp: 0 }, { cp: 300 }, { cp: -300 }], 0, new Map(), SIZE);
    expect(graph.querySelector('.graph-hover')).toBeNull();
  });
});

describe('graphTip', () => {
  const game = readGame('1. f3 e5 2. g4 Qh4# 0-1');
  const evals = [{ cp: 0 }, { cp: -30 }, undefined, { cp: -250 }, { mateIn: 0, winner: 'black' as const }];

  it('names the move and its evaluation', () => {
    expect(graphTip(game, evals, 0)).toBe('Start · 0.0');
    expect(graphTip(game, evals, 3)).toBe('2. g4 · -2.5');
    expect(graphTip(game, evals, 4)).toBe('2… Qh4# · 0-1');
  });

  it('says nothing of a position not evaluated yet', () => {
    expect(graphTip(game, evals, 2)).toBeNull();
  });
});
