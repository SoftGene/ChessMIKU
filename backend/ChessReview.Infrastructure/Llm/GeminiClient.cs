using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace ChessReview.Infrastructure.Llm;

public sealed class GeminiOptions
{
    public const string Section = "Gemini";

    /// <summary>Key from Google AI Studio. Only from the environment or user secrets, never from a file in the repository.</summary>
    [Required]
    public string ApiKey { get; set; } = "";

    /// <summary>Models to ask in turn: each has its own free-tier limits.</summary>
    [Required]
    [MinLength(1)]
    public string[] Models { get; set; } = [];
}

/// <summary>
/// The Gemini API (generateContent). The HttpClient must have the API root as its base address:
/// https://generativelanguage.googleapis.com/.
/// </summary>
public sealed class GeminiClient(HttpClient http, IOptions<GeminiOptions> options) : ILlmClient
{
    public async Task<LlmAnswer> GenerateJsonAsync(LlmRequest request, CancellationToken cancellationToken)
    {
        var refusals = new List<string>();
        foreach (var model in options.Value.Models)
        {
            var (response, body) = await SendAsync(model, request, cancellationToken);
            using (response)
            {
                if (response.IsSuccessStatusCode)
                {
                    return new LlmAnswer(AnswerText(body), model);
                }

                var error = $"{model}: {(int)response.StatusCode} {response.StatusCode}: {ErrorMessage(body)}";

                // A model at its limit or overloaded may leave room in the next one: each has its own limits.
                if (response.StatusCode is not (HttpStatusCode.TooManyRequests or HttpStatusCode.ServiceUnavailable))
                {
                    throw new LlmException($"Gemini answered {error}");
                }

                refusals.Add(error);
            }
        }

        throw new LlmException($"Every Gemini model refused. {string.Join("; ", refusals)}");
    }

    private async Task<(HttpResponseMessage Response, string Body)> SendAsync(string model, LlmRequest request, CancellationToken cancellationToken)
    {
        using var message = new HttpRequestMessage(HttpMethod.Post, $"v1beta/models/{Uri.EscapeDataString(model)}:generateContent")
        {
            Content = JsonContent.Create(new
            {
                systemInstruction = new { parts = new[] { new { text = request.Instructions } } },
                contents = new[] { new { role = "user", parts = new[] { new { text = request.Input } } } },
                generationConfig = new { responseMimeType = "application/json" },
            }),
        };

        // In a header, not in the URL: URLs end up in logs.
        message.Headers.Add("x-goog-api-key", options.Value.ApiKey);

        var response = await http.SendAsync(message, cancellationToken);
        return (response, await response.Content.ReadAsStringAsync(cancellationToken));
    }

    private static string AnswerText(string body)
    {
        using var answer = JsonDocument.Parse(body);
        var root = answer.RootElement;

        if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
        {
            var reason = root.TryGetProperty("promptFeedback", out var feedback) && feedback.TryGetProperty("blockReason", out var blockReason)
                ? blockReason.GetString()
                : "no reason given";
            throw new LlmException($"Gemini gave no answer: {reason}.");
        }

        var candidate = candidates[0];
        var finishReason = candidate.TryGetProperty("finishReason", out var finish) ? finish.GetString() : null;
        if (finishReason != "STOP")
        {
            throw new LlmException($"Gemini stopped before the end of the answer: {finishReason ?? "no reason given"}.");
        }

        var text = new StringBuilder();
        if (candidate.TryGetProperty("content", out var content) && content.TryGetProperty("parts", out var parts))
        {
            foreach (var part in parts.EnumerateArray())
            {
                var isThought = part.TryGetProperty("thought", out var thought) && thought.ValueKind == JsonValueKind.True;
                if (!isThought && part.TryGetProperty("text", out var partText))
                {
                    text.Append(partText.GetString());
                }
            }
        }

        return text.Length > 0 ? text.ToString() : throw new LlmException("Gemini answered with no text.");
    }

    private static string ErrorMessage(string body)
    {
        try
        {
            using var error = JsonDocument.Parse(body);
            return error.RootElement.GetProperty("error").GetProperty("message").GetString() ?? body;
        }
        catch (Exception exception) when (exception is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            return body.Length <= 500 ? body : body[..500];
        }
    }
}
