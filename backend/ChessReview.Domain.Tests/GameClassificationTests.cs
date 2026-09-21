using static ChessReview.Domain.MoveClassification;

namespace ChessReview.Domain.Tests;

public class GameClassificationTests
{
    // 1.e4 e5 2.Nf3 and nothing else: keeps the rule tests independent of the Lichess list.
    private static readonly OpeningBook TinyBook = new([["e2e4", "e7e5", "g1f3"]]);

    private static readonly OpeningBook NoBook = new([]);

    [Fact]
    public void Moves_that_follow_the_book_are_book_even_when_they_are_the_engine_choice()
    {
        var game = Game(
            ("e2e4", "d2d4", Cp(30), Cp(25)),
            ("e7e5", "e7e5", Cp(-25), Cp(-25)),
            ("g1f3", "g1f3", Cp(25), Cp(25)));

        Assert.Equal<MoveClassification>([Book, Book, Book], MoveClassifier.ClassifyGame(game, TinyBook));
    }

    [Fact]
    public void Moves_after_leaving_the_book_are_not_book()
    {
        // 3.Nf3 is the third move of the book line, but after 1...a6 the game is out of it.
        var game = Game(
            ("e2e4", "e2e4", Cp(30), Cp(30)),
            ("a7a6", "e7e5", Cp(-30), Cp(-45)),
            ("g1f3", "g1f3", Cp(45), Cp(45)));

        Assert.Equal<MoveClassification>([Book, Excellent, Best], MoveClassifier.ClassifyGame(game, TinyBook));
    }

    [Fact]
    public void A_book_move_that_walks_into_mate_is_a_blunder()
    {
        // Opening lists contain traps too: the engine's verdict wins.
        var trap = new OpeningBook([["e2e4", "e7e5", "d1h5", "e8e7"]]);
        var game = Game(
            ("e2e4", "e2e4", Cp(30), Cp(30)),
            ("e7e5", "e7e5", Cp(-30), Cp(-30)),
            ("d1h5", "g1f3", Cp(30), Cp(0)),
            ("e8e7", "b8c6", Cp(0), Mate(-1)));

        Assert.Equal(Blunder, MoveClassifier.ClassifyGame(game, trap)[3]);
    }

    [Fact]
    public void Giving_back_the_win_after_the_opponent_blundered_is_a_miss()
    {
        var game = Game(
            ("e2e4", "e2e4", Cp(30), Cp(30)),
            ("f7f6", "e7e5", Cp(-30), Cp(-400)),
            ("b1c3", "d1h5", Cp(400), Cp(50)));

        Assert.Equal<MoveClassification>([Best, Blunder, Miss], MoveClassifier.ClassifyGame(game, NoBook));
    }

    [Fact]
    public void A_miss_answered_by_a_miss_is_a_miss_again()
    {
        var game = Game(
            ("e2e4", "e2e4", Cp(30), Cp(30)),
            ("f7f6", "e7e5", Cp(-30), Cp(-400)),
            ("b1c3", "d1h5", Cp(400), Cp(-400)),
            ("a7a6", "d8e7", Cp(400), Cp(-50)));

        Assert.Equal<MoveClassification>([Best, Blunder, Miss, Miss], MoveClassifier.ClassifyGame(game, NoBook));
    }

    [Theory]
    [InlineData(250, 50, Mistake)]   // before the move the mover was better, but not winning
    [InlineData(600, 200, Blunder)]  // after the move the mover is still clearly better
    public void Losing_ground_is_no_miss_unless_a_win_is_given_back(int beforeCp, int afterCp, MoveClassification expected)
    {
        var game = Game(
            ("e2e4", "e2e4", Cp(30), Cp(30)),
            ("f7f6", "e7e5", Cp(-30), Cp(-beforeCp)),
            ("b1c3", "d1h5", Cp(beforeCp), Cp(afterCp)));

        Assert.Equal(expected, MoveClassifier.ClassifyGame(game, NoBook)[2]);
    }

    [Fact]
    public void Throwing_away_a_win_the_opponent_did_not_hand_over_is_no_miss()
    {
        var game = Game(
            ("e2e4", "e2e4", Cp(400), Cp(400)),
            ("e7e5", "e7e5", Cp(-400), Cp(-400)),
            ("b1c3", "d1h5", Cp(400), Cp(50)));

        Assert.Equal(Blunder, MoveClassifier.ClassifyGame(game, NoBook)[2]);
    }

    [Fact]
    public void Moves_must_come_in_order_from_the_first_ply()
    {
        MoveEvaluation[] game = [new(2, "e7e5", "e7e5", Cp(0), Cp(0))];

        Assert.Throws<ArgumentException>(() => MoveClassifier.ClassifyGame(game, NoBook));
    }

    [Fact]
    public void The_contract_example_game_is_classified_as_documented()
    {
        // The Legal mate game from the examples in contracts/api.yaml.
        var game = Game(
            ("e2e4", "e2e4", Cp(30), Cp(30)),
            ("e7e5", "e7e5", Cp(-30), Cp(-30)),
            ("g1f3", "g1f3", Cp(32), Cp(32)),
            ("d7d6", "b8c6", Cp(-32), Cp(-60)),
            ("f1c4", "d2d4", Cp(60), Cp(55)),
            ("c8g4", "g8f6", Cp(-55), Cp(-95)),
            ("b1c3", "h2h3", Cp(95), Cp(90)),
            ("g7g6", "g8f6", Cp(-90), Cp(-130)),
            ("f3e5", "f3e5", Cp(130), Cp(150)),
            ("g4d1", "d6e5", Cp(-150), Mate(-2)),
            ("c4f7", "c4f7", Mate(2), Mate(1)),
            ("e8e7", "e8e7", Mate(-1), Mate(-1)),
            ("c3d5", "c3d5", Mate(1), Mate(0)));

        Assert.Equal<MoveClassification>(
            [Book, Book, Book, Book, Book, Good, Excellent, Good, Best, Blunder, Best, Best, Best],
            MoveClassifier.ClassifyGame(game, OpeningBook.Lichess));
    }

    [Fact]
    public void Scholars_mate_victim_blunders_even_in_the_opening()
    {
        // 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#
        var game = Game(
            ("e2e4", "e2e4", Cp(30), Cp(30)),
            ("e7e5", "e7e5", Cp(-30), Cp(-30)),
            ("f1c4", "g1f3", Cp(30), Cp(20)),
            ("b8c6", "g8f6", Cp(-20), Cp(-25)),
            ("d1h5", "g1f3", Cp(25), Cp(-30)),
            ("g8f6", "g7g6", Cp(30), Mate(-1)),
            ("h5f7", "h5f7", Mate(1), Mate(0)));

        Assert.Equal(Blunder, MoveClassifier.ClassifyGame(game, OpeningBook.Lichess)[5]);
    }

    private static MoveEvaluation[] Game(params (string Uci, string BestMoveUci, EngineScore Before, EngineScore After)[] moves) =>
        [.. moves.Select((move, index) => new MoveEvaluation(index + 1, move.Uci, move.BestMoveUci, move.Before, move.After))];

    private static EngineScore Cp(int centipawns) => EngineScore.FromCentipawns(centipawns);

    private static EngineScore Mate(int moves) => EngineScore.FromMateIn(moves);
}
