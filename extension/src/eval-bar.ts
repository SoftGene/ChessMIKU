import { evalText, whiteShare, type WhiteEval } from './eval-display';
import type { Orientation } from './page';

/** White's share as the fill of the bar, the evaluation as text; turned over when Black is at the bottom. */
export function renderEvalBar(bar: HTMLElement, value: WhiteEval | undefined, orientation: Orientation): void {
  bar.style.setProperty('--white-share', (value ? whiteShare(value) : 0.5).toFixed(3));
  bar.classList.toggle('flipped', orientation === 'black');
  const text = value ? evalText(value) : '';
  bar.querySelector('.eval-text')!.textContent = text;
  bar.title = text || 'Not evaluated yet';
}
