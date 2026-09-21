namespace ChessReview.Domain.Tests;

public class MoveClassifierTests
{
    [Theory]
    [InlineData(0, MoveClassification.Good)]
    [InlineData(49, MoveClassification.Good)]
    [InlineData(50, MoveClassification.Inaccuracy)]
    [InlineData(99, MoveClassification.Inaccuracy)]
    [InlineData(100, MoveClassification.Mistake)]
    [InlineData(299, MoveClassification.Mistake)]
    [InlineData(300, MoveClassification.Blunder)]
    public void Loss_thresholds_follow_the_spec(int lossCp, MoveClassification expected)
    {
        var move = Move(evalBeforeCp: 20, evalAfterCp: 20 - lossCp);

        Assert.Equal(expected, MoveClassifier.Classify(move));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(300)]
    public void Engine_best_move_is_best_whatever_the_loss(int lossCp)
    {
        var move = Move(evalBeforeCp: 20, evalAfterCp: 20 - lossCp, uci: "d2d4", bestMoveUci: "d2d4");

        Assert.Equal(MoveClassification.Best, MoveClassifier.Classify(move));
    }

    [Fact]
    public void Negative_loss_counts_as_zero()
    {
        // The engine can rate the position after the move higher than before it, when the
        // second search sees further than the first. That is no loss.
        var move = Move(evalBeforeCp: 20, evalAfterCp: 80);

        Assert.Equal(0, move.LossCp);
        Assert.Equal(MoveClassification.Good, MoveClassifier.Classify(move));
    }

    // A middlegame move in a balanced position that is not the engine's choice: keeps the
    // tests about the thresholds only.
    private static MoveEvaluation Move(int evalBeforeCp, int evalAfterCp, string uci = "c2c3", string bestMoveUci = "d2d4") =>
        new(Ply: 21, Uci: uci, BestMoveUci: bestMoveUci, EvalBeforeCp: evalBeforeCp, EvalAfterCp: evalAfterCp);
}
