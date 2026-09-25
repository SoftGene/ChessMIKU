import { describe, expect, it } from 'vitest';
import { readGame } from './game';
import { backToGame, keyAction, movePlace, navigate, playMove, positionAt, type Place } from './navigation';

describe('navigate', () => {
  it.each([
    [5, 'prev', 4],
    [5, 'next', 6],
    [5, 'first', 0],
    [5, 'last', 10],
    [0, 'prev', 0],
    [10, 'next', 10],
  ] as const)('from %i, %s goes to %i', (ply, action, expected) => {
    expect(navigate(ply, 10, action)).toBe(expected);
  });
});

describe('keyAction', () => {
  it.each([
    ['ArrowLeft', 'prev'],
    ['ArrowRight', 'next'],
    ['Home', 'first'],
    ['End', 'last'],
    ['Escape', 'close'],
  ])('maps %s to %s', (key, action) => {
    expect(keyAction(key)).toBe(action);
  });

  it.each(['ArrowUp', 'a', ' ', 'Enter'])('leaves %j alone', (key) => {
    expect(keyAction(key)).toBeNull();
  });
});

const game = readGame('1. e4 e5 2. Nf3 Nc6 3. Bb5');
// A line from the game's third half-move: 2… Nf6 3. Nxe5 d6.
const line = readGame('1. e4 e5 2. Nf3 Nf6 3. Nxe5 d6').plies.slice(3);
const d4 = readGame('1. e4 e5 2. Nf3 Nf6 3. d4').plies[4];
const d6 = readGame('1. e4 e5 2. Nf3 d6').plies[3];
const at = (ply: number, inLine: Place['line'] = null): Place => ({ ply, line: inLine });

describe('playMove', () => {
  it("goes along the game when the move is the game's next one", () => {
    expect(playMove(at(3), game, game.plies[3])).toEqual(at(4));
  });

  it('starts a line with another move', () => {
    expect(playMove(at(3), game, line[0])).toEqual(at(3, { moves: [line[0]], at: 1 }));
  });

  it("goes along the line when the move is the line's next one", () => {
    expect(playMove(at(3, { moves: line, at: 1 }), game, line[1])).toEqual(at(3, { moves: line, at: 2 }));
  });

  it('cuts the rest of the line at another move', () => {
    expect(playMove(at(3, { moves: line, at: 1 }), game, d4)).toEqual(at(3, { moves: [line[0], d4], at: 2 }));
  });

  it("leaves the line for the game when its first position plays the game's move", () => {
    expect(playMove(at(3, { moves: line, at: 0 }), game, game.plies[3])).toEqual(at(4));
  });

  it('starts the line anew from its first position with a third move', () => {
    expect(playMove(at(3, { moves: line, at: 0 }), game, d6)).toEqual(at(3, { moves: [d6], at: 1 }));
  });
});

describe('movePlace', () => {
  it('moves along the game outside a line', () => {
    expect(movePlace(at(3), game, 'next')).toEqual(at(4));
    expect(movePlace(at(3), game, 'last')).toEqual(at(5));
  });

  it('moves inside the line, from its first position to its last, and stays at the game move it left', () => {
    const inLine = at(3, { moves: line, at: 1 });

    expect(movePlace(inLine, game, 'prev')).toEqual(at(3, { moves: line, at: 0 }));
    expect(movePlace(inLine, game, 'first')).toEqual(at(3, { moves: line, at: 0 }));
    expect(movePlace(inLine, game, 'last')).toEqual(at(3, { moves: line, at: 3 }));
    expect(movePlace(at(3, { moves: line, at: 3 }), game, 'next')).toEqual(at(3, { moves: line, at: 3 }));
  });
});

describe('backToGame', () => {
  it('returns to the position the line left', () => {
    expect(backToGame(at(3, { moves: line, at: 2 }))).toEqual(at(3));
  });
});

describe('positionAt', () => {
  it("shows the game's position and the move that led to it", () => {
    expect(positionAt(at(3), game)).toEqual({ fen: game.plies[2].fenAfter, move: game.plies[2] });
    expect(positionAt(at(0), game)).toEqual({ fen: game.startFen, move: undefined });
  });

  it("shows the line's position and move, and the game's at the line's first position", () => {
    expect(positionAt(at(3, { moves: line, at: 2 }), game)).toEqual({ fen: line[1].fenAfter, move: line[1] });
    expect(positionAt(at(3, { moves: line, at: 0 }), game)).toEqual({ fen: game.plies[2].fenAfter, move: game.plies[2] });
  });
});
