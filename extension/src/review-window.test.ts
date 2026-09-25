// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { NavAction } from './navigation';
import { createWindow, setPressed, showHeaders } from './review-window';

let root: HTMLElement;
let handlers: { close: Mock<() => void>; flip: Mock<() => void>; toggleHints: Mock<() => void>; toggleSound: Mock<() => void>; navigate: Mock<(action: NavAction) => void> };

beforeEach(() => {
  document.body.innerHTML = '<div id="review" class="backdrop"></div>';
  root = document.getElementById('review')!;
  handlers = { close: vi.fn(), flip: vi.fn(), toggleHints: vi.fn(), toggleSound: vi.fn(), navigate: vi.fn<(action: NavAction) => void>() };
});

const click = (selector: string) => root.querySelector<HTMLElement>(selector)!.click();

describe('the review window', () => {
  it('has a place for every part', () => {
    const parts = createWindow(root, handlers);

    for (const part of [parts.board, parts.evalBar, parts.graph, parts.moves, parts.card, parts.status, parts.title, parts.hints, parts.sound]) {
      expect(root.contains(part)).toBe(true);
    }
    expect(parts.graph.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('closes with its close button', () => {
    createWindow(root, handlers);

    click('button[aria-label="Close"]');

    expect(handlers.close).toHaveBeenCalledOnce();
  });

  it('closes on a click on the dimmed page around it, not inside it', () => {
    createWindow(root, handlers);

    click('.window');
    expect(handlers.close).not.toHaveBeenCalled();
    root.click();
    expect(handlers.close).toHaveBeenCalledOnce();
  });

  it('goes to the start, back, forward and to the end with its buttons', () => {
    createWindow(root, handlers);

    for (const label of ['First move', 'Previous move', 'Next move', 'Last move']) {
      click(`button[aria-label="${label}"]`);
    }

    expect(handlers.navigate.mock.calls).toEqual([['first'], ['prev'], ['next'], ['last']]);
  });

  it('flips the board and switches hints and sound', () => {
    createWindow(root, handlers);

    click('button[aria-label="Flip board"]');
    click('button[aria-label="Hints"]');
    click('button[aria-label="Sound"]');

    expect([handlers.flip, handlers.toggleHints, handlers.toggleSound].map((h) => h.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('names the players, their ratings, the result and the date, as text', () => {
    const parts = createWindow(root, handlers);

    showHeaders(parts, { white: 'Hikaru', black: '<b>x</b>', whiteElo: '3370', blackElo: null, result: '1-0', date: '2026.08.30' });

    expect(parts.title.textContent).toBe('Hikaru (3370) – <b>x</b> · 1-0 · 2026.08.30');
    expect(parts.title.querySelector('b')).toBeNull();
  });

  it('shows whether a switch is on', () => {
    const parts = createWindow(root, handlers);

    setPressed(parts.hints, false);
    expect(parts.hints.getAttribute('aria-pressed')).toBe('false');
    setPressed(parts.hints, true);
    expect(parts.hints.getAttribute('aria-pressed')).toBe('true');
  });
});
