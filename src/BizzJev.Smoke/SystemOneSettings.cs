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
        var key = config["SYSTEMONE_API_KEY"] ?? config["TYPESAFE_API_KEY"];
        var model = config["SYSTEMONE_MODEL"] ?? config["TypeSafe:Model"] ?? DefaultModel;
        var baseUrl = config["SYSTEMONE_URL"] ?? "https://api.typesafe.ai";
        var timeout = int.TryParse(config["TypeSafe:TimeoutSeconds"], out var seconds) && seconds is >= 1 and <= 300 ? seconds : 60;
        if (string.IsNullOrWhiteSpace(key)) return null;
        return new SystemOneSettings(key, model, new Uri($"{baseUrl.TrimEnd('/')}/v1/systemone", UriKind.Absolute), timeout);
    }
}
