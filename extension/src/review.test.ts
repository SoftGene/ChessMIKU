import { describe, expect, it, vi } from 'vitest';
import { EngineError } from './engine';
import type { GamePage } from './page';
import { runReview, type ReviewDeps, type ReviewEngine, type ReviewState } from './review';

const page: GamePage = { type: 'live', id: '173765478164', players: ['Hikaru', 'poohineedyou'] };
const FOOLS_MATE = '1. f3 e5 2. g4 Qh4# 0-1';

// An engine that remembers what it was asked; `failAt` makes that search (counted from 1) fail.
function fakeEngine(failAt?: number) {
  const calls: string[] = [];
  let searches = 0;
  const engine: ReviewEngine = {
    async newGame() {
      calls.push('newGame');
    },
    async evaluate(_fen, limit) {
      calls.push(`evaluate ${JSON.stringify(limit)}`);
      if (++searches === failAt) {
        throw new EngineError('The engine stopped: RuntimeError: unreachable');
      }
      return { bestMoveUci: 'e2e4', score: { cp: 10 } };
    },
    quit() {
      calls.push('quit');
    },
  };
  return { engine, calls };
}

function deps(overrides: Partial<ReviewDeps> = {}, engine: ReviewEngine = fakeEngine().engine): ReviewDeps {
  return {
    lookUp: async () => ({ status: 'finished', pgn: FOOLS_MATE }),
    startEngine: async () => engine,
    limit: { movetime: 300 },
    ...overrides,
  };
}

async function review(reviewDeps: ReviewDeps) {
  const states: ReviewState[] = [];
  await runReview(page, reviewDeps, (state) => states.push(state));
  return states;
}

const stages = (states: ReviewState[]) => states.map((s) => (s.stage === 'analysing' ? `analysing ${s.done}/${s.total}` : s.stage));

describe('runReview', () => {
  it('shows each step of a review and ends with the evaluated moves', async () => {
    const states = await review(deps());

    expect(stages(states)).toEqual(['looking-up', 'starting-engine', 'analysing 1/5', 'analysing 2/5', 'analysing 3/5', 'analysing 4/5', 'analysing 5/5', 'done']);
    const last = states.at(-1);
    expect(last?.stage === 'done' && last.moves.map((m) => m.san)).toEqual(['f3', 'e5', 'g4', 'Qh4#']);
  });

  it('starts a new game in the engine, searches with the given limit and stops the engine after', async () => {
    const { engine, calls } = fakeEngine();

    await review(deps({ limit: { depth: 12 } }, engine));

    expect(calls).toEqual(['newGame', ...Array(4).fill('evaluate {"depth":12}'), 'quit']);
  });

  it('says the game is not in the archive, and does not start the engine', async () => {
    const startEngine = vi.fn();

    const states = await review(deps({ lookUp: async () => ({ status: 'not-found' }), startEngine }));

    expect(states).toEqual([{ stage: 'looking-up' }, { stage: 'not-found' }]);
    expect(startEngine).not.toHaveBeenCalled();
  });

  it('says the engine could not start', async () => {
    const startEngine = () => Promise.reject(new EngineError('The engine could not start: no answer in 20 s'));

    const states = await review(deps({ startEngine }));

    expect(states).toEqual([{ stage: 'looking-up' }, { stage: 'starting-engine' }, { stage: 'engine-failed', reason: 'The engine could not start: no answer in 20 s' }]);
  });

  it('says the review failed when the engine stops midway, and stops the engine', async () => {
    const { engine, calls } = fakeEngine(2);

    const states = await review(deps({}, engine));

    expect(states.at(-1)).toEqual({ stage: 'failed', reason: 'The engine stopped: RuntimeError: unreachable' });
    expect(calls.at(-1)).toBe('quit');
  });

  it('says the review failed when the game cannot be read, and stops the engine', async () => {
    const { engine, calls } = fakeEngine();

    const states = await review(deps({ lookUp: async () => ({ status: 'finished', pgn: '1. e4 e5 2. Ke3 *' }) }, engine));

    expect(states.at(-1)).toMatchObject({ stage: 'failed', reason: expect.stringMatching(/could not be read/) });
    expect(calls).toEqual(['newGame', 'quit']);
  });

  it('says the review failed when the game cannot be looked up', async () => {
    const lookUp = () => Promise.reject(new Error('Could not establish connection. Receiving end does not exist.'));

    const states = await review(deps({ lookUp }));

    expect(states).toEqual([{ stage: 'looking-up' }, { stage: 'failed', reason: 'Could not establish connection. Receiving end does not exist.' }]);
  });
});
