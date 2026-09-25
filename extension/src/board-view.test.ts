import { describe, expect, it } from 'vitest';
import { pressChoosesAnother } from './board-view';

describe('pressChoosesAnother', () => {
  it('takes a press on another piece of the same side for choosing it, not for a move onto it', () => {
    expect(pressChoosesAnother({ key: 'd7', color: 'black' }, { key: 'e7', color: 'black' })).toBe(true);
  });

  it('leaves a press on the piece chosen, on the other side, on an empty square or with nothing chosen to the board', () => {
    expect(pressChoosesAnother({ key: 'd7', color: 'black' }, { key: 'd7', color: 'black' })).toBe(false);
    expect(pressChoosesAnother({ key: 'd7', color: 'black' }, { key: 'e2', color: 'white' })).toBe(false);
    expect(pressChoosesAnother({ key: 'd7', color: 'black' }, undefined)).toBe(false);
    expect(pressChoosesAnother(undefined, { key: 'e7', color: 'black' })).toBe(false);
  });
});
