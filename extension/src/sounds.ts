import type { Ply } from './game';

export type SoundKind = 'move' | 'capture' | 'castle' | 'check' | 'mate' | 'illegal' | 'tick';

/** The sound of a half-move: mate over check over castling over a capture over a plain move. */
export function soundOf(ply: Ply): SoundKind {
  return ply.mate ? 'mate' : ply.check ? 'check' : ply.castle ? 'castle' : ply.capture ? 'capture' : 'move';
}

export interface Sounds {
  play(kind: SoundKind): void;
  setEnabled(on: boolean): void;
}

interface Knock {
  freq: number;
  q: number;
  gain: number;
  decay: number;
}

/**
 * Wooden sounds made by Web Audio, no files: a burst of noise through a band-pass filter with a fast decay
 * (wood on wood), a soft tone for check and mate. Picked by ear with Pavel on bench/sounds.html.
 */
export function createSounds(): Sounds {
  let context: AudioContext | null = null;
  let enabled = true;
  const audio = () => (context ??= new AudioContext());

  const knock = (at: number, { freq, q, gain, decay }: Knock) => {
    const a = audio();
    const length = Math.ceil(a.sampleRate * decay);
    const buffer = a.createBuffer(1, length, a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp((-6 * i) / length);
    }
    const source = a.createBufferSource();
    source.buffer = buffer;
    const filter = a.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const volume = a.createGain();
    volume.gain.value = gain;
    source.connect(filter).connect(volume).connect(a.destination);
    source.start(at);
  };

  const tone = (at: number, freq: number, duration: number, gain: number) => {
    const a = audio();
    const oscillator = a.createOscillator();
    oscillator.frequency.value = freq;
    const volume = a.createGain();
    volume.gain.setValueAtTime(gain, at);
    volume.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(volume).connect(a.destination);
    oscillator.start(at);
    oscillator.stop(at + duration);
  };

  const wood: Knock = { freq: 1200, q: 4, gain: 0.9, decay: 0.08 };
  const recipes: Record<SoundKind, (at: number) => void> = {
    move: (at) => knock(at, wood),
    capture: (at) => {
      knock(at, { freq: 900, q: 3, gain: 1.2, decay: 0.1 });
      knock(at + 0.02, { freq: 1600, q: 5, gain: 0.6, decay: 0.06 });
    },
    castle: (at) => {
      knock(at, wood);
      knock(at + 0.09, wood);
    },
    check: (at) => {
      knock(at, wood);
      tone(at + 0.03, 880, 0.18, 0.12);
    },
    mate: (at) => {
      knock(at, { freq: 900, q: 3, gain: 1.2, decay: 0.1 });
      tone(at + 0.05, 660, 0.4, 0.15);
      tone(at + 0.05, 990, 0.4, 0.08);
    },
    illegal: (at) => knock(at, { freq: 300, q: 1.5, gain: 0.7, decay: 0.12 }),
    tick: (at) => knock(at, { freq: 2200, q: 6, gain: 0.25, decay: 0.03 }),
  };

  return {
    play(kind) {
      if (!enabled) {
        return;
      }
      const a = audio();
      if (a.state === 'suspended') {
        void a.resume();
      }
      recipes[kind](a.currentTime);
    },
    setEnabled(on) {
      enabled = on;
    },
  };
}
