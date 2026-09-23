import type { GamePage } from './page';

/** Content script → service worker: is this game finished, and what is its PGN? The answer is a Lookup. */
export const FIND_FINISHED_GAME = 'chess-review/find-finished-game';

export interface FindFinishedGame {
  type: typeof FIND_FINISHED_GAME;
  page: GamePage;
}

const USERNAME = /^[A-Za-z0-9_-]{3,25}$/;

/** The query of the panel's address: the panel is an extension page and learns its game from it. */
export function panelSearch(page: GamePage): string {
  return `?${new URLSearchParams({ type: page.type, id: page.id, players: page.players.join(',') })}`;
}

/** The game in the query of the panel's address, or null when it names no valid game. */
export function readPanelSearch(search: string): GamePage | null {
  const query = new URLSearchParams(search);
  const page = { type: query.get('type'), id: query.get('id'), players: query.get('players')?.split(',') };
  return isFindFinishedGame({ type: FIND_FINISHED_GAME, page }) ? (page as GamePage) : null;
}

// Players come from the page title and end up in an API address: only real usernames pass.
export function isFindFinishedGame(message: unknown): message is FindFinishedGame {
  const { type, page } = (message ?? {}) as { type?: unknown; page?: Partial<GamePage> };

  return type === FIND_FINISHED_GAME
    && (page?.type === 'live' || page?.type === 'daily')
    && typeof page.id === 'string' && /^\d+$/.test(page.id)
    && Array.isArray(page.players) && page.players.length === 2
    && page.players.every((player) => typeof player === 'string' && USERNAME.test(player));
}
