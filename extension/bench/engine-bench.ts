// Measures the engine on real games: how long a review takes for each search limit, whether the
// page stays responsive meanwhile, and how often a quicker limit changes a move's class against
// the deepest one. Spec 15.1, T6.3. Run: npm run bench, then open /bench/engine-bench.html.
import archive from '../test/fixtures/archive-hikaru-2026-08.json';
import { analyseGame, type MoveEvaluation } from '../src/analysis';
import { UciEngine, type EngineProcess, type SearchLimit } from '../src/engine';

const LIMITS: SearchLimit[] = [{ movetime: 300 }, { depth: 10 }, { depth: 12 }, { depth: 14 }, { depth: 16 }];

interface Result {
  limit: string;
  plies: number;
  totalS: number;
  avgMs: number;
  maxMs: number;
  longTasks: number;
  longestTaskMs: number;
  maxFrameGapMs: number;
  sameClassAsDeepest?: string;
}

const games = document.getElementById('game') as HTMLSelectElement;
const pgnInput = document.getElementById('pgn') as HTMLTextAreaElement;
const output = document.getElementById('output') as HTMLPreElement;

for (const game of archive.games) {
  games.add(new Option(`${game.url.split('/').at(-1)} (${game.time_class})`, game.pgn));
}
games.addEventListener('change', () => (pgnInput.value = games.value));
pgnInput.value = games.value;
document.getElementById('run')!.addEventListener('click', () => void run(pgnInput.value));

async function run(pgn: string) {
  const results: Result[] = [];
  const reviews: MoveEvaluation[][] = [];
  for (const limit of LIMITS) {
    output.textContent = `${JSON.stringify(results, null, 1)}\nRunning ${describe(limit)}…`;
    const { result, moves } = await bench(pgn, limit);
    results.push(result);
    reviews.push(moves);
  }

  const deepest = reviews.at(-1)!.map(roughClass);
  results.forEach((result, i) => {
    const same = reviews[i].map(roughClass).filter((c, ply) => c === deepest[ply]).length;
    result.sameClassAsDeepest = `${same} of ${deepest.length}`;
  });
  output.textContent = JSON.stringify({ userAgent: navigator.userAgent, cores: navigator.hardwareConcurrency, results }, null, 1);
}

async function bench(pgn: string, limit: SearchLimit) {
  const engine = await UciEngine.start(startWorker, { searchTimeoutMs: 120_000 });
  await engine.newGame();
  const times: number[] = [];
  const stopWatching = watchMainThread();
  const started = performance.now();
  const moves = await analyseGame(pgn, async (fen) => {
    const searchStarted = performance.now();
    const evaluation = await engine.evaluate(fen, limit);
    times.push(performance.now() - searchStarted);
    return evaluation;
  });
  const totalMs = performance.now() - started;
  const health = stopWatching();
  engine.quit();

  const result: Result = {
    limit: describe(limit),
    plies: moves.length,
    totalS: round(totalMs / 1000, 1),
    avgMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    maxMs: Math.round(Math.max(...times)),
    ...health,
  };
  return { result, moves };
}

// The same way the panel starts it (src/panel.ts); the dev server serves public/ at the root.
function startWorker(onLine: (line: string) => void, onFailure: (reason: string) => void): EngineProcess {
  const worker = new Worker('/engine/stockfish-19-lite-single.js');
  worker.onmessage = (event: MessageEvent) => String(event.data).split('\n').forEach(onLine);
  worker.onerror = (event: ErrorEvent) => {
    event.preventDefault();
    onFailure(event.message || 'the engine script failed');
  };
  return { send: (command) => worker.postMessage(command), terminate: () => worker.terminate() };
}

// The page's own thread while the worker searches: tasks over 50 ms and the longest gap between frames.
function watchMainThread() {
  const longTasks: number[] = [];
  const observer = new PerformanceObserver((list) => list.getEntries().forEach((entry) => longTasks.push(entry.duration)));
  observer.observe({ type: 'longtask' });
  let last = performance.now();
  let maxGap = 0;
  let watching = true;
  const frame = (now: number) => {
    maxGap = Math.max(maxGap, now - last);
    last = now;
    if (watching) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return () => {
    watching = false;
    observer.disconnect();
    return { longTasks: longTasks.length, longestTaskMs: Math.round(Math.max(0, ...longTasks)), maxFrameGapMs: Math.round(maxGap) };
  };
}

// For comparing limits only, not the product's rule (that one is the backend's, spec section 6):
// the class by expected-points loss, and "best" when the move is the engine's.
function roughClass(move: MoveEvaluation): string {
  if (move.uci === move.bestMoveUci) return 'best';
  const loss = Math.max(0, points(move.evalBeforeCp, move.mateBefore) - points(move.evalAfterCp, move.mateAfter));
  return loss < 0.02 ? 'excellent' : loss < 0.05 ? 'good' : loss < 0.1 ? 'inaccuracy' : loss < 0.2 ? 'mistake' : 'blunder';
}

function points(cp: number | null, mate: number | null): number {
  if (mate !== null) return mate >= 0 ? 1 : 0;
  return 1 / (1 + Math.exp(-0.00368208 * (cp ?? 0)));
}

const describe = (limit: SearchLimit) => ('movetime' in limit ? `movetime ${limit.movetime}` : `depth ${limit.depth}`);
const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;
