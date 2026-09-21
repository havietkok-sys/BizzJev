using System.Text.Json;
using System.Text.Json.Serialization;
using BizzJev.Lab;
using Microsoft.Extensions.Configuration;

var builder = WebApplication.CreateSlimBuilder(args);
builder.Configuration.AddUserSecrets<Marker>().AddEnvironmentVariables();
var config = builder.Configuration;
string FindRepoRoot()
{
    var dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "data", "raw")))
        dir = dir.Parent;
    return dir?.FullName ?? Directory.GetCurrentDirectory();
}
var dataDir = Environment.GetEnvironmentVariable("LAB_DATA_DIR")
    ?? (Directory.Exists(Path.Combine(Directory.GetCurrentDirectory(), "data", "raw"))
        ? Path.Combine(Directory.GetCurrentDirectory(), "data", "lab")
        : Path.Combine(FindRepoRoot(), "data", "lab"));
var defaultGateSet = config["DefaultGateSet"] ?? "v1";
// Disable Technical View in a production deployment by setting EnableTechnicalView=false.
var enableTechnicalView = !bool.TryParse(config["EnableTechnicalView"], out var etv) || etv;
var model = config["TypeSafe:Model"] ?? throw new InvalidOperationException("TypeSafe:Model required");
var timeout = int.TryParse(config["TypeSafe:TimeoutSeconds"], out var t) && t is >= 1 and <= 300 ? t : 60;
Directory.CreateDirectory(dataDir);
Directory.CreateDirectory(Path.Combine(dataDir, "evaluations"));

var json = new JsonSerializerOptions(JsonSerializerDefaults.Web)
{
    WriteIndented = true,
    Converters = { new JsonStringEnumConverter() }
};

// ---------- stores ----------

var gateStore = new GateStore(Path.Combine(dataDir, "gates"));
string ActiveGateSetVersion = defaultGateSet;

List<SemanticGateDefinition> LoadGates(string version)
{
    var path = Path.Combine(AppContext.BaseDirectory, "config", $"gates.{version}.json");
    if (!File.Exists(path)) throw new InvalidOperationException($"unknown gate set version '{version}'");
    var doc = JsonDocument.Parse(File.ReadAllText(path));
    var gates = doc.RootElement.GetProperty("gates").Deserialize<List<SemanticGateDefinition>>(json)
        ?? throw new InvalidOperationException("gate parse failed");
    return gates;
}

/// Config baseline with per-gate local active overrides applied (Gate Studio).
List<SemanticGateDefinition> LoadActiveGates()
{
    var gates = LoadGates(defaultGateSet);
    var overridden = false;
    for (var i = 0; i < gates.Count; i++)
    {
        var active = gateStore.ActiveVersion(gates[i].GateId);
        if (active == GateStore.BaselineVersion) continue;
        var local = gateStore.LoadVersion(gates[i].GateId, active);
        if (local is null) continue;
        gates[i] = local.Gate;
        overridden = true;
    }
    ActiveGateSetVersion = overridden ? "mixed-local" : defaultGateSet;
    return gates;
}

Dictionary<string, PolicyDefinition> LoadPolicies(List<SemanticGateDefinition> gates)
{
    var overrides = ReadJson<Dictionary<string, ThresholdOverride>>(Path.Combine(dataDir, "policy-overrides.json")) ?? [];
    var custom = overrides.Count > 0;
    return gates.ToDictionary(
        g => g.GateId,
        g => overrides.TryGetValue(g.GateId, out var o)
            ? new PolicyDefinition { GateId = g.GateId, PolicyVersion = "v1-custom", ReviewThreshold = o.ReviewThreshold, AcceptThreshold = o.AcceptThreshold, Profile = g.PolicyProfile }
            : new PolicyDefinition { GateId = g.GateId, PolicyVersion = custom ? "v1-custom" : "v1", ReviewThreshold = g.ReviewThreshold, AcceptThreshold = g.AcceptThreshold, Profile = g.PolicyProfile });
}

List<EvaluationCase> LoadSyntheticCases()
{
    var path = Path.Combine(AppContext.BaseDirectory, "config", "testcases.v1.json");
    var doc = JsonDocument.Parse(File.ReadAllText(path));
    return doc.RootElement.GetProperty("cases").Deserialize<List<EvaluationCase>>(json)!;
}

List<EvaluationCase> LoadSavedCases() =>
    ReadJson<List<EvaluationCase>>(Path.Combine(dataDir, "evaluation-cases.json")) ?? [];

T? ReadJson<T>(string path) where T : class
{
    if (!File.Exists(path)) return null;
    using var doc = JsonDocument.Parse(File.ReadAllText(path));
    return doc.RootElement.Deserialize<T>(json);
}

void WriteJson(string path, object value) => File.WriteAllText(path, JsonSerializer.Serialize(value, json));

List<EvaluationCase> ExpandExpected(List<EvaluationCase> cases, IEnumerable<SemanticGateDefinition> gates)
{
    // Fixture convention: any gate not explicitly labeled defaults to expected NO
    // (YES/UNCLEAR are listed explicitly in testcases.v1.json).
    var gateIds = gates.Select(g => g.GateId).ToList();
    return cases.Select(c => new EvaluationCase
    {
        Id = c.Id, CaseType = c.CaseType, CustomerText = c.CustomerText,
        Expected = gateIds
            .Where(id => c.Expected.All(e => e.GateId != id))
            .Select(id => new ExpectedLabel { GateId = id, Label = "NO" })
            .Concat(c.Expected)
            .ToList(),
        Rationale = c.Rationale, Notes = c.Notes, Synthetic = c.Synthetic, CreatedAtUtc = c.CreatedAtUtc
    }).ToList();
}

JevGateClient? client = null;
JevGateClient Jev()
{
    var key = config["TYPESAFE_API_KEY"];
    if (string.IsNullOrWhiteSpace(key)) throw new InvalidOperationException("TYPESAFE_API_KEY missing (user secrets or environment).");
    return client ??= new JevGateClient(key, model, timeout);
}

// ---------- endpoints ----------

var app = builder.Build();
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/gates", (string? version) =>
{
    var v = version ?? defaultGateSet;
    var gates = LoadGates(v);
    return Results.Json(new
    {
        gateSetVersion = v,
        gates = gates.Select(g => new
        {
            g.GateId, g.Category, g.BusinessGoal, g.SemanticTarget, g.SemanticInterior, g.SemanticBoundaries,
            g.FalsePositiveConsequence, g.FalseNegativeConsequence, g.PolicyProfile, g.PromptVersion, g.Instructions,
            g.ReviewThreshold, g.AcceptThreshold, g.ActionOnYes, g.ActionLabel,
            criteriaTrue = g.Criteria.True, criteriaFalse = g.Criteria.False
        })
    }, json);
});

app.MapGet("/api/policies", () =>
{
    var gates = LoadGates(defaultGateSet);
    var policies = LoadPolicies(gates);
    return Results.Json(policies.Values.ToList(), json);
});

app.MapPut("/api/policies/{gateId}", (string gateId, ThresholdOverride body) =>
{
    var gates = LoadGates(defaultGateSet);
    if (gates.All(g => g.GateId != gateId)) return Results.NotFound(new { error = $"unknown gate {gateId}" });
    if (body.AcceptThreshold < body.ReviewThreshold || body.ReviewThreshold < 0 || body.AcceptThreshold > 1)
        return Results.BadRequest(new { error = "0 <= review <= accept <= 1 required" });
    var overrides = ReadJson<Dictionary<string, ThresholdOverride>>(Path.Combine(dataDir, "policy-overrides.json")) ?? [];
    overrides[gateId] = body with { UpdatedAtUtc = DateTimeOffset.UtcNow };
    WriteJson(Path.Combine(dataDir, "policy-overrides.json"), overrides);
    return Results.Json(LoadPolicies(gates).Values.First(p => p.GateId == gateId), json);
});

app.MapPost("/api/analyze", async (AnalyzeRequest body) =>
{
    if (string.IsNullOrWhiteSpace(body.CustomerText) || body.CustomerText.Length > 8000)
        return Results.BadRequest(new { error = "customerText must be non-empty and at most 8000 characters" });
    var gates = LoadActiveGates().Where(g => g.Active).ToList();
    var version = ActiveGateSetVersion;
    var outcome = await Jev().AnalyzeAsync(body.CustomerText, gates, version);
    var analysis = outcome.Result;
    var policies = LoadPolicies(gates);
    var decisions = PolicyEngine.DecideAll(analysis.Signals, policies);
    var actions = Actions.Derive(decisions, gates.ToDictionary(g => g.GateId));
    return Results.Json(new
    {
        signals = analysis.Signals.Select(s => new { s.GateId, s.Probability, s.ModelVersion, s.PromptVersion, s.Success, s.Error, s.LatencyMs }),
        policy = decisions.Select(d => new { d.GateId, result = d.Result.ToString().ToLowerInvariant(), d.PolicyVersion, d.ReviewThreshold, d.AcceptThreshold }),
        actions = actions.Select(a => new { a.Type, a.SourceGate, a.Label, trigger = a.Trigger.ToString().ToLowerInvariant() }),
        gateSetVersion = version,
        analyzedAtUtc = analysis.AnalyzedAtUtc,
        diagnostics = enableTechnicalView ? outcome.Diagnostics : null
    }, json);
});

app.MapGet("/api/test-cases", () =>
{
    var gates = LoadGates(defaultGateSet);
    return Results.Json(new { synthetic = LoadSyntheticCases(), saved = LoadSavedCases() }, json);
});

app.MapPost("/api/test-cases", (EvaluationCase body) =>
{
    if (string.IsNullOrWhiteSpace(body.CustomerText)) return Results.BadRequest(new { error = "customerText required" });
    if (body.Expected.Any(e => e.Label is not ("YES" or "NO" or "UNCLEAR"))) return Results.BadRequest(new { error = "labels must be YES/NO/UNCLEAR" });
    var gates = LoadGates(defaultGateSet).Select(g => g.GateId).ToHashSet();
    if (body.Expected.Any(e => !gates.Contains(e.GateId))) return Results.BadRequest(new { error = "unknown gateId in expected" });
    var saved = LoadSavedCases();
    var id = body.Id;
    if (string.IsNullOrWhiteSpace(id) || saved.Any(c => c.Id == id))
        id = $"manual-{DateTimeOffset.UtcNow:yyyyMMdd-HHmmssfff}";
    var sanitized = body with { Id = id, Synthetic = false, CreatedAtUtc = DateTimeOffset.UtcNow };
    saved.Add(sanitized);
    WriteJson(Path.Combine(dataDir, "evaluation-cases.json"), saved);
    return Results.Json(sanitized, json);
});

app.MapPost("/api/evaluate", async (string? gateSetVersion) =>
{
    var gates = LoadActiveGates().Where(g => g.Active).ToList();
    var version = ActiveGateSetVersion;
    var gateMap = gates.ToDictionary(g => g.GateId);
    var policies = LoadPolicies(gates);
    var policyVersion = policies.Values.First().PolicyVersion;
    var cases = ExpandExpected(LoadSyntheticCases().Concat(LoadSavedCases()).ToList(), gates);
    var runs = new List<CaseRun>();
    var failures = 0;
    foreach (var c in cases)
    {
        var analysis = (await Jev().AnalyzeAsync(c.CustomerText, gates, version)).Result;
        if (analysis.Signals.Any(s => !s.Success)) failures++;
        var decisions = PolicyEngine.DecideAll(analysis.Signals, policies);
        runs.Add(new CaseRun
        {
            CaseId = c.Id, CaseType = c.CaseType, CustomerText = c.CustomerText,
            Expected = c.Expected, Rationale = c.Rationale, Notes = c.Notes,
            Signals = analysis.Signals, Policy = decisions, Actions = Actions.Derive(decisions, gateMap),
            GateSetVersion = version, PolicyVersion = policyVersion
        });
        Console.WriteLine($"evaluated {runs.Count}/{cases.Count} ({c.Id})");
    }
    var result = new EvaluationResult
    {
        Id = DateTimeOffset.UtcNow.ToString("yyyyMMdd-HHmmssfff"),
        RanAtUtc = DateTimeOffset.UtcNow, GateSetVersion = version, PolicyVersion = policyVersion,
        PerGate = Metrics.Compute(runs, gates.Select(g => g.GateId).ToList()),
        ByCaseType = Metrics.ByCaseType(runs, gates.Select(g => g.GateId).ToList()),
        WeakestRoutingGate = Metrics.WeakestRoutingGate(Metrics.Compute(runs, gates.Select(g => g.GateId).ToList()), gateMap),
        Cases = runs.Count, ApiFailures = failures, Runs = runs
    };
    WriteJson(Path.Combine(dataDir, "evaluations", $"{result.Id}.json"), result);
    return Results.Json(result, json);
});

app.MapGet("/api/evaluation/latest", () =>
{
    var file = Directory.GetFiles(Path.Combine(dataDir, "evaluations")).OrderByDescending(f => f).FirstOrDefault();
    if (file is null) return Results.NotFound(new { error = "no evaluations yet" });
    return Results.Json(ReadJson<EvaluationResult>(file), json);
});

app.MapGet("/api/evaluation/history", () =>
{
    var list = Directory.GetFiles(Path.Combine(dataDir, "evaluations")).OrderByDescending(f => f)
        .Select(f => ReadJson<EvaluationResult>(f))
        .Where(r => r is not null)
        .Select(r => new { r!.Id, r.RanAtUtc, r.GateSetVersion, r.PolicyVersion, r.Cases, r.ApiFailures })
        .ToList();
    return Results.Json(list, json);
});

app.MapGet("/api/evaluation/compare", (string from, string to) =>
{
    var dir = Path.Combine(dataDir, "evaluations");
    EvaluationResult? Load(string id) => Directory.GetFiles(dir).Select(ReadJson<EvaluationResult>).FirstOrDefault(r => r?.Id == id);
    var a = Load(from);
    var b = Load(to);
    if (a is null || b is null) return Results.NotFound(new { error = "unknown evaluation id" });
    var gateIds = a.PerGate.Select(g => g.GateId).ToList();
    return Results.Json(Regression.Compare(a.GateSetVersion, b.GateSetVersion, a.Runs.ToList(), b.Runs.ToList(), gateIds), json);
});


// ---------- Gate Studio ----------

app.MapGet("/api/gates/{gateId}/versions", (string gateId) =>
{
    var baseline = LoadGates(defaultGateSet).FirstOrDefault(g => g.GateId == gateId)
        ?? throw new InvalidOperationException($"unknown gate '{gateId}'");
    var locals = gateStore.LoadAllVersions(gateId);
    var active = gateStore.ActiveVersion(gateId);
    var list = new List<object>
    {
        new { version = GateStore.BaselineVersion, source = "config", parentVersion = "", createdAtUtc = "", changeNote = "Original frozen gate", isActive = active == GateStore.BaselineVersion }
    };
    list.AddRange(locals.Select(r => (object)new { r.Version, source = "local", r.ParentVersion, r.CreatedAtUtc, r.ChangeNote, isActive = r.Version == active }));
    return Results.Json(list, json);
});

app.MapGet("/api/gates/{gateId}/versions/{version}", (string gateId, string version) =>
{
    if (version == GateStore.BaselineVersion)
    {
        var g = LoadGates(defaultGateSet).FirstOrDefault(g => g.GateId == gateId) ?? throw new InvalidOperationException($"unknown gate '{gateId}'");
        return Results.Json(new { version, source = "config", parentVersion = "", createdAtUtc = "", changeNote = "Original frozen gate", gate = g }, json);
    }
    var local = gateStore.LoadVersion(gateId, version);
    return local is null ? Results.NotFound(new { error = $"unknown version '{version}'" }) : Results.Json(new { local.Version, source = "local", local.ParentVersion, local.CreatedAtUtc, local.ChangeNote, local.Gate }, json);
});

app.MapPost("/api/gates/{gateId}/versions", (string gateId, SaveVersionRequest body) =>
{
    _ = LoadGates(defaultGateSet).FirstOrDefault(g => g.GateId == gateId) ?? throw new InvalidOperationException($"unknown gate '{gateId}'");
    try
    {
        var saved = gateStore.SaveNewVersion(gateId, body.Gate, body.ParentVersion, body.ChangeNote);
        return Results.Json(new { saved.Version, saved.ParentVersion, saved.CreatedAtUtc, saved.ChangeNote, saved.Gate }, json);
    }
    catch (InvalidOperationException e) { return Results.BadRequest(new { error = e.Message }); }
});

app.MapPut("/api/gates/{gateId}/active", (string gateId, SetActiveRequest body) =>
{
    try
    {
        gateStore.SetActive(gateId, body.Version);
        return Results.Json(new { gateId, activeVersion = gateStore.ActiveVersion(gateId) });
    }
    catch (InvalidOperationException e) { return Results.BadRequest(new { error = e.Message }); }
});

app.MapPost("/api/gates/{gateId}/draft-test", async (string gateId, DraftTestRequest body) =>
{
    var activeGate = LoadActiveGates().FirstOrDefault(g => g.GateId == gateId) ?? throw new InvalidOperationException($"unknown gate '{gateId}'");
    GateStore.ValidateGate(body.Draft);
    var draftGate = body.Draft with { GateId = "draft", PromptVersion = "draft" };
    var activeProbe = activeGate with { GateId = "active", PromptVersion = activeGate.PromptVersion };
    var outcome = await Jev().AnalyzeAsync(body.CustomerText, [draftGate, activeProbe], "draft-test");
    var draft = outcome.Result.Signals.First(s => s.GateId == "draft");
    var active = outcome.Result.Signals.First(s => s.GateId == "active");
    return Results.Json(new
    {
        draftSignal = draft.Probability, draftOk = draft.Success,
        activeSignal = active.Probability, activeOk = active.Success,
        activeVersion = activeGate.PromptVersion,
        difference = draft.Probability is double d1 && active.Probability is double a1 ? Math.Round(d1 - a1, 3) : (double?)null
    }, json);
});

app.MapPost("/api/gates/{gateId}/draft-evaluate", async (string gateId, DraftEvaluateRequest body) =>
{
    var activeGate = LoadActiveGates().FirstOrDefault(g => g.GateId == gateId) ?? throw new InvalidOperationException($"unknown gate '{gateId}'");
    GateStore.ValidateGate(body.Draft);
    var draftGate = body.Draft with { GateId = "draft", PromptVersion = "draft" };
    var activeProbe = activeGate with { GateId = "active", PromptVersion = activeGate.PromptVersion };
    var probeGates = new[] { draftGate, activeProbe };
    var cases = ExpandExpected(LoadSyntheticCases().Concat(LoadSavedCases()).ToList(), probeGates);
    var rows = new List<DraftCaseResult>();
    foreach (var c in cases)
    {
        var outcome = await Jev().AnalyzeAsync(c.CustomerText, probeGates, "draft-evaluate");
        var dSig = outcome.Result.Signals.First(s => s.GateId == "draft");
        var aSig = outcome.Result.Signals.First(s => s.GateId == "active");
        var expected = c.Expected.FirstOrDefault(e => e.GateId == gateId)?.Label;
        if (expected is not ("YES" or "NO")) continue;
        var dYes = dSig.Probability >= body.Draft.AcceptThreshold;
        var aYes = aSig.Probability >= activeGate.AcceptThreshold;
        rows.Add(new DraftCaseResult
        {
            CaseId = c.Id, CaseType = c.CaseType, CustomerText = c.CustomerText, Expected = expected,
            DraftSignal = dSig.Probability, ActiveSignal = aSig.Probability,
            DraftYes = dYes, ActiveYes = aYes,
            PassedBefore = expected == "YES" ? aYes : !aYes,
            PassedAfter = expected == "YES" ? dYes : !dYes
        });
    }
    var tp = rows.Count(r => r.Expected == "YES" && r.DraftYes);
    var fp = rows.Count(r => r.Expected == "NO" && r.DraftYes);
    var fn = rows.Count(r => r.Expected == "YES" && !r.DraftYes);
    var tn = rows.Count(r => r.Expected == "NO" && !r.DraftYes);
    var atp = rows.Count(r => r.Expected == "YES" && r.ActiveYes);
    var afp = rows.Count(r => r.Expected == "NO" && r.ActiveYes);
    var afn = rows.Count(r => r.Expected == "YES" && !r.ActiveYes);
    var atn = rows.Count(r => r.Expected == "NO" && !r.ActiveYes);
    double? Pr(double t, double f) => t + f == 0 ? null : Math.Round(t / (double)(t + f), 3);
    double? Rc(double t, double fnn) => t + fnn == 0 ? null : Math.Round(t / (double)(t + fnn), 3);
    double? F1(double? pp, double? rr) => pp is null || rr is null || pp + rr == 0 ? null : Math.Round(2 * pp.Value * rr.Value / (pp.Value + rr.Value), 3);
    return Results.Json(new
    {
        gateId, activeVersion = activeGate.PromptVersion,
        before = new { tp = atp, fp = afp, fn = afn, tn = atn, precision = Pr(atp, afp), recall = Rc(atp, afn), f1 = F1(Pr(atp, afp), Rc(atp, afn)) },
        after = new { tp, fp, fn, tn, precision = Pr(tp, fp), recall = Rc(tp, fn), f1 = F1(Pr(tp, fp), Rc(tp, fn)) },
        fixedCases = rows.Where(r => r.PassedAfter && !r.PassedBefore).Select(r => r.CaseId).ToList(),
        brokenCases = rows.Where(r => !r.PassedAfter && r.PassedBefore).Select(r => r.CaseId).ToList(),
        unchangedCases = rows.Where(r => r.PassedAfter == r.PassedBefore).Select(r => r.CaseId).ToList(),
        cases = rows
    }, json);
});

app.MapPost("/api/gates/reset-local", (ResetRequest body) =>
{
    if (!body.Confirm) return Results.BadRequest(new { error = "confirmation required" });
    gateStore.ResetLocal();
    return Results.Json(new { status = "reset", activeGateSet = defaultGateSet });
});

app.MapGet("/api/health", () => Results.Json(new { status = "ok", model, defaultGateSet }));

// ---------- Decision Pipeline (Milestone 2) ----------

DecisionPipelineEndpoints.MapDecisionPipelineEndpoints(app, new DecisionPipelineEndpointOptions
{
    ResolveApiKey = () => config["TYPESAFE_API_KEY"],
    Model = model,
    TimeoutSeconds = timeout,
    EnableTechnicalView = enableTechnicalView,
    Json = json
});

app.Run();

public sealed record ThresholdOverride
{
    public double ReviewThreshold { get; init; }
    public double AcceptThreshold { get; init; }
    public DateTimeOffset UpdatedAtUtc { get; init; }
}

public sealed record AnalyzeRequest(string CustomerText, string? GateSetVersion);

public sealed record SaveVersionRequest(SemanticGateDefinition Gate, string ParentVersion, string? ChangeNote);
public sealed record SetActiveRequest(string Version);
public sealed record DraftTestRequest(SemanticGateDefinition Draft, string CustomerText);
public sealed record DraftEvaluateRequest(SemanticGateDefinition Draft);
public sealed record ResetRequest(bool Confirm);

public sealed class DraftCaseResult
{
    public required string CaseId { get; init; }
    public required string CaseType { get; init; }
    public required string CustomerText { get; init; }
    public required string Expected { get; init; }
    public double? DraftSignal { get; init; }
    public double? ActiveSignal { get; init; }
    public bool DraftYes { get; init; }
    public bool ActiveYes { get; init; }
    public bool PassedBefore { get; init; }
    public bool PassedAfter { get; init; }
}

public sealed class Marker;
