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
    expect(await read(await panelScript())).not.toMatch(network);
  });

  it('has every file the manifest names', async () => {
    const manifest = JSON.parse(await read('manifest.json'));
    const files: string[] = [
      manifest.background.service_worker,
      ...manifest.content_scripts.flatMap((script: { js: string[] }) => script.js),
      ...manifest.web_accessible_resources.flatMap((entry: { resources: string[] }) => entry.resources),
    ];

    expect(files).toEqual(['background.js', 'content.js', 'panel.html']);
    for (const file of files) {
      expect((await read(file)).length).toBeGreaterThan(0);
    }
  });

  it('has the panel page and the module script it loads', async () => {
    const script = await panelScript();

    expect(await read(script)).toMatch(/Analysing position/);
  });

  it('ships the engine the panel starts, with its license', async () => {
    const wasm = await readFile(join(dist, 'engine/stockfish-19-lite-single.wasm'));

    expect(await read('engine/stockfish-19-lite-single.js')).toMatch(/Stockfish\.js 19/);
    expect([...wasm.subarray(0, 4)]).toEqual([0x00, 0x61, 0x73, 0x6d]); // "\0asm"
    expect(await read('engine/Copying.txt')).toMatch(/GNU GENERAL PUBLIC LICENSE\s+Version 3/);
    expect(await read(await panelScript())).toContain('engine/stockfish-19-lite-single.js');
  });
});

// The script panel.html loads, as a path inside the built extension.
async function panelScript(): Promise<string> {
  const html = await read('panel.html');
  const src = /<script type="module"[^>]*\ssrc="\/?([^"]+)"/.exec(html)?.[1];
  expect(src, 'panel.html loads no module script').toBeDefined();
  return src!;
}
