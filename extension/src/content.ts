import { extractGameInfo, parseGameFromHtml } from './game-source';

// Content script to detect a finished game and add the "Review" button
console.log('Chess Review content script loaded');

export function isGameFinished(): boolean {
  return document.querySelector('.game-over-dialog, .game-result-container') !== null;
}

async function handleFinishedGame() {
  console.log('Game is finished, fetching PGN...');
  
  const info = extractGameInfo(document, window.location.href);
  
  let pgn: string | null = null;
  
  // 1. Try background API
  try {
    const res = await chrome.runtime.sendMessage({ type: 'FETCH_GAME', ...info });
    if (res && res.pgn) {
      pgn = res.pgn;
    }
  } catch (err) {
    console.error('Error communicating with background script:', err);
  }
  
  // 2. Fallback to HTML
  if (!pgn) {
    console.log('API failed to find game, falling back to HTML parsing...');
    pgn = parseGameFromHtml(document);
  }
  
  if (pgn) {
    console.log('Successfully found PGN:', pgn.substring(0, 50) + '...');
    renderButton('Review Game', false);
  } else {
    console.warn('Chess Review: Both API and HTML parsing failed to find PGN.');
    renderButton('Game not found', true);
  }
}

function renderButton(text: string, disabled: boolean) {
  // Check if button already exists
  if (document.querySelector('#chess-review-btn')) return;
  
  const btn = document.createElement('button');
  btn.id = 'chess-review-btn';
  btn.textContent = text;
  btn.disabled = disabled;
  btn.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 999999; padding: 10px 20px; font-size: 16px; background-color: #7fa650; color: white; border: none; border-radius: 5px; cursor: pointer;';
  
  if (disabled) {
    btn.style.backgroundColor = '#999';
    btn.style.cursor = 'not-allowed';
  }
  
  document.body.appendChild(btn);
}

if (typeof document !== 'undefined') {
  // Simple polling to detect when game finishes
  let gameHandled = false;
  setInterval(() => {
    if (!gameHandled && isGameFinished()) {
      gameHandled = true;
      handleFinishedGame();
    }
  }, 1000);
}

