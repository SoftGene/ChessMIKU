import type { MoveEvaluation } from './analysis';
import type { ReviewState } from './review';

// Everything is set as text: SAN and reasons come from outside (the PGN, the engine), never as markup.

/** Shows a review state in the panel, in place of whatever the panel showed before. */
export function renderState(root: HTMLElement, state: ReviewState): void {
  const status = document.createElement('p');
  status.textContent = describe(state);
  root.replaceChildren(status);

  if (state.stage === 'done') {
    root.append(movesTable(state.moves));
  }
}

function describe(state: ReviewState): string {
  switch (state.stage) {
    case 'looking-up':
      return 'Looking up the game in the chess.com archive…';
    case 'not-found':
      return 'This game is not in the chess.com archive. A game that has just ended appears there within a few minutes.';
    case 'starting-engine':
      return 'Starting the engine…';
    case 'engine-failed':
      return `The engine could not start, so there is no review. The chess.com page is not affected. Reason: ${state.reason}.`;
    case 'analysing':
      return `Analysing position ${state.done} of ${state.total}…`;
    case 'done':
      return `Analysed ${state.moves.length} moves.`;
    case 'failed':
      return `The review failed. ${state.reason}`;
  }
}

function movesTable(moves: MoveEvaluation[]): HTMLTableElement {
  const table = document.createElement('table');
  table.createTHead().append(row('th', ['#', 'Move', 'Best', 'Before', 'After']));
  const body = table.createTBody();
  for (const move of moves) {
    body.append(row('td', [String(move.ply), move.san, move.bestMoveUci, score(move.evalBeforeCp, move.mateBefore), score(move.evalAfterCp, move.mateAfter)]));
  }
  return table;
}

function row(cell: 'th' | 'td', texts: string[]): HTMLTableRowElement {
  const tr = document.createElement('tr');
  for (const text of texts) {
    const element = document.createElement(cell);
    element.textContent = text;
    tr.append(element);
  }
  return tr;
}

// Pawns for the side that moved: +0.30; a mate in N: #N, against that side #-N; the move mated: #.
function score(cp: number | null, mate: number | null): string {
  if (mate !== null) {
    return mate === 0 ? '#' : `#${mate}`;
  }
  const value = cp ?? 0;
  return `${value > 0 ? '+' : ''}${(value / 100).toFixed(2)}`;
}
