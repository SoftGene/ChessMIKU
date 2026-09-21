using Testcontainers.MsSql;

namespace ChessReview.Testing;

public static class SqlServerContainer
{
    // The image docker-compose.yml runs in production; a test keeps the two in step.
    public const string Image = "mcr.microsoft.com/mssql/server:2025-CU9-ubuntu-24.04";

    public static MsSqlContainer Create() => new MsSqlBuilder(Image).Build();
}
