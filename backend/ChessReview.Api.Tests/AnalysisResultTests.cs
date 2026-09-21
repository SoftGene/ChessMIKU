using System.Net;
using System.Text.Json.Nodes;
using ChessReview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using static ChessReview.Api.Tests.AnalysisApi;

namespace ChessReview.Api.Tests;

public class AnalysisResultTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task A_pending_analysis_is_as_in_the_contract()
    {
        var analysisId = await NewAnalysisAsync();

        var result = await api.GetAnalysisAsync(analysisId);

        Assert.Equal(HttpStatusCode.OK, result.Status);
        AssertMatchesExample(Contract.AnalysisPending, result.Body);
    }

    [Fact]
    public async Task A_ready_analysis_returns_its_explanations_as_in_the_contract()
    {
        var analysisId = await NewAnalysisAsync();
        var explained = Contract.Example(Contract.AnalysisReady)["explanations"]!.AsArray()
            .Select(e => (Ply: e!["ply"]!.GetValue<long>(), Text: e["text"]!.GetValue<string>()));
        await ExplainAsync(analysisId, [.. explained]);

        var result = await api.GetAnalysisAsync(analysisId);

        Assert.Equal(HttpStatusCode.OK, result.Status);
        AssertMatchesExample(Contract.AnalysisReady, result.Body);
    }

    [Fact]
    public async Task A_failed_analysis_is_as_in_the_contract()
    {
        var analysisId = await NewAnalysisAsync();
        await api.UpdateJobAsync(analysisId, job => job.Status = ExplanationJobStatus.Failed);

        var result = await api.GetAnalysisAsync(analysisId);

        Assert.Equal(HttpStatusCode.OK, result.Status);
        AssertMatchesExample(Contract.AnalysisFailed, result.Body);
    }

    [Fact]
    public async Task Explanations_come_only_in_the_language_of_the_analysis()
    {
        var english = NewGameRequest();
        var russian = english.DeepClone().AsObject();
        russian["language"] = "ru";
        var inEnglish = (await api.PostAnalysisAsync(english)).AnalysisId!.Value;
        var inRussian = (await api.PostAnalysisAsync(russian)).AnalysisId!.Value;
        await ExplainAsync(inEnglish, [(10, "Taking the queen walks into mate.")]);
        await ExplainAsync(inRussian, [(10, "Взятие ферзя ведёт к мату.")]);

        Assert.Equal(["Taking the queen walks into mate."], ExplanationTexts(await api.GetAnalysisAsync(inEnglish)));
        Assert.Equal(["Взятие ферзя ведёт к мату."], ExplanationTexts(await api.GetAnalysisAsync(inRussian)));
    }

    [Fact]
    public async Task Explanations_are_ordered_by_ply()
    {
        var analysisId = await NewAnalysisAsync();
        await ExplainAsync(analysisId, [(12, "c"), (4, "a"), (10, "b")]);

        var result = await api.GetAnalysisAsync(analysisId);

        Assert.Equal([4, 10, 12], result.Body["explanations"]!.AsArray().Select(e => e!["ply"]!.GetValue<int>()));
    }

    [Fact]
    public async Task Explanations_stay_hidden_until_the_analysis_is_ready()
    {
        // The worker may store explanations one by one before it marks the analysis ready.
        var analysisId = await NewAnalysisAsync();
        await ExplainAsync(analysisId, [(10, "Written, not yet published.")], ready: false);

        var result = await api.GetAnalysisAsync(analysisId);

        Assert.Equal("pending", result.Body["status"]!.GetValue<string>());
        Assert.Empty(result.Body["explanations"]!.AsArray());
    }

    [Fact]
    public async Task An_unknown_analysis_is_404_as_in_the_contract()
    {
        var result = await api.GetAnalysisAsync(Guid.NewGuid());

        Assert.Equal(HttpStatusCode.NotFound, result.Status);
        Assert.Equal("application/problem+json", result.MediaType);

        // Problem details may carry more members, such as traceId; the documented ones must match.
        foreach (var (name, value) in Contract.Example(Contract.AnalysisNotFound))
        {
            Assert.True(JsonNode.DeepEquals(value, result.Body[name]), $"{name}: expected {value}, got {result.Body[name]}");
        }
    }

    private async Task<Guid> NewAnalysisAsync() => (await api.PostAnalysisAsync(NewGameRequest())).AnalysisId!.Value;

    private Task ExplainAsync(Guid analysisId, (long Ply, string Text)[] explanations, bool ready = true) =>
        api.WithDatabaseAsync(async db =>
        {
            var job = await db.ExplanationJobs.SingleAsync(j => j.Id == analysisId, Ct);
            if (ready)
            {
                job.Status = ExplanationJobStatus.Ready;
            }

            db.Explanations.AddRange(explanations.Select(e => new Explanation
            {
                GameId = job.GameId,
                Ply = (short)e.Ply,
                Language = job.Language,
                Text = e.Text,
                Model = "test",
            }));
        });

    private static IEnumerable<string> ExplanationTexts(Fetched result) =>
        result.Body["explanations"]!.AsArray().Select(e => e!["text"]!.GetValue<string>());
}
