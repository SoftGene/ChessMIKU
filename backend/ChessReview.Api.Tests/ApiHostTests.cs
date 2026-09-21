using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace ChessReview.Api.Tests;

public class ApiHostTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    // The factory runs the host in the Development environment, where the service container
    // validates every registration on build: a broken registration fails this test.
    [Fact]
    public async Task Host_starts_and_serves_requests()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/no-such-endpoint", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
