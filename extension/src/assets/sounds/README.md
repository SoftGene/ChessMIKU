# Move sounds

The three sounds here are knocks cut from one recording of a wooden piece on a board, chosen by ear
by Pavel on 25.09.2026 out of the 17 knocks in it:

- source: "Moving piece on a boardgame" by zachrau, https://freesound.org/s/556387/
- license: Creative Commons 0 (public domain dedication): free to copy, change and ship, credit not required
- file used: the site's high-quality preview, `556387_676927-hq.ogg` (Vorbis, 44.1 kHz, stereo, 7.99 s),
  SHA-256 `d2d63a32bbdb4bdf352340e1ae65ef8716ddf64695e53471ce67ece66ec983c9`

| File | Knock | From | Length | Gain | SHA-256 |
|---|---|---|---|---|---|
| `move.ogg` | the 15th | 7.012 s | 0.320 s | +4.27 dB | `e2d922c0a7faf498f15122eb5fbb54272e5d99869f2e2ec4cbc9d197ac6cbf21` |
| `capture.ogg` | the 16th and 17th: a light knock, then a loud one | 7.533 s | 0.442 s | −0.41 dB | `f06273daf80a3845f3332ab41cf6b2ce6690e0ee2731bb4f56a0c78abfc7d0b3` |
| `tick.ogg` | the 16th, for the ticks of the replay | 7.533 s | 0.116 s | +15.56 dB | `01b86216b54f1d3c5a143241763c664eb282813d69a1adcf915400f6288d1d10` |

How they were made, with FFmpeg 8.1: the recording mixed to mono, rumble below 70 Hz cut and the hiss
between knocks lowered by about 14 dB,

    ffmpeg -i 556387_676927-hq.ogg -af "pan=mono|c0=0.5*c0+0.5*c1,highpass=f=70,anlmdn=s=0.0015:p=0.004:r=0.006" -c:a pcm_f32le denoised.wav

then each piece cut, faded in over 3 ms and out over its last 45 %, and raised to a peak of −1 dBFS:

    ffmpeg -ss 7.012 -t 0.32 -i denoised.wav -af "afade=t=in:d=0.003,afade=t=out:st=0.176:d=0.144:curve=exp,volume=4.27dB" -ac 1 -ar 44100 -c:a libvorbis -q:a 6 move.ogg

Castling plays the move sound twice. Check, mate and the refused move have no sound of their own yet:
until they do, a move plays the knock of its move or capture.
