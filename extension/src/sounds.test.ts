import { describe, expect, it, vi } from 'vitest';
import archive from '../test/fixtures/archive-hikaru-2026-08.json';
import captureUrl from './assets/sounds/capture.ogg?inline';
import castleUrl from './assets/sounds/castle.ogg?inline';
import checkUrl from './assets/sounds/check.ogg?inline';
import illegalUrl from './assets/sounds/illegal.ogg?inline';
import mateUrl from './assets/sounds/mate.ogg?inline';
import moveUrl from './assets/sounds/move.ogg?inline';
import tickUrl from './assets/sounds/tick.ogg?inline';
import { readGame } from './game';
import { createSounds, soundOf, type SoundKind } from './sounds';

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

// A recording is told by its length in bytes: the seven differ.
const size = (dataUrl: string) => atob(dataUrl.slice(dataUrl.indexOf(',') + 1)).length;
const RECORDING: Record<SoundKind, number> = {
  move: size(moveUrl),
  capture: size(captureUrl),
  castle: size(castleUrl),
  check: size(checkUrl),
  mate: size(mateUrl),
  illegal: size(illegalUrl),
  tick: size(tickUrl),
};

// Just enough of an AudioContext to see which recording starts when, and how loud.
function fakeAudio(state: AudioContextState = 'running') {
  const started: { recording: number; at: number; gain: number }[] = [];
  const context = {
    state,
    currentTime: 10,
    destination: {},
    resume: vi.fn(async () => {}),
    decodeAudioData: vi.fn(async (data: ArrayBuffer) => ({ recording: data.byteLength })),
    createGain: () => ({ gain: { value: 1 }, connect: (next: unknown) => next }),
    createBufferSource() {
      const source = {
        buffer: null as { recording: number } | null,
        output: null as { gain: { value: number } } | null,
        connect(gain: { gain: { value: number } }) {
          source.output = gain;
          return gain;
        },
        start(at: number) {
          started.push({ recording: source.buffer!.recording, at, gain: source.output!.gain.value });
        },
      };
      return source;
    },
  };
  return { context, started, sounds: createSounds(() => context as unknown as AudioContext) };
}

describe('createSounds', () => {
  it.each(['move', 'capture', 'castle', 'check', 'mate', 'illegal'] as const)('plays %s its own recording, at full volume', async (kind) => {
    const { sounds, started } = fakeAudio();

    await sounds.play(kind);

    expect(started).toEqual([{ recording: RECORDING[kind], at: 10, gain: 1 }]);
  });

  it('ticks quietly during the replay', async () => {
    const { sounds, started } = fakeAudio();

    await sounds.play('tick');

    expect(started).toEqual([{ recording: RECORDING.tick, at: 10, gain: 0.35 }]);
  });

  it('is silent while switched off, and plays again when switched on', async () => {
    const { sounds, started } = fakeAudio();

    sounds.setEnabled(false);
    await sounds.play('move');
    expect(started).toEqual([]);

    sounds.setEnabled(true);
    await sounds.play('move');
    expect(started).toEqual([{ recording: RECORDING.move, at: 10, gain: 1 }]);
  });

  it('resumes the audio that the browser holds until a click', async () => {
    const { sounds, context } = fakeAudio('suspended');

    await sounds.play('move');

    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it('decodes each recording once', async () => {
    const { sounds, context } = fakeAudio();

    await sounds.play('move');
    await sounds.play('move');
    await sounds.play('tick');

    const decoded = context.decodeAudioData.mock.calls.map(([data]) => data.byteLength);
    expect(decoded.sort((a, b) => a - b)).toEqual(Object.values(RECORDING).sort((a, b) => a - b));
  });
});
