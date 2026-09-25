// Runs the real panel (src/panel.ts) outside the extension: the real worker, engine and view, with
// only chrome.runtime replaced by an answer from the archive fixture. Run: npm run bench, then open
// /bench/panel-harness.html?type=live&id=173765478164&players=Hikaru%2Cpoohineedyou
// Add &engine=missing to see the window when the engine cannot start, &classes=sample to see the icons.
import archive from '../test/fixtures/archive-hikaru-2026-08.json';

const query = new URLSearchParams(location.search);
const game = archive.games.find((g) => g.url.endsWith(`/${query.get('id')}`));

Object.assign(globalThis, {
  chrome: { runtime: { sendMessage: async () => (game ? { status: 'finished', pgn: game.pgn } : { status: 'not-found' }) } },
});

// The panel starts its worker from "engine/…" next to panel.html. Move the address to where the
// dev server has public/engine, or, for &engine=missing, to where it has nothing.
history.replaceState(null, '', `${query.get('engine') === 'missing' ? '/missing/' : '/'}panel.html${location.search}`);

const panel = await import('../src/panel');
if (query.get('classes') === 'sample') {
  // A sample to see the icons drawn, not classes of this game: the backend gives the real ones (T7.3).
  panel.showClassifications([
    { ply: 1, classification: 'book' },
    { ply: 2, classification: 'best' },
    { ply: 3, classification: 'inaccuracy' },
    { ply: 4, classification: 'excellent' },
    { ply: 5, classification: 'mistake' },
    { ply: 6, classification: 'good' },
    { ply: 7, classification: 'blunder' },
    { ply: 8, classification: 'miss' },
  ]);
}
