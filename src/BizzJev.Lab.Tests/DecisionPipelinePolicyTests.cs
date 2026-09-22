using BizzJev.Lab;
using Xunit;

namespace BizzJev.Lab.Tests;

/// Fabricated typed-answer fixtures exercising the C# policy directly (specification §7).
/// These are NOT Jev outputs; no customer text exists anywhere in these tests — the policy
/// function consumes only validated answers and thresholds.
public sealed class DecisionPipelinePolicyTests
{
    private static ChoiceAnswerSlot Choice(string selected, decimal technical, decimal billing, decimal contract, decimal support, decimal other, decimal confidence) => new()
    {
        Valid = true, Error = null, Selected = selected,
        Probabilities = new Dictionary<string, decimal> { ["Technical"] = technical, ["Billing"] = billing, ["Contract"] = contract, ["Support"] = support, ["Other"] = other },
        Confidence = confidence
    };

    private static ScoreAnswerSlot Score(decimal score, decimal p0, decimal p1, decimal p2, decimal p3, decimal confidence) => new()
    {
        Valid = true, Error = null, Score = score,
        Probabilities = new Dictionary<string, decimal> { ["0"] = p0, ["1"] = p1, ["2"] = p2, ["3"] = p3 },
        Legend = new Dictionary<string, string> { ["0"] = "L0", ["1"] = "L1", ["2"] = "L2", ["3"] = "L3" },
        Confidence = confidence
    };

    private static NoulAnswerSlot Noul(decimal p) => new() { Valid = true, Error = null, Probability = p };

    private static readonly ChoiceAnswerSlot DefaultChoice = Choice("Technical", 1, 0, 0, 0, 0, 1);
    private static readonly ScoreAnswerSlot DefaultScore = Score(2, 0, 0, 1, 0, 1);

    private static DecisionPipelineDecision Evaluate(
        ChoiceAnswerSlot? routingOverride = null,
        ScoreAnswerSlot? urgencyOverride = null,
        NoulAnswerSlot? cancellationOverride = null,
        string? model = "jev-1.13.0",
        IReadOnlyList<PipelineError>? envelopeErrors = null,
        DecisionPipelinePolicySettings? settings = null)
        => DecisionPipelinePolicy.Evaluate(new DecisionPipelinePolicyInput
        {
            Answers = new DecisionPipelineAnswers
            {
                Routing = routingOverride ?? DefaultChoice,
                Urgency = urgencyOverride ?? DefaultScore,
                CancellationRequested = cancellationOverride ?? Noul(0.05m)
            },
            ReturnedModel = model,
            EnvelopeErrors = envelopeErrors ?? [],
            Settings = settings ?? DecisionPipelinePolicySettings.Defaults
        });

    private static ChoiceAnswerSlot InvalidChoice(string error = "missing_answer")
        => new() { Valid = false, Error = error };
    private static ScoreAnswerSlot InvalidScore(string error = "missing_answer")
        => new() { Valid = false, Error = error };
    private static NoulAnswerSlot InvalidNoul(string error = "missing_answer")
        => new() { Valid = false, Error = error };

    // ---------- P01-P17 fabricated policy checks ----------

    [Fact]
    public void P01_DefaultsArePolicyEligibleWithOnlyRouteAction()
    {
        var d = Evaluate();
        Assert.Equal(PipelineStatus.ok, d.PipelineStatus);
        Assert.Equal("Technical", d.ProposedTeam);
        Assert.Equal(Priority.Elevated, d.ProposedPriority);
        Assert.Equal(CancellationDisposition.NO, d.CancellationDisposition);
        Assert.Equal(OverallDisposition.policy_eligible, d.OverallDisposition);
        Assert.Empty(d.ReviewReasons);
        var actionTypes = d.ProposedActions.Select(a => a.Type).ToList();
        Assert.Equal([ActionType.route_to_team], actionTypes);
        Assert.Contains(d.MatchedRuleIds, r => r == RuleId.ROUTING_SELECTED);
        Assert.Contains(d.MatchedRuleIds, r => r == RuleId.PRIORITY_ELEVATED);
        Assert.Contains(d.MatchedRuleIds, r => r == RuleId.CANCELLATION_NO);
        Assert.Contains(d.MatchedRuleIds, r => r == RuleId.OUTCOME_POLICY_ELIGIBLE);
    }

    [Fact]
    public void P02_HighCancellationProbabilityAddsCancellationHandlingOnly()
    {
        var d = Evaluate(cancellationOverride: Noul(0.94m));
        Assert.Equal(OverallDisposition.policy_eligible, d.OverallDisposition);
        Assert.Equal(CancellationDisposition.YES, d.CancellationDisposition);
        Assert.Equal([ActionType.route_to_team, ActionType.cancellation_handling], d.ProposedActions.Select(a => a.Type));
        Assert.Equal("Review and handle only the cancellation scope requested in the customer's message.",
            d.ProposedActions.Single(a => a.Type == ActionType.cancellation_handling).Label);
    }

    [Fact]
    public void P03_UncertainRoutingKeepsUrgentVisibleAndNeverRoutes()
    {
        var d = Evaluate(
            routingOverride: Choice("Technical", 0.55m, 0.45m, 0, 0, 0, 0.45m),
            urgencyOverride: Score(3, 0, 0, 0, 1, 1));
        Assert.Equal(Priority.Urgent, d.ProposedPriority);
        Assert.True(d.RoutingReviewRequired);
        Assert.Equal(OverallDisposition.human_review, d.OverallDisposition);
        Assert.Equal([ActionType.human_review, ActionType.urgent_attention], d.ProposedActions.Select(a => a.Type));
        var routing = d.ReviewReasons.Single(r => r.Code == ReviewReasonCode.routing_uncertain);
        Assert.Contains("0.45 < routingConfidenceMin 0.8", routing.Detail);   // confidence below minimum
        Assert.Contains("0.1 < routingMarginMin 0.2", routing.Detail);        // margin below minimum
    }

    [Fact]
    public void P04_SplitScoreKeepsElevatedMeanButFlagsUrgentTail()
    {
        var d = Evaluate(urgencyOverride: Score(1.5m, 0.5m, 0, 0, 0.5m, 0.40m));
        Assert.Equal(Priority.Elevated, d.ProposedPriority);
        Assert.True(d.UrgentRisk);
        Assert.True(d.UrgencyReviewRequired);
        Assert.Equal([ReviewReasonCode.urgency_uncertain, ReviewReasonCode.urgent_risk_review],
            d.ReviewReasons.Select(r => r.Code));
        Assert.Equal(OverallDisposition.human_review, d.OverallDisposition);
        Assert.Equal([ActionType.human_review, ActionType.urgent_attention, ActionType.route_to_team],
            d.ProposedActions.Select(a => a.Type));
    }

    [Fact]
    public void P05_MiddleCancellationBecomesReviewAndKeepsOtherOutputs()
    {
        var d = Evaluate(cancellationOverride: Noul(0.52m));
        Assert.Equal(CancellationDisposition.REVIEW, d.CancellationDisposition);
        Assert.Equal("Technical", d.ProposedTeam);
        Assert.Equal(Priority.Elevated, d.ProposedPriority);
        Assert.Equal(OverallDisposition.human_review, d.OverallDisposition);
        Assert.DoesNotContain(d.ProposedActions, a => a.Type == ActionType.cancellation_handling);
    }

    [Fact]
    public void P06_MissingScoreIsTechnicalFailureWithHumanReviewOnly()
    {
        var d = Evaluate(urgencyOverride: InvalidScore());
        Assert.Equal(PipelineStatus.failed, d.PipelineStatus);
        Assert.Equal(OverallDisposition.technical_failure, d.OverallDisposition);
        Assert.Null(d.ProposedPriority);
        Assert.Null(d.UrgentRisk);
        Assert.True(d.UrgencyReviewRequired);
        Assert.Equal([ActionType.human_review], d.ProposedActions.Select(a => a.Type));
        Assert.Equal("Technical", d.ProposedTeam); // valid sibling stays visible
        Assert.Contains(d.Errors, e => e.Category == PipelineErrorCategory.urgency && e.Code == "missing_answer");
    }

    [Fact]
    public void P07_MissingRoutingKeepsUrgentAndCancellationVisible()
    {
        var d = Evaluate(
            routingOverride: InvalidChoice(),
            urgencyOverride: Score(3, 0, 0, 0, 1, 1),
            cancellationOverride: Noul(0.94m));
        Assert.Equal(PipelineStatus.failed, d.PipelineStatus);
        Assert.Null(d.ProposedTeam);
        Assert.Equal(Priority.Urgent, d.ProposedPriority);
        Assert.Equal(CancellationDisposition.YES, d.CancellationDisposition);
        Assert.Equal([ActionType.human_review, ActionType.urgent_attention], d.ProposedActions.Select(a => a.Type));
        Assert.DoesNotContain(d.ProposedActions, a => a.Type == ActionType.cancellation_handling);
    }

    [Fact]
    public void P08_ConfidentOtherIsGeneralTriageNotARoute()
    {
        var d = Evaluate(routingOverride: Choice("Other", 0, 0, 0, 0, 1, 1));
        Assert.Equal(OverallDisposition.human_review, d.OverallDisposition);
        Assert.Equal("Other", d.ProposedTeam);
        Assert.True(d.RoutingReviewRequired);
        Assert.Contains(d.ReviewReasons, r => r.Code == ReviewReasonCode.general_triage);
        Assert.DoesNotContain(d.ProposedActions, a => a.Type == ActionType.route_to_team);
    }

    [Theory]
    [InlineData(0.80, false)]
    [InlineData(0.799999, true)]
    public void P09_RoutingConfidenceBoundaryIsInclusive(decimal confidence, bool review)
    {
        var d = Evaluate(routingOverride: Choice("Technical", 1, 0, 0, 0, 0, confidence));
        Assert.Equal(review, d.RoutingReviewRequired);
    }

    [Fact]
    public void P10_DecimalMarginArithmeticPassesExactlyAtBoundary()
    {
        var d = Evaluate(routingOverride: Choice("Technical", 0.60m, 0.40m, 0, 0, 0, 0.90m));
        Assert.False(d.RoutingReviewRequired); // 0.60 - 0.40 == 0.20 exactly in decimal arithmetic
        Assert.Contains(d.Explanations, e => e.RuleId == RuleId.ROUTING_ELIGIBLE && e.Text.Contains("margin 0.2 >= 0.2"));
    }

    [Theory]
    [InlineData(0.70, false)]
    [InlineData(0.699999, true)]
    public void P11_UrgencyConfidenceBoundaryIsInclusive(decimal confidence, bool review)
    {
        var d = Evaluate(urgencyOverride: Score(2, 0, 0, 1, 0, confidence));
        Assert.Equal(review, d.UrgencyReviewRequired);
    }

    [Theory]
    [InlineData(0.199999, CancellationDisposition.NO)]
    [InlineData(0.20, CancellationDisposition.REVIEW)]
    [InlineData(0.799999, CancellationDisposition.REVIEW)]
    [InlineData(0.80, CancellationDisposition.YES)]
    [InlineData(0, CancellationDisposition.NO)]
    [InlineData(1, CancellationDisposition.YES)]
    public void P12_CancellationBoundaries(decimal p, CancellationDisposition expected)
    {
        var d = Evaluate(cancellationOverride: Noul(p));
        Assert.Equal(expected, d.CancellationDisposition);
        if (expected == CancellationDisposition.REVIEW)
            Assert.Contains(d.ReviewReasons, r => r.Code == ReviewReasonCode.cancellation_uncertain);
    }

    [Fact]
    public void P13_ElevatedAtEqualityAndBelow()
    {
        var atBoundary = Evaluate(urgencyOverride: Score(1.50m, 0, 0.50m, 0.50m, 0, 0.80m));
        Assert.Equal(Priority.Elevated, atBoundary.ProposedPriority);
        var below = Evaluate(urgencyOverride: Score(1.49m, 0, 0.51m, 0.49m, 0, 0.80m));
        Assert.Equal(Priority.Normal, below.ProposedPriority);
    }

    [Fact]
    public void P14_UrgentAtEqualityWithoutUrgentRiskReview()
    {
        var d = Evaluate(urgencyOverride: Score(2.50m, 0, 0, 0.50m, 0.50m, 0.80m));
        Assert.Equal(Priority.Urgent, d.ProposedPriority);
        Assert.True(d.UrgentRisk);
        Assert.DoesNotContain(d.ReviewReasons, r => r.Code == ReviewReasonCode.urgent_risk_review);
        Assert.Equal(OverallDisposition.policy_eligible, d.OverallDisposition);
    }

    [Fact]
    public void P15_UrgentTailAtEqualityBlocksAutomaticEligibility()
    {
        var d = Evaluate(urgencyOverride: Score(0.60m, 0.80m, 0, 0, 0.20m, 0.80m));
        Assert.Equal(Priority.Normal, d.ProposedPriority);
        Assert.True(d.UrgentRisk);
        Assert.Contains(d.ReviewReasons, r => r.Code == ReviewReasonCode.urgent_risk_review);
        Assert.Equal(OverallDisposition.human_review, d.OverallDisposition);
    }

    [Fact]
    public void P16_TopTieReviewsEvenWithZeroMarginThreshold()
    {
        var settings = DecisionPipelinePolicySettings.Defaults with { RoutingMarginMin = 0m };
        var d = Evaluate(settings: settings, routingOverride: Choice("Technical", 0.50m, 0.50m, 0, 0, 0, 1));
        Assert.True(d.RoutingReviewRequired);
        var reason = d.ReviewReasons.Single(r => r.Code == ReviewReasonCode.routing_uncertain);
        Assert.Contains("top tie", reason.Detail);
        Assert.Equal("Technical", d.ProposedTeam); // never re-resolved in C#
    }

    [Fact]
    public void P17_MissingModelMetadataIsTechnicalFailureWithSignalsPreserved()
    {
        var d = Evaluate(model: null);
        Assert.Equal(PipelineStatus.failed, d.PipelineStatus);
        Assert.Equal(OverallDisposition.technical_failure, d.OverallDisposition);
        Assert.Equal("Technical", d.ProposedTeam);
        Assert.Equal(Priority.Elevated, d.ProposedPriority);
        Assert.Equal([ActionType.human_review], d.ProposedActions.Select(a => a.Type));
        Assert.Contains(d.Errors, e => e.Category == PipelineErrorCategory.envelope && e.Code == "missing_model");
    }

    // ---------- determinism, replay safety, invalid settings ----------

    [Fact]
    public void SameAnswersAndSettingsProduceIdenticalDecisions()
    {
        var input = new DecisionPipelinePolicyInput
        {
            Answers = new DecisionPipelineAnswers
            {
                Routing = Choice("Technical", 0.60m, 0.40m, 0, 0, 0, 0.90m),
                Urgency = Score(1.5m, 0.5m, 0, 0, 0.5m, 0.40m),
                CancellationRequested = Noul(0.52m)
            },
            ReturnedModel = "jev-1.13.0",
            EnvelopeErrors = [],
            Settings = DecisionPipelinePolicySettings.Defaults
        };
        var first = DecisionPipelinePolicy.Evaluate(input);
        var second = DecisionPipelinePolicy.Evaluate(input);
        Assert.Equal(first.MatchedRuleIds, second.MatchedRuleIds);
        Assert.Equal(first.ReviewReasons.Select(r => r.Code + "|" + r.Detail), second.ReviewReasons.Select(r => r.Code + "|" + r.Detail));
        Assert.Equal(first.ProposedActions.Select(a => a.Type + "|" + a.Label), second.ProposedActions.Select(a => a.Type + "|" + a.Label));
        // replay does not alter the answers
        Assert.Equal(0.60m, input.Answers.Routing.Probabilities!["Technical"]);
        Assert.Equal(1.5m, input.Answers.Urgency.Score);
        Assert.Equal(0.52m, input.Answers.CancellationRequested.Probability);
    }

    [Fact]
    public void TwoReplaysWithDifferentThresholdsDifferWithoutTouchingAnswers()
    {
        var answers = new DecisionPipelineAnswers
        {
            Routing = Choice("Technical", 1, 0, 0, 0, 0, 0.85m),
            Urgency = Score(2.45m, 0, 0, 0.55m, 0.45m, 0.9m),
            CancellationRequested = Noul(0.55m)
        };
        var withDefaults = DecisionPipelinePolicy.Evaluate(new DecisionPipelinePolicyInput
        {
            Answers = answers, ReturnedModel = "m", EnvelopeErrors = [], Settings = DecisionPipelinePolicySettings.Defaults
        });
        var withCustom = DecisionPipelinePolicy.Evaluate(new DecisionPipelinePolicyInput
        {
            Answers = answers, ReturnedModel = "m", EnvelopeErrors = [],
            Settings = DecisionPipelinePolicySettings.Defaults with { UrgentAtLeast = 2.40m, CancellationYesAtLeast = 0.50m }
        });
        Assert.Equal(Priority.Elevated, withDefaults.ProposedPriority);
        Assert.Equal(Priority.Urgent, withCustom.ProposedPriority);
        Assert.Equal(CancellationDisposition.REVIEW, withDefaults.CancellationDisposition);
        Assert.Equal(CancellationDisposition.YES, withCustom.CancellationDisposition);
        Assert.Equal(2.45m, answers.Urgency.Score); // answers unchanged by both evaluations
    }

    [Theory]
    [InlineData("cancellationNoBelow", 0.85)]
    [InlineData("elevatedAtLeast", 2.50)]
    [InlineData("urgentRiskAtLeast", 0)]
    [InlineData("routingConfidenceMin", 1.5)]
    public void InvalidSettingsAreRejectedExplicitly(string setting, double value)
    {
        var settings = setting switch
        {
            "cancellationNoBelow" => DecisionPipelinePolicySettings.Defaults with { CancellationNoBelow = (decimal)value },
            "elevatedAtLeast" => DecisionPipelinePolicySettings.Defaults with { ElevatedAtLeast = (decimal)value },
            "urgentRiskAtLeast" => DecisionPipelinePolicySettings.Defaults with { UrgentRiskAtLeast = (decimal)value },
            _ => DecisionPipelinePolicySettings.Defaults with { RoutingConfidenceMin = (decimal)value }
        };
        var ex = Assert.Throws<InvalidOperationException>(() => Evaluate(settings: settings));
        Assert.Contains("invalid decision pipeline policy settings", ex.Message);
    }

    [Fact]
    public void InvalidAnswerErrorCodesSurfaceInTheErrorsList()
    {
        var d = Evaluate(
            urgencyOverride: InvalidScore("score_distribution_mismatch"),
            cancellationOverride: InvalidNoul("invalid_number"));
        Assert.Equal(PipelineStatus.failed, d.PipelineStatus);
        Assert.Equal([PipelineErrorCategory.urgency, PipelineErrorCategory.cancellation], d.Errors.Select(e => e.Category));
        var reason = d.ReviewReasons.Single(r => r.Code == ReviewReasonCode.technical_failure);
        Assert.Contains("score_distribution_mismatch", reason.Detail);
        Assert.Contains("invalid_number", reason.Detail);
    }

    [Fact]
    public void ReasonOrderingIsFixedEvenWhenAddedInAnotherOrder()
    {
        var d = Evaluate(
            routingOverride: Choice("Other", 0, 0, 0, 0.40m, 0.60m, 0.50m), // general_triage + routing_uncertain
            urgencyOverride: Score(1.5m, 0.5m, 0, 0, 0.5m, 0.40m),           // urgency_uncertain + urgent_risk_review
            cancellationOverride: Noul(0.52m));                             // cancellation_uncertain
        Assert.Equal(
        [
            ReviewReasonCode.general_triage, ReviewReasonCode.routing_uncertain,
            ReviewReasonCode.urgency_uncertain, ReviewReasonCode.urgent_risk_review, ReviewReasonCode.cancellation_uncertain
        ], d.ReviewReasons.Select(r => r.Code));
    }
}
