import { describe, expect, it } from 'vitest';
import { showsButton } from './button';

// The review button is never on a game in progress: a finished game is one an archive holds, or one
// older than the recent archives that chess.com itself shows as over (the panel then finds it).
describe('showsButton', () => {
  it('shows it for a game found in an archive', () => {
    expect(showsButton({ status: 'finished', pgn: '1. e4 *' }, false)).toBe(true);
  });

  it('shows it for an older game once chess.com shows the game as over', () => {
    expect(showsButton({ status: 'older' }, true)).toBe(true);
  });

  it('hides it for an older game while chess.com does not show the game as over', () => {
    expect(showsButton({ status: 'older' }, false)).toBe(false);
  });

  it('hides it for a game not found, even when chess.com shows the game as over', () => {
    expect(showsButton({ status: 'not-found' }, true)).toBe(false);
  });

  it('hides it before any answer', () => {
    expect(showsButton(undefined, true)).toBe(false);
  });
});
