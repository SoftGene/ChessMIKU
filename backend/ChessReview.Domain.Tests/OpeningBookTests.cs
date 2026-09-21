namespace ChessReview.Domain.Tests;

public class OpeningBookTests
{
    [Theory]
    [InlineData("g1h3")]                               // A00 Amar Opening
    [InlineData("e2e4 c7c5")]                          // B20 Sicilian Defense
    [InlineData("e2e4 e7e5 g1f3 d7d6")]                // C41 Philidor Defense
    [InlineData("d2d4 d7d5 c2c4")]                     // D06 Queen's Gambit
    [InlineData("d2d4 g8f6 c2c4 e7e6 b1c3 f8b4")]      // E20 Nimzo-Indian Defense
    public void Lichess_book_has_lines_from_every_volume(string moves)
    {
        Assert.True(OpeningBook.Lichess.Contains(moves.Split(' ')));
    }

    [Theory]
    [InlineData("e2e4")]
    [InlineData("e2e4 e7e5")]
    [InlineData("e2e4 e7e5 g1f3")]
    [InlineData("e2e4 e7e5 g1f3 d7d6 f1c4")]
    public void Every_start_of_a_line_is_in_the_book(string moves)
    {
        Assert.True(OpeningBook.Lichess.Contains(moves.Split(' ')));
    }

    [Fact]
    public void A_move_outside_the_list_leaves_the_book()
    {
        // 3...Bg4 in the Philidor Defense with 3.Bc4 is not in the Lichess list.
        Assert.False(OpeningBook.Lichess.Contains("e2e4 e7e5 g1f3 d7d6 f1c4 c8g4".Split(' ')));
    }
}
