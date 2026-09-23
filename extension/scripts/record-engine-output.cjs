// Records what the engine of the extension prints, for the tests: test/fixtures/engine-output.txt.
// Runs the same files the panel runs (public/engine) in Node. Usage, from extension/:
//   node scripts/record-engine-output.cjs
'use strict';

const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const ENGINE = join(__dirname, '../public/engine/stockfish-19-lite-single.js');
const OUTPUT = join(__dirname, '../test/fixtures/engine-output.txt');

// A fixed depth, so that a new recording gives the same lines.
const GO = 'go depth 12';

const POSITIONS = [
  // Fool's mate, 1. f3 e5 2. g4 Qh4#: every position before a move.
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1',
  'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2',
  'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
  // A pawn that promotes: the best move carries the new piece.
  '8/P7/8/8/8/8/8/k6K w - - 0 1',
];

async function main() {
  const lines = [];
  let waiting = null;
  const engine = {
    locateFile: (file) => (file.includes('.wasm') ? ENGINE.replace(/\.js$/, '.wasm') : ENGINE),
    listener: (line) => {
      lines.push(line);
      if (waiting && waiting.done.test(line)) {
        const { resolve } = waiting;
        waiting = null;
        resolve();
      }
    },
  };

  await require(ENGINE)()(engine);
  while (engine._isReady && !engine._isReady()) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  const ask = (command, done) =>
    new Promise((resolve) => {
      waiting = { done, resolve };
      lines.push(`> ${command}`);
      setImmediate(() => engine.ccall('command', null, ['string'], [command], { async: command.startsWith('go ') }));
    });

  await ask('uci', /^uciok\b/);
  await ask('isready', /^readyok\b/);
  for (const fen of POSITIONS) {
    lines.push(`> position fen ${fen}`);
    engine.ccall('command', null, ['string'], [`position fen ${fen}`]);
    await ask(GO, /^bestmove\b/);
  }

  const header = `# Recorded by scripts/record-engine-output.cjs from public/engine/stockfish-19-lite-single.js, "${GO}".\n# "> " marks a command sent to the engine; the other lines are the engine's, as printed.\n`;
  writeFileSync(OUTPUT, header + lines.join('\n') + '\n');
  console.log(`${lines.length} lines written to ${OUTPUT}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
