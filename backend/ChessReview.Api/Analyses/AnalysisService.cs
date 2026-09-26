using System.Globalization;
using ChessReview.Api.Limits;
using ChessReview.Domain;
using ChessReview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ChessReview.Api.Analyses;

public abstract record CreateAnalysisResult
{
    public sealed record Accepted(AnalysisAccepted Analysis, bool FromCache) : CreateAnalysisResult;

    public sealed record QuotaExceeded(TimeSpan RetryAfter) : CreateAnalysisResult;
}

public sealed class AnalysisService(ChessReviewDbContext db, DailyQuota quota)
{
    /// <summary>
    /// Classifies and stores a new game, or reuses the stored one: a game is classified once,
    /// and each language gets one analysis whose explanations are generated once. Only
    /// explanations still to generate count against the daily quota of the installation.
    /// </summary>
    public async Task<CreateAnalysisResult> CreateAsync(Guid installId, CreateAnalysisRequest request, CancellationToken cancellationToken)
    {
        try
        {
            return await FindOrCreateAsync(installId, request, cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.IsDuplicateKey())
        {
            // A simultaneous request stored the same game or analysis first: use what it stored.
            db.ChangeTracker.Clear();
            return await FindOrCreateAsync(installId, request, cancellationToken);
        }
    }

    private async Task<CreateAnalysisResult> FindOrCreateAsync(Guid installId, CreateAnalysisRequest request, CancellationToken cancellationToken)
    {
        // The quota count and the analysis it pays for are stored together or not at all.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var language = LanguageCode(request.Language);

        var game = await db.Games
            .Include(g => g.Moves)
            .Include(g => g.ExplanationJobs.Where(j => j.Language == language))
            .SingleOrDefaultAsync(g => g.ExternalGameId == request.ExternalGameId, cancellationToken);

        var job = game?.ExplanationJobs.SingleOrDefault(j => j.Language == language);
        var fromCache = job?.Status == ExplanationJobStatus.Ready;

        // Only new work for the model counts: a new game, a new language, explanations that failed.
        var queuesExplanations = job is null || job.Status == ExplanationJobStatus.Failed;
        if (queuesExplanations && !await quota.TryCountAsync(installId, cancellationToken))
        {
            return new CreateAnalysisResult.QuotaExceeded(quota.UntilReset());
        }

        if (game is null)
        {
            game = NewGame(request);
            db.Games.Add(game);
        }
        else if (game.ClassifierVersion < MoveClassifier.Version)
        {
            ClassifyAgain(game, request);
        }

        if (job is null)
        {
            job = new ExplanationJob { Language = language };
            game.ExplanationJobs.Add(job);
        }
        else if (job.Status == ExplanationJobStatus.Failed)
        {
            // The contract has no failed status for a new request: queue the explanations again.
            job.Status = ExplanationJobStatus.Pending;
            job.Attempts = 0;
            job.LastError = null;
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new CreateAnalysisResult.Accepted(Accepted(game, job, fromCache), fromCache);
    }

    /// <summary>
    /// The analysis with its classifications, and its explanations once all of them are ready.
    /// Null when there is no such analysis.
    /// </summary>
    public async Task<AnalysisResult?> FindAsync(Guid analysisId, CancellationToken cancellationToken)
    {
        var job = await db.ExplanationJobs.AsNoTracking().SingleOrDefaultAsync(j => j.Id == analysisId, cancellationToken);
        if (job is null)
        {
            return null;
        }

        var classifications = await db.Moves.AsNoTracking()
            .Where(m => m.GameId == job.GameId)
            .OrderBy(m => m.Ply)
            .Select(m => new MoveClassificationResult(m.Ply, m.Classification))
            .ToListAsync(cancellationToken);

        // The worker may store explanations one by one: publish them only together.
        List<ExplanationResult> explanations = job.Status == ExplanationJobStatus.Ready
            ? await db.Explanations.AsNoTracking()
                .Where(e => e.GameId == job.GameId && e.Language == job.Language)
                .OrderBy(e => e.Ply)
                .Select(e => new ExplanationResult(e.Ply, e.Text))
                .ToListAsync(cancellationToken)
            : [];

        return new AnalysisResult(Status(job.Status), classifications, explanations);
    }

    private static AnalysisStatus Status(ExplanationJobStatus status) => status switch
    {
        ExplanationJobStatus.Pending => AnalysisStatus.Pending,
        ExplanationJobStatus.Ready => AnalysisStatus.Ready,
        ExplanationJobStatus.Failed => AnalysisStatus.Failed,
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, null),
    };

    private static AnalysisAccepted Accepted(Game game, ExplanationJob job, bool ready) => new(
        job.Id,
        [.. game.Moves.OrderBy(m => m.Ply).Select(m => new MoveClassificationResult(m.Ply, m.Classification))],
        ready ? ExplanationsStatus.Ready : ExplanationsStatus.Pending);

    private static Game NewGame(CreateAnalysisRequest request)
    {
        var pgn = PgnGame.Parse(request.Pgn);
        var classes = MoveClassifier.ClassifyGame([.. request.Moves.Select(ToEvaluation)], OpeningBook.Lichess);

        var game = new Game
        {
            ExternalGameId = request.ExternalGameId,
            Pgn = request.Pgn,
            WhiteUser = pgn.Tag("White") ?? "",
            BlackUser = pgn.Tag("Black") ?? "",
            PlayedAt = PlayedAt(pgn),
            ClassifierVersion = MoveClassifier.Version,
        };

        game.Moves.AddRange(request.Moves.Select((move, index) => new Move
        {
            Ply = (short)move.Ply,
            San = move.San,
            Uci = move.Uci,
            BestMoveUci = move.BestMoveUci,
            EvalBeforeCp = move.EvalBeforeCp,
            MateBefore = (short?)move.MateBefore,
            EvalAfterCp = move.EvalAfterCp,
            MateAfter = (short?)move.MateAfter,
            SecondBestCp = move.SecondBestEvalCp,
            SecondBestMate = (short?)move.SecondBestMate,
            Classification = classes[index],
        }));

        return game;
    }

    // A game classified by an older classifier: the evaluations of this request (the same moves, the PGN matched
    // them) replace the stored ones, and the moves are classified anew. Its explanations stay.
    private static void ClassifyAgain(Game game, CreateAnalysisRequest request)
    {
        var classes = MoveClassifier.ClassifyGame([.. request.Moves.Select(ToEvaluation)], OpeningBook.Lichess);
        var stored = game.Moves.ToDictionary(m => (int)m.Ply);
        foreach (var (move, index) in request.Moves.Select((move, index) => (move, index)))
        {
            var row = stored[move.Ply];
            row.BestMoveUci = move.BestMoveUci;
            row.EvalBeforeCp = move.EvalBeforeCp;
            row.MateBefore = (short?)move.MateBefore;
            row.EvalAfterCp = move.EvalAfterCp;
            row.MateAfter = (short?)move.MateAfter;
            row.SecondBestCp = move.SecondBestEvalCp;
            row.SecondBestMate = (short?)move.SecondBestMate;
            row.Classification = classes[index];
        }

        game.ClassifierVersion = MoveClassifier.Version;
    }

    private static MoveEvaluation ToEvaluation(MoveEvaluationRequest move) => new(
        move.Ply,
        move.Uci,
        move.BestMoveUci,
        Score(move.EvalBeforeCp, move.MateBefore),
        Score(move.EvalAfterCp, move.MateAfter),
        move.SecondBestEvalCp is null && move.SecondBestMate is null ? null : Score(move.SecondBestEvalCp, move.SecondBestMate));

    private static EngineScore Score(int? centipawns, int? mateIn) =>
        centipawns is { } value ? EngineScore.FromCentipawns(value) : EngineScore.FromMateIn(mateIn!.Value);

    // chess.com writes the start of the game as UTCDate "2026.09.20" and UTCTime "18:47:52".
    private static DateTime? PlayedAt(PgnGame pgn) =>
        DateTime.TryParseExact(
            $"{pgn.Tag("UTCDate")} {pgn.Tag("UTCTime")}",
            "yyyy.MM.dd HH:mm:ss",
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out var playedAt)
            ? playedAt
            : null;

    private static string LanguageCode(Language language) => language.ToString().ToLowerInvariant();
}
