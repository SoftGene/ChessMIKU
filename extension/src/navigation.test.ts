import { describe, expect, it } from 'vitest';
import { keyAction, navigate } from './navigation';

describe('navigate', () => {
  it.each([
    [5, 'prev', 4],
    [5, 'next', 6],
    [5, 'first', 0],
    [5, 'last', 10],
    [0, 'prev', 0],
    [10, 'next', 10],
  ] as const)('from %i, %s goes to %i', (ply, action, expected) => {
    expect(navigate(ply, 10, action)).toBe(expected);
  });
});

describe('keyAction', () => {
  it.each([
    ['ArrowLeft', 'prev'],
    ['ArrowRight', 'next'],
    ['Home', 'first'],
    ['End', 'last'],
    ['Escape', 'close'],
  ])('maps %s to %s', (key, action) => {
    expect(keyAction(key)).toBe(action);
  });

  it.each(['ArrowUp', 'a', ' ', 'Enter'])('leaves %j alone', (key) => {
    expect(keyAction(key)).toBeNull();
  });
});
