import type { Lookup } from './archive';

/** Whether the page gets the review button, given the look-up and whether chess.com shows the game as over. */
export function showsButton(lookup: Lookup | undefined, gameOverShown: boolean): boolean {
  return lookup?.status === 'finished' || (lookup?.status === 'older' && gameOverShown);
}
