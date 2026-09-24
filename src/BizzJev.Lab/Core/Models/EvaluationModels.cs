namespace BizzJev.Lab.Core.Models;

// ---------- Evaluation ----------

public sealed class ExpectedLabel
{
    public string GateId { get; init; } = "";
    public string Label { get; init; } = ""; // YES | NO | UNCLEAR
}

public sealed record EvaluationCase
{
    public required string Id { get; init; }
    public required string CaseType { get; init; }
    public required string CustomerText { get; init; }
    public List<ExpectedLabel> Expected { get; init; } = [];
    public string? Rationale { get; init; }
    public string? Notes { get; init; }
    public bool Synthetic { get; init; } = true;
    public DateTimeOffset CreatedAtUtc { get; init; } = DateTimeOffset.UtcNow;
}

public sealed class CaseRun
{
    public required string CaseId { get; init; }
    public required string CaseType { get; init; }
    public required string CustomerText { get; init; }
    public IReadOnlyList<ExpectedLabel> Expected { get; init; } = [];
    public string? Rationale { get; init; }
    public string? Notes { get; init; }
    public required IReadOnlyList<SemanticGateResult> Signals { get; init; }
    public required IReadOnlyList<PolicyDecision> Policy { get; init; }
    public required IReadOnlyList<BusinessAction> Actions { get; init; }
    public required string GateSetVersion { get; init; }
    public required string PolicyVersion { get; init; }
}

public sealed class GateMetric
{
    public required string GateId { get; init; }
    public int Tp { get; init; }
    public int Fp { get; init; }
    public int Fn { get; init; }
    public int Tn { get; init; }
    public int Unclear { get; init; }
    public double? Precision { get; init; }
    public double? Recall { get; init; }
    public double? F1 { get; init; }
    public double? YesMedianProbability { get; init; }
    public double? NoMedianProbability { get; init; }
}

public sealed class CaseTypeMetric
{
    public required string CaseType { get; init; }
    public required IReadOnlyList<GateMetric> Gates { get; init; }
}

public sealed class EvaluationResult
{
    public required string Id { get; init; }
    public required DateTimeOffset RanAtUtc { get; init; }
    public required string GateSetVersion { get; init; }
    public required string PolicyVersion { get; init; }
    public required IReadOnlyList<GateMetric> PerGate { get; init; }
    public required IReadOnlyList<CaseTypeMetric> ByCaseType { get; init; }
    public required string? WeakestRoutingGate { get; init; }
    public required int Cases { get; init; }
    public required int ApiFailures { get; init; }
    public required IReadOnlyList<CaseRun> Runs { get; init; }
}

// ---------- Regression comparison ----------

public sealed class RegressionComparison
{
    public required string FromVersion { get; init; }
    public required string ToVersion { get; init; }
    public required IReadOnlyList<string> Fixed { get; init; }
    public required IReadOnlyList<string> Broken { get; init; }
    public required IReadOnlyList<string> Unchanged { get; init; }
    public required IReadOnlyList<GateMetric> Before { get; init; }
    public required IReadOnlyList<GateMetric> After { get; init; }
}
