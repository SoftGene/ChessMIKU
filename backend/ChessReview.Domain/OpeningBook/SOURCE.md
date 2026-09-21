# Opening book data

`lichess-openings.tsv` is generated from the Lichess opening list:

- Source: https://github.com/lichess-org/chess-openings, commit `c67912be581f0793dbaa776be5ccf111e01f88d9`
- License: CC0 1.0 Universal (public domain dedication)
- Columns: ECO code, opening name, moves in UCI notation (converted from the PGN of the source)

Do not edit the file by hand. Rebuild it with `tools/opening-book` (see `build.mjs`).
