using ChessReview.Infrastructure.Persistence;
using ChessReview.Testing;
using Microsoft.EntityFrameworkCore;
using Testcontainers.MsSql;

[assembly: AssemblyFixture(typeof(ChessReview.Infrastructure.Tests.SqlServerFixture))]

namespace ChessReview.Infrastructure.Tests;

/// <summary>
/// One SQL Server container for the whole test assembly, migrated from scratch.
/// </summary>
public sealed class SqlServerFixture : IAsyncLifetime
{
    private MsSqlContainer? _container;

    public async ValueTask InitializeAsync()
    {
        _container = await SqlServerContainer.StartAsync();

        await using var db = CreateContext();
        await db.Database.MigrateAsync();
    }

    public ChessReviewDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<ChessReviewDbContext>().UseSqlServer(_container!.GetConnectionString()).Options);

    public ValueTask DisposeAsync() => _container?.DisposeAsync() ?? ValueTask.CompletedTask;
}
