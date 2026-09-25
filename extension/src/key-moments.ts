import type { Language } from './backend-messages';
import type { CardState } from './backend-review';
import { cardMessage, cardTitle, className, noMistakesText } from './card-text';
import type { Game, Ply } from './game';
import { moveIcon } from './icons';

export interface MomentsContext {
  language: Language;
  game: Game;
  classes: ReadonlyMap<number, string>;
  /** The half-move on the board: its moment, when it is one, is open. */
  current: number;
  onSelect(ply: number): void;
}

/** "19. Qd2" for White, "24… Rc8" for Black: the number of the move in the position before it. */
export function moveLabel(ply: Ply): string {
  const number = ply.fenBefore.split(' ')[5];
  return ply.color === 'w' ? `${number}. ${ply.san}` : `${number}… ${ply.san}`;
}

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
};

/**
 * The card under the moves: the key moments in the order of the game, each a button to go to it, the text of one
 * open. The texts come from the server and are set as text. Without explanations, a line about where they are.
 */
export function renderKeyMoments(card: HTMLElement, state: CardState, { language, game, classes, current, onSelect }: MomentsContext): void {
  if (state.kind !== 'ready') {
    card.replaceChildren(element('p', 'card-message', cardMessage(language, state)));
    return;
  }
  const moments = state.explanations.filter((moment) => game.plies[moment.ply - 1]).sort((a, b) => a.ply - b.ply);
  if (moments.length === 0) {
    card.replaceChildren(element('p', 'card-message', noMistakesText(language)));
    return;
  }

  const open = moments.some((moment) => moment.ply === current) ? current : moments[0].ply;
  const children: HTMLElement[] = [element('h2', 'moments-title', cardTitle(language))];
  for (const moment of moments) {
    const cls = classes.get(moment.ply) ?? '';
    const row = element('button', 'moment');
    row.type = 'button';
    row.dataset.ply = String(moment.ply);
    row.setAttribute('aria-expanded', String(moment.ply === open));
    row.append(element('span', 'moment-move', moveLabel(game.plies[moment.ply - 1])), element('span', 'moment-class', className(language, cls)));
    const icon = moveIcon(cls);
    if (icon) {
      row.insertAdjacentHTML('afterbegin', icon);
    }
    row.addEventListener('click', () => onSelect(moment.ply));
    children.push(row);
    if (moment.ply === open) {
      children.push(element('p', 'moment-text', moment.text));
    }
  }
  card.replaceChildren(...children);
}
