import { analyseGame, type MoveEvaluation } from './analysis';
import type { Lookup } from './archive';
import type { SearchLimit } from './engine';
import type { GamePage } from './page';
import type { Evaluation } from './uci';

/** What the panel shows while it reviews a game. */
export type ReviewState =
  | { stage: 'looking-up' }
  | { stage: 'not-found' }
  | { stage: 'starting-engine' }
  | { stage: 'engine-failed'; reason: string }
  | { stage: 'analysing'; done: number; total: number }
  | { stage: 'done'; moves: MoveEvaluation[] }
  | { stage: 'failed'; reason: string };

/** The part of the engine a review needs. */
export interface ReviewEngine {
  newGame(): Promise<void>;
  evaluate(fen: string, limit: SearchLimit): Promise<Evaluation>;
  quit(): void;
}

export interface ReviewDeps {
  lookUp(page: GamePage): Promise<Lookup>;
  startEngine(): Promise<ReviewEngine>;
  limit: SearchLimit;
}

/** Finds the game, evaluates it with the engine and tells `show` each step. Never throws. */
export async function runReview(page: GamePage, deps: ReviewDeps, show: (state: ReviewState) => void): Promise<void> {
  let engine: ReviewEngine | null = null;
  try {
    show({ stage: 'looking-up' });
    const lookup = await deps.lookUp(page);
    if (lookup.status !== 'finished') {
      show({ stage: 'not-found' });
      return;
    }

    show({ stage: 'starting-engine' });
    try {
      engine = await deps.startEngine();
    } catch (error) {
      show({ stage: 'engine-failed', reason: reasonOf(error) });
      return;
    }

    await engine.newGame();
    const running = engine;
    const moves = await analyseGame(lookup.pgn, (fen) => running.evaluate(fen, deps.limit), (done, total) => show({ stage: 'analysing', done, total }));
    show({ stage: 'done', moves });
  } catch (error) {
    show({ stage: 'failed', reason: reasonOf(error) });
  } finally {
    engine?.quit();
  }
}

const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
