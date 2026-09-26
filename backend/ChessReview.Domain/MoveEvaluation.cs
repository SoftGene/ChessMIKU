namespace ChessReview.Domain;

/// <summary>
/// Engine evaluations of one half-move, both from the point of view of the side making the move.
/// </summary>
/// <param name="Before">Position before the move, assuming the engine's best move.</param>
/// <param name="After">Position after the move actually played.</param>
public sealed record MoveEvaluation(int Ply, string Uci, string BestMoveUci, EngineScore Before, EngineScore After, EngineScore? SecondBest = null)
{
    /// <summary>
    /// Expected points the move gave away compared with the engine's best move. Never
    /// negative: a deeper second search can rate the position after the move higher than
    /// before it.
    /// </summary>
    public double ExpectedPointsLoss => Math.Max(0.0, Before.ExpectedPoints - After.ExpectedPoints);
}
