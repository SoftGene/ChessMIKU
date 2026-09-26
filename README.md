# ChessMIKU

Free post-game review for finished chess.com games: a browser extension analyses the game with
Stockfish in your own browser, and a .NET backend stores the review and turns the engine numbers
into plain-language explanations.

Status: version 1, for the author and friends.

## How it works

1. The extension adds a review button to a finished game on chess.com.
2. Stockfish (WebAssembly) evaluates every move in the user's browser.
3. The backend classifies the moves the way chess.com does (brilliant, great, best, excellent,
   good, book, inaccuracy, mistake, miss, blunder), stores the game in MS SQL and asks a language model to
   explain the three worst moments.
4. The panel shows the evaluation graph, move badges and an interactive board with the engine's
   best-move arrow.

The engine only analyses games that are already over. The extension never helps during play.

## Stack

- Extension: TypeScript, Manifest V3, chessground, chess.js, stockfish.wasm
- Backend: .NET 10, ASP.NET Core, EF Core, MS SQL, xUnit, Docker

## Install the extension

### From a release

1. Download `chessmiku-<version>.zip` from
   [Releases](https://github.com/SoftGene/ChessMIKU/releases) and unzip it.
2. Open `chrome://extensions` and switch on **Developer mode**.
3. **Load unpacked** and choose the unzipped folder.

### From the source

Needs Node.js 24 and Chrome (or another Chromium browser).

```bash
npm --prefix extension ci
CHESS_REVIEW_API=https://review.example.org npm --prefix extension run build
```

`CHESS_REVIEW_API` is the backend the extension asks, an `https://` origin. Without it the build
asks the local backend, `http://127.0.0.1:8080`. The address goes into the service worker and into
the host permissions of `extension/dist/manifest.json`.

Then in Chrome:

1. Open `chrome://extensions` and switch on **Developer mode**.
2. **Load unpacked** and choose `extension/dist`.
3. Open a finished game on chess.com (`https://www.chess.com/game/live/...`) and press
   **Review game**.

After a new build, press the reload button on the extension's card.

## Run the backend

Needs Docker.

```bash
cp .env.example .env               # then set MSSQL_SA_PASSWORD and GEMINI_API_KEY
docker compose up --wait --build
curl http://localhost:8080/healthz # Healthy
```

The API applies database migrations on startup. SQL Server runs in the Express edition and
listens on `127.0.0.1:1433` only.

Explanations come from Gemini. A background service in the API takes queued analyses one at a
time and asks the model to explain the three worst errors of the game, with up to three attempts
each. The model gets only the engine's data: the move, the best move, the evaluations, the class
and the position in FEN. Get a key in [Google AI Studio](https://aistudio.google.com/apikey). The
models are `Gemini:Models` in `appsettings.json`, asked in turn: when one is at its limit or
overloaded, the next one answers. On the free tier each model allows 5 requests a minute and 20 a
day, so the worker waits 13 seconds between requests.

The extension registers once with `POST /api/installs` and sends the issued id as
`X-Install-Id`. Limits live in `backend/ChessReview.Api/appsettings.json`; environment
variables override them, for example `Quotas__AnalysesPerDay=50`.

| Setting | Default | Limits |
|---|---|---|
| `Quotas:AnalysesPerDay` | 5 | analyses a day per installation that need new explanations; answers from the cache are free |
| `RateLimiting:Registrations` | 5 an hour | registrations per client address |
| `RateLimiting:Requests` | 60 a minute | requests per installation |

To run the API from Visual Studio against that database, keep the connection string and the
Gemini key in user secrets:

```bash
dotnet user-secrets set ConnectionStrings:ChessReview "Server=localhost,1433;Database=ChessReview;User Id=sa;Password=<password>;TrustServerCertificate=True" --project backend/ChessReview.Api
dotnet user-secrets set Gemini:ApiKey "<key>" --project backend/ChessReview.Api
```

The tests need Docker as well: `dotnet test backend/ChessReview.sln` starts SQL Server in
containers.

## Run on the home server

The server runs the same compose file plus `docker-compose.tunnel.yml`: cloudflared connects out to
Cloudflare, and Cloudflare serves the API over HTTPS. The server opens no ports.

1. In Cloudflare Zero Trust, **Networks → Tunnels → Create a tunnel** (Cloudflared). Copy the token
   from the Docker install command into `.env` as `CLOUDFLARE_TUNNEL_TOKEN`.
2. In the tunnel, add a **public hostname**, for example `review.example.org`, with the service
   `http://api:8080`.
3. On the server:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d --wait --build
   curl https://review.example.org/healthz   # Healthy
   ```

4. Build the extension with `CHESS_REVIEW_API=https://review.example.org`.

Every request reaches the API from cloudflared, so the API takes the client address from the
`CF-Connecting-IP` header that Cloudflare sets, and only from the address in
`ForwardedHeaders:KnownProxies`: cloudflared's fixed address in the tunnel network. Without that
setting the API ignores the header. The registration limit counts by this address.

To update: `git pull`, then the same `up` command. The database lives in the `mssql-data` volume.

## Releasing

By hand, from an up-to-date `main`:

1. Build for the server:
   `CHESS_REVIEW_API=https://chessmiku.softgene.dev npm --prefix extension run build`.
   `extension/dist/manifest.json` should show the new version and the server in `host_permissions`.
2. Zip the contents of `extension/dist`, not the folder: `manifest.json` must be at the root of the
   archive. Keep the archive outside the repository. In PowerShell:
   ```powershell
   Push-Location extension\dist; tar.exe -a -cf $HOME\Desktop\chessmiku-1.0.1.zip *; Pop-Location
   ```
   Not `Compress-Archive`: in Windows PowerShell 5.1 it writes paths with backslashes
   (`icons\icon-16.png`), which other systems and the Chrome Web Store read as file names, not
   folders. Check with `tar.exe -tf <zip>`: the paths must use `/`.
3. Tag the commit and push the tag: `git tag v1.0.1`, `git push origin v1.0.1`.
4. On GitHub: **Releases** → **Draft a new release** → the tag, a title, notes, the zip attached →
   **Publish release**. The same zip goes to the Chrome Web Store.

The version comes from `extension/public/manifest.json` and `extension/package.json`; raise both
before a release.

## Privacy

Only a finished game you choose to review leaves your browser: its PGN, the engine evaluations and an anonymous
installation ID go to the server, and the moves go on to Google Gemini for the explanations. The full policy:
https://softgene.github.io/ChessMIKU/privacy.html (source in `site/`, published by the `pages` workflow).

## Licence

Stockfish is GPL v3, so the extension that ships it is GPL v3 as well.
