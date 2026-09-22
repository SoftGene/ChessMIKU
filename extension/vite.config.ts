import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Two builds, because Chrome loads the two scripts differently:
// - background (--mode background): the service worker, an ES module (manifest "type": "module");
// - content (--mode content): a classic script with everything inlined. Content scripts cannot
//   import, so a chunk shared with the service worker would stop them on their first line.
export default defineConfig(({ mode }) =>
  mode === 'content'
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
          rolldownOptions: {
            input: { background: resolve(import.meta.dirname, 'src/background.ts') },
            output: { entryFileNames: '[name].js' },
          },
        },
      },
);
