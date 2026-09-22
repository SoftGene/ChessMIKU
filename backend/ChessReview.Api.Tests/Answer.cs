using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace ChessReview.Api.Tests;

/// <summary>A response of the API with what the tests look at.</summary>
public sealed record Answer(HttpStatusCode Status, string? MediaType, TimeSpan? RetryAfter, JsonObject Body)
{
    public Guid? AnalysisId => Id("analysisId");

    public Guid? InstallId => Id("installId");

    public static async Task<Answer> ReadAsync(HttpResponseMessage response) => new(
        response.StatusCode,
        response.Content.Headers.ContentType?.MediaType,
        response.Headers.RetryAfter?.Delta,
        await response.Content.ReadFromJsonAsync<JsonObject>(TestContext.Current.CancellationToken)
            ?? throw new InvalidOperationException("Empty response body."));

    private Guid? Id(string name) => Body[name]?.GetValue<string>() is { } id ? Guid.Parse(id) : null;
}
