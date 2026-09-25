import { describe, expect, it, vi } from 'vitest';
import archive from '../test/fixtures/archive-hikaru-2026-08.json';
import captureUrl from './assets/sounds/capture.ogg?inline';
import moveUrl from './assets/sounds/move.ogg?inline';
import tickUrl from './assets/sounds/tick.ogg?inline';
import { readGame } from './game';
import { createSounds, soundsOf } from './sounds';

const { plies } = readGame(archive.games.find((g) => g.url.endsWith('/173765478164'))!.pgn);

describe('soundsOf', () => {
  it.each([
    [1, 'b3', ['move']],
    [12, 'O-O', ['castle', 'move']],
    [19, 'dxc5', ['capture']],
    [71, 'Rxh7+', ['check', 'capture']],
    [89, 'Rh8#', ['mate', 'move']],
  ])('gives half-move %i, %s, the sounds %j, the most telling first', (ply, san, kinds) => {
    expect(plies[ply - 1].san).toBe(san);
    expect(soundsOf(plies[ply - 1])).toEqual(kinds);
  });
});

// A recording is told by its length in bytes: the three differ.
const size = (dataUrl: string) => atob(dataUrl.slice(dataUrl.indexOf(',') + 1)).length;
const MOVE = size(moveUrl);
const CAPTURE = size(captureUrl);
const TICK = size(tickUrl);

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
  it('plays the recorded knock of a move and of a capture', async () => {
    const { sounds, started } = fakeAudio();

    await sounds.play('move');
    await sounds.play('capture');

    expect(started).toEqual([
      { recording: MOVE, at: 10, gain: 1 },
      { recording: CAPTURE, at: 10, gain: 1 },
    ]);
  });

  it('castles with two knocks of the move, the rook after the king', async () => {
    const { sounds, started } = fakeAudio();

    await sounds.play('castle', 'move');

    expect(started).toEqual([
      { recording: MOVE, at: 10, gain: 1 },
      { recording: MOVE, at: 10.14, gain: 1 },
    ]);
  });

  it('plays a check, which has no sound of its own yet, as the knock of its capture', async () => {
    const { sounds, started } = fakeAudio();

    await sounds.play('check', 'capture');

    expect(started).toEqual([{ recording: CAPTURE, at: 10, gain: 1 }]);
  });

  it('ticks quietly during the replay', async () => {
    const { sounds, started } = fakeAudio();

    await sounds.play('tick');

    expect(started).toEqual([{ recording: TICK, at: 10, gain: 0.35 }]);
  });

  it('is silent while switched off, and plays again when switched on', async () => {
    const { sounds, started } = fakeAudio();

    sounds.setEnabled(false);
    await sounds.play('move');
    expect(started).toEqual([]);

    sounds.setEnabled(true);
    await sounds.play('move');
    expect(started).toEqual([{ recording: MOVE, at: 10, gain: 1 }]);
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

    expect(context.decodeAudioData.mock.calls.map(([data]) => data.byteLength).sort()).toEqual([MOVE, CAPTURE, TICK].sort());
  });
});
