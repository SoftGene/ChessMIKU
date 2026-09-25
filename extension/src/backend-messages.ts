import type { MoveEvaluation } from './analysis';

/** Panel → service worker: send the evaluated game to the server. The answer is an AnalyseAnswer. */
export const ANALYSE = 'chess-review/analyse';

/** Panel → service worker: how are the explanations of this analysis? The answer is an ExplanationsAnswer. */
export const EXPLANATIONS = 'chess-review/explanations';

/** The languages of the explanations (contracts/api.yaml, Language). */
export type Language = 'ru' | 'cs' | 'en';
export const LANGUAGES: readonly Language[] = ['ru', 'cs', 'en'];

export interface MoveClassification {
  ply: number;
  classification: string;
}

export interface Explanation {
  ply: number;
  text: string;
}

export interface AnalyseMessage {
  type: typeof ANALYSE;
  externalGameId: string;
  pgn: string;
  language: Language;
  moves: MoveEvaluation[];
}

export interface ExplanationsMessage {
  type: typeof EXPLANATIONS;
  analysisId: string;
}

/** Why the server gave nothing to show; the same for both messages. */
export type Failure =
  | { status: 'unreachable' }
  | { status: 'quota'; retryAfterSeconds: number }
  | { status: 'busy'; retryAfterSeconds: number }
  | { status: 'rejected'; detail: string };

export interface Accepted {
  status: 'accepted';
  analysisId: string;
  classifications: MoveClassification[];
  explanationsReady: boolean;
}

export interface Explanations {
  status: 'explanations';
  state: 'pending' | 'ready' | 'failed';
  classifications: MoveClassification[];
  explanations: Explanation[];
}

export type AnalyseAnswer = Accepted | Failure;
export type ExplanationsAnswer = Explanations | Failure;

// As in contracts/api.yaml: ExternalGameId, the limits of CreateAnalysisRequest, AnalysisId.
const GAME_ID = /^(live|daily)\/[0-9]{1,20}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isLanguage = (value: unknown): value is Language => LANGUAGES.includes(value as Language);

// Only the extension's own panel sends these, but the service worker checks the form anyway.
export function isAnalyseMessage(message: unknown): message is AnalyseMessage {
  const { type, externalGameId, pgn, language, moves } = (message ?? {}) as Partial<Record<keyof AnalyseMessage, unknown>>;
  return type === ANALYSE
    && typeof externalGameId === 'string' && GAME_ID.test(externalGameId)
    && typeof pgn === 'string' && pgn.length >= 1 && pgn.length <= 65536
    && isLanguage(language)
    && Array.isArray(moves) && moves.length >= 1 && moves.length <= 1000
    && moves.every((move) => typeof move === 'object' && move !== null && Number.isInteger((move as { ply?: unknown }).ply));
}

export function isExplanationsMessage(message: unknown): message is ExplanationsMessage {
  const { type, analysisId } = (message ?? {}) as Partial<Record<keyof ExplanationsMessage, unknown>>;
  return type === EXPLANATIONS && typeof analysisId === 'string' && UUID.test(analysisId);
}
