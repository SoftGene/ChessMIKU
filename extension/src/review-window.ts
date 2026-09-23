import type { GameHeaders } from './game';
import type { NavAction } from './navigation';

export interface WindowHandlers {
  close(): void;
  flip(): void;
  toggleHints(): void;
  toggleSound(): void;
  navigate(action: NavAction): void;
}

export interface WindowParts {
  root: HTMLElement;
  title: HTMLElement;
  board: HTMLElement;
  evalBar: HTMLElement;
  graph: SVGSVGElement;
  moves: HTMLElement;
  card: HTMLElement;
  status: HTMLElement;
  hints: HTMLButtonElement;
  sound: HTMLButtonElement;
}

// Our own markup, no data in it: players, moves and texts are set as text afterwards.
const LAYOUT = `
  <section class="window" role="dialog" aria-label="Game review" tabindex="-1">
    <header>
      <h1 class="title"></h1>
      <button type="button" class="tool" aria-label="Hints" aria-pressed="true">Hints</button>
      <button type="button" class="tool" aria-label="Sound" aria-pressed="true">Sound</button>
      <button type="button" class="tool" aria-label="Flip board">⇅</button>
      <button type="button" class="tool" aria-label="Close">✕</button>
    </header>
    <div class="main">
      <div class="left">
        <div class="eval-bar"><span class="eval-text"></span></div>
        <div class="board"></div>
        <nav class="nav">
          <button type="button" class="tool" aria-label="First move">⏮</button>
          <button type="button" class="tool" aria-label="Previous move">◀</button>
          <button type="button" class="tool" aria-label="Next move">▶</button>
          <button type="button" class="tool" aria-label="Last move">⏭</button>
        </nav>
        <svg class="graph" xmlns="http://www.w3.org/2000/svg" aria-label="Evaluation graph"></svg>
      </div>
      <div class="right">
        <div class="moves"></div>
        <div class="card"></div>
      </div>
    </div>
    <p class="status" role="status"></p>
  </section>`;

export function createWindow(root: HTMLElement, handlers: WindowHandlers): WindowParts {
  root.innerHTML = LAYOUT;
  const button = (label: string) => root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  button('Close').addEventListener('click', () => handlers.close());
  button('Flip board').addEventListener('click', () => handlers.flip());
  button('Hints').addEventListener('click', () => handlers.toggleHints());
  button('Sound').addEventListener('click', () => handlers.toggleSound());
  const nav: [string, NavAction][] = [
    ['First move', 'first'],
    ['Previous move', 'prev'],
    ['Next move', 'next'],
    ['Last move', 'last'],
  ];
  for (const [label, action] of nav) {
    button(label).addEventListener('click', () => handlers.navigate(action));
  }
  // The dimmed page around the window closes it; a click inside the window has another target.
  root.addEventListener('click', (event) => {
    if (event.target === root) {
      handlers.close();
    }
  });

  return {
    root,
    title: root.querySelector('.title')!,
    board: root.querySelector('.board')!,
    evalBar: root.querySelector('.eval-bar')!,
    graph: root.querySelector<SVGSVGElement>('svg.graph')!,
    moves: root.querySelector('.moves')!,
    card: root.querySelector('.card')!,
    status: root.querySelector('.status')!,
    hints: button('Hints'),
    sound: button('Sound'),
  };
}

/** "White (elo) – Black (elo) · result · date", as text: names come from the PGN. */
export function showHeaders(parts: WindowParts, headers: GameHeaders): void {
  const player = (name: string, elo: string | null) => (elo ? `${name} (${elo})` : name);
  const pieces = [`${player(headers.white, headers.whiteElo)} – ${player(headers.black, headers.blackElo)}`, headers.result, headers.date].filter(Boolean);
  parts.title.textContent = pieces.join(' · ');
}

export function setPressed(button: HTMLButtonElement, on: boolean): void {
  button.setAttribute('aria-pressed', String(on));
}
