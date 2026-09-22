using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using BizzJev.Lab;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BizzJev.Lab.Tests;

/// Endpoint handler tests executed directly (no running server). The fake TypeSafe transport is
/// a counting handler with FABRICATED API-shaped fixtures; zero live calls are made.
public sealed class DecisionPipelineEndpointTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    private static DecisionPipelineDefinitionConfig Config() =>
        DecisionPipelineConfig.Load(Path.Combine(AppContext.BaseDirectory, "config", "decision-pipeline.v1.json"));

    private static DecisionPipelineEndpointOptions Options(bool technicalView = true) => new()
    {
        ResolveApiKey = () => "test-key",
        Model = "jev-1.13.0",
        TimeoutSeconds = 60,
        EnableTechnicalView = technicalView,
        Json = Json
    };

    private static List<DecisionPipelineExample> Examples() =>
    [
        new() { Id = "dp-d01", Text = "synthetic example one", Synthetic = true },
        new() { Id = "dp-d03", Text = "synthetic example two", Synthetic = true }
    ];

    private static async Task<(int Status, JsonNode Body)> Execute(IResult result)
    {
        var ctx = new DefaultHttpContext();
        ctx.Response.Body = new MemoryStream();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(JsonSerializerOptions.Default);
        ctx.RequestServices = services.BuildServiceProvider();
        await result.ExecuteAsync(ctx);
        ctx.Response.Body.Position = 0;
        var body = await new StreamReader(ctx.Response.Body).ReadToEndAsync();
        return (ctx.Response.StatusCode, JsonNode.Parse(body)!);
    }

    private const string ValidResponseBody =
        """
        {
          "model": "jev-1.13.0",
          "answers": {
            "routing": { "type": "choice", "choice": "Technical", "probabilities": { "Technical": 0.9, "Billing": 0.1, "Contract": 0, "Support": 0, "Other": 0 }, "confidence": 0.92 },
            "urgency": { "type": "score", "score": 2, "legend": { "0": "L0", "1": "L1", "2": "L2", "3": "L3" }, "probabilities": { "0": 0, "1": 0, "2": 1, "3": 0 }, "confidence": 0.95 },
            "cancellationRequested": { "type": "noul", "noul": 0.05 }
          },
          "usage": { "input_tokens": 300, "output_tokens": 20 }
        }
        """;

    private static HttpResponseMessage Ok(string body) =>
        new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    // ---------- definition ----------

    [Fact]
    public async Task DefinitionServesVersionsDefaultsAndExamplesWithoutAnyKey()
    {
        var result = DecisionPipelineEndpoints.HandleDefinition(Config(), Examples(), Options());
        var (status, body) = await Execute(result);
        Assert.Equal(200, status);
        Assert.Equal("pipeline-v1", (string?)body["semanticVersion"]);
        Assert.Equal("pipeline-policy-v1", (string?)body["policyVersion"]);
        Assert.Equal("jev-1.13.0", (string?)body["model"]);
        Assert.Equal(0.80m, (decimal)body["policyDefaults"]!["routingConfidenceMin"]!);
        Assert.Equal(["dp-d01", "dp-d03"], body["examples"]!.AsArray().Select(e => (string?)e!["id"]));
        Assert.Equal("synthetic example one", (string?)body["examples"]![0]!["text"]);
        var questions = body["questions"]!.AsObject();
        Assert.Equal(["routing", "urgency", "cancellationRequested"], questions.Select(q => q.Key));
        // no expected labels or TEST text in the definition payload
        Assert.DoesNotContain("expected", body.ToJsonString());
    }

    [Fact]
    public async Task DefinitionIncludesTheEightShippedDesignExamples()
    {
        var dataset = JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "config", "decision-pipeline-cases.v1.json")))!.AsObject();
        var uiIds = dataset["uiExamples"]!.AsArray().Select(n => (string?)n).ToList();
        Assert.Equal(8, uiIds.Count);
        var designSplits = dataset["cases"]!.AsArray()
            .Where(c => uiIds.Contains((string?)c!["id"]))
            .Select(c => (string?)c!["split"]).ToList();
        Assert.All(designSplits, split => Assert.Equal("DESIGN", split));
    }

    // ---------- analyze ----------

    [Fact]
    public async Task AnalyzePerformsOneCallAndReturnsDecisionAndDiagnostics()
    {
        var handler = new CountingHandler(_ => Ok(ValidResponseBody));
        var result = await DecisionPipelineEndpoints.HandleAnalyzeAsync(
            """{ "customerText": "My internet is completely down." }""",
            Config(), Options().ResolveApiKey, _ => new DecisionPipelineClient(new HttpClient(handler), "jev-test"),
            enableTechnicalView: true, json: Json);
        var (status, body) = await Execute(result);
        Assert.Equal(200, status);
        Assert.Equal(1, handler.Attempts);
        Assert.Equal("jev-1.13.0", (string?)body["returnedModel"]);
        Assert.Equal("Technical", (string?)body["answers"]!["routing"]!["selected"]);
        Assert.Equal(0.8m, (decimal)body["answers"]!["routing"]!["margin"]!); // 0.9 - 0.1
        Assert.Equal("Elevated", (string?)body["decision"]!["proposedPriority"]);
        Assert.Equal("policy_eligible", (string?)body["decision"]!["overallDisposition"]);
        Assert.NotNull(body["diagnostics"]);
        Assert.Equal(1, (int)body["diagnostics"]!["outboundAttempts"]!);
        Assert.NotNull(body["answers"]!["routing"]!["raw"]);
        Assert.Contains("customerText", (string?)body["diagnostics"]!["requestPayload"]);
    }

    [Fact]
    public async Task AnalyzeHidesRawPayloadsWhenTechnicalViewIsDisabled()
    {
        var handler = new CountingHandler(_ => Ok(ValidResponseBody));
        var result = await DecisionPipelineEndpoints.HandleAnalyzeAsync(
            """{ "customerText": "My internet is completely down." }""",
            Config(), Options().ResolveApiKey, _ => new DecisionPipelineClient(new HttpClient(handler), "jev-test"),
            enableTechnicalView: false, json: Json);
        var (status, body) = await Execute(result);
        Assert.Equal(200, status);
        Assert.Null(body["diagnostics"]);
        Assert.Null(body["answers"]!["routing"]!["raw"]);
        Assert.Null(body["answers"]!["urgency"]!["raw"]);
        // the public decision stays usable
        Assert.Equal("Technical", (string?)body["answers"]!["routing"]!["selected"]);
        Assert.Equal("ok", (string?)body["decision"]!["pipelineStatus"]);
    }

    [Theory]
    [InlineData("""{ "customerText": "" }""", "invalid_input")]
    [InlineData("""{ "customerText": "   " }""", "invalid_input")]
    [InlineData("""not json""", "invalid_body")]
    [InlineData("""{ "something": "else" }""", "invalid_body")]
    public async Task AnalyzeRejectsBadInputWithZeroCalls(string requestBody, string expectedCode)
    {
        var handler = new CountingHandler(_ => Ok(ValidResponseBody));
        var result = await DecisionPipelineEndpoints.HandleAnalyzeAsync(
            requestBody, Config(), Options().ResolveApiKey, _ => new DecisionPipelineClient(new HttpClient(handler), "jev-test"),
            enableTechnicalView: true, json: Json);
        var (status, body) = await Execute(result);
        Assert.Equal(400, status);
        Assert.Equal(expectedCode, (string?)body["code"]);
        Assert.Equal(0, handler.Attempts);
    }

    [Fact]
    public async Task AnalyzeRejectsOversizeInputWithoutCallingJev()
    {
        var handler = new CountingHandler(_ => Ok(ValidResponseBody));
        var body = JsonSerializer.Serialize(new { customerText = new string('x', 8001) });
        var result = await DecisionPipelineEndpoints.HandleAnalyzeAsync(
            body, Config(), Options().ResolveApiKey, _ => new DecisionPipelineClient(new HttpClient(handler), "jev-test"),
            enableTechnicalView: true, json: Json);
        var (status, _) = await Execute(result);
        Assert.Equal(400, status);
        Assert.Equal(0, handler.Attempts);
    }

    [Fact]
    public async Task AnalyzeReportsMissingKeyAsServiceUnavailable()
    {
        var handler = new CountingHandler(_ => Ok(ValidResponseBody));
        var factoryCalled = false;
        var result = await DecisionPipelineEndpoints.HandleAnalyzeAsync(
            """{ "customerText": "hello" }""", Config(), () => null,
            _ => { factoryCalled = true; return new DecisionPipelineClient(new HttpClient(handler), "jev-test"); },
            enableTechnicalView: true, json: Json);
        var (status, body) = await Execute(result);
        Assert.Equal(503, status);
        Assert.Equal("missing_api_key", (string?)body["code"]);
        Assert.False(factoryCalled);
        Assert.Equal(0, handler.Attempts);
    }

    [Theory]
    [InlineData(429, 502, "upstream_http_error")]
    [InlineData(500, 502, "upstream_http_error")]
    public async Task AnalyzeMapsUpstreamHttpErrorsWithoutRetry(int upstream, int expected, string expectedCode)
    {
        var handler = new CountingHandler(_ => new HttpResponseMessage((HttpStatusCode)upstream) { Content = new StringContent("{}") });
        var result = await DecisionPipelineEndpoints.HandleAnalyzeAsync(
            """{ "customerText": "hello" }""", Config(), Options().ResolveApiKey,
            _ => new DecisionPipelineClient(new HttpClient(handler), "jev-test"),
            enableTechnicalView: true, json: Json);
        var (status, body) = await Execute(result);
        Assert.Equal(expected, status);
        Assert.Equal(expectedCode, (string?)body["code"]);
        Assert.Equal(1, handler.Attempts); // single attempt, no automatic retry
    }

    [Fact]
    public async Task AnalyzeMapsTransportFailureTo504()
    {
        var handler = new CountingHandler(_ => throw new HttpRequestException("boom"));
        var result = await DecisionPipelineEndpoints.HandleAnalyzeAsync(
            """{ "customerText": "hello" }""", Config(), Options().ResolveApiKey,
            _ => new DecisionPipelineClient(new HttpClient(handler), "jev-test"),
            enableTechnicalView: true, json: Json);
        var (status, body) = await Execute(result);
        Assert.Equal(504, status);
        Assert.Equal("upstream_unavailable", (string?)body["code"]);
        Assert.Equal(1, handler.Attempts);
    }

    [Fact]
    public async Task AnalyzeMarksInvalidRequiredAnswerAsTechnicalFailureNotSuccess()
    {
        var node = JsonNode.Parse(ValidResponseBody)!;
        ((JsonObject)node["answers"]!).Remove("urgency"); // Score missing: pipeline incomplete
        var handler = new CountingHandler(_ => Ok(node.ToJsonString()));
        var result = await DecisionPipelineEndpoints.HandleAnalyzeAsync(
            """{ "customerText": "hello" }""", Config(), Options().ResolveApiKey,
            _ => new DecisionPipelineClient(new HttpClient(handler), "jev-test"),
            enableTechnicalView: true, json: Json);
        var (status, body) = await Execute(result);
        Assert.Equal(200, status); // request succeeded; the PIPELINE failed
        Assert.Equal("failed", (string?)body["decision"]!["pipelineStatus"]);
        Assert.Equal("technical_failure", (string?)body["decision"]!["overallDisposition"]);
        Assert.False((bool)body["answers"]!["urgency"]!["valid"]!);
        Assert.Equal("missing_answer", (string?)body["answers"]!["urgency"]!["error"]);
        Assert.True((bool)body["answers"]!["routing"]!["valid"]!); // sibling stays visible
    }

    // ---------- replay ----------

    private const string ReplayBody =
        """
        {
          "semanticVersion": "pipeline-v1",
          "model": "jev-1.13.0",
          "routing": { "type": "choice", "choice": "Technical", "probabilities": { "Technical": 1, "Billing": 0, "Contract": 0, "Support": 0, "Other": 0 }, "confidence": 0.9 },
          "urgency": { "type": "score", "score": 2, "legend": { "0": "L0", "1": "L1", "2": "L2", "3": "L3" }, "probabilities": { "0": 0, "1": 0, "2": 1, "3": 0 }, "confidence": 0.95 },
          "cancellationRequested": { "type": "noul", "noul": 0.05 }
        }
        """;

    [Fact]
    public async Task ReplayRecomputesInCSharpWithZeroOutboundAttempts()
    {
        var result = DecisionPipelineEndpoints.HandleReplay(ReplayBody, Config(), enableTechnicalView: true, json: Json);
        var (status, body) = await Execute(result);
        Assert.Equal(200, status);
        Assert.Equal(0, (int)body["outboundAttempts"]!);
        Assert.Equal("pipeline-policy-v1", (string?)body["policyVersion"]);
        Assert.Equal("policy_eligible", (string?)body["decision"]!["overallDisposition"]);
        Assert.Equal("Technical", (string?)body["decision"]!["proposedTeam"]);
        Assert.Equal(0.80m, (decimal)body["policy"]!["routingConfidenceMin"]!); // exact settings echoed
    }

    [Fact]
    public async Task ReplayWithCustomThresholdsChangesOutcomeAndEchoesSettings()
    {
        var node = JsonNode.Parse(ReplayBody)!;
        node["policy"] = new JsonObject
        {
            ["routingConfidenceMin"] = 0.80, ["routingMarginMin"] = 0.20, ["urgencyConfidenceMin"] = 0.70,
            ["cancellationNoBelow"] = 0.02, ["cancellationYesAtLeast"] = 0.08,
            ["elevatedAtLeast"] = 1.50, ["urgentAtLeast"] = 2.50, ["urgentRiskAtLeast"] = 0.20
        };
        ((JsonObject)node["cancellationRequested"]!)["noul"] = 0.10;
        var result = DecisionPipelineEndpoints.HandleReplay(node.ToJsonString(), Config(), enableTechnicalView: true, json: Json);
        var (status, body) = await Execute(result);
        Assert.Equal(200, status);
        Assert.Equal("pipeline-policy-v1-custom", (string?)body["policyVersion"]);
        Assert.Equal("YES", (string?)body["decision"]!["cancellationDisposition"]); // 0.10 >= 0.08 under custom settings
        Assert.Equal(0.08m, (decimal)body["policy"]!["cancellationYesAtLeast"]!);
        Assert.Equal(0, (int)body["outboundAttempts"]!);
    }

    [Fact]
    public async Task ReplayRejectsVersionMismatchAndInvalidSettingsAndMissingModel()
    {
        var mismatch = JsonNode.Parse(ReplayBody)!;
        ((JsonObject)mismatch)["semanticVersion"] = "pipeline-v0";
        var (status1, body1) = await Execute(DecisionPipelineEndpoints.HandleReplay(mismatch.ToJsonString(), Config(), true, Json));
        Assert.Equal(400, status1);
        Assert.Equal("semantic_version_mismatch", (string?)body1["code"]);

        var missingSetting = JsonNode.Parse(ReplayBody)!;
        missingSetting["policy"] = new JsonObject { ["urgentAtLeast"] = 2.0 }; // wholesale replacement: all eight required
        var (status2, body2) = await Execute(DecisionPipelineEndpoints.HandleReplay(missingSetting.ToJsonString(), Config(), true, Json));
        Assert.Equal(400, status2);
        Assert.Equal("invalid_policy_settings", (string?)body2["code"]);

        var badRange = JsonNode.Parse(ReplayBody)!;
        badRange["policy"] = new JsonObject
        {
            ["routingConfidenceMin"] = 0.80, ["routingMarginMin"] = 0.20, ["urgencyConfidenceMin"] = 0.70,
            ["cancellationNoBelow"] = 0.90, ["cancellationYesAtLeast"] = 0.80,
            ["elevatedAtLeast"] = 1.50, ["urgentAtLeast"] = 2.50, ["urgentRiskAtLeast"] = 0.20
        };
        var (status3, body3) = await Execute(DecisionPipelineEndpoints.HandleReplay(badRange.ToJsonString(), Config(), true, Json));
        Assert.Equal(400, status3);
        Assert.Contains("cancellationNoBelow", (string?)body3["error"]);

        var noModel = JsonNode.Parse(ReplayBody)!;
        ((JsonObject)noModel).Remove("model");
        var (status4, body4) = await Execute(DecisionPipelineEndpoints.HandleReplay(noModel.ToJsonString(), Config(), true, Json));
        Assert.Equal(400, status4);
        Assert.Equal("invalid_body", (string?)body4["code"]);
    }

    [Fact]
    public async Task ReplayWithUnavailableAnswerReproducesTechnicalFailure()
    {
        var node = JsonNode.Parse(ReplayBody)!;
        ((JsonObject)node).Remove("urgency");
        var result = DecisionPipelineEndpoints.HandleReplay(node.ToJsonString(), Config(), true, Json);
        var (status, body) = await Execute(result);
        Assert.Equal(200, status);
        Assert.Equal("failed", (string?)body["decision"]!["pipelineStatus"]);
        Assert.Equal("technical_failure", (string?)body["decision"]!["overallDisposition"]);
        Assert.Equal(0, (int)body["outboundAttempts"]!); // no Jev fallback exists to complete it
    }

    [Fact]
    public async Task ReplaySemanticallyInvalidAnswerFailsLikeALiveRun()
    {
        var node = JsonNode.Parse(ReplayBody)!;
        ((JsonObject)node["routing"]!)["choice"] = "Priority"; // unknown category
        var result = DecisionPipelineEndpoints.HandleReplay(node.ToJsonString(), Config(), true, Json);
        var (status, body) = await Execute(result);
        Assert.Equal(200, status);
        Assert.Equal("failed", (string?)body["decision"]!["pipelineStatus"]);
        Assert.Equal("invalid_choice_key", (string?)body["answers"]!["routing"]!["error"]);
    }

    [Fact]
    public void ReplayHandlerHasNoJevDependencyAtAll()
    {
        // The replay handler's signature accepts no client factory and no key resolver: there is
        // no code path from replay to inference. This test exists so the seam cannot regress.
        var method = typeof(DecisionPipelineEndpoints).GetMethod(nameof(DecisionPipelineEndpoints.HandleReplay),
            System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic);
        Assert.NotNull(method);
        Assert.All(method!.GetParameters(), p => Assert.True(p.ParameterType != typeof(DecisionPipelineClient)));
    }
}
