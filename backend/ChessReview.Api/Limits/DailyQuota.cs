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
    /// that stores the analysis, so that a failed request takes its count back.
    /// </summary>
    public async Task<bool> TryCountAsync(Guid installId, CancellationToken cancellationToken)
    {
        var today = Today();
        var limit = options.Value.AnalysesPerDay;

        // Check and count in one statement: simultaneous requests cannot both take the last analysis.
        var counted = await db.UsageDaily
            .Where(u => u.InstallId == installId && u.Date == today && u.AnalysisCount < limit)
            .ExecuteUpdateAsync(u => u.SetProperty(usage => usage.AnalysisCount, usage => usage.AnalysisCount + 1), cancellationToken);

        if (counted == 1)
        {
            return true;
        }

        if (await db.UsageDaily.AnyAsync(u => u.InstallId == installId && u.Date == today, cancellationToken))
        {
            return false;
        }

        // The first analysis today, saved with the analysis. A simultaneous first one fails to save with a duplicate key.
        db.UsageDaily.Add(new UsageDaily { InstallId = installId, Date = today, AnalysisCount = 1 });
        return true;
    }

    /// <summary>Time until the quota resets at 00:00 UTC.</summary>
    public TimeSpan UntilReset() => new DateTimeOffset(Today().AddDays(1), TimeOnly.MinValue, TimeSpan.Zero) - time.GetUtcNow();

    private DateOnly Today() => DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime);
}
