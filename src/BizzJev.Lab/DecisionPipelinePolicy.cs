using System.Globalization;

namespace BizzJev.Lab;

/// Pure input to the decision policy. Deliberately contains NO customer text: Jev owns semantic
/// inference; this function only combines already-validated typed answers with thresholds.
public sealed record DecisionPipelinePolicyInput
{
    public required DecisionPipelineAnswers Answers { get; init; }
    /// Model recorded for the run; null/blank means envelope metadata failure (P17).
    public required string? ReturnedModel { get; init; }
    public required IReadOnlyList<PipelineError> EnvelopeErrors { get; init; }
    public required DecisionPipelinePolicySettings Settings { get; init; }
}

/// Deterministic C# decision policy over the three validated judgments, implementing the frozen
/// rule table of SEMANTIC_SPECIFICATION.md §5.2-5.3 (pipeline-policy-v1). Pure function: no clock,
/// network, filesystem, randomness or input mutation. Invalid settings throw instead of clamping.
public static class DecisionPipelinePolicy
{
    /// Winner probability minus the largest other-option probability, in decimal.
    /// Single source for the margin used by both the policy rules and the response display.
    public static decimal? ComputeMargin(ChoiceAnswerSlot routing)
        => routing.Valid
            ? routing.Probabilities![routing.Selected!] - routing.Probabilities.Where(kv => kv.Key != routing.Selected).Max(kv => kv.Value)
            : null;

    public static DecisionPipelineDecision Evaluate(DecisionPipelinePolicyInput input)
    {
        var settingsErrors = input.Settings.Validate();
        if (settingsErrors.Count > 0)
            throw new InvalidOperationException($"invalid decision pipeline policy settings: {string.Join("; ", settingsErrors)}");

        var settings = input.Settings;
        var routing = input.Answers.Routing;
        var urgency = input.Answers.Urgency;
        var cancellation = input.Answers.CancellationRequested;

        // Rule 1 TECHNICAL_FAILURE: envelope/required-metadata failure or any missing/invalid
        // required answer. All sibling rules still evaluate so valid signals remain visible.
        var errors = new List<PipelineError>();
        foreach (var envelopeError in input.EnvelopeErrors) errors.Add(envelopeError);
        if (string.IsNullOrWhiteSpace(input.ReturnedModel))
            errors.Add(new PipelineError { Category = PipelineErrorCategory.envelope, Code = "missing_model", Detail = "run has no recorded model" });
        if (!routing.Valid)
            errors.Add(new PipelineError { Category = PipelineErrorCategory.routing, Code = routing.Error ?? AnswerErrorCodes.MissingAnswer, Detail = $"routing answer unavailable ({routing.Error ?? "unavailable"})" });
        if (!urgency.Valid)
            errors.Add(new PipelineError { Category = PipelineErrorCategory.urgency, Code = urgency.Error ?? AnswerErrorCodes.MissingAnswer, Detail = $"urgency answer unavailable ({urgency.Error ?? "unavailable"})" });
        if (!cancellation.Valid)
            errors.Add(new PipelineError { Category = PipelineErrorCategory.cancellation, Code = cancellation.Error ?? AnswerErrorCodes.MissingAnswer, Detail = $"cancellation answer unavailable ({cancellation.Error ?? "unavailable"})" });
        errors.Sort((a, b) => CategoryOrder(a.Category).CompareTo(CategoryOrder(b.Category))); // stable order: envelope, routing, urgency, cancellation
        var failed = errors.Count > 0;

        var ruleIds = new List<RuleId>();
        var explanations = new List<PolicyExplanation>();
        var reasons = new List<ReviewReason>(); // appended in the fixed frozen order at the end
        bool routingReview = false, urgencyReview = false;

        // Rules 2-5: routing
        string? team = null;
        decimal? margin = null;
        if (routing.Valid)
        {
            team = routing.Selected;
            var others = routing.Probabilities!.Where(kv => kv.Key != team).ToList();
            var maxOther = others.Max(kv => kv.Value);
            margin = DecisionPipelinePolicy.ComputeMargin(routing);
            var tied = routing.Probabilities![team!] == maxOther;
            ruleIds.Add(RuleId.ROUTING_SELECTED);
            explanations.Add(new PolicyExplanation
            {
                RuleId = RuleId.ROUTING_SELECTED,
                Text = $"selected {team}; confidence {Fmt(routing.Confidence!.Value)}; margin {Fmt(margin!.Value)}"
            });
            if (team == nameof(RoutingCategory.Other))
            {
                routingReview = true;
                ruleIds.Add(RuleId.GENERAL_TRIAGE);
                reasons.Add(new ReviewReason { Code = ReviewReasonCode.general_triage, Detail = $"Choice selected Other (confidence {Fmt(routing.Confidence!.Value)}); Other means general triage, not a department" });
                explanations.Add(new PolicyExplanation { RuleId = RuleId.GENERAL_TRIAGE, Text = "selected Other -> general triage for a human, even when confidence is high" });
            }
            var failedChecks = new List<string>();
            if (tied)
                failedChecks.Add($"top tie ({team} {Fmt(routing.Probabilities[team!])} = {others.First(kv => kv.Value == maxOther).Key} {Fmt(maxOther)})");
            if (routing.Confidence!.Value < settings.RoutingConfidenceMin)
                failedChecks.Add($"confidence {Fmt(routing.Confidence!.Value)} < routingConfidenceMin {Fmt(settings.RoutingConfidenceMin)}");
            if (margin < settings.RoutingMarginMin) // exact ties always review via the tie check above
                failedChecks.Add($"margin {Fmt(margin.Value)} < routingMarginMin {Fmt(settings.RoutingMarginMin)}");
            if (failedChecks.Count > 0)
            {
                routingReview = true;
                ruleIds.Add(RuleId.ROUTING_REVIEW);
                reasons.Add(new ReviewReason { Code = ReviewReasonCode.routing_uncertain, Detail = string.Join("; ", failedChecks) });
                explanations.Add(new PolicyExplanation { RuleId = RuleId.ROUTING_REVIEW, Text = string.Join("; ", failedChecks) });
            }
            else if (team != nameof(RoutingCategory.Other)) // ROUTING_ELIGIBLE is non-Other by definition
            {
                ruleIds.Add(RuleId.ROUTING_ELIGIBLE);
                explanations.Add(new PolicyExplanation
                {
                    RuleId = RuleId.ROUTING_ELIGIBLE,
                    Text = $"confidence {Fmt(routing.Confidence!.Value)} >= {Fmt(settings.RoutingConfidenceMin)} and margin {Fmt(margin.Value)} >= {Fmt(settings.RoutingMarginMin)}"
                });
            }
        }
        else
        {
            ruleIds.Add(RuleId.ROUTING_UNAVAILABLE);
            routingReview = true; // technical reason already covers the missing input
        }

        // Rules 6-9: urgency
        Priority? priority = null;
        bool? urgentRisk = null;
        if (urgency.Valid)
        {
            var score = urgency.Score!.Value;
            priority = score < settings.ElevatedAtLeast ? Priority.Normal
                : score < settings.UrgentAtLeast ? Priority.Elevated
                : Priority.Urgent;
            ruleIds.Add(priority switch
            {
                Priority.Normal => RuleId.PRIORITY_NORMAL,
                Priority.Elevated => RuleId.PRIORITY_ELEVATED,
                _ => RuleId.PRIORITY_URGENT
            });
            var interval = priority == Priority.Normal
                ? $"score {Fmt(score)} < elevatedAtLeast {Fmt(settings.ElevatedAtLeast)}"
                : priority == Priority.Elevated
                    ? $"score {Fmt(score)} >= elevatedAtLeast {Fmt(settings.ElevatedAtLeast)} and < urgentAtLeast {Fmt(settings.UrgentAtLeast)}"
                    : $"score {Fmt(score)} >= urgentAtLeast {Fmt(settings.UrgentAtLeast)}";
            explanations.Add(new PolicyExplanation { RuleId = priority switch { Priority.Normal => RuleId.PRIORITY_NORMAL, Priority.Elevated => RuleId.PRIORITY_ELEVATED, _ => RuleId.PRIORITY_URGENT }, Text = interval });

            if (urgency.Confidence!.Value < settings.UrgencyConfidenceMin)
            {
                urgencyReview = true;
                ruleIds.Add(RuleId.URGENCY_REVIEW);
                reasons.Add(new ReviewReason
                {
                    Code = ReviewReasonCode.urgency_uncertain,
                    Detail = $"confidence {Fmt(urgency.Confidence!.Value)} < urgencyConfidenceMin {Fmt(settings.UrgencyConfidenceMin)}"
                });
                explanations.Add(new PolicyExplanation
                {
                    RuleId = RuleId.URGENCY_REVIEW,
                    Text = $"confidence {Fmt(urgency.Confidence!.Value)} < {Fmt(settings.UrgencyConfidenceMin)}; distribution {DescribeDistribution(urgency.Probabilities!)}"
                });
            }

            var p3 = urgency.Probabilities!["3"];
            urgentRisk = p3 >= settings.UrgentRiskAtLeast;
            ruleIds.Add(RuleId.URGENT_RISK);
            explanations.Add(new PolicyExplanation
            {
                RuleId = RuleId.URGENT_RISK,
                Text = $"P(level 3) {Fmt(p3)} {(urgentRisk.Value ? ">=" : "<")} urgentRiskAtLeast {Fmt(settings.UrgentRiskAtLeast)} -> urgentRisk {urgentRisk.Value.ToString().ToLowerInvariant()}"
            });
            if (urgentRisk.Value && priority != Priority.Urgent)
            {
                urgencyReview = true;
                ruleIds.Add(RuleId.URGENT_RISK_REVIEW);
                reasons.Add(new ReviewReason
                {
                    Code = ReviewReasonCode.urgent_risk_review,
                    Detail = $"P(level 3) {Fmt(p3)} >= {Fmt(settings.UrgentRiskAtLeast)} while mean-derived priority is {priority}; priority is not silently promoted"
                });
                explanations.Add(new PolicyExplanation
                {
                    RuleId = RuleId.URGENT_RISK_REVIEW,
                    Text = $"urgent probability tail above threshold with non-Urgent mean priority ({priority}); review required, no silent promotion"
                });
            }
        }
        else
        {
            ruleIds.Add(RuleId.URGENCY_UNAVAILABLE);
            urgencyReview = true;
        }

        // Rule 10: cancellation
        CancellationDisposition? cancellationDisposition = null;
        if (cancellation.Valid)
        {
            var p = cancellation.Probability!.Value;
            cancellationDisposition = p < settings.CancellationNoBelow ? CancellationDisposition.NO
                : p >= settings.CancellationYesAtLeast ? CancellationDisposition.YES
                : CancellationDisposition.REVIEW;
            ruleIds.Add(cancellationDisposition switch
            {
                CancellationDisposition.NO => RuleId.CANCELLATION_NO,
                CancellationDisposition.REVIEW => RuleId.CANCELLATION_REVIEW,
                _ => RuleId.CANCELLATION_YES
            });
            var boundary = cancellationDisposition == CancellationDisposition.NO
                ? $"p {Fmt(p)} < cancellationNoBelow {Fmt(settings.CancellationNoBelow)}"
                : cancellationDisposition == CancellationDisposition.YES
                    ? $"p {Fmt(p)} >= cancellationYesAtLeast {Fmt(settings.CancellationYesAtLeast)}"
                    : $"p {Fmt(p)} >= cancellationNoBelow {Fmt(settings.CancellationNoBelow)} and < cancellationYesAtLeast {Fmt(settings.CancellationYesAtLeast)}";
            explanations.Add(new PolicyExplanation
            {
                RuleId = cancellationDisposition switch { CancellationDisposition.NO => RuleId.CANCELLATION_NO, CancellationDisposition.REVIEW => RuleId.CANCELLATION_REVIEW, _ => RuleId.CANCELLATION_YES },
                Text = $"{boundary} -> {cancellationDisposition}"
            });
            if (cancellationDisposition == CancellationDisposition.REVIEW)
            {
                reasons.Add(new ReviewReason
                {
                    Code = ReviewReasonCode.cancellation_uncertain,
                    Detail = $"p {Fmt(p)} is between cancellationNoBelow {Fmt(settings.CancellationNoBelow)} and cancellationYesAtLeast {Fmt(settings.CancellationYesAtLeast)}"
                });
            }
        }
        else
        {
            ruleIds.Add(RuleId.CANCELLATION_UNAVAILABLE); // null disposition: never a silent NO
        }

        // Rule 1 bookkeeping and Rule 11 outcome
        var status = failed ? PipelineStatus.failed : PipelineStatus.ok;
        if (failed)
        {
            ruleIds.Insert(0, RuleId.TECHNICAL_FAILURE);
            reasons.Insert(0, new ReviewReason
            {
                Code = ReviewReasonCode.technical_failure,
                Detail = errors.Count == 0 ? "pipeline failed" : string.Join("; ", errors.Select(e => $"{e.Category}: {e.Code}"))
            });
            explanations.Insert(0, new PolicyExplanation { RuleId = RuleId.TECHNICAL_FAILURE, Text = "required metadata or required answer missing/invalid; no complete automatic recommendation" });
        }
        reasons = ReasonOrder(reasons);
        var overall = status == PipelineStatus.failed ? OverallDisposition.technical_failure
            : reasons.Count > 0 ? OverallDisposition.human_review
            : OverallDisposition.policy_eligible;
        ruleIds.Add(overall switch
        {
            OverallDisposition.technical_failure => RuleId.OUTCOME_TECHNICAL_FAILURE,
            OverallDisposition.human_review => RuleId.OUTCOME_HUMAN_REVIEW,
            _ => RuleId.OUTCOME_POLICY_ELIGIBLE
        });
        explanations.Add(new PolicyExplanation
        {
            RuleId = overall switch { OverallDisposition.technical_failure => RuleId.OUTCOME_TECHNICAL_FAILURE, OverallDisposition.human_review => RuleId.OUTCOME_HUMAN_REVIEW, _ => RuleId.OUTCOME_POLICY_ELIGIBLE },
            Text = overall == OverallDisposition.policy_eligible
                ? "pipeline ok and no review reasons -> complete recommendation meets demo policy checks (not execution permission)"
                : overall == OverallDisposition.human_review
                    ? $"pipeline ok with review reasons ({string.Join(", ", reasons.Select(r => r.Code))}) -> human review"
                    : "pipeline failed -> technical failure and manual handling"
        });

        // Actions in the frozen order (all non-executing)
        var actions = new List<ProposedAction>();
        if (overall != OverallDisposition.policy_eligible)
        {
            var available = new List<string>();
            if (team is not null) available.Add($"proposed team {team}");
            if (priority is not null) available.Add($"proposed priority {priority}");
            actions.Add(new ProposedAction
            {
                Type = ActionType.human_review,
                Label = $"Hand off to a person for review before any action (reasons: {string.Join(", ", reasons.Select(r => r.Code))}{(available.Count > 0 ? "; " + string.Join("; ", available) : "; no proposed team/priority available")})"
            });
        }
        if (priority == Priority.Urgent || urgentRisk == true)
        {
            var parts = new List<string>();
            if (priority == Priority.Urgent) parts.Add("mean-derived priority is Urgent");
            if (urgentRisk == true) parts.Add($"urgent-risk tail P(level 3) {Fmt(urgency!.Probabilities!["3"])} >= {Fmt(settings.UrgentRiskAtLeast)}");
            actions.Add(new ProposedAction { Type = ActionType.urgent_attention, Label = $"Keep urgent attention visible: {string.Join(" and ", parts)}" });
        }
        if (status == PipelineStatus.ok && routing.Valid && !routingReview)
            actions.Add(new ProposedAction { Type = ActionType.route_to_team, Label = $"Propose routing to {team} for initial handling (proposed; not executed)" });
        if (status == PipelineStatus.ok && cancellationDisposition == CancellationDisposition.YES)
            actions.Add(new ProposedAction { Type = ActionType.cancellation_handling, Label = "Review and handle only the cancellation scope requested in the customer's message." });

        return new DecisionPipelineDecision
        {
            PipelineStatus = status,
            ProposedTeam = team,
            RoutingReviewRequired = routingReview,
            ProposedPriority = priority,
            UrgencyReviewRequired = urgencyReview,
            UrgentRisk = urgentRisk,
            CancellationDisposition = cancellationDisposition,
            OverallDisposition = overall,
            ReviewReasons = reasons,
            ProposedActions = actions,
            MatchedRuleIds = ruleIds,
            Explanations = explanations,
            Errors = errors
        };
    }

    private static int CategoryOrder(PipelineErrorCategory category) => category switch
    {
        PipelineErrorCategory.envelope => 0,
        PipelineErrorCategory.routing => 1,
        PipelineErrorCategory.urgency => 2,
        _ => 3
    };

    private static List<ReviewReason> ReasonOrder(List<ReviewReason> reasons) => reasons
        .OrderBy(r => r.Code switch
        {
            ReviewReasonCode.technical_failure => 0,
            ReviewReasonCode.general_triage => 1,
            ReviewReasonCode.routing_uncertain => 2,
            ReviewReasonCode.urgency_uncertain => 3,
            ReviewReasonCode.urgent_risk_review => 4,
            _ => 5
        })
        .ToList();

    private static string DescribeDistribution(IReadOnlyDictionary<string, decimal> probabilities)
        => string.Join(", ", probabilities.OrderBy(kv => kv.Key, StringComparer.Ordinal).Select(kv => $"{kv.Key}:{Fmt(kv.Value)}"));

    private static string Fmt(decimal value) => value.ToString("0.######", CultureInfo.InvariantCulture);
}
