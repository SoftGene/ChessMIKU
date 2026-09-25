// Runs the real panel (src/panel.ts) outside the extension: the real worker, engine and view, and the real
// service worker code for the server (src/backend-service.ts) against the local backend, through the /api proxy
// of the bench server. Only chrome.* is replaced. Run: docker compose up, npm run bench, then open
// /bench/panel-harness.html?type=live&id=173765478164&players=Hikaru%2Cpoohineedyou
// &engine=missing: the engine cannot start; &classes=sample: sample icons; &backend=off: the server is away;
// &fresh=1: forget the saved evaluations (the installation id stays).
import archive from '../test/fixtures/archive-hikaru-2026-08.json';
import { isAnalyseMessage, isExplanationsMessage } from '../src/backend-messages';
import { serveBackend, type BackendDeps } from '../src/backend-service';
import { FIND_FINISHED_GAME } from '../src/messages';

const query = new URLSearchParams(location.search);
const game = archive.games.find((g) => g.url.endsWith(`/${query.get('id')}`));

// chrome.storage.local, kept in this page's localStorage: a reload finds the saved evaluations and the installation.
const KEY = 'harness.storage';
const all = (): Record<string, unknown> => JSON.parse(localStorage.getItem(KEY) ?? '{}');
const local = {
  async get(keys: string | null) {
    const items = all();
    return keys === null ? items : keys in items ? { [keys]: items[keys] } : {};
  },
  async set(items: Record<string, unknown>) {
    localStorage.setItem(KEY, JSON.stringify({ ...all(), ...items }));
  },
  async remove(keys: string | string[]) {
    const items = all();
    for (const key of [keys].flat()) {
      delete items[key];
    }
    localStorage.setItem(KEY, JSON.stringify(items));
  },
};
if (query.get('fresh') === '1') {
  await local.remove(Object.keys(all()).filter((key) => key.startsWith('evals:')));
}

const backend: BackendDeps = {
  http: { fetch: (input, init) => fetch(input, init), base: '' },
  store: { get: async (key) => (await local.get(key))[key], set: (key, value) => local.set({ [key]: value }) },
};

async function sendMessage(message: unknown): Promise<unknown> {
  const away = query.get('backend') === 'off';
  if (isAnalyseMessage(message)) {
    return away ? { status: 'unreachable' } : serveBackend(message, backend);
  }
  if (isExplanationsMessage(message)) {
    return away ? { status: 'unreachable' } : serveBackend(message, backend);
  }
  if ((message as { type?: unknown }).type === FIND_FINISHED_GAME) {
    return game ? { status: 'finished', pgn: game.pgn } : { status: 'not-found' };
  }
  return undefined;
}

Object.assign(globalThis, { chrome: { runtime: { sendMessage }, storage: { local } } });

// The panel starts its worker from "engine/…" next to panel.html. Move the address to where the
// dev server has public/engine, or, for &engine=missing, to where it has nothing.
history.replaceState(null, '', `${query.get('engine') === 'missing' ? '/missing/' : '/'}panel.html${location.search}`);

const panel = await import('../src/panel');
if (query.get('classes') === 'sample') {
  // A sample to see the icons drawn, not classes of this game: the backend gives the real ones.
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
