using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using static ChessReview.Api.Tests.AnalysisApi;

namespace ChessReview.Api.Tests;

public class RateLimitTests(ApiFactory api)
{
    [Fact]
    public async Task Requests_from_one_install_are_rate_limited_as_in_the_contract()
    {
        using var host = WithRequestLimit(3);
        var installId = await api.NewInstallAsync();
        for (var i = 0; i < 3; i++)
        {
            Assert.Equal(HttpStatusCode.NotFound, (await host.GetAnalysisAsync(Guid.NewGuid(), installId)).Status);
        }

        var limited = await host.GetAnalysisAsync(Guid.NewGuid(), installId);

        AssertProblemMatchesExample(Contract.RateLimited, limited);
        Assert.NotNull(limited.RetryAfter);
        Assert.InRange(limited.RetryAfter.Value, TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(60));
    }

    [Fact]
    public async Task Each_install_has_its_own_rate_limit()
    {
        using var host = WithRequestLimit(1);
        var first = await api.NewInstallAsync();
        var second = await api.NewInstallAsync();
        await host.GetAnalysisAsync(Guid.NewGuid(), first);

        Assert.Equal(HttpStatusCode.TooManyRequests, (await host.GetAnalysisAsync(Guid.NewGuid(), first)).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await host.GetAnalysisAsync(Guid.NewGuid(), second)).Status);
    }

    private WebApplicationFactory<Program> WithRequestLimit(int permitLimit) => api.WithWebHostBuilder(builder =>
    {
        builder.UseSetting("RateLimiting:Requests:PermitLimit", permitLimit.ToString(System.Globalization.CultureInfo.InvariantCulture));
        builder.UseSetting("RateLimiting:Requests:WindowSeconds", "60");
    });
}
