using ChessReview.Domain;
using ChessReview.Infrastructure.Llm;
using ChessReview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChessReview.ExplanationWorker;

public enum JobOutcome
{
    /// <summary>No pending job.</summary>
    None,

    Ready,

    /// <summary>The attempt failed; the job stays pending for another one.</summary>
    Retry,

    /// <summary>The last attempt failed; the job is failed.</summary>
    Failed,
}

/// <summary>
/// Writes the explanations of one analysis: the worst errors of the game, in the language of
/// the analysis, once per move.
/// </summary>
public sealed class ExplanationWriter(ChessReviewDbContext db, ILlmClient llm, ILogger<ExplanationWriter> logger)
{
    public const int MaxAttempts = 3;

    public async Task<JobOutcome> ProcessNextAsync(CancellationToken cancellationToken)
    {
        var next = await db.ExplanationJobs
            .Where(j => j.Status == ExplanationJobStatus.Pending)
            .OrderBy(j => j.CreatedAt)
            .Select(j => (Guid?)j.Id)
            .FirstOrDefaultAsync(cancellationToken);

        return next is { } jobId ? await ProcessAsync(jobId, cancellationToken) : JobOutcome.None;
    }

    public async Task<JobOutcome> ProcessAsync(Guid jobId, CancellationToken cancellationToken)
    {
        var job = await db.ExplanationJobs.SingleAsync(j => j.Id == jobId, cancellationToken);
        if (job.Status != ExplanationJobStatus.Pending)
        {
            return JobOutcome.None;
        }

        var game = await db.Moves.AsNoTracking().Where(m => m.GameId == job.GameId).OrderBy(m => m.Ply).ToListAsync(cancellationToken);
        var worst = WorstMoves.Pick([.. game.Select(Evaluation)], [.. game.Select(m => m.Classification)]);

        // A requeued analysis keeps what it already has: every move is explained once per language.
        var explained = await db.Explanations
            .Where(e => e.GameId == job.GameId && e.Language == job.Language)
            .Select(e => (int)e.Ply)
            .ToListAsync(cancellationToken);
        List<int> plies = [.. worst.Except(explained)];

        if (plies.Count > 0)
        {
            try
            {
                var reply = await llm.GenerateJsonAsync(ExplanationPrompt.Build(job.Language, game, plies), cancellationToken);
                db.Explanations.AddRange(ExplanationPrompt.ParseReply(reply.Text, plies).Select(text => new Explanation
                {
                    GameId = job.GameId,
                    Ply = (short)text.Key,
                    Language = job.Language,
                    Text = text.Value,
                    Model = reply.Model,
                }));
            }
            catch (Exception exception) when (exception is LlmException or HttpRequestException
                || (exception is OperationCanceledException && !cancellationToken.IsCancellationRequested))
            {
                return await FailAttemptAsync(job, exception.Message, cancellationToken);
            }
        }

        job.Status = ExplanationJobStatus.Ready;
        await db.SaveChangesAsync(cancellationToken);
        return JobOutcome.Ready;
    }

    private async Task<JobOutcome> FailAttemptAsync(ExplanationJob job, string error, CancellationToken cancellationToken)
    {
        job.Attempts++;
        job.LastError = error.Length <= 2000 ? error : error[..2000];
        job.Status = job.Attempts >= MaxAttempts ? ExplanationJobStatus.Failed : ExplanationJobStatus.Pending;
        await db.SaveChangesAsync(cancellationToken);

        logger.LogWarning("Explanations of analysis {AnalysisId}, attempt {Attempt} of {MaxAttempts}, failed: {Error}", job.Id, job.Attempts, MaxAttempts, error);
        return job.Status == ExplanationJobStatus.Failed ? JobOutcome.Failed : JobOutcome.Retry;
    }

    private static MoveEvaluation Evaluation(Move move) => new(
        move.Ply,
        move.Uci,
        move.BestMoveUci,
        Score(move.EvalBeforeCp, move.MateBefore),
        Score(move.EvalAfterCp, move.MateAfter),
        move.SecondBestCp is null && move.SecondBestMate is null ? null : Score(move.SecondBestCp, move.SecondBestMate));

    private static EngineScore Score(int? centipawns, short? mateIn) =>
        centipawns is { } value ? EngineScore.FromCentipawns(value) : EngineScore.FromMateIn(mateIn!.Value);
}
