import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Two builds, because Chrome loads the scripts differently:
// - background (--mode background): the service worker, an ES module (manifest "type": "module"),
//   and the panel page with its module script; public/ (manifest, engine) is copied as is;
// - content (--mode content): a classic script with everything inlined. Content scripts cannot
//   import, so a chunk shared with the service worker would stop them on their first line.
// - bench (npm run bench): a dev server for bench/engine-bench.html. It sends the default policy
//   of extension pages, so the engine runs under the same rules as in the panel.
export default defineConfig(({ mode }) =>
  mode === 'bench'
    ? { server: { headers: { 'Content-Security-Policy': "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'" } } }
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
      },
);
