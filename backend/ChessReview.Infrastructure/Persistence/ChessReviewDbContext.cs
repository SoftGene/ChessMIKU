using Microsoft.EntityFrameworkCore;

namespace ChessReview.Infrastructure.Persistence;

public sealed class ChessReviewDbContext(DbContextOptions<ChessReviewDbContext> options) : DbContext(options)
{
    public DbSet<Game> Games => Set<Game>();

    public DbSet<Move> Moves => Set<Move>();

    public DbSet<Explanation> Explanations => Set<Explanation>();

    public DbSet<ExplanationJob> ExplanationJobs => Set<ExplanationJob>();

    public DbSet<Install> Installs => Set<Install>();

    public DbSet<UsageDaily> UsageDaily => Set<UsageDaily>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ChessReviewDbContext).Assembly);
}
