// Explanations take 10–60 s, and up to a few minutes when the model is busy (three attempts, a minute apart).
const QUICK_MS = 3_000;
const QUICK_FOR_MS = 30_000;
const SLOW_MS = 10_000;
const GIVE_UP_AFTER_MS = 300_000;

/** How long to wait before asking about the explanations again, by the time since the game was sent; null: stop. */
export function pollDelay(elapsedMs: number): number | null {
  if (elapsedMs >= GIVE_UP_AFTER_MS) {
    return null;
  }
  return elapsedMs < QUICK_FOR_MS ? QUICK_MS : SLOW_MS;
}
