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
    public async Task JevAdapterPreservesExistingRequestAndResultBehavior()
    {
        var handler = new CapturingHandler(_ => Json("""{"model":"jev-test","answers":{"access":{"type":"noul","noul":0.91}}}"""));
        ISystemOneProvider provider = new JevSystemOneProvider(new JevGateClient(new HttpClient(handler), "jev-test"));

        var outcome = await provider.EvaluateAsync("hello", [Question("access", "Can the customer log in?")], "v1");

        using var request = JsonDocument.Parse(handler.Body!);
        Assert.Equal("hello", request.RootElement.GetProperty("state").GetProperty("customerText").GetString());
        Assert.Equal("yes", request.RootElement.GetProperty("questions").GetProperty("access").GetProperty("criteria").GetProperty("true").GetString());
        Assert.Equal(0.91, outcome.Result.Signals.Single().Probability);
    }

    [Fact]
    public async Task SvenSerializesKevSchemaAsUtf8WithAllQuestionsInOneRequest()
    {
        var handler = new CapturingHandler(_ => Json("""{"model":"kev-latest","answers":{"access":{"type":"noul","noul":0.9797},"billing":{"type":"noul","noul":0.08}}}"""));
        var provider = new SvenSystemOneProvider(new HttpClient(handler));
        const string state = "Kunden kan inte logga in på sin portal. ÅÄÖ åäö";
        var questions = new[]
        {
            Question("access", "Är detta ett problem som handlar om åtkomst eller inloggning?"),
            Question("billing", "Gäller frågan en felaktig faktura?")
        };

        await provider.EvaluateAsync(state, questions, "v1-sv");

        Assert.Equal(1, handler.Attempts);
        Assert.Equal("http://localhost:8009/v1/systemone", handler.Uri!.ToString());
        Assert.Equal("application/json", handler.MediaType);
        Assert.Equal("utf-8", handler.CharSet);
        Assert.Contains(state, handler.Body, StringComparison.Ordinal);
        using var request = JsonDocument.Parse(handler.Body!);
        Assert.Equal(state, request.RootElement.GetProperty("state").GetString());
        Assert.Equal("kev-latest", request.RootElement.GetProperty("model").GetString());
        var sent = request.RootElement.GetProperty("questions");
        Assert.Equal(2, sent.EnumerateObject().Count());
        Assert.Equal("noul", sent.GetProperty("access").GetProperty("type").GetString());
        Assert.Equal(questions[0].Instructions, sent.GetProperty("access").GetProperty("instructions").GetString());
        Assert.False(sent.GetProperty("access").TryGetProperty("criteria", out _));
    }

    [Fact]
    public async Task SvenMapsMultipleNoulAnswersIntoInternalSignals()
    {
        var handler = new CapturingHandler(_ => Json("""{"model":"kev-latest","answers":{"access":{"type":"noul","noul":0.9797},"billing":{"type":"noul","noul":0.08}}}"""));
        var provider = new SvenSystemOneProvider(new HttpClient(handler));

        var outcome = await provider.EvaluateAsync("state", [Question("access", "a"), Question("billing", "b")], "v1");

        Assert.Equal(2, outcome.Result.Signals.Count);
        Assert.Equal(0.9797, outcome.Result.Signals.Single(x => x.GateId == "access").Probability);
        Assert.Equal(0.08, outcome.Result.Signals.Single(x => x.GateId == "billing").Probability);
        Assert.All(outcome.Result.Signals, x =>
        {
            Assert.True(x.Success);
            Assert.Equal("kev-latest", x.ModelVersion);
        });
        Assert.Equal(2, outcome.Diagnostics!.JudgmentCount);
        Assert.Equal("v1", outcome.Result.GateSetVersion);
    }

    [Theory]
    [InlineData(null, typeof(JevSystemOneProvider))]
    [InlineData("jev", typeof(JevSystemOneProvider))]
    [InlineData("SVEN", typeof(SvenSystemOneProvider))]
    public void ProviderSwitchSelectsConfiguredAdapter(string? configured, Type expected)
    {
        var selected = SystemOneProviderFactory.Select(
            configured,
            () => new JevSystemOneProvider(new JevGateClient(new HttpClient(new CapturingHandler(_ => Json("{}"))), "jev")),
            () => new SvenSystemOneProvider(new HttpClient(new CapturingHandler(_ => Json("{}")))));

        Assert.IsType(expected, selected);
    }

    [Fact]
    public void ProviderSwitchRejectsUnknownValue()
        => Assert.Throws<InvalidOperationException>(() => SystemOneProviderFactory.Select("other", () => throw new Exception(), () => throw new Exception()));

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

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Attempts++;
            Body = await request.Content!.ReadAsStringAsync(ct);
            Uri = request.RequestUri;
            MediaType = request.Content.Headers.ContentType?.MediaType;
            CharSet = request.Content.Headers.ContentType?.CharSet;
            return respond(request);
        }
    }
}
