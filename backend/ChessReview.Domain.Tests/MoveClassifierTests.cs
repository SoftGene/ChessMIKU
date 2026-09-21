namespace ChessReview.Domain.Tests;

public class MoveClassifierTests
{
    [Theory]
    [InlineData(0.0, MoveClassification.Excellent)]
    [InlineData(0.0199, MoveClassification.Excellent)]
    [InlineData(0.02, MoveClassification.Good)]
    [InlineData(0.0499, MoveClassification.Good)]
    [InlineData(0.05, MoveClassification.Inaccuracy)]
    [InlineData(0.0999, MoveClassification.Inaccuracy)]
    [InlineData(0.10, MoveClassification.Mistake)]
    [InlineData(0.1999, MoveClassification.Mistake)]
    [InlineData(0.20, MoveClassification.Blunder)]
    [InlineData(1.0, MoveClassification.Blunder)]
    public void Expected_points_loss_thresholds_follow_chess_com(double loss, MoveClassification expected)
    {
        Assert.Equal(expected, MoveClassifier.ForLoss(loss));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(300)]
    public void Engine_best_move_is_best_whatever_the_loss(int lossCp)
    {
        var move = Move(Cp(20), Cp(20 - lossCp), uci: "d2d4", bestMoveUci: "d2d4");

        Assert.Equal(MoveClassification.Best, MoveClassifier.Classify(move));
    }

    [Fact]
    public void Negative_loss_counts_as_zero()
    {
        // The engine can rate the position after the move higher than before it, when the
        // second search sees further than the first. That is no loss.
        var move = Move(Cp(20), Cp(80));

        Assert.Equal(0.0, move.ExpectedPointsLoss);
        Assert.Equal(MoveClassification.Excellent, MoveClassifier.Classify(move));
    }

    [Fact]
    public void Giving_back_part_of_a_won_position_is_at_most_an_inaccuracy()
    {
        // Still more than six pawns up after the move: expected points barely move.
        Assert.Equal(MoveClassification.Inaccuracy, MoveClassifier.Classify(Move(Cp(3000), Cp(601))));
        Assert.Equal(MoveClassification.Inaccuracy, MoveClassifier.Classify(Move(Mate(5), Cp(601))));
    }

    [Fact]
    public void Turning_a_forced_mate_into_being_mated_is_a_blunder()
    {
        var move = Move(Mate(3), Mate(-2));

        Assert.Equal(MoveClassification.Blunder, MoveClassifier.Classify(move));
    }

    [Fact]
    public void Delivering_mate_loses_nothing()
    {
        // Another mating move than the engine's choice: mate in 0 after the move.
        var move = Move(Mate(1), Mate(0));

        Assert.Equal(0.0, move.ExpectedPointsLoss);
        Assert.Equal(MoveClassification.Excellent, MoveClassifier.Classify(move));
    }

    // A middlegame move that is not the engine's choice: keeps the tests about the loss only.
    private static MoveEvaluation Move(EngineScore before, EngineScore after, string uci = "c2c3", string bestMoveUci = "d2d4") =>
        new(Ply: 21, Uci: uci, BestMoveUci: bestMoveUci, Before: before, After: after);

    private static EngineScore Cp(int centipawns) => EngineScore.FromCentipawns(centipawns);

    private static EngineScore Mate(int moves) => EngineScore.FromMateIn(moves);
}
