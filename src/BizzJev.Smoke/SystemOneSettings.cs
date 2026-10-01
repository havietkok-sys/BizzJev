using Microsoft.Extensions.Configuration;

internal sealed record SystemOneSettings(string ApiKey, string Model, Uri Endpoint, int TimeoutSeconds)
{
    internal const string DefaultModel = "jev-1.13.0";

    internal static SystemOneSettings? Load()
    {
        var config = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json")
            .AddUserSecrets<SmokeMarker>()
            .AddEnvironmentVariables()
            .Build();
        var provider = config["SYSTEMONE_PROVIDER"] ?? "jev";
        if (provider is not ("jev" or "kev")) throw new InvalidOperationException("SYSTEMONE_PROVIDER must be 'jev' or 'kev'.");
        var useKev = provider == "kev";
        var key = useKev ? config["SYSTEMONE_API_KEY"] : config["TYPESAFE_API_KEY"] ?? config["SYSTEMONE_API_KEY"];
        var model = useKev ? config["SYSTEMONE_MODEL"] ?? "kev-latest" : config["TypeSafe:Model"] ?? DefaultModel;
        var baseUrl = useKev ? config["SYSTEMONE_URL"] ?? "http://localhost:8009" : "https://api.typesafe.ai";
        var timeout = int.TryParse(config["TypeSafe:TimeoutSeconds"], out var seconds) && seconds is >= 1 and <= 300 ? seconds : 60;
        if (string.IsNullOrWhiteSpace(key)) return null;
        return new SystemOneSettings(key, model, new Uri($"{baseUrl.TrimEnd('/')}/v1/systemone", UriKind.Absolute), timeout);
    }
}
