using System.Net;
using System.Text;
using System.Text.Json;
using Xunit;

public sealed class SystemOneProviderTests
{
    private static SemanticGateDefinition Question(string id, string instructions) => new()
    {
        GateId = id,
        Category = "routing",
        BusinessGoal = "goal",
        SemanticTarget = "target",
        SemanticInterior = "interior",
        SemanticBoundaries = "boundaries",
        FalsePositiveConsequence = "fp",
        FalseNegativeConsequence = "fn",
        PolicyProfile = "balanced_routing",
        PromptVersion = "v1",
        Instructions = instructions,
        Criteria = new NoulCriteria { True = "yes", False = "no" },
        ReviewThreshold = 0.3,
        AcceptThreshold = 0.8,
        ActionOnYes = "route",
        ActionLabel = "Route"
    };

    [Fact]
    public async Task CompatibleAdapterPreservesExistingRequestAndResultBehavior()
    {
        var handler = new CapturingHandler(_ => Json("""{"model":"kev-latest","answers":{"access":{"type":"noul","noul":0.91},"billing":{"type":"noul","noul":0.08}},"latency_ms":9}"""));
        ISystemOneProvider provider = new JevSystemOneProvider(
            new JevGateClient(new HttpClient(handler), "kev-latest", "https://kev.example", "modal-key"));

        var outcome = await provider.EvaluateAsync(
            "Kunden kan inte logga in. ÅÄÖ åäö",
            [Question("access", "Kan kunden logga in?"), Question("billing", "Gäller det fakturering?")],
            "v1-sv");

        using var request = JsonDocument.Parse(handler.Body!);
        Assert.Equal("https://kev.example/v1/systemone", handler.Uri!.ToString());
        Assert.Equal("Bearer", handler.AuthorizationScheme);
        Assert.Equal("modal-key", handler.AuthorizationParameter);
        Assert.Equal("Kunden kan inte logga in. ÅÄÖ åäö", request.RootElement.GetProperty("state").GetProperty("customerText").GetString());
        Assert.Equal("kev-latest", request.RootElement.GetProperty("model").GetString());
        Assert.Equal("yes", request.RootElement.GetProperty("questions").GetProperty("access").GetProperty("criteria").GetProperty("true").GetString());
        Assert.Equal(2, request.RootElement.GetProperty("questions").EnumerateObject().Count());
        Assert.Equal(0.91, outcome.Result.Signals.Single(x => x.GateId == "access").Probability);
        Assert.Equal(1, handler.Attempts);
        Assert.Equal("application/json", handler.MediaType);
        Assert.Equal("utf-8", handler.CharSet);
        Assert.Equal(2, outcome.Result.Signals.Count);
        Assert.Equal(0.08, outcome.Result.Signals.Single(x => x.GateId == "billing").Probability);
        Assert.Equal(2, outcome.Diagnostics!.JudgmentCount);
        Assert.Equal("v1-sv", outcome.Result.GateSetVersion);
    }

    private static HttpResponseMessage Json(string body) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(body, Encoding.UTF8, "application/json")
    };

    private sealed class CapturingHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public int Attempts { get; private set; }
        public string? Body { get; private set; }
        public Uri? Uri { get; private set; }
        public string? MediaType { get; private set; }
        public string? CharSet { get; private set; }
        public string? AuthorizationScheme { get; private set; }
        public string? AuthorizationParameter { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Attempts++;
            Body = await request.Content!.ReadAsStringAsync(ct);
            Uri = request.RequestUri;
            MediaType = request.Content.Headers.ContentType?.MediaType;
            CharSet = request.Content.Headers.ContentType?.CharSet;
            AuthorizationScheme = request.Headers.Authorization?.Scheme;
            AuthorizationParameter = request.Headers.Authorization?.Parameter;
            return respond(request);
        }
    }
}
