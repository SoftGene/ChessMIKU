// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { boardOrientation, parseGamePage, shownAsOver } from './page';

// Titles as chess.com set them on 22.09.2026 for a finished game, seen as a guest.
const ENGLISH_TITLE = 'Chess: Hikaru vs poohineedyou - 173765478164 - Chess.com';
const RUSSIAN_TITLE = 'Шахматы: Hikaru против poohineedyou - 173765478164 - Chess.com';

// chess.com's analysis of a finished game, where a logged-in player lands from their list of games
// (23.09.2026, the same English title on /ru/). The game number is only in the address.
const ANALYSIS = 'https://www.chess.com/analysis/game/live/173765478164/analysis';
const ANALYSIS_TITLE = 'Hikaru vs. poohineedyou | Analysis - Chess.com';

// The analysis page of a game in progress (a daily game of erik, 23.09.2026): an empty board, no players.
const ANALYSIS_IN_PROGRESS = 'https://www.chess.com/analysis/game/daily/1031528548/analysis';
const ANALYSIS_IN_PROGRESS_TITLE = 'Analysis | Chess.com - Chess.com';

// The title the server sends before the page script rewrites it: no game number yet.
const RUSSIAN_TITLE_BEFORE_THE_SCRIPT = 'Шахматы: GM Hikaru - poohineedyou - Chess.com';

describe('parseGamePage', () => {
  it('reads the game and both players from an English game page', () => {
    expect(parseGamePage('https://www.chess.com/game/live/173765478164', ENGLISH_TITLE))
      .toEqual({ type: 'live', id: '173765478164', players: ['Hikaru', 'poohineedyou'] });
  });

  it('reads a localised game page, whose address has a language', () => {
    expect(parseGamePage('https://www.chess.com/ru/game/live/173765478164?move=12#tab', RUSSIAN_TITLE))
      .toEqual({ type: 'live', id: '173765478164', players: ['Hikaru', 'poohineedyou'] });
  });

  it('reads a daily game', () => {
    expect(parseGamePage('https://www.chess.com/game/daily/987654321', 'Chess: anna_k vs bob-2 - 987654321 - Chess.com'))
      .toEqual({ type: 'daily', id: '987654321', players: ['anna_k', 'bob-2'] });
  });

  it('waits while the title has no game number yet', () => {
    expect(parseGamePage('https://www.chess.com/ru/game/live/173765478164', RUSSIAN_TITLE_BEFORE_THE_SCRIPT)).toBeNull();
  });

  it('waits while the title still names the previous game', () => {
    expect(parseGamePage('https://www.chess.com/game/live/173765478165', ENGLISH_TITLE)).toBeNull();
  });

  it('reads the game from the address of an analysis page and the players from its title', () => {
    expect(parseGamePage(ANALYSIS, ANALYSIS_TITLE)).toEqual({ type: 'live', id: '173765478164', players: ['Hikaru', 'poohineedyou'] });
  });

  it('reads a localised analysis page', () => {
    expect(parseGamePage('https://www.chess.com/ru/analysis/game/live/173765223182/analysis', ANALYSIS_TITLE))
      .toEqual({ type: 'live', id: '173765223182', players: ['Hikaru', 'poohineedyou'] });
  });

  it('sees no game on the empty analysis board chess.com shows for a game in progress', () => {
    expect(parseGamePage(ANALYSIS_IN_PROGRESS, ANALYSIS_IN_PROGRESS_TITLE)).toBeNull();
  });

  it.each([
    'https://www.chess.com/play/online',
    'https://www.chess.com/analysis/game/live/173765478164',
    'https://www.chess.com/game/live/abc',
    'https://evil.example/game/live/173765478164',
    'http://www.chess.com/game/live/173765478164',
  ])('is not a game page: %s', (url) => {
    expect(parseGamePage(url, ENGLISH_TITLE)).toBeNull();
  });
});

describe('shownAsOver', () => {
  it('is over on the analysis page of a game: chess.com analyses only finished games', () => {
    expect(shownAsOver(ANALYSIS, false)).toBe(true);
  });

  it('is over on a game page with the game-over dialog', () => {
    expect(shownAsOver('https://www.chess.com/game/live/173765478164', true)).toBe(true);
  });

  it('is not over on a game page without the dialog', () => {
    expect(shownAsOver('https://www.chess.com/game/live/173765478164', false)).toBe(false);
  });
});

describe('boardOrientation', () => {
  it('is White at the bottom of an ordinary chess.com board', () => {
    document.body.innerHTML = '<wc-chess-board class="board"></wc-chess-board>';
    expect(boardOrientation(document)).toBe('white');
  });

  it('is Black when chess.com has flipped its board', () => {
    // Seen 23.09.2026: the Flip Board button adds the class on game and analysis pages.
    document.body.innerHTML = '<wc-chess-board class="board flipped"></wc-chess-board>';
    expect(boardOrientation(document)).toBe('black');
  });

  it('is White when the page has no board', () => {
    document.body.innerHTML = '';
    expect(boardOrientation(document)).toBe('white');
  });
});
