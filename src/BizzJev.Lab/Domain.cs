namespace BizzJev.Lab;

// ---------- Gate definitions (versioned configuration) ----------

public sealed record SemanticGateDefinition
{
    public required string GateId { get; init; }
    public required string Category { get; init; }            // routing | context | business_signal
    public required string BusinessGoal { get; init; }
    public required string SemanticTarget { get; init; }
    public required string SemanticInterior { get; init; }
    public required string SemanticBoundaries { get; init; }
    public required string FalsePositiveConsequence { get; init; }
    public required string FalseNegativeConsequence { get; init; }
    public required string PolicyProfile { get; init; }        // catch_most | strong_boundary | balanced_routing | analytics
    public required string PromptVersion { get; init; }        // e.g. v1
    public required string Instructions { get; init; }         // noul instructions
    public required NoulCriteria Criteria { get; init; }       // {true,false} per TypeSafe noul schema
    public double ReviewThreshold { get; init; }
    public double AcceptThreshold { get; init; }
    public required string ActionOnYes { get; init; }
    public required string ActionLabel { get; init; }
    public bool Active { get; init; } = true;
}

public sealed record NoulCriteria
{
    public required string True { get; init; }
    public required string False { get; init; }
}

public sealed record GateVersion(string GateId, string PromptVersion);

// ---------- Raw semantic results ----------

public sealed class SemanticGateResult
{
    public required string GateId { get; init; }
    public required double? Probability { get; init; }
    public string? ModelVersion { get; init; }
    public required string PromptVersion { get; init; }
    public required bool Success { get; init; }
    public string? Error { get; init; }
    public double? LatencyMs { get; init; }
}

public sealed class SemanticAnalysisResult
{
    public required IReadOnlyList<SemanticGateResult> Signals { get; init; }
    public required string GateSetVersion { get; init; }
    public DateTimeOffset AnalyzedAtUtc { get; init; } = DateTimeOffset.UtcNow;
}

/// Safe diagnostic capture of one analysis run for the Technical View.
/// Contains no secrets: the authorization header lives in HttpClient, never in the payload.
public sealed class AnalysisDiagnostics
{
    public required string ModelVersion { get; init; }
    public required string GateSetVersion { get; init; }
    public required IReadOnlyList<string> PromptVersions { get; init; }
    public required string RequestPayload { get; init; }   // exact serialized JSON sent to Jev
    public required string RawResponse { get; init; }      // exact response body received
    public required double LatencyMs { get; init; }
    public required string RequestMode { get; init; }
    public required int JudgmentCount { get; init; }
}

public sealed class AnalysisOutcome
{
    public required SemanticAnalysisResult Result { get; init; }
    public AnalysisDiagnostics? Diagnostics { get; init; }
}

// ---------- Policy layer (deterministic, no Jev) ----------

public enum PolicyResult { No, Review, Yes }

public sealed record PolicyDefinition
{
    public required string GateId { get; init; }
    public required string PolicyVersion { get; init; }
    public required double ReviewThreshold { get; init; }
    public required double AcceptThreshold { get; init; }
    public required string Profile { get; init; }
}

public sealed class PolicyDecision
{
    public required string GateId { get; init; }
    public required PolicyResult Result { get; init; }
    public required string PolicyVersion { get; init; }
    public required double ReviewThreshold { get; init; }
    public required double AcceptThreshold { get; init; }
    public double? Probability { get; init; }
}

public static class PolicyEngine
{
    /// Raw probability + thresholds -> NO/REVIEW/YES. Pure function; never calls Jev.
    public static PolicyResult Decide(double? probability, double reviewThreshold, double acceptThreshold)
    {
        if (probability is null) return PolicyResult.Review; // failed gate: escalate, never silently NO
        if (acceptThreshold < reviewThreshold)
            throw new InvalidOperationException("accept threshold must be >= review threshold");
        if (probability >= acceptThreshold) return PolicyResult.Yes;
        if (probability >= reviewThreshold) return PolicyResult.Review;
        return PolicyResult.No;
    }

    public static IReadOnlyList<PolicyDecision> DecideAll(
        IEnumerable<SemanticGateResult> signals,
        IReadOnlyDictionary<string, PolicyDefinition> policies)
        => signals.Select(s =>
        {
            var p = policies.TryGetValue(s.GateId, out var pd)
                ? pd
                : throw new InvalidOperationException($"no policy for gate {s.GateId}");
            return new PolicyDecision
            {
                GateId = s.GateId,
                Result = Decide(s.Probability, p.ReviewThreshold, p.AcceptThreshold),
                PolicyVersion = p.PolicyVersion,
                ReviewThreshold = p.ReviewThreshold,
                AcceptThreshold = p.AcceptThreshold,
                Probability = s.Probability
            };
        }).ToList();
}

// ---------- Business actions ----------

public sealed class BusinessAction
{
    public required string Type { get; init; }
    public required string SourceGate { get; init; }
    public required string Label { get; init; }
    public required PolicyResult Trigger { get; init; } // Yes or Review
}

public static class Actions
{
    public static IReadOnlyList<BusinessAction> Derive(
        IReadOnlyList<PolicyDecision> decisions,
        IReadOnlyDictionary<string, SemanticGateDefinition> gates)
        => decisions
            .Where(d => d.Result is PolicyResult.Yes or PolicyResult.Review)
            .Select(d => new BusinessAction
            {
                Type = gates[d.GateId].ActionOnYes,
                SourceGate = d.GateId,
                Label = (d.Result == PolicyResult.Review ? "Human review first: " : "") + gates[d.GateId].ActionLabel,
                Trigger = d.Result
            })
            .ToList();
}

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

public static class Metrics
{
    private static double? SafeDiv(double a, double b) => b == 0 ? null : a / b;

    private static double? ComputeF1(double? precision, double? recall)
    {
        if (precision is not double p || recall is not double r || p + r == 0) return null;
        return Math.Round(2 * p * r / (p + r), 3);
    }
    private static double? Median(List<double> xs) => xs.Count == 0 ? null : xs.OrderBy(x => x).ToList()[xs.Count / 2];

    public static List<GateMetric> Compute(IEnumerable<CaseRun> runs, IReadOnlyCollection<string> gateIds)
    {
        var result = new List<GateMetric>();
        foreach (var gateId in gateIds)
        {
            int tp = 0, fp = 0, fn = 0, tn = 0, unclear = 0;
            var yesProbs = new List<double>();
            var noProbs = new List<double>();
            foreach (var run in runs)
            {
                var expected = run.Expected.FirstOrDefault(e => e.GateId == gateId)?.Label;
                var signal = run.Signals.FirstOrDefault(s => s.GateId == gateId);
                if (expected is null or "UNCLEAR") { if (expected == "UNCLEAR") unclear++; continue; }
                if (signal?.Success != true) continue;
                var predictedYes = (run.Policy.First(p => p.GateId == gateId).Result) == PolicyResult.Yes;
                if (predictedYes) yesProbs.Add(signal.Probability!.Value); else noProbs.Add(signal.Probability!.Value);
                if (expected == "YES") { if (predictedYes) tp++; else fn++; }
                else { if (predictedYes) fp++; else tn++; }
            }
            var precision = SafeDiv(tp, tp + fp);
            var recall = SafeDiv(tp, tp + fn);
            result.Add(new GateMetric
            {
                GateId = gateId, Tp = tp, Fp = fp, Fn = fn, Tn = tn, Unclear = unclear,
                Precision = precision is null ? null : Math.Round(precision.Value, 3),
                Recall = recall is null ? null : Math.Round(recall.Value, 3),
                F1 = ComputeF1(precision, recall),
                YesMedianProbability = Median(yesProbs) is double y ? Math.Round(y, 3) : null,
                NoMedianProbability = Median(noProbs) is double n ? Math.Round(n, 3) : null
            });
        }
        return result;
    }

    public static string? WeakestRoutingGate(IReadOnlyList<GateMetric> metrics, IReadOnlyDictionary<string, SemanticGateDefinition> gates)
    {
        var routing = metrics.Where(m => gates.TryGetValue(m.GateId, out var g) && g.Category == "routing").ToList();
        return routing.Count == 0 ? null
            : routing.MinBy(m => m.F1 ?? double.NegativeInfinity)!.GateId;
    }

    public static IReadOnlyList<CaseTypeMetric> ByCaseType(IReadOnlyList<CaseRun> runs, IReadOnlyCollection<string> gateIds)
        => runs.GroupBy(r => r.CaseType)
               .Select(g => new CaseTypeMetric { CaseType = g.Key, Gates = Compute(g.ToList(), gateIds) })
               .ToList();
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

public static class Regression
{
    // A case "passed" under a run when every labeled gate's expectation matches the policy YES/NO
    // (UNCLEAR labels never count as pass or fail).
    public static bool CasePassed(CaseRun run, string gateId, string expected)
    {
        var decision = run.Policy.FirstOrDefault(p => p.GateId == gateId);
        if (decision is null) return false;
        return expected == "YES" ? decision.Result == PolicyResult.Yes : decision.Result == PolicyResult.No;
    }

    public static bool CasePassedAll(CaseRun run) =>
        run.Expected.Where(e => e.Label is "YES" or "NO").All(e => CasePassed(run, e.GateId, e.Label));

    public static RegressionComparison Compare(
        string from, string to,
        IReadOnlyList<CaseRun> beforeRuns, IReadOnlyList<CaseRun> afterRuns,
        IReadOnlyCollection<string> gateIds)
    {
        var before = beforeRuns.ToDictionary(r => r.CaseId);
        var fixedCases = new List<string>();
        var broken = new List<string>();
        var unchanged = new List<string>();
        foreach (var after in afterRuns)
        {
            if (!before.TryGetValue(after.CaseId, out var beforeRun)) continue;
            var b = CasePassedAll(beforeRun);
            var a = CasePassedAll(after);
            if (a && !b) fixedCases.Add(after.CaseId);
            else if (!a && b) broken.Add(after.CaseId);
            else unchanged.Add(after.CaseId);
        }
        return new RegressionComparison
        {
            FromVersion = from, ToVersion = to,
            Fixed = fixedCases, Broken = broken, Unchanged = unchanged,
            Before = Metrics.Compute(beforeRuns, gateIds),
            After = Metrics.Compute(afterRuns, gateIds)
        };
    }
}
