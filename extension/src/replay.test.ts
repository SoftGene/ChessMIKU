import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startReplay } from './replay';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function replay(last: number, readyUpTo: { value: number }) {
  const shown: number[] = [];
  let done = 0;
  const handle = startReplay({ last, isReady: (ply) => ply <= readyUpTo.value, show: (ply) => shown.push(ply), done: () => done++ });
  return { shown, handle, done: () => done };
}

describe('startReplay', () => {
  it('moves one half-move every 100 ms while positions are ready', () => {
    const { shown, done } = replay(3, { value: 3 });

    vi.advanceTimersByTime(99);
    expect(shown).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(shown).toEqual([1]);
    vi.advanceTimersByTime(200);
    expect(shown).toEqual([1, 2, 3]);
    expect(done()).toBe(1);
  });

  it('waits for positions not evaluated yet', () => {
    const ready = { value: 1 };
    const { shown } = replay(3, ready);

    vi.advanceTimersByTime(500);
    expect(shown).toEqual([1]);
    ready.value = 3;
    vi.advanceTimersByTime(200);
    expect(shown).toEqual([1, 2, 3]);
  });

  it('says it is done once, and shows nothing after', () => {
    const { shown, done } = replay(2, { value: 2 });

    vi.advanceTimersByTime(1000);
    expect(shown).toEqual([1, 2]);
    expect(done()).toBe(1);
  });

  it('stops when asked', () => {
    const { shown, handle, done } = replay(5, { value: 5 });

    vi.advanceTimersByTime(150);
    handle.stop();
    vi.advanceTimersByTime(1000);
    expect(shown).toEqual([1]);
    expect(done()).toBe(0);
  });

  it('is done at once for a game without moves', () => {
    const { shown, done } = replay(0, { value: 0 });

    vi.advanceTimersByTime(100);
    expect(shown).toEqual([]);
    expect(done()).toBe(1);
  });
});
