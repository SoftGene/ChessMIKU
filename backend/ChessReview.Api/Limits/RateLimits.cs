using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Threading.RateLimiting;
using ChessReview.Api.Installs;
using Microsoft.Extensions.Options;

namespace ChessReview.Api.Limits;

/// <summary>A number of requests allowed in a fixed window, from the RateLimiting section of the configuration.</summary>
public sealed class WindowLimit
{
    [Range(1, int.MaxValue)]
    public int PermitLimit { get; set; }

    [Range(1, int.MaxValue)]
    public int WindowSeconds { get; set; }
}

public static class RateLimits
{
    public const string Registrations = "Registrations";

    public const string Requests = "Requests";

    public static IServiceCollection AddChessReviewRateLimiting(this IServiceCollection services)
    {
        foreach (var policy in (string[])[Registrations, Requests])
        {
            services.AddOptions<WindowLimit>(policy).BindConfiguration($"RateLimiting:{policy}").ValidateDataAnnotations().ValidateOnStart();
        }

        services.AddRateLimiter(limiter =>
        {
            // Per client address: a new installation for every request would get around the daily quota.
            limiter.AddPolicy(Registrations, http => Partition(http, Registrations, $"address:{ClientAddress(http)}"));

            // Per installation. A request without one counts for its address until authorization refuses it.
            limiter.AddPolicy(Requests, http => Partition(
                http,
                Requests,
                http.User.FindFirstValue(InstallIdAuthentication.ClaimType) is { } installId ? $"install:{installId}" : $"address:{ClientAddress(http)}"));

            limiter.OnRejected = (context, _) => TooManyRequests.RateLimited.WriteAsync(
                context.HttpContext,
                context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter) ? retryAfter : TimeSpan.FromMinutes(1));
        });

        return services;
    }

    private static RateLimitPartition<string> Partition(HttpContext http, string policy, string key)
    {
        var limit = http.RequestServices.GetRequiredService<IOptionsMonitor<WindowLimit>>().Get(policy);

        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = limit.PermitLimit,
            Window = TimeSpan.FromSeconds(limit.WindowSeconds),
            QueueLimit = 0,
        });
    }

    private static string ClientAddress(HttpContext http) => http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}
