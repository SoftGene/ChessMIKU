using ChessReview.Api.Limits;
using ChessReview.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ChessReview.Api.Installs;

public sealed record InstallRegistered(Guid InstallId);

[ApiController]
[Route("api/installs")]
[AllowAnonymous]
[EnableRateLimiting(RateLimits.Registrations)]
public sealed class InstallsController(ChessReviewDbContext db) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Register(CancellationToken cancellationToken)
    {
        // Random, not time-ordered: one identifier tells nothing about the next.
        var install = new Install { InstallId = Guid.NewGuid() };
        db.Installs.Add(install);
        await db.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new InstallRegistered(install.InstallId));
    }
}
