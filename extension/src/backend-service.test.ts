import { describe, expect, it, vi } from 'vitest';
import { ANALYSE, EXPLANATIONS, type AnalyseMessage } from './backend-messages';
import { serveBackend } from './backend-service';
import type { KeyValueStore } from './install-id';

const INSTALL = '9b1e4c2a-7f3d-4a58-b6e0-2c8d5f1a9e73';
const ANALYSIS = '3f2b8c1e-5d4a-4e7b-9c61-0a8d2f4b7e19';
const move = { ply: 1, san: 'e4', uci: 'e2e4', bestMoveUci: 'e2e4', evalBeforeCp: 30, mateBefore: null, evalAfterCp: 30, mateAfter: null, secondBestEvalCp: 25, secondBestMate: null };
const analyse: AnalyseMessage = { type: ANALYSE, externalGameId: 'live/1', pgn: '1. e4 1-0', language: 'cs', moves: [move] };

// A backend that registers installations and accepts analyses, as the contract says.
function backend() {
  const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    if (url.endsWith('/api/installs')) return json(201, { installId: INSTALL });
    if (url.endsWith('/api/analyses')) return json(202, { analysisId: ANALYSIS, classifications: [{ ply: 1, classification: 'book' }], explanationsStatus: 'pending' });
    return json(200, { status: 'ready', classifications: [{ ply: 1, classification: 'book' }], explanations: [{ ply: 1, text: 'Why.' }] });
  });
  const data: Record<string, unknown> = {};
  const store: KeyValueStore = { get: async (key) => data[key], set: async (key, value) => void (data[key] = value) };
  return { fetch, data, deps: { http: { fetch: fetch as unknown as typeof globalThis.fetch, base: 'http://127.0.0.1:8080' }, store } };
}

describe('serveBackend', () => {
  it('registers, then sends the game in the form of the contract, without the message type', async () => {
    const { fetch, data, deps } = backend();

    expect(await serveBackend(analyse, deps)).toEqual({ status: 'accepted', analysisId: ANALYSIS, classifications: [{ ply: 1, classification: 'book' }], explanationsReady: false });

    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['http://127.0.0.1:8080/api/installs', 'http://127.0.0.1:8080/api/analyses']);
    expect(Object.keys(JSON.parse(String(fetch.mock.calls[1][1]?.body)))).toEqual(['externalGameId', 'pgn', 'language', 'moves']);
    expect(data.installId).toBe(INSTALL);
  });

  it('reads the explanations of an analysis', async () => {
    const { fetch, deps } = backend();

    expect(await serveBackend({ type: EXPLANATIONS, analysisId: ANALYSIS }, deps)).toEqual({
      status: 'explanations',
      state: 'ready',
      classifications: [{ ply: 1, classification: 'book' }],
      explanations: [{ ply: 1, text: 'Why.' }],
    });
    expect(fetch.mock.calls.at(-1)?.[0]).toBe(`http://127.0.0.1:8080/api/analyses/${ANALYSIS}`);
  });
});
