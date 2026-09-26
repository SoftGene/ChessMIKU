using System.Text;

namespace ChessReview.Domain;

/// <summary>
/// A position that UCI moves are played on, to give the language model the FEN before a move.
/// The engine produced the moves, so their legality is not checked.
/// </summary>
public sealed partial class Position
{
    // Index = file + 8 * rank, a1 = 0, h8 = 63. White pieces upper case, black lower case, '\0' empty.
    private readonly char[] _board;
    private readonly bool _whiteToMove;
    private readonly string _castling;
    private readonly int? _enPassant;
    private readonly int _halfmoveClock;
    private readonly int _fullmoveNumber;

    private Position(char[] board, bool whiteToMove, string castling, int? enPassant, int halfmoveClock, int fullmoveNumber)
    {
        _board = board;
        _whiteToMove = whiteToMove;
        _castling = castling;
        _enPassant = enPassant;
        _halfmoveClock = halfmoveClock;
        _fullmoveNumber = fullmoveNumber;
    }

    public static Position Start { get; } = new(StartBoard(), whiteToMove: true, "KQkq", enPassant: null, 0, 1);

    public string Fen => $"{Placement()} {(_whiteToMove ? 'w' : 'b')} {(_castling.Length > 0 ? _castling : "-")} {(_enPassant is { } square ? Name(square) : "-")} {_halfmoveClock} {_fullmoveNumber}";

    public static Position AfterMoves(IEnumerable<string> uciMoves) => uciMoves.Aggregate(Start, (position, move) => position.Play(move));

    public Position Play(string uci)
    {
        var (from, to, promotion) = ParseUci(uci);
        var piece = _board[from];
        if (piece == '\0' || char.IsUpper(piece) != _whiteToMove)
        {
            throw new ArgumentException($"{uci}: the side to move has no piece on {Name(from)}.", nameof(uci));
        }

        var board = (char[])_board.Clone();
        var isPawn = char.ToLowerInvariant(piece) == 'p';
        var captures = board[to] != '\0';

        if (isPawn && File(from) != File(to) && !captures)
        {
            // En passant: the captured pawn stands beside the moving one, not on the target square.
            board[File(to) + (8 * Rank(from))] = '\0';
            captures = true;
        }

        if (char.ToLowerInvariant(piece) == 'k' && Math.Abs(File(to) - File(from)) == 2)
        {
            var (rookFrom, rookTo) = File(to) == 6 ? (from + 3, from + 1) : (from - 4, from - 1);
            board[rookTo] = board[rookFrom];
            board[rookFrom] = '\0';
        }

        board[to] = promotion is { } promoted ? (_whiteToMove ? char.ToUpperInvariant(promoted) : promoted) : piece;
        board[from] = '\0';

        return new Position(
            board,
            !_whiteToMove,
            CastlingAfter(piece, from, to),
            isPawn && Math.Abs(Rank(to) - Rank(from)) == 2 ? EnPassantTarget(board, from, to) : null,
            isPawn || captures ? 0 : _halfmoveClock + 1,
            _whiteToMove ? _fullmoveNumber : _fullmoveNumber + 1);
    }

    private string CastlingAfter(char piece, int from, int to)
    {
        var lost = new HashSet<char>();
        if (piece == 'K') { lost.UnionWith("KQ"); }
        if (piece == 'k') { lost.UnionWith("kq"); }

        // A rook that leaves its corner, or is taken there, takes its castling right with it.
        foreach (var square in (int[])[from, to])
        {
            switch (Name(square))
            {
                case "h1": lost.Add('K'); break;
                case "a1": lost.Add('Q'); break;
                case "h8": lost.Add('k'); break;
                case "a8": lost.Add('q'); break;
            }
        }

        return string.Concat(_castling.Where(right => !lost.Contains(right)));
    }

    // Written only when a pawn can take en passant, as chess.js does. Pins are not checked.
    private int? EnPassantTarget(char[] board, int from, int to)
    {
        var enemyPawn = _whiteToMove ? 'p' : 'P';
        var besides = new[] { File(to) - 1, File(to) + 1 }.Where(file => file is >= 0 and < 8);

        return besides.Any(file => board[file + (8 * Rank(to))] == enemyPawn) ? (from + to) / 2 : null;
    }

    private string Placement()
    {
        var fen = new StringBuilder();
        for (var rank = 7; rank >= 0; rank--)
        {
            var empty = 0;
            for (var file = 0; file < 8; file++)
            {
                var piece = _board[file + (8 * rank)];
                if (piece == '\0')
                {
                    empty++;
                    continue;
                }

                if (empty > 0)
                {
                    fen.Append(empty);
                    empty = 0;
                }

                fen.Append(piece);
            }

            if (empty > 0)
            {
                fen.Append(empty);
            }

            if (rank > 0)
            {
                fen.Append('/');
            }
        }

        return fen.ToString();
    }

    private static (int From, int To, char? Promotion) ParseUci(string uci)
    {
        if (uci.Length is not (4 or 5) || !IsSquare(uci[..2]) || !IsSquare(uci[2..4]) || (uci.Length == 5 && "qrbn".IndexOf(uci[4]) < 0))
        {
            throw new ArgumentException($"{uci} is not a move in UCI notation.", nameof(uci));
        }

        return (Square(uci[..2]), Square(uci[2..4]), uci.Length == 5 ? uci[4] : null);
    }

    private static bool IsSquare(string name) => name[0] is >= 'a' and <= 'h' && name[1] is >= '1' and <= '8';

    private static int Square(string name) => name[0] - 'a' + (8 * (name[1] - '1'));

    private static string Name(int square) => $"{(char)('a' + File(square))}{(char)('1' + Rank(square))}";

    private static int File(int square) => square % 8;

    private static int Rank(int square) => square / 8;

    private static char[] StartBoard()
    {
        var board = new char[64];
        const string backRank = "RNBQKBNR";
        for (var file = 0; file < 8; file++)
        {
            board[file] = backRank[file];
            board[file + 8] = 'P';
            board[file + 48] = 'p';
            board[file + 56] = char.ToLowerInvariant(backRank[file]);
        }

        return board;
    }
}
