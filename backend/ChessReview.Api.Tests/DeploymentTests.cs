using ChessReview.Testing;

namespace ChessReview.Api.Tests;

public class DeploymentTests
{
    private static readonly string Compose = File.ReadAllText(Path.Combine(RepositoryPaths.Root, "docker-compose.yml"));

    [Fact]
    public void Compose_runs_the_tested_SQL_Server_image_in_the_Express_edition()
    {
        Assert.Contains($"image: {SqlServerContainer.Image}", Compose, StringComparison.Ordinal);

        // The default Developer edition is licensed for development and testing only.
        Assert.Contains("MSSQL_PID: Express", Compose, StringComparison.Ordinal);
    }

    [Fact]
    public void Compose_takes_the_database_password_from_the_environment()
    {
        Assert.Contains("MSSQL_SA_PASSWORD: ${MSSQL_SA_PASSWORD", Compose, StringComparison.Ordinal);
        Assert.Contains("Password=${MSSQL_SA_PASSWORD", Compose, StringComparison.Ordinal);
    }
}
