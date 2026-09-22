import { findGameInApi } from './game-source';

console.log('Chess Review background service worker loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_GAME') {
    handleFetchGame(request).then(sendResponse);
    return true; // Keep message channel open for async response
  }
});

async function handleFetchGame(info: any) {
  const { url, players, currentYear, currentMonth, previousYear, previousMonth } = info;
  
  if (!players || players.length === 0) {
    return { pgn: null, error: 'No players found' };
  }
  
  for (const username of players) {
    // Try current month
    let pgn = await fetchGameFromApi(username, currentYear, currentMonth, url);
    if (pgn) return { pgn };
    
    // Try previous month (if game was played at the end of month but retrieved later)
    pgn = await fetchGameFromApi(username, previousYear, previousMonth, url);
    if (pgn) return { pgn };
  }
  
  return { pgn: null, error: 'Game not found in API' };
}

async function fetchGameFromApi(username: string, year: string, month: string, url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.chess.com/pub/player/${username}/games/${year}/${month}`);
    if (!res.ok) return null;
    const data = await res.json();
    return findGameInApi(data, url);
  } catch (err) {
    console.error('Error fetching from chess.com API:', err);
    return null;
  }
}

