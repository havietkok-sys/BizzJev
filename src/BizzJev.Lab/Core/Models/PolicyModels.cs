namespace BizzJev.Lab.Core.Models;

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

// ---------- Business actions ----------

public sealed class BusinessAction
{
    public required string Type { get; init; }
    public required string SourceGate { get; init; }
    public required string Label { get; init; }
    public required PolicyResult Trigger { get; init; } // Yes or Review
}
