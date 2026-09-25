import type { PlayerInfo } from './player-info';

/** A player as the block over the moves shows them. */
export interface PlayerView {
  name: string;
  rating: string | null;
  info: PlayerInfo | null;
  accuracy: number | null;
}

const span = (className: string, text: string) => {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  return node;
};

/** One player: avatar (or the first letter), title and name, rating, accuracy. Names come from the PGN: text. */
export function renderPlayer(element: HTMLElement, { name, rating, info, accuracy }: PlayerView): void {
  const avatar = element.querySelector<HTMLElement>('.avatar')!;
  if (info?.avatar) {
    const image = document.createElement('img');
    image.src = info.avatar;
    image.alt = '';
    image.width = 40;
    image.height = 40;
    image.referrerPolicy = 'no-referrer';
    avatar.replaceChildren(image);
  } else {
    avatar.textContent = name.charAt(0).toUpperCase();
  }
  element.querySelector('.player-name')!.replaceChildren(...(info?.title ? [span('player-title', info.title), ' '] : []), name);
  element.querySelector('.player-rating')!.textContent = rating ?? '';
  element.querySelector('.accuracy')!.textContent = accuracy === null ? '—' : accuracy.toFixed(1);
}
