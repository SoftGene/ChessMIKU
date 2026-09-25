import type { Game } from './game';
import { moveIcon } from './icons';

const cell = (className: string, text: string) => {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
};

/** The moves in two columns, White and Black, each a button to go to it. Moves are text: they come from the PGN. */
export function buildMoveList(list: HTMLElement, game: Game, onSelect: (ply: number) => void): void {
  list.replaceChildren();
  game.plies.forEach((ply, i) => {
    if (ply.color === 'w' || i === 0) {
      list.append(cell('move-number', `${ply.fenBefore.split(' ')[5]}.`));
      if (ply.color === 'b') {
        list.append(cell('move empty', '…'));
      }
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'move';
    button.dataset.ply = String(ply.ply);
    button.append(cell('san', ply.san));
    button.addEventListener('click', () => onSelect(ply.ply));
    list.append(button);
  });
}

/** Marks the move that led to the position shown; none at the start. */
export function markCurrentMove(list: HTMLElement, ply: number): void {
  list.querySelector('[aria-current="true"]')?.removeAttribute('aria-current');
  const current = list.querySelector<HTMLElement>(`button.move[data-ply="${ply}"]`);
  current?.setAttribute('aria-current', 'true');
  current?.scrollIntoView?.({ block: 'nearest' });
}

/** Puts the icon of each move's class before it; a class the extension does not know gets none. */
export function setMoveClasses(list: HTMLElement, classes: ReadonlyMap<number, string>): void {
  for (const button of list.querySelectorAll<HTMLElement>('button.move')) {
    button.querySelector('svg')?.remove();
    const icon = moveIcon(classes.get(Number(button.dataset.ply)) ?? '');
    if (icon) {
      button.insertAdjacentHTML('afterbegin', icon);
    }
  }
}
