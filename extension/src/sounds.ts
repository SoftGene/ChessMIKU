import captureUrl from './assets/sounds/capture.ogg?inline';
import castleUrl from './assets/sounds/castle.ogg?inline';
import checkUrl from './assets/sounds/check.ogg?inline';
import illegalUrl from './assets/sounds/illegal.ogg?inline';
import mateUrl from './assets/sounds/mate.ogg?inline';
import moveUrl from './assets/sounds/move.ogg?inline';
import tickUrl from './assets/sounds/tick.ogg?inline';
import type { Ply } from './game';

export type SoundKind = 'move' | 'capture' | 'castle' | 'check' | 'mate' | 'illegal' | 'tick';

/** The sound of a half-move: mate over check over castling over a capture over a plain move. */
export function soundOf(ply: Ply): SoundKind {
  return ply.mate ? 'mate' : ply.check ? 'check' : ply.castle ? 'castle' : ply.capture ? 'capture' : 'move';
}

export interface Sounds {
  play(kind: SoundKind): Promise<void>;
  setEnabled(on: boolean): void;
}

// Free recordings (CC0), chosen by ear by Pavel and levelled against each other: assets/sounds/README.md.
// They are in the script itself: the panel reads no files and goes to no network.
const RECORDINGS: Record<SoundKind, string> = {
  move: moveUrl,
  capture: captureUrl,
  castle: castleUrl,
  check: checkUrl,
  mate: mateUrl,
  illegal: illegalUrl,
  tick: tickUrl,
};

// The ticks of the replay come ten a second: quieter than a move played by hand.
const VOLUME: Partial<Record<SoundKind, number>> = { tick: 0.35 };

export function createSounds(audio: () => AudioContext = () => new AudioContext()): Sounds {
  let context: AudioContext | null = null;
  let buffers: Promise<Record<SoundKind, AudioBuffer>> | null = null;
  let enabled = true;

  // Made at the first sound: before a click the browser would hold the audio anyway.
  const decoded = (a: AudioContext) =>
    (buffers ??= Promise.all(
      Object.entries(RECORDINGS).map(async ([kind, url]) => [kind, await a.decodeAudioData(bytes(url))] as const),
    ).then((pairs) => Object.fromEntries(pairs) as Record<SoundKind, AudioBuffer>));

  return {
    async play(kind) {
      if (!enabled) {
        return;
      }
      const a = (context ??= audio());
      if (a.state === 'suspended') {
        void a.resume();
      }
      const source = a.createBufferSource();
      source.buffer = (await decoded(a))[kind];
      const gain = a.createGain();
      gain.gain.value = VOLUME[kind] ?? 1;
      source.connect(gain).connect(a.destination);
      source.start(a.currentTime);
    },
    setEnabled(on) {
      enabled = on;
    },
  };
}

// A data: address to the bytes it holds.
function bytes(dataUrl: string): ArrayBuffer {
  const text = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    out[i] = text.charCodeAt(i);
  }
  return out.buffer;
}
