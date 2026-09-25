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

/** The lines of one `go` with MultiPV, best first: for each, its last complete report (bounds are skipped). */
export function readLines(lines: readonly string[]): EngineLine[] {
  const found = new Map<number, EngineLine>();
  for (const line of lines) {
    const words = line.trim().split(/\s+/);
    if (words[0] !== 'info' || words.includes('lowerbound') || words.includes('upperbound')) {
      continue;
    }
    const score = scoreOf(words);
    const pv = words.indexOf('pv');
    const moveUci = pv >= 0 ? words[pv + 1] : undefined;
    if (score && moveUci && UCI_MOVE.test(moveUci)) {
      const multipv = words.indexOf('multipv');
      found.set(multipv >= 0 ? Number.parseInt(words[multipv + 1], 10) : 1, { moveUci, score });
    }
  }
  return [...found.entries()].sort(([a], [b]) => a - b).map(([, line]) => line);
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
