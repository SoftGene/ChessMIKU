import { describe, expect, it } from 'vitest';
import { EngineError } from './engine';
import { EnginePool, poolSize } from './engine-pool';
import type { ReviewEngine } from './review';
import type { Evaluation } from './uci';

// An engine whose searches the test answers by hand, in any order.
function fakeEngine(name: string) {
  const searches: { fen: string; answer: (evaluation: Evaluation) => void }[] = [];
  const log: string[] = [];
  const engine: ReviewEngine = {
    async newGame() {
      log.push('newGame');
    },
    evaluate(fen) {
      return new Promise((answer) => searches.push({ fen, answer }));
    },
    quit() {
      log.push('quit');
    },
  };
  return { name, engine, searches, log };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const evaluation = (bestMoveUci: string): Evaluation => ({ bestMoveUci, score: { cp: 10 } });

describe('poolSize', () => {
  it.each([
    [16, 4],
    [8, 4],
    [5, 4],
    [4, 3],
    [2, 1],
    [1, 1],
    [0, 1],
  ])('runs %i cores with %i engines', (cores, engines) => {
    expect(poolSize(cores)).toBe(engines);
  });
});

describe('EnginePool', () => {
  it('starts all its engines at once', async () => {
    const pending: ((engine: ReviewEngine) => void)[] = [];
    const starting = EnginePool.start(() => new Promise((resolve) => pending.push(resolve)), 4);

    await settle();
    expect(pending).toHaveLength(4);
    pending.forEach((resolve, i) => resolve(fakeEngine(`e${i}`).engine));
    expect((await starting).size).toBe(4);
  });

  it('works with the engines that started when some did not', async () => {
    const a = fakeEngine('a');
    const b = fakeEngine('b');
    const results = [a.engine, new EngineError('The engine could not start: no answer in 10 s', 'no answer in 10 s'), b.engine, new Error('out of memory')];
    let started = 0;

    const pool = await EnginePool.start(() => {
      const result = results[started++];
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    }, 4);

    expect(pool.size).toBe(2);
  });

  it('fails to start with the first reason when no engine started', async () => {
    const failures = [new EngineError('The engine could not start: no answer in 10 s', 'no answer in 10 s'), new Error('out of memory')];
    let started = 0;

    const starting = EnginePool.start(() => Promise.reject(failures[started++]), 2);

    await expect(starting).rejects.toBeInstanceOf(EngineError);
    await expect(starting).rejects.toMatchObject({ reason: 'no answer in 10 s' });
  });

  it('gives each search to a free engine and keeps the rest waiting for one', async () => {
    const a = fakeEngine('a');
    const b = fakeEngine('b');
    const engines = [a.engine, b.engine];
    const pool = await EnginePool.start(async () => engines.shift()!, 2);

    const first = pool.evaluate('fen-1', { movetime: 300 });
    const second = pool.evaluate('fen-2', { movetime: 300 });
    const third = pool.evaluate('fen-3', { movetime: 300 });
    await settle();

    // Both engines busy, the third search waits.
    expect([a.searches.map((s) => s.fen), b.searches.map((s) => s.fen)]).toEqual([['fen-1'], ['fen-2']]);

    // B finishes first: the waiting search goes to B.
    b.searches[0].answer(evaluation('b2b4'));
    await settle();
    expect([a.searches.map((s) => s.fen), b.searches.map((s) => s.fen)]).toEqual([['fen-1'], ['fen-2', 'fen-3']]);

    a.searches[0].answer(evaluation('a2a4'));
    b.searches[1].answer(evaluation('c2c4'));
    expect(await first).toEqual(evaluation('a2a4'));
    expect(await second).toEqual(evaluation('b2b4'));
    expect(await third).toEqual(evaluation('c2c4'));
  });

  it('starts a new game in every engine', async () => {
    const all = [fakeEngine('a'), fakeEngine('b'), fakeEngine('c')];
    const engines = all.map((f) => f.engine);
    const pool = await EnginePool.start(async () => engines.shift()!, 3);

    await pool.newGame();

    expect(all.map((f) => f.log)).toEqual([['newGame'], ['newGame'], ['newGame']]);
  });

  it('stops every engine on quit', async () => {
    const all = [fakeEngine('a'), fakeEngine('b')];
    const engines = all.map((f) => f.engine);
    const pool = await EnginePool.start(async () => engines.shift()!, 2);

    pool.quit();

    expect(all.map((f) => f.log)).toEqual([['quit'], ['quit']]);
  });
});
