using System.Diagnostics;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.VisualBasic.FileIO;

internal static class CfpbSingleGate
{
    private const string TestHash = "97a79e10a513bd5737a350e6b33024b1087ea9657db1f85f17c1c52aef516706";
    private const string JudgmentHash = "c4f0623046210ed03dcaea787955aac5917ca59eb66bbacd997bac03b0bba724";
    private const string Model = "jev-1.13.0";
    private const int MaxAttempts = 3;
    private static readonly JsonSerializerOptions Pretty = new() { WriteIndented = true };
    private static readonly string[] Forbidden =
    [
        "Debt is not yours", "Debt was result of identity theft", "Debt was paid", "discharged in bankruptcy",
        "Didn't receive enough information", "Didn't receive notice of right to dispute", "didn't disclose it was an attempt",
        "Attempted to collect wrong amount", "Indicated you were committing crime", "Impersonated attorney",
        "Told you not to respond to a lawsuit", "Threatened or suggested your credit would be damaged",
        "Threatened to sue you for very old debt", "Sued you without properly notifying", "Collected or attempted to collect exempt",
        "Threatened to arrest you", "Seized or attempted to seize", "Sued you in a state where you do not live",
        "Threatened to turn you in to immigration", "cfpbSubIssues", "Sub-issue", "sub-issue"
    ];

    internal static async Task<int> Run(bool checkOnly)
    {
        // Run from repository root. Read and hash the same bytes that are parsed.
        var testBytes = File.ReadAllBytes("data/prepared/cfpb/consumer-issue-prediction-v1/test.csv");
        if (!Convert.ToHexString(SHA256.HashData(testBytes)).Equals(TestHash, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Frozen TEST split SHA-256 mismatch. No requests sent.");
        var definition = File.ReadAllBytes("src/BizzJev.Smoke/cfpb-consumer-issue-single-gate.json");
        if (!Convert.ToHexString(SHA256.HashData(definition)).Equals(JudgmentHash, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Frozen single-gate judgment SHA-256 mismatch. No requests sent.");
        using var questions = JsonDocument.Parse(definition);
        var root = questions.RootElement;
        if (root.EnumerateObject().Count() != 1 || !root.TryGetProperty("consumerSelectedIssue", out var question))
            throw new InvalidDataException("Structural check failed: exactly one question required.");
        if (question.GetProperty("type").GetString() != "choice")
            throw new InvalidDataException("Structural check failed: question must be a single Choice.");
        var criteria = question.GetProperty("criteria");
        var labels = criteria.EnumerateObject().Select(p => p.Name).ToArray();
        var expected = new[]
        {
            "Attempts to collect debt not owed", "Written notification about debt",
            "False statements or representation", "Took or threatened to take negative or legal action"
        };
        if (labels.Length != 4 || !labels.ToHashSet().SetEquals(expected))
            throw new InvalidDataException("Structural check failed: criteria must be exactly the four parent labels.");
        foreach (var property in criteria.EnumerateObject())
            if (property.Value.ValueKind != JsonValueKind.String)
                throw new InvalidDataException("Structural check failed: criteria must be plain strings, not nested objects.");
        var text = Encoding.UTF8.GetString(definition);
        var hit = Forbidden.FirstOrDefault(f => text.Contains(f, StringComparison.Ordinal));
        if (hit is not null)
            throw new InvalidDataException($"Structural check failed: forbidden child-level content present: '{hit}'.");
        Console.WriteLine("Structural checks passed: one Choice, four plain parent-level string criteria, no child-level content.");

        using var stream = new MemoryStream(testBytes);
        using var csv = new TextFieldParser(stream, Encoding.UTF8) { HasFieldsEnclosedInQuotes = true, TrimWhiteSpace = false };
        csv.SetDelimiters(",");
        var header = csv.ReadFields()!;
        var rows = new List<(string Id, string Issue, string Narrative)>();
        while (!csv.EndOfData)
        {
            var fields = csv.ReadFields()!;
            if (fields.Length != header.Length) throw new InvalidDataException("CSV width mismatch.");
            rows.Add((fields[Array.IndexOf(header, "Complaint ID")], fields[Array.IndexOf(header, "Issue")], fields[Array.IndexOf(header, "Consumer complaint narrative")]));
        }
        var expectedPerLabel = new Dictionary<string, int>
        {
            ["Attempts to collect debt not owed"] = 432,
            ["Written notification about debt"] = 164,
            ["False statements or representation"] = 139,
            ["Took or threatened to take negative or legal action"] = 75
        };
        if (rows.Count != 810 || rows.Select(r => r.Id).Distinct().Count() != 810
            || rows.Select(r => r.Narrative).Distinct().Count() != 810
            || rows.Any(r => string.IsNullOrWhiteSpace(r.Narrative))
            || expectedPerLabel.Any(kv => rows.Count(r => r.Issue == kv.Key) != kv.Value))
            throw new InvalidDataException("Frozen TEST split structure mismatch.");
        Console.WriteLine("Verified frozen judgment + TEST hashes, 810 unique narratives, expected per-label counts.");
        if (checkOnly)
        {
            using var payload = JsonDocument.Parse(JsonSerializer.Serialize(new { model = Model, state = new { narrative = "offline input" }, questions = root }));
            if (payload.RootElement.GetProperty("state").EnumerateObject().Count() != 1) throw new Exception("State isolation failed.");
            Console.WriteLine("Single-gate offline checks passed. No requests sent.");
            return 0;
        }
        var config = new ConfigurationBuilder().AddUserSecrets<SmokeMarker>().AddEnvironmentVariables().Build();
        var key = config["TYPESAFE_API_KEY"];
        if (string.IsNullOrWhiteSpace(key)) { Console.Error.WriteLine("TYPESAFE_API_KEY missing. No requests sent."); return 2; }
        var directory = "data/results/cfpb-single-gate-" + DateTime.UtcNow.ToString("yyyyMMddTHHmmssfffZ");
        Directory.CreateDirectory(directory);
        File.WriteAllBytes(Path.Combine(directory, "judgment.json"), definition);
        File.WriteAllText(Path.Combine(directory, "manifest.json"), JsonSerializer.Serialize(new
        {
            name = "CFPB Single Semantic Gate Experiment (post-test architecture comparison)",
            resultLabel = "EXPERIMENTAL / POST-TEST ARCHITECTURE COMPARISON - TEST set previously inspected during V1 post-test analysis; NOT a held-out generalization result",
            testCsvSha256 = TestHash,
            judgmentSha256 = JudgmentHash.ToLowerInvariant(),
            model = Model,
            metric = "Agreement with consumer-selected CFPB Issue",
            cases = 810,
            retryPolicy = $"Up to {MaxAttempts} attempts per case for transient failures only (HttpRequestException, TaskCanceledException, HTTP 408/429/5xx); identical frozen judgment re-sent verbatim; every attempt logged per case",
            timeoutSeconds = 60,
            startedUtc = DateTime.UtcNow,
            latencyDefinition = "Final attempt's HTTP request through complete response body; milliseconds; excludes local validation, disk writes and backoff waits"
        }, Pretty));
        await using var output = new StreamWriter(new FileStream(Path.Combine(directory, "raw.jsonl"), FileMode.CreateNew), new UTF8Encoding(false)) { AutoFlush = true };
        using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(60) };
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", key);
        var results = new List<Result>();
        foreach (var row in rows)
        {
            var result = new Result { ComplaintId = row.Id, ExpectedCfpbIssue = row.Issue };
            for (var attempt = 1; attempt <= MaxAttempts; attempt++)
            {
                result.Attempts = attempt;
                var timer = Stopwatch.StartNew();
                try
                {
                    using var response = await client.PostAsJsonAsync("https://api.typesafe.ai/v1/systemone", new
                    {
                        model = Model,
                        state = new { narrative = row.Narrative },
                        questions = root
                    });
                    result.HttpStatus = (int)response.StatusCode;
                    result.RawResponse = await response.Content.ReadAsStringAsync();
                    timer.Stop();
                    var transientStatus = !response.IsSuccessStatusCode && ((int)response.StatusCode is 408 or 429 or >= 500);
                    if (transientStatus && attempt < MaxAttempts)
                    {
                        result.AddRetry($"attempt {attempt}: HTTP {(int)response.StatusCode}");
                        await Task.Delay(TimeSpan.FromSeconds(2 * attempt));
                        continue;
                    }
                    if (!response.IsSuccessStatusCode) result.Status = "api_error";
                    else
                    {
                        using var document = JsonDocument.Parse(result.RawResponse);
                        var body = document.RootElement;
                        result.Model = body.GetProperty("model").GetString();
                        result.InputTokens = body.GetProperty("usage").GetProperty("input_tokens").GetInt64();
                        result.OutputTokens = body.GetProperty("usage").GetProperty("output_tokens").GetInt64();
                        var answer = body.GetProperty("answers").GetProperty("consumerSelectedIssue");
                        var choice = answer.GetProperty("choice").GetString();
                        var confidence = answer.GetProperty("confidence").GetDouble();
                        var distribution = answer.GetProperty("probabilities").EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetDouble());
                        if (answer.GetProperty("type").GetString() != "choice" || choice is null || !labels.Contains(choice)
                            || !distribution.Keys.ToHashSet().SetEquals(labels)
                            || distribution.Values.Any(p => !double.IsFinite(p) || p < 0 || p > 1)
                            || Math.Abs(distribution.Values.Sum() - 1) > 0.00001
                            || !double.IsFinite(confidence) || confidence < 0 || confidence > 1
                            || string.IsNullOrWhiteSpace(result.Model) || result.InputTokens < 0 || result.OutputTokens < 0)
                            throw new JsonException("Invalid Choice response.");
                        result.Choice = choice;
                        result.Probabilities = distribution;
                        result.Confidence = confidence;
                        result.Agreement = choice == row.Issue;
                        result.Status = "success";
                    }
                }
                catch (Exception error) when (error is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException or InvalidOperationException or FormatException or ArgumentException)
                {
                    timer.Stop();
                    if (error is HttpRequestException or TaskCanceledException)
                    {
                        if (attempt < MaxAttempts)
                        {
                            result.AddRetry($"attempt {attempt}: {error.GetType().Name}");
                            await Task.Delay(TimeSpan.FromSeconds(2 * attempt));
                            continue;
                        }
                        result.Status = "transport_error";
                    }
                    else result.Status = "response_error";
                    result.Error = error.GetType().Name;
                }
                result.LatencyMs = timer.Elapsed.TotalMilliseconds;
                break;
            }
            results.Add(result);
            output.WriteLine(JsonSerializer.Serialize(result));
            var retries = results.Sum(r => r.Attempts - 1);
            if (results.Count % 10 == 0 || results.Count == 810 || result.Status != "success")
                Console.WriteLine($"Completed {results.Count}/810; failures: {results.Count(r => r.Status != "success")}; retry attempts so far: {retries}");
        }
        var summary = Summarize(results, labels);
        File.WriteAllText(Path.Combine(directory, "summary.json"), JsonSerializer.Serialize(summary, Pretty));
        Console.WriteLine(JsonSerializer.Serialize(summary, Pretty));
        Console.WriteLine($"Results: {Path.GetFullPath(directory)}");
        return 0;
    }

    private static double Median(double[] values)
    {
        var sorted = values.OrderBy(v => v).ToArray();
        return sorted.Length == 0 ? double.NaN : sorted.Length % 2 == 1 ? sorted[sorted.Length / 2] : (sorted[sorted.Length / 2 - 1] + sorted[sorted.Length / 2]) / 2;
    }

    private static double Percentile(double[] values, double fraction)
    {
        var sorted = values.OrderBy(v => v).ToArray();
        if (sorted.Length == 0) return double.NaN;
        var index = (int)Math.Round(fraction * (sorted.Length - 1), MidpointRounding.AwayFromZero);
        return sorted[index];
    }

    private static object MarginStats(List<Result> results) => new
    {
        mean = results.Any() ? results.Average(Margin) : double.NaN,
        median = Median(results.Select(Margin).ToArray()),
        p10 = Percentile(results.Select(Margin).ToArray(), 0.10),
        p90 = Percentile(results.Select(Margin).ToArray(), 0.90)
    };

    private static double Margin(Result r) => r.Probabilities is null ? double.NaN : r.Probabilities.Values.OrderByDescending(p => p).First() - r.Probabilities.Values.OrderByDescending(p => p).Skip(1).First();

    private static object Summarize(List<Result> results, string[] labels)
    {
        var validated = results.Where(r => r.Status == "success" && r.Agreement != null).ToList();
        var agreements = validated.Where(r => r.Agreement == true).ToList();
        var disagreements = validated.Where(r => r.Agreement == false).ToList();
        var latencies = validated.Select(r => r.LatencyMs).ToArray();
        return new
        {
            resultLabel = "EXPERIMENTAL / POST-TEST ARCHITECTURE COMPARISON (not held-out; TEST previously inspected in V1 post-test analysis)",
            metric = "Agreement with consumer-selected CFPB Issue",
            total = results.Count,
            completed = validated.Count,
            agreement = agreements.Count,
            agreementPercentage = results.Count == 0 ? 0 : Math.Round(agreements.Count * 100.0 / results.Count, 2),
            perLabel = labels.Select(l => new
            {
                label = l,
                agreement = validated.Count(r => r.ExpectedCfpbIssue == l && r.Agreement == true),
                total = results.Count(r => r.ExpectedCfpbIssue == l),
                percentage = Math.Round(validated.Count(r => r.ExpectedCfpbIssue == l && r.Agreement == true) * 100.0 / results.Count(r => r.ExpectedCfpbIssue == l), 1)
            }),
            confusionMatrixLabels = labels,
            confusionMatrixRows = "CFPB consumer-selected Issue",
            confusionMatrixColumns = "Jev Choice",
            confusionMatrix = labels.Select(source => labels.Select(predicted => results.Count(r => r.ExpectedCfpbIssue == source && r.Choice == predicted)).ToArray()).ToArray(),
            averageConfidenceOverall = validated.Any() ? validated.Average(r => r.Confidence ?? double.NaN) : double.NaN,
            averageConfidenceAgreements = agreements.Any() ? agreements.Average(r => r.Confidence ?? double.NaN) : double.NaN,
            averageConfidenceDisagreements = disagreements.Any() ? disagreements.Average(r => r.Confidence ?? double.NaN) : double.NaN,
            probabilityMarginFirstMinusSecond = new { overall = MarginStats(validated), agreements = MarginStats(agreements), disagreements = MarginStats(disagreements) },
            totalInputTokens = results.Sum(r => r.InputTokens ?? 0),
            totalOutputTokens = results.Sum(r => r.OutputTokens ?? 0),
            averageLatencyMs = latencies.Any() ? latencies.Average() : double.NaN,
            medianLatencyMs = Median(latencies),
            totalLatencyMs = results.Sum(r => r.LatencyMs),
            apiFailureCount = results.Count(r => r.Status != "success"),
            retryAttempts = results.Sum(r => r.Attempts - 1),
            note = "Failures remain in the 810-case denominator; no predicted label or agreement is fabricated. The metric is agreement with the consumer's single CFPB intake selection, not semantic ground-truth accuracy. Confidence means and margins use validated responses only."
        };
    }

    private sealed class Result
    {
        public required string ComplaintId { get; init; }
        public required string ExpectedCfpbIssue { get; init; }
        public string? Choice { get; set; }
        public Dictionary<string, double>? Probabilities { get; set; }
        public double? Confidence { get; set; }
        public bool? Agreement { get; set; }
        public double LatencyMs { get; set; }
        public long? InputTokens { get; set; }
        public long? OutputTokens { get; set; }
        public string? Model { get; set; }
        public string Status { get; set; } = "pending";
        public int? HttpStatus { get; set; }
        public string? Error { get; set; }
        public string? RawResponse { get; set; }
        public int Attempts { get; set; } = 1;
        public List<string> Retries { get; } = [];
        public void AddRetry(string reason) => Retries.Add(reason);
    }
}
