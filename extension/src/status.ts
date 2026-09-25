import type { ReviewState } from './review';

/** One line about where the review is, for the status line of the window. */
export function statusText(state: ReviewState): string {
  switch (state.stage) {
    case 'looking-up':
      return 'Looking up the game in the chess.com archive… An older game takes a few seconds.';
    case 'not-found':
      return 'This game is not in the chess.com archive. A game that has just ended appears there within a few minutes.';
    case 'starting-engine':
      return 'Starting the engine…';
    case 'engine-failed':
      return `The engine could not start, so there are no evaluations. The chess.com page is not affected. Reason: ${state.reason}.`;
    case 'analysing':
      return `Analysing position ${state.done} of ${state.total}…`;
    case 'done':
      return `Analysed ${state.moves.length} moves.`;
    case 'failed':
      return `The review failed. ${state.reason}`;
  }
}
