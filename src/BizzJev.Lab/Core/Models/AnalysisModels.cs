namespace BizzJev.Lab.Core.Models;

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
