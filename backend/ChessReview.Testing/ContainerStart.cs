using DotNet.Testcontainers.Containers;
using Microsoft.Extensions.Logging;

namespace ChessReview.Testing;

public static class ContainerStart
{
    /// <summary>
    /// Creates and starts a container. One that exits while it starts up is deleted, its output
    /// logged, and a new one takes its place, up to <paramref name="attempts"/> containers in all.
    /// Any other failure is not retried.
    /// </summary>
    public static async Task<TContainer> StartAsync<TContainer>(Func<TContainer> create, int attempts, CancellationToken ct = default)
        where TContainer : IContainer
    {
        for (var attempt = 1; ; attempt++)
        {
            var container = create();
            try
            {
                await container.StartAsync(ct);
                return container;
            }
            catch (Exception e)
            {
                await container.DisposeAsync();

                if (e is not ContainerNotRunningException || attempt == attempts)
                    throw;

                // The exception message carries the container's stdout and stderr.
                container.Logger.LogWarning(
                    "Attempt {Attempt} of {Attempts}: starting a new container, because this one exited while starting. {Exit}",
                    attempt, attempts, e.Message);
            }
        }
    }
}
