// Lets Pavel hear the sounds as the panel plays them (the assistant cannot hear). Run: npm run bench, open /bench/sounds.html.
import { createSounds, type SoundKind } from '../src/sounds';

const sounds = createSounds();
const kinds: SoundKind[] = ['move', 'capture', 'castle', 'check', 'mate', 'illegal', 'tick'];
const buttons = document.getElementById('buttons')!;

for (const kind of kinds) {
  const button = document.createElement('button');
  button.textContent = kind;
  button.addEventListener('click', () => void sounds.play(kind));
  buttons.append(button);
}

const replay = document.createElement('button');
replay.textContent = 'replay: 30 ticks';
replay.addEventListener('click', () => {
  let n = 0;
  const timer = setInterval(() => {
    void sounds.play('tick');
    if (++n === 30) {
      clearInterval(timer);
    }
  }, 100);
});
buttons.append(replay);
