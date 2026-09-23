import type { SearchLimit } from './engine';
import type { ReviewEngine } from './review';
import type { Evaluation } from './uci';

/** How many engines to run: one core stays for the page and the browser, and four are plenty. */
export function poolSize(cores: number): number {
  return Math.max(1, Math.min(4, cores - 1));
}

/** Several engines behind one: each search goes to a free engine, the rest wait for one. */
export class EnginePool implements ReviewEngine {
  private readonly free: ReviewEngine[];
  private readonly waiting: ((engine: ReviewEngine) => void)[] = [];

  private constructor(private readonly engines: ReviewEngine[]) {
    this.free = [...engines];
  }

  get size(): number {
    return this.engines.length;
  }

  /**
   * Starts `size` engines at once and keeps those that started. When none did, fails the way the
   * first one failed.
   */
  static async start(startOne: () => Promise<ReviewEngine>, size: number): Promise<EnginePool> {
    const results = await Promise.allSettled(Array.from({ length: size }, () => startOne()));
    const engines = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    if (engines.length === 0) {
      throw (results[0] as PromiseRejectedResult).reason;
    }
    return new EnginePool(engines);
  }

  async newGame(): Promise<void> {
    await Promise.all(this.engines.map((engine) => engine.newGame()));
  }

  async evaluate(fen: string, limit: SearchLimit): Promise<Evaluation> {
    const engine = await this.take();
    try {
      return await engine.evaluate(fen, limit);
    } finally {
      this.giveBack(engine);
    }
  }

  quit(): void {
    this.engines.forEach((engine) => engine.quit());
  }

  private take(): Promise<ReviewEngine> {
    const engine = this.free.shift();
    return engine ? Promise.resolve(engine) : new Promise((resolve) => this.waiting.push(resolve));
  }

  private giveBack(engine: ReviewEngine) {
    const next = this.waiting.shift();
    if (next) {
      next(engine);
    } else {
      this.free.push(engine);
    }
  }
}
