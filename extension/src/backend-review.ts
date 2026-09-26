import type { MoveEvaluation } from './analysis';
import {
  ANALYSE,
  EXPLANATIONS,
  type AnalyseAnswer,
  type AnalyseMessage,
  type Explanation,
  type ExplanationsAnswer,
  type ExplanationsMessage,
  type Failure,
  type Language,
  type MoveClassification,
} from './backend-messages';
import { pollDelay } from './poll-schedule';

/** What the card under the moves shows. */
export type CardState =
  | { kind: 'waiting-engine' }
  | { kind: 'no-engine' }
  | { kind: 'asking' }
  | { kind: 'writing'; waitedSeconds: number }
  | { kind: 'ready'; explanations: Explanation[] }
  | { kind: 'unreachable' }
  | { kind: 'quota'; retryAfterSeconds: number }
  | { kind: 'busy'; retryAfterSeconds: number }
  | { kind: 'rejected' }
  | { kind: 'failed' }
  | { kind: 'timeout' };

export interface BackendDeps {
  analyse(message: AnalyseMessage): Promise<AnalyseAnswer>;
  explanations(message: ExplanationsMessage): Promise<ExplanationsAnswer>;
  wait(ms: number): Promise<void>;
  now(): number;
}

export interface BackendView {
  classes(list: MoveClassification[]): void;
  card(state: CardState): void;
}

export interface GameToSend {
  externalGameId: string;
  pgn: string;
  moves: MoveEvaluation[];
}

// A short "too many requests" is waited out once; a longer one is told.
const WAIT_OUT_BUSY_UP_TO_S = 10;

/**
 * Sends the evaluated game to the server, shows the classes it returns and asks for the explanations until
 * they are ready, fail, or take too long. A new language sends the game again; answers for the old one are dropped.
 */
export function createBackendReview(deps: BackendDeps, view: BackendView, language: Language) {
  let game: GameToSend | null = null;
  let run = 0;

  async function send(): Promise<void> {
    if (!game) {
      return;
    }
    const mine = ++run;
    const stale = () => mine !== run;

    view.card({ kind: 'asking' });
    const message: AnalyseMessage = { type: ANALYSE, ...game, language };
    let answer = await deps.analyse(message);
    if (!stale() && answer.status === 'busy' && answer.retryAfterSeconds <= WAIT_OUT_BUSY_UP_TO_S) {
      await deps.wait(answer.retryAfterSeconds * 1000);
      if (!stale()) {
        answer = await deps.analyse(message);
      }
    }
    if (stale()) {
      return;
    }
    if (answer.status !== 'accepted') {
      view.card(failureCard(answer));
      return;
    }

    view.classes(answer.classifications);
    view.card({ kind: 'writing', waitedSeconds: 0 });
    const sentAt = deps.now();
    let delay = answer.explanationsReady ? 0 : (pollDelay(0) ?? 0);
    for (;;) {
      await deps.wait(delay);
      if (stale()) {
        return;
      }
      const result = await deps.explanations({ type: EXPLANATIONS, analysisId: answer.analysisId });
      if (stale()) {
        return;
      }
      if (result.status === 'explanations' && result.state === 'ready') {
        view.card({ kind: 'ready', explanations: result.explanations });
        return;
      }
      if (result.status === 'explanations' && result.state === 'failed') {
        view.card({ kind: 'failed' });
        return;
      }
      // Pending, or the server away for a moment: say how long it has been, and ask again later, not sooner
      // than a busy server asks. The model is sometimes overloaded, and the server then tries for minutes.
      view.card({ kind: 'writing', waitedSeconds: Math.round((deps.now() - sentAt) / 1000) });
      const next = pollDelay(deps.now() - sentAt);
      if (next === null) {
        view.card({ kind: 'timeout' });
        return;
      }
      delay = result.status === 'busy' ? Math.max(next, result.retryAfterSeconds * 1000) : next;
    }
  }

  return {
    start(toSend: GameToSend): Promise<void> {
      game = toSend;
      return send();
    },
    setLanguage(next: Language): Promise<void> {
      if (next === language) {
        return Promise.resolve();
      }
      language = next;
      return send();
    },
  };
}

function failureCard(failure: Failure): CardState {
  switch (failure.status) {
    case 'unreachable':
      return { kind: 'unreachable' };
    case 'quota':
      return { kind: 'quota', retryAfterSeconds: failure.retryAfterSeconds };
    case 'busy':
      return { kind: 'busy', retryAfterSeconds: failure.retryAfterSeconds };
    case 'rejected':
      console.warn('ChessMIKU: the server rejected the game:', failure.detail);
      return { kind: 'rejected' };
  }
}
