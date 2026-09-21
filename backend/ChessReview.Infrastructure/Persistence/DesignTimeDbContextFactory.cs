using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ChessReview.Infrastructure.Persistence;

// Lets `dotnet ef migrations` build the model without starting the API: creating a migration
// needs the provider, not a database.
internal sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ChessReviewDbContext>
{
    public ChessReviewDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<ChessReviewDbContext>().UseSqlServer().Options);
}
