using System.Security.Claims;
using System.Text.Encodings.Web;
using ChessReview.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ChessReview.Api.Installs;

public static class InstallIdAuthentication
{
    public const string Scheme = "InstallId";

    public const string Header = "X-Install-Id";

    public const string ClaimType = "install_id";

    /// <summary>
    /// Every endpoint requires an installation registered with POST /api/installs, unless it
    /// allows anonymous access itself.
    /// </summary>
    public static IServiceCollection AddInstallIdAuthentication(this IServiceCollection services)
    {
        services.AddAuthentication(Scheme).AddScheme<AuthenticationSchemeOptions, InstallIdAuthenticationHandler>(Scheme, configureOptions: null);
        services.AddAuthorizationBuilder().SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
        return services;
    }

    public static Guid InstallId(this ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirstValue(ClaimType) ?? throw new InvalidOperationException("The request has no authenticated installation."));
}

/// <summary>Accepts the X-Install-Id header only with an identifier issued by POST /api/installs.</summary>
public sealed class InstallIdAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    ChessReviewDbContext db,
    IProblemDetailsService problems)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(InstallIdAuthentication.Header, out var header))
        {
            return AuthenticateResult.NoResult();
        }

        if (!Guid.TryParse(header.ToString(), out var installId)
            || !await db.Installs.AnyAsync(i => i.InstallId == installId, Context.RequestAborted))
        {
            return AuthenticateResult.Fail($"{InstallIdAuthentication.Header} was not issued by this server.");
        }

        var identity = new ClaimsIdentity([new Claim(InstallIdAuthentication.ClaimType, installId.ToString())], Scheme.Name);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name));
    }

    protected override async Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = Context,
            ProblemDetails =
            {
                Type = "https://tools.ietf.org/html/rfc9110#section-15.5.2",
                Title = "Unknown installation",
                Status = StatusCodes.Status401Unauthorized,
                Detail = $"The {InstallIdAuthentication.Header} header is missing or was not issued by this server.",
            },
        });
    }
}
