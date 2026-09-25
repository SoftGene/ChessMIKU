import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { parse } from 'yaml';
import { describe, expect, it, vi } from 'vitest';
import { analyseGame } from './analysis';
import { createAnalysis, getAnalysis, registerInstall, type AnalysisRequest, type Http } from './api-client';
import { readGame } from './game';

// The contract, as the backend implements it: its schemas check our request, its examples are the answers.
const contract = parse(readFileSync(join(import.meta.dirname, '../../contracts/api.yaml'), 'utf8'));
const ajv = new Ajv2020({ strict: false, validateFormats: false });
ajv.addSchema({ $id: 'api', components: contract.components });
const validRequest = ajv.getSchema('api#/components/schemas/CreateAnalysisRequest')!;

type Media = { example?: unknown; examples?: Record<string, { value: unknown }> };
function media(path: string, method: 'get' | 'post', status: string): Media {
  let response = contract.paths[path][method].responses[status];
  if (response.$ref) {
    response = contract.components.responses[response.$ref.split('/').at(-1)];
  }
  return Object.values(response.content)[0] as Media;
}

const INSTALL = '9b1e4c2a-7f3d-4a58-b6e0-2c8d5f1a9e73';
const ANALYSIS = '3f2b8c1e-5d4a-4e7b-9c61-0a8d2f4b7e19';
const FOOLS_MATE = '[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1';
const CLASSES = (media('/api/analyses', 'post', '202').example as { classifications: unknown }).classifications;

// A server that answers every request with one response.
function server(status: number, body?: unknown, headers: Record<string, string> = {}) {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers }));
  const http: Http = { fetch: fetch as unknown as typeof globalThis.fetch, base: 'http://127.0.0.1:8080' };
  return { http, fetch };
}

async function request(): Promise<AnalysisRequest> {
  const moves = await analyseGame(readGame(FOOLS_MATE), async () => ({ bestMoveUci: 'e2e4', score: { cp: 10 } }));
  return { externalGameId: 'live/173765478164', pgn: FOOLS_MATE, language: 'ru', moves };
}

describe('the request', () => {
  it('matches CreateAnalysisRequest of the contract, with the installation id', async () => {
    const { http, fetch } = server(202, media('/api/analyses', 'post', '202').example);

    await createAnalysis(http, INSTALL, await request());

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8080/api/analyses');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('X-Install-Id')).toBe(INSTALL);
    const body = JSON.parse(String(init?.body));
    expect(validRequest(body), JSON.stringify(validRequest.errors)).toBe(true);
    expect(body.moves.at(-1)).toMatchObject({ ply: 4, san: 'Qh4#', mateAfter: 0 });
  });

  it('is checked by the schema for real: a language outside the contract fails it', async () => {
    expect(validRequest({ ...(await request()), language: 'de' })).toBe(false);
  });

  it('asks for an analysis by its id, with the installation id', async () => {
    const { http, fetch } = server(200, media('/api/analyses/{analysisId}', 'get', '200').examples!.ready.value);

    await getAnalysis(http, INSTALL, ANALYSIS);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`http://127.0.0.1:8080/api/analyses/${ANALYSIS}`);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(new Headers(init?.headers).get('X-Install-Id')).toBe(INSTALL);
  });

  it('gives each request a time limit', async () => {
    const { http, fetch } = server(201, media('/api/installs', 'post', '201').example);

    await registerInstall(http);

    expect(fetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('the answers of the contract', () => {
  it('registers an installation (201)', async () => {
    const { http, fetch } = server(201, media('/api/installs', 'post', '201').example);

    expect(await registerInstall(http)).toEqual({ status: 'registered', installId: INSTALL });
    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:8080/api/installs');
    expect(fetch.mock.calls[0][1]?.method).toBe('POST');
  });

  it('takes the classes while the explanations are written (202)', async () => {
    const { http } = server(202, media('/api/analyses', 'post', '202').example);

    expect(await createAnalysis(http, INSTALL, await request())).toEqual({ status: 'accepted', analysisId: ANALYSIS, classifications: CLASSES, explanationsReady: false });
  });

  it('takes the classes with the explanations ready (200)', async () => {
    const { http } = server(200, media('/api/analyses', 'post', '200').example);

    expect(await createAnalysis(http, INSTALL, await request())).toEqual({ status: 'accepted', analysisId: ANALYSIS, classifications: CLASSES, explanationsReady: true });
  });

  it.each(['pending', 'ready', 'failed'] as const)('reads the explanations when they are %s', async (state) => {
    const example = media('/api/analyses/{analysisId}', 'get', '200').examples![state].value as { explanations: unknown };
    const { http } = server(200, example);

    expect(await getAnalysis(http, INSTALL, ANALYSIS)).toEqual({ status: 'explanations', state, classifications: CLASSES, explanations: example.explanations });
  });

  it('says the daily quota is used up, and until when', async () => {
    const { http } = server(429, media('/api/analyses', 'post', '429').examples!.dailyQuota.value, { 'Retry-After': '3600' });

    expect(await createAnalysis(http, INSTALL, await request())).toEqual({ status: 'quota', retryAfterSeconds: 3600 });
  });

  it('says the server is busy, and for how long', async () => {
    const { http } = server(429, media('/api/analyses', 'post', '429').examples!.rateLimited.value, { 'Retry-After': '7' });

    expect(await getAnalysis(http, INSTALL, ANALYSIS)).toEqual({ status: 'busy', retryAfterSeconds: 7 });
  });

  it('asks to register again when the server does not know the installation (401)', async () => {
    const { http } = server(401, media('/api/analyses', 'post', '401').example);

    expect(await createAnalysis(http, INSTALL, await request())).toEqual({ status: 'unknown-install' });
  });

  it("says the game was rejected, with the server's words (400)", async () => {
    const { http } = server(400, media('/api/analyses', 'post', '400').example);

    const answer = await createAnalysis(http, INSTALL, await request());

    expect(answer).toMatchObject({ status: 'rejected', detail: expect.stringContaining('The game is not finished.') });
  });
});

describe('answers outside the contract', () => {
  it('takes no server for an unreachable one', async () => {
    const http: Http = { fetch: vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch, base: '' };

    expect(await registerInstall(http)).toEqual({ status: 'unreachable' });
    expect(await createAnalysis(http, INSTALL, await request())).toEqual({ status: 'unreachable' });
    expect(await getAnalysis(http, INSTALL, ANALYSIS)).toEqual({ status: 'unreachable' });
  });

  it.each([500, 503, 404])('takes %i for an unreachable server', async (status) => {
    expect(await getAnalysis(server(status).http, INSTALL, ANALYSIS)).toEqual({ status: 'unreachable' });
  });

  it('takes an answer of another shape for an unreachable server', async () => {
    expect(await createAnalysis(server(202, { analysisId: 'x', classifications: [] }).http, INSTALL, await request())).toEqual({ status: 'unreachable' });
    expect(await getAnalysis(server(200, { status: 'done', classifications: [], explanations: [] }).http, INSTALL, ANALYSIS)).toEqual({ status: 'unreachable' });
    expect(await registerInstall(server(201, { installId: 42 }).http)).toEqual({ status: 'unreachable' });
  });

  it('waits a minute when a 429 does not say how long', async () => {
    expect(await createAnalysis(server(429, { code: 'rate_limited' }).http, INSTALL, await request())).toEqual({ status: 'busy', retryAfterSeconds: 60 });
  });
});
