# Chess Review

Free post-game review for finished chess.com games: a browser extension analyses the game with
Stockfish in your own browser, and a .NET backend stores the review and turns the engine numbers
into plain-language explanations.

Status: design done, implementation starting. See
`docs/superpowers/specs/2026-09-20-chess-review-design.md`.

## How it works

1. The extension adds a review button to a finished game on chess.com.
2. Stockfish (WebAssembly) evaluates every move in the user's browser.
3. The backend classifies the moves the way chess.com does (best, excellent, good, book,
   inaccuracy, mistake, miss, blunder), stores the game in MS SQL and asks a language model to
   explain the three worst moments.
4. The panel shows the evaluation graph, move badges and an interactive board with the engine's
   best-move arrow.

The engine only analyses games that are already over. The extension never helps during play.

## Stack

- Extension: TypeScript, Manifest V3, chessground, chess.js, stockfish.wasm
- Backend: .NET 10, ASP.NET Core, EF Core, MS SQL, xUnit, Docker

## Run the backend

Needs Docker.

```bash
cp .env.example .env               # then set MSSQL_SA_PASSWORD
docker compose up --wait --build
curl http://localhost:8080/healthz # Healthy
```

The API applies database migrations on startup. SQL Server runs in the Express edition and
listens on `127.0.0.1:1433` only.

To run the API from Visual Studio against that database, keep the connection string in user
secrets:

```bash
dotnet user-secrets set ConnectionStrings:ChessReview "Server=localhost,1433;Database=ChessReview;User Id=sa;Password=<password>;TrustServerCertificate=True" --project backend/ChessReview.Api
```

The tests need Docker as well: `dotnet test backend/ChessReview.sln` starts SQL Server in
containers.

## Licence

Stockfish is GPL v3, so the extension that ships it is GPL v3 as well.
