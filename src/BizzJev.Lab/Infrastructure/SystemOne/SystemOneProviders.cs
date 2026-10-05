namespace BizzJev.Lab.Infrastructure.SystemOne;

public interface ISystemOneProvider
{
    Task<AnalysisOutcome> EvaluateAsync(
        string state,
        IReadOnlyList<SemanticGateDefinition> questions,
        string gateSetVersion,
        CancellationToken ct = default,
        int maxAttempts = 3);
}

public sealed class JevSystemOneProvider(JevGateClient client) : ISystemOneProvider
{
    public Task<AnalysisOutcome> EvaluateAsync(
        string state,
        IReadOnlyList<SemanticGateDefinition> questions,
        string gateSetVersion,
        CancellationToken ct = default,
        int maxAttempts = 3)
        => client.AnalyzeAsync(state, questions, gateSetVersion, ct, maxAttempts);
}

public sealed class Tev1SystemOneProvider(JevGateClient client) : ISystemOneProvider
{
    public Task<AnalysisOutcome> EvaluateAsync(
        string state,
        IReadOnlyList<SemanticGateDefinition> questions,
        string gateSetVersion,
        CancellationToken ct = default,
        int maxAttempts = 3)
        => client.AnalyzeAsync(state, questions, gateSetVersion, ct, maxAttempts);
}
