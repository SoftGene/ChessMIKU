import { describe, expect, it } from 'vitest';
import { pollDelay } from './poll-schedule';

describe('pollDelay', () => {
  it.each([
    [0, 3000],
    [29_999, 3000],
    [30_000, 10_000],
    [299_999, 10_000],
    [300_000, null],
  ])('after %i ms waits %s ms', (elapsed, delay) => {
    expect(pollDelay(elapsed)).toBe(delay);
  });
});
