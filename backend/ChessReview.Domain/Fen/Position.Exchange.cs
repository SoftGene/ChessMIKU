namespace ChessReview.Domain;

// Material and exchanges on the board: enough to tell a sacrifice (design T7.2b, section 2). Moves are still not
// checked for legality, and pins are not considered.
public sealed partial class Position
{
    private static readonly (int File, int Rank)[] KnightSteps = [(1, 2), (2, 1), (2, -1), (1, -2), (-1, -2), (-2, -1), (-2, 1), (-1, 2)];
    private static readonly (int File, int Rank)[] KingSteps = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)];
    private static readonly (int File, int Rank)[] Diagonals = [(1, 1), (1, -1), (-1, 1), (-1, -1)];
    private static readonly (int File, int Rank)[] Lines = [(1, 0), (-1, 0), (0, 1), (0, -1)];

    // The least material a sacrifice gives away: the exchange (a rook for a minor piece) or more.
    private const int SacrificeFrom = 2;

    /// <summary>A position given in FEN, for tests and tools: the game itself is played from the start.</summary>
    public static Position FromFen(string fen)
    {
        var fields = fen.Split(' ');
        var ranks = fields[0].Split('/');
        if (fields.Length != 6 || ranks.Length != 8)
        {
            throw new ArgumentException($"{fen} is not a FEN: it needs six fields and eight ranks.", nameof(fen));
        }

        var board = new char[64];
        for (var row = 0; row < 8; row++)
        {
            var file = 0;
            foreach (var piece in ranks[row])
            {
                if (char.IsDigit(piece))
                {
                    file += piece - '0';
                }
                else
                {
                    board[file++ + (8 * (7 - row))] = piece;
                }
            }
        }

        return new Position(
            board,
            fields[1] == "w",
            fields[2] == "-" ? "" : fields[2],
            fields[3] == "-" ? null : Square(fields[3]),
            int.Parse(fields[4], System.Globalization.CultureInfo.InvariantCulture),
            int.Parse(fields[5], System.Globalization.CultureInfo.InvariantCulture));
    }

    /// <summary>
    /// Whether the move played from here gives material away: after it, the opponent's best series of captures on one
    /// square leaves the mover at least the exchange down against before the move, and it starts by taking a piece,
    /// not a pawn. So Bxf7+ Kxf7 is a sacrifice (a pawn for a bishop) and Qxd8+ Kxd8 is not (a queen for a queen).
    /// When the move gives check, only captures of the checking pieces count.
    /// </summary>
    public bool Sacrifices(string uci)
    {
        var mover = _whiteToMove;
        var after = Play(uci);
        var (gain, victim) = after.BestExchange(forWhite: !mover);
        var given = MaterialFor(mover) - (after.MaterialFor(mover) - gain);
        return given >= SacrificeFrom && victim is { } taken && char.ToLowerInvariant(taken) != 'p';
    }

    // Pawns 1, knights and bishops 3, rooks 5, queens 9. The king is never won.
    private static int Value(char piece) => char.ToLowerInvariant(piece) switch
    {
        'p' => 1,
        'n' or 'b' => 3,
        'r' => 5,
        'q' => 9,
        _ => 0,
    };

    private static bool IsWhite(char piece) => char.IsUpper(piece);

    private int MaterialFor(bool white) =>
        _board.Where(piece => piece != '\0').Sum(piece => IsWhite(piece) == white ? Value(piece) : -Value(piece));

    // The most the side to move wins by a series of captures on one square of the other side's pieces, and the piece
    // it takes first there. In check, only the checking pieces can be taken.
    private (int Gain, char? Victim) BestExchange(bool forWhite)
    {
        var king = Array.IndexOf(_board, forWhite ? 'K' : 'k');
        var checkers = king < 0 ? [] : Attackers(_board, king, byWhite: !forWhite);
        var targets = checkers.Count > 0
            ? checkers
            : [.. Enumerable.Range(0, 64).Where(square => _board[square] != '\0' && IsWhite(_board[square]) != forWhite && char.ToLowerInvariant(_board[square]) != 'k')];

        var best = (Gain: 0, Victim: (char?)null);
        foreach (var square in targets)
        {
            var gain = Exchange((char[])_board.Clone(), square, forWhite);
            if (gain > best.Gain)
            {
                best = (gain, _board[square]);
            }
        }

        return best;
    }

    // Static exchange on one square: each side takes with its least valuable piece that attacks it, and may stop when
    // going on does not pay. The board changes as the captures go, so a piece behind one that took joins in (x-ray).
    private static int Exchange(char[] board, int square, bool white)
    {
        // gains[d]: what the side making capture d has won, if the other side does not take back.
        var gains = new List<int> { Value(board[square]) };
        var attacker = LeastValuableAttacker(board, square, white);
        if (attacker is null)
        {
            return 0;
        }

        while (attacker is { } from)
        {
            var capturing = board[from];
            board[square] = capturing;
            board[from] = '\0';
            white = !white;
            attacker = LeastValuableAttacker(board, square, white);
            if (attacker is not null)
            {
                gains.Add(Value(capturing) - gains[^1]);
            }
        }

        // Each side may stop instead of taking on.
        for (var depth = gains.Count - 1; depth > 0; depth--)
        {
            gains[depth - 1] = -Math.Max(-gains[depth - 1], gains[depth]);
        }

        return Math.Max(0, gains[0]);
    }

    // The cheapest piece of a side that can take on a square. The king comes last, and takes only a square the
    // other side no longer attacks.
    private static int? LeastValuableAttacker(char[] board, int square, bool white)
    {
        var attackers = Attackers(board, square, white);
        if (attackers.Count == 0)
        {
            return null;
        }

        var from = attackers.MinBy(at => char.ToLowerInvariant(board[at]) == 'k' ? int.MaxValue : Value(board[at]));
        if (char.ToLowerInvariant(board[from]) != 'k')
        {
            return from;
        }

        var probe = (char[])board.Clone();
        probe[square] = probe[from];
        probe[from] = '\0';
        return Attackers(probe, square, !white).Count == 0 ? from : null;
    }

    // The squares of a side's pieces that attack a square: pawns diagonally forward, knights, the king, and the
    // first piece on each line and diagonal.
    private static List<int> Attackers(char[] board, int square, bool byWhite)
    {
        var found = new List<int>();
        var (file, rank) = (File(square), Rank(square));

        foreach (var side in (int[])[-1, 1])
        {
            Add(file + side, byWhite ? rank - 1 : rank + 1, 'p');
        }

        foreach (var (df, dr) in KnightSteps)
        {
            Add(file + df, rank + dr, 'n');
        }

        foreach (var (df, dr) in KingSteps)
        {
            Add(file + df, rank + dr, 'k');
        }

        foreach (var (df, dr) in Diagonals)
        {
            Slide(df, dr, 'b');
        }

        foreach (var (df, dr) in Lines)
        {
            Slide(df, dr, 'r');
        }

        return found;

        char Own(char kind) => byWhite ? char.ToUpperInvariant(kind) : kind;

        void Add(int f, int r, char kind)
        {
            if (On(f, r) && board[f + (8 * r)] == Own(kind))
            {
                found.Add(f + (8 * r));
            }
        }

        void Slide(int df, int dr, char kind)
        {
            for (int f = file + df, r = rank + dr; On(f, r); f += df, r += dr)
            {
                var piece = board[f + (8 * r)];
                if (piece == '\0')
                {
                    continue;
                }

                if (piece == Own(kind) || piece == Own('q'))
                {
                    found.Add(f + (8 * r));
                }

                break;
            }
        }
    }

    private static bool On(int file, int rank) => file is >= 0 and < 8 && rank is >= 0 and < 8;
}
