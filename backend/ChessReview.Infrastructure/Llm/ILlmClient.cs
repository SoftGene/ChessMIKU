namespace ChessReview.Infrastructure.Llm;

/// <summary>A language model that answers with JSON text.</summary>
public interface ILlmClient
{
    /// <exception cref="LlmException">No model gave a usable answer.</exception>
    Task<LlmAnswer> GenerateJsonAsync(LlmRequest request, CancellationToken cancellationToken);
}

/// <param name="Instructions">What the model must do, the same for every request.</param>
/// <param name="Input">The data of this request.</param>
public sealed record LlmRequest(string Instructions, string Input);

/// <param name="Model">The model that wrote the answer, stored with every explanation.</param>
public sealed record LlmAnswer(string Text, string Model);

public sealed class LlmException(string message) : Exception(message);
