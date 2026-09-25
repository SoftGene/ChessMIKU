import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './panel.css';
import { gameAccuracy } from './accuracy';
import type { PositionEvaluation } from './analysis';
import type { Lookup } from './archive';
import type { AnalyseAnswer, AnalyseMessage, ExplanationsAnswer, ExplanationsMessage, Language, MoveClassification } from './backend-messages';
import { createBackendReview, type CardState } from './backend-review';
import { createBoard } from './board-view';
import { UciEngine, type EngineProcess, type SearchLimit } from './engine';
import { EnginePool, poolSize } from './engine-pool';
import { renderEvalBar } from './eval-bar';
import { createEvalCache, type CacheStore } from './eval-cache';
import { sideToMove, toWhiteEval, type WhiteEval } from './eval-display';
import { graphTip, graphX, positionAtX, renderGraph } from './eval-graph';
import { fenAt, type Game, type Ply } from './game';
import { renderKeyMoments } from './key-moments';
import { readLanguage, writeLanguage } from './language';
import { endingOf, legalDests, readDrop } from './legal-moves';
import { createLineEngine } from './line-engine';
import { lineEval, linesState, renderLine } from './line-view';
import { CLOSE_PANEL, FIND_FINISHED_GAME, readOrientation, readPanelSearch, type FindFinishedGame } from './messages';
import { isPlayerInfoMessage, NO_INFO, PLAYER_INFO, readPlayerInfo, type PlayerInfo, type PlayerInfoMessage } from './player-info';
import { renderPlayer, type PlayerView } from './players';
import { buildMoveList, markCurrentMove, setMoveClasses } from './move-list';
import { backToGame, keyAction, movePlace, playMove, positionAt, type NavAction, type Place } from './navigation';
import { showPromotion, type PromotionChoice } from './promotion';
import { startReplay } from './replay';
import { runReview, type ReviewState } from './review';
import { createWindow, setPressed, showHeaders, showLanguage } from './review-window';
import { readSetting, writeSetting } from './settings';
import { createSounds, soundOf } from './sounds';
import { statusText } from './status';

// The panel is an extension page inside the chess.com page (the content script embeds it). A worker
// script must come from the origin of the page that starts it: from here it can, from a content
// script running in chess.com it could not. See public/engine/README.md for this build.
const ENGINE_URL = 'engine/stockfish-19-lite-single.js';

// How long the engine searches each position (spec 15.1, measured 23.09 in bench/engine-bench.html).
// A fixed time gives a known duration; a fixed depth was no closer to depth 20 in its verdicts.
// The evaluation cache keys its games by these settings (eval-cache.ts, ENGINE_TAG).
const SEARCH_LIMIT: SearchLimit = { movetime: 300 };

// The engine is ready in about 0.1 s. Without its .wasm it does not fail, it stays silent: only this
// timeout notices, so it is short enough for a person to wait out.
const START_TIMEOUT_MS = 10_000;

const page = readPanelSearch(location.search);
let orientation = readOrientation(location.search);
const parts = createWindow(document.getElementById('review')!, { close, flip, toggleHints, toggleSound, navigate: go, setLanguage, backToGame: leaveLine });
const board = createBoard(parts.board, orientation);
const sounds = createSounds();
let hints = readSetting('hints');
let soundOn = readSetting('sound');
let language = readLanguage(navigator.languages);
sounds.setEnabled(soundOn);
setPressed(parts.hints, hints);
setPressed(parts.sound, soundOn);
showLanguage(parts, language);
parts.root.querySelector<HTMLElement>('.window')?.focus();

let game: Game | null = null;
// The position shown: of the game, or of the player's own line (T7.2).
let place: Place = { ply: 0, line: null };
// The review is over: the player may move pieces.
let playable = false;
let promotion: PromotionChoice | null = null;
const evals: (WhiteEval | undefined)[] = [];
const bestMoves: (string | undefined)[] = [];
const classes = new Map<number, string>();
let replay: { stop(): void } | null = null;
let card: CardState = { kind: 'waiting-engine' };
// The position under the pointer on the graph, while it is there.
let hover: number | null = null;
const players: Record<'white' | 'black', PlayerView> = {
  white: { name: '', rating: null, info: null, accuracy: null },
  black: { name: '', rating: null, info: null, accuracy: null },
};

// The server: classes and explanations. The panel asks the service worker, which alone goes to the network.
const backend = createBackendReview(
  { analyse: ask, explanations: ask, wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now: () => Date.now() },
  { classes: showClassifications, card: showCard },
  language,
);

// The player's line has an engine of its own, one, with two lines: the review's engines are gone by then (and a
// game from the store never starts them). 0.5 s a position (design of the free play, section 5).
const LINE_LIMIT: SearchLimit = { movetime: 500 };
const lineEngine = createLineEngine(startLineEngine, LINE_LIMIT, (fen) => {
  if (game && place.line && positionAt(place, game).fen === fen) {
    render(false);
  }
});
board.onDrop(onDrop);

// The engine's evaluations of games reviewed before: opening one again needs neither the archive nor the engine.
const cacheStore: CacheStore = {
  get: (keys) => chrome.storage.local.get(keys),
  set: (items) => chrome.storage.local.set(items),
  remove: (keys) => chrome.storage.local.remove(keys),
};

document.addEventListener('keydown', (event) => {
  const action = keyAction(event.key);
  if (!action) {
    return;
  }
  event.preventDefault();
  // While the pieces of a promotion are offered, Esc closes only them, and the other keys wait.
  if (promotion) {
    if (action === 'close') {
      promotion.cancel();
    }
    return;
  }
  if (action === 'close') {
    close();
  } else {
    go(action);
  }
});

// The graph is drawn in the pixels it has, so that its dots stay round: again when its size changes.
new ResizeObserver(() => drawGraph()).observe(parts.graph);

parts.graph.addEventListener('mousemove', (event) => {
  if (!game) {
    return;
  }
  hover = positionAtX(event.offsetX, parts.graph.clientWidth, game.plies.length);
  const tip = graphTip(game, evals, hover);
  parts.graphTip.hidden = tip === null;
  parts.graphTip.textContent = tip ?? '';
  parts.graphTip.style.left = `${graphX(hover, game.plies.length, parts.graph.clientWidth)}px`;
  drawGraph();
});

parts.graph.addEventListener('mouseleave', () => {
  hover = null;
  parts.graphTip.hidden = true;
  drawGraph();
});

parts.graph.addEventListener('click', (event) => {
  if (game) {
    interrupt();
    show(positionAtX(event.offsetX, parts.graph.clientWidth, game.plies.length), false);
  }
});

if (page) {
  const externalGameId = `${page.type}/${page.id}`;
  // Positions are searched by several engines at once: 4 took 6.6 s where 1 took 25.8 s (bench, 23.09).
  const startOne = () => UciEngine.start(startWorker, { startTimeoutMs: START_TIMEOUT_MS });
  const startEngine = () => EnginePool.start(startOne, poolSize(navigator.hardwareConcurrency));
  const deps = { lookUp, startEngine, limit: SEARCH_LIMIT, cache: createEvalCache(cacheStore) };
  void runReview(page, deps, (state) => onState(state, externalGameId));
} else {
  parts.root.classList.add('no-game');
  parts.status.textContent = 'The panel opens from the review button on a finished chess.com game.';
}

/** The classes of the moves, from the backend. */
export function showClassifications(list: MoveClassification[]): void {
  for (const { ply: at, classification } of list) {
    classes.set(at, classification);
  }
  setMoveClasses(parts.moves, classes);
  render(false);
}

function onState(state: ReviewState, externalGameId: string) {
  parts.status.textContent = statusText(state);
  if ('game' in state && !game) {
    // A game opened from the store is shown at its last move at once, without the replay.
    begin(state.game, state.stage !== 'done');
  }
  if (state.stage === 'analysing') {
    record(state.index, state.evaluation);
  }
  if (state.stage === 'engine-failed') {
    stopReplay();
    showCard({ kind: 'no-engine' });
    playable = true;
    render(false);
  }
  if (state.stage === 'done') {
    if (state.cached) {
      state.positions.forEach((evaluation, index) => record(index, evaluation));
      show(state.game.plies.length, false);
    }
    showAccuracy(state.game);
    // The review's engines are done: the player's moves come now.
    playable = true;
    render(false);
    void backend.start({ externalGameId, pgn: state.pgn, moves: state.moves });
  }
  if ((state.stage === 'not-found' || state.stage === 'failed') && !game) {
    parts.root.classList.add('no-game');
  }
}

function begin(started: Game, withReplay: boolean) {
  game = started;
  evals.length = started.plies.length + 1;
  showHeaders(parts, started.headers);
  showPlayers(started);
  buildMoveList(parts.moves, started, select);
  show(0, false);
  if (withReplay) {
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
}

// A click on a move or on a key moment: the board goes there.
function select(at: number) {
  interrupt();
  show(at, true);
  playMoveSound();
}

function record(index: number, evaluation: PositionEvaluation) {
  if (!game) {
    return;
  }
  evals[index] = toWhiteEval(evaluation.score, sideToMove(fenAt(game, index)));
  bestMoves[index] = evaluation.bestMoveUci;
  drawGraph();
  if (index === place.ply && !place.line) {
    render(false);
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

// The game's position after `at` half-moves.
function show(at: number, animate: boolean) {
  place = { ply: at, line: null };
  render(animate);
}

// Everything at the place shown: board, bar, list, graph, the player's line, card.
function render(animate: boolean) {
  if (!game) {
    return;
  }
  const { fen, move } = positionAt(place, game);
  const ending = endingOf(fen);
  const lines = place.line && !ending ? lineEngine.lines(fen) : undefined;
  const best = place.line ? lines?.[0]?.moveUci : bestMoves[place.ply];
  board.show(
    {
      fen,
      lastMove: move ? [move.from, move.to] : undefined,
      check: Boolean(move && (move.check || move.mate)),
      // Classes are the game's: a move of the line has none.
      mark: place.line && place.line.at > 0 ? undefined : classes.get(place.ply),
      hint: squares(best),
      second: squares(place.line ? lines?.[1]?.moveUci : undefined),
    },
    { animate, hints, movable: playable && !promotion ? { color: sideToMove(fen) === 'w' ? 'white' : 'black', dests: legalDests(fen) } : null },
  );
  renderEvalBar(parts.evalBar, place.line ? lineEval(fen, ending, lines) : evals[place.ply], orientation);
  markCurrentMove(parts.moves, place.ply);
  showHeaders(parts, game.headers, place.line ? fenAt(game, place.ply).split(' ')[5] : null);
  parts.line.hidden = !place.line;
  if (place.line) {
    renderLine(parts.line, { fen, moves: place.line.moves, at: place.line.at, engine: linesState(ending, lines, hints) }, goInLine);
  }
  drawGraph();
  renderCard();
}

function squares(uci: string | undefined): [string, string] | undefined {
  return uci ? [uci.slice(0, 2), uci.slice(2, 4)] : undefined;
}

function drawGraph() {
  renderGraph(parts.graph, evals, place.ply, classes, { width: parts.graph.clientWidth, height: parts.graph.clientHeight }, hover);
}

// The players from the PGN at once; their avatars and titles when the service worker has them.
function showPlayers(started: Game) {
  for (const color of ['white', 'black'] as const) {
    players[color] = { name: started.headers[color], rating: started.headers[color === 'white' ? 'whiteElo' : 'blackElo'], info: null, accuracy: null };
    renderPlayer(parts.players[color], players[color]);
    const message: PlayerInfoMessage = { type: PLAYER_INFO, username: players[color].name };
    if (isPlayerInfoMessage(message)) {
      void askPlayer(message).then((info) => {
        players[color].info = info;
        renderPlayer(parts.players[color], players[color]);
      });
    }
  }
}

// The accuracy of both players, once every position is evaluated.
function showAccuracy(finished: Game) {
  const known = evals.filter((value): value is WhiteEval => value !== undefined);
  if (known.length !== finished.plies.length + 1) {
    return;
  }
  const accuracy = gameAccuracy(known, sideToMove(finished.startFen));
  for (const color of ['white', 'black'] as const) {
    players[color].accuracy = accuracy[color];
    renderPlayer(parts.players[color], players[color]);
  }
}

function showCard(state: CardState) {
  card = state;
  renderCard();
}

function renderCard() {
  if (game) {
    renderKeyMoments(parts.card, card, { language, game, classes, current: place.ply, onSelect: select });
  }
}

// The sound of the move that led to the place shown, in the game or in the line.
function playMoveSound() {
  const move = game ? positionAt(place, game).move : undefined;
  if (move) {
    void sounds.play(soundOf(move));
  }
}

function go(action: NavAction) {
  if (!game) {
    return;
  }
  interrupt();
  const next = movePlace(place, game, action);
  if (next.ply !== place.ply || next.line?.at !== place.line?.at) {
    place = next;
    render(true);
    playMoveSound();
  }
}

// A piece dropped on the board: chess.js judges it.
function onDrop(from: string, to: string) {
  if (!game) {
    return;
  }
  const { fen } = positionAt(place, game);
  const drop = readDrop(fen, from, to);
  if (drop.kind === 'move') {
    play(drop.ply);
  } else if (drop.kind === 'promote') {
    promotion = showPromotion(parts.board, to, sideToMove(fen) === 'w' ? 'white' : 'black', orientation, (piece) => {
      promotion = null;
      const chosen = piece ? readDrop(fen, from, to, piece) : null;
      if (chosen?.kind === 'move') {
        play(chosen.ply);
      } else {
        render(true);
      }
    });
  } else if (drop.kind === 'reselect') {
    render(false);
    board.select(to);
  } else {
    render(true);
    void sounds.play('illegal');
  }
}

function play(move: Ply) {
  if (!game) {
    return;
  }
  stopReplay();
  place = playMove(place, game, move);
  render(true);
  void sounds.play(soundOf(move));
}

// A move of the line clicked.
function goInLine(at: number) {
  if (place.line) {
    interrupt();
    place = { ply: place.ply, line: { moves: place.line.moves, at } };
    render(true);
    playMoveSound();
  }
}

function leaveLine() {
  interrupt();
  place = backToGame(place);
  render(true);
}

// The replay and an open choice of a promotion end when the player goes elsewhere.
function interrupt() {
  stopReplay();
  promotion?.cancel();
}

function stopReplay() {
  replay?.stop();
  replay = null;
}

async function startLineEngine(): Promise<UciEngine> {
  const engine = await UciEngine.start(startWorker, { startTimeoutMs: START_TIMEOUT_MS });
  await engine.setOption('MultiPV', 2);
  return engine;
}

function close() {
  stopReplay();
  window.parent.postMessage({ type: CLOSE_PANEL }, 'https://www.chess.com');
}

function flip() {
  // The pieces of a promotion stand where the board was: they go first.
  promotion?.cancel();
  orientation = board.flip();
  render(false);
}

function toggleHints() {
  hints = !hints;
  writeSetting('hints', hints);
  setPressed(parts.hints, hints);
  render(false);
}

function toggleSound() {
  soundOn = !soundOn;
  sounds.setEnabled(soundOn);
  writeSetting('sound', soundOn);
  setPressed(parts.sound, soundOn);
}

function setLanguage(next: Language) {
  if (next === language) {
    return;
  }
  language = next;
  writeLanguage(language);
  showLanguage(parts, language);
  renderCard();
  void backend.setLanguage(language);
}

// The service worker is the only part that goes to the network; the panel asks it like the content script does.
async function lookUp(target: FindFinishedGame['page']): Promise<Lookup> {
  // Deep: the button may be on an older game, found only in the older archives.
  const request: FindFinishedGame = { type: FIND_FINISHED_GAME, page: target, deep: true };
  const lookup: Lookup | undefined = await chrome.runtime.sendMessage(request);
  return lookup ?? { status: 'not-found' };
}

// The service worker answers for the server; no answer (the extension was reloaded) is an unreachable server.
function ask(message: AnalyseMessage): Promise<AnalyseAnswer>;
function ask(message: ExplanationsMessage): Promise<ExplanationsAnswer>;
async function ask(message: AnalyseMessage | ExplanationsMessage): Promise<AnalyseAnswer | ExplanationsAnswer> {
  try {
    return (await chrome.runtime.sendMessage(message)) ?? { status: 'unreachable' };
  } catch {
    return { status: 'unreachable' };
  }
}

// The picture is checked again here: only chess.com's image server goes into the window.
async function askPlayer(message: PlayerInfoMessage): Promise<PlayerInfo> {
  try {
    return readPlayerInfo(await chrome.runtime.sendMessage(message));
  } catch {
    return NO_INFO;
  }
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
