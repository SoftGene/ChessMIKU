using System.Text.Json.Nodes;
using ChessReview.Testing;
using YamlDotNet.Serialization;

namespace ChessReview.Api.Tests;

/// <summary>
/// Examples from contracts/api.yaml as JSON, so that tests send and expect exactly what the
/// contract documents.
/// </summary>
internal static class Contract
{
    public static readonly string[] InstallRegistered =
        ["paths", "/api/installs", "post", "responses", "201", "content", "application/json", "example"];

    public static readonly string[] CreateAnalysisRequest =
        ["paths", "/api/analyses", "post", "requestBody", "content", "application/json", "example"];

    public static readonly string[] AnalysisAccepted =
        ["paths", "/api/analyses", "post", "responses", "202", "content", "application/json", "example"];

    public static readonly string[] AnalysisFromCache =
        ["paths", "/api/analyses", "post", "responses", "200", "content", "application/json", "example"];

    public static readonly string[] AnalysisPending = AnalysisResult("pending");

    public static readonly string[] AnalysisReady = AnalysisResult("ready");

    public static readonly string[] AnalysisFailed = AnalysisResult("failed");

    public static readonly string[] AnalysisNotFound =
        ["components", "responses", "AnalysisNotFound", "content", "application/problem+json", "example"];

    public static readonly string[] UnknownInstall =
        ["components", "responses", "UnknownInstall", "content", "application/problem+json", "example"];

    public static readonly string[] DailyQuotaExceeded = TooManyRequests("dailyQuota");

    public static readonly string[] RateLimited = TooManyRequests("rateLimited");

    private static readonly JsonNode Document = Load();

    /// <summary>A fresh copy of the example at <paramref name="path"/>.</summary>
    public static JsonObject Example(string[] path) =>
        path.Aggregate(Document, (node, key) => node[key] ?? throw new KeyNotFoundException($"{string.Join('/', path)}: no '{key}'"))
            .DeepClone()
            .AsObject();

    private static string[] AnalysisResult(string example) =>
        ["paths", "/api/analyses/{analysisId}", "get", "responses", "200", "content", "application/json", "examples", example, "value"];

    private static string[] TooManyRequests(string example) =>
        ["components", "responses", "TooManyRequests", "content", "application/problem+json", "examples", example, "value"];

    private static JsonNode Load()
    {
        var yaml = File.ReadAllText(Path.Combine(RepositoryPaths.Root, "contracts", "api.yaml"));
        var graph = new DeserializerBuilder().WithAttemptingUnquotedStringTypeDeserialization().Build().Deserialize<object>(yaml);

        return ToJson(graph) ?? throw new InvalidOperationException("contracts/api.yaml is empty.");
    }

    private static JsonNode? ToJson(object? value) => value switch
    {
        null => null,
        IDictionary<object, object> map => new JsonObject(map.Select(entry => KeyValuePair.Create(entry.Key.ToString()!, ToJson(entry.Value)))),
        IList<object> list => new JsonArray([.. list.Select(ToJson)]),
        string text => JsonValue.Create(text),
        bool flag => JsonValue.Create(flag),

        // YamlDotNet picks the smallest numeric type that fits, byte included.
        byte or sbyte or short or ushort or int or uint or long => JsonValue.Create(Convert.ToInt64(value, System.Globalization.CultureInfo.InvariantCulture)),
        float or double or decimal => JsonValue.Create(Convert.ToDouble(value, System.Globalization.CultureInfo.InvariantCulture)),

        _ => throw new NotSupportedException($"Unexpected YAML value {value} ({value.GetType()})."),
    };
}
