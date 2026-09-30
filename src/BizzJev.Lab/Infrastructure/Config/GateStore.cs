using System.Text.Json;

namespace BizzJev.Lab.Infrastructure.Config;

/// File-backed store for locally authored gate versions + the active-version map.
/// Layout: {root}/{gateId}/v{N}-local.json and {root}/active.json
/// Frozen repository config (config/gates.v1.json) is NEVER written by this store.
public sealed class GateStore
{
    public const string BaselineVersion = "v1";

    private readonly string _root;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public GateStore(string root) => _root = root;

    // ---------- files ----------

    private string LanguageRoot(string language) => language == "sv" ? Path.Combine(_root, "sv") : _root;
    private string GateDir(string gateId, string language) => Path.Combine(LanguageRoot(language), gateId);
    private string VersionFile(string gateId, string version, string language) => Path.Combine(GateDir(gateId, language), $"{version}.json");
    private string ActiveFile(string language) => Path.Combine(LanguageRoot(language), "active.json");

    public sealed class LocalGateVersion
    {
        public required string GateId { get; init; }
        public required string Version { get; init; }
        public required string ParentVersion { get; init; }
        public required DateTimeOffset CreatedAtUtc { get; init; }
        public string? ChangeNote { get; init; }
        public required SemanticGateDefinition Gate { get; init; }
    }

    // ---------- versions ----------

    public List<string> LocalVersions(string gateId, string language = "en")
        => Directory.Exists(GateDir(gateId, language))
            ? Directory.GetFiles(GateDir(gateId, language), "v*-local.json").Select(f => Path.GetFileNameWithoutExtension(f)).Order().ToList()
            : [];

    public int NextLocalNumber(string gateId, string language = "en")
        => LocalVersions(gateId, language)
            .Select(v => v.Split('-')[0])
            .Select(p => p.Length > 1 && int.TryParse(p[1..], out var n) ? n : 0)
            .DefaultIfEmpty(1)
            .Max() + 1;

    /// Saves a NEW immutable local version. Existing versions are never overwritten.
    public LocalGateVersion SaveNewVersion(string gateId, SemanticGateDefinition gate, string parentVersion, string? changeNote, string language = "en")
    {
        ValidateLanguage(language);
        ValidateGate(gate);
        var version = $"v{NextLocalNumber(gateId, language)}-local";
        Directory.CreateDirectory(GateDir(gateId, language));
        if (File.Exists(VersionFile(gateId, version, language)))
            throw new InvalidOperationException("version collision; saved versions are immutable");
        var record = new LocalGateVersion
        {
            GateId = gateId, Version = version, ParentVersion = parentVersion,
            CreatedAtUtc = DateTimeOffset.UtcNow, ChangeNote = changeNote,
            Gate = gate with { GateId = gateId, PromptVersion = version }
        };
        File.WriteAllText(VersionFile(gateId, version, language), JsonSerializer.Serialize(record, Json));
        return record;
    }

    public LocalGateVersion? LoadVersion(string gateId, string version, string language = "en")
    {
        ValidateLanguage(language);
        if (version == BaselineVersion) return null;
        var path = VersionFile(gateId, version, language);
        return File.Exists(path)
            ? JsonSerializer.Deserialize<LocalGateVersion>(File.ReadAllText(path), Json)
            : null;
    }

    public List<LocalGateVersion> LoadAllVersions(string gateId, string language = "en")
        => LocalVersions(gateId, language).Select(v => LoadVersion(gateId, v, language)).Where(r => r is not null).Cast<LocalGateVersion>().ToList();

    // ---------- active map ----------

    private Dictionary<string, string> ReadActiveMap(string language)
        => File.Exists(ActiveFile(language))
            ? JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(ActiveFile(language)), Json) ?? []
            : [];

    public string ActiveVersion(string gateId, string language = "en")
        => ReadActiveMap(language).TryGetValue(gateId, out var v) ? v : BaselineVersion;

    public void SetActive(string gateId, string version, string language = "en")
    {
        ValidateLanguage(language);
        if (version != BaselineVersion && LoadVersion(gateId, version, language) is null)
            throw new InvalidOperationException($"unknown version '{version}' for gate '{gateId}'");
        var map = ReadActiveMap(language);
        if (version == BaselineVersion) map.Remove(gateId); else map[gateId] = version;
        Directory.CreateDirectory(LanguageRoot(language));
        File.WriteAllText(ActiveFile(language), JsonSerializer.Serialize(map, Json));
    }

    /// Removes local gate versions + active overrides, restoring the frozen baseline.
    /// Evaluation data elsewhere under data/lab is untouched.
    public void ResetLocal()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    private static void ValidateLanguage(string language)
    {
        if (language is not ("en" or "sv")) throw new ArgumentException("language must be 'en' or 'sv'");
    }

    public static void ValidateGate(SemanticGateDefinition gate)
    {
        if (string.IsNullOrWhiteSpace(gate.Instructions)) throw new InvalidOperationException("instructions required");
        if (string.IsNullOrWhiteSpace(gate.Criteria?.True) || string.IsNullOrWhiteSpace(gate.Criteria?.False))
            throw new InvalidOperationException("noul criteria requires non-empty true and false");
        if (gate.ReviewThreshold < 0 || gate.AcceptThreshold > 1 || gate.ReviewThreshold > gate.AcceptThreshold)
            throw new InvalidOperationException("thresholds must satisfy 0 <= review <= accept <= 1");
    }
}
