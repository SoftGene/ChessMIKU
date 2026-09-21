using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChessReview.Infrastructure.Persistence;

public sealed class Install
{
    public int Id { get; set; }

    /// <summary>Anonymous identifier issued to the extension, sent as X-Install-Id.</summary>
    public Guid InstallId { get; set; }

    public DateTime CreatedAt { get; set; }
}

internal sealed class InstallConfiguration : IEntityTypeConfiguration<Install>
{
    public void Configure(EntityTypeBuilder<Install> install)
    {
        install.Property(i => i.CreatedAt).HasDefaultValueSql(SqlConstraints.UtcNow);

        // Unique, and the key UsageDaily refers to.
        install.HasAlternateKey(i => i.InstallId);
    }
}
