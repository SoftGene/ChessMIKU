import type { SearchLimit } from './engine';
import type { EngineLine } from './uci';

/** The part of the engine the player's line needs: several lines of a position. */
export interface LinesEngine {
  evaluateLines(fen: string, limit: SearchLimit): Promise<EngineLine[]>;
  quit(): void;
}

export interface LineEngine {
  /**
   * The lines of a position: at once when known; `undefined` while they are searched (asking starts the search);
   * `null` when the engine is unavailable.
   */
  lines(fen: string): EngineLine[] | null | undefined;
}

/**
 * The engine of the player's line: started at the first position asked for, then kept. Only the newest position
 * waits for a search: one asked for while another is searched replaces the one waiting. `ready` hears each position
 * searched, and each one left when the engine failed; an engine that failed is not started again.
 */
export function createLineEngine(start: () => Promise<LinesEngine>, limit: SearchLimit, ready: (fen: string) => void): LineEngine {
  const known = new Map<string, EngineLine[]>();
  let engine: LinesEngine | null = null;
  let failed = false;
  let searching: string | null = null;
  let waiting: string | null = null;

  async function run() {
    while (waiting !== null) {
      const fen = waiting;
      waiting = null;
      searching = fen;
      if (!failed) {
        try {
          engine ??= await start();
          known.set(fen, await engine.evaluateLines(fen, limit));
        } catch {
          failed = true;
          engine?.quit();
        }
      }
      searching = null;
      ready(fen);
    }
  }

  return {
    lines(fen) {
      if (failed) {
        return null;
      }
      const found = known.get(fen);
      if (found || fen === searching) {
        return found;
      }
      const idle = searching === null && waiting === null;
      waiting = fen;
      if (idle) {
        void run();
      }
      return undefined;
    },
  };
}
