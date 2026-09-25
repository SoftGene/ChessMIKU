// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPlayer } from './players';
import { createWindow, type WindowParts } from './review-window';

let parts: WindowParts;

beforeEach(() => {
  document.body.innerHTML = '<div id="review"></div>';
  parts = createWindow(document.getElementById('review')!, {
    close: vi.fn(),
    flip: vi.fn(),
    toggleHints: vi.fn(),
    toggleSound: vi.fn(),
    navigate: vi.fn(),
    setLanguage: vi.fn(),
    backToGame: vi.fn(),
  });
});

const AVATAR = 'https://images.chesscomfiles.com/uploads/v1/user/15448422.88c010c1.200x200o.3c5619f5441e.png';
const text = (selector: string) => parts.players.white.querySelector(selector)?.textContent;

describe('renderPlayer', () => {
  it('shows the avatar, title and name, rating and accuracy', () => {
    renderPlayer(parts.players.white, { name: 'Hikaru', rating: '3370', info: { avatar: AVATAR, title: 'GM' }, accuracy: 91.44 });

    const image = parts.players.white.querySelector('img');
    expect([image?.getAttribute('src'), image?.getAttribute('alt'), image?.referrerPolicy]).toEqual([AVATAR, '', 'no-referrer']);
    expect(text('.player-title')).toBe('GM');
    expect(text('.player-name')).toBe('GM Hikaru');
    expect(text('.player-rating')).toBe('3370');
    expect(text('.accuracy')).toBe('91.4');
  });

  it('shows the first letter without an avatar, and a dash until the accuracy is known', () => {
    renderPlayer(parts.players.white, { name: 'poohineedyou', rating: null, info: null, accuracy: null });

    expect(parts.players.white.querySelector('img')).toBeNull();
    expect(text('.avatar')).toBe('P');
    expect(text('.player-title')).toBeUndefined();
    expect(text('.player-name')).toBe('poohineedyou');
    expect(text('.player-rating')).toBe('');
    expect(text('.accuracy')).toBe('—');
  });

  it('shows a name as text', () => {
    renderPlayer(parts.players.white, { name: '<b>x</b>', rating: null, info: null, accuracy: null });

    expect(text('.player-name')).toBe('<b>x</b>');
    expect(parts.players.white.querySelector('b')).toBeNull();
  });

  it('shows the avatar when it comes after the first letter', () => {
    renderPlayer(parts.players.white, { name: 'Hikaru', rating: '3370', info: null, accuracy: null });
    renderPlayer(parts.players.white, { name: 'Hikaru', rating: '3370', info: { avatar: AVATAR, title: null }, accuracy: null });

    expect(text('.avatar')).toBe('');
    expect(parts.players.white.querySelectorAll('img')).toHaveLength(1);
  });
});
