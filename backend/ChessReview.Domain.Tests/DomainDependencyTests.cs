using System.Reflection;

namespace ChessReview.Domain.Tests;

// Classification rules stay free of infrastructure: they are tested in isolation and change
// without touching the database or the web layer.
public class DomainDependencyTests
{
    private static readonly Assembly Domain = Assembly.Load("ChessReview.Domain");

    [Fact]
    public void Domain_references_only_the_base_class_library()
    {
        // Only references used in code end up in the assembly, and those are what matters here.
        var foreign = Domain.GetReferencedAssemblies()
            .Select(reference => reference.Name!)
            .Where(name => !IsBaseClassLibrary(name))
            .ToArray();

        Assert.Empty(foreign);
    }

    private static bool IsBaseClassLibrary(string name) =>
        name.StartsWith("System.", StringComparison.Ordinal)
        || name is "System" or "netstandard" or "mscorlib";
}
