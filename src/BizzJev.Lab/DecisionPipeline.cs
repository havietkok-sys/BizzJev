using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace BizzJev.Lab;

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

// ---------- Policy settings (decimal arithmetic, frozen boundaries) ----------

/// Demo policy thresholds. Comparisons are inclusive per the frozen specification:
/// review when confidence < minimum; NO when p < noBelow; YES when p >= yesAtLeast;
/// Elevated when score >= elevatedAtLeast and < urgentAtLeast; Urgent when score >= urgentAtLeast;
/// urgent risk when P(level 3) >= urgentRiskAtLeast. Never round before comparing.
public sealed record DecisionPipelinePolicySettings
{
    public required decimal RoutingConfidenceMin { get; init; }
    public required decimal RoutingMarginMin { get; init; }
    public required decimal UrgencyConfidenceMin { get; init; }
    public required decimal CancellationNoBelow { get; init; }
    public required decimal CancellationYesAtLeast { get; init; }
    public required decimal ElevatedAtLeast { get; init; }
    public required decimal UrgentAtLeast { get; init; }
    public required decimal UrgentRiskAtLeast { get; init; }

    public static readonly IReadOnlyList<string> SettingNames =
    [
        "routingConfidenceMin", "routingMarginMin", "urgencyConfidenceMin",
        "cancellationNoBelow", "cancellationYesAtLeast", "elevatedAtLeast", "urgentAtLeast", "urgentRiskAtLeast"
    ];

    public static DecisionPipelinePolicySettings Defaults { get; } = new()
    {
        RoutingConfidenceMin = 0.80m, RoutingMarginMin = 0.20m, UrgencyConfidenceMin = 0.70m,
        CancellationNoBelow = 0.20m, CancellationYesAtLeast = 0.80m,
        ElevatedAtLeast = 1.50m, UrgentAtLeast = 2.50m, UrgentRiskAtLeast = 0.20m
    };

    /// Returns every constraint violation; empty means the settings are usable.
    /// Values must already be finite decimals; invalid JSON numbers must be rejected by the reader.
    public IReadOnlyList<string> Validate()
    {
        var errors = new List<string>();
        void InRange(decimal value, decimal min, decimal max, bool minInclusive, bool maxInclusive, string name)
        {
            var lowOk = minInclusive ? value >= min : value > min;
            var highOk = maxInclusive ? value <= max : value < max;
            if (!lowOk || !highOk)
                errors.Add(string.Create(CultureInfo.InvariantCulture,
                    $"{name} must be {(minInclusive ? ">=" : ">")} {min} and {(maxInclusive ? "<=" : "<")} {max}; got {value}"));
        }
        InRange(RoutingConfidenceMin, 0m, 1m, true, true, "routingConfidenceMin");
        InRange(RoutingMarginMin, 0m, 1m, true, true, "routingMarginMin");
        InRange(UrgencyConfidenceMin, 0m, 1m, true, true, "urgencyConfidenceMin");
        InRange(CancellationNoBelow, 0m, 1m, true, false, "cancellationNoBelow");
        InRange(CancellationYesAtLeast, 0m, 1m, false, true, "cancellationYesAtLeast");
        if (CancellationNoBelow >= CancellationYesAtLeast)
            errors.Add(string.Create(CultureInfo.InvariantCulture,
                $"cancellationNoBelow ({CancellationNoBelow}) must be strictly below cancellationYesAtLeast ({CancellationYesAtLeast})"));
        InRange(ElevatedAtLeast, 0m, 3m, true, false, "elevatedAtLeast");
        InRange(UrgentAtLeast, 0m, 3m, false, true, "urgentAtLeast");
        if (ElevatedAtLeast >= UrgentAtLeast)
            errors.Add(string.Create(CultureInfo.InvariantCulture,
                $"elevatedAtLeast ({ElevatedAtLeast}) must be strictly below urgentAtLeast ({UrgentAtLeast})"));
        InRange(UrgentRiskAtLeast, 0m, 1m, false, true, "urgentRiskAtLeast");
        return errors;
    }
}

// ---------- Exact JSON numbers ----------

/// Reads JSON numbers as exact decimals. Policy arithmetic is frozen to decimal arithmetic on the
/// supplied JSON numbers; a number that decimal cannot represent exactly is rejected instead of
/// silently rounded, so 0.60 - 0.40 == 0.20 holds and unsupported precision cannot alter values.
public static class ExactJsonNumber
{
    public static bool TryGetDecimal(JsonElement element, out decimal value)
    {
        if (element.ValueKind != JsonValueKind.Number)
        {
            value = 0m;
            return false;
        }
        return TryGetDecimal(element.GetRawText(), out value);
    }

    public static bool TryGetDecimal(string? raw, out decimal value)
    {
        value = 0m;
        if (string.IsNullOrEmpty(raw) || raw.Length > 44) return false;
        var s = raw.AsSpan();
        var i = 0;
        if (s[i] == '-') i++;
        // integer part: '0' | [1-9][0-9]*
        if (i >= s.Length) return false;
        var intStart = i;
        if (s[i] == '0') i++;
        else if (s[i] is >= '1' and <= '9') { while (i < s.Length && s[i] is >= '0' and <= '9') i++; }
        else return false;
        if (i > intStart + 1 && s[intStart] == '0') return false; // leading zeros are not JSON numbers
        var intDigits = s[intStart..i];
        // fraction
        var fracDigits = ReadOnlySpan<char>.Empty;
        if (i < s.Length && s[i] == '.')
        {
            i++;
            var start = i;
            while (i < s.Length && s[i] is >= '0' and <= '9') i++;
            if (i == start) return false;
            fracDigits = s[start..i];
        }
        // exponent
        var exponent = 0;
        if (i < s.Length && (s[i] is 'e' or 'E'))
        {
            i++;
            var negativeExponent = false;
            if (i < s.Length && (s[i] is '+' or '-'))
            {
                negativeExponent = s[i] == '-';
                i++;
            }
            var start = i;
            while (i < s.Length && s[i] is >= '0' and <= '9') i++;
            if (i == start || !int.TryParse(s[start..i], NumberStyles.None, CultureInfo.InvariantCulture, out var exponentDigits)) return false;
            exponent = negativeExponent ? -exponentDigits : exponentDigits;
        }
        if (i != s.Length) return false;
        // exactness bounds for decimal: mantissa significant digits <= 28 and resulting scale <= 28
        var mantissa = string.Concat(intDigits, fracDigits);
        var significant = mantissa.TrimStart('0');
        if (significant.Length > 28) return false;
        var scale = fracDigits.Length - exponent;
        if (scale > 28) return false;
        return decimal.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out value);
    }
}

// ---------- Versioned configuration ----------

/// Parsed, validated decision-pipeline.v1.json. `Questions` keeps the exact frozen wire object so
/// the client serializes the normative question definitions without paraphrasing them.
public sealed class DecisionPipelineDefinitionConfig
{
    public required string SemanticVersion { get; init; }
    public required string PolicyVersion { get; init; }
    public required JsonNode Questions { get; init; }
    public required IReadOnlyList<string> RoutingCategories { get; init; }
    public required IReadOnlyList<string> ScoreLevelDescriptions { get; init; }
    public required DecisionPipelinePolicySettings Policy { get; init; }
}

public static class DecisionPipelineConfig
{
    public const int MinCustomerTextUtf16Length = 1;
    public const int MaxCustomerTextUtf16Length = 8000;
    /// Validation-only tolerances (response structure checks); never used in policy threshold comparisons.
    public const decimal DistributionSumTolerance = 0.00001m;
    public const decimal ScoreAgreementTolerance = 0.00001m;

    public static readonly string RoutingQuestionId = "routing";
    public static readonly string UrgencyQuestionId = "urgency";
    public static readonly string CancellationQuestionId = "cancellationRequested";
    public static readonly IReadOnlyList<string> RequiredQuestionIds = [RoutingQuestionId, UrgencyQuestionId, CancellationQuestionId];
    public static readonly IReadOnlyList<string> FrozenRoutingCategories = ["Technical", "Billing", "Contract", "Support", "Other"];
    public const int FrozenScoreLevelCount = 4;

    public static DecisionPipelineDefinitionConfig Load(string path)
    {
        if (!File.Exists(path)) throw new InvalidOperationException($"decision pipeline config not found: {path}");
        JsonNode? root;
        try { root = JsonNode.Parse(File.ReadAllText(path)); }
        catch (JsonException e) { throw new InvalidOperationException($"decision pipeline config is not valid JSON: {e.Message}"); }
        var errors = Validate(root);
        if (errors.Count > 0) throw new InvalidOperationException($"invalid decision pipeline config: {string.Join("; ", errors)}");
        return Build((JsonObject)root!);
    }

    /// Validates structure/types/order/thresholds. Returns every problem; empty list means valid.
    public static IReadOnlyList<string> Validate(JsonNode? root)
    {
        var errors = new List<string>();
        if (root is not JsonObject obj)
        {
            errors.Add("config root must be a JSON object");
            return errors;
        }
        foreach (var key in obj) 
            if (key.Key is not ("semanticVersion" or "policyVersion" or "questions" or "policy"))
                errors.Add($"unknown top-level field '{key.Key}'");
        _ = ReadNonEmptyString(obj, "semanticVersion", errors, required: true);
        _ = ReadNonEmptyString(obj, "policyVersion", errors, required: true);

        if (obj.TryGetPropertyValue("questions", out var questionsNode) && questionsNode is JsonObject questions)
        {
            var ids = questions.Select(q => q.Key).ToList();
            foreach (var missing in RequiredQuestionIds.Where(id => !ids.Contains(id)))
                errors.Add($"questions must contain '{missing}'");
            foreach (var extra in ids.Where(id => !RequiredQuestionIds.Contains(id)))
                errors.Add($"questions contains unexpected '{extra}'");
            ValidateChoiceQuestion(questions, RoutingQuestionId, errors);
            ValidateScoreQuestion(questions, UrgencyQuestionId, errors);
            ValidateNoulQuestion(questions, CancellationQuestionId, errors);
        }
        else errors.Add("questions must be an object");

        if (obj.TryGetPropertyValue("policy", out var policyNode))
        {
            if (policyNode is JsonObject policy)
            {
                var settings = ReadSettings(policy, errors);
                if (settings is not null) errors.AddRange(settings.Validate());
            }
            else errors.Add("policy must be an object");
        }
        else errors.Add("policy settings are required");
        return errors;
    }

    private static DecisionPipelineDefinitionConfig Build(JsonObject root)
    {
        var questions = (JsonObject)root["questions"]!;
        var routingCriteria = (JsonObject)questions[RoutingQuestionId]!["criteria"]!;
        var urgencyCriteria = (JsonArray)questions[UrgencyQuestionId]!["criteria"]!;
        return new DecisionPipelineDefinitionConfig
        {
            SemanticVersion = (string)root["semanticVersion"]!,
            PolicyVersion = (string)root["policyVersion"]!,
            Questions = questions.DeepClone(),
            RoutingCategories = routingCriteria.Select(c => c.Key).ToList(),
            ScoreLevelDescriptions = urgencyCriteria.Select(l => (string)l!).ToList(),
            Policy = ReadSettings((JsonObject)root["policy"]!, new List<string>())!
        };
    }

    private static void ValidateChoiceQuestion(JsonObject questions, string id, List<string> errors)
    {
        if (questions[id] is not JsonObject q)
        {
            errors.Add($"questions.{id} must be an object");
            return;
        }
        if ((string?)q["type"] != "choice") errors.Add($"questions.{id}.type must be 'choice'");
        ValidateInstructions(q, id, errors);
        if (q["criteria"] is not JsonObject criteria)
        {
            errors.Add($"questions.{id}.criteria must be an object of category descriptions");
            return;
        }
        var keys = criteria.Select(c => c.Key).ToList();
        if (!keys.SequenceEqual(FrozenRoutingCategories))
            errors.Add($"questions.{id}.criteria keys must be exactly [{string.Join(", ", FrozenRoutingCategories)}] in order; got [{string.Join(", ", keys)}]");
        foreach (var c in criteria)
            if (!IsNonEmptyString(c.Value))
                errors.Add($"questions.{id}.criteria.{c.Key} must be a non-empty string");
    }

    private static void ValidateScoreQuestion(JsonObject questions, string id, List<string> errors)
    {
        if (questions[id] is not JsonObject q)
        {
            errors.Add($"questions.{id} must be an object");
            return;
        }
        if ((string?)q["type"] != "score") errors.Add($"questions.{id}.type must be 'score'");
        ValidateInstructions(q, id, errors);
        if (q["criteria"] is not JsonArray levels)
        {
            errors.Add($"questions.{id}.criteria must be an ordered array of level descriptions");
            return;
        }
        if (levels.Count != FrozenScoreLevelCount)
            errors.Add($"questions.{id}.criteria must have exactly {FrozenScoreLevelCount} levels (0-3); got {levels.Count}");
        for (var i = 0; i < levels.Count; i++)
            if (!IsNonEmptyString(levels[i]))
                errors.Add($"questions.{id}.criteria[{i}] must be a non-empty string");
    }

    private static void ValidateNoulQuestion(JsonObject questions, string id, List<string> errors)
    {
        if (questions[id] is not JsonObject q)
        {
            errors.Add($"questions.{id} must be an object");
            return;
        }
        if ((string?)q["type"] != "noul") errors.Add($"questions.{id}.type must be 'noul'");
        ValidateInstructions(q, id, errors);
        if (q["criteria"] is not JsonObject criteria)
        {
            errors.Add($"questions.{id}.criteria must be an object with true/false descriptions");
            return;
        }
        var keys = criteria.Select(c => c.Key).OrderBy(k => k).ToList();
        if (keys is not ["false", "true"])
            errors.Add($"questions.{id}.criteria keys must be exactly 'true' and 'false'; got [{string.Join(", ", criteria.Select(c => c.Key))}]");
        foreach (var c in criteria)
            if (!IsNonEmptyString(c.Value))
                errors.Add($"questions.{id}.criteria.{c.Key} must be a non-empty string");
    }

    private static bool IsNonEmptyString(JsonNode? node)
        => node is JsonValue v && v.GetValueKind() == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetValue<string>());

    private static void ValidateInstructions(JsonObject question, string id, List<string> errors)
    {
        if (question["instructions"] is not JsonValue instructions || instructions.GetValueKind() != JsonValueKind.String)
        {
            errors.Add($"questions.{id}.instructions must be a non-empty string");
            return;
        }
        var text = instructions.GetValue<string>();
        if (string.IsNullOrWhiteSpace(text))
            errors.Add($"questions.{id}.instructions must be a non-empty string");
        else if (!text.Contains("customerText"))
            errors.Add($"questions.{id}.instructions must reference the shared state field 'customerText'");
    }

    /// Reads the eight policy settings as exact decimals (all required; unknown fields rejected).
    /// Also used by the replay endpoint for caller-supplied settings.
    internal static DecisionPipelinePolicySettings? ReadSettings(JsonObject policy, List<string> errors)
    {
        var local = new List<string>();
        foreach (var key in policy)
            if (!DecisionPipelinePolicySettings.SettingNames.Contains(key.Key))
                local.Add($"unknown policy setting '{key.Key}'");
        foreach (var name in DecisionPipelinePolicySettings.SettingNames)
            if (!policy.ContainsKey(name)) local.Add($"policy.{name} is required");
        if (local.Count > 0)
        {
            errors.AddRange(local);
            return null;
        }
        decimal Read(string name)
        {
            if (policy[name] is not JsonValue value || value.GetValueKind() != JsonValueKind.Number)
            {
                local.Add($"policy.{name} must be a JSON number");
                return 0m;
            }
            if (!ExactJsonNumber.TryGetDecimal(value.ToJsonString(), out var parsed))
            {
                local.Add($"policy.{name} is not an exactly representable decimal: {value.ToJsonString()}");
                return 0m;
            }
            return parsed;
        }
        var settings = new DecisionPipelinePolicySettings
        {
            RoutingConfidenceMin = Read("routingConfidenceMin"),
            RoutingMarginMin = Read("routingMarginMin"),
            UrgencyConfidenceMin = Read("urgencyConfidenceMin"),
            CancellationNoBelow = Read("cancellationNoBelow"),
            CancellationYesAtLeast = Read("cancellationYesAtLeast"),
            ElevatedAtLeast = Read("elevatedAtLeast"),
            UrgentAtLeast = Read("urgentAtLeast"),
            UrgentRiskAtLeast = Read("urgentRiskAtLeast")
        };
        if (local.Count > 0)
        {
            errors.AddRange(local);
            return null;
        }
        return settings;
    }

    private static string? ReadNonEmptyString(JsonObject obj, string name, List<string> errors, bool required)
    {
        if (!obj.TryGetPropertyValue(name, out var node))
        {
            if (required) errors.Add($"{name} is required");
            return null;
        }
        if (node is not JsonValue value || value.GetValueKind() != JsonValueKind.String || string.IsNullOrWhiteSpace(value.GetValue<string>()))
        {
            errors.Add($"{name} must be a non-empty string");
            return null;
        }
        return value.GetValue<string>();
    }
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

// ---------- Decision tuple (deterministic C# policy output) ----------

public sealed record ReviewReason
{
    public required ReviewReasonCode Code { get; init; }
    /// Observed values and thresholds only; never model-generated text.
    public required string Detail { get; init; }
}

public sealed record ProposedAction
{
    public required ActionType Type { get; init; }
    /// Non-executing description of the proposed handling.
    public required string Label { get; init; }
}

public sealed record PolicyExplanation
{
    public required RuleId RuleId { get; init; }
    /// Deterministic comparison that matched, with observed value(s) and threshold(s).
    public required string Text { get; init; }
}

public sealed record PipelineError
{
    public required PipelineErrorCategory Category { get; init; }
    public required string Code { get; init; }
    public required string Detail { get; init; }
}

public sealed class DecisionPipelineDecision
{
    /// Wire name `pipelineStatus`: technical validity of the pipeline (`ok`/`failed`),
    /// distinct from `overallDisposition` (policy handling).
    public required PipelineStatus PipelineStatus { get; init; }
    public string? ProposedTeam { get; init; }
    public required bool RoutingReviewRequired { get; init; }
    public Priority? ProposedPriority { get; init; }
    public required bool UrgencyReviewRequired { get; init; }
    public bool? UrgentRisk { get; init; }
    public CancellationDisposition? CancellationDisposition { get; init; }
    public required OverallDisposition OverallDisposition { get; init; }
    /// Fixed order: technical_failure, general_triage, routing_uncertain, urgency_uncertain, urgent_risk_review, cancellation_uncertain.
    public required IReadOnlyList<ReviewReason> ReviewReasons { get; init; }
    public required IReadOnlyList<ProposedAction> ProposedActions { get; init; }
    public required IReadOnlyList<RuleId> MatchedRuleIds { get; init; }
    public required IReadOnlyList<PolicyExplanation> Explanations { get; init; }
    /// Structured failure details in stable order: envelope, routing, urgency, cancellation.
    public required IReadOnlyList<PipelineError> Errors { get; init; }
}

// ---------- Usage / diagnostics ----------

public sealed record UsageSnapshot
{
    public required long InputTokens { get; init; }
    public required long OutputTokens { get; init; }
}

/// Safe diagnostic capture; contains no credentials. Exact serialized request body and raw
/// response are shown only when EnableTechnicalView is true.
public sealed class DecisionPipelineDiagnostics
{
    public required string SemanticVersion { get; init; }
    public required string PolicyVersion { get; init; }
    public required string RequestPayload { get; init; }
    public required string? RawResponse { get; init; }
    public required string? ReturnedModel { get; init; }
    public required decimal ElapsedMs { get; init; }
    public required int OutboundAttempts { get; init; }
    /// Missing usage (for example on a failed upstream call) is unknown: null, never zero.
    public UsageSnapshot? Usage { get; init; }
}

// ---------- Endpoint request/response contracts ----------

public sealed record DecisionPipelineAnalyzeRequest(string CustomerText);

public sealed class DecisionPipelineDefinitionResponse
{
    public required string SemanticVersion { get; init; }
    public required string PolicyVersion { get; init; }
    public required string Model { get; init; }
    public required JsonNode Questions { get; init; }
    public required DecisionPipelinePolicySettings PolicyDefaults { get; init; }
    public required IReadOnlyList<string> RoutingCategories { get; init; }
    public required IReadOnlyList<string> ScoreLevelDescriptions { get; init; }
    /// The eight synthetic DESIGN example ID/text pairs selected by task 05 (never TEST split text).
    public required IReadOnlyList<DecisionPipelineExample> Examples { get; init; }
}

public sealed record DecisionPipelineExample
{
    public required string Id { get; init; }
    public required string Text { get; init; }
    public required bool Synthetic { get; init; }
}

public sealed class DecisionPipelineAnalyzeResponse
{
    public required string SemanticVersion { get; init; }
    public required string PolicyVersion { get; init; }
    public required DateTimeOffset AnalyzedAtUtc { get; init; }
    public required string? ReturnedModel { get; init; }
    public required DecisionPipelineAnswers Answers { get; init; }
    public required DecisionPipelineDecision Decision { get; init; }
    public DecisionPipelineDiagnostics? Diagnostics { get; init; }
}

public sealed class DecisionPipelineReplayRequest
{
    public required string SemanticVersion { get; init; }
    /// The model recorded for the original run; replay supplies metadata, never a Jev call.
    public required string Model { get; init; }
    /// Raw answer objects in the TypeSafe answer shape; null means that answer was unavailable.
    public JsonNode? Routing { get; init; }
    public JsonNode? Urgency { get; init; }
    public JsonNode? CancellationRequested { get; init; }
    /// When null, the frozen defaults are used. Any supplied settings replace the defaults wholesale.
    public DecisionPipelinePolicySettings? Policy { get; init; }
}

public sealed class DecisionPipelineReplayResponse
{
    public required string SemanticVersion { get; init; }
    public required string PolicyVersion { get; init; }
    public required DateTimeOffset ReplayedAtUtc { get; init; }
    public required string Model { get; init; }
    public required DecisionPipelineAnswers Answers { get; init; }
    public required DecisionPipelineDecision Decision { get; init; }
    /// The exact settings used for this replay (defaults or caller-supplied).
    public required DecisionPipelinePolicySettings Policy { get; init; }
    /// Replay is a local C# recomputation: always zero Jev requests.
    public required int OutboundAttempts { get; init; }
}

/// Flat error body for non-success HTTP responses: { "error": "...", "code": "..." }.
public sealed record ApiErrorBody(string Error, string Code);
