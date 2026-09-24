namespace BizzJev.Lab.Core.Models;

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
