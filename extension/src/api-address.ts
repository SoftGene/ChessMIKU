/** The backend of docker compose on this computer: what the extension asks unless the build names another. */
export const LOCAL_API = 'http://127.0.0.1:8080';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * The backend the extension is built for, from CHESS_REVIEW_API at build time (`npm run build`).
 * Only an origin: the client adds /api/... itself.
 */
export function apiBase(raw: string | undefined): string {
  if (!raw) {
    return LOCAL_API;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`CHESS_REVIEW_API is not an address: ${raw}`);
  }

  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))) {
    throw new Error(`CHESS_REVIEW_API must be https:// unless the backend is on this computer: ${raw}`);
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`CHESS_REVIEW_API must be an origin, such as https://review.example.org: ${raw}`);
  }

  return url.origin;
}

/** The manifest that lets the extension reach `base` in place of the local backend. */
export function withApiHost<T extends { host_permissions: string[] }>(manifest: T, base: string): T {
  return {
    ...manifest,
    host_permissions: manifest.host_permissions.map((host) => (host === `${LOCAL_API}/*` ? `${base}/*` : host)),
  };
}
