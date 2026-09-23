export interface ReplayOptions {
  /** The final half-move: the replay stops there. */
  last: number;
  /** Whether the position after this half-move is evaluated, and every one before it. */
  isReady(ply: number): boolean;
  show(ply: number): void;
  done(): void;
  intervalMs?: number;
}

/**
 * Plays the game forward from the start, a half-move at a time: never faster than one an interval (~10 a
 * second), never past the positions evaluated so far. Stops at the last half-move.
 */
export function startReplay({ last, isReady, show, done, intervalMs = 100 }: ReplayOptions): { stop(): void } {
  let ply = 0;
  const timer = setInterval(() => {
    if (ply < last && isReady(ply + 1)) {
      ply += 1;
      show(ply);
    }
    if (ply === last) {
      clearInterval(timer);
      done();
    }
  }, intervalMs);
  return { stop: () => clearInterval(timer) };
}
