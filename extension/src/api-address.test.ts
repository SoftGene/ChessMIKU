import { describe, expect, it } from 'vitest';
import { LOCAL_API, apiBase, withApiHost } from './api-address';

describe('apiBase', () => {
  it('is the local backend when the build names none', () => {
    expect(apiBase(undefined)).toBe('http://127.0.0.1:8080');
    expect(apiBase('')).toBe('http://127.0.0.1:8080');
    expect(LOCAL_API).toBe('http://127.0.0.1:8080');
  });

  it('is the origin of the address the build names, without the trailing slash', () => {
    expect(apiBase('https://review.example.org')).toBe('https://review.example.org');
    expect(apiBase('https://review.example.org/')).toBe('https://review.example.org');
    expect(apiBase('http://localhost:5080')).toBe('http://localhost:5080');
  });

  it('refuses plain HTTP to another computer: the install id would cross the network in the clear', () => {
    expect(() => apiBase('http://review.example.org')).toThrow('CHESS_REVIEW_API must be https://');
  });

  it('refuses a path: the client adds /api/... to the origin', () => {
    expect(() => apiBase('https://review.example.org/chess')).toThrow('CHESS_REVIEW_API must be an origin');
  });

  it('refuses what is not an address', () => {
    expect(() => apiBase('review.example.org')).toThrow('CHESS_REVIEW_API is not an address');
  });
});

describe('withApiHost', () => {
  const manifest = { name: 'Chess Review', host_permissions: ['https://api.chess.com/*', 'http://127.0.0.1:8080/*'] };

  it('lets the extension reach the backend it was built for instead of the local one', () => {
    expect(withApiHost(manifest, 'https://review.example.org')).toEqual({
      name: 'Chess Review',
      host_permissions: ['https://api.chess.com/*', 'https://review.example.org/*'],
    });
  });

  it('leaves the manifest as it is for the local backend', () => {
    expect(withApiHost(manifest, LOCAL_API)).toEqual(manifest);
  });
});
