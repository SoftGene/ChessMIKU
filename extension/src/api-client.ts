import type { MoveEvaluation } from './analysis';
import type { Accepted, Explanation, Explanations, Failure, Language, MoveClassification } from './backend-messages';

declare const __CHESS_REVIEW_API__: string;

/** The backend (contracts/api.yaml, servers): the one the build was made for, see api-address.ts. */
export const API_BASE = __CHESS_REVIEW_API__;

// A server that takes the connection and never answers must not hold the review forever.
const TIMEOUT_MS = 15_000;
// The contract sends Retry-After with every 429; without it, wait a minute.
const DEFAULT_RETRY_AFTER_S = 60;

export interface Http {
  fetch: typeof fetch;
  base: string;
}

export interface AnalysisRequest {
  externalGameId: string;
  pgn: string;
  language: Language;
  moves: MoveEvaluation[];
}

/** The server did not issue this installation id, or no longer knows it: register again. */
export type UnknownInstall = { status: 'unknown-install' };
export type Registered = { status: 'registered'; installId: string };

type Body = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /api/installs. */
export async function registerInstall(http: Http): Promise<Registered | Failure> {
  const response = await send(http, '/api/installs', { method: 'POST' });
  if (response?.status === 201) {
    const { installId } = await readBody(response);
    return isUuid(installId) ? { status: 'registered', installId } : { status: 'unreachable' };
  }
  const failed = await failure(response);
  // Registration has no 401 in the contract.
  return failed.status === 'unknown-install' ? { status: 'unreachable' } : failed;
}

/** POST /api/analyses: the classes now, the explanations later. */
export async function createAnalysis(http: Http, installId: string, request: AnalysisRequest): Promise<Accepted | Failure | UnknownInstall> {
  const response = await send(http, '/api/analyses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Install-Id': installId },
    body: JSON.stringify(request),
  });
  if (response?.status === 200 || response?.status === 202) {
    const { analysisId, classifications, explanationsStatus } = await readBody(response);
    return isUuid(analysisId) && isClassifications(classifications) && (explanationsStatus === 'ready' || explanationsStatus === 'pending')
      ? { status: 'accepted', analysisId, classifications, explanationsReady: explanationsStatus === 'ready' }
      : { status: 'unreachable' };
  }
  return failure(response);
}

/** GET /api/analyses/{analysisId}. */
export async function getAnalysis(http: Http, installId: string, analysisId: string): Promise<Explanations | Failure | UnknownInstall> {
  const response = await send(http, `/api/analyses/${encodeURIComponent(analysisId)}`, { headers: { 'X-Install-Id': installId } });
  if (response?.status === 200) {
    const { status, classifications, explanations } = await readBody(response);
    return (status === 'pending' || status === 'ready' || status === 'failed') && isClassifications(classifications) && isExplanations(explanations)
      ? { status: 'explanations', state: status, classifications, explanations }
      : { status: 'unreachable' };
  }
  return failure(response);
}

// The response, or null when there is none: no network, no server, or no answer in time.
async function send(http: Http, path: string, init: RequestInit): Promise<Response | null> {
  try {
    return await http.fetch(`${http.base}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return null;
  }
}

async function failure(response: Response | null): Promise<Failure | UnknownInstall> {
  switch (response?.status) {
    case 401:
      return { status: 'unknown-install' };
    case 400:
      return { status: 'rejected', detail: (await response.text().catch(() => '')).slice(0, 1000) };
    case 429: {
      const { code } = await readBody(response);
      const retryAfterSeconds = retryAfter(response.headers.get('Retry-After'));
      return code === 'daily_quota_exceeded' ? { status: 'quota', retryAfterSeconds } : { status: 'busy', retryAfterSeconds };
    }
    default:
      return { status: 'unreachable' };
  }
}

async function readBody(response: Response): Promise<Body> {
  try {
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null ? (body as Body) : {};
  } catch {
    return {};
  }
}

function retryAfter(header: string | null): number {
  const seconds = Number(header ?? NaN);
  return Number.isInteger(seconds) && seconds >= 1 ? seconds : DEFAULT_RETRY_AFTER_S;
}

const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

const isClassifications = (value: unknown): value is MoveClassification[] =>
  Array.isArray(value)
  && value.every((c) => typeof c === 'object' && c !== null && Number.isInteger(c.ply) && c.ply >= 1 && typeof c.classification === 'string');

const isExplanations = (value: unknown): value is Explanation[] =>
  Array.isArray(value)
  && value.length <= 3
  && value.every((e) => typeof e === 'object' && e !== null && Number.isInteger(e.ply) && e.ply >= 1 && typeof e.text === 'string');
