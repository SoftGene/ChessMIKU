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
}
