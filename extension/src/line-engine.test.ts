import { describe, expect, it, vi } from 'vitest';
import { createLineEngine, type LinesEngine } from './line-engine';
import type { EngineLine } from './uci';

const LIMIT = { movetime: 500 };
const LINES_A: EngineLine[] = [{ moveUci: 'e2e4', score: { cp: 30 } }, { moveUci: 'd2d4', score: { cp: 25 } }];
const LINES_C: EngineLine[] = [{ moveUci: 'g1f3', score: { cp: 12 } }];
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// An engine whose searches the test answers one by one.
function fakeEngine() {
  const searches: { fen: string; resolve: (lines: EngineLine[]) => void; reject: (error: Error) => void }[] = [];
  const engine = {
    evaluateLines: vi.fn((fen: string) => new Promise<EngineLine[]>((resolve, reject) => searches.push({ fen, resolve, reject }))),
    quit: vi.fn(),
  } satisfies LinesEngine;
  return { engine, searches };
}

describe('the engine of the line', () => {
  it('starts at the first position asked for, once, and searches it with the limit', async () => {
    const { engine } = fakeEngine();
    const start = vi.fn(async () => engine);
    const lines = createLineEngine(start, LIMIT, () => {});

    expect(start).not.toHaveBeenCalled();
    expect(lines.lines('A')).toBeUndefined();
    await settle();

    expect(start).toHaveBeenCalledOnce();
    expect(engine.evaluateLines.mock.calls).toEqual([['A', LIMIT]]);
  });

  it('searches only the newest position asked for while another is searched', async () => {
    const { engine, searches } = fakeEngine();
    const ready = vi.fn();
    const lines = createLineEngine(async () => engine, LIMIT, ready);

    lines.lines('A');
    await settle();
    lines.lines('B');
    lines.lines('C');
    searches[0]?.resolve(LINES_A);
    await settle();
    searches[1]?.resolve(LINES_C);
    await settle();

    expect(engine.evaluateLines.mock.calls.map(([fen]) => fen)).toEqual(['A', 'C']);
    expect(ready.mock.calls).toEqual([['A'], ['C']]);
    expect([lines.lines('A'), lines.lines('C')]).toEqual([LINES_A, LINES_C]);
  });

  it('knows a position searched, and does not search one twice while it is searched', async () => {
    const { engine, searches } = fakeEngine();
    const lines = createLineEngine(async () => engine, LIMIT, () => {});

    lines.lines('A');
    await settle();
    lines.lines('A');
    searches[0]?.resolve(LINES_A);
    await settle();

    expect(lines.lines('A')).toEqual(LINES_A);
    expect(engine.evaluateLines).toHaveBeenCalledOnce();
  });

  it('gives null for every position once the engine cannot start, and does not start it again', async () => {
    const start = vi.fn(() => Promise.reject(new Error('The engine could not start: no answer in 10 s')));
    const ready = vi.fn();
    const lines = createLineEngine(start, LIMIT, ready);

    lines.lines('A');
    await settle();

    expect(ready.mock.calls).toEqual([['A']]);
    expect([lines.lines('A'), lines.lines('B')]).toEqual([null, null]);
    expect(start).toHaveBeenCalledOnce();
  });

  it('gives null once a search failed, stops the engine and answers the position waiting', async () => {
    const { engine, searches } = fakeEngine();
    const ready = vi.fn();
    const lines = createLineEngine(async () => engine, LIMIT, ready);

    lines.lines('A');
    await settle();
    lines.lines('B');
    searches[0]?.reject(new Error('The engine stopped: no answer in 30 s'));
    await settle();

    expect(ready.mock.calls).toEqual([['A'], ['B']]);
    expect([lines.lines('A'), lines.lines('B'), lines.lines('C')]).toEqual([null, null, null]);
    expect(engine.quit).toHaveBeenCalled();
    expect(engine.evaluateLines).toHaveBeenCalledOnce();
  });
});
