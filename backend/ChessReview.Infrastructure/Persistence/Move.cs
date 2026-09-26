using ChessReview.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChessReview.Infrastructure.Persistence;

/// <summary>
/// One half-move with the engine evaluations as the extension sent them: each evaluation is
/// centipawns or a forced mate, from the point of view of the side making the move.
/// </summary>
public sealed class Move
{
    public int Id { get; set; }

    public int GameId { get; set; }

    public short Ply { get; set; }

    public required string San { get; set; }

    public required string Uci { get; set; }

    public required string BestMoveUci { get; set; }

    public int? EvalBeforeCp { get; set; }

    public short? MateBefore { get; set; }

    public int? EvalAfterCp { get; set; }

    public short? MateAfter { get; set; }

    /// <summary>The engine's second best move before this one: at most one of the two; both null when it had no other.</summary>
    public int? SecondBestCp { get; set; }

    public short? SecondBestMate { get; set; }

    public MoveClassification Classification { get; set; }
}

internal sealed class MoveConfiguration : IEntityTypeConfiguration<Move>
{
    public void Configure(EntityTypeBuilder<Move> move)
    {
        move.Property(m => m.San).HasMaxLength(10).IsUnicode(false);
        move.Property(m => m.Uci).HasMaxLength(5).IsUnicode(false);
        move.Property(m => m.BestMoveUci).HasMaxLength(5).IsUnicode(false);
        move.Property(m => m.Classification).HasConversion<string>().HasMaxLength(16).IsUnicode(false);

        move.HasIndex(m => new { m.GameId, m.Ply }).IsUnique();

        move.ToTable(table =>
        {
            table.HasCheckConstraint("CK_Moves_EvalBefore", SqlConstraints.ExactlyOneOf("EvalBeforeCp", "MateBefore"));
            table.HasCheckConstraint("CK_Moves_EvalAfter", SqlConstraints.ExactlyOneOf("EvalAfterCp", "MateAfter"));
            table.HasCheckConstraint("CK_Moves_SecondBest", SqlConstraints.AtMostOneOf("SecondBestCp", "SecondBestMate"));

            // A side that is already mated has no move to make.
            table.HasCheckConstraint("CK_Moves_MateBefore", "[MateBefore] <> 0");

            table.HasCheckConstraint("CK_Moves_Classification", SqlConstraints.In("Classification", Enum.GetNames<MoveClassification>()));
        });
    }
}
