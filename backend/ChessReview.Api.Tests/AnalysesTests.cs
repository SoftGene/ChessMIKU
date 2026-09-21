using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using ChessReview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static ChessReview.Api.Tests.AnalysisApi;

namespace ChessReview.Api.Tests;

public class AnalysesTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_contract_example_request_gets_the_contract_example_response()
    {
        using var client = api.CreateClient();

        using var response = await client.PostAsJsonAsync("/api/analyses", NewGameRequest(), Ct);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        AssertMatchesExample(Contract.AnalysisAccepted, await response.Content.ReadFromJsonAsync<JsonObject>(Ct));
    }

    [Fact]
    public async Task Repeating_the_request_while_explanations_are_pending_returns_the_same_analysis()
    {
        var request = NewGameRequest();
        var first = await api.PostAnalysisAsync(request);

        var second = await api.PostAnalysisAsync(request);

        Assert.Equal(HttpStatusCode.Accepted, second.Status);
        Assert.Equal(first.AnalysisId, second.AnalysisId);
        Assert.Equal("pending", second.Body["explanationsStatus"]!.GetValue<string>());
        Assert.Equal(1, await CountAsync(db => db.ExplanationJobs, request));
    }

    [Fact]
    public async Task A_game_with_ready_explanations_comes_from_the_cache()
    {
        var request = NewGameRequest();
        var first = await api.PostAnalysisAsync(request);
        await api.UpdateJobAsync(first.AnalysisId!.Value, job => job.Status = ExplanationJobStatus.Ready);

        var cached = await api.PostAnalysisAsync(request);

        Assert.Equal(HttpStatusCode.OK, cached.Status);
        Assert.Equal(first.AnalysisId, cached.AnalysisId);
        AssertMatchesExample(Contract.AnalysisFromCache, cached.Body);
    }

    [Fact]
    public async Task A_cached_game_is_not_classified_again()
    {
        var request = NewGameRequest();
        await api.PostAnalysisAsync(request);

        // The same game with other evaluations: 5...Bxd1 would no longer be a blunder.
        var replayed = request.DeepClone().AsObject();
        var bxd1 = replayed["moves"]![9]!;
        bxd1["evalAfterCp"] = -150;
        bxd1["mateAfter"] = null;
        var second = await api.PostAnalysisAsync(replayed);

        Assert.Equal("blunder", second.Body["classifications"]![9]!["classification"]!.GetValue<string>());
        Assert.Equal(13, await CountAsync(db => db.Moves, request));
    }

    [Fact]
    public async Task The_same_game_in_another_language_is_a_new_analysis()
    {
        var english = NewGameRequest();
        var inEnglish = await api.PostAnalysisAsync(english);
        var russian = english.DeepClone().AsObject();
        russian["language"] = "ru";

        var inRussian = await api.PostAnalysisAsync(russian);

        Assert.Equal(HttpStatusCode.Accepted, inRussian.Status);
        Assert.NotEqual(inEnglish.AnalysisId, inRussian.AnalysisId);
        Assert.True(JsonNode.DeepEquals(inEnglish.Body["classifications"], inRussian.Body["classifications"]));
        Assert.Equal((1, 13, 2), (await CountAsync(db => db.Games, english), await CountAsync(db => db.Moves, english), await CountAsync(db => db.ExplanationJobs, english)));
    }

    [Fact]
    public async Task Failed_explanations_are_queued_again()
    {
        var request = NewGameRequest();
        var first = await api.PostAnalysisAsync(request);
        await api.UpdateJobAsync(first.AnalysisId!.Value, job =>
        {
            job.Status = ExplanationJobStatus.Failed;
            job.Attempts = 3;
            job.LastError = "The model did not answer.";
        });

        var retried = await api.PostAnalysisAsync(request);

        Assert.Equal(HttpStatusCode.Accepted, retried.Status);
        Assert.Equal(first.AnalysisId, retried.AnalysisId);
        var job = await FindJobAsync(first.AnalysisId!.Value);
        Assert.Equal((ExplanationJobStatus.Pending, 0, (string?)null), (job.Status, job.Attempts, job.LastError));
    }

    // Each case breaks one thing in a valid request; the error must name the field at fault.
    private static readonly Dictionary<string, (Action<JsonObject> Break, string Field)> InvalidRequests = new()
    {
        ["game id without its type"] = (r => r["externalGameId"] = "123456789012", "externalGameId"),
        ["language outside the contract"] = (r => r["language"] = "de", "$.language"),
        ["move that is not UCI"] = (r => r["moves"]![0]!["uci"] = "e2e9", "moves[0].uci"),
        ["evaluation with neither centipawns nor mate"] = (r => r["moves"]![0]!["evalBeforeCp"] = null, "moves[0].evalBeforeCp"),
        ["evaluation with both centipawns and mate"] = (r => r["moves"]![0]!["mateAfter"] = 3, "moves[0].evalAfterCp"),
        ["mate in 0 before the move"] = (r => r["moves"]![11]!["mateBefore"] = 0, "moves[11].mateBefore"),
        ["centipawns out of range"] = (r => r["moves"]![0]!["evalBeforeCp"] = 40000, "moves[0].evalBeforeCp"),
        ["moves out of order"] = (r => (r["moves"]![0]!["ply"], r["moves"]![1]!["ply"]) = (2, 1), "moves"),
        ["moves that do not match the PGN"] = (r => r["moves"]!.AsArray().RemoveAt(12), "moves"),
        ["game that is not finished"] = (r => r["pgn"] = r["pgn"]!.GetValue<string>().Replace("[Result \"1-0\"]", "[Result \"*\"]"), "pgn"),
        ["PGN without the White tag"] = (r => r["pgn"] = r["pgn"]!.GetValue<string>().Replace("[White \"example_white\"]\n", ""), "pgn"),
        ["no moves"] = (r => r["moves"] = new JsonArray(), "moves"),
        ["property the contract does not list"] = (r => r["comment"] = "hi", "$"),
    };

    public static TheoryData<string> InvalidRequestNames => [.. InvalidRequests.Keys];

    [Theory]
    [MemberData(nameof(InvalidRequestNames))]
    public async Task An_invalid_request_gets_400_naming_the_field(string name)
    {
        var (breakRequest, field) = InvalidRequests[name];
        var request = NewGameRequest();
        breakRequest(request);
        using var client = api.CreateClient();

        using var response = await client.PostAsJsonAsync("/api/analyses", request, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var errors = (await response.Content.ReadFromJsonAsync<JsonObject>(Ct))!["errors"]!.AsObject();
        Assert.True(
            errors.Any(error => error.Key == field || error.Key.StartsWith(field + ".", StringComparison.Ordinal)),
            $"No error for '{field}' in {errors.ToJsonString()}");
    }

    [Fact]
    public async Task Simultaneous_requests_for_a_new_game_share_one_analysis()
    {
        // A double click on the review button.
        var request = NewGameRequest();

        var results = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => api.PostAnalysisAsync(request)));

        Assert.All(results, result => Assert.Equal(HttpStatusCode.Accepted, result.Status));
        Assert.Single(results.Select(result => result.AnalysisId).Distinct());
        Assert.Equal((1, 1), (await CountAsync(db => db.Games, request), await CountAsync(db => db.ExplanationJobs, request)));
    }

    private async Task<int> CountAsync<T>(Func<ChessReviewDbContext, IQueryable<T>> rows, JsonObject request)
        where T : class
    {
        await using var scope = api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ChessReviewDbContext>();
        var gameId = await db.Games.Where(g => g.ExternalGameId == request["externalGameId"]!.GetValue<string>()).Select(g => g.Id).SingleAsync(Ct);

        return rows(db) switch
        {
            IQueryable<Game> games => await games.CountAsync(g => g.Id == gameId, Ct),
            IQueryable<Move> moves => await moves.CountAsync(m => m.GameId == gameId, Ct),
            IQueryable<ExplanationJob> jobs => await jobs.CountAsync(j => j.GameId == gameId, Ct),
            _ => throw new NotSupportedException(typeof(T).Name),
        };
    }

    private async Task<ExplanationJob> FindJobAsync(Guid analysisId)
    {
        await using var scope = api.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<ChessReviewDbContext>().ExplanationJobs.AsNoTracking().SingleAsync(j => j.Id == analysisId, Ct);
    }
}
