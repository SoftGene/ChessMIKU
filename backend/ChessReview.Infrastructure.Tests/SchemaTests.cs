using ChessReview.Domain;
using ChessReview.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace ChessReview.Infrastructure.Tests;

public class SchemaTests(SqlServerFixture sql)
{
    private const int DuplicateKeyInIndex = 2601;
    private const int DuplicateKeyInConstraint = 2627;
    private const int ConstraintConflict = 547;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Migration_creates_exactly_the_documented_indexes()
    {
        // Section 4 of the spec; primary keys included.
        IndexInfo[] expected =
        [
            new("ExplanationJobs", "GameId,Language", IsUnique: true, IsPrimaryKey: false),
            new("ExplanationJobs", "Id", IsUnique: true, IsPrimaryKey: true),
            new("ExplanationJobs", "Status,CreatedAt", IsUnique: false, IsPrimaryKey: false),
            new("Explanations", "GameId,Ply,Language", IsUnique: true, IsPrimaryKey: false),
            new("Explanations", "Id", IsUnique: true, IsPrimaryKey: true),
            new("Games", "ExternalGameId", IsUnique: true, IsPrimaryKey: false),
            new("Games", "Id", IsUnique: true, IsPrimaryKey: true),
            new("Installs", "Id", IsUnique: true, IsPrimaryKey: true),
            new("Installs", "InstallId", IsUnique: true, IsPrimaryKey: false),
            new("Moves", "GameId,Ply", IsUnique: true, IsPrimaryKey: false),
            new("Moves", "Id", IsUnique: true, IsPrimaryKey: true),
            new("UsageDaily", "InstallId,Date", IsUnique: true, IsPrimaryKey: true),
        ];
        await using var db = sql.CreateContext();

        var actual = await db.Database.SqlQueryRaw<IndexInfo>(
            """
            SELECT t.name AS TableName,
                   STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) AS Columns,
                   i.is_unique AS IsUnique,
                   i.is_primary_key AS IsPrimaryKey
            FROM sys.indexes i
            JOIN sys.tables t ON t.object_id = i.object_id
            JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
            JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE t.name <> '__EFMigrationsHistory' AND ic.is_included_column = 0
            GROUP BY t.name, i.name, i.is_unique, i.is_primary_key
            """).ToListAsync(Ct);

        Assert.Equal(expected, actual.OrderBy(i => i.TableName, StringComparer.Ordinal).ThenBy(i => i.Columns, StringComparer.Ordinal));
    }

    [Fact]
    public async Task Daily_usage_counts_only_analyses()
    {
        await using var db = sql.CreateContext();

        var columns = await db.Database.SqlQueryRaw<string>(
            "SELECT COLUMN_NAME AS Value FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'UsageDaily'")
            .ToListAsync(Ct);

        Assert.Equal(["AnalysisCount", "Date", "InstallId"], columns.Order());
    }

    [Fact]
    public async Task Evaluations_are_whole_numbers_without_floating_point_columns()
    {
        await using var db = sql.CreateContext();

        var floatingPoint = await db.Database.SqlQueryRaw<string>(
            "SELECT TABLE_NAME + '.' + COLUMN_NAME AS Value FROM INFORMATION_SCHEMA.COLUMNS WHERE DATA_TYPE IN ('float', 'real')")
            .ToListAsync(Ct);

        Assert.Empty(floatingPoint);
    }

    [Fact]
    public async Task A_game_with_its_moves_survives_a_round_trip()
    {
        var game = NewGame();
        game.Moves.Add(NewMove(ply: 1, evalBeforeCp: 30, evalAfterCp: 25, classification: MoveClassification.Book));
        game.Moves.Add(NewMove(ply: 2, mateBefore: 2, mateAfter: 1, classification: MoveClassification.Best));
        await SaveAsync(game);

        await using var db = sql.CreateContext();
        var stored = await db.Games.Include(g => g.Moves).SingleAsync(g => g.Id == game.Id, Ct);

        Assert.Equal(game.ExternalGameId, stored.ExternalGameId);
        Assert.InRange(stored.CreatedAt, DateTime.UtcNow.AddMinutes(-5), DateTime.UtcNow.AddMinutes(5));
        var mateMove = stored.Moves.Single(m => m.Ply == 2);
        Assert.Equal((null, (short?)2, null, (short?)1), (mateMove.EvalBeforeCp, mateMove.MateBefore, mateMove.EvalAfterCp, mateMove.MateAfter));
        Assert.Equal(MoveClassification.Best, mateMove.Classification);
    }

    [Fact]
    public async Task Games_are_unique_by_external_id()
    {
        var first = NewGame();
        await SaveAsync(first);

        var duplicate = NewGame();
        duplicate.ExternalGameId = first.ExternalGameId;

        await AssertDuplicateAsync("Games", () => SaveAsync(duplicate));
    }

    [Fact]
    public async Task Moves_are_unique_by_game_and_ply()
    {
        var game = NewGame();
        game.Moves.Add(NewMove(ply: 1, evalBeforeCp: 0, evalAfterCp: 0));
        game.Moves.Add(NewMove(ply: 1, evalBeforeCp: 0, evalAfterCp: 0));

        await AssertDuplicateAsync("Moves", () => SaveAsync(game));
    }

    [Fact]
    public async Task Explanations_are_unique_by_game_ply_and_language()
    {
        var game = NewGame();
        await SaveAsync(game);

        await AssertDuplicateAsync("Explanations", () => SaveAsync(
            new Explanation { GameId = game.Id, Ply = 10, Language = "ru", Text = "…", Model = "test" },
            new Explanation { GameId = game.Id, Ply = 10, Language = "ru", Text = "…", Model = "test" }));
    }

    [Fact]
    public async Task There_is_one_analysis_per_game_and_language()
    {
        var game = NewGame();
        await SaveAsync(game);

        await AssertDuplicateAsync("ExplanationJobs", () => SaveAsync(
            new ExplanationJob { GameId = game.Id, Language = "en" },
            new ExplanationJob { GameId = game.Id, Language = "en" }));
    }

    // Keys are saved in separate contexts: in one context EF would reject the duplicate itself,
    // and the database would never see it.
    [Fact]
    public async Task Installs_are_unique_by_install_id()
    {
        var installId = Guid.NewGuid();
        await SaveAsync(new Install { InstallId = installId });

        await AssertDuplicateAsync("Installs", () => SaveAsync(new Install { InstallId = installId }));
    }

    [Fact]
    public async Task Daily_usage_is_unique_by_install_and_date()
    {
        var install = new Install { InstallId = Guid.NewGuid() };
        await SaveAsync(install);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await SaveAsync(new UsageDaily { InstallId = install.InstallId, Date = today });

        await AssertDuplicateAsync("UsageDaily", () => SaveAsync(new UsageDaily { InstallId = install.InstallId, Date = today }));
    }

    [Theory]
    [InlineData(null, null, "CK_Moves_EvalBefore")]
    [InlineData(30, (short)3, "CK_Moves_EvalBefore")]
    [InlineData(null, (short)0, "CK_Moves_MateBefore")]
    public async Task Each_evaluation_is_centipawns_or_a_mate(int? evalBeforeCp, short? mateBefore, string constraint)
    {
        var game = NewGame();
        game.Moves.Add(NewMove(ply: 1, evalBeforeCp: evalBeforeCp, mateBefore: mateBefore, evalAfterCp: 0));

        await AssertConstraintAsync(constraint, () => SaveAsync(game));
    }

    [Fact]
    public async Task Explanation_language_is_one_of_the_contract_languages()
    {
        var game = NewGame();
        await SaveAsync(game);

        await AssertConstraintAsync("CK_Explanations_Language", () => SaveAsync(
            new Explanation { GameId = game.Id, Ply = 1, Language = "de", Text = "…", Model = "test" }));
    }

    [Fact]
    public async Task Classification_outside_the_contract_is_rejected()
    {
        var game = NewGame();
        game.Moves.Add(NewMove(ply: 1, evalBeforeCp: 0, evalAfterCp: 0));
        await SaveAsync(game);
        await using var db = sql.CreateContext();

        var error = await Assert.ThrowsAsync<SqlException>(() =>
            db.Database.ExecuteSqlAsync($"UPDATE Moves SET Classification = 'Brilliant' WHERE GameId = {game.Id}", Ct));

        Assert.Equal(ConstraintConflict, error.Number);
        Assert.Contains("CK_Moves_Classification", error.Message, StringComparison.Ordinal);
    }

    private async Task SaveAsync(params object[] entities)
    {
        await using var db = sql.CreateContext();
        db.AddRange(entities);
        await db.SaveChangesAsync(Ct);
    }

    private static async Task AssertDuplicateAsync(string table, Func<Task> save)
    {
        var error = await Assert.ThrowsAsync<DbUpdateException>(save);
        var sqlError = Assert.IsType<SqlException>(error.InnerException);

        Assert.Contains(sqlError.Number, new[] { DuplicateKeyInIndex, DuplicateKeyInConstraint });
        Assert.Contains($"dbo.{table}", sqlError.Message, StringComparison.Ordinal);
    }

    private static async Task AssertConstraintAsync(string constraint, Func<Task> save)
    {
        var error = await Assert.ThrowsAsync<DbUpdateException>(save);
        var sqlError = Assert.IsType<SqlException>(error.InnerException);

        Assert.Equal(ConstraintConflict, sqlError.Number);
        Assert.Contains(constraint, sqlError.Message, StringComparison.Ordinal);
    }

    private static Game NewGame() => new()
    {
        ExternalGameId = $"live/{Random.Shared.NextInt64(1, long.MaxValue)}",
        Pgn = "1. e4 e5 *",
        WhiteUser = "example_white",
        BlackUser = "example_black",
    };

    private static Move NewMove(
        short ply,
        int? evalBeforeCp = null,
        short? mateBefore = null,
        int? evalAfterCp = null,
        short? mateAfter = null,
        MoveClassification classification = MoveClassification.Good) => new()
    {
        Ply = ply,
        San = "e4",
        Uci = "e2e4",
        BestMoveUci = "e2e4",
        EvalBeforeCp = evalBeforeCp,
        MateBefore = mateBefore,
        EvalAfterCp = evalAfterCp,
        MateAfter = mateAfter,
        Classification = classification,
    };

    private sealed record IndexInfo(string TableName, string Columns, bool IsUnique, bool IsPrimaryKey);
}
