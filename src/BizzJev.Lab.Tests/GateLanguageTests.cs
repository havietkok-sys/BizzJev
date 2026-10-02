using System.Net;
using System.Text;
using System.Text.Json;
using Xunit;

public sealed class GateLanguageTests
{
    [Fact]
    public void DefaultThresholdsFollowSelectedProviderWithoutChangingQuestions()
    {
        static List<SemanticGateDefinition> Load(string file)
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "config", file)));
            return doc.RootElement.GetProperty("gates").Deserialize<List<SemanticGateDefinition>>(new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        }

        var english = Load("gates.v1.json");
        var swedish = Load("gates.v1-sv.json");
        var jev = ProviderThresholdDefaults.Apply(english, "jev", "en", AppContext.BaseDirectory);
        var kevEnglish = ProviderThresholdDefaults.Apply(english, "kev", "en", AppContext.BaseDirectory);
        var kevSwedish = ProviderThresholdDefaults.Apply(swedish, "kev", "sv", AppContext.BaseDirectory);

        Assert.Equal(0.75, jev.Single(g => g.GateId == "billing_problem").AcceptThreshold);
        Assert.Equal(0.3818, kevEnglish.Single(g => g.GateId == "billing_problem").AcceptThreshold);
        Assert.Equal(0.88245, kevEnglish.Single(g => g.GateId == "recurring_problem").AcceptThreshold);
        Assert.Equal(0.7099, kevSwedish.Single(g => g.GateId == "recurring_problem").AcceptThreshold);
        Assert.All(english.Zip(kevEnglish), pair =>
        {
            Assert.Equal(pair.First.GateId, pair.Second.GateId);
            Assert.Equal(pair.First.Instructions, pair.Second.Instructions);
            Assert.Equal(pair.First.Criteria, pair.Second.Criteria);
        });
    }

    [Fact]
    public void SavedCasesWithoutLanguageRemainEnglish()
    {
        var oldCase = JsonSerializer.Deserialize<EvaluationCase>("""{"id":"old","caseType":"demo","customerText":"hello"}""", new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Equal("en", oldCase!.Language);
        var swedish = oldCase with { Language = "sv" };
        Assert.Equal("sv", JsonSerializer.Deserialize<EvaluationCase>(JsonSerializer.Serialize(swedish, new JsonSerializerOptions(JsonSerializerDefaults.Web)), new JsonSerializerOptions(JsonSerializerDefaults.Web))!.Language);
    }

    [Fact]
    public void SwedishCaseSetPairsWithEnglishLabels()
    {
        static JsonDocument Load(string name) => JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "config", name)));
        using var en = Load("testcases.v1.json");
        using var sv = Load("testcases.v1-sv.json");
        Assert.Equal("sv", sv.RootElement.GetProperty("language").GetString());
        var english = en.RootElement.GetProperty("cases").EnumerateArray().ToArray();
        var swedish = sv.RootElement.GetProperty("cases").EnumerateArray().ToArray();
        Assert.Equal(100, english.Length);
        Assert.Equal(english.Length, swedish.Length);
        foreach (var (a, b) in english.Zip(swedish))
        {
            Assert.Equal(a.GetProperty("id").GetString(), b.GetProperty("id").GetString());
            static string[] Labels(JsonElement c) => c.GetProperty("expected").EnumerateArray()
                .Select(x => $"{x.GetProperty("gateId").GetString()}:{x.GetProperty("label").GetString()}").Order().ToArray();
            Assert.Equal(Labels(a), Labels(b));
            Assert.NotEqual(a.GetProperty("customerText").GetString(), b.GetProperty("customerText").GetString());
        }
    }

    [Fact]
    public async Task BothGateSetsSendTheirOwnInstructionsAndCriteriaToJev()
    {
        static (string Version, List<SemanticGateDefinition> Gates) Load(string file)
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "config", file)));
            return (doc.RootElement.GetProperty("gateSetVersion").GetString()!, doc.RootElement.GetProperty("gates").Deserialize<List<SemanticGateDefinition>>(new JsonSerializerOptions(JsonSerializerDefaults.Web))!);
        }

        var en = Load("gates.v1.json");
        var sv = Load("gates.v1-sv.json");
        Assert.Equal("v1", en.Version);
        Assert.Equal("v1-sv", sv.Version);
        Assert.Equal(en.Gates.Select(g => g.GateId), sv.Gates.Select(g => g.GateId));
        foreach (var (english, swedish) in en.Gates.Zip(sv.Gates))
        {
            Assert.NotEqual(english.Instructions, swedish.Instructions);
            Assert.NotEqual(english.Criteria.True, swedish.Criteria.True);
            Assert.NotEqual(english.Criteria.False, swedish.Criteria.False);
            Assert.NotEqual(english.BusinessGoal, swedish.BusinessGoal);
            Assert.NotEqual(english.SemanticTarget, swedish.SemanticTarget);
            Assert.NotEqual(english.SemanticInterior, swedish.SemanticInterior);
            Assert.NotEqual(english.SemanticBoundaries, swedish.SemanticBoundaries);
            Assert.NotEqual(english.FalsePositiveConsequence, swedish.FalsePositiveConsequence);
            Assert.NotEqual(english.FalseNegativeConsequence, swedish.FalseNegativeConsequence);
            Assert.NotEqual(english.ActionLabel, swedish.ActionLabel);
            Assert.Equal(english.ReviewThreshold, swedish.ReviewThreshold);
            Assert.Equal(english.AcceptThreshold, swedish.AcceptThreshold);
            Assert.Equal(english.ActionOnYes, swedish.ActionOnYes);
        }

        foreach (var set in new[] { en, sv })
        {
            var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{}", Encoding.UTF8, "application/json")
            });
            await new JevGateClient(new HttpClient(handler), "jev-test").AnalyzeAsync("hej", set.Gates, set.Version);
            var questions = handler.LastRequest!.RootElement.GetProperty("questions");
            Assert.Equal(set.Gates.Count, questions.EnumerateObject().Count());
            foreach (var gate in set.Gates)
            {
                var sent = questions.GetProperty(gate.GateId);
                Assert.Equal("noul", sent.GetProperty("type").GetString());
                Assert.Equal(gate.Instructions, sent.GetProperty("instructions").GetString());
                Assert.Equal(gate.Criteria.True, sent.GetProperty("criteria").GetProperty("true").GetString());
                Assert.Equal(gate.Criteria.False, sent.GetProperty("criteria").GetProperty("false").GetString());
            }
        }
    }
}
