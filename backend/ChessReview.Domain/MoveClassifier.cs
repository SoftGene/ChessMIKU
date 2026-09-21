namespace ChessReview.Domain;

public static class MoveClassifier
{
    // Loss thresholds in centipawns, section 6 of the spec.
    private const int InaccuracyFromCp = 50;
    private const int MistakeFromCp = 100;
    private const int BlunderFromCp = 300;

    public static MoveClassification Classify(MoveEvaluation move)
    {
        if (string.Equals(move.Uci, move.BestMoveUci, StringComparison.Ordinal))
        {
            return MoveClassification.Best;
        }

        return move.LossCp switch
        {
            < InaccuracyFromCp => MoveClassification.Good,
            < MistakeFromCp => MoveClassification.Inaccuracy,
            < BlunderFromCp => MoveClassification.Mistake,
            _ => MoveClassification.Blunder,
        };
    }
}
