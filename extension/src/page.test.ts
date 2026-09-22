import { describe, expect, it } from 'vitest';
import { parseGamePage } from './page';

// Titles as chess.com set them on 22.09.2026 for a finished game, seen as a guest.
const ENGLISH_TITLE = 'Chess: Hikaru vs poohineedyou - 173765478164 - Chess.com';
const RUSSIAN_TITLE = 'Шахматы: Hikaru против poohineedyou - 173765478164 - Chess.com';

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
