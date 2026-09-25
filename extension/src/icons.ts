/** The classes of moves the backend sends (contracts/api.yaml, Classification). */
export type MoveClass = 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'miss' | 'blunder';

// Each icon is a circle of its colour with a white symbol, drawn on a 24 × 24 grid. The symbols and
// colours follow what players know from chess.com; the drawings are our own.
const star = '<path d="M12 5.2l2 4.2 4.6.6-3.4 3.2.9 4.5L12 15.5l-4.1 2.2.9-4.5-3.4-3.2 4.6-.6z" fill="#fff"/>';
const thumb = '<path d="M7.5 11h2.2v6.5H7.5zM10.6 17.5V11l2.6-4.2c.4-.6 1.3-.3 1.3.4V10h2.6c.8 0 1.4.8 1.2 1.6l-1.1 4.6c-.2.7-.8 1.3-1.5 1.3z" fill="#fff"/>';
const check = '<path d="M7 12.4l3.2 3.2L17.2 8.6" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
const book = '<path d="M6.5 8c1.8-.8 3.8-.8 5.5.3v8.4c-1.7-1.1-3.7-1.1-5.5-.3zM17.5 8c-1.8-.8-3.8-.8-5.5.3v8.4c1.7-1.1 3.7-1.1 5.5-.3z" fill="#fff"/>';
const cross = '<path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>';
const text = (symbol: string, size: number) =>
  `<text x="12" y="12.5" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-weight="800" font-size="${size}" fill="#fff">${symbol}</text>`;

export const MOVE_CLASSES: Record<MoveClass, { label: string; color: string; symbol: string }> = {
  best: { label: 'Best', color: '#81b64c', symbol: star },
  excellent: { label: 'Excellent', color: '#5fa56b', symbol: thumb },
  good: { label: 'Good', color: '#8aa38b', symbol: check },
  book: { label: 'Book', color: '#a88865', symbol: book },
  inaccuracy: { label: 'Inaccuracy', color: '#f0c043', symbol: text('?!', 10) },
  mistake: { label: 'Mistake', color: '#e8883a', symbol: text('?', 13) },
  miss: { label: 'Miss', color: '#e05a6b', symbol: cross },
  blunder: { label: 'Blunder', color: '#d93b3b', symbol: text('??', 10) },
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
