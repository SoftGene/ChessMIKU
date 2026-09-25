import type { GamePage, Orientation } from './page';

/**
 * Content script or panel → service worker: is this game finished, and what is its PGN? The answer is a
 * Lookup. `deep`: also search the older archives (the panel asks so; the content script, on every page, not).
 */
export const FIND_FINISHED_GAME = 'chess-review/find-finished-game';

export interface FindFinishedGame {
  type: typeof FIND_FINISHED_GAME;
  page: GamePage;
  deep?: boolean;
}

export const USERNAME = /^[A-Za-z0-9_-]{3,25}$/;

/** The query of the panel's address: the panel is an extension page and learns its game from it. */
export function panelSearch(page: GamePage, orientation: Orientation = 'white'): string {
  return `?${new URLSearchParams({ type: page.type, id: page.id, players: page.players.join(','), orientation })}`;
}

/** The game in the query of the panel's address, or null when it names no valid game. */
export function readPanelSearch(search: string): GamePage | null {
  const query = new URLSearchParams(search);
  const page = { type: query.get('type'), id: query.get('id'), players: query.get('players')?.split(',') };
  return isFindFinishedGame({ type: FIND_FINISHED_GAME, page }) ? (page as GamePage) : null;
}

// Players come from the page title and end up in an API address: only real usernames pass.
export function isFindFinishedGame(message: unknown): message is FindFinishedGame {
  const { type, page, deep } = (message ?? {}) as { type?: unknown; page?: Partial<GamePage>; deep?: unknown };

  return type === FIND_FINISHED_GAME
    && (deep === undefined || typeof deep === 'boolean')
    && (page?.type === 'live' || page?.type === 'daily')
    && typeof page.id === 'string' && /^\d+$/.test(page.id)
    && Array.isArray(page.players) && page.players.length === 2
    && page.players.every((player) => typeof player === 'string' && USERNAME.test(player));
}

/** The side at the bottom of the board from the panel's address; anything but "black" is White. */
export function readOrientation(search: string): Orientation {
  return new URLSearchParams(search).get('orientation') === 'black' ? 'black' : 'white';
}

/** Panel → content script: close the review window. */
export const CLOSE_PANEL = 'chess-review/close';

export function isClosePanel(data: unknown): boolean {
  return (data as { type?: unknown } | null)?.type === CLOSE_PANEL;
}
