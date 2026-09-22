using ChessReview.ExplanationWorker;
using ChessReview.Infrastructure.Llm;
using ChessReview.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using static ChessReview.Api.Tests.AnalysisApi;

namespace ChessReview.Api.Tests;

// Each test has a database of its own: the shared one always holds other tests' pending analyses.
public class ExplanationQueueTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Pending_analyses_are_explained_oldest_first_and_others_are_skipped()
    {
        using var host = api.WithWebHostBuilder(builder => builder.UseSetting("ConnectionStrings:ChessReview", api.ConnectionString("ChessReviewQueue")));
        var installId = await host.NewInstallAsync();
        var failed = (await host.PostAnalysisAsync(NewGameRequest(), installId)).AnalysisId!.Value;
        await host.UpdateJobAsync(failed, job => job.Status = ExplanationJobStatus.Failed);
        var older = (await host.PostAnalysisAsync(NewGameRequest(), installId)).AnalysisId!.Value;
        var newer = (await host.PostAnalysisAsync(NewGameRequest(), installId)).AnalysisId!.Value;
        var llm = StubLlmClient.Explaining(_ => "Text.");

        var first = await ProcessNextAsync(host, llm);
        var afterFirst = (await StatusAsync(host, installId, older), await StatusAsync(host, installId, newer));
        JobOutcome[] rest = [await ProcessNextAsync(host, llm), await ProcessNextAsync(host, llm)];

        Assert.Equal((JobOutcome.Ready, ("ready", "pending")), (first, afterFirst));
        Assert.Equal([JobOutcome.Ready, JobOutcome.None], rest);
        Assert.Equal(("ready", "failed"), (await StatusAsync(host, installId, newer), await StatusAsync(host, installId, failed)));
    }

    [Fact]
    public async Task The_running_worker_explains_a_new_analysis()
    {
        var llm = StubLlmClient.Explaining(_ => "Text.");
        using var host = api.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("ConnectionStrings:ChessReview", api.ConnectionString("ChessReviewWorker"));
            builder.UseSetting("ExplanationWorker:Enabled", "true");
            builder.UseSetting("ExplanationWorker:IdleSeconds", "1");
            builder.UseSetting("ExplanationWorker:SecondsBetweenRequests", "0");
            builder.ConfigureTestServices(services => services.AddSingleton<ILlmClient>(llm));
        });
        var installId = await host.NewInstallAsync();
        var analysisId = (await host.PostAnalysisAsync(NewGameRequest(), installId)).AnalysisId!.Value;

        var deadline = DateTime.UtcNow.AddSeconds(20);
        var status = await StatusAsync(host, installId, analysisId);
        while (status == "pending" && DateTime.UtcNow < deadline)
        {
            await Task.Delay(TimeSpan.FromMilliseconds(200), Ct);
            status = await StatusAsync(host, installId, analysisId);
        }

        Assert.Equal("ready", status);
        Assert.Equal([10], StubLlmClient.RequestedPlies(Assert.Single(llm.Requests)));
    }

    private static async Task<JobOutcome> ProcessNextAsync(WebApplicationFactory<Program> host, StubLlmClient llm)
    {
        await using var scope = host.Services.CreateAsyncScope();
        return await ActivatorUtilities.CreateInstance<ExplanationWriter>(scope.ServiceProvider, llm).ProcessNextAsync(Ct);
    }

    private static async Task<string> StatusAsync(WebApplicationFactory<Program> host, Guid installId, Guid analysisId) =>
        (await host.GetAnalysisAsync(analysisId, installId)).Body["status"]!.GetValue<string>();
}
