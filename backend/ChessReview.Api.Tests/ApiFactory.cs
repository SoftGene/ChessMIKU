using ChessReview.Infrastructure.Llm;
using ChessReview.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;
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

    /// <summary>A connection string to a database of its own on the same server.</summary>
    public string ConnectionString(string database) =>
        new SqlConnectionStringBuilder(_sql!.GetConnectionString()) { InitialCatalog = database }.ConnectionString;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:ChessReview", ConnectionString("ChessReview"));
        builder.UseSetting("Database:MigrateOnStartup", "true");

        // The worker would change analyses under the tests' feet: tests run it themselves.
        builder.UseSetting("ExplanationWorker:Enabled", "false");

        // Never used: the stub replaces the Gemini client, and no HttpClient reaches the network.
        builder.UseSetting("Gemini:ApiKey", "not-a-key-tests-never-call-gemini");
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<ILlmClient>(new StubLlmClient());
            services.ConfigureHttpClientDefaults(http => http.ConfigurePrimaryHttpMessageHandler(() => new NoNetworkHandler()));
        });

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
