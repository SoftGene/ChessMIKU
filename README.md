# Chess Review

Free post-game review for finished chess.com games: a browser extension analyses the game with
Stockfish in your own browser, and a .NET backend stores the review and turns the engine numbers
into plain-language explanations.

Status: design done, implementation starting. See
`docs/superpowers/specs/2026-09-20-chess-review-design.md`.

## How it works

1. The extension adds a review button to a finished game on chess.com.
2. Stockfish (WebAssembly) evaluates every move in the user's browser.
3. The backend classifies the moves (blunder, mistake, inaccuracy, good, best), stores the game
   in MS SQL and asks a language model to explain the three worst moments.
4. The panel shows the evaluation graph, move badges and an interactive board with the engine's
   best-move arrow.

The engine only analyses games that are already over. The extension never helps during play.

## Stack

- Extension: TypeScript, Manifest V3, chessground, chess.js, stockfish.wasm
- Backend: .NET 10, ASP.NET Core, EF Core, MS SQL, xUnit, Docker

## Licence

Stockfish is GPL v3, so the extension that ships it is GPL v3 as well.
