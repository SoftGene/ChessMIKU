using System.Diagnostics;
using System.Text.RegularExpressions;
using ChessReview.Testing;

namespace ChessReview.Api.Tests;

public partial class DeploymentTests
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

    [Fact]
    public void Compose_takes_the_Gemini_key_from_the_environment()
    {
        Assert.Contains("Gemini__ApiKey: ${GEMINI_API_KEY", Compose, StringComparison.Ordinal);
    }

    [Fact]
    public void No_file_that_git_would_commit_holds_a_Google_API_key()
    {
        var files = FilesGitWouldCommit();

        // The scan sees the repository and would recognise a key: built here, so that no file holds one.
        Assert.Contains("docker-compose.yml", files);
        Assert.Matches(GoogleApiKey(), "AIza" + new string('x', 35));

        Assert.DoesNotContain(files, file => GoogleApiKey().IsMatch(File.ReadAllText(Path.Combine(RepositoryPaths.Root, file))));
    }

    // Google API keys are "AIza" followed by 35 characters.
    [GeneratedRegex("AIza[0-9A-Za-z_-]{35}")]
    private static partial Regex GoogleApiKey();

    // Tracked files and new files that .gitignore does not exclude; .env with the real key is excluded.
    private static List<string> FilesGitWouldCommit()
    {
        using var git = Process.Start(new ProcessStartInfo("git", "ls-files --cached --others --exclude-standard")
        {
            WorkingDirectory = RepositoryPaths.Root,
            RedirectStandardOutput = true,
        })!;
        var output = git.StandardOutput.ReadToEnd();
        git.WaitForExit();
        Assert.Equal(0, git.ExitCode);

        // A tracked file deleted in the working tree is still listed.
        return [.. output.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(file => File.Exists(Path.Combine(RepositoryPaths.Root, file)))];
    }
}
