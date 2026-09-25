import { analyseGame, movesFrom, type MoveEvaluation, type PositionEvaluation } from './analysis';
import type { Lookup } from './archive';
import { EngineError, type SearchLimit } from './engine';
import type { EvalCache } from './eval-cache';
import { readGame, type Game } from './game';
import type { GamePage } from './page';
import type { Evaluation } from './uci';

/** What the window shows while it reviews a game. */
export type ReviewState =
  | { stage: 'looking-up' }
  | { stage: 'not-found' }
  | { stage: 'starting-engine'; game: Game }
  | { stage: 'engine-failed'; game: Game; reason: string }
  | { stage: 'analysing'; game: Game; index: number; evaluation: PositionEvaluation; done: number; total: number }
  | { stage: 'done'; game: Game; pgn: string; moves: MoveEvaluation[]; positions: PositionEvaluation[]; cached: boolean }
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
  /** Evaluations of games reviewed before (T7.3): a game found there needs neither the archive nor the engine. */
  cache?: EvalCache;
}

/** Finds the game, evaluates it with the engine and tells `show` each step. Never throws. */
export async function runReview(page: GamePage, deps: ReviewDeps, show: (state: ReviewState) => void): Promise<void> {
  let engine: ReviewEngine | null = null;
  const externalGameId = `${page.type}/${page.id}`;
  try {
    show({ stage: 'looking-up' });
    const saved = await deps.cache?.read(externalGameId).catch(() => null);
    const again = saved ? fromCache(saved.pgn, saved.positions) : null;
    if (again) {
      show({ stage: 'done', ...again, cached: true });
      return;
    }

    const lookup = await deps.lookUp(page);
    if (lookup.status !== 'finished') {
      show({ stage: 'not-found' });
      return;
    }

    // The window shows the game while the engine starts and evaluates it.
    const game = readGame(lookup.pgn);
    show({ stage: 'starting-engine', game });
    try {
      engine = await deps.startEngine();
    } catch (error) {
      show({ stage: 'engine-failed', game, reason: error instanceof EngineError ? error.reason : reasonOf(error) });
      return;
    }

    await engine.newGame();
    const running = engine;
    const positions: PositionEvaluation[] = [];
    const moves = await analyseGame(game, (fen) => running.evaluate(fen, deps.limit), (index, evaluation, done, total) => {
      positions[index] = evaluation;
      show({ stage: 'analysing', game, index, evaluation, done, total });
    });
    show({ stage: 'done', game, pgn: lookup.pgn, moves, positions, cached: false });
    await deps.cache?.write(externalGameId, { pgn: lookup.pgn, positions }).catch(() => undefined);
  } catch (error) {
    show({ stage: 'failed', reason: reasonOf(error) });
  } finally {
    engine?.quit();
  }
}

// A saved game that still fits: its PGN reads, and it has an evaluation for each position.
function fromCache(pgn: string, positions: PositionEvaluation[]) {
  try {
    const game = readGame(pgn);
    return positions.length === game.plies.length + 1 ? { game, pgn, moves: movesFrom(game, positions), positions } : null;
  } catch {
    return null;
  }
}

const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
