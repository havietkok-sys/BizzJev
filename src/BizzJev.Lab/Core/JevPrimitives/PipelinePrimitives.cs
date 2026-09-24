using System.Text.Json.Nodes;

namespace BizzJev.Lab.Core.JevPrimitives;

// ---------- Frozen wire-value enums ----------
// Member names are the exact wire strings (see milestone2docs/API_CONTRACT.md).
// The frozen semantic specification (SEMANTIC_SPECIFICATION.md, pipeline-v1) fixes
// these values; do not rename members without a new semantic/policy version.

public enum PipelineStatus { ok, failed }

public enum OverallDisposition { technical_failure, human_review, policy_eligible }

public enum Priority { Normal, Elevated, Urgent }

public enum CancellationDisposition { NO, REVIEW, YES }

public enum RoutingCategory { Technical, Billing, Contract, Support, Other }

public enum ReviewReasonCode
{
    technical_failure, general_triage, routing_uncertain, urgency_uncertain, urgent_risk_review, cancellation_uncertain
}

public enum ActionType { human_review, urgent_attention, route_to_team, cancellation_handling }

public enum RuleId
{
    TECHNICAL_FAILURE, ROUTING_UNAVAILABLE, ROUTING_SELECTED, GENERAL_TRIAGE, ROUTING_REVIEW, ROUTING_ELIGIBLE,
    URGENCY_UNAVAILABLE, PRIORITY_NORMAL, PRIORITY_ELEVATED, PRIORITY_URGENT, URGENCY_REVIEW, URGENT_RISK,
    URGENT_RISK_REVIEW, CANCELLATION_UNAVAILABLE, CANCELLATION_NO, CANCELLATION_REVIEW, CANCELLATION_YES,
    OUTCOME_TECHNICAL_FAILURE, OUTCOME_HUMAN_REVIEW, OUTCOME_POLICY_ELIGIBLE
}

public enum PipelineErrorCategory { envelope, routing, urgency, cancellation }

/// Stable per-answer validation error codes. A structurally parsed but semantically
/// invalid answer keeps its siblings and fails the whole pipeline (never a fabricated value).
public static class AnswerErrorCodes
{
    public const string MissingAnswer = "missing_answer";
    public const string WrongType = "wrong_type";
    public const string InvalidChoiceKey = "invalid_choice_key";
    public const string InvalidProbabilities = "invalid_probabilities";
    public const string InvalidConfidence = "invalid_confidence";
    public const string SelectedNotMaximum = "selected_not_maximum";
    public const string InvalidScore = "invalid_score";
    public const string ScoreDistributionMismatch = "score_distribution_mismatch";
    public const string InvalidLegend = "invalid_legend";
    public const string InvalidProbability = "invalid_probability";
    public const string InvalidNumber = "invalid_number";
}

// ---------- Validated answers (one slot per primitive) ----------
// A slot is either valid (typed fields populated) or invalid (Error set, typed fields null).
// Absent/invalid answers stay null; they never become zero or false.

public sealed record ChoiceAnswerSlot
{
    /// Exact raw answer object as received (or as supplied for replay); omitted from
    /// serialized output when Technical View is disabled.
    public JsonNode? Raw { get; init; }
    public required bool Valid { get; init; }
    public string? Error { get; init; }
    public string? Selected { get; init; }
    public IReadOnlyDictionary<string, decimal>? Probabilities { get; init; }
    public decimal? Confidence { get; init; }
    /// Winner probability minus the largest other-option probability; computed by C# policy.
    public decimal? Margin { get; init; }
}

public sealed record ScoreAnswerSlot
{
    public JsonNode? Raw { get; init; }
    public required bool Valid { get; init; }
    public string? Error { get; init; }
    public decimal? Score { get; init; }
    public IReadOnlyDictionary<string, decimal>? Probabilities { get; init; }
    public IReadOnlyDictionary<string, string>? Legend { get; init; }
    public decimal? Confidence { get; init; }
}

public sealed record NoulAnswerSlot
{
    public JsonNode? Raw { get; init; }
    public required bool Valid { get; init; }
    public string? Error { get; init; }
    public decimal? Probability { get; init; }
}

public sealed class DecisionPipelineAnswers
{
    public required ChoiceAnswerSlot Routing { get; init; }
    public required ScoreAnswerSlot Urgency { get; init; }
    public required NoulAnswerSlot CancellationRequested { get; init; }
}
