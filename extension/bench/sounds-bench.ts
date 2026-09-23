// Lets Pavel judge the sounds by ear (the assistant cannot hear them). Run: npm run bench, open /bench/sounds.html.
import { createSounds, type SoundKind } from '../src/sounds';

const sounds = createSounds();
const kinds: SoundKind[] = ['move', 'capture', 'castle', 'check', 'mate', 'illegal', 'tick'];
const buttons = document.getElementById('buttons')!;

for (const kind of kinds) {
  const button = document.createElement('button');
  button.textContent = kind;
  button.addEventListener('click', () => sounds.play(kind));
  buttons.append(button);
}

const replay = document.createElement('button');
replay.textContent = 'replay: 30 ticks';
replay.addEventListener('click', () => {
  let n = 0;
  const timer = setInterval(() => {
    sounds.play('tick');
    if (++n === 30) {
      clearInterval(timer);
    }
  }, 100);
});
buttons.append(replay);
