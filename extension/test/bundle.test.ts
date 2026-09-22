import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Script } from 'node:vm';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The extension as Chrome loads it, built by the same configuration as `npm run build`.
let dist: string;

const read = (file: string) => readFile(join(dist, file), 'utf8');

beforeAll(async () => {
  dist = await mkdtemp(join(tmpdir(), 'chess-review-dist-'));
  for (const mode of ['background', 'content']) {
    await build({ configFile: resolve(import.meta.dirname, '../vite.config.ts'), mode, logLevel: 'silent', build: { outDir: dist } });
  }
}, 60_000);

afterAll(() => rm(dist, { recursive: true, force: true }));

describe('the built extension', () => {
  it('has a content script Chrome can run: a classic script, not a module', async () => {
    const code = await read('content.js');

    expect(() => new Script(code, { filename: 'content.js' })).not.toThrow();
  });

  it('keeps the network in the service worker', async () => {
    const network = /\bfetch\s*\(|XMLHttpRequest|WebSocket/;

    expect(await read('background.js')).toMatch(network);
    expect(await read('content.js')).not.toMatch(network);
  });

  it('has every file the manifest names', async () => {
    const manifest = JSON.parse(await read('manifest.json'));
    const files: string[] = [manifest.background.service_worker, ...manifest.content_scripts.flatMap((script: { js: string[] }) => script.js)];

    expect(files).toEqual(['background.js', 'content.js']);
    for (const file of files) {
      expect((await read(file)).length).toBeGreaterThan(0);
    }
  });
});
