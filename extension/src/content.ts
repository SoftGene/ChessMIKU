// Content script to detect a finished game and add the "Review" button
console.log('Chess Review content script loaded');

export function isGameFinished(): boolean {
  // We'll implement actual detection later
  return document.querySelector('.game-over-dialog, .game-result-container') !== null;
}

if (typeof document !== 'undefined') {
  if (isGameFinished()) {
    console.log('Game is finished, adding review button...');
  }
}
