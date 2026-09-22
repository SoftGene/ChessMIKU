using ChessReview.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;

namespace ChessReview.Api.Tests;

/// <summary>Installations and the X-Install-Id header, shared by the API tests.</summary>
internal static class InstallApi
{
    public const string Header = "X-Install-Id";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public static async Task<Answer> RegisterInstallAsync(this WebApplicationFactory<Program> api)
    {
        using var client = api.CreateClient();
        using var response = await client.PostAsync("/api/installs", content: null, Ct);
        return await Answer.ReadAsync(response);
    }

    /// <summary>An installation stored as if registered: most tests are not about registering.</summary>
    public static async Task<Guid> NewInstallAsync(this WebApplicationFactory<Program> api)
    {
        var installId = Guid.NewGuid();
        await api.WithDatabaseAsync(db =>
        {
            db.Installs.Add(new Install { InstallId = installId });
            return Task.CompletedTask;
        });

        return installId;
    }

    public static HttpClient CreateClientAs(this WebApplicationFactory<Program> api, Guid installId) =>
        api.CreateClientWithInstallHeader(installId.ToString());

    /// <summary>A client that sends <paramref name="header"/> as X-Install-Id unchecked, or no header when null.</summary>
    public static HttpClient CreateClientWithInstallHeader(this WebApplicationFactory<Program> api, string? header)
    {
        var client = api.CreateClient();
        if (header is not null)
        {
            client.DefaultRequestHeaders.TryAddWithoutValidation(Header, header);
        }

        return client;
    }
}
