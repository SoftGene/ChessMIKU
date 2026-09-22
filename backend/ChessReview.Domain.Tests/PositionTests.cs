namespace ChessReview.Domain.Tests;

// Expected FENs come from chess.js 1.4.0 (tools/opening-book), which writes an en passant square
// only when a pawn can take en passant.
public class PositionTests
{
    private static readonly Dictionary<string, (string Moves, (int Ply, string Fen)[] Expected)> Games = new()
    {
        ["Légal mate, the contract example"] = (
            "e2e4 e7e5 g1f3 d7d6 f1c4 c8g4 b1c3 g7g6 f3e5 g4d1 c4f7 e8e7 c3d5",
            [
                (0, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
                (1, "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"),
                (2, "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"),
                (3, "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2"),
                (4, "rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3"),
                (5, "rnbqkbnr/ppp2ppp/3p4/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 1 3"),
                (6, "rn1qkbnr/ppp2ppp/3p4/4p3/2B1P1b1/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 4"),
                (7, "rn1qkbnr/ppp2ppp/3p4/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R b KQkq - 3 4"),
                (8, "rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5"),
                (9, "rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P1b1/2N5/PPPP1PPP/R1BQK2R b KQkq - 0 5"),
                (10, "rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 6"),
                (11, "rn1qkbnr/ppp2B1p/3p2p1/4N3/4P3/2N5/PPPP1PPP/R1BbK2R b KQkq - 0 6"),
                (12, "rn1q1bnr/ppp1kB1p/3p2p1/4N3/4P3/2N5/PPPP1PPP/R1BbK2R w KQ - 1 7"),
                (13, "rn1q1bnr/ppp1kB1p/3p2p1/3NN3/4P3/8/PPPP1PPP/R1BbK2R b KQ - 2 7"),
            ]),
        ["en passant"] = (
            "e2e4 a7a6 e4e5 d7d5 e5d6",
            [
                (4, "rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3"),
                (5, "rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3"),
            ]),
        ["castling on both sides"] = (
            "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 e1g1 d7d6 d2d3 c8e6 b1c3 d8d7 c1e3 e8c8",
            [
                (7, "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4"),
                (14, "2kr1b1r/pppq1ppp/2npbn2/4p3/2B1P3/2NPBN2/PPP2PPP/R2Q1RK1 w - - 5 8"),
            ]),
        ["promotion that takes a rook"] = (
            "a2a4 b7b5 a4b5 a7a6 b5a6 c8b7 a6b7 b8c6 b7a8q",
            [
                (8, "r2qkbnr/1Ppppppp/2n5/8/8/8/1PPPPPPP/RNBQKBNR w KQkq - 1 5"),
                (9, "Q2qkbnr/2pppppp/2n5/8/8/8/1PPPPPPP/RNBQKBNR b KQk - 0 5"),
            ]),
    };

    public static TheoryData<string> GameNames => [.. Games.Keys];

    [Theory]
    [MemberData(nameof(GameNames))]
    public void The_position_after_each_move_has_the_FEN_chess_js_gives(string name)
    {
        var (moves, expected) = Games[name];
        var uci = moves.Split(' ');

        foreach (var (ply, fen) in expected)
        {
            Assert.Equal(fen, Position.AfterMoves(uci[..ply]).Fen);
        }
    }

    [Fact]
    public void A_move_from_an_empty_square_is_rejected()
    {
        Assert.Throws<ArgumentException>(() => Position.AfterMoves(["e3e4"]));
    }
}
