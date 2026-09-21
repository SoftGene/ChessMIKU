using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChessReview.Infrastructure.Persistence;

public sealed class Game
{
    public int Id { get; set; }

    /// <summary>Type and number of the game on chess.com, for example live/123456789012. Cache key.</summary>
    public required string ExternalGameId { get; set; }

    public required string Pgn { get; set; }

    public required string WhiteUser { get; set; }

    public required string BlackUser { get; set; }

    public DateTime? PlayedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public List<Move> Moves { get; } = [];

    public List<ExplanationJob> ExplanationJobs { get; } = [];
}

internal sealed class GameConfiguration : IEntityTypeConfiguration<Game>
{
    public void Configure(EntityTypeBuilder<Game> game)
    {
        game.Property(g => g.ExternalGameId).HasMaxLength(32).IsUnicode(false);
        game.Property(g => g.WhiteUser).HasMaxLength(64);
        game.Property(g => g.BlackUser).HasMaxLength(64);
        game.Property(g => g.CreatedAt).HasDefaultValueSql(SqlConstraints.UtcNow);

        game.HasIndex(g => g.ExternalGameId).IsUnique();
        game.HasMany(g => g.Moves).WithOne().HasForeignKey(m => m.GameId);
        game.HasMany(g => g.ExplanationJobs).WithOne().HasForeignKey(j => j.GameId);
    }
}
