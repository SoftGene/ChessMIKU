using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using ChessReview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ChessReview.Api.Tests;

public sealed record Posted(HttpStatusCode Status, Guid? AnalysisId, JsonObject Body);

public sealed record Fetched(HttpStatusCode Status, string? MediaType, JsonObject Body);

/// <summary>Calls to the analyses API and direct database changes shared by the API tests.</summary>
internal static class AnalysisApi
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    // The contract example with a game id of its own, so that tests do not share cached games.
    public static JsonObject NewGameRequest()
    {
        var request = Contract.Example(Contract.CreateAnalysisRequest);
        request["externalGameId"] = $"live/{Random.Shared.NextInt64(1, 99_999_999_999)}";
        return request;
    }

    public static async Task<Posted> PostAnalysisAsync(this ApiFactory api, JsonObject request)
    {
        using var client = api.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/analyses", request, Ct);
        var body = await response.Content.ReadFromJsonAsync<JsonObject>(Ct) ?? throw new InvalidOperationException("Empty response body.");
        var analysisId = body["analysisId"]?.GetValue<string>();

        return new Posted(response.StatusCode, analysisId is null ? null : Guid.Parse(analysisId), body);
    }

    public static async Task<Fetched> GetAnalysisAsync(this ApiFactory api, Guid analysisId)
    {
        using var client = api.CreateClient();
        using var response = await client.GetAsync($"/api/analyses/{analysisId}", Ct);
        var body = await response.Content.ReadFromJsonAsync<JsonObject>(Ct) ?? throw new InvalidOperationException("Empty response body.");

        return new Fetched(response.StatusCode, response.Content.Headers.ContentType?.MediaType, body);
    }

    public static async Task WithDatabaseAsync(this ApiFactory api, Func<ChessReviewDbContext, Task> change)
    {
        await using var scope = api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ChessReviewDbContext>();
        await change(db);
        await db.SaveChangesAsync(Ct);
    }

    public static Task UpdateJobAsync(this ApiFactory api, Guid analysisId, Action<ExplanationJob> change) =>
        api.WithDatabaseAsync(async db => change(await db.ExplanationJobs.SingleAsync(j => j.Id == analysisId, Ct)));

    /// <summary>
    /// Asserts that a response equals a contract example. The server issues its own analysisId,
    /// so only its format is checked.
    /// </summary>
    public static void AssertMatchesExample(string[] examplePath, JsonObject? actual)
    {
        Assert.NotNull(actual);
        var expected = Contract.Example(examplePath);

        if (expected.Remove("analysisId"))
        {
            Assert.True(Guid.TryParse(actual["analysisId"]?.GetValue<string>(), out _), $"analysisId is not a UUID: {actual}");
            actual.Remove("analysisId");
        }

        Assert.True(JsonNode.DeepEquals(expected, actual), $"Expected {expected.ToJsonString()}\nActual   {actual.ToJsonString()}");
    }
}
