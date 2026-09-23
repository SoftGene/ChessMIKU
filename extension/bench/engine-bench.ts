// Measures the engine on real games: how long a review takes for each search limit, whether the
// page stays responsive meanwhile, and how often a quicker limit changes a move's class against
// the deepest one. Spec 15.1, T6.3. Run: npm run bench, then open /bench/engine-bench.html.
import archive from '../test/fixtures/archive-hikaru-2026-08.json';
import { analyseGame, type MoveEvaluation } from '../src/analysis';
import { UciEngine, type EngineProcess, type SearchLimit } from '../src/engine';
import { EnginePool } from '../src/engine-pool';

// The last one is the reference the others are compared with.
const LIMITS: SearchLimit[] = [{ movetime: 300 }, { depth: 12 }, { depth: 14 }, { depth: 16 }, { depth: 18 }, { depth: 20 }];

interface Result {
  limit: string;
  plies: number;
  totalS: number;
  avgMs: number;
  maxMs: number;
  longTasks: number;
  longestTaskMs: number;
  maxFrameGapMs: number;
  sameClass?: string;
  sameVerdict?: string;
  sameWorstThree?: string;
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
document.getElementById('parallel')!.addEventListener('click', () => void runParallel(pgnInput.value));

// A pool of engines, as the panel runs it (src/panel.ts): how the time falls with their number.
async function runParallel(pgn: string) {
  const rows: Record<string, unknown>[] = [];
  const reviews: MoveEvaluation[][] = [];
  for (const size of [1, 2, 3, 4, 6, 8]) {
    output.textContent = `${JSON.stringify(rows, null, 1)}
Running ${size} engines…`;
    const pool = await EnginePool.start(() => UciEngine.start(startWorker), size);
    await pool.newGame();
    const stopWatching = watchMainThread();
    const started = performance.now();
    const moves = await analyseGame(pgn, (fen) => pool.evaluate(fen, { movetime: 300 }));
    const totalS = round((performance.now() - started) / 1000, 1);
    const health = stopWatching();
    pool.quit();
    rows.push({ engines: pool.size, plies: moves.length, limit: 'movetime 300', totalS, ...health });
    reviews.push(moves);
  }

  // The reference, depth 20, searched by eight engines to save time: a fixed depth barely depends on that.
  output.textContent = `${JSON.stringify(rows, null, 1)}
Running the reference, depth 20…`;
  const pool = await EnginePool.start(() => UciEngine.start(startWorker, { searchTimeoutMs: 120_000 }), 8);
  await pool.newGame();
  const reference = await analyseGame(pgn, (fen) => pool.evaluate(fen, { depth: 20 }));
  pool.quit();
  rows.forEach((row, i) => {
    row.sameVerdict = `${reviews[i].filter((move, ply) => verdict(move) === verdict(reference[ply])).length} of ${reference.length}`;
  });
  output.textContent = JSON.stringify({ cores: navigator.hardwareConcurrency, rows }, null, 1);
}

async function run(pgn: string) {
  const results: Result[] = [];
  const reviews: MoveEvaluation[][] = [];
  for (const limit of LIMITS) {
    output.textContent = `${JSON.stringify(results, null, 1)}\nRunning ${describe(limit)}…`;
    const { result, moves } = await bench(pgn, limit);
    results.push(result);
    reviews.push(moves);
  }

  const reference = reviews.at(-1)!;
  const referenceWorst = worstThree(reference);
  results.forEach((result, i) => {
    const moves = reviews[i];
    const agree = (judge: (move: MoveEvaluation) => string) => moves.filter((move, ply) => judge(move) === judge(reference[ply])).length;
    result.sameClass = `${agree(roughClass)} of ${moves.length}`;
    result.sameVerdict = `${agree(verdict)} of ${moves.length}`;
    result.sameWorstThree = `${worstThree(moves).filter((ply) => referenceWorst.includes(ply)).length} of ${referenceWorst.length}`;
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
  const lost = loss(move);
  return lost < 0.02 ? 'excellent' : lost < 0.05 ? 'good' : lost < 0.1 ? 'inaccuracy' : lost < 0.2 ? 'mistake' : 'blunder';
}

// What the review tells the player: fine (best, excellent, good), or which error.
function verdict(move: MoveEvaluation): string {
  const c = roughClass(move);
  return c === 'best' || c === 'excellent' || c === 'good' ? 'fine' : c;
}

// The plies the explanations are written for: the three biggest losses (spec section 7).
function worstThree(moves: MoveEvaluation[]): number[] {
  return moves
    .map((move) => ({ ply: move.ply, loss: loss(move) }))
    .filter(({ loss }) => loss >= 0.05)
    .sort((a, b) => b.loss - a.loss)
    .slice(0, 3)
    .map(({ ply }) => ply);
}

function loss(move: MoveEvaluation): number {
  return Math.max(0, points(move.evalBeforeCp, move.mateBefore) - points(move.evalAfterCp, move.mateAfter));
}

function points(cp: number | null, mate: number | null): number {
  if (mate !== null) return mate >= 0 ? 1 : 0;
  return 1 / (1 + Math.exp(-0.00368208 * (cp ?? 0)));
}

const describe = (limit: SearchLimit) => ('movetime' in limit ? `movetime ${limit.movetime}` : `depth ${limit.depth}`);
const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;
