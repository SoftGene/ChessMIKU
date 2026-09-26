using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChessReview.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GreatAndBrilliant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Moves_Classification",
                table: "Moves");

            migrationBuilder.AddColumn<int>(
                name: "SecondBestCp",
                table: "Moves",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "SecondBestMate",
                table: "Moves",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ClassifierVersion",
                table: "Games",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Moves_Classification",
                table: "Moves",
                sql: "[Classification] IN ('Best', 'Excellent', 'Good', 'Book', 'Inaccuracy', 'Mistake', 'Miss', 'Blunder', 'Great', 'Brilliant')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Moves_SecondBest",
                table: "Moves",
                sql: "[SecondBestCp] IS NULL OR [SecondBestMate] IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Moves_Classification",
                table: "Moves");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Moves_SecondBest",
                table: "Moves");

            migrationBuilder.DropColumn(
                name: "SecondBestCp",
                table: "Moves");

            migrationBuilder.DropColumn(
                name: "SecondBestMate",
                table: "Moves");

            migrationBuilder.DropColumn(
                name: "ClassifierVersion",
                table: "Games");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Moves_Classification",
                table: "Moves",
                sql: "[Classification] IN ('Best', 'Excellent', 'Good', 'Book', 'Inaccuracy', 'Mistake', 'Miss', 'Blunder')");
        }
    }
}
