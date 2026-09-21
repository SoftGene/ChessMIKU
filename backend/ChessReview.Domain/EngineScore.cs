namespace ChessReview.Domain;

/// <summary>
/// Engine evaluation of a position from the point of view of the side making the move:
/// centipawns, or a forced mate.
/// </summary>
public sealed record EngineScore
{
    // Lichess fit of the expected score against centipawns, from games between players rated
    // about 2300: https://lichess.org/page/accuracy
    private const double LichessSlope = 0.00368208;

    private EngineScore(int? centipawns, int? mateIn)
    {
        Centipawns = centipawns;
        MateIn = mateIn;
    }

    public int? Centipawns { get; }

    public int? MateIn { get; }

    /// <summary>
    /// Expected score of the side making the move: 0.0 lost, 0.5 equal, 1.0 won.
    /// </summary>
    public double ExpectedPoints => MateIn is { } moves
        ? moves >= 0 ? 1.0 : 0.0
        : 1.0 / (1.0 + Math.Exp(-LichessSlope * Centipawns!.Value));

    public static EngineScore FromCentipawns(int centipawns) => new(centipawns, null);

    /// <summary>
    /// Forced mate in <paramref name="moves"/> moves: positive when the side making the move
    /// mates, negative when it is mated, zero when its move has just delivered mate.
    /// </summary>
    public static EngineScore FromMateIn(int moves) => new(null, moves);
}
