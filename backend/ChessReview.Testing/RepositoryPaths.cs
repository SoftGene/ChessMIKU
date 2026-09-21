namespace ChessReview.Testing;

public static class RepositoryPaths
{
    /// <summary>The repository root: the nearest folder above the test binaries with global.json.</summary>
    public static string Root { get; } = FindRoot();

    private static string FindRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "global.json")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("Repository root with global.json not found.");
    }
}
