namespace ChessReview.Domain;

public static class MoveClassifier
{
    // Section 6 of the spec. A book move must not be worse than good, so that a trap in the
    // opening list stays a blunder.
    private const double BookLossBelow = 0.05;

    // Our thresholds for a miss; chess.com does not publish its own.
    private const double MissWinningFrom = 0.75;
    private const double MissGivenBackTo = 0.60;

    /// <summary>
    /// Classifies the moves of a game in order, adding the classes that depend on the moves
    /// before: book and miss.
    /// </summary>
    public static IReadOnlyList<MoveClassification> ClassifyGame(IReadOnlyList<MoveEvaluation> moves, OpeningBook book)
    {
        var classes = new MoveClassification[moves.Count];
        var line = new List<string>(moves.Count);
        var inBook = true;

        for (var i = 0; i < moves.Count; i++)
        {
            var move = moves[i];
            if (move.Ply != i + 1)
            {
                throw new ArgumentException($"Move {i + 1} has ply {move.Ply}: moves must come in order from ply 1.", nameof(moves));
            }

            line.Add(move.Uci);
            inBook = inBook && book.Contains(line);

            classes[i] = inBook && move.ExpectedPointsLoss < BookLossBelow
                ? MoveClassification.Book
                : Classify(move);

            if (i > 0 && IsMiss(move, classes[i], classes[i - 1]))
            {
                classes[i] = MoveClassification.Miss;
            }
        }

        return classes;
    }

    /// <summary>
    /// Classifies a single move by its own evaluations. Without the game around it there is
    /// no book and no miss: use <see cref="ClassifyGame"/> for a game.
    /// </summary>
    public static MoveClassification Classify(MoveEvaluation move)
    {
        if (string.Equals(move.Uci, move.BestMoveUci, StringComparison.Ordinal))
        {
            return MoveClassification.Best;
        }

        return ForLoss(move.ExpectedPointsLoss);
    }

    // Thresholds published by chess.com for expected points lost, section 6 of the spec.
    public static MoveClassification ForLoss(double expectedPointsLoss) => expectedPointsLoss switch
    {
        < 0.02 => MoveClassification.Excellent,
        < 0.05 => MoveClassification.Good,
        < 0.10 => MoveClassification.Inaccuracy,
        < 0.20 => MoveClassification.Mistake,
        _ => MoveClassification.Blunder,
    };

    // The opponent has just erred, the mover had a winning position and gave it back.
    private static bool IsMiss(MoveEvaluation move, MoveClassification moveClass, MoveClassification opponentMoveClass) =>
        moveClass is MoveClassification.Mistake or MoveClassification.Blunder
        && opponentMoveClass is MoveClassification.Mistake or MoveClassification.Miss or MoveClassification.Blunder
        && move.Before.ExpectedPoints >= MissWinningFrom
        && move.After.ExpectedPoints <= MissGivenBackTo;
}
