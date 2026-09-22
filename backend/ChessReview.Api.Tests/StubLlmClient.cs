using System.Collections.Concurrent;
using System.Text.Json.Nodes;
using ChessReview.Infrastructure.Llm;

namespace ChessReview.Api.Tests;

/// <summary>A language model for tests: records every request and answers as it is told.</summary>
public sealed class StubLlmClient(Func<LlmRequest, string> answer) : ILlmClient
{
    public const string ModelName = "stub-model";

    /// <summary>Answers nothing: the host's default, so that a test that forgets to set one fails.</summary>
    public StubLlmClient()
        : this(_ => throw new LlmException("The stub has no answer configured."))
    {
    }

    public string Model => ModelName;

    public ConcurrentQueue<LlmRequest> Requests { get; } = new();

    /// <summary>Answers every requested ply with the text <paramref name="text"/> gives for it.</summary>
    public static StubLlmClient Explaining(Func<int, string> text) => new(request => new JsonObject
    {
        ["explanations"] = new JsonArray([.. RequestedPlies(request).Select(ply => new JsonObject { ["ply"] = ply, ["text"] = text(ply) })]),
    }.ToJsonString());

    public static StubLlmClient Failing(string message) => new(_ => throw new LlmException(message));

    public static IReadOnlyList<int> RequestedPlies(LlmRequest request) =>
        [.. JsonNode.Parse(request.Input)!["moves"]!.AsArray().Select(move => move!["ply"]!.GetValue<int>())];

    public Task<string> GenerateJsonAsync(LlmRequest request, CancellationToken cancellationToken)
    {
        Requests.Enqueue(request);
        return Task.FromResult(answer(request));
    }
}

/// <summary>The primary handler of every HttpClient in the test host: tests never reach the network.</summary>
public sealed class NoNetworkHandler : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
        throw new InvalidOperationException($"Tests do not go to the network: {request.Method} {request.RequestUri}");
}
