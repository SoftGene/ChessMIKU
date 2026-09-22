/** A game page of chess.com: the game and its two players. */
export interface GamePage {
  type: 'live' | 'daily';
  id: string;
  players: [string, string];
}

// www.chess.com/game/live/123, or with a language: /ru/game/live/123, /pt-BR/game/daily/123.
const GAME_URL = /^https:\/\/www\.chess\.com\/(?:[a-z]{2}(?:-[a-z]{2,4})?\/)?game\/(live|daily)\/(\d+)(?:[/?#]|$)/i;

// "Chess: Hikaru vs poohineedyou - 173765478164 - Chess.com" or "Шахматы: Hikaru против poohineedyou - …":
// the page script writes it once the game is loaded, and only the words differ between languages.
// Usernames on chess.com are 3 to 25 letters, digits, underscores and hyphens.
const GAME_TITLE = /:\s*([A-Za-z0-9_-]{3,25})\s+\S+\s+([A-Za-z0-9_-]{3,25})\s+-\s+(\d+)\s+-\s+Chess\.com\s*$/;

/**
 * The game of a page, or null when the page shows no game or is not ready yet: the title names the
 * players only after the page script has loaded the game, and it must name this very game.
 */
export function parseGamePage(url: string, title: string): GamePage | null {
  const address = GAME_URL.exec(url);
  const heading = GAME_TITLE.exec(title);
  if (!address || !heading || heading[3] !== address[2]) {
    return null;
  }

  return { type: address[1].toLowerCase() as GamePage['type'], id: address[2], players: [heading[1], heading[2]] };
}
