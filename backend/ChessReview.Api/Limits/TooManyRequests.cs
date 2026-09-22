using System.Globalization;
using Microsoft.AspNetCore.Mvc;

namespace ChessReview.Api.Limits;

/// <summary>The two 429 answers of the contract: problem details whose code tells them apart, and Retry-After.</summary>
public sealed class TooManyRequests
{
    public static readonly TooManyRequests DailyQuotaExceeded = new("Daily quota exceeded", "daily_quota_exceeded");

    public static readonly TooManyRequests RateLimited = new("Too many requests", "rate_limited");

    private const string Type = "https://tools.ietf.org/html/rfc6585#section-4";

    private readonly string _title;
    private readonly string _code;

    private TooManyRequests(string title, string code) => (_title, _code) = (title, code);

    public ObjectResult Result(ControllerBase controller, TimeSpan retryAfter)
    {
        SetRetryAfter(controller.Response, retryAfter);
        return controller.Problem(
            title: _title,
            statusCode: StatusCodes.Status429TooManyRequests,
            type: Type,
            extensions: new Dictionary<string, object?> { ["code"] = _code });
    }

    public async ValueTask WriteAsync(HttpContext http, TimeSpan retryAfter)
    {
        http.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        SetRetryAfter(http.Response, retryAfter);
        await http.RequestServices.GetRequiredService<IProblemDetailsService>().TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = http,
            ProblemDetails =
            {
                Type = Type,
                Title = _title,
                Status = StatusCodes.Status429TooManyRequests,
                Extensions = { ["code"] = _code },
            },
        });
    }

    // Whole seconds, rounded up and at least one: an earlier retry would be refused again.
    private static void SetRetryAfter(HttpResponse response, TimeSpan wait) =>
        response.Headers.RetryAfter = Math.Max(1, (long)Math.Ceiling(wait.TotalSeconds)).ToString(CultureInfo.InvariantCulture);
}
