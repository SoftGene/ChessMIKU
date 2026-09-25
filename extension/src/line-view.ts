import { Chess } from 'chess.js';
import { evalText, sideToMove, toWhiteEval, type WhiteEval } from './eval-display';
import type { Ply } from './game';
import type { Ending } from './legal-moves';
import type { EngineLine } from './uci';

/** What the row of the line tells about the engine: its lines, or why there are none. */
export type LinesState =
  | { kind: 'lines'; lines: EngineLine[] }
  | { kind: 'thinking' }
  | { kind: 'unavailable' }
  | { kind: 'ending'; ending: 'checkmate' | 'stalemate' }
  | { kind: 'hidden' };

export interface LineRow {
  /** The position shown. */
  fen: string;
  moves: Ply[];
  /** The position shown in the line: 0 is the game's position the line leaves. */
  at: number;
  engine: LinesState;
}

/** An engine line as the row shows it: its first move in SAN and White's evaluation, "Nf3 +0.8". */
export function describeLine(fen: string, line: EngineLine): { san: string; value: string } {
  let san = line.moveUci;
  try {
    san = new Chess(fen).move({ from: line.moveUci.slice(0, 2), to: line.moveUci.slice(2, 4), promotion: line.moveUci[4] }).san;
  } catch {
    // An engine answers with legal moves; the UCI text stays if one ever is not.
  }
  return { san, value: evalText(toWhiteEval(line.score, sideToMove(fen))) };
}

/** The bar in the line: the best line's evaluation; a mate or a stalemate on the board needs no engine. */
export function lineEval(fen: string, ending: Ending, lines: EngineLine[] | null | undefined): WhiteEval | undefined {
  if (ending === 'checkmate') {
    return { mateIn: 0, winner: sideToMove(fen) === 'w' ? 'black' : 'white' };
  }
  if (ending === 'stalemate') {
    return { cp: 0 };
  }
  return lines?.[0] ? toWhiteEval(lines[0].score, sideToMove(fen)) : undefined;
}

/** What the row tells: the end of the game first, then nothing when hints are off, then the engine. */
export function linesState(ending: Ending, lines: EngineLine[] | null | undefined, hints: boolean): LinesState {
  if (ending) {
    return { kind: 'ending', ending };
  }
  if (!hints) {
    return { kind: 'hidden' };
  }
  if (lines === null) {
    return { kind: 'unavailable' };
  }
  return lines ? { kind: 'lines', lines } : { kind: 'thinking' };
}

const TEXTS = { thinking: '…', unavailable: 'Engine unavailable', checkmate: 'Checkmate', stalemate: 'Stalemate' };

const span = (className: string, text: string) => {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  return node;
};

/** The row of the player's line: the engine's lines over the moves of the line, each a button to go to it. */
export function renderLine(element: HTMLElement, row: LineRow, onSelect: (at: number) => void): void {
  const engine = document.createElement('div');
  engine.className = 'line-engine';
  engine.hidden = row.engine.kind === 'hidden';
  if (row.engine.kind === 'lines') {
    row.engine.lines.forEach((line, i) => {
      const { san, value } = describeLine(row.fen, line);
      engine.append(...(i > 0 ? [' · '] : []), span('line-san', san), ` ${value}`);
    });
  } else if (row.engine.kind === 'ending') {
    engine.textContent = TEXTS[row.engine.ending];
  } else if (row.engine.kind !== 'hidden') {
    engine.textContent = TEXTS[row.engine.kind];
  }

  const moves = document.createElement('div');
  moves.className = 'line-moves';
  row.moves.forEach((move, i) => {
    const [, turn, , , , fullmove] = move.fenBefore.split(' ');
    if (turn === 'w') {
      moves.append(span('line-number', `${fullmove}.`));
    } else if (i === 0) {
      moves.append(span('line-number', `${fullmove}…`));
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'line-move';
    button.textContent = move.san;
    if (i + 1 === row.at) {
      button.setAttribute('aria-current', 'true');
    }
    button.addEventListener('click', () => onSelect(i + 1));
    moves.append(button);
  });

  element.replaceChildren(engine, moves);
}
