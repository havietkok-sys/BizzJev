using System.Diagnostics;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.VisualBasic.FileIO;

internal static class JevGateFormulation
{
    private const string RunInputHash = "ddc60dacfebf8fc1e5d5f13c5b4299921558718cd2899adeb42443d3154181e9";
    private const string GatesHash = "9ff5ae7dda62958bc5786077bd78b1f835097fdc776617b5e03de948d623dc51";
    private const string Model = "jev-1.13.0";
    private const int MaxAttempts = 3;
    private static readonly JsonSerializerOptions Pretty = new() { WriteIndented = true };

    internal static async Task<int> Run(bool checkOnly)
    {
        // Run from repository root.
        var inputBytes = File.ReadAllBytes("data/results/jev-semantic-gate-formulation-experiment/run_input.csv");
        if (!Convert.ToHexString(SHA256.HashData(inputBytes)).Equals(RunInputHash, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Frozen run_input SHA-256 mismatch. No requests sent.");
        var gatesBytes = File.ReadAllBytes("data/results/jev-semantic-gate-formulation-experiment/gate_definitions.json");
        if (!Convert.ToHexString(SHA256.HashData(gatesBytes)).Equals(GatesHash, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Frozen gate_definitions SHA-256 mismatch. No requests sent.");
        using var gatesDoc = JsonDocument.Parse(gatesBytes);
        var gates = gatesDoc.RootElement.GetProperty("gates").EnumerateArray().ToList();
        if (gates.Count != 18 || gates.Any(g => g.GetProperty("question").GetProperty("type").GetString() != "noul"))
            throw new InvalidDataException("Expected 18 noul gates.");
        if (gates.Any(g => g.GetProperty("question").TryGetProperty("criteria", out var c) && c.ValueKind != JsonValueKind.Object))
            throw new InvalidDataException("noul criteria must be an object with true/false descriptions.");
        var gateIds = gates.Select(g => g.GetProperty("id").GetString()!).ToArray();
        if (gateIds.Distinct().Count() != 18) throw new InvalidDataException("Duplicate gate ids.");

        using var stream = new MemoryStream(inputBytes);
        using var csv = new TextFieldParser(stream, Encoding.UTF8) { HasFieldsEnclosedInQuotes = true, TrimWhiteSpace = false };
        csv.SetDelimiters(",");
        var header = csv.ReadFields()!;
        var rows = new List<(string Id, string Narrative)>();
        while (!csv.EndOfData)
        {
            var fields = csv.ReadFields()!;
            rows.Add((fields[Array.IndexOf(header, "complaint_id")], fields[Array.IndexOf(header, "narrative")]));
        }
        if (rows.Count != 72 || rows.Any(r => string.IsNullOrWhiteSpace(r.Narrative)))
            throw new InvalidDataException("Expected 72 non-empty narratives.");
        Console.WriteLine($"Verified frozen hashes: 18 noul gates, {rows.Count} narratives.");
        if (checkOnly)
        {
            using var payload = JsonDocument.Parse(JsonSerializer.Serialize(new { model = Model, state = new { narrative = "offline input" }, questions = gates.Select(g => g.GetProperty("question")) }));
            var state = payload.RootElement.GetProperty("state");
            if (state.EnumerateObject().Count() != 1 || state.EnumerateObject().First().Name != "narrative") throw new Exception("State isolation failed.");
            Console.WriteLine("Gate-formulation offline checks passed. No requests sent.");
            return 0;
        }
        var config = new ConfigurationBuilder().AddUserSecrets<SmokeMarker>().AddEnvironmentVariables().Build();
        var key = config["TYPESAFE_API_KEY"];
        if (string.IsNullOrWhiteSpace(key)) { Console.Error.WriteLine("TYPESAFE_API_KEY missing. No requests sent."); return 2; }

        using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(60) };
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", key);
        var outDir = "data/results/jev-semantic-gate-formulation-experiment";
        await using var output = new StreamWriter(new FileStream(Path.Combine(outDir, "raw_predictions.csv"), FileMode.CreateNew), new UTF8Encoding(false)) { AutoFlush = true };
        await output.WriteLineAsync("complaint_id,gate_id,concept,variant,noul,status,http_status,error,attempts,latency_ms,input_tokens,output_tokens,model");
        var completed = 0; var gateFailures = 0; var retryAttempts = 0;
        foreach (var row in rows)
        {
            var attempts = 0; JsonDocument? body = null; string status = "pending"; int? httpStatus = null; string? error = null; double latency = 0;
            while (attempts < MaxAttempts)
            {
                attempts++;
                var timer = Stopwatch.StartNew();
                try
                {
                    var questions = new Dictionary<string, object>();
                    foreach (var g in gates)
                        questions[g.GetProperty("id").GetString()!] = g.GetProperty("question").Deserialize<object>()!;
                    using var response = await client.PostAsJsonAsync("https://api.typesafe.ai/v1/systemone", new
                    {
                        model = Model,
                        state = new { narrative = row.Narrative },
                        questions
                    });
                    httpStatus = (int)response.StatusCode;
                    var raw = await response.Content.ReadAsStringAsync();
                    timer.Stop();
                    latency = timer.Elapsed.TotalMilliseconds;
                    var transient = !response.IsSuccessStatusCode && ((int)response.StatusCode is 408 or 429 or >= 500);
                    if (transient && attempts < MaxAttempts) { await Task.Delay(TimeSpan.FromSeconds(2 * attempts)); continue; }
                    if (!response.IsSuccessStatusCode) { status = "api_error"; error = $"HTTP {(int)response.StatusCode}"; }
                    else
                    {
                        body = JsonDocument.Parse(raw);
                        status = "success";
                    }
                    break;
                }
                catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException or InvalidOperationException or FormatException or ArgumentException)
                {
                    timer.Stop();
                    latency = timer.Elapsed.TotalMilliseconds;
                    if ((e is HttpRequestException or TaskCanceledException) && attempts < MaxAttempts) continue;
                    status = e is HttpRequestException or TaskCanceledException ? "transport_error" : "response_error";
                    error = e.GetType().Name;
                    break;
                }
            }
            retryAttempts += attempts - 1;
            var inputTokens = 0L; var outputTokens = 0L; var model = "";
            if (body is not null)
            {
                model = body.RootElement.GetProperty("model").GetString() ?? "";
                inputTokens = body.RootElement.GetProperty("usage").GetProperty("input_tokens").GetInt64();
                outputTokens = body.RootElement.GetProperty("usage").GetProperty("output_tokens").GetInt64();
            }
            foreach (var g in gates)
            {
                var gateId = g.GetProperty("id").GetString()!;
                var concept = g.GetProperty("concept").GetString()!;
                var variant = g.GetProperty("variant").GetString()!;
                string gateStatus = status; string? gateError = error; double noulValue = double.NaN;
                if (status == "success")
                {
                    try
                    {
                        var answer = body!.RootElement.GetProperty("answers").GetProperty(gateId);
                        if (answer.GetProperty("type").GetString() != "noul") throw new JsonException("not noul");
                        var n = answer.GetProperty("noul").GetDouble();
                        if (!double.IsFinite(n) || n < 0 || n > 1) throw new JsonException("noul out of range");
                        noulValue = n;
                    }
                    catch (Exception e) when (e is KeyNotFoundException or JsonException or InvalidOperationException or FormatException)
                    {
                        gateStatus = "response_error"; gateError = e.GetType().Name; gateFailures++;
                    }
                }
                else gateFailures++;
                await output.WriteLineAsync($"{row.Id},{gateId},{concept},{variant},{(double.IsNaN(noulValue) ? "" : noulValue.ToString("R", System.Globalization.CultureInfo.InvariantCulture))},{gateStatus},{(httpStatus.HasValue ? httpStatus.Value.ToString() : "")},{gateError ?? ""},{attempts},{latency:R},{(status == "success" ? inputTokens : 0)},{(status == "success" ? outputTokens : 0)},{model}");
            }
            completed++;
            if (completed % 6 == 0 || completed == rows.Count || status != "success")
                Console.WriteLine($"Narratives completed {completed}/{rows.Count}; gate-level failures so far: {gateFailures}; retries: {retryAttempts}; last status: {status}");
        }
        Console.WriteLine($"Done: {completed} narratives x 18 gates; gate-level failures: {gateFailures}; retry attempts: {retryAttempts}.");
        Console.WriteLine($"Output: {Path.GetFullPath(Path.Combine(outDir, "raw_predictions.csv"))}");
        return 0;
    }
}
