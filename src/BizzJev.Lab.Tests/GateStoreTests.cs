using BizzJev.Lab;
using Xunit;

public sealed class GateStoreTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "gatestore-tests-" + Guid.NewGuid().ToString("N"));
    private readonly GateStore _store;

    public GateStoreTests() => _store = new GateStore(_root);

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }

    private static SemanticGateDefinition Gate(string promptVersion = "v1") => new()
    {
        GateId = "churn_risk", Category = "business_signal", BusinessGoal = "g", SemanticTarget = "t",
        SemanticInterior = "i", SemanticBoundaries = "b", FalsePositiveConsequence = "fp",
        FalseNegativeConsequence = "fn", PolicyProfile = "catch_most", PromptVersion = promptVersion,
        Instructions = "q?", Criteria = new NoulCriteria { True = "yes when", False = "no when" },
        ReviewThreshold = 0.3, AcceptThreshold = 0.7, ActionOnYes = "retention_review", ActionLabel = "l"
    };

    [Fact]
    public void SavesSequentialImmutableVersions_WithMetadata()
    {
        var v2 = _store.SaveNewVersion("churn_risk", Gate(), "v1", "tighten boundary");
        var v3 = _store.SaveNewVersion("churn_risk", Gate(), v2.Version, null);
        Assert.Equal("v2-local", v2.Version);
        Assert.Equal("v3-local", v3.Version);
        Assert.Equal("v1", v2.ParentVersion);
        Assert.Equal("v2-local", v3.ParentVersion);
        Assert.Equal("tighten boundary", v2.ChangeNote);
        Assert.Equal("v2-local", v2.Gate.PromptVersion); // saved gate carries its version
        var loaded = _store.LoadVersion("churn_risk", "v2-local");
        Assert.NotNull(loaded);
        Assert.Equal("tighten boundary", loaded!.ChangeNote);
    }

    [Fact]
    public void SavedVersionFilesAreImmutable()
    {
        _store.SaveNewVersion("churn_risk", Gate(), "v1", "first");
        // Saving again yields a NEW version; the old file is untouched.
        var second = _store.SaveNewVersion("churn_risk", Gate(), "v1", "second");
        Assert.Equal("v3-local", second.Version);
        Assert.NotNull(_store.LoadVersion("churn_risk", "v2-local"));
        Assert.Equal("first", _store.LoadVersion("churn_risk", "v2-local")!.ChangeNote);
    }

    [Fact]
    public void ActiveDefaultsToBaseline_AndCanBeSetAndCleared()
    {
        Assert.Equal("v1", _store.ActiveVersion("churn_risk"));
        var v2 = _store.SaveNewVersion("churn_risk", Gate(), "v1", null);
        _store.SetActive("churn_risk", v2.Version);
        Assert.Equal("v2-local", _store.ActiveVersion("churn_risk"));
        _store.SetActive("churn_risk", "v1");
        Assert.Equal("v1", _store.ActiveVersion("churn_risk"));
        Assert.Throws<InvalidOperationException>(() => _store.SetActive("churn_risk", "v9-local"));
    }

    [Fact]
    public void ResetLocalRemovesVersionsAndActive_LeavesNothingBehind()
    {
        _store.SaveNewVersion("churn_risk", Gate(), "v1", null);
        _store.SetActive("churn_risk", "v2-local");
        _store.ResetLocal();
        Assert.Equal("v1", _store.ActiveVersion("churn_risk"));
        Assert.Empty(_store.LocalVersions("churn_risk"));
    }

    [Fact]
    public void ValidationRejectsBrokenGates()
    {
        Assert.Throws<InvalidOperationException>(() => _store.SaveNewVersion("churn_risk", Gate() with { Instructions = " " }, "v1", null));
        Assert.Throws<InvalidOperationException>(() => _store.SaveNewVersion("churn_risk", Gate() with { Criteria = new NoulCriteria { True = "", False = "x" } }, "v1", null));
        Assert.Throws<InvalidOperationException>(() => _store.SaveNewVersion("churn_risk", Gate() with { ReviewThreshold = 0.9, AcceptThreshold = 0.5 }, "v1", null));
    }
}
