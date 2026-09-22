/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { isGameFinished } from './content';

describe('isGameFinished', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should return false when game is not finished', () => {
    document.body.innerHTML = '<div>Some other content</div>';
    expect(isGameFinished()).toBe(false);
  });

  it('should return true when game is finished with game-over-dialog', () => {
    document.body.innerHTML = '<div class="game-over-dialog"></div>';
    expect(isGameFinished()).toBe(true);
  });

  it('should return true when game is finished with game-result-container', () => {
    document.body.innerHTML = '<div class="game-result-container"></div>';
    expect(isGameFinished()).toBe(true);
  });
});
