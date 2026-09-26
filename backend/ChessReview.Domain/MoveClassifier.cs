namespace ChessReview.Domain;

public static class MoveClassifier
{
    public const int Version = 2;

    // Section 6 of the spec. A book move must not be worse than good, so that a trap in the
    // opening list stays a blunder.
    private const double BookLossBelow = 0.05;

    // Our thresholds for a miss; chess.com does not publish its own.
    private const double MissWinningFrom = 0.75;
    private const double MissGivenBackTo = 0.60;

    // A brilliant move (design T7.2b): a sacrifice that is the best move or within this loss of it, that keeps the
    // game at least about equal, played before the game was already won. Our values; chess.com does not publish its own.
    private const double BrilliantLossBelow = 0.02;
    private const double BrilliantAfterFrom = 0.45;
    private const double BrilliantBeforeBelow = 0.90;

    // A great move: the best move, where the second best would give this much away, a mistake.
    private const double GreatGapFrom = 0.10;

    /// <summary>
    /// Classifies the moves of a game in order, adding the classes that depend on the moves
    /// before and on the board: book, brilliant, great and miss.
    /// </summary>
    public static IReadOnlyList<MoveClassification> ClassifyGame(IReadOnlyList<MoveEvaluation> moves, OpeningBook book)
    {
        var classes = new MoveClassification[moves.Count];
        var line = new List<string>(moves.Count);
        var inBook = true;
        var position = Position.Start;
        // The square the move before took on, if it took: a move taking back there is plain to see.
        string? lastCapture = null;

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
                : IsBrilliant(move, position)
                    ? MoveClassification.Brilliant
                    : IsGreat(move, position, lastCapture)
                        ? MoveClassification.Great
                        : Classify(move);

            lastCapture = position.Captures(move.Uci) ? move.Uci[2..4] : null;
            position = position.Play(move.Uci);

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

    // A sacrifice that costs almost nothing and keeps the game, in a game not yet won.
    private static bool IsBrilliant(MoveEvaluation move, Position before) =>
        move.ExpectedPointsLoss < BrilliantLossBelow
        && move.Before.ExpectedPoints < BrilliantBeforeBelow
        && move.After.ExpectedPoints >= BrilliantAfterFrom
        && before.Sacrifices(move.Uci);

    // The only good move: the engine's best, the second best a mistake. Not a plain recapture on the square just
    // taken, and not a move that had no other to choose from (no second best).
    private static bool IsGreat(MoveEvaluation move, Position before, string? lastCapture) =>
        string.Equals(move.Uci, move.BestMoveUci, StringComparison.Ordinal)
        && move.SecondBest is { } second
        && move.Before.ExpectedPoints - second.ExpectedPoints >= GreatGapFrom
        && !(lastCapture == move.Uci[2..4] && before.Captures(move.Uci));

    // The opponent has just erred, the mover had a winning position and gave it back.
    private static bool IsMiss(MoveEvaluation move, MoveClassification moveClass, MoveClassification opponentMoveClass) =>
        moveClass is MoveClassification.Mistake or MoveClassification.Blunder
        && opponentMoveClass is MoveClassification.Mistake or MoveClassification.Miss or MoveClassification.Blunder
        && move.Before.ExpectedPoints >= MissWinningFrom
        && move.After.ExpectedPoints <= MissGivenBackTo;
}
