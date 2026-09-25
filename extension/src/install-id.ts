import type { Registered, UnknownInstall } from './api-client';
import type { Accepted, Explanations, Failure } from './backend-messages';

/** Where the service worker keeps the installation id: chrome.storage.local, or a fake in tests. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

const KEY = 'installId';

/**
 * Calls the server with this installation's id. Registers when there is no id yet, and once more when
 * the server does not know the stored one (its database was made anew); the second time it gives up.
 */
export async function withInstall<A extends Accepted | Explanations | Failure>(
  store: KeyValueStore,
  register: () => Promise<Registered | Failure>,
  call: (installId: string) => Promise<A | UnknownInstall>,
): Promise<A | Failure> {
  let installId = await storedId(store);
  for (let attempt = 1; ; attempt++) {
    if (installId === null) {
      const registered = await register();
      if (registered.status !== 'registered') {
        return registered;
      }
      installId = registered.installId;
      await store.set(KEY, installId);
    }
    const answer = await call(installId);
    if (answer.status !== 'unknown-install') {
      return answer as A;
    }
    if (attempt === 2) {
      return { status: 'unreachable' };
    }
    installId = null;
  }
}

async function storedId(store: KeyValueStore): Promise<string | null> {
  const value = await store.get(KEY);
  return typeof value === 'string' && value.length > 0 ? value : null;
}
