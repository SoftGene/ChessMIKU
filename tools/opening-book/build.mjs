// Builds backend/ChessReview.Domain/OpeningBook/lichess-openings.tsv from the Lichess opening
// list (https://github.com/lichess-org/chess-openings, CC0), converting each line from PGN to
// UCI moves, the notation the engine and the API use.
//
// Usage, from this folder: npm ci && npm run build
// Bump SOURCE_COMMIT to take a newer version of the list.

import { writeFile } from 'node:fs/promises';
import { Chess } from 'chess.js';

const SOURCE_COMMIT = 'c67912be581f0793dbaa776be5ccf111e01f88d9';
const SOURCE_FILES = ['a', 'b', 'c', 'd', 'e'];
const OUTPUT = new URL('../../backend/ChessReview.Domain/OpeningBook/lichess-openings.tsv', import.meta.url);

const rows = [];

for (const file of SOURCE_FILES) {
  const url = `https://raw.githubusercontent.com/lichess-org/chess-openings/${SOURCE_COMMIT}/${file}.tsv`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }

  const [header, ...lines] = (await response.text()).trim().split(/\r?\n/);
  if (header !== 'eco\tname\tpgn') {
    throw new Error(`${url}: unexpected header "${header}"`);
  }

  for (const line of lines) {
    const [eco, name, pgn] = line.split('\t');
    const game = new Chess();
    game.loadPgn(pgn);
    const uci = game.history({ verbose: true }).map((move) => move.lan).join(' ');
    rows.push(`${eco}\t${name}\t${uci}`);
  }
}

await writeFile(OUTPUT, ['eco\tname\tuci', ...rows].join('\n') + '\n');
console.log(`${rows.length} opening lines written to ${OUTPUT.pathname}`);
