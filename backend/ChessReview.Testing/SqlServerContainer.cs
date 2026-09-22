using Testcontainers.MsSql;

namespace ChessReview.Testing;

public static class SqlServerContainer
{
    // The image docker-compose.yml runs in production; a test keeps the two in step.
    public const string Image = "mcr.microsoft.com/mssql/server:2025-CU9-ubuntu-24.04";

    // Now and then a fresh container exits with code 1 before it is ready: SQL Server's own
    // security subsystem (LSA) crashes or hangs while it starts. The fault is in the image, not
    // in the tests, and a new container starts normally.
    private const int StartAttempts = 3;

    /// <summary>Starts a new SQL Server container, replacing ones that exit while starting.</summary>
    public static Task<MsSqlContainer> StartAsync(CancellationToken ct = default) =>
        ContainerStart.StartAsync(() => new MsSqlBuilder(Image).Build(), StartAttempts, ct);
}
