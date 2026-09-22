import type { Lookup } from './archive';
import { FIND_FINISHED_GAME, type FindFinishedGame } from './messages';
import { parseGamePage, type GamePage } from './page';

// Shown by chess.com when a game ends, and on a finished game opened later (seen 22.09.2026).
// Only a hint to ask again: whether the game is over is decided by the archive of the public API.
const GAME_OVER = '.game-over-modal-shell-container';

// The page is asked about once when it opens. A game that ends while the page is open reaches the
// archive a little later, so after the game-over dialog appears, ask again after these delays.
const ASK_AFTER_GAME_OVER_MS = [20_000, 60_000, 180_000];

const BUTTON_ID = 'chess-review-button';

interface Watch {
  key: string;
  page: GamePage;
  asking: boolean;
  finished: boolean;
  gameOverSince: number | null;
  gameOverAsks: number;
}

let watch: Watch | null = null;

// chess.com changes games without reloading the page: follow the address and the title.
setInterval(() => {
  try {
    tick(Date.now());
  } catch (error) {
    console.warn('Chess Review:', error);
  }
}, 1000);

function tick(now: number) {
  const page = parseGamePage(location.href, document.title);
  const key = page ? `${page.type}/${page.id}` : null;

  if (key !== watch?.key) {
    document.getElementById(BUTTON_ID)?.remove();
    watch = page && key ? { key, page, asking: false, finished: false, gameOverSince: null, gameOverAsks: 0 } : null;
    if (watch) {
      void ask(watch);
    }
    return;
  }

  if (!watch || watch.finished || watch.asking || watch.gameOverAsks >= ASK_AFTER_GAME_OVER_MS.length) {
    return;
  }

  if (!document.querySelector(GAME_OVER)) {
    return;
  }

  watch.gameOverSince ??= now;
  if (now >= watch.gameOverSince + ASK_AFTER_GAME_OVER_MS[watch.gameOverAsks]) {
    watch.gameOverAsks++;
    void ask(watch);
  }
}

async function ask(current: Watch) {
  current.asking = true;
  try {
    const request: FindFinishedGame = { type: FIND_FINISHED_GAME, page: current.page };
    const lookup: Lookup | undefined = await chrome.runtime.sendMessage(request);

    // A game in progress is not in the archive: no button, not even a disabled one.
    if (lookup?.status === 'finished' && watch === current) {
      current.finished = true;
      showButton();
    }
  } catch {
    // The extension was reloaded or updated: this page keeps an orphaned script until it reloads.
  } finally {
    current.asking = false;
  }
}

function showButton() {
  if (document.getElementById(BUTTON_ID)) {
    return;
  }

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.textContent = 'Review game';
  button.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 999999; padding: 10px 20px; font-size: 16px; background: #7fa650; color: #fff; border: none; border-radius: 5px; cursor: pointer;';
  document.body.appendChild(button);
}
