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
    private MsSqlContainer? _sql;

    /// <summary>A registered installation, for tests that are not about installations.</summary>
    public Guid InstallId { get; private set; }

    public async ValueTask InitializeAsync()
    {
        _sql = await SqlServerContainer.StartAsync();

        // Start the host, and so migrate, once before any test runs: the factory is not safe
        // for concurrent first use, and two hosts would race to create the database.
        _ = Services;

        InstallId = await this.NewInstallAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        var connectionString = new SqlConnectionStringBuilder(_sql!.GetConnectionString()) { InitialCatalog = "ChessReview" };

        builder.UseSetting("ConnectionStrings:ChessReview", connectionString.ConnectionString);
        builder.UseSetting("Database:MigrateOnStartup", "true");

        // All tests share this host and its installation: only the tests about limits, each on
        // a host of its own, may reach them.
        builder.UseSetting("Quotas:AnalysesPerDay", "1000000");
        builder.UseSetting("RateLimiting:Registrations:PermitLimit", "1000000");
        builder.UseSetting("RateLimiting:Requests:PermitLimit", "1000000");
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();

        if (_sql is not null)
            await _sql.DisposeAsync();
    }
}
