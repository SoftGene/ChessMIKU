using System.Diagnostics;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using ChessReview.Testing;
using YamlDotNet.RepresentationModel;

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
    public void Behind_the_tunnel_the_API_trusts_cloudflared_and_nobody_else()
    {
        var services = (YamlMappingNode)TunnelCompose()["services"];
        var cloudflared = (YamlMappingNode)services["cloudflared"];
        var api = (YamlMappingNode)services["api"];

        var trusted = api["environment"]["ForwardedHeaders__KnownProxies__0"].ToString();

        Assert.Equal(cloudflared["networks"]["tunnel"]["ipv4_address"].ToString(), trusted);
        Assert.Equal("172.31.250.2", trusted);
        Assert.DoesNotContain(new YamlScalarNode("ForwardedHeaders__KnownProxies__1"), ((YamlMappingNode)api["environment"]).Children.Keys);
    }

    [Fact]
    public void The_tunnel_takes_its_token_from_the_environment()
    {
        var cloudflared = (YamlMappingNode)((YamlMappingNode)TunnelCompose()["services"])["cloudflared"];

        Assert.StartsWith("${CLOUDFLARE_TUNNEL_TOKEN:?", cloudflared["environment"]["TUNNEL_TOKEN"].ToString(), StringComparison.Ordinal);
    }

    private static YamlMappingNode TunnelCompose()
    {
        var yaml = new YamlStream();
        yaml.Load(new StringReader(File.ReadAllText(Path.Combine(RepositoryPaths.Root, "docker-compose.tunnel.yml"))));
        return (YamlMappingNode)yaml.Documents[0].RootNode;
    }

    [Fact]
    public void Production_settings_stay_within_the_Gemini_free_tier()
    {
        // Free tier, per model: 5 requests a minute, 20 a day for the whole project (AI Studio, 22.09).
        var settings = JsonNode.Parse(File.ReadAllText(Path.Combine(RepositoryPaths.Root, "backend", "ChessReview.Api", "appsettings.json")))!;

        Assert.True(settings["ExplanationWorker"]!["SecondsBetweenRequests"]!.GetValue<int>() >= 60 / 5, "More than 5 requests a minute.");
        Assert.True(settings["Quotas"]!["AnalysesPerDay"]!.GetValue<int>() < 20, "One installation could use up the daily limit alone.");
        Assert.True(settings["Gemini"]!["Models"]!.AsArray().Count >= 2, "No spare model for a model at its limit.");
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
