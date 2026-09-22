using System.Globalization;
using System.Net;
using System.Text.Json.Nodes;
using ChessReview.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;
using static ChessReview.Api.Tests.AnalysisApi;

namespace ChessReview.Api.Tests;

public class QuotaTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    // An hour before the daily quota resets at 00:00 UTC.
    private readonly FakeTimeProvider _clock = new(new DateTimeOffset(2026, 9, 25, 23, 0, 0, TimeSpan.Zero));

    [Fact]
    public async Task A_new_game_beyond_the_daily_quota_gets_429_as_in_the_contract()
    {
        using var host = WithQuota(2);
        var installId = await api.NewInstallAsync();
        await AcceptAsync(host, NewGameRequest(), installId);
        await AcceptAsync(host, NewGameRequest(), installId);
        var refusedGame = NewGameRequest();

        var refused = await host.PostAnalysisAsync(refusedGame, installId);

        AssertProblemMatchesExample(Contract.DailyQuotaExceeded, refused);
        Assert.Equal(TimeSpan.FromHours(1), refused.RetryAfter);
        Assert.False(await host.ReadDatabaseAsync(db => db.Games.AnyAsync(g => g.ExternalGameId == GameId(refusedGame), Ct)));
    }

    [Fact]
    public async Task The_quota_resets_at_midnight_UTC()
    {
        using var host = WithQuota(1);
        var installId = await api.NewInstallAsync();
        await AcceptAsync(host, NewGameRequest(), installId);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await host.PostAnalysisAsync(NewGameRequest(), installId)).Status);

        _clock.Advance(TimeSpan.FromHours(1));

        Assert.Equal(HttpStatusCode.Accepted, (await host.PostAnalysisAsync(NewGameRequest(), installId)).Status);
    }

    [Fact]
    public async Task Answers_from_the_cache_are_free_and_served_after_the_quota_is_used_up()
    {
        using var host = WithQuota(1);
        var installId = await api.NewInstallAsync();
        var game = NewGameRequest();
        var analysisId = (await AcceptAsync(host, game, installId)).AnalysisId!.Value;

        var pending = await host.PostAnalysisAsync(game, installId);
        await host.UpdateJobAsync(analysisId, job => job.Status = ExplanationJobStatus.Ready);
        var ready = await host.PostAnalysisAsync(game, installId);

        Assert.Equal(HttpStatusCode.Accepted, pending.Status);
        Assert.Equal(HttpStatusCode.OK, ready.Status);
        Assert.Equal(1, await UsedAsync(host, installId));
        Assert.Equal(HttpStatusCode.TooManyRequests, (await host.PostAnalysisAsync(NewGameRequest(), installId)).Status);
    }

    [Fact]
    public async Task A_new_language_and_a_requeued_failure_count_as_new_work()
    {
        using var host = WithQuota(3);
        var installId = await api.NewInstallAsync();
        var english = NewGameRequest();
        var russian = english.DeepClone().AsObject();
        russian["language"] = "ru";

        var analysisId = (await AcceptAsync(host, english, installId)).AnalysisId!.Value;
        await AcceptAsync(host, russian, installId);
        await host.UpdateJobAsync(analysisId, job => job.Status = ExplanationJobStatus.Failed);
        await AcceptAsync(host, english, installId);

        Assert.Equal(3, await UsedAsync(host, installId));
        Assert.Equal(HttpStatusCode.TooManyRequests, (await host.PostAnalysisAsync(NewGameRequest(), installId)).Status);
    }

    [Fact]
    public async Task Each_install_has_its_own_quota()
    {
        using var host = WithQuota(1);
        var first = await api.NewInstallAsync();
        var second = await api.NewInstallAsync();
        await AcceptAsync(host, NewGameRequest(), first);
        var game = NewGameRequest();

        Assert.Equal(HttpStatusCode.TooManyRequests, (await host.PostAnalysisAsync(game, first)).Status);
        Assert.Equal(HttpStatusCode.Accepted, (await host.PostAnalysisAsync(game, second)).Status);
    }

    [Fact]
    public async Task Simultaneous_requests_cannot_go_beyond_the_quota()
    {
        using var host = WithQuota(3);
        var installId = await api.NewInstallAsync();

        var results = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => host.PostAnalysisAsync(NewGameRequest(), installId)));

        Assert.Equal(
            [(HttpStatusCode.Accepted, 3), (HttpStatusCode.TooManyRequests, 5)],
            results.CountBy(r => r.Status).OrderBy(c => c.Key).Select(c => (c.Key, c.Value)));
        Assert.Equal(3, await UsedAsync(host, installId));
    }

    [Fact]
    public async Task Simultaneous_requests_for_one_game_count_once()
    {
        // A double click on the review button.
        using var host = WithQuota(5);
        var installId = await api.NewInstallAsync();
        var game = NewGameRequest();

        var results = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => host.PostAnalysisAsync(game, installId)));

        Assert.All(results, r => Assert.Equal(HttpStatusCode.Accepted, r.Status));
        Assert.Equal(1, await UsedAsync(host, installId));
    }

    private WebApplicationFactory<Program> WithQuota(int analysesPerDay) => api.WithWebHostBuilder(builder =>
    {
        builder.UseSetting("Quotas:AnalysesPerDay", analysesPerDay.ToString(CultureInfo.InvariantCulture));
        builder.ConfigureTestServices(services => services.AddSingleton<TimeProvider>(_clock));
    });

    private static async Task<Answer> AcceptAsync(WebApplicationFactory<Program> host, JsonObject game, Guid installId)
    {
        var answer = await host.PostAnalysisAsync(game, installId);
        Assert.Equal(HttpStatusCode.Accepted, answer.Status);
        return answer;
    }

    // Analyses counted against the quota today, by the clock of the test.
    private Task<int> UsedAsync(WebApplicationFactory<Program> host, Guid installId)
    {
        var today = DateOnly.FromDateTime(_clock.GetUtcNow().UtcDateTime);
        return host.ReadDatabaseAsync(db => db.UsageDaily
            .Where(u => u.InstallId == installId && u.Date == today)
            .SumAsync(u => u.AnalysisCount, Ct));
    }

    private static string GameId(JsonObject game) => game["externalGameId"]!.GetValue<string>();
}
