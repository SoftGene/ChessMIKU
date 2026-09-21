using System.Text.Json;
using System.Text.Json.Serialization;
using ChessReview.Api.Analyses;
using ChessReview.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc.ModelBinding.Metadata;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<ChessReviewDbContext>((services, options) => options.UseSqlServer(
    services.GetRequiredService<IConfiguration>().GetConnectionString("ChessReview")
        ?? throw new InvalidOperationException("Connection string 'ChessReview' is not set.")));

builder.Services
    .AddControllers(options =>
        // Validation errors name fields as the JSON does: moves[3].uci, not Moves[3].Uci.
        options.ModelMetadataDetailsProviders.Add(new SystemTextJsonValidationMetadataProvider()))
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));

        // The contract allows no properties it does not list.
        options.JsonSerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
    });

builder.Services.AddProblemDetails();
builder.Services.AddScoped<AnalysisService>();
builder.Services.AddHealthChecks().AddDbContextCheck<ChessReviewDbContext>();

var app = builder.Build();

// One API instance on the home server: applying migrations on startup is enough.
if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<ChessReviewDbContext>().Database.MigrateAsync();
}

app.MapControllers();
app.MapHealthChecks("/healthz");

await app.RunAsync();
