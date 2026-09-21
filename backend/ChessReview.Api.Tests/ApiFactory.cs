using ChessReview.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Testcontainers.MsSql;

[assembly: AssemblyFixture(typeof(ChessReview.Api.Tests.ApiFactory))]

namespace ChessReview.Api.Tests;

/// <summary>
/// The API with its own SQL Server container, migrating the database on startup as it does in
/// docker-compose.yml.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly MsSqlContainer _sql = SqlServerContainer.Create();

    public async ValueTask InitializeAsync()
    {
        await _sql.StartAsync();

        // Start the host, and so migrate, once before any test runs: the factory is not safe
        // for concurrent first use, and two hosts would race to create the database.
        _ = Services;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        var connectionString = new SqlConnectionStringBuilder(_sql.GetConnectionString()) { InitialCatalog = "ChessReview" };

        builder.UseSetting("ConnectionStrings:ChessReview", connectionString.ConnectionString);
        builder.UseSetting("Database:MigrateOnStartup", "true");
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        await _sql.DisposeAsync();
    }
}
