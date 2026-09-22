using System.ComponentModel.DataAnnotations;
using ChessReview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ChessReview.Api.Limits;

public sealed class QuotaOptions
{
    public const string Section = "Quotas";

    /// <summary>Analyses a day, per installation, that queue new explanations.</summary>
    [Range(1, int.MaxValue)]
    public int AnalysesPerDay { get; set; }
}

/// <summary>
/// Counts analyses that give the language model new work, per installation and UTC day.
/// Answers from the cache cost nothing and are not counted.
/// </summary>
public sealed class DailyQuota(ChessReviewDbContext db, TimeProvider time, IOptions<QuotaOptions> options)
{
    /// <summary>
    /// Counts one analysis unless the quota for today is used up. Call it inside the transaction
    /// that stores the analysis, before the analysis is stored: a failed request takes its count
    /// back, and every request of an installation locks its count first, then its game, so
    /// simultaneous requests wait for each other instead of deadlocking.
    /// </summary>
    public async Task<bool> TryCountAsync(Guid installId, CancellationToken cancellationToken)
    {
        var today = Today();
        var limit = options.Value.AnalysesPerDay;

        // Today's row exists before anyone counts. UPDLOCK and HOLDLOCK make simultaneous first
        // requests of the day wait for one insert instead of colliding on the key.
        await db.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO UsageDaily (InstallId, Date, AnalysisCount)
            SELECT {installId}, {today}, 0
            WHERE NOT EXISTS (
                SELECT 1 FROM UsageDaily WITH (UPDLOCK, HOLDLOCK)
                WHERE InstallId = {installId} AND Date = {today})
            """,
            cancellationToken);

        // Check and count in one statement: simultaneous requests cannot both take the last analysis.
        var counted = await db.UsageDaily
            .Where(u => u.InstallId == installId && u.Date == today && u.AnalysisCount < limit)
            .ExecuteUpdateAsync(u => u.SetProperty(usage => usage.AnalysisCount, usage => usage.AnalysisCount + 1), cancellationToken);

        return counted == 1;
    }

    /// <summary>Time until the quota resets at 00:00 UTC.</summary>
    public TimeSpan UntilReset() => new DateTimeOffset(Today().AddDays(1), TimeOnly.MinValue, TimeSpan.Zero) - time.GetUtcNow();

    private DateOnly Today() => DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime);
}
