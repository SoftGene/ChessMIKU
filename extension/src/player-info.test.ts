import { describe, expect, it, vi } from 'vitest';
import { fetchPlayerInfo, isPlayerInfoMessage, NO_INFO, PLAYER_INFO, readPlayerInfo } from './player-info';

const HIKARU = {
  avatar: 'https://images.chesscomfiles.com/uploads/v1/user/15448422.88c010c1.200x200o.3c5619f5441e.png',
  username: 'hikaru',
  title: 'GM',
  followers: 1,
};

describe('readPlayerInfo', () => {
  it("takes the avatar and the title from chess.com's answer", () => {
    expect(readPlayerInfo(HIKARU)).toEqual({ avatar: HIKARU.avatar, title: 'GM' });
  });

  it('has none of them when the answer has none', () => {
    expect(readPlayerInfo({ username: 'poohineedyou' })).toEqual(NO_INFO);
    expect(readPlayerInfo(null)).toEqual(NO_INFO);
  });

  it.each(['https://evil.example/a.png', 'javascript:alert(1)', 'https://images.chesscomfiles.com/a b.png', 'http://images.chesscomfiles.com/a.png'])(
    'takes no picture from %s',
    (avatar) => {
      expect(readPlayerInfo({ ...HIKARU, avatar }).avatar).toBeNull();
    },
  );

  it.each(['XX', 'gm', '<b>GM</b>'])('takes no title %s', (title) => {
    expect(readPlayerInfo({ ...HIKARU, title }).title).toBeNull();
  });
});

describe('isPlayerInfoMessage', () => {
  it('takes a username', () => {
    expect(isPlayerInfoMessage({ type: PLAYER_INFO, username: 'Hikaru' })).toBe(true);
  });

  it.each(['../x', 'ab', 'x'.repeat(26), 'Hi karu'])('turns away %s', (username) => {
    expect(isPlayerInfoMessage({ type: PLAYER_INFO, username })).toBe(false);
  });

  it('turns away another type', () => {
    expect(isPlayerInfoMessage({ type: 'chess-review/analyse', username: 'Hikaru' })).toBe(false);
  });
});

describe('fetchPlayerInfo', () => {
  it('asks the public API of chess.com', async () => {
    const fetchJson = vi.fn(async (_url: string) => HIKARU);

    expect(await fetchPlayerInfo('Hikaru', fetchJson)).toEqual({ avatar: HIKARU.avatar, title: 'GM' });
    expect(fetchJson).toHaveBeenCalledWith('https://api.chess.com/pub/player/hikaru');
  });

  it('has no avatar and no title without an answer', async () => {
    expect(await fetchPlayerInfo('Hikaru', async () => null)).toEqual(NO_INFO);
  });
});
