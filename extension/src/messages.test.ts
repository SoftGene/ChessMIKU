import { describe, expect, it } from 'vitest';
import type { GamePage } from './page';
import { FIND_FINISHED_GAME, isClosePanel, isFindFinishedGame, panelSearch, readOrientation, readPanelSearch } from './messages';

const page = { type: 'live', id: '173765478164', players: ['Hikaru', 'poohineedyou'] };

describe('isFindFinishedGame', () => {
  it('accepts a request for a game page', () => {
    expect(isFindFinishedGame({ type: FIND_FINISHED_GAME, page })).toBe(true);
  });

  it('accepts a request to search older archives too', () => {
    expect(isFindFinishedGame({ type: FIND_FINISHED_GAME, page, deep: true })).toBe(true);
  });

  // Players come from the page title: they end up in an API address, so only real usernames pass.
  it.each([
    ['another message', { type: 'other', page }],
    ['no page', { type: FIND_FINISHED_GAME }],
    ['an unknown game type', { type: FIND_FINISHED_GAME, page: { ...page, type: 'bullet' } }],
    ['a game number with letters', { type: FIND_FINISHED_GAME, page: { ...page, id: '12a' } }],
    ['a path in a username', { type: FIND_FINISHED_GAME, page: { ...page, players: ['../../stats', 'x_y'] } }],
    ['one player', { type: FIND_FINISHED_GAME, page: { ...page, players: ['Hikaru'] } }],
    ['a search depth that is not true or false', { type: FIND_FINISHED_GAME, page, deep: 'yes' }],
  ])('rejects %s', (_, message) => {
    expect(isFindFinishedGame(message)).toBe(false);
  });
});

describe('the address of the panel', () => {
  const game: GamePage = { type: 'live', id: '173765478164', players: ['Hikaru', 'poohineedyou'] };

  it('names the game and its players', () => {
    expect(panelSearch(game)).toBe('?type=live&id=173765478164&players=Hikaru%2Cpoohineedyou&orientation=white');
  });

  it('names the side at the bottom of the board', () => {
    expect(panelSearch(game, 'black')).toBe('?type=live&id=173765478164&players=Hikaru%2Cpoohineedyou&orientation=black');
  });

  it('gives the panel back the same game', () => {
    expect(readPanelSearch(panelSearch(game))).toEqual(game);
  });

  // Any chess.com page can open the panel with an address of its own making.
  it.each([
    ['no game number', '?type=live&players=Hikaru%2Cpoohineedyou'],
    ['an unknown game type', '?type=bullet&id=173765478164&players=Hikaru%2Cpoohineedyou'],
    ['a path in a username', '?type=live&id=173765478164&players=..%2F..%2Fstats%2Cpoohineedyou'],
    ['three players', '?type=live&id=173765478164&players=Hikaru%2Cpoohineedyou%2Cmagnus'],
    ['nothing at all', ''],
  ])('names no game with %s', (_, search) => {
    expect(readPanelSearch(search)).toBeNull();
  });
});

describe('readOrientation', () => {
  it('reads Black at the bottom', () => {
    expect(readOrientation('?type=live&orientation=black')).toBe('black');
  });

  it.each(['?orientation=white', '', '?orientation=sideways'])('is White otherwise: %j', (search) => {
    expect(readOrientation(search)).toBe('white');
  });
});

describe('isClosePanel', () => {
  it('knows the request of the panel to close it', () => {
    expect(isClosePanel({ type: 'chess-review/close' })).toBe(true);
  });

  it.each([[{ type: 'other' }], [null], ['chess-review/close'], [{}]])('ignores anything else: %j', (data) => {
    expect(isClosePanel(data)).toBe(false);
  });
});
