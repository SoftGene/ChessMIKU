import { describe, expect, it, vi } from 'vitest';
import type { Registered, UnknownInstall } from './api-client';
import type { AnalyseAnswer, Failure } from './backend-messages';
import { withInstall, type KeyValueStore } from './install-id';

function memory(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  const store: KeyValueStore = { get: async (key) => data[key], set: async (key, value) => void (data[key] = value) };
  return { data, store };
}

const accepted: AnalyseAnswer = { status: 'accepted', analysisId: '3f2b8c1e-5d4a-4e7b-9c61-0a8d2f4b7e19', classifications: [], explanationsReady: false };
const unknown: UnknownInstall = { status: 'unknown-install' };
const registering = (...ids: string[]) => vi.fn(async (): Promise<Registered | Failure> => ({ status: 'registered', installId: ids.shift()! }));

describe('withInstall', () => {
  it('registers the first time, keeps the id and calls with it', async () => {
    const { data, store } = memory();
    const register = registering('id-1');
    const call = vi.fn(async (_id: string) => accepted);

    expect(await withInstall(store, register, call)).toEqual(accepted);
    expect(data.installId).toBe('id-1');
    expect(call.mock.calls).toEqual([['id-1']]);
  });

  it('does not register again when it has an id', async () => {
    const { store } = memory({ installId: 'id-0' });
    const register = registering('id-1');
    const call = vi.fn(async (_id: string) => accepted);

    await withInstall(store, register, call);

    expect(register).not.toHaveBeenCalled();
    expect(call.mock.calls).toEqual([['id-0']]);
  });

  it('registers again, once, when the server does not know the id', async () => {
    const { data, store } = memory({ installId: 'old' });
    const register = registering('new');
    const answers = [unknown, accepted];
    const call = vi.fn(async (_id: string) => answers.shift()!);

    expect(await withInstall(store, register, call)).toEqual(accepted);
    expect(call.mock.calls).toEqual([['old'], ['new']]);
    expect(data.installId).toBe('new');
  });

  it('gives up when the server does not know the new id either', async () => {
    const { store } = memory({ installId: 'old' });
    const call = vi.fn(async (_id: string) => unknown);

    expect(await withInstall(store, registering('new'), call)).toEqual({ status: 'unreachable' });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('passes on why registration failed, and keeps no id', async () => {
    const { data, store } = memory();
    const register = vi.fn(async (): Promise<Registered | Failure> => ({ status: 'busy', retryAfterSeconds: 30 }));
    const call = vi.fn(async (_id: string) => accepted);

    expect(await withInstall(store, register, call)).toEqual({ status: 'busy', retryAfterSeconds: 30 });
    expect(data.installId).toBeUndefined();
    expect(call).not.toHaveBeenCalled();
  });

  it('takes a stored value that is not an id for none', async () => {
    const { store } = memory({ installId: 42 });
    const call = vi.fn(async (_id: string) => accepted);

    await withInstall(store, registering('id-1'), call);

    expect(call.mock.calls).toEqual([['id-1']]);
  });
});
