import { USERNAME } from './messages';

/** Panel → service worker: a player's avatar and title on chess.com. The answer is a PlayerInfo. */
export const PLAYER_INFO = 'chess-review/player-info';

export interface PlayerInfoMessage {
  type: typeof PLAYER_INFO;
  username: string;
}

/** A player's avatar and title on chess.com; null when there is none, or it is not what chess.com gives. */
export interface PlayerInfo {
  avatar: string | null;
  title: string | null;
}

export const NO_INFO: PlayerInfo = { avatar: null, title: null };

// Only pictures from chess.com's own image server, and only the titles chess.com gives.
const AVATAR = /^https:\/\/images\.chesscomfiles\.com\/[A-Za-z0-9._/-]+$/;
const TITLES = new Set(['GM', 'IM', 'FM', 'CM', 'NM', 'WGM', 'WIM', 'WFM', 'WCM', 'WNM']);

export function isPlayerInfoMessage(message: unknown): message is PlayerInfoMessage {
  const { type, username } = (message ?? {}) as Partial<Record<keyof PlayerInfoMessage, unknown>>;
  return type === PLAYER_INFO && typeof username === 'string' && USERNAME.test(username);
}

/** The avatar and title in an answer of https://api.chess.com/pub/player/{username}. */
export function readPlayerInfo(body: unknown): PlayerInfo {
  const { avatar, title } = (body ?? {}) as { avatar?: unknown; title?: unknown };
  return {
    avatar: typeof avatar === 'string' && AVATAR.test(avatar) ? avatar : null,
    title: typeof title === 'string' && TITLES.has(title) ? title : null,
  };
}

/** Asks the public API of chess.com; no answer is no avatar and no title. The username is checked by the message. */
export async function fetchPlayerInfo(username: string, fetchJson: (url: string) => Promise<unknown>): Promise<PlayerInfo> {
  return readPlayerInfo(await fetchJson(`https://api.chess.com/pub/player/${username.toLowerCase()}`));
}
