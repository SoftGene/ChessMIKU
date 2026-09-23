import type { Lookup } from './archive';
import { UciEngine, type EngineProcess, type SearchLimit } from './engine';
import { EnginePool, poolSize } from './engine-pool';
import { FIND_FINISHED_GAME, readPanelSearch, type FindFinishedGame } from './messages';
import { renderState } from './panel-view';
import { runReview } from './review';

// The panel is an extension page inside the chess.com page (the content script embeds it). A worker
// script must come from the origin of the page that starts it: from here it can, from a content
// script running in chess.com it could not. See public/engine/README.md for this build.
const ENGINE_URL = 'engine/stockfish-19-lite-single.js';

// How long the engine searches each position (spec 15.1, measured 23.09 in bench/engine-bench.html).
// A fixed time gives a known duration, 37 s for a game of 62 moves; a fixed depth took from 10 to 22 s
// at depth 16 depending on the game, and was no closer to depth 20 in its verdicts.
const SEARCH_LIMIT: SearchLimit = { movetime: 300 };

// The engine is ready in about 0.1 s. Without its .wasm it does not fail, it stays silent: only this
// timeout notices, so it is short enough for a person to wait out.
const START_TIMEOUT_MS = 10_000;

const root = document.getElementById('review')!;
const page = readPanelSearch(location.search);

if (page) {
  // Positions are searched by several engines at once: 4 took 6.6 s where 1 took 25.8 s (bench, 23.09).
  const startOne = () => UciEngine.start(startWorker, { startTimeoutMs: START_TIMEOUT_MS });
  const startEngine = () => EnginePool.start(startOne, poolSize(navigator.hardwareConcurrency));
  void runReview(page, { lookUp, startEngine, limit: SEARCH_LIMIT }, (state) => renderState(root, state));
} else {
  renderState(root, { stage: 'failed', reason: 'The panel opens from the review button on a finished chess.com game.' });
}

// The service worker is the only part that goes to the network, the panel asks it like the content script does.
async function lookUp(game: FindFinishedGame['page']): Promise<Lookup> {
  // Deep: the button may be on an older game, found only in the older archives.
  const request: FindFinishedGame = { type: FIND_FINISHED_GAME, page: game, deep: true };
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
