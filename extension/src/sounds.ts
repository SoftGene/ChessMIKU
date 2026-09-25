import captureUrl from './assets/sounds/capture.ogg?inline';
import moveUrl from './assets/sounds/move.ogg?inline';
import tickUrl from './assets/sounds/tick.ogg?inline';
import type { Ply } from './game';

export type SoundKind = 'move' | 'capture' | 'castle' | 'check' | 'mate' | 'illegal' | 'tick';

/**
 * The sounds that fit a half-move, the most telling first: mate or check, then castling, then the knock
 * of a capture or a plain move. A kind with no sound yet gives way to the next one.
 */
export function soundsOf(ply: Ply): SoundKind[] {
  const kinds: SoundKind[] = [];
  if (ply.mate) {
    kinds.push('mate');
  } else if (ply.check) {
    kinds.push('check');
  }
  if (ply.castle) {
    kinds.push('castle');
  }
  kinds.push(ply.capture ? 'capture' : 'move');
  return kinds;
}

export interface Sounds {
  /** Plays the first of the kinds that has a sound. */
  play(...kinds: SoundKind[]): Promise<void>;
  setEnabled(on: boolean): void;
}

// Knocks of a wooden piece, cut from a CC0 recording and chosen by ear by Pavel (assets/sounds/README.md).
// They are in the script itself: the panel reads no files and goes to no network.
const RECORDINGS = { move: moveUrl, capture: captureUrl, tick: tickUrl };
type Recording = keyof typeof RECORDINGS;

// What each kind plays: recordings with their delay in seconds and their volume. Check, mate and the
// refused move have no sounds of their own yet.
const KINDS: Partial<Record<SoundKind, [Recording, number, number][]>> = {
  move: [['move', 0, 1]],
  capture: [['capture', 0, 1]],
  castle: [
    ['move', 0, 1],
    ['move', 0.14, 1],
  ],
  tick: [['tick', 0, 0.35]],
};

export function createSounds(audio: () => AudioContext = () => new AudioContext()): Sounds {
  let context: AudioContext | null = null;
  let buffers: Promise<Record<Recording, AudioBuffer>> | null = null;
  let enabled = true;

  // Made at the first sound: before a click the browser would hold the audio anyway.
  const decoded = (a: AudioContext) =>
    (buffers ??= Promise.all(
      Object.entries(RECORDINGS).map(async ([name, url]) => [name, await a.decodeAudioData(bytes(url))] as const),
    ).then((pairs) => Object.fromEntries(pairs) as Record<Recording, AudioBuffer>));

  return {
    async play(...kinds) {
      const plan = kinds.map((kind) => KINDS[kind]).find(Boolean);
      if (!enabled || !plan) {
        return;
      }
      const a = (context ??= audio());
      if (a.state === 'suspended') {
        void a.resume();
      }
      const recordings = await decoded(a);
      const now = a.currentTime;
      for (const [recording, delay, volume] of plan) {
        const source = a.createBufferSource();
        source.buffer = recordings[recording];
        const gain = a.createGain();
        gain.gain.value = volume;
        source.connect(gain).connect(a.destination);
        source.start(now + delay);
      }
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
