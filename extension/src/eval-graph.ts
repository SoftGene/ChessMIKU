import { whiteShare, type WhiteEval } from './eval-display';
import { classColor } from './icons';

export const GRAPH_WIDTH = 600;
export const GRAPH_HEIGHT = 80;

const round = (value: number) => Math.round(value * 10) / 10;

/** The x of a position: the start at the left edge, the last position at the right. */
export function graphX(index: number, last: number): number {
  return last === 0 ? 0 : round((index / last) * GRAPH_WIDTH);
}

const graphY = (value: WhiteEval) => round((1 - whiteShare(value)) * GRAPH_HEIGHT);

/** "x,y x,y …" of the evaluated positions, left to right; White's advantage is up. */
export function graphPoints(evals: readonly (WhiteEval | undefined)[]): string {
  const last = evals.length - 1;
  return evals.flatMap((value, i) => (value ? [`${graphX(i, last)},${graphY(value)}`] : [])).join(' ');
}

/** The position under an x of the graph as drawn `width` pixels wide. */
export function positionAtX(x: number, width: number, last: number): number {
  if (width <= 0) {
    return 0;
  }
  return Math.min(last, Math.max(0, Math.round((x / width) * last)));
}

/** The area and line of the evaluations, the classed moves as coloured dots, the current position as a line. */
export function renderGraph(svg: SVGSVGElement, evals: readonly (WhiteEval | undefined)[], current: number, marks: ReadonlyMap<number, string>): void {
  const last = evals.length - 1;
  const known = evals.flatMap((value, i) => (value ? [i] : []));
  const points = graphPoints(evals);
  const area = known.length ? `${graphX(known[0], last)},${GRAPH_HEIGHT} ${points} ${graphX(known.at(-1)!, last)},${GRAPH_HEIGHT}` : '';
  const dots = [...marks].flatMap(([ply, cls]) => {
    const value = evals[ply];
    const color = classColor(cls);
    return value && color ? [`<circle class="graph-mark" cx="${graphX(ply, last)}" cy="${graphY(value)}" r="4" fill="${color}"/>`] : [];
  });
  const cursor = graphX(current, last);
  svg.setAttribute('viewBox', `0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML =
    `<line class="graph-mid" x1="0" y1="${GRAPH_HEIGHT / 2}" x2="${GRAPH_WIDTH}" y2="${GRAPH_HEIGHT / 2}"/>` +
    (area ? `<polygon class="graph-area" points="${area}"/>` : '') +
    `<polyline class="graph-line" points="${points}"/>` +
    dots.join('') +
    `<line class="graph-cursor" x1="${cursor}" y1="0" x2="${cursor}" y2="${GRAPH_HEIGHT}"/>`;
}
