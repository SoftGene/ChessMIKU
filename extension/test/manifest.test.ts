import { describe, expect, it } from 'vitest';
import manifest from '../public/manifest.json';

describe('manifest', () => {
  it('runs the content script on game pages in every language of chess.com', () => {
    // English pages have no language in the address; others do: /ru/game/live/…
    expect(manifest.content_scripts).toEqual([
      { matches: ['https://www.chess.com/game/*', 'https://www.chess.com/*/game/*'], js: ['content.js'] },
    ]);
  });

  it('reaches only the chess.com API and the local backend, and keeps its data in its own storage', () => {
    expect(manifest.host_permissions).toEqual(['https://api.chess.com/*', 'http://127.0.0.1:8080/*']);
    expect(manifest.permissions).toEqual(['storage']);
  });

  // Chrome's default policy for extension pages has no WebAssembly: the engine could not compile
  // in the panel and stayed silent. This is the most Chrome allows, and only WebAssembly is added.
  it('lets the panel compile the engine, and nothing more', () => {
    expect(manifest.content_security_policy).toEqual({ extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';" });
  });

  it('lets only chess.com pages embed the panel, and nothing else of the extension', () => {
    expect(manifest.web_accessible_resources).toEqual([{ resources: ['panel.html'], matches: ['https://www.chess.com/*'] }]);
  });

  it('carries no chess.com brand in its name', () => {
    expect(manifest.name).toBe('Chess Review');
  });
});
