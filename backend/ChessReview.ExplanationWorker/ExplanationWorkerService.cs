using System.ComponentModel.DataAnnotations;
using ChessReview.Infrastructure.Llm;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ChessReview.ExplanationWorker;

public sealed class ExplanationWorkerOptions
{
    public const string Section = "ExplanationWorker";

    public bool Enabled { get; set; } = true;

    /// <summary>Wait when the queue is empty.</summary>
    [Range(1, 3600)]
    public int IdleSeconds { get; set; } = 5;

    /// <summary>Wait after each job, to stay within the model's requests per minute.</summary>
    [Range(0, 3600)]
    public int SecondsBetweenRequests { get; set; } = 7;

    /// <summary>Wait after a failed attempt: failures are usually quotas or outages, not one bad job.</summary>
    [Range(1, 3600)]
    public int SecondsAfterFailure { get; set; } = 60;
}

/// <summary>
/// Takes pending analyses one at a time, oldest first. One API instance runs one worker, so
/// jobs are not claimed against other workers.
/// </summary>
public sealed class ExplanationWorkerService(
    IServiceScopeFactory scopes,
    IOptions<ExplanationWorkerOptions> options,
    TimeProvider time,
    ILogger<ExplanationWorkerService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var settings = options.Value;
        if (!settings.Enabled)
        {
            logger.LogInformation("The explanation worker is disabled.");
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            JobOutcome outcome;
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                outcome = await scope.ServiceProvider.GetRequiredService<ExplanationWriter>().ProcessNextAsync(stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // The database may be restarting: keep the worker, and with it the API, alive.
                logger.LogError(exception, "The explanation worker failed to process the queue.");
                outcome = JobOutcome.Retry;
            }

            var pause = outcome switch
            {
                JobOutcome.None => settings.IdleSeconds,
                JobOutcome.Ready => settings.SecondsBetweenRequests,
                _ => settings.SecondsAfterFailure,
            };
            await Task.Delay(TimeSpan.FromSeconds(pause), time, stoppingToken);
        }
    }
}

public static class ExplanationWorkerRegistration
{
    public static IServiceCollection AddExplanationWorker(this IServiceCollection services)
    {
        services.AddOptions<GeminiOptions>().BindConfiguration(GeminiOptions.Section).ValidateDataAnnotations().ValidateOnStart();
        services.AddHttpClient<ILlmClient, GeminiClient>(http => http.BaseAddress = new Uri("https://generativelanguage.googleapis.com/"));

        services.AddOptions<ExplanationWorkerOptions>().BindConfiguration(ExplanationWorkerOptions.Section).ValidateDataAnnotations().ValidateOnStart();
        services.AddScoped<ExplanationWriter>();
        services.AddHostedService<ExplanationWorkerService>();
        return services;
    }
}
