namespace BizzJev.Lab.Core.Policies;

// ---------- Policy layer (deterministic, no Jev) ----------

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
