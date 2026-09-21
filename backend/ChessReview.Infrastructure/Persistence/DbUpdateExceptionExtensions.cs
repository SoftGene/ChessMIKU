using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace ChessReview.Infrastructure.Persistence;

public static class DbUpdateExceptionExtensions
{
    private const int DuplicateKeyInIndex = 2601;
    private const int DuplicateKeyInConstraint = 2627;

    /// <summary>True when the save broke a primary key or a unique index.</summary>
    public static bool IsDuplicateKey(this DbUpdateException exception) =>
        exception.InnerException is SqlException { Number: DuplicateKeyInIndex or DuplicateKeyInConstraint };
}
