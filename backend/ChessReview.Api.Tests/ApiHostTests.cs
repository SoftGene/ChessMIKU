using System.Net;
using ChessReview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ChessReview.Api.Tests;

public class ApiHostTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    // The factory runs the host in the Development environment, where the service container
    // validates every registration on build: a broken registration fails this test.
    [Fact]
    public async Task Host_starts_and_serves_requests()
    {
        using var client = api.CreateClient();

        using var response = await client.GetAsync("/no-such-endpoint", Ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Startup_applies_every_migration()
    {
        await using var scope = api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ChessReviewDbContext>();

        Assert.NotEmpty(await db.Database.GetAppliedMigrationsAsync(Ct));
        Assert.Empty(await db.Database.GetPendingMigrationsAsync(Ct));
    }
}
