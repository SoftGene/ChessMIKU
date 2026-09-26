import type { Lookup } from './archive';
import { showsButton } from './button';
import { FIND_FINISHED_GAME, isClosePanel, panelSearch, type FindFinishedGame } from './messages';
import { boardOrientation, parseGamePage, shownAsOver, type GamePage } from './page';

// Shown by chess.com when a game ends, and on a finished game opened later (seen 22.09.2026).
// A hint to ask again, and for a game older than the recent archives, chess.com's word that it is over.
const GAME_OVER = '.game-over-modal-shell-container';

// The page is asked about once when it opens. A game that ends while the page is open reaches the
// archive a little later, so after the game-over dialog appears, ask again after these delays.
const ASK_AFTER_GAME_OVER_MS = [20_000, 60_000, 180_000];

const BUTTON_ID = 'chess-review-button';
const PANEL_ID = 'chess-review-panel';

interface Watch {
  key: string;
  page: GamePage;
  asking: boolean;
  lookup: Lookup | undefined;
  shown: boolean;
  gameOverSince: number | null;
  gameOverAsks: number;
}

let watch: Watch | null = null;

// chess.com changes games without reloading the page: follow the address and the title.
setInterval(() => {
  try {
    tick(Date.now());
  } catch (error) {
    console.warn('ChessMIKU:', error);
  }
}, 1000);

function tick(now: number) {
  const page = parseGamePage(location.href, document.title);
  // With the players: an analysis page has the game number only in its address, the title may lag behind.
  const key = page ? `${page.type}/${page.id}/${page.players.join(',')}` : null;

  if (key !== watch?.key) {
    document.getElementById(BUTTON_ID)?.remove();
    document.getElementById(PANEL_ID)?.remove();
    watch = page && key ? { key, page, asking: false, lookup: undefined, shown: false, gameOverSince: null, gameOverAsks: 0 } : null;
    if (watch) {
      void ask(watch);
    }
    return;
  }

  if (!watch || watch.shown) {
    return;
  }
  const gameOver = shownAsOver(location.href, document.querySelector(GAME_OVER) !== null);
  if (showsButton(watch.lookup, gameOver)) {
    watch.shown = true;
    showButton(watch.page);
    return;
  }

  // An older game waits for the game-over dialog; a game not found asks again once the game is over.
  if (watch.asking || watch.lookup?.status === 'older' || watch.gameOverAsks >= ASK_AFTER_GAME_OVER_MS.length || !gameOver) {
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
    if (watch === current && lookup) {
      current.lookup = lookup;
      // A game in progress is not in the archive: no button, not even a disabled one (see showsButton).
      if (!current.shown && showsButton(lookup, shownAsOver(location.href, document.querySelector(GAME_OVER) !== null))) {
        current.shown = true;
        showButton(current.page);
      }
    }
  } catch {
    // The extension was reloaded or updated: this page keeps an orphaned script until it reloads.
  } finally {
    current.asking = false;
  }
}

function showButton(page: GamePage) {
  if (document.getElementById(BUTTON_ID)) {
    return;
  }

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.textContent = 'Review game';
  button.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 999999; padding: 10px 20px; font-size: 16px; background: #7fa650; color: #fff; border: none; border-radius: 5px; cursor: pointer;';
  button.addEventListener('click', () => togglePanel(page));
  document.body.appendChild(button);
}

// The panel asks to be closed (✕, Esc, a click on the dimmed page): only our own frame is listened to.
window.addEventListener('message', (event) => {
  const frame = document.getElementById(PANEL_ID);
  if (frame instanceof HTMLIFrameElement && event.source === frame.contentWindow && isClosePanel(event.data)) {
    frame.remove();
  }
});

// The panel is an extension page in a frame over the whole page: its worker can run the engine, and the
// styles of chess.com and of the panel cannot touch each other. "autoplay" lets its sounds play after the
// click on the button, which happened on this page. The frame has the dark colour scheme of the panel:
// with another one, Chrome paints the frame opaque and hides the page around the window.
function togglePanel(page: GamePage) {
  const open = document.getElementById(PANEL_ID);
  if (open) {
    open.remove();
    return;
  }

  const frame = document.createElement('iframe');
  frame.id = PANEL_ID;
  frame.title = 'ChessMIKU';
  frame.allow = 'autoplay';
  frame.src = chrome.runtime.getURL('panel.html') + panelSearch(page, boardOrientation(document));
  frame.style.cssText = 'position: fixed; inset: 0; width: 100vw; height: 100vh; margin: 0; border: 0; z-index: 2147483647; background: transparent; color-scheme: dark;';
  document.body.appendChild(frame);
  frame.focus();
}
