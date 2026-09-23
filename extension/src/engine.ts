import { readSearch, type Evaluation } from './uci';

/** How long the engine searches one position. */
export type SearchLimit = { movetime: number } | { depth: number };

/** A running engine: UCI commands in, lines out. A Web Worker in the panel, a stand-in in tests. */
export interface EngineProcess {
  send(command: string): void;
  terminate(): void;
}

export type StartProcess = (onLine: (line: string) => void, onFailure: (reason: string) => void) => EngineProcess;

export class EngineError extends Error {
  override name = 'EngineError';
}

export interface EngineOptions {
  startTimeoutMs?: number;
  searchTimeoutMs?: number;
}

interface Waiter {
  done: RegExp;
  lines: string[];
  resolve: (lines: string[]) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Talks UCI to one engine process, one command at a time. */
export class UciEngine {
  private process: EngineProcess | null = null;
  private waiter: Waiter | null = null;
  private stopped: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly startTimeoutMs: number,
    private readonly searchTimeoutMs: number,
  ) {}

  /** Starts the engine and waits until it is ready; a process that fails or stays silent is stopped. */
  static async start(startProcess: StartProcess, { startTimeoutMs = 20_000, searchTimeoutMs = 30_000 }: EngineOptions = {}): Promise<UciEngine> {
    const engine = new UciEngine(startTimeoutMs, searchTimeoutMs);
    engine.process = startProcess(
      (line) => engine.hear(line),
      (reason) => engine.stop(reason),
    );

    try {
      await engine.ask(['uci'], /^uciok\b/, startTimeoutMs);
      await engine.ask(['isready'], /^readyok\b/, startTimeoutMs);
    } catch {
      throw new EngineError(`The engine could not start: ${engine.stopped}`);
    }
    return engine;
  }

  newGame(): Promise<void> {
    return this.enqueue(async () => {
      await this.ask(['ucinewgame', 'isready'], /^readyok\b/, this.startTimeoutMs);
    });
  }

  evaluate(fen: string, limit: SearchLimit): Promise<Evaluation> {
    const go = 'movetime' in limit ? `go movetime ${limit.movetime}` : `go depth ${limit.depth}`;
    return this.enqueue(async () => readSearch(await this.ask([`position fen ${fen}`, go], /^bestmove\b/, this.searchTimeoutMs)));
  }

  quit(): void {
    this.stop('quit');
  }

  // Commands wait for the one before them: the engine's output has no marks saying which command it answers.
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private ask(commands: string[], done: RegExp, timeoutMs: number): Promise<string[]> {
    if (this.stopped !== null) {
      return Promise.reject(new EngineError(`The engine stopped: ${this.stopped}`));
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.stop(`no answer in ${timeoutMs / 1000} s`), timeoutMs);
      this.waiter = { done, lines: [], resolve, reject, timer };
      for (const command of commands) {
        this.process?.send(command);
      }
    });
  }

  private hear(line: string) {
    const waiter = this.waiter;
    if (!waiter) {
      return;
    }

    waiter.lines.push(line);
    if (waiter.done.test(line)) {
      clearTimeout(waiter.timer);
      this.waiter = null;
      waiter.resolve(waiter.lines);
    }
  }

  // A failed, silent or finished engine is stopped for good: its state is unknown, a restart is a new engine.
  private stop(reason: string) {
    if (this.stopped !== null) {
      return;
    }

    this.stopped = reason;
    this.process?.terminate();
    const waiter = this.waiter;
    this.waiter = null;
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.reject(new EngineError(`The engine stopped: ${reason}`));
    }
  }
}
