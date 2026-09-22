using System.Text.Json;
using System.Text.Json.Nodes;
using BizzJev.Lab;
using Xunit;

namespace BizzJev.Lab.Tests;

public sealed class ExactJsonNumberTests
{
    [Theory]
    [InlineData("0", 0)]
    [InlineData("1", 1)]
    [InlineData("0.60", 0.60)]
    [InlineData("0.199999", 0.199999)]
    [InlineData("0.799999", 0.799999)]
    [InlineData("2.50", 2.50)]
    [InlineData("1e2", 100)]
    [InlineData("1.5e1", 15)]
    [InlineData("-0.5", -0.5)]
    [InlineData("0.1234567890123456789012345678", 0)] // 28 significant digits: accepted (value checked below)
    public void AcceptsExactlyRepresentableNumbers(string raw, decimal _)
    {
        Assert.True(ExactJsonNumber.TryGetDecimal(raw, out var value));
        // scale and digits survive: re-serializing must reproduce an equal decimal
        Assert.Equal(decimal.Parse(raw, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture), value);
    }

    [Theory]
    [InlineData("1e-30")]          // scale 30: decimal would round to zero
    [InlineData("1.1e-28")]        // scale 29: silent rounding
    [InlineData("0.12345678901234567890123456789")] // 29 significant digits: silent rounding
    [InlineData("1e30")]           // beyond decimal range
    [InlineData("NaN")]
    [InlineData("Infinity")]
    [InlineData("+1")]
    [InlineData("01")]
    [InlineData("1.")]
    [InlineData(".5")]
    [InlineData("0.1.2")]
    [InlineData("1e")]
    [InlineData("abc")]
    [InlineData("")]
    public void RejectsInexactOrMalformedNumbers(string raw)
        => Assert.False(ExactJsonNumber.TryGetDecimal(raw, out _));

    [Fact]
    public void BoundaryArithmeticIsExactInDecimal()
    {
        Assert.True(ExactJsonNumber.TryGetDecimal("0.60", out var a));
        Assert.True(ExactJsonNumber.TryGetDecimal("0.40", out var b));
        Assert.True(ExactJsonNumber.TryGetDecimal("0.20", out var margin));
        Assert.Equal(margin, a - b); // P10: 0.60 - 0.40 must equal the 0.20 boundary exactly
    }
}

public sealed class DecisionPipelineConfigTests
{
    private static string ConfigPath =>
        Path.Combine(AppContext.BaseDirectory, "config", "decision-pipeline.v1.json");

    private static JsonObject ValidConfig()
    {
        var root = (JsonObject)JsonNode.Parse(File.ReadAllText(ConfigPath))!;
        return root.DeepClone().AsObject();
    }

    [Fact]
    public void ShippedConfigLoadsAndMatchesFrozenSpecification()
    {
        var config = DecisionPipelineConfig.Load(ConfigPath);
        Assert.Equal("pipeline-v1", config.SemanticVersion);
        Assert.Equal("pipeline-policy-v1", config.PolicyVersion);
        Assert.Equal(["Technical", "Billing", "Contract", "Support", "Other"], config.RoutingCategories);
        Assert.Equal(4, config.ScoreLevelDescriptions.Count);
        Assert.True(config.ScoreLevelDescriptions.All(l => l.Length > 20));
        Assert.Equal(DecisionPipelinePolicySettings.Defaults, config.Policy);

        // the wire object carries the exact frozen questions, not a paraphrase
        var questions = (JsonObject)config.Questions;
        Assert.Equal(["routing", "urgency", "cancellationRequested"], questions.Select(q => q.Key));
        Assert.Equal("choice", (string?)questions["routing"]!["type"]);
        Assert.Equal("score", (string?)questions["urgency"]!["type"]);
        Assert.Equal("noul", (string?)questions["cancellationRequested"]!["type"]);
    }

    [Fact]
    public void MissingQuestionIsRejected()
    {
        var root = ValidConfig();
        ((JsonObject)root["questions"]!).Remove("urgency");
        var errors = DecisionPipelineConfig.Validate(root);
        Assert.Contains(errors, e => e.Contains("must contain 'urgency'"));
    }

    [Fact]
    public void UnexpectedQuestionIsRejected()
    {
        var root = ValidConfig();
        ((JsonObject)root["questions"]!)["extra"] = new JsonObject { ["type"] = "noul", ["instructions"] = "x `customerText`", ["criteria"] = new JsonObject { ["true"] = "a", ["false"] = "b" } };
        var errors = DecisionPipelineConfig.Validate(root);
        Assert.Contains(errors, e => e.Contains("unexpected 'extra'"));
    }

    [Fact]
    public void WrongQuestionTypeIsRejected()
    {
        var root = ValidConfig();
        ((JsonObject)root["questions"]!["urgency"]!)["type"] = "noul";
        var errors = DecisionPipelineConfig.Validate(root);
        Assert.Contains(errors, e => e.Contains("questions.urgency.type must be 'score'"));
    }

    [Fact]
    public void WrongCategoryOrderIsRejected()
    {
        var root = ValidConfig();
        var criteria = (JsonObject)root["questions"]!["routing"]!["criteria"]!;
        var billing = (JsonNode)criteria["Billing"]!.DeepClone();
        criteria.Remove("Billing");
        var rewritten = new JsonObject();
        rewritten["Billing"] = billing; // Billing first: violates the frozen order
        foreach (var c in criteria) rewritten[c.Key] = c.Value!.DeepClone();
        ((JsonObject)root["questions"]!["routing"]!)["criteria"] = rewritten;
        var errors = DecisionPipelineConfig.Validate(root);
        Assert.Contains(errors, e => e.Contains("criteria keys must be exactly [Technical, Billing, Contract, Support, Other]"));
    }

    [Fact]
    public void WrongScoreLevelCountIsRejected()
    {
        var root = ValidConfig();
        var levels = (JsonArray)root["questions"]!["urgency"]!["criteria"]!;
        levels.Add("extra level");
        var errors = DecisionPipelineConfig.Validate(root);
        Assert.Contains(errors, e => e.Contains("must have exactly 4 levels (0-3); got 5"));
    }

    [Theory]
    [InlineData("cancellationNoBelow", 0.85)]   // not strictly below cancellationYesAtLeast (0.80)
    [InlineData("cancellationYesAtLeast", 0.20)] // not strictly above cancellationNoBelow (0.20)
    [InlineData("elevatedAtLeast", 2.50)]        // not strictly below urgentAtLeast (2.50)
    [InlineData("urgentAtLeast", 1.50)]          // not strictly above elevatedAtLeast (1.50)
    [InlineData("urgentRiskAtLeast", 0)]         // must be > 0
    [InlineData("routingConfidenceMin", 1.5)]    // out of 0..1
    [InlineData("urgentAtLeast", 3.5)]           // out of 0..3
    public void OutOfRangeOrMisorderedThresholdsAreRejected(string setting, double value)
    {
        var root = ValidConfig();
        ((JsonObject)root["policy"]!)[setting] = value;
        var errors = DecisionPipelineConfig.Validate(root);
        Assert.NotEmpty(errors);
    }

    [Fact]
    public void MissingOrNonNumberPolicySettingIsRejected()
    {
        var root = ValidConfig();
        ((JsonObject)root["policy"]!).Remove("routingMarginMin");
        var errors = DecisionPipelineConfig.Validate(root);
        Assert.Contains(errors, e => e.Contains("policy.routingMarginMin is required"));

        var root2 = ValidConfig();
        ((JsonObject)root2["policy"]!)["routingMarginMin"] = "0.2";
        var errors2 = DecisionPipelineConfig.Validate(root2);
        Assert.Contains(errors2, e => e.Contains("policy.routingMarginMin must be a JSON number"));
    }

    [Fact]
    public void UnknownTopLevelAndPolicyFieldsAreRejected()
    {
        var root = ValidConfig();
        root["policies"] = new JsonObject();
        var errors = DecisionPipelineConfig.Validate(root);
        Assert.Contains(errors, e => e.Contains("unknown top-level field 'policies'"));

        var root2 = ValidConfig();
        ((JsonObject)root2["policy"]!)["marginMin"] = 0.2;
        var errors2 = DecisionPipelineConfig.Validate(root2);
        Assert.Contains(errors2, e => e.Contains("unknown policy setting 'marginMin'"));
    }

    [Fact]
    public void NonStringInstructionsOrCriteriaAreRejected()
    {
        var root = ValidConfig();
        ((JsonObject)root["questions"]!["routing"]!)["instructions"] = 42;
        var errors = DecisionPipelineConfig.Validate(root);
        Assert.Contains(errors, e => e.Contains("questions.routing.instructions must be a non-empty string"));
    }
}

public sealed class DecisionPipelineContractSerializationTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    [Fact]
    public void InvalidAnswerSlotsSerializeNullsNotDefaults()
    {
        var answers = new DecisionPipelineAnswers
        {
            Routing = new ChoiceAnswerSlot { Valid = false, Error = AnswerErrorCodes.MissingAnswer },
            Urgency = new ScoreAnswerSlot { Valid = false, Error = AnswerErrorCodes.MissingAnswer },
            CancellationRequested = new NoulAnswerSlot { Valid = false, Error = AnswerErrorCodes.WrongType }
        };
        var json = JsonSerializer.Serialize(answers, Web);
        Assert.Contains("\"selected\":null", json);
        Assert.Contains("\"probabilities\":null", json);
        Assert.Contains("\"confidence\":null", json);
        Assert.Contains("\"score\":null", json);
        Assert.Contains("\"probability\":null", json);
        Assert.DoesNotContain("\"selected\":0", json);
        Assert.DoesNotContain("\"probability\":0", json);
        Assert.Contains("\"error\":\"missing_answer\"", json);
    }

    [Fact]
    public void WireEnumNamesMatchFrozenContract()
    {
        var decision = new DecisionPipelineDecision
        {
            PipelineStatus = PipelineStatus.failed,
            OverallDisposition = OverallDisposition.technical_failure,
            RoutingReviewRequired = true,
            UrgencyReviewRequired = true,
            ReviewReasons = [new ReviewReason { Code = ReviewReasonCode.technical_failure, Detail = "missing_answer" }],
            ProposedActions = [new ProposedAction { Type = ActionType.human_review, Label = "Hand off to a person" }],
            MatchedRuleIds = [RuleId.TECHNICAL_FAILURE, RuleId.OUTCOME_TECHNICAL_FAILURE],
            Explanations = [new PolicyExplanation { RuleId = RuleId.TECHNICAL_FAILURE, Text = "urgency missing_answer" }],
            Errors = [new PipelineError { Category = PipelineErrorCategory.urgency, Code = AnswerErrorCodes.MissingAnswer, Detail = "answer absent" }]
        };
        var json = JsonSerializer.Serialize(decision, Web);
        Assert.Contains("\"pipelineStatus\":\"failed\"", json);
        Assert.Contains("\"overallDisposition\":\"technical_failure\"", json);
        Assert.Contains("\"code\":\"technical_failure\"", json);
        Assert.Contains("\"type\":\"human_review\"", json);
        Assert.Contains("\"ruleId\":\"TECHNICAL_FAILURE\"", json);
        Assert.Contains("\"category\":\"urgency\"", json);
        Assert.Contains("\"proposedPriority\":null", json);
        Assert.Contains("\"urgentRisk\":null", json);
        Assert.Contains("\"cancellationDisposition\":null", json);
        Assert.Contains("\"proposedTeam\":null", json);
    }

    [Fact]
    public void PriorityAndCancellationEnumValuesMatchFrozenContract()
    {
        var json = JsonSerializer.Serialize(new
        {
            priority = Priority.Elevated,
            cancellation = CancellationDisposition.REVIEW,
            team = RoutingCategory.Other
        }, Web);
        Assert.Contains("\"priority\":\"Elevated\"", json);
        Assert.Contains("\"cancellation\":\"REVIEW\"", json);
        Assert.Contains("\"team\":\"Other\"", json);
    }

    [Fact]
    public void DecimalValuesSurviveRoundTripExactly()
    {
        var payload = new DecisionPipelineReplayRequest
        {
            SemanticVersion = "pipeline-v1",
            Model = "jev-1.13.0",
            Routing = JsonNode.Parse("""{"type":"choice","choice":"Technical","probabilities":{"Technical":0.60,"Billing":0.40,"Contract":0,"Support":0,"Other":0},"confidence":0.90}"""),
            Urgency = JsonNode.Parse("""{"type":"score","score":1.50,"legend":{"0":"a","1":"b","2":"c","3":"d"},"probabilities":{"0":0,"1":0.50,"2":0.50,"3":0},"confidence":0.80}"""),
            CancellationRequested = JsonNode.Parse("""{"type":"noul","noul":0.199999}"""),
            Policy = new DecisionPipelinePolicySettings
            {
                RoutingConfidenceMin = 0.80m, RoutingMarginMin = 0m, UrgencyConfidenceMin = 0.70m,
                CancellationNoBelow = 0.20m, CancellationYesAtLeast = 0.80m,
                ElevatedAtLeast = 1.50m, UrgentAtLeast = 2.50m, UrgentRiskAtLeast = 0.20m
            }
        };
        var json = JsonSerializer.Serialize(payload, Web);
        var back = JsonSerializer.Deserialize<DecisionPipelineReplayRequest>(json, Web)!;
        Assert.Equal(payload.Routing!.ToJsonString(), back.Routing!.ToJsonString());
        Assert.Equal(1.50m, back.Policy!.ElevatedAtLeast);
        Assert.Equal(0.20m, back.Policy.CancellationNoBelow);
        // margin zero (P16) must survive the round trip as zero, not be nudged by float conversion
        Assert.Equal(0m, back.Policy.RoutingMarginMin);
        Assert.True(ExactJsonNumber.TryGetDecimal("0.60", out var a));
        Assert.True(ExactJsonNumber.TryGetDecimal("0.40", out var b));
        Assert.Equal(0.20m, a - b);
    }

    [Fact]
    public void DiagnosticsWithUnknownUsageSerializesNullUsage()
    {
        var d = new DecisionPipelineDiagnostics
        {
            SemanticVersion = "pipeline-v1",
            PolicyVersion = "pipeline-policy-v1",
            RequestPayload = "{}",
            RawResponse = null,
            ReturnedModel = null,
            ElapsedMs = 0m,
            OutboundAttempts = 1,
            Usage = null
        };
        var json = JsonSerializer.Serialize(d, Web);
        Assert.Contains("\"usage\":null", json);
        Assert.Contains("\"rawResponse\":null", json);
    }
}
