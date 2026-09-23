import type { Lookup } from './archive';
import { UciEngine, type EngineProcess, type SearchLimit } from './engine';
import { FIND_FINISHED_GAME, readPanelSearch, type FindFinishedGame } from './messages';
import { renderState } from './panel-view';
import { runReview } from './review';

// The panel is an extension page inside the chess.com page (the content script embeds it). A worker
// script must come from the origin of the page that starts it: from here it can, from a content
// script running in chess.com it could not. See public/engine/README.md for this build.
const ENGINE_URL = 'engine/stockfish-19-lite-single.js';

// How long the engine searches each position: spec 15.1, measured in T6.3 (docs/journal.md).
const SEARCH_LIMIT: SearchLimit = { movetime: 300 };

const root = document.getElementById('review')!;
const page = readPanelSearch(location.search);

if (page) {
  void runReview(page, { lookUp, startEngine: () => UciEngine.start(startWorker), limit: SEARCH_LIMIT }, (state) => renderState(root, state));
} else {
  renderState(root, { stage: 'failed', reason: 'The panel opens from the review button on a finished chess.com game.' });
}

// The service worker is the only part that goes to the network, the panel asks it like the content script does.
async function lookUp(game: FindFinishedGame['page']): Promise<Lookup> {
  const request: FindFinishedGame = { type: FIND_FINISHED_GAME, page: game };
  const lookup: Lookup | undefined = await chrome.runtime.sendMessage(request);
  return lookup ?? { status: 'not-found' };
}

function startWorker(onLine: (line: string) => void, onFailure: (reason: string) => void): EngineProcess {
  const worker = new Worker(ENGINE_URL);
  worker.onmessage = (event: MessageEvent) => String(event.data).split('\n').forEach(onLine);
  worker.onerror = (event: ErrorEvent) => {
    event.preventDefault();
    onFailure(event.message || 'the engine script failed');
  };
  return { send: (command) => worker.postMessage(command), terminate: () => worker.terminate() };
}
