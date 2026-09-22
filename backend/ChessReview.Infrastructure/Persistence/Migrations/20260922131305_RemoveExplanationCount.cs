using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChessReview.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveExplanationCount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExplanationCount",
                table: "UsageDaily");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ExplanationCount",
                table: "UsageDaily",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }
    }
}
