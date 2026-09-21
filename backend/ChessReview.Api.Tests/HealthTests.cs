using System.Net;
using Microsoft.AspNetCore.Hosting;

namespace ChessReview.Api.Tests;

public class HealthTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Healthz_is_healthy_when_the_database_answers()
    {
        using var client = api.CreateClient();

        using var response = await client.GetAsync("/healthz", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync(Ct));
    }

    [Fact]
    public async Task Healthz_is_unhealthy_when_the_database_does_not_answer()
    {
        // Nothing listens on port 1.
        using var withoutDatabase = api.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("ConnectionStrings:ChessReview", "Server=127.0.0.1,1;Database=ChessReview;User Id=sa;Password=unused;Connect Timeout=2;TrustServerCertificate=True");
            builder.UseSetting("Database:MigrateOnStartup", "false");
        });
        using var client = withoutDatabase.CreateClient();

        using var response = await client.GetAsync("/healthz", Ct);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("Unhealthy", await response.Content.ReadAsStringAsync(Ct));
    }
}
