import { createAnalysis, getAnalysis, registerInstall, type Http } from './api-client';
import { ANALYSE, type AnalyseAnswer, type AnalyseMessage, type ExplanationsAnswer, type ExplanationsMessage } from './backend-messages';
import { withInstall, type KeyValueStore } from './install-id';

export interface BackendDeps {
  http: Http;
  store: KeyValueStore;
}

/** The service worker's answer to the panel: the server's answer, under this installation's id. */
export function serveBackend(message: AnalyseMessage, deps: BackendDeps): Promise<AnalyseAnswer>;
export function serveBackend(message: ExplanationsMessage, deps: BackendDeps): Promise<ExplanationsAnswer>;
export function serveBackend(message: AnalyseMessage | ExplanationsMessage, { http, store }: BackendDeps): Promise<AnalyseAnswer | ExplanationsAnswer> {
  const register = () => registerInstall(http);
  if (message.type === ANALYSE) {
    // The contract takes exactly these fields: not the message type.
    const { externalGameId, pgn, language, moves } = message;
    return withInstall(store, register, (installId) => createAnalysis(http, installId, { externalGameId, pgn, language, moves }));
  }
  return withInstall(store, register, (installId) => getAnalysis(http, installId, message.analysisId));
}
