import { fetchJson, findFinishedGame, type Lookup } from './archive';
import { isFindFinishedGame } from './messages';

// The only part of the extension that goes to the network.
chrome.runtime.onMessage.addListener((message, sender, sendResponse: (answer: Lookup) => void) => {
  // Only content scripts of this extension ask, and only in the agreed form.
  if (sender.id !== chrome.runtime.id || !isFindFinishedGame(message)) {
    return false;
  }

  findFinishedGame(message.page, new Date(), fetchJson).then(sendResponse, () => sendResponse({ status: 'not-found' }));
  return true; // The answer comes later.
});
