import type { PositionEvaluation } from './analysis';

/** The engine, search time and lines the evaluations come from (panel.ts): other settings give other evaluations. */
export const ENGINE_TAG = 'stockfish-19-lite-single/300ms/multipv2';

const PREFIX = 'evals:';
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** A game reviewed before: its PGN and the engine's evaluation of each of its positions. */
export interface CachedGame {
  pgn: string;
  positions: PositionEvaluation[];
}

/** The part of chrome.storage.local the cache needs. */
export interface CacheStore {
  get(keys: string | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export interface EvalCache {
  read(externalGameId: string): Promise<CachedGame | null>;
  write(externalGameId: string, game: CachedGame): Promise<void>;
}

/**
 * The evaluations of the last `limit` games reviewed in this browser (about 10 KB each), so that opening a
 * game again needs neither the archive nor the engine. Only games found in the archive get here: finished ones.
 */
export function createEvalCache(store: CacheStore, { limit = 200, now = () => Date.now() } = {}): EvalCache {
  const key = (externalGameId: string) => `${PREFIX}${ENGINE_TAG}:${externalGameId}`;

  return {
    async read(externalGameId) {
      const value = (await store.get(key(externalGameId)))[key(externalGameId)];
      return isCachedGame(value) ? { pgn: value.pgn, positions: value.positions } : null;
    },
    async write(externalGameId, { pgn, positions }) {
      await store.set({ [key(externalGameId)]: { pgn, positions, savedAt: now() } });
      // Evaluations of other engine settings go at once; of these, the oldest beyond the limit.
      const current = `${PREFIX}${ENGINE_TAG}:`;
      const saved = Object.entries(await store.get(null)).filter(([name]) => name.startsWith(PREFIX));
      const stale = saved.filter(([name]) => !name.startsWith(current)).map(([name]) => name);
      const kept = saved
        .filter(([name]) => name.startsWith(current))
        .sort(([, a], [, b]) => savedAt(b) - savedAt(a))
        .map(([name]) => name);
      const forgotten = [...stale, ...kept.slice(limit)];
      if (forgotten.length > 0) {
        await store.remove(forgotten);
      }
    },
  };
}

const savedAt = (value: unknown) => {
  const time = (value as { savedAt?: unknown } | null)?.savedAt;
  return typeof time === 'number' ? time : 0;
};

function isCachedGame(value: unknown): value is CachedGame {
  const { pgn, positions } = (value ?? {}) as Partial<Record<keyof CachedGame, unknown>>;
  return typeof pgn === 'string' && Array.isArray(positions) && positions.every(isPosition);
}

function isPosition(value: unknown): value is PositionEvaluation {
  const { score, bestMoveUci } = (value ?? {}) as { score?: Record<string, unknown>; bestMoveUci?: unknown };
  const scoreOk = typeof score === 'object' && score !== null && (Number.isInteger(score.cp) || Number.isInteger(score.mate));
  return scoreOk && (bestMoveUci === undefined || (typeof bestMoveUci === 'string' && UCI.test(bestMoveUci)));
}
