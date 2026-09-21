namespace ChessReview.Domain;

/// <summary>
/// Engine evaluations of one half-move. Both evaluations are in centipawns and from the point
/// of view of the side making the move.
/// </summary>
/// <param name="EvalBeforeCp">Position before the move, assuming the engine's best move.</param>
/// <param name="EvalAfterCp">Position after the move actually played.</param>
public sealed record MoveEvaluation(int Ply, string Uci, string BestMoveUci, int EvalBeforeCp, int EvalAfterCp)
{
    /// <summary>
    /// How much the move gave away compared with the engine's best move. Never negative: a
    /// deeper second search can rate the position after the move higher than before it.
    /// </summary>
    public int LossCp => Math.Max(0, EvalBeforeCp - EvalAfterCp);
}
