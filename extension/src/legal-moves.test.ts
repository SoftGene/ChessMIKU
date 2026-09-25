import { describe, expect, it } from 'vitest';
import { endingOf, legalDests, readDrop } from './legal-moves';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const PROMOTION = '8/4P3/8/8/8/8/k7/4K3 w - - 0 1';
const moveOf = (drop: ReturnType<typeof readDrop>) => (drop.kind === 'move' ? drop.ply : null);

describe('legalDests', () => {
  it('gives each piece of the side to move its squares', () => {
    const dests = legalDests(START);

    expect(dests.get('e2')).toEqual(['e3', 'e4']);
    expect(dests.get('g1')?.sort()).toEqual(['f3', 'h3']);
    expect([...dests.values()].flat()).toHaveLength(20);
    expect(dests.has('e7')).toBe(false);
  });

  it('gives a promotion square once, not once per piece', () => {
    expect(legalDests(PROMOTION).get('e7')).toEqual(['e8']);
  });
});

describe('readDrop', () => {
  it('reads a legal move as a half-move, numbered from the start', () => {
    expect(readDrop(START, 'e2', 'e4')).toEqual({
      kind: 'move',
      ply: {
        ply: 1,
        san: 'e4',
        uci: 'e2e4',
        from: 'e2',
        to: 'e4',
        color: 'w',
        fenBefore: START,
        fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        capture: false,
        castle: false,
        check: false,
        mate: false,
      },
    });
  });

  it('refuses to move a pinned piece', () => {
    expect(readDrop('4k3/8/8/8/1b6/8/3N4/4K3 w - - 0 1', 'd2', 'f3')).toEqual({ kind: 'illegal' });
  });

  it('refuses to put the king in check, and lets it go elsewhere', () => {
    const fen = '4kr2/8/8/8/8/8/8/4K3 w - - 0 1';

    expect(readDrop(fen, 'e1', 'f1')).toEqual({ kind: 'illegal' });
    expect(moveOf(readDrop(fen, 'e1', 'd1'))?.san).toBe('Kd1');
  });

  it('refuses a move the piece cannot make', () => {
    expect(readDrop(START, 'g1', 'g3')).toEqual({ kind: 'illegal' });
  });

  it('takes a drop on a piece of the same side for choosing that piece', () => {
    expect(readDrop(START, 'e2', 'd2')).toEqual({ kind: 'reselect' });
  });

  it('castles both ways', () => {
    const white = moveOf(readDrop('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1', 'g1'));
    const black = moveOf(readDrop('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1', 'e8', 'c8'));

    expect([white?.san, white?.castle, white?.uci, white?.ply]).toEqual(['O-O', true, 'e1g1', 1]);
    expect([black?.san, black?.castle, black?.color, black?.ply]).toEqual(['O-O-O', true, 'b', 2]);
  });

  it('counts an en passant capture as a capture', () => {
    const move = moveOf(readDrop('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3', 'e5', 'd6'));

    expect([move?.san, move?.capture, move?.ply]).toEqual(['exd6', true, 5]);
  });

  it('asks for the piece of a promotion, then promotes to the one chosen', () => {
    const knight = moveOf(readDrop(PROMOTION, 'e7', 'e8', 'n'));

    expect(readDrop(PROMOTION, 'e7', 'e8')).toEqual({ kind: 'promote' });
    expect([knight?.san, knight?.uci]).toEqual(['e8=N', 'e7e8n']);
    expect(moveOf(readDrop(PROMOTION, 'e7', 'e8', 'q'))?.san).toBe('e8=Q');
  });

  it('marks a check and a mate', () => {
    const check = moveOf(readDrop('6k1/8/8/8/8/8/8/R5K1 w - - 0 1', 'a1', 'a8'));
    const mate = moveOf(readDrop('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'a1', 'a8'));

    expect([check?.san, check?.check, check?.mate]).toEqual(['Ra8+', true, false]);
    expect([mate?.san, mate?.check, mate?.mate]).toEqual(['Ra8#', false, true]);
  });
});

describe('endingOf', () => {
  it('tells a mate, a stalemate and a game going on', () => {
    expect(endingOf('R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1')).toBe('checkmate');
    expect(endingOf('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).toBe('stalemate');
    expect(endingOf(START)).toBeNull();
  });
});
