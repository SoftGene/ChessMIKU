// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { GRAPH_HEIGHT, GRAPH_WIDTH, graphPoints, graphX, positionAtX, renderGraph } from './eval-graph';

describe('graph geometry', () => {
  it('puts the start at the left edge and the last position at the right', () => {
    expect(graphX(0, 88)).toBe(0);
    expect(graphX(88, 88)).toBe(GRAPH_WIDTH);
    expect(graphX(44, 88)).toBe(GRAPH_WIDTH / 2);
    expect(graphX(0, 0)).toBe(0);
  });

  it('draws White’s advantage up, and skips positions not evaluated yet', () => {
    // A level start (middle), then unknown, then White mates (top).
    expect(graphPoints([{ cp: 0 }, undefined, { mateIn: 2, winner: 'white' }])).toBe(`0,${GRAPH_HEIGHT / 2} ${GRAPH_WIDTH},0`);
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
  it('draws the line, the current position and the classed moves in their colours', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    renderGraph(svg, [{ cp: 0 }, { cp: 300 }, { cp: -300 }], 1, new Map([[2, 'blunder'], [1, 'brilliant']]));

    expect(svg.querySelector('.graph-line')?.getAttribute('points')).toBe(graphPoints([{ cp: 0 }, { cp: 300 }, { cp: -300 }]));
    expect(svg.querySelector('.graph-cursor')?.getAttribute('x1')).toBe(String(GRAPH_WIDTH / 2));
    expect([...svg.querySelectorAll('.graph-mark')].map((c) => [c.getAttribute('cx'), c.getAttribute('fill')])).toEqual([[String(GRAPH_WIDTH), '#d93b3b']]);
  });
});
