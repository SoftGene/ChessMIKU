import { describe, expect, it } from 'vitest';
import archive from '../test/fixtures/archive-hikaru-2026-08.json';
import { readGame } from './game';
import { soundOf } from './sounds';

const { plies } = readGame(archive.games.find((g) => g.url.endsWith('/173765478164'))!.pgn);

describe('soundOf', () => {
  it.each([
    [1, 'b3', 'move'],
    [12, 'O-O', 'castle'],
    [19, 'dxc5', 'capture'],
    [71, 'Rxh7+', 'check'],
    [89, 'Rh8#', 'mate'],
  ])('plays half-move %i, %s, as %s', (ply, san, kind) => {
    expect(plies[ply - 1].san).toBe(san);
    expect(soundOf(plies[ply - 1])).toBe(kind);
  });
});
