using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using ChessReview.Infrastructure.Llm;
using Microsoft.Extensions.Options;

namespace ChessReview.Infrastructure.Tests;

// No network: every answer comes from a handler that records the requests.
public class GeminiClientTests
{
    private const string Key = "test-key-7f3a";

    private const string Base = "https://generativelanguage.googleapis.com/v1beta/models/";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_request_carries_the_instructions_and_the_input_to_the_first_model()
    {
        var handler = new RecordingHandler(_ => (HttpStatusCode.OK, Answer("{}")));

        await Client(handler).GenerateJsonAsync(new LlmRequest("Explain the moves.", "{\"moves\":[]}"), Ct);

        var request = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal($"{Base}gemini-test:generateContent", request.Uri);
        Assert.Equal([Key], request.KeyHeader);
        var body = JsonNode.Parse(request.Body)!;
        Assert.Equal("Explain the moves.", body["systemInstruction"]!["parts"]![0]!["text"]!.GetValue<string>());
        Assert.Equal("user", body["contents"]![0]!["role"]!.GetValue<string>());
        Assert.Equal("{\"moves\":[]}", body["contents"]![0]!["parts"]![0]!["text"]!.GetValue<string>());
        Assert.Equal("application/json", body["generationConfig"]!["responseMimeType"]!.GetValue<string>());
    }

    [Fact]
    public async Task The_answer_is_the_text_of_the_first_candidate_without_its_thoughts()
    {
        var answer = """
            {"candidates": [{"content": {"role": "model", "parts": [
                {"text": "Let me think.", "thought": true},
                {"text": "{\"ok\":"},
                {"text": "true}"}
            ]}, "finishReason": "STOP"}]}
            """;

        var reply = await Client(new RecordingHandler(_ => (HttpStatusCode.OK, answer))).GenerateJsonAsync(new LlmRequest("i", "x"), Ct);

        Assert.Equal(("{\"ok\":true}", "gemini-test"), (reply.Text, reply.Model));
    }

    [Theory]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.ServiceUnavailable)]
    public async Task A_model_at_its_limit_or_overloaded_hands_the_request_to_the_next(HttpStatusCode refusal)
    {
        var handler = new RecordingHandler(request => request.RequestUri!.AbsolutePath.Contains("gemini-test", StringComparison.Ordinal)
            ? (refusal, Error((int)refusal, "Try again later."))
            : (HttpStatusCode.OK, Answer("{\"ok\":true}")));

        var reply = await Client(handler).GenerateJsonAsync(new LlmRequest("i", "x"), Ct);

        Assert.Equal(("{\"ok\":true}", "gemini-spare"), (reply.Text, reply.Model));
        Assert.Equal([$"{Base}gemini-test:generateContent", $"{Base}gemini-spare:generateContent"], handler.Requests.Select(r => r.Uri));
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest)]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.NotFound)]
    public async Task Other_errors_are_not_retried_on_the_next_model(HttpStatusCode error)
    {
        var handler = new RecordingHandler(_ => (error, Error((int)error, "Bad request.")));

        await Assert.ThrowsAsync<LlmException>(() => Client(handler).GenerateJsonAsync(new LlmRequest("i", "x"), Ct));

        Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task When_every_model_refuses_the_error_names_each_one_and_never_the_key()
    {
        var handler = new RecordingHandler(request => request.RequestUri!.AbsolutePath.Contains("gemini-test", StringComparison.Ordinal)
            ? (HttpStatusCode.TooManyRequests, Error(429, "Resource has been exhausted (e.g. check quota)."))
            : (HttpStatusCode.ServiceUnavailable, Error(503, "This model is currently experiencing high demand.")));

        var exception = await Assert.ThrowsAsync<LlmException>(() => Client(handler).GenerateJsonAsync(new LlmRequest("i", "x"), Ct));

        Assert.Contains("gemini-test: 429 TooManyRequests: Resource has been exhausted", exception.Message, StringComparison.Ordinal);
        Assert.Contains("gemini-spare: 503 ServiceUnavailable: This model is currently experiencing high demand.", exception.Message, StringComparison.Ordinal);
        Assert.DoesNotContain(Key, exception.Message, StringComparison.Ordinal);
    }

    public static TheoryData<string, string> Unusable => new()
    {
        { """{"promptFeedback": {"blockReason": "SAFETY"}}""", "SAFETY" },
        { """{"candidates": [{"content": {"parts": [{"text": "{\"cut"}]}, "finishReason": "MAX_TOKENS"}]}""", "MAX_TOKENS" },
        { """{"candidates": [{"content": {"parts": []}, "finishReason": "STOP"}]}""", "no text" },
    };

    [Theory]
    [MemberData(nameof(Unusable))]
    public async Task An_answer_without_complete_text_throws_saying_why(string answer, string reason)
    {
        var exception = await Assert.ThrowsAsync<LlmException>(() =>
            Client(new RecordingHandler(_ => (HttpStatusCode.OK, answer))).GenerateJsonAsync(new LlmRequest("i", "x"), Ct));

        Assert.Contains(reason, exception.Message, StringComparison.Ordinal);
    }

    private static GeminiClient Client(HttpMessageHandler handler) => new(
        new HttpClient(handler) { BaseAddress = new Uri("https://generativelanguage.googleapis.com/") },
        Options.Create(new GeminiOptions { ApiKey = Key, Models = ["gemini-test", "gemini-spare"] }));

    private static string Answer(string text) =>
        new JsonObject
        {
            ["candidates"] = new JsonArray(new JsonObject
            {
                ["content"] = new JsonObject { ["parts"] = new JsonArray(new JsonObject { ["text"] = text }) },
                ["finishReason"] = "STOP",
            }),
        }.ToJsonString();

    private static string Error(int code, string message) =>
        new JsonObject { ["error"] = new JsonObject { ["code"] = code, ["message"] = message } }.ToJsonString();

    private sealed record Recorded(HttpMethod Method, string Uri, IEnumerable<string>? KeyHeader, string Body);

    private sealed class RecordingHandler(Func<HttpRequestMessage, (HttpStatusCode Status, string Body)> answer) : HttpMessageHandler
    {
        public List<Recorded> Requests { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(new Recorded(
                request.Method,
                request.RequestUri!.ToString(),
                request.Headers.TryGetValues("x-goog-api-key", out var key) ? key : null,
                request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken)));

            var (status, body) = answer(request);
            return new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        }
    }
}
