using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using static ChessReview.Api.Tests.AnalysisApi;

namespace ChessReview.Api.Tests;

public class InstallsTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Registering_issues_a_new_install_id_as_in_the_contract()
    {
        var first = await api.RegisterInstallAsync();
        var second = await api.RegisterInstallAsync();

        Assert.Equal(HttpStatusCode.Created, first.Status);
        AssertMatchesExample(Contract.InstallRegistered, first.Body.DeepClone().AsObject());
        Assert.NotEqual(first.InstallId, second.InstallId);
    }

    [Fact]
    public async Task An_issued_install_id_opens_the_analyses_api()
    {
        var installId = (await api.RegisterInstallAsync()).InstallId!.Value;

        var result = await api.GetAnalysisAsync(Guid.NewGuid(), installId);

        Assert.Equal(HttpStatusCode.NotFound, result.Status);
    }

    private static readonly Dictionary<string, string?> NotIssued = new()
    {
        ["no header"] = null,
        ["not a UUID"] = "install-1",
        ["never issued"] = "0d6f3c7a-2b1e-4c9d-8a5f-7e3b1c9d2a64",
    };

    private static readonly Dictionary<string, Func<HttpClient, Task<HttpResponseMessage>>> Protected = new()
    {
        ["POST /api/analyses"] = client => client.PostAsJsonAsync("/api/analyses", NewGameRequest(), Ct),
        ["GET /api/analyses/{analysisId}"] = client => client.GetAsync($"/api/analyses/{Guid.NewGuid()}", Ct),
    };

    public static MatrixTheoryData<string, string> NotIssuedCases => new(NotIssued.Keys, Protected.Keys);

    [Theory]
    [MemberData(nameof(NotIssuedCases))]
    public async Task An_install_id_not_issued_by_the_server_gets_401_as_in_the_contract(string header, string endpoint)
    {
        using var client = api.CreateClientWithInstallHeader(NotIssued[header]);

        using var response = await Protected[endpoint](client);

        AssertProblemMatchesExample(Contract.UnknownInstall, await Answer.ReadAsync(response));
    }

    [Fact]
    public async Task Registrations_from_one_address_are_rate_limited_as_in_the_contract()
    {
        using var strict = api.WithWebHostBuilder(builder => builder.UseSetting("RateLimiting:Registrations:PermitLimit", "2"));

        Assert.Equal(HttpStatusCode.Created, (await strict.RegisterInstallAsync()).Status);
        Assert.Equal(HttpStatusCode.Created, (await strict.RegisterInstallAsync()).Status);
        var third = await strict.RegisterInstallAsync();

        AssertProblemMatchesExample(Contract.RateLimited, third);
        Assert.NotNull(third.RetryAfter);
        Assert.True(third.RetryAfter >= TimeSpan.FromSeconds(1), $"Retry-After: {third.RetryAfter}");
    }
}
