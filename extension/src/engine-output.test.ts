import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyseGame } from './analysis';
import { UciEngine, type StartProcess } from './engine';
import { readSearch } from './uci';

// What the real engine printed: scripts/record-engine-output.cjs ran public/engine in Node.
// "> command" lines are what was sent; the lines after one are the engine's answer to it.
const recording = readFileSync(join(import.meta.dirname, '../test/fixtures/engine-output.txt'), 'utf8')
  .split(/\r?\n/)
  .filter((line) => line !== '' && !line.startsWith('#'));

// The engine greets before any command ("Stockfish 19 Lite WASM by …"): that line answers nothing.
const answers: { command: string; lines: string[] }[] = [];
for (const line of recording) {
  if (line.startsWith('> ')) {
    answers.push({ command: line.slice(2), lines: [] });
  } else {
    answers.at(-1)?.lines.push(line);
  }
}

const answerTo = (command: string) => answers.find((a) => a.command === command)!.lines;

// The search recorded for a position: the answer to the `go` that followed its `position fen`.
function searchOf(fen: string): string[] {
  const at = answers.findIndex((a) => a.command === `position fen ${fen}`);
  expect(at, `no recording for ${fen}`).toBeGreaterThanOrEqual(0);
  return answers[at + 1].lines;
}

// Plays the recorded engine back to the engine client.
const replay: StartProcess = (onLine) => {
  let position = '';
  return {
    send(command) {
      if (command.startsWith('position fen ')) {
        position = command.slice('position fen '.length);
        return;
      }
      const lines = command.startsWith('go ') ? searchOf(position) : answerTo(command);
      queueMicrotask(() => lines.forEach(onLine));
    },
    terminate() {},
  };
};

describe('the recorded output of the real engine', () => {
  it('passes the start of the engine client', async () => {
    await expect(UciEngine.start(replay)).resolves.toBeInstanceOf(UciEngine);
  });

  it("evaluates fool's mate from the side of each move", async () => {
    const engine = await UciEngine.start(replay);

    const moves = await analyseGame('1. f3 e5 2. g4 Qh4# 0-1', (fen) => engine.evaluate(fen, { depth: 12 }));

    // The start is about level; 1. f3 weakens White; after 2. g4 Black mates in one; Qh4 mates.
    expect(Math.abs(moves[0].evalBeforeCp!)).toBeLessThan(100);
    expect(moves[0].evalAfterCp).toBeLessThan(0);
    expect(moves[1].evalBeforeCp).toBeGreaterThan(0);
    expect(moves[2]).toMatchObject({ san: 'g4', evalAfterCp: null, mateAfter: -1 });
    expect(moves[3]).toMatchObject({ san: 'Qh4#', bestMoveUci: 'd8h4', evalBeforeCp: null, mateBefore: 1, evalAfterCp: null, mateAfter: 0 });
  });

  it('keeps the promotion piece of a best move', () => {
    const evaluation = readSearch(searchOf('8/P7/8/8/8/8/8/k6K w - - 0 1'));

    expect(evaluation.bestMoveUci).toBe('a7a8q');
    expect('mate' in evaluation.score ? evaluation.score.mate > 0 : evaluation.score.cp > 500).toBe(true);
  });
});
