namespace ChessReview.Domain;

public static class MoveClassifier
{
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
}
