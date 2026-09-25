import type { WhiteEval } from './eval-display';

// The accuracy of Lichess (lichess.org/page/accuracy), written anew: the chances to win of each position, how much of
// them each move gave away, and a mean that weighs sharp moments more. Numbers are close to chess.com's, not equal.

const CP_LIMIT = 1000;

/** White's chances to win, 0 to 100; an evaluation counts up to ±10 pawns, and a mate as 10 pawns. */
export function winPercent(value: WhiteEval): number {
  const cp = 'cp' in value ? Math.max(-CP_LIMIT, Math.min(CP_LIMIT, value.cp)) : value.winner === 'white' ? CP_LIMIT : -CP_LIMIT;
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** The accuracy of one move, 0 to 100, from the mover's chances before and after it. */
export function moveAccuracy(before: number, after: number): number {
  if (after >= before) {
    return 100;
  }
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * (before - after)) - 3.166924740191411;
  // +1: the analysis is not perfect.
  return Math.min(100, Math.max(0, raw + 1));
}

export interface Accuracy {
  white: number | null;
  black: number | null;
}

/** The accuracy of each player over the game, from White's evaluation of every position (0 is the start). */
export function gameAccuracy(evals: readonly WhiteEval[], firstMover: 'w' | 'b'): Accuracy {
  const chances = evals.map(winPercent);
  const moves = chances.length - 1;
  if (moves < 1) {
    return { white: null, black: null };
  }
  // A window of about a tenth of the game around each move; its spread of chances is how sharp the moment was.
  const size = Math.min(8, Math.max(2, Math.floor(moves / 10)));
  const windows = [...Array<number[]>(Math.min(size, chances.length) - 2).fill(chances.slice(0, size)), ...sliding(chances, size)];
  const weights = windows.map((window) => Math.min(12, Math.max(0.5, deviation(window))));

  const byPlayer: Record<'white' | 'black', [number, number][]> = { white: [], black: [] };
  for (let i = 0; i < moves; i++) {
    const player = (i % 2 === 0) === (firstMover === 'w') ? 'white' : 'black';
    const [before, after] = player === 'white' ? [chances[i], chances[i + 1]] : [100 - chances[i], 100 - chances[i + 1]];
    byPlayer[player].push([moveAccuracy(before, after), weights[i]]);
  }
  return { white: mean(byPlayer.white), black: mean(byPlayer.black) };
}

function sliding(values: readonly number[], size: number): number[][] {
  return Array.from({ length: Math.max(1, values.length - size + 1) }, (_, i) => values.slice(i, i + size));
}

function deviation(values: readonly number[]): number {
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
}

// The mean of the weighted mean and the harmonic mean: one bad move weighs heavily, as it does in a game.
function mean(moves: readonly [number, number][]): number | null {
  if (moves.length === 0) {
    return null;
  }
  const weighted = moves.reduce((sum, [accuracy, weight]) => sum + accuracy * weight, 0) / moves.reduce((sum, [, weight]) => sum + weight, 0);
  const harmonic = moves.length / moves.reduce((sum, [accuracy]) => sum + 1 / accuracy, 0);
  return (weighted + harmonic) / 2;
}
