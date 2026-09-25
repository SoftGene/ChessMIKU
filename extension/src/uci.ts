/** An evaluation as the engine reports it (`score cp` or `score mate`), for the side to move. */
export type Score = { cp: number } | { mate: number };

/** What one search found: the best move in the position and its evaluation. */
export interface Evaluation {
  bestMoveUci: string;
  score: Score;
}

/** One line of a search with several (MultiPV): its first move and its score, for the side to move. */
export interface EngineLine {
  moveUci: string;
  score: Score;
}

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/**
 * The lines of one `go` with MultiPV, best first, all from one depth: the deepest at which each line has a complete
 * report. Lines of different depths can name the same move: the first line changes its mind at a depth where the
 * second has only a bound (lowerbound, upperbound), which is skipped.
 */
export function readLines(lines: readonly string[]): EngineLine[] {
  const byDepth = new Map<number, Map<number, EngineLine>>();
  let count = 0;
  for (const line of lines) {
    const words = line.trim().split(/\s+/);
    const score = words[0] === 'info' ? scoreOf(words) : null;
    if (!score) {
      continue;
    }
    const index = numberAfter(words, 'multipv') ?? 1;
    count = Math.max(count, index);
    const moveUci = words[words.indexOf('pv') + 1];
    const depth = numberAfter(words, 'depth');
    if (words.includes('lowerbound') || words.includes('upperbound') || !words.includes('pv') || !UCI_MOVE.test(moveUci ?? '') || depth === null) {
      continue;
    }
    const atDepth = byDepth.get(depth) ?? new Map<number, EngineLine>();
    atDepth.set(index, { moveUci, score });
    byDepth.set(depth, atDepth);
  }
  const deepest = [...byDepth.entries()].sort(([a], [b]) => b - a).find(([, found]) => found.size === count);
  return deepest ? [...deepest[1].entries()].sort(([a], [b]) => a - b).map(([, line]) => line) : [];
}

// The whole number after a word of an `info` line: "depth 12", "multipv 2".
function numberAfter(words: string[], word: string): number | null {
  const at = words.indexOf(word);
  const value = at >= 0 ? Number.parseInt(words[at + 1], 10) : Number.NaN;
  return Number.isInteger(value) ? value : null;
}

/** The result of one `go`, read from the lines the engine printed for it. */
export function readSearch(lines: readonly string[]): Evaluation {
  let score: Score | null = null;
  let bestMoveUci: string | null = null;

  for (const line of lines) {
    const words = line.trim().split(/\s+/);
    if (words[0] === 'bestmove') {
      bestMoveUci = UCI_MOVE.test(words[1] ?? '') ? words[1] : null;
    } else if (words[0] === 'info') {
      score = readScore(words) ?? score;
    }
  }

  if (bestMoveUci === null) {
    throw new Error('The engine reported no move.');
  }
  if (score === null) {
    throw new Error('The engine reported no score.');
  }
  return { bestMoveUci, score };
}

// "info depth 10 seldepth 14 multipv 1 score cp 28 nodes …": the score of the main line, unless
// the line reports only a bound of it (lowerbound, upperbound) while the search is still settling.
function readScore(words: string[]): Score | null {
  const multipv = words.indexOf('multipv');
  if (words.includes('lowerbound') || words.includes('upperbound') || (multipv >= 0 && words[multipv + 1] !== '1')) {
    return null;
  }
  return scoreOf(words);
}

// "score cp 28" or "score mate -3".
function scoreOf(words: string[]): Score | null {
  const at = words.indexOf('score');
  if (at < 0) {
    return null;
  }
  const value = Number.parseInt(words[at + 2], 10);
  if (!Number.isInteger(value)) {
    return null;
  }
  return words[at + 1] === 'cp' ? { cp: value } : words[at + 1] === 'mate' ? { mate: value } : null;
}
