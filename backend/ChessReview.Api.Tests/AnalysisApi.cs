using System.Net.Http.Json;
using System.Text.Json.Nodes;
using ChessReview.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ChessReview.Api.Tests;

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

    public static Task<Answer> PostAnalysisAsync(this ApiFactory api, JsonObject request) =>
        api.PostAnalysisAsync(request, api.InstallId);

    public static async Task<Answer> PostAnalysisAsync(this WebApplicationFactory<Program> api, JsonObject request, Guid installId)
    {
        using var client = api.CreateClientAs(installId);
        using var response = await client.PostAsJsonAsync("/api/analyses", request, Ct);
        return await Answer.ReadAsync(response);
    }

    public static Task<Answer> GetAnalysisAsync(this ApiFactory api, Guid analysisId) =>
        api.GetAnalysisAsync(analysisId, api.InstallId);

    public static async Task<Answer> GetAnalysisAsync(this WebApplicationFactory<Program> api, Guid analysisId, Guid installId)
    {
        using var client = api.CreateClientAs(installId);
        using var response = await client.GetAsync($"/api/analyses/{analysisId}", Ct);
        return await Answer.ReadAsync(response);
    }

    public static async Task WithDatabaseAsync(this WebApplicationFactory<Program> api, Func<ChessReviewDbContext, Task> change)
    {
        await using var scope = api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ChessReviewDbContext>();
        await change(db);
        await db.SaveChangesAsync(Ct);
    }

    public static async Task<T> ReadDatabaseAsync<T>(this WebApplicationFactory<Program> api, Func<ChessReviewDbContext, Task<T>> read)
    {
        await using var scope = api.Services.CreateAsyncScope();
        return await read(scope.ServiceProvider.GetRequiredService<ChessReviewDbContext>());
    }

    public static Task UpdateJobAsync(this WebApplicationFactory<Program> api, Guid analysisId, Action<ExplanationJob> change) =>
        api.WithDatabaseAsync(async db => change(await db.ExplanationJobs.SingleAsync(j => j.Id == analysisId, Ct)));

    /// <summary>
    /// Asserts that a response equals a contract example. The server issues its own analysisId
    /// and installId, so only their format is checked.
    /// </summary>
    public static void AssertMatchesExample(string[] examplePath, JsonObject? actual)
    {
        Assert.NotNull(actual);
        var expected = Contract.Example(examplePath);

        foreach (var issued in (string[])["analysisId", "installId"])
        {
            if (expected.Remove(issued))
            {
                Assert.True(Guid.TryParse(actual[issued]?.GetValue<string>(), out _), $"{issued} is not a UUID: {actual}");
                actual.Remove(issued);
            }
        }

        Assert.True(JsonNode.DeepEquals(expected, actual), $"Expected {expected.ToJsonString()}\nActual   {actual.ToJsonString()}");
    }

    /// <summary>
    /// Asserts that a problem response has the status and every member of a contract example.
    /// Problem details may carry more members, such as traceId.
    /// </summary>
    public static void AssertProblemMatchesExample(string[] examplePath, Answer answer)
    {
        var expected = Contract.Example(examplePath);

        Assert.Equal(expected["status"]!.GetValue<long>(), (long)answer.Status);
        Assert.Equal("application/problem+json", answer.MediaType);
        foreach (var (name, value) in expected)
        {
            Assert.True(JsonNode.DeepEquals(value, answer.Body[name]), $"{name}: expected {value}, got {answer.Body[name]}");
        }
    }
}
