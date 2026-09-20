using System.Net;
using System.Text;
using System.Text.Json;
using BizzJev.Lab;
using Xunit;

public sealed class StubHandler : HttpMessageHandler
{
    private readonly Func<JsonDocument, HttpResponseMessage> _respond;
    public JsonDocument? LastRequest { get; private set; }
    public StubHandler(Func<JsonDocument, HttpResponseMessage> respond) => _respond = respond;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var body = await request.Content!.ReadAsStringAsync(ct);
        LastRequest = JsonDocument.Parse(body);
        return _respond(LastRequest);
    }
}

public sealed class PolicyEngineTests
{
    [Theory]
    [InlineData(0.10, 0.40, 0.85, PolicyResult.No)]
    [InlineData(0.63, 0.40, 0.85, PolicyResult.Review)]
    [InlineData(0.91, 0.40, 0.85, PolicyResult.Yes)]
    [InlineData(0.40, 0.40, 0.85, PolicyResult.Review)]
    [InlineData(0.85, 0.40, 0.85, PolicyResult.Yes)]
    public void ThresholdTransitions(double p, double review, double accept, PolicyResult expected)
        => Assert.Equal(expected, PolicyEngine.Decide(p, review, accept));

    [Fact]
    public void FailedGateBecomesReviewNotSilentNo()
        => Assert.Equal(PolicyResult.Review, PolicyEngine.Decide(null, 0.4, 0.8));

    [Fact]
    public void InvalidThresholdPairThrows()
        => Assert.Throws<InvalidOperationException>(() => PolicyEngine.Decide(0.5, 0.9, 0.4));

    [Fact]
    public void ChangingThresholdsDoesNotChangeProbability()
    {
        // The whole point of the lab: same raw signal, different policy interpretation.
        const double raw = 0.58;
        Assert.Equal(PolicyResult.Review, PolicyEngine.Decide(raw, 0.40, 0.85));
        Assert.Equal(PolicyResult.No, PolicyEngine.Decide(raw, 0.65, 0.85));
        Assert.Equal(PolicyResult.Yes, PolicyEngine.Decide(raw, 0.30, 0.55));
        Assert.Equal(0.58, raw);
    }
}

public sealed class MultiSignalTests
{
    private static SemanticGateDefinition Gate(string id, string action) => new()
    {
        GateId = id, Category = "routing", BusinessGoal = "g", SemanticTarget = "t", SemanticInterior = "i",
        SemanticBoundaries = "b", FalsePositiveConsequence = "fp", FalseNegativeConsequence = "fn",
        PolicyProfile = "balanced_routing", PromptVersion = "v1", Instructions = "q",
        Criteria = new NoulCriteria { True = "y", False = "n" },
        ReviewThreshold = 0.35, AcceptThreshold = 0.75, ActionOnYes = action, ActionLabel = "label"
    };

    [Fact]
    public void MultipleGatesPositiveSimultaneously_NoWinnerTakesAll()
    {
        var gates = new Dictionary<string, SemanticGateDefinition>
        {
            ["billing_problem"] = Gate("billing_problem", "billing_workflow"),
            ["churn_risk"] = Gate("churn_risk", "retention_review"),
            ["recurring_problem"] = Gate("recurring_problem", "trend_analytics"),
            ["explicit_cancellation_intent"] = Gate("explicit_cancellation_intent", "cancellation_process"),
        };
        var signals = new List<SemanticGateResult>
        {
            new() { GateId = "billing_problem", Probability = 0.97, PromptVersion = "v1", Success = true },
            new() { GateId = "churn_risk", Probability = 0.63, PromptVersion = "v1", Success = true },
            new() { GateId = "recurring_problem", Probability = 0.91, PromptVersion = "v1", Success = true },
            new() { GateId = "explicit_cancellation_intent", Probability = 0.14, PromptVersion = "v1", Success = true },
        };
        var policies = gates.Values.ToDictionary(
            g => g.GateId,
            g => new PolicyDefinition { GateId = g.GateId, PolicyVersion = "v1", Profile = g.PolicyProfile, ReviewThreshold = 0.40, AcceptThreshold = 0.85 });
        policies["churn_risk"] = policies["churn_risk"] with { ReviewThreshold = 0.40, AcceptThreshold = 0.70 };
        var decisions = PolicyEngine.DecideAll(signals, policies);
        Assert.Equal(PolicyResult.Yes, decisions.First(d => d.GateId == "billing_problem").Result);
        Assert.Equal(PolicyResult.Review, decisions.First(d => d.GateId == "churn_risk").Result);
        Assert.Equal(PolicyResult.Yes, decisions.First(d => d.GateId == "recurring_problem").Result);
        Assert.Equal(PolicyResult.No, decisions.First(d => d.GateId == "explicit_cancellation_intent").Result);

        var actions = Actions.Derive(decisions, gates);
        Assert.Equal(3, actions.Count); // three simultaneous actions, cancellation not among them
        Assert.DoesNotContain(actions, a => a.SourceGate == "explicit_cancellation_intent");
        Assert.Contains(actions, a => a.Type == "retention_review" && a.Trigger == PolicyResult.Review);
    }
}

public sealed class MetricsTests
{
    private static CaseRun Run(string caseId, string gateId, string expected, double probability, double review = 0.2, double accept = 0.6)
        => new()
        {
            CaseId = caseId, CaseType = "t", CustomerText = "x",
            Expected = [new ExpectedLabel { GateId = gateId, Label = expected }],
            Signals = [ new() { GateId = gateId, Probability = probability, PromptVersion = "v1", Success = true } ],
            Policy = [ new PolicyDecision { GateId = gateId, Result = PolicyEngine.Decide(probability, review, accept), PolicyVersion = "v1", ReviewThreshold = review, AcceptThreshold = accept } ],
            Actions = [], GateSetVersion = "v1", PolicyVersion = "v1"
        };

    [Fact]
    public void ComputesTpFpFnTnAndF1()
    {
        var runs = new List<CaseRun>
        {
            Run("a", "g", "YES", 0.9),   // TP
            Run("b", "g", "YES", 0.1),   // FN
            Run("c", "g", "NO", 0.9),    // FP
            Run("d", "g", "NO", 0.1),    // TN
            Run("e", "g", "UNCLEAR", 0.99) // excluded from binary, counted as unclear
        };
        var m = Metrics.Compute(runs, ["g"]).Single();
        Assert.Equal(1, m.Tp); Assert.Equal(1, m.Fp); Assert.Equal(1, m.Fn); Assert.Equal(1, m.Tn); Assert.Equal(1, m.Unclear);
        Assert.Equal(0.5, m.Precision!.Value, 3);
        Assert.Equal(0.5, m.Recall!.Value, 3);
    }

    [Fact]
    public void WeakestRoutingGatePicksLowestF1RoutingGate()
    {
        var gates = new Dictionary<string, SemanticGateDefinition>
        {
            ["r1"] = Gate("r1"), ["r2"] = Gate("r2"), ["c1"] = Gate("c1", category: "business_signal")
        };
        var runs = new List<CaseRun> { Run("a", "r1", "YES", 0.9), Run("b", "r2", "YES", 0.1), Run("c", "c1", "NO", 0.99) };
        var metrics = Metrics.Compute(runs, ["r1", "r2", "c1"]);
        Assert.Equal("r2", Metrics.WeakestRoutingGate(metrics, gates));

        static SemanticGateDefinition Gate(string id, string category = "routing") => new()
        {
            GateId = id, Category = category, BusinessGoal = "g", SemanticTarget = "t", SemanticInterior = "i",
            SemanticBoundaries = "b", FalsePositiveConsequence = "fp", FalseNegativeConsequence = "fn",
            PolicyProfile = "balanced_routing", PromptVersion = "v1", Instructions = "q",
            Criteria = new NoulCriteria { True = "y", False = "n" },
            ReviewThreshold = 0.2, AcceptThreshold = 0.6, ActionOnYes = "a", ActionLabel = "l"
        };
    }
}

public sealed class RegressionTests
{
    [Fact]
    public void ClassifiesFixedBrokenUnchanged()
    {
        var before = new List<CaseRun> { Run("fixed", false), Run("broken", true), Run("same", true) };
        var after = new List<CaseRun> { Run("fixed", true), Run("broken", false), Run("same", true) };
        var cmp = Regression.Compare("v1", "v2", before, after, ["g"]);
        Assert.Equal(["fixed"], cmp.Fixed);
        Assert.Equal(["broken"], cmp.Broken);
        Assert.Equal(["same"], cmp.Unchanged);
    }

    private static CaseRun Run(string id, bool pass)
        => new()
        {
            CaseId = id, CaseType = "t", CustomerText = "x",
            Expected = [new ExpectedLabel { GateId = "g", Label = pass ? "NO" : "YES" }],
            Signals = [new SemanticGateResult { GateId = "g", Probability = 0.05, PromptVersion = "v1", Success = true }],
            Policy = [new PolicyDecision { GateId = "g", Result = PolicyEngine.Decide(0.05, 0.2, 0.6), PolicyVersion = "v1", ReviewThreshold = 0.2, AcceptThreshold = 0.6 }],
            Actions = [], GateSetVersion = "v1", PolicyVersion = "v1"
        };
}

public sealed class JevClientTests
{
    private static SemanticGateDefinition Gate(string id) => new()
    {
        GateId = id, Category = "routing", BusinessGoal = "g", SemanticTarget = "t", SemanticInterior = "i",
        SemanticBoundaries = "b", FalsePositiveConsequence = "fp", FalseNegativeConsequence = "fn",
        PolicyProfile = "balanced_routing", PromptVersion = "v1", Instructions = "is it?",
        Criteria = new NoulCriteria { True = "y", False = "n" },
        ReviewThreshold = 0.3, AcceptThreshold = 0.8, ActionOnYes = "a", ActionLabel = "l"
    };

    [Fact]
    public async Task SendsAllGatesAsNoulQuestionsInOneRequest_AndParsesProbabilities()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                """{"model":"jev-test","answers":{"g1":{"type":"noul","noul":0.91},"g2":{"type":"noul","noul":0.12}},"usage":{"input_tokens":10,"output_tokens":5}}""",
                Encoding.UTF8, "application/json")
        });
        var client = new JevGateClient(new HttpClient(handler), "jev-test");
        var result = (await client.AnalyzeAsync("hello", [Gate("g1"), Gate("g2")], "v1")).Result;
        Assert.All(result.Signals, s => Assert.True(s.Success));
        Assert.Equal(0.91, result.Signals.First(s => s.GateId == "g1").Probability);
        Assert.Equal(0.12, result.Signals.First(s => s.GateId == "g2").Probability);

        var questions = handler.LastRequest!.RootElement.GetProperty("questions");
        Assert.Equal(2, questions.EnumerateObject().Count());
        Assert.Equal("noul", questions.GetProperty("g1").GetProperty("type").GetString());
        Assert.Equal("hello", handler.LastRequest.RootElement.GetProperty("state").GetProperty("customerText").GetString());
        // criteria must be {true,false} objects per the noul schema
        Assert.Equal("y", questions.GetProperty("g1").GetProperty("criteria").GetProperty("true").GetString());
    }

    [Fact]
    public async Task HttpErrorFailsAllGatesWithoutThrowing()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.UnprocessableEntity) { Content = new StringContent("{}") });
        var client = new JevGateClient(new HttpClient(handler), "jev-test");
        var result = (await client.AnalyzeAsync("hello", [Gate("g1")], "v1")).Result;
        Assert.False(result.Signals.Single().Success);
        Assert.Equal("HTTP 422", result.Signals.Single().Error);
        Assert.Null(result.Signals.Single().Probability);
    }

    [Fact]
    public async Task OutOfRangeNoulFailsThatGate()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"model":"m","answers":{"g1":{"type":"noul","noul":1.5}},"usage":{"input_tokens":1,"output_tokens":1}}""", Encoding.UTF8, "application/json")
        });
        var client = new JevGateClient(new HttpClient(handler), "jev-test");
        var result = (await client.AnalyzeAsync("hello", [Gate("g1")], "v1")).Result;
        Assert.False(result.Signals.Single().Success);
        Assert.Equal("noul_out_of_range", result.Signals.Single().Error);
    }

    [Fact]
    public async Task RejectsInvalidInput()
    {
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") });
        var client = new JevGateClient(new HttpClient(handler), "m");
        await Assert.ThrowsAsync<ArgumentException>(() => client.AnalyzeAsync("  ", [Gate("g1")], "v1"));
        await Assert.ThrowsAsync<ArgumentException>(() => client.AnalyzeAsync(new string('x', 8001), [Gate("g1")], "v1"));
    }
}

public sealed class DiagnosticsTests
{
    private static SemanticGateDefinition Gate(string id) => new()
    {
        GateId = id, Category = "routing", BusinessGoal = "g", SemanticTarget = "t", SemanticInterior = "i",
        SemanticBoundaries = "b", FalsePositiveConsequence = "fp", FalseNegativeConsequence = "fn",
        PolicyProfile = "balanced_routing", PromptVersion = "v1", Instructions = "is it?",
        Criteria = new NoulCriteria { True = "y", False = "n" },
        ReviewThreshold = 0.3, AcceptThreshold = 0.8, ActionOnYes = "a", ActionLabel = "l"
    };

    [Fact]
    public async Task DiagnosticsCaptureExactRequestAndRawResponse_NoSecrets()
    {
        string? sentBody = null;
        var handler = new StubHandler(req =>
        {
            sentBody = req.RootElement.GetRawText();
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    "{\"model\":\"jev-x\",\"answers\":{\"g1\":{\"type\":\"noul\",\"noul\":0.5}},\"usage\":{\"input_tokens\":1,\"output_tokens\":1}}",
                    Encoding.UTF8, "application/json")
            };
        });
        var client = new JevGateClient(new HttpClient(handler), "jev-x");
        var outcome = await client.AnalyzeAsync("hello", [Gate("g1")], "v1");
        var d = outcome.Diagnostics!;
        Assert.NotNull(d);
        Assert.Equal("jev-x", d.ModelVersion);
        Assert.Equal("v1", d.GateSetVersion);
        Assert.Equal(["v1"], d.PromptVersions);
        Assert.Equal(1, d.JudgmentCount);
        Assert.Contains("\"type\":\"noul\"", d.RequestPayload);
        Assert.Contains("\"customerText\":\"hello\"", d.RequestPayload);
        Assert.DoesNotContain("Bearer", d.RequestPayload);       // no auth material in payload
        Assert.DoesNotContain("TYPESAFE", d.RequestPayload);
        Assert.Equal(sentBody, d.RequestPayload);                 // captured string IS the wire payload
        Assert.Contains("\"noul\":0.5", d.RawResponse);         // raw response preserved verbatim
        Assert.True(d.LatencyMs >= 0);
    }
}

public sealed class VersioningTests
{
    [Fact]
    public void GateVersionRecordsPromptVersion()
        => Assert.Equal("v1", new GateVersion("g", "v1").PromptVersion);
}
