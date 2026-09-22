namespace ChessReview.Infrastructure.Llm;

/// <summary>A language model that answers with JSON text.</summary>
public interface ILlmClient
{
    /// <summary>Name of the model, stored with every explanation it writes.</summary>
    string Model { get; }

    /// <exception cref="LlmException">The model gave no usable answer.</exception>
    Task<string> GenerateJsonAsync(LlmRequest request, CancellationToken cancellationToken);
}

/// <param name="Instructions">What the model must do, the same for every request.</param>
/// <param name="Input">The data of this request.</param>
public sealed record LlmRequest(string Instructions, string Input);

public sealed class LlmException(string message) : Exception(message);
