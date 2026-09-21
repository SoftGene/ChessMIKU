namespace ChessReview.Domain.Tests;

public class PgnGameTests
{
    // The shape chess.com exports: tags, then moves with clock comments.
    private const string ChessComPgn =
        """
        [Event "Live Chess"]
        [Site "Chess.com"]
        [Date "2026.09.20"]
        [White "example_white"]
        [Black "example_black"]
        [Result "1-0"]
        [UTCDate "2026.09.20"]
        [UTCTime "18:47:52"]

        1. e4 {[%clk 0:02:59.9]} 1... e5 {[%clk 0:02:58.1]} 2. Nf3 {[%clk 0:02:57.3]} 2... d6
        {[%clk 0:02:55]} 3. Bc4 {[%clk 0:02:54.2]} 1-0
        """;

    [Fact]
    public void Reads_the_tags()
    {
        var game = PgnGame.Parse(ChessComPgn);

        Assert.Equal("example_white", game.Tag("White"));
        Assert.Equal("example_black", game.Tag("Black"));
        Assert.Equal("1-0", game.Tag("Result"));
        Assert.Equal("18:47:52", game.Tag("UTCTime"));
        Assert.Null(game.Tag("Opening"));
    }

    [Fact]
    public void Reads_the_moves_of_a_chess_com_game()
    {
        Assert.Equal(["e4", "e5", "Nf3", "d6", "Bc4"], PgnGame.Parse(ChessComPgn).Moves);
    }

    [Fact]
    public void Skips_variations_annotations_and_comments()
    {
        var game = PgnGame.Parse("1. e4 (1. d4 d5 (1... Nf6 2. c4)) e5 $1 2. Nf3 ; rest of line\n2... Nc6 {plan} *");

        Assert.Equal(["e4", "e5", "Nf3", "Nc6"], game.Moves);
    }

    [Theory]
    [InlineData("1.e4 e5 2.Nf3 1-0")]
    [InlineData("1. e4 e5 2. Nf3 0-1")]
    [InlineData("1. e4 e5 2. Nf3 1/2-1/2")]
    [InlineData("1. e4 e5 2. Nf3 *")]
    public void Move_numbers_and_the_result_are_not_moves(string movetext)
    {
        Assert.Equal(["e4", "e5", "Nf3"], PgnGame.Parse(movetext).Moves);
    }

    [Fact]
    public void Keeps_check_marks_and_annotations_as_written()
    {
        Assert.Equal(["e4", "e5", "Qh5", "Nf6??", "Qxf7#"], PgnGame.Parse("1. e4 e5 2. Qh5 Nf6?? 3. Qxf7# 1-0").Moves);
    }

    [Fact]
    public void Unescapes_quotes_in_tag_values()
    {
        var game = PgnGame.Parse("[Event \"Club \\\"Blitz\\\" night\"]\n\n1. e4 *");

        Assert.Equal("Club \"Blitz\" night", game.Tag("Event"));
    }
}
