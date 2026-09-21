using ChessReview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<ChessReviewDbContext>((services, options) => options.UseSqlServer(
    services.GetRequiredService<IConfiguration>().GetConnectionString("ChessReview")
        ?? throw new InvalidOperationException("Connection string 'ChessReview' is not set.")));

builder.Services.AddHealthChecks().AddDbContextCheck<ChessReviewDbContext>();

var app = builder.Build();

// One API instance on the home server: applying migrations on startup is enough.
if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<ChessReviewDbContext>().Database.MigrateAsync();
}

app.MapHealthChecks("/healthz");

await app.RunAsync();
