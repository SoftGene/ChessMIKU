using System.Diagnostics;
using ChessReview.Api.Installs;
using ChessReview.Api.Limits;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ChessReview.Api.Analyses;

[ApiController]
[Route("api/analyses")]
[EnableRateLimiting(RateLimits.Requests)]
public sealed class AnalysesController(AnalysisService analyses) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(CreateAnalysisRequest request, CancellationToken cancellationToken) =>
        await analyses.CreateAsync(User.InstallId(), request, cancellationToken) switch
        {
            CreateAnalysisResult.Accepted { FromCache: true } cached => Ok(cached.Analysis),
            CreateAnalysisResult.Accepted accepted => StatusCode(StatusCodes.Status202Accepted, accepted.Analysis),
            CreateAnalysisResult.QuotaExceeded refused => TooManyRequests.DailyQuotaExceeded.Result(this, refused.RetryAfter),
            var other => throw new UnreachableException($"Unexpected result {other}."),
        };

    [HttpGet("{analysisId:guid}")]
    public async Task<IActionResult> Get(Guid analysisId, CancellationToken cancellationToken) =>
        await analyses.FindAsync(analysisId, cancellationToken) is { } analysis
            ? Ok(analysis)
            : Problem(statusCode: StatusCodes.Status404NotFound, title: "Analysis not found");
}
