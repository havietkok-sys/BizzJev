using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using BizzJev.Lab;
using Xunit;

namespace BizzJev.Lab.Tests;

/// Counts outbound attempts and captures the exact request body. All payloads below are
/// FABRICATED fixtures shaped like the documented TypeSafe API; no live response is involved.
public sealed class CountingHandler : HttpMessageHandler
{
    private readonly Func<string?, HttpResponseMessage> _respond;
    public int Attempts { get; private set; }
    public string? LastBody { get; private set; }

    public CountingHandler(Func<string?, HttpResponseMessage> respond) => _respond = respond;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        Attempts++;
        LastBody = request.Content == null ? null : await request.Content.ReadAsStringAsync(ct);
        return _respond(LastBody);
    }
}

public sealed class DecisionPipelineClientTests
{
    private static DecisionPipelineDefinitionConfig Config() =>
        DecisionPipelineConfig.Load(Path.Combine(AppContext.BaseDirectory, "config", "decision-pipeline.v1.json"));

    private static DecisionPipelineClient Client(CountingHandler handler) => new(new HttpClient(handler), "jev-test");

    private static HttpResponseMessage Json(string body, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private const string ValidBody =
        """
        {
          "model": "jev-1.13.0",
          "answers": {
            "routing": { "type": "choice", "choice": "Technical", "probabilities": { "Technical": 0.6, "Billing": 0.4, "Contract": 0, "Support": 0, "Other": 0 }, "confidence": 0.9 },
            "urgency": { "type": "score", "score": 1.5, "legend": { "0": "L0", "1": "L1", "2": "L2", "3": "L3" }, "probabilities": { "0": 0, "1": 0.5, "2": 0.5, "3": 0 }, "confidence": 0.8 },
            "cancellationRequested": { "type": "noul", "noul": 0.05 }
          },
          "usage": { "input_tokens": 296, "output_tokens": 20 },
          "future_additive_field": { "anything": true }
        }
        """;

    private static string WithAnswer(string id, string replacement)
    {
        var node = JsonNode.Parse(ValidBody)!;
        if (replacement is null) ((JsonObject)node["answers"]!).Remove(id);
        else ((JsonObject)node["answers"]!)[id] = JsonNode.Parse(replacement);
        return node.ToJsonString();
    }

    [Fact]
    public async Task SendsExactlyThreeMixedQuestionsInOneRequestOverSharedState()
    {
        var handler = new CountingHandler(_ => Json(ValidBody));
        var outcome = await Client(handler).AnalyzeAsync("hello world", Config());
        Assert.Equal(1, handler.Attempts);

        var request = JsonNode.Parse(handler.LastBody!)!.AsObject();
        Assert.Equal("jev-test", (string?)request["model"]);
        Assert.Equal("hello world", (string?)request["state"]!["customerText"]);
        var questions = request["questions"]!.AsObject();
        Assert.Equal(["routing", "urgency", "cancellationRequested"], questions.Select(q => q.Key));
        Assert.Equal("choice", (string?)questions["routing"]!["type"]);
        Assert.Equal("score", (string?)questions["urgency"]!["type"]);
        Assert.Equal("noul", (string?)questions["cancellationRequested"]!["type"]);
        // frozen criteria travel verbatim from the config
        var config = Config();
        Assert.Equal(config.RoutingCategories, questions["routing"]!["criteria"]!.AsObject().Select(c => c.Key));
        Assert.Equal(config.ScoreLevelDescriptions, questions["urgency"]!["criteria"]!.AsArray().Select(l => (string?)l));
        Assert.Equal(["false", "true"], questions["cancellationRequested"]!["criteria"]!.AsObject().Select(c => c.Key).OrderBy(k => k));
        // no credentials in the payload
        Assert.DoesNotContain("Bearer", outcome.Diagnostics.RequestPayload);
    }

    [Fact]
    public async Task ParsesAllThreePrimitivesWithExactDecimalsAndRawPreserved()
    {
        var handler = new CountingHandler(_ => Json(ValidBody));
        var outcome = await Client(handler).AnalyzeAsync("hello", Config());

        Assert.True(outcome.ResponseReceived);
        Assert.Null(outcome.FailureCode);
        Assert.Empty(outcome.EnvelopeErrors);
        Assert.Equal("jev-1.13.0", outcome.ReturnedModel);
        Assert.Equal(296, outcome.Usage!.InputTokens);
        Assert.Equal(20, outcome.Usage.OutputTokens);

        var routing = outcome.Answers.Routing;
        Assert.True(routing.Valid);
        Assert.Equal("Technical", routing.Selected);
        Assert.Equal(0.6m, routing.Probabilities!["Technical"]);
        Assert.Equal(0.4m, routing.Probabilities!["Billing"]);
        Assert.Equal(0.9m, routing.Confidence);
        Assert.Equal("Technical", (string?)routing.Raw!["choice"]);

        var urgency = outcome.Answers.Urgency;
        Assert.True(urgency.Valid);
        Assert.Equal(1.5m, urgency.Score);
        Assert.Equal(0.5m, urgency.Probabilities!["1"]);
        Assert.Equal(0.5m, urgency.Probabilities!["2"]);
        Assert.Equal("L2", urgency.Legend!["2"]);
        Assert.Equal(0.8m, urgency.Confidence);

        var cancellation = outcome.Answers.CancellationRequested;
        Assert.True(cancellation.Valid);
        Assert.Equal(0.05m, cancellation.Probability);

        Assert.Equal(1, outcome.Diagnostics.OutboundAttempts);
        Assert.Contains("\"routing\"", outcome.Diagnostics.RequestPayload);
        Assert.Contains("jev-1.13.0", outcome.Diagnostics.RawResponse);
    }

    [Theory]
    [InlineData("routing", """{ "type": "choice", "choice": "Priority", "probabilities": { "Technical": 1, "Billing": 0, "Contract": 0, "Support": 0, "Other": 0 }, "confidence": 0.9 }""", "invalid_choice_key")]
    [InlineData("routing", """{ "type": "noul", "noul": 0.5 }""", "wrong_type")]
    [InlineData("routing", """{ "type": "choice", "choice": "Technical", "probabilities": { "Technical": 0.5, "Billing": 0.4, "Contract": 0, "Support": 0, "Other": 0 }, "confidence": 0.9 }""", "invalid_probabilities")]
    [InlineData("routing", """{ "type": "choice", "choice": "Technical", "probabilities": { "Technical": 0.3, "Billing": 0.7, "Contract": 0, "Support": 0, "Other": 0 }, "confidence": 0.9 }""", "selected_not_maximum")]
    [InlineData("routing", """{ "type": "choice", "choice": "Technical", "probabilities": { "Technical": 1, "Billing": 0, "Contract": 0, "Support": 0, "Other": 0 }, "confidence": 1.2 }""", "invalid_confidence")]
    [InlineData("urgency", """{ "type": "score", "score": 3.5, "legend": { "0": "a", "1": "b", "2": "c", "3": "d" }, "probabilities": { "0": 0, "1": 0, "2": 0, "3": 1 }, "confidence": 0.8 }""", "invalid_score")]
    [InlineData("urgency", """{ "type": "score", "score": 3, "legend": { "0": "a", "1": "b", "2": "c" }, "probabilities": { "0": 0, "1": 0, "2": 0, "3": 1 }, "confidence": 0.8 }""", "invalid_legend")]
    [InlineData("urgency", """{ "type": "score", "score": 0, "legend": { "0": "a", "1": "b", "2": "c", "3": "d" }, "probabilities": { "0": 0, "1": 0.5, "2": 0.5, "3": 0 }, "confidence": 0.8 }""", "score_distribution_mismatch")]
    [InlineData("cancellationRequested", """{ "type": "noul", "noul": 1.5 }""", "invalid_probability")]
    [InlineData("cancellationRequested", """{ "type": "score", "score": 1 }""", "wrong_type")]
    public async Task InvalidAnswerIsMarkedInvalidWhileSiblingsStayValid(string id, string replacement, string expectedError)
    {
        var handler = new CountingHandler(_ => Json(WithAnswer(id, replacement)));
        var outcome = await Client(handler).AnalyzeAsync("hello", Config());
        if (id == "routing")
        {
            Assert.False(outcome.Answers.Routing.Valid);
            Assert.Equal(expectedError, outcome.Answers.Routing.Error);
            Assert.NotNull(outcome.Answers.Routing.Raw);
        }
        else if (id == "urgency")
        {
            Assert.False(outcome.Answers.Urgency.Valid);
            Assert.Equal(expectedError, outcome.Answers.Urgency.Error);
            Assert.NotNull(outcome.Answers.Urgency.Raw);
        }
        else
        {
            Assert.False(outcome.Answers.CancellationRequested.Valid);
            Assert.Equal(expectedError, outcome.Answers.CancellationRequested.Error);
            Assert.NotNull(outcome.Answers.CancellationRequested.Raw);
        }
        // the other two primitives remain valid
        if (id != "routing") Assert.True(outcome.Answers.Routing.Valid);
        if (id != "urgency") Assert.True(outcome.Answers.Urgency.Valid);
        if (id != "cancellationRequested") Assert.True(outcome.Answers.CancellationRequested.Valid);
    }

    [Fact]
    public async Task MissingAnswerKeepsSiblingsValid()
    {
        var handler = new CountingHandler(_ => Json(WithAnswer("urgency", null!)));
        var outcome = await Client(handler).AnalyzeAsync("hello", Config());
        Assert.False(outcome.Answers.Urgency.Valid);
        Assert.Equal(AnswerErrorCodes.MissingAnswer, outcome.Answers.Urgency.Error);
        Assert.Null(outcome.Answers.Urgency.Score);
        Assert.True(outcome.Answers.Routing.Valid);
        Assert.True(outcome.Answers.CancellationRequested.Valid);
    }

    [Fact]
    public async Task SilentlyRoundedNumberIsRejectedAsInvalidNumber()
    {
        var body = WithAnswer("cancellationRequested", """{ "type": "noul", "noul": 1e-30 }""");
        var handler = new CountingHandler(_ => Json(body));
        var outcome = await Client(handler).AnalyzeAsync("hello", Config());
        Assert.False(outcome.Answers.CancellationRequested.Valid);
        Assert.Equal(AnswerErrorCodes.InvalidNumber, outcome.Answers.CancellationRequested.Error);
    }

    [Fact]
    public async Task MissingModelIsAnEnvelopeErrorButAnswersRemainVisible()
    {
        var node = JsonNode.Parse(ValidBody)!;
        ((JsonObject)node).Remove("model");
        var handler = new CountingHandler(_ => Json(node.ToJsonString()));
        var outcome = await Client(handler).AnalyzeAsync("hello", Config());
        Assert.True(outcome.ResponseReceived);
        Assert.Null(outcome.ReturnedModel);
        Assert.Contains(outcome.EnvelopeErrors, e => e.Code == "missing_model");
        Assert.True(outcome.Answers.Routing.Valid);
        Assert.True(outcome.Answers.Urgency.Valid);
    }

    [Fact]
    public async Task NegativeUsageIsAnEnvelopeError()
    {
        var node = JsonNode.Parse(ValidBody)!;
        node["usage"] = new JsonObject { ["input_tokens"] = -1, ["output_tokens"] = 5 };
        var handler = new CountingHandler(_ => Json(node.ToJsonString()));
        var outcome = await Client(handler).AnalyzeAsync("hello", Config());
        Assert.Contains(outcome.EnvelopeErrors, e => e.Code == "invalid_usage");
        Assert.Null(outcome.Usage);
    }

    [Fact]
    public async Task MalformedResponseBodyIsAnEnvelopeError()
    {
        var handler = new CountingHandler(_ => Json("not json at all"));
        var outcome = await Client(handler).AnalyzeAsync("hello", Config());
        Assert.True(outcome.ResponseReceived);
        Assert.Contains(outcome.EnvelopeErrors, e => e.Code == "invalid_response_body");
        Assert.False(outcome.Answers.Routing.Valid);
    }

    [Theory]
    [InlineData(429)]
    [InlineData(500)]
    public async Task UpstreamHttpErrorFailsAfterExactlyOneAttempt(int status)
    {
        var handler = new CountingHandler(_ => Json("{}", (HttpStatusCode)status));
        var outcome = await Client(handler).AnalyzeAsync("hello", Config());
        Assert.False(outcome.ResponseReceived);
        Assert.Equal("upstream_http_error", outcome.FailureCode);
        Assert.Equal(1, handler.Attempts);
        Assert.Equal(1, outcome.Diagnostics.OutboundAttempts);
        Assert.False(outcome.Answers.Routing.Valid);
        Assert.Null(outcome.Usage);
    }

    [Fact]
    public async Task TransportFailureFailsAfterOneAttempt()
    {
        var handler = new CountingHandler(_ => throw new HttpRequestException("connection refused"));
        var outcome = await Client(handler).AnalyzeAsync("hello", Config());
        Assert.False(outcome.ResponseReceived);
        Assert.Equal("upstream_unavailable", outcome.FailureCode);
        Assert.Equal(1, handler.Attempts);
    }

    private sealed class DelayingHandler : HttpMessageHandler
    {
        public int Attempts { get; private set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Attempts++;
            await Task.Delay(10_000, ct); // HttpClient's own timeout cancels this token
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}", Encoding.UTF8, "application/json") };
        }
    }

    [Fact]
    public async Task TimeoutFailsAfterOneAttemptWithoutRetry()
    {
        var handler = new DelayingHandler();
        using var http = new HttpClient(handler) { Timeout = TimeSpan.FromMilliseconds(100) };
        var outcome = await new DecisionPipelineClient(http, "jev-test").AnalyzeAsync("hello", Config());
        Assert.False(outcome.ResponseReceived);
        Assert.Equal("timeout", outcome.FailureCode);
        Assert.Equal(1, handler.Attempts);
    }

    [Fact]
    public async Task CallerCancellationPropagatesAndIsNeverASuccess()
    {
        var handler = new CountingHandler(_ => Json(ValidBody));
        var cts = new CancellationTokenSource();
        cts.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => Client(handler).AnalyzeAsync("hello", Config(), cts.Token));
        Assert.Equal(0, handler.Attempts); // cancelled before dispatch: nothing sent, nothing counted as success
    }

    [Fact]
    public async Task AcceptedTextTravelsUnchangedIncludingWhitespaceAndSupplementaryCharacters()
    {
        var text = "  leading and trailing whitespace\t\r\n" + "emoji \U0001F680 and \U0001F600 chars  ";
        var handler = new CountingHandler(_ => Json(ValidBody));
        await Client(handler).AnalyzeAsync(text, Config());
        var sent = JsonNode.Parse(handler.LastBody!)!["state"]!["customerText"]!.GetValue<string>();
        Assert.Equal(text, sent); // decoded value preserved exactly; no trimming/normalization
    }

    [Theory]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData("   \t \r\n ", false)]
    [InlineData("x", true)]
    public async Task InputValidationUsesOriginalStringLength(string? text, bool valid)
    {
        var handler = new CountingHandler(_ => Json(ValidBody));
        var client = Client(handler);
        if (valid)
        {
            var outcome = await client.AnalyzeAsync(text!, Config());
            Assert.True(outcome.ResponseReceived);
            Assert.Equal(1, handler.Attempts);
        }
        else
        {
            await Assert.ThrowsAsync<ArgumentException>(() => client.AnalyzeAsync(text!, Config()));
            Assert.Equal(0, handler.Attempts); // zero outbound calls for rejected input
        }
    }

    [Fact]
    public void LengthBoundariesUseUtf16CodeUnitsOnTheOriginalString()
    {
        Assert.True(DecisionPipelineClient.IsValidCustomerText(new string('x', 8000)));
        Assert.False(DecisionPipelineClient.IsValidCustomerText(new string('x', 8001)));
        // whitespace padding counts toward the original length: 7,999 letters + space = 8,000, still non-blank
        Assert.True(DecisionPipelineClient.IsValidCustomerText(new string('x', 7999) + " "));
        // 4,000 emoji = 8,000 UTF-16 code units: accepted; 4,001 = 8,002: rejected
        var emoji = string.Concat(Enumerable.Repeat("\U0001F600", 4000));
        Assert.Equal(8000, emoji.Length);
        Assert.True(DecisionPipelineClient.IsValidCustomerText(emoji));
        Assert.False(DecisionPipelineClient.IsValidCustomerText(string.Concat(Enumerable.Repeat("\U0001F600", 4001))));
    }
}
