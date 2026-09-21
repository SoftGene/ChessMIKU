using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChessReview.Infrastructure.Persistence;

/// <summary>
/// The analysis of one game in one language, and the queue entry for its explanations.
/// <see cref="Id"/> is the analysisId of the API contract.
/// </summary>
public sealed class ExplanationJob
{
    public Guid Id { get; set; }

    public int GameId { get; set; }

    /// <summary>ru, cs or en.</summary>
    public required string Language { get; set; }

    public ExplanationJobStatus Status { get; set; }

    public int Attempts { get; set; }

    public string? LastError { get; set; }

    public DateTime CreatedAt { get; set; }
}

public enum ExplanationJobStatus
{
    Pending,
    Ready,
    Failed,
}

internal sealed class ExplanationJobConfiguration : IEntityTypeConfiguration<ExplanationJob>
{
    public void Configure(EntityTypeBuilder<ExplanationJob> job)
    {
        job.Property(j => j.Language).HasMaxLength(2).IsUnicode(false);
        job.Property(j => j.Status).HasConversion<string>().HasMaxLength(16).IsUnicode(false);
        job.Property(j => j.LastError).HasMaxLength(2000);
        job.Property(j => j.CreatedAt).HasDefaultValueSql(SqlConstraints.UtcNow);

        job.HasIndex(j => new { j.GameId, j.Language }).IsUnique();
        job.HasIndex(j => new { j.Status, j.CreatedAt });

        job.ToTable(table =>
        {
            table.HasCheckConstraint("CK_ExplanationJobs_Language", SqlConstraints.In("Language", SqlConstraints.Languages));
            table.HasCheckConstraint("CK_ExplanationJobs_Status", SqlConstraints.In("Status", Enum.GetNames<ExplanationJobStatus>()));
            table.HasCheckConstraint("CK_ExplanationJobs_Attempts", "[Attempts] >= 0");
        });
    }
}
