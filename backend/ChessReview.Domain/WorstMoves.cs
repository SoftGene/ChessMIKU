using static ChessReview.Domain.MoveClassification;

namespace ChessReview.Domain;

/// <summary>The moves worth explaining: up to three errors that gave away the most expected points.</summary>
public static class WorstMoves
{
    public const int Count = 3;

    private static readonly HashSet<MoveClassification> Errors = [Inaccuracy, Mistake, Miss, Blunder];

    /// <returns>Plies of the picked moves, in the order they were played.</returns>
    public static IReadOnlyList<int> Pick(IReadOnlyList<MoveEvaluation> moves, IReadOnlyList<MoveClassification> classes)
    {
        if (moves.Count != classes.Count)
        {
            throw new ArgumentException($"{moves.Count} moves but {classes.Count} classes: each move needs its class.", nameof(classes));
        }

        return
        [
            .. moves.Zip(classes)
                .Where(move => Errors.Contains(move.Second))
                .OrderByDescending(move => move.First.ExpectedPointsLoss)
                .ThenBy(move => move.First.Ply)
                .Take(Count)
                .Select(move => move.First.Ply)
                .Order(),
        ];
    }
}
