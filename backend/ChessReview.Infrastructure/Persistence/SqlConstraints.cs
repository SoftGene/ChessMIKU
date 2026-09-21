namespace ChessReview.Infrastructure.Persistence;

// Building blocks for CHECK constraints, so that allowed values come from one place.
internal static class SqlConstraints
{
    public const string UtcNow = "SYSUTCDATETIME()";

    /// <summary>Explanation languages of the API contract.</summary>
    public static readonly string[] Languages = ["ru", "cs", "en"];

    public static string In(string column, IEnumerable<string> values) =>
        $"[{column}] IN ({string.Join(", ", values.Select(value => $"'{value}'"))})";

    public static string ExactlyOneOf(string first, string second) =>
        $"([{first}] IS NULL AND [{second}] IS NOT NULL) OR ([{first}] IS NOT NULL AND [{second}] IS NULL)";
}
