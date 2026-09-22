using System.Collections.Concurrent;
using System.Net;
using ChessReview.Testing;
using Docker.DotNet;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Configurations;
using DotNet.Testcontainers.Containers;
using Microsoft.Extensions.Logging;

namespace ChessReview.Infrastructure.Tests;

/// <summary>
/// A container that exits while starting, as SQL Server 2025 now and then does, is replaced by
/// a new one. The stand-in containers run the SQL Server image with another entrypoint, so the
/// tests pull nothing new.
/// </summary>
public class ContainerStartTests
{
    private const string CrashOutput = "This program has encountered a fatal error and cannot continue running";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private readonly CapturingLogger _logger = new();

    [Fact]
    public async Task A_container_that_exits_while_starting_is_replaced_by_a_new_one()
    {
        var containers = new ContainerSequence(Crashing(), Crashing(), Running());

        await using var container = await ContainerStart.StartAsync(containers.Next, attempts: 3, Ct);

        Assert.Same(containers.Created[2], container);
        Assert.Equal(TestcontainersStates.Running, container.State);
    }

    [Fact]
    public async Task The_output_of_a_container_that_exits_while_starting_is_logged()
    {
        var containers = new ContainerSequence(Crashing(), Running());

        await using var container = await ContainerStart.StartAsync(containers.Next, attempts: 3, Ct);

        var warning = Assert.Single(_logger.Warnings);
        Assert.Contains(CrashOutput, warning, StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_container_that_exits_while_starting_is_deleted()
    {
        var crashed = UniqueName();
        var containers = new ContainerSequence(Crashing(crashed), Running());

        await using var container = await ContainerStart.StartAsync(containers.Next, attempts: 3, Ct);

        using var docker = TestcontainersSettings.OS.DockerEndpointAuthConfig.GetDockerClientBuilder(Guid.Empty).Build();
        var notFound = await Assert.ThrowsAnyAsync<DockerApiException>(
            () => docker.Containers.InspectContainerAsync(crashed, Ct));
        Assert.Equal(HttpStatusCode.NotFound, notFound.StatusCode);
    }

    [Fact]
    public async Task After_the_last_attempt_the_exit_is_thrown_with_the_container_output()
    {
        var containers = new ContainerSequence(Crashing(), Crashing(), Crashing(), Running());

        var exited = await Assert.ThrowsAsync<ContainerNotRunningException>(
            () => ContainerStart.StartAsync(containers.Next, attempts: 3, Ct));

        Assert.Equal(3, containers.Created.Count);
        Assert.Contains(CrashOutput, exited.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_start_that_fails_for_another_reason_is_not_retried()
    {
        var containers = new ContainerSequence(FailingReadinessCheck(), Running());

        await Assert.ThrowsAsync<ReadinessCheckFailed>(() => ContainerStart.StartAsync(containers.Next, attempts: 3, Ct));

        Assert.Single(containers.Created);
    }

    // Prints what SQL Server prints when it crashes, then exits before it is ever ready.
    private IContainer Crashing(string? name = null) => new ContainerBuilder(SqlServerContainer.Image)
        .WithName(name ?? UniqueName())
        .WithEntrypoint("/bin/sh", "-c", $"echo '{CrashOutput}'; exit 1")
        .WithWaitStrategy(Wait.ForUnixContainer().UntilMessageIsLogged("never printed"))
        .WithLogger(_logger)
        .Build();

    private IContainer Running() => new ContainerBuilder(SqlServerContainer.Image)
        .WithEntrypoint("sleep", "infinity")
        .WithLogger(_logger)
        .Build();

    private IContainer FailingReadinessCheck() => new ContainerBuilder(SqlServerContainer.Image)
        .WithEntrypoint("sleep", "infinity")
        .WithWaitStrategy(Wait.ForUnixContainer().AddCustomWaitStrategy(new FailingCheck()))
        .WithLogger(_logger)
        .Build();

    // Testcontainers forgets a deleted container's id, so the tests find it by name.
    private static string UniqueName() => $"chess-review-crash-{Guid.NewGuid():N}";

    /// <summary>Hands out the given containers in order and remembers which were handed out.</summary>
    private sealed class ContainerSequence(params IContainer[] containers)
    {
        public List<IContainer> Created { get; } = [];

        public IContainer Next()
        {
            var container = containers[Created.Count];
            Created.Add(container);
            return container;
        }
    }

    private sealed class FailingCheck : IWaitUntil
    {
        public Task<bool> UntilAsync(IContainer container) => throw new ReadinessCheckFailed();
    }

    private sealed class ReadinessCheckFailed : Exception;

    private sealed class CapturingLogger : ILogger
    {
        private readonly ConcurrentQueue<(LogLevel Level, string Message)> _entries = new();

        public IEnumerable<string> Warnings => _entries.Where(e => e.Level == LogLevel.Warning).Select(e => e.Message);

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            _entries.Enqueue((logLevel, formatter(state, exception)));
    }
}
