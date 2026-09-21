using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChessReview.Infrastructure.Persistence;

public sealed class Explanation
{
    public int Id { get; set; }

    public int GameId { get; set; }

    public short Ply { get; set; }

    /// <summary>ru, cs or en.</summary>
    public required string Language { get; set; }

    public required string Text { get; set; }

    /// <summary>Language model that wrote the text.</summary>
    public required string Model { get; set; }

    public DateTime CreatedAt { get; set; }
}

internal sealed class ExplanationConfiguration : IEntityTypeConfiguration<Explanation>
{
    public void Configure(EntityTypeBuilder<Explanation> explanation)
    {
        explanation.Property(e => e.Language).HasMaxLength(2).IsUnicode(false);
        explanation.Property(e => e.Text).HasMaxLength(2000);
        explanation.Property(e => e.Model).HasMaxLength(64).IsUnicode(false);
        explanation.Property(e => e.CreatedAt).HasDefaultValueSql(SqlConstraints.UtcNow);

        explanation.HasIndex(e => new { e.GameId, e.Ply, e.Language }).IsUnique();
        explanation.HasOne<Game>().WithMany().HasForeignKey(e => e.GameId);

        explanation.ToTable(table =>
            table.HasCheckConstraint("CK_Explanations_Language", SqlConstraints.In("Language", SqlConstraints.Languages)));
    }
}
