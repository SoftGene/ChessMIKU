using static ChessReview.Domain.MoveClassification;

namespace ChessReview.Domain.Tests;

public class WorstMovesTests
{
    [Fact]
    public void The_three_errors_that_lose_most_are_picked_in_the_order_they_were_played()
    {
        MoveEvaluation[] moves =
        [
            Move(1, Cp(30), Cp(-20)),   // loses about 0.05
            Move(2, Cp(0), Cp(-300)),   // about 0.25
            Move(3, Cp(50), Cp(0)),     // about 0.05
            Move(4, Cp(100), Cp(-400)), // about 0.41
            Move(5, Cp(0), Cp(-150)),   // about 0.14
        ];

        var worst = WorstMoves.Pick(moves, [Inaccuracy, Blunder, Inaccuracy, Blunder, Mistake]);

        Assert.Equal([2, 4, 5], worst);
    }

    [Fact]
    public void Only_errors_are_explained_however_much_other_moves_lose()
    {
        // A good move can lose a little; there is nothing to explain in it.
        MoveEvaluation[] moves = [Move(1, Cp(0), Cp(-20)), Move(2, Cp(0), Cp(-300)), Move(3, Cp(0), Cp(-10))];

        var worst = WorstMoves.Pick(moves, [Good, Blunder, Excellent]);

        Assert.Equal([2], worst);
    }

    [Fact]
    public void Every_kind_of_error_counts()
    {
        MoveEvaluation[] moves = [Move(1, Cp(0), Cp(-60)), Move(2, Cp(0), Cp(-120)), Move(3, Cp(300), Cp(0)), Move(4, Cp(0), Cp(-400))];

        var worst = WorstMoves.Pick(moves, [Inaccuracy, Mistake, Miss, Blunder]);

        Assert.Equal([2, 3, 4], worst);
    }

    [Fact]
    public void Of_two_equal_errors_the_earlier_one_is_picked()
    {
        MoveEvaluation[] moves =
        [
            Move(1, Cp(0), Cp(-400)),
            Move(2, Cp(0), Cp(-100)),
            Move(3, Cp(0), Cp(-400)),
            Move(4, Cp(0), Cp(-100)),
        ];

        var worst = WorstMoves.Pick(moves, [Blunder, Mistake, Blunder, Mistake]);

        Assert.Equal([1, 2, 3], worst);
    }

    [Fact]
    public void A_game_without_errors_has_nothing_to_explain()
    {
        MoveEvaluation[] moves = [Move(1, Cp(30), Cp(30)), Move(2, Cp(-30), Cp(-35))];

        Assert.Empty(WorstMoves.Pick(moves, [Book, Best]));
    }

    [Fact]
    public void Each_move_needs_its_class()
    {
        Assert.Throws<ArgumentException>(() => WorstMoves.Pick([Move(1, Cp(0), Cp(0))], []));
    }

    private static MoveEvaluation Move(int ply, EngineScore before, EngineScore after) => new(ply, "e2e4", "e2e4", before, after);

    private static EngineScore Cp(int centipawns) => EngineScore.FromCentipawns(centipawns);
}
