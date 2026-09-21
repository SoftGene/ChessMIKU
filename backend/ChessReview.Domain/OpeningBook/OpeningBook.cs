namespace ChessReview.Domain;

/// <summary>
/// Known opening lines. A sequence of moves is in the book when it is the start of one of the
/// lines. Transpositions are not recognised.
/// </summary>
public sealed class OpeningBook
{
    private const string LichessResource = "ChessReview.Domain.lichess-openings.tsv";

    private static readonly Lazy<OpeningBook> LichessBook = new(LoadLichess);

    // Every start of every line, as UCI moves joined by spaces.
    private readonly HashSet<string> _sequences = new(StringComparer.Ordinal);

    public OpeningBook(IEnumerable<IReadOnlyList<string>> lines)
    {
        foreach (var line in lines)
        {
            for (var length = 1; length <= line.Count; length++)
            {
                _sequences.Add(string.Join(' ', line.Take(length)));
            }
        }
    }

    /// <summary>The Lichess opening list, see OpeningBook/SOURCE.md.</summary>
    public static OpeningBook Lichess => LichessBook.Value;

    public bool Contains(IEnumerable<string> uciMoves) => _sequences.Contains(string.Join(' ', uciMoves));

    private static OpeningBook LoadLichess()
    {
        using var stream = typeof(OpeningBook).Assembly.GetManifestResourceStream(LichessResource)
            ?? throw new InvalidOperationException($"Resource {LichessResource} is missing.");
        using var reader = new StreamReader(stream);

        reader.ReadLine(); // header: eco, name, uci
        var lines = new List<IReadOnlyList<string>>();
        while (reader.ReadLine() is { } row)
        {
            lines.Add(row.Split('\t')[2].Split(' '));
        }

        return new OpeningBook(lines);
    }
}
