using Microsoft.AspNetCore.Mvc;

namespace ChessReview.Api.Analyses;

[ApiController]
[Route("api/analyses")]
public sealed class AnalysesController(AnalysisService analyses) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(CreateAnalysisRequest request, CancellationToken cancellationToken)
    {
        var result = await analyses.CreateAsync(request, cancellationToken);

        return StatusCode(result.FromCache ? StatusCodes.Status200OK : StatusCodes.Status202Accepted, result.Analysis);
    }

    [HttpGet("{analysisId:guid}")]
    public async Task<IActionResult> Get(Guid analysisId, CancellationToken cancellationToken) =>
        await analyses.FindAsync(analysisId, cancellationToken) is { } analysis
            ? Ok(analysis)
            : Problem(statusCode: StatusCodes.Status404NotFound, title: "Analysis not found");
}
