// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { renderEvalBar } from './eval-bar';

let bar: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div class="eval-bar"><span class="eval-text"></span></div>';
  bar = document.querySelector('.eval-bar')!;
});

describe('renderEvalBar', () => {
  it('fills White’s share and writes the evaluation', () => {
    renderEvalBar(bar, { cp: 300 }, 'white');

    expect(bar.style.getPropertyValue('--white-share')).toBe('0.751');
    expect(bar.querySelector('.eval-text')?.textContent).toBe('+3.0');
    expect(bar.classList.contains('flipped')).toBe(false);
  });

  it('turns over with the board', () => {
    renderEvalBar(bar, { cp: 300 }, 'black');

    expect(bar.classList.contains('flipped')).toBe(true);
  });

  it('stays level and silent before the position is evaluated', () => {
    renderEvalBar(bar, undefined, 'white');

    expect(bar.style.getPropertyValue('--white-share')).toBe('0.500');
    expect(bar.querySelector('.eval-text')?.textContent).toBe('');
  });
});
