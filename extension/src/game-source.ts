export interface ChessComApiResponse {
  games: {
    url: string;
    pgn: string;
    [key: string]: any;
  }[];
}

export function findGameInApi(apiResponse: ChessComApiResponse, url: string): string | null {
  if (!apiResponse || !Array.isArray(apiResponse.games)) {
    return null;
  }
  
  // Sometimes URLs have query parameters or different protocols, so we normalize
  const normalize = (u: string) => u.split('?')[0].replace(/^https?:\/\//, '').toLowerCase();
  const normalizedTarget = normalize(url);
  
  for (const game of apiResponse.games) {
    if (game.url && normalize(game.url) === normalizedTarget) {
      return game.pgn;
    }
  }
  
  return null;
}

export function parseGameFromHtml(doc: Document): string | null {
  // Strategy 1: look for a textarea with PGN (e.g., share dialog)
  const textarea = doc.querySelector('.share-menu-tab-pgn-textarea, [name="pgn"]') as HTMLTextAreaElement | null;
  if (textarea && textarea.value && textarea.value.includes('[Event')) {
    return textarea.value;
  }
  
  // Strategy 2: search script tags for PGN data
  const scripts = doc.querySelectorAll('script');
  for (const script of Array.from(scripts)) {
    const text = script.textContent || '';
    if (text.includes('[Event')) {
      const pgnMatch = text.match(/pgn\s*:\s*["'](\[Event(?:[^"'\\]|\\.)*)["']/);
      if (pgnMatch) {
        return pgnMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
      
      const jsonMatch = text.match(/"pgn"\s*:\s*"(\[Event(?:[^"\\]|\\.)*)"/);
      if (jsonMatch) {
        return jsonMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    }
  }
  
  return null;
}

export function extractGameInfo(doc: Document, url: string) {
  // Chess.com player names are usually in elements like .user-tagline-username or .user-username
  const players = Array.from(doc.querySelectorAll('.user-tagline-username, .user-username, [data-test-element="user-tagline-username"]'))
    .map(el => el.textContent?.trim() || '');
  
  const uniquePlayers = Array.from(new Set(players.filter(Boolean)));
  
  const now = new Date();
  
  return {
    url,
    players: uniquePlayers,
    currentYear: now.getFullYear().toString(),
    currentMonth: String(now.getMonth() + 1).padStart(2, '0'),
    previousYear: now.getMonth() === 0 ? (now.getFullYear() - 1).toString() : now.getFullYear().toString(),
    previousMonth: now.getMonth() === 0 ? '12' : String(now.getMonth()).padStart(2, '0')
  };
}
