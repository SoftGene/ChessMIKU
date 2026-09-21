using System.ComponentModel.DataAnnotations;
using ChessReview.Domain;

namespace ChessReview.Api.Analyses;

// Request and response bodies of contracts/api.yaml. Enums travel as camelCase strings, and
// validation errors name fields as the JSON does.

public enum Language
{
    Ru,
    Cs,
    En,
}

public enum ExplanationsStatus
{
    Pending,
    Ready,
}

// Classes rather than positional records: MVC names validation errors by JSON name only for
// properties. `required` makes a missing property a 400 even where null is allowed.
public sealed class CreateAnalysisRequest : IValidatableObject
{
    private static readonly string[] FinishedResults = ["1-0", "0-1", "1/2-1/2"];

    [RegularExpression(@"^(live|daily)/[0-9]{1,20}$", ErrorMessage = "Must be the game type and number from the chess.com URL, for example live/123456789012.")]
    public required string ExternalGameId { get; init; }

    [StringLength(65536, MinimumLength = 1)]
    public required string Pgn { get; init; }

    public required Language Language { get; init; }

    [MinLength(1), MaxLength(1000)]
    public required IReadOnlyList<MoveEvaluationRequest> Moves { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        for (var index = 0; index < Moves.Count; index++)
        {
            if (Moves[index].Ply != index + 1)
            {
                yield return new ValidationResult($"Moves must come in order from ply 1: move {index + 1} has ply {Moves[index].Ply}.", ["moves"]);
                yield break;
            }
        }

        var pgn = PgnGame.Parse(Pgn);

        if (!FinishedResults.Contains(pgn.Tag("Result")))
        {
            yield return new ValidationResult("The game is not finished: the Result tag must be 1-0, 0-1 or 1/2-1/2.", ["pgn"]);
        }

        if (string.IsNullOrWhiteSpace(pgn.Tag("White")) || string.IsNullOrWhiteSpace(pgn.Tag("Black")))
        {
            yield return new ValidationResult("The PGN must name both players in the White and Black tags.", ["pgn"]);
        }

        if (MismatchWithPgn(pgn.Moves) is { } mismatch)
        {
            yield return new ValidationResult(mismatch, ["moves"]);
        }
    }

    private string? MismatchWithPgn(IReadOnlyList<string> pgnMoves)
    {
        for (var index = 0; index < Math.Max(pgnMoves.Count, Moves.Count); index++)
        {
            var inPgn = index < pgnMoves.Count ? Bare(pgnMoves[index]) : null;
            var inList = index < Moves.Count ? Bare(Moves[index].San) : null;
            if (inPgn != inList)
            {
                return $"The moves do not match the PGN: move {index + 1} is {inPgn ?? "missing"} in the PGN and {inList ?? "missing"} in the list.";
            }
        }

        return null;
    }

    // Check marks and annotations are written differently by different tools.
    private static string Bare(string san) => san.TrimEnd('+', '#', '!', '?');
}

public sealed class MoveEvaluationRequest : IValidatableObject
{
    private const string UciPattern = "^[a-h][1-8][a-h][1-8][qrbn]?$";
    private const string UciMessage = "Must be a move in UCI notation, for example e2e4.";

    [Range(1, 1000)]
    public required int Ply { get; init; }

    [StringLength(10, MinimumLength = 2)]
    public required string San { get; init; }

    [RegularExpression(UciPattern, ErrorMessage = UciMessage)]
    public required string Uci { get; init; }

    [RegularExpression(UciPattern, ErrorMessage = UciMessage)]
    public required string BestMoveUci { get; init; }

    [Range(-32000, 32000)]
    public required int? EvalBeforeCp { get; init; }

    [Range(-500, 500)]
    public required int? MateBefore { get; init; }

    [Range(-32000, 32000)]
    public required int? EvalAfterCp { get; init; }

    [Range(-500, 500)]
    public required int? MateAfter { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (EvalBeforeCp is null == MateBefore is null)
        {
            yield return new ValidationResult("Set exactly one of evalBeforeCp and mateBefore.", ["evalBeforeCp", "mateBefore"]);
        }

        if (EvalAfterCp is null == MateAfter is null)
        {
            yield return new ValidationResult("Set exactly one of evalAfterCp and mateAfter.", ["evalAfterCp", "mateAfter"]);
        }

        if (MateBefore == 0)
        {
            yield return new ValidationResult("mateBefore cannot be 0: a side that is already mated has no move to make.", ["mateBefore"]);
        }
    }
}

public sealed record AnalysisAccepted(
    Guid AnalysisId,
    IReadOnlyList<MoveClassificationResult> Classifications,
    ExplanationsStatus ExplanationsStatus);

public sealed record MoveClassificationResult(int Ply, MoveClassification Classification);

public enum AnalysisStatus
{
    Pending,
    Ready,
    Failed,
}

public sealed record AnalysisResult(
    AnalysisStatus Status,
    IReadOnlyList<MoveClassificationResult> Classifications,
    IReadOnlyList<ExplanationResult> Explanations);

public sealed record ExplanationResult(int Ply, string Text);
