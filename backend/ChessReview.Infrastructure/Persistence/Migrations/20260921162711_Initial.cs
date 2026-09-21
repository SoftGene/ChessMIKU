using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChessReview.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Games",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ExternalGameId = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: false),
                    Pgn = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    WhiteUser = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    BlackUser = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    PlayedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Games", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Installs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstallId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Installs", x => x.Id);
                    table.UniqueConstraint("AK_Installs_InstallId", x => x.InstallId);
                });

            migrationBuilder.CreateTable(
                name: "ExplanationJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GameId = table.Column<int>(type: "int", nullable: false),
                    Language = table.Column<string>(type: "varchar(2)", unicode: false, maxLength: 2, nullable: false),
                    Status = table.Column<string>(type: "varchar(16)", unicode: false, maxLength: 16, nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    LastError = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExplanationJobs", x => x.Id);
                    table.CheckConstraint("CK_ExplanationJobs_Attempts", "[Attempts] >= 0");
                    table.CheckConstraint("CK_ExplanationJobs_Language", "[Language] IN ('ru', 'cs', 'en')");
                    table.CheckConstraint("CK_ExplanationJobs_Status", "[Status] IN ('Pending', 'Ready', 'Failed')");
                    table.ForeignKey(
                        name: "FK_ExplanationJobs_Games_GameId",
                        column: x => x.GameId,
                        principalTable: "Games",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Explanations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GameId = table.Column<int>(type: "int", nullable: false),
                    Ply = table.Column<short>(type: "smallint", nullable: false),
                    Language = table.Column<string>(type: "varchar(2)", unicode: false, maxLength: 2, nullable: false),
                    Text = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    Model = table.Column<string>(type: "varchar(64)", unicode: false, maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Explanations", x => x.Id);
                    table.CheckConstraint("CK_Explanations_Language", "[Language] IN ('ru', 'cs', 'en')");
                    table.ForeignKey(
                        name: "FK_Explanations_Games_GameId",
                        column: x => x.GameId,
                        principalTable: "Games",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Moves",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GameId = table.Column<int>(type: "int", nullable: false),
                    Ply = table.Column<short>(type: "smallint", nullable: false),
                    San = table.Column<string>(type: "varchar(10)", unicode: false, maxLength: 10, nullable: false),
                    Uci = table.Column<string>(type: "varchar(5)", unicode: false, maxLength: 5, nullable: false),
                    BestMoveUci = table.Column<string>(type: "varchar(5)", unicode: false, maxLength: 5, nullable: false),
                    EvalBeforeCp = table.Column<int>(type: "int", nullable: true),
                    MateBefore = table.Column<short>(type: "smallint", nullable: true),
                    EvalAfterCp = table.Column<int>(type: "int", nullable: true),
                    MateAfter = table.Column<short>(type: "smallint", nullable: true),
                    Classification = table.Column<string>(type: "varchar(16)", unicode: false, maxLength: 16, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Moves", x => x.Id);
                    table.CheckConstraint("CK_Moves_Classification", "[Classification] IN ('Best', 'Excellent', 'Good', 'Book', 'Inaccuracy', 'Mistake', 'Miss', 'Blunder')");
                    table.CheckConstraint("CK_Moves_EvalAfter", "([EvalAfterCp] IS NULL AND [MateAfter] IS NOT NULL) OR ([EvalAfterCp] IS NOT NULL AND [MateAfter] IS NULL)");
                    table.CheckConstraint("CK_Moves_EvalBefore", "([EvalBeforeCp] IS NULL AND [MateBefore] IS NOT NULL) OR ([EvalBeforeCp] IS NOT NULL AND [MateBefore] IS NULL)");
                    table.CheckConstraint("CK_Moves_MateBefore", "[MateBefore] <> 0");
                    table.ForeignKey(
                        name: "FK_Moves_Games_GameId",
                        column: x => x.GameId,
                        principalTable: "Games",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UsageDaily",
                columns: table => new
                {
                    InstallId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    AnalysisCount = table.Column<int>(type: "int", nullable: false),
                    ExplanationCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsageDaily", x => new { x.InstallId, x.Date });
                    table.ForeignKey(
                        name: "FK_UsageDaily_Installs_InstallId",
                        column: x => x.InstallId,
                        principalTable: "Installs",
                        principalColumn: "InstallId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExplanationJobs_GameId_Language",
                table: "ExplanationJobs",
                columns: new[] { "GameId", "Language" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ExplanationJobs_Status_CreatedAt",
                table: "ExplanationJobs",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Explanations_GameId_Ply_Language",
                table: "Explanations",
                columns: new[] { "GameId", "Ply", "Language" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Games_ExternalGameId",
                table: "Games",
                column: "ExternalGameId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Moves_GameId_Ply",
                table: "Moves",
                columns: new[] { "GameId", "Ply" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExplanationJobs");

            migrationBuilder.DropTable(
                name: "Explanations");

            migrationBuilder.DropTable(
                name: "Moves");

            migrationBuilder.DropTable(
                name: "UsageDaily");

            migrationBuilder.DropTable(
                name: "Games");

            migrationBuilder.DropTable(
                name: "Installs");
        }
    }
}
