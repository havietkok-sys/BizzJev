using System.Diagnostics;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;

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

public sealed class SvenSystemOneProvider : ISystemOneProvider
{
    private readonly HttpClient _client;
    private readonly Uri _endpoint;
    private readonly string _model;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public SvenSystemOneProvider(string baseUrl, int timeoutSeconds)
        : this(new HttpClient { Timeout = TimeSpan.FromSeconds(timeoutSeconds) }, "kev-latest", baseUrl) { }

    internal SvenSystemOneProvider(HttpClient client, string model = "kev-latest", string baseUrl = "http://localhost:8009")
    {
        _client = client;
        _model = model;
        _endpoint = new Uri($"{baseUrl.TrimEnd('/')}/v1/systemone", UriKind.Absolute);
    }

    public async Task<AnalysisOutcome> EvaluateAsync(
        string state,
        IReadOnlyList<SemanticGateDefinition> questions,
        string gateSetVersion,
        CancellationToken ct = default,
        int maxAttempts = 3)
    {
        if (string.IsNullOrWhiteSpace(state) || state.Length > 8000)
            throw new ArgumentException("state must be non-empty and at most 8000 characters.");
        if (maxAttempts is < 1 or > 3)
            throw new ArgumentOutOfRangeException(nameof(maxAttempts), "maxAttempts must be between 1 and 3.");

        var kevQuestions = questions.ToDictionary(
            q => q.GateId,
            q => (object)new { type = "noul", instructions = q.Instructions });
        var payloadJson = JsonSerializer.Serialize(new { state, model = _model, questions = kevQuestions }, Json);
        Exception? lastError = null;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            var timer = Stopwatch.StartNew();
            try
            {
                using var content = new StringContent(payloadJson, Encoding.UTF8, "application/json");
                using var response = await _client.PostAsync(_endpoint, content, ct);
                var body = await response.Content.ReadAsStringAsync(ct);
                timer.Stop();
                if (attempt < maxAttempts && (int)response.StatusCode is 408 or 429 or >= 500)
                {
                    await Task.Delay(TimeSpan.FromSeconds(2 * attempt), ct);
                    continue;
                }
                if (!response.IsSuccessStatusCode)
                    return Failed(questions, gateSetVersion, $"HTTP {(int)response.StatusCode}", timer.Elapsed.TotalMilliseconds);

                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;
                var returnedModel = root.GetProperty("model").GetString();
                var answers = root.GetProperty("answers");
                var signals = questions.Select(q => Parse(q, answers, returnedModel, timer.Elapsed.TotalMilliseconds)).ToList();
                return new AnalysisOutcome
                {
                    Result = new SemanticAnalysisResult { GateSetVersion = gateSetVersion, Signals = signals },
                    Diagnostics = new AnalysisDiagnostics
                    {
                        ModelVersion = returnedModel ?? "",
                        GateSetVersion = gateSetVersion,
                        PromptVersions = questions.Select(q => q.PromptVersion).Distinct().ToList(),
                        RequestPayload = payloadJson,
                        RawResponse = body,
                        LatencyMs = timer.Elapsed.TotalMilliseconds,
                        RequestMode = "Sven/Kev batched Noul judgments (single local request)",
                        JudgmentCount = questions.Count
                    }
                };
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException
                or KeyNotFoundException or InvalidOperationException or FormatException or ArgumentException)
            {
                timer.Stop();
                lastError = e;
                if (attempt < maxAttempts && e is HttpRequestException or TaskCanceledException)
                {
                    await Task.Delay(TimeSpan.FromSeconds(2 * attempt), ct);
                    continue;
                }
                return Failed(questions, gateSetVersion, e.GetType().Name, timer.Elapsed.TotalMilliseconds);
            }
        }

        return Failed(questions, gateSetVersion, lastError?.GetType().Name ?? "exhausted_retries", 0);
    }

    private static SemanticGateResult Parse(SemanticGateDefinition question, JsonElement answers, string? model, double latencyMs)
    {
        if (!answers.TryGetProperty(question.GateId, out var answer)) return Failure(question, "missing_answer", latencyMs);
        if (!answer.TryGetProperty("type", out var type) || type.GetString() != "noul") return Failure(question, "wrong_type", latencyMs);
        if (!answer.TryGetProperty("noul", out var value) || !value.TryGetDouble(out var noul) || !double.IsFinite(noul) || noul is < 0 or > 1)
            return Failure(question, "noul_out_of_range", latencyMs);
        return new SemanticGateResult
        {
            GateId = question.GateId,
            Probability = noul,
            ModelVersion = model,
            PromptVersion = question.PromptVersion,
            Success = true,
            LatencyMs = latencyMs
        };
    }

    private static SemanticGateResult Failure(SemanticGateDefinition question, string error, double? latencyMs) => new()
    {
        GateId = question.GateId,
        Probability = null,
        ModelVersion = null,
        PromptVersion = question.PromptVersion,
        Success = false,
        Error = error,
        LatencyMs = latencyMs
    };

    private static AnalysisOutcome Failed(IReadOnlyList<SemanticGateDefinition> questions, string gateSetVersion, string error, double latencyMs) => new()
    {
        Result = new SemanticAnalysisResult
        {
            GateSetVersion = gateSetVersion,
            Signals = questions.Select(q => Failure(q, error, latencyMs)).ToList()
        }
    };
}

public static class SystemOneProviderFactory
{
    public static ISystemOneProvider Select(
        string? configuredProvider,
        Func<ISystemOneProvider> jev,
        Func<ISystemOneProvider> sven)
        => configuredProvider?.Trim().ToLowerInvariant() switch
        {
            null or "" or "jev" => jev(),
            "sven" => sven(),
            _ => throw new InvalidOperationException("SYSTEM_ONE_PROVIDER must be 'jev' or 'sven'.")
        };
}
