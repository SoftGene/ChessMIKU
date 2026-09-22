using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using ChessReview.Domain;
using ChessReview.Infrastructure.Llm;
using ChessReview.Infrastructure.Persistence;

namespace ChessReview.ExplanationWorker;

/// <summary>
/// What the model gets and what it must answer. It gets only data the engine produced; it
/// formulates, it does not analyse.
/// </summary>
public static class ExplanationPrompt
{
    public const int MaxTextLength = 1000;

    private static readonly Dictionary<string, string> Languages = new() { ["ru"] = "Russian", ["cs"] = "Czech", ["en"] = "English" };

    public static LlmRequest Build(string language, IReadOnlyList<Move> game, IReadOnlyList<int> plies)
    {
        var instructions = $$"""
            You explain errors in a finished chess game to the player who made them.
            For every move in the input you get the move number, the move played in SAN, the engine's best move in UCI, the evaluation before and after the move, the class of the error and the position before the move in FEN.
            Write 2 or 3 sentences per move in {{Languages[language]}}: what the move cost according to the evaluations, and which move the engine preferred.
            Use only this data. Do not analyse the position yourself, do not mention any other move and do not invent variations.
            Name the engine's move in standard algebraic notation, working it out from the FEN and the UCI move.
            Answer with JSON only: {"explanations": [{"ply": <ply from the input>, "text": "<the explanation>"}]}, one entry for every input move.
            """;

        var moves = new JsonArray();
        foreach (var ply in plies)
        {
            var move = game.Single(m => m.Ply == ply);
            var mover = ply % 2 == 1 ? "White" : "Black";
            var opponent = ply % 2 == 1 ? "Black" : "White";
            moves.Add(new JsonObject
            {
                ["ply"] = ply,
                ["moveNumber"] = $"{(ply + 1) / 2}{(ply % 2 == 1 ? "." : "...")}",
                ["played"] = move.San,
                ["bestMove"] = move.BestMoveUci,
                ["evaluationBefore"] = Evaluation(move.EvalBeforeCp, move.MateBefore, mover, opponent),
                ["evaluationAfter"] = Evaluation(move.EvalAfterCp, move.MateAfter, mover, opponent),
                ["classification"] = JsonNamingPolicy.CamelCase.ConvertName(move.Classification.ToString()),
                ["fen"] = Position.AfterMoves(game.Where(m => m.Ply < ply).OrderBy(m => m.Ply).Select(m => m.Uci)).Fen,
            });
        }

        return new LlmRequest(instructions, new JsonObject { ["moves"] = moves }.ToJsonString());
    }

    /// <returns>Text for every requested ply.</returns>
    /// <exception cref="LlmException">The answer is not JSON of the requested shape.</exception>
    public static IReadOnlyDictionary<int, string> ParseReply(string reply, IReadOnlyList<int> plies)
    {
        JsonNode? answer;
        try
        {
            answer = JsonNode.Parse(reply);
        }
        catch (JsonException exception)
        {
            throw DoesNotFit($"not JSON ({exception.Message})");
        }

        if (answer?["explanations"] is not JsonArray explanations)
        {
            throw DoesNotFit("no explanations array");
        }

        var texts = new Dictionary<int, string>();
        foreach (var explanation in explanations)
        {
            var ply = explanation?["ply"] is JsonValue plyValue && plyValue.TryGetValue<int>(out var number) ? number : (int?)null;
            var text = explanation?["text"] is JsonValue textValue && textValue.TryGetValue<string>(out var value) ? value.Trim() : "";

            if (ply is not { } requested || !plies.Contains(requested) || !texts.TryAdd(requested, text))
            {
                throw DoesNotFit($"unexpected or repeated ply {explanation?["ply"]?.ToJsonString() ?? "none"}");
            }

            if (text.Length is 0 or > MaxTextLength)
            {
                throw DoesNotFit($"the text for ply {requested} has {text.Length} characters");
            }
        }

        var missing = plies.Except(texts.Keys).ToList();
        return missing.Count == 0 ? texts : throw DoesNotFit($"no text for ply {string.Join(", ", missing)}");
    }

    // The side that moved is named: a sign would leave the model to guess whose point of view it is.
    private static string Evaluation(int? centipawns, short? mateIn, string mover, string opponent) => (centipawns, mateIn) switch
    {
        (0, _) => "the position is equal",
        ({ } cp, _) => $"{(cp > 0 ? mover : opponent)} is better by {(Math.Abs(cp) / 100.0).ToString("0.00", CultureInfo.InvariantCulture)} pawns",
        (_, 0) => $"{mover} has given checkmate",
        (_, { } mate) => $"{(mate > 0 ? mover : opponent)} mates in {Math.Abs(mate).ToString(CultureInfo.InvariantCulture)}",
        _ => throw new ArgumentException("A move needs an evaluation in centipawns or mate."),
    };

    private static LlmException DoesNotFit(string reason) => new($"The model's answer does not fit: {reason}.");
}
