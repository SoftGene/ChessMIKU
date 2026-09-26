import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { apiBase, withApiHost } from './src/api-address';

// The policy Chrome gives the extension's pages and workers: the manifest's, or else Chrome's default,
// which has no WebAssembly (developer.chrome.com/docs/extensions/reference/manifest/content-security-policy).
const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, 'public/manifest.json'), 'utf8'));
const EXTENSION_PAGES_POLICY: string = manifest.content_security_policy?.extension_pages ?? "script-src 'self'; object-src 'self';";

// The backend the extension asks: CHESS_REVIEW_API=https://… npm run build, or the local one.
const API = apiBase(process.env.CHESS_REVIEW_API);

// public/manifest.json lets the extension reach the local backend; the built one, the backend of the build.
function manifestForApi(): Plugin {
  let outDir = '';
  return {
    name: 'manifest-for-api',
    configResolved: (config) => {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle: () => {
      const file = resolve(outDir, 'manifest.json');
      writeFileSync(file, `${JSON.stringify(withApiHost(JSON.parse(readFileSync(file, 'utf8')), API), null, 2)}
`);
    },
  };
}

// Two builds, because Chrome loads the scripts differently:
// - background (--mode background): the service worker, an ES module (manifest "type": "module"),
//   and the panel page with its module script; public/ (manifest, engine) is copied as is;
// - content (--mode content): a classic script with everything inlined. Content scripts cannot
//   import, so a chunk shared with the service worker would stop them on their first line.
// - bench (npm run bench): a dev server for bench/*.html. It sends the policy of the extension's
//   pages, so the engine runs under the same rules as in the panel.
export default defineConfig(({ mode }) => ({
  define: { __CHESS_REVIEW_API__: JSON.stringify(API) },
  ...(mode === 'bench'
    ? {
        server: {
          headers: { 'Content-Security-Policy': EXTENSION_PAGES_POLICY },
          // The panel harness reaches the local backend (docker compose) through this server: same origin, no CORS.
          proxy: { '/api': 'http://127.0.0.1:8080' },
        },
      }
    : mode === 'content'
    ? {
        publicDir: false,
        build: {
          outDir: 'dist',
          emptyOutDir: false,
          lib: {
            entry: resolve(import.meta.dirname, 'src/content.ts'),
            formats: ['iife'],
            name: 'chessReviewContent',
            fileName: () => 'content.js',
          },
        },
      }
    : {
        plugins: [manifestForApi()],
        build: {
          outDir: 'dist',
          emptyOutDir: true,
          // Chrome preloads modules itself; Vite's polyfill for other browsers would put a fetch in the panel.
          modulePreload: { polyfill: false },
          rolldownOptions: {
            input: {
              background: resolve(import.meta.dirname, 'src/background.ts'),
              panel: resolve(import.meta.dirname, 'panel.html'),
            },
            output: { entryFileNames: '[name].js' },
          },
        },
      }),
}));
