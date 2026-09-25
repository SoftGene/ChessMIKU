import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './panel.css';
import type { PositionEvaluation } from './analysis';
import type { Lookup } from './archive';
import { createBoard } from './board-view';
import { UciEngine, type EngineProcess, type SearchLimit } from './engine';
import { EnginePool, poolSize } from './engine-pool';
import { renderEvalBar } from './eval-bar';
import { sideToMove, toWhiteEval, type WhiteEval } from './eval-display';
import { positionAtX, renderGraph } from './eval-graph';
import { fenAt, type Game } from './game';
import { CLOSE_PANEL, FIND_FINISHED_GAME, readOrientation, readPanelSearch, type FindFinishedGame } from './messages';
import { buildMoveList, markCurrentMove, setMoveClasses } from './move-list';
import { keyAction, navigate, type NavAction } from './navigation';
import { startReplay } from './replay';
import { runReview, type ReviewState } from './review';
import { createWindow, setPressed, showHeaders } from './review-window';
import { readSetting, writeSetting } from './settings';
import { createSounds, soundsOf } from './sounds';
import { statusText } from './status';

// The panel is an extension page inside the chess.com page (the content script embeds it). A worker
// script must come from the origin of the page that starts it: from here it can, from a content
// script running in chess.com it could not. See public/engine/README.md for this build.
const ENGINE_URL = 'engine/stockfish-19-lite-single.js';

// How long the engine searches each position (spec 15.1, measured 23.09 in bench/engine-bench.html).
// A fixed time gives a known duration; a fixed depth was no closer to depth 20 in its verdicts.
const SEARCH_LIMIT: SearchLimit = { movetime: 300 };

// The engine is ready in about 0.1 s. Without its .wasm it does not fail, it stays silent: only this
// timeout notices, so it is short enough for a person to wait out.
const START_TIMEOUT_MS = 10_000;

const page = readPanelSearch(location.search);
let orientation = readOrientation(location.search);
const parts = createWindow(document.getElementById('review')!, { close, flip, toggleHints, toggleSound, navigate: go });
const board = createBoard(parts.board, orientation);
const sounds = createSounds();
let hints = readSetting('hints');
let soundOn = readSetting('sound');
sounds.setEnabled(soundOn);
setPressed(parts.hints, hints);
setPressed(parts.sound, soundOn);
parts.card.textContent = 'Move classes and explanations are not available yet: the server is not connected.';
parts.root.querySelector<HTMLElement>('.window')?.focus();

let game: Game | null = null;
let ply = 0;
const evals: (WhiteEval | undefined)[] = [];
const bestMoves: (string | undefined)[] = [];
const classes = new Map<number, string>();
let replay: { stop(): void } | null = null;

document.addEventListener('keydown', (event) => {
  const action = keyAction(event.key);
  if (!action) {
    return;
  }
  event.preventDefault();
  if (action === 'close') {
    close();
  } else {
    go(action);
  }
});

parts.graph.addEventListener('click', (event) => {
  if (game) {
    stopReplay();
    show(positionAtX(event.offsetX, parts.graph.clientWidth, game.plies.length), false);
  }
});

if (page) {
  // Positions are searched by several engines at once: 4 took 6.6 s where 1 took 25.8 s (bench, 23.09).
  const startOne = () => UciEngine.start(startWorker, { startTimeoutMs: START_TIMEOUT_MS });
  const startEngine = () => EnginePool.start(startOne, poolSize(navigator.hardwareConcurrency));
  void runReview(page, { lookUp, startEngine, limit: SEARCH_LIMIT }, onState);
} else {
  parts.root.classList.add('no-game');
  parts.status.textContent = 'The panel opens from the review button on a finished chess.com game.';
}

/** The classes of the moves, from the backend (T7.3). */
export function showClassifications(list: { ply: number; classification: string }[]): void {
  for (const { ply: at, classification } of list) {
    classes.set(at, classification);
  }
  setMoveClasses(parts.moves, classes);
  if (game) {
    show(ply, false);
  }
}

function onState(state: ReviewState) {
  parts.status.textContent = statusText(state);
  if ('game' in state && !game) {
    begin(state.game);
  }
  if (state.stage === 'analysing') {
    record(state.index, state.evaluation);
  }
  if (state.stage === 'engine-failed') {
    stopReplay();
  }
  if ((state.stage === 'not-found' || state.stage === 'failed') && !game) {
    parts.root.classList.add('no-game');
  }
}

function begin(started: Game) {
  game = started;
  evals.length = started.plies.length + 1;
  showHeaders(parts, started.headers);
  buildMoveList(parts.moves, started, (at) => {
    stopReplay();
    show(at, true);
    playMoveSound(at);
  });
  show(0, false);
  replay = startReplay({
    last: started.plies.length,
    isReady: (at) => evaluatedUpTo() >= at,
    show: (at) => {
      show(at, true);
      void sounds.play('tick');
    },
    done: () => {
      replay = null;
    },
  });
}

function record(index: number, evaluation: PositionEvaluation) {
  if (!game) {
    return;
  }
  evals[index] = toWhiteEval(evaluation.score, sideToMove(fenAt(game, index)));
  bestMoves[index] = evaluation.bestMoveUci;
  renderGraph(parts.graph, evals, ply, classes);
  if (index === ply) {
    show(ply, false);
  }
}

// The last position of an unbroken run of evaluated positions from the start.
function evaluatedUpTo(): number {
  let at = 0;
  while (at < evals.length && evals[at]) {
    at++;
  }
  return at - 1;
}

function show(at: number, animate: boolean) {
  if (!game) {
    return;
  }
  ply = at;
  const move = at > 0 ? game.plies[at - 1] : undefined;
  const best = bestMoves[at];
  board.show(
    {
      fen: fenAt(game, at),
      lastMove: move ? [move.from, move.to] : undefined,
      check: Boolean(move && (move.check || move.mate)),
      mark: classes.get(at),
      hint: best ? [best.slice(0, 2), best.slice(2, 4)] : undefined,
    },
    { animate, hints },
  );
  renderEvalBar(parts.evalBar, evals[at], orientation);
  markCurrentMove(parts.moves, at);
  renderGraph(parts.graph, evals, at, classes);
}

function playMoveSound(at: number) {
  if (game && at > 0) {
    void sounds.play(...soundsOf(game.plies[at - 1]));
  }
}

function go(action: NavAction) {
  if (!game) {
    return;
  }
  stopReplay();
  const next = navigate(ply, game.plies.length, action);
  if (next !== ply) {
    show(next, true);
    playMoveSound(next);
  }
}

function stopReplay() {
  replay?.stop();
  replay = null;
}

function close() {
  stopReplay();
  window.parent.postMessage({ type: CLOSE_PANEL }, 'https://www.chess.com');
}

function flip() {
  orientation = board.flip();
  renderEvalBar(parts.evalBar, evals[ply], orientation);
}

function toggleHints() {
  hints = !hints;
  writeSetting('hints', hints);
  setPressed(parts.hints, hints);
  show(ply, false);
}

function toggleSound() {
  soundOn = !soundOn;
  sounds.setEnabled(soundOn);
  writeSetting('sound', soundOn);
  setPressed(parts.sound, soundOn);
}

// The service worker is the only part that goes to the network; the panel asks it like the content script does.
async function lookUp(target: FindFinishedGame['page']): Promise<Lookup> {
  // Deep: the button may be on an older game, found only in the older archives.
  const request: FindFinishedGame = { type: FIND_FINISHED_GAME, page: target, deep: true };
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
