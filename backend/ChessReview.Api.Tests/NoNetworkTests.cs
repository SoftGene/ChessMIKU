using ChessReview.Infrastructure.Llm;
using Microsoft.Extensions.DependencyInjection;

namespace ChessReview.Api.Tests;

public class NoNetworkTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public void The_test_host_answers_with_a_stub_instead_of_Gemini()
    {
        Assert.IsType<StubLlmClient>(api.Services.GetRequiredService<ILlmClient>());
    }

    [Fact]
    public async Task No_HTTP_client_of_the_test_host_reaches_the_network()
    {
        // The client the Gemini implementation would get, had the stub not replaced it.
        using var gemini = api.Services.GetRequiredService<IHttpClientFactory>().CreateClient(nameof(ILlmClient));

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() => gemini.GetAsync(new Uri("https://generativelanguage.googleapis.com/"), Ct));

        Assert.StartsWith("Tests do not go to the network", exception.Message, StringComparison.Ordinal);
    }
}
