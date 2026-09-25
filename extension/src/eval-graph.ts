import { evalText, whiteShare, type WhiteEval } from './eval-display';
import type { Game } from './game';
import { classColor } from './icons';
import { moveLabel } from './key-moments';

/** The size of the graph as laid out, in pixels: it is drawn in these, so that its dots stay round. */
export interface GraphSize {
  width: number;
  height: number;
}

/** The classes marked with a dot: the mistakes, and the great moves once the server gives them. */
export const GRAPH_MARKS: ReadonlySet<string> = new Set(['blunder', 'mistake', 'miss', 'great', 'brilliant']);

const round = (value: number) => Math.round(value * 10) / 10;

/** The x of a position: the start at the left edge, the last position at the right. */
export function graphX(index: number, last: number, width: number): number {
  return last === 0 ? 0 : round((index / last) * width);
}

export function graphY(value: WhiteEval, height: number): number {
  return round((1 - whiteShare(value)) * height);
}

/** "x,y x,y …" of the evaluated positions, left to right; White's advantage is up. */
export function graphPoints(evals: readonly (WhiteEval | undefined)[], { width, height }: GraphSize): string {
  const last = evals.length - 1;
  return evals.flatMap((value, i) => (value ? [`${graphX(i, last, width)},${graphY(value, height)}`] : [])).join(' ');
}

/** The position under an x of the graph as drawn `width` pixels wide. */
export function positionAtX(x: number, width: number, last: number): number {
  if (width <= 0) {
    return 0;
  }
  return Math.min(last, Math.max(0, Math.round((x / width) * last)));
}

/** "23… f5 · +2.6": the move that led to a position, and its evaluation; null before it is evaluated. */
export function graphTip(game: Game, evals: readonly (WhiteEval | undefined)[], index: number): string | null {
  const value = evals[index];
  if (!value) {
    return null;
  }
  return `${index === 0 ? 'Start' : moveLabel(game.plies[index - 1])} · ${evalText(value)}`;
}

/** The area and line of the evaluations, the middle, the current and pointed positions, the mistakes as dots. */
export function renderGraph(
  svg: SVGSVGElement,
  evals: readonly (WhiteEval | undefined)[],
  current: number,
  marks: ReadonlyMap<number, string>,
  size: GraphSize,
  hover: number | null = null,
): void {
  const { width, height } = size;
  const last = evals.length - 1;
  const at = (index: number) => graphX(index, last, width);
  const known = evals.flatMap((value, i) => (value ? [i] : []));
  const points = graphPoints(evals, size);
  const area = known.length ? `${at(known[0])},${height} ${points} ${at(known.at(-1)!)},${height}` : '';
  const dots = [...marks].flatMap(([ply, cls]) => {
    const value = evals[ply];
    const color = GRAPH_MARKS.has(cls) ? classColor(cls) : null;
    return value && color ? [`<circle class="graph-mark" cx="${at(ply)}" cy="${graphY(value, height)}" r="4" fill="${color}"/>`] : [];
  });
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.removeAttribute('preserveAspectRatio');
  svg.innerHTML =
    (area ? `<polygon class="graph-area" points="${area}"/>` : '') +
    `<polyline class="graph-line" points="${points}"/>` +
    // Over the area, so that it shows on both sides: where the game is level.
    `<line class="graph-mid" x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}"/>` +
    `<line class="graph-cursor" x1="${at(current)}" y1="0" x2="${at(current)}" y2="${height}"/>` +
    (hover === null ? '' : `<line class="graph-hover" x1="${at(hover)}" y1="0" x2="${at(hover)}" y2="${height}"/>`) +
    dots.join('');
}
