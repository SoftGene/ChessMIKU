using System.Text.Json;
using System.Text.Json.Serialization;
using ChessReview.Api.Analyses;
using ChessReview.Api.Installs;
using ChessReview.Api.Limits;
using ChessReview.ExplanationWorker;
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
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<AnalysisService>();

builder.Services.AddInstallIdAuthentication();
builder.Services.AddOptions<QuotaOptions>().BindConfiguration(QuotaOptions.Section).ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddScoped<DailyQuota>();
builder.Services.AddCloudflareTunnel();
builder.Services.AddChessReviewRateLimiting();
builder.Services.AddExplanationWorker();

builder.Services.AddHealthChecks().AddDbContextCheck<ChessReviewDbContext>();

var app = builder.Build();

// One API instance on the home server: applying migrations on startup is enough.
if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<ChessReviewDbContext>().Database.MigrateAsync();
}

// The client address comes first: the registration limit counts by it.
app.UseForwardedHeaders();

// The rate limiter needs the installation, and refuses requests before authorization answers 401.
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/healthz").AllowAnonymous();

await app.RunAsync();
