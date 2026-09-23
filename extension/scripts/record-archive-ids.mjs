// Records the game numbers of every monthly archive of one player, for the tests of the search in old
// archives: test/fixtures/archive-ids-<player>.json. The archives themselves weigh about 1 MB a month;
// the search reads only the numbers, and the PGN of the games it has to find. Usage, from extension/:
//   node scripts/record-archive-ids.mjs poohineedyou <game number> [<game number> …]
import { writeFileSync } from 'node:fs';

const [player, ...wanted] = process.argv.slice(2);
if (!player) {
  console.error('usage: node scripts/record-archive-ids.mjs <player> [<game number> …]');
  process.exit(2);
}

const base = `https://api.chess.com/pub/player/${player.toLowerCase()}/games`;

async function json(url) {
  // One request at a time, with a pause: the public API asks for serial access.
  await new Promise((resolve) => setTimeout(resolve, 250));
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: ${response.status}`);
  }
  return response.json();
}

const { archives } = await json(`${base}/archives`);
const months = {};
const games = [];
for (const url of archives) {
  const month = url.slice(base.length + 1);
  const archive = await json(url);
  const numbers = (type) => archive.games.filter((g) => g.url.includes(`/game/${type}/`)).map((g) => Number(g.url.split('/').pop()));
  months[month] = { live: numbers('live'), daily: numbers('daily') };
  for (const game of archive.games) {
    if (wanted.includes(game.url.split('/').pop())) {
      games.push({ month, url: game.url, pgn: game.pgn });
    }
  }
  process.stdout.write(`${month} `);
}

const output = new URL(`../test/fixtures/archive-ids-${player.toLowerCase()}.json`, import.meta.url);
const recorded = { player, recordedAt: new Date().toISOString().slice(0, 10), archives, months, games };
writeFileSync(output, `${JSON.stringify(recorded)}\n`);
console.log(`\n${archives.length} months, ${games.length} of ${wanted.length} wanted games written to ${output.pathname}`);
