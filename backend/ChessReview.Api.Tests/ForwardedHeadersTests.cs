using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace ChessReview.Api.Tests;

/// <summary>
/// Behind Cloudflare Tunnel every request comes from cloudflared. The registration limit is per client
/// address, so the API takes the address from the header Cloudflare sets, and only from cloudflared.
/// </summary>
public class ForwardedHeadersTests(ApiFactory api)
{
    private const string Tunnel = "10.0.0.2";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Registrations_through_the_tunnel_are_limited_per_client_address()
    {
        using var host = OneRegistrationPerAddress(trustedProxy: Tunnel);

        Assert.Equal(HttpStatusCode.Created, await RegisterAsync(host, peer: Tunnel, client: "203.0.113.1"));
        Assert.Equal(HttpStatusCode.TooManyRequests, await RegisterAsync(host, peer: Tunnel, client: "203.0.113.1"));
        Assert.Equal(HttpStatusCode.Created, await RegisterAsync(host, peer: Tunnel, client: "203.0.113.2"));
    }

    [Fact]
    public async Task The_client_address_header_from_anyone_but_the_tunnel_is_ignored()
    {
        using var host = OneRegistrationPerAddress(trustedProxy: Tunnel);

        Assert.Equal(HttpStatusCode.Created, await RegisterAsync(host, peer: "198.51.100.7", client: "203.0.113.1"));
        Assert.Equal(HttpStatusCode.TooManyRequests, await RegisterAsync(host, peer: "198.51.100.7", client: "203.0.113.2"));
    }

    [Fact]
    public async Task Without_a_configured_tunnel_even_loopback_is_not_trusted()
    {
        // ASP.NET Core trusts loopback by default; on the server that would be any process on the host.
        using var host = OneRegistrationPerAddress(trustedProxy: null);

        Assert.Equal(HttpStatusCode.Created, await RegisterAsync(host, peer: "127.0.0.1", client: "203.0.113.1"));
        Assert.Equal(HttpStatusCode.TooManyRequests, await RegisterAsync(host, peer: "127.0.0.1", client: "203.0.113.2"));
    }

    private WebApplicationFactory<Program> OneRegistrationPerAddress(string? trustedProxy) => api.WithWebHostBuilder(builder =>
    {
        builder.UseSetting("RateLimiting:Registrations:PermitLimit", "1");
        if (trustedProxy is not null)
        {
            builder.UseSetting("ForwardedHeaders:KnownProxies:0", trustedProxy);
        }

        // The test server has no connection address: this header stands for the address the request comes from.
        builder.ConfigureTestServices(services => services.AddSingleton<IStartupFilter, PeerAddressFromTestHeader>());
    });

    private static async Task<HttpStatusCode> RegisterAsync(WebApplicationFactory<Program> host, string peer, string client)
    {
        using var http = host.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/installs");
        request.Headers.Add(PeerAddressFromTestHeader.Header, peer);
        request.Headers.Add("CF-Connecting-IP", client);

        using var response = await http.SendAsync(request, Ct);
        return response.StatusCode;
    }

    private sealed class PeerAddressFromTestHeader : IStartupFilter
    {
        public const string Header = "X-Test-Peer";

        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((context, nextMiddleware) =>
            {
                context.Connection.RemoteIpAddress = IPAddress.Parse(context.Request.Headers[Header].ToString());
                return nextMiddleware(context);
            });
            next(app);
        };
    }
}
