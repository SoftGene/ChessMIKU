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
        // 5.Nxe5 gives the queen away (brilliant); 6.Bxf7+ is the only way to mate in two (great); 6...Ke7 is the
        // only move there is.
        var game = Game(
            ("e2e4", "e2e4", Cp(30), Cp(30), Cp(25)),
            ("e7e5", "e7e5", Cp(-30), Cp(-30), Cp(-40)),
            ("g1f3", "g1f3", Cp(32), Cp(32), Cp(28)),
            ("d7d6", "b8c6", Cp(-32), Cp(-60), Cp(-40)),
            ("f1c4", "d2d4", Cp(60), Cp(55), Cp(55)),
            ("c8g4", "g8f6", Cp(-55), Cp(-95), Cp(-70)),
            ("b1c3", "h2h3", Cp(95), Cp(90), Cp(90)),
            ("g7g6", "g8f6", Cp(-90), Cp(-130), Cp(-110)),
            ("f3e5", "f3e5", Cp(130), Cp(150), Cp(60)),
            ("g4d1", "d6e5", Cp(-150), Mate(-2), Cp(-160)),
            ("c4f7", "c4f7", Mate(2), Mate(1), Cp(400)),
            ("e8e7", "e8e7", Mate(-1), Mate(-1), null),
            ("c3d5", "c3d5", Mate(1), Mate(0), Mate(2)));

        Assert.Equal<MoveClassification>(
            [Book, Book, Book, Book, Book, Good, Excellent, Good, Brilliant, Blunder, Great, Best, Best],
            MoveClassifier.ClassifyGame(game, OpeningBook.Lichess));
    }

    [Theory]
    [InlineData("c4f7", 50, 40, Brilliant)]    // the engine's move, and it gives the bishop away
    [InlineData("d2d4", 50, 40, Brilliant)]    // not the engine's first choice, but within 0.02
    [InlineData("d2d4", 50, 20, Good)]         // gives more than 0.02 away: no brilliant move
    [InlineData("c4f7", 700, 690, Best)]       // already winning by more than 0.90 before it
    [InlineData("d2d4", -50, -60, Excellent)]  // worse than about equal after it: below 0.45
    public void A_sacrifice_that_keeps_the_game_is_brilliant(string bestMoveUci, int beforeCp, int afterCp, MoveClassification expected)
    {
        Assert.Equal(expected, MoveClassifier.ClassifyGame(BishopTakesF7(bestMoveUci, Cp(beforeCp), Cp(afterCp)), NoBook)[6]);
    }

    [Fact]
    public void A_pawn_offered_is_no_brilliant_move()
    {
        // 1.d4 d5 2.c4: the queen's gambit, the engine's own move.
        var game = Game(
            ("d2d4", "d2d4", Cp(30), Cp(30), Cp(25)),
            ("d7d5", "d7d5", Cp(-30), Cp(-30), Cp(-40)),
            ("c2c4", "c2c4", Cp(30), Cp(30), Cp(25)));

        Assert.Equal(Best, MoveClassifier.ClassifyGame(game, NoBook)[2]);
    }

    [Fact]
    public void A_sacrifice_in_the_book_stays_book()
    {
        var book = new OpeningBook([["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "c4f7"]]);

        Assert.Equal(Book, MoveClassifier.ClassifyGame(BishopTakesF7("c4f7", Cp(50), Cp(40)), book)[6]);
    }

    [Fact]
    public void A_brilliant_move_is_not_called_great_as_well()
    {
        Assert.Equal(Brilliant, MoveClassifier.ClassifyGame(BishopTakesF7("c4f7", Cp(50), Cp(40), Cp(-300)), NoBook)[6]);
    }

    [Theory]
    [InlineData(83, Great)]  // 0.6762 against 0.5758: 0.1004 worse, the second move would be a mistake
    [InlineData(84, Best)]   // 0.6762 against 0.5767: 0.0995, just under 0.10
    public void The_only_good_move_is_great(int secondBestCp, MoveClassification expected)
    {
        // 1.e4 e5 2.Nf3, the engine's move, found where the next best is 0.10 worse or more.
        var game = Game(
            ("e2e4", "e2e4", Cp(30), Cp(30), Cp(25)),
            ("e7e5", "e7e5", Cp(-30), Cp(-30), Cp(-40)),
            ("g1f3", "g1f3", Cp(200), Cp(200), Cp(secondBestCp)));

        Assert.Equal(expected, MoveClassifier.ClassifyGame(game, NoBook)[2]);
    }

    [Fact]
    public void A_move_the_engine_did_not_choose_is_not_great()
    {
        var game = Game(
            ("e2e4", "e2e4", Cp(30), Cp(30), Cp(25)),
            ("e7e5", "e7e5", Cp(-30), Cp(-30), Cp(-40)),
            ("b1c3", "g1f3", Cp(200), Cp(195), Cp(-300)));

        Assert.Equal(Excellent, MoveClassifier.ClassifyGame(game, NoBook)[2]);
    }

    [Fact]
    public void Taking_back_on_the_square_just_taken_is_not_great()
    {
        Assert.Equal(Best, MoveClassifier.ClassifyGame(AfterExd5("d8d5", Cp(-400)), NoBook)[3]);
    }

    [Fact]
    public void The_only_good_move_elsewhere_after_a_capture_is_great()
    {
        // 2...Nf6 takes nothing back.
        Assert.Equal(Great, MoveClassifier.ClassifyGame(AfterExd5("g8f6", Cp(-400)), NoBook)[3]);
    }

    [Fact]
    public void The_only_move_there_is_is_not_great()
    {
        var game = Game(
            ("e2e4", "e2e4", Cp(30), Cp(30), Cp(25)),
            ("e7e5", "e7e5", Cp(-30), Cp(-30), Cp(-40)),
            ("g1f3", "g1f3", Cp(200), Cp(200), null));

        Assert.Equal(Best, MoveClassifier.ClassifyGame(game, NoBook)[2]);
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

    private static MoveEvaluation[] Game(params (string Uci, string BestMoveUci, EngineScore Before, EngineScore After, EngineScore? SecondBest)[] moves) =>
        [.. moves.Select((move, index) => new MoveEvaluation(index + 1, move.Uci, move.BestMoveUci, move.Before, move.After, move.SecondBest))];

    // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6, and White to play 4.Bxf7+ (a bishop for a pawn: Kxf7).
    private static MoveEvaluation[] BishopTakesF7(string bestMoveUci, EngineScore before, EngineScore after, EngineScore? secondBest = null) => Game(
        ("e2e4", "e2e4", Cp(30), Cp(30), Cp(25)),
        ("e7e5", "e7e5", Cp(-30), Cp(-30), Cp(-40)),
        ("g1f3", "g1f3", Cp(32), Cp(32), Cp(28)),
        ("b8c6", "b8c6", Cp(-32), Cp(-32), Cp(-40)),
        ("f1c4", "f1c4", Cp(35), Cp(35), Cp(30)),
        ("g8f6", "g8f6", Cp(-35), Cp(-35), Cp(-45)),
        ("c4f7", bestMoveUci, before, after, secondBest));

    // 1.e4 d5 2.exd5, and Black to play from there (2...Qxd5 takes back on the square just taken).
    private static MoveEvaluation[] AfterExd5(string uci, EngineScore secondBest) => Game(
        ("e2e4", "e2e4", Cp(30), Cp(30), Cp(25)),
        ("d7d5", "d7d5", Cp(-30), Cp(-60), Cp(-70)),
        ("e4d5", "e4d5", Cp(60), Cp(60), Cp(-100)),
        (uci, uci, Cp(-60), Cp(-60), secondBest));

    private static EngineScore Cp(int centipawns) => EngineScore.FromCentipawns(centipawns);

    private static EngineScore Mate(int moves) => EngineScore.FromMateIn(moves);
}
