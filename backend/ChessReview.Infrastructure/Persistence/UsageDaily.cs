using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChessReview.Infrastructure.Persistence;

/// <summary>Usage of one installation on one day (UTC), for the daily quota.</summary>
public sealed class UsageDaily
{
    public Guid InstallId { get; set; }

    public DateOnly Date { get; set; }

    public int AnalysisCount { get; set; }

    public int ExplanationCount { get; set; }
}

internal sealed class UsageDailyConfiguration : IEntityTypeConfiguration<UsageDaily>
{
    public void Configure(EntityTypeBuilder<UsageDaily> usage)
    {
        usage.HasKey(u => new { u.InstallId, u.Date });
        usage.HasOne<Install>().WithMany().HasForeignKey(u => u.InstallId).HasPrincipalKey(i => i.InstallId);
    }
}
