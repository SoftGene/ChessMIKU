import { describe, expect, it } from 'vitest';
import archive from '../test/fixtures/archive-hikaru-2026-08.json';
import { archiveMonths, archiveUrl, findFinishedGame, findGame } from './archive';
import type { GamePage } from './page';

// A real response of api.chess.com/pub/player/hikaru/games/2026/08, cut to its last three games.
const FINISHED: GamePage = { type: 'live', id: '173765478164', players: ['Hikaru', 'poohineedyou'] };
const IN_PROGRESS: GamePage = { type: 'live', id: '173799999999', players: ['Hikaru', 'poohineedyou'] };

describe('findGame', () => {
  it('finds a game of the archive by its type and number', () => {
    const pgn = findGame(archive, FINISHED);

    expect(pgn).toMatch(/^\[Event "Live Chess"\]/);
    expect(pgn).toContain('[Link "https://www.chess.com/game/live/173765478164"]');
  });

  it('does not find a game that is not in the archive', () => {
    expect(findGame(archive, IN_PROGRESS)).toBeNull();
    expect(findGame(archive, { ...FINISHED, type: 'daily' })).toBeNull();
  });

  it.each([null, {}, { games: 'none' }, 'not json'])('ignores an answer that is not an archive: %j', (answer) => {
    expect(findGame(answer, FINISHED)).toBeNull();
  });
});

describe('archiveMonths', () => {
  it('is this month and the one before, in UTC', () => {
    expect(archiveMonths(new Date('2026-09-15T12:00:00Z'))).toEqual([{ year: '2026', month: '09' }, { year: '2026', month: '08' }]);
  });

  it('goes back over the new year', () => {
    expect(archiveMonths(new Date('2026-01-03T12:00:00Z'))).toEqual([{ year: '2026', month: '01' }, { year: '2025', month: '12' }]);
  });

  it('follows UTC, not the local time of the browser', () => {
    // Half past midnight on 1 September in Prague is still 31 August in UTC.
    expect(archiveMonths(new Date('2026-09-01T00:30:00+02:00'))).toEqual([{ year: '2026', month: '08' }, { year: '2026', month: '07' }]);
  });
});

describe('archiveUrl', () => {
  it('asks for the username in lower case, as the API expects', () => {
    expect(archiveUrl('Hikaru', { year: '2026', month: '08' })).toBe('https://api.chess.com/pub/player/hikaru/games/2026/08');
  });
});

describe('findFinishedGame', () => {
  const now = new Date('2026-09-05T10:00:00Z');

  function api(answers: Record<string, unknown>) {
    const asked: string[] = [];
    const fetchJson = async (url: string) => {
      asked.push(url);
      return url in answers ? answers[url] : null;
    };
    return { asked, fetchJson };
  }

  it('finds a game that ended last month', async () => {
    const { asked, fetchJson } = api({
      'https://api.chess.com/pub/player/hikaru/games/2026/09': { games: [] },
      'https://api.chess.com/pub/player/hikaru/games/2026/08': archive,
    });

    const result = await findFinishedGame(FINISHED, now, fetchJson);

    expect(result.status).toBe('finished');
    expect(asked).toEqual([
      'https://api.chess.com/pub/player/hikaru/games/2026/09',
      'https://api.chess.com/pub/player/hikaru/games/2026/08',
    ]);
  });

  it('asks the other player when the first one has no archive', async () => {
    const { asked, fetchJson } = api({ 'https://api.chess.com/pub/player/poohineedyou/games/2026/08': archive });

    expect((await findFinishedGame(FINISHED, now, fetchJson)).status).toBe('finished');
    expect(asked.at(-1)).toBe('https://api.chess.com/pub/player/poohineedyou/games/2026/08');
  });

  it('reports a game in progress as not found: only finished games are archived', async () => {
    const { fetchJson } = api({
      'https://api.chess.com/pub/player/hikaru/games/2026/09': { games: [] },
      'https://api.chess.com/pub/player/hikaru/games/2026/08': archive,
      'https://api.chess.com/pub/player/poohineedyou/games/2026/09': { games: [] },
      'https://api.chess.com/pub/player/poohineedyou/games/2026/08': archive,
    });

    expect(await findFinishedGame(IN_PROGRESS, now, fetchJson)).toEqual({ status: 'not-found' });
  });
});
