import { describe, expect, it } from 'vitest';
import recorded from '../test/fixtures/archive-ids-poohineedyou.json';
import { findFinishedGame, OLDER_ARCHIVES_LIMIT, searchOlderArchives } from './archive';
import type { GamePage } from './page';

// The real archives of poohineedyou, 38 months from 2023/06 to 2026/09, recorded 23.09 by
// scripts/record-archive-ids.mjs: the number of every game, and the PGN of six games to find.
// Game numbers grow with time, but not evenly: in 2025/02 some games came from a block of
// numbers about 10 billion lower than the rest, and in 2026/01 the numbers jumped by 16 billion.
const LIST = 'https://api.chess.com/pub/player/poohineedyou/games/archives';
const RECENT = ['2026/09', '2026/08'];
const NOW = new Date('2026-09-23T12:00:00Z');

function archiveOf(month: string) {
  const { live, daily } = recorded.months[month as keyof typeof recorded.months];
  const games = [
    ...live.map((n) => ({ url: `https://www.chess.com/game/live/${n}` })),
    ...daily.map((n) => ({ url: `https://www.chess.com/game/daily/${n}` })),
  ];
  const withPgn = recorded.games.filter((g) => g.month === month);
  return { games: games.map((game) => withPgn.find((g) => g.url === game.url) ?? game) };
}

// The public API as recorded, for one player; any other address answers nothing, like a closed account.
function api() {
  const asked: string[] = [];
  const fetchJson = async (url: string) => {
    asked.push(url);
    if (url === LIST) {
      return { archives: recorded.archives };
    }
    const month = url.startsWith('https://api.chess.com/pub/player/poohineedyou/games/') ? url.slice(-7) : null;
    return month && month in recorded.months ? archiveOf(month) : null;
  };
  return { asked, fetchJson, months: () => asked.filter((url) => url !== LIST && !RECENT.some((m) => url.endsWith(m))) };
}

const live = (id: string): GamePage => ({ type: 'live', id, players: ['poohineedyou', 'closed_account'] });
const daily = (id: string): GamePage => ({ type: 'daily', id, players: ['poohineedyou', 'closed_account'] });

describe('searchOlderArchives', () => {
  it.each([
    ['the first month of the archives', '80995370153', '2023/06'],
    ['a busy month, 1650 games', '110975434041', '2024/06'],
    ['a block of numbers lower than the rest of its month', '122980178122', '2025/02'],
    ['the month where the numbers jumped', '164077125804', '2026/01'],
  ])('finds a live game from %s', async (_, id, month) => {
    const { fetchJson, months } = api();

    const pgn = await searchOlderArchives(live(id), 'poohineedyou', RECENT, fetchJson);

    expect(pgn).toContain(`[Link "https://www.chess.com/game/live/${id}"]`);
    expect(months()).toContain(`https://api.chess.com/pub/player/poohineedyou/games/${month}`);
    expect(months().length).toBeLessThanOrEqual(OLDER_ARCHIVES_LIMIT);
  });

  it('gives up on a game that is in no archive, after at most the limit of archives', async () => {
    const { fetchJson, months } = api();

    expect(await searchOlderArchives(live('150000000000'), 'poohineedyou', RECENT, fetchJson)).toBeNull();
    expect(months()).toHaveLength(OLDER_ARCHIVES_LIMIT);
  });

  it('never downloads the recent archives again', async () => {
    const { asked, fetchJson } = api();

    // Just above the last older month (2026/06): without the skip, the search would open 2026/08 next.
    await searchOlderArchives(live('170300000000'), 'poohineedyou', RECENT, fetchJson);

    expect(asked.filter((url) => RECENT.some((m) => url.endsWith(m)))).toEqual([]);
  });

  it('looks for a daily game from the newest archive back: their numbers say nothing about the month', async () => {
    const { fetchJson, months } = api();

    const pgn = await searchOlderArchives(daily('952111441'), 'poohineedyou', RECENT, fetchJson);

    expect(pgn).toContain('[Link "https://www.chess.com/game/daily/952111441"]');
    expect(months()).toEqual([
      'https://api.chess.com/pub/player/poohineedyou/games/2026/06',
      'https://api.chess.com/pub/player/poohineedyou/games/2026/05',
      'https://api.chess.com/pub/player/poohineedyou/games/2026/04',
    ]);
  });

  it('says so when the player has no list of archives', async () => {
    const { fetchJson } = api();

    expect(await searchOlderArchives(live('80995370153'), 'closed_account', RECENT, fetchJson)).toBeUndefined();
  });
});

describe('findFinishedGame and older games', () => {
  it('reports a game older than the recent archives as older, and searches nothing more', async () => {
    const { asked, fetchJson } = api();

    expect(await findFinishedGame(live('110975434041'), NOW, fetchJson)).toEqual({ status: 'older' });
    expect(asked).not.toContain(LIST);
  });

  it('finds an older game when asked to search deeper', async () => {
    const { fetchJson } = api();

    const lookup = await findFinishedGame(live('110975434041'), NOW, fetchJson, { deep: true });

    expect(lookup.status === 'finished' && lookup.pgn).toContain('[Link "https://www.chess.com/game/live/110975434041"]');
  });

  it('searches the archives of the player who plays less: a busy player has 8 MB in one month', async () => {
    const { asked, fetchJson } = api();
    // The first player of the title plays a thousand games a month, all newer than the game sought.
    const busy = async (url: string) =>
      url.startsWith('https://api.chess.com/pub/player/busy_player/games/2026/')
        ? { games: Array.from({ length: 1000 }, (_, i) => ({ url: `https://www.chess.com/game/live/${173000000000 + i}` })) }
        : fetchJson(url);

    const lookup = await findFinishedGame({ type: 'live', id: '110975434041', players: ['busy_player', 'poohineedyou'] }, NOW, busy, { deep: true });

    expect(lookup.status).toBe('finished');
    expect(asked.filter((url) => url.endsWith('/archives'))).toEqual([LIST]);
  });

  it("goes on to the other player when the game is not in the first one's archives", async () => {
    const { asked, fetchJson } = api();
    // A player with no recent games comes first, and has an archive without the game.
    const stranger = async (url: string) =>
      url === 'https://api.chess.com/pub/player/stranger/games/archives'
        ? { archives: ['https://api.chess.com/pub/player/stranger/games/2024/06'] }
        : url === 'https://api.chess.com/pub/player/stranger/games/2024/06'
          ? { games: [] }
          : fetchJson(url);

    const lookup = await findFinishedGame({ type: 'live', id: '110975434041', players: ['poohineedyou', 'stranger'] }, NOW, stranger, { deep: true });

    expect(lookup.status).toBe('finished');
    expect(asked).toContain(LIST);
  });

  it('does not search older archives for a game newer than the recent ones: it is not over, or not archived yet', async () => {
    const { asked, fetchJson } = api();

    expect(await findFinishedGame(live('174600000000'), NOW, fetchJson, { deep: true })).toEqual({ status: 'not-found' });
    expect(asked).not.toContain(LIST);
  });

  // Friends who play now and then: neither player has a game in the last two months (Pavel, 23.09).
  describe('when neither player played lately', () => {
    const LATER = new Date('2026-12-15T12:00:00Z');

    it('compares with the newest archive of a player, and calls an older game older', async () => {
      const { asked, fetchJson } = api();

      expect(await findFinishedGame(live('110975434041'), LATER, fetchJson)).toEqual({ status: 'older' });
      expect(asked.filter((url) => /\/games\/\d{4}\/\d{2}$/.test(url) && url.includes('poohineedyou'))).toEqual([
        'https://api.chess.com/pub/player/poohineedyou/games/2026/12',
        'https://api.chess.com/pub/player/poohineedyou/games/2026/11',
        'https://api.chess.com/pub/player/poohineedyou/games/2026/09',
      ]);
    });

    it('finds a game that is in that newest archive', async () => {
      const { fetchJson } = api();
      const newest = 'https://api.chess.com/pub/player/poohineedyou/games/2026/09';
      const game = recorded.games.find((g) => g.month === '2026/01')!;
      const withGame = async (url: string) => (url === newest ? { games: [{ url: game.url, pgn: game.pgn }] } : fetchJson(url));

      const lookup = await findFinishedGame(live('164077125804'), LATER, withGame);

      expect(lookup.status === 'finished' && lookup.pgn).toContain('[Link "https://www.chess.com/game/live/164077125804"]');
    });

    it('still calls a newer game not found: it is in progress', async () => {
      const { fetchJson } = api();

      expect(await findFinishedGame(live('185000000000'), LATER, fetchJson, { deep: true })).toEqual({ status: 'not-found' });
    });

    it('calls a game not found when no archive has a game of its kind to compare with', async () => {
      const { fetchJson } = api();

      // The same archives without their daily games: nothing to compare a daily game with.
      const noDaily = async (url: string) => {
        const answer = (await fetchJson(url)) as { games?: { url: string }[] } | null;
        return answer?.games ? { games: answer.games.filter((g) => g.url.includes('/live/')) } : answer;
      };
      expect(await findFinishedGame(daily('714066857'), LATER, noDaily)).toEqual({ status: 'not-found' });
    });
  });
});
