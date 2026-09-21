using ChessReview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.MsSql;

[assembly: AssemblyFixture(typeof(ChessReview.Infrastructure.Tests.SqlServerFixture))]

namespace ChessReview.Infrastructure.Tests;

/// <summary>
/// One SQL Server container for the whole test assembly, migrated from scratch.
/// </summary>
public sealed class SqlServerFixture : IAsyncLifetime
{
    // Keep in step with the mssql image in docker-compose.yml.
    public const string Image = "mcr.microsoft.com/mssql/server:2025-CU9-ubuntu-24.04";

    private readonly MsSqlContainer _container = new MsSqlBuilder(Image).Build();

    public async ValueTask InitializeAsync()
    {
        await _container.StartAsync();

        await using var db = CreateContext();
        await db.Database.MigrateAsync();
    }

    public ChessReviewDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<ChessReviewDbContext>().UseSqlServer(_container.GetConnectionString()).Options);

    public ValueTask DisposeAsync() => _container.DisposeAsync();
}
