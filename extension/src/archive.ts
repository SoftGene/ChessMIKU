import type { GamePage } from './page';

/**
 * A game is `finished` when an archive holds it. `older`: not in the recent archives, and older than
 * every game in them, so it may be in older archives (searched when asked with `deep`).
 */
export type Lookup = { status: 'finished'; pgn: string } | { status: 'older' } | { status: 'not-found' };

/** The most monthly archives one search in older archives downloads. */
export const OLDER_ARCHIVES_LIMIT = 12;

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
export async function findFinishedGame(
  page: GamePage,
  now: Date,
  fetchJson: (url: string) => Promise<unknown>,
  { deep = false }: { deep?: boolean } = {},
): Promise<Lookup> {
  const recent = archiveMonths(now);
  const recentNumbers: number[] = [];
  const recentGames = new Map<string, number>();
  for (const player of page.players) {
    for (const month of recent) {
      const archive = await fetchJson(archiveUrl(player, month));
      const pgn = findGame(archive, page);
      if (pgn !== null) {
        return { status: 'finished', pgn };
      }
      recentNumbers.push(...gameNumbers(archive, page.type));
      recentGames.set(player, (recentGames.get(player) ?? 0) + gameNumbers(archive, 'live').length + gameNumbers(archive, 'daily').length);
    }
  }

  // Neither player had a game of this kind in the recent months (friends who play now and then): the
  // newest archive of one of them is what to compare with, and may hold the game itself.
  const checked = recent.map(({ year, month }) => `${year}/${month}`);
  for (const player of page.players) {
    if (recentNumbers.length > 0) {
      break;
    }
    const urls = await archiveList(player, checked, fetchJson);
    const newest = urls?.at(-1);
    if (newest) {
      checked.push(newest.slice(-7));
      const archive = await fetchJson(newest);
      const pgn = findGame(archive, page);
      if (pgn !== null) {
        return { status: 'finished', pgn };
      }
      recentNumbers.push(...gameNumbers(archive, page.type));
    }
  }

  // Only a game older than every game of its kind in the recent archives can be in older ones. A newer
  // game is in progress, or has just ended and is not archived yet; nothing to compare with — unknown.
  if (recentNumbers.length === 0 || Number(page.id) >= Math.min(...recentNumbers)) {
    return { status: 'not-found' };
  }
  if (!deep) {
    return { status: 'older' };
  }

  // Both players have the game in their archives: start with the one who plays less. A month of a
  // player with 2000 games weighs 8 MB, of one with 400 games 1.6 MB (seen 23.09).
  const players = [...page.players].sort((a, b) => (recentGames.get(a) ?? 0) - (recentGames.get(b) ?? 0));
  // If the first has no archives, or an incomplete one (a closed account), the other may have the game.
  for (const player of players) {
    const pgn = await searchOlderArchives(page, player, checked, fetchJson);
    if (typeof pgn === 'string') {
      return { status: 'finished', pgn };
    }
  }
  return { status: 'not-found' };
}

/**
 * Looks for a game in the older monthly archives of one player. Returns its PGN, null when it is not
 * found within OLDER_ARCHIVES_LIMIT archives, or undefined when the player has no list of archives.
 */
export async function searchOlderArchives(
  page: Pick<GamePage, 'type' | 'id'>,
  player: string,
  skipMonths: string[],
  fetchJson: (url: string) => Promise<unknown>,
): Promise<string | null | undefined> {
  const urls = await archiveList(player, skipMonths, fetchJson);
  if (!urls) {
    return undefined;
  }

  const archives = new Map<number, unknown>();
  const open = async (i: number): Promise<unknown> => {
    if (!archives.has(i)) {
      archives.set(i, await fetchJson(urls[i]));
    }
    return archives.get(i);
  };
  const canOpen = (i: number) => i >= 0 && i < urls.length && (archives.has(i) || archives.size < OLDER_ARCHIVES_LIMIT);

  // Daily games last for weeks, and their numbers come from a sequence of their own: nothing tells the month.
  if (page.type === 'daily') {
    for (let i = urls.length - 1; canOpen(i); i--) {
      const pgn = findGame(await open(i), page);
      if (pgn !== null) {
        return pgn;
      }
    }
    return null;
  }

  // Live game numbers grow with time, with exceptions: blocks of lower numbers, jumps. The median number
  // of a month still grows, so halve the list by it, then look at the months around where the game fits.
  const id = Number(page.id);
  let low = 0;
  let high = urls.length - 1;
  while (low <= high && canOpen((low + high) >> 1)) {
    const middle = (low + high) >> 1;
    const archive = await open(middle);
    const pgn = findGame(archive, page);
    if (pgn !== null) {
      return pgn;
    }
    const median = medianOf(gameNumbers(archive, 'live'));
    if (median === null) {
      break;
    }
    if (id < median) {
      high = middle - 1;
    } else {
      low = middle + 1;
    }
  }

  // `low` is the first month whose median is above the game: it is there or in the month before, most
  // likely; then further out on both sides.
  for (let step = 0; step < urls.length; step++) {
    for (const i of [low - 1 - step, low + step]) {
      if (canOpen(i)) {
        const pgn = findGame(await open(i), page);
        if (pgn !== null) {
          return pgn;
        }
      }
    }
    if (archives.size >= OLDER_ARCHIVES_LIMIT) {
      break;
    }
  }
  return null;
}

/** The addresses of a player's monthly archives, oldest first, without the months to skip; undefined without a list. */
async function archiveList(player: string, skipMonths: string[], fetchJson: (url: string) => Promise<unknown>): Promise<string[] | undefined> {
  const prefix = `https://api.chess.com/pub/player/${encodeURIComponent(player.toLowerCase())}/games/`;
  const list = ((await fetchJson(`${prefix}archives`)) as { archives?: unknown } | null)?.archives;
  if (!Array.isArray(list)) {
    return undefined;
  }
  return list.filter((url): url is string => typeof url === 'string' && url.startsWith(prefix) && !skipMonths.includes(url.slice(prefix.length)));
}

/** The numbers of the games of one kind in a monthly archive. */
function gameNumbers(archive: unknown, type: GamePage['type']): number[] {
  const games = (archive as { games?: unknown } | null)?.games;
  if (!Array.isArray(games)) {
    return [];
  }
  return games.flatMap((game) => {
    const address = typeof game?.url === 'string' ? GAME_URL.exec(game.url) : null;
    return address?.[1] === type ? [Number(address[2])] : [];
  });
}

function medianOf(numbers: number[]): number | null {
  if (numbers.length === 0) {
    return null;
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
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
