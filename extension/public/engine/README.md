# Stockfish in this extension

The engine files here are Stockfish.js 19, the lite single-threaded build, copied unchanged from
the npm package `stockfish` 19.0.0:

| File | SHA-256 |
|---|---|
| `stockfish-19-lite-single.js` | `d3344124ab067fb0b90ee77873bb8e9fbf5fc01bc525fe714b0f942581e889e6` |
| `stockfish-19-lite-single.wasm` | `57ac2d72312aba346760e3f173f687a8c211208e97a87268436f7f0e10bb5387` |

The package tarball matched its npm integrity
`sha512-jDyYLbqNpboQcMs5HodTHI2CrKL74zkQWb1+sgoNXw5HI6avTblW4G0X7afFt3BBOc6VbTSkOV64EUxm/DWSpg==`.

Why this build: the multi-threaded builds need a cross-origin isolated page, which the panel
inside a chess.com page cannot be, and the full network weighs 99 MB against 1.8 MB.

## License and source

Stockfish and Stockfish.js are free software under the GNU General Public License v3
(`Copying.txt`). So is this extension. Source code:

- Stockfish.js 19: https://github.com/nmrugg/stockfish.js (tag v19.0.0)
- Stockfish: https://github.com/official-stockfish/Stockfish
- this extension: https://github.com/SoftGene/ChessMIKU
