using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using ChessReview.Infrastructure.Llm;
using Microsoft.Extensions.Options;

namespace ChessReview.Infrastructure.Tests;

// No network: every answer comes from a handler that records the request.
public class GeminiClientTests
{
    private const string Key = "test-key-7f3a";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_request_carries_the_instructions_and_the_input_to_the_configured_model()
    {
        var handler = new RecordingHandler(HttpStatusCode.OK, Answer("{}"));

        await Client(handler).GenerateJsonAsync(new LlmRequest("Explain the moves.", "{\"moves\":[]}"), Ct);

        Assert.Equal(HttpMethod.Post, handler.Request!.Method);
        Assert.Equal("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent", handler.Request.RequestUri!.ToString());
        Assert.Equal([Key], handler.Request.Headers.GetValues("x-goog-api-key"));
        var body = JsonNode.Parse(handler.RequestBody!)!;
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

        var text = await Client(new RecordingHandler(HttpStatusCode.OK, answer)).GenerateJsonAsync(new LlmRequest("i", "x"), Ct);

        Assert.Equal("{\"ok\":true}", text);
    }

    [Fact]
    public async Task An_error_answer_throws_with_its_status_and_message_but_never_the_key()
    {
        var error = """{"error": {"code": 429, "message": "Resource has been exhausted (e.g. check quota).", "status": "RESOURCE_EXHAUSTED"}}""";

        var exception = await Assert.ThrowsAsync<LlmException>(() =>
            Client(new RecordingHandler(HttpStatusCode.TooManyRequests, error)).GenerateJsonAsync(new LlmRequest("i", "x"), Ct));

        Assert.Contains("429", exception.Message, StringComparison.Ordinal);
        Assert.Contains("Resource has been exhausted", exception.Message, StringComparison.Ordinal);
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
            Client(new RecordingHandler(HttpStatusCode.OK, answer)).GenerateJsonAsync(new LlmRequest("i", "x"), Ct));

        Assert.Contains(reason, exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void The_model_name_is_the_configured_one()
    {
        Assert.Equal("gemini-test", Client(new RecordingHandler(HttpStatusCode.OK, Answer("{}"))).Model);
    }

    private static GeminiClient Client(HttpMessageHandler handler) => new(
        new HttpClient(handler) { BaseAddress = new Uri("https://generativelanguage.googleapis.com/") },
        Options.Create(new GeminiOptions { ApiKey = Key, Model = "gemini-test" }));

    private static string Answer(string text) =>
        new JsonObject
        {
            ["candidates"] = new JsonArray(new JsonObject
            {
                ["content"] = new JsonObject { ["parts"] = new JsonArray(new JsonObject { ["text"] = text }) },
                ["finishReason"] = "STOP",
            }),
        }.ToJsonString();

    private sealed class RecordingHandler(HttpStatusCode status, string answer) : HttpMessageHandler
    {
        public HttpRequestMessage? Request { get; private set; }

        public string? RequestBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Request = request;
            RequestBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(status) { Content = new StringContent(answer, Encoding.UTF8, "application/json") };
        }
    }
}
