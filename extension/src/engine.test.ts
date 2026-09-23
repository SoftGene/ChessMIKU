import { afterEach, describe, expect, it, vi } from 'vitest';
import { EngineError, UciEngine, type StartProcess } from './engine';

const SEARCH_A = ['info depth 12 seldepth 16 multipv 1 score cp 30 nodes 9000 time 280 pv e2e4 e7e5', 'bestmove e2e4 ponder e7e5'];
const SEARCH_B = ['info depth 11 seldepth 15 multipv 1 score mate -2 nodes 8000 time 290 pv g8f8 h5f7', 'bestmove g8f8'];

// A stand-in for the engine worker. By default it answers like Stockfish; `answer` can hold a
// command back (return null), and the test then plays the engine with `say` and `crash`.
function fakeProcess(answer: (command: string) => string[] | null = standard) {
  const sent: string[] = [];
  const state = { terminated: false };
  let onLine: (line: string) => void = () => {};
  let onFailure: (reason: string) => void = () => {};

  const start: StartProcess = (line, failure) => {
    onLine = line;
    onFailure = failure;
    return {
      send(command) {
        sent.push(command);
        const lines = answer(command);
        // A worker answers asynchronously.
        queueMicrotask(() => lines?.forEach((l) => onLine(l)));
      },
      terminate() {
        state.terminated = true;
      },
    };
  };

  return { start, sent, state, say: (...lines: string[]) => lines.forEach((l) => onLine(l)), crash: (reason: string) => onFailure(reason) };
}

function standard(command: string): string[] | null {
  if (command === 'uci') return ['id name Stockfish 19 Lite', 'option name Hash type spin default 16 min 1 max 2048', 'uciok'];
  if (command === 'isready') return ['readyok'];
  if (command.startsWith('go ')) return SEARCH_A;
  return [];
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.useRealTimers();
});

describe('UciEngine', () => {
  it('starts the engine in UCI mode and waits until it is ready', async () => {
    const engine = fakeProcess();

    await UciEngine.start(engine.start);

    expect(engine.sent).toEqual(['uci', 'isready']);
  });

  it('fails to start when the engine process fails, and stops it', async () => {
    const engine = fakeProcess((command) => (command === 'uci' ? null : standard(command)));

    const starting = UciEngine.start(engine.start);
    engine.crash('failed to fetch stockfish-19-lite-single.wasm');

    await expect(starting).rejects.toThrow(/could not start: failed to fetch stockfish-19-lite-single\.wasm/);
    await expect(starting).rejects.toBeInstanceOf(EngineError);
    expect(engine.state.terminated).toBe(true);
  });

  it('fails to start when the engine never answers, and stops it', async () => {
    vi.useFakeTimers();
    const engine = fakeProcess(() => null);

    const starting = UciEngine.start(engine.start, { startTimeoutMs: 5000 });
    const failed = expect(starting).rejects.toThrow(/could not start: no answer in 5 s/);
    await vi.advanceTimersByTimeAsync(5000);

    await failed;
    expect(engine.state.terminated).toBe(true);
  });

  it('searches a position for the given time', async () => {
    const engine = fakeProcess();
    const uci = await UciEngine.start(engine.start);

    const evaluation = await uci.evaluate('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', { movetime: 300 });

    expect(engine.sent.slice(2)).toEqual(['position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'go movetime 300']);
    expect(evaluation).toEqual({ bestMoveUci: 'e2e4', score: { cp: 30 } });
  });

  it('searches a position to the given depth', async () => {
    const engine = fakeProcess();
    const uci = await UciEngine.start(engine.start);

    await uci.evaluate('8/8/8/8/8/8/8/K1k5 w - - 0 1', { depth: 14 });

    expect(engine.sent.slice(2)).toEqual(['position fen 8/8/8/8/8/8/8/K1k5 w - - 0 1', 'go depth 14']);
  });

  it('searches one position at a time', async () => {
    const engine = fakeProcess((command) => (command.startsWith('go ') ? null : standard(command)));
    const uci = await UciEngine.start(engine.start);

    const a = uci.evaluate('fen-a', { movetime: 300 });
    const b = uci.evaluate('fen-b', { movetime: 300 });
    await settle();

    // B waits until the engine has finished A.
    expect(engine.sent.slice(2)).toEqual(['position fen fen-a', 'go movetime 300']);
    engine.say(...SEARCH_A);
    await settle();
    expect(engine.sent.slice(2)).toEqual(['position fen fen-a', 'go movetime 300', 'position fen fen-b', 'go movetime 300']);
    engine.say(...SEARCH_B);

    expect(await a).toEqual({ bestMoveUci: 'e2e4', score: { cp: 30 } });
    expect(await b).toEqual({ bestMoveUci: 'g8f8', score: { mate: -2 } });
  });

  it('starts a new game and waits until the engine is ready', async () => {
    const engine = fakeProcess();
    const uci = await UciEngine.start(engine.start);

    await uci.newGame();

    expect(engine.sent.slice(2)).toEqual(['ucinewgame', 'isready']);
  });

  it('fails the search when the engine process fails, and every search after it', async () => {
    const engine = fakeProcess((command) => (command.startsWith('go ') ? null : standard(command)));
    const uci = await UciEngine.start(engine.start);

    const searching = uci.evaluate('fen-a', { movetime: 300 });
    await settle();
    engine.crash('RuntimeError: unreachable');

    await expect(searching).rejects.toThrow(/stopped: RuntimeError: unreachable/);
    await expect(uci.evaluate('fen-b', { movetime: 300 })).rejects.toThrow(/stopped: RuntimeError: unreachable/);
    expect(engine.sent.slice(2)).toEqual(['position fen fen-a', 'go movetime 300']);
  });

  it('fails a search the engine does not finish in time, and stops the engine', async () => {
    vi.useFakeTimers();
    const engine = fakeProcess((command) => (command.startsWith('go ') ? null : standard(command)));
    const uci = await UciEngine.start(engine.start, { searchTimeoutMs: 30_000 });

    const searching = uci.evaluate('fen-a', { depth: 40 });
    const failed = expect(searching).rejects.toThrow(/stopped: no answer in 30 s/);
    await vi.advanceTimersByTimeAsync(30_000);

    await failed;
    expect(engine.state.terminated).toBe(true);
  });

  it('stops the process on quit', async () => {
    const engine = fakeProcess();
    const uci = await UciEngine.start(engine.start);

    uci.quit();

    expect(engine.state.terminated).toBe(true);
    await expect(uci.evaluate('fen-a', { movetime: 300 })).rejects.toThrow(/stopped: quit/);
  });
});
