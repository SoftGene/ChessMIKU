import { fetchJson, findFinishedGame, type Lookup } from './archive';
import { isFindFinishedGame } from './messages';

// Games found in an archive, by type and number: the panel asks again right after the page did, and a
// search in older archives takes several seconds. Lives as long as the service worker.
const found = new Map<string, string>();

// The only part of the extension that goes to the network.
chrome.runtime.onMessage.addListener((message, sender, sendResponse: (answer: Lookup) => void) => {
  // Only content scripts of this extension ask, and only in the agreed form.
  if (sender.id !== chrome.runtime.id || !isFindFinishedGame(message)) {
    return false;
  }

  const key = `${message.page.type}/${message.page.id}`;
  const pgn = found.get(key);
  if (pgn !== undefined) {
    sendResponse({ status: 'finished', pgn });
    return false;
  }

  findFinishedGame(message.page, new Date(), fetchJson, { deep: message.deep === true }).then(
    (lookup) => {
      if (lookup.status === 'finished') {
        found.set(key, lookup.pgn);
      }
      sendResponse(lookup);
    },
    () => sendResponse({ status: 'not-found' }),
  );
  return true; // The answer comes later.
});
