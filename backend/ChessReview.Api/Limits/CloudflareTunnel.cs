using System.Net;
using Microsoft.AspNetCore.HttpOverrides;

namespace ChessReview.Api.Limits;

/// <summary>
/// Behind Cloudflare Tunnel every request comes from cloudflared, and the per-address registration limit
/// would be one for everybody. The client address is in the header Cloudflare sets at its edge.
/// </summary>
public static class CloudflareTunnel
{
    public const string ClientAddressHeader = "CF-Connecting-IP";

    public const string Section = "ForwardedHeaders";

    public static IServiceCollection AddCloudflareTunnel(this IServiceCollection services)
    {
        services.AddOptions<ForwardedHeadersOptions>().Configure<IConfiguration>((options, configuration) =>
        {
            var proxies = configuration.GetSection($"{Section}:KnownProxies").Get<string[]>() ?? [];

            // Only cloudflared. The defaults trust loopback, that is any process on the server; an empty list
            // would trust everybody, and any client could pick its own address. No tunnel: no header.
            options.ForwardedHeaders = proxies.Length > 0 ? ForwardedHeaders.XForwardedFor : ForwardedHeaders.None;
            options.ForwardedForHeaderName = ClientAddressHeader;
            options.KnownProxies.Clear();
            options.KnownIPNetworks.Clear();
            foreach (var proxy in proxies)
            {
                options.KnownProxies.Add(IPAddress.Parse(proxy));
            }
        });

        return services;
    }
}
