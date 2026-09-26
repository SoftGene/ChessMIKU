namespace ChessReview.Domain.Tests;

// Positions checked in chess.js 1.4.0: each move is legal, and the captures that answer it are the ones the
// expectations count on. Material: pawn 1, knight and bishop 3, rook 5, queen 9 (design T7.2b, section 2).
public class SacrificeTests
{
    [Theory]
    // Légal mate, move 5: Nxe5 takes a pawn (+1) and leaves the queen to Bxd1; Kxd1 wins the bishop back: -9 + 3.
    [InlineData("rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5", "f3e5")]
    // Bxf7+ Kxf7: a pawn for the bishop, 2 down; f7 is taken by the king, nobody defends it.
    [InlineData("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", "c4f7")]
    // A quiet king move leaves the rook to the knight.
    [InlineData("4k3/8/4n3/8/3R4/8/8/4K3 w - - 0 1", "e1e2")]
    // The knight on d4 is attacked twice through the file (the second rook behind the first) and defended once.
    [InlineData("3r2k1/3r4/8/8/3N4/8/8/3R2K1 w - - 0 1", "g1h1")]
    public void A_move_that_lets_the_opponent_win_a_piece_is_a_sacrifice(string fen, string uci)
    {
        Assert.True(Position.FromFen(fen).Sacrifices(uci));
    }

    [Theory]
    // Légal mate, move 6: Bxf7+ with the knight on e5 defending f7, so the king cannot take.
    [InlineData("rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 6", "c4f7")]
    // Qxd8+ Kxd8: a queen for a queen.
    [InlineData("3qk3/8/8/8/8/8/8/3QK3 w - - 0 1", "d1d8")]
    // The queen's gambit: only a pawn is offered.
    [InlineData("rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", "c2c4")]
    // Nf6+ while the queen stands attacked by the g-pawn: the check has to be met, and the knight cannot be taken.
    [InlineData("4k3/8/6p1/7Q/6N1/8/8/4K3 w - - 0 1", "g4f6")]
    public void A_move_that_gives_away_no_piece_is_no_sacrifice(string fen, string uci)
    {
        Assert.False(Position.FromFen(fen).Sacrifices(uci));
    }

    [Theory]
    [InlineData("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "e2e4", false)]
    [InlineData("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "e4d5", true)]
    [InlineData("rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3", "e5d6", true)]
    public void A_move_onto_a_piece_or_en_passant_captures(string fen, string uci, bool captures)
    {
        Assert.Equal(captures, Position.FromFen(fen).Captures(uci));
    }

    [Theory]
    [InlineData("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")]
    [InlineData("rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 6")]
    [InlineData("rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3")]
    [InlineData("3r2k1/3r4/8/8/3N4/8/8/3R2K1 b - - 12 40")]
    public void A_position_read_from_its_FEN_writes_the_same_FEN(string fen)
    {
        Assert.Equal(fen, Position.FromFen(fen).Fen);
    }
}
