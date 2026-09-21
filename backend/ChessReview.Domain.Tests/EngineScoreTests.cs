namespace ChessReview.Domain.Tests;

public class EngineScoreTests
{
    [Fact]
    public void Equal_position_is_half_a_point()
    {
        Assert.Equal(0.5, EngineScore.FromCentipawns(0).ExpectedPoints, precision: 10);
    }

    [Theory]
    [InlineData(100, 0.591)]
    [InlineData(300, 0.751)]
    [InlineData(-300, 0.249)]
    public void Centipawns_follow_the_Lichess_curve(int centipawns, double expected)
    {
        Assert.Equal(expected, EngineScore.FromCentipawns(centipawns).ExpectedPoints, precision: 3);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(50)]
    [InlineData(300)]
    [InlineData(1000)]
    public void Curve_is_symmetric(int centipawns)
    {
        var gain = EngineScore.FromCentipawns(centipawns).ExpectedPoints;
        var loss = EngineScore.FromCentipawns(-centipawns).ExpectedPoints;

        Assert.Equal(1.0, gain + loss, precision: 10);
    }

    [Theory]
    [InlineData(1, 1.0)]
    [InlineData(12, 1.0)]
    [InlineData(0, 1.0)]
    [InlineData(-1, 0.0)]
    [InlineData(-7, 0.0)]
    public void Forced_mate_decides_the_game(int mateIn, double expected)
    {
        Assert.Equal(expected, EngineScore.FromMateIn(mateIn).ExpectedPoints);
    }

    [Fact]
    public void Huge_centipawn_score_is_never_better_than_mate()
    {
        // Stockfish reports tablebase wins as centipawn scores close to 20000.
        var tablebaseWin = EngineScore.FromCentipawns(20000).ExpectedPoints;
        var tablebaseLoss = EngineScore.FromCentipawns(-20000).ExpectedPoints;

        Assert.InRange(tablebaseWin, 0.999, EngineScore.FromMateIn(1).ExpectedPoints);
        Assert.InRange(tablebaseLoss, EngineScore.FromMateIn(-1).ExpectedPoints, 0.001);
    }
}
