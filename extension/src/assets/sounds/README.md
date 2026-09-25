# Move sounds

Seven sounds, all from free recordings under Creative Commons 0 (a public domain dedication: free to copy,
change and ship, credit not required). Pavel chose each one by ear among cut and levelled candidates: the
move, capture and tick on 25.09.2026, the others the same day.

| File | Plays for | Made of |
|---|---|---|
| `move.ogg` | a move | the 15th knock of zachrau's recording |
| `capture.ogg` | a capture | the 16th and 17th knocks of zachrau's recording: a light one, then a loud one |
| `tick.ogg` | each half-move of the replay, at 35 % volume | the 16th knock of zachrau's recording |
| `castle.ogg` | castling | el_boss's piece slide, then `move.ogg` 0.26 s later |
| `check.ogg` | a check | el_boss's piece capture snap |
| `mate.ogg` | a mate | `capture.ogg`, then Kenney's `bong_001` 0.12 s later |
| `illegal.ogg` | a refused move (free play, T7.2) | Kenney's `error_004` |

## Sources

| Recording | Author | Where | File used | SHA-256 of that file |
|---|---|---|---|---|
| Moving piece on a boardgame | zachrau | https://freesound.org/s/556387/ | preview `556387_676927-hq.ogg` | `d2d63a32bbdb4bdf352340e1ae65ef8716ddf64695e53471ce67ece66ec983c9` |
| Piece Slide.mp3 (pack Chess Puzzle Blitz SFX) | el_boss | https://freesound.org/s/546118/ | preview `546118_9129912-hq.ogg` | `12f46e2ce41fa7b1f3c353326d4e4a2fd392beafbc1bf13a3be7051d0252d0f5` |
| Piece Capture.mp3 (pack Chess Puzzle Blitz SFX) | el_boss | https://freesound.org/s/546120/ | preview `546120_9129912-hq.ogg` | `3e7f823e104d103bb950abbc46b5353035a20289c84f940f492bdc9ec33b904c` |
| Interface Sounds 1.0 | Kenney | https://kenney.nl/assets/interface-sounds | `bong_001.ogg`, `error_004.ogg` from `kenney_interface-sounds.zip` | zip `f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232` |

The licenses: each freesound page says "Creative Commons 0"; Kenney's archive has a `License.txt` saying
"License: (Creative Commons Zero, CC0)".

## How they were made

With FFmpeg 8.1. Every piece is mixed to mono at 44.1 kHz, cut, brought to a level, faded out at its end,
kept under a peak of −1 dBFS, and saved as Vorbis (`-q:a 6`).

zachrau's recording first loses the rumble below 70 Hz and about 14 dB of the hiss between knocks:

    ffmpeg -i 556387_676927-hq.ogg -af "pan=mono|c0=0.5*c0+0.5*c1,highpass=f=70,anlmdn=s=0.0015:p=0.004:r=0.006" -c:a pcm_f32le denoised.wav

then each knock is cut from it, faded in over 3 ms and out over its last 45 %, and raised to a peak of −1 dBFS:

| File | From | Length | Gain |
|---|---|---|---|
| `move.ogg` | 7.012 s | 0.320 s | +4.27 dB |
| `capture.ogg` | 7.533 s | 0.442 s | −0.41 dB |
| `tick.ogg` | 7.533 s | 0.116 s | +15.56 dB |

    ffmpeg -ss 7.012 -t 0.32 -i denoised.wav -af "afade=t=in:d=0.003,afade=t=out:st=0.176:d=0.144:curve=exp,volume=4.27dB" -ac 1 -ar 44100 -c:a libvorbis -q:a 6 move.ogg

The other four are levelled by their RMS against the move (RMS −29.5 dBFS), then mixed where two pieces
make one sound, faded out over their last 80 ms at most:

| File | Pieces and their RMS level |
|---|---|
| `castle.ogg` | the slide at −30 dBFS; `move.ogg` as it is, 0.26 s later |
| `check.ogg` | the snap at −27 dBFS |
| `mate.ogg` | `capture.ogg` as it is; `bong_001` at −24 dBFS, 0.12 s later |
| `illegal.ogg` | `error_004` at −28 dBFS |

| File | SHA-256 |
|---|---|
| `move.ogg` | `e2d922c0a7faf498f15122eb5fbb54272e5d99869f2e2ec4cbc9d197ac6cbf21` |
| `capture.ogg` | `f06273daf80a3845f3332ab41cf6b2ce6690e0ee2731bb4f56a0c78abfc7d0b3` |
| `tick.ogg` | `01b86216b54f1d3c5a143241763c664eb282813d69a1adcf915400f6288d1d10` |
| `castle.ogg` | `2486ec00b4274ce4a00c5c6e5a8709700806c9de3a843f21a9960498e1d3938c` |
| `check.ogg` | `d0105921eb8aa271e5ef9b7172c897070b75a605e46c7bdf8b2d154f5d4cb0e5` |
| `mate.ogg` | `bf1a2cdde1ad7ebf21db3ad84b77994d329802d3b941c982afb600937f21ae9e` |
| `illegal.ogg` | `b69e0729b16d38afc84266c47e597f5359c562e26050481cf863c4024fa4c685` |
