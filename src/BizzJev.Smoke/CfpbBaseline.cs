using System.Diagnostics;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.VisualBasic.FileIO;

internal static class CfpbBaseline
{
    private const string Hash = "380911efa458a467a0a08ead125b3f06d500e1e50ef8f4c0263fd3ae144f18f6";
    private const string Model = "jev-1.13.0";
    private static readonly JsonSerializerOptions Pretty = new() { WriteIndented = true };

    internal static async Task<int> Run(bool checkOnly)
    {
        // Run from repository root. Read and hash the same bytes that are parsed.
        var bytes = File.ReadAllBytes("data/prepared/cfpb/cfpb-debt-100.csv");
        if (!Convert.ToHexString(SHA256.HashData(bytes)).Equals(Hash, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Frozen benchmark SHA-256 mismatch. No requests sent.");
        var definition = File.ReadAllBytes("src/BizzJev.Smoke/cfpb-baseline-v1.json");
        using var questions = JsonDocument.Parse(definition);
        var labels = questions.RootElement.GetProperty("cfpbIssue").GetProperty("criteria").EnumerateObject().Select(p => p.Name).ToArray();
        using var stream = new MemoryStream(bytes);
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
        if (rows.Count != 100 || rows.Select(r => r.Id).Distinct().Count() != 100
            || rows.Select(r => r.Narrative).Distinct().Count() != 100
            || rows.Any(r => string.IsNullOrWhiteSpace(r.Narrative))
            || labels.Length != 4 || labels.Any(l => rows.Count(r => r.Issue == l) != 25))
            throw new InvalidDataException("Frozen benchmark structure mismatch.");
        Console.WriteLine("Verified frozen hash, 100 unique narratives and 25 cases per label.");
        if (checkOnly)
        {
            // Offline check: payload has narrative-only state and no source metadata.
            using var payload = JsonDocument.Parse(JsonSerializer.Serialize(new { model = Model, state = new { narrative = "offline input" }, questions = questions.RootElement }));
            if (payload.RootElement.GetProperty("state").EnumerateObject().Count() != 1) throw new Exception("State isolation failed.");
            Console.WriteLine("CFPB offline checks passed. No requests sent.");
            return 0;
        }
        var config = new ConfigurationBuilder().AddUserSecrets<SmokeMarker>().AddEnvironmentVariables().Build();
        var key = config["TYPESAFE_API_KEY"];
        if (string.IsNullOrWhiteSpace(key)) { Console.Error.WriteLine("TYPESAFE_API_KEY missing. No requests sent."); return 2; }
        var directory = "data/results/cfpb-debt-baseline-v1-" + DateTime.UtcNow.ToString("yyyyMMddTHHmmssfffZ");
        Directory.CreateDirectory(directory);
        File.WriteAllBytes(Path.Combine(directory, "judgment.json"), definition);
        File.WriteAllText(Path.Combine(directory, "manifest.json"), JsonSerializer.Serialize(new
        {
            name = "CFPB Debt Collection Baseline v1",
            benchmarkSha256 = Hash,
            judgmentSha256 = Convert.ToHexString(SHA256.HashData(definition)).ToLowerInvariant(),
            model = Model,
            metric = "Agreement with CFPB consumer-selected Issue",
            cases = 100,
            retries = 0,
            timeoutSeconds = 60,
            startedUtc = DateTime.UtcNow,
            latencyDefinition = "HTTP request through complete response body; milliseconds; excludes local validation and disk writes"
        }, Pretty));
        using var output = new StreamWriter(new FileStream(Path.Combine(directory, "raw.jsonl"), FileMode.CreateNew), new UTF8Encoding(false)) { AutoFlush = true };
        using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(60) };
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", key);
        var results = new List<Result>();
        foreach (var row in rows)
        {
            var result = new Result { ComplaintId = row.Id, ExpectedCfpbIssue = row.Issue };
            var timer = Stopwatch.StartNew();
            try
            {
                using var response = await client.PostAsJsonAsync("https://api.typesafe.ai/v1/systemone", new
                {
                    model = Model,
                    state = new { narrative = row.Narrative },
                    questions = questions.RootElement
                });
                result.HttpStatus = (int)response.StatusCode;
                result.RawResponse = await response.Content.ReadAsStringAsync();
                timer.Stop();
                if (!response.IsSuccessStatusCode) result.Status = "api_error";
                else
                {
                    using var document = JsonDocument.Parse(result.RawResponse);
                    var root = document.RootElement;
                    result.Model = root.GetProperty("model").GetString();
                    result.InputTokens = root.GetProperty("usage").GetProperty("input_tokens").GetInt64();
                    result.OutputTokens = root.GetProperty("usage").GetProperty("output_tokens").GetInt64();
                    var answer = root.GetProperty("answers").GetProperty("cfpbIssue");
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
                result.Status = error is HttpRequestException or TaskCanceledException ? "transport_error" : "response_error";
                result.Error = error.GetType().Name;
            }
            timer.Stop();
            result.LatencyMs = timer.Elapsed.TotalMilliseconds;
            results.Add(result);
            output.WriteLine(JsonSerializer.Serialize(result));
            Console.WriteLine($"Completed {results.Count}/100; API/transport/response failures: {results.Count(r => r.Status != "success")}");
        }
        var summary = Summarize(results, labels);
        File.WriteAllText(Path.Combine(directory, "summary.json"), JsonSerializer.Serialize(summary, Pretty));
        Console.WriteLine(JsonSerializer.Serialize(summary, Pretty));
        Console.WriteLine($"Results: {Path.GetFullPath(directory)}");
        return 0;
    }

    private static object Summarize(List<Result> results, string[] labels) => new
    {
        metric = "Agreement with CFPB consumer-selected Issue",
        total = results.Count,
        agreement = results.Count(r => r.Agreement == true),
        agreementPercentage = results.Count(r => r.Agreement == true) / 100.0 * 100,
        perLabel = labels.Select(l => new { label = l, agreement = results.Count(r => r.ExpectedCfpbIssue == l && r.Agreement == true), total = 25, percentage = results.Count(r => r.ExpectedCfpbIssue == l && r.Agreement == true) * 4.0 }),
        confusionMatrixLabels = labels,
        confusionMatrixRows = "CFPB consumer-selected Issue",
        confusionMatrixColumns = "Jev Choice",
        confusionMatrix = labels.Select(source => labels.Select(predicted => results.Count(r => r.ExpectedCfpbIssue == source && r.Choice == predicted)).ToArray()).ToArray(),
        averageConfidenceOverall = results.Where(r => r.Status == "success").Select(r => r.Confidence).Average(),
        averageConfidenceAgreements = results.Where(r => r.Agreement == true).Select(r => r.Confidence).Average(),
        averageConfidenceDisagreements = results.Where(r => r.Agreement == false).Select(r => r.Confidence).Average(),
        totalInputTokens = results.Sum(r => r.InputTokens ?? 0),
        totalOutputTokens = results.Sum(r => r.OutputTokens ?? 0),
        averageLatencyMs = results.Average(r => r.LatencyMs),
        totalLatencyMs = results.Sum(r => r.LatencyMs),
        apiFailureCount = results.Count(r => r.Status != "success"),
        note = "Failures remain in the 100-case denominator; no predicted label or agreement is fabricated. Confidence means use validated responses only; tokens reflect reported usage only."
    };

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
    }
}
