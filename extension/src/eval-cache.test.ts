import { describe, expect, it } from 'vitest';
import type { PositionEvaluation } from './analysis';
import { createEvalCache, ENGINE_TAG, type CacheStore } from './eval-cache';

function memory(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  const store: CacheStore = {
    async get(keys) {
      return keys === null ? { ...data } : keys in data ? { [keys]: data[keys] } : {};
    },
    async set(items) {
      Object.assign(data, items);
    },
    async remove(keys) {
      for (const key of keys) delete data[key];
    },
  };
  return { data, store };
}

const positions: PositionEvaluation[] = [{ score: { cp: 30 }, bestMoveUci: 'e2e4' }, { score: { mate: 0 } }];
const game = { pgn: '1. e4 1-0', positions };

describe('the evaluation cache', () => {
  it('gives back a game it keeps', async () => {
    const cache = createEvalCache(memory().store);

    await cache.write('live/1', game);

    expect(await cache.read('live/1')).toEqual(game);
  });

  it('gives nothing for a game it does not have', async () => {
    expect(await createEvalCache(memory().store).read('live/2')).toBeNull();
  });

  it('keeps games under the engine settings: other settings do not mix in', async () => {
    const { data, store } = memory({ 'evals:stockfish-18/1000ms:live/1': { pgn: '1. d4 1-0', positions, savedAt: 1 } });

    await createEvalCache(store).write('live/2', game);

    expect(Object.keys(data)).toEqual([`evals:${ENGINE_TAG}:live/2`]);
    expect(await createEvalCache(store).read('live/1')).toBeNull();
  });

  it('forgets the oldest games beyond its limit', async () => {
    const { data, store } = memory();
    let clock = 0;
    const cache = createEvalCache(store, { limit: 2, now: () => ++clock });

    for (const id of ['live/1', 'live/2', 'live/3']) {
      await cache.write(id, game);
    }

    expect(Object.keys(data).sort()).toEqual([`evals:${ENGINE_TAG}:live/2`, `evals:${ENGINE_TAG}:live/3`]);
  });

  it("leaves the rest of the extension's storage alone", async () => {
    const { data, store } = memory({ installId: '9b1e4c2a-7f3d-4a58-b6e0-2c8d5f1a9e73' });

    await createEvalCache(store, { limit: 0 }).write('live/1', game);

    expect(data.installId).toBe('9b1e4c2a-7f3d-4a58-b6e0-2c8d5f1a9e73');
  });

  it.each([
    ['no PGN', { positions }],
    ['no positions', { pgn: '1. e4 1-0' }],
    ['a score of another shape', { pgn: '1. e4 1-0', positions: [{ score: { cp: 'x' } }] }],
    ['a best move that is not a move', { pgn: '1. e4 1-0', positions: [{ score: { cp: 1 }, bestMoveUci: 'e9e4' }] }],
  ])('gives nothing for an entry with %s', async (_what, value) => {
    const { store } = memory({ [`evals:${ENGINE_TAG}:live/1`]: value });

    expect(await createEvalCache(store).read('live/1')).toBeNull();
  });
});
