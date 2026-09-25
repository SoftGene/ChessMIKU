/**
 * The classes of moves the backend sends (contracts/api.yaml, Classification), and great and brilliant, drawn
 * ahead of it: the backend is to give them after v1.
 */
export type MoveClass = 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'miss' | 'blunder' | 'great' | 'brilliant';

// Each icon is a circle of its colour with a white symbol, drawn on a 24 × 24 grid. The symbols and
// colours follow what players know from chess.com; the drawings are our own.
const star = '<path d="M12 5.2l2 4.2 4.6.6-3.4 3.2.9 4.5L12 15.5l-4.1 2.2.9-4.5-3.4-3.2 4.6-.6z" fill="#fff"/>';
const thumb = '<path d="M7.5 11h2.2v6.5H7.5zM10.6 17.5V11l2.6-4.2c.4-.6 1.3-.3 1.3.4V10h2.6c.8 0 1.4.8 1.2 1.6l-1.1 4.6c-.2.7-.8 1.3-1.5 1.3z" fill="#fff"/>';
const check = '<path d="M7 12.4l3.2 3.2L17.2 8.6" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
// The two pages, and the spine between them in the colour of the icon.
const book =
  '<path d="M6.5 8c1.8-.8 3.8-.8 5.5.3v8.4c-1.7-1.1-3.7-1.1-5.5-.3zM17.5 8c-1.8-.8-3.8-.8-5.5.3v8.4c1.7-1.1 3.7-1.1 5.5-.3z" fill="#fff"/>' +
  '<path d="M12 8.3v8.4" stroke="#a88865" stroke-width="1.2"/>';
const cross = '<path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>';

// Question and exclamation marks are drawn, not typed: fonts differ in size and in where their centre is.
// Every mark is as tall as the others (5.7 to 18.2, the stroke included), and a class's marks are centred.
type Mark = 'question' | 'exclaim';
const MARK_TOP = 5.7;
const MARK_BOTTOM = 18.2;
const MARK_HALF_WIDTH: Record<Mark, number> = { question: 3.6, exclaim: 1.3 };
const dot = (cx: number) => `<circle cx="${cx}" cy="16.9" r="1.3" fill="#fff"/>`;
const drawMark = (mark: Mark, cx: number) =>
  mark === 'question'
    ? `<path data-mark="question" d="M${Math.round((cx - 2.5) * 10) / 10} 9.3a2.5 2.5 0 1 1 4.1 1.95c-.95.62-1.6 1.2-1.6 2.3v.45" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>${dot(cx)}`
    : `<path data-mark="exclaim" d="M${cx} 6.8v7.2" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>${dot(cx)}`;
const MARKS: Partial<Record<MoveClass, [Mark, number][]>> = {
  inaccuracy: [['question', 10.1], ['exclaim', 16.2]],
  mistake: [['question', 12]],
  blunder: [['question', 8], ['question', 16]],
  great: [['exclaim', 12]],
  brilliant: [['exclaim', 9.8], ['exclaim', 14.2]],
};
const marks = (cls: MoveClass) => (MARKS[cls] ?? []).map(([mark, cx]) => drawMark(mark, cx)).join('');

export const MOVE_CLASSES: Record<MoveClass, { label: string; color: string; symbol: string }> = {
  best: { label: 'Best', color: '#81b64c', symbol: star },
  excellent: { label: 'Excellent', color: '#5fa56b', symbol: thumb },
  good: { label: 'Good', color: '#8aa38b', symbol: check },
  book: { label: 'Book', color: '#a88865', symbol: book },
  inaccuracy: { label: 'Inaccuracy', color: '#f0c043', symbol: marks('inaccuracy') },
  mistake: { label: 'Mistake', color: '#e8883a', symbol: marks('mistake') },
  miss: { label: 'Miss', color: '#e05a6b', symbol: cross },
  blunder: { label: 'Blunder', color: '#d93b3b', symbol: marks('blunder') },
  great: { label: 'Great', color: '#5b8bd6', symbol: marks('great') },
  brilliant: { label: 'Brilliant', color: '#26b5a8', symbol: marks('brilliant') },
};

// A class from the backend the extension does not know yet is shown without an icon (contract, decision 4).
const known = (cls: string): cls is MoveClass => Object.hasOwn(MOVE_CLASSES, cls);

const drawing = (cls: MoveClass) =>
  `<circle cx="12" cy="12" r="11" fill="${MOVE_CLASSES[cls].color}" stroke="#17140f" stroke-width="1.5"/>${MOVE_CLASSES[cls].symbol}`;

export function classColor(cls: string): string | null {
  return known(cls) ? MOVE_CLASSES[cls].color : null;
}

/** The icon of a class for the move list. */
export function moveIcon(cls: string, size = 16): string | null {
  return known(cls)
    ? `<svg class="move-icon" width="${size}" height="${size}" viewBox="0 0 24 24" role="img" aria-label="${MOVE_CLASSES[cls].label}">${drawing(cls)}</svg>`
    : null;
}

/** The icon of a class in the top right corner of a square, for chessground's custom SVG (a square is 100 × 100). */
export function squareMark(cls: string): string | null {
  return known(cls) ? `<g transform="translate(60 -4) scale(1.75)">${drawing(cls)}</g>` : null;
}

/** Where the drawn marks of a class sit on the 24 × 24 grid; null for a class drawn otherwise. */
export function glyphBox(cls: string): { left: number; right: number; top: number; bottom: number } | null {
  const list = known(cls) ? MARKS[cls] : undefined;
  if (!list) {
    return null;
  }
  return {
    left: Math.min(...list.map(([mark, cx]) => cx - MARK_HALF_WIDTH[mark])),
    right: Math.max(...list.map(([mark, cx]) => cx + MARK_HALF_WIDTH[mark])),
    top: MARK_TOP,
    bottom: MARK_BOTTOM,
  };
}
