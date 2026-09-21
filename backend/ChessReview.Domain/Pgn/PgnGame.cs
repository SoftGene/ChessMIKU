using System.Text.RegularExpressions;

namespace ChessReview.Domain;

/// <summary>
/// Tags and main-line moves of a game in PGN: what the review needs, without checking that the
/// moves are legal.
/// </summary>
public sealed partial class PgnGame
{
    private static readonly string[] Results = ["1-0", "0-1", "1/2-1/2", "*"];

    private readonly Dictionary<string, string> _tags;

    private PgnGame(Dictionary<string, string> tags, List<string> moves)
    {
        _tags = tags;
        Moves = moves;
    }

    /// <summary>Main-line moves in SAN as written, check marks and annotations included.</summary>
    public IReadOnlyList<string> Moves { get; }

    public string? Tag(string name) => _tags.GetValueOrDefault(name);

    public static PgnGame Parse(string pgn)
    {
        var tags = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (Match tag in TagPattern().Matches(pgn))
        {
            tags[tag.Groups["name"].Value] = tag.Groups["value"].Value.Replace("\\\"", "\"").Replace("\\\\", "\\");
        }

        var movetext = CommentPattern().Replace(TagPattern().Replace(pgn, " "), " ");

        // Variations nest: remove the innermost ones until none are left.
        while (VariationPattern().IsMatch(movetext))
        {
            movetext = VariationPattern().Replace(movetext, " ");
        }

        var moves = new List<string>();
        foreach (var token in movetext.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
        {
            var move = MoveNumberPattern().Replace(token, "");
            if (move.Length > 0 && !move.StartsWith('$') && !Results.Contains(move))
            {
                moves.Add(move);
            }
        }

        return new PgnGame(tags, moves);
    }

    [GeneratedRegex("""^\[(?<name>\w+)\s+"(?<value>(?:[^"\\]|\\.)*)"\]\s*$""", RegexOptions.Multiline)]
    private static partial Regex TagPattern();

    // {...} comments, and ; comments to the end of the line.
    [GeneratedRegex(@"\{[^}]*\}|;[^\n]*")]
    private static partial Regex CommentPattern();

    [GeneratedRegex(@"\([^()]*\)")]
    private static partial Regex VariationPattern();

    // "1." or "12..." in front of a move.
    [GeneratedRegex(@"^\d+\.+")]
    private static partial Regex MoveNumberPattern();
}
