import type { GamePage } from './page';

export type Lookup = { status: 'finished'; pgn: string } | { status: 'not-found' };

export interface ArchiveMonth {
  year: string;
  month: string;
}

// https://www.chess.com/game/live/173765478164 — how the API names a game.
const GAME_URL = /\/game\/(live|daily)\/(\d+)$/;

/** The PGN of the game in a monthly archive of the public API, or null. */
export function findGame(archive: unknown, page: Pick<GamePage, 'type' | 'id'>): string | null {
  const games = (archive as { games?: unknown } | null)?.games;
  if (!Array.isArray(games)) {
    return null;
  }

  for (const game of games) {
    const address = typeof game?.url === 'string' ? GAME_URL.exec(game.url) : null;
    if (address?.[1] === page.type && address[2] === page.id && typeof game.pgn === 'string') {
      return game.pgn;
    }
  }

  return null;
}

/** The archives a recently finished game is in: this month and the one before, in UTC as the API keeps them. */
export function archiveMonths(now: Date): ArchiveMonth[] {
  const format = (date: Date) => ({ year: String(date.getUTCFullYear()), month: String(date.getUTCMonth() + 1).padStart(2, '0') });
  return [format(now), format(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)))];
}

export function archiveUrl(player: string, { year, month }: ArchiveMonth): string {
  return `https://api.chess.com/pub/player/${encodeURIComponent(player.toLowerCase())}/games/${year}/${month}`;
}

/**
 * Looks the game up in the players' monthly archives. The archives hold only finished games, so a
 * game found there is over: this is what keeps the review off games in progress.
 */
export async function findFinishedGame(page: GamePage, now: Date, fetchJson: (url: string) => Promise<unknown>): Promise<Lookup> {
  for (const player of page.players) {
    for (const month of archiveMonths(now)) {
      const pgn = findGame(await fetchJson(archiveUrl(player, month)), page);
      if (pgn !== null) {
        return { status: 'finished', pgn };
      }
    }
  }

  return { status: 'not-found' };
}

/** The JSON of a public API answer, or null when there is none: a closed account, an outage. */
export async function fetchJson(url: string): Promise<unknown> {
  try {
    const response = await fetch(url);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
