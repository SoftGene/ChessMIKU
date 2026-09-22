import { describe, expect, it } from 'vitest';
import { FIND_FINISHED_GAME, isFindFinishedGame } from './messages';

const page = { type: 'live', id: '173765478164', players: ['Hikaru', 'poohineedyou'] };

describe('isFindFinishedGame', () => {
  it('accepts a request for a game page', () => {
    expect(isFindFinishedGame({ type: FIND_FINISHED_GAME, page })).toBe(true);
  });

  // Players come from the page title: they end up in an API address, so only real usernames pass.
  it.each([
    ['another message', { type: 'other', page }],
    ['no page', { type: FIND_FINISHED_GAME }],
    ['an unknown game type', { type: FIND_FINISHED_GAME, page: { ...page, type: 'bullet' } }],
    ['a game number with letters', { type: FIND_FINISHED_GAME, page: { ...page, id: '12a' } }],
    ['a path in a username', { type: FIND_FINISHED_GAME, page: { ...page, players: ['../../stats', 'x_y'] } }],
    ['one player', { type: FIND_FINISHED_GAME, page: { ...page, players: ['Hikaru'] } }],
  ])('rejects %s', (_, message) => {
    expect(isFindFinishedGame(message)).toBe(false);
  });
});
