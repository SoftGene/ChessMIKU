using System.Net;
using System.Text.Json.Nodes;
using ChessReview.ExplanationWorker;
using ChessReview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static ChessReview.Api.Tests.AnalysisApi;

namespace ChessReview.Api.Tests;

// The worker is off in the test host; each test runs the writer itself, with a stub model of its own.
public class ExplanationWorkerTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task An_explained_analysis_is_ready_as_in_the_contract()
    {
        var analysisId = await NewAnalysisAsync(NewGameRequest());
        var text = Contract.Example(Contract.AnalysisReady)["explanations"]![0]!["text"]!.GetValue<string>();

        Assert.Equal(JobOutcome.Ready, await ProcessAsync(analysisId, StubLlmClient.Explaining(_ => text)));

        AssertMatchesExample(Contract.AnalysisReady, (await api.GetAnalysisAsync(analysisId)).Body);
    }

    [Fact]
    public async Task The_model_gets_only_the_data_of_the_moves_it_explains()
    {
        var game = NewGameRequest();
        var analysisId = await NewAnalysisAsync(game);
        var llm = StubLlmClient.Explaining(_ => "Text.");

        await ProcessAsync(analysisId, llm);

        // 5...Bxd1, the only error of the contract example, seen from Black, the side that moved.
        var request = Assert.Single(llm.Requests);
        var expected = new JsonObject
        {
            ["moves"] = new JsonArray(new JsonObject
            {
                ["ply"] = 10,
                ["moveNumber"] = "5...",
                ["played"] = "Bxd1",
                ["bestMove"] = "d6e5",
                ["evaluationBefore"] = "White is better by 1.50 pawns",
                ["evaluationAfter"] = "White mates in 2",
                ["classification"] = "blunder",
                ["fen"] = "rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P1b1/2N5/PPPP1PPP/R1BQK2R b KQkq - 0 5",
            }),
        };
        var input = JsonNode.Parse(request.Input);
        Assert.True(JsonNode.DeepEquals(expected, input), $"Expected {expected.ToJsonString()}\nActual   {input?.ToJsonString()}");

        // Nothing about the players, the game or the installation reaches the model.
        string[] notForTheModel = ["example_white", "example_black", game["externalGameId"]!.GetValue<string>(), "Chess.com", api.InstallId.ToString(), analysisId.ToString()];
        Assert.All(notForTheModel, detail => Assert.DoesNotContain(detail, request.Instructions + request.Input, StringComparison.OrdinalIgnoreCase));
    }

    [Theory]
    [InlineData("ru", "Russian")]
    [InlineData("cs", "Czech")]
    [InlineData("en", "English")]
    public async Task The_model_is_asked_to_write_in_the_language_of_the_analysis(string language, string name)
    {
        var game = NewGameRequest();
        game["language"] = language;
        var analysisId = await NewAnalysisAsync(game);
        var llm = StubLlmClient.Explaining(_ => "Text.");

        await ProcessAsync(analysisId, llm);

        Assert.Contains($"in {name}", Assert.Single(llm.Requests).Instructions, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Only_the_three_worst_errors_are_explained()
    {
        var analysisId = await NewAnalysisAsync(GameWithFourErrors());
        var llm = StubLlmClient.Explaining(ply => $"Move {ply}.");

        await ProcessAsync(analysisId, llm);

        Assert.Equal([4, 8, 10], StubLlmClient.RequestedPlies(Assert.Single(llm.Requests)));
        Assert.Equal(["Move 4.", "Move 8.", "Move 10."], ExplanationTexts(await api.GetAnalysisAsync(analysisId)));
    }

    [Fact]
    public async Task Explanations_are_stored_with_the_model_that_wrote_them()
    {
        var analysisId = await NewAnalysisAsync(NewGameRequest());

        await ProcessAsync(analysisId, StubLlmClient.Explaining(_ => "Text."));

        var models = await api.ReadDatabaseAsync(async db =>
        {
            var job = await db.ExplanationJobs.SingleAsync(j => j.Id == analysisId, Ct);
            return await db.Explanations.Where(e => e.GameId == job.GameId).Select(e => e.Model).ToListAsync(Ct);
        });
        Assert.Equal([StubLlmClient.ModelName], models);
    }

    [Fact]
    public async Task A_failing_model_is_tried_three_times_then_the_analysis_fails()
    {
        var analysisId = await NewAnalysisAsync(NewGameRequest());
        var llm = StubLlmClient.Failing("Resource has been exhausted.");

        var first = await ProcessAsync(analysisId, llm);
        var afterFirst = await FindJobAsync(analysisId);
        JobOutcome[] rest = [await ProcessAsync(analysisId, llm), await ProcessAsync(analysisId, llm)];
        var afterLast = await FindJobAsync(analysisId);

        Assert.Equal((JobOutcome.Retry, ExplanationJobStatus.Pending, 1, "Resource has been exhausted."), (first, afterFirst.Status, afterFirst.Attempts, afterFirst.LastError));
        Assert.Equal([JobOutcome.Retry, JobOutcome.Failed], rest);
        Assert.Equal((ExplanationJobStatus.Failed, 3), (afterLast.Status, afterLast.Attempts));
        AssertMatchesExample(Contract.AnalysisFailed, (await api.GetAnalysisAsync(analysisId)).Body);
    }

    private static readonly Dictionary<string, string> AnswersThatDoNotFit = new()
    {
        ["not JSON"] = "Taking the queen walks into mate.",
        ["another move"] = """{"explanations": [{"ply": 9, "text": "Nxe5 is fine."}]}""",
        ["an empty text"] = """{"explanations": [{"ply": 10, "text": "  "}]}""",
        ["no explanations"] = """{"text": "Taking the queen walks into mate."}""",
        ["a text too long"] = new JsonObject { ["explanations"] = new JsonArray(new JsonObject { ["ply"] = 10, ["text"] = new string('a', 1001) }) }.ToJsonString(),
    };

    public static TheoryData<string> AnswerNames => [.. AnswersThatDoNotFit.Keys];

    [Theory]
    [MemberData(nameof(AnswerNames))]
    public async Task An_answer_that_does_not_fit_is_a_failed_attempt(string name)
    {
        var analysisId = await NewAnalysisAsync(NewGameRequest());

        var outcome = await ProcessAsync(analysisId, new StubLlmClient(_ => AnswersThatDoNotFit[name]));

        var job = await FindJobAsync(analysisId);
        Assert.Equal((JobOutcome.Retry, ExplanationJobStatus.Pending, 1), (outcome, job.Status, job.Attempts));
        Assert.StartsWith("The model's answer does not fit", job.LastError, StringComparison.Ordinal);
        Assert.Equal(0, await api.ReadDatabaseAsync(db => db.Explanations.CountAsync(e => e.GameId == job.GameId, Ct)));
    }

    [Fact]
    public async Task Explanations_already_written_are_neither_requested_again_nor_duplicated()
    {
        var analysisId = await NewAnalysisAsync(GameWithFourErrors());
        await api.WithDatabaseAsync(async db =>
        {
            var job = await db.ExplanationJobs.SingleAsync(j => j.Id == analysisId, Ct);
            db.Explanations.Add(new Explanation { GameId = job.GameId, Ply = 8, Language = job.Language, Text = "Written before.", Model = "earlier" });
        });
        var llm = StubLlmClient.Explaining(ply => $"Move {ply}.");

        Assert.Equal(JobOutcome.Ready, await ProcessAsync(analysisId, llm));

        Assert.Equal([4, 10], StubLlmClient.RequestedPlies(Assert.Single(llm.Requests)));
        Assert.Equal(["Move 4.", "Written before.", "Move 10."], ExplanationTexts(await api.GetAnalysisAsync(analysisId)));
    }

    [Fact]
    public async Task A_game_without_errors_is_ready_without_asking_the_model()
    {
        // 5...Bxd1 keeps the evaluation here: nothing in the game is an error.
        var analysisId = await NewAnalysisAsync(WithEvaluations(NewGameRequest(), (10, -150, -150)));
        var llm = new StubLlmClient();

        Assert.Equal(JobOutcome.Ready, await ProcessAsync(analysisId, llm));

        Assert.Empty(llm.Requests);
        var result = await api.GetAnalysisAsync(analysisId);
        Assert.Equal(("ready", 0), (result.Body["status"]!.GetValue<string>(), result.Body["explanations"]!.AsArray().Count));
    }

    [Fact]
    public async Task An_analysis_that_is_not_pending_is_left_alone()
    {
        var analysisId = await NewAnalysisAsync(NewGameRequest());
        await api.UpdateJobAsync(analysisId, job => job.Status = ExplanationJobStatus.Failed);
        var llm = StubLlmClient.Explaining(_ => "Text.");

        Assert.Equal(JobOutcome.None, await ProcessAsync(analysisId, llm));

        Assert.Empty(llm.Requests);
        Assert.Equal(ExplanationJobStatus.Failed, (await FindJobAsync(analysisId)).Status);
    }

    // Plies 4 and 8 become mistakes and ply 6 an inaccuracy, besides the blunder on ply 10.
    private static JsonObject GameWithFourErrors() => WithEvaluations(NewGameRequest(), (4, -32, -200), (6, -55, -140), (8, -90, -300));

    private static JsonObject WithEvaluations(JsonObject game, params (int Ply, int Before, int After)[] evaluations)
    {
        foreach (var (ply, before, after) in evaluations)
        {
            var move = game["moves"]![ply - 1]!.AsObject();
            move["evalBeforeCp"] = before;
            move["mateBefore"] = null;
            move["evalAfterCp"] = after;
            move["mateAfter"] = null;
        }

        return game;
    }

    private async Task<Guid> NewAnalysisAsync(JsonObject game)
    {
        var posted = await api.PostAnalysisAsync(game);
        Assert.Equal(HttpStatusCode.Accepted, posted.Status);
        return posted.AnalysisId!.Value;
    }

    private async Task<JobOutcome> ProcessAsync(Guid analysisId, StubLlmClient llm)
    {
        await using var scope = api.Services.CreateAsyncScope();
        var writer = ActivatorUtilities.CreateInstance<ExplanationWriter>(scope.ServiceProvider, llm);
        return await writer.ProcessAsync(analysisId, Ct);
    }

    private Task<ExplanationJob> FindJobAsync(Guid analysisId) =>
        api.ReadDatabaseAsync(db => db.ExplanationJobs.AsNoTracking().SingleAsync(j => j.Id == analysisId, Ct));

    private static IEnumerable<string> ExplanationTexts(Answer result) =>
        result.Body["explanations"]!.AsArray().Select(e => e!["text"]!.GetValue<string>());
}
