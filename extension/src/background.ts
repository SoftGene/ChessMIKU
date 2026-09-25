import { API_BASE } from './api-client';
import { fetchJson, findFinishedGame, type Lookup } from './archive';
import { isAnalyseMessage, isExplanationsMessage } from './backend-messages';
import { serveBackend, type BackendDeps } from './backend-service';
import { isFindFinishedGame } from './messages';

// Games found in an archive, by type and number: the panel asks again right after the page did, and a
// search in older archives takes several seconds. Lives as long as the service worker.
const found = new Map<string, string>();

// The installation id lives in the extension's storage, which outlives the service worker.
const backend: BackendDeps = {
  http: { fetch: (input, init) => fetch(input, init), base: API_BASE },
  store: {
    get: async (key) => (await chrome.storage.local.get(key))[key],
    set: (key, value) => chrome.storage.local.set({ [key]: value }),
  },
};

const answer = (work: Promise<unknown>, sendResponse: (answer: unknown) => void) =>
  work.then(sendResponse, () => sendResponse({ status: 'unreachable' }));

// The only part of the extension that goes to the network.
chrome.runtime.onMessage.addListener((message, sender, sendResponse: (answer: unknown) => void) => {
  // Only this extension's content scripts and panel ask, and only in the agreed forms.
  if (sender.id !== chrome.runtime.id) {
    return false;
  }
  if (isAnalyseMessage(message)) {
    answer(serveBackend(message, backend), sendResponse);
    return true;
  }
  if (isExplanationsMessage(message)) {
    answer(serveBackend(message, backend), sendResponse);
    return true;
  }
  if (!isFindFinishedGame(message)) {
    return false;
  }

  const key = `${message.page.type}/${message.page.id}`;
  const pgn = found.get(key);
  if (pgn !== undefined) {
    sendResponse({ status: 'finished', pgn } satisfies Lookup);
    return false;
  }

  findFinishedGame(message.page, new Date(), fetchJson, { deep: message.deep === true }).then(
    (lookup) => {
      if (lookup.status === 'finished') {
        found.set(key, lookup.pgn);
      }
      sendResponse(lookup);
    },
    () => sendResponse({ status: 'not-found' } satisfies Lookup),
  );
  return true; // The answer comes later.
});
