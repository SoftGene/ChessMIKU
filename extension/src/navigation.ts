export type NavAction = 'first' | 'prev' | 'next' | 'last';

/** The half-move to show after a navigation action; 0 is the start, `last` the final position. */
export function navigate(ply: number, last: number, action: NavAction): number {
  switch (action) {
    case 'first':
      return 0;
    case 'prev':
      return Math.max(0, ply - 1);
    case 'next':
      return Math.min(last, ply + 1);
    case 'last':
      return last;
  }
}

const KEYS: Record<string, NavAction | 'close'> = {
  ArrowLeft: 'prev',
  ArrowRight: 'next',
  Home: 'first',
  End: 'last',
  Escape: 'close',
};

/** What a key does in the window. */
export function keyAction(key: string): NavAction | 'close' | null {
  return KEYS[key] ?? null;
}
