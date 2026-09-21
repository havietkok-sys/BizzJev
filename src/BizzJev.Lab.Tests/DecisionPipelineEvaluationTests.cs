using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using BizzJev.Lab;
using Xunit;

namespace BizzJev.Lab.Tests;

/// Hand-calculated metric checks over FABRICATED case-run fixtures (no Jev, no transport).
public sealed class DecisionPipelineMetricsTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    private static JsonObject Run(
        string id,
        string outcome = "completed",
        string? routingChoice = "Technical",
        decimal? score = 2m,
        decimal? noul = 0.05m,
        string? decisionDisposition = "NO",
        string overall = "policy_eligible",
        string? expectedRouting = "Technical",
        bool routingAmbiguous = false,
        int? expectedLevel = 2,
        int[]? expectedInterval = null,
        string expectedCancellation = "NO",
        string? reversalPair = null,
        decimal elapsedMs = 100m,
        long? inputTokens = 100)
    {
        // a run with any missing answer is a technical failure, never a complete recommendation
        var anyAnswerMissing = routingChoice is null || score is null || noul is null;
        var effectiveOutcome = anyAnswerMissing && outcome == "completed" ? "failed" : outcome;
        var effectiveOverall = anyAnswerMissing && overall == "policy_eligible" ? "technical_failure" : overall;
        var effectiveDisposition = anyAnswerMissing && decisionDisposition == "NO" ? null : decisionDisposition;
        return new JsonObject
        {
            ["caseId"] = id,
            ["outcome"] = effectiveOutcome,
            ["elapsedMs"] = elapsedMs,
            ["usage"] = inputTokens is null ? null : new JsonObject { ["inputTokens"] = inputTokens, ["outputTokens"] = 20 },
            ["reversalPair"] = reversalPair,
            ["expected"] = new JsonObject
            {
                ["routing"] = routingAmbiguous ? new JsonObject { ["ambiguous"] = true } : new JsonObject { ["category"] = expectedRouting },
                ["urgency"] = expectedInterval is int[] interval
                    ? new JsonObject { ["interval"] = new JsonArray(interval.Select(i => (JsonNode)i).ToArray()) }
                    : new JsonObject { ["level"] = expectedLevel },
                ["cancellation"] = new JsonObject { ["label"] = expectedCancellation }
            },
            ["answers"] = routingChoice is null && score is null && noul is null ? null : new JsonObject
            {
                ["routing"] = routingChoice is null
                    ? new JsonObject { ["valid"] = false, ["error"] = "missing_answer" }
                    : new JsonObject { ["valid"] = true, ["selected"] = routingChoice },
                ["urgency"] = score is null
                    ? new JsonObject { ["valid"] = false, ["error"] = "missing_answer" }
                    : new JsonObject { ["valid"] = true, ["score"] = score },
                ["cancellationRequested"] = noul is null
                    ? new JsonObject { ["valid"] = false, ["error"] = "missing_answer" }
                    : new JsonObject { ["valid"] = true, ["probability"] = noul }
            },
            ["decision"] = new JsonObject
            {
                ["overallDisposition"] = effectiveOverall,
                ["cancellationDisposition"] = effectiveDisposition
            }
        };
    }

    private static JsonNode Metrics(params JsonObject[] runs)
        => DecisionPipelineEvaluationMetrics.Compute(new JsonArray(runs), DecisionPipelinePolicySettings.Defaults);

    [Fact]
    public void RoutingAgreementAndConfusionExcludeAmbiguousAndInvalid()
    {
        var m = Metrics(
            Run("a", expectedRouting: "Technical", routingChoice: "Technical"),      // agree
            Run("b", expectedRouting: "Technical", routingChoice: "Billing"),        // disagree
            Run("c", expectedRouting: "Billing", routingChoice: "Billing"),          // agree
            Run("d", expectedRouting: "Technical", routingChoice: null),             // invalid answer: excluded
            Run("e", routingAmbiguous: true, routingChoice: "Technical"));           // ambiguous label: excluded
        var routing = m["primitiveLevel"]!["routing"]!.AsObject();
        Assert.Equal(3, (int)routing["determinateLabels"]!);
        Assert.Equal(2, (int)routing["agreement"]!);
        Assert.Equal(0.6667m, (decimal)routing["agreementRate"]!);
        Assert.Equal(1, (int)routing["invalidOrMissingRoutingAnswers"]!);
        Assert.Equal(["e"], routing["ambiguousLabelCaseIds"]!.AsArray().Select(n => (string?)n));
        var confusion = routing["confusionExpectedToReturned"]!.AsObject();
        Assert.Equal(1, (int)confusion["Technical"]!["Technical"]!);
        Assert.Equal(1, (int)confusion["Technical"]!["Billing"]!);
        Assert.Equal(1, (int)confusion["Billing"]!["Billing"]!);
    }

    [Fact]
    public void UrgencyMaeUsesPointLabelsAndIntervalErrorUsesDistanceToInterval()
    {
        var m = Metrics(
            Run("a", expectedLevel: 2, score: 1m),   // |1-2| = 1
            Run("b", expectedLevel: 0, score: 0m),   // 0
            Run("c", expectedLevel: 3, score: 2.5m), // 0.5 -> mean = 0.5
            Run("d", expectedLevel: 2, score: null), // invalid: excluded from MAE
            Run("e", expectedInterval: [1, 2], score: 2.7m), // 0.7 above interval
            Run("f", expectedInterval: [1, 2], score: 1.5m), // inside: 0 -> mean interval error = 0.35
            Run("g", expectedInterval: [1, 2], score: null)); // invalid: excluded
        var urgency = m["primitiveLevel"]!["urgency"]!.AsObject();
        Assert.Equal(3, (int)urgency["pointLabels"]!);
        Assert.Equal(0.5m, (decimal)urgency["meanAbsoluteError"]!);
        Assert.Equal(2, (int)urgency["intervalLabels"]!);
        Assert.Equal(0.35m, (decimal)urgency["intervalError"]!);
        Assert.Equal(2, (int)urgency["invalidOrMissingScoreAnswers"]!);
    }

    [Fact]
    public void BrierScoreUsesDefiniteLabelsWithValidAnswersAndDisclosesDenominator()
    {
        // p vs y: (0.9-1)^2 = 0.01 ; (0.1-0)^2 = 0.01 ; mean = 0.01
        var m = Metrics(
            Run("a", expectedCancellation: "YES", noul: 0.9m),
            Run("b", expectedCancellation: "NO", noul: 0.1m),
            Run("c", expectedCancellation: "UNCLEAR", noul: 0.5m),  // excluded (UNCLEAR)
            Run("d", expectedCancellation: "YES", noul: null));      // excluded (invalid)
        var raw = m["primitiveLevel"]!["cancellationRawNoul"]!.AsObject();
        Assert.Equal(3, (int)raw["definiteLabels"]!);           // a (YES), b (NO), d (YES); c is UNCLEAR
        Assert.Equal(2, (int)raw["brierDenominator"]!);          // d's Noul answer is invalid
        Assert.Equal(0.01m, (decimal)raw["brierScore"]!);
        Assert.Equal(1, (int)raw["excludedUnclear"]!);
        Assert.Equal(1, (int)raw["excludedInvalidAnswers"]!);
        Assert.Equal(["c"], raw["unclearCaseIds"]!.AsArray().Select(n => (string?)n));
    }

    [Fact]
    public void ThresholdedCancellationCountsReviewAsNotYes()
    {
        var m = Metrics(
            Run("a", expectedCancellation: "YES", noul: 0.95m, decisionDisposition: "YES"),   // TP
            Run("b", expectedCancellation: "YES", noul: 0.50m, decisionDisposition: "REVIEW", overall: "human_review"), // FN (+review)
            Run("c", expectedCancellation: "NO", noul: 0.90m, decisionDisposition: "YES", overall: "human_review"),    // FP
            Run("d", expectedCancellation: "NO", noul: 0.05m, decisionDisposition: "NO"));     // TN
        var policy = m["policyWorkflow"]!["cancellationThresholded"]!.AsObject();
        Assert.Equal(1, (int)policy["tp"]!);
        Assert.Equal(1, (int)policy["fp"]!);
        Assert.Equal(1, (int)policy["fn"]!);
        Assert.Equal(1, (int)policy["tn"]!);
        Assert.Equal(1, (int)policy["reviewDispositions"]!);
        Assert.Equal(0.5m, (decimal)policy["precision"]!);
        Assert.Equal(0.5m, (decimal)policy["recall"]!);
        var workflow = m["policyWorkflow"]!.AsObject();
        Assert.Equal(0.5m, (decimal)workflow["reviewRate"]!); // 2 of 4 human_review
        Assert.Equal(0m, (decimal)workflow["technicalFailureRate"]!);
    }

    [Fact]
    public void EmptyDenominatorsYieldNullNeverZero()
    {
        // one run with an interval urgency label and an UNCLEAR cancellation label:
        // no point labels -> null MAE; no definite cancellation labels -> null precision/recall/brier
        var m = Metrics(Run("a", expectedCancellation: "UNCLEAR", noul: 0.5m, expectedLevel: null, expectedInterval: [0, 3]));
        var raw = m["primitiveLevel"]!["cancellationRawNoul"]!.AsObject();
        Assert.Equal(0, (int)raw["definiteLabels"]!);
        Assert.Null(raw["brierScore"]);
        var policy = m["policyWorkflow"]!["cancellationThresholded"]!.AsObject();
        Assert.Null(policy["precision"]);
        Assert.Null(policy["recall"]);
        var urgency = m["primitiveLevel"]!["urgency"]!.AsObject();
        Assert.Null(urgency["meanAbsoluteError"]);   // no point labels: unavailable, not zero
        Assert.Equal(0m, (decimal)urgency["intervalError"]!); // interval label inside [0,3]: real zero
    }

    [Fact]
    public void AmbiguityCaptureSeparatesHumanReviewTechnicalFailureAndConfidentEligible()
    {
        var m = Metrics(
            Run("a", routingAmbiguous: true, overall: "human_review"),                 // ambiguous routing -> captured
            Run("b", expectedInterval: [1, 2], overall: "policy_eligible"),            // ambiguous urgency -> confident, reported
            Run("c", expectedCancellation: "UNCLEAR", overall: "technical_failure", outcome: "failed"), // -> captured via failure
            Run("d"));                                                                  // not ambiguous
        var capture = m["policyWorkflow"]!["ambiguityReviewCapture"]!.AsObject();
        Assert.Equal(["a", "b", "c"], capture["ambiguousCaseIds"]!.AsArray().Select(n => (string?)n));
        Assert.Equal(1, (int)capture["byOutcome"]!["human_review"]!);
        Assert.Equal(1, (int)capture["byOutcome"]!["policy_eligible"]!);
        Assert.Equal(1, (int)capture["confidentPolicyEligibleOnAmbiguous"]!);
        Assert.Equal(1, (int)capture["byOutcome"]!["technical_failure"]!);
    }

    [Fact]
    public void IncorrectAutomaticRecommendationsCountPerOutputErrors()
    {
        // accepted + correct / accepted + wrong routing / accepted + wrong urgency band
        // / accepted + wrong cancellation / human review (not a complete recommendation)
        var m = Metrics(
            Run("ok"),
            Run("badRoute", expectedRouting: "Billing", routingChoice: "Technical"),
            Run("badBand", expectedLevel: 3, score: 0m, noul: 0.05m, decisionDisposition: "NO"),
            Run("badCancel", expectedCancellation: "NO", noul: 0.9m, decisionDisposition: "YES"),
            Run("reviewed", overall: "human_review", decisionDisposition: "REVIEW"));
        var auto = m["policyWorkflow"]!["automaticCompleteRecommendations"]!.AsObject();
        Assert.Equal(4, (int)auto["accepted"]!);           // 4 policy_eligible runs
        Assert.Equal(3, (int)auto["incorrect"]!);          // badRoute, badBand, badCancel
        Assert.Equal(0.75m, (decimal)auto["incorrectRate"]!);
        Assert.Equal(1, (int)auto["perOutputErrors"]!["routing"]!);
        Assert.Equal(1, (int)auto["perOutputErrors"]!["urgencyBand"]!);
        Assert.Equal(1, (int)auto["perOutputErrors"]!["cancellation"]!);
        Assert.Equal(0.8m, (decimal)auto["coverageOfAttempted"]!); // 4 of 5 attempted
    }

    [Fact]
    public void ReversalPairsReportAgreementAndDeltas()
    {
        var m = Metrics(
            Run("p1a", reversalPair: "rp1", routingChoice: "Technical", score: 2m, noul: 0.1m),
            Run("p1b", reversalPair: "rp1", routingChoice: "Technical", score: 2.4m, noul: 0.3m),
            Run("solo"));
        var pairs = m["reversalPairs"]!.AsArray();
        Assert.Single(pairs);
        var row = pairs[0]!.AsObject();
        Assert.Equal("rp1", (string?)row["pair"]);
        Assert.True((bool)row["routingSameChoice"]!);
        Assert.Equal(0.4m, (decimal)row["urgencyScoreDelta"]!);
        Assert.Equal(0.2m, (decimal)row["noulDelta"]!);
    }

    [Fact]
    public void LatencyMedianMethodAndUnknownUsageAreExplicit()
    {
        var runs = new[] { 100m, 300m, 200m, 400m }.Select((ms, i) => Run("c" + i, elapsedMs: ms, inputTokens: i == 3 ? null : 50)).ToArray();
        var m = Metrics(runs);
        var exec = m["execution"]!.AsObject();
        Assert.Equal(4, (int)exec["latencyMsCount"]!);
        Assert.Equal(250m, (decimal)exec["latencyMedianMs"]!); // mean of 200 and 300 (even n)
        Assert.Null(exec["latencyP95Ms"]);                     // fewer than 20 observations
        Assert.Equal(150, (long)exec["totalInputTokens"]!);
        Assert.Equal(1, (int)exec["unknownUsageCount"]!);
        Assert.Contains("nearest-rank", (string?)exec["latencyMethod"]);
    }
}

/// Runner behavior with a fake transport and a temporary budget ledger: budget gating, stopping
// exactly at a ceiling smaller than the case set, failure consumption and cross-instance persistence.
public sealed class DecisionPipelineEvaluationRunnerTests
{
    private static DecisionPipelineDefinitionConfig Config() =>
        DecisionPipelineConfig.Load(Path.Combine(AppContext.BaseDirectory, "config", "decision-pipeline.v1.json"));

    private static DecisionPipelineCaseDataset Dataset() =>
        DecisionPipelineCaseDataset.Load(Path.Combine(AppContext.BaseDirectory, "config", "decision-pipeline-cases.v1.json"));

    private static HttpResponseMessage Ok(string body) =>
        new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private const string ValidBody =
        """
        {
          "model": "jev-1.13.0",
          "answers": {
            "routing": { "type": "choice", "choice": "Technical", "probabilities": { "Technical": 1, "Billing": 0, "Contract": 0, "Support": 0, "Other": 0 }, "confidence": 0.95 },
            "urgency": { "type": "score", "score": 2, "legend": { "0": "L0", "1": "L1", "2": "L2", "3": "L3" }, "probabilities": { "0": 0, "1": 0, "2": 1, "3": 0 }, "confidence": 0.9 },
            "cancellationRequested": { "type": "noul", "noul": 0.05 }
          },
          "usage": { "input_tokens": 100, "output_tokens": 10 }
        }
        """;

    private static (DecisionPipelineEvaluationRunner Runner, CountingHandler Handler, DecisionPipelineBudgetLedger Budget, string Dir) Make(
        int ceiling, int initialConsumedFileState, Func<string?, HttpResponseMessage> respond)
    {
        var dir = Path.Combine(Path.GetTempPath(), "dp-eval-test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        var budgetPath = Path.Combine(dir, "budget.json");
        if (initialConsumedFileState >= 0)
        {
            // pre-seed consumed attempts (simulating earlier runs) instead of the imported entry
            File.WriteAllText(budgetPath, $$"""
                { "ceiling": {{ceiling}}, "consumed": {{initialConsumedFileState}}, "entries": [] }
                """);
        }
        var budget = DecisionPipelineBudgetLedger.Load(budgetPath, ceiling);
        var handler = new CountingHandler(respond);
        var runner = new DecisionPipelineEvaluationRunner(dir, Config(), Dataset(), budget,
            () => new DecisionPipelineClient(new HttpClient(handler), "jev-test"), "jev-test", enableTechnicalView: false);
        return (runner, handler, budget, dir);
    }

    [Fact]
    public async Task ZeroBudgetRunsNothingAndStopsAtCeiling()
    {
        // ceiling 0 -> no dispatch at all, all cases unattempted, status stopped_budget
        var (runner, handler, _, dir) = Make(ceiling: 0, initialConsumedFileState: 0, _ => Ok(ValidBody));
        var run = await runner.RunSplitAsync("TEST");
        Assert.Equal("stopped_budget", run.Status);
        Assert.Equal(0, handler.Attempts);
        Assert.Equal(16, run.Unattempted);
        Assert.Equal(0, run.Attempted);
        Directory.Delete(dir, true);
    }

    [Fact]
    public async Task StopsExactlyAtACeilingSmallerThanTheCaseSet()
    {
        var (runner, handler, budget, dir) = Make(ceiling: 3, initialConsumedFileState: 0, _ => Ok(ValidBody));
        var run = await runner.RunSplitAsync("TEST"); // 16 cases, ceiling 3
        Assert.Equal("stopped_budget", run.Status);
        Assert.Equal(3, handler.Attempts);            // exactly at the ceiling
        Assert.Equal(3, run.Attempted);
        Assert.Equal(3, run.Completed);
        Assert.Equal(13, run.Unattempted);
        Assert.Equal(3, budget.Consumed);
        Directory.Delete(dir, true);
    }

    [Fact]
    public async Task FailedAttemptsStillConsumeAllowance()
    {
        var (runner, handler, budget, dir) = Make(ceiling: 2, initialConsumedFileState: 0,
            _ => new HttpResponseMessage(HttpStatusCode.TooManyRequests) { Content = new StringContent("{}") });
        var run = await runner.RunSplitAsync("TEST");
        Assert.Equal(2, handler.Attempts);
        Assert.Equal(2, run.Attempted);
        Assert.Equal(2, budget.Consumed);             // failures are not refunded
        Assert.Equal(0, run.Completed);               // every dispatched case failed at transport
        Assert.All(run.Cases.Where(c => c.Outcome != "unattempted"), c => Assert.Equal("failed", c.Outcome));
        Directory.Delete(dir, true);
    }

    [Fact]
    public async Task ResumedRunRespectsAlreadyConsumedAttemptsAcrossInstances()
    {
        var (runner1, handler1, _, dir) = Make(ceiling: 4, initialConsumedFileState: 0, _ => Ok(ValidBody));
        await runner1.RunSplitAsync("TEST");          // consumes 4 of ceiling 4
        // a NEW process/instance loads the same ledger file
        var handler2 = new CountingHandler(_ => Ok(ValidBody));
        var budget2 = DecisionPipelineBudgetLedger.Load(Path.Combine(dir, "budget.json"), 4);
        var runner2 = new DecisionPipelineEvaluationRunner(dir, Config(), Dataset(), budget2,
            () => new DecisionPipelineClient(new HttpClient(handler2), "jev-test"), "jev-test", false);
        var run2 = await runner2.RunSplitAsync("TEST");
        Assert.Equal(0, handler2.Attempts);           // nothing left: no silent reset of accounting
        Assert.Equal("stopped_budget", run2.Status);
        Assert.Equal(16, run2.Unattempted);
        Assert.Equal(4, budget2.Consumed);
        Directory.Delete(dir, true);
    }

    [Fact]
    public async Task RunFilesAreImmutablePerRunAndCaseCountingIsAccurate()
    {
        var (runner, handler, _, dir) = Make(ceiling: 1000, initialConsumedFileState: 0, _ => Ok(ValidBody));
        var run = await runner.RunSplitAsync("DESIGN");
        Assert.Equal("completed", run.Status);
        Assert.Equal(24, run.Attempted);
        Assert.Equal(24, run.Completed);
        Assert.Equal(0, run.Unattempted);
        Assert.Equal(24, handler.Attempts);           // one attempt per case, no retries
        var loaded = runner.LoadRun(run.Id);
        Assert.NotNull(loaded);
        Assert.Equal(24, loaded!.Attempted);
        Assert.Null(runner.LoadRun("../" + run.Id));  // path traversal rejected
        Assert.Null(runner.LoadRun(run.Id + ";drop"));
        Assert.Equal(40, Dataset().Cases.Count);      // dataset untouched by runs
        Directory.Delete(dir, true);
    }
}
