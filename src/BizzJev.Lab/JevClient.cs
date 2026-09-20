using System.Diagnostics;
using System.Text;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace BizzJev.Lab;

/// Runs every active gate as an independent Noul question in ONE batched
/// POST /v1/systemone request (TypeSafe: independent questions share state, run in
/// parallel, and cannot see each other - no gate influences another).
public sealed class JevGateClient
{
    private readonly HttpClient _client;
    private readonly string _model;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public JevGateClient(string apiKey, string model, int timeoutSeconds)
        : this(new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(timeoutSeconds) }, model)
    {
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
    }

    internal JevGateClient(HttpClient client, string model)
    {
        _client = client;
        _model = model;
    }

    public async Task<AnalysisOutcome> AnalyzeAsync(
        string customerText,
        IReadOnlyList<SemanticGateDefinition> gates,
        string gateSetVersion,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(customerText) || customerText.Length > 8000)
            throw new ArgumentException("customerText must be non-empty and at most 8000 characters.");
        var questions = new Dictionary<string, object>();
        foreach (var gate in gates)
            questions[gate.GateId] = new { type = "noul", instructions = gate.Instructions, criteria = gate.Criteria };
        var payload = new { model = _model, state = new { customerText }, questions };
        // serialize once; the SAME string is sent and captured so Technical View shows the exact wire payload
        var payloadJson = JsonSerializer.Serialize(payload, Json);
        var content = new StringContent(payloadJson, Encoding.UTF8, "application/json");

        Exception? lastError = null;
        for (var attempt = 1; attempt <= 3; attempt++)
        {
            var timer = Stopwatch.StartNew();
            try
            {
                using var response = await _client.PostAsync("https://api.typesafe.ai/v1/systemone", content, ct);
                var body = await response.Content.ReadAsStringAsync(ct);
                timer.Stop();
                if ((int)response.StatusCode is 408 or 429 or >= 500 && attempt < 3)
                {
                    await Task.Delay(TimeSpan.FromSeconds(2 * attempt), ct);
                    continue;
                }
                if (!response.IsSuccessStatusCode)
                    return new AnalysisOutcome { Result = FailAll(gates, gateSetVersion, $"HTTP {(int)response.StatusCode}", timer.Elapsed.TotalMilliseconds) };
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;
                var model = root.GetProperty("model").GetString();
                var answers = root.GetProperty("answers");
                var signals = gates.Select(g =>
                {
                    if (!answers.TryGetProperty(g.GateId, out var answer))
                        return Fail(g, "missing_answer", null);
                    if (answer.GetProperty("type").GetString() != "noul") return Fail(g, "wrong_type", null);
                    var noul = answer.GetProperty("noul").GetDouble();
                    if (!double.IsFinite(noul) || noul < 0 || noul > 1) return Fail(g, "noul_out_of_range", null);
                    return new SemanticGateResult
                    {
                        GateId = g.GateId, Probability = noul, ModelVersion = model,
                        PromptVersion = g.PromptVersion, Success = true, LatencyMs = timer.Elapsed.TotalMilliseconds
                    };
                }).ToList();
                return new AnalysisOutcome
                {
                    Result = new SemanticAnalysisResult { GateSetVersion = gateSetVersion, Signals = signals },
                    Diagnostics = new AnalysisDiagnostics
                    {
                        ModelVersion = model ?? "",
                        GateSetVersion = gateSetVersion,
                        PromptVersions = gates.Select(g => g.PromptVersion).Distinct().ToList(),
                        RequestPayload = payloadJson,
                        RawResponse = body,
                        LatencyMs = timer.Elapsed.TotalMilliseconds,
                        RequestMode = "Batched independent Noul judgments (single request, shared state)",
                        JudgmentCount = gates.Count
                    }
                };
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException
                or KeyNotFoundException or InvalidOperationException or FormatException or ArgumentException)
            {
                timer.Stop();
                lastError = e;
                if (e is HttpRequestException or TaskCanceledException && attempt < 3)
                {
                    await Task.Delay(TimeSpan.FromSeconds(2 * attempt), ct);
                    continue;
                }
                return new AnalysisOutcome { Result = FailAll(gates, gateSetVersion, e.GetType().Name, timer.Elapsed.TotalMilliseconds) };
            }
        }
        return new AnalysisOutcome { Result = FailAll(gates, gateSetVersion, lastError?.GetType().Name ?? "exhausted_retries", 0) };
    }

    private static SemanticGateResult Fail(SemanticGateDefinition g, string error, double? ms) => new()
    {
        GateId = g.GateId, Probability = null, ModelVersion = null,
        PromptVersion = g.PromptVersion, Success = false, Error = error, LatencyMs = ms
    };

    private static SemanticAnalysisResult FailAll(IReadOnlyList<SemanticGateDefinition> gates, string version, string error, double ms)
        => new() { GateSetVersion = version, Signals = gates.Select(g => Fail(g, error, ms)).ToList() };
}
