using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace BizzJev.Lab;

// ---------- dataset ----------

public sealed class DecisionPipelineEvalCase
{
    public required string Id { get; init; }
    public required string Split { get; init; }
    public required string Family { get; init; }
    public string? ReversalPair { get; init; }
    public required IReadOnlyList<string> Tags { get; init; }
    public required string CustomerText { get; init; }
    public bool Synthetic { get; init; } = true;
    /// Determinate expected category, or null when the routing expectation is explicitly ambiguous.
    public string? ExpectedRouting { get; init; }
    public bool RoutingAmbiguous { get; init; }
    /// Point level 0-3, or null when an interval is annotated instead.
    public int? ExpectedUrgencyLevel { get; init; }
    public int[]? ExpectedUrgencyInterval { get; init; }
    /// YES | NO | UNCLEAR annotation (UNCLEAR is an annotation, not a Noul state).
    public required string ExpectedCancellation { get; init; }
    public required IReadOnlyList<string> Business { get; init; }
    public string? Rationale { get; init; }
}

public sealed class DecisionPipelineCaseDataset
{
    public required string DatasetVersion { get; init; }
    public required string Sha256 { get; init; }
    public required IReadOnlyList<DecisionPipelineEvalCase> Cases { get; init; }
    public required IReadOnlyList<string> UiExamples { get; init; }

    public static DecisionPipelineCaseDataset Load(string path)
    {
        var text = File.ReadAllText(path);
        var root = JsonNode.Parse(text) as JsonObject ?? throw new InvalidOperationException("dataset root must be an object");
        var version = (string?)root["datasetVersion"] ?? throw new InvalidOperationException("datasetVersion missing");
        var cases = new List<DecisionPipelineEvalCase>();
        foreach (var node in root["cases"] as JsonArray ?? throw new InvalidOperationException("cases array missing"))
        {
            var c = (JsonObject)node!;
            var expected = (JsonObject)c["expected"]!;
            var routing = (JsonObject)expected["routing"]!;
            var urgency = (JsonObject)expected["urgency"]!;
            var cancellation = (JsonObject)expected["cancellation"]!;
            int[]? interval = null;
            if (urgency["interval"] is JsonArray arr)
                interval = arr.Select(n => (int)n!).ToArray();
            cases.Add(new DecisionPipelineEvalCase
            {
                Id = (string)c["id"]!,
                Split = (string)c["split"]!,
                Family = (string)c["family"]!,
                ReversalPair = (string?)c["reversalPair"],
                Tags = (c["tags"] as JsonArray ?? []).Select(t => (string)t!).ToList(),
                CustomerText = (string)c["customerText"]!,
                Synthetic = c["synthetic"]?.GetValue<bool>() ?? true,
                ExpectedRouting = (string?)routing["category"],
                RoutingAmbiguous = routing["ambiguous"]?.GetValue<bool>() ?? false,
                ExpectedUrgencyLevel = (int?)urgency["level"],
                ExpectedUrgencyInterval = interval,
                ExpectedCancellation = (string)cancellation["label"]!,
                Business = (expected["business"] as JsonArray ?? []).Select(b => (string)b!).ToList(),
                Rationale = (string?)c["rationale"]
            });
        }
        if (cases.Count == 0) throw new InvalidOperationException("dataset has no cases");
        var ids = cases.Select(c => c.Id).ToList();
        if (ids.Distinct().Count() != ids.Count) throw new InvalidOperationException("dataset case ids are not unique");
        return new DecisionPipelineCaseDataset
        {
            DatasetVersion = version,
            Sha256 = Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(text))).ToLowerInvariant(),
            Cases = cases,
            UiExamples = (root["uiExamples"] as JsonArray ?? []).Select(n => (string?)n!).Where(n => n is not null).Select(n => (string)n!).ToList()
        };
    }
}

// ---------- live request budget ledger (runtime mirror of LIVE_REQUEST_BUDGET.md) ----------

/// Hard-ceiling ledger persisted under data/lab/decision-pipeline/budget.json. An attempt is
/// recorded BEFORE dispatch, so a crash cannot silently reset accounting. Failed, timed-out and
/// malformed attempts all count; nothing is ever refunded.
public sealed class DecisionPipelineBudgetLedger
{
    public sealed class Entry
    {
        public int Attempt { get; init; }
        public string RunId { get; init; } = "";
        public string CaseId { get; init; } = "";
        public string Note { get; init; } = "";
        public DateTimeOffset ReservedUtc { get; init; }
        public string Outcome { get; init; } = "reserved"; // reserved | success | failed
    }

    private readonly object _gate = new();
    private readonly string _path;
    public int Ceiling { get; }
    public int Consumed { get; private set; }
    public List<Entry> Entries { get; private set; } = [];
    public int Remaining => Ceiling - Consumed;

    private DecisionPipelineBudgetLedger(string path, int ceiling, int consumed, List<Entry> entries)
    {
        _path = path;
        Ceiling = ceiling;
        Consumed = consumed;
        Entries = entries;
    }

    public static DecisionPipelineBudgetLedger Load(string path, int ceiling)
    {
        if (File.Exists(path))
        {
            var node = JsonNode.Parse(File.ReadAllText(path)) as JsonObject
                ?? throw new InvalidOperationException("budget ledger is not a JSON object");
            var consumed = (int)node["consumed"]!;
            var entries = (node["entries"] as JsonArray ?? []).Select(e => new Entry
            {
                Attempt = (int)e!["attempt"]!,
                RunId = (string?)e!["runId"] ?? "",
                CaseId = (string?)e!["caseId"] ?? "",
                Note = (string?)e!["note"] ?? "",
                ReservedUtc = DateTimeOffset.TryParse((string?)e!["reservedUtc"], CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var t) ? t : DateTimeOffset.UtcNow,
                Outcome = (string?)e!["outcome"] ?? "reserved"
            }).ToList();
            return new DecisionPipelineBudgetLedger(path, ceiling, consumed, entries);
        }
        // First use this milestone: LIVE_REQUEST_BUDGET.md records one consumed attempt (task 07
        // UI verification, 2026-09-21). Import it so the runtime ceiling matches the document.
        var imported = new DecisionPipelineBudgetLedger(path, ceiling, 1,
        [
            new Entry { Attempt = 1, RunId = "task-07-ui-check", CaseId = "dp-d01", Note = "imported from LIVE_REQUEST_BUDGET.md (single live UI demonstration)", ReservedUtc = DateTimeOffset.Parse("2026-09-21T21:27:00Z", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal), Outcome = "success" }
        ]);
        imported.Save();
        return imported;
    }

    /// Reserves the next attempt number, or returns false when the ceiling would be exceeded.
    public bool TryReserve(string runId, string caseId, out int attemptNumber)
    {
        lock (_gate)
        {
            if (Consumed >= Ceiling)
            {
                attemptNumber = 0;
                return false;
            }
            attemptNumber = Consumed + 1;
            Consumed = attemptNumber;
            Entries.Add(new Entry { Attempt = attemptNumber, RunId = runId, CaseId = caseId, ReservedUtc = DateTimeOffset.UtcNow });
            Save();
            return true;
        }
    }

    public void MarkOutcome(int attemptNumber, string outcome)
    {
        lock (_gate)
        {
            var entry = Entries.FirstOrDefault(e => e.Attempt == attemptNumber);
            if (entry is not null)
            {
                Entries[Entries.IndexOf(entry)] = new Entry { Attempt = entry.Attempt, RunId = entry.RunId, CaseId = entry.CaseId, Note = entry.Note, ReservedUtc = entry.ReservedUtc, Outcome = outcome };
                Save();
            }
        }
    }

    private void Save()
    {
        var node = new JsonObject
        {
            ["ceiling"] = Ceiling,
            ["consumed"] = Consumed,
            ["entries"] = new JsonArray(Entries.Select(e => (JsonNode)new JsonObject
            {
                ["attempt"] = e.Attempt, ["runId"] = e.RunId, ["caseId"] = e.CaseId, ["note"] = e.Note,
                ["reservedUtc"] = e.ReservedUtc.ToString("O"), ["outcome"] = e.Outcome
            }).ToArray())
        };
        File.WriteAllText(_path, node.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
    }
}

// ---------- run records ----------

public sealed class DecisionPipelineEvaluationCaseRun
{
    public required string CaseId { get; init; }
    public required string Split { get; init; }
    public required string Family { get; init; }
    public string? ReversalPair { get; init; }
    public required string CustomerText { get; init; }
    public required JsonNode Expected { get; init; }
    /// completed | failed | unattempted (budget exhaustion / cancellation before dispatch).
    public required string Outcome { get; init; }
    public string? Error { get; init; }
    public DecisionPipelineAnswers? Answers { get; init; }
    public DecisionPipelineDecision? Decision { get; init; }
    public decimal ElapsedMs { get; init; }
    public UsageSnapshot? Usage { get; init; }
    /// Global milestone budget attempt number for this dispatch (0 when not dispatched).
    public int BudgetAttempt { get; init; }
    /// Exact raw response body; stored only when EnableTechnicalView is true.
    public string? RawResponse { get; init; }
}

public sealed class DecisionPipelineEvaluationRun
{
    public required string Id { get; init; }
    public required string Split { get; init; }
    public required DateTimeOffset StartedUtc { get; init; }
    public required DateTimeOffset EndedUtc { get; init; }
    /// completed | stopped_budget | cancelled.
    public required string Status { get; init; }
    public required string SemanticVersion { get; init; }
    public required string PolicyVersion { get; init; }
    public required string DatasetVersion { get; init; }
    public required string DatasetSha256 { get; init; }
    public required string Model { get; init; }
    public required DecisionPipelinePolicySettings Settings { get; init; }
    public required int Attempted { get; init; }
    public required int Completed { get; init; }
    public required int Unattempted { get; init; }
    public required int OutboundAttempts { get; init; }
    public required IReadOnlyList<DecisionPipelineEvaluationCaseRun> Cases { get; init; }
    public required JsonNode Metrics { get; init; }
}

// ---------- runner ----------

public sealed class DecisionPipelineEvaluationRunner
{
    private readonly string _runsDir;
    private readonly DecisionPipelineDefinitionConfig _definition;
    private readonly DecisionPipelineCaseDataset _dataset;
    private readonly DecisionPipelineBudgetLedger _budget;
    private readonly Func<DecisionPipelineClient> _client;
    private readonly string _model;
    private readonly bool _enableTechnicalView;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    public DecisionPipelineEvaluationRunner(
        string dataDir,
        DecisionPipelineDefinitionConfig definition,
        DecisionPipelineCaseDataset dataset,
        DecisionPipelineBudgetLedger budget,
        Func<DecisionPipelineClient> client,
        string model,
        bool enableTechnicalView)
    {
        _runsDir = Path.Combine(dataDir, "evaluations");
        Directory.CreateDirectory(_runsDir);
        _definition = definition;
        _dataset = dataset;
        _budget = budget;
        _client = client;
        _model = model;
        _enableTechnicalView = enableTechnicalView;
    }

    public IReadOnlyList<string> ListRunIds()
        => Directory.GetFiles(_runsDir, "*.json").Select(f => (string)Path.GetFileNameWithoutExtension(f)).OrderByDescending(id => id).ToList();

    public DecisionPipelineEvaluationRun? LoadRun(string id)
    {
        if (id.Length == 0 || id.Any(ch => !char.IsAsciiLetterOrDigit(ch) && ch != '-')) return null; // keep resolved paths inside the run directory
        var path = Path.Combine(_runsDir, id + ".json");
        if (!Path.GetFullPath(path).StartsWith(Path.GetFullPath(_runsDir), StringComparison.OrdinalIgnoreCase)) return null;
        if (!File.Exists(path)) return null;
        return JsonSerializer.Deserialize<DecisionPipelineEvaluationRun>(File.ReadAllText(path), Json);
    }

    /// Runs one split sequentially: exactly one attempt per case, no retries. The remaining budget
    /// is checked before EVERY dispatch and the attempt is reserved before the request is sent;
    /// budget exhaustion stops the run with accurate attempted/completed/unattempted counts.
    public async Task<DecisionPipelineEvaluationRun> RunSplitAsync(string split, CancellationToken ct = default)
    {
        var cases = _dataset.Cases.Where(c => c.Split.Equals(split, StringComparison.OrdinalIgnoreCase)).ToList();
        if (cases.Count == 0) throw new InvalidOperationException($"unknown split '{split}'");
        var runId = DateTimeOffset.UtcNow.ToString("yyyyMMdd-HHmmssfff", CultureInfo.InvariantCulture) + "-" + split.ToLowerInvariant();
        var started = DateTimeOffset.UtcNow;
        var runs = new List<DecisionPipelineEvaluationCaseRun>();
        var status = "completed";
        var outbound = 0;

        foreach (var c in cases)
        {
            if (ct.IsCancellationRequested) { status = "cancelled"; break; }
            if (!_budget.TryReserve(runId, c.Id, out var attemptNumber))
            {
                status = "stopped_budget";
                runs.Add(Unattempted(c, "budget ceiling reached"));
                continue;
            }
            outbound++;
            var outcome = await _client().AnalyzeAsync(c.CustomerText, _definition, ct);
            _budget.MarkOutcome(attemptNumber, outcome.ResponseReceived ? "success" : "failed");
            DecisionPipelineDecision? decision = null;
            if (outcome.ResponseReceived)
                decision = DecisionPipelinePolicy.Evaluate(new DecisionPipelinePolicyInput
                {
                    Answers = outcome.Answers,
                    ReturnedModel = outcome.ReturnedModel,
                    EnvelopeErrors = outcome.EnvelopeErrors,
                    Settings = _definition.Policy
                });
            var completed = outcome.ResponseReceived && outcome.EnvelopeErrors.Count == 0
                && outcome.Answers.Routing.Valid && outcome.Answers.Urgency.Valid && outcome.Answers.CancellationRequested.Valid;
            runs.Add(new DecisionPipelineEvaluationCaseRun
            {
                CaseId = c.Id, Split = c.Split, Family = c.Family, ReversalPair = c.ReversalPair,
                CustomerText = c.CustomerText, Expected = ExpectedNode(c),
                Outcome = completed ? "completed" : "failed",
                Error = outcome.FailureCode is null
                    ? (outcome.EnvelopeErrors.Count > 0 ? string.Join("; ", outcome.EnvelopeErrors.Select(e => e.Category + "." + e.Code)) : null)
                    : outcome.FailureCode + (outcome.FailureDetail is null ? "" : ": " + outcome.FailureDetail),
                Answers = outcome.ResponseReceived ? StripRawWhenDisabled(outcome.Answers) : null,
                Decision = decision,
                ElapsedMs = outcome.Diagnostics.ElapsedMs,
                Usage = outcome.Usage,
                BudgetAttempt = attemptNumber,
                RawResponse = _enableTechnicalView ? outcome.Diagnostics.RawResponse : null
            });
        }

        var run = new DecisionPipelineEvaluationRun
        {
            Id = runId,
            Split = split.ToUpperInvariant(),
            StartedUtc = started,
            EndedUtc = DateTimeOffset.UtcNow,
            Status = status,
            SemanticVersion = _definition.SemanticVersion,
            PolicyVersion = _definition.PolicyVersion,
            DatasetVersion = _dataset.DatasetVersion,
            DatasetSha256 = _dataset.Sha256,
            Model = _model,
            Settings = _definition.Policy,
            Attempted = runs.Count(r => r.Outcome != "unattempted"),
            Completed = runs.Count(r => r.Outcome == "completed"),
            Unattempted = runs.Count(r => r.Outcome == "unattempted"),
            OutboundAttempts = outbound,
            Cases = runs,
            Metrics = DecisionPipelineEvaluationMetrics.Compute(JsonSerializer.SerializeToNode(runs, Json)!, _definition.Policy)
        };
        var path = Path.Combine(_runsDir, runId + ".json");
        if (File.Exists(path)) throw new InvalidOperationException("run files are immutable; refusing to overwrite " + runId);
        File.WriteAllText(path, JsonSerializer.Serialize(run, new JsonSerializerOptions(Json) { WriteIndented = true }));
        return run;
    }

    private static DecisionPipelineAnswers StripRawWhenDisabled(DecisionPipelineAnswers answers) => new()
    {
        Routing = answers.Routing with { Raw = null },
        Urgency = answers.Urgency with { Raw = null },
        CancellationRequested = answers.CancellationRequested with { Raw = null }
    };

    private DecisionPipelineEvaluationCaseRun Unattempted(DecisionPipelineEvalCase c, string reason)
        => new()
        {
            CaseId = c.Id, Split = c.Split, Family = c.Family, ReversalPair = c.ReversalPair,
            CustomerText = c.CustomerText, Expected = ExpectedNode(c),
            Outcome = "unattempted", Error = reason
        };

    private static JsonNode ExpectedNode(DecisionPipelineEvalCase c) => new JsonObject
    {
        ["routing"] = c.RoutingAmbiguous ? new JsonObject { ["ambiguous"] = true } : (JsonNode?)(c.ExpectedRouting is null ? null : new JsonObject { ["category"] = c.ExpectedRouting }),
        ["urgency"] = c.ExpectedUrgencyLevel is int level
            ? new JsonObject { ["level"] = level }
            : new JsonObject { ["interval"] = new JsonArray(c.ExpectedUrgencyInterval!.Select(i => (JsonNode)i).ToArray()) },
        ["cancellation"] = new JsonObject { ["label"] = c.ExpectedCancellation },
        ["business"] = new JsonArray(c.Business.Select(b => (JsonNode)b!).ToArray())
    };
}

// ---------- metrics (pure, offline-testable) ----------

/// Computes the frozen evaluation metrics from serialized case runs. Primitive-level Jev results
/// are computed FIRST and independently of policy behavior; thresholded/policy metrics are
/// reported separately and can never replace or inflate the primitive-level results.
public static class DecisionPipelineEvaluationMetrics
{
    public static JsonNode Compute(JsonNode runsNode, DecisionPipelinePolicySettings settings)
    {
        var runs = (runsNode as JsonArray ?? []).Where(r => r is not null).Select(r => (JsonNode)r!).ToList();
        var attempted = runs.Where(r => (string?)r!["outcome"] != "unattempted").ToList();
        var completed = attempted.Where(r => (string?)r!["outcome"] == "completed").ToList();
        var failures = attempted.Where(r => (string?)r!["outcome"] == "failed").ToList();

        // ---- primitive level: routing (determinate labels WITH valid Choice answers only;
        //      invalid answers and ambiguous labels are listed separately, never disagreement counts) ----
        var routingDeterminate = attempted.Where(r => HasDeterminateRouting(r) && RoutingChoice(r) is not null).ToList();
        var routingInvalidAnswers = attempted.Count(r => HasDeterminateRouting(r) && RoutingChoice(r) is null);
        var routingAgree = routingDeterminate.Count(r => RoutingChoice(r) == ExpectedRouting(r));
        var confusion = new JsonObject();
        foreach (var g in routingDeterminate.GroupBy(r => ExpectedRouting(r)))
        {
            var row = new JsonObject();
            foreach (var inner in g.GroupBy(r => RoutingChoice(r) ?? "invalid"))
                row[inner.Key] = inner.Count();
            confusion[g.Key!] = row;
        }
        var routingAmbiguousIds = attempted.Where(r => (bool?)r!["expected"]!["routing"]!["ambiguous"] == true).Select(r => (string?)r!["caseId"]).ToList();

        // ---- primitive level: urgency (point labels: valid Score answers only for MAE;
        //      interval labels: distance to the interval, reported separately) ----
        var pointCases = attempted.Where(r => HasPointUrgency(r) && r["answers"]?["urgency"]?["valid"]?.GetValue<bool>() == true).ToList();
        var urgencyInvalidAnswers = attempted.Count(r => (HasPointUrgency(r) || HasIntervalUrgency(r)) && r["answers"]?["urgency"]?["valid"]?.GetValue<bool>() != true);
        decimal? mae = pointCases.Count == 0 ? null
            : Math.Round(pointCases.Average(r => Math.Abs((decimal)r!["answers"]!["urgency"]!["score"]! - (int)r["expected"]!["urgency"]!["level"]!)), 4);
        var intervalCases = attempted.Where(r => HasIntervalUrgency(r) && r["answers"]?["urgency"]?["valid"]?.GetValue<bool>() == true).ToList();
        decimal? intervalError = intervalCases.Count == 0 ? null
            : Math.Round(intervalCases.Average(r =>
            {
                var score = (decimal)r!["answers"]!["urgency"]!["score"]!;
                var lo = (int)r["expected"]!["urgency"]!["interval"]![0]!;
                var hi = (int)r["expected"]!["urgency"]!["interval"]![1]!;
                return score < lo ? lo - score : score > hi ? score - hi : 0m;
            }), 4);

        // ---- primitive level: raw Noul probability (Brier over definite labels) ----
        var definiteCancellation = attempted.Where(r => (string?)r!["expected"]!["cancellation"]!["label"] is "YES" or "NO").ToList();
        var brierDenominator = definiteCancellation.Count(r => r["answers"]?["cancellationRequested"]?["valid"]?.GetValue<bool>() == true);
        decimal? brier = brierDenominator == 0 ? null
            : Math.Round(definiteCancellation.Where(r => r["answers"]?["cancellationRequested"]?["valid"]?.GetValue<bool>() == true)
                .Average(r =>
                {
                    var p = (decimal)r!["answers"]!["cancellationRequested"]!["probability"]!;
                    var y = (string?)r["expected"]!["cancellation"]!["label"] == "YES" ? 1m : 0m;
                    return (p - y) * (p - y);
                }), 5);
        var unclearCancellationIds = attempted.Where(r => (string?)r!["expected"]!["cancellation"]!["label"] == "UNCLEAR").Select(r => (string?)r!["caseId"]).ToList();

        // ---- policy/workflow: thresholded cancellation (REVIEW = not-YES) ----
        int tp = 0, fp = 0, fn = 0, tn = 0, reviewDispositions = 0;
        foreach (var r in definiteCancellation)
        {
            var disposition = (string?)r!["decision"]?["cancellationDisposition"];
            if (r["answers"]?["cancellationRequested"]?["valid"]?.GetValue<bool>() != true) continue;
            if (disposition == "REVIEW") reviewDispositions++;
            var predictedYes = disposition == "YES";
            var expectedYes = (string?)r["expected"]!["cancellation"]!["label"] == "YES";
            if (expectedYes && predictedYes) tp++;
            else if (expectedYes && !predictedYes) fn++;
            else if (!expectedYes && predictedYes) fp++;
            else tn++;
        }

        // ---- workflow rates ----
        var reviewed = attempted.Count(r => (string?)r!["decision"]?["overallDisposition"] == "human_review");
        var technical = attempted.Count(r => (string?)r!["decision"]?["overallDisposition"] == "technical_failure");

        // ---- ambiguity review capture ----
        var ambiguousIds = attempted
            .Where(r => (bool?)r!["expected"]!["routing"]!["ambiguous"] == true
                || r["expected"]!["urgency"]!["interval"] is not null
                || (string?)r["expected"]!["cancellation"]!["label"] == "UNCLEAR")
            .Select(r => (string)r!["caseId"]!).ToList();
        var ambiguityCapture = ambiguousIds
            .Select(id => attempted.First(r => (string)r!["caseId"]! == id))
            .GroupBy(r => (string?)r!["decision"]?["overallDisposition"] ?? "no_decision")
            .ToDictionary(g => g.Key, g => g.Count());

        // ---- automatic complete recommendations ----
        var accepted = attempted.Where(r => (string?)r!["decision"]?["overallDisposition"] == "policy_eligible").ToList();
        static bool ValidUrgency(JsonNode r) => r["answers"]?["urgency"]?["valid"]?.GetValue<bool>() == true;
        static bool UrgencyIncorrect(JsonNode r, DecisionPipelinePolicySettings s)
            => ValidUrgency(r)
               && r["expected"]!["urgency"]!["level"] is not null
               && Band((decimal)r["answers"]!["urgency"]!["score"]!, s) != Band((decimal)(int)r["expected"]!["urgency"]!["level"]!, s);
        int routingErrors = 0, urgencyErrors = 0, cancellationErrors = 0;
        foreach (var r in accepted)
        {
            if (HasDeterminateRouting(r) && RoutingChoice(r) != ExpectedRouting(r)) routingErrors++;
            if (UrgencyIncorrect(r, settings)) urgencyErrors++;
            if ((string?)r!["expected"]!["cancellation"]!["label"] is "YES" or "NO"
                && r["answers"]?["cancellationRequested"]?["valid"]?.GetValue<bool>() == true
                && (string?)r["decision"]!["cancellationDisposition"] != (string?)r["expected"]!["cancellation"]!["label"])
                cancellationErrors++;
        }
        var incorrect = accepted.Count(r =>
            (HasDeterminateRouting(r) && RoutingChoice(r) != ExpectedRouting(r))
            || UrgencyIncorrect(r, settings)
            || ((string?)r!["expected"]!["cancellation"]!["label"] is "YES" or "NO"
                && r["answers"]?["cancellationRequested"]?["valid"]?.GetValue<bool>() == true
                && (string?)r["decision"]!["cancellationDisposition"] != (string?)r["expected"]!["cancellation"]!["label"]));

        // ---- reversal pairs (descriptive) ----
        var pairs = attempted.Where(r => r!["reversalPair"] is not null && (string?)r!["reversalPair"] != "")
            .GroupBy(r => (string)r!["reversalPair"]!).ToList();
        var pairRows = new JsonArray();
        foreach (var pair in pairs)
        {
            var members = pair.ToList();
            if (members.Count != 2) continue;
            var a = members[0];
            var b = members[1];
            decimal? Score(JsonNode? r) => r?["answers"]?["urgency"]?["valid"]?.GetValue<bool>() == true ? (decimal)r!["answers"]!["urgency"]!["score"]! : null;
            decimal? Noul(JsonNode? r) => r?["answers"]?["cancellationRequested"]?["valid"]?.GetValue<bool>() == true ? (decimal)r!["answers"]!["cancellationRequested"]!["probability"]! : null;
            var sa = Score(a); var sb = Score(b); var na = Noul(a); var nb = Noul(b);
            decimal L1(JsonNode? r)
            {
                if (r?["answers"]?["routing"]?["probabilities"] is not JsonObject probs) return -1m;
                decimal sum = 0;
                foreach (var kv in probs) sum += Math.Abs((decimal)kv.Value! - ((decimal?)b!["answers"]?["routing"]?["probabilities"]?[kv.Key] ?? 0m));
                return Math.Round(sum, 4);
            }
            pairRows.Add(new JsonObject
            {
                ["pair"] = pair.Key,
                ["cases"] = new JsonArray((string)a!["caseId"]!, (string)b!["caseId"]!),
                ["routingSameChoice"] = RoutingChoice(a) is { } ca && RoutingChoice(b) is { } cb && ca == cb,
                ["urgencyScoreDelta"] = sa is not null && sb is not null ? Math.Round(Math.Abs(sa.Value - sb.Value), 4) : null,
                ["noulDelta"] = na is not null && nb is not null ? Math.Round(Math.Abs(na.Value - nb.Value), 4) : null,
                ["routingDistributionL1Delta"] = L1(a)
            });
        }

        // ---- latency / usage ----
        var latencies = attempted.Where(r => r!["answers"] is not null).Select(r => (decimal)r!["elapsedMs"]!).OrderBy(x => x).ToList();
        decimal? Median() => latencies.Count == 0 ? null : latencies.Count % 2 == 1 ? latencies[latencies.Count / 2] : Math.Round((latencies[latencies.Count / 2 - 1] + latencies[latencies.Count / 2]) / 2m, 2);
        // nearest-rank percentile: value at index ceil(p*n)-1
        decimal? P95() => latencies.Count < 20 ? null : latencies[(int)Math.Ceiling(0.95 * latencies.Count) - 1];
        var knownUsage = attempted.Where(r => r!["usage"] is not null).ToList();
        static long ToLong(JsonNode n)
            => long.TryParse(n.ToJsonString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var v) ? v : 0;

        return new JsonObject
        {
            ["primitiveLevel"] = new JsonObject
            {
                ["routing"] = new JsonObject
                {
                    ["determinateLabels"] = routingDeterminate.Count,
                    ["agreement"] = routingAgree,
                    ["agreementRate"] = routingDeterminate.Count == 0 ? null : Math.Round((decimal)routingAgree / routingDeterminate.Count, 4),
                    ["confusionExpectedToReturned"] = confusion,
                    ["ambiguousLabelCaseIds"] = new JsonArray(routingAmbiguousIds.Select(i => (JsonNode)i!).ToArray()),
                    ["invalidOrMissingRoutingAnswers"] = routingInvalidAnswers
                },
                ["urgency"] = new JsonObject
                {
                    ["pointLabels"] = pointCases.Count,
                    ["meanAbsoluteError"] = mae,
                    ["intervalLabels"] = intervalCases.Count,
                    ["intervalError"] = intervalError,
                    ["invalidOrMissingScoreAnswers"] = urgencyInvalidAnswers
                },
                ["cancellationRawNoul"] = new JsonObject
                {
                    ["definiteLabels"] = definiteCancellation.Count,
                    ["brierDenominator"] = brierDenominator,
                    ["brierScore"] = brier,
                    ["excludedUnclear"] = unclearCancellationIds.Count,
                    ["unclearCaseIds"] = new JsonArray(unclearCancellationIds.Select(i => (JsonNode)i!).ToArray()),
                    ["excludedInvalidAnswers"] = definiteCancellation.Count - brierDenominator
                }
            },
            ["policyWorkflow"] = new JsonObject
            {
                ["cancellationThresholded"] = new JsonObject
                {
                    ["tp"] = tp, ["fp"] = fp, ["fn"] = fn, ["tn"] = tn,
                    ["reviewDispositions"] = reviewDispositions,
                    ["precision"] = tp + fp == 0 ? null : Math.Round((decimal)tp / (tp + fp), 4),
                    ["recall"] = tp + fn == 0 ? null : Math.Round((decimal)tp / (tp + fn), 4)
                },
                ["reviewRate"] = attempted.Count == 0 ? null : Math.Round((decimal)reviewed / attempted.Count, 4),
                ["technicalFailureRate"] = attempted.Count == 0 ? null : Math.Round((decimal)technical / attempted.Count, 4),
                ["ambiguityReviewCapture"] = new JsonObject
                {
                    ["ambiguousCaseIds"] = new JsonArray(ambiguousIds.Select(i => (JsonNode)i!).ToArray()),
                    ["byOutcome"] = new JsonObject(ambiguityCapture.Select(kv => new KeyValuePair<string, JsonNode?>(kv.Key, kv.Value)).ToArray()),
                    ["confidentPolicyEligibleOnAmbiguous"] = ambiguityCapture.GetValueOrDefault("policy_eligible", 0)
                },
                ["automaticCompleteRecommendations"] = new JsonObject
                {
                    ["accepted"] = accepted.Count,
                    ["incorrect"] = incorrect,
                    ["incorrectRate"] = accepted.Count == 0 ? null : Math.Round((decimal)incorrect / accepted.Count, 4),
                    ["perOutputErrors"] = new JsonObject { ["routing"] = routingErrors, ["urgencyBand"] = urgencyErrors, ["cancellation"] = cancellationErrors },
                    ["coverageOfAttempted"] = attempted.Count == 0 ? null : Math.Round((decimal)accepted.Count / attempted.Count, 4)
                }
            },
            ["reversalPairs"] = pairRows,
            ["execution"] = new JsonObject
            {
                ["attempted"] = attempted.Count,
                ["completed"] = completed.Count,
                ["failed"] = failures.Count,
                ["failedCaseIds"] = new JsonArray(failures.Select(r => (JsonNode)(string)r!["caseId"]!).ToArray()),
                ["outboundAttempts"] = attempted.Count,
                ["latencyMsCount"] = latencies.Count,
                ["latencyMedianMs"] = Median(),
                ["latencyP95Ms"] = P95(),
                ["latencyMethod"] = "median = middle of sorted per-case elapsed (mean of the two middles for even n); p95 = nearest-rank, reported only with >= 20 observations",
                ["totalInputTokens"] = knownUsage.Count == 0 ? null : knownUsage.Sum(r => ToLong(r!["usage"]!["inputTokens"]!)),
                ["totalOutputTokens"] = knownUsage.Count == 0 ? null : knownUsage.Sum(r => ToLong(r!["usage"]!["outputTokens"]!)),
                ["unknownUsageCount"] = attempted.Count - knownUsage.Count
            }
        };
    }

    private static string? RoutingChoice(JsonNode run)
        => run["answers"]?["routing"]?["valid"]?.GetValue<bool>() == true ? (string?)run["answers"]!["routing"]!["selected"] : null;

    private static string? ExpectedRouting(JsonNode run)
        => (string?)run!["expected"]!["routing"]!["category"];

    private static bool HasDeterminateRouting(JsonNode run)
        => ExpectedRouting(run) is not null;

    private static bool HasPointUrgency(JsonNode run)
        => run["expected"]!["urgency"]!["level"] is not null;

    private static bool HasIntervalUrgency(JsonNode run)
        => run["expected"]!["urgency"]!["interval"] is not null;

    private static string Band(decimal score, DecisionPipelinePolicySettings settings)
        => score < settings.ElevatedAtLeast ? "Normal" : score < settings.UrgentAtLeast ? "Elevated" : "Urgent";
}

// ---------- endpoints ----------

public static class DecisionPipelineEvaluationEndpoints
{
    public static void MapDecisionPipelineEvaluationEndpoints(this WebApplication app, DecisionPipelineEndpointOptions options)
    {
        var definition = DecisionPipelineConfig.Load(Path.Combine(AppContext.BaseDirectory, "config", "decision-pipeline.v1.json"));
        var datasetPath = Path.Combine(AppContext.BaseDirectory, "config", "decision-pipeline-cases.v1.json");
        var dataset = DecisionPipelineCaseDataset.Load(datasetPath);
        var dataDir = Environment.GetEnvironmentVariable("LAB_DATA_DIR")
            ?? (Directory.Exists(Path.Combine(Directory.GetCurrentDirectory(), "data", "raw"))
                ? Path.Combine(Directory.GetCurrentDirectory(), "data", "lab")
                : null);
        dataDir ??= FindRepoRoot() is { } root ? Path.Combine(root, "data", "lab") : Path.Combine(AppContext.BaseDirectory, "data", "lab");
        var pipelineDir = Path.Combine(dataDir, "decision-pipeline");
        Directory.CreateDirectory(pipelineDir);
        var ceilingRaw = app.Configuration["DecisionPipeline:LiveRequestCeiling"];
        var ceiling = int.TryParse(ceilingRaw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var c) && c >= 0 ? c : 1000;
        var budget = DecisionPipelineBudgetLedger.Load(Path.Combine(pipelineDir, "budget.json"), ceiling);
        DecisionPipelineClient? client = null;

        DecisionPipelineEvaluationRunner Runner()
        {
            client ??= new DecisionPipelineClient(
                app.Configuration["TYPESAFE_API_KEY"] ?? throw new InvalidOperationException("TYPESAFE_API_KEY missing (user secrets or environment)."),
                options.Model, options.TimeoutSeconds);
            return new DecisionPipelineEvaluationRunner(pipelineDir, definition, dataset, budget, () => client, options.Model, options.EnableTechnicalView);
        }

        app.MapGet("/api/decision-pipeline/evaluations/cases", () =>
        {
            var cases = dataset.Cases.Select(x => new
            {
                x.Id, x.Split, x.Family, x.ReversalPair, x.Tags, x.CustomerText, x.Synthetic,
                expected = new { routing = x.RoutingAmbiguous ? new { ambiguous = true } : (object?)new { category = x.ExpectedRouting },
                    urgency = x.ExpectedUrgencyLevel is int l ? (object)new { level = l } : new { interval = x.ExpectedUrgencyInterval },
                    cancellation = new { label = x.ExpectedCancellation }, x.Business },
                x.Rationale
            });
            return Results.Json(new { dataset.DatasetVersion, dataset.Sha256, budgetRemaining = budget.Remaining, cases }, options.Json);
        });

        app.MapPost("/api/decision-pipeline/evaluations", async (JsonElement body, CancellationToken ct) =>
        {
            string? split = null;
            try
            {
                if (body.ValueKind == JsonValueKind.Object && body.TryGetProperty("split", out var s) && s.ValueKind == JsonValueKind.String)
                    split = s.GetString();
            }
            catch (JsonException) { split = null; }
            if (split is null || !dataset.Cases.Any(c => c.Split.Equals(split, StringComparison.OrdinalIgnoreCase)))
                return Results.Json(new ApiErrorBody("body must be { \"split\": \"DESIGN\" | \"TEST\" }", "invalid_body"), options.Json, statusCode: 400);
            var caseCount = dataset.Cases.Count(c => c.Split.Equals(split, StringComparison.OrdinalIgnoreCase));
            if (budget.Remaining <= 0)
                return Results.Json(new ApiErrorBody($"live request budget exhausted ({budget.Consumed}/{budget.Ceiling} consumed); the owner can raise the ceiling", "budget_exhausted"), options.Json, statusCode: 409);
            var planned = Math.Min(caseCount, budget.Remaining);
            try
            {
                var run = await Runner().RunSplitAsync(split, ct);
                return Results.Json(new { run, plannedAttempts = planned, budgetRemaining = budget.Remaining }, options.Json);
            }
            catch (InvalidOperationException e) when (e.Message.Contains("TYPESAFE_API_KEY"))
            {
                return Results.Json(new ApiErrorBody(e.Message, "missing_api_key"), options.Json, statusCode: 503);
            }
        });

        app.MapGet("/api/decision-pipeline/evaluations", () =>
        {
            var runner = Runner();
            return Results.Json(runner.ListRunIds().Select(id => runner.LoadRun(id)).Where(r => r is not null).Select(r => new
            {
                r!.Id, r.Split, r.Status, r.StartedUtc, r.EndedUtc, r.DatasetVersion, r.SemanticVersion, r.PolicyVersion,
                r.Attempted, r.Completed, r.Unattempted, r.OutboundAttempts
            }), options.Json);
        });

        app.MapGet("/api/decision-pipeline/evaluations/{id}", (string id) =>
        {
            var run = Runner().LoadRun(id);
            return run is null
                ? Results.Json(new ApiErrorBody($"unknown run id '{id}'", "not_found"), options.Json, statusCode: 404)
                : Results.Json(run, options.Json);
        });

        static string? FindRepoRoot()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "data", "raw"))) dir = dir.Parent;
            return dir?.FullName;
        }
    }
}
